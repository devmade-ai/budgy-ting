# Implementation Plan: Actuals-First Pivot

## Overview

Rewrite budgy-ting from a budget-first app (define expenses → project → compare) to an actuals-first app (upload transactions → classify → predict → measure accuracy). The UI collapses from 3 tabs to a single screen.

## Phase 1: Data Model & Database Migration

### 1a. New types in `src/types/models.ts`
- Add `Transaction` interface (replaces both `Expense` and `Actual`)
  - Fields: id, workspaceId, date, amount (signed: positive=income, negative=expense), description, tags, source ('import'|'manual'), classification ('recurring'|'once-off'), recurringGroupId, accountId, originalRow, importBatchId, createdAt, updatedAt
- Add `RecurringPattern` interface
  - Fields: id, workspaceId, description, expectedAmount, amountStdDev, frequency, anchorDay, tags, isActive, autoAccept, lastSeenDate, createdAt, updatedAt
- Add `ImportBatch` interface
  - Fields: id, workspaceId, accountId, fileName, dateRange, transactionCount, importedAt
- Update `Workspace`: add `cashOnHand: number | null`, `accounts: string[]`
- Keep old types (`Expense`, `Actual`) temporarily for migration, mark as `@deprecated`

### 1b. Database schema v6 in `src/db/index.ts`
- Add new tables: `transactions`, `patterns`, `importBatches`
- Indexes: transactions on `workspaceId, date, *tags, recurringGroupId, source, classification, importBatchId, accountId`
- Indexes: patterns on `workspaceId, description, frequency, isActive`
- Indexes: importBatches on `workspaceId, accountId, importedAt`
- Migration upgrade handler:
  - Convert `expenses` → `patterns` (recurring ones) + keep as context
  - Convert `actuals` → `transactions` with source='import', classification='once-off' (safe default)
  - Add cashOnHand=null and accounts=[] to workspaces
  - Drop old tables after migration: expenses=null, actuals=null, categoryMappings=null

### 1c. Update `src/db/demoData.ts`
- Rewrite demo seed to create transactions + patterns instead of expenses + actuals

## Phase 2: Forecasting Engine

### 2a. New file: `src/engine/recurring.ts`
- `detectFrequency(dates: string[]): { frequency, anchorDay, confidence }` — interval analysis
- `projectRecurringPattern(pattern, startDate, endDate): DailyPoint[]` — deterministic scheduling
- `matchToPattern(description, amount, patterns): RecurringPattern | null` — fuzzy match for auto-accept

### 2b. New file: `src/engine/holt.ts`
- `HoltState` interface
- `holtInit(values): HoltState` — initialize from historical data
- `holtUpdate(state, observation): HoltState`
- `holtForecast(state, stepsAhead): number`
- `optimizeParameters(historicalValues): { alpha, beta }` — grid search

### 2c. New file: `src/engine/forecaster.ts` (replaces forecast.ts + projection.ts)
- `calculateDayOfWeekFactors(dailyResiduals): number[]`
- `generateForecast(transactions, patterns, startDate, endDate, cashOnHand?): ForecastResult`
  - Separates recurring from variable
  - Projects recurring deterministically
  - Applies Holt + day-of-week to variable residual
  - Combines into daily points with confidence bands
  - Cash runway calculation when cashOnHand provided
- `ForecastResult` type: dailyActuals, dailyPredictions, confidenceBands, runway, metrics

### 2d. New file: `src/engine/metrics.ts` (replaces accuracy.ts + variance.ts)
- `calculateMAE(actuals, predictions): number`
- `calculateBias(actuals, predictions): number`
- `calculateHitRate(actuals, predictions, threshold): number`
- `calculateWMAPE(actuals, predictions): number` (for monthly aggregates)
- `detectSpendingTrend(dailyAmounts): TrendResult`
- `calculateMetrics(transactions, forecast): MetricsResult` — all metric cards in one call

### 2e. Install `simple-statistics`
- `npm install simple-statistics`
- Used for: linearRegression, standardDeviation, quantile

## Phase 3: Import Wizard Redesign

### 3a. Refactor ImportWizardView.vue — 3 steps instead of 4
- Step 1: Upload + Map (merge current steps 1+2 into one screen)
- Step 2: Classify (new — recurring/once-off/ignore per transaction group)
- Step 3: Confirm & Import

### 3b. New component: `ImportStepClassify.vue` (replaces ImportStepReview.vue)
- Groups imported rows by description+amount pattern
- For each group: show description, amount range, date range, count
- User selects: Recurring / Once-off / Ignore
- For recurring: auto-detected frequency displayed, allow override
- Pre-fill from existing RecurringPatterns (autoAccept)
- Tags optional per group
- Bulk action: "Mark remaining as once-off"

### 3c. Update ImportStepMapping.vue
- Merge upload UI into this step (or keep separate, combine visually)
- Add account selector (optional "Which account?")
- Duplicate detection now checks against transactions table + importBatches

### 3d. Update confirm handler in ImportWizardView.vue
- Save transactions (classified recurring + once-off, skip ignored)
- Create/update RecurringPattern for each recurring group
- Create ImportBatch record
- Navigate to workspace dashboard (single screen) instead of Compare tab

### 3e. Remove: ImportStepComplete.vue (fold into step 3 confirmation)

## Phase 4: Single-Screen UI

### 4a. Rewrite `WorkspaceDetailView.vue`
- Remove tab navigation entirely
- Single screen with: cash-on-hand input, graph, metrics, table
- Keep header (workspace name, import button, overflow menu)

### 4b. New component: `CashOnHandInput.vue`
- Numeric input, persisted to workspace.cashOnHand on change (debounced)
- Shows runway summary inline when value provided

### 4c. Rewrite `CashflowChart.vue`
- Multiple series: actuals (solid blue), predictions (dashed amber), confidence band (shaded), cash runway (green→red area), zero line
- Period selector: 1W / 1M / 3M / 6M / 1Y / All
- Toggle: cumulative vs daily net
- Data comes from `ForecastResult`

### 4d. New component: `MetricsGrid.vue` + `MetricCard.vue`
- Responsive grid of metric cards
- Each card: label, value, optional trend arrow, optional sub-text
- Metrics from `MetricsResult`: daily avg spend, daily income, net, monthly burn, top category, prediction accuracy, spending trend, cash runway, savings rate, etc.

### 4e. New component: `TransactionTable.vue`
- Paginated (configurable, default 25)
- Columns: Date, Description, Amount, Type (recurring/once-off), Tags, Account
- Sortable by date (default desc) and amount
- Filterable: date range, tags, classification, account, search text
- Inline edit: click row to expand/edit (or modal)
- Delete with confirmation

### 4f. New component: `AddTransactionModal.vue`
- Manual entry form: date, description, amount, type (income/expense), classification, tags
- Creates a transaction with source='manual'

### 4g. Remove old views
- Delete: ExpensesTab.vue, ProjectedTab.vue, CompareTab.vue
- Delete: compare-views/ directory (CompareLineItems, CompareCategories, CompareMonthly)
- Delete: ExpenseCreateView.vue, ExpenseEditView.vue
- Delete: ExpenseForm.vue component

### 4h. Update router
- Remove child routes (workspace-expenses, workspace-projected, workspace-compare)
- Remove expense-create, expense-edit routes
- Workspace detail becomes the single view (no redirect needed)

## Phase 5: Cleanup & Polish

### 5a. Remove old engine files
- Delete: projection.ts, variance.ts (replaced by forecaster.ts, metrics.ts)
- Delete: matching.ts three-pass matching (replaced by pattern matching in recurring.ts). Keep: fuzzyScore, parseDate, parseAmount, isDuplicate, DATE_FORMATS (move reusable parts to a utils file)
- Update: forecast.ts → delete (replaced by forecaster.ts + holt.ts)
- Update: accuracy.ts → delete (replaced by metrics.ts)

### 5b. Update tests
- New tests for: recurring.ts, holt.ts, forecaster.ts, metrics.ts
- Update: csvParser.test.ts (should be unchanged)
- Delete: matching.test.ts, projection.test.ts, variance.test.ts, forecast.test.ts, accuracy.test.ts
- Update: exportImport.test.ts for new schema

### 5c. Update exportImport.ts
- Export schema v3 with transactions + patterns + importBatches
- Import validation handles v1, v2, v3

### 5d. Update demoData.ts
- Generate realistic demo transactions over 3 months
- Create demo recurring patterns
- Create demo import batches

### 5e. Update documentation
- CLAUDE.md: update architecture section
- docs/USER_GUIDE.md: rewrite for single-screen flow
- docs/TESTING_GUIDE.md: new test scenarios
- docs/SESSION_NOTES.md: update
- README.md: update features

### 5f. Build & verify
- `npm run type-check`
- `npm run test`
- `npm run build`
- Fix any issues

## Files Changed Summary

### New files (~10)
- `src/engine/recurring.ts` + test
- `src/engine/holt.ts` + test
- `src/engine/forecaster.ts` + test
- `src/engine/metrics.ts` + test
- `src/views/import-steps/ImportStepClassify.vue`
- `src/components/CashOnHandInput.vue`
- `src/components/MetricsGrid.vue`
- `src/components/MetricCard.vue`
- `src/components/TransactionTable.vue`
- `src/components/AddTransactionModal.vue`

### Modified files (~8)
- `src/types/models.ts` — new types
- `src/db/index.ts` — schema v6
- `src/db/demoData.ts` — new demo data
- `src/views/WorkspaceDetailView.vue` — single screen
- `src/views/ImportWizardView.vue` — 3-step flow
- `src/views/import-steps/ImportStepMapping.vue` — merged upload
- `src/components/CashflowChart.vue` — more series
- `src/router/index.ts` — simplified routes
- `src/engine/exportImport.ts` — schema v3
- `package.json` — add simple-statistics

### Deleted files (~15)
- `src/views/ExpensesTab.vue`
- `src/views/ProjectedTab.vue`
- `src/views/CompareTab.vue`
- `src/views/compare-views/CompareLineItems.vue`
- `src/views/compare-views/CompareCategories.vue`
- `src/views/compare-views/CompareMonthly.vue`
- `src/views/ExpenseCreateView.vue`
- `src/views/ExpenseEditView.vue`
- `src/views/import-steps/ImportStepComplete.vue`
- `src/views/import-steps/ImportStepReview.vue`
- `src/components/ExpenseForm.vue`
- `src/engine/projection.ts` + test
- `src/engine/variance.ts` + test
- `src/engine/matching.ts` + test (after extracting reusable utils)
- `src/engine/forecast.ts` + test
- `src/engine/accuracy.ts` + test

## Execution Order

Phases 1-2-3-4-5 in sequence. Within each phase, steps can be parallelized where noted. Each phase ends with a commit. Phase 5 ends with build verification and push.
