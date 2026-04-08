# Farlume

A local-first progressive web app for tracking household cashflow. Create workspaces, import bank statements, detect recurring spending patterns, and forecast your cashflow with statistical models.

All data lives on-device using IndexedDB. No authentication, no server. Exportable as JSON for backup or re-import.

## Features

- **Workspace management** — Create, edit, delete workspaces with monthly or custom date ranges
- **Demo workspace** — Auto-seeded realistic household data on first visit to explore features immediately
- **Transaction import** — Upload CSV/JSON bank statements with a 2-step wizard (upload, review & import)
- **Recurring pattern detection** — Automatically groups similar transactions and detects frequency (daily, weekly, biweekly, monthly, quarterly, annually)
- **Statistical forecasting** — Holt's double exponential smoothing with seasonal adjustments and confidence bands
- **Cash runway** — Enter cash on hand to see how long it lasts with optimistic/expected/pessimistic scenarios
- **Prediction accuracy** — MAE, RMSE, bias, and hit rate metrics computed from backtest forecasts
- **Single-screen dashboard** — Cashflow graph, metrics grid, and transaction table on one page
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

# Run tests
npm run test
```

## Tech Stack

- **Vue 3** (Composition API) + **Vite**
- **TypeScript**
- **Tailwind CSS v4** (with Vite integration)
- **Dexie.js** (IndexedDB)
- **vite-plugin-pwa** (Workbox)
- **ApexCharts** + **vue3-apexcharts** (cashflow graph)
- **simple-statistics** (mean, median, stddev, regression)
- **Transformers.js** (`@huggingface/transformers`) — zero-shot classification + embeddings via Web Worker
- **marked** (markdown rendering in help drawers)

## Project Structure

```
src/
├── components/         # Reusable UI components
│   ├── AppLayout.vue              # App shell (header, burger menu, PWA prompts)
│   ├── BottomSheet.vue              # Mobile-friendly bottom sheet modal
│   ├── CashflowGraph.vue         # ApexCharts daily cashflow line chart
│   ├── ClassificationBadge.vue    # Recurring/once-off classification pill
│   ├── ConfirmDialog.vue          # Destructive action confirmation modal
│   ├── DateInput.vue              # Native date input with calendar icon
│   ├── EmptyState.vue             # Reusable empty state (icon + text + slot)
│   ├── ErrorAlert.vue             # Dismissible error/success/warning banner
│   ├── ErrorBoundary.vue          # Catches render errors, shows recovery UI
│   ├── HelpDrawer.vue             # Slide-out drawer for markdown help content
│   ├── InstallInstructionsModal.vue # Browser-specific PWA install guides
│   ├── InstallPrompt.vue          # PWA install banner (native or manual)
│   ├── LoadingSpinner.vue         # Centered loading indicator
│   ├── MetricCard.vue             # Single metric display card
│   ├── MetricsGrid.vue            # Grid of forecast/accuracy/runway metrics
│   ├── SkeletonLoader.vue         # Placeholder loading skeleton
│   ├── TagSuggestions.vue         # ML-powered tag suggestion chips
│   ├── ToastNotification.vue      # Auto-dismiss toast (success/error/warning)
│   ├── TransactionEditModal.vue   # View/edit transaction details modal
│   ├── TransactionTable.vue       # Transaction list with filtering/sorting
│   ├── TutorialModal.vue          # 6-step first-visit walkthrough carousel
│   └── WorkspaceForm.vue          # Create/edit workspace form
├── composables/        # Vue composables (shared logic)
│   ├── useDialogA11y.ts           # Focus trapping + Escape key for modals
│   ├── useFormValidation.ts       # Shared validation rules (required, dateAfter)
│   ├── useFormat.ts               # formatAmount() number formatting
│   ├── useHaptic.ts               # Haptic feedback for touch interactions
│   ├── useId.ts                   # generateId() UUID generation
│   ├── useInstallReminder.ts      # Delayed PWA install re-prompt
│   ├── usePagination.ts           # Paginated list state management
│   ├── usePWAInstall.ts           # PWA install detection + browser-specific flows
│   ├── usePWAUpdate.ts            # Service worker update prompt (60-min check)
│   ├── usePullToRefresh.ts        # Pull-to-refresh gesture handling
│   ├── useSafeStorage.ts          # Safe localStorage wrapper (quota/privacy)
│   ├── useTagAutocomplete.ts      # touchTags() — update tag cache on use
│   ├── useTagInput.ts             # Tag chip input with autocomplete + keyboard nav
│   ├── useTimestamp.ts            # ISO timestamp helpers
│   ├── useToast.ts                # Singleton toast state management
│   └── useTutorial.ts             # First-visit tutorial state (localStorage)
├── db/                 # Dexie.js database setup
│   ├── index.ts                   # Schema v8 definition with 8 migrations
│   └── demoData.ts                # Demo workspace seeding on first visit
├── debug/              # Alpha-phase diagnostic tools
│   ├── debugLog.ts                # In-memory event store (200-entry circular buffer)
│   └── DebugPill.vue              # Floating debug panel (Log + Environment tabs)
├── ml/                 # ML/AI features (Web Worker-based)
│   ├── embeddingWorker.ts           # Web Worker: text embeddings (all-MiniLM-L6-v2)
│   ├── tagSuggestionWorker.ts       # Web Worker: zero-shot tag classification
│   ├── types.ts                     # Shared ML type definitions
│   ├── useEmbeddings.ts             # Composable: embedding generation + caching
│   ├── useTagSuggestions.ts         # Composable: ML tag suggestion lifecycle
│   └── workerTimeout.ts             # Worker timeout + cleanup utilities
├── engine/             # Pure TypeScript calculation engines
│   ├── accuracy.ts                # Prediction accuracy (MAE, RMSE, bias, WMAPE, hit rate)
│   ├── csvParser.ts               # CSV/JSON file parsing
│   ├── dateUtils.ts               # Date utility functions (formatDate, daysBetween)
│   ├── exportImport.ts            # Workspace export/import/restore (schema v3)
│   ├── forecast.ts                # Holt's double exponential smoothing forecasting
│   ├── matching.ts                # Date/amount parsing, duplicate detection
│   ├── patterns.ts                # Recurring pattern detection + projection
│   ├── runway.ts                  # Cash runway calculation with confidence bands
│   └── transactionMath.ts         # Transaction calculation helpers
├── router/             # Vue Router configuration
│   └── index.ts                   # All routes (lazy-loaded)
├── types/              # TypeScript type definitions
│   └── models.ts                  # Workspace, Transaction, RecurringPattern, ImportBatch, TagCache, EmbeddingCache
├── views/              # Page-level view components
│   ├── WorkspaceListView.vue      # Home: workspace list + restore + clear
│   ├── WorkspaceCreateView.vue    # New workspace form
│   ├── WorkspaceEditView.vue      # Edit workspace form
│   ├── WorkspaceDetailView.vue    # Workspace detail header + actions
│   ├── WorkspaceDashboard.vue     # Single-screen dashboard (graph + metrics + transactions)
│   ├── NewImportWizard.vue        # 2-step import wizard (upload, review & import)
│   └── import-steps/              # Import wizard step components
│       ├── ImportStepUpload.vue   # File upload + column mapping + auto-detection
│       └── ImportStepReview.vue   # Per-transaction review, tagging, classification
├── App.vue             # Root component (AppLayout > ErrorBoundary > RouterView)
└── main.ts             # App entry + debug pill mount + demo seed
```

## Deployment

Deployed to Vercel. `vite build` produces the `dist/` directory. Vercel auto-deploys on push to `main`.
