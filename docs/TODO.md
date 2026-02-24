# TODO

<!-- AI-managed backlog. Group by category. Use - [ ] for pending items. Move completed items to HISTORY.md. -->

## Features

- [ ] Add ApexCharts for category bar chart and monthly line chart (requires npm install)
- [ ] Swap fuzzy matching from simple scoring to Fuse.js (requires npm install)
- [ ] Add date-fns for robust date calculations (leap years, timezone edge cases) — removed from package.json since unused; re-add when needed
- [ ] Add Papa Parse for robust CSV parsing (multi-line quoted fields, custom delimiters)
- [ ] Storage usage indicator on budget list page
- [ ] Generate dedicated maskable icon with proper safe-zone padding

## UX

- [ ] Add loading spinners/skeleton screens for better perceived performance
- [ ] Add success toast/notification after actions (create, import, export)
- [ ] Virtual scrolling for long expense lists (vue-virtual-scroller)
- [ ] Keyboard shortcuts for common actions

## Technical

- [ ] Run `npm install` locally (npm registry blocked during development)
- [ ] Verify build compiles with `npm run build`
- [ ] Add unit tests for projection engine
- [ ] Add unit tests for matching engine
- [ ] Add unit tests for variance calculation engine
- [ ] Add unit tests for CSV parser
- [ ] Remove debug system (DebugPill + debugLog) after alpha phase
