/**
 * Shared number formatting helpers.
 *
 * Requirement: Consistent currency display across all views
 * Approach: Single helper using Intl-backed toLocaleString
 * Alternatives:
 *   - Intl.NumberFormat instance: Considered — toLocaleString is simpler, no locale config needed
 *   - Per-component inline: Rejected — was duplicated in 4 files (ExpensesTab, ProjectedTab,
 *     CompareTab, ImportWizardView)
 */

/**
 * Format a number as a 2-decimal-place string with locale grouping.
 */
export function formatAmount(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
