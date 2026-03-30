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

## UX — Burger Menu Hardening (glow-props sync)

- [ ] Add `aria-expanded` and `aria-controls` to the menu trigger button (disclosure pattern)
- [ ] Add Escape key handler to close the menu
- [ ] Add `cursor-pointer` on backdrop overlay — iOS Safari fix (empty divs don't receive click events without it)
- [ ] Add `overscroll-contain` on the dropdown to prevent scroll chaining behind the menu
- [ ] Add focus management — focus first item on open, return focus to trigger on close
- [ ] Consider extracting to standalone `BurgerMenu.vue` component (keeps AppLayout cleaner)

## UX

- [ ] Virtual scrolling for long transaction lists (vue-virtual-scroller) — current pagination filters full array on every change, 10K+ transactions will lag
- [ ] Keyboard shortcuts for common actions

## Technical — Icon Generation (glow-props sync)

- [ ] Generate dedicated 1024x1024 maskable icon with proper safe-zone padding — glow-props recommends separate large maskable icon; budgy-ting only has 512x512 for maskable purpose

## Technical — CLAUDE.md Sync (glow-props sync)

- [ ] Add Z-Index Scale table to CLAUDE.md — formalize current ad-hoc values (header z-10, dropdown z-20, modals z-50, toasts z-[100], debug pill z-[9999]) into a documented scale
- [ ] Normalize debug pill z-index from `z-[9999]` to match the documented scale
- [ ] Add "Discontinued repos" AI note — skip `plant-fur` and `coin-zapp` in cross-project operations

## Technical

- [ ] Remove debug system (DebugPill + debugLog) after alpha phase
- [ ] Extract shared ML worker management — useTagSuggestions.ts and useEmbeddings.ts have ~300 lines of duplicated worker lifecycle, timeout, ref-counting patterns. Should be a shared factory function.
- [ ] Use embedding clustering in import pattern creation — currently "McDonald's" vs "MCDONALDS" creates separate patterns. embedTexts() and clusterTexts() exist but aren't used during import save. Would require grouping by semantic similarity before creating patterns.
- [ ] Phase 5 (remaining): Parameter auto-tuning (grid search alpha/beta), bonus metrics — trend detection already done via Holt's double exponential smoothing in forecast.ts (linear regression was rejected)
