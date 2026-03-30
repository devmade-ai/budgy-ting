# TODO

<!-- AI-managed backlog. Group by category. Use - [ ] for pending items. Move completed items to HISTORY.md. -->

## Features

- [ ] Add Papa Parse for robust CSV parsing (multi-line quoted fields, custom delimiters)
- [ ] Storage usage indicator on workspace list page
- [ ] Code-split ApexCharts into separate chunk via dynamic import (currently 518KB in ProjectedTab bundle)
- [ ] Import history view — show importBatches table data (already stored, never displayed)
- [ ] Transaction deletion from import review step (currently only available on dashboard)

## Features — Download as PDF (glow-props sync)

- [ ] Print trigger — "Download as PDF" button in dashboard header or burger menu, calls `window.print()`

## UX

- [ ] Virtual scrolling for long transaction lists (vue-virtual-scroller) — current pagination filters full array on every change, 10K+ transactions will lag
- [ ] Keyboard shortcuts for common actions

## Technical — Icon Generation (glow-props sync)

- [ ] Generate dedicated 1024x1024 maskable icon with proper safe-zone padding — glow-props recommends separate large maskable icon; budgy-ting only has 512x512 for maskable purpose

## Technical

- [ ] Remove debug system (DebugPill + debugLog) after alpha phase
- [ ] Extract shared ML worker management — useTagSuggestions.ts and useEmbeddings.ts have ~300 lines of duplicated worker lifecycle, timeout, ref-counting patterns. Should be a shared factory function.
- [ ] Use embedding clustering in import pattern creation — currently "McDonald's" vs "MCDONALDS" creates separate patterns. embedTexts() and clusterTexts() exist but aren't used during import save. Would require grouping by semantic similarity before creating patterns.
- [ ] Phase 5 (remaining): Parameter auto-tuning (grid search alpha/beta), bonus metrics — trend detection already done via Holt's double exponential smoothing in forecast.ts (linear regression was rejected)
