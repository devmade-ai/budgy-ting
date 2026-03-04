/**
 * Statistical forecasting engine — layered on top of the deterministic projection engine.
 *
 * Requirement: Aggregate cashflow forecasting using EMA and rolling averages, plus daily
 *   granularity expansion for cashflow graphing. Deterministic projection remains the
 *   source of truth for fixed/recurring items. Forecasting operates on total cashflow,
 *   not per-category — categories/tags are for interest stats only.
 * Approach: EMA (alpha=0.3) for aggregate spend with 3+ months of actuals history,
 *   rolling average fallback for fewer data points. Daily expansion distributes monthly
 *   amounts across days for chart consumption.
 * Alternatives:
 *   - ML classifier (Prophet, ARIMA): Rejected — overkill for personal finance with small datasets
 *   - simple-statistics library: Deferred — manual EMA/rolling avg is ~30 lines, avoids dependency
 *   - Per-category forecasting: Rejected — forecasting is about total cashflow, categories are
 *     for interesting breakdowns in Compare tab
 */

import type { Actual, Expense } from '@/types/models'
import type { ProjectionResult } from './projection'

/** EMA smoothing factor — 0.3 weights recent months more heavily */
const EMA_ALPHA = 0.3

/** Minimum months of actuals to use EMA (below this, use rolling average) */
const EMA_MIN_MONTHS = 3

export type ForecastMethod = 'deterministic' | 'ema' | 'rolling-average'

export interface CashflowForecast {
  method: ForecastMethod
  /** Predicted monthly net cashflow */
  predicted: number
  /** Upper/lower confidence band (null for deterministic or insufficient data) */
  confidenceBand: { upper: number; lower: number } | null
  /** Number of actuals months used */
  dataPoints: number
}

export interface DailyPoint {
  date: string
  amount: number
  cumulative: number
}

export interface DailyCashflowData {
  /** Actual daily amounts (from uploaded actuals) */
  actuals: DailyPoint[]
  /** Forecasted daily amounts (from projection + statistical models) */
  forecast: DailyPoint[]
  /** Combined: actuals where available, forecast where not */
  combined: DailyPoint[]
}

/**
 * Compute aggregate monthly expense totals from actuals (income excluded).
 * Returns Map<YYYY-MM, totalExpense>.
 */
export function groupActualsByMonth(
  actuals: Actual[],
  expenses: Expense[],
): Map<string, number> {
  const expenseById = new Map<string, Expense>()
  for (const exp of expenses) expenseById.set(exp.id, exp)

  const result = new Map<string, number>()

  for (const actual of actuals) {
    // Skip income actuals
    if (actual.expenseId && expenseById.has(actual.expenseId)) {
      if (expenseById.get(actual.expenseId)!.type === 'income') continue
    }

    const month = actual.date.slice(0, 7)
    result.set(month, (result.get(month) ?? 0) + actual.amount)
  }

  return result
}

/**
 * Calculate Exponential Moving Average for a time series.
 * Values should be in chronological order.
 */
export function calculateEMA(values: number[], alpha: number = EMA_ALPHA): number {
  if (values.length === 0) return 0
  if (values.length === 1) return values[0]!

  let ema = values[0]!
  for (let i = 1; i < values.length; i++) {
    ema = alpha * values[i]! + (1 - alpha) * ema
  }
  return ema
}

/**
 * Calculate rolling average for a time series.
 */
export function calculateRollingAverage(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/**
 * Calculate standard deviation for confidence bands.
 */
function standardDeviation(values: number[], mean: number): number {
  if (values.length < 2) return 0
  const sumSqDiff = values.reduce((sum, v) => sum + (v - mean) ** 2, 0)
  return Math.sqrt(sumSqDiff / (values.length - 1))
}

/**
 * Generate aggregate cashflow forecast from actuals history.
 * Uses EMA with 3+ months, rolling average otherwise.
 */
export function generateCashflowForecast(
  actuals: Actual[],
  expenses: Expense[],
): CashflowForecast | null {
  const monthlyTotals = groupActualsByMonth(actuals, expenses)
  if (monthlyTotals.size === 0) return null

  const sortedMonths = [...monthlyTotals.keys()].sort()
  const values = sortedMonths.map((m) => monthlyTotals.get(m) ?? 0)

  let predicted: number
  let method: ForecastMethod
  let confidenceBand: { upper: number; lower: number } | null = null

  if (values.length >= EMA_MIN_MONTHS) {
    method = 'ema'
    predicted = calculateEMA(values)
    const stdDev = standardDeviation(values, predicted)
    confidenceBand = {
      upper: predicted + stdDev,
      lower: Math.max(0, predicted - stdDev),
    }
  } else {
    method = 'rolling-average'
    predicted = calculateRollingAverage(values)
  }

  return { method, predicted, confidenceBand, dataPoints: values.length }
}

/**
 * Expand actuals into daily data points for charting.
 * Groups all actuals by date, computes net daily amount and cumulative running total.
 */
export function expandActualsToDailyPoints(
  actuals: Actual[],
  expenses: Expense[],
  startDate: string,
  endDate: string,
): DailyPoint[] {
  const expenseById = new Map<string, Expense>()
  for (const exp of expenses) expenseById.set(exp.id, exp)

  // Group by date
  const dailyNet = new Map<string, number>()
  for (const actual of actuals) {
    if (actual.date < startDate || actual.date > endDate) continue

    const isIncome = actual.expenseId
      ? (expenseById.get(actual.expenseId)?.type === 'income')
      : false

    const sign = isIncome ? 1 : -1
    const current = dailyNet.get(actual.date) ?? 0
    dailyNet.set(actual.date, current + sign * actual.amount)
  }

  // Sort dates and build cumulative series
  const sortedDates = [...dailyNet.keys()].sort()
  const points: DailyPoint[] = []
  let cumulative = 0

  for (const date of sortedDates) {
    const amount = dailyNet.get(date)!
    cumulative += amount
    points.push({ date, amount, cumulative })
  }

  return points
}

/**
 * Expand forecast (projection) into daily data points for charting.
 * Distributes monthly projected net amounts evenly across days.
 */
export function expandForecastToDailyPoints(
  projection: ProjectionResult,
  startDate: string,
  endDate: string,
): DailyPoint[] {
  const points: DailyPoint[] = []
  let cumulative = 0

  for (const slot of projection.months) {
    const monthNet = projection.monthlyNet.get(slot.month) ?? 0
    const dailyAmount = monthNet / slot.daysInMonth

    for (let d = 1; d <= slot.daysInMonth; d++) {
      const dateStr = `${slot.month}-${String(d).padStart(2, '0')}`
      if (dateStr < startDate || dateStr > endDate) continue

      cumulative += dailyAmount
      points.push({
        date: dateStr,
        amount: Math.round(dailyAmount * 100) / 100,
        cumulative: Math.round(cumulative * 100) / 100,
      })
    }
  }

  return points
}

/**
 * Build the full daily cashflow dataset for charting.
 * Merges actual daily data with forecast daily data.
 */
export function buildDailyCashflowData(
  actuals: Actual[],
  expenses: Expense[],
  projection: ProjectionResult,
  startDate: string,
  endDate: string,
): DailyCashflowData {
  const actualPoints = expandActualsToDailyPoints(actuals, expenses, startDate, endDate)
  const forecastPoints = expandForecastToDailyPoints(projection, startDate, endDate)

  const actualsMap = new Map<string, DailyPoint>()
  for (const p of actualPoints) actualsMap.set(p.date, p)

  const allDates = new Set<string>()
  for (const p of actualPoints) allDates.add(p.date)
  for (const p of forecastPoints) allDates.add(p.date)

  const sortedDates = [...allDates].sort()
  const combined: DailyPoint[] = []
  let combinedCumulative = 0

  for (const date of sortedDates) {
    const actualPoint = actualsMap.get(date)
    const amount = actualPoint ? actualPoint.amount : (
      forecastPoints.find((p) => p.date === date)?.amount ?? 0
    )
    combinedCumulative += amount
    combined.push({
      date,
      amount: Math.round(amount * 100) / 100,
      cumulative: Math.round(combinedCumulative * 100) / 100,
    })
  }

  return { actuals: actualPoints, forecast: forecastPoints, combined }
}
