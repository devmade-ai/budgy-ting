# TODO

<!-- AI-managed backlog. Group by category. Use - [ ] for pending items. Move completed items to HISTORY.md. -->

## Actuals-First Pivot (Phases 2, 4, 5)

- [ ] Phase 2: Import wizard redesign — merge upload+map steps, add classification step (recurring/once-off/ignore), auto-accept known patterns, duplicate detection per import batch
- [ ] Phase 4: Single-screen UI — replace empty workspace detail with graph + metrics grid + paginated transaction table. Wire forecast/accuracy/runway engines into the UI.
- [ ] Phase 5: Trend detection (linear regression on weekly aggregates), parameter auto-tuning (grid search alpha/beta), bonus metrics

## Features

- [ ] Add Papa Parse for robust CSV parsing (multi-line quoted fields, custom delimiters)
- [ ] Storage usage indicator on workspace list page
- [ ] Generate dedicated maskable icon with proper safe-zone padding
- [ ] Export/import for new Transaction model (JSON backup/restore)

## UX

- [ ] Virtual scrolling for long transaction lists (vue-virtual-scroller)
- [ ] Keyboard shortcuts for common actions

## Technical

- [ ] Remove debug system (DebugPill + debugLog) after alpha phase
