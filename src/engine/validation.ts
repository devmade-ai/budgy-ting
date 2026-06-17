/**
 * Forecast validation harness — rolling-origin backtest + proper interval scoring.
 *
 * Requirement (FORECASTING_RESEARCH.md §16.5): evaluate the forecast HONESTLY.
 *   The old dashboard "backtest" fit the model on the whole history and scored it against
 *   that same history — in-sample, leaky, over-optimistic. This module replaces it with a
 *   rolling-origin (walk-forward) backtest where every forecast origin trains ONLY on data
 *   strictly before it, scored per horizon, plus calibration metrics for the confidence bands.
 * Approach:
 *   - rollingOriginBacktest: step an origin forward, refit at each origin on past-only data,
 *     forecast h days ahead, match to actuals → out-of-sample (origin, horizon, point, band, actual).
 *   - Scoring primitives (pure, testable): pinball loss (proper), PICP + Wilson CI, PINAW, PIT.
 * Alternatives:
 *   - Random K-fold CV: Rejected — leaks future into past on time-ordered data (§16.5).
 *   - In-sample single fit (previous): Rejected — over-optimistic; the leak this module fixes.
 *   - Persisting backtest results: Rejected — cheap to recompute, stale-data risk.
 */

import type { Transaction, RecurringPattern } from '@/types/models'
import { buildForecast } from './forecast'
import { summarizeAccuracy, type AccuracySummary, type DailyAccuracyPoint } from './accuracy'
import { formatDate } from './dateUtils'
import { debugLog } from '@/debug/debugLog'

// Nominal coverage of the forecast bands (10th/90th empirical quantiles = 80% central).
const NOMINAL_COVERAGE = 0.8

// ── Interval scoring primitives (pure) ──

/**
 * Pinball (quantile) loss for a single quantile forecast. Strictly proper for the τ-quantile:
 * expected loss is minimised only by reporting the true quantile, so it can't be gamed by
 * over-widening (unlike raw coverage). Lower is better.
 */
export function pinballLoss(actual: number, forecast: number, tau: number): number {
  const diff = actual - forecast
  return diff >= 0 ? tau * diff : (tau - 1) * diff
}

/** PICP — Prediction Interval Coverage Probability: fraction of actuals inside [lower, upper]. */
export function picp(records: Array<{ lower: number; upper: number; actual: number }>): number {
  if (records.length === 0) return 0
  const inside = records.filter((r) => r.actual >= r.lower && r.actual <= r.upper).length
  return inside / records.length
}

/**
 * PINAW — Prediction Interval Normalized Average Width: mean interval width divided by the
 * range of observed actuals. Lower = tighter. Reported alongside PICP (they trade off).
 */
export function pinaw(records: Array<{ lower: number; upper: number; actual: number }>): number | null {
  if (records.length === 0) return null
  const actuals = records.map((r) => r.actual)
  const range = Math.max(...actuals) - Math.min(...actuals)
  if (range <= 0) return null
  const meanWidth = records.reduce((s, r) => s + (r.upper - r.lower), 0) / records.length
  return meanWidth / range
}

/**
 * Wilson score interval for a binomial proportion — the honest coverage CI on short series.
 * With few backtest origins, a bare "PICP = 0.85" is noise; the Wilson band shows how
 * uncertain it is. z=1.96 ≈ 95% CI.
 */
export function wilsonInterval(successes: number, n: number, z = 1.96): { lo: number; hi: number } {
  if (n === 0) return { lo: 0, hi: 1 }
  const p = successes / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const center = (p + z2 / (2 * n)) / denom
  const margin = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))
  return { lo: Math.max(0, center - margin), hi: Math.min(1, center + margin) }
}

/**
 * Empirical PIT (Probability Integral Transform) value from a quantile band. If forecasts are
 * calibrated, PIT values are Uniform[0,1]; a U-shaped histogram means bands too narrow, ∩-shaped
 * means too wide. We only hold three quantiles (lower=0.1, point=0.5, upper=0.9), so the predictive
 * CDF is approximated piecewise-linearly through those knots with linear tails — enough for a
 * calibration diagnostic, not a full distributional score.
 */
export function pitValueFromBand(actual: number, lower: number, point: number, upper: number): number {
  // Degenerate band (no spread) → uninformative midpoint.
  if (!(upper > lower)) return 0.5

  if (actual <= lower) {
    if (point <= lower) return 0
    const slope = 0.4 / (point - lower) // (0.5 - 0.1) / (point - lower)
    return Math.max(0, 0.1 - slope * (lower - actual))
  }
  if (actual <= point) {
    if (point === lower) return 0.1
    return 0.1 + 0.4 * ((actual - lower) / (point - lower))
  }
  if (actual <= upper) {
    if (upper === point) return 0.9
    return 0.5 + 0.4 * ((actual - point) / (upper - point))
  }
  // actual > upper
  if (upper <= point) return 1
  const slope = 0.4 / (upper - point)
  return Math.min(1, 0.9 + slope * (actual - upper))
}

/** Bucket PIT values into a histogram of `bins` equal-width bins over [0,1]. */
export function pitHistogram(pitValues: number[], bins = 10): number[] {
  const counts = new Array(bins).fill(0) as number[]
  for (const v of pitValues) {
    const clamped = Math.min(0.999999, Math.max(0, v))
    counts[Math.floor(clamped * bins)]!++
  }
  return counts
}

// ── Rolling-origin backtest ──

export interface BacktestRecord {
  /** Last training day (the forecast stands here and looks forward) */
  origin: string
  /** Forecast target date */
  date: string
  /** Days ahead of the origin (1-based) */
  horizon: number
  point: number
  lower: number
  upper: number
  actual: number
}

export interface BacktestOptions {
  /** Minimum training days before the first origin (default 14 — combination-model floor) */
  minTrainDays?: number
  /** Days forecast ahead from each origin (default 14) */
  horizon?: number
  /** Days between successive origins (default 7 — weekly walk-forward) */
  stride?: number
  /** Cap on number of origins; the most recent are kept (default 26) */
  maxOrigins?: number
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86_400_000,
  )
}

/**
 * Walk-forward backtest. At each origin, fit on transactions dated ≤ origin only and forecast
 * forward, matching predictions to actuals → out-of-sample records. No leakage: the forecast
 * window is never part of the training data.
 */
export function rollingOriginBacktest(
  transactions: Transaction[],
  patterns: RecurringPattern[],
  opts: BacktestOptions = {},
): BacktestRecord[] {
  const minTrainDays = opts.minTrainDays ?? 14
  const horizon = opts.horizon ?? 14
  const stride = opts.stride ?? 7
  const maxOrigins = opts.maxOrigins ?? 26

  if (transactions.length === 0) return []

  // Actual net daily totals.
  const actualByDate = new Map<string, number>()
  for (const t of transactions) {
    actualByDate.set(t.date, (actualByDate.get(t.date) ?? 0) + t.amount)
  }

  const sortedDates = [...actualByDate.keys()].sort()
  const firstDate = sortedDates[0]!
  const lastDate = sortedDates[sortedDates.length - 1]!

  // First origin sits minTrainDays after the first actual; last origin must leave ≥1 future day.
  const firstOrigin = addDays(firstDate, minTrainDays)
  if (daysBetween(firstOrigin, lastDate) < 1) return []

  // Generate candidate origins, then keep the most recent maxOrigins.
  const origins: string[] = []
  for (let o = firstOrigin; daysBetween(o, lastDate) >= 1; o = addDays(o, stride)) {
    origins.push(o)
  }
  const usedOrigins = origins.slice(-maxOrigins)

  const records: BacktestRecord[] = []
  for (const origin of usedOrigins) {
    const trainTxns = transactions.filter((t) => t.date <= origin)
    if (trainTxns.length === 0) continue

    const forecastStart = addDays(origin, 1)
    const forecastEnd = addDays(origin, horizon)
    const fc = buildForecast(trainTxns, patterns, forecastStart, forecastEnd)

    for (const p of fc.daily) {
      const actual = actualByDate.get(p.date)
      if (actual === undefined) continue // no actual that day → can't score
      records.push({
        origin,
        date: p.date,
        horizon: daysBetween(origin, p.date),
        point: p.amount,
        lower: p.band ? p.band.lower : p.amount,
        upper: p.band ? p.band.upper : p.amount,
        actual,
      })
    }
  }

  return records
}

// ── Backtest summary ──

export interface PerHorizonScore {
  horizon: number
  mae: number | null
  /** Empirical coverage at this horizon (fraction inside the band) */
  coverage: number | null
  n: number
}

export interface BacktestSummary {
  /** Out-of-sample point accuracy (MAE/RMSE/bias/WMAPE/hit-rate), reusing the accuracy engine */
  accuracy: AccuracySummary
  /** Per-horizon MAE + coverage — coverage degrades as horizon grows; a pooled number hides it */
  perHorizon: PerHorizonScore[]
  /** Pooled coverage with its Wilson 95% CI, against the nominal band coverage */
  coverage: { nominal: number; picp: number; wilsonLo: number; wilsonHi: number } | null
  /** Mean interval width normalized by actual range */
  pinaw: number | null
  /** Mean pinball loss over the band quantiles (0.1 / 0.5 / 0.9) — a scaled-CRPS proxy */
  meanPinball: number | null
  /** PIT histogram (10 bins) — flat = calibrated, U = bands too narrow, ∩ = too wide */
  pitHistogram: number[]
  /** Number of out-of-sample records scored */
  records: number
}

function toAccuracyPoints(records: BacktestRecord[]): DailyAccuracyPoint[] {
  return records.map((r) => {
    const signedError = r.actual - r.point
    return {
      date: r.date,
      forecastAmount: Math.round(r.point * 100) / 100,
      actualAmount: Math.round(r.actual * 100) / 100,
      absoluteError: Math.round(Math.abs(signedError) * 100) / 100,
      signedError: Math.round(signedError * 100) / 100,
    }
  })
}

/** Aggregate backtest records into point-accuracy + interval-calibration metrics. */
export function summarizeBacktest(records: BacktestRecord[]): BacktestSummary {
  const accuracy = summarizeAccuracy(toAccuracyPoints(records))

  if (records.length === 0) {
    return {
      accuracy,
      perHorizon: [],
      coverage: null,
      pinaw: null,
      meanPinball: null,
      pitHistogram: new Array(10).fill(0) as number[],
      records: 0,
    }
  }

  // Per-horizon MAE + coverage.
  const byHorizon = new Map<number, BacktestRecord[]>()
  for (const r of records) {
    const arr = byHorizon.get(r.horizon) ?? []
    arr.push(r)
    byHorizon.set(r.horizon, arr)
  }
  const perHorizon: PerHorizonScore[] = [...byHorizon.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([horizon, recs]) => ({
      horizon,
      mae: Math.round((recs.reduce((s, r) => s + Math.abs(r.actual - r.point), 0) / recs.length) * 100) / 100,
      coverage: Math.round(picp(recs) * 1000) / 1000,
      n: recs.length,
    }))

  // Pooled coverage + Wilson CI.
  const inside = records.filter((r) => r.actual >= r.lower && r.actual <= r.upper).length
  const wilson = wilsonInterval(inside, records.length)
  const coverage = {
    nominal: NOMINAL_COVERAGE,
    picp: Math.round((inside / records.length) * 1000) / 1000,
    wilsonLo: Math.round(wilson.lo * 1000) / 1000,
    wilsonHi: Math.round(wilson.hi * 1000) / 1000,
  }

  // Mean pinball over the three quantiles we hold (lower=0.1, point=0.5, upper=0.9).
  let pinballSum = 0
  for (const r of records) {
    pinballSum += pinballLoss(r.actual, r.lower, 0.1)
    pinballSum += pinballLoss(r.actual, r.point, 0.5)
    pinballSum += pinballLoss(r.actual, r.upper, 0.9)
  }
  const meanPinball = Math.round((pinballSum / (records.length * 3)) * 100) / 100

  const pit = records.map((r) => pitValueFromBand(r.actual, r.lower, r.point, r.upper))

  const summary: BacktestSummary = {
    accuracy,
    perHorizon,
    coverage,
    pinaw: pinaw(records),
    meanPinball,
    pitHistogram: pitHistogram(pit),
    records: records.length,
  }

  debugLog('engine', 'info', 'Rolling-origin backtest', {
    records: summary.records,
    mae: summary.accuracy.mae,
    picp: coverage.picp,
    wilson: [coverage.wilsonLo, coverage.wilsonHi],
    meanPinball: summary.meanPinball,
  })

  return summary
}

/**
 * Convenience: run the rolling-origin backtest and summarize in one call.
 * Returns null when there isn't enough history for a single out-of-sample record.
 */
export function backtestForecast(
  transactions: Transaction[],
  patterns: RecurringPattern[],
  opts?: BacktestOptions,
): BacktestSummary | null {
  const records = rollingOriginBacktest(transactions, patterns, opts)
  if (records.length === 0) return null
  return summarizeBacktest(records)
}
