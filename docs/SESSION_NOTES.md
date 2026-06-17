# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Deep-research validation pass on Farlume's forecasting core, then implemented the two cheapest high-value findings: damped trend + empirical residual-quantile confidence bands.

## Accomplished

- Ran a 5-angle parallel research pass (intermittent-demand models, short-history forecasting, conformal prediction, interval validation/scoring, client-side JS feasibility) with adversarial verification. Findings in **§16 of `docs/FORECASTING_RESEARCH.md`** with citations.
- Added **Forecasting / Projection** and **Calibrated Intervals** TODO categories to `docs/TODO.md`, cross-referenced to §16.
- **Implemented in `src/engine/forecast.ts`:**
  - **Damped trend (φ=0.9)** on the variable-spending Holt model. `HoltState.phi` is optional (defaults to undamped=1 for externally-constructed literal states; pipeline sets 0.9). New `dampingSum()` helper; `holtUpdate`/`holtForecast`/`initHolt`/`runHolt` thread φ through. Caps trend extrapolation at φ/(1−φ) instead of growing linearly forever.
  - **Empirical residual-quantile bands** in `calculatePredictionBands` — 10th/90th percentiles of historical residuals, bias-centred so √horizon scaling widens spread not bias. Replaces ±1.28σ Gaussian. Captures residual skew → asymmetric optimistic/pessimistic edges.
- Updated tests: reframed the `tracks an increasing trend` assertion to damped-correct semantics; added a `damped trend` describe block (4 tests) and a skewed-band test. **All 145 tests pass, type-check clean, production build succeeds.**

## Current state

Branch: `claude/fervent-rubin-y1wa0q`. Two commits: (1) research docs, (2) damped-trend + empirical-bands implementation with docs. Forecasting now runs damped-trend Holt + empirical-quantile bands. `PredictionBand` shape unchanged, so runway.ts optimistic/pessimistic consumers flow through unchanged (now skew-aware).

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
- Next cheap follow-ups from the same research: runway UI leading with the pessimistic/lower edge, then the Theta+ETS+seasonal-naive combination and ACI/DtACI conformal calibration (needs ~100+ residuals; calibrate on daily/weekly not monthly).
- φ=0.9 is a deliberate middle-ground damping constant (documented in forecast.ts with the 0.8/0.98 alternatives). On a clean linear series damped trend under-shoots vs undamped — that's the intended tradeoff (real cashflow residuals aren't clean lines).
