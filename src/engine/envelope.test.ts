import { describe, it, expect } from 'vitest'
import { calculateEnvelope } from './envelope'
import { calculateProjection } from './projection'
import type { Expense, Actual } from '@/types/models'

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    budgetId: 'b-1',
    description: 'Test expense',
    category: 'General',
    amount: 1000,
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
    budgetId: 'b-1',
    expenseId: 'exp-1',
    date: '2026-01-15',
    amount: 1000,
    category: 'General',
    description: 'Test actual',
    originalRow: {},
    matchConfidence: 'high',
    approved: true,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    ...overrides,
  }
}

describe('calculateEnvelope', () => {
  it('calculates remaining balance correctly with no actuals', () => {
    const expenses = [makeExpense({ amount: 1000 })]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    const result = calculateEnvelope(5000, projection, [], '2026-01-15', expenses)

    expect(result.startingBalance).toBe(5000)
    expect(result.totalSpent).toBe(0)
    expect(result.remainingBalance).toBe(5000)
    expect(result.totalProjected).toBe(3000) // 1000 × 3 months
    expect(result.willExceed).toBe(false)
    expect(result.projectedSurplus).toBe(2000) // 5000 - 3000
    expect(result.dailyBurnRate).toBeNull() // No actuals
    expect(result.depletionDate).toBeNull()
  })

  it('calculates remaining balance after actuals', () => {
    const expenses = [makeExpense({ amount: 1000 })]
    const actuals = [
      makeActual({ id: 'a1', date: '2026-01-10', amount: 800 }),
      makeActual({ id: 'a2', date: '2026-01-20', amount: 300 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    const result = calculateEnvelope(5000, projection, actuals, '2026-01-25', expenses)

    expect(result.totalSpent).toBe(1100)
    expect(result.remainingBalance).toBe(3900)
  })

  it('detects when budget will be exceeded', () => {
    const expenses = [makeExpense({ amount: 2000 })]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    // Budget of 5000, projected spend 6000 (2000 × 3)
    const result = calculateEnvelope(5000, projection, [], '2026-01-15', expenses)

    expect(result.willExceed).toBe(true)
    expect(result.projectedSurplus).toBe(-1000)
  })

  it('calculates daily burn rate from actuals', () => {
    const expenses = [makeExpense({ amount: 1000 })]
    const actuals = [
      makeActual({ id: 'a1', date: '2026-01-01', amount: 100 }),
      makeActual({ id: 'a2', date: '2026-01-10', amount: 200 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    const result = calculateEnvelope(5000, projection, actuals, '2026-01-10', expenses)

    expect(result.dailyBurnRate).not.toBeNull()
    // 300 spent over 10 days = 30/day
    expect(result.dailyBurnRate).toBeCloseTo(30, 0)
  })

  it('calculates depletion date', () => {
    const expenses = [makeExpense({ amount: 1000 })]
    const actuals = [
      makeActual({ id: 'a1', date: '2026-01-01', amount: 500 }),
      makeActual({ id: 'a2', date: '2026-01-10', amount: 500 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-06-30')

    const result = calculateEnvelope(3000, projection, actuals, '2026-01-10', expenses)

    expect(result.depletionDate).not.toBeNull()
    expect(result.daysRemaining).not.toBeNull()
    expect(result.daysRemaining!).toBeGreaterThan(0)
  })

  it('shows zero days remaining when budget is already exceeded', () => {
    const expenses = [makeExpense({ amount: 1000 })]
    const actuals = [
      makeActual({ id: 'a1', date: '2026-01-01', amount: 3000 }),
      makeActual({ id: 'a2', date: '2026-01-10', amount: 2500 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    const result = calculateEnvelope(5000, projection, actuals, '2026-01-15', expenses)

    expect(result.remainingBalance).toBeLessThan(0)
    expect(result.daysRemaining).toBe(0)
  })

  it('builds month-by-month breakdown with running balance', () => {
    const expenses = [makeExpense({ amount: 1000 })]
    const actuals = [
      makeActual({ id: 'a1', date: '2026-01-15', amount: 900 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    const result = calculateEnvelope(5000, projection, actuals, '2026-02-01', expenses)

    expect(result.months).toHaveLength(3)

    // Jan: actual=900 (used instead of projected 1000), remaining=4100
    expect(result.months[0]!.actual).toBe(900)
    expect(result.months[0]!.effectiveSpend).toBe(900)
    expect(result.months[0]!.remainingBalance).toBe(4100)

    // Feb: no actuals, use projected 1000, remaining=3100
    expect(result.months[1]!.actual).toBeNull()
    expect(result.months[1]!.effectiveSpend).toBe(1000)
    expect(result.months[1]!.remainingBalance).toBe(3100)

    // Mar: no actuals, use projected 1000, remaining=2100
    expect(result.months[2]!.remainingBalance).toBe(2100)
  })

  it('excludes income-type actuals from spend tracking', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 1000, type: 'expense' }),
      makeExpense({ id: 'e2', amount: 3000, type: 'income', category: 'Salary' }),
    ]
    const actuals = [
      // Expense actual — should count as spend
      makeActual({ id: 'a1', expenseId: 'e1', date: '2026-01-15', amount: 900 }),
      // Income actual — should NOT count as spend
      makeActual({ id: 'a2', expenseId: 'e2', date: '2026-01-05', amount: 3000 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    const result = calculateEnvelope(5000, projection, actuals, '2026-01-20', expenses)

    // Only the expense actual (900) should count as spend, not the income (3000)
    expect(result.totalSpent).toBe(900)
    expect(result.remainingBalance).toBe(4100)
    // Daily burn rate based only on expense actuals
    expect(result.dailyBurnRate).not.toBeNull()
  })
})
