/**
 * Category autocomplete composable.
 *
 * Requirement: Autocomplete from previously used categories across all budgets
 * Approach: Dexie startsWithIgnoreCase for prefix matching (uses index), fallback
 *   to substring matching for remaining slots
 * Alternatives:
 *   - Full-table scan + JS filter: Rejected — loads all categories every keystroke
 *   - Query expenses table directly: Rejected — slower, requires distinct aggregation
 *   - In-memory cache: Rejected — categoryCache table handles persistence across sessions
 */

import { ref, watch } from 'vue'
import { db } from '@/db'
import { nowISO } from '@/composables/useTimestamp'

const MAX_SUGGESTIONS = 10

export function useCategoryAutocomplete() {
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
        const prefixMatches = await db.categoryCache
          .where('category')
          .startsWithIgnoreCase(needle)
          .limit(MAX_SUGGESTIONS)
          .sortBy('lastUsed')

        const prefixResults = prefixMatches
          .reverse()
          .map((c) => c.category)

        // If we have enough prefix matches, use those
        if (prefixResults.length >= MAX_SUGGESTIONS) {
          suggestions.value = prefixResults.slice(0, MAX_SUGGESTIONS)
        } else {
          // Supplement with substring matches (requires broader scan, capped at 100)
          const allCategories = await db.categoryCache
            .orderBy('lastUsed')
            .reverse()
            .limit(100)
            .toArray()

          const prefixSet = new Set(prefixResults)
          const substringMatches = allCategories
            .filter((c) => !prefixSet.has(c.category) && c.category.toLowerCase().includes(needle))
            .map((c) => c.category)

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

  function select(category: string) {
    query.value = category
    isOpen.value = false
  }

  function close() {
    isOpen.value = false
  }

  return { query, suggestions, isOpen, select, close }
}

/**
 * Update the category cache when a category is used.
 * Call after saving an expense.
 */
export async function touchCategory(category: string): Promise<void> {
  try {
    await db.categoryCache.put({
      category,
      lastUsed: nowISO(),
    })
  } catch {
    // Category cache is non-critical — silently degrade if DB fails
  }
}
