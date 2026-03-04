# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Phase 1 (Data Model) + Phase 3 (Forecasting Engine) of the actuals-first pivot described in `docs/FORECASTING_RESEARCH.md`.

## Accomplished

- **New data models** — `Transaction` (unified, signed amounts), `RecurringPattern`, `ImportBatch` replace `Expense`/`Actual`. Signed convention: positive=income, negative=expense.
- **DB schema v6** — clean slate migration: drops expenses/actuals/categoryMappings, creates transactions/patterns/importBatches. Old Workspace data cleared so demo re-seeds.
- **Installed `simple-statistics`** (~30KB) — stddev, mean, median, linear regression, quantiles.
- **Pattern detection engine** (`engine/patterns.ts`) — frequency detection from transaction intervals (daily→annually), anchor day detection, amount variability (CV threshold), `projectPattern()` for deterministic scheduling of recurring items.
- **Hybrid forecasting engine** (`engine/forecast.ts`) — Holt's double exponential smoothing (alpha=0.2, beta=0.05) for variable spending, day-of-week seasonal factors, parametric + bootstrap confidence bands (80% CI), combined forecast (recurring + variable). Falls back to simple average with <14 days of data.
- **Prediction accuracy engine** (`engine/accuracy.ts`) — MAE (primary), RMSE, bias, WMAPE, hit rate. Replaces old MAPE-based approach.
- **Cash runway engine** (`engine/runway.ts`) — daily balance projection from cash-on-hand through forecast, depletion detection, min balance tracking, band-based scenarios (optimistic/expected/pessimistic).
- **Updated demo data** — 2 months of transactions with signed amounts, 10 recurring patterns, `cashOnHand: 15000` on workspace.
- **Legacy compatibility** — `Expense`, `Actual`, `LineType`, `CategoryMapping` types retained for existing UI code. Legacy DB table stubs for compile compat. `DailyPoint`, `expandActualsToDailyPoints`, `expandForecastToDailyPoints` stubs for CashflowChart/ProjectedTab.
- **66 new tests** (patterns: 24, forecast: 24, accuracy: 11, runway: 7) — 142 total across 9 test files, all passing. Type-check clean.

## Current state

All engine work for the actuals-first pivot is complete. The old UI code compiles via legacy compatibility types but the views (ExpensesTab, ProjectedTab, CompareTab, ImportWizard, etc.) still use the old Expense/Actual model and will need migration in Phase 2 (Import Wizard Redesign) and Phase 4 (Single-Screen UI).

## Key context

- `simple-statistics` is now a runtime dependency (~30KB)
- Frequency type now includes `biweekly` (new) and keeps `once-off` for legacy compat
- DB schema is at v6 — first load after upgrade will clear all data and re-seed demo
- Legacy DB tables (expenses, actuals, categoryMappings) are typed but dropped at runtime — existing views that query them will get empty results
- The old `engine/projection.ts` and `engine/variance.ts` are untouched — they still work with the legacy `Expense` type for the existing UI
- Phase 2 (Import Wizard) and Phase 4 (Single-Screen UI) are the next steps
