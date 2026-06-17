import { describe, it, expect } from 'vitest'
import {
  pinballLoss,
  picp,
  pinaw,
  wilsonInterval,
  pitValueFromBand,
  pitHistogram,
  rollingOriginBacktest,
  summarizeBacktest,
  backtestForecast,
} from './validation'
import type { Transaction } from '@/types/models'

function makeTxn(date: string, amount: number, id: string): Transaction {
  return {
    id,
    workspaceId: 'w-1',
    date,
    amount,
    description: 'Test',
    tags: [],
    source: 'import',
    classification: 'once-off',
    recurringGroupId: null,
    originalRow: null,
    importBatchId: null,
    createdAt: `${date}T00:00:00Z`,
    updatedAt: `${date}T00:00:00Z`,
  }
}

// 60 days of daily expenses with mild variation — enough for several rolling origins.
function dailyHistory(days: number): Transaction[] {
  const txns: Transaction[] = []
  const start = new Date('2026-01-01T00:00:00')
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    txns.push(makeTxn(dateStr, -(50 + (i % 5) * 6), `t-${i}`))
  }
  return txns
}

describe('pinballLoss', () => {
  it('penalises under-forecast of a high quantile lightly, over-forecast heavily', () => {
    // tau=0.9: actual above forecast → 0.9*diff; actual below → 0.1*|diff|
    expect(pinballLoss(10, 8, 0.9)).toBeCloseTo(1.8, 5)
    expect(pinballLoss(6, 8, 0.9)).toBeCloseTo(0.2, 5)
  })

  it('is symmetric across complementary quantiles', () => {
    expect(pinballLoss(10, 8, 0.1)).toBeCloseTo(0.2, 5)
    expect(pinballLoss(6, 8, 0.1)).toBeCloseTo(1.8, 5)
  })

  it('is zero when forecast equals actual', () => {
    expect(pinballLoss(5, 5, 0.5)).toBe(0)
  })
})

describe('picp', () => {
  it('returns the fraction of actuals inside the band', () => {
    const recs = [
      { lower: 0, upper: 10, actual: 5 },   // in
      { lower: 0, upper: 10, actual: 15 },  // out
      { lower: 0, upper: 10, actual: 0 },   // in (boundary)
      { lower: 0, upper: 10, actual: -1 },  // out
    ]
    expect(picp(recs)).toBe(0.5)
  })

  it('returns 0 for empty input', () => {
    expect(picp([])).toBe(0)
  })
})

describe('pinaw', () => {
  it('normalises mean width by the actual range', () => {
    const recs = [
      { lower: 0, upper: 10, actual: 0 },
      { lower: 0, upper: 10, actual: 20 },
    ]
    // mean width 10, range 20 → 0.5
    expect(pinaw(recs)).toBeCloseTo(0.5, 5)
  })

  it('returns null when the actual range is zero', () => {
    expect(pinaw([{ lower: 0, upper: 10, actual: 5 }])).toBeNull()
  })
})

describe('wilsonInterval', () => {
  it('returns the full [0,1] for n=0', () => {
    expect(wilsonInterval(0, 0)).toEqual({ lo: 0, hi: 1 })
  })

  it('brackets the point estimate and stays within [0,1]', () => {
    const { lo, hi } = wilsonInterval(8, 10)
    expect(lo).toBeGreaterThan(0)
    expect(hi).toBeLessThanOrEqual(1)
    expect(lo).toBeLessThan(0.8)
    expect(hi).toBeGreaterThan(0.8)
  })

  it('never exceeds 1 even at p=1', () => {
    const { lo, hi } = wilsonInterval(10, 10)
    expect(hi).toBeLessThanOrEqual(1)
    expect(lo).toBeLessThan(1)
  })

  it('narrows as n grows', () => {
    const small = wilsonInterval(8, 10)
    const large = wilsonInterval(800, 1000)
    expect(large.hi - large.lo).toBeLessThan(small.hi - small.lo)
  })
})

describe('pitValueFromBand', () => {
  it('maps the quantile knots to 0.1 / 0.5 / 0.9', () => {
    expect(pitValueFromBand(-10, -10, 0, 10)).toBeCloseTo(0.1, 5)
    expect(pitValueFromBand(0, -10, 0, 10)).toBeCloseTo(0.5, 5)
    expect(pitValueFromBand(10, -10, 0, 10)).toBeCloseTo(0.9, 5)
  })

  it('interpolates between knots', () => {
    expect(pitValueFromBand(-5, -10, 0, 10)).toBeCloseTo(0.3, 5)
    expect(pitValueFromBand(5, -10, 0, 10)).toBeCloseTo(0.7, 5)
  })

  it('clamps the tails to [0,1]', () => {
    expect(pitValueFromBand(-1000, -10, 0, 10)).toBe(0)
    expect(pitValueFromBand(1000, -10, 0, 10)).toBe(1)
  })

  it('returns 0.5 for a degenerate (zero-width) band', () => {
    expect(pitValueFromBand(5, 3, 3, 3)).toBe(0.5)
  })
})

describe('pitHistogram', () => {
  it('buckets values into equal-width bins', () => {
    const hist = pitHistogram([0.05, 0.15, 0.95, 0.99], 10)
    expect(hist).toHaveLength(10)
    expect(hist[0]).toBe(1) // 0.05
    expect(hist[1]).toBe(1) // 0.15
    expect(hist[9]).toBe(2) // 0.95, 0.99
  })

  it('clamps 1.0 into the last bin', () => {
    const hist = pitHistogram([1.0], 10)
    expect(hist[9]).toBe(1)
  })
})

describe('rollingOriginBacktest', () => {
  it('returns no records without enough history', () => {
    expect(rollingOriginBacktest(dailyHistory(10), [])).toEqual([])
  })

  it('produces out-of-sample records with no leakage', () => {
    const records = rollingOriginBacktest(dailyHistory(60), [], { horizon: 14, stride: 7 })
    expect(records.length).toBeGreaterThan(0)
    for (const r of records) {
      // Forecast target is strictly after the origin (no training on the scored day)
      expect(r.date > r.origin).toBe(true)
      // Horizon within the requested window
      expect(r.horizon).toBeGreaterThanOrEqual(1)
      expect(r.horizon).toBeLessThanOrEqual(14)
      expect(Number.isFinite(r.point)).toBe(true)
      expect(Number.isFinite(r.actual)).toBe(true)
    }
  })

  it('respects the maxOrigins cap (keeps the most recent)', () => {
    const all = rollingOriginBacktest(dailyHistory(60), [], { stride: 1, maxOrigins: 3 })
    const origins = new Set(all.map((r) => r.origin))
    expect(origins.size).toBeLessThanOrEqual(3)
  })
})

describe('summarizeBacktest', () => {
  it('returns null-ish metrics for empty records', () => {
    const summary = summarizeBacktest([])
    expect(summary.records).toBe(0)
    expect(summary.accuracy.mae).toBeNull()
    expect(summary.coverage).toBeNull()
    expect(summary.pitHistogram).toHaveLength(10)
  })

  it('computes accuracy, coverage with Wilson band, and per-horizon scores', () => {
    const records = rollingOriginBacktest(dailyHistory(60), [], { horizon: 14, stride: 7 })
    const summary = summarizeBacktest(records)

    expect(summary.records).toBe(records.length)
    expect(summary.accuracy.dataPoints).toBeGreaterThan(0)
    expect(summary.coverage).not.toBeNull()
    expect(summary.coverage!.nominal).toBe(0.8)
    expect(summary.coverage!.wilsonLo).toBeLessThanOrEqual(summary.coverage!.picp)
    expect(summary.coverage!.wilsonHi).toBeGreaterThanOrEqual(summary.coverage!.picp)

    // Per-horizon scores are sorted ascending and cover only seen horizons
    const horizons = summary.perHorizon.map((h) => h.horizon)
    expect(horizons).toEqual([...horizons].sort((a, b) => a - b))
    expect(summary.meanPinball).not.toBeNull()
  })
})

describe('backtestForecast', () => {
  it('returns null without enough history', () => {
    expect(backtestForecast(dailyHistory(10), [])).toBeNull()
  })

  it('returns a summary with enough history', () => {
    const summary = backtestForecast(dailyHistory(60), [])
    expect(summary).not.toBeNull()
    expect(summary!.records).toBeGreaterThan(0)
  })
})
