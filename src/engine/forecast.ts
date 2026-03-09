/**
 * Hybrid forecasting engine — combines deterministic recurring item scheduling
 * with Holt's double exponential smoothing for variable spending prediction.
 *
 * Requirement: Predict daily cashflow from historical patterns + known recurring items.
 *   Total Daily Cashflow = Recurring Items + Variable Spending + Day-of-Week Adjustment
 * Approach: Hybrid decomposition per FORECASTING_RESEARCH.md:
 *   1. Recurring items: deterministic scheduling from RecurringPattern (handled by patterns.ts)
 *   2. Variable spending residual: Holt's method (level + trend) for trend-aware smoothing
 *   3. Day-of-week seasonality: multipliers for weekday/weekend patterns (needs 4+ weeks)
 *   4. Confidence bands: prediction error distribution with sqrt horizon scaling
 * Alternatives:
 *   - ARIMA: Rejected — complex parameter tuning, heavy WASM dependency (~500KB)
 *   - Simple EMA only: Rejected — misses spending trends (SES always underpredicts if spending increases)
 *   - Holt-Winters triple: Deferred — needs 2+ full seasonal cycles (14+ weeks) to initialise weekly seasonality
 */

import { standardDeviation, mean } from 'simple-statistics'
import type { Transaction, RecurringPattern } from '@/types/models'
import { projectPattern } from './patterns'
import { formatDate } from './dateUtils'
import { debugLog } from '@/debug/debugLog'

// ── Holt's Double Exponential Smoothing ──

export interface HoltState {
  /** Current smoothed level (average daily spend) */
  level: number
  /** Current smoothed trend (per-day change) */
  trend: number
  /** Level smoothing factor (0.1-0.3 for daily data) */
  alpha: number
  /** Trend smoothing factor (0.01-0.1) */
  beta: number
}

/**
 * Level smoothing factor for Holt's method.
 * 0.2 balances responsiveness to recent changes vs stability — standard choice
 * for daily financial data (see Hyndman & Athanasopoulos "Forecasting: Principles and Practice").
 */
const DEFAULT_ALPHA = 0.2

/**
 * Trend smoothing factor for Holt's method.
 * 0.05 dampens trend updates to avoid overfitting daily noise in personal spending.
 */
const DEFAULT_BETA = 0.05

/**
 * Minimum weeks of data required to compute day-of-week seasonality factors.
 * 4 weeks ensures each weekday has at least 4 data points for a stable average.
 */
const MIN_WEEKS_FOR_SEASONALITY = 4

/**
 * Minimum days of history needed for Holt's method. Below this, the trend estimate
 * is too noisy to be useful, so we fall back to a simple average.
 */
const MIN_DAYS_FOR_HOLT = 14

/**
 * Initialise Holt state from a series of daily amounts.
 * Uses the first value as initial level and estimates initial trend
 * from the first few data points.
 */
export function initHolt(
  dailyAmounts: number[],
  alpha: number = DEFAULT_ALPHA,
  beta: number = DEFAULT_BETA,
): HoltState {
  if (dailyAmounts.length === 0) {
    return { level: 0, trend: 0, alpha, beta }
  }

  if (dailyAmounts.length === 1) {
    return { level: dailyAmounts[0]!, trend: 0, alpha, beta }
  }

  // Initial level: first observation
  const level = dailyAmounts[0]!

  // Initial trend: average change over the first min(7, n) points
  const trendWindow = Math.min(7, dailyAmounts.length)
  let trendSum = 0
  for (let i = 1; i < trendWindow; i++) {
    trendSum += dailyAmounts[i]! - dailyAmounts[i - 1]!
  }
  const trend = trendSum / (trendWindow - 1)

  return { level, trend, alpha, beta }
}

/**
 * Update Holt state with a new observation.
 */
export function holtUpdate(state: HoltState, observation: number): HoltState {
  const newLevel = state.alpha * observation + (1 - state.alpha) * (state.level + state.trend)
  const newTrend = state.beta * (newLevel - state.level) + (1 - state.beta) * state.trend
  return { ...state, level: newLevel, trend: newTrend }
}

/**
 * Forecast stepsAhead days from the current Holt state.
 */
export function holtForecast(state: HoltState, stepsAhead: number): number {
  return state.level + stepsAhead * state.trend
}

/**
 * Run Holt's method over a full series, returning the final state
 * and one-step-ahead prediction errors for confidence band calculation.
 */
export function runHolt(
  dailyAmounts: number[],
  alpha: number = DEFAULT_ALPHA,
  beta: number = DEFAULT_BETA,
): { finalState: HoltState; errors: number[] } {
  if (dailyAmounts.length < 2) {
    return {
      finalState: initHolt(dailyAmounts, alpha, beta),
      errors: [],
    }
  }

  let state = initHolt(dailyAmounts, alpha, beta)
  const errors: number[] = []

  // Walk through the series, collecting one-step-ahead prediction errors
  for (let i = 1; i < dailyAmounts.length; i++) {
    const predicted = holtForecast(state, 1)
    const actual = dailyAmounts[i]!
    errors.push(actual - predicted)
    state = holtUpdate(state, actual)
  }

  return { finalState: state, errors }
}

// ── Day-of-Week Seasonality ──

/**
 * Calculate day-of-week multipliers from daily residuals.
 * factors[0] = Monday multiplier, factors[6] = Sunday multiplier.
 * Returns null if insufficient data (< 4 weeks).
 *
 * Requirement: Capture weekday/weekend spending patterns
 * Approach: Average residual per day-of-week / overall average
 * Alternatives:
 *   - Multiplicative on raw amounts: Rejected — calculate on residuals after Holt detrending
 *   - Fixed weekend factor: Rejected — actual patterns vary per user
 */
export function calculateDayOfWeekFactors(
  dailyResiduals: Map<string, number>,
): number[] | null {
  if (dailyResiduals.size < MIN_WEEKS_FOR_SEASONALITY * 7) return null

  const dayTotals = [0, 0, 0, 0, 0, 0, 0]  // Mon-Sun
  const dayCounts = [0, 0, 0, 0, 0, 0, 0]

  for (const [dateStr, amount] of dailyResiduals) {
    const dow = new Date(dateStr + 'T00:00:00').getDay()
    // Adjust: JS getDay() returns 0=Sun, we want 0=Mon
    const adjusted = dow === 0 ? 6 : dow - 1
    dayTotals[adjusted]! += amount
    dayCounts[adjusted]!++
  }

  const allValues = [...dailyResiduals.values()]
  const overallAvg = allValues.length > 0 ? mean(allValues) : 0
  if (Math.abs(overallAvg) < 0.01) return null // avoid division by near-zero

  return dayTotals.map((total, i) =>
    dayCounts[i]! > 0 ? (total / dayCounts[i]!) / overallAvg : 1.0,
  )
}

// ── Confidence / Prediction Bands ──

export interface PredictionBand {
  /** 80th percentile scenario (upper bound) */
  upper: number
  /** 20th percentile scenario (lower bound) */
  lower: number
  /** Point estimate (median/expected value) */
  point: number
}

/**
 * Calculate prediction bands from historical errors.
 * Uses parametric method: stddev * sqrt(horizon) scaling.
 *
 * Requirement: Show "fairly confident between $Y and $Z" not just point estimate
 * Approach: 80% CI using ±1.28 * stddev * sqrt(stepsAhead) — wider bands for further forecasts
 * Alternatives:
 *   - Bootstrap from residuals: More robust for non-normal tails, viable for <1000 daily points.
 *     Deferred as an upgrade path — parametric is simpler and sufficient initially.
 *   - 95% CI: Rejected — too wide to be actionable for personal finance
 */
export function calculatePredictionBands(
  historicalErrors: number[],
  forecast: number,
  stepsAhead: number,
): PredictionBand {
  if (historicalErrors.length < 2) {
    return { point: forecast, upper: forecast, lower: forecast }
  }

  const errorStdDev = standardDeviation(historicalErrors)

  // Prediction uncertainty grows with forecast horizon (random walk assumption).
  // Cap at 90 days — beyond that, bands grow so wide they're not actionable.
  const cappedSteps = Math.min(stepsAhead, 90)
  const horizonFactor = Math.sqrt(Math.max(1, cappedSteps))
  const adjustedStdDev = errorStdDev * horizonFactor

  return {
    point: forecast,
    upper: forecast + 1.28 * adjustedStdDev,   // 80% CI upper
    lower: forecast - 1.28 * adjustedStdDev,    // 80% CI lower
  }
}

// ── Combined Forecast ──

export interface DailyForecastPoint {
  date: string
  /** Total predicted amount (recurring + variable) — signed */
  amount: number
  /** Cumulative running total from forecast start */
  cumulative: number
  /** Prediction band (null for dates with actuals) */
  band: PredictionBand | null
  /** Breakdown of how this point was computed */
  source: 'actual' | 'recurring-only' | 'recurring+variable'
}

export interface ForecastResult {
  /** Daily forecast points */
  daily: DailyForecastPoint[]
  /** Holt state for the variable component (null if insufficient data) */
  variableState: HoltState | null
  /** Day-of-week factors (null if insufficient data) */
  dowFactors: number[] | null
  /** One-step-ahead errors from Holt fitting (for accuracy metrics) */
  predictionErrors: number[]
  /** Method used for variable spending */
  variableMethod: 'holt' | 'average' | 'none'
}

/**
 * Project all active recurring patterns into a daily amount map.
 * Handles irregular patterns by computing daily rate from historical transactions.
 */
function projectRecurringItems(
  patterns: RecurringPattern[],
  transactions: Transaction[],
  startDate: string,
  endDate: string,
): Map<string, number> {
  const activePatterns = patterns.filter((p) => p.isActive)
  const recurringDaily = new Map<string, number>()

  for (const pattern of activePatterns) {
    let projected: Array<{ date: string; amount: number }>

    if (pattern.frequency === 'irregular') {
      const linkedTxns = transactions.filter(
        (t) => t.recurringGroupId === pattern.id && t.date < startDate,
      )
      let totalHistoricalAmount = 0
      let historicalDaySpan = 30
      if (linkedTxns.length > 0) {
        totalHistoricalAmount = linkedTxns.reduce((sum, t) => sum + t.amount, 0)
        const dates = linkedTxns.map((t) => t.date).sort()
        const first = new Date(dates[0]! + 'T00:00:00')
        const last = new Date(dates[dates.length - 1]! + 'T00:00:00')
        historicalDaySpan = Math.max(1, Math.round((last.getTime() - first.getTime()) / 86_400_000))
      }
      projected = projectPattern({ ...pattern, totalHistoricalAmount, historicalDaySpan }, startDate, endDate)
    } else {
      projected = projectPattern(pattern, startDate, endDate)
    }

    for (const point of projected) {
      recurringDaily.set(point.date, (recurringDaily.get(point.date) ?? 0) + point.amount)
    }
  }

  return recurringDaily
}

/**
 * Compute historical daily residuals: total daily amount minus recurring component.
 * Used to isolate the variable spending signal for Holt's method.
 */
function computeHistoricalResiduals(
  transactions: Transaction[],
  patterns: RecurringPattern[],
  startDate: string,
): Map<string, number> {
  const activePatterns = patterns.filter((p) => p.isActive)
  const historicalTxns = transactions.filter((t) => t.date < startDate)

  const historicalByDate = new Map<string, number>()
  for (const t of historicalTxns) {
    historicalByDate.set(t.date, (historicalByDate.get(t.date) ?? 0) + t.amount)
  }

  const historicalRecurring = new Map<string, number>()
  const recurringGroupIds = new Set(activePatterns.map((p) => p.id))
  for (const t of historicalTxns) {
    if (t.recurringGroupId && recurringGroupIds.has(t.recurringGroupId)) {
      historicalRecurring.set(t.date, (historicalRecurring.get(t.date) ?? 0) + t.amount)
    }
  }

  const residualByDate = new Map<string, number>()
  for (const [date, total] of historicalByDate) {
    const recurring = historicalRecurring.get(date) ?? 0
    residualByDate.set(date, total - recurring)
  }

  return residualByDate
}

/**
 * Fit variable spending model (Holt's or simple average) to residual series.
 */
function fitVariableModel(residualSeries: number[]): {
  variableState: HoltState | null
  predictionErrors: number[]
  variableMethod: 'holt' | 'average' | 'none'
  variableDailyForecast: number
} {
  if (residualSeries.length >= MIN_DAYS_FOR_HOLT) {
    const result = runHolt(residualSeries)
    return {
      variableState: result.finalState,
      predictionErrors: result.errors,
      variableMethod: 'holt',
      variableDailyForecast: holtForecast(result.finalState, 1),
    }
  }

  if (residualSeries.length > 0) {
    const avg = mean(residualSeries)
    // Requirement: Generate meaningful prediction bands even with sparse data
    // Approach: Compute residual errors from the simple average so bands aren't flat.
    return {
      variableState: null,
      predictionErrors: residualSeries.map((v) => v - avg),
      variableMethod: 'average',
      variableDailyForecast: avg,
    }
  }

  return { variableState: null, predictionErrors: [], variableMethod: 'none', variableDailyForecast: 0 }
}

/**
 * Assemble the daily forecast point series from recurring + variable components.
 */
function assembleDailyForecast(
  recurringDaily: Map<string, number>,
  variableState: HoltState | null,
  variableMethod: 'holt' | 'average' | 'none',
  variableDailyForecast: number,
  predictionErrors: number[],
  dowFactors: number[] | null,
  startDate: string,
  endDate: string,
): DailyForecastPoint[] {
  const daily: DailyForecastPoint[] = []
  let cumulative = 0
  const cursor = new Date(startDate + 'T00:00:00')
  const endD = new Date(endDate + 'T00:00:00')
  let dayIndex = 0

  while (cursor <= endD) {
    const dateStr = formatDate(cursor)
    dayIndex++

    const recurring = recurringDaily.get(dateStr) ?? 0

    let variable = 0
    if (variableMethod !== 'none') {
      variable = variableMethod === 'holt'
        ? holtForecast(variableState!, dayIndex)
        : variableDailyForecast

      if (dowFactors) {
        const dow = cursor.getDay()
        const adjusted = dow === 0 ? 6 : dow - 1
        variable *= dowFactors[adjusted]!
      }
    }

    const amount = recurring + variable
    cumulative += amount

    let band: PredictionBand | null = null
    if (predictionErrors.length >= 2) {
      band = calculatePredictionBands(predictionErrors, amount, dayIndex)
    }

    const source = variableMethod === 'none' ? 'recurring-only' : 'recurring+variable'

    daily.push({
      date: dateStr,
      amount: Math.round(amount * 100) / 100,
      cumulative: Math.round(cumulative * 100) / 100,
      band: band ? {
        point: Math.round(band.point * 100) / 100,
        upper: Math.round(band.upper * 100) / 100,
        lower: Math.round(band.lower * 100) / 100,
      } : null,
      source,
    })

    cursor.setDate(cursor.getDate() + 1)
  }

  return daily
}

/**
 * Build the combined daily forecast.
 *
 * 1. Compute recurring item schedule from patterns
 * 2. Calculate variable spending residual from historical transactions
 * 3. Apply Holt's method to the residual for trend-aware forecasting
 * 4. Add day-of-week seasonal factors where data permits
 * 5. Produce confidence bands that widen over the forecast horizon
 */
export function buildForecast(
  transactions: Transaction[],
  patterns: RecurringPattern[],
  startDate: string,
  endDate: string,
): ForecastResult {
  const recurringDaily = projectRecurringItems(patterns, transactions, startDate, endDate)
  const residualByDate = computeHistoricalResiduals(transactions, patterns, startDate)

  const sortedDates = [...residualByDate.keys()].sort()
  const residualSeries = sortedDates.map((d) => residualByDate.get(d)!)

  const { variableState, predictionErrors, variableMethod, variableDailyForecast } =
    fitVariableModel(residualSeries)

  const dowFactors = calculateDayOfWeekFactors(residualByDate)

  const daily = assembleDailyForecast(
    recurringDaily, variableState, variableMethod, variableDailyForecast,
    predictionErrors, dowFactors, startDate, endDate,
  )

  debugLog('engine', 'info', 'Forecast built', {
    method: variableMethod,
    forecastDays: daily.length,
    recurringPatterns: patterns.filter((p) => p.isActive).length,
    residualDays: residualSeries.length,
    hasDowFactors: dowFactors !== null,
    holtLevel: variableState?.level,
    holtTrend: variableState?.trend,
  })

  return { daily, variableState, dowFactors, predictionErrors, variableMethod }
}

