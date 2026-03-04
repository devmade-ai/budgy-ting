<script setup lang="ts">
/**
 * Requirement: Single-screen workspace view — graph + metrics + transaction table.
 *   Replaces the old 3-tab structure (Expenses/Forecast/Compare).
 * Approach: Load transactions + patterns from DB, compute forecast/accuracy/runway,
 *   pass to child components. Cash-on-hand input persisted to workspace.
 * Alternatives:
 *   - Keep 3 tabs: Rejected — single screen per FORECASTING_RESEARCH.md spec
 *   - Lazy-load engines: Considered — data is small enough to compute eagerly
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { db } from '@/db'
import { buildForecast } from '@/engine/forecast'
import { calculateRunway } from '@/engine/runway'
import { calculateDailyAccuracy, summariseAccuracy } from '@/engine/accuracy'
import { formatDate } from '@/engine/dateUtils'
import { formatAmount } from '@/composables/useFormat'
import CashflowGraph from '@/components/CashflowGraph.vue'
import MetricsGrid from '@/components/MetricsGrid.vue'
import TransactionTable from '@/components/TransactionTable.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import type { Workspace, Transaction, RecurringPattern } from '@/types/models'
import type { ForecastResult } from '@/engine/forecast'
import type { RunwayResult } from '@/engine/runway'
import type { AccuracySummary } from '@/engine/accuracy'

const props = defineProps<{
  workspace: Workspace
}>()

const transactions = ref<Transaction[]>([])
const patterns = ref<RecurringPattern[]>([])
const error = ref('')
const cashOnHand = ref<number | null>(props.workspace.cashOnHand)

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
})

// Compute forecast (90 days ahead from today)
const forecast = computed<ForecastResult | null>(() => {
  if (transactions.value.length === 0 && patterns.value.length === 0) return null

  const today = new Date()
  const startDate = formatDate(today)
  const endDate = formatDate(new Date(today.getFullYear(), today.getMonth() + 3, today.getDate()))

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
  return summariseAccuracy(dailyAccuracy)
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

onUnmounted(() => {
  if (cashSaveTimeout) clearTimeout(cashSaveTimeout)
})
</script>

<template>
  <div>
    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

    <!-- Cash on hand input -->
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <label class="text-sm text-gray-600 flex items-center gap-2">
        <span class="i-lucide-wallet text-base text-gray-400" />
        Cash on hand
      </label>
      <div class="flex items-center gap-1">
        <span class="text-sm text-gray-500">{{ workspace.currencyLabel }}</span>
        <input
          v-model.number="cashOnHand"
          type="number"
          min="0"
          step="100"
          placeholder="0.00"
          class="input text-sm w-32 min-h-[44px]"
        />
      </div>
      <span v-if="runway && runway.daysRemaining !== null" class="text-sm text-red-500">
        Runs out {{ runway.depletionDate }}
      </span>
      <span v-else-if="runway" class="text-sm text-green-600">
        Projected {{ workspace.currencyLabel }}{{ formatAmount(runway.endBalance) }}
      </span>
    </div>

    <!-- Cashflow graph -->
    <CashflowGraph
      :transactions="transactions"
      :forecast-points="forecast?.daily ?? []"
      :runway="runway"
      :currency-label="workspace.currencyLabel"
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
        <h2 class="text-lg font-semibold text-gray-900">Transactions</h2>
      </div>
      <TransactionTable
        :transactions="transactions"
        :currency-label="workspace.currencyLabel"
      />
    </div>
  </div>
</template>
