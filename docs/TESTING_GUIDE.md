# Testing Guide

Manual test scenarios for verifying budgy-ting works correctly. Run through these after making changes.

---

## Quick Regression Checklist

Run through this checklist after any change to verify nothing is broken:

- [ ] App loads without errors (no console errors)
- [ ] Home page lists existing workspaces (demo workspace on first visit)
- [ ] Can create a new workspace (both monthly and custom period types)
- [ ] Can open a workspace and see single-screen dashboard (graph, metrics, transactions)
- [ ] Cash on hand input shows runway result on dashboard
- [ ] Can import a CSV file through the 2-step wizard (upload, review & import)
- [ ] Transactions appear in the table after import
- [ ] Can export a workspace as JSON
- [ ] Can restore a workspace from exported JSON
- [ ] Can delete a workspace (confirm dialog appears)
- [ ] Menu opens via hamburger icon, shows 6 items (with dividers)
- [ ] Tutorial opens via menu → "How it works"
- [ ] User Guide drawer opens via menu → "User Guide"
- [ ] Test Scenarios drawer opens via menu → "Test Scenarios"
- [ ] Import Format drawer opens via menu → "Import Format"
- [ ] Sample CSV drawer opens via menu → "Sample CSV"
- [ ] Check for updates button triggers SW update check
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
- Dashboard shows empty state or graph with no data

#### 1.2 Create a Custom-Period Workspace

**Steps:**
1. Go to home screen
2. Click **New Workspace**
3. Enter name: "Test Custom"
4. Change currency to "$"
5. Select **Custom dates**
6. Set start date to 2026-01-01
7. Set end date to 2026-06-30
8. Click **Create workspace**

**Expected:**
- Redirected to workspace detail page
- Workspace name shows "Test Custom"
- "$" shown as currency
- "Custom period" displayed

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
2. Click the **⋮** menu, then **Edit workspace**
3. Change the workspace name
4. Click **Save changes**

**Expected:**
- Redirected back to workspace detail
- Updated name shown in header

#### 1.5 Delete a Workspace

**Steps:**
1. Open a workspace
2. Click the **⋮** menu, then **Delete workspace**
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
1. Create a workspace with imported transactions
2. Click **⋮** menu → **Export** — JSON file downloads
3. Delete the workspace
4. From home screen, click **Restore**
5. Select the exported JSON file

**Expected:**
- Workspace restored with all transactions, patterns, and import batches intact
- Dashboard shows the same data as before export

#### 1.7 Restore Over Existing Workspace

**Steps:**
1. Have a workspace
2. Click **Restore** and select a file for a workspace with the same ID

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
- Contains sample transactions and recurring patterns
- Dashboard is functional with the demo data

---

### 2. Dashboard

#### 2.1 Dashboard Layout

**Pre-condition:** Workspace with imported transactions.

**Steps:**
1. Open a workspace

**Expected:**
- Cash on hand input at the top
- Cashflow graph showing transaction history and forecast
- Metrics grid below the graph
- Transaction table at the bottom

#### 2.2 Cash on Hand — Runs Out

**Pre-condition:** Workspace where expenses exceed income.

**Steps:**
1. Open workspace dashboard
2. Enter a cash amount in the **Cash on hand** field (e.g. 10000)

**Expected:**
- Shows depletion date in red text
- Value persists when you leave and return to the workspace

#### 2.3 Cash on Hand — Positive Outlook

**Pre-condition:** Workspace where income exceeds expenses.

**Steps:**
1. Open workspace dashboard
2. Enter a cash amount in the **Cash on hand** field

**Expected:**
- Shows projected end balance in green text

#### 2.4 Empty Dashboard

**Steps:**
1. Open a workspace with no transactions

**Expected:**
- Cash on hand input still visible
- Graph shows empty or minimal state
- Transaction table shows no data

#### 2.5 Transaction Table

**Pre-condition:** Workspace with imported transactions.

**Steps:**
1. Open workspace dashboard
2. Scroll to the Transactions section

**Expected:**
- Transactions listed with date, description, amount, and tags
- Amounts formatted with currency symbol

---

### 3. Import Wizard

#### 3.1 Step 1 — File Upload (CSV)

**Pre-condition:** Have a CSV file with columns: Date, Description, Amount.

**Steps:**
1. Open a workspace, click **Import**
2. Click **Choose a file** and select the CSV

**Expected:**
- Preview shows detected rows and columns
- Columns auto-detected for date, amount, description
- Continue button enabled

#### 3.2 Step 1 — File Upload (JSON)

**Steps:**
1. Click **Import**, select a JSON file

**Expected:**
- File parsed, preview shown
- Same auto-detection behavior as CSV

#### 3.3 Step 1 — File Too Large

**Steps:**
1. Click **Import**, select a file larger than 10 MB

**Expected:**
- Error shown
- Cannot proceed

#### 3.4 Step 1 — Invalid File

**Steps:**
1. Select a file that isn't valid CSV or JSON

**Expected:**
- Error message about parsing failure
- Cannot proceed

#### 3.5 Step 1 — Duplicate Detection

**Steps:**
1. Import a CSV file once
2. Try importing the same file again

**Expected:**
- Duplicate rows are skipped
- Message shows how many rows were skipped as duplicates

#### 3.6 Step 2 — Review & Import

**Steps:**
1. After uploading, proceed to Step 2
2. Review the per-transaction list

**Expected:**
- Each transaction shown individually with description, amount, date
- Classification toggle: Recurring / Once-off
- Tag input with autocomplete
- ML tag suggestions shown inline (when model loaded)
- Transactions matching existing patterns auto-classified and highlighted
- Variability selector shown for recurring transactions (Fixed/Variable/Irregular)
- Ignore toggle per transaction
- Pagination for large imports (25 per page)

#### 3.7 Step 2 — Change Classification

**Steps:**
1. Change a transaction from Recurring to Once-off (or vice versa)

**Expected:**
- Classification updates immediately
- Variability selector appears/disappears based on classification

#### 3.8 Step 2 — Bulk Actions

**Steps:**
1. Click **Mark all unmatched as once-off**

**Expected:**
- All unmatched transactions classified as once-off
- Already-matched transactions unchanged

#### 3.9 Step 2 — Import

**Steps:**
1. After reviewing, click **Import transactions**

**Expected:**
- Transactions saved to database
- Recurring patterns created for recurring transactions
- Redirected to workspace dashboard
- New transactions visible in the transaction table

#### 3.10 Step Navigation — Back Button

**Steps:**
1. On Step 2, click **Back** (or the back arrow)

**Expected:**
- Returns to Step 1 with file still loaded

---

### 4. Navigation & UI

#### 4.1 Home Navigation

**Steps:**
1. From any workspace detail page, click **budgy-ting** in the header

**Expected:** Navigated to home screen with workspace list

2. From any workspace detail page, click **Workspaces** breadcrumb

**Expected:** Navigated to home screen

#### 4.2 Workspace Actions Menu

**Steps:**
1. Open a workspace
2. Click the **⋮** (three dots) menu button

**Expected:**
- Dropdown shows: Export, Edit workspace, Delete workspace
- Clicking outside the dropdown closes it

#### 4.3 Help Menu

**Steps:**
1. Click the **hamburger menu** icon in the top-right corner

**Expected:**
- Dropdown shows 6 items with dividers: "How it works", "User Guide", "Test Scenarios" | "Import Format", "Sample CSV" | "Check for updates"
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
- Shows column requirements, CSV and JSON examples, date formats, AI prompt
- Code blocks are rendered with monospace styling

**Steps (Sample CSV):**
6. Open menu, click **Sample CSV**

**Expected:**
- Slide-out drawer appears from right
- Title shows "Sample CSV"
- Shows intro text and a code block with CSV data
- CSV content is selectable/copyable

#### 4.4 Browser Back/Forward

**Steps:**
1. Navigate: Home → Workspace → Import → Back to Workspace
2. Click browser back button multiple times

**Expected:**
- Each back press returns to previous page
- Forward button works to go forward again
- No broken states

---

### 5. PWA Features

#### 5.1 Install Prompt

**Steps:**
1. Open app in Chromium browser for first time (or clear site data)

**Expected:**
- Install banner appears: "Install budgy-ting for quick access"
- "Install" button triggers browser install dialog
- "Not now" dismisses the banner

#### 5.2 Update Available

**Steps:**
1. Deploy a new version
2. Open app (or wait for service worker check)

**Expected:**
- Banner appears: "A new version is available"
- Click **Update now** reloads the app

#### 5.3 Check for Updates (Manual)

**Steps:**
1. Open the hamburger menu
2. Click **Check for updates**

**Expected:**
- Button text changes to "Checking..." briefly
- Returns to "Check for updates" when done
- If an update is available, the update banner appears

#### 5.4 Offline Use

**Steps:**
1. Load the app while online
2. Disconnect from internet
3. Continue using the app (create workspace, import data, etc.)

**Expected:**
- All local operations work without internet
- Data persists in IndexedDB
- No network errors shown

---

### 6. Edge Cases & Error Handling

#### 6.1 Invalid Workspace URL

**Steps:**
1. Navigate to `/workspace/nonexistent-id`

**Expected:**
- Redirected to home screen (workspace list)

#### 6.2 Empty CSV Import

**Steps:**
1. Import a CSV file with only headers (no data rows)

**Expected:**
- Error message about no valid rows
- Cannot proceed past Step 1

#### 6.3 Currency Symbol Display

**Steps:**
1. Create a workspace with currency "€"
2. Import transactions

**Expected:**
- Amount displays with "€" prefix throughout the dashboard
- Currency symbol used consistently

#### 6.4 Long Workspace Names

**Steps:**
1. Create a workspace with a very long name (50+ characters)

**Expected:**
- Text truncates or wraps gracefully
- No layout breaking
- Full name visible in edit form

#### 6.5 Decimal Amounts

**Steps:**
1. Import transactions with decimal amounts

**Expected:**
- Amounts show with 2 decimal places
- Calculations are accurate (no visible floating-point rounding errors)

---

### 7. Data Integrity

#### 7.1 Export/Import Round-Trip

**Steps:**
1. Create a workspace with imported transactions and detected patterns
2. Export the workspace
3. Delete the workspace
4. Restore from the exported file
5. Verify all data matches original

**Expected:**
- Workspace properties identical
- All transactions present with correct values
- All recurring patterns present
- Dashboard shows same data

#### 7.2 Concurrent Workspaces

**Steps:**
1. Create 3 different workspaces
2. Import transactions to each
3. Switch between workspaces

**Expected:**
- Each workspace's data is isolated
- No cross-contamination between workspaces
- Deleting one workspace doesn't affect others
