/**
 * Projection calculation engine — pure TypeScript, no UI dependency.
 *
 * Requirement: Expand recurring expenses into monthly amounts based on frequency
 * Approach: For each month in the budget period, calculate each expense's contribution
 * Alternatives:
 *   - Generate all future dates then aggregate: Rejected — memory-heavy for daily items
 *   - Use date-fns for all date math: Deferred — using simple ISO date string math
 *     for MVP to avoid the dependency until import wizard needs it. Will add date-fns
 *     if edge cases warrant it.
 *
 * Decision: For monthly period type (no custom range), use current month + 11 months
 *   as the 12-month rolling view per product definition recommendation.
 */

import type { Budget, Expense } from '@/types/models'

export interface MonthSlot {
  /** ISO month string: YYYY-MM */
  month: string
  /** Year number */
  year: number
  /** Month number (1-12) */
  monthNum: number
  /** First day of month: YYYY-MM-01 */
  firstDay: string
  /** Last day of month: YYYY-MM-DD */
  lastDay: string
  /** Number of days in the month */
  daysInMonth: number
}

export interface ProjectedRow {
  expenseId: string
  description: string
  category: string
  frequency: string
  /** Amount per month slot */
  amounts: Map<string, number>
  /** Total across all months */
  total: number
}

export interface ProjectionResult {
  months: MonthSlot[]
  rows: ProjectedRow[]
  /** Category → month → total */
  categoryRollup: Map<string, Map<string, number>>
  /** Month → total */
  monthlyTotals: Map<string, number>
  grandTotal: number
}

/**
 * Generate an array of MonthSlots between two dates (inclusive).
 */
export function generateMonthSlots(startDate: string, endDate: string): MonthSlot[] {
  const slots: MonthSlot[] = []
  const [startY, startM] = startDate.split('-').map(Number) as [number, number]
  const [endY, endM] = endDate.split('-').map(Number) as [number, number]

  let y = startY
  let m = startM

  while (y < endY || (y === endY && m <= endM)) {
    const daysInMonth = new Date(y, m, 0).getDate()
    const monthStr = `${y}-${String(m).padStart(2, '0')}`
    slots.push({
      month: monthStr,
      year: y,
      monthNum: m,
      firstDay: `${monthStr}-01`,
      lastDay: `${monthStr}-${String(daysInMonth).padStart(2, '0')}`,
      daysInMonth,
    })

    m++
    if (m > 12) {
      m = 1
      y++
    }
  }

  return slots
}

/**
 * Get the default budget period for a monthly-type budget.
 * Current month + 11 months (12-month rolling view).
 */
export function getDefaultPeriod(): { startDate: string; endDate: string } {
  const now = new Date()
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const endMonth = now.getMonth() + 12 // 0-indexed, so +12 gives 11 months ahead
  const endYear = now.getFullYear() + Math.floor(endMonth / 12)
  const endM = (endMonth % 12) || 12
  const daysInEndMonth = new Date(endYear, endM, 0).getDate()
  const endDate = `${endYear}-${String(endM).padStart(2, '0')}-${String(daysInEndMonth).padStart(2, '0')}`

  return { startDate, endDate }
}

/**
 * Resolve the effective start/end dates for a budget.
 *
 * Requirement: Monthly budgets use a 12-month rolling view from current month;
 *   custom budgets use their explicit dates with fallback to defaults.
 * Approach: Single helper to eliminate the 3-file duplication of this logic
 *   (was in ProjectedTab, CompareTab, and exportImport).
 */
export function resolveBudgetPeriod(budget: Pick<Budget, 'startDate' | 'endDate' | 'periodType'>): { startDate: string; endDate: string } {
  let startDate = budget.startDate
  let endDate = budget.endDate

  if (budget.periodType === 'monthly' || !endDate) {
    const defaults = getDefaultPeriod()
    if (!startDate) startDate = defaults.startDate
    if (!endDate) endDate = defaults.endDate
  }

  return { startDate, endDate: endDate! }
}

/**
 * Calculate the amount an expense contributes to a given month.
 */
function calculateMonthAmount(expense: Expense, slot: MonthSlot, budgetEnd: string): number {
  // Determine effective date range for this expense
  const expStart = expense.startDate
  const expEnd = expense.endDate || budgetEnd

  // Check if expense overlaps this month at all
  if (expStart > slot.lastDay || expEnd < slot.firstDay) {
    return 0
  }

  // Clamp the expense range to this month
  const effectiveStart = expStart > slot.firstDay ? expStart : slot.firstDay
  const effectiveEnd = expEnd < slot.lastDay ? expEnd : slot.lastDay

  switch (expense.frequency) {
    case 'once-off': {
      // Once-off appears in the month of its start date
      const expMonth = expStart.slice(0, 7)
      return expMonth === slot.month ? expense.amount : 0
    }

    case 'daily': {
      // Amount × number of days in this month (within bounds)
      const startDay = parseInt(effectiveStart.split('-')[2]!, 10)
      const endDay = parseInt(effectiveEnd.split('-')[2]!, 10)
      const days = endDay - startDay + 1
      return expense.amount * days
    }

    case 'weekly': {
      // Amount × weeks overlapping this month
      const startDay = parseInt(effectiveStart.split('-')[2]!, 10)
      const endDay = parseInt(effectiveEnd.split('-')[2]!, 10)
      const days = endDay - startDay + 1
      const weeks = days / 7
      return expense.amount * weeks
    }

    case 'monthly': {
      // Full amount if month falls within start/end
      return expense.amount
    }

    case 'quarterly': {
      // Amount if this month is a quarter boundary from the start date
      const startMonth = parseInt(expStart.split('-')[1]!, 10)
      const monthDiff = (slot.year - parseInt(expStart.split('-')[0]!, 10)) * 12 +
        (slot.monthNum - startMonth)
      return monthDiff >= 0 && monthDiff % 3 === 0 ? expense.amount : 0
    }

    case 'annually': {
      // Amount if this month matches the anniversary month
      const startMonth = parseInt(expStart.split('-')[1]!, 10)
      return slot.monthNum === startMonth ? expense.amount : 0
    }

    default:
      return 0
  }
}

/**
 * Run the projection engine.
 *
 * @param expenses - List of expense records for the budget
 * @param startDate - Budget period start (ISO date)
 * @param endDate - Budget period end (ISO date)
 */
export function calculateProjection(
  expenses: Expense[],
  startDate: string,
  endDate: string,
): ProjectionResult {
  const months = generateMonthSlots(startDate, endDate)

  const rows: ProjectedRow[] = []
  const categoryRollup = new Map<string, Map<string, number>>()
  const monthlyTotals = new Map<string, number>()
  let grandTotal = 0

  // Initialize monthly totals
  for (const slot of months) {
    monthlyTotals.set(slot.month, 0)
  }

  for (const expense of expenses) {
    const amounts = new Map<string, number>()
    let rowTotal = 0

    for (const slot of months) {
      const amount = calculateMonthAmount(expense, slot, endDate)
      amounts.set(slot.month, amount)
      rowTotal += amount

      // Update monthly totals
      monthlyTotals.set(slot.month, (monthlyTotals.get(slot.month) ?? 0) + amount)

      // Update category rollup
      if (!categoryRollup.has(expense.category)) {
        categoryRollup.set(expense.category, new Map())
      }
      const catMap = categoryRollup.get(expense.category)!
      catMap.set(slot.month, (catMap.get(slot.month) ?? 0) + amount)
    }

    rows.push({
      expenseId: expense.id,
      description: expense.description,
      category: expense.category,
      frequency: expense.frequency,
      amounts,
      total: rowTotal,
    })

    grandTotal += rowTotal
  }

  return { months, rows, categoryRollup, monthlyTotals, grandTotal }
}
