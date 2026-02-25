# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Fixed budget envelope feature + comprehensive unit tests for all engines.

## Accomplished

- **Envelope feature:** Users can set a total budget amount ("I have R50,000 to spend") and see: remaining balance, daily burn rate, depletion date, month-by-month running balance, and whether they're on track or over budget
- **Unit tests:** 56 tests across 5 files covering projection, matching, variance, CSV parser, and envelope engines — all passing
- **DB migration:** Schema v2 adds `totalBudget` field to budgets with backward-compatible upgrade handler

## Current state

All code type-checks and builds. 56 unit tests pass. Dependencies installed.

Working features:
- Full budget CRUD with optional fixed total amount (envelope mode)
- Expense CRUD with category autocomplete (keyboard navigable)
- Projection engine showing month-by-month breakdown + envelope depletion tracking
- Import wizard with pagination, skipped row feedback
- Comparison views with envelope remaining balance, burn rate, depletion date
- Export/import with backward compatibility for new totalBudget field
- All modals with focus trapping, Escape key, ARIA roles
- All error banners with role="alert"
- PWA install + service worker updates
- Tutorial modal for first-time users

## Key context

- `Budget.totalBudget` is `number | null` — null means no envelope (backward compatible)
- DB schema is now v2 (Dexie migration handler sets null for existing budgets)
- `engine/envelope.ts` depends on both `projection.ts` output and `Actual[]` data
- ProjectedTab shows projected-only envelope summary (no actuals needed)
- CompareTab shows full envelope with actuals-based burn rate and depletion
- Export/import uses `{ ...data.budget, totalBudget: data.budget.totalBudget ?? null }` for backward compat
- vitest configured in `vite.config.ts` test section, tests in `src/engine/*.test.ts`
- Remaining TODOs in `docs/TODO.md`: ImportWizardView split, ErrorAlert migration, error boundary, exportImport tests
