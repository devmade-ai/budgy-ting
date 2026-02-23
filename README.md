# budgy-ting

A local-first progressive web app for planning and tracking expenses against budgets. Capture planned costs as once-off or recurring line items, import actual spend data from CSV or JSON files, and compare projected versus actual spend with automated matching and visual reporting.

All data lives on-device using IndexedDB. No authentication, no server. Exportable as JSON for backup or re-import.

## Features

- **Budget management** — Create named budgets with monthly or custom date ranges
- **Expense tracking** — Add once-off or recurring expense lines with category autocomplete
- **Projected spend** — View monthly breakdowns calculated from expense frequencies
- **Import actuals** — Upload CSV/JSON files with guided column mapping and auto-matching
- **Budget vs actuals** — Compare projected and actual spend by line item, category, or month
- **Export/backup** — Download budget data as JSON for backup or re-import
- **Offline-first PWA** — Works without internet, installable on mobile

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
- **ApexCharts** (vue3-apexcharts)
- **Fuse.js** (fuzzy matching)
- **date-fns** (date utilities)
- **vite-plugin-pwa** (Workbox)

## Project Structure

```
src/
├── components/     # Reusable UI components
│   └── AppLayout.vue       # App shell (header, content area)
├── composables/    # Vue composables (shared logic)
├── db/             # Dexie.js database setup
│   └── index.ts            # Schema definition and db instance
├── router/         # Vue Router configuration
│   └── index.ts            # Routes (budget list, budget detail + tabs)
├── types/          # TypeScript type definitions
│   └── models.ts           # Budget, Expense, Actual, CategoryCache
├── views/          # Page-level view components
│   ├── BudgetListView.vue  # Home: list of all budgets
│   ├── BudgetDetailView.vue # Budget detail with tab navigation
│   ├── ExpensesTab.vue     # Expenses tab (stub)
│   ├── ProjectedTab.vue    # Projected spend tab (stub)
│   └── CompareTab.vue      # Comparison tab (stub)
├── App.vue         # Root component
└── main.ts         # App entry point
```

## Deployment

Static site deployment via GitHub Pages. `vite build` produces the `dist/` directory.
