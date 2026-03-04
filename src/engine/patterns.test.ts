import { describe, it, expect } from 'vitest'
import {
  detectFrequency,
  detectAnchorDay,
  detectPattern,
  groupByDescription,
  detectAllPatterns,
  projectPattern,
} from './patterns'
import type { Transaction } from '@/types/models'

function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'txn-1',
    workspaceId: 'w-1',
    date: '2026-01-15',
    amount: -100,
    description: 'Test transaction',
    tags: ['Groceries'],
    source: 'import',
    classification: 'recurring',
    recurringGroupId: null,
    originalRow: null,
    importBatchId: null,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    ...overrides,
  }
}

describe('detectFrequency', () => {
  it('returns null for empty intervals', () => {
    expect(detectFrequency([])).toBeNull()
  })

  it('detects daily frequency', () => {
    const result = detectFrequency([1, 1, 1, 1])
    expect(result).not.toBeNull()
    expect(result!.frequency).toBe('daily')
    expect(result!.confidence).toBeGreaterThan(0.5)
  })

  it('detects weekly frequency', () => {
    const result = detectFrequency([7, 7, 7, 7])
    expect(result).not.toBeNull()
    expect(result!.frequency).toBe('weekly')
    expect(result!.confidence).toBeGreaterThan(0.8)
  })

  it('detects monthly frequency with slight variation', () => {
    const result = detectFrequency([30, 31, 28, 31])
    expect(result).not.toBeNull()
    expect(result!.frequency).toBe('monthly')
  })

  it('detects quarterly frequency', () => {
    const result = detectFrequency([91, 92, 90])
    expect(result).not.toBeNull()
    expect(result!.frequency).toBe('quarterly')
  })

  it('detects annually frequency', () => {
    const result = detectFrequency([365, 366])
    expect(result).not.toBeNull()
    expect(result!.frequency).toBe('annually')
  })

  it('returns null for unrecognised intervals', () => {
    const result = detectFrequency([45, 50, 42])
    expect(result).toBeNull()
  })
})

describe('detectAnchorDay', () => {
  it('detects day-of-week for weekly frequency', () => {
    // All Mondays: 2026-01-05 is Monday, 2026-01-12 is Monday, etc.
    const day = detectAnchorDay(['2026-01-05', '2026-01-12', '2026-01-19'], 'weekly')
    expect(day).toBe(1) // Monday = 1 (JS getDay())
  })

  it('detects day-of-month for monthly frequency', () => {
    const day = detectAnchorDay(['2026-01-15', '2026-02-15', '2026-03-15'], 'monthly')
    expect(day).toBe(15)
  })

  it('uses mode when days vary', () => {
    const day = detectAnchorDay(['2026-01-01', '2026-02-01', '2026-03-02'], 'monthly')
    expect(day).toBe(1) // 1st appears twice, 2nd once
  })
})

describe('detectPattern', () => {
  it('returns null with fewer than 2 transactions', () => {
    expect(detectPattern([makeTxn()], 'Test')).toBeNull()
  })

  it('detects monthly pattern from 3 monthly transactions', () => {
    const txns = [
      makeTxn({ id: 't1', date: '2026-01-01', amount: -12000 }),
      makeTxn({ id: 't2', date: '2026-02-01', amount: -12000 }),
      makeTxn({ id: 't3', date: '2026-03-01', amount: -12000 }),
    ]
    const pattern = detectPattern(txns, 'Rent')
    expect(pattern).not.toBeNull()
    expect(pattern!.frequency).toBe('monthly')
    expect(pattern!.expectedAmount).toBe(-12000)
    expect(pattern!.isVariable).toBe(false)
    expect(pattern!.anchorDay).toBe(1)
  })

  it('detects variable recurring pattern', () => {
    const txns = [
      makeTxn({ id: 't1', date: '2026-01-07', amount: -1500 }),
      makeTxn({ id: 't2', date: '2026-02-07', amount: -2500 }),
      makeTxn({ id: 't3', date: '2026-03-07', amount: -3500 }),
    ]
    const pattern = detectPattern(txns, 'Electricity')
    expect(pattern).not.toBeNull()
    expect(pattern!.frequency).toBe('monthly')
    expect(pattern!.isVariable).toBe(true) // CV > 0.3
    expect(pattern!.amountStdDev).toBeGreaterThan(0)
  })

  it('preserves positive amounts for income patterns', () => {
    const txns = [
      makeTxn({ id: 't1', date: '2026-01-25', amount: 25000 }),
      makeTxn({ id: 't2', date: '2026-02-25', amount: 25000 }),
    ]
    const pattern = detectPattern(txns, 'Salary')
    expect(pattern).not.toBeNull()
    expect(pattern!.expectedAmount).toBe(25000) // positive = income
  })
})

describe('groupByDescription', () => {
  it('groups by lowercase description', () => {
    const txns = [
      makeTxn({ id: 't1', description: 'Netflix subscription' }),
      makeTxn({ id: 't2', description: 'netflix subscription' }),
      makeTxn({ id: 't3', description: 'Spotify' }),
    ]
    const groups = groupByDescription(txns)
    expect(groups.size).toBe(1) // Netflix has 2, Spotify only 1
    expect(groups.has('netflix subscription')).toBe(true)
  })

  it('excludes groups with only 1 transaction', () => {
    const txns = [
      makeTxn({ id: 't1', description: 'One-off purchase' }),
    ]
    const groups = groupByDescription(txns)
    expect(groups.size).toBe(0)
  })
})

describe('detectAllPatterns', () => {
  it('detects patterns across all description groups', () => {
    const txns = [
      makeTxn({ id: 't1', date: '2026-01-01', description: 'Rent', amount: -12000 }),
      makeTxn({ id: 't2', date: '2026-02-01', description: 'Rent', amount: -12000 }),
      makeTxn({ id: 't3', date: '2026-01-02', description: 'Netflix', amount: -199 }),
      makeTxn({ id: 't4', date: '2026-02-02', description: 'Netflix', amount: -199 }),
    ]
    const patterns = detectAllPatterns(txns)
    expect(patterns.length).toBe(2)
    // Sorted by confidence descending
    expect(patterns[0]!.confidence).toBeGreaterThanOrEqual(patterns[1]!.confidence)
  })
})

describe('projectPattern', () => {
  it('projects monthly pattern correctly', () => {
    const points = projectPattern(
      { frequency: 'monthly', anchorDay: 1, expectedAmount: -12000, lastSeenDate: '2026-01-01' },
      '2026-01-01',
      '2026-03-31',
    )
    expect(points).toHaveLength(3) // Jan, Feb, Mar
    expect(points[0]!.date).toBe('2026-01-01')
    expect(points[0]!.amount).toBe(-12000)
    expect(points[1]!.date).toBe('2026-02-01')
    expect(points[2]!.date).toBe('2026-03-01')
  })

  it('handles anchor day overflow (31st in short months)', () => {
    const points = projectPattern(
      { frequency: 'monthly', anchorDay: 31, expectedAmount: -500, lastSeenDate: '2026-01-31' },
      '2026-01-01',
      '2026-03-31',
    )
    expect(points).toHaveLength(3)
    expect(points[0]!.date).toBe('2026-01-31')
    expect(points[1]!.date).toBe('2026-02-28') // Feb 2026 has 28 days
    expect(points[2]!.date).toBe('2026-03-31')
  })

  it('projects weekly pattern', () => {
    const points = projectPattern(
      { frequency: 'weekly', anchorDay: 1, expectedAmount: -50, lastSeenDate: '2026-01-05' }, // Monday
      '2026-01-01',
      '2026-01-31',
    )
    // Mondays in Jan 2026: 5, 12, 19, 26
    expect(points.length).toBeGreaterThanOrEqual(4)
    for (const p of points) {
      const dow = new Date(p.date + 'T00:00:00').getDay()
      expect(dow).toBe(1) // Monday
    }
  })

  it('projects biweekly pattern', () => {
    const points = projectPattern(
      { frequency: 'biweekly', anchorDay: 5, expectedAmount: 4000, lastSeenDate: '2026-01-02' }, // Friday
      '2026-01-01',
      '2026-02-28',
    )
    // Should be roughly every 2 weeks
    expect(points.length).toBeGreaterThanOrEqual(3)
    if (points.length >= 2) {
      const d1 = new Date(points[0]!.date).getTime()
      const d2 = new Date(points[1]!.date).getTime()
      const daysBetween = (d2 - d1) / 86_400_000
      expect(daysBetween).toBe(14)
    }
  })

  it('projects quarterly pattern', () => {
    const points = projectPattern(
      { frequency: 'quarterly', anchorDay: 15, expectedAmount: -3000, lastSeenDate: '2026-01-15' },
      '2026-01-01',
      '2026-12-31',
    )
    expect(points).toHaveLength(4) // Jan, Apr, Jul, Oct
    expect(points[0]!.date).toBe('2026-01-15')
    expect(points[1]!.date).toBe('2026-04-15')
    expect(points[2]!.date).toBe('2026-07-15')
    expect(points[3]!.date).toBe('2026-10-15')
  })

  it('projects annual pattern', () => {
    const points = projectPattern(
      { frequency: 'annually', anchorDay: 10, expectedAmount: -5000, lastSeenDate: '2026-03-10' },
      '2026-01-01',
      '2027-12-31',
    )
    expect(points).toHaveLength(2) // Mar 2026, Mar 2027
    expect(points[0]!.date).toBe('2026-03-10')
    expect(points[1]!.date).toBe('2027-03-10')
  })

  it('projects daily pattern', () => {
    const points = projectPattern(
      { frequency: 'daily', anchorDay: 0, expectedAmount: -15, lastSeenDate: '2026-01-01' },
      '2026-01-01',
      '2026-01-07',
    )
    expect(points).toHaveLength(7) // 7 days inclusive
    expect(points[0]!.date).toBe('2026-01-01')
    expect(points[6]!.date).toBe('2026-01-07')
  })
})
