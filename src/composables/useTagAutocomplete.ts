/**
 * Tag autocomplete composable.
 *
 * Requirement: Autocomplete from previously used tags across all workspaces
 * Approach: Dexie startsWithIgnoreCase for prefix matching (uses index), fallback
 *   to substring matching for remaining slots
 * Alternatives:
 *   - Full-table scan + JS filter: Rejected — loads all tags every keystroke
 *   - Query expenses table directly: Rejected — slower, requires distinct aggregation
 *   - In-memory cache: Rejected — tagCache table handles persistence across sessions
 */

import { db } from '@/db'
import { nowISO } from '@/composables/useTimestamp'

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
