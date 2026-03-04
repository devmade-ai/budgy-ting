/**
 * Daily forecast accuracy tracking engine.
 *
 * Requirement: Track forecast accuracy at daily granularity on aggregate cashflow (not per-category).
 *   Not displayed to users by default. Computed on-the-fly from existing data, not persisted.
 * Approach: Compare daily total forecast spend vs daily total actual spend. Compute MAPE
 *   and weighted MAPE. Categories are for interest/stats in the Compare tab, not for
 *   measuring forecast accuracy.
 * Alternatives:
 *   - Per-category accuracy: Rejected — forecasting is about total cashflow, categories are
 *     for interesting breakdowns only
 *   - Persist accuracy snapshots to IndexedDB: Rejected — stale data risk, schema bloat
 *   - Only monthly accuracy: Rejected — user wants daily granularity for internal tracking
 */

import type { Actual, Expense } from '@/types/models'
import type { ProjectionResult } from './projection'

export interface DailyAccuracyPoint {
  date: string
  /** Total forecasted spend for this day */
  forecastAmount: number
  /** Total actual spend for this day */
  actualAmount: number
  absoluteError: number
  /** null when actual is 0 (can't compute percentage) */
  percentError: number | null
}

export interface AccuracySummary {
  /** Mean Absolute Percentage Error across all days with data */
  mape: number | null
  /** Weighted MAPE (larger amounts count more) */
  weightedMape: number | null
  /** Number of days with both forecast and actual */
  dataPoints: number
}

/**
 * Build daily forecast lookup from projection.
 * Distributes monthly projected expense totals evenly across days.
 * Returns Map<date, totalExpenseAmount>.
 */
function buildDailyForecastLookup(
  projection: ProjectionResult,
): Map<string, number> {
  const lookup = new Map<string, number>()

  for (const slot of projection.months) {
    const monthExpense = projection.monthlyTotals.get(slot.month) ?? 0
    if (monthExpense === 0) continue
    const dailyAmount = monthExpense / slot.daysInMonth

    for (let d = 1; d <= slot.daysInMonth; d++) {
      const dateStr = `${slot.month}-${String(d).padStart(2, '0')}`
      lookup.set(dateStr, (lookup.get(dateStr) ?? 0) + dailyAmount)
    }
  }

  return lookup
}

/**
 * Build daily actual spend totals (expenses only, income excluded).
 * Returns Map<date, totalExpenseAmount>.
 */
function buildDailyActualLookup(
  actuals: Actual[],
  expenses: Expense[],
): Map<string, number> {
  const expenseById = new Map<string, Expense>()
  for (const exp of expenses) expenseById.set(exp.id, exp)

  const lookup = new Map<string, number>()

  for (const actual of actuals) {
    // Skip income actuals — accuracy tracks expense forecasting only
    if (actual.expenseId) {
      const exp = expenseById.get(actual.expenseId)
      if (exp?.type === 'income') continue
    }

    lookup.set(actual.date, (lookup.get(actual.date) ?? 0) + actual.amount)
  }

  return lookup
}

/**
 * Calculate daily accuracy points — comparing total forecast vs total actual spend
 * for each day that has data in both.
 */
export function calculateDailyAccuracy(
  projection: ProjectionResult,
  actuals: Actual[],
  expenses: Expense[],
): DailyAccuracyPoint[] {
  const forecastLookup = buildDailyForecastLookup(projection)
  const actualLookup = buildDailyActualLookup(actuals, expenses)

  const points: DailyAccuracyPoint[] = []

  // For each date that has actuals, compare against forecast
  for (const [date, actualAmount] of actualLookup) {
    const forecastAmount = forecastLookup.get(date)
    if (forecastAmount === undefined) continue // no forecast for this date
    if (forecastAmount === 0 && actualAmount === 0) continue

    const absoluteError = Math.abs(forecastAmount - actualAmount)
    const percentError = actualAmount !== 0
      ? (absoluteError / actualAmount) * 100
      : null

    points.push({
      date,
      forecastAmount: Math.round(forecastAmount * 100) / 100,
      actualAmount,
      absoluteError: Math.round(absoluteError * 100) / 100,
      percentError: percentError !== null ? Math.round(percentError * 100) / 100 : null,
    })
  }

  return points.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Summarise daily accuracy points into aggregate metrics.
 */
export function summariseAccuracy(points: DailyAccuracyPoint[]): AccuracySummary {
  if (points.length === 0) {
    return { mape: null, weightedMape: null, dataPoints: 0 }
  }

  // Overall MAPE
  const withPercent = points.filter((p) => p.percentError !== null)
  const mape = withPercent.length > 0
    ? withPercent.reduce((sum, p) => sum + p.percentError!, 0) / withPercent.length
    : null

  // Weighted MAPE: weight by actual amount
  const totalActualAmount = withPercent.reduce((sum, p) => sum + p.actualAmount, 0)
  const weightedMape = totalActualAmount > 0
    ? withPercent.reduce((sum, p) => sum + p.percentError! * (p.actualAmount / totalActualAmount), 0)
    : null

  return {
    mape: mape !== null ? Math.round(mape * 100) / 100 : null,
    weightedMape: weightedMape !== null ? Math.round(weightedMape * 100) / 100 : null,
    dataPoints: points.length,
  }
}
