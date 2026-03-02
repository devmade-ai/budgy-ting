import { describe, it, expect } from 'vitest'
import { validateImport } from './exportImport'
import type { ExportSchema } from './exportImport'
import type { Workspace, Expense } from '@/types/models'

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'b-1',
    name: 'Test Workspace',
    currencyLabel: 'R',
    periodType: 'monthly',
    startDate: '2026-01-01',
    endDate: null,
    startingBalance: null,
    isDemo: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    workspaceId: 'b-1',
    description: 'Test expense',
    tags: ['General'],
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

function makeValidExport(overrides: Partial<ExportSchema> = {}): ExportSchema {
  return {
    version: 2,
    exportedAt: '2026-01-15T00:00:00Z',
    workspace: makeWorkspace(),
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
    expect(result.data!.workspace.id).toBe('b-1')
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
    const result = validateImport({ ...data, version: 3 })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Unsupported format version')
  })

  it('rejects missing version', () => {
    const { version, ...rest } = makeValidExport()
    const result = validateImport(rest)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Unsupported format version')
  })

  it('rejects missing workspace', () => {
    const data = makeValidExport()
    const result = validateImport({ ...data, workspace: null })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Missing workspace data')
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

  it('rejects workspace without id', () => {
    const data = makeValidExport()
    const result = validateImport({
      ...data,
      workspace: { name: 'Test', periodType: 'monthly', startDate: '2026-01-01', createdAt: '2026-01-01T00:00:00Z' },
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('missing id')
  })

  it('rejects workspace without name', () => {
    const data = makeValidExport()
    const result = validateImport({
      ...data,
      workspace: { id: 'b-1', periodType: 'monthly', startDate: '2026-01-01', createdAt: '2026-01-01T00:00:00Z' },
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('missing name')
  })

  it('rejects workspace with invalid periodType', () => {
    const data = makeValidExport()
    const result = validateImport({
      ...data,
      workspace: { ...data.workspace, periodType: 'weekly' },
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('invalid periodType')
  })

  it('rejects workspace without startDate', () => {
    const ws = makeWorkspace()
    const result = validateImport({
      ...makeValidExport(),
      workspace: { id: ws.id, name: ws.name, periodType: 'monthly', createdAt: ws.createdAt },
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('missing startDate')
  })

  it('rejects workspace without createdAt', () => {
    const ws = makeWorkspace()
    const result = validateImport({
      ...makeValidExport(),
      workspace: { id: ws.id, name: ws.name, periodType: 'monthly', startDate: ws.startDate },
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('missing createdAt')
  })

  it('rejects expenses with missing required fields', () => {
    const result = validateImport({
      ...makeValidExport(),
      expenses: [{ id: 'exp-1', workspaceId: 'b-1' }],
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('missing required fields')
  })

  it('rejects expenses with non-number amount', () => {
    const result = validateImport({
      ...makeValidExport(),
      expenses: [{ id: 'exp-1', workspaceId: 'b-1', description: 'Test', amount: '100' }],
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain('missing required fields')
  })

  it('accepts valid export with empty expenses', () => {
    const result = validateImport(makeValidExport({ expenses: [] }))
    expect(result.valid).toBe(true)
  })

  it('accepts valid export with startingBalance', () => {
    const result = validateImport(makeValidExport({
      workspace: makeWorkspace({ startingBalance: 50000 }),
    }))
    expect(result.valid).toBe(true)
    expect(result.data!.workspace.startingBalance).toBe(50000)
  })

  it('accepts valid export with comparison data', () => {
    const result = validateImport(makeValidExport({
      comparison: {
        lineItems: [{ description: 'Test', category: 'General', tags: ['General'], budgeted: 1000, actual: 900, variance: -100 }],
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

  it('accepts old format with budget key (backward compat)', () => {
    const result = validateImport({
      version: 1,
      exportedAt: '2026-01-15T00:00:00Z',
      budget: makeWorkspace(),
      expenses: [makeExpense()],
      actuals: [],
      comparison: null,
    })
    expect(result.valid).toBe(true)
    expect(result.data!.workspace.id).toBe('b-1')
  })

  it('accepts old format with budgetId in expenses (backward compat)', () => {
    const result = validateImport({
      version: 1,
      exportedAt: '2026-01-15T00:00:00Z',
      workspace: makeWorkspace(),
      expenses: [{ id: 'exp-1', budgetId: 'b-1', description: 'Test', category: 'General', amount: 1000, frequency: 'monthly', type: 'expense', startDate: '2026-01-01', endDate: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }],
      actuals: [],
      comparison: null,
    })
    expect(result.valid).toBe(true)
  })
})
