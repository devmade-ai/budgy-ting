import { describe, it, expect } from 'vitest'
import { generateMonthSlots, calculateProjection } from './projection'
import type { Expense } from '@/types/models'

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    budgetId: 'b-1',
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

describe('generateMonthSlots', () => {
  it('generates correct number of months for a year', () => {
    const slots = generateMonthSlots('2026-01', '2026-12')
    expect(slots).toHaveLength(12)
    expect(slots[0]!.month).toBe('2026-01')
    expect(slots[11]!.month).toBe('2026-12')
  })

  it('handles cross-year ranges', () => {
    const slots = generateMonthSlots('2025-11', '2026-02')
    expect(slots).toHaveLength(4)
    expect(slots.map((s) => s.month)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })

  it('sets correct days in month for February', () => {
    const slots = generateMonthSlots('2026-02', '2026-02')
    expect(slots).toHaveLength(1)
    expect(slots[0]!.daysInMonth).toBe(28) // 2026 is not a leap year
  })

  it('sets correct days in month for February leap year', () => {
    const slots = generateMonthSlots('2028-02', '2028-02')
    expect(slots).toHaveLength(1)
    expect(slots[0]!.daysInMonth).toBe(29)
  })
})

describe('calculateProjection', () => {
  it('calculates monthly expenses correctly', () => {
    const expense = makeExpense({ amount: 500, frequency: 'monthly' })
    const result = calculateProjection([expense], '2026-01-01', '2026-03-31')

    expect(result.months).toHaveLength(3)
    expect(result.grandTotal).toBe(1500)
    expect(result.monthlyTotals.get('2026-01')).toBe(500)
    expect(result.monthlyTotals.get('2026-02')).toBe(500)
    expect(result.monthlyTotals.get('2026-03')).toBe(500)
  })

  it('calculates daily expenses using full month days', () => {
    const expense = makeExpense({ amount: 10, frequency: 'daily' })
    const result = calculateProjection([expense], '2026-01-01', '2026-01-31')

    expect(result.months).toHaveLength(1)
    // 31 days in January × 10 = 310
    expect(result.grandTotal).toBe(310)
  })

  it('calculates weekly expenses correctly', () => {
    const expense = makeExpense({ amount: 100, frequency: 'weekly' })
    const result = calculateProjection([expense], '2026-01-01', '2026-01-31')

    expect(result.months).toHaveLength(1)
    // 31 days / 7 ≈ 4.4286 weeks × 100
    const expected = 100 * (31 / 7)
    expect(result.grandTotal).toBeCloseTo(expected, 2)
  })

  it('calculates once-off expenses in correct month only', () => {
    const expense = makeExpense({
      amount: 1000,
      frequency: 'once-off',
      startDate: '2026-02-15',
    })
    const result = calculateProjection([expense], '2026-01-01', '2026-03-31')

    expect(result.monthlyTotals.get('2026-01')).toBe(0)
    expect(result.monthlyTotals.get('2026-02')).toBe(1000)
    expect(result.monthlyTotals.get('2026-03')).toBe(0)
  })

  it('calculates quarterly expenses at correct intervals', () => {
    const expense = makeExpense({
      amount: 300,
      frequency: 'quarterly',
      startDate: '2026-01-01',
    })
    const result = calculateProjection([expense], '2026-01-01', '2026-06-30')

    expect(result.monthlyTotals.get('2026-01')).toBe(300)
    expect(result.monthlyTotals.get('2026-02')).toBe(0)
    expect(result.monthlyTotals.get('2026-03')).toBe(0)
    expect(result.monthlyTotals.get('2026-04')).toBe(300)
    expect(result.grandTotal).toBe(600)
  })

  it('calculates annually expenses in anniversary month only', () => {
    const expense = makeExpense({
      amount: 1200,
      frequency: 'annually',
      startDate: '2026-03-01',
    })
    const result = calculateProjection([expense], '2026-01-01', '2026-12-31')

    expect(result.monthlyTotals.get('2026-03')).toBe(1200)
    expect(result.monthlyTotals.get('2026-06')).toBe(0)
    expect(result.grandTotal).toBe(1200)
  })

  it('respects expense end date', () => {
    const expense = makeExpense({
      amount: 100,
      frequency: 'monthly',
      endDate: '2026-02-28',
    })
    const result = calculateProjection([expense], '2026-01-01', '2026-04-30')

    expect(result.monthlyTotals.get('2026-01')).toBe(100)
    expect(result.monthlyTotals.get('2026-02')).toBe(100)
    expect(result.monthlyTotals.get('2026-03')).toBe(0)
    expect(result.grandTotal).toBe(200)
  })

  it('handles daily expenses across month boundary correctly', () => {
    // Expense starts Jan 25, budget goes to Feb 5
    const expense = makeExpense({
      amount: 10,
      frequency: 'daily',
      startDate: '2026-01-25',
    })
    const result = calculateProjection([expense], '2026-01-01', '2026-02-28')

    // Jan: 25th to 31st = 7 days → 70
    expect(result.monthlyTotals.get('2026-01')).toBe(70)
    // Feb: 1st to 28th = 28 days → 280
    expect(result.monthlyTotals.get('2026-02')).toBe(280)
  })

  it('builds category rollup correctly', () => {
    const expenses = [
      makeExpense({ id: 'e1', category: 'Food', amount: 200 }),
      makeExpense({ id: 'e2', category: 'Food', amount: 100 }),
      makeExpense({ id: 'e3', category: 'Transport', amount: 50 }),
    ]
    const result = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    const food = result.categoryRollup.get('Food')
    expect(food?.get('2026-01')).toBe(300)

    const transport = result.categoryRollup.get('Transport')
    expect(transport?.get('2026-01')).toBe(50)
  })

  it('separates income from expense in monthly totals', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 500, type: 'expense' }),
      makeExpense({ id: 'e2', amount: 3000, type: 'income', category: 'Salary' }),
    ]
    const result = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    // monthlyTotals tracks expenses only
    expect(result.monthlyTotals.get('2026-01')).toBe(500)
    // monthlyIncome tracks income only
    expect(result.monthlyIncome.get('2026-01')).toBe(3000)
    // monthlyNet = income - expenses
    expect(result.monthlyNet.get('2026-01')).toBe(2500)
    // grandTotal is expense-only
    expect(result.grandTotal).toBe(500)
    expect(result.totalIncome).toBe(3000)
    expect(result.totalNet).toBe(2500)
  })

  it('tracks type on projected rows', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 500, type: 'expense' }),
      makeExpense({ id: 'e2', amount: 3000, type: 'income' }),
    ]
    const result = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    expect(result.rows[0]!.type).toBe('expense')
    expect(result.rows[1]!.type).toBe('income')
  })

  it('excludes income from category rollup', () => {
    const expenses = [
      makeExpense({ id: 'e1', amount: 500, type: 'expense', category: 'Food' }),
      makeExpense({ id: 'e2', amount: 3000, type: 'income', category: 'Salary' }),
    ]
    const result = calculateProjection(expenses, '2026-01-01', '2026-01-31')

    expect(result.categoryRollup.has('Food')).toBe(true)
    expect(result.categoryRollup.has('Salary')).toBe(false)
  })
})
