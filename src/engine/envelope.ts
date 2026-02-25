/**
 * Envelope budget calculation engine — pure TypeScript, no UI dependency.
 *
 * Requirement: For budgets with a fixed total amount, calculate remaining balance,
 *   daily burn rate, depletion date, and month-by-month remaining balance after actuals.
 * Approach: Combine projection data with actual spend to produce a running balance.
 *   When actuals are imported, use actual spend for past months and projected spend for
 *   future months to give an updated "reality-adjusted" forecast.
 * Alternatives:
 *   - Merge into projection.ts: Rejected — projection is pure expense expansion;
 *     envelope is a higher-level concept that depends on both projection and actuals
 *   - Client-side computed only: Rejected — engine should be testable independently
 */

import type { ProjectionResult } from './projection'
import type { Actual } from '@/types/models'

export interface EnvelopeMonth {
  /** ISO month string: YYYY-MM */
  month: string
  /** Human-readable label: "Jan 26" */
  monthLabel: string
  /** Projected spend for this month (from expense lines) */
  projected: number
  /** Actual spend for this month (from imported actuals). Null if no actuals imported. */
  actual: number | null
  /** Effective spend used for balance calculation (actual if available, else projected) */
  effectiveSpend: number
  /** Running balance at end of this month */
  remainingBalance: number
}

export interface EnvelopeResult {
  /** The fixed total budget amount */
  startingBalance: number
  /** Total spent so far (sum of all actuals) */
  totalSpent: number
  /** Total projected spend across the budget period */
  totalProjected: number
  /** Current remaining balance (startingBalance - totalSpent) */
  remainingBalance: number
  /** Average daily spend based on actuals (null if no actuals) */
  dailyBurnRate: number | null
  /** Estimated date when budget runs out at current burn rate (null if no actuals or not depleting) */
  depletionDate: string | null
  /** Estimated days remaining at current burn rate (null if no actuals or not depleting) */
  daysRemaining: number | null
  /** Month-by-month breakdown with running balance */
  months: EnvelopeMonth[]
  /** Whether the budget is projected to be exceeded */
  willExceed: boolean
  /** Projected surplus or deficit at end of budget period */
  projectedSurplus: number
}

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Calculate envelope budget status given a fixed total, projection, and actuals.
 */
export function calculateEnvelope(
  startingBalance: number,
  projection: ProjectionResult,
  actuals: Actual[],
  todayISO: string,
): EnvelopeResult {
  // Group actuals by month
  const actualsByMonth = new Map<string, number>()
  let totalSpent = 0

  for (const actual of actuals) {
    const month = actual.date.slice(0, 7)
    actualsByMonth.set(month, (actualsByMonth.get(month) ?? 0) + actual.amount)
    totalSpent += actual.amount
  }

  const currentMonth = todayISO.slice(0, 7)
  const remainingBalance = startingBalance - totalSpent
  const totalProjected = projection.grandTotal

  // Build month-by-month breakdown with running balance
  let runningBalance = startingBalance
  const months: EnvelopeMonth[] = projection.months.map((slot) => {
    const projected = projection.monthlyTotals.get(slot.month) ?? 0
    const actual = actualsByMonth.has(slot.month) ? actualsByMonth.get(slot.month)! : null
    // Use actual spend for past/current months if available, otherwise use projected
    const effectiveSpend = actual !== null ? actual : projected

    runningBalance -= effectiveSpend

    const m = slot.monthNum
    const y = String(slot.year).slice(2)
    const monthLabel = `${monthLabels[m - 1] ?? 'Unknown'} ${y}`

    return {
      month: slot.month,
      monthLabel,
      projected,
      actual,
      effectiveSpend,
      remainingBalance: runningBalance,
    }
  })

  // Calculate burn rate from actuals
  let dailyBurnRate: number | null = null
  let depletionDate: string | null = null
  let daysRemaining: number | null = null

  if (actuals.length > 0 && totalSpent > 0) {
    // Find date range of actuals
    const sortedDates = actuals.map((a) => a.date).sort()
    const firstActualDate = sortedDates[0]!
    const lastDate = currentMonth <= todayISO.slice(0, 10) ? todayISO : sortedDates[sortedDates.length - 1]!

    const firstDate = new Date(firstActualDate + 'T00:00:00')
    const endDate = new Date(lastDate + 'T00:00:00')
    const daysCovered = Math.max(1, Math.round((endDate.getTime() - firstDate.getTime()) / 86_400_000) + 1)

    dailyBurnRate = totalSpent / daysCovered

    if (dailyBurnRate > 0 && remainingBalance > 0) {
      daysRemaining = Math.ceil(remainingBalance / dailyBurnRate)
      const depletionMs = new Date(todayISO + 'T00:00:00').getTime() + daysRemaining * 86_400_000
      const depletionDateObj = new Date(depletionMs)
      depletionDate = depletionDateObj.toISOString().slice(0, 10)
    } else if (remainingBalance <= 0) {
      daysRemaining = 0
      depletionDate = todayISO
    }
  }

  // Calculate projected surplus/deficit
  // Use effective spend (actuals where available, projected where not) for total forecast
  const totalEffectiveSpend = months.reduce((sum, m) => sum + m.effectiveSpend, 0)
  const projectedSurplus = startingBalance - totalEffectiveSpend
  const willExceed = projectedSurplus < 0

  return {
    startingBalance,
    totalSpent,
    totalProjected,
    remainingBalance,
    dailyBurnRate,
    depletionDate,
    daysRemaining,
    months,
    willExceed,
    projectedSurplus,
  }
}
