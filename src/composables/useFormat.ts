/**
 * Shared number formatting helpers.
 *
 * Requirement: Consistent currency display across all views
 * Approach: Single helper using Intl-backed toLocaleString
 * Alternatives:
 *   - Intl.NumberFormat instance: Considered — toLocaleString is simpler, no locale config needed
 *   - Per-component inline: Rejected — was duplicated across multiple view files
 */

/**
 * Format a number as a 2-decimal-place string with locale grouping.
 */
export function formatAmount(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Format an ISO date string (YYYY-MM-DD) for user display.
 *
 * Requirement: Consistent date display across TransactionTable and TransactionEditModal
 * Approach: Single helper replacing duplicate formatDate/displayDate functions
 * Alternatives:
 *   - Per-component functions: Rejected — identical logic duplicated in 2+ files
 */
export function formatDateForDisplay(
  dateStr: string,
  yearFormat: 'numeric' | '2-digit' = '2-digit',
): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr || '—'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: yearFormat })
}
