/**
 * Adaptive Conformal Inference (ACI) — online calibration of the prediction-band level.
 *
 * Requirement (FORECASTING_RESEARCH.md §16.4 step 2): the empirical residual-quantile bands are
 *   distribution-free but have no coverage *guarantee*; if the model systematically over- or
 *   under-covers, the fixed 10th/90th band stays wrong. ACI (Gibbs & Candès 2021) corrects this
 *   by nudging the miscoverage level online from realized hits/misses — long-run average coverage
 *   converges to the target with NO distributional assumptions (the one conformal variant that
 *   survives the exchangeability violation inherent to time series).
 * Approach: walk the historical one-step residual stream with an expanding calibration window.
 *   At each step form the band at the current level αₜ, check whether the residual landed inside,
 *   and update αₜ₊₁ = αₜ + γ(α_target − errₜ) — miss → lower α → wider band; hit → raise α → tighter.
 *   The learned α gives the tail probabilities used for the FORWARD forecast bands. We keep the
 *   asymmetric empirical quantiles (lower = αₜ/2, upper = 1 − αₜ/2) so cashflow skew survives.
 * Caveats (from the research, surfaced honestly, not hidden):
 *   - The guarantee is long-run / marginal / time-averaged, NOT per-forecast conditional.
 *   - It needs a stream of realized outcomes; early intervals are unreliable until enough steps
 *     accumulate, so we DON'T adapt below a warm-up threshold and report `adapted: false`.
 * Alternatives:
 *   - Split conformal / CQR: Rejected for the live band — assume exchangeability, which a drifting
 *     cashflow series violates; ACI is assumption-free.
 *   - DtACI (grid of γ experts): deferred — a single γ is adequate at these data sizes; revisit if
 *     adaptation proves too slow/fast in practice (tracked in docs/TODO.md).
 */

import { quantile } from 'simple-statistics'

export interface AciResult {
  /** Adapted miscoverage level (≈ target when already well-calibrated) */
  alpha: number
  /** Lower-tail quantile probability for the band (= alpha/2) */
  lowerProb: number
  /** Upper-tail quantile probability for the band (= 1 - alpha/2) */
  upperProb: number
  /** Realized coverage of the adaptive interval over the calibration stream (null if not adapted) */
  realizedCoverage: number | null
  /** Number of adaptation steps run */
  steps: number
  /** Whether adaptation actually ran (enough residuals past the warm-up) */
  adapted: boolean
}

const TARGET_COVERAGE = 0.8
const DEFAULT_GAMMA = 0.05
const MIN_WARMUP = 10
/** Residuals needed past the warm-up before adaptation is worth running. */
const MIN_ADAPT_STEPS = 5

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

export interface AciOptions {
  /** Target coverage (default 0.8 → the 80% band) */
  targetCoverage?: number
  /** Learning rate γ (default 0.05) */
  gamma?: number
  /** Steps to observe before the first adaptation check (default 10) */
  minWarmup?: number
}

/**
 * Run ACI over a residual series and return the adapted band level.
 * Returns the un-adapted default (target level, no change) when there isn't enough data.
 */
export function adaptiveConformal(residuals: number[], opts: AciOptions = {}): AciResult {
  const target = opts.targetCoverage ?? TARGET_COVERAGE
  const gamma = opts.gamma ?? DEFAULT_GAMMA
  const minWarmup = opts.minWarmup ?? MIN_WARMUP
  const targetAlpha = 1 - target

  const unadapted: AciResult = {
    alpha: targetAlpha,
    lowerProb: targetAlpha / 2,
    upperProb: 1 - targetAlpha / 2,
    realizedCoverage: null,
    steps: 0,
    adapted: false,
  }

  if (residuals.length < minWarmup + MIN_ADAPT_STEPS) return unadapted

  let alpha = targetAlpha
  let covered = 0
  let steps = 0

  // Expanding-window ACI: calibrate on residuals before t, score residual t. No leakage.
  for (let t = minWarmup; t < residuals.length; t++) {
    const window = residuals.slice(0, t)
    const lowerProb = clamp(alpha / 2, 0.005, 0.495)
    const lo = quantile(window, lowerProb)
    const hi = quantile(window, 1 - lowerProb)

    const isCovered = residuals[t]! >= lo && residuals[t]! <= hi
    if (isCovered) covered++
    steps++

    const err = isCovered ? 0 : 1
    // miss (err=1) → α decreases → band widens; hit (err=0) → α increases → band tightens.
    alpha = clamp(alpha + gamma * (targetAlpha - err), 0.02, 0.6)
  }

  const lowerProb = clamp(alpha / 2, 0.005, 0.495)
  return {
    alpha,
    lowerProb,
    upperProb: 1 - lowerProb,
    realizedCoverage: steps > 0 ? covered / steps : null,
    steps,
    adapted: true,
  }
}
