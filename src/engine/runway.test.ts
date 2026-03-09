import { describe, it, expect } from 'vitest'
import { calculateRunway, calculateRunwayWithBands } from './runway'
import type { DailyForecastPoint } from './forecast'

function makePoint(date: string, amount: number): DailyForecastPoint {
  return {
    date,
    amount,
    cumulative: 0,
    band: null,
    source: 'recurring+variable',
  }
}

function makePointWithBand(date: string, amount: number, lower: number, upper: number): DailyForecastPoint {
  return {
    date,
    amount,
    cumulative: 0,
    band: { point: amount, lower, upper },
    source: 'recurring+variable',
  }
}

describe('calculateRunway', () => {
  it('returns immediately for no forecast points', () => {
    const result = calculateRunway(1000, [])
    expect(result.daysRemaining).toBeNull()
    expect(result.endBalance).toBe(1000)
    expect(result.dailyBalance).toHaveLength(0)
  })

  it('tracks depletion correctly', () => {
    const points = [
      makePoint('2026-03-01', -400),
      makePoint('2026-03-02', -400),
      makePoint('2026-03-03', -400), // balance goes to -200
    ]
    const result = calculateRunway(1000, points)
    expect(result.daysRemaining).toBe(3)
    expect(result.depletionDate).toBe('2026-03-03')
    expect(result.endBalance).toBeLessThan(0)
  })

  it('returns null daysRemaining when cash lasts', () => {
    const points = [
      makePoint('2026-03-01', -100),
      makePoint('2026-03-02', -100),
      makePoint('2026-03-03', 500), // income
    ]
    const result = calculateRunway(1000, points)
    expect(result.daysRemaining).toBeNull()
    expect(result.depletionDate).toBeNull()
    expect(result.endBalance).toBe(1300)
  })

  it('tracks minimum balance correctly', () => {
    const points = [
      makePoint('2026-03-01', -800),  // balance: 200
      makePoint('2026-03-02', -100),  // balance: 100 ← minimum
      makePoint('2026-03-03', 500),   // balance: 600
      makePoint('2026-03-04', -200),  // balance: 400
    ]
    const result = calculateRunway(1000, points)
    expect(result.minimumBalance).toBe(100)
    expect(result.minimumBalanceDate).toBe('2026-03-02')
    expect(result.endBalance).toBe(400)
  })

  it('builds daily balance progression', () => {
    const points = [
      makePoint('2026-03-01', -300),
      makePoint('2026-03-02', -200),
    ]
    const result = calculateRunway(1000, points)
    // First entry is the initial balance (day before forecast starts)
    expect(result.dailyBalance).toHaveLength(3)
    expect(result.dailyBalance[0]!.balance).toBe(1000)
    expect(result.dailyBalance[1]!.balance).toBe(700)
    expect(result.dailyBalance[2]!.balance).toBe(500)
  })

  it('handles income growing cash', () => {
    const points = [
      makePoint('2026-03-01', 500),
      makePoint('2026-03-02', 500),
    ]
    const result = calculateRunway(1000, points)
    expect(result.daysRemaining).toBeNull()
    expect(result.endBalance).toBe(2000)
    expect(result.minimumBalance).toBe(1000) // starting balance is the min
  })
})

describe('calculateRunwayWithBands', () => {
  it('returns three scenarios', () => {
    const points = [
      makePointWithBand('2026-03-01', -500, -600, -400),
      makePointWithBand('2026-03-02', -500, -600, -400),
      makePointWithBand('2026-03-03', -500, -600, -400),
    ]

    const result = calculateRunwayWithBands(1000, points)

    // Expected: 1000 - 500*3 = -500 → depletes
    expect(result.expected.daysRemaining).not.toBeNull()

    // Pessimistic (uses lower = more negative): depletes faster
    // With lower=-600: 1000-600-600 = -200 → depletes on day 2
    expect(result.pessimistic.daysRemaining).not.toBeNull()
    expect(result.pessimistic.daysRemaining!).toBeLessThanOrEqual(result.expected.daysRemaining!)

    // Optimistic (uses upper = less negative): depletes later or not at all
    // With upper=-400: 1000-400-400-400 = -200 → still depletes but later
    // Compare depletion timing rather than endBalance (which depends on when it stops)
    if (result.optimistic.daysRemaining !== null && result.expected.daysRemaining !== null) {
      expect(result.optimistic.daysRemaining).toBeGreaterThanOrEqual(result.expected.daysRemaining)
    }
  })
})
