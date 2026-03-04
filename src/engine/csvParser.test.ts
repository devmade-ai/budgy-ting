import { describe, it, expect } from 'vitest'
import { parseCSV, parseJSONImport } from './csvParser'

describe('parseCSV', () => {
  it('parses simple CSV correctly', () => {
    const csv = 'Date,Amount,Description\n2026-01-15,100,Groceries\n2026-01-16,50,Coffee'
    const result = parseCSV(csv)

    expect(result.headers).toEqual(['Date', 'Amount', 'Description'])
    expect(result.rows).toHaveLength(2)
    expect(result.totalRows).toBe(2)
    expect(result.errors).toHaveLength(0)

    expect(result.rows[0]!['Date']).toBe('2026-01-15')
    expect(result.rows[0]!['Amount']).toBe('100')
    expect(result.rows[0]!['Description']).toBe('Groceries')
  })

  it('handles quoted fields with commas', () => {
    const csv = 'Name,Amount\n"Rent, Housing",1000\nFood,500'
    const result = parseCSV(csv)

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]!['Name']).toBe('Rent, Housing')
  })

  it('handles escaped quotes in fields', () => {
    const csv = 'Name,Amount\n"He said ""hello""",100'
    const result = parseCSV(csv)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]!['Name']).toBe('He said "hello"')
  })

  it('handles CRLF line endings', () => {
    const csv = 'A,B\r\n1,2\r\n3,4'
    const result = parseCSV(csv)

    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]!['A']).toBe('1')
    expect(result.rows[1]!['A']).toBe('3')
  })

  it('reports column count mismatch', () => {
    const csv = 'A,B,C\n1,2\n4,5,6'
    const result = parseCSV(csv)

    expect(result.rows).toHaveLength(2)
    expect(result.errors.length).toBeGreaterThan(0)
    // Short row gets padded with empty string
    expect(result.rows[0]!['C']).toBe('')
  })

  it('handles empty file', () => {
    const result = parseCSV('')
    expect(result.headers).toEqual([])
    expect(result.rows).toEqual([])
    expect(result.errors).toContain('File is empty')
  })

  it('skips blank lines', () => {
    const csv = 'A,B\n\n1,2\n\n3,4\n'
    const result = parseCSV(csv)
    expect(result.rows).toHaveLength(2)
  })

  it('handles whitespace in values', () => {
    const csv = 'Name, Amount\n  Rent , 1000 '
    const result = parseCSV(csv)

    expect(result.headers).toContain('Amount')
    expect(result.rows[0]!['Amount']).toBe('1000')
  })
})

describe('parseJSONImport', () => {
  it('parses valid JSON array of objects', () => {
    const json = JSON.stringify([
      { date: '2026-01-15', amount: 100, description: 'Groceries' },
      { date: '2026-01-16', amount: 50, description: 'Coffee' },
    ])
    const result = parseJSONImport(json)

    expect(result.headers).toContain('date')
    expect(result.headers).toContain('amount')
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]!['amount']).toBe('100')
  })

  it('returns error for invalid JSON', () => {
    const result = parseJSONImport('not json')
    expect(result.errors).toContain('Invalid JSON file')
    expect(result.rows).toHaveLength(0)
  })

  it('returns error for non-array JSON', () => {
    const result = parseJSONImport('{"key": "value"}')
    expect(result.errors).toContain('JSON must be an array of objects')
  })

  it('returns error for empty array', () => {
    const result = parseJSONImport('[]')
    expect(result.errors).toContain('JSON array is empty')
  })

  it('converts null/undefined values to empty strings', () => {
    const json = JSON.stringify([
      { date: '2026-01-15', amount: null, description: undefined },
    ])
    const result = parseJSONImport(json)
    expect(result.rows[0]!['amount']).toBe('')
  })
})
