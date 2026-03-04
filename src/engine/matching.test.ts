import { describe, it, expect } from 'vitest'
import {
  detectDateFormat,
  parseDate,
  parseAmount,
  isDuplicate,
} from './matching'

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

describe('isDuplicate', () => {
  it('detects exact duplicate', () => {
    const row = { date: '2026-01-15', amount: 500, description: 'Groceries' }
    const existing = [{ date: '2026-01-15', amount: 500, description: 'Groceries' }]
    expect(isDuplicate(row, existing)).toBe(true)
  })

  it('is case-insensitive on description', () => {
    const row = { date: '2026-01-15', amount: 500, description: 'GROCERIES' }
    const existing = [{ date: '2026-01-15', amount: 500, description: 'groceries' }]
    expect(isDuplicate(row, existing)).toBe(true)
  })

  it('returns false for different amount', () => {
    const row = { date: '2026-01-15', amount: 500, description: 'Groceries' }
    const existing = [{ date: '2026-01-15', amount: 600, description: 'Groceries' }]
    expect(isDuplicate(row, existing)).toBe(false)
  })

  it('returns false for different date', () => {
    const row = { date: '2026-01-15', amount: 500, description: 'Groceries' }
    const existing = [{ date: '2026-01-16', amount: 500, description: 'Groceries' }]
    expect(isDuplicate(row, existing)).toBe(false)
  })

  it('tolerates small rounding differences (within 0.5%)', () => {
    const row = { date: '2026-01-15', amount: 1000, description: 'Rent' }
    const existing = [{ date: '2026-01-15', amount: 1004, description: 'Rent' }]
    expect(isDuplicate(row, existing)).toBe(true) // 4 < 1000 * 0.005 = 5
  })

  it('rejects amounts beyond tolerance', () => {
    const row = { date: '2026-01-15', amount: 1000, description: 'Rent' }
    const existing = [{ date: '2026-01-15', amount: 1010, description: 'Rent' }]
    expect(isDuplicate(row, existing)).toBe(false) // 10 > 1000 * 0.005 = 5
  })
})

describe('detectDateFormat disambiguation', () => {
  it('detects DD/MM when first segment > 12', () => {
    const fmt = detectDateFormat(['15/01/2026', '20/02/2026', '28/03/2026'])
    expect(fmt?.label).toBe('DD/MM/YYYY')
  })

  it('detects MM/DD when second segment > 12', () => {
    const fmt = detectDateFormat(['01/15/2026', '02/20/2026', '03/28/2026'])
    expect(fmt?.label).toBe('MM/DD/YYYY')
  })

  it('defaults to DD/MM when ambiguous (all values <= 12)', () => {
    const fmt = detectDateFormat(['01/02/2026', '03/04/2026', '05/06/2026'])
    expect(fmt?.label).toBe('DD/MM/YYYY')
  })
})

describe('parseAmount expanded currencies', () => {
  it('strips Korean won symbol', () => {
    expect(parseAmount('₩50000')).toBe(50000)
  })

  it('strips Thai baht symbol', () => {
    expect(parseAmount('฿1500')).toBe(1500)
  })

  it('strips letter-based currency codes', () => {
    expect(parseAmount('CHF 100.50')).toBe(100.5)
  })
})
