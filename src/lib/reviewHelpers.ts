/**
 * Format a byte count as a human-readable storage size.
 * KB below 1 MB, MB below 1 GB, GB above. Avoids decimals on small KB
 * counts and caps fractional digits at 2 for GB.
 *
 * Used by the workspace-list storage indicator.
 */
export function formatStorageSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * Reconcile tag-input index and pagination state after a row is spliced
 * out of the import-review transactions list.
 *
 * - tagInputIndex pointing at the removed row → unset (-1)
 * - tagInputIndex on a later row → shift down by 1 to track the same row
 * - currentPage past totalPages after splice → clamp to last valid page
 *
 * Pure so the splice flow can be unit-tested without mounting the component.
 */
export function reconcileRemoveRow(
  input: { tagInputIndex: number; currentPage: number; totalPagesAfter: number; removedIndex: number },
): { tagInputIndex: number; currentPage: number } {
  const { tagInputIndex, currentPage, totalPagesAfter, removedIndex } = input
  let nextTagInputIndex = tagInputIndex
  if (tagInputIndex === removedIndex) {
    nextTagInputIndex = -1
  } else if (tagInputIndex > removedIndex) {
    nextTagInputIndex = tagInputIndex - 1
  }
  const nextCurrentPage = currentPage > totalPagesAfter
    ? Math.max(1, totalPagesAfter)
    : currentPage
  return { tagInputIndex: nextTagInputIndex, currentPage: nextCurrentPage }
}
