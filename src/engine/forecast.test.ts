import { describe, it, expect } from 'vitest'
import {
  initHolt,
  holtUpdate,
  holtForecast,
  runHolt,
  calculateDayOfWeekFactors,
  calculatePredictionBands,
  buildForecast,
} from './forecast'
import type { Transaction, RecurringPattern } from '@/types/models'

function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    workspaceId: 'w-1',
    date: '2026-01-15',
    amount: -100,
    description: 'Test',
    tags: ['Food'],
    source: 'import',
    classification: 'once-off',
    recurringGroupId: null,
    originalRow: null,
    importBatchId: null,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    ...overrides,
  }
}

function makePattern(overrides: Partial<RecurringPattern> = {}): RecurringPattern {
  return {
    id: 'pat-1',
    workspaceId: 'w-1',
    description: 'Rent',
    expectedAmount: -12000,
    amountStdDev: 0,
    frequency: 'monthly',
    anchorDay: 1,
    tags: ['Housing'],
    variability: 'fixed',
    isActive: true,
    autoAccept: true,
    lastSeenDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('initHolt', () => {
  it('handles empty array', () => {
    const state = initHolt([])
    expect(state.level).toBe(0)
    expect(state.trend).toBe(0)
  })

  it('handles single value', () => {
    const state = initHolt([100])
    expect(state.level).toBe(100)
    expect(state.trend).toBe(0)
  })

  it('initialises level and trend correctly', () => {
    const state = initHolt([100, 110, 120, 130])
    expect(state.level).toBe(100)
    // Trend: avg change over first 4 points = (10+10+10)/3 = 10
    expect(state.trend).toBeCloseTo(10, 1)
  })

  it('respects custom alpha/beta', () => {
    const state = initHolt([100], 0.5, 0.1)
    expect(state.alpha).toBe(0.5)
    expect(state.beta).toBe(0.1)
  })
})

describe('holtUpdate', () => {
  it('updates level towards observation', () => {
    const state = { level: 100, trend: 0, alpha: 0.2, beta: 0.05 }
    const updated = holtUpdate(state, 120)
    // newLevel = 0.2*120 + 0.8*(100+0) = 24+80 = 104
    expect(updated.level).toBeCloseTo(104, 1)
  })

  it('updates trend when level changes', () => {
    const state = { level: 100, trend: 0, alpha: 0.2, beta: 0.05 }
    const updated = holtUpdate(state, 120)
    // newTrend = 0.05*(104-100) + 0.95*0 = 0.2
    expect(updated.trend).toBeCloseTo(0.2, 1)
  })
})

describe('holtForecast', () => {
  it('projects forward using level + trend', () => {
    const state = { level: 100, trend: 5, alpha: 0.2, beta: 0.05 }
    expect(holtForecast(state, 1)).toBe(105)
    expect(holtForecast(state, 10)).toBe(150)
  })

  it('handles zero trend', () => {
    const state = { level: 100, trend: 0, alpha: 0.2, beta: 0.05 }
    expect(holtForecast(state, 5)).toBe(100)
  })
})

describe('runHolt', () => {
  it('returns empty errors for single-value series', () => {
    const result = runHolt([100])
    expect(result.errors).toHaveLength(0)
  })

  it('collects prediction errors for multi-value series', () => {
    const result = runHolt([100, 110, 120, 130, 140])
    // 4 one-step-ahead predictions (n-1 errors)
    expect(result.errors).toHaveLength(4)
    expect(result.finalState.level).toBeGreaterThan(0)
  })

  it('tracks an increasing trend', () => {
    const series = Array.from({ length: 30 }, (_, i) => 100 + i * 2) // steady increase
    const result = runHolt(series)
    expect(result.finalState.trend).toBeGreaterThan(0)
    // Damped trend (phi=0.9) projects upward over the horizon — each step higher than the
    // last and above the level — but deliberately does NOT extrapolate the full undamped
    // slope past the last actual. That conservatism is the point (FORECASTING_RESEARCH §16.1).
    expect(holtForecast(result.finalState, 1)).toBeGreaterThan(result.finalState.level)
    expect(holtForecast(result.finalState, 2)).toBeGreaterThan(holtForecast(result.finalState, 1))
  })

  it('tracks a decreasing trend', () => {
    const series = Array.from({ length: 30 }, (_, i) => 200 - i * 3) // steady decrease
    const result = runHolt(series)
    expect(result.finalState.trend).toBeLessThan(0)
  })
})

describe('damped trend', () => {
  it('phi=1 recovers classic level + h*trend (undamped)', () => {
    const state = { level: 100, trend: 5, alpha: 0.2, beta: 0.05, phi: 1 }
    expect(holtForecast(state, 1)).toBe(105)
    expect(holtForecast(state, 10)).toBe(150)
  })

  it('defaults to undamped when phi is absent (back-compat for literal states)', () => {
    const state = { level: 100, trend: 5, alpha: 0.2, beta: 0.05 }
    expect(holtForecast(state, 10)).toBe(150)
  })

  it('bounds the cumulative trend contribution by phi/(1-phi)', () => {
    const state = { level: 0, trend: 10, alpha: 0.2, beta: 0.05, phi: 0.9 }
    // Geometric cap: trend * phi/(1-phi) = 10 * (0.9/0.1) = 90, approached as h grows.
    const farForecast = holtForecast(state, 1000)
    expect(farForecast).toBeLessThanOrEqual(90 + 1e-6)
    expect(farForecast).toBeGreaterThan(85)
  })

  it('forecasts below undamped at a long horizon (no runaway extrapolation)', () => {
    const series = Array.from({ length: 30 }, (_, i) => 100 + i * 2)
    const damped = runHolt(series).finalState // phi=0.9 by default
    const undamped = { ...damped, phi: 1 }
    expect(holtForecast(damped, 90)).toBeLessThan(holtForecast(undamped, 90))
  })
})

describe('calculateDayOfWeekFactors', () => {
  it('returns null with insufficient data (<28 days)', () => {
    const residuals = new Map<string, number>()
    for (let i = 1; i <= 20; i++) {
      residuals.set(`2026-01-${String(i).padStart(2, '0')}`, -50)
    }
    expect(calculateDayOfWeekFactors(residuals)).toBeNull()
  })

  it('returns 7 factors with sufficient data', () => {
    const residuals = new Map<string, number>()
    // Generate 35 days of data (5 weeks)
    for (let i = 0; i < 35; i++) {
      const d = new Date(2026, 0, 1 + i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      // Weekends spend more (Sat=5, Sun=6 in our Mon=0 indexing)
      const dow = d.getDay()
      const isWeekend = dow === 0 || dow === 6
      residuals.set(dateStr, isWeekend ? -200 : -100)
    }

    const factors = calculateDayOfWeekFactors(residuals)
    expect(factors).not.toBeNull()
    expect(factors).toHaveLength(7)
    // Weekend factors should be higher than weekday
    // factors[4]=Friday, factors[5]=Saturday, factors[6]=Sunday
    expect(factors![5]).toBeGreaterThan(factors![0]!) // Saturday > Monday
    expect(factors![6]).toBeGreaterThan(factors![0]!) // Sunday > Monday
  })
})

describe('calculatePredictionBands', () => {
  it('returns flat band with insufficient errors', () => {
    const band = calculatePredictionBands([10], 100, 5)
    expect(band.upper).toBe(100)
    expect(band.lower).toBe(100)
    expect(band.point).toBe(100)
  })

  it('widens band with more steps ahead', () => {
    const errors = [5, -3, 7, -2, 4, -6, 3, -1, 5, -4]
    const band1 = calculatePredictionBands(errors, 100, 1)
    const band10 = calculatePredictionBands(errors, 100, 10)

    const width1 = band1.upper - band1.lower
    const width10 = band10.upper - band10.lower
    expect(width10).toBeGreaterThan(width1) // bands widen with horizon
  })

  it('centres band on forecast', () => {
    const errors = [5, -5, 5, -5, 5, -5]
    const band = calculatePredictionBands(errors, 100, 1)
    expect(band.point).toBe(100)
    // Symmetric errors → symmetric band
    const upperDist = band.upper - band.point
    const lowerDist = band.point - band.lower
    expect(upperDist).toBeCloseTo(lowerDist, 1)
  })

  it('produces an asymmetric band for skewed errors', () => {
    // Mostly small positive errors with one large negative (an expense spike) → fat lower tail.
    // A symmetric ±1.28σ band could not represent this; empirical quantiles can.
    const errors = [2, 1, 3, 2, 1, 2, 3, 1, 2, -20]
    const band = calculatePredictionBands(errors, 100, 1)
    const upperDist = band.upper - band.point
    const lowerDist = band.point - band.lower
    expect(lowerDist).toBeGreaterThan(upperDist)
  })
})

describe('buildForecast', () => {
  it('returns empty forecast for no data', () => {
    const result = buildForecast([], [], '2026-03-01', '2026-03-07')
    expect(result.daily).toHaveLength(7)
    expect(result.variableMethod).toBe('none')
    // With no patterns and no history, all amounts should be 0
    for (const p of result.daily) {
      expect(p.amount).toBe(0)
    }
  })

  it('produces recurring-only forecast with patterns but no history', () => {
    const patterns = [
      makePattern({ expectedAmount: -12000, frequency: 'monthly', anchorDay: 1 }),
    ]
    const result = buildForecast([], patterns, '2026-03-01', '2026-03-31')
    expect(result.variableMethod).toBe('none')
    // Should have -12000 on March 1
    const march1 = result.daily.find((d) => d.date === '2026-03-01')
    expect(march1).toBeDefined()
    expect(march1!.amount).toBe(-12000)
    expect(march1!.source).toBe('recurring-only')
  })

  it('uses average method with few history days', () => {
    // Create 10 days of history (below MIN_DAYS_FOR_HOLT=14)
    const txns: Transaction[] = []
    for (let i = 1; i <= 10; i++) {
      txns.push(makeTxn({
        id: `t-${i}`,
        date: `2026-02-${String(i).padStart(2, '0')}`,
        amount: -50,
      }))
    }

    const result = buildForecast(txns, [], '2026-03-01', '2026-03-07')
    expect(result.variableMethod).toBe('average')
  })

  it('uses combination method with sufficient history', () => {
    // Create 20 days of history (above MIN_DAYS_FOR_COMBINATION=14)
    const txns: Transaction[] = []
    for (let i = 1; i <= 20; i++) {
      txns.push(makeTxn({
        id: `t-${i}`,
        date: `2026-02-${String(i).padStart(2, '0')}`,
        amount: -(50 + i), // slight trend
      }))
    }

    const result = buildForecast(txns, [], '2026-03-01', '2026-03-07')
    expect(result.variableMethod).toBe('combination')
    // variableState exposes the damped-ETS component of the combination
    expect(result.variableState).not.toBeNull()
    expect(result.predictionErrors.length).toBeGreaterThan(0)
  })

  it('includes prediction bands when errors exist', () => {
    const txns: Transaction[] = []
    for (let i = 1; i <= 20; i++) {
      txns.push(makeTxn({
        id: `t-${i}`,
        date: `2026-02-${String(i).padStart(2, '0')}`,
        amount: -(50 + (i % 5) * 4),  // deterministic variation: -50, -54, -58, -62, -66
      }))
    }

    const result = buildForecast(txns, [], '2026-03-01', '2026-03-07')
    // Should have bands on forecast points
    const withBands = result.daily.filter((d) => d.band !== null)
    expect(withBands.length).toBeGreaterThan(0)
  })

  it('combines recurring and variable components', () => {
    const txns: Transaction[] = []
    for (let i = 1; i <= 20; i++) {
      txns.push(makeTxn({
        id: `t-${i}`,
        date: `2026-02-${String(i).padStart(2, '0')}`,
        amount: -80,
      }))
    }

    const patterns = [
      makePattern({ expectedAmount: -5000, frequency: 'monthly', anchorDay: 15 }),
    ]

    const result = buildForecast(txns, patterns, '2026-03-01', '2026-03-31')
    // March 15 should have the recurring -5000 plus variable component
    const march15 = result.daily.find((d) => d.date === '2026-03-15')
    expect(march15).toBeDefined()
    expect(march15!.amount).toBeLessThan(-5000) // -5000 recurring + variable expense
    expect(march15!.source).toBe('recurring+variable')
  })

  it('accumulates cumulative totals correctly', () => {
    const patterns = [
      makePattern({ expectedAmount: -100, frequency: 'daily', anchorDay: 0 }),
    ]
    const result = buildForecast([], patterns, '2026-03-01', '2026-03-03')
    expect(result.daily).toHaveLength(3)
    expect(result.daily[0]!.cumulative).toBeCloseTo(-100, 0)
    expect(result.daily[1]!.cumulative).toBeCloseTo(-200, 0)
    expect(result.daily[2]!.cumulative).toBeCloseTo(-300, 0)
  })

  it('generates prediction errors for sparse data (< 14 days, average method)', () => {
    // Requirement: Sparse data should still produce meaningful prediction bands
    const txns: Transaction[] = []
    for (let i = 1; i <= 8; i++) {
      txns.push(makeTxn({
        id: `t-${i}`,
        date: `2026-02-${String(i).padStart(2, '0')}`,
        amount: -(40 + i * 5), // variable amounts: -45, -50, -55...
      }))
    }

    const result = buildForecast(txns, [], '2026-03-01', '2026-03-07')
    expect(result.variableMethod).toBe('average')
    // Should have prediction errors computed from residuals vs average
    expect(result.predictionErrors.length).toBeGreaterThan(0)
    // Should have non-zero band widths (not flat)
    const withBands = result.daily.filter((d) => d.band !== null && d.band.upper !== d.band.lower)
    expect(withBands.length).toBeGreaterThan(0)
  })

  it('handles zero starting balance runway with empty forecast', () => {
    const result = buildForecast([], [], '2026-03-01', '2026-03-07')
    expect(result.daily).toHaveLength(7)
    // All zero amounts, all zero cumulative
    for (const p of result.daily) {
      expect(p.amount).toBe(0)
      expect(p.cumulative).toBe(0)
    }
  })

  it('handles constant-series combination initialization gracefully', () => {
    // A constant series should produce near-zero trend in the ETS component
    const txns: Transaction[] = []
    for (let i = 1; i <= 20; i++) {
      txns.push(makeTxn({
        id: `t-${i}`,
        date: `2026-02-${String(i).padStart(2, '0')}`,
        amount: -100, // constant
      }))
    }
    const result = buildForecast(txns, [], '2026-03-01', '2026-03-07')
    expect(result.variableMethod).toBe('combination')
    // Trend should be near zero for constant series
    expect(Math.abs(result.variableState!.trend)).toBeLessThan(1)
  })

  it('combination forecast follows the residual trend direction', () => {
    // Rising daily expense magnitude → forecast variable component stays negative and
    // the combination (Theta drift + damped ETS) projects continued spend.
    const txns: Transaction[] = []
    for (let i = 1; i <= 20; i++) {
      txns.push(makeTxn({
        id: `t-${i}`,
        date: `2026-02-${String(i).padStart(2, '0')}`,
        amount: -(40 + i * 3), // steadily larger expenses
      }))
    }
    const result = buildForecast(txns, [], '2026-03-01', '2026-03-07')
    expect(result.variableMethod).toBe('combination')
    const variablePoints = result.daily.filter((d) => d.source === 'recurring+variable')
    expect(variablePoints.length).toBeGreaterThan(0)
    // All forecast amounts are expenses (negative) and finite
    for (const p of variablePoints) {
      expect(p.amount).toBeLessThan(0)
      expect(Number.isFinite(p.amount)).toBe(true)
    }
  })
})
