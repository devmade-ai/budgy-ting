# TODO

<!-- AI-managed backlog. Group by category. Use - [ ] for pending items. Delete completed items (git history tracks them). -->

## Features

- [ ] Add Papa Parse for robust CSV parsing (multi-line quoted fields, custom delimiters)
- [ ] Import history view — show importBatches table data (already stored, never displayed)

## UX

- [ ] Virtual scrolling for long transaction lists (vue-virtual-scroller) — current pagination filters full array on every change, 10K+ transactions will lag
- [ ] Keyboard shortcuts for common actions
- [ ] Theme combo picker UI in burger menu — useDarkMode() exposes setCombo() + themeCombos but no UI exists yet. Currently only "Vivid" (cmyk/night) combo registered. Add more combos to src/config/themes.ts + register themes in CSS + sync flash script.

## Forecasting / Projection

<!-- From deep-research validation pass 2026-06-17. Full rationale + citations: docs/FORECASTING_RESEARCH.md §16. -->

- [ ] Backtest the Theta + damped-ETS combination against the previous single-Holt model via rolling-origin once the validation harness lands. The combination is live (decision 1a: Theta + damped-ETS, seasonal-naive deferred to avoid double-counting dowFactors); this item is just the empirical confirmation it helps. §16.1
- [ ] Seasonal-naive as a third combination member — deferred (decision 1a). Only viable if dowFactors is replaced as the weekly-seasonality mechanism; otherwise it double-counts. Revisit if dowFactors is reworked. §16.1
- [ ] Gate seasonality by history length: estimate weekly (period-7) only with enough weeks; never fit monthly/annual on <6 months daily data (overfits). Add a guard. §16.3
- [ ] Spike test: split inflow/outflow into two non-negative streams and net the forecasts; compare accuracy vs forecasting signed totals. Croston/SBA/TSB don't fit signed net cashflow directly. §16.2

## Calibrated Intervals

<!-- From deep-research validation pass 2026-06-17. Full rationale + citations: docs/FORECASTING_RESEARCH.md §16.4-16.6. -->

- [ ] Layer ACI/DtACI online miscoverage adjustment for a long-run coverage guarantee under drift (~40-70 LOC, no deps). §16.4
- [ ] Calibrate intervals on daily/weekly residuals, never monthly totals; below ~100 residuals render bands as explicitly provisional (n too small for stable coverage). §16.4
- [ ] Fix interval UI copy: bands mean "~80% of the time over the long run," not "80% confident about this month" (conformal gives marginal, not conditional, coverage). §16.4
- [ ] Add rolling-origin backtest scored per horizon; replace any random splitting (K-fold leaks future into past). §16.5
- [ ] Add pinball/quantile loss (≈ scaled CRPS) as the headline uncertainty metric alongside MAE/RMSE/bias/WMAPE — strictly proper, lower-variance at small N than coverage counting. §16.5
- [ ] Add PIT-histogram calibration check + PICP/PINAW with a Wilson confidence band. §16.5

## Performance

- [ ] CashflowGraph `:key` triggers full ApexCharts re-init on chartMode / timeRange / forecastMonths / isDark change. Investigate mutating the chart instance (via `this.chart.updateOptions`) instead of a keyed remount.

## Testing

- [ ] Unit tests for debounced `cashOnHandForRunway` watcher in WorkspaceDashboard
- [ ] Test radiogroup arrow-key focus movement in WorkspaceForm — requires mounting the full form (DateInput, router, validation composable) so deferred
- [ ] `loadStorageUsage` runtime branch (navigator.storage missing / estimate rejects) — currently covered by code inspection only

## A11y / Dark mode

- [ ] Visually verify the 12 `text-base-content/40` → `/60` bumps against both cmyk and night themes using an actual contrast checker. Current bumps were made by heuristic (body/helper vs icon) — dark-theme readability unverified.
- [ ] Verify `CashflowGraph` chart-loading error state (`ChartLoadError` component) renders as expected when a chunk fetch fails — e.g. by disabling the network tab after initial paint.

## Refactor

- [ ] `src/components/transactionDirty.ts` isn't a component — lives in `src/components/` only because it was extracted from `TransactionEditModal.vue`. Move to `src/lib/` or `src/components/helpers/` for clarity.
- [ ] `TransactionEditModal` save is fire-and-forget — modal closes optimistically on save click; if the parent's `db.transactions.update()` rejects, the error appears on the dashboard (not the modal) because the modal already unmounted. Not data-loss (reopening shows the un-saved state + dashboard banner reads "Couldn't save changes"), but feedback is loosely coupled. Fixing requires child-waits-for-parent via callback prop or promise — emit-based flow doesn't support it cleanly.

## Technical

- [ ] Migrate WorkspaceDetailView.vue raw `localStorage` calls to `safeGetItem`/`safeSetItem` — kebab hint key (`KEBAB_HINT_KEY`) uses inline try/catch instead of the project's `useSafeStorage` wrapper
- [ ] Remove debug system (DebugPill + debugLog) after alpha phase
- [ ] Extract shared ML worker management — useTagSuggestions.ts and useEmbeddings.ts have ~300 lines of duplicated worker lifecycle, timeout, ref-counting patterns. Should be a shared factory function.
- [ ] Use embedding clustering in import pattern creation — currently "McDonald's" vs "MCDONALDS" creates separate patterns. embedTexts() and clusterTexts() exist but aren't used during import save. Would require grouping by semantic similarity before creating patterns.
- [ ] Phase 5 (remaining): Parameter auto-tuning (grid search alpha/beta), bonus metrics — trend detection already done via Holt's double exponential smoothing in forecast.ts (linear regression was rejected)
