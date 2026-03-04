/**
 * Daily forecast accuracy tracking engine.
 *
 * Requirement: Track forecast accuracy at daily granularity, but not displayed to users
 *   by default. Computed on-the-fly from existing data (expenses + actuals), not persisted.
 * Approach: Compare daily forecast amounts vs daily actual amounts. Compute MAPE, weighted
 *   MAPE, and per-category breakdowns. Only for days that have both forecast and actual data.
 * Alternatives:
 *   - Persist accuracy snapshots to IndexedDB: Rejected — stale data risk, schema bloat
 *   - Only monthly accuracy: Rejected — user wants daily granularity for internal tracking
 */

import type { Actual, Expense } from '@/types/models'
import { primaryTag } from '@/types/models'
import type { ProjectionResult } from './projection'

export interface DailyAccuracyPoint {
  date: string
  category: string
  forecastAmount: number
  actualAmount: number
  absoluteError: number
  /** null when actual is 0 (can't compute percentage) */
  percentError: number | null
  method: 'deterministic' | 'ema' | 'rolling-average'
}

export interface AccuracySummary {
  /** Mean Absolute Percentage Error across all days with data */
  mape: number | null
  /** Weighted MAPE (larger amounts count more) */
  weightedMape: number | null
  /** Number of days with both forecast and actual */
  dataPoints: number
  /** Per-category breakdown */
  byCategory: Map<string, { mape: number | null; dataPoints: number }>
  /** Per-method breakdown */
  byMethod: Map<string, { mape: number | null; dataPoints: number }>
}

/**
 * Build daily forecast lookup from projection.
 * Distributes monthly projected totals evenly across days.
 * Returns Map<date, Map<category, amount>>.
 */
function buildDailyForecastLookup(
  projection: ProjectionResult,
): Map<string, Map<string, number>> {
  const lookup = new Map<string, Map<string, number>>()

  for (const slot of projection.months) {
    // Distribute each category's monthly amount across the month's days
    for (const [category, monthMap] of projection.categoryRollup) {
      const monthAmount = monthMap.get(slot.month) ?? 0
      if (monthAmount === 0) continue
      const dailyAmount = monthAmount / slot.daysInMonth

      for (let d = 1; d <= slot.daysInMonth; d++) {
        const dateStr = `${slot.month}-${String(d).padStart(2, '0')}`
        if (!lookup.has(dateStr)) lookup.set(dateStr, new Map())
        const dayMap = lookup.get(dateStr)!
        dayMap.set(category, (dayMap.get(category) ?? 0) + dailyAmount)
      }
    }
  }

  return lookup
}

/**
 * Build daily actual spend by category.
 * Returns Map<date, Map<category, amount>>.
 */
function buildDailyActualLookup(
  actuals: Actual[],
  expenses: Expense[],
): Map<string, Map<string, number>> {
  const expenseById = new Map<string, Expense>()
  for (const exp of expenses) expenseById.set(exp.id, exp)

  const lookup = new Map<string, Map<string, number>>()

  for (const actual of actuals) {
    // Skip income actuals — accuracy tracks expense forecasting only
    if (actual.expenseId) {
      const exp = expenseById.get(actual.expenseId)
      if (exp?.type === 'income') continue
    }

    const category = actual.expenseId && expenseById.has(actual.expenseId)
      ? primaryTag(expenseById.get(actual.expenseId)!.tags)
      : primaryTag(actual.tags)

    if (!lookup.has(actual.date)) lookup.set(actual.date, new Map())
    const dayMap = lookup.get(actual.date)!
    dayMap.set(category, (dayMap.get(category) ?? 0) + actual.amount)
  }

  return lookup
}

/**
 * Calculate daily accuracy points — comparing forecast vs actual for each day+category
 * that has data in both.
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
  for (const [date, actualCategories] of actualLookup) {
    const forecastCategories = forecastLookup.get(date)
    if (!forecastCategories) continue // no forecast for this date

    for (const [category, actualAmount] of actualCategories) {
      const forecastAmount = forecastCategories.get(category) ?? 0
      // Only track accuracy where there's a forecast to compare against
      if (forecastAmount === 0 && actualAmount === 0) continue

      const absoluteError = Math.abs(forecastAmount - actualAmount)
      const percentError = actualAmount !== 0
        ? (absoluteError / actualAmount) * 100
        : null

      points.push({
        date,
        category,
        forecastAmount: Math.round(forecastAmount * 100) / 100,
        actualAmount,
        absoluteError: Math.round(absoluteError * 100) / 100,
        percentError: percentError !== null ? Math.round(percentError * 100) / 100 : null,
        method: 'deterministic', // current engine is deterministic; will update when EMA is wired
      })
    }
  }

  return points.sort((a, b) => a.date.localeCompare(b.date) || a.category.localeCompare(b.category))
}

/**
 * Summarise daily accuracy points into aggregate metrics.
 */
export function summariseAccuracy(points: DailyAccuracyPoint[]): AccuracySummary {
  if (points.length === 0) {
    return {
      mape: null,
      weightedMape: null,
      dataPoints: 0,
      byCategory: new Map(),
      byMethod: new Map(),
    }
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

  // Per-category
  const byCategory = new Map<string, { mape: number | null; dataPoints: number }>()
  const categoryGroups = new Map<string, DailyAccuracyPoint[]>()
  for (const p of points) {
    if (!categoryGroups.has(p.category)) categoryGroups.set(p.category, [])
    categoryGroups.get(p.category)!.push(p)
  }
  for (const [cat, catPoints] of categoryGroups) {
    const catWithPercent = catPoints.filter((p) => p.percentError !== null)
    byCategory.set(cat, {
      mape: catWithPercent.length > 0
        ? catWithPercent.reduce((s, p) => s + p.percentError!, 0) / catWithPercent.length
        : null,
      dataPoints: catPoints.length,
    })
  }

  // Per-method
  const byMethod = new Map<string, { mape: number | null; dataPoints: number }>()
  const methodGroups = new Map<string, DailyAccuracyPoint[]>()
  for (const p of points) {
    if (!methodGroups.has(p.method)) methodGroups.set(p.method, [])
    methodGroups.get(p.method)!.push(p)
  }
  for (const [method, methodPoints] of methodGroups) {
    const methodWithPercent = methodPoints.filter((p) => p.percentError !== null)
    byMethod.set(method, {
      mape: methodWithPercent.length > 0
        ? methodWithPercent.reduce((s, p) => s + p.percentError!, 0) / methodWithPercent.length
        : null,
      dataPoints: methodPoints.length,
    })
  }

  return {
    mape: mape !== null ? Math.round(mape * 100) / 100 : null,
    weightedMape: weightedMape !== null ? Math.round(weightedMape * 100) / 100 : null,
    dataPoints: points.length,
    byCategory,
    byMethod,
  }
}
