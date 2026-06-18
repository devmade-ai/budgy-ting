# TODO

<!-- AI-managed backlog. Group by category. Use - [ ] for pending items. Delete completed items (git history tracks them). -->

## Features

- [ ] Add Papa Parse for robust CSV parsing (multi-line quoted fields, custom delimiters)
- [ ] Import history view — show importBatches table data (already stored, never displayed)

## UX

- [ ] Virtual scrolling for long transaction lists (vue-virtual-scroller) — current pagination filters full array on every change, 10K+ transactions will lag
- [ ] Keyboard shortcuts for common actions
- [ ] Theme combo picker UI in burger menu — useDarkMode() exposes setCombo() + themeCombos but no UI exists yet. Currently only the single "Farlume" brand combo (light/dark) is registered. A picker is only worth building if more brand palettes are added to src/config/themes.ts (+ mirror in index.html flash script). With one brand theme, the existing light/dark toggle is sufficient.

## Forecasting / Projection

<!-- From deep-research validation pass 2026-06-17. Full rationale + citations: docs/FORECASTING_RESEARCH.md §16. -->

- [ ] Backtest the Theta + damped-ETS combination against the previous single-Holt model via rolling-origin once the validation harness lands. The combination is live (decision 1a: Theta + damped-ETS, seasonal-naive deferred to avoid double-counting dowFactors); this item is just the empirical confirmation it helps. §16.1
- [ ] Seasonal-naive as a third combination member — deferred (decision 1a). Only viable if dowFactors is replaced as the weekly-seasonality mechanism; otherwise it double-counts. Revisit if dowFactors is reworked. §16.1
- [ ] Gate seasonality by history length: estimate weekly (period-7) only with enough weeks; never fit monthly/annual on <6 months daily data (overfits). Add a guard. §16.3
- [ ] Spike test: split inflow/outflow into two non-negative streams and net the forecasts; compare accuracy vs forecasting signed totals. Croston/SBA/TSB don't fit signed net cashflow directly. §16.2

## Calibrated Intervals

<!-- From deep-research validation pass 2026-06-17. Full rationale + citations: docs/FORECASTING_RESEARCH.md §16.4-16.6. -->

- [ ] **Residual mild over-coverage (~89% vs 80% target).** The √horizon over-coverage is FIXED — `calculatePredictionBands` now uses constant-width empirical quantiles (the residual is mean-reverting + recurring is deterministic, so no random-walk growth), measured via backtest at coverage 0.89 / PINAW 0.74 (was 0.996 / 1.91). Warm-up trimming (dropping the first ~7 residuals) was TRIED and measured as negligible (0.894 → 0.897), so it was not kept — the residual over-coverage isn't warm-up driven. Likely the residual band variance double-counts the day-of-week swing already applied via dowFactors. Proper next lever if it matters: per-horizon empirical widths from the harness's out-of-sample residuals, or building bands from dow-adjusted residuals. Low priority — errs conservative and close to target. §16.4/§16.5
- [ ] DtACI (grid of γ experts) — deferred upgrade over single-γ ACI (`conformal.ts`). Only worth it if a single learning rate proves too slow/fast to track regime changes in practice. §16.4
- [ ] Mark the bands as provisional in the *main* UI (not just the advanced panel) when residuals are below ~100 / ACI hasn't adapted — n too small for stable coverage. The diagnostics panel already reports the adapted/not-adapted state; this is about a user-visible cue on the chart. §16.4
- [ ] Fix interval UI copy: bands mean "~80% of the time over the long run," not "80% confident about this month" (the ACI guarantee is marginal/long-run, not per-forecast conditional). §16.4

## Performance

- [ ] CashflowGraph `:key` triggers full ApexCharts re-init on chartMode / chartType / timeRange / forecastMonths / isDark change. Investigate mutating the chart instance (via `this.chart.updateOptions`) instead of a keyed remount. Note: the chartMode→chartType switch (line ↔ rangeArea) genuinely needs a re-init since ApexCharts can't hot-swap the base chart type; the other deps could use updateOptions.

## Testing

- [ ] Unit tests for debounced `cashOnHandForRunway` watcher in WorkspaceDashboard
- [ ] Test radiogroup arrow-key focus movement in WorkspaceForm — requires mounting the full form (DateInput, router, validation composable) so deferred
- [ ] `loadStorageUsage` runtime branch (navigator.storage missing / estimate rejects) — currently covered by code inspection only

## A11y / Dark mode

- [ ] Re-verify text contrast (formerly the `text-base-content/40`→`/60` bumps, now `text-ink-*`) against the Farlume light + dark themes with a real contrast checker. Token values changed in the facelift — the ink scale (`--ink-0..3`) and muted/faint utilities should be re-checked for AA, especially `text-ink-faint` on `bg-app`/`bg-card`.
- [ ] Verify `CashflowGraph` chart-loading error state (`ChartLoadError` component) renders as expected when a chunk fetch fails — e.g. by disabling the network tab after initial paint.

## Design / Facelift follow-ups (Farlume design system)

<!-- The DaisyUI→Farlume facelift landed: tokens in src/styles/, .fl-* component layer, self-hosted fonts, brand icons. Build/typecheck/178 tests pass, and a Playwright visual sweep (light + dark, desktop + mobile) across list/dashboard/import/tutorial/help/edit-modal/create/menu found no styling regressions. These are the remaining optional polish items. -->

- [ ] Native `<progress>` elements in WorkspaceListView (pull-to-refresh + storage bar) are token-styled via Tailwind arbitrary variants rather than the `.fl-progress` div component — swap to `.fl-progress` for visual parity if desired.
- [ ] ForecastDiagnostics keeps a native `<details>/<summary>` disclosure (accessible, zero-JS) styled with Farlume tokens rather than a `.fl-card` + chevron-button. Fine as-is; revisit only if a chevron-toggle look is wanted.
- [ ] TagSuggestions accept-chip lost its hover text-color affordance (would clash inside the solid accent pill). If a hover cue is wanted, use a subtle chip background/opacity shift instead.

## Refactor

- [ ] `src/components/transactionDirty.ts` isn't a component — lives in `src/components/` only because it was extracted from `TransactionEditModal.vue`. Move to `src/lib/` or `src/components/helpers/` for clarity.
- [ ] `TransactionEditModal` save is fire-and-forget — modal closes optimistically on save click; if the parent's `db.transactions.update()` rejects, the error appears on the dashboard (not the modal) because the modal already unmounted. Not data-loss (reopening shows the un-saved state + dashboard banner reads "Couldn't save changes"), but feedback is loosely coupled. Fixing requires child-waits-for-parent via callback prop or promise — emit-based flow doesn't support it cleanly.

## Technical

- [ ] Migrate WorkspaceDetailView.vue raw `localStorage` calls to `safeGetItem`/`safeSetItem` — kebab hint key (`KEBAB_HINT_KEY`) uses inline try/catch instead of the project's `useSafeStorage` wrapper
- [ ] Remove debug system (DebugPill + debugLog) after alpha phase
- [ ] Extract shared ML worker management — useTagSuggestions.ts and useEmbeddings.ts have ~300 lines of duplicated worker lifecycle, timeout, ref-counting patterns. Should be a shared factory function.
- [ ] Use embedding clustering in import pattern creation — currently "McDonald's" vs "MCDONALDS" creates separate patterns. embedTexts() and clusterTexts() exist but aren't used during import save. Would require grouping by semantic similarity before creating patterns.
- [ ] Phase 5 (remaining): Parameter auto-tuning (grid search alpha/beta), bonus metrics — trend detection already done via Holt's double exponential smoothing in forecast.ts (linear regression was rejected)
