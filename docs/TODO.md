# TODO

<!-- AI-managed backlog. Group by category. Use - [ ] for pending items. Move completed items to HISTORY.md. -->

## Features

- [ ] Add ApexCharts for category bar chart and monthly line chart (requires npm install)
- [ ] Add Papa Parse for robust CSV parsing (multi-line quoted fields, custom delimiters)
- [ ] Storage usage indicator on budget list page
- [ ] Generate dedicated maskable icon with proper safe-zone padding

## UX

- [ ] Add success toast/notification after actions (create, import, export)
- [ ] Virtual scrolling for long expense lists (vue-virtual-scroller)
- [ ] Keyboard shortcuts for common actions

## Technical

- [ ] Remove debug system (DebugPill + debugLog) after alpha phase
- [ ] Split ImportWizardView.vue into 4 step sub-components (currently 700+ lines, exceeds 600-line threshold)
- [ ] Replace duplicated error/loading/empty-state markup with ErrorAlert/LoadingSpinner/EmptyState components across all views
- [ ] Add error boundary component to prevent white-screen crashes
- [ ] Optimize category autocomplete to use Dexie range queries instead of full-table scan + JS filter
- [ ] Add unit tests for exportImport engine
