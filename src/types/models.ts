/**
 * Core data models for budgy-ting.
 * All dates stored as ISO strings (YYYY-MM-DD) without timezone.
 *
 * Requirement: Pivot from budget-first to actuals-first paradigm. "Expense" becomes
 *   "Transaction" — both historic actuals and future predictions are the same entity type.
 *   Signed amounts: positive = income, negative = expense.
 * Approach: Unified Transaction model + RecurringPattern for detected patterns + ImportBatch
 *   for duplicate detection. Clean slate migration (v6) since app is pre-release with zero users.
 * Alternatives:
 *   - Keep separate expenses/actuals tables: Rejected — the unified model simplifies queries
 *     and enables the actuals-first workflow where everything starts as a transaction
 *   - Unsigned amounts with type field: Rejected — signed amounts simplify all arithmetic
 *     (summing, netting, runway calculations) at the cost of Math.abs() in UI formatting
 */

export type PeriodType = 'monthly' | 'custom'

export type Frequency =
  | 'once-off'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'annually'

export type TransactionSource = 'import' | 'manual'

export type TransactionClassification = 'recurring' | 'once-off'

export interface Workspace {
  id: string
  name: string
  currencyLabel: string
  periodType: PeriodType
  startDate: string
  endDate: string | null
  /** Whether this is a demo workspace (pre-populated with sample data) */
  isDemo: boolean
  /** Persisted cash on hand for runway calculations (was ephemeral, now stored) */
  cashOnHand: number | null
  createdAt: string
  updatedAt: string
}

/**
 * Unified transaction — both imported actuals and manually created items.
 * Signed amounts: positive = income, negative = expense.
 */
export interface Transaction {
  id: string
  workspaceId: string
  /** ISO date (YYYY-MM-DD) */
  date: string
  /** Signed amount: positive = income, negative = expense */
  amount: number
  description: string
  /** Flexible tags for categorisation, filtering, account references */
  tags: string[]
  /** How this transaction entered the system */
  source: TransactionSource
  /** User-assigned classification during import */
  classification: TransactionClassification
  /** Links recurring instances together (references RecurringPattern.id) */
  recurringGroupId: string | null
  /** Original CSV row data (null for manual entries) */
  originalRow: Record<string, string> | null
  /** Which import batch this came from (null for manual entries) */
  importBatchId: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Recurring pattern — derived from classified transactions.
 * Represents a detected or user-defined recurring transaction pattern.
 * The expectedAmount is signed (positive = income, negative = expense).
 */
export interface RecurringPattern {
  id: string
  workspaceId: string
  /** Pattern name (e.g., "Netflix", "Rent", "Salary") */
  description: string
  /** Median historical amount (signed: positive = income, negative = expense) */
  expectedAmount: number
  /** Standard deviation of historical amounts (always positive) */
  amountStdDev: number
  frequency: Frequency
  /**
   * Anchor day for scheduling:
   * - daily: ignored
   * - weekly/biweekly: day-of-week (0=Sunday, 6=Saturday)
   * - monthly/quarterly/annually: day-of-month (1-31)
   */
  anchorDay: number
  tags: string[]
  /** Still expected to recur? */
  isActive: boolean
  /** Auto-approve matching transactions in future imports */
  autoAccept: boolean
  /** Most recent occurrence date */
  lastSeenDate: string
  createdAt: string
  updatedAt: string
}

/**
 * Import batch — tracks a single CSV/JSON import for duplicate detection.
 */
export interface ImportBatch {
  id: string
  workspaceId: string
  fileName: string
  dateRange: { start: string; end: string }
  transactionCount: number
  importedAt: string
}

/**
 * Cached tag for autocomplete suggestions.
 * Updated whenever a tag is used (transaction created/edited, import confirmed).
 */
export interface TagCache {
  tag: string
  lastUsed: string
}

/** Helper: get the primary tag (first tag) from a tags array, or 'Uncategorised' if empty */
export function primaryTag(tags: string[]): string {
  return tags[0] || 'Uncategorised'
}

/** Helper: format a signed amount for display (always shows absolute value) */
export function displayAmount(amount: number): number {
  return Math.abs(amount)
}

/** Helper: is this an income transaction (positive amount)? */
export function isIncome(amount: number): boolean {
  return amount > 0
}

/** Helper: is this an expense transaction (negative amount)? */
export function isExpense(amount: number): boolean {
  return amount < 0
}

