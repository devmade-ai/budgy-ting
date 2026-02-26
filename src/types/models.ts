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
  category: string
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
  category: string
  description: string
  originalRow: Record<string, unknown>
  matchConfidence: MatchConfidence
  approved: boolean
  createdAt: string
  updatedAt: string
}

export interface CategoryCache {
  category: string
  lastUsed: string
}
