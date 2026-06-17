# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Deep-research validation pass on Farlume's forecasting core: is Holt's double exponential smoothing the right model for bank-statement-shaped data, and how to replace the heuristic confidence bands with calibrated ones. No code touched — research + docs only.

## Accomplished

- Ran a 5-angle parallel research pass (intermittent-demand models, short-history forecasting, conformal prediction, interval validation/scoring, client-side JS feasibility) with adversarial verification.
- Appended findings as **§16 of `docs/FORECASTING_RESEARCH.md`** (2026-06-17) — full rationale + citations (arXiv IDs / DOIs). Validates the existing hybrid-decomposition architecture (§1) and sharpens two specifics.
- Added two new TODO categories — **Forecasting / Projection** and **Calibrated Intervals** — to `docs/TODO.md`, each item cross-referenced to FORECASTING_RESEARCH.md §16.

## Current state

Branch: `claude/fervent-rubin-y1wa0q`. One commit covering the two doc files. No code changes — all items are proposals for the user to prioritize. App forecasting still runs the current single-Holt + heuristic-bands implementation.

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
- Nothing here is committed as code — next session can pick any TODO item from the two new categories and implement against the §16 rationale.
