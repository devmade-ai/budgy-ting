# History

<!-- Changelog and record of completed work. Organized by date. -->

## 2026-04-09

- **DaisyUI v5 migration — full theming overhaul (glow-props THEME_DARK_MODE sync):**
  - Installed DaisyUI v5, configured `@plugin "daisyui"` in Tailwind CSS v4 with 4 themes (lofi, black, emerald, forest)
  - Dual-layer theming: `data-theme` for DaisyUI components + `.dark` class for Tailwind utilities
  - Named combos (Approach B): "Classic" (lofi/black) and "Nature" (emerald/forest) — stored in `src/config/themes.ts`
  - Removed all custom `:root`/`.dark` CSS variable definitions (--color-text-default, --color-surface, etc.)
  - Removed all custom component classes (btn-primary, btn-secondary, btn-danger, input-field, card, tag-pill, page-title) — replaced with DaisyUI `btn`, `input`, `badge` classes
  - Migrated all 30+ Vue files: replaced ~200+ `dark:` paired classes with single DaisyUI semantic tokens (bg-base-100, text-base-content, border-base-300, text-error, text-success, etc.)
  - Updated flash prevention script in index.html to set both `.dark` class and `data-theme` attribute
  - Updated `useDarkMode.ts`: added `data-theme` attribute setting, theme combo support, per-combo meta theme-color
  - Updated print handler in AppLayout: saves/restores `data-theme` alongside `.dark` class
  - HelpDrawer prose styles: migrated from `var(--color-*)` to DaisyUI oklch variables (`oklch(var(--bc))`, etc.)
  - Z-index scale unchanged (already aligned: 10/40/50/60/70/80)
  - Brand colors retained in `@theme` for chart data visualization (CashflowGraph hex colors intentionally not migrated — ApexCharts requires hardcoded values)



- **PWA install detection — full pattern sync (glow-props PWA_SYSTEM sync):**
  - Browser detection expanded from 3 → 7 Chromium browsers (+ opera, samsung, vivaldi, arc)
  - Brave detection: `'brave' in navigator` existence check replaces UA string match (Brave Mobile strips "Brave" from UA)
  - `CHROMIUM_BROWSERS` exported constant — single source of truth for install/diagnostics/analytics
  - iOS non-Safari detection: CriOS (Chrome), FxiOS (Firefox), EdgiOS (Edge) caught before Safari check
  - iOS non-Safari install instructions redirect users to Safari with explanation
  - `display-mode: standalone` change listener detects install-via-browser-menu (not just native prompt)
  - Chromium fallback: 5s diagnostic timeout enables `chromiumFallback` ref → `needsManualInstructions` → install banner shows manual steps when native prompt was suppressed (Chrome 90-day dismiss)
  - Chromium fallback instructions in modal for all 7 browsers (address bar icon, browser menu)
  - Install instructions modal: "Why install?" benefits section + per-browser warning notes (Brave Shields, Firefox desktop)
  - `installed-via-browser` analytics event type added

- **ChunkLoadError prevention (glow-props PWA_SYSTEM sync):**
  - `lazyRetry()` wrapper on all lazy route imports — reloads once on 404 during deploy→SW update window
  - `sessionStorage` flag prevents infinite reload loops

- **version.json supplementary update detection (glow-props PWA_SYSTEM sync):**
  - Vite plugin (`versionJsonPlugin`) emits `version.json` with ISO `buildTime` on every build
  - `checkVersionUpdate()` in usePWAUpdate.ts fetches with `cache: 'no-store'`, compares against `localStorage`
  - Runs on initial load (stores current version) and on visibility change (throttled to once per minute)
  - Catches app changes that don't modify `sw.js` (edge case where precache manifest stays identical)

- **PWA update checks — visibility + suppression + cleanup (glow-props PWA_SYSTEM sync):**
  - Visibility-based update checks: `visibilitychange` listener triggers `registration.update()` when tab regains focus (catches deploys while backgrounded)
  - 30-second post-update suppression: `wasJustUpdated()` checks `sessionStorage` timestamp to prevent false re-detection after applying an update
  - `checkForUpdate()`: 1500ms settle delay lets SW lifecycle events propagate, error handling with debugLog
  - `cleanupOutdatedCaches: true` in workbox config — removes stale caches from older Workbox versions across deployments
  - Fixed DebugPill install prompt diagnostic: `usePWAInstall` now sets `__pwaInstallPromptReceived` flag when consuming the early-captured event (diagnostic was always showing "Not received" because the event was deleted before the pill opened)
  - PWA diagnostics tab: already wired into debug pill from DEBUG_SYSTEM sync

- **Save as PDF — full print implementation (glow-props DOWNLOAD_PDF sync):**
  - Added "Save as PDF" menu item in workspace actions (kebab menu + mobile bottom sheet)
  - Calls `window.print()` — zero dependencies, native browser PDF export
  - `no-print` on all interactive elements: app header, banners (update/offline/install), back navigation, action buttons, chart toggle buttons, transaction filters, pagination, cash-on-hand input
  - `print-show` utility class: forces desktop table layout in print (A4 width < sm breakpoint would show mobile cards)
  - `beforeprint`/`afterprint` in TransactionTable: bypasses pagination to show ALL transactions in print (not just current 25-row page)
  - `beforeprint`/`afterprint` in AppLayout: temporarily removes `.dark` class for light-mode print output (direct DOM toggle, no reactive side effects)
  - Cash-on-hand: print-only static text span replaces interactive `<input type="number">`
  - ApexCharts print CSS: hides toolbar, forces readable label/legend/grid colors regardless of dark mode
  - `print-color-adjust: exact` / `-webkit-print-color-adjust: exact` preserves intentional colors (badges, chart areas)

- **Debug System — Full pattern sync (glow-props DEBUG_SYSTEM sync):**
  - Circular buffer: replaced Array.shift() O(n) with head/count pointer pattern O(1) in debugLog.ts
  - Console interception: patched console.error/console.warn at module load with HMR guard
  - PWA Diagnostics tab: third tab in DebugPill with active health checks (protocol, SW state, manifest, standalone, install prompt)
  - Inline styles: replaced all Tailwind classes in DebugPill.vue with inline styles (survives CSS load failures)
  - Pre-framework inline pill: vanilla JS script in index.html with error buffer, __debugPushError(), 20-second loading timeout
  - URL query param redaction in debug reports
  - Immediate subscriber delivery (new subscribers get current entries)
  - DebugSource type accepts ad-hoc string sources via `(string & {})`
  - Timestamp changed from ISO string to numeric (Date.now()) for consistency
  - ClipboardItem Blob fallback added to copy
  - main.ts bridges pre-mount errors and clears loading timer on Vue mount
  - Global error listener HMR guard to prevent duplicates
  - Console interception re-entrancy guard (prevents infinite loop if subscriber triggers console.error)
  - Inline pill error listeners yield to debugLog.ts via __debugLogReady flag (prevents duplicate entries)
  - Hardcoded diagnostic indices replaced with label-based lookup (fragile → robust)
  - Inline pill alert() replaced with DOM error panel (non-blocking, scrollable)
  - Removed unnecessary immediate subscriber delivery (DebugPill re-fetches on every notify)

- **App Icons — 400 DPI + dedicated maskable icon (glow-props APP_ICONS sync):**
  - Increased Sharp density from 150 to 400 DPI for crisper edge anti-aliasing
  - Added `shape-rendering="geometricPrecision"` to source `icon.svg` (prioritizes accurate geometry for all rasterized icons)
  - Created dedicated 1024x1024 maskable icon with safe-zone padding (B glyph scaled to 80%, no rounded corners)
  - Updated manifest: 192/512 = `purpose: "any"`, 1024 maskable = `purpose: "maskable"`
  - Removed old maskable entry that reused pwa-512x512.png
  - Added 48x48 PNG favicon with `<link rel="icon" type="image/png">` in index.html (modern browsers prefer PNG over ICO)
  - Added `favicon-48x48.png` to `includeAssets` for offline precaching
  - Build verified: manifest.webmanifest has correct icon entries, all PNGs in dist
  - Fixed 10 stale `glow-props CLAUDE.md` code comment references across 6 files — now point to specific pattern files in `docs/implementations/` (THEME_DARK_MODE.md, PWA_SYSTEM.md, DOWNLOAD_PDF.md, BURGER_MENU.md)

- **Burger Menu — Arrow key navigation + z-index enforcement (glow-props BURGER_MENU sync):**
  - Added ArrowDown/ArrowUp (with wrapping) and Home/End key navigation to BurgerMenu.vue
  - Arrow key idx=-1 guard: ArrowDown → first item, ArrowUp → last item when no button focused
  - Z-index scale enforced per pattern: modals/drawers z-50 → z-[60] (6 components: BottomSheet, ConfirmDialog, HelpDrawer, InstallInstructionsModal, TransactionEditModal, TutorialModal)
  - Updated CLAUDE.md z-index scale table to match pattern (modals = 60, consolidated base content = 0-10)
  - Error routing: `handleItem` catches action errors and routes to `debugLog()` (debug pill visibility)
  - Removed redundant `handleOutsideClick` document listener — backdrop `@click="close"` already handles outside clicks
  - Timer cleanup: `handleItem` setTimeout tracked and cleared on unmount per AI_MISTAKES.md lesson
  - Removed unused `onMounted` import
  - Theme UI already implemented (dark/light toggle with Sun/Moon icons in menu)

- **Updated implementation pattern fetch URLs in CLAUDE.md:**
  - Renamed "Suggested Implementations" → "Implementation Patterns (Source of Truth)"
  - Changed all fetch URLs from `glow-props/contents/CLAUDE.md` to `glow-props/contents/docs/implementations/{PATTERN_NAME}.md`
  - Added GitHub Pages URL: `https://devmade-ai.github.io/glow-props/patterns/{PATTERN_NAME}.md`
  - Added listing endpoint to discover available patterns dynamically
  - Updated AI Notes entry to reference `docs/implementations/` folder
  - Updated Cross-Project Reference section with new URLs

## 2026-04-07

- **Removed local Suggested Implementations from CLAUDE.md:**
  - Deleted ~300 lines of hard-copied patterns (PWA, debug, icons, PDF, proxy)
  - Replaced with pointer to glow-props source repo (single source of truth)
  - Updated Cross-Project Reference to prohibit local copies
  - Added AI Note enforcing fetch-from-source rule
  - Added Prohibition against storing/copying patterns locally

## 2026-03-30

- **Burger Menu Hardening — Extracted BurgerMenu.vue (glow-props sync):**
  - Extracted standalone `BurgerMenu.vue` from inline menu in `AppLayout.vue`
  - Disclosure pattern: `aria-expanded`, `aria-controls`, `<nav>` with `<ul>/<li>` (not `role="menu"`)
  - Escape key handler (registered only while open, cleaned up on close)
  - `cursor-pointer` on backdrop overlay (iOS Safari fix — empty divs don't fire click events)
  - `overscroll-contain` on dropdown (prevents scroll chaining behind menu)
  - Focus management: first item focused on open, trigger focused on close (with `hasBeenOpen` guard)
  - `focus-visible:ring-2` on menu items for keyboard navigation visibility
  - `no-print` class on menu container
  - AppLayout simplified: menu items defined as computed data array, BurgerMenu handles all interaction

- **Z-Index Scale — Formalized (glow-props sync):**
  - Added Z-Index Scale table to CLAUDE.md (0→80 range)
  - Normalized debug pill: `z-[9999]` → `z-[80]`
  - Normalized toast: `z-[100]` → `z-[70]`

- **CLAUDE.md Sync:**
  - Added "Discontinued repos" AI note (skip `plant-fur` and `coin-zapp`)

- **Dark Mode — Full Implementation (glow-props sync):**

  **Foundation:**
  - `src/index.css`: Semantic CSS variable palette (`:root` light + `.dark` dark tokens), `@custom-variant dark` for Tailwind v4, `color-scheme: dark` on `html.dark`, `@media print` overrides
  - `src/composables/useDarkMode.ts`: Module-level singleton composable — localStorage persistence, `matchMedia` system preference fallback, cross-tab sync via `storage` event, dynamic `<meta name="theme-color">` update
  - `index.html`: Flash prevention inline `<script>` (applies `.dark` before first paint), dual `<meta name="theme-color">` tags with `media` queries

  **Component class dark variants (`dark:` prefix) — 30 files:**
  - Component classes in `index.css`: btn-primary, btn-secondary, btn-danger, input-field, card, page-title, tag-pill
  - AppLayout.vue: Header, burger menu, banners + "Dark / Light mode" toggle with Sun/Moon icons
  - CashflowGraph.vue: ApexCharts theme-aware config (axis labels, grid, tooltip, legend)
  - All 17 components + 8 views updated with dark mode variants
  - DebugPill.vue: Intentionally NOT updated — uses hardcoded dark theme by design (alpha diagnostic)

  **Completed TODO items moved here:**
  - CSS variable palette, useDarkMode composable, flash prevention, meta theme-color tags, Tailwind v4 dark variant, color-scheme: dark, menu toggle, @media print CSS

## 2026-03-23

- **Documentation Fixes — 4 issues from cross-repo audit:**
  - `src/router/index.ts`: Fixed stale comment "3-step" → "2-step" import wizard
  - `README.md`: Added `@huggingface/transformers` to Tech Stack section
  - `README.md`: Added `src/ml/` directory (6 files) to Project Structure
  - `README.md`: Added `EmbeddingCache` to models.ts description in Project Structure

## 2026-03-13

- **Mobile UX Audit — 20 Fixes Across 12 Components:**

  **CRITICAL (Touch Targets):**
  - `TransactionEditModal.vue`: Close button → 40x40px with hover bg (was 18px icon)
  - `TransactionEditModal.vue`: Tag removal buttons → 20x20px with hover bg (was 10px icon)
  - `ToastNotification.vue`: Dismiss button → 32x32px with 18px icon (was 14px icon)
  - `TransactionEditModal.vue`: Modal padding responsive `p-4 sm:p-5`, max-width clamp for small phones

  **MEDIUM (iOS Zoom, Text Sizes, Layout):**
  - `index.css`: `input-field` → `text-base` (16px) to prevent iOS Safari auto-zoom on focus
  - Removed redundant `text-sm` from all `input-field` uses (6 files)
  - `MetricCard.vue`: Label → `text-sm` (was `text-xs`)
  - `TransactionTable.vue`: Table headers → `text-sm` (was `text-xs`)
  - `ClassificationBadge.vue`: Responsive `text-xs sm:text-sm`
  - `TagSuggestions.vue`: Dismiss buttons → 20x20px touch targets (was 10px)
  - `HelpDrawer.vue`: Responsive width `w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)]`
  - `AppLayout.vue`: Menu dropdown `max-w-[calc(100vw-1rem)]` + 44px min-height on all items
  - `TransactionEditModal.vue`: Autocomplete dropdown renders upward (`bottom-full`) to avoid modal clip
  - `ToastNotification.vue`: Safe area inset on bottom position for iOS notch/home indicator

  **LOW (Polish):**
  - `TransactionTable.vue`: Pagination buttons → `px-4 py-2.5 min-w-[44px]`
  - `InstallPrompt.vue`: Stack vertically on mobile (`flex-col sm:flex-row`)
  - `BottomSheet.vue`: Swipe-to-close gesture on drag handle (80px threshold)

  **Verification:** 106 tests pass, type-check clean.

- **Documentation Accuracy Audit — 10 Fixes Across CLAUDE.md, README.md, USER_GUIDE.md, TESTING_GUIDE.md:**
  - CLAUDE.md: Added Project Status section with current features, schema v8, and tech stack
  - README.md: Fixed CSS framework (UnoCSS → Tailwind CSS v4), added 5 missing components, 6 missing composables, 1 missing engine file, corrected schema v6→v8, fixed import wizard 3→2 steps
  - USER_GUIDE.md: Rewrote import wizard section from 3-step (Upload/Classify/Confirm) to 2-step (Upload/Review & Import), added "Check for updates" to help menu list
  - TESTING_GUIDE.md: Fixed menu item count (5→6), corrected import wizard step count, rewrote Step 2/3 test scenarios to match per-transaction review flow, added "Check for updates" test scenario (5.3)

- **Code Quality Audit — 13 Fixes Across Race Conditions, Math Errors, Leaks, and Validation:**

  **Critical (Memory Leaks / Race Conditions):**
  - `useDialogA11y.ts`: Track and cancel `requestAnimationFrame` on unmount (was accessing stale DOM)
  - `usePWAUpdate.ts`: Track periodic update interval so HMR module reload doesn't duplicate it

  **High (Math Errors / Lifecycle Issues):**
  - `ImportStepReview.vue`: Guard `cosineSimilarity()` against zero-norm vectors (returns 0 instead of NaN)
  - `useTagSuggestions.ts`: Prevent `waitForModel()` polling interval from running after safety-net timeout fires
  - `matching.ts`: Replace hardcoded `DATE_FORMATS[1]!`/`[2]!` with named lookups by label (refactor-safe)
  - `ImportStepUpload.vue`: Abort FileReader on unmount to prevent stale reactive state updates

  **Medium (Division-by-Zero / Unnecessary Work):**
  - `ImportStepReview.vue`: Replace non-null assertion `descCounts.get()!` with nullish coalescing
  - `patterns.ts`: Guard `detectFrequency()` confidence calc against `expectedInterval === 0`
  - `usePWAInstall.ts`: Only run 5s diagnostic timeout on Chromium browsers (was firing on Safari/Firefox where `beforeinstallprompt` never exists)
  - `useTagAutocomplete.ts`: Add `debugLog` to silent catch in `pruneStaleTagCache()`

  **Low (Validation / NaN Guards / Pattern Consistency):**
  - `forecast.ts`: Guard `initHolt()` against NaN/Infinity input values
  - `exportImport.ts`: Validate ALL transactions in import file, not just the first (catches mid-file corruption)
  - `useTagInput.ts`: Standardise timeout cleanup to Set-based tracked pattern (matches ML composables)

  **Verification:** 106 tests pass, type-check clean.

- **Code Review Sweep — Bug Fixes, UX Improvements, and New Features:**

  **Synced CLAUDE.md from external glow-props:**
  - Added Triggers section (10 analysis triggers with aliases and sweep protocol)
  - Added AI Note for sibling repo access via GitHub API
  - Added Prohibition for interactive input prompts
  - Added Download as PDF suggested implementation
  - Added SVG design rules (400 DPI, shape-rendering)

  **UX Fixes:**
  - Kebab menu hint auto-dismisses after 6s (was pulsing forever until tapped)
  - Pull-to-refresh shows visual progress bar + color change at threshold
  - Import wizard shows transaction count when on step 2 (pagination depth awareness)
  - Import upload gives specific errors: empty file vs headers-only vs parse failure
  - Tag autocomplete shows "No matching tags — press Enter to create" hint

  **ML Model Recovery:**
  - Both ML composables (useTagSuggestions, useEmbeddings) expose `retryModel()` for download failure recovery
  - Import review shows "Retry download" button when models fail to load

  **New Feature — Transaction Deletion:**
  - Delete button in TransactionEditModal with inline confirmation
  - Wired through TransactionTable → WorkspaceDashboard with DB cleanup
  - Optimistic local state update for immediate UI feedback

  **TODO Cleanup:**
  - Removed completed items: Phase 2 (import wizard), Phase 4 (single-screen UI), legacy view migration, legacy type removal
  - Added deferred review findings: shared worker extraction, embedding clustering for import patterns, import history view, virtual scrolling detail

## 2026-03-09

- **Import Flow Refactor — Per-Transaction Review:**

  **Architecture Change:**
  - Replaced group-based ImportStepClassify with per-transaction ImportStepReview
  - Wizard simplified from 3 steps (Upload → Classify → Confirm) to 2 steps (Upload → Review)
  - Tags and classification now per-transaction, not per-group
  - Separate Confirm step removed — Import button integrated into Review step

  **New Component (`ImportStepReview.vue`):**
  - Paginated list (25/page) with search filter
  - Each transaction: classification toggle (recurring/once-off), tag input with autocomplete, ML tag suggestions, ignore toggle
  - Variability selector (fixed/variable/irregular) shown for recurring transactions
  - Exact pattern matching + embedding-based fuzzy matching (cosine ≥ 0.75)
  - Fuzzy matches show "similar to [pattern]" hint
  - Bulk action: "Mark all unmatched as once-off"

  **ML Integration:**
  - Embeddings: fuzzy-match unmatched transactions against existing patterns (replaces group clustering)
  - Tag suggestions: batch zero-shot classification per unique description, displayed inline
  - Both models still preload during Step 1 (Upload)

  **Save Logic (`NewImportWizard.vue`):**
  - Recurring patterns created at save time by grouping transactions with same description
  - Per-transaction tags preserved (not inherited from group)
  - Pattern frequency/anchor detection same as before, applied to per-description groups

  **Cleanup:**
  - Deleted `ImportStepClassify.vue` (group-based flow)
  - `TransactionGroup` type no longer used — replaced by `ReviewTransaction`

- **Transaction Edit Modal — Read-Only View Mode:**
  - Added `editing` ref toggle — modal opens in read-only mode showing description, date, type, amount, tags
  - Edit button switches to form mode with inputs and Save/Cancel
  - Added `knownTags` prop for autocomplete fallback when tagCache is empty

- **Cashflow Chart — Fixed Forecast Gap:**
  - Forecast series now prepends last actual data point when there's a date gap between actuals and forecast

- **ML Tag Suggestions — Threshold Fix:**
  - Lowered confidence threshold from 0.5 to 0.15 (zero-shot on short descriptions scores 0.2–0.4)
  - Added debug logging when all suggestions filtered out
  - Added `knownTags` prop to TransactionEditModal for autocomplete fallback

- **ML Auto-Tagging — Robustness & Candidate Labels:**

  **Composable Improvements (`ml/useTagSuggestions.ts`):**
  - Model load timeout (30s) — silently gives up on slow networks instead of hanging
  - Inference timeout (10s) — per-request timeout, resolves with empty results
  - `dispose()` method — terminates worker, clears pending requests, resets all state
  - All timeouts tracked and cleaned up in dispose

  **Candidate Labels Strategy:**
  - Three sources merged: tagCache (primary) → pattern tags (supplementary) → defaults (fallback)
  - 15 default finance categories for new users: groceries, rent, utilities, transport, insurance, salary, subscriptions, dining, entertainment, medical, savings, transfer, fuel, clothing, education
  - Pattern tags from `RecurringPattern` entries added as supplementary source

  **Earlier Model Warmup:**
  - `preloadModel()` moved from ImportStepClassify (Step 2) to NewImportWizard (Step 1)
  - Model starts downloading while user maps CSV columns
  - Worker disposed in NewImportWizard's `onUnmounted` to free ~50-100MB WASM heap

  **Verification:**
  - Build succeeds, type-check clean

## 2026-03-06

- **Variable Recurring Expenses — Support for usage-based and on-demand costs:**

  **New Types (`types/models.ts`):**
  - `RecurringVariability` — `'fixed' | 'variable' | 'irregular'`
  - `'irregular'` added to `Frequency` type
  - `variability` field added to `RecurringPattern`

  **DB Schema v7 (`db/index.ts`):**
  - Adds `variability` index to patterns table
  - Backfills existing patterns with `variability: 'fixed'`

  **Engine Updates:**
  - `patterns.ts`: `projectPattern()` handles `'irregular'` frequency — computes daily rate from total historical spend / observation days, spreads evenly across forecast window. Added `firstSeenDate` to `DetectedPattern`.
  - `forecast.ts`: For irregular patterns, computes `totalHistoricalAmount` and `historicalDaySpan` from linked transactions before passing to `projectPattern`.
  - `exportImport.ts`: Backfills missing `variability` field on imported patterns.

  **UI Changes:**
  - `ImportStepClassify.vue`: Sub-type selector when classified as "recurring": "Fixed amount" / "Varies each time" / "Buy when needed"
  - `NewImportWizard.vue`: Passes `variability` through to `RecurringPattern`. Sets `frequency: 'irregular'` for irregular patterns.

  **Demo Data:**
  - Added variable recurring: City of CT water (monthly, variable amount)
  - Added irregular recurring: Prepaid electricity, Vodacom data bundle

  **Verification:**
  - 109 tests pass, build succeeds, type-check clean

## 2026-03-04 (Session 3)

- **Full Codebase Audit — Bug Fixes and Dead Code Removal:**

  **Critical Bug Fixes (C1-C3):**
  - Fixed `detectFrequency()` in `NewImportWizard.vue` — was called with `string[]` (ISO dates) instead of `number[]` (day intervals). All new recurring patterns created during import had `frequency: null`, producing zero forecast projections. Now correctly computes intervals between consecutive dates before calling `detectFrequency()`, and handles the return value with proper fallback to `'monthly'`.

  **High-Priority Fixes:**
  - H1: Fixed timer leak in `WorkspaceDashboard.vue` — `cashSaveTimeout` now cleaned up on `onUnmounted`
  - H2: Strengthened `validateImport()` in `exportImport.ts` — now validates `patterns` and `importBatches` are arrays when present, and spot-checks first transaction has required fields (id, date, amount)
  - H3: Fixed `v-for` key in `MetricsGrid.vue` — changed from array index `i` to `m.label` (labels are unique)
  - H4: Replaced inline duplicate detection in `NewImportWizard.vue` with existing `isDuplicate()` from `matching.ts` (includes `.trim()` that inline version omitted)

  **Medium-Priority Fixes:**
  - M1: Removed dead `categoryColumn` detection from `ImportStepUpload.vue` — auto-detected and emitted but never consumed by parent
  - M3: Renamed `useId()` → `generateId()` — pure function with no Vue dependency shouldn't use `use*` composable naming convention

  **Dead Code Removal:**
  - L1: Removed orphaned `ScrollHint.vue` — zero imports across codebase
  - L2-L4: Removed unused exports from `models.ts`: `primaryTag()`, `displayAmount()`, `isExpense()`
  - L5: Removed unused `positiveNumber()` from `useFormValidation.ts`
  - L6-L7: Removed unused `useTagAutocomplete()` composable and `touchTag()` (singular) from `useTagAutocomplete.ts` — only `touchTags()` (plural) was imported

  **Verification:**
  - 97 tests pass, build succeeds, type-check clean

## 2026-03-04 (Session 2)

- **Actuals-First Pivot — Phase 1 (Data Model) + Phase 3 (Forecasting Engine):**

  **New Data Models (`types/models.ts`):**
  - `Transaction` — unified model replacing separate Expense/Actual tables. Signed amounts (positive=income, negative=expense). Fields: date, amount, description, tags, source, classification, recurringGroupId, importBatchId.
  - `RecurringPattern` — detected or user-defined recurring transaction pattern. Fields: expectedAmount (signed), amountStdDev, frequency (incl. new `biweekly`), anchorDay, isActive, autoAccept.
  - `ImportBatch` — tracks CSV/JSON imports for duplicate detection.
  - Helper function: `isIncome()`.
  - Legacy types (`Expense`, `Actual`, `LineType`, `CategoryMapping`) removed — no longer needed after clean slate migration.

  **DB Schema v6 (`db/index.ts`):**
  - Clean slate migration: drops expenses, actuals, categoryMappings tables.
  - New tables: transactions, patterns, importBatches.
  - Workspace data cleared so demo re-seeds with new model.
  - `cashOnHand` field added to Workspace (persisted, was ephemeral).

  **New Engines:**
  - `engine/patterns.ts` — Recurring pattern detection: frequency detection from transaction intervals (maps median interval to daily/weekly/biweekly/monthly/quarterly/annually), anchor day detection (mode of day-of-week or day-of-month), amount variability (CV > 0.3 = "variable recurring"), `projectPattern()` for deterministic forward scheduling with month-end overflow handling.
  - `engine/forecast.ts` — Hybrid forecasting: Holt's double exponential smoothing (level + trend, alpha=0.2, beta=0.05), day-of-week seasonal multipliers (needs 4+ weeks), parametric confidence bands (80% CI, ±1.28σ√h), bootstrap bands for non-normal distributions, combined forecast (recurring items + variable residual). Falls back to simple average with <14 days of data.
  - `engine/accuracy.ts` — Prediction accuracy: MAE (primary, in currency units), RMSE, bias (systematic over/under), WMAPE (for aggregates), hit rate (% within threshold). Replaces old MAPE-only approach.
  - `engine/runway.ts` — Cash runway: daily balance projection from cash-on-hand, depletion detection, minimum balance tracking, `calculateRunwayWithBands()` for optimistic/expected/pessimistic scenarios.

  **Updated:**
  - `db/demoData.ts` — 2 months of signed transactions (48 total), 10 recurring patterns, cashOnHand R15,000.
  - `WorkspaceCreateView.vue` — adds `cashOnHand: null` to new workspaces.

  **Dependencies:**
  - Added `simple-statistics` (~30KB) — mean, median, stddev, linear regression, quantiles.

  **Tests:**
  - `patterns.test.ts` — 24 tests: frequency detection (all 6 types), anchor day, variable detection, pattern projection, grouping
  - `forecast.test.ts` — 24 tests: Holt init/update/forecast, runHolt trending, day-of-week factors, prediction bands, buildForecast with patterns/history
  - `accuracy.test.ts` — 11 tests: daily accuracy, aggregation, MAE, RMSE, bias, WMAPE, hit rate
  - `runway.test.ts` — 7 tests: depletion, survival, minimum balance, daily progression, band scenarios
  - Total: 142 tests across 9 files, all passing. Type-check clean.

  **Completed TODO items moved here:**
  - Pattern detection engine — detect recurring transactions from import history
  - Wire EMA/rolling-average aggregate forecast into UI (superseded by Holt's method)
  - Surface forecast accuracy metrics to users (engine built, UI pending Phase 4)
  - "Promote to recurring" action (superseded by import classification workflow)

## 2026-03-04 (Session 1)

- **Forecasting System Enhancement:**

  **New Engines:**
  - `engine/forecast.ts` — Statistical forecasting: EMA (alpha=0.3, min 3 months), rolling average fallback, daily expansion for charting. Functions: `calculateEMA()`, `calculateRollingAverage()`, `generateCategoryForecasts()`, `expandActualsToDailyPoints()`, `expandForecastToDailyPoints()`, `buildDailyCashflowData()`
  - `engine/accuracy.ts` — Daily forecast accuracy: compares projected vs actual at day+category level. Computes MAPE, weighted MAPE, per-category and per-method breakdowns. Not persisted — computed on-the-fly. Hidden from users by default.

  **New Components:**
  - `components/CashflowChart.vue` — ApexCharts daily cashflow line chart. Cumulative (running balance) or daily net toggle. Optional forecast overlay as dashed line. Zoom/pan enabled.

  **Modified:**
  - `views/ProjectedTab.vue` — Added Table/Chart view toggle. Loads actuals alongside expenses. Computes daily chart data via forecast engine.
  - `views/CompareTab.vue` — Variance display gated on `hasAnyActuals`. Shows empty state with import CTA until actuals uploaded. Displays actuals date range info.
  - `engine/variance.ts` — Added `hasAnyActuals: boolean` and `actualsDateRange` to `ComparisonResult`.

  **Dependencies:**
  - Added `apexcharts` and `vue3-apexcharts`

  **Tests:**
  - `forecast.test.ts` — 14 tests: EMA, rolling average, category grouping, daily expansion, income exclusion
  - `accuracy.test.ts` — 6 tests: empty input, daily accuracy, income exclusion, multi-category, MAPE summary
  - Total: 96 tests across 7 files, all passing

  **Completed TODO items moved here:**
  - Forecasting with simple-statistics — variable spend prediction with confidence bands
  - Add ApexCharts for category bar chart and monthly line chart

## 2026-03-03

- **Documentation Audit — Full Codebase Review:**

  **README.md:**
  - Rewrote project structure to reflect actual codebase: all 16 components, 10 composables, debug/ directory, compare-views/ and import-steps/ subdirectories, correct schema version (v5), accurate file descriptions

  **PRODUCT_DEFINITION.md:**
  - Full rewrite — all terminology updated from "budget" to "workspace"
  - Tech stack corrected: removed ApexCharts, Fuse.js, date-fns, Papa Parse (none in project); added marked
  - Stack justification updated: custom Levenshtein matching, CSS bar charts, native Date helpers
  - Data model updated: category→tags, budgetId→workspaceId, CategoryCache→TagCache, schema v5 with migration history
  - All 6 user flows rewritten to match current implementation
  - Task breakdown phases marked as complete with accurate feature descriptions
  - Risks/mitigations and third-party dependencies corrected

  **CLAUDE.md:**
  - Removed broken reference to non-existent `docs/EXTRACTION_PLAYBOOK.md`
  - Replaced with inline tag list

  **USER_GUIDE.md:**
  - Fixed "Category" field → "Tags" with multi-tag instructions
  - Fixed "grouped by category" → "grouped by primary tag"

  **HISTORY.md:**
  - Removed stale "Starting balance of R45,000" reference

  **Code Comments:**
  - Fixed ExpensesTab.vue decision doc: "category"/"budget" → "primary tag"/"workspace"

  **AI_MISTAKES.md:**
  - Populated with 6 significant past bugs and prevention strategies

  **Completed TODO items moved here:**
  - Fix broken CLAUDE.md reference to docs/EXTRACTION_PLAYBOOK.md
  - Update PRODUCT_DEFINITION.md data model to reflect workspace rename, v5 schema, and tags migration
  - Update PRODUCT_DEFINITION.md tech stack — remove Fuse.js and ApexCharts, add marked

## 2026-03-02

- **Code Review Audit — Bug Fixes and Quality Improvements:**

  **Bug Fix:**
  - Fixed prop mutation in ImportStepReview.vue — `toggleApproval`, `reassignExpense`, `approveAll` now emit events to parent (ImportWizardView) instead of mutating props directly

  **Timer Leak Fixes:**
  - ExpenseForm.vue: `handleTagBlur` setTimeout now tracked and cleared on unmount
  - HelpDrawer.vue: `handleClose` animation timeout now tracked and cleared on unmount
  - DebugPill.vue: `copyReport` feedback timeout now tracked and cleared on unmount
  - useTagAutocomplete.ts: debounce timer now cleared on unmount via `onUnmounted`

  **Performance:**
  - variance.ts: replaced `expenses.find()` inside loop (O(n²)) with `expenseById` Map lookup (O(n))

  **Error Handling:**
  - ProjectedTab: wrapped `calculateProjection` computed in try-catch with user-facing error message

  **Documentation:**
  - Added TODO items for broken EXTRACTION_PLAYBOOK.md reference and stale PRODUCT_DEFINITION.md tech stack

  **Verification:**
  - 76 tests pass, build succeeds, type-check clean

- **Replace Balance with Ephemeral Cash Input:**

  **Concept Change:**
  - Removed persisted `startingBalance` from Workspace model — balance is no longer stored
  - Added ephemeral "Cash on hand" input to Forecast tab — user enters cash amount to see how long it lasts
  - Cash input walks month-by-month through the projection to calculate depletion (accounts for varying monthly costs from quarterly/annual expenses)
  - Shows: "Runs out in [Month]", "Cash is growing", or "Lasts all [N] months"

  **Removed:**
  - Cashflow tab (CashflowTab.vue) — running balance timeline + chart
  - Cashflow engine (engine/cashflow.ts + tests) — running balance calculation
  - Envelope engine (engine/envelope.ts + tests) — budget depletion tracking
  - Balance input from WorkspaceForm (checkbox + amount field)
  - Envelope summary from CompareTab
  - `startingBalance` from demo workspace data

  **Updated:**
  - Export/import: strips `startingBalance` and `totalBudget` from imported workspaces (backward compat)
  - Tab navigation: 4 tabs → 3 tabs (Expenses, Forecast, Compare)
  - All documentation (USER_GUIDE, TESTING_GUIDE, README)

  **Verification:**
  - 76 tests pass, build succeeds, type-check clean
  - No DB migration needed — unused `startingBalance` field on old records is harmless

- **Multi-Tag Migration (category → tags):**

  **Data Model:**
  - `Expense.category: string` → `Expense.tags: string[]` across entire codebase
  - `Actual.category: string` → `Actual.tags: string[]`
  - Renamed `CategoryCache` → `TagCache` (field `category` → `tag`)
  - Added `CategoryMapping` interface for learned description→tags patterns from imports
  - Added `primaryTag(tags: string[]): string` helper — returns first tag or 'Uncategorised'

  **DB Migration v5:**
  - Converts `category` string → single-element `tags` array on all expenses and actuals
  - Migrates `categoryCache` → `tagCache`, deletes old table
  - New `categoryMappings` table with `id, workspaceId, pattern` indexes
  - `*tags` multiEntry index on expenses and actuals for efficient tag queries

  **Engine Updates:**
  - projection.ts: `ProjectedRow.tags`, category rollup uses `primaryTag()`
  - variance.ts: `LineItemVariance.tags`, `UnbudgetedActual.tags`, grouping via `primaryTag()`
  - matching.ts: `ImportedRow.tags`, `tagsMatch()` for primary tag comparison, `isDuplicate()` for dedup
  - exportImport.ts: Export schema bumped to v2, backward-compatible import (v1 `category` → `tags` array)
  - All test files updated (94 tests pass)

  **UI Changes:**
  - ExpenseForm: multi-tag chip input (Enter/comma to add, Backspace to remove, autocomplete from tagCache)
  - ExpensesTab: groups by primaryTag, shows secondary tags as small chips
  - ImportStepMapping: auto-tagging from CategoryMappings, duplicate detection
  - ImportStepReview: multi-tag create form, duplicate count info banner
  - Demo data uses multi-tag arrays (e.g., `['Income', 'FNB Cheque']`, `['Food', 'Discretionary']`)

  **Cleanup:**
  - Removed `useCategoryAutocomplete.ts` (replaced by `useTagAutocomplete.ts`)

  **Verification:**
  - All 94 tests pass, build succeeds, type-check clean
  - DB schema now at v5

## 2026-02-26

- **Renamed Budget → Workspace + Demo Workspace:**

  **Entity Rename (Budget → Workspace):**
  - Renamed `Budget` type to `Workspace`, `budgetId` to `workspaceId` throughout codebase (600+ references)
  - Added `isDemo: boolean` field to Workspace model
  - DB migration v4: creates `workspaces` table, migrates data from `budgets`, renames foreign keys, deletes old table
  - Renamed 5 view files via git mv (BudgetListView → WorkspaceListView, etc.)
  - Updated all routes: `/budget/` → `/workspace/`, `budget-*` → `workspace-*`
  - Renamed engine functions: `exportBudget` → `exportWorkspace`, `resolveBudgetPeriod` → `resolveWorkspacePeriod`
  - Backward-compatible import: accepts both `workspace` and `budget` keys, both `workspaceId` and `budgetId`
  - Kept financial terms as-is: "budgeted", "unbudgeted", "over/under budget" (standard accounting language)

  **Demo Workspace:**
  - New `src/db/demoData.ts` — seeds "Demo Household" workspace on first visit (empty DB)
  - 16 realistic SA Rand-denominated items: salary (R25k), freelance (R5k), rent (R12k), groceries (R4.5k), etc.
  - Monthly period type
  - Non-blocking `seedDemoWorkspace()` call in main.ts
  - Uses `isDemo: true` flag and deterministic ID (`demo-household`)

  **Documentation:**
  - Updated all docs (USER_GUIDE, TESTING_GUIDE, README, SESSION_NOTES, HISTORY, TODO) to workspace terminology
  - Added demo workspace test scenario (1.9)

  **Verification:**
  - All 94 tests pass, build succeeds, type-check clean
  - DB schema now at v4

- **Codebase Review — Implemented 24 UX & Code Quality Improvements:**

  **New Components:**
  - `ToastNotification.vue` + `useToast.ts` — singleton toast system with success/error/warning variants, auto-dismiss, integrated across all CRUD actions
  - `ScrollHint.vue` — ResizeObserver-based fade gradient for horizontally scrollable tables
  - `DateInput.vue` — date input wrapper with calendar icon for mobile discoverability
  - `useFormValidation.ts` — shared validation composable with `required()`, `positiveNumber()`, `dateAfter()` rule factories

  **Component Extractions:**
  - Split CompareTab (~460 lines) into 3 sub-components: `CompareLineItems.vue`, `CompareCategories.vue`, `CompareMonthly.vue`
  - Extracted form validation from BudgetForm + ExpenseForm into shared composable

  **Mobile UX:**
  - Touch targets: header menu 32→40px, expense buttons p-1.5→p-2.5
  - Tab bar: added overflow-x-auto for horizontal scroll on narrow screens
  - Budget detail: replaced 4 inline buttons with Import CTA + kebab overflow menu
  - HelpDrawer: added 2rem left margin for backdrop peek-through on mobile
  - Scroll hints on ProjectedTab and CashflowTab tables
  - Text size bump: text-[10px]→text-xs, text-xs→text-sm for readability

  **UX Improvements:**
  - Budget list: summary line (period, currency, item count, monthly total) under each budget
  - Expense search filter (visible when ≥5 items)
  - Compare tab empty state: "Import bank statement" guidance
  - Cashflow empty state: "Set starting balance" button linking to budget edit
  - Tab renames: "Projected"→"Forecast", "Cashflow"→"Balance"
  - Label renames: "Run matching"→"Find matches", "By Item"→"Each item", "By Category"→"Group by category"

  **Technical:**
  - Autocomplete debounce reduced from 150ms to 80ms
  - Toast calls integrated into BudgetCreateView, BudgetEditView, ExpenseCreateView, ExpenseEditView, BudgetDetailView, ExpensesTab, BudgetListView

- **Completed TODO items moved here:**
  - Add success toast/notification after actions (create, import, export)

## 2026-02-25

- **Import Review — Create New Income/Expense:**
  - Added "Create new..." option to the reassign dropdown on each import review row
  - Modal form with type toggle (income/expense), description, category, amount, frequency
  - Pre-fills from imported row data (description, category, amount, originalSign → type hint)
  - Creates expense in DB immediately, adds to local list, auto-assigns to the import row
  - ImportStepReview emits `create-expense` → ImportWizardView handles DB save + state update

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
  - Fixed localStorage key naming inconsistency (tutorial now uses `farlume:` prefix like PWA install)
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
