import { describe, it, expect } from 'vitest'
import { calculateCashflow } from './cashflow'
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

describe('calculateCashflow', () => {
  it('calculates running balance from starting balance minus expenses', () => {
    const expenses = [makeExpense({ amount: 1000 })]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    const result = calculateCashflow(10000, projection, [])

    expect(result.startingBalance).toBe(10000)
    expect(result.totalExpenses).toBe(3000)
    expect(result.totalIncome).toBe(0)
    expect(result.endingBalance).toBe(7000)
    expect(result.months).toHaveLength(3)
    // Running balance: 10000 - 1000 = 9000, - 1000 = 8000, - 1000 = 7000
    expect(result.months[0]!.balance).toBe(9000)
    expect(result.months[1]!.balance).toBe(8000)
    expect(result.months[2]!.balance).toBe(7000)
  })

  it('includes income in running balance', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 2000, type: 'expense' }),
      makeExpense({ id: 'e2', amount: 3000, type: 'income', category: 'Salary' }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    const result = calculateCashflow(5000, projection, [])

    expect(result.totalIncome).toBe(9000) // 3000 × 3
    expect(result.totalExpenses).toBe(6000) // 2000 × 3
    expect(result.totalNet).toBe(3000) // 9000 - 6000
    expect(result.endingBalance).toBe(8000) // 5000 + 3000
    // Monthly: 5000 + 3000 - 2000 = 6000, + 1000 = 7000, + 1000 = 8000
    expect(result.months[0]!.balance).toBe(6000)
    expect(result.months[1]!.balance).toBe(7000)
    expect(result.months[2]!.balance).toBe(8000)
  })

  it('detects zero crossing when balance goes negative', () => {
    const expenses = [makeExpense({ amount: 5000 })]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    // Starting 8000, spend 5000/month: 3000 after Jan, -2000 after Feb
    const result = calculateCashflow(8000, projection, [])

    expect(result.willGoNegative).toBe(true)
    expect(result.zeroCrossingMonth).toBe('Feb 26')
    expect(result.lowestBalance).toBe(-7000) // After 3 months: 8000 - 15000
  })

  it('reports no zero crossing when balance stays positive', () => {
    const expenses = [makeExpense({ amount: 100 })]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    const result = calculateCashflow(10000, projection, [])

    expect(result.willGoNegative).toBe(false)
    expect(result.zeroCrossingDate).toBeNull()
    expect(result.zeroCrossingMonth).toBeNull()
  })

  it('uses actuals to adjust balance when available', () => {
    const expenses = [makeExpense({ amount: 1000 })]
    const actuals = [
      makeActual({ id: 'a1', date: '2026-01-10', amount: 800 }),
      makeActual({ id: 'a2', date: '2026-01-20', amount: 400 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    const result = calculateCashflow(10000, projection, actuals)

    // Jan: actual spend 1200 (not projected 1000), so balance = 10000 + 0 income - 1200 = 8800
    expect(result.months[0]!.actualSpend).toBe(1200)
    expect(result.months[0]!.balance).toBe(8800)
    // Feb: no actuals, use projected 1000
    expect(result.months[1]!.actualSpend).toBeNull()
    expect(result.months[1]!.balance).toBe(7800)
  })

  it('tracks lowest balance month', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 3000, type: 'expense' }),
      makeExpense({
        id: 'e2',
        amount: 5000,
        type: 'income',
        frequency: 'once-off',
        startDate: '2026-03-01',
      }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    // Starting 10000, spend 3000/month, income 5000 in March
    // Jan: 10000 - 3000 = 7000
    // Feb: 7000 - 3000 = 4000 (lowest)
    // Mar: 4000 + 5000 - 3000 = 6000
    const result = calculateCashflow(10000, projection, [])

    expect(result.lowestBalance).toBe(4000)
    expect(result.lowestBalanceMonth).toBe('Feb 26')
    expect(result.endingBalance).toBe(6000)
  })

  it('handles zero starting balance', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 1000, type: 'income' }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    const result = calculateCashflow(0, projection, [])

    expect(result.startingBalance).toBe(0)
    expect(result.endingBalance).toBe(1000)
    expect(result.willGoNegative).toBe(false)
  })

  it('provides month-by-month income and expense breakdown', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 2000, type: 'expense' }),
      makeExpense({ id: 'e2', amount: 3000, type: 'income' }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    const result = calculateCashflow(5000, projection, [])

    expect(result.months[0]!.projectedIncome).toBe(3000)
    expect(result.months[0]!.projectedExpenses).toBe(2000)
    expect(result.months[0]!.projectedNet).toBe(1000)
    expect(result.months[0]!.effectiveNet).toBe(1000)
  })
})
