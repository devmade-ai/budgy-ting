import { describe, it, expect } from 'vitest'
import { adaptiveConformal } from './conformal'

describe('adaptiveConformal', () => {
  it('returns the un-adapted default when there is too little data', () => {
    const r = adaptiveConformal([1, -2, 3, -1, 2, 0, 1, -1]) // < minWarmup + 5
    expect(r.adapted).toBe(false)
    expect(r.alpha).toBeCloseTo(0.2, 5)
    expect(r.lowerProb).toBeCloseTo(0.1, 5)
    expect(r.upperProb).toBeCloseTo(0.9, 5)
    expect(r.realizedCoverage).toBeNull()
    expect(r.steps).toBe(0)
  })

  it('keeps lowerProb + upperProb symmetric around the adapted alpha', () => {
    const residuals = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 5 : -5))
    const r = adaptiveConformal(residuals)
    expect(r.adapted).toBe(true)
    expect(r.lowerProb).toBeCloseTo(r.alpha / 2, 5)
    expect(r.upperProb).toBeCloseTo(1 - r.alpha / 2, 5)
    expect(r.lowerProb).toBeLessThan(r.upperProb)
    expect(r.alpha).toBeGreaterThanOrEqual(0.02)
    expect(r.alpha).toBeLessThanOrEqual(0.6)
    expect(r.realizedCoverage).toBeGreaterThanOrEqual(0)
    expect(r.realizedCoverage).toBeLessThanOrEqual(1)
  })

  it('widens the band (lowers alpha) when residuals keep escaping the interval', () => {
    // Strictly increasing residuals: each new value exceeds every prior one, so it lands above
    // the calibration window's upper quantile every step → a miss every step → alpha → floor.
    const residuals = Array.from({ length: 30 }, (_, i) => i + 1)
    const r = adaptiveConformal(residuals)
    expect(r.adapted).toBe(true)
    expect(r.alpha).toBeLessThan(0.1) // much wider than the nominal 0.2
    expect(r.realizedCoverage).toBeLessThan(0.5)
  })

  it('tightens the band (raises alpha) when every residual is comfortably inside', () => {
    // All-zero residuals: the interval is [0,0] and every residual (0) is inside → every hit →
    // alpha rises, requesting a tighter band.
    const residuals = new Array(30).fill(0) as number[]
    const r = adaptiveConformal(residuals)
    expect(r.adapted).toBe(true)
    expect(r.alpha).toBeGreaterThan(0.2)
    expect(r.realizedCoverage).toBe(1)
  })

  it('runs one adaptation step per residual past the warm-up', () => {
    const residuals = Array.from({ length: 25 }, (_, i) => (i % 3) - 1)
    const r = adaptiveConformal(residuals, { minWarmup: 10 })
    expect(r.steps).toBe(25 - 10)
  })

  it('respects a custom target coverage', () => {
    const residuals = new Array(30).fill(0) as number[]
    const r = adaptiveConformal(residuals, { targetCoverage: 0.9 })
    // target alpha = 0.1; with all-hits it rises above that
    expect(r.alpha).toBeGreaterThan(0.1)
  })
})
