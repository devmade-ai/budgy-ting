# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Documentation audit and full rewrite — all docs were severely outdated after the actuals-first pivot.

## Accomplished

- **Rewrote README.md** — Project structure now matches actual codebase (18 components, 10 composables, 8 engine files, 6 views). Feature descriptions updated from old expense/forecast/compare model to dashboard/import/patterns model. Tech stack includes all deps (apexcharts, simple-statistics, marked).
- **Rewrote USER_GUIDE.md** — Replaced old 3-tab workflow (Expenses/Forecast/Compare) with single-screen dashboard guide. Replaced 4-step import wizard docs with 3-step (upload, classify, confirm). Removed stale expense CRUD sections.
- **Rewrote TESTING_GUIDE.md** — All test scenarios rewritten for dashboard UI, 3-step import, and kebab menu. Removed old expense management, projected spend, and compare tab scenarios.
- **Updated TutorialModal.vue** — 6 steps now describe: welcome, create workspace, import transactions, detect patterns, see forecast, track runway. Previously described old add-expenses/see-projections/compare flow.
- **Fixed stale user-facing strings** — Confirmation dialogs in WorkspaceDetailView and WorkspaceListView said "expenses" instead of "transactions/patterns".
- **Fixed stale code comments** — useFormat.ts, useFormValidation.ts, useTagAutocomplete.ts referenced deleted files/tables.
- **Fixed HISTORY.md** — Legacy types entry said "retained for backward compat" but they were removed in clean slate migration.

## Current state

All documentation matches actual codebase. Code comments are accurate. App is fully functional. 97 tests pass, build succeeds, type-check clean.

## Key context

- App uses single-screen `WorkspaceDashboard.vue` (not 3 tabs) — graph + metrics + transaction table
- Import is 3-step: upload → classify (recurring/once-off/ignore) → confirm
- Data model: `Transaction` (unified), `RecurringPattern`, `ImportBatch` — no separate Expense/Actual
- Export schema is v3, DB schema is v6
- `generateId()` replaces `useId()` — import path is still `@/composables/useId`
- `useTagAutocomplete.ts` only exports `touchTags()`
- `models.ts` only exports `isIncome()` helper
