import { describe, it, expect } from 'vitest'
import { validateImport } from './exportImport'
import type { ExportSchema } from './exportImport'
import type { Budget, Expense } from '@/types/models'

function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'b-1',
    name: 'Test Budget',
    currencyLabel: 'R',
    periodType: 'monthly',
    startDate: '2026-01-01',
    endDate: null,
    totalBudget: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    budgetId: 'b-1',
    description: 'Test expense',
    category: 'General',
    amount: 1000,
    frequency: 'monthly',
    startDate: '2026-01-01',
    endDate: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeValidExport(overrides: Partial<ExportSchema> = {}): ExportSchema {
  return {
    version: 1,
    exportedAt: '2026-01-15T00:00:00Z',
    budget: makeBudget(),
    expenses: [makeExpense()],
    actuals: [],
    comparison: null,
    ...overrides,
  }
}

describe('validateImport', () => {
  it('accepts a valid export file', () => {
    const result = validateImport(makeValidExport())
    expect(result.valid).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data!.budget.id).toBe('b-1')
  })

  it('rejects null input', () => {
    const result = validateImport(null)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('not a JSON object')
  })

  it('rejects non-object input', () => {
    const result = validateImport('hello')
    expect(result.valid).toBe(false)
  })

  it('rejects wrong version', () => {
    const data = makeValidExport()
    const result = validateImport({ ...data, version: 2 })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Unsupported format version')
  })

  it('rejects missing version', () => {
    const { version, ...rest } = makeValidExport()
    const result = validateImport(rest)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Unsupported format version')
  })

  it('rejects missing budget', () => {
    const data = makeValidExport()
    const result = validateImport({ ...data, budget: null })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Missing budget data')
  })

  it('rejects missing expenses array', () => {
    const data = makeValidExport()
    const result = validateImport({ ...data, expenses: 'not an array' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Missing expenses data')
  })

  it('rejects missing actuals array', () => {
    const data = makeValidExport()
    const result = validateImport({ ...data, actuals: 'not an array' })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Missing actuals data')
  })

  it('rejects budget without id', () => {
    const data = makeValidExport()
    const result = validateImport({
      ...data,
      budget: { name: 'Test', periodType: 'monthly', startDate: '2026-01-01', createdAt: '2026-01-01T00:00:00Z' },
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('missing id')
  })

  it('rejects budget without name', () => {
    const data = makeValidExport()
    const result = validateImport({
      ...data,
      budget: { id: 'b-1', periodType: 'monthly', startDate: '2026-01-01', createdAt: '2026-01-01T00:00:00Z' },
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('missing name')
  })

  it('rejects budget with invalid periodType', () => {
    const data = makeValidExport()
    const result = validateImport({
      ...data,
      budget: { ...data.budget, periodType: 'weekly' },
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('invalid periodType')
  })

  it('rejects budget without startDate', () => {
    const budget = makeBudget()
    const result = validateImport({
      ...makeValidExport(),
      budget: { id: budget.id, name: budget.name, periodType: 'monthly', createdAt: budget.createdAt },
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('missing startDate')
  })

  it('rejects budget without createdAt', () => {
    const budget = makeBudget()
    const result = validateImport({
      ...makeValidExport(),
      budget: { id: budget.id, name: budget.name, periodType: 'monthly', startDate: budget.startDate },
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('missing createdAt')
  })

  it('rejects expenses with missing required fields', () => {
    const result = validateImport({
      ...makeValidExport(),
      expenses: [{ id: 'exp-1', budgetId: 'b-1' }],
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('missing required fields')
  })

  it('rejects expenses with non-number amount', () => {
    const result = validateImport({
      ...makeValidExport(),
      expenses: [{ id: 'exp-1', budgetId: 'b-1', description: 'Test', amount: '100' }],
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('missing required fields')
  })

  it('accepts valid export with empty expenses', () => {
    const result = validateImport(makeValidExport({ expenses: [] }))
    expect(result.valid).toBe(true)
  })

  it('accepts valid export with totalBudget', () => {
    const result = validateImport(makeValidExport({
      budget: makeBudget({ totalBudget: 50000 }),
    }))
    expect(result.valid).toBe(true)
    expect(result.data!.budget.totalBudget).toBe(50000)
  })

  it('accepts valid export with comparison data', () => {
    const result = validateImport(makeValidExport({
      comparison: {
        lineItems: [{ description: 'Test', category: 'General', budgeted: 1000, actual: 900, variance: -100 }],
        categories: [{ category: 'General', budgeted: 1000, actual: 900, variance: -100 }],
        monthly: [{ month: '2026-01', projected: 1000, actual: 900, variance: -100 }],
      },
    }))
    expect(result.valid).toBe(true)
    expect(result.data!.comparison).not.toBeNull()
  })

  it('only validates first 5 expenses', () => {
    // First 5 are valid, 6th is invalid — should still pass
    const validExpenses = Array.from({ length: 5 }, (_, i) =>
      makeExpense({ id: `exp-${i}` })
    )
    const result = validateImport(makeValidExport({
      expenses: [...validExpenses, { id: 'bad' } as unknown as Expense],
    }))
    expect(result.valid).toBe(true)
  })
})
