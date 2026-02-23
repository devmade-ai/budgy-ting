# TODO

<!-- AI-managed backlog. Group by category. Use - [ ] for pending items. Move completed items to HISTORY.md. -->

## Phase 1 — Budget Management

- [ ] Budget create form (name, currency, period type, date range)
- [ ] Budget edit form (reuse create form, pre-filled)
- [ ] Budget delete with confirmation and cascade (expenses + actuals)
- [ ] Budget list interactions (tap to open detail)

## Phase 2 — Expense Management

- [ ] Expense list within budget detail (grouped by category)
- [ ] Add expense form (description, category autocomplete, amount, frequency, dates)
- [ ] Edit/delete expense
- [ ] Category autocomplete composable (debounced, from categoryCache)

## Phase 3 — Projection Engine

- [ ] Projection calculation module (pure TypeScript)
- [ ] Projected spend view (monthly breakdown table)
- [ ] Edge case handling (partial months, boundary clamping)

## Phase 4 — Import Wizard

- [ ] File upload step (CSV/JSON parsing with Papa Parse)
- [ ] Column mapping step (date, amount, category/description)
- [ ] Auto-matching engine (3-pass with Fuse.js)
- [ ] Review and confirmation step

## Phase 5 — Comparison Views

- [ ] Variance calculation module
- [ ] Line item comparison view
- [ ] Category comparison view with bar chart
- [ ] Monthly comparison view with line chart

## Phase 6 — Export

- [ ] Export budget to JSON
- [ ] Import from budgy-ting JSON export
- [ ] Data management (clear all, storage indicator)

## Phase 7 — PWA Polish

- [ ] PWA icons (192x192, 512x512, apple-touch-icon, favicon)
- [ ] Install prompt handling
- [ ] Service worker update prompt
- [ ] Mobile browser testing

## Technical

- [ ] Run `npm install` locally (npm registry blocked in CI environment)
- [ ] Verify build compiles with `npm run build`
- [ ] Create PWA icon assets and place in /public
