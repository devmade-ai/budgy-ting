# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Complete legacy code cleanup — removed all deprecated types, broken views, and old engines from the pre-pivot budget-first system.

## Accomplished

- **Deleted legacy engines** — projection.ts, variance.ts, matching.ts, exportImport.ts, csvParser.ts (+ all tests)
- **Deleted broken views** — ExpensesTab, ProjectedTab, CompareTab, ExpenseCreateView, ExpenseEditView, ExpenseForm, ImportWizardView, all import-steps/*, all compare-views/*, CashflowChart
- **Removed legacy types** — `Expense`, `Actual`, `CategoryMapping`, `LineType`, `MatchConfidence`, `DailyPoint` and stub functions from models.ts, forecast.ts, db/index.ts
- **Cleaned up router** — removed routes for expenses CRUD, import wizard, and tab children
- **Updated WorkspaceDetailView** — removed tabs, import button, export functionality; fixed delete to use new tables (transactions, patterns, importBatches)
- **Updated WorkspaceListView** — removed expense summaries, import/export restore; fixed clear-all to use new tables
- **Updated TutorialModal** — rewrote steps for actuals-first paradigm (transactions + forecast instead of expenses + projections + compare)
- **Build passes** — vue-tsc clean, vite build clean, 69 tests pass (4 test files: patterns, forecast, accuracy, runway)

## Current state

The app is a clean shell: workspace CRUD works, new engines (forecast, patterns, accuracy, runway) are fully tested, but there's no UI for transactions or forecasting yet. WorkspaceDetailView shows a "Transaction views coming soon" placeholder. Phase 2 (import wizard redesign) and Phase 4 (single-screen UI) are the next steps.

## Key context

- `simple-statistics` is a runtime dependency (~30KB)
- DB schema is at v6 — transactions, patterns, importBatches, tagCache, workspaces
- No legacy types remain — everything uses Transaction + RecurringPattern
- 69 tests across 4 files (patterns: 24, forecast: 27, accuracy: 11, runway: 7)
- ApexCharts + vue3-apexcharts are still dependencies but CashflowChart was deleted — will be needed again for Phase 4 UI
