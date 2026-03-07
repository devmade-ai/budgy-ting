import { describe, it, expect } from 'vitest'
import { calculateDailyAccuracy, summarizeAccuracy } from './accuracy'
import type { Transaction } from '@/types/models'
import type { DailyForecastPoint } from './forecast'

function makeForecastPoint(date: string, amount: number): DailyForecastPoint {
  return {
    date,
    amount,
    cumulative: 0,
    band: null,
    source: 'recurring+variable',
  }
}

function makeTxn(date: string, amount: number): Transaction {
  return {
    id: `txn-${date}`,
    workspaceId: 'w-1',
    date,
    amount,
    description: 'Test',
    tags: ['Food'],
    source: 'import',
    classification: 'once-off',
    recurringGroupId: null,
    originalRow: null,
    importBatchId: null,
    createdAt: `${date}T00:00:00Z`,
    updatedAt: `${date}T00:00:00Z`,
  }
}

describe('calculateDailyAccuracy', () => {
  it('returns empty for no data', () => {
    expect(calculateDailyAccuracy([], [])).toHaveLength(0)
  })

  it('skips dates without both forecast and actual', () => {
    const forecasts = [makeForecastPoint('2026-01-01', -100)]
    const actuals = [makeTxn('2026-01-02', -90)]
    expect(calculateDailyAccuracy(forecasts, actuals)).toHaveLength(0)
  })

  it('calculates errors correctly', () => {
    const forecasts = [
      makeForecastPoint('2026-01-01', -100),
      makeForecastPoint('2026-01-02', -50),
    ]
    const actuals = [
      makeTxn('2026-01-01', -90),
      makeTxn('2026-01-02', -70),
    ]

    const points = calculateDailyAccuracy(forecasts, actuals)
    expect(points).toHaveLength(2)

    expect(points[0]!.signedError).toBeCloseTo(10, 1)
    expect(points[0]!.absoluteError).toBeCloseTo(10, 1)

    expect(points[1]!.signedError).toBeCloseTo(-20, 1)
    expect(points[1]!.absoluteError).toBeCloseTo(20, 1)
  })

  it('aggregates multiple transactions on same date', () => {
    const forecasts = [makeForecastPoint('2026-01-01', -150)]
    const actuals = [
      makeTxn('2026-01-01', -80),
      { ...makeTxn('2026-01-01', -60), id: 'txn-2' },
    ]

    const points = calculateDailyAccuracy(forecasts, actuals)
    expect(points).toHaveLength(1)
    expect(points[0]!.actualAmount).toBeCloseTo(-140, 1)
  })

  it('sorts results by date', () => {
    const forecasts = [
      makeForecastPoint('2026-01-03', -100),
      makeForecastPoint('2026-01-01', -100),
    ]
    const actuals = [
      makeTxn('2026-01-03', -90),
      makeTxn('2026-01-01', -110),
    ]

    const points = calculateDailyAccuracy(forecasts, actuals)
    expect(points[0]!.date).toBe('2026-01-01')
    expect(points[1]!.date).toBe('2026-01-03')
  })
})

describe('summarizeAccuracy', () => {
  it('returns nulls for empty points', () => {
    const summary = summarizeAccuracy([])
    expect(summary.mae).toBeNull()
    expect(summary.rmse).toBeNull()
    expect(summary.bias).toBeNull()
    expect(summary.dataPoints).toBe(0)
  })

  it('calculates MAE correctly', () => {
    const points = [
      { date: '2026-01-01', forecastAmount: -100, actualAmount: -90, absoluteError: 10, signedError: 10 },
      { date: '2026-01-02', forecastAmount: -100, actualAmount: -120, absoluteError: 20, signedError: -20 },
    ]
    const summary = summarizeAccuracy(points)
    expect(summary.mae).toBe(15)
  })

  it('calculates RMSE correctly', () => {
    const points = [
      { date: '2026-01-01', forecastAmount: -100, actualAmount: -90, absoluteError: 10, signedError: 10 },
      { date: '2026-01-02', forecastAmount: -100, actualAmount: -120, absoluteError: 20, signedError: -20 },
    ]
    const summary = summarizeAccuracy(points)
    expect(summary.rmse).toBeCloseTo(15.81, 1)
  })

  it('calculates bias correctly', () => {
    const points = [
      { date: '2026-01-01', forecastAmount: -100, actualAmount: -90, absoluteError: 10, signedError: 10 },
      { date: '2026-01-02', forecastAmount: -100, actualAmount: -120, absoluteError: 20, signedError: -20 },
    ]
    const summary = summarizeAccuracy(points)
    expect(summary.bias).toBe(-5)
  })

  it('calculates WMAPE correctly', () => {
    const points = [
      { date: '2026-01-01', forecastAmount: -100, actualAmount: -200, absoluteError: 100, signedError: -100 },
      { date: '2026-01-02', forecastAmount: -100, actualAmount: -100, absoluteError: 0, signedError: 0 },
    ]
    const summary = summarizeAccuracy(points)
    expect(summary.wmape).toBeCloseTo(33.33, 0)
  })

  it('calculates hit rate with custom threshold', () => {
    const points = [
      { date: '2026-01-01', forecastAmount: -100, actualAmount: -95, absoluteError: 5, signedError: 5 },
      { date: '2026-01-02', forecastAmount: -100, actualAmount: -80, absoluteError: 20, signedError: 20 },
      { date: '2026-01-03', forecastAmount: -100, actualAmount: -110, absoluteError: 10, signedError: -10 },
    ]
    const summary = summarizeAccuracy(points, 10)
    expect(summary.hitRate).toBeCloseTo(66.67, 0)
    expect(summary.hitRateThreshold).toBe(10)
  })
})
