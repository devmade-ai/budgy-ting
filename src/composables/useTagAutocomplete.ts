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

import { ref, watch } from 'vue'
import { db } from '@/db'
import { nowISO } from '@/composables/useTimestamp'

const MAX_SUGGESTIONS = 10

export function useTagAutocomplete() {
  const query = ref('')
  const suggestions = ref<string[]>([])
  const isOpen = ref(false)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  watch(query, (val) => {
    if (debounceTimer) clearTimeout(debounceTimer)

    if (!val.trim()) {
      suggestions.value = []
      isOpen.value = false
      return
    }

    // 80ms debounce — snappier for fast typers while still batching keystrokes
    debounceTimer = setTimeout(async () => {
      try {
        const needle = val.toLowerCase().trim()

        // Prefix match via Dexie index (fast, DB-level filtering)
        const prefixMatches = await db.tagCache
          .where('tag')
          .startsWithIgnoreCase(needle)
          .limit(MAX_SUGGESTIONS)
          .sortBy('lastUsed')

        const prefixResults = prefixMatches
          .reverse()
          .map((c) => c.tag)

        // If we have enough prefix matches, use those
        if (prefixResults.length >= MAX_SUGGESTIONS) {
          suggestions.value = prefixResults.slice(0, MAX_SUGGESTIONS)
        } else {
          // Supplement with substring matches (requires broader scan, capped at 100)
          const allTags = await db.tagCache
            .orderBy('lastUsed')
            .reverse()
            .limit(100)
            .toArray()

          const prefixSet = new Set(prefixResults)
          const substringMatches = allTags
            .filter((c) => !prefixSet.has(c.tag) && c.tag.toLowerCase().includes(needle))
            .map((c) => c.tag)

          suggestions.value = [
            ...prefixResults,
            ...substringMatches,
          ].slice(0, MAX_SUGGESTIONS)
        }

        isOpen.value = suggestions.value.length > 0
      } catch {
        // Autocomplete is non-critical — silently degrade if DB fails
        suggestions.value = []
        isOpen.value = false
      }
    }, 80)
  })

  function select(tag: string) {
    query.value = tag
    isOpen.value = false
  }

  function close() {
    isOpen.value = false
  }

  return { query, suggestions, isOpen, select, close }
}

/**
 * Update the tag cache when a tag is used.
 * Call after saving an expense or confirming an import.
 */
export async function touchTag(tag: string): Promise<void> {
  try {
    await db.tagCache.put({
      tag,
      lastUsed: nowISO(),
    })
  } catch {
    // Tag cache is non-critical — silently degrade if DB fails
  }
}

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
