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

    const result = calculateCashflow(10000, projection, [], expenses)

    expect(result.startingBalance).toBe(10000)
    expect(result.totalExpenses).toBe(3000)
    expect(result.totalIncome).toBe(0)
    expect(result.endingBalance).toBe(7000)
    expect(result.months).toHaveLength(3)
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

    const result = calculateCashflow(5000, projection, [], expenses)

    expect(result.totalIncome).toBe(9000)
    expect(result.totalExpenses).toBe(6000)
    expect(result.totalNet).toBe(3000)
    expect(result.endingBalance).toBe(8000)
    expect(result.months[0]!.balance).toBe(6000)
    expect(result.months[1]!.balance).toBe(7000)
    expect(result.months[2]!.balance).toBe(8000)
  })

  it('detects zero crossing when balance goes negative', () => {
    const expenses = [makeExpense({ amount: 5000 })]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    const result = calculateCashflow(8000, projection, [], expenses)

    expect(result.willGoNegative).toBe(true)
    expect(result.zeroCrossingMonth).toBe('Feb 26')
    expect(result.lowestBalance).toBe(-7000)
  })

  it('reports no zero crossing when balance stays positive', () => {
    const expenses = [makeExpense({ amount: 100 })]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    const result = calculateCashflow(10000, projection, [], expenses)

    expect(result.willGoNegative).toBe(false)
    expect(result.zeroCrossingDate).toBeNull()
    expect(result.zeroCrossingMonth).toBeNull()
  })

  it('splits actuals by linked expense type — expense actuals replace projected expenses', () => {
    const expenses = [makeExpense({ id: 'e1', amount: 1000 })]
    const actuals = [
      makeActual({ id: 'a1', expenseId: 'e1', date: '2026-01-10', amount: 800 }),
      makeActual({ id: 'a2', expenseId: 'e1', date: '2026-01-20', amount: 400 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    const result = calculateCashflow(10000, projection, actuals, expenses)

    // Jan: actual expenses 1200 replaces projected 1000
    expect(result.months[0]!.actualExpenses).toBe(1200)
    expect(result.months[0]!.actualIncome).toBeNull()
    expect(result.months[0]!.balance).toBe(8800)
    // Feb: no actuals, use projected
    expect(result.months[1]!.actualExpenses).toBeNull()
    expect(result.months[1]!.balance).toBe(7800)
  })

  it('splits actuals by type — income actuals replace projected income, not expenses', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 2000, type: 'expense' }),
      makeExpense({ id: 'e2', amount: 5000, type: 'income', category: 'Salary' }),
    ]
    const actuals = [
      // Salary came in higher than projected
      makeActual({ id: 'a1', expenseId: 'e2', date: '2026-01-05', amount: 6000 }),
      // Rent was as expected
      makeActual({ id: 'a2', expenseId: 'e1', date: '2026-01-15', amount: 2000 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    const result = calculateCashflow(10000, projection, actuals, expenses)

    // Jan: actual income 6000 (not projected 5000), actual expenses 2000 (matches projected)
    expect(result.months[0]!.actualIncome).toBe(6000)
    expect(result.months[0]!.actualExpenses).toBe(2000)
    // effectiveNet = 6000 - 2000 = 4000 (not projected 3000)
    expect(result.months[0]!.effectiveNet).toBe(4000)
    expect(result.months[0]!.balance).toBe(14000)
  })

  it('treats unmatched actuals (null expenseId) as expenses by default', () => {
    const expenses = [makeExpense({ id: 'e1', amount: 1000 })]
    const actuals = [
      makeActual({ id: 'a1', expenseId: null, date: '2026-01-15', amount: 500 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    const result = calculateCashflow(10000, projection, actuals, expenses)

    // Unmatched actual → treated as expense, so actual expenses = 500
    expect(result.months[0]!.actualExpenses).toBe(500)
    expect(result.months[0]!.actualIncome).toBeNull()
    // effectiveNet = projected income (0) - actual expenses (500)
    expect(result.months[0]!.effectiveNet).toBe(-500)
    expect(result.months[0]!.balance).toBe(9500)
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

    const result = calculateCashflow(10000, projection, [], expenses)

    expect(result.lowestBalance).toBe(4000)
    expect(result.lowestBalanceMonth).toBe('Feb 26')
    expect(result.endingBalance).toBe(6000)
  })

  it('handles zero starting balance', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 1000, type: 'income' }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    const result = calculateCashflow(0, projection, [], expenses)

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

    const result = calculateCashflow(5000, projection, [], expenses)

    expect(result.months[0]!.projectedIncome).toBe(3000)
    expect(result.months[0]!.projectedExpenses).toBe(2000)
    expect(result.months[0]!.projectedNet).toBe(1000)
    expect(result.months[0]!.effectiveNet).toBe(1000)
  })
})
