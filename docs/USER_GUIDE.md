# User Guide

Everything you need to know about using budgy-ting to track and forecast your spending.

---

## Getting Started

budgy-ting is a cashflow tracking tool that runs entirely on your device. No accounts, no cloud, no sign-ups. Your data stays in your browser and never leaves your device.

When you first open the app, a **Demo Household** workspace is created automatically with realistic sample data — salary, rent, groceries, and more. This lets you explore all the features before creating your own workspace.

You can also reopen the tutorial any time from the **menu** (hamburger icon) in the top-right corner.

---

## Workspaces

A workspace is the top-level container for your transactions, recurring patterns, and forecasts.

### Creating a Workspace

1. From the home screen, click **New Workspace** (or **Create your first workspace** if you have none yet)
2. Fill in the form:
   - **Workspace name** — Give it a meaningful name (e.g. "Household", "Side Business")
   - **Currency symbol** — The symbol shown next to amounts (e.g. "R", "$", "€"). Display only — doesn't do conversions
   - **Period type** — Choose **Monthly** (rolling view) or **Custom dates** (fixed start and end dates)
   - **Start date** / **End date** — Only shown for custom-date workspaces. End date is optional
3. Click **Create workspace**

### Editing a Workspace

1. Open the workspace you want to edit
2. Click the **⋮** menu (three dots) in the top-right, then **Edit workspace**
3. Change any fields and click **Save changes**

### Deleting a Workspace

1. Open the workspace
2. Click the **⋮** menu, then **Delete workspace**
3. A confirmation dialog will explain what gets deleted: the workspace, all its transactions, patterns, and imported data
4. Click **Delete workspace** to confirm, or **Cancel** to go back

### Exporting a Workspace

1. Open the workspace
2. Click the **⋮** menu, then **Export**
3. A JSON file downloads to your device containing the workspace and all its data
4. Use this file as a backup or to move your workspace to another device

### Restoring from a Backup

1. From the home screen, click **Restore** (or **Restore from file** if you have no workspaces)
2. Select a previously exported JSON file
3. If a workspace with the same ID already exists, you'll be asked whether to **Replace** it or **Cancel**
4. The workspace and all its data will be restored

### Clearing All Data

1. From the home screen, scroll to the bottom and click **Clear all data**
2. A confirmation dialog warns that this deletes everything permanently
3. Click **Clear everything** to confirm
4. Make sure you've exported anything you want to keep first

---

## The Dashboard

When you open a workspace, you see a single-screen dashboard with three sections:

### Cash on Hand

At the top, there's a **Cash on hand** input where you can enter how much cash you currently have. This is saved to the workspace automatically.

- Enter any amount and the app shows your projected end balance or when your cash runs out
- The forecast is based on your recurring patterns and transaction history

### Cashflow Graph

An interactive line chart showing:
- **Historical transactions** — your actual daily cashflow
- **Forecast** — projected future cashflow based on patterns (shown as a dashed line)

### Metrics Grid

Key financial metrics at a glance:
- Transaction counts and totals
- Forecast accuracy (MAE, hit rate) when enough historical data exists
- Runway information (when cash on hand is set)

### Transaction Table

A list of all transactions in the workspace, showing date, description, amount, and tags.

---

## Importing Transactions

The import wizard lets you upload your bank statement and classify transactions. It's a 3-step process.

For details on file format, supported columns, and a ready-to-copy AI prompt for converting bank statements, open **Import Format** from the menu. A **Sample CSV** is also available there to test with.

### Step 1: Upload File

1. From the workspace, click **Import**
2. Click **Choose a file** and select a CSV or JSON file (max 10 MB)
3. The app reads your file and auto-detects which columns contain dates, amounts, and descriptions
4. A preview table shows the first few rows
5. Select the correct columns if auto-detection was wrong
6. Click **Continue**

Duplicate transactions (matching date, amount, and description) are automatically skipped.

### Step 2: Classify Transactions

The app groups similar transactions together and lets you classify each group:

- **Recurring** — This is a regular payment (rent, salary, subscription). A recurring pattern will be created or updated, and these transactions will feed the forecast engine.
- **Once-off** — A one-time transaction (doesn't repeat). Still imported, but not used for pattern-based forecasting.
- **Ignore** — Skip this group entirely (won't be imported).

For each group, you can see:
- The description and number of occurrences
- The average amount and detected frequency
- Whether it matches an existing recurring pattern

Click **Continue** when you've classified all groups.

### Step 3: Confirm & Import

A summary shows:
- How many recurring groups and once-off transactions will be imported
- Total transaction count

Click **Import transactions** to save everything. You'll be redirected back to the workspace dashboard.

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

### Help Menu

Click the **menu** icon (hamburger) in the top-right corner to access:

- **How it works** — Reopens the step-by-step tutorial walkthrough
- **User Guide** — Opens this guide in a slide-out panel within the app
- **Test Scenarios** — Opens the manual testing checklist in a slide-out panel
- **Import Format** — Shows what your import file should look like, with examples and an AI conversion prompt
- **Sample CSV** — A ready-to-use sample import file you can copy
