# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Cashflow pivot — transforming the app from budgeting-only to a cashflow-focused tool with income tracking, running balance, and cashflow forecasting.

## Accomplished

- **Data model:** Added `LineType = 'income' | 'expense'` and `type` field to Expense model
- **DB migration:** Schema v3 — renames `totalBudget` → `startingBalance` on budgets, adds `type: 'expense'` default to existing expenses
- **BudgetForm:** Renamed all `totalBudget` refs to `startingBalance` with updated labels ("I know my current balance", "Starting balance")
- **ExpenseForm:** Added income/expense toggle (red expense button, green income button with icons)
- **Projection engine:** Extended to track income vs expense separately — new `monthlyIncome`, `monthlyNet`, `totalIncome`, `totalNet` fields; `type` on `ProjectedRow`
- **Cashflow engine:** New `src/engine/cashflow.ts` — running balance timeline, zero-crossing detection, income vs expense breakdown per month
- **CashflowTab:** New tab with summary cards (starting balance, income, expenses, ending balance), monthly running balance table, balance forecast bar chart
- **ProjectedTab:** Income rows shown in green with separate Income/Expenses section headers, footer shows income/expense/net totals
- **ExpensesTab:** Updated to show income badge, income amounts in green, separate income/expense monthly summaries
- **CompareTab + envelope.ts:** Updated all `totalBudget` → `startingBalance` references
- **Export/import:** Backward compat for old exports (handles both `totalBudget` and `startingBalance`, defaults missing `type` to `'expense'`)
- **Tests:** 86 tests across 7 files (was 75), all passing — new cashflow.test.ts (8 tests), projection income tests (3 new), updated all makeExpense helpers

## Current state

All code type-checks and builds. 86 unit tests pass. DB schema v3.

Working features:
- Income + expense tracking with type toggle on form
- Starting balance (formerly totalBudget) for cashflow forecasting
- Projection engine with income/expense/net breakdown
- Cashflow tab showing running balance forecast, zero-crossing detection
- Projected tab with income (green) vs expense sections, net totals
- Envelope engine using startingBalance semantics
- Backward-compatible export/import (handles old totalBudget exports)
- All previous features intact (CRUD, autocomplete, import wizard, comparison, PWA, tutorial)

## Key context

- `Budget.startingBalance` (was `totalBudget`) — `number | null`, null means no balance tracking
- `Expense.type` — `'income' | 'expense'`, defaults to `'expense'`
- DB schema v3: migration renames totalBudget → startingBalance, adds type to expenses
- Projection engine: `monthlyTotals` = expenses only, `monthlyIncome` = income only, `monthlyNet` = income - expenses
- Cashflow engine: takes starting balance + projection → running balance with zero-crossing date
- 4 tabs: Expenses, Projected, Cashflow, Compare
- Route: `/budget/:id/cashflow` → `CashflowTab.vue`
- All `makeExpense` test helpers now include `type: 'expense'`
