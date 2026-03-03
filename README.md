# budgy-ting

A local-first progressive web app for planning and tracking household cashflow. Create workspaces for different spending plans, capture once-off or recurring income and expense lines, import actual spend data from CSV or JSON files, and compare projected versus actual spend with automated matching and visual reporting.

All data lives on-device using IndexedDB. No authentication, no server. Exportable as JSON for backup or re-import.

## Features

- **Workspace management** — Create, edit, delete workspaces with monthly or custom date ranges
- **Demo workspace** — Auto-seeded realistic household data on first visit to explore features immediately
- **Expense tracking** — Add once-off or recurring income/expense lines with category autocomplete
- **Projected spend** — View monthly breakdowns calculated from expense frequencies (by item or category)
- **Cash runway** — Enter cash on hand to see how long it lasts based on your forecast (not stored)
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
│   ├── AppLayout.vue              # App shell (header, burger menu, PWA prompts)
│   ├── ConfirmDialog.vue          # Destructive action confirmation modal
│   ├── DateInput.vue              # Native date input with calendar icon
│   ├── EmptyState.vue             # Reusable empty state (icon + text + slot)
│   ├── ErrorAlert.vue             # Dismissible error/success/warning banner
│   ├── ErrorBoundary.vue          # Catches render errors, shows recovery UI
│   ├── ExpenseForm.vue            # Create/edit expense with multi-tag input
│   ├── HelpDrawer.vue             # Slide-out drawer for markdown help content
│   ├── InstallInstructionsModal.vue # Browser-specific PWA install guides
│   ├── InstallPrompt.vue          # PWA install banner (native or manual)
│   ├── LoadingSpinner.vue         # Centered loading indicator
│   ├── ScrollHint.vue             # Gradient fade for horizontal scroll overflow
│   ├── ToastNotification.vue      # Auto-dismiss toast (success/error/warning)
│   ├── TutorialModal.vue          # 6-step first-visit walkthrough carousel
│   └── WorkspaceForm.vue          # Create/edit workspace form
├── composables/        # Vue composables (shared logic)
│   ├── useDialogA11y.ts           # Focus trapping + Escape key for modals
│   ├── useFormValidation.ts       # Shared validation rules (required, positive, dateAfter)
│   ├── useFormat.ts               # formatAmount() number formatting
│   ├── useId.ts                   # UUID generation
│   ├── usePWAInstall.ts           # PWA install detection + browser-specific flows
│   ├── usePWAUpdate.ts            # Service worker update prompt (60-min check)
│   ├── useTagAutocomplete.ts      # Tag suggestions from IndexedDB tagCache
│   ├── useTimestamp.ts            # ISO timestamp helpers
│   ├── useToast.ts                # Singleton toast state management
│   └── useTutorial.ts             # First-visit tutorial state (localStorage)
├── db/                 # Dexie.js database setup
│   ├── index.ts                   # Schema v5 definition with 5 migrations
│   └── demoData.ts                # Demo workspace seeding on first visit
├── debug/              # Alpha-phase diagnostic tools
│   ├── debugLog.ts                # In-memory event store (200-entry circular buffer)
│   └── DebugPill.vue              # Floating debug panel (Log + Environment tabs)
├── engine/             # Pure TypeScript calculation engines
│   ├── csvParser.ts               # CSV/JSON file parsing
│   ├── exportImport.ts            # Workspace export/import/restore (schema v2)
│   ├── matching.ts                # 3-pass auto-matching algorithm
│   ├── projection.ts              # Recurring expense projection engine
│   └── variance.ts                # Budget vs actual variance calculation
├── router/             # Vue Router configuration
│   └── index.ts                   # All routes (lazy-loaded)
├── types/              # TypeScript type definitions
│   └── models.ts                  # Workspace, Expense, Actual, TagCache
├── views/              # Page-level view components
│   ├── WorkspaceListView.vue      # Home: workspace list + restore + clear
│   ├── WorkspaceCreateView.vue    # New workspace form
│   ├── WorkspaceEditView.vue      # Edit workspace form
│   ├── WorkspaceDetailView.vue    # Workspace detail with tabs + actions
│   ├── ExpensesTab.vue            # Grouped expense list (by primary tag)
│   ├── ExpenseCreateView.vue      # New expense form
│   ├── ExpenseEditView.vue        # Edit expense form
│   ├── ProjectedTab.vue           # Monthly projection table + cash runway
│   ├── CompareTab.vue             # Variance comparison (delegates to sub-views)
│   ├── ImportWizardView.vue       # 4-step import wizard (orchestrator)
│   ├── compare-views/             # Compare tab sub-components
│   │   ├── CompareLineItems.vue   # Per-expense variance table
│   │   ├── CompareCategories.vue  # Category-grouped variance + bar chart
│   │   └── CompareMonthly.vue     # Month-by-month variance + bar chart
│   └── import-steps/              # Import wizard step components
│       ├── ImportStepUpload.vue   # File upload + auto-detection
│       ├── ImportStepMapping.vue  # Column mapping + validation
│       ├── ImportStepReview.vue   # Match review + approval + pagination
│       └── ImportStepComplete.vue # Import success summary
├── App.vue             # Root component (AppLayout > ErrorBoundary > RouterView)
└── main.ts             # App entry + debug pill mount + demo seed
```

## Deployment

Deployed to Vercel. `vite build` produces the `dist/` directory. Vercel auto-deploys on push to `main`.
