/**
 * Category autocomplete composable.
 *
 * Requirement: Autocomplete from previously used categories across all budgets
 * Approach: Query categoryCache table, debounced filtering, allow new values
 * Alternatives:
 *   - Query expenses table directly: Rejected — slower, requires distinct aggregation
 *   - In-memory cache: Rejected — categoryCache table handles persistence across sessions
 */

import { ref, watch } from 'vue'
import { db } from '@/db'
import { nowISO } from '@/composables/useTimestamp'

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

    debounceTimer = setTimeout(async () => {
      const allCategories = await db.categoryCache
        .orderBy('lastUsed')
        .reverse()
        .toArray()

      const needle = val.toLowerCase()
      suggestions.value = allCategories
        .map((c) => c.category)
        .filter((cat) => cat.toLowerCase().includes(needle))
        .slice(0, 10)

      isOpen.value = suggestions.value.length > 0
    }, 150)
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
  await db.categoryCache.put({
    category,
    lastUsed: nowISO(),
  })
}
