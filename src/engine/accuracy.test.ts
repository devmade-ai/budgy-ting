import { describe, it, expect } from 'vitest'
import { summarizeAccuracy } from './accuracy'

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
