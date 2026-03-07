/**
 * Prediction accuracy engine — compares forecast vs actual transactions.
 *
 * Requirement: Track forecast accuracy at daily granularity. Primary metric is MAE
 *   (not MAPE — MAPE explodes on zero-spend days). Secondary: WMAPE for monthly summaries,
 *   bias (systematic over/under prediction), hit rate (% of days within threshold).
 * Approach: Compare daily forecast amounts to daily actual totals. Compute metrics
 *   on-the-fly from existing data, not persisted.
 * Alternatives:
 *   - Per-category accuracy: Rejected — forecasting is about total cashflow
 *   - Persist accuracy snapshots to IndexedDB: Rejected — stale data risk, schema bloat
 *   - MAPE as primary: Rejected — distorted by zero-spend days at daily granularity
 */

import { mean, standardDeviation } from 'simple-statistics'
import type { Transaction } from '@/types/models'
import type { DailyForecastPoint } from './forecast'

export interface DailyAccuracyPoint {
  date: string
  /** Forecasted net daily amount */
  forecastAmount: number
  /** Actual net daily amount */
  actualAmount: number
  /** Absolute error = |forecast - actual| */
  absoluteError: number
  /** Signed error = actual - forecast (positive = we underpredicted) */
  signedError: number
}

export interface AccuracySummary {
  /** Mean Absolute Error — primary metric, in currency units */
  mae: number | null
  /** Root Mean Square Error — penalises large errors */
  rmse: number | null
  /** Mean signed error — positive = systematically underpredicting */
  bias: number | null
  /** WMAPE — sum(|error|) / sum(|actual|) — for monthly/aggregate level */
  wmape: number | null
  /** Hit rate — % of days where |error| < threshold */
  hitRate: number | null
  /** Threshold used for hit rate (currency units) */
  hitRateThreshold: number
  /** Number of days with both forecast and actual */
  dataPoints: number
}

/**
 * Calculate daily accuracy points — comparing forecast vs actual.
 * Only includes days where both forecast and actual data exist.
 *
 * @param forecastPoints - Daily forecast points from the forecast engine
 * @param transactions - Actual transactions for the period
 */
export function calculateDailyAccuracy(
  forecastPoints: DailyForecastPoint[],
  transactions: Transaction[],
): DailyAccuracyPoint[] {
  // Build actual daily totals
  const actualByDate = new Map<string, number>()
  for (const t of transactions) {
    actualByDate.set(t.date, (actualByDate.get(t.date) ?? 0) + t.amount)
  }

  // Build forecast lookup
  const forecastByDate = new Map<string, number>()
  for (const p of forecastPoints) {
    forecastByDate.set(p.date, p.amount)
  }

  const points: DailyAccuracyPoint[] = []

  // For each date that has actuals, compare against forecast
  for (const [date, actualAmount] of actualByDate) {
    const forecastAmount = forecastByDate.get(date)
    if (forecastAmount === undefined) continue
    if (forecastAmount === 0 && actualAmount === 0) continue

    const signedError = actualAmount - forecastAmount
    const absoluteError = Math.abs(signedError)

    points.push({
      date,
      forecastAmount: Math.round(forecastAmount * 100) / 100,
      actualAmount: Math.round(actualAmount * 100) / 100,
      absoluteError: Math.round(absoluteError * 100) / 100,
      signedError: Math.round(signedError * 100) / 100,
    })
  }

  return points.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Summarise accuracy points into aggregate metrics.
 *
 * @param points - Daily accuracy comparison points
 * @param hitRateThreshold - Currency amount threshold for "close enough" (default: auto-calculated)
 */
export function summarizeAccuracy(
  points: DailyAccuracyPoint[],
  hitRateThreshold?: number,
): AccuracySummary {
  if (points.length === 0) {
    return {
      mae: null,
      rmse: null,
      bias: null,
      wmape: null,
      hitRate: null,
      hitRateThreshold: hitRateThreshold ?? 0,
      dataPoints: 0,
    }
  }

  const absErrors = points.map((p) => p.absoluteError)
  const signedErrors = points.map((p) => p.signedError)

  // MAE — primary metric
  const mae = mean(absErrors)

  // RMSE — penalises large errors
  const squaredErrors = points.map((p) => p.signedError ** 2)
  const rmse = Math.sqrt(mean(squaredErrors))

  // Bias — systematic over/under prediction
  const bias = mean(signedErrors)

  // WMAPE — weighted by actual amount (only where actuals are non-zero)
  const totalAbsActual = points.reduce((sum, p) => sum + Math.abs(p.actualAmount), 0)
  const totalAbsError = points.reduce((sum, p) => sum + p.absoluteError, 0)
  const wmape = totalAbsActual > 0 ? (totalAbsError / totalAbsActual) * 100 : null

  // Hit rate — % of days within threshold
  // Default threshold: 1 standard deviation of absolute errors (intuitive "close enough")
  const threshold = hitRateThreshold ?? (absErrors.length >= 2 ? standardDeviation(absErrors) : mae)
  const hitsCount = points.filter((p) => p.absoluteError <= threshold).length
  const hitRate = (hitsCount / points.length) * 100

  return {
    mae: Math.round(mae * 100) / 100,
    rmse: Math.round(rmse * 100) / 100,
    bias: Math.round(bias * 100) / 100,
    wmape: wmape !== null ? Math.round(wmape * 100) / 100 : null,
    hitRate: Math.round(hitRate * 100) / 100,
    hitRateThreshold: Math.round(threshold * 100) / 100,
    dataPoints: points.length,
  }
}
