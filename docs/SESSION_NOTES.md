# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Renamed top-level entity from "Budget" to "Workspace" across the entire codebase. Created demo workspace with realistic household cashflow data.

## Accomplished

- **Type rename:** `Budget` → `Workspace`, `budgetId` → `workspaceId` in `src/types/models.ts`, added `isDemo: boolean` field
- **DB migration v4:** New `workspaces` table, data migration from `budgets`, foreign key rename, old table deletion
- **File renames:** 5 view files renamed via `git mv` (BudgetListView → WorkspaceListView, etc.)
- **Bulk code update:** 600+ references across all source files — routes, components, engines, composables, props, template bindings
- **Backward-compatible import:** `validateImport` accepts both `workspace` and `budget` keys, both `workspaceId` and `budgetId`
- **Demo workspace:** `src/db/demoData.ts` seeds a "Demo Household" workspace with 16 realistic SA Rand-denominated items (salary, freelance, rent, groceries, etc.) on first visit (empty DB)
- **Demo seeding:** Non-blocking `seedDemoWorkspace()` call in `main.ts`
- **Documentation:** Updated all docs to reflect workspace terminology
- **All 94 tests pass, build succeeds, type-check clean**

## Current state

DB schema v4. All features working. Build passes. 94 unit tests across 7 files.

Working features:
- All previous features intact with "workspace" terminology
- Demo workspace auto-seeded on first visit
- Backward-compatible import (handles old "budget" format)
- Multiple workspaces supported (always were, now properly named)

## Key context

- `isDemo: boolean` flag on Workspace model — demo workspace uses `id: 'demo-household'`
- DB v4 migration handles v3→v4 upgrade (renames tables + foreign keys, preserves data)
- Financial terms kept as-is: "budgeted", "unbudgeted", "over/under budget" — standard accounting language
- `resolveWorkspacePeriod()` replaces `resolveBudgetPeriod()` in projection engine
- `exportWorkspace()` / `importWorkspace()` replace old function names
- Export format uses `workspace:` key but import accepts both `workspace:` and `budget:`
