# Farlume

## Product Definition

Farlume is a local-first progressive web app for planning and tracking household cashflow. Users create workspaces for different spending plans, capture once-off or recurring income and expense lines, import actual spend data from CSV or JSON files, and compare projected versus actual spend with automated matching and visual reporting.

All data lives on-device using IndexedDB. No authentication, no server. Exportable as JSON for backup or re-import.

### Technical Stack

- **Framework:** Vue 3 (Composition API) + Vite
- **PWA:** vite-plugin-pwa (Workbox)
- **Styling:** UnoCSS (Tailwind-compatible preset)
- **Storage:** Dexie.js v4 (IndexedDB wrapper)
- **Markdown rendering:** marked (for in-app help content)
- **Language:** TypeScript

### Stack Justification

- **Vue 3 over React/Svelte:** First-class Vite integration (Vite was built by Vue's creator). Composition API provides clean separation for data-heavy logic. Larger ecosystem than Svelte for component libraries if needed later. Opinionated conventions reduce decision overhead.
- **UnoCSS over Tailwind:** Tailwind-compatible class names (zero relearning) with significantly faster build times. On-demand engine only generates used CSS. Smaller output for PWA bundle size.
- **Dexie.js over raw IndexedDB:** Typed, Promise-based API. Built-in indexing and querying that raw IndexedDB makes painful. ~25 KB gzipped. Handles schema migrations cleanly as the data model evolves.
- **Custom matching over Fuse.js:** Levenshtein distance implementation provides the confidence levels needed for the 3-pass auto-match system without an external dependency. Fuse.js may be added later if more sophisticated fuzzy matching is needed.
- **CSS bar charts over ApexCharts:** Comparison views use simple CSS-based proportional bars for category and monthly visualizations. Keeps the bundle small. ApexCharts may be added later for richer interactive charts.
- **marked over custom rendering:** ~5 KB gzipped. Renders markdown help content (User Guide, Testing Guide, Import Format) in the HelpDrawer component. Build-time `?raw` imports keep markdown in the source tree.

---

## Use Cases and User Flows

### Flow 1: Create a Workspace

**Goal:** Set up a named workspace with a defined period.

1. User opens the app, sees a list of existing workspaces (demo workspace pre-populated on first visit)
2. User taps "New Workspace"
3. User enters:
   - Workspace name (required)
   - Currency label (display only, default "R")
   - Period type: monthly (default) or custom date range
   - If custom: start date and end date
4. Workspace is created and user lands on the workspace detail view (empty expense list)

**Data created:** Workspace record with id, name, currency label, period type, start date, end date, isDemo flag, created timestamp.

---

### Flow 2: Add Expense Lines

**Goal:** Capture planned income or expenses within a workspace.

1. User is on a workspace detail view, Expenses tab
2. User taps "Add Item"
3. User enters:
   - Type: income or expense (toggle)
   - Description (required, free text)
   - Tags (multi-tag input with autocomplete from previously used tags across all workspaces). Press Enter or comma to add a tag, Backspace to remove
   - Amount (required, numeric, always positive)
   - Frequency: once-off, daily, weekly, monthly, quarterly, annually
   - Start date (required, defaults to workspace start date)
   - End date (optional)
4. Expense line is saved and appears in the workspace's expense list, grouped by primary tag
5. User can edit or delete any expense line

**Data created:** Expense record linked to workspace id with all fields above plus a generated id, type (income/expense), and created timestamp.

**Tag autocomplete behaviour:**
- Queries tagCache table in IndexedDB (indexed prefix matching via Dexie `startsWithIgnoreCase`)
- Falls back to substring matching for remaining suggestion slots
- 80ms debounce, max 10 suggestions
- User can always enter a new tag not in the list

---

### Flow 3: View Projected Spend

**Goal:** See what the workspace projects over its period.

1. User is on a workspace detail view, Forecast tab
2. The view shows:
   - Monthly breakdown table: each month as a column, each expense line as a row, with calculated amounts based on frequency
   - Toggle between "Each item" and "Group by tag" views
   - Income section (green) and Expenses section, with Net totals when income items exist
   - Cash on hand input: enter current cash to see how long it lasts (ephemeral, not stored)
   - Grand total row and per-month totals
3. Recurring expenses are expanded into their monthly amounts based on frequency and date range
4. Once-off expenses appear in the month of their start date

**Cash on hand calculation:** Walks month-by-month through the projection, subtracting net costs. Reports "Runs out in [month]", "Cash is growing", or "Lasts all [N] months — R[amount] remaining".

**Calculation logic for recurring expansion:**
- Daily: amount × days in that month (within start/end bounds, using Date objects for correct boundary handling)
- Weekly: amount × weeks overlapping that month
- Monthly: amount × 1 (if month falls within start/end)
- Quarterly: amount if the month is a quarter boundary from start date
- Annually: amount if the month matches the anniversary month

---

### Flow 4: Import Actuals

**Goal:** Upload real spend data to compare against workspace projections.

This is a multi-step wizard:

**Step 1 — File Upload**
1. User taps "Import"
2. User selects a CSV or JSON file (max 10 MB)
3. App parses the file (custom RFC 4180 CSV parser or JSON array-of-objects) and shows a preview of the first few rows

**Step 2 — Column Mapping**
1. App auto-detects columns/fields from the file
2. User maps source columns to required fields:
   - Date (required)
   - Amount (required)
   - Category or Description (at least one required)
   - Any unmapped columns are ignored
3. User sets the date format if auto-detection is wrong
4. App validates the mapping (checks for parseable dates, numeric amounts)
5. Preview of first 5 mapped rows shown

**Step 3 — Auto-Matching**
1. App runs the three-pass matching algorithm against workspace expense lines:
   - **Pass 1 — High confidence:** Exact tag match + exact amount match + type-compatible → auto-approved
   - **Pass 2 — Medium confidence:** Fuzzy description/tag match (Levenshtein distance) + exact amount → flagged for review
   - **Pass 3 — Low confidence:** Amount-only match within the same month → flagged for review
   - **Unmatched:** No match found → flagged for manual assignment
2. Results displayed as a paginated table (50 per page):
   - Each row shows: actual item, matched expense (if any), confidence badge, approval status
   - High confidence rows show as auto-approved (green)
   - Medium and low confidence rows require manual approval
   - Unmatched rows show a dropdown to assign to an existing expense or mark as unbudgeted
   - User can select "+ Create new..." to create a new expense from the import row
3. Bulk actions: "Approve all likely" (high), "Approve all possible" (high + medium)
4. User reviews and confirms all assignments

**Step 4 — Confirmation**
1. Summary showing: total rows imported, auto-matched count, manually approved count, unbudgeted count
2. User clicks "Import [N] rows"
3. Actuals are saved and linked to the workspace

**Data created:** Actual records linked to workspace id, each with: original row data, mapped date, mapped amount, mapped tags/description, matched expense line id (nullable), match confidence, approval status.

---

### Flow 5: Compare Budget vs Actuals

**Goal:** See variance between planned and actual spend.

1. User navigates to the Compare tab on a workspace detail view
2. Summary bar shows: Budgeted total, Actual total, Variance (red if over, green if under)
3. Three comparison views are available via toggle buttons:

**Line Items** — Each expense as a row:
- Columns: expense name, budgeted, actual, variance (amount), variance (%)
- Red = over budget, green = under budget, with text labels ("Over"/"Under") for colorblind accessibility
- Unbudgeted actuals shown in a separate section below

**Categories** — Grouped by primary tag:
- Same columns as line items but summed per tag
- CSS bar chart below: proportional bars showing budgeted vs actual per category
- Legend: blue = budgeted, green = under budget, red = over budget

**Monthly** — Each month as a row:
- Columns: month, projected, actual, variance (amount), variance (%)
- Dimmed rows for months with no actual data yet
- CSS bar chart below: proportional bars for projected vs actual per month

**Variance calculation:**
- Variance amount = actual − budgeted (positive = overspend, negative = underspend)
- Variance % = (variance amount / budgeted) × 100
- Rounding tolerance: 0.005 (half-cent)
- Income actuals excluded from variance calculations (expense-only)

---

### Flow 6: Export

**Goal:** Back up or share workspace data.

1. User taps "Export" (download icon) on a workspace detail view
2. App generates a JSON file containing:
   - Workspace metadata
   - All expense lines
   - All imported actuals with their match assignments
   - Comparison snapshot (calculated, included for convenience)
3. File downloads with naming convention: `farlume-{workspace-name}-{date}.json`

**Re-import:** Export format is backward-compatible. Import validates schema version, handles v1→v2 field mapping (budget→workspace, category→tags), and supports replace mode for existing workspaces.

---

## MVP Roadmap

### Data Model

```
Workspace
├── id: string (UUID)
├── name: string
├── currencyLabel: string (default "R")
├── periodType: "monthly" | "custom"
├── startDate: string (ISO date)
├── endDate: string (ISO date, nullable for monthly)
├── isDemo: boolean
├── createdAt: string (ISO datetime)
└── updatedAt: string (ISO datetime)

Expense
├── id: string (UUID)
├── workspaceId: string (FK → Workspace.id)
├── description: string
├── tags: string[] (multi-tag, first tag = primary)
├── amount: number
├── frequency: "once-off" | "daily" | "weekly" | "monthly" | "quarterly" | "annually"
├── type: "income" | "expense"
├── startDate: string (ISO date)
├── endDate: string (ISO date, nullable)
├── createdAt: string (ISO datetime)
└── updatedAt: string (ISO datetime)

Actual
├── id: string (UUID)
├── workspaceId: string (FK → Workspace.id)
├── expenseId: string (FK → Expense.id, nullable — null if unbudgeted)
├── date: string (ISO date)
├── amount: number
├── tags: string[] (mapped from import)
├── description: string (mapped from import)
├── originalRow: object (raw data from CSV/JSON)
├── matchConfidence: "high" | "medium" | "low" | "manual" | "unmatched"
├── approved: boolean
├── createdAt: string (ISO datetime)
└── updatedAt: string (ISO datetime)

TagCache (derived, for autocomplete performance)
├── tag: string (indexed, unique)
└── lastUsed: string (ISO datetime)

CategoryMapping (learned description→tags patterns from imports)
├── id: string (UUID)
├── workspaceId: string (FK → Workspace.id)
├── pattern: string (indexed)
└── tags: string[]
```

**Dexie schema definition (v5):**

```typescript
db.version(5).stores({
  workspaces: 'id, name, createdAt',
  expenses: 'id, workspaceId, *tags, type, createdAt',
  actuals: 'id, workspaceId, expenseId, *tags, date',
  tagCache: 'tag, lastUsed',
  categoryMappings: 'id, workspaceId, pattern'
});
```

**Migrations:** v1 (initial schema) → v2 (add totalBudget) → v3 (cashflow pivot: rename totalBudget→startingBalance, add expense type) → v4 (rename budgets→workspaces, budgetId→workspaceId) → v5 (category→tags migration, categoryCache→tagCache, add categoryMappings).

**IndexedDB indexes:** workspaceId on expenses and actuals enables efficient per-workspace queries. `*tags` multiEntry index on expenses and actuals supports tag queries. Date index on actuals enables monthly rollup queries.

---

### Task Breakdown

All phases are **complete**. Preserved here as architectural reference.

#### Phase 0: Project Scaffolding — COMPLETE

- Vite + Vue 3 + TypeScript project
- UnoCSS with Tailwind preset
- vite-plugin-pwa (service worker, manifest, icons)
- Dexie.js with schema (now at v5)
- Base layout component (AppLayout with burger menu)
- Vue Router with lazy-loaded routes
- Build and dev scripts configured

#### Phase 1: Workspace Management — COMPLETE

- Workspace list view with demo workspace badge, summary lines
- Create/edit workspace form (name, currency, period type, custom dates)
- Workspace detail view with 3 tabs (Expenses, Forecast, Compare)
- Delete workspace with cascade confirmation
- Export workspace as JSON, restore from backup

#### Phase 2: Expense Management — COMPLETE

- Expense list grouped by primary tag with edit/delete per item
- Add/edit expense form with multi-tag input, type toggle (income/expense), 6 frequency options
- Tag autocomplete from IndexedDB tagCache (80ms debounce, prefix + substring matching)
- Income items tagged with green badge, separate monthly summary

#### Phase 3: Projection Engine — COMPLETE

- Pure TypeScript projection module (all 6 frequency types)
- Projected spend view with "Each item" and "Group by tag" toggle
- Income/expense/net sections with monthly totals
- Cash on hand ephemeral input with depletion calculation
- Horizontally scrollable table with ScrollHint gradient

#### Phase 4: Import Wizard — COMPLETE

- 4-step wizard (Upload → Mapping → Review → Complete)
- Custom RFC 4180 CSV parser + JSON import handler
- Column auto-detection and manual mapping
- 3-pass matching engine (tag match, Levenshtein fuzzy, amount-only)
- Paginated review (50/page) with approve/reassign/create-new per row
- Bulk approve actions, duplicate detection

#### Phase 5: Comparison Views — COMPLETE

- Variance calculation module (pure TypeScript, expense-only)
- Line item, category, and monthly comparison views
- CSS proportional bar charts (no charting library)
- Colorblind-safe text labels alongside color indicators
- Unbudgeted actuals section

#### Phase 6: Export and Data Management — COMPLETE

- Export workspace + expenses + actuals + comparison snapshot as JSON (schema v2)
- Restore from backup with schema validation and v1→v2 backward compatibility
- Workspace-level delete with cascade

#### Phase 7: PWA Polish and Offline — COMPLETE

- Service worker with precache (prompt mode, 60-min update checks)
- Browser-specific install detection (Chrome/Edge/Brave native, Safari/Firefox manual instructions)
- `beforeinstallprompt` race condition fix (inline script + composable)
- App icons generated from SVG source (512, 192, 180, 32px)
- Install analytics tracking in localStorage
- Offline-ready notification (auto-dismiss 3s)

---

### Risks and Mitigations

**CSV parsing edge cases**
- Risk: User uploads CSVs with inconsistent encoding, mixed delimiters, or malformed rows
- Impact: Import wizard crashes or produces garbage data
- Mitigation: Custom RFC 4180 parser handles quoted fields, escaped quotes, CRLF/LF. Row-level error reporting. Skipped rows shown as warning. Papa Parse may be added later for multi-line quoted field support.

**Fuzzy matching quality**
- Risk: Fuzzy matching produces too many false positives or misses obvious matches
- Impact: User loses trust in auto-matching, manually overrides everything
- Mitigation: Levenshtein distance provides normalized 0–1 scoring. The manual approval step on medium/low confidence acts as a safety net. Fuse.js may be added later for more sophisticated matching.

**IndexedDB storage limits**
- Risk: Browsers impose per-origin storage limits. Safari is more aggressive with eviction on iOS.
- Impact: Data loss on iOS Safari if user doesn't export regularly
- Mitigation: Export/restore functionality. PWA installed to home screen gets more generous storage on iOS.

**Recurring expense calculation precision**
- Risk: Edge cases in date boundary logic (leap years, months with different day counts)
- Impact: Projected amounts slightly wrong
- Mitigation: Date object-based `daysBetween()` helper for daily/weekly calculations. Comprehensive unit tests for every frequency type. All dates stored as ISO strings without timezone.

**Mobile performance with large datasets**
- Risk: 500+ expense lines or 1000+ actual rows cause sluggish UI on mid-range phones
- Impact: Poor user experience, especially in comparison views
- Mitigation: Import review pagination (50/page). Debounced recalculations. Future: virtual scrolling for long lists (vue-virtual-scroller).

---

### Third-Party Dependencies

- **Dexie.js** — IndexedDB wrapper. Apache 2.0 license. ~25 KB gzipped.
- **vite-plugin-pwa** — PWA support. MIT license.
- **marked** — Markdown rendering. MIT license. ~5 KB gzipped.

**Not used (planned originally, deferred or replaced):**
- Papa Parse — deferred, using custom CSV parser (handles most finance CSV formats)
- Fuse.js — replaced by custom Levenshtein distance implementation
- ApexCharts — replaced by CSS proportional bar charts
- date-fns — replaced by native Date objects with helper functions

---

### Deployment

- **Hosting:** Vercel (free tier, sufficient for static PWA)
- **Build:** `vite build` produces static assets
- **CI/CD:** Vercel auto-deploys on push to `main`
- **Custom domain:** Optional, Vercel supports it
- **SSL:** Automatic via Vercel (required for PWA service worker)

---

### Security Considerations

- No authentication, no server, no transmitted data — attack surface is minimal
- CSV/JSON import is the only external data ingestion point
  - Sanitize all imported strings before rendering (Vue's template binding handles this by default, avoid v-html)
  - Validate numeric fields are actually numeric before storage
  - Limit file upload size (10 MB cap) to prevent browser memory issues
- IndexedDB data is unencrypted on device
  - Acceptable for MVP since this is personal budget data, not financial credentials
  - Document that anyone with device access can read the data
- Export JSON could contain sensitive budget information
  - No mitigation needed for MVP beyond user awareness

---

### Future Considerations (Post-MVP)

These are explicitly out of scope for MVP but inform architectural decisions:

- **Multi-currency support:** currencyLabel field is already on Workspace. Future work adds conversion rates and display logic, no schema change needed.
- **Supabase sync:** Data model is designed to be sync-friendly (UUIDs as IDs, timestamps on all records). Adding sync later means adding a Supabase backend and conflict resolution, but the local-first model stays intact.
- **Authentication:** Required if sync is added. Supabase Auth slots in cleanly.
- **Shared workspaces:** Requires sync + auth + permissions. Schema already supports it (workspaces are independent entities).
- **Templates:** Predefined expense sets for common project types. Would be a new collection in IndexedDB with export/import support.
- **Multi-workspace comparison:** Compare two workspaces side by side. Current comparison engine works per-workspace; this would be a UI layer addition.
- **Charting library:** ApexCharts or Chart.js for richer interactive visualizations in comparison views.
- **Advanced CSV parsing:** Papa Parse for multi-line quoted fields, custom delimiters, encoding detection.
