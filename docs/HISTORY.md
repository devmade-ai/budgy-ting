# History

<!-- Changelog and record of completed work. Organized by date. -->

## 2026-02-23

- Initial project setup: created documentation structure per CLAUDE.md
- **Phase 0 — Project Scaffolding:**
  - Saved product definition to `docs/PRODUCT_DEFINITION.md`
  - Vite + Vue 3 + TypeScript project structure (package.json, tsconfig, vite.config.ts)
  - UnoCSS with Tailwind preset, brand colours, utility shortcuts (uno.config.ts)
  - vite-plugin-pwa configuration with manifest
  - Dexie.js v4 schema v1: budgets, expenses, actuals, categoryCache (src/db/index.ts)
  - TypeScript data models: Budget, Expense, Actual, CategoryCache (src/types/models.ts)
  - Vue Router: budget list (/), budget detail (/budget/:id) with nested tabs (src/router/index.ts)
  - AppLayout component: header, max-width content area (src/components/AppLayout.vue)
  - BudgetListView: empty state, loading, budget cards (src/views/BudgetListView.vue)
  - BudgetDetailView: back nav, tab bar, nested router-view (src/views/BudgetDetailView.vue)
  - Stub tab views: ExpensesTab, ProjectedTab, CompareTab
