# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Deep-research validation pass on Farlume's forecasting core, then implemented six findings from it: damped trend, empirical residual-quantile bands, the Theta + damped-ETS combination model, a worst-case runway metric, a rolling-origin validation harness, and Adaptive Conformal Inference (ACI) band calibration.

## Accomplished

- Ran a 5-angle parallel research pass (intermittent-demand models, short-history forecasting, conformal prediction, interval validation/scoring, client-side JS feasibility) with adversarial verification. Findings in **§16 of `docs/FORECASTING_RESEARCH.md`** with citations.
- Added **Forecasting / Projection** and **Calibrated Intervals** TODO categories to `docs/TODO.md`, cross-referenced to §16.
- **Implemented in `src/engine/forecast.ts`:**
  - **Damped trend (φ=0.9)** on the variable-spending Holt model. `HoltState.phi` is optional (defaults to undamped=1 for externally-constructed literal states; pipeline sets 0.9). New `dampingSum()` helper; `holtUpdate`/`holtForecast`/`initHolt`/`runHolt` thread φ through. Caps trend extrapolation at φ/(1−φ) instead of growing linearly forever.
  - **Empirical residual-quantile bands** in `calculatePredictionBands` — 10th/90th percentiles of historical residuals, bias-centred so √horizon scaling widens spread not bias. Replaces ±1.28σ Gaussian. Captures residual skew → asymmetric optimistic/pessimistic edges.
  - **Theta + damped-ETS combination** (decision 1a) — `runCombination` in `forecast.ts` equal-weights Theta (SES-with-drift, drift = ½·OLS-slope) and the damped-ETS Holt on the variable residual, running both incrementally so the band errors reflect the true combined model. `variableMethod` is now `'combination' | 'average' | 'none'` (was `'holt'`); `variableState` exposes the ETS component. Seasonal-naive deferred (would double-count dowFactors).
  - **Worst-case runway metric** (decision 2a) — `WorkspaceDashboard` computes `calculateRunwayWithBands` once, derives expected + pessimistic; `MetricsGrid` shows a "Worst-case runway/balance" card from the pessimistic band (only when it differs from expected).
  - **Validation harness** (`src/engine/validation.ts`) — rolling-origin (walk-forward) backtest with no leakage (each origin trains on date ≤ origin only), scored per horizon, plus pinball loss, PICP + Wilson CI, PINAW, PIT histogram. **The dashboard's `accuracy` now runs through this out-of-sample backtest instead of the old in-sample single fit** — headline MAE/RMSE/etc are now honest (and will read worse than before, because the old number was leaky/over-optimistic). `AccuracySummary` shape unchanged so MetricsGrid is untouched. 24 new tests.
  - **Diagnostics panel** (`ForecastDiagnostics.vue`) — collapsed "Forecast diagnostics (advanced)" `<details>` on the dashboard showing the harness's calibration metrics (coverage vs target + Wilson CI, pinball, PINAW, per-horizon table, PIT histogram). Kept out of the non-technical MetricsGrid (UX rule). Dashboard computes the full `BacktestSummary` once; `accuracy` derives from it. DaisyUI semantic tokens throughout.
  - **Adaptive Conformal Inference** (`src/engine/conformal.ts`) — `adaptiveConformal` walks the residual stream (expanding window), nudges αₜ from realized hits/misses (miss → widen, hit → tighten), converging on target coverage with no distributional assumptions. `buildForecast` applies the learned tail probabilities to the forward bands via `calculatePredictionBands(... lowerProb, upperProb)`, keeping the asymmetric empirical quantiles; below warm-up it reports `adapted:false` + fixed 80% band. `ForecastResult.conformal` exposes it; the diagnostics panel shows the adapted level. Because the harness's `buildForecast` calls now include ACI, the backtest measures ACI's effect (closed loop). 6 new tests.
- Updated tests across all changes. **All 181 tests pass, type-check clean, production build succeeds.**

## Current state

Branch: `claude/fervent-rubin-y1wa0q`. Six commits: (1) research docs, (2) damped-trend + empirical-bands, (3) combination model + worst-case runway, (4) validation harness, (5) diagnostics panel, (6) ACI band calibration. Forecasting runs a Theta + damped-ETS combination with ACI-calibrated empirical-quantile bands; the dashboard surfaces a worst-case runway figure, reports out-of-sample accuracy, and exposes the calibration metrics + adapted band level in a collapsed advanced panel. `PredictionBand`/`RunwayResult`/`AccuracySummary` shapes unchanged (`ForecastResult` gained a `conformal` field).

## Key context

- **Headline research conclusions:**
  1. The decompose-then-combine architecture is sound. For the *variable residual*, replace single Holt with an equal-weighted combination of **Theta (SES-with-drift) + damped-trend ETS + seasonal-naive**. Simple+combination beats complex ML on a single short series (M4/M5, "Size Matters"). M5's GBDT win does NOT transfer — needed cross-learning across thousands of series.
  2. Holt's undamped trend over-extrapolates off one-off spikes → switch to damped trend as a cheap interim fix.
  3. Croston/SBA/TSB don't fit *signed net* cashflow (assume non-negative count demand). Only defensible use = split inflow/outflow streams.
  4. Weekly (period-7) seasonality is estimable from a few months; monthly/annual is NOT on <6 months — gate it.
  5. Calibrated bands: empirical residual-quantile intervals first (near-free), then ACI/DtACI conformal for a real long-run coverage guarantee. **Calibrate on daily/weekly residuals, never monthly (n too small, ~100 needed).** Guarantee is marginal/long-run, NOT per-forecast conditional — UI copy must reflect that.
  6. Validate via rolling-origin per horizon + pinball loss (proper) + PIT histogram + PICP/PINAW with Wilson band.
- **Client-side feasibility:** JS forecasting ecosystem is sparse/stale. Hand-roll on `simple-statistics` (already shipped). Conformal = arithmetic over residuals, ~40-80 LOC. Pyodide/WASM Python = skip (too heavy for an offline PWA). Implementation ladder: residual-quantile → split conformal → ACI/DtACI.
- **Caveat:** WebFetch was 403-blocked during the pass, so claims rest on search-extracted summaries of primary sources (arXiv IDs/DOIs verified correct). Lowest-confidence items flagged in §16.7.
- Remaining follow-ups from the same research: DtACI (grid-of-γ upgrade over single-γ ACI); a "provisional" cue on the main chart below ~100 residuals; interval UI copy ("~80% over the long run", not "80% confident this month"); history-length seasonality gating; and the inflow/outflow split spike. All smaller than the core that's now done.
- The harness is the lever for everything else: it can now backtest the combination vs the old single-Holt empirically (point accuracy + coverage), so future forecasting changes are measurable not assumed.
- φ=0.9 is a deliberate middle-ground damping constant (documented in forecast.ts with the 0.8/0.98 alternatives). On a clean linear series damped trend under-shoots vs undamped — that's the intended tradeoff (real cashflow residuals aren't clean lines).
