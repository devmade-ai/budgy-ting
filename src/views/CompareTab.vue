<script setup lang="ts">
/**
 * Requirement: Compare budget vs actuals by line item, category, and month
 * Approach: Load expenses + actuals, run projection + variance engines, render 3 sub-views
 *
 * Note: Charts (ApexCharts) deferred — npm can't install. Table views are fully functional.
 * Charts will be added when dependencies are available.
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { calculateProjection, getDefaultPeriod } from '@/engine/projection'
import { calculateComparison } from '@/engine/variance'
import type { Budget, Expense, Actual } from '@/types/models'
import type { ComparisonResult } from '@/engine/variance'

const props = defineProps<{ budget: Budget }>()
const router = useRouter()

const expenses = ref<Expense[]>([])
const actuals = ref<Actual[]>([])
const loading = ref(true)

onMounted(async () => {
  const [exps, acts] = await Promise.all([
    db.expenses.where('budgetId').equals(props.budget.id).toArray(),
    db.actuals.where('budgetId').equals(props.budget.id).toArray(),
  ])
  expenses.value = exps
  actuals.value = acts
  loading.value = false
})

const comparison = computed<ComparisonResult | null>(() => {
  if (expenses.value.length === 0 && actuals.value.length === 0) return null

  let startDate = props.budget.startDate
  let endDate = props.budget.endDate

  if (props.budget.periodType === 'monthly' || !endDate) {
    const defaults = getDefaultPeriod()
    if (!startDate) startDate = defaults.startDate
    if (!endDate) endDate = defaults.endDate
  }

  const projection = calculateProjection(expenses.value, startDate, endDate!)
  return calculateComparison(projection, actuals.value, expenses.value)
})

const viewMode = ref<'items' | 'categories' | 'monthly'>('items')

function formatAmount(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPercent(n: number | null): string {
  if (n === null) return 'N/A'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function varianceClass(direction: string, percent: number | null): string {
  if (direction === 'neutral') return 'text-gray-500'
  if (percent !== null && Math.abs(percent) <= 5) return 'text-gray-500'
  return direction === 'over' ? 'text-red-600' : 'text-green-600'
}

function goToImport() {
  router.push({ name: 'import-actuals', params: { id: props.budget.id } })
}
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>

    <!-- Empty state -->
    <div v-else-if="!comparison" class="text-center py-12">
      <div class="i-lucide-bar-chart-3 text-4xl text-gray-300 mx-auto mb-3" />
      <p class="text-gray-500">Nothing to compare yet</p>
      <p class="text-gray-400 text-sm mt-1 mb-4">
        Add expenses and import actuals to see comparisons
      </p>
      <button class="btn-primary" @click="goToImport">Import actuals</button>
    </div>

    <!-- Comparison views -->
    <template v-else>
      <!-- Summary bar -->
      <div class="card mb-4">
        <div class="grid grid-cols-3 gap-4 text-center">
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Budgeted</p>
            <p class="text-lg font-semibold text-gray-900">
              {{ props.budget.currencyLabel }}{{ formatAmount(comparison.totalBudgeted) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Actual</p>
            <p class="text-lg font-semibold text-gray-900">
              {{ props.budget.currencyLabel }}{{ formatAmount(comparison.totalActual) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Variance</p>
            <p
              class="text-lg font-semibold"
              :class="comparison.totalVariance > 0 ? 'text-red-600' : comparison.totalVariance < 0 ? 'text-green-600' : 'text-gray-500'"
            >
              {{ comparison.totalVariance >= 0 ? '+' : '' }}{{ props.budget.currencyLabel }}{{ formatAmount(comparison.totalVariance) }}
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

      <!-- Line Items View -->
      <div v-if="viewMode === 'items'" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-2 pr-3 font-medium text-gray-700">Expense</th>
              <th class="text-right py-2 px-2 font-medium text-gray-500">Budgeted</th>
              <th class="text-right py-2 px-2 font-medium text-gray-500">Actual</th>
              <th class="text-right py-2 px-2 font-medium text-gray-500">Variance</th>
              <th class="text-right py-2 pl-2 font-medium text-gray-500">%</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in comparison.lineItems"
              :key="item.expenseId"
              class="border-b border-gray-100 hover:bg-gray-50"
            >
              <td class="py-2 pr-3">
                <span class="font-medium text-gray-900">{{ item.description }}</span>
                <span class="text-gray-400 text-xs ml-1">{{ item.category }}</span>
              </td>
              <td class="text-right py-2 px-2 tabular-nums text-gray-700">
                {{ formatAmount(item.budgeted) }}
              </td>
              <td class="text-right py-2 px-2 tabular-nums text-gray-700">
                {{ formatAmount(item.actual) }}
              </td>
              <td
                class="text-right py-2 px-2 tabular-nums font-medium"
                :class="varianceClass(item.direction, item.variancePercent)"
              >
                {{ item.variance >= 0 ? '+' : '' }}{{ formatAmount(item.variance) }}
              </td>
              <td
                class="text-right py-2 pl-2 tabular-nums text-xs"
                :class="varianceClass(item.direction, item.variancePercent)"
              >
                {{ formatPercent(item.variancePercent) }}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Unbudgeted actuals -->
        <div v-if="comparison.unbudgeted.length > 0" class="mt-6">
          <h3 class="section-title mb-2 text-gray-500">Unbudgeted Spending</h3>
          <div class="space-y-2">
            <div
              v-for="(item, i) in comparison.unbudgeted"
              :key="i"
              class="card p-3 border-dashed"
            >
              <div class="flex justify-between">
                <div>
                  <p class="text-sm text-gray-700">{{ item.description || item.category || 'Uncategorized' }}</p>
                  <p class="text-xs text-gray-400">{{ item.date }}</p>
                </div>
                <p class="text-sm font-medium text-gray-900">
                  {{ props.budget.currencyLabel }}{{ formatAmount(item.amount) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Categories View -->
      <div v-else-if="viewMode === 'categories'" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-2 pr-3 font-medium text-gray-700">Category</th>
              <th class="text-right py-2 px-2 font-medium text-gray-500">Budgeted</th>
              <th class="text-right py-2 px-2 font-medium text-gray-500">Actual</th>
              <th class="text-right py-2 px-2 font-medium text-gray-500">Variance</th>
              <th class="text-right py-2 pl-2 font-medium text-gray-500">%</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="cat in comparison.categories"
              :key="cat.category"
              class="border-b border-gray-100 hover:bg-gray-50"
            >
              <td class="py-2 pr-3 font-medium text-gray-900">{{ cat.category }}</td>
              <td class="text-right py-2 px-2 tabular-nums text-gray-700">
                {{ formatAmount(cat.budgeted) }}
              </td>
              <td class="text-right py-2 px-2 tabular-nums text-gray-700">
                {{ formatAmount(cat.actual) }}
              </td>
              <td
                class="text-right py-2 px-2 tabular-nums font-medium"
                :class="varianceClass(cat.direction, cat.variancePercent)"
              >
                {{ cat.variance >= 0 ? '+' : '' }}{{ formatAmount(cat.variance) }}
              </td>
              <td
                class="text-right py-2 pl-2 tabular-nums text-xs"
                :class="varianceClass(cat.direction, cat.variancePercent)"
              >
                {{ formatPercent(cat.variancePercent) }}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Simple bar visualization (CSS-based, no chart library needed) -->
        <div class="mt-6 space-y-3">
          <div v-for="cat in comparison.categories" :key="cat.category">
            <div class="flex justify-between text-xs text-gray-500 mb-1">
              <span>{{ cat.category }}</span>
              <span :class="varianceClass(cat.direction, cat.variancePercent)">
                {{ formatPercent(cat.variancePercent) }}
              </span>
            </div>
            <div class="flex gap-1 h-4">
              <div
                class="bg-blue-200 rounded-sm h-full transition-all"
                :style="{
                  width: `${Math.min(100, (cat.budgeted / Math.max(cat.budgeted, cat.actual, 1)) * 100)}%`
                }"
                title="Budgeted"
              />
              <div
                class="rounded-sm h-full transition-all"
                :class="cat.direction === 'over' ? 'bg-red-300' : 'bg-green-300'"
                :style="{
                  width: `${Math.min(100, (cat.actual / Math.max(cat.budgeted, cat.actual, 1)) * 100)}%`
                }"
                title="Actual"
              />
            </div>
          </div>
          <div class="flex gap-4 text-xs text-gray-400 mt-2">
            <span class="flex items-center gap-1">
              <span class="w-3 h-3 bg-blue-200 rounded-sm inline-block" /> Budgeted
            </span>
            <span class="flex items-center gap-1">
              <span class="w-3 h-3 bg-green-300 rounded-sm inline-block" /> Actual
            </span>
          </div>
        </div>
      </div>

      <!-- Monthly View -->
      <div v-else-if="viewMode === 'monthly'" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-2 pr-3 font-medium text-gray-700">Month</th>
              <th class="text-right py-2 px-2 font-medium text-gray-500">Projected</th>
              <th class="text-right py-2 px-2 font-medium text-gray-500">Actual</th>
              <th class="text-right py-2 px-2 font-medium text-gray-500">Variance</th>
              <th class="text-right py-2 pl-2 font-medium text-gray-500">%</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="m in comparison.monthly"
              :key="m.month"
              class="border-b border-gray-100 hover:bg-gray-50"
              :class="!m.hasActuals ? 'opacity-50' : ''"
            >
              <td class="py-2 pr-3 font-medium text-gray-900">{{ m.monthLabel }}</td>
              <td class="text-right py-2 px-2 tabular-nums text-gray-700">
                {{ formatAmount(m.projected) }}
              </td>
              <td class="text-right py-2 px-2 tabular-nums" :class="m.hasActuals ? 'text-gray-700' : 'text-gray-400'">
                {{ m.hasActuals ? formatAmount(m.actual) : '—' }}
              </td>
              <td
                v-if="m.hasActuals"
                class="text-right py-2 px-2 tabular-nums font-medium"
                :class="varianceClass(m.direction, m.variancePercent)"
              >
                {{ m.variance >= 0 ? '+' : '' }}{{ formatAmount(m.variance) }}
              </td>
              <td v-else class="text-right py-2 px-2 text-gray-400">—</td>
              <td
                v-if="m.hasActuals"
                class="text-right py-2 pl-2 tabular-nums text-xs"
                :class="varianceClass(m.direction, m.variancePercent)"
              >
                {{ formatPercent(m.variancePercent) }}
              </td>
              <td v-else class="text-right py-2 pl-2 text-gray-400">—</td>
            </tr>
          </tbody>
        </table>

        <!-- Simple line visualization (CSS-based) -->
        <div class="mt-6">
          <div class="flex items-end gap-1 h-32">
            <div
              v-for="m in comparison.monthly"
              :key="m.month"
              class="flex-1 flex flex-col items-center gap-0.5"
            >
              <div class="w-full flex gap-0.5 items-end" style="height: 100px;">
                <div
                  class="flex-1 bg-blue-200 rounded-t-sm transition-all"
                  :style="{
                    height: `${comparison.totalBudgeted > 0
                      ? Math.max(2, (m.projected / (Math.max(...comparison.monthly.map(x => Math.max(x.projected, x.actual))))) * 100)
                      : 2}%`
                  }"
                />
                <div
                  v-if="m.hasActuals"
                  class="flex-1 rounded-t-sm transition-all"
                  :class="m.direction === 'over' ? 'bg-red-300' : 'bg-green-300'"
                  :style="{
                    height: `${comparison.totalBudgeted > 0
                      ? Math.max(2, (m.actual / (Math.max(...comparison.monthly.map(x => Math.max(x.projected, x.actual))))) * 100)
                      : 2}%`
                  }"
                />
              </div>
              <span class="text-[10px] text-gray-400 truncate w-full text-center">
                {{ m.monthLabel.slice(0, 3) }}
              </span>
            </div>
          </div>
          <div class="flex gap-4 text-xs text-gray-400 mt-2">
            <span class="flex items-center gap-1">
              <span class="w-3 h-3 bg-blue-200 rounded-sm inline-block" /> Projected
            </span>
            <span class="flex items-center gap-1">
              <span class="w-3 h-3 bg-green-300 rounded-sm inline-block" /> Actual
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
