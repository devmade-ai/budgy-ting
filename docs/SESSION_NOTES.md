# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Variable recurring expenses — support for usage-based bills and prepaid/on-demand purchases.

## Accomplished

- **Added `RecurringVariability` type** (`'fixed' | 'variable' | 'irregular'`) and `variability` field to `RecurringPattern`
- **Added `'irregular'` frequency type** — for patterns with no fixed schedule
- **DB schema v7** — adds `variability` index to patterns table, backfills existing patterns with `'fixed'`
- **Updated pattern engine** — `projectPattern()` handles `'irregular'` frequency by spreading as daily rate (total historical spend / observation days)
- **Updated forecast engine** — computes historical totals from linked transactions for irregular patterns, passes to `projectPattern` for daily rate calculation
- **Updated import wizard classify step** — when user marks a group as "recurring", shows sub-type selector: "Fixed amount" / "Varies each time" / "Buy when needed"
- **Updated demo data** — added variable recurring (City of CT water) and irregular recurring (prepaid electricity, Vodacom data bundle) examples
- **Updated export/import** — backfills missing `variability` field on imported patterns
- **Updated test helpers** — `makePattern()` in forecast.test.ts includes `variability: 'fixed'`

## Current state

All 109 tests pass. Build succeeds. Type-check clean. DB schema at v7.

## Key context

- Three variability types: `fixed` (same amount, regular schedule), `variable` (different amount, regular schedule), `irregular` (no schedule, buy when needed)
- Irregular patterns use `frequency: 'irregular'` and project as daily rate spread
- Variable patterns use existing frequency detection but the amount varies (wider prediction bands come from `amountStdDev`)
- Import wizard sub-type selector only appears when group is classified as "recurring"
- Export schema still v3 — `variability` backfilled on import if missing
