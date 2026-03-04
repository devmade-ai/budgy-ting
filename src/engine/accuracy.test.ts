import { describe, it, expect } from 'vitest'
import { calculateDailyAccuracy, summariseAccuracy } from './accuracy'
import { calculateProjection } from './projection'
import type { Expense, Actual } from '@/types/models'

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    workspaceId: 'w-1',
    description: 'Test expense',
    tags: ['Groceries'],
    amount: 310,
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
    amount: 12,
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

describe('calculateDailyAccuracy', () => {
  it('returns empty array when no actuals', () => {
    const expenses = [makeExpense()]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')
    const points = calculateDailyAccuracy(projection, [], expenses)
    expect(points).toHaveLength(0)
  })

  it('computes accuracy for days with both forecast and actual', () => {
    const expenses = [makeExpense({ amount: 310 })] // 310/31 = 10/day in Jan
    const actuals = [makeActual({ date: '2026-01-15', amount: 12 })]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    const points = calculateDailyAccuracy(projection, actuals, expenses)

    expect(points).toHaveLength(1)
    expect(points[0]!.date).toBe('2026-01-15')
    expect(points[0]!.forecastAmount).toBeCloseTo(10, 0)
    expect(points[0]!.actualAmount).toBe(12)
    expect(points[0]!.absoluteError).toBeCloseTo(2, 0)
    expect(points[0]!.percentError).not.toBeNull()
  })

  it('skips income actuals', () => {
    const expenses = [makeExpense({ type: 'income', amount: 3100 })]
    const actuals = [makeActual({ date: '2026-01-15', amount: 3100 })]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    const points = calculateDailyAccuracy(projection, actuals, expenses)
    expect(points).toHaveLength(0)
  })

  it('handles multiple categories', () => {
    const expenses = [
      makeExpense({ id: 'e1', tags: ['Groceries'], amount: 310 }),
      makeExpense({ id: 'e2', tags: ['Transport'], amount: 155 }),
    ]
    const actuals = [
      makeActual({ id: 'a1', expenseId: 'e1', date: '2026-01-10', amount: 15 }),
      makeActual({ id: 'a2', expenseId: 'e2', date: '2026-01-10', amount: 8 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')
    const points = calculateDailyAccuracy(projection, actuals, expenses)

    expect(points).toHaveLength(2)
    const categories = points.map((p) => p.category).sort()
    expect(categories).toEqual(['Groceries', 'Transport'])
  })
})

describe('summariseAccuracy', () => {
  it('returns null metrics for empty input', () => {
    const summary = summariseAccuracy([])
    expect(summary.mape).toBeNull()
    expect(summary.weightedMape).toBeNull()
    expect(summary.dataPoints).toBe(0)
  })

  it('computes MAPE from accuracy points', () => {
    const expenses = [makeExpense({ amount: 310 })]
    const actuals = [
      makeActual({ id: 'a1', date: '2026-01-10', amount: 12 }),
      makeActual({ id: 'a2', date: '2026-01-20', amount: 8 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')
    const points = calculateDailyAccuracy(projection, actuals, expenses)
    const summary = summariseAccuracy(points)

    expect(summary.dataPoints).toBe(2)
    expect(summary.mape).not.toBeNull()
    expect(summary.mape).toBeGreaterThan(0)
    expect(summary.byCategory.has('Groceries')).toBe(true)
    expect(summary.byMethod.has('deterministic')).toBe(true)
  })
})
