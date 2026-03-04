# Forecasting Models Research

## Context

The app is pivoting from a **budget-first** paradigm (define expenses, project forward, compare to actuals) to an **actuals-first** paradigm:

1. Upload bank statement actuals
2. Categorize transactions via wizard: **recurring**, **once-off**, or **ignore** (not stored)
3. Predict future daily cashflow from historical patterns + known recurring items
4. Upload next period, auto-accept known recurring items
5. View prediction accuracy, refine predictions
6. Single-screen UI: graph + cash-on-hand input + metrics + paginated transaction table

### Key Requirements
- Daily granularity for all calculations and display
- Predictions, actuals, and accuracy on the same graph
- Duplicate detection for same-period reimports
- Multi-account support (different bank accounts, same period)
- Cash runway projection when cash-on-hand is provided
- Editable historic and future items
- Manual item creation without upload
- All computation runs client-side (browser, no server)

---

## 1. Forecasting Architecture: The Hybrid Approach

Personal finance cashflow has a unique structure that pure statistical models don't capture well. The best approach is a **hybrid model** that separates transactions into components and handles each appropriately.

### Component Decomposition

```
Total Daily Cashflow = Recurring Items + Variable Spending + Seasonal Adjustments + Trend
```

| Component | Source | Method |
|-----------|--------|--------|
| **Recurring items** | User-tagged during import wizard | Deterministic scheduling (known amount, known frequency, known date) |
| **Variable spending** | Residual after removing recurring items | Exponential smoothing (Holt method for trend) |
| **Seasonal patterns** | Detected from 3+ months of data | Day-of-week multipliers + month-of-year adjustments |
| **Trend** | Overall spending direction | Linear regression on weekly/monthly aggregates |

### Why Hybrid Beats Pure Statistical

Pure time-series models (ARIMA, EMA) treat all data points equally. But personal finance has **known structure**:
- Rent is exactly $1,500 on the 1st of every month
- Salary is exactly $4,200 on the 25th
- Netflix is exactly $15.99 monthly

These aren't patterns to "discover" — the user tells us directly in the wizard. Statistical models should only handle the **residual** (groceries, dining, transport, ad-hoc purchases) where amounts and timing genuinely vary.

---

## 2. Recurring Item Detection & Scheduling

### Frequency Detection Algorithm

When the user tags a transaction as "recurring" in the import wizard, we need to detect its frequency from historical data. The algorithm:

```
Input: All transactions matching the same description/amount pattern
Output: Detected frequency + next expected dates

1. Sort transactions by date ascending
2. Calculate intervals between consecutive occurrences (in days)
3. Find the median interval (robust to missed/late payments)
4. Map median interval to nearest standard frequency:
   - 1 day       → daily
   - 6-8 days    → weekly
   - 13-16 days  → biweekly (fortnightly)
   - 27-34 days  → monthly
   - 85-95 days  → quarterly
   - 350-380 days → annually
5. For monthly+: detect preferred day-of-month (mode of all occurrence days)
6. For weekly: detect preferred day-of-week
```

### Scheduling Engine for Recurring Items

Once frequency is known, project forward deterministically:

```typescript
interface RecurringItem {
  description: string
  amount: number          // positive = income, negative = expense
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually'
  anchorDate: string      // the date pattern is anchored to (e.g., "1st of month")
  type: 'income' | 'expense'
  confidence: number      // how regular the pattern is (0-1)
  tags: string[]
}

function projectRecurringItem(item: RecurringItem, startDate: Date, endDate: Date): DailyPoint[] {
  // Generate all expected occurrence dates within the range
  // For monthly: handle months with fewer days (e.g., anchor day 31 → use last day)
  // Return array of { date, amount } points
}
```

### Amount Variation Handling

For recurring items where the amount varies slightly (e.g., electricity bill):
- Store the **median amount** as the expected value
- Calculate **standard deviation** of historical amounts
- Use this for confidence bands on predictions
- If stddev/mean > 0.3 (coefficient of variation), flag as "variable recurring" rather than "fixed recurring"

---

## 3. Variable Spending Prediction

After removing recurring items from the daily totals, the residual represents variable spending. This is where statistical models earn their keep.

### Recommended: Double Exponential Smoothing (Holt's Method)

Captures both **level** (average daily spend) and **trend** (spending going up or down over time).

```typescript
interface HoltState {
  level: number       // current smoothed level
  trend: number       // current smoothed trend (per day)
  alpha: number       // level smoothing factor (0.1-0.3 for daily data)
  beta: number        // trend smoothing factor (0.01-0.1)
}

function holtUpdate(state: HoltState, observation: number): HoltState {
  const newLevel = state.alpha * observation + (1 - state.alpha) * (state.level + state.trend)
  const newTrend = state.beta * (newLevel - state.level) + (1 - state.beta) * state.trend
  return { ...state, level: newLevel, trend: newTrend }
}

function holtForecast(state: HoltState, stepsAhead: number): number {
  return state.level + stepsAhead * state.trend
}
```

**Why Holt over simpler methods:**
- Simple Moving Average (SMA): No trend detection, lagging indicator, equal weight to old/new data
- Simple Exponential Smoothing (SES): Handles level but ignores trend — if spending is gradually increasing, SES will always underpredict
- Holt-Winters (triple): Adds seasonality component (m=7 for weekly), but needs 2+ full seasonal cycles to initialize. Worth upgrading to once we have enough data.

**Upgrade path: Holt → Holt-Winters additive (m=7)**
When 3+ months of data exist, upgrade to Holt-Winters with weekly seasonality (m=7) to capture weekday/weekend patterns. **Always use the additive variant** — the multiplicative variant breaks when daily cashflow touches zero (which it often does). The additive model adds the seasonal factor; multiplicative scales by it (division by zero risk).

**Why Holt over complex methods:**
- ARIMA: Needs stationarity testing, differencing, parameter selection (p,d,q) — too complex for client-side, requires expertise to tune. The `arima` npm package is WASM-based (~293KB), last updated 4 years ago, and requires a Chrome workaround.
- LSTM/neural nets: Needs training data volume we don't have, heavy computation, overkill for this use case
- Prophet: Server-side Python library, not suitable for browser
- Chronos2/TiRex (zero-shot JS SDK): Interesting new entry (late 2025) but adds API dependency, very new. Worth revisiting when it matures.

### Parameter Selection

For daily personal finance data:
- `alpha = 0.2` — responds to changes but doesn't overreact to single-day spikes
- `beta = 0.05` — trend changes slowly (spending habits don't shift daily)

These can be optimized per-user by minimizing one-step-ahead prediction error on historical data (grid search over alpha/beta space).

### Day-of-Week Seasonality

Variable spending has strong weekly patterns (weekends vs weekdays). Apply multiplicative seasonal adjustment:

```typescript
function calculateDayOfWeekFactors(dailyResiduals: Map<string, number>): number[] {
  // factors[0] = Monday multiplier, factors[6] = Sunday multiplier
  // Average residual per day-of-week / overall average
  // e.g., Saturday = 1.4 (40% more), Tuesday = 0.8 (20% less)
  const dayTotals = [0, 0, 0, 0, 0, 0, 0]
  const dayCounts = [0, 0, 0, 0, 0, 0, 0]

  for (const [dateStr, amount] of dailyResiduals) {
    const dow = new Date(dateStr).getDay() // 0=Sun, adjust to 0=Mon
    const adjusted = dow === 0 ? 6 : dow - 1
    dayTotals[adjusted] += amount
    dayCounts[adjusted]++
  }

  const overallAvg = [...dailyResiduals.values()].reduce((a, b) => a + b, 0) / dailyResiduals.size
  return dayTotals.map((total, i) => dayCounts[i] > 0 ? (total / dayCounts[i]) / overallAvg : 1.0)
}

// Forecasted daily amount = holtForecast(state, stepsAhead) * dayOfWeekFactor[targetDay]
```

Needs minimum 4 weeks of data to be meaningful. Below that, skip seasonal adjustment.

---

## 4. Confidence Intervals / Prediction Bands

Users need to see not just "we predict $X" but "we're fairly confident it'll be between $Y and $Z."

### Method: Prediction Error Distribution

```typescript
interface PredictionBand {
  upper: number    // 80th percentile scenario
  lower: number    // 20th percentile scenario
  point: number    // median/expected value
}

function calculatePredictionBands(
  historicalErrors: number[],  // actual - predicted for each historical day
  forecast: number,
  stepsAhead: number
): PredictionBand {
  const errorStdDev = standardDeviation(historicalErrors)

  // Prediction uncertainty grows with forecast horizon
  // Use sqrt scaling (random walk assumption)
  const horizonFactor = Math.sqrt(stepsAhead)
  const adjustedStdDev = errorStdDev * horizonFactor

  return {
    point: forecast,
    upper: forecast + 1.28 * adjustedStdDev,  // 80% CI upper
    lower: forecast - 1.28 * adjustedStdDev,  // 80% CI lower
  }
}
```

### Alternative: Bootstrap from Residuals (More Robust)

For non-normal error distributions (common with bank transactions — heavy tails, occasional large outliers):
1. Collect all historical residuals: `errors = actual - predicted` for each day
2. For each future day h, sample with replacement from residuals 1,000 times
3. Add each resampled path to the forecast
4. Use 10th/90th percentiles as the 80% band, 2.5th/97.5th for 95%

Bootstrap handles heavy tails better than the parametric formula above. Viable in-browser with typical dataset sizes (365-1000 daily points).

**Why 80% CI instead of 95%:**
- 95% bands are too wide to be useful for personal finance (range of "you'll spend between $20 and $200 today" isn't helpful)
- 80% is narrow enough to be actionable while still being honest about uncertainty
- Can offer a toggle: "likely range" (80%) vs "possible range" (95%)

**Cumulative bands** for the graph (running balance view):
- Uncertainty compounds over time — bands should widen as you look further into the future
- This naturally communicates "we're more confident about next week than next month"

---

## 5. Prediction Accuracy Metrics

### Primary Metric: MAE (Mean Absolute Error)

MAE is the right primary metric for daily cashflow prediction. MAPE (percentage-based) explodes on days with near-zero actual transactions, making it unreliable at daily granularity.

```typescript
function calculateMAE(actuals: number[], predictions: number[]): number {
  // MAE in currency units: "predictions are typically within $X per day"
  // Intuitive, scale-dependent, not distorted by zero-spend days
  let sumAbsError = 0
  for (let i = 0; i < actuals.length; i++) {
    sumAbsError += Math.abs(actuals[i] - predictions[i])
  }
  return actuals.length === 0 ? 0 : sumAbsError / actuals.length
}
```

### Secondary Metrics (for the metrics cards)

| Metric | Formula | User-facing label | Why it's useful |
|--------|---------|-------------------|-----------------|
| MAE | mean(\|actual - predicted\|) | "Prediction accuracy" (in currency: "within $X/day") | Primary — tangible dollar amount |
| RMSE | sqrt(mean((actual - predicted)²)) | Internal only | Penalizes large errors — if RMSE >> MAE, you have occasional big misses |
| Bias | mean(actual - predicted) | "Prediction tendency" | Shows if we systematically over/under predict |
| Hit rate | % of days where \|error\| < threshold | "Days within range" | Percentage of days prediction was close |
| WMAPE | sum(\|error\|) / sum(\|actual\|) | "Forecast accuracy %" (for monthly summaries only) | Percentage form — only meaningful at weekly/monthly aggregate level where values are never near zero |

### Accuracy Over Time (for the graph)

Display as a **shaded band** between actual and predicted lines:
- Green where prediction was close (within 1 stddev)
- Yellow where prediction was off (1-2 stddev)
- Red where prediction was way off (>2 stddev)

Or simpler: show the actual line, the predicted line, and let the visual gap speak for itself.

---

## 6. Seasonality Detection

### Three Levels of Seasonality

**Level 1: Day-of-week (needs 4+ weeks)**
- Weekend vs weekday spending patterns
- Specific day patterns (e.g., Friday = dining out)
- Method: Day-of-week multipliers (section 3 above)

**Level 2: Day-of-month (needs 3+ months)**
- Salary deposits (25th, last day)
- Rent/mortgage (1st)
- Bill payment clusters (around statement dates)
- Method: Already captured by recurring item detection — if a transaction is tagged recurring with monthly frequency, its anchor date handles this

**Level 3: Month-of-year (needs 12+ months)**
- Holiday spending (December spike)
- Tax payments (quarterly/annual)
- Back-to-school, vacation periods
- Method: Monthly multipliers similar to day-of-week factors
- **Skip this initially** — most users won't have a year of data at first

### Implementation Priority

Start with Level 1 + Level 2 (covered by recurring items). Level 3 is a future enhancement when users have enough history.

---

## 7. JavaScript Libraries Evaluation

### Recommended Stack

| Need | Library | Size | Why |
|------|---------|------|-----|
| Basic statistics | `simple-statistics` | ~30KB | Mean, median, stddev, linear regression. Well-maintained, zero deps, TypeScript types. Covers 90% of what we need. |
| Everything else | Custom implementation | 0 | Holt's method, day-of-week factors, frequency detection, WMAPE — all simple enough to implement in ~200 lines total. No library needed. |

### Libraries Evaluated and Rejected

| Library | Why rejected |
|---------|-------------|
| `arima` (npm) | WASM-based ARIMA/SARIMA. Heavy (~500KB), complex parameter tuning (p,d,q), overkill for this use case. Would be the right choice if we were doing pure statistical forecasting without the hybrid approach, but our recurring-item detection handles most of what ARIMA's AR component would capture. |
| `ml.js` | Machine learning toolkit. Too heavy, needs training data volume we don't have. |
| `danfojs` | DataFrame library (pandas-like). Useful for data manipulation but we're doing that with plain arrays/Maps already. Adds ~300KB. |
| `tensorflow.js` | LSTM/neural nets. Way too heavy (MB-scale), needs training, wrong tool for <1 year of daily data. |
| `timeseries-analysis` | Auto-regression coefficients. Viable but no TypeScript types, last updated 2019, and our hybrid approach makes pure AR less necessary. |
| Chronos2/TiRex JS SDK | Zero-shot foundation models. Interesting for future exploration, but adds API dependency (not fully client-side) and is very new (late 2025). Worth revisiting when it matures. |

### Why Minimal Dependencies

The hybrid approach (recurring items + Holt smoothing + day-of-week factors) is mathematically simple. Each piece is 20-50 lines of TypeScript. Adding a library for this would:
1. Increase bundle size unnecessarily
2. Add a dependency maintenance burden
3. Make the logic harder to debug and customize
4. Not actually improve prediction quality — the gains come from the hybrid decomposition, not from fancier math on the residuals

`simple-statistics` is worth it because standard deviation, linear regression, and percentile calculations are tedious to get right (numerical stability, edge cases) and it's small.

---

## 8. Trend Detection

### Method: Linear Regression on Weekly Aggregates

Daily data is too noisy for trend detection. Aggregate to weekly totals first.

```typescript
import { linearRegression, linearRegressionLine } from 'simple-statistics'

function detectSpendingTrend(dailyAmounts: Map<string, number>): {
  direction: 'increasing' | 'decreasing' | 'stable'
  weeklyChange: number    // average change per week in currency units
  confidence: number      // R-squared (0-1)
} {
  // 1. Aggregate daily data into ISO weeks
  const weeklyTotals: [number, number][] = [] // [weekIndex, total]
  // ... group by ISO week, sum amounts

  // 2. Linear regression on (weekIndex, weeklyTotal)
  const regression = linearRegression(weeklyTotals)
  const rSquared = calculateRSquared(weeklyTotals, linearRegressionLine(regression))

  // 3. Classify
  const threshold = 0.05 * mean(weeklyTotals.map(w => w[1])) // 5% of avg weekly spend
  return {
    direction: Math.abs(regression.m) < threshold ? 'stable'
             : regression.m > 0 ? 'increasing' : 'decreasing',
    weeklyChange: regression.m,
    confidence: rSquared
  }
}
```

Needs minimum 8 weeks of data for meaningful trend detection. Below that, assume stable.

---

## 9. Cash Runway Calculation

When the user inputs cash on hand, walk forward day-by-day through the combined forecast (recurring + variable):

```typescript
interface RunwayResult {
  daysRemaining: number | null    // null = cash is growing (never runs out)
  depletionDate: string | null    // ISO date string
  endBalance: number              // balance at end of forecast period
  minimumBalance: number          // lowest point during forecast
  minimumBalanceDate: string      // when the lowest point occurs
}

function calculateRunway(
  cashOnHand: number,
  dailyForecasts: DailyPoint[],  // combined recurring + variable forecasts
): RunwayResult {
  let balance = cashOnHand
  let minBalance = cashOnHand
  let minDate = dailyForecasts[0]?.date ?? ''

  for (const day of dailyForecasts) {
    balance += day.amount  // positive for income, negative for expense
    if (balance < minBalance) {
      minBalance = balance
      minDate = day.date
    }
    if (balance <= 0) {
      return {
        daysRemaining: daysBetween(new Date(), new Date(day.date)),
        depletionDate: day.date,
        endBalance: balance,
        minimumBalance: minBalance,
        minimumBalanceDate: minDate
      }
    }
  }

  return {
    daysRemaining: null,  // cash lasts beyond forecast horizon
    depletionDate: null,
    endBalance: balance,
    minimumBalance: minBalance,
    minimumBalanceDate: minDate
  }
}
```

### Graph Integration

Plot the runway as a **filled area** on the cashflow graph:
- Starting from cash-on-hand value
- Adding/subtracting predicted daily cashflow
- Color: green above zero, fading to red as it approaches zero
- If it crosses zero: mark the depletion date with a vertical line

---

## 10. Metrics Cards

Metrics to display above the transaction table, derived from the data:

### Always Visible

| Metric | Calculation | User label |
|--------|------------|------------|
| Average daily spend | Mean of daily expense totals (excl. income) | "Daily average" |
| Average daily income | Mean of daily income totals | "Daily income" |
| Net daily cashflow | Income - expenses, daily average | "Daily net" |
| Monthly burn rate | Sum of expenses over last 30 days | "Monthly spend" |
| Top expense category | Tag with highest total spend | "Biggest category" |
| Transaction count | Total actuals in current view period | "Transactions" |

### When Predictions Exist (3+ weeks of data)

| Metric | Calculation | User label |
|--------|------------|------------|
| Prediction accuracy | 100% - WMAPE | "Forecast accuracy" |
| Predicted month-end balance | Cumulative forecast to month end | "Predicted balance" |
| Spending trend | Linear regression direction + magnitude | "Spending trend" |
| Days until broke | Cash runway (when cash-on-hand provided) | "Cash runway" |

### When Cash-on-Hand Provided

| Metric | Calculation | User label |
|--------|------------|------------|
| Cash runway | Days until balance hits zero | "Cash lasts until" |
| Minimum balance | Lowest predicted balance and when | "Tightest point" |
| End-of-period balance | Predicted balance at forecast horizon | "Projected balance" |

### Potential Bonus Metrics

| Metric | Calculation | User label |
|--------|------------|------------|
| Savings rate | (Income - Expenses) / Income × 100 | "Savings rate" |
| Recurring vs variable ratio | Fixed costs / total spend | "Fixed costs ratio" |
| Weekend vs weekday spend | Average weekend day / average weekday | "Weekend factor" |
| Largest single transaction | Max expense amount in period | "Biggest expense" |
| Income stability | Coefficient of variation of income | "Income stability" |
| Expense volatility | Coefficient of variation of daily expenses | "Spending volatility" |

---

## 11. Data Model Changes

### Current → New Model Mapping

The core shift: **"Expense" becomes "Transaction"** (both historic actuals and future predictions are the same entity type).

```typescript
// NEW: Unified transaction model
interface Transaction {
  id: string
  workspaceId: string
  date: string                // ISO date (YYYY-MM-DD)
  amount: number              // positive = income, negative = expense (sign-based, no separate type)
  description: string
  tags: string[]
  source: 'import' | 'manual' // how it entered the system
  classification: 'recurring' | 'once-off' // user-assigned during import
  recurringGroupId: string | null  // links recurring instances together
  accountId: string | null    // which bank account (for multi-account)

  // Import metadata (null for manual entries)
  originalRow: Record<string, string> | null
  importBatchId: string | null

  createdAt: string
  updatedAt: string
}

// NEW: Recurring pattern (derived from classified transactions)
interface RecurringPattern {
  id: string
  workspaceId: string
  description: string          // pattern name (e.g., "Netflix", "Rent")
  expectedAmount: number       // median historical amount
  amountStdDev: number         // variation in amount
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually'
  anchorDay: number            // day-of-week (0-6) for weekly, day-of-month (1-31) for monthly+
  tags: string[]
  isActive: boolean            // still expected to recur?
  autoAccept: boolean          // auto-approve in future imports
  lastSeenDate: string         // most recent occurrence
  createdAt: string
  updatedAt: string
}

// NEW: Import batch tracking (for duplicate detection)
interface ImportBatch {
  id: string
  workspaceId: string
  accountId: string | null
  fileName: string
  dateRange: { start: string, end: string }
  transactionCount: number
  importedAt: string
}

// Workspace stays mostly the same, add:
interface Workspace {
  // ... existing fields
  cashOnHand: number | null    // persisted now (was ephemeral)
  accounts: string[]           // list of account identifiers
}
```

### Database Schema Changes

```
workspaces:    'id, name, createdAt'
transactions:  'id, workspaceId, date, *tags, recurringGroupId, source, classification, importBatchId, accountId'
patterns:      'id, workspaceId, description, frequency, isActive'
importBatches: 'id, workspaceId, accountId, importedAt'
tagCache:      'tag, lastUsed'
```

### Migration Strategy

The existing `expenses` table maps to `RecurringPattern` (they were always predictions of future recurring items). The existing `actuals` table maps to `Transaction` with `source: 'import'`. Migration can convert existing data on schema upgrade.

---

## 12. Import Wizard Redesign

### New Flow (3 steps instead of 4)

**Step 1 — Upload & Map Columns** (merge current steps 1+2)
- File upload + column mapping on one screen
- Auto-detection same as current
- Duplicate detection against existing transactions AND import batches
- Account selection/creation (optional: "Which account is this from?")

**Step 2 — Classify Transactions** (new — replaces current "review matches")
- For each unique transaction pattern (grouped by description + similar amount):
  - Show: description, amount(s), dates, occurrence count
  - User selects: **Recurring** / **Once-off** / **Ignore**
  - For recurring: auto-detect frequency, allow override
  - Pre-fill classifications from existing RecurringPatterns (auto-accept known recurring items)
  - "Ignore" means don't store at all (per user requirement)
- Tags are optional — can be added per-group or skipped
- Bulk actions: "Mark remaining as once-off"

**Step 3 — Confirm & Import**
- Summary: X recurring (Y auto-accepted), Z once-off, W ignored
- Shows which RecurringPatterns were created/updated
- Import button

### Auto-Accept Logic for Returning Users

```typescript
function autoClassify(
  row: ParsedRow,
  existingPatterns: RecurringPattern[]
): { classification: 'recurring' | 'once-off' | null, patternId: string | null } {
  for (const pattern of existingPatterns) {
    if (!pattern.autoAccept || !pattern.isActive) continue

    // Match by description similarity + amount proximity
    const descMatch = fuzzyScore(row.description, pattern.description) < 0.3
    const amountMatch = Math.abs(row.amount - pattern.expectedAmount) / Math.abs(pattern.expectedAmount) < 0.1

    if (descMatch && amountMatch) {
      return { classification: 'recurring', patternId: pattern.id }
    }
  }
  return { classification: null, patternId: null }
}
```

Auto-classified items are shown pre-checked in Step 2 but the user can still override.

---

## 13. Single-Screen UI Architecture

### Component Tree

```
WorkspaceView.vue
├── CashOnHandInput.vue          (persistent, stored in workspace)
├── CashflowGraph.vue            (ApexCharts — actuals + predictions + accuracy + runway)
├── MetricsGrid.vue              (responsive grid of metric cards)
│   └── MetricCard.vue           (individual metric with label, value, trend indicator)
├── TransactionTable.vue         (paginated, filterable, editable)
│   ├── TransactionFilters.vue   (date range, tags, classification, account, search)
│   ├── TransactionRow.vue       (inline editable row)
│   └── TransactionPagination.vue
├── AddTransactionButton.vue     (manual entry — opens inline form or modal)
└── ImportButton.vue             (launches import wizard)
```

### Graph Configuration

Single ApexCharts instance with multiple series:

| Series | Type | Color | Style | When shown |
|--------|------|-------|-------|------------|
| Actuals (cumulative) | line | blue #3b82f6 | solid, 2px | Always (when data exists) |
| Predictions (cumulative) | line | amber #f59e0b | dashed, 2px | When 3+ weeks of data |
| Prediction accuracy band | area | green/red | filled, 20% opacity | Between actual and predicted lines |
| Cash runway | area | green→red gradient | filled, 15% opacity | When cash-on-hand provided |
| Zero line | line | red #ef4444 | dotted, 1px | When cash runway is shown |

X-axis: daily dates, scrollable/zoomable
Y-axis: currency amount
Period selector: 1W / 1M / 3M / 6M / 1Y / All

---

## 14. Implementation Phases

### Phase 1: Data Model Migration
- New schema (transactions, patterns, importBatches)
- Migration from expenses/actuals to new model
- CRUD operations for transactions

### Phase 2: Import Wizard Redesign
- Merge upload + mapping steps
- New classification step (recurring/once-off/ignore)
- Auto-accept for known recurring patterns
- Duplicate detection per import batch
- Multi-account support

### Phase 3: Forecasting Engine
- Recurring item scheduling (deterministic projection)
- Holt's method for variable spending
- Day-of-week seasonal factors
- Combined forecast generation
- Confidence bands
- `simple-statistics` integration

### Phase 4: Single-Screen UI
- Remove 3-tab structure
- Graph with all series (actuals, predictions, accuracy, runway)
- Metrics grid
- Paginated transaction table with inline editing
- Cash-on-hand input (persisted)
- Manual transaction creation

### Phase 5: Accuracy & Refinement
- Prediction accuracy calculation (WMAPE, MAE, bias)
- Accuracy visualization on graph
- Trend detection
- Parameter auto-tuning (optimize alpha/beta per user)
- Bonus metrics

---

## 15. What We Keep from Current Codebase

| Current | Keep? | Notes |
|---------|-------|-------|
| `csvParser.ts` | Yes | CSV/JSON parsing is reusable as-is |
| `matching.ts` | Partial | `fuzzyScore`, `isDuplicate`, `parseDate`, `parseAmount` are reusable. The 3-pass matching against expenses goes away. |
| `projection.ts` | Replace | New scheduling engine for recurring patterns replaces this |
| `variance.ts` | Replace | Prediction accuracy replaces budget variance |
| `forecast.ts` | Replace | New hybrid forecasting engine replaces EMA-only approach |
| `accuracy.ts` | Evolve | MAPE concept stays, calculation changes to work with new model |
| `exportImport.ts` | Update | Schema changes needed, but structure is reusable |
| `CashflowChart.vue` | Evolve | Same library (ApexCharts), more series, different configuration |
| Import wizard views | Restructure | 4 steps → 3 steps, classification replaces matching |
| `useFormat.ts` | Yes | Currency/date formatting is reusable |
| Database layer (Dexie) | Yes | Schema v6 migration, same Dexie patterns |
| PWA system | Yes | Completely independent of data model |
| Debug system | Yes | Completely independent |

---

## Summary

The key insight is that **most of the forecasting quality comes from the hybrid decomposition, not from fancy math**. By letting users classify transactions as recurring (with deterministic scheduling) and only applying statistical models to the variable residual, we get better predictions with simpler code than any pure statistical approach.

The `simple-statistics` library plus ~300 lines of custom TypeScript (Holt's method, frequency detection, day-of-week factors, confidence bands) covers the entire forecasting engine. No heavy ML libraries needed.

The single-screen UI simplifies the user experience dramatically — everything on one page, one graph, clear metrics, and a table for detail. The import wizard becomes the primary interaction point for getting data in, with the classification step being the core value-add.
