import { describe, it, expect } from 'vitest'
import { calculateComparison } from './variance'
import { calculateProjection } from './projection'
import type { Expense, Actual } from '@/types/models'

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    workspaceId: 'b-1',
    description: 'Test expense',
    category: 'General',
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
    workspaceId: 'b-1',
    expenseId: 'exp-1',
    date: '2026-01-15',
    amount: 100,
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

describe('calculateComparison', () => {
  it('shows zero variance when actual matches budget', () => {
    const expenses = [makeExpense({ amount: 500 })]
    const actuals = [makeActual({ amount: 500 })]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    const result = calculateComparison(projection, actuals, expenses)

    expect(result.totalBudgeted).toBe(500)
    expect(result.totalActual).toBe(500)
    expect(result.totalVariance).toBeCloseTo(0, 2)
  })

  it('shows positive variance (overspend) when actual exceeds budget', () => {
    const expenses = [makeExpense({ amount: 500 })]
    const actuals = [makeActual({ amount: 700 })]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    const result = calculateComparison(projection, actuals, expenses)

    expect(result.totalVariance).toBe(200)
  })

  it('shows negative variance (underspend) when actual is less than budget', () => {
    const expenses = [makeExpense({ amount: 500 })]
    const actuals = [makeActual({ amount: 300 })]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    const result = calculateComparison(projection, actuals, expenses)

    expect(result.totalVariance).toBe(-200)
  })

  it('calculates per-line-item variance correctly', () => {
    const expenses = [
      makeExpense({ id: 'e1', description: 'Rent', category: 'Housing', amount: 1000 }),
      makeExpense({ id: 'e2', description: 'Food', category: 'Groceries', amount: 500 }),
    ]
    const actuals = [
      makeActual({ id: 'a1', expenseId: 'e1', amount: 1100 }),
      makeActual({ id: 'a2', expenseId: 'e2', amount: 400 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    const result = calculateComparison(projection, actuals, expenses)

    expect(result.lineItems).toHaveLength(2)
    const rent = result.lineItems.find((li) => li.description === 'Rent')
    expect(rent?.variance).toBe(100) // 1100 - 1000
    expect(rent?.direction).toBe('over')

    const food = result.lineItems.find((li) => li.description === 'Food')
    expect(food?.variance).toBe(-100) // 400 - 500
    expect(food?.direction).toBe('under')
  })

  it('tracks unbudgeted actuals', () => {
    const expenses = [makeExpense()]
    const actuals = [
      makeActual({ expenseId: 'exp-1', amount: 100 }),
      makeActual({ id: 'a2', expenseId: null, amount: 50, description: 'Random purchase' }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    const result = calculateComparison(projection, actuals, expenses)

    expect(result.unbudgeted).toHaveLength(1)
    expect(result.unbudgeted[0]!.amount).toBe(50)
  })

  it('calculates category-level variance', () => {
    const expenses = [
      makeExpense({ id: 'e1', category: 'Food', amount: 200 }),
      makeExpense({ id: 'e2', category: 'Food', amount: 300 }),
    ]
    const actuals = [
      makeActual({ id: 'a1', expenseId: 'e1', amount: 250 }),
      makeActual({ id: 'a2', expenseId: 'e2', amount: 250 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    const result = calculateComparison(projection, actuals, expenses)

    const foodCat = result.categories.find((c) => c.category === 'Food')
    expect(foodCat?.budgeted).toBe(500)
    expect(foodCat?.actual).toBe(500)
    expect(foodCat?.variance).toBeCloseTo(0, 2)
  })

  it('calculates monthly variance', () => {
    const expenses = [makeExpense({ amount: 100 })]
    const actuals = [
      makeActual({ date: '2026-01-15', amount: 120 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-03-31')

    const result = calculateComparison(projection, actuals, expenses)

    const jan = result.monthly.find((m) => m.month === '2026-01')
    expect(jan?.projected).toBe(100)
    expect(jan?.actual).toBe(120)
    expect(jan?.variance).toBe(20)
    expect(jan?.direction).toBe('over')

    const feb = result.monthly.find((m) => m.month === '2026-02')
    expect(feb?.actual).toBe(0)
    expect(feb?.hasActuals).toBe(false)
  })

  it('excludes income-type actuals from expense variance tracking', () => {
    const expenses = [
      makeExpense({ id: 'e1', description: 'Rent', category: 'Housing', amount: 1000 }),
      makeExpense({ id: 'e2', description: 'Salary', category: 'Income', amount: 3000, type: 'income' }),
    ]
    const actuals = [
      makeActual({ id: 'a1', expenseId: 'e1', date: '2026-01-15', amount: 1000 }),
      // Salary actual — should NOT inflate totalActual or monthly expense variance
      makeActual({ id: 'a2', expenseId: 'e2', date: '2026-01-05', amount: 3500 }),
    ]
    const projection = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    const result = calculateComparison(projection, actuals, expenses)

    // Line items should only include expense lines, not income
    expect(result.lineItems).toHaveLength(1)
    expect(result.lineItems[0]!.description).toBe('Rent')

    // Total actual should only count expense actuals (1000), not income (3500)
    expect(result.totalActual).toBe(1000)

    // Monthly variance should only reflect expense actuals
    const jan = result.monthly.find((m) => m.month === '2026-01')
    expect(jan?.actual).toBe(1000)
    expect(jan?.hasActuals).toBe(true)
  })
})
