/**
 * Core data models for budgy-ting.
 * All dates stored as ISO strings without timezone.
 *
 * Requirement: Rename Budget → Workspace to reflect that this is a cashflow tool, not just budgeting
 * Approach: Rename the core type and all foreign key references (budgetId → workspaceId)
 * Alternatives:
 *   - Keep "Budget" name: Rejected — misleading since the tool does cashflow forecasting
 *   - Use "Cashflow" as the type name: Rejected — "Workspace" is more generic and future-proof
 */

export type PeriodType = 'monthly' | 'custom'

export type Frequency =
  | 'once-off'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'annually'

/** Whether an expense line represents money coming in or going out */
export type LineType = 'income' | 'expense'

export type MatchConfidence = 'high' | 'medium' | 'low' | 'manual' | 'unmatched'

export interface Workspace {
  id: string
  name: string
  currencyLabel: string
  periodType: PeriodType
  startDate: string
  endDate: string | null
  /** Starting balance (e.g. "I have R100k right now"). Null = no balance tracking. */
  startingBalance: number | null
  /** Whether this is a demo workspace (pre-populated with sample data) */
  isDemo: boolean
  createdAt: string
  updatedAt: string
}

export interface Expense {
  id: string
  workspaceId: string
  description: string
  /**
   * Flexible tags for categorisation, account references, and filtering.
   * First tag is used as the primary "category" for grouping and rollups.
   * Requirement: Multiple category tags instead of single category string
   * Approach: string[] with first-tag-as-primary convention
   * Alternatives:
   *   - Separate category + tags fields: Rejected — adds complexity, tags are sufficient
   *   - Single category string: Rejected — user needs multiple labels (category, account, etc.)
   */
  tags: string[]
  amount: number
  frequency: Frequency
  /** Whether this is income (money in) or expense (money out). Defaults to 'expense'. */
  type: LineType
  startDate: string
  endDate: string | null
  createdAt: string
  updatedAt: string
}

export interface Actual {
  id: string
  workspaceId: string
  expenseId: string | null
  date: string
  amount: number
  /** Tags inherited from matched expense or assigned during import */
  tags: string[]
  description: string
  originalRow: Record<string, unknown>
  matchConfidence: MatchConfidence
  approved: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Cached tag for autocomplete suggestions.
 * Updated whenever a tag is used (expense created/edited, import confirmed).
 */
export interface TagCache {
  tag: string
  lastUsed: string
}

/**
 * Learned mapping from transaction description patterns to tags.
 * Built up over time from imports so future imports auto-suggest tags.
 *
 * Requirement: Auto-categorise imported transactions based on previous imports
 * Approach: Store description→tags mappings, match against new imports
 * Alternatives:
 *   - Full ML classifier: Rejected — overkill for personal finance, large bundle size
 *   - Only manual tagging: Rejected — tedious for users importing the same merchants repeatedly
 */
export interface CategoryMapping {
  id: string
  workspaceId: string
  /** Lowercase pattern to match against transaction descriptions */
  pattern: string
  /** Tags to auto-assign when pattern matches */
  tags: string[]
  /** Whether the mapped transaction is typically income or expense */
  type: LineType
  createdAt: string
}

/** Helper: get the primary tag (first tag) from a tags array, or 'Uncategorised' if empty */
export function primaryTag(tags: string[]): string {
  return tags[0] || 'Uncategorised'
}
