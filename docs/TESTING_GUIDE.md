# Testing Guide

Manual test scenarios for verifying budgy-ting works correctly. Run through these after making changes.

---

## Quick Regression Checklist

Run through this checklist after any change to verify nothing is broken:

- [ ] App loads without errors (no console errors)
- [ ] Home page lists existing workspaces (demo workspace on first visit)
- [ ] Can create a new workspace (both monthly and custom period types)
- [ ] Can open a workspace and see all 4 tabs (Expenses, Projected, Cashflow, Compare)
- [ ] Can add an expense item
- [ ] Can add an income item
- [ ] Projected tab shows monthly breakdown
- [ ] Cashflow tab shows running balance (requires starting balance)
- [ ] Can import a CSV file through the 4-step wizard
- [ ] Compare tab shows budget vs actuals after import
- [ ] Can export a workspace as JSON
- [ ] Can restore a workspace from exported JSON
- [ ] Can delete a workspace (confirm dialog appears)
- [ ] Menu opens via hamburger icon, shows 5 items (with divider)
- [ ] Tutorial opens via menu → "How it works"
- [ ] User Guide drawer opens via menu → "User Guide"
- [ ] Test Scenarios drawer opens via menu → "Test Scenarios"
- [ ] Import Format drawer opens via menu → "Import Format"
- [ ] Sample CSV drawer opens via menu → "Sample CSV"
- [ ] Build passes: `npm run build`
- [ ] Type-check passes: `npm run type-check`
- [ ] Unit tests pass: `npm run test`

---

## Test Scenarios

### 1. Workspace Management

#### 1.1 Create a Monthly Workspace

**Steps:**
1. Go to home screen
2. Click **New Workspace**
3. Enter name: "Test Monthly"
4. Leave currency as default ("R")
5. Select **Monthly** period type
6. Click **Create workspace**

**Expected:**
- Redirected to workspace detail page
- Workspace name shows "Test Monthly" in header
- "Monthly" period type displayed
- Expenses tab is active and shows empty state: "No items yet"

#### 1.2 Create a Custom-Period Workspace with Starting Balance

**Steps:**
1. Go to home screen
2. Click **New Workspace**
3. Enter name: "Test Custom"
4. Change currency to "$"
5. Select **Custom dates**
6. Set start date to 2026-01-01
7. Set end date to 2026-06-30
8. Check **I know my current balance**
9. Enter starting balance: 10000
10. Click **Create workspace**

**Expected:**
- Redirected to workspace detail page
- Workspace name shows "Test Custom"
- "$" shown as currency
- "Custom period" displayed
- Cashflow tab shows balance data (not the "No starting balance" empty state)

#### 1.3 Workspace Validation Errors

**Steps:**
1. Click **New Workspace**
2. Leave workspace name empty
3. Click **Create workspace**

**Expected:**
- Error shown: "Workspace name is required"
- Form not submitted

**Steps (continued):**
4. Enter a name
5. Select **Custom dates**
6. Set end date before start date
7. Click **Create workspace**

**Expected:**
- Error shown: "End date must be after start date"
- Form not submitted

#### 1.4 Edit a Workspace

**Steps:**
1. Open an existing workspace
2. Click the **Edit** button (pencil icon)
3. Change the workspace name
4. Click **Save changes**

**Expected:**
- Redirected back to workspace detail
- Updated name shown in header

#### 1.5 Delete a Workspace

**Steps:**
1. Open a workspace
2. Click the **Delete** button (trash icon)
3. Confirm dialog appears with workspace name and warning text

**Expected (Cancel):**
4. Click **Cancel**
5. Dialog closes, workspace still exists

**Expected (Confirm):**
4. Click **Delete workspace**
5. Redirected to home screen
6. Deleted workspace no longer in list

#### 1.6 Export and Restore a Workspace

**Steps:**
1. Create a workspace with expenses and some imported data
2. Click **Export** — JSON file downloads
3. Delete the workspace
4. From home screen, click **Restore**
5. Select the exported JSON file

**Expected:**
- Workspace restored with all expenses and imported data intact
- All tabs show the same data as before export

#### 1.7 Restore Over Existing Workspace

**Steps:**
1. Have a workspace named "Test Workspace"
2. Click **Restore** and select a file for a workspace with the same name

**Expected:**
- Dialog asks: "Replace existing workspace?"
- Warning explains data will be overwritten
- Clicking **Replace** overwrites the workspace
- Clicking **Cancel** keeps the original

#### 1.8 Clear All Data

**Steps:**
1. Have at least one workspace
2. From home screen, click **Clear all data**
3. Confirmation dialog appears

**Expected (Confirm):**
4. Click **Clear everything**
5. Success message: "All data cleared"
6. Home screen shows empty state: "No workspaces yet"

#### 1.9 Demo Workspace

**Steps:**
1. Clear all data (or use a fresh browser)
2. Reload the app

**Expected:**
- A "Demo Household" workspace appears automatically
- Contains 16 items (salary, freelance, rent, groceries, etc.)
- Starting balance of R45,000
- All tabs functional with the demo data

---

### 2. Expense Management

#### 2.1 Add an Expense

**Steps:**
1. Open a workspace, go to Expenses tab
2. Click **Add Item**
3. Keep type as **Expense**
4. Description: "Rent"
5. Category: "Housing"
6. Amount: 5000
7. Frequency: **Monthly**
8. Leave dates as defaults
9. Click **Add expense**

**Expected:**
- Redirected to Expenses tab
- "Rent" appears under "Housing" category group
- Shows "R5 000.00/month"
- Header bar shows expense total updated

#### 2.2 Add an Income Item

**Steps:**
1. From Expenses tab, click **Add Item**
2. Switch type to **Income**
3. Description: "Salary"
4. Category: "Employment"
5. Amount: 20000
6. Frequency: **Monthly**
7. Click **Add income**

**Expected:**
- "Salary" appears with green "income" badge
- Header shows income total (green, with "+")

#### 2.3 Category Autocomplete

**Steps:**
1. Add an expense with category "Marketing"
2. Add another expense
3. Start typing "Mar" in the category field

**Expected:**
- Dropdown appears with "Marketing" as a suggestion
- Clicking the suggestion fills the field

#### 2.4 Expense Validation Errors

**Steps:**
1. Click **Add Item**
2. Leave description empty, click submit

**Expected:** Error: "Description is required"

3. Fill description, leave category empty, click submit

**Expected:** Error: "Category is required"

4. Fill category, enter amount as 0 or negative, click submit

**Expected:** Error: "Enter a positive amount"

5. Set end date before start date, click submit

**Expected:** Error: "End date must be after start date"

#### 2.5 Edit an Expense

**Steps:**
1. In Expenses tab, click the **edit** icon on an expense
2. Change the amount
3. Click **Save changes**

**Expected:**
- Redirected to Expenses tab
- Updated amount shown on the expense card
- Header totals updated

#### 2.6 Delete an Expense

**Steps:**
1. In Expenses tab, click the **delete** icon on an expense
2. Confirmation dialog shows item name and amount

**Expected (Confirm):**
3. Click **Delete expense**
4. Item removed from list
5. Header totals updated

#### 2.7 Delete Expense with Linked Actuals

**Steps:**
1. Import actuals matched to an expense (see Import section)
2. Delete that expense

**Expected:**
- Confirmation dialog mentions: "Any matched import data will be unlinked"
- After deletion, imported actuals still appear in Compare tab under "Unbudgeted Spending"
- Actuals are preserved, not deleted

#### 2.8 Expense Frequency Display

**Steps:**
1. Create expenses with each frequency type: Once-off, Daily, Weekly, Monthly, Quarterly, Annually

**Expected each expense shows correct label:**
- Once-off → "R100.00 Once-off"
- Daily → "R100.00/day"
- Weekly → "R100.00/week"
- Monthly → "R100.00/month"
- Quarterly → "R100.00/quarter"
- Annually → "R100.00/year"

---

### 3. Projected Spend

#### 3.1 Monthly Projections — By Item View

**Pre-condition:** Workspace with several expenses at different frequencies.

**Steps:**
1. Open workspace, click **Projected** tab
2. Ensure **By Item** view is selected

**Expected:**
- Table shows one row per expense
- Column per month (12 months for monthly workspaces, or workspace date range for custom)
- Total column on the right
- Monthly expenses show full amount each month
- Weekly expenses show amount × weeks in month (varies slightly per month)
- Once-off expenses show amount only in their start month
- Quarterly expenses show amount every 3 months
- Annually expenses show amount once per year

#### 3.2 Monthly Projections — By Category View

**Steps:**
1. From Projected tab, click **By Category**

**Expected:**
- Rows grouped by category instead of individual items
- Amounts are summed per category per month
- Totals match the "By Item" totals

#### 3.3 Projections with Income

**Pre-condition:** Workspace has both income and expense items.

**Steps:**
1. Open Projected tab

**Expected:**
- **Income** section (green) at top with income rows
- **Expenses** section below
- Footer shows: Total Income, Total Expenses, Net
- Net = Income - Expenses

#### 3.4 Balance Summary with Negative Projection

**Pre-condition:** Workspace with starting balance where expenses exceed income + balance.

**Steps:**
1. Open Projected tab

**Expected:**
- Balance summary card shows Starting Balance, Income, Expenses, Ending Balance
- Warning message in red: "Your balance goes negative in [Month Year]"
- Ending balance shown in red

#### 3.5 Empty State

**Steps:**
1. Open a workspace with no expenses
2. Click **Projected** tab

**Expected:**
- Empty state: "No projections yet" with description "Add expenses to see projected spend over time"

---

### 4. Cashflow Forecast

#### 4.1 Cashflow with Starting Balance

**Pre-condition:** Workspace with starting balance of R10,000 and monthly expenses totalling R3,000.

**Steps:**
1. Open workspace, click **Cashflow** tab

**Expected:**
- Summary card shows Starting Balance: R10,000
- Table shows month-by-month with:
  - Starting row with R10,000
  - Each month's income, expenses, net, and running balance
  - Balance decreasing each month by ~R3,000
- Bar chart shows balance trajectory

#### 4.2 Cashflow with Actuals

**Pre-condition:** Workspace with starting balance, expenses, and imported actuals for at least one month.

**Steps:**
1. Open Cashflow tab

**Expected:**
- Months with imported data show actual amounts (marked with "actual" indicator)
- Months without imported data show projected amounts
- Running balance uses actual where available, projected where not

#### 4.3 Balance Goes Negative

**Pre-condition:** Workspace where expenses will deplete balance.

**Steps:**
1. Open Cashflow tab

**Expected:**
- Warning: "Your balance goes negative in [Month Year]"
- Lowest balance and month shown
- Red bars in chart for negative months

#### 4.4 Missing Starting Balance

**Steps:**
1. Open a workspace without starting balance
2. Click **Cashflow** tab

**Expected:**
- Empty state: "No starting balance set"
- Description: "Enter your current account balance to see how your money flows over time"
- Button: "Set starting balance" linking to workspace edit

#### 4.5 No Expenses

**Steps:**
1. Open a workspace with starting balance but no expenses
2. Click **Cashflow** tab

**Expected:**
- Empty state: "No cashflow data yet"
- Description: "Add income and expense lines to see your cashflow forecast"

---

### 5. Compare (Budget vs Actuals)

#### 5.1 Empty State

**Steps:**
1. Open a workspace with no imported actuals
2. Click **Compare** tab

**Expected:**
- Empty state: "Nothing to compare yet"
- Description: "Import your bank statement to see how your actual spending compares to your budget"
- Button: "Import bank statement"

#### 5.2 Line Items View

**Pre-condition:** Workspace with expenses and imported actuals.

**Steps:**
1. Open Compare tab
2. Select **Line Items** view

**Expected:**
- Table shows each expense: Budgeted, Actual, Variance, %
- Over-budget items shown in red
- Under-budget items shown in green
- "Unbudgeted Spending" section at bottom (if any unmatched imports exist)

#### 5.3 Categories View

**Steps:**
1. From Compare tab, click **Categories**

**Expected:**
- Table shows each category: Budgeted, Actual, Variance, %
- Bar chart below with budgeted (blue) vs actual (green = under, red = over)
- Legend present

#### 5.4 Monthly View

**Steps:**
1. From Compare tab, click **Monthly**

**Expected:**
- Table shows each month: Projected, Actual, Variance, %
- Months without actual data are dimmed
- Bar chart below showing monthly comparison

#### 5.5 Envelope Summary

**Pre-condition:** Workspace with starting balance and imported actuals.

**Steps:**
1. Open Compare tab

**Expected:**
- Envelope card shows: Starting Balance, Spent So Far, Remaining
- If spending is on track: green message with projected surplus
- If overspending: red message with amount over budget
- Daily burn rate or depletion date shown (after importing actuals)

---

### 6. Import Wizard

#### 6.1 Step 1 — File Upload (CSV)

**Pre-condition:** Have a CSV file with columns: Date, Description, Amount, Category.

**Steps:**
1. Open a workspace, click **Import**
2. Click **Choose a file** and select the CSV

**Expected:**
- Preview shows "[N] rows detected with [N] columns"
- Table shows first 5 rows of data
- Columns auto-detected for date, amount, category, description
- **Continue to mapping** button enabled

#### 6.2 Step 1 — File Upload (JSON)

**Steps:**
1. Click **Import**, select a JSON file

**Expected:**
- File parsed, preview shown
- Same auto-detection behavior as CSV

#### 6.3 Step 1 — File Too Large

**Steps:**
1. Click **Import**, select a file larger than 10 MB

**Expected:**
- Error: "File is too large (max 10 MB)"
- Cannot proceed

#### 6.4 Step 1 — Invalid File

**Steps:**
1. Select a file that isn't valid CSV or JSON (e.g. a text file with random content)

**Expected:**
- Error message about parsing failure
- Cannot proceed

#### 6.5 Step 2 — Column Mapping

**Steps:**
1. After uploading, proceed to Step 2
2. Verify auto-detected column assignments are correct
3. If wrong, change dropdown selections
4. Check the date format dropdown matches your file's format
5. Verify the 5-row preview shows correctly parsed data
6. Click **Run matching**

**Expected:**
- Date column and amount column are required (marked with *)
- At least one of category or description is required
- Preview table updates as you change mappings
- Dates and amounts parse correctly in preview

#### 6.6 Step 2 — Bad Date Format

**Steps:**
1. Select a date column with dates in DD/MM/YYYY format
2. Leave date format as MM/DD/YYYY

**Expected:**
- Error: "Many dates couldn't be parsed — check the date format"
- Cannot proceed until format corrected

#### 6.7 Step 2 — Bad Amount Column

**Steps:**
1. Select a description column as the amount column

**Expected:**
- Error: "Many amounts couldn't be parsed — check the amount column"
- Cannot proceed

#### 6.8 Step 3 — Review Matches

**Steps:**
1. After mapping, proceed to Step 3
2. Review the match results

**Expected:**
- Each imported row shows: date, amount, description, category
- Matched rows show confidence badge (high/medium/low) and matched expense name
- Unmatched rows show gray "unmatched" badge
- Summary badges at top show count per confidence level
- High-confidence matches are auto-approved (green checkmark)

#### 6.9 Step 3 — Reassign a Match

**Steps:**
1. On a matched row, click the "Assign to expense" dropdown
2. Select a different expense

**Expected:**
- Match changes to "manual" confidence (blue badge)
- Row marked as approved
- Matched expense name updates

#### 6.10 Step 3 — Mark as Unbudgeted

**Steps:**
1. On a matched row, select **Unbudgeted** from dropdown

**Expected:**
- Match changes to "unmatched" confidence
- Row still approved (will import as unbudgeted)

#### 6.11 Step 3 — Create New Expense from Import

**Steps:**
1. On any row, select **+ Create new...** from the dropdown
2. A form appears pre-filled with:
   - Description from the imported row
   - Category from the imported row
   - Amount from the imported row
   - Type: "Expense" or "Income" (inferred from amount sign — negative amounts default to income)
3. Adjust fields if needed (e.g. change frequency from default "Monthly")
4. Click **Create & assign**

**Expected:**
- New expense created in the database
- Row re-assigned to the newly created expense
- New expense appears in all other rows' dropdowns
- Badge updates to "manual" confidence

#### 6.12 Step 3 — Bulk Approve

**Pre-condition:** Import file has medium and low confidence matches.

**Steps:**
1. Click **Approve all likely** (for medium-confidence rows)
2. Click **Approve all possible** (for low-confidence rows)

**Expected:**
- All rows at that confidence level become approved
- Import count updates

#### 6.13 Step 3 — Un-approve a Row

**Steps:**
1. Click the approve button on an approved row to toggle it off

**Expected:**
- Row becomes un-approved (grayed out)
- Import count decreases
- Row will be skipped during import

#### 6.14 Step 3 — Pagination

**Pre-condition:** Import file with more than 50 rows.

**Steps:**
1. Review page 1 (50 rows)
2. Click **Next** to go to page 2

**Expected:**
- Pagination shows "Page 1 of N"
- Next/Previous buttons work correctly
- All pages show match data

#### 6.15 Step 4 — Import Complete

**Steps:**
1. After reviewing all matches, click **Import [N] rows**

**Expected:**
- Button text changes to "Saving..."
- On success, Step 4 shows:
  - Green checkmark icon
  - "Import Complete"
  - "Successfully imported [N] transactions"
  - Summary: auto-matched, manually approved, unbudgeted counts
- Click **View comparison** → redirected to Compare tab

#### 6.16 Step Navigation — Back Button

**Steps:**
1. On Step 2, click **Back**

**Expected:**
- Returns to Step 1 with file still loaded

2. On Step 3, click **Back**

**Expected:**
- Returns to Step 2 with column mappings preserved

---

### 7. Navigation & UI

#### 7.1 Home Navigation

**Steps:**
1. From any workspace detail page, click **budgy-ting** in the header

**Expected:** Navigated to home screen with workspace list

2. From any workspace detail page, click **Workspaces** breadcrumb

**Expected:** Navigated to home screen

#### 7.2 Tab Navigation

**Steps:**
1. Open a workspace
2. Click each tab in order: Expenses → Projected → Cashflow → Compare

**Expected:**
- Each tab loads its content
- Active tab is visually highlighted
- URL updates to match the tab

#### 7.3 Help Menu

**Steps:**
1. Click the **hamburger menu** icon in the top-right corner

**Expected:**
- Dropdown shows 5 items with a divider: "How it works", "User Guide", "Test Scenarios" | "Import Format", "Sample CSV"
- Clicking outside the dropdown closes it

**Steps (Tutorial):**
2. Click **How it works**

**Expected:**
- Tutorial modal opens with welcome step
- 6 tutorial steps navigable via Next/Back buttons
- Step dots at bottom are clickable
- Last step has **Get started** button
- Clicking Get started or closing dismisses the modal

**Steps (User Guide):**
3. Open menu, click **User Guide**

**Expected:**
- Slide-out drawer appears from right
- Title shows "User Guide"
- Markdown content rendered with headings, lists, bold text
- Scrollable for long content
- Click X or backdrop to close, drawer slides out

**Steps (Test Scenarios):**
4. Open menu, click **Test Scenarios**

**Expected:**
- Slide-out drawer appears from right
- Title shows "Test Scenarios"
- Testing guide markdown rendered correctly
- Checkboxes visible in checklist items

**Steps (Import Format):**
5. Open menu, click **Import Format**

**Expected:**
- Slide-out drawer appears from right
- Title shows "Import Format"
- Shows column requirements table, CSV and JSON examples, date formats, AI prompt
- Code blocks are rendered with monospace styling

**Steps (Sample CSV):**
6. Open menu, click **Sample CSV**

**Expected:**
- Slide-out drawer appears from right
- Title shows "Sample CSV"
- Shows intro text and a code block with CSV data
- CSV content is selectable/copyable

#### 7.4 Browser Back/Forward

**Steps:**
1. Navigate: Home → Workspace → Expenses tab → Add Item → Back → Projected tab
2. Click browser back button multiple times

**Expected:**
- Each back press returns to previous page
- Forward button works to go forward again
- No broken states

---

### 8. PWA Features

#### 8.1 Install Prompt

**Steps:**
1. Open app in Chromium browser for first time (or clear site data)

**Expected:**
- Install banner appears: "Install budgy-ting for quick access"
- "Install" button triggers browser install dialog
- "Not now" dismisses the banner

#### 8.2 Update Available

**Steps:**
1. Deploy a new version
2. Open app (or wait for service worker check)

**Expected:**
- Banner appears: "A new version is available"
- Click **Update now** reloads the app

#### 8.3 Offline Use

**Steps:**
1. Load the app while online
2. Disconnect from internet
3. Continue using the app (create workspace, add expenses, etc.)

**Expected:**
- All local operations work without internet
- Data persists in IndexedDB
- No network errors shown

---

### 9. Edge Cases & Error Handling

#### 9.1 Invalid Workspace URL

**Steps:**
1. Navigate to `/workspace/nonexistent-id`

**Expected:**
- Error message: "Couldn't load this workspace. Please go back and try again."
- Can navigate back to home

#### 9.2 Empty CSV Import

**Steps:**
1. Import a CSV file with only headers (no data rows)

**Expected:**
- Error: "No data found in file"
- Cannot proceed past Step 1

#### 9.3 Currency Symbol Display

**Steps:**
1. Create a workspace with currency "€"
2. Add an expense with amount 1500

**Expected:**
- Amount displays as "€1 500.00" throughout all tabs
- Currency symbol used consistently in projections, cashflow, compare

#### 9.4 Long Workspace/Expense Names

**Steps:**
1. Create a workspace with a very long name (50+ characters)
2. Add an expense with a very long description

**Expected:**
- Text truncates or wraps gracefully
- No layout breaking
- Full name visible in edit forms

#### 9.5 Large Number of Expenses

**Steps:**
1. Create 30+ expenses in a single workspace

**Expected:**
- Expenses tab shows all items grouped by category
- Projected tab handles many rows (may need horizontal scroll)
- Performance remains acceptable

#### 9.6 Decimal Amounts

**Steps:**
1. Create an expense with amount 99.99
2. View in Projected, Cashflow, and Compare tabs

**Expected:**
- Amount shows as "R99.99" (2 decimal places)
- Calculations are accurate (no floating-point rounding errors visible)

#### 9.7 Zero Starting Balance

**Steps:**
1. Create a workspace, check "I know my current balance", enter 0

**Expected:**
- Error: "Enter a positive amount"
- Cannot save with zero balance

**Steps (alternative):**
1. Create a workspace, check "I know my current balance", enter a positive amount
2. Cashflow and Projected tabs show balance data starting from that amount

---

### 10. Data Integrity

#### 10.1 Export/Import Round-Trip

**Steps:**
1. Create a workspace with:
   - Custom name, currency, period type, starting balance
   - 5+ expenses (mix of income/expense, various frequencies)
   - Imported actuals
2. Export the workspace
3. Delete the workspace
4. Restore from the exported file
5. Verify all data matches original

**Expected:**
- Workspace properties identical
- All expenses present with correct values
- All imported actuals present with correct matches
- Projections, cashflow, and compare tabs show same data

#### 10.2 Concurrent Workspaces

**Steps:**
1. Create 3 different workspaces
2. Add expenses to each
3. Import actuals to one of them
4. Switch between workspaces

**Expected:**
- Each workspace's data is isolated
- No cross-contamination between workspaces
- Deleting one workspace doesn't affect others

#### 10.3 Actual Unlinking on Expense Delete

**Steps:**
1. Create a workspace with an expense "Groceries"
2. Import actuals matched to "Groceries"
3. Verify Compare tab shows the match
4. Delete the "Groceries" expense
5. Check Compare tab

**Expected:**
- Previously matched actuals now appear under "Unbudgeted Spending"
- Total actual amount unchanged
- Actuals not deleted, only unlinked
