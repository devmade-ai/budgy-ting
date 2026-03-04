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

import { standardDeviation, mean, quantileSorted } from 'simple-statistics'
import type { Transaction, RecurringPattern } from '@/types/models'
import { projectPattern } from './patterns'

// ── Legacy compatibility types and stubs ──
// Kept for backward compat with CashflowChart.vue and ProjectedTab.vue.
// Will be removed when the UI migrates to the new forecast model (Phase 4).

export interface DailyPoint {
  date: string
  amount: number
  cumulative: number
}

/** Legacy stub — returns empty array. Replaced by buildForecast(). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function expandActualsToDailyPoints(..._args: unknown[]): DailyPoint[] {
  return []
}

/** Legacy stub — returns empty array. Replaced by buildForecast(). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function expandForecastToDailyPoints(..._args: unknown[]): DailyPoint[] {
  return []
}

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

/** Default parameters for daily personal finance data */
const DEFAULT_ALPHA = 0.2
const DEFAULT_BETA = 0.05

/** Minimum weeks of data for day-of-week seasonality */
const MIN_WEEKS_FOR_SEASONALITY = 4

/** Minimum days of data for Holt's method (below this, use simple average) */
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

  // Prediction uncertainty grows with forecast horizon (random walk assumption)
  const horizonFactor = Math.sqrt(Math.max(1, stepsAhead))
  const adjustedStdDev = errorStdDev * horizonFactor

  return {
    point: forecast,
    upper: forecast + 1.28 * adjustedStdDev,   // 80% CI upper
    lower: forecast - 1.28 * adjustedStdDev,    // 80% CI lower
  }
}

/**
 * Bootstrap prediction bands — more robust for non-normal error distributions.
 * Resamples from historical errors to build empirical prediction intervals.
 */
export function bootstrapPredictionBands(
  historicalErrors: number[],
  forecast: number,
  stepsAhead: number,
  nSamples: number = 1000,
): PredictionBand {
  if (historicalErrors.length < 5) {
    return calculatePredictionBands(historicalErrors, forecast, stepsAhead)
  }

  // Resample paths and compute cumulative error
  const outcomes: number[] = []
  for (let s = 0; s < nSamples; s++) {
    let cumError = 0
    for (let h = 0; h < stepsAhead; h++) {
      const idx = Math.floor(Math.random() * historicalErrors.length)
      cumError += historicalErrors[idx]!
    }
    outcomes.push(forecast + cumError)
  }

  outcomes.sort((a, b) => a - b)

  return {
    point: forecast,
    lower: quantileSorted(outcomes, 0.1),   // 10th percentile → 80% band lower
    upper: quantileSorted(outcomes, 0.9),   // 90th percentile → 80% band upper
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
 * Build the combined daily forecast.
 *
 * 1. Compute recurring item schedule from patterns
 * 2. Calculate variable spending residual from historical transactions
 * 3. Apply Holt's method to the residual for trend-aware forecasting
 * 4. Add day-of-week seasonal factors where data permits
 * 5. Produce confidence bands that widen over the forecast horizon
 *
 * @param transactions - All historical transactions for the workspace
 * @param patterns - Active recurring patterns
 * @param startDate - Forecast period start (YYYY-MM-DD)
 * @param endDate - Forecast period end (YYYY-MM-DD)
 */
export function buildForecast(
  transactions: Transaction[],
  patterns: RecurringPattern[],
  startDate: string,
  endDate: string,
): ForecastResult {
  // ── Step 1: Project recurring items ──
  const activePatterns = patterns.filter((p) => p.isActive)
  const recurringDaily = new Map<string, number>()

  for (const pattern of activePatterns) {
    const projected = projectPattern(pattern, startDate, endDate)
    for (const point of projected) {
      recurringDaily.set(point.date, (recurringDaily.get(point.date) ?? 0) + point.amount)
    }
  }

  // ── Step 2: Build historical daily totals and residuals ──
  // Historical = before forecast startDate
  const historicalTxns = transactions.filter((t) => t.date < startDate)
  const historicalByDate = new Map<string, number>()
  for (const t of historicalTxns) {
    historicalByDate.set(t.date, (historicalByDate.get(t.date) ?? 0) + t.amount)
  }

  // Also compute historical recurring amounts to subtract for residual
  const historicalRecurring = new Map<string, number>()
  const recurringGroupIds = new Set(activePatterns.map((p) => p.id))
  for (const t of historicalTxns) {
    if (t.recurringGroupId && recurringGroupIds.has(t.recurringGroupId)) {
      historicalRecurring.set(t.date, (historicalRecurring.get(t.date) ?? 0) + t.amount)
    }
  }

  // Residual = total daily - recurring component
  const residualByDate = new Map<string, number>()
  for (const [date, total] of historicalByDate) {
    const recurring = historicalRecurring.get(date) ?? 0
    residualByDate.set(date, total - recurring)
  }

  // ── Step 3: Holt's method on the residual ──
  const sortedDates = [...residualByDate.keys()].sort()
  const residualSeries = sortedDates.map((d) => residualByDate.get(d)!)

  let variableState: HoltState | null = null
  let predictionErrors: number[] = []
  let variableMethod: 'holt' | 'average' | 'none' = 'none'
  let variableDailyForecast = 0

  if (residualSeries.length >= MIN_DAYS_FOR_HOLT) {
    const result = runHolt(residualSeries)
    variableState = result.finalState
    predictionErrors = result.errors
    variableMethod = 'holt'
    variableDailyForecast = holtForecast(variableState, 1)
  } else if (residualSeries.length > 0) {
    variableMethod = 'average'
    variableDailyForecast = mean(residualSeries)
  }

  // ── Step 4: Day-of-week factors ──
  const dowFactors = calculateDayOfWeekFactors(residualByDate)

  // ── Step 5: Build daily forecast points ──
  const daily: DailyForecastPoint[] = []
  let cumulative = 0
  const cursor = new Date(startDate + 'T00:00:00')
  const endD = new Date(endDate + 'T00:00:00')
  let dayIndex = 0

  while (cursor <= endD) {
    const dateStr = fmtDate(cursor)
    dayIndex++

    const recurring = recurringDaily.get(dateStr) ?? 0

    // Variable component with optional day-of-week adjustment
    let variable = 0
    if (variableMethod !== 'none') {
      variable = variableMethod === 'holt'
        ? holtForecast(variableState!, dayIndex)
        : variableDailyForecast

      // Apply day-of-week seasonal factor
      if (dowFactors) {
        const dow = cursor.getDay()
        const adjusted = dow === 0 ? 6 : dow - 1
        variable *= dowFactors[adjusted]!
      }
    }

    const amount = recurring + variable
    cumulative += amount

    // Prediction band (only for the variable component, recurring is deterministic)
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

  return {
    daily,
    variableState,
    dowFactors,
    predictionErrors,
    variableMethod,
  }
}

/** Format a Date object to ISO date string (YYYY-MM-DD) */
function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
