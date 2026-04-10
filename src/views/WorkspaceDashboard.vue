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

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Wallet } from 'lucide-vue-next'
import { db } from '@/db'
import { buildForecast } from '@/engine/forecast'
import { calculateRunway } from '@/engine/runway'
import { calculateDailyAccuracy, summarizeAccuracy } from '@/engine/accuracy'
import { formatDate } from '@/engine/dateUtils'
import { formatAmount } from '@/composables/useFormat'
import { touchTags } from '@/composables/useTagAutocomplete'
import { useTagSuggestions } from '@/ml/useTagSuggestions'
import CashflowGraph from '@/components/CashflowGraph.vue'
import MetricsGrid from '@/components/MetricsGrid.vue'
import TransactionTable from '@/components/TransactionTable.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import type { Workspace, Transaction, RecurringPattern } from '@/types/models'
import type { ForecastResult } from '@/engine/forecast'
import type { RunwayResult } from '@/engine/runway'
import type { AccuracySummary } from '@/engine/accuracy'
import type { TagSuggestion } from '@/ml/types'

const props = defineProps<{
  workspace: Workspace
}>()

const transactions = ref<Transaction[]>([])
const patterns = ref<RecurringPattern[]>([])
const error = ref('')
const cashOnHand = ref<number | null>(props.workspace.cashOnHand)
const forecastMonths = ref(3)

// ML tag suggestions
const { preloadModel, suggestTags, inferring, dispose } = useTagSuggestions()
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
  }

  // Preload ML model for tag suggestions
  preloadModel()
})

onUnmounted(() => {
  if (cashSaveTimeout) clearTimeout(cashSaveTimeout)
  dispose()
})

// Compute forecast (user-selectable horizon, default 3 months)
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

// Compute runway
const runway = computed<RunwayResult | null>(() => {
  if (cashOnHand.value === null || cashOnHand.value <= 0) return null
  if (!forecast.value) return null
  return calculateRunway(cashOnHand.value, forecast.value.daily)
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

    <!-- Cash on hand input -->
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <label class="text-sm text-base-content/70 flex items-center gap-2">
        <Wallet :size="16" class="text-base-content/40" />
        Cash on hand
      </label>
      <div class="flex items-center gap-1">
        <span class="text-sm text-base-content/60">{{ workspace.currencyLabel }}</span>
        <input
          v-model.number="cashOnHand"
          type="number"
          min="0"
          step="100"
          placeholder="0.00"
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
        @update-transaction="handleUpdateTransaction"
        @delete-transaction="handleDeleteTransaction"
        @request-suggestions="handleRequestSuggestions"
      />
    </div>
  </div>
</template>
