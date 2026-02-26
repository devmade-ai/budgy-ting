# budgy-ting

A local-first progressive web app for planning and tracking household cashflow. Create workspaces for different spending plans, capture once-off or recurring income and expense lines, import actual spend data from CSV or JSON files, and compare projected versus actual spend with automated matching and visual reporting.

All data lives on-device using IndexedDB. No authentication, no server. Exportable as JSON for backup or re-import.

## Features

- **Workspace management** — Create, edit, delete workspaces with monthly or custom date ranges
- **Demo workspace** — Auto-seeded realistic household data on first visit to explore features immediately
- **Expense tracking** — Add once-off or recurring income/expense lines with category autocomplete
- **Projected spend** — View monthly breakdowns calculated from expense frequencies (by item or category)
- **Cashflow forecast** — Running balance timeline showing how your account balance changes month by month
- **Import actuals** — Upload CSV/JSON files with guided column mapping and 3-pass auto-matching
- **Budget vs actuals** — Compare projected and actual spend by line item, category, or month with variance indicators
- **Export/backup** — Download workspace data as JSON, restore from backup, clear all data
- **Offline-first PWA** — Works without internet, installable on mobile, service worker update prompt

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type-check
npm run type-check

# Build for production
npm run build

# Preview production build
npm run preview
```

## Tech Stack

- **Vue 3** (Composition API) + **Vite**
- **TypeScript**
- **UnoCSS** (Tailwind-compatible)
- **Dexie.js** (IndexedDB)
- **vite-plugin-pwa** (Workbox)

## Project Structure

```
src/
├── components/         # Reusable UI components
│   ├── AppLayout.vue           # App shell (header, PWA install/update)
│   ├── WorkspaceForm.vue       # Create/edit workspace form
│   ├── ConfirmDialog.vue       # Destructive action confirmation modal
│   └── ExpenseForm.vue         # Create/edit expense form with autocomplete
├── composables/        # Vue composables (shared logic)
│   ├── useCategoryAutocomplete.ts  # Category autocomplete from IndexedDB
│   ├── useId.ts                    # UUID generation
│   ├── usePWA.ts                   # PWA install prompt + SW updates
│   └── useTimestamp.ts             # ISO timestamp helpers
├── db/                 # Dexie.js database setup
│   ├── index.ts                # Schema v4 definition with migrations
│   └── demoData.ts             # Demo workspace seeding on first visit
├── engine/             # Pure TypeScript calculation engines
│   ├── cashflow.ts            # Running balance / cashflow forecast
│   ├── csvParser.ts            # CSV/JSON file parsing
│   ├── envelope.ts             # Budget envelope tracking
│   ├── exportImport.ts         # Workspace export/import/restore
│   ├── matching.ts             # 3-pass auto-matching algorithm
│   ├── projection.ts           # Recurring expense projection engine
│   └── variance.ts             # Budget vs actual variance calculation
├── router/             # Vue Router configuration
│   └── index.ts                # All routes
├── types/              # TypeScript type definitions
│   └── models.ts               # Workspace, Expense, Actual, CategoryCache
├── views/              # Page-level view components
│   ├── WorkspaceListView.vue   # Home: workspace list + restore
│   ├── WorkspaceCreateView.vue # New workspace form
│   ├── WorkspaceEditView.vue   # Edit workspace form
│   ├── WorkspaceDetailView.vue # Workspace detail with tabs + actions
│   ├── ExpensesTab.vue         # Grouped expense list
│   ├── ExpenseCreateView.vue   # New expense form
│   ├── ExpenseEditView.vue     # Edit expense form
│   ├── ProjectedTab.vue        # Monthly projection table
│   ├── CashflowTab.vue         # Running balance timeline + chart
│   ├── CompareTab.vue          # Variance comparison (3 sub-views)
│   └── ImportWizardView.vue    # 4-step import wizard
├── App.vue             # Root component
└── main.ts             # App entry point
```

## Deployment

Static site deployment via GitHub Pages. `vite build` produces the `dist/` directory.
