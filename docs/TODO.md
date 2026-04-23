# TODO

<!-- AI-managed backlog. Group by category. Use - [ ] for pending items. Delete completed items (git history tracks them). -->

## Features

- [ ] Add Papa Parse for robust CSV parsing (multi-line quoted fields, custom delimiters)
- [ ] Storage usage indicator on workspace list page
- [ ] Code-split ApexCharts into separate chunk via dynamic import (currently 518KB in ProjectedTab bundle)
- [ ] Import history view — show importBatches table data (already stored, never displayed)
- [ ] Transaction deletion from import review step (currently only available on dashboard)

## UX

- [ ] Virtual scrolling for long transaction lists (vue-virtual-scroller) — current pagination filters full array on every change, 10K+ transactions will lag
- [ ] Keyboard shortcuts for common actions
- [ ] Theme combo picker UI in burger menu — useDarkMode() exposes setCombo() + themeCombos but no UI exists yet. Currently only "Vivid" (cmyk/night) combo registered. Add more combos to src/config/themes.ts + register themes in CSS + sync flash script.
- [ ] Systematic `text-base-content/40` audit — 30 uses remain after the a11y contrast pass normalised some to /60. Needs a per-site visual review to decide which are legitimately decorative (icons, placeholders) vs body text still failing WCAG AA.

## Performance

- [ ] Debounce the forecast/accuracy/runway computed chain in WorkspaceDashboard — cash-on-hand input recomputes on every keystroke while DB save is already 500ms-debounced. 1000+ transactions = main-thread hog mid-type.
- [ ] CashflowGraph `:key` triggers full ApexCharts re-init on chartMode / timeRange / forecastMonths / isDark change. Investigate mutating the chart instance (via `this.chart.updateOptions`) instead of a keyed remount.

## Testing

- [ ] Unit tests for `useDialogA11y` stack semantics — push/pop ordering, Escape-to-top-only behaviour, body-scroll lock-release symmetry across nested dialogs
- [ ] Unit tests for `isDirty` computation in TransactionEditModal — covers description/date/amount/direction/classification/tags each field in isolation

## Internationalization (deferred)

- [ ] ApexCharts axis + tooltip date formatters hardcoded English ('dd MMM'). Becomes relevant only if the UI is translated. Until then, entire-app English consistency makes this a non-issue.

## Technical

- [ ] Migrate WorkspaceDetailView.vue raw `localStorage` calls to `safeGetItem`/`safeSetItem` — kebab hint key (`KEBAB_HINT_KEY`) uses inline try/catch instead of the project's `useSafeStorage` wrapper
- [ ] Remove debug system (DebugPill + debugLog) after alpha phase
- [ ] Extract shared ML worker management — useTagSuggestions.ts and useEmbeddings.ts have ~300 lines of duplicated worker lifecycle, timeout, ref-counting patterns. Should be a shared factory function.
- [ ] Use embedding clustering in import pattern creation — currently "McDonald's" vs "MCDONALDS" creates separate patterns. embedTexts() and clusterTexts() exist but aren't used during import save. Would require grouping by semantic similarity before creating patterns.
- [ ] Phase 5 (remaining): Parameter auto-tuning (grid search alpha/beta), bonus metrics — trend detection already done via Holt's double exponential smoothing in forecast.ts (linear regression was rejected)
