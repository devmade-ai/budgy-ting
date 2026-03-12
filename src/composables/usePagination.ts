/**
 * Reusable client-side pagination composable.
 *
 * Requirement: Pagination logic duplicated in TransactionTable and ImportStepReview
 * Approach: Extract shared page state, totalPages, and paginated slice into composable
 * Alternatives:
 *   - Duplicate in each component: Rejected — identical ~15-line pattern
 *   - Virtual scrolling: Deferred — pagination is simpler for current data sizes
 */

import { ref, computed, watch } from 'vue'
import type { ComputedRef } from 'vue'

export function usePagination<T>(items: ComputedRef<T[]>, pageSize = 25) {
  const currentPage = ref(1)

  const totalPages = computed(() => Math.max(1, Math.ceil(items.value.length / pageSize)))

  const paginatedItems = computed(() => {
    const start = (currentPage.value - 1) * pageSize
    return items.value.slice(start, start + pageSize)
  })

  // Clamp page when items shrink (e.g. filter change, external deletion)
  watch(totalPages, (pages) => {
    if (currentPage.value > pages) currentPage.value = pages
  })

  function resetPage() {
    currentPage.value = 1
  }

  return {
    currentPage,
    totalPages,
    paginatedItems,
    resetPage,
  }
}
