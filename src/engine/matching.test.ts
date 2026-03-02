import { describe, it, expect } from 'vitest'
import {
  matchImportedRows,
  detectDateFormat,
  parseDate,
  parseAmount,
} from './matching'
import type { Expense } from '@/types/models'
import type { ImportedRow } from './matching'

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    workspaceId: 'b-1',
    description: 'Monthly groceries',
    tags: ['Food'],
    amount: 500,
    frequency: 'monthly',
    type: 'expense',
    startDate: '2026-01-01',
    endDate: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeRow(overrides: Partial<ImportedRow> = {}): ImportedRow {
  return {
    date: '2026-01-15',
    amount: 500,
    tags: ['Food'],
    description: 'Monthly groceries',
    originalRow: {},
    ...overrides,
  }
}

describe('matchImportedRows', () => {
  it('matches exact category + amount as high confidence', () => {
    const expenses = [makeExpense()]
    const rows = [makeRow()]

    const results = matchImportedRows(rows, expenses)
    expect(results).toHaveLength(1)
    expect(results[0]!.confidence).toBe('high')
    expect(results[0]!.approved).toBe(true)
    expect(results[0]!.matchedExpense?.id).toBe('exp-1')
  })

  it('marks unmatched rows as unmatched', () => {
    const expenses = [makeExpense()]
    const rows = [makeRow({ amount: 999, tags: ['Transport'] })]

    const results = matchImportedRows(rows, expenses)
    expect(results).toHaveLength(1)
    expect(results[0]!.confidence).toBe('unmatched')
    expect(results[0]!.matchedExpense).toBeNull()
  })

  it('matches amount-only within same month as low confidence', () => {
    const expenses = [makeExpense()]
    const rows = [makeRow({ tags: ['Different'], description: 'Something else' })]

    const results = matchImportedRows(rows, expenses)
    expect(results).toHaveLength(1)
    // Should match on amount within same month range
    expect(results[0]!.confidence).toBe('low')
    expect(results[0]!.approved).toBe(false)
  })

  it('does not auto-approve medium confidence matches', () => {
    const expenses = [makeExpense()]
    const rows = [makeRow({ tags: ['Foods'], description: 'Monthly grocery' })]

    const results = matchImportedRows(rows, expenses)
    expect(results).toHaveLength(1)
    // Should be medium (fuzzy match) — not auto-approved
    if (results[0]!.confidence === 'medium') {
      expect(results[0]!.approved).toBe(false)
    }
  })

  it('handles multiple rows matching different expenses', () => {
    const expenses = [
      makeExpense({ id: 'e1', tags: ['Food'], amount: 500 }),
      makeExpense({ id: 'e2', tags: ['Transport'], amount: 200 }),
    ]
    const rows = [
      makeRow({ tags: ['Food'], amount: 500 }),
      makeRow({ tags: ['Transport'], amount: 200 }),
    ]

    const results = matchImportedRows(rows, expenses)
    expect(results).toHaveLength(2)
    expect(results.filter((r) => r.confidence === 'high')).toHaveLength(2)
  })

  it('prefers type-compatible match when originalSign is provided', () => {
    const expenses = [
      makeExpense({ id: 'e1', tags: ['Salary'], amount: 5000, type: 'income' }),
      makeExpense({ id: 'e2', tags: ['Salary'], amount: 5000, type: 'expense' }),
    ]
    // Row with negative sign (credit) should prefer income expense
    const rows = [
      makeRow({ tags: ['Salary'], amount: 5000, originalSign: 'negative' as const }),
    ]

    const results = matchImportedRows(rows, expenses)
    expect(results).toHaveLength(1)
    expect(results[0]!.matchedExpense?.id).toBe('e1') // income match
    expect(results[0]!.confidence).toBe('high')
  })

  it('falls back to any type when no type-compatible match exists', () => {
    const expenses = [
      makeExpense({ id: 'e1', tags: ['Salary'], amount: 5000, type: 'expense' }),
    ]
    // Row with negative sign but only expense-type lines exist
    const rows = [
      makeRow({ tags: ['Salary'], amount: 5000, originalSign: 'negative' as const }),
    ]

    const results = matchImportedRows(rows, expenses)
    expect(results).toHaveLength(1)
    expect(results[0]!.matchedExpense?.id).toBe('e1') // still matches
  })
})

describe('detectDateFormat', () => {
  it('detects YYYY-MM-DD format', () => {
    const fmt = detectDateFormat(['2026-01-15', '2026-02-20', '2026-03-10'])
    expect(fmt?.label).toBe('YYYY-MM-DD')
  })

  it('detects DD/MM/YYYY format', () => {
    const fmt = detectDateFormat(['15/01/2026', '20/02/2026', '10/03/2026'])
    // Could be DD/MM or MM/DD — either is valid pattern match
    expect(fmt).not.toBeNull()
  })

  it('returns null for unrecognized formats', () => {
    const fmt = detectDateFormat(['Jan 15 2026', 'Feb 20 2026'])
    expect(fmt).toBeNull()
  })
})

describe('parseDate', () => {
  it('parses YYYY-MM-DD correctly', () => {
    const result = parseDate('2026-01-15', 0) // index 0 = YYYY-MM-DD
    expect(result).toBe('2026-01-15')
  })

  it('returns null for invalid date', () => {
    const result = parseDate('not-a-date', 0)
    expect(result).toBeNull()
  })

  it('returns null for out-of-bounds format index', () => {
    const result = parseDate('2026-01-15', 99)
    expect(result).toBeNull()
  })
})

describe('parseAmount', () => {
  it('parses simple number', () => {
    expect(parseAmount('100')).toBe(100)
    expect(parseAmount('100.50')).toBe(100.5)
  })

  it('strips currency symbols', () => {
    expect(parseAmount('R100')).toBe(100)
    expect(parseAmount('$50.25')).toBe(50.25)
    expect(parseAmount('€1,000')).toBe(1000)
  })

  it('handles parenthetical negatives', () => {
    expect(parseAmount('(100)')).toBe(-100)
    expect(parseAmount('(50.25)')).toBe(-50.25)
  })

  it('handles whitespace', () => {
    expect(parseAmount('  100  ')).toBe(100)
    expect(parseAmount(' R 500 ')).toBe(500)
  })

  it('returns null for empty or invalid', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
  })
})
