# History

<!-- Changelog and record of completed work. Organized by date. -->

## 2026-02-25

- **Type-Aware Actuals Splitting:**
  - All engines now classify actuals as income or expense via `actual.expenseId → expense.type` lookup
  - Cashflow engine: `actualSpend` replaced with `actualIncome`/`actualExpenses`; effective net independently uses actual values where available
  - Envelope engine: filters to expense-type actuals only for spend tracking (burn rate, depletion date)
  - Variance engine: excludes income actuals from line item, category, monthly, and total variance calculations
  - Matching engine: added `originalSign` to `ImportedRow`, `isTypeCompatible()` prefers same-type matches (negative CSV amounts → income), falls back to any type
  - ImportStepMapping: preserves `originalSign` from parsed amounts before `Math.abs()`
  - CashflowTab/CompareTab: updated to pass expenses to engines
  - Fixed variable ordering bug in variance.ts (`expenseActuals` used before definition)
  - 92 unit tests across 7 files (was 86) — new tests for income splitting, type-compatible matching, income exclusion

- **Cashflow Pivot:**
  - Added `LineType = 'income' | 'expense'` type and `type` field to Expense model
  - DB schema v3 migration — renames `totalBudget` → `startingBalance`, adds `type: 'expense'` default
  - Income/expense toggle on ExpenseForm (red/green buttons with icons)
  - Extended projection engine — tracks income/expense separately (`monthlyIncome`, `monthlyNet`, `totalIncome`, `totalNet`)
  - New `engine/cashflow.ts` — running balance timeline, zero-crossing detection, income vs expense breakdown
  - New `CashflowTab.vue` — summary cards, monthly running balance table, balance forecast bar chart
  - Updated `ProjectedTab` — income rows in green, separate sections, income/expense/net footer totals
  - Updated `ExpensesTab` — income badge, green amounts, income/expense monthly summaries
  - Renamed all `totalBudget` → `startingBalance` across envelope engine, views, export/import
  - Backward-compatible import handles both old `totalBudget` and new `startingBalance` + missing `type` field
  - 86 unit tests across 7 files (was 75) — new cashflow.test.ts (8 tests), 3 new projection tests

- **Technical Debt Cleanup:**
  - Split `ImportWizardView.vue` (747 lines) into 4 step sub-components:
    - `import-steps/ImportStepUpload.vue` — file upload with auto-detection
    - `import-steps/ImportStepMapping.vue` — column mapping with validation
    - `import-steps/ImportStepReview.vue` — match review with pagination
    - `import-steps/ImportStepComplete.vue` — success confirmation
    - Parent `ImportWizardView.vue` reduced to ~130 lines (orchestrator only)
  - Migrated all 9 view files to use shared `ErrorAlert`, `LoadingSpinner`, `EmptyState` components — eliminated 15+ instances of duplicated markup
  - Added `ErrorBoundary.vue` — wraps RouterView to catch unhandled errors, shows recovery UI instead of white screen
  - Optimized `useCategoryAutocomplete` — uses Dexie `startsWithIgnoreCase` index query for prefix matching (was full-table scan), falls back to capped substring match for remaining slots
  - Added 19 unit tests for `exportImport` engine (`validateImport` — schema validation, field checks, edge cases)
  - Total tests: 75 across 6 files (was 56 across 5)

- **Completed TODO items moved here:**
  - Split ImportWizardView.vue into 4 step sub-components
  - Replace duplicated error/loading/empty-state markup with shared components across all views
  - Add error boundary component to prevent white-screen crashes
  - Optimize category autocomplete to use Dexie range queries
  - Add unit tests for exportImport engine

- **Fixed Budget Envelope Feature:**
  - Added `totalBudget: number | null` field to Budget model
  - DB schema v2 migration — preserves existing data, sets null for existing budgets
  - BudgetForm: "I have a set amount to spend" checkbox + amount input
  - New `engine/envelope.ts` — calculates remaining balance, daily burn rate, depletion date, month-by-month running balance with actual vs projected effective spend
  - ProjectedTab: envelope summary card showing total budget, projected spend, remaining/over, and which month the budget runs out
  - CompareTab: envelope card with total budget, spent so far, remaining, depletion date, daily burn rate, and forecast message ("on track" vs "over budget by X")
  - Export/import backward compatibility — old exports without totalBudget default to null

- **Unit Tests (56 tests, 5 files):**
  - `projection.test.ts` — 13 tests: month slot generation, all 6 frequency types, end dates, cross-boundary daily expenses, category rollup
  - `matching.test.ts` — 16 tests: high/medium/low/unmatched confidence, date format detection, date parsing, amount parsing with currency symbols/parenthetical negatives
  - `variance.test.ts` — 7 tests: zero/positive/negative variance, per-line-item, unbudgeted actuals, category and monthly rollup
  - `csvParser.test.ts` — 13 tests: basic CSV, quoted fields, escaped quotes, CRLF, column mismatch, empty files, blank lines, JSON import
  - `envelope.test.ts` — 7 tests: no actuals, with actuals, budget exceeded, burn rate, depletion date, running balance
  - Installed vitest, added test config to vite.config.ts, added npm test scripts

- **Completed TODO items moved here:**
  - Add unit tests for projection engine
  - Add unit tests for matching engine
  - Add unit tests for variance calculation engine
  - Add unit tests for CSV parser

## 2026-02-24

- **Codebase Review & Bug Fixes:**
  - **Fixed fuzzy matching algorithm** (`engine/matching.ts`):
    - Replaced `Math.min` with `Math.max` in medium-confidence pass — was too lenient (any single good score passed)
    - Replaced character-presence scoring with Levenshtein distance — old algorithm was order-blind ("abc" vs "cba" scored as perfect match)
  - **Fixed weekly/daily projection arithmetic** (`engine/projection.ts`):
    - Replaced day-of-month subtraction with Date object-based `daysBetween()` helper
    - Old code broke across month boundaries (Jan 25 to Feb 4 calculated -20 days)
  - **Fixed variance threshold mislabel** (`engine/variance.ts`):
    - Extracted `ROUNDING_TOLERANCE` constant (0.005 = half-cent rounding tolerance)
    - Corrected misleading comment that said "5% tolerance" — display-level threshold is separate
    - Added bounds check on monthLabels array access
  - **Strengthened import validation** (`engine/exportImport.ts`):
    - Now validates `periodType`, `startDate`, `createdAt` on budgets (was only checking `id` and `name`)
    - Validates first 5 expenses have required fields (`id`, `budgetId`, `description`, `amount`)

- **Accessibility Improvements:**
  - Added `role="dialog"` / `role="alertdialog"` and `aria-modal="true"` to all 3 modal components
  - Added focus trapping and Escape-to-close via new `useDialogA11y` composable
  - Focus restores to previously-focused element on modal close
  - Added `role="alert"` to all error banners across all 10 views
  - Added `aria-label` to all icon-only buttons (edit, delete, dismiss, help)
  - Added `aria-hidden="true"` to decorative icons
  - Added colorblind-safe text labels ("Over"/"Under") alongside color-only bars in CompareTab
  - Added 3-item legend (Budgeted / Under budget / Over budget) to bar charts
  - Added keyboard navigation (Arrow Up/Down, Enter, Escape) to category autocomplete
  - Added ARIA combobox pattern (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, `role="listbox"`, `role="option"`)

- **Architecture & UX:**
  - Added 404 catch-all route — redirects unknown paths to budget list
  - Added skipped row feedback to import wizard — shows warning when rows can't be parsed
  - Added pagination (50 per page) to import Step 3 — prevents DOM overload with large files
  - Created reusable `ErrorAlert.vue`, `LoadingSpinner.vue`, `EmptyState.vue` components
  - Created `useDialogA11y.ts` composable for shared modal accessibility logic
  - Fixed localStorage key naming inconsistency (tutorial now uses `budgy-ting:` prefix like PWA install)
  - Clarified app-lifetime interval in usePWAUpdate is intentional (not a memory leak)

- **Completed TODO items moved here:**
  - Swap fuzzy matching from simple scoring to Levenshtein (was pending Fuse.js)
  - Add date-fns for robust date calculations — addressed with Date object approach instead

- **Tutorial Modal for New Users:**
  - `composables/useTutorial.ts` — shared reactive state backed by localStorage
  - `components/TutorialModal.vue` — 6-step walkthrough (welcome, create budget, add expenses, projections, import, compare)
  - Auto-shows on first visit, persists dismissal in localStorage
  - Help button (circle-help icon) in header to re-open tutorial anytime
  - Follows existing Teleport modal pattern (ConfirmDialog, InstallInstructionsModal)

- **Audit Fixes (Error Handling, Dependencies, Code Duplication):**
  - Added try/catch with user-friendly error banners to all 10 views with DB operations
  - Added silent error handling to `useCategoryAutocomplete` (non-critical, degrades gracefully)
  - Removed phantom `date-fns` dependency from package.json (was listed but never imported)
  - Extracted `resolveBudgetPeriod()` helper in projection.ts to eliminate 3-file duplication

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
  - Split `usePWA.ts` into `usePWAUpdate.ts` and `usePWAInstall.ts`
  - `InstallPrompt.vue` — banner with native install or manual instructions link + dismiss
  - `InstallInstructionsModal.vue` — browser-specific guides (Safari iOS/macOS, Firefox Android/desktop)

- **Debug System (Alpha):**
  - `debug/debugLog.ts` — pub/sub event store, 200-entry circular buffer, global error listeners
  - `debug/DebugPill.vue` — floating pill with Log + Environment tabs, Copy/Clear
  - Mounted in separate Vue root (survives main app crashes)

## 2026-02-23

- Initial project setup: created documentation structure per CLAUDE.md
- **Phase 0 — Project Scaffolding:** Vite + Vue 3 + TypeScript + UnoCSS + Dexie.js + PWA
- **Phase 1 — Budget Management:** CRUD with cascade delete
- **Phase 2 — Expense Management:** CRUD with category autocomplete
- **Phase 3 — Projection Engine:** All 6 frequency types
- **Phase 4 — Import Wizard:** CSV/JSON parsing, 3-pass matching
- **Phase 5 — Comparison Views:** Line item, category, monthly variance
- **Phase 6 — Export/Import:** JSON backup/restore
- **Phase 7 — PWA Polish:** Install prompt + SW updates
