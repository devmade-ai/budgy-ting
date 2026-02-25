# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Type-aware actuals splitting + "Create new" expense/income from import review screen.

## Accomplished

- **Type-aware actuals (prior commit):** All engines split actuals by linked expense type, matching engine type-aware with originalSign hints
- **Import review "Create new":** Users can create a new income/expense line directly from the import review dropdown, without leaving the wizard. Modal form pre-fills description, category, amount, and type from the imported CSV row. New expense saved to DB and auto-assigned to the row.

## Current state

All code type-checks, builds, 92 unit tests pass. DB schema v3.

Working features:
- Type-aware actuals across all engines
- "Create new" income/expense during import review (modal with pre-filled data)
- All previous cashflow pivot features intact

## Key context

- `ImportStepReview.vue` emits `create-expense` event → `ImportWizardView.vue` handles DB save + local state update
- "Create new" option appears as `+ Create new...` in the reassign dropdown on each match row
- Pre-fill logic: description/category/amount from imported row, type from `originalSign` (negative → income)
- New expense uses budget's `startDate`, no `endDate`, frequency defaults to monthly
- After creation, expense appears in all row dropdowns (reactive via `expenses` prop)
