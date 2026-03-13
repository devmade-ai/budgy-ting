/**
 * Tag autocomplete composable.
 *
 * Requirement: Autocomplete from previously used tags across all workspaces
 * Approach: Dexie startsWithIgnoreCase for prefix matching (uses index), fallback
 *   to substring matching for remaining slots
 * Alternatives:
 *   - Full-table scan + JS filter: Rejected — loads all tags every keystroke
 *   - Query transactions table directly: Rejected — slower, requires distinct aggregation
 *   - In-memory cache: Rejected — tagCache table handles persistence across sessions
 */

import { db } from '@/db'
import { nowISO } from '@/composables/useTimestamp'
import { debugLog } from '@/debug/debugLog'

/** Tags unused for this many months are pruned from autocomplete */
const STALE_TAG_MONTHS = 6

/**
 * Update the tag cache for multiple tags at once.
 */
export async function touchTags(tags: string[]): Promise<void> {
  const now = nowISO()
  try {
    await db.tagCache.bulkPut(
      tags.filter(Boolean).map((tag) => ({ tag, lastUsed: now }))
    )
  } catch {
    // Tag cache is non-critical — silently degrade if DB fails
  }
}

/**
 * Remove tags that haven't been used in 6+ months.
 *
 * Requirement: Prevent typo tags from persisting in autocomplete forever
 * Approach: Delete tagCache entries where lastUsed is older than the cutoff.
 *   Called on app startup to keep autocomplete clean.
 * Alternatives:
 *   - Never prune: Rejected — typos accumulate and clutter autocomplete
 *   - Prune on every touch: Rejected — unnecessary DB churn
 */
export async function pruneStaleTagCache(): Promise<number> {
  try {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - STALE_TAG_MONTHS)
    const cutoffISO = cutoff.toISOString()
    const stale = await db.tagCache.where('lastUsed').below(cutoffISO).toArray()
    if (stale.length > 0) {
      await db.tagCache.bulkDelete(stale.map((t) => t.tag))
    }
    return stale.length
  } catch (e) {
    debugLog('db', 'warn', 'Tag cache prune failed', { error: String(e) })
    return 0
  }
}
