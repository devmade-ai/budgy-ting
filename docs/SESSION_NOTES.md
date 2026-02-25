# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Type-aware actuals splitting — making all engines correctly distinguish income vs expense actuals based on linked expense type.

## Accomplished

- **Cashflow engine:** Takes `expenses` as 4th param, splits actuals into `actualIncome`/`actualExpenses` by month using `actual.expenseId → expense.type` lookup. Unmatched actuals default to 'expense'. Effective net independently uses actual income or actual expenses where available.
- **Envelope engine:** Takes `expenses` as optional 5th param, filters to expense-type actuals only for spend tracking (burn rate, depletion, etc.)
- **Variance engine:** Builds type lookup, filters to expense-only actuals for line items, categories, monthly, and totals. Income actuals excluded from all expense comparisons. Fixed variable ordering bug (`expenseActuals` used before definition).
- **Matching engine:** Added `originalSign` to `ImportedRow`, `isTypeCompatible()` helper — prefers same-type matches (negative amounts → income, positive → expense), falls back to any type.
- **ImportStepMapping:** Preserves `originalSign` from parsed CSV amounts before `Math.abs()`.
- **Views:** CashflowTab passes expenses to cashflow engine, shows actual income/expenses in table. CompareTab passes expenses to envelope engine.
- **Tests:** 92 tests across 7 files (was 86). New tests for income actual splitting, type-compatible matching, income exclusion from variance.

## Current state

All code type-checks, builds, 92 unit tests pass. DB schema v3.

Working features:
- Type-aware actuals: income actuals count as income, expense actuals count as expenses across all engines
- Matching engine prefers type-compatible matches using bank statement sign hints
- All previous cashflow pivot features intact (income/expense tracking, running balance, zero-crossing, etc.)

## Key context

- `actual.expenseId → expense.type` is the mechanism for classifying actuals as income or expense
- All engines that process actuals now take an `expenses` parameter and build a type lookup
- `ImportedRow.originalSign` preserves CSV sign before `Math.abs()` — used as hint for matching
- Unmatched actuals (null expenseId) conservatively default to 'expense' everywhere
- `CashflowMonth.actualSpend` was replaced with `actualIncome` and `actualExpenses` (both `number | null`)
