/**
 * Core data models for budgy-ting.
 * Matches the data model from the product definition.
 * All dates stored as ISO strings without timezone.
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

export interface Budget {
  id: string
  name: string
  currencyLabel: string
  periodType: PeriodType
  startDate: string
  endDate: string | null
  /** Starting balance (e.g. "I have R100k right now"). Null = no balance tracking. */
  startingBalance: number | null
  createdAt: string
  updatedAt: string
}

export interface Expense {
  id: string
  budgetId: string
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
  budgetId: string
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
