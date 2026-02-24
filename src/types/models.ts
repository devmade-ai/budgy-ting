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

export type MatchConfidence = 'high' | 'medium' | 'low' | 'manual' | 'unmatched'

export interface Budget {
  id: string
  name: string
  currencyLabel: string
  periodType: PeriodType
  startDate: string
  endDate: string | null
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
