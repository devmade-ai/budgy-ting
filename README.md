# budgy-ting

A local-first progressive web app for planning and tracking expenses against budgets. Capture planned costs as once-off or recurring line items, import actual spend data from CSV or JSON files, and compare projected versus actual spend with automated matching and visual reporting.

All data lives on-device using IndexedDB. No authentication, no server. Exportable as JSON for backup or re-import.

## Features

- **Budget management** — Create, edit, delete budgets with monthly or custom date ranges
- **Expense tracking** — Add once-off or recurring expense lines with category autocomplete
- **Projected spend** — View monthly breakdowns calculated from expense frequencies (by item or category)
- **Import actuals** — Upload CSV/JSON files with guided column mapping and 3-pass auto-matching
- **Budget vs actuals** — Compare projected and actual spend by line item, category, or month with variance indicators
- **Export/backup** — Download budget data as JSON, restore from backup, clear all data
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
│   ├── BudgetForm.vue          # Create/edit budget form
│   ├── ConfirmDialog.vue       # Destructive action confirmation modal
│   └── ExpenseForm.vue         # Create/edit expense form with autocomplete
├── composables/        # Vue composables (shared logic)
│   ├── useCategoryAutocomplete.ts  # Category autocomplete from IndexedDB
│   ├── useId.ts                    # UUID generation
│   ├── usePWA.ts                   # PWA install prompt + SW updates
│   └── useTimestamp.ts             # ISO timestamp helpers
├── db/                 # Dexie.js database setup
│   └── index.ts                # Schema v1 definition
├── engine/             # Pure TypeScript calculation engines
│   ├── csvParser.ts            # CSV/JSON file parsing
│   ├── exportImport.ts         # Budget export/import/restore
│   ├── matching.ts             # 3-pass auto-matching algorithm
│   ├── projection.ts           # Recurring expense projection engine
│   └── variance.ts             # Budget vs actual variance calculation
├── router/             # Vue Router configuration
│   └── index.ts                # All routes
├── types/              # TypeScript type definitions
│   └── models.ts               # Budget, Expense, Actual, CategoryCache
├── views/              # Page-level view components
│   ├── BudgetListView.vue      # Home: budget list + restore
│   ├── BudgetCreateView.vue    # New budget form
│   ├── BudgetEditView.vue      # Edit budget form
│   ├── BudgetDetailView.vue    # Budget detail with tabs + actions
│   ├── ExpensesTab.vue         # Grouped expense list
│   ├── ExpenseCreateView.vue   # New expense form
│   ├── ExpenseEditView.vue     # Edit expense form
│   ├── ProjectedTab.vue        # Monthly projection table
│   ├── CompareTab.vue          # Variance comparison (3 sub-views)
│   └── ImportWizardView.vue    # 4-step import wizard
├── App.vue             # Root component
└── main.ts             # App entry point
```

## Deployment

Static site deployment via GitHub Pages. `vite build` produces the `dist/` directory.
