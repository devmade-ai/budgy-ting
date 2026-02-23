# History

<!-- Changelog and record of completed work. Organized by date. -->

## 2026-02-23

- Initial project setup: created documentation structure per CLAUDE.md

- **Phase 0 — Project Scaffolding:**
  - Saved product definition to `docs/PRODUCT_DEFINITION.md`
  - Vite + Vue 3 + TypeScript project structure
  - UnoCSS with Tailwind preset, brand colours, utility shortcuts
  - vite-plugin-pwa configuration with manifest
  - Dexie.js v4 schema v1: budgets, expenses, actuals, categoryCache
  - TypeScript data models: Budget, Expense, Actual, CategoryCache
  - Vue Router with all routes (list, detail, create/edit, import)
  - AppLayout component with header

- **Phase 1 — Budget Management:**
  - BudgetForm component (reusable for create/edit)
  - BudgetCreateView and BudgetEditView
  - Delete with cascade (removes expenses + actuals)
  - ConfirmDialog component for destructive actions
  - Budget list with empty state and navigation

- **Phase 2 — Expense Management:**
  - ExpenseForm component with category autocomplete
  - ExpenseCreateView and ExpenseEditView
  - ExpensesTab with grouped-by-category display
  - Category autocomplete composable (debounced, from categoryCache)
  - Delete expense with actual unlinking

- **Phase 3 — Projection Engine:**
  - `engine/projection.ts` — pure TypeScript calculation module
  - All 6 frequency types: once-off, daily, weekly, monthly, quarterly, annually
  - Partial month and boundary clamping logic
  - Default 12-month rolling view for monthly budgets
  - ProjectedTab with by-item and by-category toggle

- **Phase 4 — Import Wizard:**
  - `engine/csvParser.ts` — CSV parser (RFC 4180 basics) + JSON parser
  - `engine/matching.ts` — 3-pass matching (exact, fuzzy, amount-only)
  - Date format auto-detection and parsing
  - Amount parsing (currency symbols, parenthetical negatives)
  - ImportWizardView — 4-step wizard (upload, map, review, confirm)
  - Column auto-detection, bulk approve, per-row reassignment

- **Phase 5 — Comparison Views:**
  - `engine/variance.ts` — variance calculation module
  - Line item, category, and monthly comparison views
  - CSS-based bar charts for category and monthly views
  - Variance colour coding (red/green/neutral with 5% tolerance)
  - Unbudgeted actuals section

- **Phase 6 — Export/Import:**
  - `engine/exportImport.ts` — export, validate, import functions
  - JSON export with comparison snapshot
  - Restore from backup with replace/merge handling
  - Clear all data with confirmation
  - Export button on budget detail, restore button on budget list

- **Phase 7 — PWA Polish:**
  - `composables/usePWA.ts` — install prompt + SW update handling
  - Install app button in header
  - Update available banner with refresh action
