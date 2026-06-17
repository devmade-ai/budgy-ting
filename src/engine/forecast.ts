/**
 * Hybrid forecasting engine — combines deterministic recurring item scheduling
 * with a statistical combination model for variable spending prediction.
 *
 * Requirement: Predict daily cashflow from historical patterns + known recurring items.
 *   Total Daily Cashflow = Recurring Items + Variable Spending + Day-of-Week Adjustment
 * Approach: Hybrid decomposition per FORECASTING_RESEARCH.md §1 + §16:
 *   1. Recurring items: deterministic scheduling from RecurringPattern (handled by patterns.ts)
 *   2. Variable spending residual: equal-weighted combination of Theta (SES-with-drift) and
 *      damped-trend ETS (Holt, φ=0.9). Equal weights beat learned weights on short series.
 *   3. Day-of-week seasonality: multipliers for weekday/weekend patterns (needs 4+ weeks)
 *   4. Confidence bands: empirical residual quantiles (distribution-free) with sqrt horizon scaling
 * Alternatives:
 *   - Undamped Holt trend: Rejected — extrapolates a constant trend indefinitely and
 *     over-forecasts off one-off spikes (rent/salary read as slope). Damping flattens the
 *     trend over the horizon. See FORECASTING_RESEARCH.md §16.1 (Gardner & McKenzie damped trend).
 *   - ARIMA: Rejected — complex parameter tuning, heavy WASM dependency (~500KB)
 *   - Simple EMA only: Rejected — misses spending trends (SES always underpredicts if spending increases)
 *   - Holt-Winters triple: Deferred — needs 2+ full seasonal cycles (14+ weeks) to initialise weekly seasonality
 *   - Theta + ETS + seasonal-naive combination: the next upgrade (FORECASTING_RESEARCH.md §16.1,
 *     tracked in docs/TODO.md) — damped trend here is the cheap interim step toward it.
 */

import { mean, quantile, linearRegression } from 'simple-statistics'
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
  /**
   * Trend damping factor φ (0 < φ ≤ 1). 1 = classic (undamped) Holt.
   * Optional so externally-constructed states default to undamped — the pipeline
   * (initHolt/runHolt) sets it to DEFAULT_PHI.
   */
  phi?: number
}

/**
 * Level smoothing factor for Holt's method.
 * 0.2 balances responsiveness to recent changes vs stability — standard choice
 * for daily financial data (see Hyndman & Athanasopoulos "Forecasting: Principles and Practice").
 */
const DEFAULT_ALPHA = 0.2

/**
 * Trend smoothing factor for Holt's method.
 * 0.05 dampens trend updates to avoid overfitting daily noise in cashflow data.
 */
const DEFAULT_BETA = 0.05

/**
 * Trend damping factor φ for the damped-trend method (Gardner & McKenzie 1985).
 *
 * Requirement (FORECASTING_RESEARCH.md §16.1): stop the variable-spending trend from
 * extrapolating a one-off spike (rent/salary read as slope) out to the horizon.
 * Approach: forecast h steps ahead = level + (φ + φ² + … + φ^h)·trend. With φ < 1 the
 * geometric sum converges to φ/(1−φ), so the trend's cumulative contribution is bounded
 * instead of growing linearly forever.
 * Why 0.9: at the 90-day horizon cap, undamped adds 90·trend; φ=0.9 caps the contribution
 * at ~9·trend (reached ~day 30), a large reduction in runaway extrapolation while still
 * tracking genuine short-term trend. Alternatives: 0.98 (barely damped, ~49·trend cap —
 * too close to undamped); 0.8 (aggressive, flattens trend within ~2 weeks — discards real
 * signal). 0.9 is the middle ground the damped-trend literature converges on.
 */
const DEFAULT_PHI = 0.9

/**
 * Minimum weeks of data required to compute day-of-week seasonality factors.
 * 4 weeks ensures each weekday has at least 4 data points for a stable average.
 */
const MIN_WEEKS_FOR_SEASONALITY = 4

/**
 * Minimum days of history needed for the combination model (Theta + damped ETS).
 * Below this, the trend/slope estimates are too noisy to be useful, so we fall back
 * to a simple average.
 */
const MIN_DAYS_FOR_COMBINATION = 14

/**
 * Initialise Holt state from a series of daily amounts.
 * Uses the first value as initial level and estimates initial trend
 * from the first few data points.
 */
export function initHolt(
  dailyAmounts: number[],
  alpha: number = DEFAULT_ALPHA,
  beta: number = DEFAULT_BETA,
  phi: number = DEFAULT_PHI,
): HoltState {
  if (dailyAmounts.length === 0) {
    return { level: 0, trend: 0, alpha, beta, phi }
  }

  if (dailyAmounts.length === 1) {
    const val = dailyAmounts[0]!
    return { level: Number.isFinite(val) ? val : 0, trend: 0, alpha, beta, phi }
  }

  // Initial level: first observation (guard against NaN/Infinity from upstream)
  const rawLevel = dailyAmounts[0]!
  const level = Number.isFinite(rawLevel) ? rawLevel : 0

  // Initial trend: average change over the first min(7, n) points
  const trendWindow = Math.min(7, dailyAmounts.length)
  let trendSum = 0
  for (let i = 1; i < trendWindow; i++) {
    trendSum += dailyAmounts[i]! - dailyAmounts[i - 1]!
  }
  const trend = trendSum / (trendWindow - 1)

  return { level, trend, alpha, beta, phi }
}

/**
 * Sum of the damping geometric series φ + φ² + … + φ^h used to project the trend
 * h steps ahead. Undamped (φ ≥ 1) reduces to h, recovering classic Holt (level + h·trend).
 */
function dampingSum(phi: number, steps: number): number {
  if (phi >= 1) return steps
  return (phi * (1 - Math.pow(phi, steps))) / (1 - phi)
}

/**
 * Update Holt state with a new observation (damped-trend form).
 * The one-step prediction uses level + φ·trend; with φ = 1 this is classic Holt.
 */
export function holtUpdate(state: HoltState, observation: number): HoltState {
  const phi = state.phi ?? 1
  const newLevel = state.alpha * observation + (1 - state.alpha) * (state.level + phi * state.trend)
  const newTrend = state.beta * (newLevel - state.level) + (1 - state.beta) * phi * state.trend
  return { ...state, level: newLevel, trend: newTrend }
}

/**
 * Forecast stepsAhead days from the current Holt state, damping the trend by φ.
 * With φ = 1 (or undefined) this is the classic level + stepsAhead·trend.
 */
export function holtForecast(state: HoltState, stepsAhead: number): number {
  return state.level + dampingSum(state.phi ?? 1, stepsAhead) * state.trend
}

/**
 * Run Holt's method over a full series, returning the final state
 * and one-step-ahead prediction errors for confidence band calculation.
 */
export function runHolt(
  dailyAmounts: number[],
  alpha: number = DEFAULT_ALPHA,
  beta: number = DEFAULT_BETA,
  phi: number = DEFAULT_PHI,
): { finalState: HoltState; errors: number[] } {
  if (dailyAmounts.length < 2) {
    return {
      finalState: initHolt(dailyAmounts, alpha, beta, phi),
      errors: [],
    }
  }

  let state = initHolt(dailyAmounts, alpha, beta, phi)
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

// ── Theta (SES-with-drift) + Combination ──

/** OLS slope of the series against its time index (0..n-1). */
function olsSlope(series: number[]): number {
  const points: Array<[number, number]> = series.map((y, t) => [t, y])
  return linearRegression(points).m
}

/**
 * Equal-weighted combination of Theta (SES-with-drift) and damped-trend ETS, fitted to the
 * variable-spending residual. Returns a horizon-aware forecaster plus the combination's
 * in-sample one-step errors (for prediction bands) and the ETS component state (for debug).
 *
 * Requirement (FORECASTING_RESEARCH.md §16.1): combine simple methods rather than rely on a
 * single model. On a single short series an equal-weighted average of statistical methods is
 * hard to beat (M4/M5), and equal weights beat learned weights (forecast-combination puzzle,
 * Stock & Watson 2004).
 * Approach: run SES and damped Holt incrementally over the series in lockstep; at each step the
 * combined one-step prediction is the mean of the two, so the errors reflect the actual combined
 * model. Theta drift per step = half the OLS slope (Hyndman & Billah's "unmasked Theta = SES
 * with drift b/2"). Multi-step forecast averages Theta's drifting line with the damped-ETS path.
 * Alternatives:
 *   - Seasonal-naive as a third member: deferred (FORECASTING_RESEARCH.md §16 decision 1a) — the
 *     pipeline already models weekly seasonality via dowFactors, so a seasonal-naive member would
 *     double-count it. Revisit if dowFactors is ever replaced.
 *   - Learned/optimal combination weights: Rejected — estimation variance overwhelms the gain on
 *     short series (Stock & Watson 2004).
 */
function runCombination(
  series: number[],
  alpha: number = DEFAULT_ALPHA,
  beta: number = DEFAULT_BETA,
  phi: number = DEFAULT_PHI,
): { forecastAt: (stepsAhead: number) => number; errors: number[]; etsState: HoltState } {
  const drift = olsSlope(series) / 2 // Theta drift per step (half the OLS slope)

  let sesLevel = series[0]!
  let etsState = initHolt(series, alpha, beta, phi)
  const errors: number[] = []

  // Walk the series once, advancing SES and damped Holt together. The combined one-step
  // prediction is the mean of the two members, so errors are the true combination errors.
  for (let i = 1; i < series.length; i++) {
    const thetaPred = sesLevel + drift
    const etsPred = holtForecast(etsState, 1)
    const combined = 0.5 * thetaPred + 0.5 * etsPred
    errors.push(series[i]! - combined)

    sesLevel = alpha * series[i]! + (1 - alpha) * sesLevel
    etsState = holtUpdate(etsState, series[i]!)
  }

  const finalSes = sesLevel
  const finalEts = etsState
  const forecastAt = (stepsAhead: number): number =>
    0.5 * (finalSes + drift * stepsAhead) + 0.5 * holtForecast(finalEts, stepsAhead)

  return { forecastAt, errors, etsState: finalEts }
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
 * Calculate an 80% prediction band from historical one-step errors.
 *
 * Requirement (FORECASTING_RESEARCH.md §16.4): replace the heuristic Gaussian band with
 * a distribution-free one whose width reflects the ACTUAL residual distribution.
 * Approach: empirical residual quantiles. Take the 10th/90th percentiles of the historical
 * one-step errors (an 80% central interval), centre the spread on the residual mean so any
 * model bias isn't amplified by horizon scaling, then widen by √horizon.
 *   upper = forecast + bias + Q90centred · √h
 *   lower = forecast + bias + Q10centred · √h
 * Why empirical over ±1.28·σ: cashflow residuals are skewed (occasional large expenses, not
 * symmetric noise). The Gaussian form forces a symmetric band and understates the fat tail;
 * empirical quantiles capture the real asymmetry, so the optimistic vs pessimistic edges
 * differ as they should. FPP3 §5.5 warns the closed-form interval is simply wrong when
 * residuals aren't normal.
 * Alternatives:
 *   - ±1.28·σ Gaussian (previous): Rejected — symmetric, assumes normality, ignores bias.
 *   - Split-conformal / ACI calibrated bands: the next upgrade (FORECASTING_RESEARCH.md §16.4,
 *     docs/TODO.md). Needs ~100+ residuals and per-horizon residual pools; this empirical
 *     method is the cheap honest first step that reuses residuals already computed for MAE/RMSE.
 *   - 95% interval: Rejected — too wide to be actionable for cashflow tracking.
 * Caveat: the √horizon widening is a random-walk approximation (one-step residuals scaled to
 * h-steps); true per-horizon residual pools come with the conformal upgrade.
 */
export function calculatePredictionBands(
  historicalErrors: number[],
  forecast: number,
  stepsAhead: number,
): PredictionBand {
  if (historicalErrors.length < 2) {
    return { point: forecast, upper: forecast, lower: forecast }
  }

  // Bias = mean residual. Centre the spread on it so horizon scaling widens the spread,
  // not the (constant) bias offset.
  const bias = mean(historicalErrors)
  const lowerSpread = quantile(historicalErrors, 0.1) - bias  // ≤ 0
  const upperSpread = quantile(historicalErrors, 0.9) - bias  // ≥ 0

  // Prediction uncertainty grows with forecast horizon (random walk assumption).
  // Cap at 90 days — beyond that, bands grow so wide they're not actionable.
  const cappedSteps = Math.min(stepsAhead, 90)
  const horizonFactor = Math.sqrt(Math.max(1, cappedSteps))

  return {
    point: forecast,
    upper: forecast + bias + upperSpread * horizonFactor,  // empirical 90th pct
    lower: forecast + bias + lowerSpread * horizonFactor,  // empirical 10th pct
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
  /** Damped-ETS (Holt) component state of the variable combination (null if insufficient data) */
  variableState: HoltState | null
  /** Day-of-week factors (null if insufficient data) */
  dowFactors: number[] | null
  /** One-step-ahead errors from the variable model fit (for accuracy metrics + bands) */
  predictionErrors: number[]
  /** Method used for variable spending */
  variableMethod: 'combination' | 'average' | 'none'
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
 * Fit the variable-spending model to the residual series.
 *
 * Returns a horizon-aware forecaster `forecastAt(stepsAhead)`:
 *   - ≥ MIN_DAYS_FOR_COMBINATION: equal-weighted Theta + damped-ETS combination
 *   - 1..MIN_DAYS_FOR_COMBINATION-1: flat simple average (too little data for trend/slope)
 *   - 0: no variable component
 */
function fitVariableModel(residualSeries: number[]): {
  variableState: HoltState | null
  predictionErrors: number[]
  variableMethod: 'combination' | 'average' | 'none'
  forecastAt: ((stepsAhead: number) => number) | null
} {
  if (residualSeries.length >= MIN_DAYS_FOR_COMBINATION) {
    const combo = runCombination(residualSeries)
    return {
      variableState: combo.etsState,
      predictionErrors: combo.errors,
      variableMethod: 'combination',
      forecastAt: combo.forecastAt,
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
      forecastAt: () => avg,
    }
  }

  return { variableState: null, predictionErrors: [], variableMethod: 'none', forecastAt: null }
}

/**
 * Assemble the daily forecast point series from recurring + variable components.
 */
function assembleDailyForecast(
  recurringDaily: Map<string, number>,
  forecastAt: ((stepsAhead: number) => number) | null,
  variableMethod: 'combination' | 'average' | 'none',
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
    if (variableMethod !== 'none' && forecastAt) {
      variable = forecastAt(dayIndex)

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

  const { variableState, predictionErrors, variableMethod, forecastAt } =
    fitVariableModel(residualSeries)

  const dowFactors = calculateDayOfWeekFactors(residualByDate)

  const daily = assembleDailyForecast(
    recurringDaily, forecastAt, variableMethod,
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

