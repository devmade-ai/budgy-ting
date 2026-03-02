<script setup lang="ts">
/**
 * Requirement: Compare budget vs actuals by line item, category, and month
 * Approach: Load expenses + actuals, run projection + variance engines, delegate to sub-view components
 *
 * Refactor: Extracted 3 view modes (line items, categories, monthly) into separate components
 *   to keep this file under the 400-line threshold. See compare-views/ directory.
 *
 * Note: Charts (ApexCharts) deferred — npm can't install. Table views are fully functional.
 * Charts will be added when dependencies are available.
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { calculateProjection, resolveWorkspacePeriod } from '@/engine/projection'
import { calculateComparison } from '@/engine/variance'
import { formatAmount } from '@/composables/useFormat'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import CompareLineItems from '@/views/compare-views/CompareLineItems.vue'
import CompareCategories from '@/views/compare-views/CompareCategories.vue'
import CompareMonthly from '@/views/compare-views/CompareMonthly.vue'
import type { Workspace, Expense, Actual } from '@/types/models'
import type { ComparisonResult } from '@/engine/variance'

const props = defineProps<{ workspace: Workspace }>()
const router = useRouter()

const expenses = ref<Expense[]>([])
const actuals = ref<Actual[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const [exps, acts] = await Promise.all([
      db.expenses.where('workspaceId').equals(props.workspace.id).toArray(),
      db.actuals.where('workspaceId').equals(props.workspace.id).toArray(),
    ])
    expenses.value = exps
    actuals.value = acts
  } catch {
    error.value = 'Couldn\'t load comparison data. Please refresh and try again.'
  } finally {
    loading.value = false
  }
})

const comparison = computed<ComparisonResult | null>(() => {
  if (expenses.value.length === 0 && actuals.value.length === 0) return null

  const { startDate, endDate } = resolveWorkspacePeriod(props.workspace)
  const projection = calculateProjection(expenses.value, startDate, endDate)
  return calculateComparison(projection, actuals.value, expenses.value)
})

const viewMode = ref<'items' | 'categories' | 'monthly'>('items')

function goToImport() {
  router.push({ name: 'import-actuals', params: { id: props.workspace.id } })
}
</script>

<template>
  <div>
    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

    <LoadingSpinner v-if="loading" />

    <EmptyState
      v-else-if="!comparison && !error"
      icon="i-lucide-bar-chart-3"
      title="Nothing to compare yet"
      description="Import your bank statement to see how your actual spending compares to your budget"
    >
      <button class="btn-primary" @click="goToImport">
        <span class="i-lucide-upload mr-1" />
        Import bank statement
      </button>
    </EmptyState>

    <!-- Comparison views -->
    <template v-else-if="comparison">
      <!-- Summary bar -->
      <div class="card mb-4">
        <div class="grid grid-cols-3 gap-4 text-center">
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Budgeted</p>
            <p class="text-lg font-semibold text-gray-900">
              {{ props.workspace.currencyLabel }}{{ formatAmount(comparison.totalBudgeted) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Actual</p>
            <p class="text-lg font-semibold text-gray-900">
              {{ props.workspace.currencyLabel }}{{ formatAmount(comparison.totalActual) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Variance</p>
            <p
              class="text-lg font-semibold"
              :class="comparison.totalVariance > 0 ? 'text-red-600' : comparison.totalVariance < 0 ? 'text-green-600' : 'text-gray-500'"
            >
              {{ comparison.totalVariance >= 0 ? '+' : '' }}{{ props.workspace.currencyLabel }}{{ formatAmount(comparison.totalVariance) }}
            </p>
          </div>
        </div>
      </div>

      <!-- View mode toggle -->
      <div class="flex gap-1 mb-4">
        <button
          class="btn text-xs"
          :class="viewMode === 'items'
            ? 'bg-brand-50 text-brand-700 border border-brand-300'
            : 'bg-gray-50 text-gray-600 border border-gray-200'"
          @click="viewMode = 'items'"
        >
          Line Items
        </button>
        <button
          class="btn text-xs"
          :class="viewMode === 'categories'
            ? 'bg-brand-50 text-brand-700 border border-brand-300'
            : 'bg-gray-50 text-gray-600 border border-gray-200'"
          @click="viewMode = 'categories'"
        >
          Categories
        </button>
        <button
          class="btn text-xs"
          :class="viewMode === 'monthly'
            ? 'bg-brand-50 text-brand-700 border border-brand-300'
            : 'bg-gray-50 text-gray-600 border border-gray-200'"
          @click="viewMode = 'monthly'"
        >
          Monthly
        </button>
      </div>

      <!-- Sub-views -->
      <CompareLineItems
        v-if="viewMode === 'items'"
        :comparison="comparison"
        :currency-label="props.workspace.currencyLabel"
      />
      <CompareCategories
        v-else-if="viewMode === 'categories'"
        :comparison="comparison"
      />
      <CompareMonthly
        v-else-if="viewMode === 'monthly'"
        :comparison="comparison"
      />
    </template>
  </div>
</template>
