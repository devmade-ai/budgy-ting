# User Guide

Everything you need to know about using budgy-ting to plan and track your spending.

---

## Getting Started

budgy-ting is a budgeting tool that runs entirely on your device. No accounts, no cloud, no sign-ups. Your data stays in your browser and never leaves your device.

When you first open the app, a **Demo Household** workspace is created automatically with realistic sample data — salary, rent, groceries, and more. This lets you explore all the features before creating your own workspace.

You can also reopen the tutorial any time from the **menu** (hamburger icon) in the top-right corner.

---

## Workspaces

A workspace is the top-level container for your spending plan. Each workspace has its own expenses, projections, and imported data.

### Creating a Workspace

1. From the home screen, click **New Workspace** (or **Create your first workspace** if you have none yet)
2. Fill in the form:
   - **Workspace name** — Give it a meaningful name (e.g. "Wedding Budget", "Q1 Marketing")
   - **Currency symbol** — The symbol shown next to amounts (e.g. "R", "$", "€"). Display only — doesn't do conversions
   - **Period type** — Choose **Monthly** (rolling 12-month view) or **Custom dates** (fixed start and end dates)
   - **Start date** / **End date** — Only shown for custom-date workspaces. End date is optional
3. Click **Create workspace**

### Editing a Workspace

1. Open the workspace you want to edit
2. Click the **Edit** button (pencil icon) in the top-right
3. Change any fields and click **Save changes**

### Deleting a Workspace

1. Open the workspace
2. Click the **Delete** button (trash icon, red)
3. A confirmation dialog will explain what gets deleted: the workspace, all its expenses, and all imported data
4. Click **Delete workspace** to confirm, or **Cancel** to go back

### Exporting a Workspace

1. Open the workspace
2. Click **Export** (download icon)
3. A JSON file downloads to your device containing the workspace, all expenses, and all imported data
4. Use this file as a backup or to move your workspace to another device

### Restoring from a Backup

1. From the home screen, click **Restore** (or **Restore from file** if you have no workspaces)
2. Select a previously exported JSON file (max 10 MB)
3. If a workspace with the same name already exists, you'll be asked whether to **Replace** it or **Cancel**
4. The workspace and all its data will be restored

### Clearing All Data

1. From the home screen, scroll to the bottom and click **Clear all data**
2. A confirmation dialog warns that this deletes everything permanently
3. Click **Clear everything** to confirm
4. Make sure you've exported anything you want to keep first

---

## Expenses

Expenses are the individual line items in your workspace — the things you plan to spend on (or earn).

### Adding an Expense

1. Open a workspace and go to the **Expenses** tab
2. Click **Add Item** (or **Add your first item** if the list is empty)
3. Fill in the form:
   - **Type** — Choose **Expense** (money going out) or **Income** (money coming in)
   - **Description** — What the item is (e.g. "Venue hire", "Monthly hosting")
   - **Category** — Group label (e.g. "Venue", "Marketing", "Software"). As you type, suggestions appear from categories you've used before
   - **Amount** — The cost per occurrence (always a positive number)
   - **How often?** — How frequently this item repeats:
     - **Once-off** — Happens only once
     - **Daily** — Every day
     - **Weekly** — Every week
     - **Monthly** — Every month
     - **Quarterly** — Every 3 months
     - **Annually** — Once a year
   - **Start date** — When this expense begins
   - **End date** (optional) — When this expense stops recurring
4. Click **Add expense** (or **Add income** for income items)

### Editing an Expense

1. In the Expenses tab, find the item and click the **edit** icon (pencil)
2. Change any fields and click **Save changes**

### Deleting an Expense

1. In the Expenses tab, find the item and click the **delete** icon (trash)
2. The confirmation dialog shows the item name and amount
3. If you've imported actual spending matched to this expense, those imports will be unlinked (not deleted)
4. Click **Delete expense** to confirm

### Understanding the Expenses List

- Items are grouped by **category** (alphabetically)
- Each item shows its description, amount, and frequency (e.g. "R500/month")
- Income items are tagged with a green **income** badge
- The header bar shows:
  - Total item count
  - Total income (green, with "+")
  - Total expenses (red, with "-")
  - All amounts are converted to a monthly equivalent for easy comparison

---

## Projected Spend

The Forecast tab shows a month-by-month breakdown of your planned spending based on your expense items and their frequencies.

### Viewing Projections

1. Open a workspace and click the **Forecast** tab (trending-up icon)
2. The table shows:
   - **Rows:** Your expense items (or categories, depending on view mode)
   - **Columns:** One column per month, plus a **Total** column
   - **Income section** (green) if you have income items
   - **Expenses section** with per-row and total amounts
   - **Net section** showing income minus expenses (if you have income items)

### Switching Views

- Click **Each item** to see each individual expense as its own row
- Click **Group by tag** to see expenses grouped and totalled by tag

### Cash on Hand

At the top of the Forecast tab, there's a **Cash on hand** input where you can enter how much cash you currently have. This is not stored — it's a quick calculator to see how long your cash will last based on your forecast.

- **Enter any amount** and the app immediately shows:
  - If your cash **runs out**: "Runs out in [month]"
  - If your cash **grows** (income exceeds expenses): "Cash is growing — R[amount] after [N] months"
  - If your cash **lasts**: "Lasts all [N] months — R[amount] remaining"

---

## Compare (Budget vs Actuals)

The Compare tab shows how your actual spending stacks up against your planned budget. You need to import actual spending data first (see Import section below).

### Summary Bar

At the top, three figures show:
- **Budgeted** — Total planned spend
- **Actual** — Total actual spend from imports
- **Variance** — The difference (red if over budget, green if under)

### Three View Modes

Click the toggle buttons to switch between views:

**Line Items** — Shows each expense individually:
- Columns: Expense name, Budgeted, Actual, Variance, %
- Red = over budget, green = under budget
- An "Unbudgeted Spending" section at the bottom shows any imported transactions that weren't matched to an expense

**Categories** — Groups spending by category:
- Columns: Category, Budgeted, Actual, Variance, %
- Visual bar chart below showing budgeted vs actual per category
- Legend: blue = budgeted, green = under budget, red = over budget

**Monthly** — Shows month-by-month comparison:
- Columns: Month, Projected, Actual, Variance, %
- Dimmed rows indicate months with no actual data yet
- Visual bar chart below showing projected vs actual per month

---

## Importing Actual Spending

The import wizard lets you upload your bank statement or spending data and match it against your budget. It's a 4-step process.

For details on file format, supported columns, and a ready-to-copy AI prompt for converting bank statements, open **Import Format** from the menu. A **Sample CSV** is also available there to test with.

### Step 1: Upload File

1. From the workspace detail page, click **Import**
2. Click **Choose a file** and select a CSV or JSON file (max 10 MB)
3. The app reads your file and auto-detects which columns contain dates, amounts, categories, and descriptions
4. A preview table shows the first few rows
5. Click **Continue to mapping**

### Step 2: Map Columns

1. The app shows dropdown selectors for each column type:
   - **Date column** (required) — Which column has the transaction date
   - **Amount column** (required) — Which column has the amount
   - **Category column** (optional) — Which column has the merchant or category
   - **Description column** (optional) — Which column has the transaction description
   - At least one of Category or Description is required
2. Select a **date format** if the auto-detected one is wrong
3. A preview table shows how the first 5 rows will be parsed
4. Click **Run matching** to proceed

### Step 3: Review Matches

The app automatically matches your imported transactions to your budget expenses using a 3-pass algorithm:

- **High confidence** (green) — Exact category and amount match. Auto-approved
- **Medium confidence** (yellow) — Close category/description match with exact amount. Needs review
- **Low confidence** (orange) — Amount match only. Needs review
- **Unmatched** (gray) — No match found

For each transaction, you can:
- **Approve or un-approve** — Click the approve button to include/exclude the row
- **Reassign** — Use the dropdown to assign the transaction to a different expense, or select "Unbudgeted" for transactions that aren't in your plan
- **Create a new expense** — Select **+ Create new...** from the dropdown to create a new expense line right from the import screen. The form pre-fills from the imported row data

Bulk actions at the top let you **Approve all likely** or **Approve all possible** matches at once.

The summary badges show how many transactions are in each confidence level.

Click **Import [N] rows** when you're happy with the matches.

### Step 4: Complete

A summary shows:
- How many transactions were imported
- How many were auto-matched, manually approved, or unbudgeted

Click **View comparison** to go straight to the Compare tab and see your budget vs actuals.

---

## Other Features

### Installing the App

budgy-ting is a Progressive Web App (PWA) — you can install it on your phone or computer for quick access. When the install banner appears, click **Install**. On Safari or Firefox, click **How to Install** for instructions.

### App Updates

When a new version is available, a banner appears at the top: "A new version is available." Click **Update now** to reload with the latest version.

### Offline Use

After your first visit, the app works fully offline. A green notification confirms: "App is ready for offline use."

### Navigation

- Click **budgy-ting** in the header to go back to the home screen from anywhere
- On workspace pages, click **Workspaces** in the breadcrumb to return to the workspace list
- Use the tab bar (Expenses, Forecast, Compare) to switch between views within a workspace

### Help Menu

Click the **menu** icon (hamburger) in the top-right corner to access:

- **How it works** — Reopens the step-by-step tutorial walkthrough
- **User Guide** — Opens this guide in a slide-out panel within the app
- **Test Scenarios** — Opens the manual testing checklist in a slide-out panel
- **Import Format** — Shows what your import file should look like, with examples and an AI conversion prompt
- **Sample CSV** — A ready-to-use sample import file you can copy
