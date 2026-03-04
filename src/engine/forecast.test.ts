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
    // Forecast should continue the upward trend
    expect(holtForecast(result.finalState, 1)).toBeGreaterThan(series[series.length - 1]!)
  })

  it('tracks a decreasing trend', () => {
    const series = Array.from({ length: 30 }, (_, i) => 200 - i * 3) // steady decrease
    const result = runHolt(series)
    expect(result.finalState.trend).toBeLessThan(0)
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

  it('uses holt method with sufficient history', () => {
    // Create 20 days of history (above MIN_DAYS_FOR_HOLT=14)
    const txns: Transaction[] = []
    for (let i = 1; i <= 20; i++) {
      txns.push(makeTxn({
        id: `t-${i}`,
        date: `2026-02-${String(i).padStart(2, '0')}`,
        amount: -(50 + i), // slight trend
      }))
    }

    const result = buildForecast(txns, [], '2026-03-01', '2026-03-07')
    expect(result.variableMethod).toBe('holt')
    expect(result.variableState).not.toBeNull()
    expect(result.predictionErrors.length).toBeGreaterThan(0)
  })

  it('includes prediction bands when errors exist', () => {
    const txns: Transaction[] = []
    for (let i = 1; i <= 20; i++) {
      txns.push(makeTxn({
        id: `t-${i}`,
        date: `2026-02-${String(i).padStart(2, '0')}`,
        amount: -(50 + Math.random() * 20),
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
})
