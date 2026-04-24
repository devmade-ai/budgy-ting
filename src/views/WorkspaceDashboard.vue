<script setup lang="ts">
/**
 * Requirement: Single-screen workspace view — graph + metrics + transaction table.
 *   Replaces the old 3-tab structure (Expenses/Forecast/Compare).
 * Approach: Load transactions + patterns from DB, compute forecast/accuracy/runway,
 *   pass to child components. Cash-on-hand input persisted to workspace.
 *   ML model preloaded for tag suggestions when editing transactions inline.
 * Alternatives:
 *   - Keep 3 tabs: Rejected — single screen per FORECASTING_RESEARCH.md spec
 *   - Lazy-load engines: Considered — data is small enough to compute eagerly
 */

import { ref, computed, defineAsyncComponent, h, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Wallet, Upload } from 'lucide-vue-next'
import { db } from '@/db'
import { buildForecast } from '@/engine/forecast'
import { calculateRunway } from '@/engine/runway'
import { calculateDailyAccuracy, summarizeAccuracy } from '@/engine/accuracy'
import { formatDate } from '@/engine/dateUtils'
import { formatAmount } from '@/composables/useFormat'
import { safeGetItem, safeSetItem } from '@/composables/useSafeStorage'
import { touchTags } from '@/composables/useTagAutocomplete'
import { useTagSuggestions } from '@/ml/useTagSuggestions'
import MetricsGrid from '@/components/MetricsGrid.vue'
import TransactionTable from '@/components/TransactionTable.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import EmptyState from '@/components/EmptyState.vue'

// CashflowGraph is the sole consumer of the ~500 KB ApexCharts bundle.
// Loading it async splits ApexCharts into its own chunk so workspaces with
// no transactions never download it. The loading fallback is a chart-sized
// skeleton to prevent layout shift; a minimal error fallback covers the case
// where the chunk fails to load (offline after SW cache eviction, stale
// deployment, CDN blip) — otherwise Vue would render nothing silently.
const ChartSkeleton = {
  render: () => h('div', {
    role: 'status',
    'aria-label': 'Loading chart…',
    class: 'skeleton h-[280px] sm:h-[350px] lg:h-[420px] w-full mb-6',
  }),
}
const ChartLoadError = {
  render: () => h('div', {
    role: 'alert',
    class: 'text-center py-12 text-sm text-base-content/60 bg-base-200 rounded-lg mb-6',
  }, 'Couldn\'t load the chart. Refresh the page and try again.'),
}
const CashflowGraph = defineAsyncComponent({
  loader: () => import('@/components/CashflowGraph.vue'),
  loadingComponent: ChartSkeleton,
  errorComponent: ChartLoadError,
  delay: 100,
})
import type { Workspace, Transaction, RecurringPattern } from '@/types/models'
import type { ForecastResult } from '@/engine/forecast'
import type { RunwayResult } from '@/engine/runway'
import type { AccuracySummary } from '@/engine/accuracy'
import type { TagSuggestion } from '@/ml/types'

const props = defineProps<{
  workspace: Workspace
}>()

const router = useRouter()
const loading = ref(true)
const transactions = ref<Transaction[]>([])
const patterns = ref<RecurringPattern[]>([])
const error = ref('')
const cashOnHand = ref<number | null>(props.workspace.cashOnHand)

// Requirement: Persist forecast horizon per workspace so it survives navigation
// Approach: localStorage keyed by workspace ID. View preference, not data — doesn't
//   belong in the DB schema alongside actual financial data like cashOnHand.
// Alternatives:
//   - Add to Workspace DB model: Rejected — would require schema migration for a
//     display preference. cashOnHand is persisted to DB because it's financial data.
//   - Don't persist: Rejected — recomputing forecast on every navigation is wasteful
//     and the user's selection is lost, which feels broken.
const FORECAST_MONTHS_KEY = `farlume:forecast-months:${props.workspace.id}`
const DEFAULT_FORECAST_MONTHS = 3
const VALID_FORECAST_MONTHS = [1, 3, 6, 12]

function loadForecastMonths(): number {
  const stored = safeGetItem(FORECAST_MONTHS_KEY)
  if (stored === null) return DEFAULT_FORECAST_MONTHS
  const parsed = Number(stored)
  return VALID_FORECAST_MONTHS.includes(parsed) ? parsed : DEFAULT_FORECAST_MONTHS
}

const forecastMonths = ref(loadForecastMonths())

watch(forecastMonths, (val) => {
  safeSetItem(FORECAST_MONTHS_KEY, String(val))
})

// Debounced mirror of cashOnHand used by the runway computation.
// Typing in the cash-on-hand input fires a keystroke per digit; the immediate
// recompute of runway → CashflowGraph series → ApexCharts re-render causes
// visible flicker during typing. The debounce absorbs bursts of input so the
// chart updates once the user stops typing.
// DB persistence already has its own 500ms debounce further down; this one is
// purely for the reactive recompute path.
const DEBOUNCE_RUNWAY_MS = 300
const cashOnHandForRunway = ref<number | null>(props.workspace.cashOnHand)
let runwayDebounceTimer: ReturnType<typeof setTimeout> | null = null
watch(cashOnHand, (val) => {
  if (runwayDebounceTimer) clearTimeout(runwayDebounceTimer)
  runwayDebounceTimer = setTimeout(() => {
    cashOnHandForRunway.value = val
  }, DEBOUNCE_RUNWAY_MS)
})

// ML tag suggestions
const {
  preloadModel,
  retryModel,
  suggestTags,
  inferring,
  modelError,
  modelReady,
  waitForModel,
  dispose,
} = useTagSuggestions()
const tagSuggestions = ref(new Map<string, TagSuggestion[]>())

// Load data
onMounted(async () => {
  try {
    const [txns, pats] = await Promise.all([
      db.transactions.where('workspaceId').equals(props.workspace.id).toArray(),
      db.patterns.where('workspaceId').equals(props.workspace.id).toArray(),
    ])
    transactions.value = txns
    patterns.value = pats
  } catch {
    error.value = 'Couldn\'t load workspace data. Please try again.'
  } finally {
    loading.value = false
  }

  // Preload ML model for tag suggestions
  preloadModel()
})

function goToImport() {
  router.push({ name: 'import-actuals', params: { id: props.workspace.id } })
}

onUnmounted(() => {
  if (cashSaveTimeout) clearTimeout(cashSaveTimeout)
  if (runwayDebounceTimer) clearTimeout(runwayDebounceTimer)
  dispose()
})

// Compute forecast (user-selectable horizon, default 3 months)
// Note: Date constructor rolls over when day exceeds the target month's length
// (e.g., Jan 31 + 1 month = Mar 3 since Feb 31 doesn't exist). This gives
// slightly more than the requested months, which is preferred for forecasts —
// showing a few extra days is better than clipping short.
const forecast = computed<ForecastResult | null>(() => {
  if (transactions.value.length === 0 && patterns.value.length === 0) return null

  const today = new Date()
  const startDate = formatDate(today)
  const endDate = formatDate(new Date(today.getFullYear(), today.getMonth() + forecastMonths.value, today.getDate()))

  return buildForecast(transactions.value, patterns.value, startDate, endDate)
})

// Compute accuracy (compare past forecast to actuals)
const accuracy = computed<AccuracySummary | null>(() => {
  if (!forecast.value || transactions.value.length === 0) return null

  // Build a "backtest" forecast for the historical period
  const dates = transactions.value.map((t) => t.date).sort()
  if (dates.length < 14) return null

  const firstDate = dates[0]!
  const lastDate = dates[dates.length - 1]!
  const backtestForecast = buildForecast(transactions.value, patterns.value, firstDate, lastDate)

  const dailyAccuracy = calculateDailyAccuracy(backtestForecast.daily, transactions.value)
  return summarizeAccuracy(dailyAccuracy)
})

// Compute runway — uses the debounced cash-on-hand ref so the chart doesn't
// thrash while the user is mid-type. DB persistence uses the raw ref below.
const runway = computed<RunwayResult | null>(() => {
  if (cashOnHandForRunway.value === null || cashOnHandForRunway.value <= 0) return null
  if (!forecast.value) return null
  return calculateRunway(cashOnHandForRunway.value, forecast.value.daily)
})

// Persist cash on hand when changed
let cashSaveTimeout: ReturnType<typeof setTimeout> | null = null
watch(cashOnHand, (val) => {
  if (cashSaveTimeout) clearTimeout(cashSaveTimeout)
  cashSaveTimeout = setTimeout(async () => {
    try {
      await db.workspaces.update(props.workspace.id, { cashOnHand: val, updatedAt: new Date().toISOString() })
    } catch {
      // Silent — non-critical persistence
    }
  }, 500)
})

// Handle transaction field updates from TransactionTable
async function handleUpdateTransaction(id: string, fields: Partial<Transaction>) {
  try {
    await db.transactions.update(id, { ...fields, updatedAt: new Date().toISOString() })

    // Update local ref for immediate UI feedback
    const idx = transactions.value.findIndex((t) => t.id === id)
    if (idx !== -1) {
      transactions.value[idx] = { ...transactions.value[idx], ...fields } as Transaction
    }

    // Update tagCache with any new tags
    if (fields.tags && fields.tags.length > 0) {
      await touchTags(fields.tags)
    }
  } catch {
    error.value = 'Couldn\'t save changes. Please try again.'
  }
}

// Handle transaction deletion
async function handleDeleteTransaction(id: string) {
  try {
    await db.transactions.delete(id)
    transactions.value = transactions.value.filter((t) => t.id !== id)
  } catch {
    error.value = 'Couldn\'t delete the transaction. Please try again.'
  }
}

// Request ML suggestions for a specific transaction
async function handleRequestSuggestions(id: string, description: string) {
  if (tagSuggestions.value.has(id)) return

  // Wait for model to be ready. preloadModel() starts on mount, but the first
  // transaction may open before the download finishes — without this await,
  // suggestTags returns [] silently and the user never sees suggestions for
  // their first row. Also makes the retry flow work: after retryModel kicks
  // off a reload, a subsequent request waits for the new load to complete.
  if (!modelReady.value) {
    const ok = await waitForModel()
    if (!ok) return
  }

  try {
    const suggestions = await suggestTags(description)
    const updated = new Map(tagSuggestions.value)
    updated.set(id, suggestions)
    tagSuggestions.value = updated
  } catch {
    // Silent — ML suggestions are non-critical
  }
}
</script>

<template>
  <div>
    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

    <!-- Empty state: no transactions imported yet.
         Requirement: New workspace lands on a useful CTA, not a blank dashboard.
         The header's Import button is not discoverable from an empty graph.
         Approach: Full-width EmptyState with a primary action routing to the
         import wizard. Suppressed while loading to avoid a flash. -->
    <EmptyState
      v-if="!loading && transactions.length === 0"
      :icon="Upload"
      title="No transactions yet"
      description="Import a CSV or JSON bank statement to see your cashflow, forecast, and runway."
    >
      <button class="btn btn-primary" @click="goToImport">
        <Upload :size="16" class="mr-1 inline-block" aria-hidden="true" />
        Import transactions
      </button>
    </EmptyState>

    <template v-else>
    <!-- Cash on hand input.
         Requirement: AT users must hear the label when focusing the input, and
         mobile users should get the decimal keypad on iOS.
         Approach: Explicit for/id label association (prior markup had a label
         as a sibling with no binding); inputmode="decimal" triggers the iOS
         numeric keypad; step="0.01" lets users enter granular amounts (was 100,
         which forced cents to be a multiple of 100 units). -->
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <label for="cash-on-hand" class="text-sm text-base-content/70 flex items-center gap-2">
        <Wallet :size="16" class="text-base-content/40" aria-hidden="true" />
        Cash on hand
      </label>
      <div class="flex items-center gap-1">
        <span class="text-sm text-base-content/60" aria-hidden="true">{{ workspace.currencyLabel }}</span>
        <input
          id="cash-on-hand"
          v-model.number="cashOnHand"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.01"
          placeholder="0.00"
          :aria-label="`Cash on hand in ${workspace.currencyLabel}`"
          class="input input-bordered w-32 text-base min-h-[44px] no-print"
        />
        <!-- Print-only: static value replaces the interactive input -->
        <span class="hidden print-show text-sm font-medium text-base-content">
          {{ cashOnHand !== null ? formatAmount(cashOnHand) : '—' }}
        </span>
      </div>
      <span v-if="runway && runway.daysRemaining !== null" class="text-sm text-error">
        Runs out {{ runway.depletionDate }}
      </span>
      <span v-else-if="runway" class="text-sm text-success">
        Projected {{ workspace.currencyLabel }}{{ formatAmount(runway.endBalance) }}
      </span>
    </div>

    <!-- Cashflow graph -->
    <CashflowGraph
      :transactions="transactions"
      :forecast-points="forecast?.daily ?? []"
      :runway="runway"
      :currency-label="workspace.currencyLabel"
      :forecast-months="forecastMonths"
      @update:forecast-months="forecastMonths = $event"
    />

    <!-- Metrics grid -->
    <MetricsGrid
      :transactions="transactions"
      :patterns="patterns"
      :currency-label="workspace.currencyLabel"
      :forecast="forecast"
      :runway="runway"
      :accuracy="accuracy"
    />

    <!-- Transaction table -->
    <div class="mt-2">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-base-content">Transactions</h2>
      </div>
      <TransactionTable
        :transactions="transactions"
        :currency-label="workspace.currencyLabel"
        :tag-suggestions="tagSuggestions"
        :suggestions-loading="inferring"
        :suggestions-error="modelError"
        @update-transaction="handleUpdateTransaction"
        @delete-transaction="handleDeleteTransaction"
        @request-suggestions="handleRequestSuggestions"
        @retry-suggestions="retryModel"
      />
    </div>
    </template>
  </div>
</template>
