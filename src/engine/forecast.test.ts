import { describe, it, expect } from 'vitest'
import {
  calculateEMA,
  calculateRollingAverage,
  generateCashflowForecast,
  expandActualsToDailyPoints,
  expandForecastToDailyPoints,
  groupActualsByMonth,
} from './forecast'
import { calculateProjection } from './projection'
import type { Expense, Actual } from '@/types/models'

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    workspaceId: 'w-1',
    description: 'Test expense',
    tags: ['Groceries'],
    amount: 100,
    frequency: 'monthly',
    type: 'expense',
    startDate: '2026-01-01',
    endDate: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeActual(overrides: Partial<Actual> = {}): Actual {
  return {
    id: 'act-1',
    workspaceId: 'w-1',
    expenseId: 'exp-1',
    date: '2026-01-15',
    amount: 95,
    tags: ['Groceries'],
    description: 'Grocery store',
    originalRow: {},
    matchConfidence: 'high',
    approved: true,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    ...overrides,
  }
}

describe('calculateEMA', () => {
  it('returns 0 for empty array', () => {
    expect(calculateEMA([])).toBe(0)
  })

  it('returns the single value for one-element array', () => {
    expect(calculateEMA([100])).toBe(100)
  })

  it('weights recent values more heavily', () => {
    // Series: 100, 200 with alpha=0.3
    // EMA: start=100, then 0.3*200 + 0.7*100 = 130
    expect(calculateEMA([100, 200], 0.3)).toBeCloseTo(130, 2)
  })

  it('handles multi-step EMA correctly', () => {
    // Series: 100, 110, 120 with alpha=0.3
    // Step 1: 100
    // Step 2: 0.3*110 + 0.7*100 = 103
    // Step 3: 0.3*120 + 0.7*103 = 108.1
    expect(calculateEMA([100, 110, 120], 0.3)).toBeCloseTo(108.1, 1)
  })
})

describe('calculateRollingAverage', () => {
  it('returns 0 for empty array', () => {
    expect(calculateRollingAverage([])).toBe(0)
  })

  it('calculates correct average', () => {
    expect(calculateRollingAverage([100, 200, 300])).toBeCloseTo(200, 2)
  })
})

describe('groupActualsByMonth', () => {
  it('groups actuals by month (aggregate, not per-category)', () => {
    const expenses = [makeExpense()]
    const actuals = [
      makeActual({ id: 'a1', date: '2026-01-10', amount: 50 }),
      makeActual({ id: 'a2', date: '2026-01-20', amount: 45 }),
      makeActual({ id: 'a3', date: '2026-02-05', amount: 80 }),
    ]

    const result = groupActualsByMonth(actuals, expenses)
    expect(result.get('2026-01')).toBe(95)
    expect(result.get('2026-02')).toBe(80)
  })

  it('skips income actuals', () => {
    const expenses = [makeExpense({ type: 'income' })]
    const actuals = [makeActual({ amount: 1000 })]

    const result = groupActualsByMonth(actuals, expenses)
    expect(result.size).toBe(0)
  })

  it('aggregates multiple categories into one monthly total', () => {
    const expenses = [
      makeExpense({ id: 'e1', tags: ['Groceries'] }),
      makeExpense({ id: 'e2', tags: ['Transport'] }),
    ]
    const actuals = [
      makeActual({ id: 'a1', expenseId: 'e1', date: '2026-01-10', amount: 50 }),
      makeActual({ id: 'a2', expenseId: 'e2', date: '2026-01-15', amount: 30 }),
    ]

    const result = groupActualsByMonth(actuals, expenses)
    // Both categories summed into one monthly total
    expect(result.get('2026-01')).toBe(80)
  })
})

describe('generateCashflowForecast', () => {
  it('returns null with no actuals', () => {
    const forecast = generateCashflowForecast([], [])
    expect(forecast).toBeNull()
  })

  it('uses rolling average with fewer than 3 months of data', () => {
    const expenses = [makeExpense()]
    const actuals = [
      makeActual({ id: 'a1', date: '2026-01-15', amount: 100 }),
      makeActual({ id: 'a2', date: '2026-02-15', amount: 120 }),
    ]

    const forecast = generateCashflowForecast(actuals, expenses)

    expect(forecast).not.toBeNull()
    expect(forecast!.method).toBe('rolling-average')
    expect(forecast!.predicted).toBeCloseTo(110, 0)
    expect(forecast!.confidenceBand).toBeNull()
  })

  it('uses EMA with 3+ months of data', () => {
    const expenses = [makeExpense()]
    const actuals = [
      makeActual({ id: 'a1', date: '2026-01-15', amount: 100 }),
      makeActual({ id: 'a2', date: '2026-02-15', amount: 120 }),
      makeActual({ id: 'a3', date: '2026-03-15', amount: 140 }),
    ]

    const forecast = generateCashflowForecast(actuals, expenses)

    expect(forecast).not.toBeNull()
    expect(forecast!.method).toBe('ema')
    expect(forecast!.confidenceBand).not.toBeNull()
    expect(forecast!.dataPoints).toBe(3)
  })
})

describe('expandActualsToDailyPoints', () => {
  it('creates daily points from actuals with cumulative totals', () => {
    const expenses = [makeExpense()]
    const actuals = [
      makeActual({ id: 'a1', date: '2026-01-10', amount: 50 }),
      makeActual({ id: 'a2', date: '2026-01-20', amount: 30 }),
    ]

    const points = expandActualsToDailyPoints(actuals, expenses, '2026-01-01', '2026-01-31')

    expect(points).toHaveLength(2)
    // Expenses are negative in net cashflow
    expect(points[0]!.amount).toBe(-50)
    expect(points[0]!.cumulative).toBe(-50)
    expect(points[1]!.amount).toBe(-30)
    expect(points[1]!.cumulative).toBe(-80)
  })

  it('treats income actuals as positive', () => {
    const expenses = [makeExpense({ type: 'income' })]
    const actuals = [makeActual({ date: '2026-01-15', amount: 1000 })]

    const points = expandActualsToDailyPoints(actuals, expenses, '2026-01-01', '2026-01-31')

    expect(points).toHaveLength(1)
    expect(points[0]!.amount).toBe(1000)
  })

  it('excludes actuals outside date range', () => {
    const expenses = [makeExpense()]
    const actuals = [
      makeActual({ id: 'a1', date: '2025-12-31', amount: 50 }),
      makeActual({ id: 'a2', date: '2026-01-15', amount: 30 }),
    ]

    const points = expandActualsToDailyPoints(actuals, expenses, '2026-01-01', '2026-01-31')
    expect(points).toHaveLength(1)
    expect(points[0]!.date).toBe('2026-01-15')
  })
})

describe('expandForecastToDailyPoints', () => {
  it('distributes monthly projection evenly across days', () => {
    const expenses = [
      makeExpense({ amount: 3100, frequency: 'monthly' }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')
    const points = expandForecastToDailyPoints(projection, '2026-01-01', '2026-01-31')

    // January has 31 days; net = -3100 (expense, no income)
    // Daily = -3100/31 = -100
    expect(points).toHaveLength(31)
    expect(points[0]!.amount).toBeCloseTo(-100, 0)
    expect(points[30]!.cumulative).toBeCloseTo(-3100, 0)
  })
})
