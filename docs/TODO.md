# TODO

<!-- AI-managed backlog. Group by category. Use - [ ] for pending items. Delete completed items (git history tracks them). -->

## Features

- [ ] Add Papa Parse for robust CSV parsing (multi-line quoted fields, custom delimiters)
- [ ] Import history view — show importBatches table data (already stored, never displayed)

## UX

- [ ] Virtual scrolling for long transaction lists (vue-virtual-scroller) — current pagination filters full array on every change, 10K+ transactions will lag
- [ ] Keyboard shortcuts for common actions
- [ ] Theme combo picker UI in burger menu — useDarkMode() exposes setCombo() + themeCombos but no UI exists yet. Currently only "Vivid" (cmyk/night) combo registered. Add more combos to src/config/themes.ts + register themes in CSS + sync flash script.

## Performance

- [ ] CashflowGraph `:key` triggers full ApexCharts re-init on chartMode / timeRange / forecastMonths / isDark change. Investigate mutating the chart instance (via `this.chart.updateOptions`) instead of a keyed remount.

## Testing

- [ ] Unit tests for WorkspaceListView storage indicator helpers (`formatStorageSize`, `loadStorageUsage` behaviour when `navigator.storage` is missing)
- [ ] Unit tests for `removeRow` in ImportStepReview (index reconciliation for `tagInputIndex`, `currentPage` bounds after splicing)
- [ ] Unit tests for debounced `cashOnHandForRunway` watcher in WorkspaceDashboard

## A11y / Dark mode

- [ ] Visually verify the 12 `text-base-content/40` → `/60` bumps against both cmyk and night themes using an actual contrast checker. Current bumps were made by heuristic (body/helper vs icon) — dark-theme readability unverified.
- [ ] Verify `CashflowGraph` chart-loading error state (`ChartLoadError` component) renders as expected when a chunk fetch fails — e.g. by disabling the network tab after initial paint.

## Refactor

- [ ] `src/components/transactionDirty.ts` isn't a component — lives in `src/components/` only because it was extracted from `TransactionEditModal.vue`. Move to `src/lib/` or `src/components/helpers/` for clarity.

## Technical

- [ ] Migrate WorkspaceDetailView.vue raw `localStorage` calls to `safeGetItem`/`safeSetItem` — kebab hint key (`KEBAB_HINT_KEY`) uses inline try/catch instead of the project's `useSafeStorage` wrapper
- [ ] Remove debug system (DebugPill + debugLog) after alpha phase
- [ ] Extract shared ML worker management — useTagSuggestions.ts and useEmbeddings.ts have ~300 lines of duplicated worker lifecycle, timeout, ref-counting patterns. Should be a shared factory function.
- [ ] Use embedding clustering in import pattern creation — currently "McDonald's" vs "MCDONALDS" creates separate patterns. embedTexts() and clusterTexts() exist but aren't used during import save. Would require grouping by semantic similarity before creating patterns.
- [ ] Phase 5 (remaining): Parameter auto-tuning (grid search alpha/beta), bonus metrics — trend detection already done via Holt's double exponential smoothing in forecast.ts (linear regression was rejected)
