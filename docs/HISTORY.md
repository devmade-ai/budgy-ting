# History

<!-- Changelog and record of completed work. Organized by date. -->

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
