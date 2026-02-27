# budgy-ting

## Product Definition

budgy-ting is a local-first progressive web app for planning and tracking expenses against budgets. Users capture planned costs as once-off or recurring line items, import actual spend data from CSV or JSON files, and compare projected versus actual spend with automated matching and visual reporting.

All data lives on-device using IndexedDB. No authentication, no server. Exportable as JSON for backup or re-import.

### Technical Stack

- **Framework:** Vue 3 (Composition API) + Vite
- **PWA:** vite-plugin-pwa (Workbox)
- **Styling:** UnoCSS (Tailwind-compatible preset)
- **Storage:** Dexie.js (IndexedDB wrapper)
- **Charts:** ApexCharts (vue3-apexcharts)
- **Fuzzy matching:** Fuse.js
- **Language:** TypeScript

### Stack Justification

- **Vue 3 over React/Svelte:** First-class Vite integration (Vite was built by Vue's creator). Composition API provides clean separation for data-heavy logic. Larger ecosystem than Svelte for component libraries if needed later. Opinionated conventions reduce decision overhead.
- **UnoCSS over Tailwind:** Tailwind-compatible class names (zero relearning) with significantly faster build times. On-demand engine only generates used CSS. Smaller output for PWA bundle size.
- **Dexie.js over raw IndexedDB:** Typed, Promise-based API. Built-in indexing and querying that raw IndexedDB makes painful. ~25 KB gzipped. Handles schema migrations cleanly as the data model evolves.
- **Fuse.js over custom matching:** ~5 KB gzipped. Configurable threshold scoring gives the confidence levels needed for the auto-match system. Well-maintained (weekly npm downloads >1.5M).
- **ApexCharts over Chart.js:** Better default styling. Vue 3 wrapper is actively maintained. Built-in responsive/interactive features reduce custom work for comparison views.

---

## Use Cases and User Flows

### Flow 1: Create a Budget

**Goal:** Set up a named budget with a defined period.

1. User opens the app, sees a list of existing budgets (empty on first use)
2. User taps "New Budget"
3. User enters:
   - Budget name (required)
   - Currency label (display only, default "R")
   - Period type: monthly (default) or custom date range
   - If custom: start date and end date
4. Budget is created and user lands on the budget detail view (empty expense list)

**Data created:** Budget record with id, name, currency label, period type, start date, end date, created timestamp.

---

### Flow 2: Add Expense Lines

**Goal:** Capture planned costs within a budget.

1. User is on a budget detail view
2. User taps "Add Expense"
3. User enters:
   - Description (required, free text)
   - Category (required, free text with autocomplete from previously used categories across all budgets)
   - Amount (required, numeric)
   - Frequency: once-off, daily, weekly, monthly, quarterly, annually
   - Start date (required, defaults to budget start date)
   - End date (optional, defaults to budget end date if not set)
4. Expense line is saved and appears in the budget's expense list
5. User can edit or delete any expense line

**Data created:** Expense record linked to budget id with all fields above plus a generated id and created timestamp.

**Category autocomplete behaviour:**
- Queries all distinct category values across all budgets in IndexedDB
- Filters as user types, case-insensitive
- User can always enter a new value not in the list

---

### Flow 3: View Projected Spend

**Goal:** See what the budget projects over its period.

1. User is on a budget detail view
2. A "Projected" tab/section shows:
   - Monthly breakdown table: each month within the budget period as a column, each expense line as a row, with calculated amounts based on frequency
   - Category rollup: grouped totals per category per month
   - Total row: sum per month and grand total
3. Recurring expenses are expanded into their monthly amounts based on frequency and date range
4. Once-off expenses appear in the month of their start date

**Calculation logic for recurring expansion:**
- Daily: amount × days in that month (within start/end bounds)
- Weekly: amount × weeks overlapping that month
- Monthly: amount × 1 (if month falls within start/end)
- Quarterly: amount if the month is a quarter boundary from start date
- Annually: amount if the month matches the anniversary month

---

### Flow 4: Import Actuals

**Goal:** Upload real spend data to compare against budget projections.

This is a multi-step wizard:

**Step 1 — File Upload**
1. User taps "Import Actuals"
2. User selects a CSV or JSON file
3. App parses the file and shows a preview of the first 5 rows

**Step 2 — Column Mapping**
1. App detects columns/fields from the file
2. User maps source columns to required fields:
   - Date (required)
   - Amount (required)
   - Category or Description (at least one required)
   - Any unmapped columns are ignored
3. User sets the date format if auto-detection fails
4. App validates the mapping (checks for parseable dates, numeric amounts)

**Step 3 — Auto-Matching**
1. App runs the three-pass matching algorithm against budget expense lines:
   - **Pass 1 — High confidence:** Exact category match + exact amount match → auto-approved
   - **Pass 2 — Medium confidence:** Fuzzy description/category match (Fuse.js score ≤ 0.3) + exact amount → flagged for review
   - **Pass 3 — Low confidence:** Amount-only match within the same month, no category/description match → flagged for review
   - **Unmatched:** No match found → flagged for manual assignment
2. Results displayed as a table:
   - Each row shows: actual item, matched budget line (if any), confidence level, approval status
   - High confidence rows show as auto-approved (green)
   - Medium and low confidence rows require manual approval (user approves or reassigns per row)
   - Unmatched rows show a dropdown to manually assign to a budget line or mark as unbudgeted
3. User reviews and confirms all assignments

**Step 4 — Confirmation**
1. Summary showing: total rows imported, auto-approved count, manually approved count, unmatched/unbudgeted count
2. User confirms import
3. Actuals are saved and linked to the budget

**Data created:** Actual records linked to budget id, each with: original row data, mapped date, mapped amount, mapped category/description, matched expense line id (nullable), match confidence, approval status.

---

### Flow 5: Compare Budget vs Actuals

**Goal:** See variance between planned and actual spend.

1. User navigates to the "Compare" tab/section on a budget detail view
2. Three comparison views are available:

**Line Item View**
- Each budget expense line as a row
- Columns: budgeted amount (for period), actual amount (sum of matched actuals), variance (amount), variance (%)
- Unbudgeted actuals shown in a separate section below

**Category View**
- Grouped by category
- Same columns as line item view but summed per category
- Bar chart (ApexCharts): categories on x-axis, budgeted vs actual as grouped bars

**Monthly View**
- Each month within the budget period as a row
- Columns: projected total, actual total, variance (amount), variance (%)
- Months with actuals show comparison; months without show projected-only (greyed or styled differently)
- Line chart (ApexCharts): months on x-axis, two lines (projected and actual)

**Variance calculation:**
- Variance amount = actual − budgeted (positive = overspend, negative = underspend)
- Variance % = (variance amount / budgeted) × 100
- Colour coding: overspend in red, underspend in green, within 5% tolerance in neutral

---

### Flow 6: Export

**Goal:** Back up or share budget data.

1. User taps "Export" on a budget detail view
2. App generates a JSON file containing:
   - Budget metadata
   - All expense lines
   - All imported actuals with their match assignments
   - Comparison results (calculated, not stored, but included for convenience)
3. File downloads with naming convention: `budgy-ting-{budget-name}-{date}.json`

**Re-import consideration:** The export format should be designed so it can be re-imported to restore a budget. This means the JSON schema is the source of truth for data structure.

---

## MVP Roadmap

### Data Model

```
Budget
├── id: string (UUID)
├── name: string
├── currencyLabel: string (default "R")
├── periodType: "monthly" | "custom"
├── startDate: string (ISO date)
├── endDate: string (ISO date, nullable for monthly)
├── createdAt: string (ISO datetime)
└── updatedAt: string (ISO datetime)

Expense
├── id: string (UUID)
├── budgetId: string (FK → Budget.id)
├── description: string
├── category: string
├── amount: number
├── frequency: "once-off" | "daily" | "weekly" | "monthly" | "quarterly" | "annually"
├── startDate: string (ISO date)
├── endDate: string (ISO date, nullable)
├── createdAt: string (ISO datetime)
└── updatedAt: string (ISO datetime)

Actual
├── id: string (UUID)
├── budgetId: string (FK → Budget.id)
├── expenseId: string (FK → Expense.id, nullable — null if unbudgeted)
├── date: string (ISO date)
├── amount: number
├── category: string (mapped from import)
├── description: string (mapped from import)
├── originalRow: object (raw data from CSV/JSON)
├── matchConfidence: "high" | "medium" | "low" | "manual" | "unmatched"
├── approved: boolean
├── createdAt: string (ISO datetime)
└── updatedAt: string (ISO datetime)

CategoryCache (derived, for autocomplete performance)
├── category: string (indexed, unique)
└── lastUsed: string (ISO datetime)
```

**Dexie schema definition:**

```typescript
db.version(1).stores({
  budgets: 'id, name, createdAt',
  expenses: 'id, budgetId, category, createdAt',
  actuals: 'id, budgetId, expenseId, category, date',
  categoryCache: 'category, lastUsed'
});
```

**IndexedDB indexes:** budgetId on expenses and actuals enables efficient per-budget queries. Category index on expenses and actuals supports autocomplete and matching. Date index on actuals enables monthly rollup queries.

---

### Task Breakdown

Tasks are grouped into phases. Each phase builds on the previous. Estimated hours assume a single developer familiar with the stack.

#### Phase 0: Project Scaffolding
**Dependencies:** None
**Estimated effort:** 4–6 hours

- [ ] Init Vite + Vue 3 + TypeScript project
- [ ] Configure UnoCSS with Tailwind preset
- [ ] Configure vite-plugin-pwa (service worker, manifest, icons)
- [ ] Set up Dexie.js with schema v1
- [ ] Create base layout component (shell, navigation)
- [ ] Set up Vue Router (budget list, budget detail with nested tabs)
- [ ] Configure build and dev scripts
- [ ] Init git repo, connect to budgy-ting remote

**Output:** Empty app shell that installs as PWA, navigates between routes, has IndexedDB ready.

---

#### Phase 1: Budget Management
**Dependencies:** Phase 0
**Estimated effort:** 6–8 hours

- [ ] Budget list view (home screen)
  - List all budgets from IndexedDB
  - Empty state with prompt to create first budget
  - Tap to open budget detail
- [ ] Create budget form
  - Name, currency label, period type toggle
  - Custom date range picker (if custom selected)
  - Validation: name required, dates valid
  - Save to IndexedDB
- [ ] Budget detail view (tabbed: Expenses, Projected, Compare)
  - Header with budget name, period, edit/delete actions
  - Tab navigation
- [ ] Edit budget (reuse create form, pre-filled)
- [ ] Delete budget (confirmation prompt, cascades to expenses and actuals)

**Testing requirements:**
- Dexie CRUD operations for budgets
- Form validation (empty name, invalid dates, end before start)
- Cascade delete removes related expenses and actuals
- Period type toggle shows/hides date range picker

---

#### Phase 2: Expense Management
**Dependencies:** Phase 1
**Estimated effort:** 8–10 hours

- [ ] Expense list within budget detail (Expenses tab)
  - Grouped by category
  - Each item shows: description, amount, frequency, date range
  - Edit and delete per item
- [ ] Add expense form
  - Description, category (with autocomplete), amount, frequency selector, start date, end date
  - Category autocomplete: query categoryCache, filter on input, allow new values
  - Validation: description required, category required, amount > 0, start date required
  - Save to IndexedDB, update categoryCache
- [ ] Edit expense (reuse form, pre-filled)
- [ ] Delete expense (confirmation, also removes linked actuals matches)
- [ ] Category autocomplete composable
  - Debounced input query against categoryCache
  - Dropdown with filtered suggestions
  - Select or type new

**Testing requirements:**
- Expense CRUD linked to correct budget
- Category autocomplete populates from cache, accepts new values
- Frequency options all selectable
- Amount validation rejects non-numeric and zero/negative

---

#### Phase 3: Projection Engine
**Dependencies:** Phase 2
**Estimated effort:** 8–10 hours

- [ ] Projection calculation module (pure TypeScript, no UI dependency)
  - Input: list of expenses, budget period (start/end)
  - Output: monthly breakdown with per-expense amounts and totals
  - Handle all frequency types with correct date boundary logic
  - Handle partial months (expense starts mid-month or ends mid-month)
- [ ] Projected spend view (Projected tab)
  - Monthly columns, expense rows, calculated amounts
  - Category rollup section
  - Grand total row
  - Horizontally scrollable on mobile for many months
- [ ] Edge cases:
  - Expense with no end date (runs to budget end)
  - Expense start date before budget start (clamp to budget start)
  - Once-off outside budget period (exclude)
  - Budget with monthly period type (rolling 12 months from creation? or current month? — default: current month forward 12 months)

**Decision needed:** For monthly period type budgets (no custom range), the projected view needs a defined window. Recommend defaulting to current month + 11 months (12-month rolling view). User can adjust this later if needed.

**Testing requirements:**
- Projection module unit tests for every frequency type
- Partial month calculations
- Boundary clamping (expense outside budget period)
- Zero expenses produces empty but valid output
- Large datasets (500+ expense lines) compute within 100 ms

---

#### Phase 4: Import Wizard
**Dependencies:** Phase 2 (needs expenses to exist for matching)
**Estimated effort:** 14–18 hours

This is the most complex phase. Break into sub-tasks:

**Step 1 UI — File Upload (3–4 hours)**
- [ ] File input accepting .csv and .json
- [ ] CSV parsing (use Papa Parse, ~7 KB gzipped, handles edge cases like quoted commas)
- [ ] JSON parsing (validate it's an array of objects)
- [ ] Preview table showing first 5 rows with detected column headers
- [ ] Error handling: invalid file, empty file, unparseable content

**Step 2 UI — Column Mapping (4–5 hours)**
- [ ] Display detected columns as draggable or selectable mapping targets
- [ ] Required targets: Date, Amount
- [ ] Optional targets: Category, Description (at least one required)
- [ ] Date format selector with auto-detection attempt
- [ ] Validation pass: parse all rows with current mapping, show error count
- [ ] Preview of mapped data (first 5 rows transformed)

**Step 3 UI — Auto-Matching (5–6 hours)**
- [ ] Matching engine (pure TypeScript module):
  - Pass 1: exact category + exact amount → high confidence
  - Pass 2: Fuse.js fuzzy match on category/description (threshold ≤ 0.3) + exact amount → medium confidence
  - Pass 3: exact amount match within same month, no text match → low confidence
  - Remaining: unmatched
- [ ] Results table:
  - Columns: actual row summary, matched budget line, confidence badge, action
  - High confidence rows: auto-approved, shown with green indicator, user can override
  - Medium confidence rows: needs approval, approve/reject per row
  - Low confidence rows: needs approval, approve/reject per row
  - Unmatched rows: dropdown to assign to existing expense line or mark as "unbudgeted"
- [ ] Bulk actions: approve all medium, approve all low (optional but speeds up workflow)

**Step 4 UI — Confirmation (2–3 hours)**
- [ ] Summary counts: total, auto-approved, manually approved, unbudgeted, rejected
- [ ] Confirm button saves all approved actuals to IndexedDB
- [ ] Rejected rows are discarded (not saved)
- [ ] Success message with count

**Additional dependency:** Add Papa Parse to the project. ~7 KB gzipped, MIT license, 1M+ weekly npm downloads. Handles CSV edge cases that manual parsing gets wrong.

**Testing requirements:**
- CSV parsing with various delimiters, quoted fields, empty rows
- JSON parsing with nested vs flat structures
- Column mapping validation catches type mismatches
- Matching engine unit tests for each pass with known inputs
- Confidence scoring produces correct levels
- Large import (1000+ rows) completes matching within 500 ms
- Wizard state persists across steps (back button works)

---

#### Phase 5: Comparison Views
**Dependencies:** Phase 3 (projection engine) + Phase 4 (imported actuals)
**Estimated effort:** 10–14 hours

- [ ] Variance calculation module (pure TypeScript)
  - Input: projected monthly data + actuals grouped by expense/category/month
  - Output: variance objects with amount, percentage, direction (over/under)
- [ ] Line item comparison view
  - Table: expense line, budgeted total, actual total, variance amount, variance %
  - Colour coding: red (overspend), green (underspend), neutral (within ±5%)
  - Unbudgeted actuals section below main table
- [ ] Category comparison view
  - Table: same structure as line item but grouped by category
  - Bar chart (ApexCharts): grouped bars per category, budgeted vs actual
- [ ] Monthly comparison view
  - Table: month, projected total, actual total, variance amount, variance %
  - Months without actuals styled as projected-only
  - Line chart (ApexCharts): two lines (projected, actual) across months
- [ ] Chart configuration
  - Responsive sizing for mobile
  - Tooltip showing exact values
  - Colour palette: projected in blue, actual in orange, variance indicators in red/green

**Testing requirements:**
- Variance calculations with known inputs
- Zero budget line with actuals (infinite % — display as "N/A" or "New")
- Budget line with zero actuals (show as -100%)
- Charts render with empty data (empty state, not crash)
- Charts resize correctly on viewport change

---

#### Phase 6: Export and Data Management
**Dependencies:** Phase 5
**Estimated effort:** 4–6 hours

- [ ] Export function
  - Serialize budget + expenses + actuals + comparison snapshot to JSON
  - File naming: `budgy-ting-{budget-name}-{YYYY-MM-DD}.json`
  - Trigger browser download
- [ ] Import from export (restore)
  - Accept a budgy-ting JSON export file
  - Validate schema version
  - Option to merge or replace existing budget with same name
  - Confirmation before overwrite
- [ ] Data management
  - Clear all data option (settings or budget list)
  - Storage usage indicator (approximate IndexedDB size)

**JSON export schema:**
```json
{
  "version": 1,
  "exportedAt": "ISO datetime",
  "budget": { },
  "expenses": [ ],
  "actuals": [ ],
  "comparison": {
    "lineItems": [ ],
    "categories": [ ],
    "monthly": [ ]
  }
}
```

**Testing requirements:**
- Export produces valid JSON matching schema
- Re-import of exported file recreates identical data
- Schema version mismatch shows helpful error
- Large export (1000+ actuals) completes within 1 second

---

#### Phase 7: PWA Polish and Offline
**Dependencies:** Phase 0 (PWA configured), all other phases complete
**Estimated effort:** 4–6 hours

- [ ] Service worker caching strategy (precache app shell, runtime cache for nothing since no API)
- [ ] Offline indicator (subtle, since app is always offline-capable)
- [ ] Install prompt handling (custom "Add to Home Screen" banner)
- [ ] App icons (multiple sizes for manifest)
- [ ] Splash screen configuration
- [ ] Test on mobile browsers (Chrome Android, Safari iOS)
- [ ] Verify IndexedDB persistence across app restarts and updates
- [ ] Handle service worker updates (prompt user to refresh)

---

### Dependency Graph

```
Phase 0 (Scaffolding)
  └── Phase 1 (Budget CRUD)
        └── Phase 2 (Expense CRUD + Autocomplete)
              ├── Phase 3 (Projection Engine)
              └── Phase 4 (Import Wizard)
                    └── Phase 5 (Comparison Views) ← also depends on Phase 3
                          └── Phase 6 (Export)
Phase 7 (PWA Polish) ← can run partially in parallel from Phase 0 onward, final pass after Phase 6
```

Phase 3 and Phase 4 can be developed in parallel after Phase 2 is complete.

---

### Effort Summary

| Phase | Estimated Hours | Buffer (25%) | Total |
|-------|----------------|-------------|-------|
| 0 — Scaffolding | 4–6 | 1.5 | 5.5–7.5 |
| 1 — Budget CRUD | 6–8 | 2 | 8–10 |
| 2 — Expense CRUD | 8–10 | 2.5 | 10.5–12.5 |
| 3 — Projection | 8–10 | 2.5 | 10.5–12.5 |
| 4 — Import Wizard | 14–18 | 4.5 | 18.5–22.5 |
| 5 — Comparison | 10–14 | 3.5 | 13.5–17.5 |
| 6 — Export | 4–6 | 1.5 | 5.5–7.5 |
| 7 — PWA Polish | 4–6 | 1.5 | 5.5–7.5 |

**Total estimated range: 77–97 hours**

---

### Risks and Mitigations

**CSV parsing edge cases**
- Risk: User uploads CSVs with inconsistent encoding, mixed delimiters, or malformed rows
- Impact: Import wizard crashes or produces garbage data
- Mitigation: Papa Parse handles most edge cases. Add a validation pass after parsing that reports row-level errors. Allow user to skip bad rows rather than failing the entire import.

**Fuse.js matching quality**
- Risk: Fuzzy matching produces too many false positives or misses obvious matches due to threshold tuning
- Impact: User loses trust in auto-matching, manually overrides everything (defeating the purpose)
- Mitigation: Start with threshold 0.3 (fairly strict). Log match scores during development to calibrate. The manual approval step on medium/low confidence acts as a safety net. Consider allowing user to adjust sensitivity in a future iteration.

**IndexedDB storage limits**
- Risk: Browsers impose per-origin storage limits (typically 50–80% of available disk, but varies). Safari is more aggressive with eviction on iOS.
- Impact: Data loss on iOS Safari if user doesn't export regularly
- Mitigation: Show storage usage indicator. Prompt export when usage exceeds 50 MB. Document Safari's limitations in app. PWA installed to home screen gets more generous storage on iOS.

**Recurring expense calculation precision**
- Risk: Edge cases in date boundary logic (leap years, months with different day counts, timezone-related off-by-one errors)
- Impact: Projected amounts slightly wrong, undermining comparison accuracy
- Mitigation: Use date-fns for all date calculations (handles these edge cases). Comprehensive unit tests for every frequency type across year boundaries. All dates stored as ISO strings without timezone.

**Mobile performance with large datasets**
- Risk: 500+ expense lines or 1000+ actual rows cause sluggish UI on mid-range phones
- Impact: Poor user experience, especially in comparison views and charts
- Mitigation: Virtual scrolling for long lists (vue-virtual-scroller). Debounce recalculations. Memoize projection and variance computations. Charts limited to visible data range.

---

### Third-Party Dependencies

- **Papa Parse** — CSV parsing. MIT license. ~7 KB gzipped. 1.5M+ weekly npm downloads.
- **Fuse.js** — Fuzzy search. Apache 2.0 license. ~5 KB gzipped. 1.5M+ weekly npm downloads.
- **Dexie.js** — IndexedDB wrapper. Apache 2.0 license. ~25 KB gzipped. 300K+ weekly npm downloads.
- **vue3-apexcharts** — Vue 3 charting. MIT license. ~130 KB gzipped (includes ApexCharts core). 100K+ weekly npm downloads.
- **date-fns** — Date utility. MIT license. ~15 KB gzipped (tree-shakeable). 20M+ weekly npm downloads.
- **vite-plugin-pwa** — PWA support. MIT license. 200K+ weekly npm downloads.

**Total additional bundle size estimate:** ~185 KB gzipped. Acceptable for PWA with service worker caching. Initial load on 3G: ~2–3 seconds. Subsequent loads from cache: <500 ms.

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
  - Acceptable for MVP since this is personal/project budget data, not financial credentials
  - Document that anyone with device access can read the data
- Export JSON could contain sensitive budget information
  - No mitigation needed for MVP beyond user awareness

---

### Future Considerations (Post-MVP)

These are explicitly out of scope for MVP but inform architectural decisions:

- **Multi-currency support:** currencyLabel field is already on Budget. Future work adds conversion rates and display logic, no schema change needed.
- **Supabase sync:** Data model is designed to be sync-friendly (UUIDs as IDs, timestamps on all records). Adding sync later means adding a Supabase backend and conflict resolution, but the local-first model stays intact.
- **Authentication:** Required if sync is added. Supabase Auth slots in cleanly.
- **Shared budgets:** Requires sync + auth + permissions. Schema already supports it (budgets are independent entities).
- **Templates:** Predefined expense sets for common project types. Would be a new collection in IndexedDB with export/import support.
- **Multi-budget comparison:** Compare two budgets side by side. Current comparison engine works per-budget; this would be a UI layer addition.
