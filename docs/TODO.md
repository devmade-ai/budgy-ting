# TODO

<!-- AI-managed backlog. Group by category. Use - [ ] for pending items. Move completed items to HISTORY.md. -->

## Features

- [ ] Pattern detection engine — detect recurring transactions from import history, suggest "promote to recurring"
- [ ] "Promote to recurring" action on imported actuals — creates expense from actual pattern
- [ ] Wire EMA/rolling-average aggregate forecast into UI (engine built, needs display)
- [ ] Add Papa Parse for robust CSV parsing (multi-line quoted fields, custom delimiters)
- [ ] Storage usage indicator on workspace list page
- [ ] Generate dedicated maskable icon with proper safe-zone padding
- [ ] Surface forecast accuracy metrics to users (currently internal/debug only)
- [ ] Code-split ApexCharts into separate chunk via dynamic import (currently 518KB in ProjectedTab bundle)

## UX

- [ ] Virtual scrolling for long expense lists (vue-virtual-scroller)
- [ ] Keyboard shortcuts for common actions

## Technical

- [ ] Remove debug system (DebugPill + debugLog) after alpha phase
