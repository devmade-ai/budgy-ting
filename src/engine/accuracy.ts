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
import { debugLog } from '@/debug/debugLog'

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

  const summary: AccuracySummary = {
    mae: Math.round(mae * 100) / 100,
    rmse: Math.round(rmse * 100) / 100,
    bias: Math.round(bias * 100) / 100,
    wmape: wmape !== null ? Math.round(wmape * 100) / 100 : null,
    hitRate: Math.round(hitRate * 100) / 100,
    hitRateThreshold: Math.round(threshold * 100) / 100,
    dataPoints: points.length,
  }

  debugLog('engine', 'info', 'Accuracy computed', {
    dataPoints: summary.dataPoints,
    mae: summary.mae,
    wmape: summary.wmape,
    bias: summary.bias,
    hitRate: summary.hitRate,
  })

  return summary
}
