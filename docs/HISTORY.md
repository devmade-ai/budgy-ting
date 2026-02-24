# History

<!-- Changelog and record of completed work. Organized by date. -->

## 2026-02-24

- **Audit Fixes (Error Handling, Dependencies, Code Duplication):**
  - Added try/catch with user-friendly error banners to all 10 views with DB operations
    (BudgetListView, BudgetCreateView, BudgetEditView, BudgetDetailView,
    ExpenseCreateView, ExpenseEditView, ExpensesTab, ProjectedTab, CompareTab, ImportWizardView)
  - Added silent error handling to `useCategoryAutocomplete` (non-critical, degrades gracefully)
  - Removed phantom `date-fns` dependency from package.json (was listed but never imported)
  - Extracted `resolveBudgetPeriod()` helper in projection.ts to eliminate 3-file duplication
    of budget period resolution logic (was in ProjectedTab, CompareTab, exportImport)

- **Deployment Setup:**
  - GitHub Actions workflow (`deploy.yml`) — build + deploy to GitHub Pages
  - Icon generation script (`scripts/generate-icons.mjs`) — SVG to PNG via sharp
  - Manual ICO packing for favicon.ico
  - SPA routing via 404.html copy

- **Deployment Review & Fixes:**
  - Fixed Vue Router missing `import.meta.env.BASE_URL` (would break routing on GH Pages)
  - Fixed SVG font from Georgia to generic `serif` (Georgia absent on Ubuntu CI runners)
  - Split `purpose: 'any maskable'` into separate entry (Chrome DevTools warning)
  - Bumped Node 20 → 22 in CI (Node 20 EOL April 2026)
  - Bumped sharp `^0.33.0` → `^0.34.5` (latest stable)

- **Code Standards Audit:**
  - Extracted duplicated `formatAmount()` to `composables/useFormat.ts` (was in 4 files)
  - Removed dead `scripts/generate-icons.py` (superseded by `.mjs`, had old Georgia font)
  - Added decision comments to BudgetListView (import/restore flow)
  - Added decision comments to BudgetDetailView (cascade delete)

- **PWA System Overhaul:**
  - Split `usePWA.ts` into `usePWAUpdate.ts` (wraps `useRegisterSW`, 60-min periodic checks,
    offline-ready auto-dismiss) and `usePWAInstall.ts` (browser detection, analytics, dismiss persistence)
  - `InstallPrompt.vue` — banner with native install or manual instructions link + dismiss
  - `InstallInstructionsModal.vue` — browser-specific guides (Safari iOS/macOS, Firefox Android/desktop)
  - Added `vite-plugin-pwa/client` type reference to env.d.ts

- **Debug System (Alpha):**
  - `debug/debugLog.ts` — pub/sub event store, 200-entry circular buffer, global error listeners
  - `debug/DebugPill.vue` — floating pill with Log + Environment tabs, Copy/Clear
  - Mounted in separate Vue root (survives main app crashes)

- **Completed TODO items moved here:**
  - Create PWA icon assets and place in /public
  - Set up GitHub Actions CI/CD pipeline
  - Configure GitHub Pages deployment

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
