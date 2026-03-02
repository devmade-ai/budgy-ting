/**
 * Variance calculation engine — compares projected vs actual spend.
 *
 * Requirement: Calculate variance by line item, category, and month
 * Approach: Pure TypeScript module, takes projection data + actuals, returns variance objects
 * Alternatives:
 *   - Calculate in component: Rejected — keeps engine testable and reusable
 */

import type { Actual, Expense } from '@/types/models'
import { primaryTag } from '@/types/models'
import type { ProjectionResult, MonthSlot } from './projection'

export interface LineItemVariance {
  expenseId: string
  description: string
  /** Primary tag used for display/grouping */
  category: string
  /** All tags on the expense line */
  tags: string[]
  budgeted: number
  actual: number
  variance: number
  variancePercent: number | null // null when budgeted is 0
  direction: 'over' | 'under' | 'neutral'
}

export interface CategoryVariance {
  category: string
  budgeted: number
  actual: number
  variance: number
  variancePercent: number | null
  direction: 'over' | 'under' | 'neutral'
}

export interface MonthlyVariance {
  month: string
  monthLabel: string
  projected: number
  actual: number
  variance: number
  variancePercent: number | null
  direction: 'over' | 'under' | 'neutral'
  hasActuals: boolean
}

export interface UnbudgetedActual {
  date: string
  amount: number
  /** Primary tag from the actual's tags */
  category: string
  /** All tags on the actual */
  tags: string[]
  description: string
}

export interface ComparisonResult {
  lineItems: LineItemVariance[]
  categories: CategoryVariance[]
  monthly: MonthlyVariance[]
  unbudgeted: UnbudgetedActual[]
  totalBudgeted: number
  totalActual: number
  totalVariance: number
}

// Half-cent rounding tolerance — amounts below this are treated as zero variance.
// Display-level tolerance (e.g. 5% threshold for colour coding) is handled in CompareTab.
const ROUNDING_TOLERANCE = 0.005

function getDirection(variance: number): 'over' | 'under' | 'neutral' {
  if (Math.abs(variance) < ROUNDING_TOLERANCE) return 'neutral'
  return variance > 0 ? 'over' : 'under'
}

function calcVariancePercent(variance: number, budgeted: number): number | null {
  if (budgeted === 0) return null
  return (variance / budgeted) * 100
}

/**
 * Calculate the full comparison between projected and actual data.
 */
export function calculateComparison(
  projection: ProjectionResult,
  actuals: Actual[],
  expenses: Expense[],
): ComparisonResult {
  // Group actuals by expense ID
  const actualsByExpense = new Map<string | null, Actual[]>()
  for (const actual of actuals) {
    const key = actual.expenseId
    if (!actualsByExpense.has(key)) actualsByExpense.set(key, [])
    actualsByExpense.get(key)!.push(actual)
  }

  // Build expense type lookup to filter out income-matched actuals
  const typeLookup = new Map<string, 'income' | 'expense'>()
  for (const exp of expenses) {
    typeLookup.set(exp.id, exp.type ?? 'expense')
  }
  const expenseActuals = actuals.filter((a) => {
    const type = a.expenseId ? (typeLookup.get(a.expenseId) ?? 'expense') : 'expense'
    return type === 'expense'
  })

  // ── Line item variance (expense lines only — income lines excluded) ──
  const expenseRows = projection.rows.filter((r) => r.type !== 'income')
  const lineItems: LineItemVariance[] = expenseRows.map((row) => {
    const matchedActuals = actualsByExpense.get(row.expenseId) ?? []
    const actualTotal = matchedActuals.reduce((sum, a) => sum + a.amount, 0)
    const variance = actualTotal - row.total

    return {
      expenseId: row.expenseId,
      description: row.description,
      category: row.category,
      tags: row.tags,
      budgeted: row.total,
      actual: actualTotal,
      variance,
      variancePercent: calcVariancePercent(variance, row.total),
      direction: getDirection(variance),
    }
  })

  // ── Category variance (expense categories only, using primary tag) ──
  const categoryMap = new Map<string, { budgeted: number; actual: number }>()

  for (const row of expenseRows) {
    const cat = row.category
    if (!categoryMap.has(cat)) categoryMap.set(cat, { budgeted: 0, actual: 0 })
    categoryMap.get(cat)!.budgeted += row.total
  }

  for (const actual of expenseActuals) {
    if (!actual.expenseId) continue // unbudgeted, handled separately
    const expense = expenses.find((e) => e.id === actual.expenseId)
    if (!expense) continue
    const cat = primaryTag(expense.tags)
    if (!categoryMap.has(cat)) categoryMap.set(cat, { budgeted: 0, actual: 0 })
    categoryMap.get(cat)!.actual += actual.amount
  }

  const categories: CategoryVariance[] = [...categoryMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, data]) => {
      const variance = data.actual - data.budgeted
      return {
        category,
        budgeted: data.budgeted,
        actual: data.actual,
        variance,
        variancePercent: calcVariancePercent(variance, data.budgeted),
        direction: getDirection(variance),
      }
    })

  // ── Monthly variance ──
  // Comparison tracks expense lines only — income actuals are excluded so
  // a salary deposit doesn't inflate "actual spend" in the monthly breakdown.
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  // Group expense-only actuals by month
  const actualsByMonth = new Map<string, number>()
  for (const actual of expenseActuals) {
    const month = actual.date.slice(0, 7)
    actualsByMonth.set(month, (actualsByMonth.get(month) ?? 0) + actual.amount)
  }

  const monthly: MonthlyVariance[] = projection.months.map((slot: MonthSlot) => {
    const projected = projection.monthlyTotals.get(slot.month) ?? 0
    const actualAmount = actualsByMonth.get(slot.month) ?? 0
    const hasActuals = actualsByMonth.has(slot.month)
    const variance = actualAmount - projected

    const m = slot.monthNum
    const y = String(slot.year).slice(2)
    const monthLabel = `${monthLabels[m - 1] ?? 'Unknown'} ${y}`

    return {
      month: slot.month,
      monthLabel,
      projected,
      actual: actualAmount,
      variance,
      variancePercent: calcVariancePercent(variance, projected),
      direction: getDirection(variance),
      hasActuals,
    }
  })

  // ── Unbudgeted actuals ──
  const unbudgeted: UnbudgetedActual[] = (actualsByExpense.get(null) ?? []).map((a) => ({
    date: a.date,
    amount: a.amount,
    category: primaryTag(a.tags),
    tags: a.tags,
    description: a.description,
  }))

  // ── Totals (expense-only — income actuals excluded) ──
  const totalBudgeted = projection.grandTotal
  const totalActual = expenseActuals.reduce((sum, a) => sum + a.amount, 0)
  const totalVariance = totalActual - totalBudgeted

  return {
    lineItems,
    categories,
    monthly,
    unbudgeted,
    totalBudgeted,
    totalActual,
    totalVariance,
  }
}
