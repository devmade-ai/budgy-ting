<script setup lang="ts">
/**
 * Requirement: Monthly breakdown table with per-expense amounts, category rollup, totals
 * Approach: Load expenses, run projection engine, render scrollable table
 */

import { ref, computed, onMounted } from 'vue'
import { db } from '@/db'
import { calculateProjection, resolveBudgetPeriod } from '@/engine/projection'
import { formatAmount } from '@/composables/useFormat'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import ScrollHint from '@/components/ScrollHint.vue'
import type { Budget, Expense } from '@/types/models'
import type { ProjectionResult } from '@/engine/projection'

/**
 * Requirement: When budget has a starting balance, show how long money lasts based on projections
 * Approach: Simple calculation — startingBalance / grandTotal * budget months = coverage months
 * Alternatives:
 *   - Reuse envelope engine: Rejected here — envelope needs actuals; projected tab is pre-actuals
 */

const props = defineProps<{ budget: Budget }>()

const expenses = ref<Expense[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    expenses.value = await db.expenses
      .where('budgetId')
      .equals(props.budget.id)
      .toArray()
  } catch {
    error.value = 'Couldn\'t load projections. Please refresh and try again.'
  } finally {
    loading.value = false
  }
})

const projection = computed<ProjectionResult | null>(() => {
  if (expenses.value.length === 0) return null

  const { startDate, endDate } = resolveBudgetPeriod(props.budget)
  return calculateProjection(expenses.value, startDate, endDate)
})

const viewMode = ref<'items' | 'categories'>('items')

function formatMonth(monthStr: string): string {
  const [y, m] = monthStr.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m!, 10) - 1]} ${y!.slice(2)}`
}

const sortedCategories = computed(() => {
  if (!projection.value) return []
  return [...projection.value.categoryRollup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
})

/** Separate income and expense rows for the items view */
const incomeRows = computed(() => projection.value?.rows.filter((r) => r.type === 'income') ?? [])
const expenseRows = computed(() => projection.value?.rows.filter((r) => r.type === 'expense') ?? [])

/** Envelope summary based on projections only (no actuals yet) */
const envelopeSummary = computed(() => {
  if (props.budget.startingBalance == null || !projection.value) return null

  const total = props.budget.startingBalance
  const projected = projection.value.grandTotal
  // Net considers income: starting balance + total income - total expenses
  const netProjected = projection.value.totalIncome - projected
  const endingBalance = total + netProjected
  const willExceed = endingBalance < 0
  const monthCount = projection.value.months.length

  // Find which month the balance drops below 0 (considering income)
  let running = total
  let depletionMonth: string | null = null
  for (const slot of projection.value.months) {
    const income = projection.value.monthlyIncome.get(slot.month) ?? 0
    const expense = projection.value.monthlyTotals.get(slot.month) ?? 0
    running += income - expense
    if (running < 0 && !depletionMonth) {
      depletionMonth = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][slot.monthNum - 1]} ${String(slot.year).slice(2)}`
    }
  }

  return { total, projected, totalIncome: projection.value.totalIncome, endingBalance, willExceed, monthCount, depletionMonth }
})
</script>

<template>
  <div>
    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

    <EmptyState
      v-if="!loading && !projection && !error"
      icon="i-lucide-trending-up"
      title="No projections yet"
      description="Add expenses to see projected spend over time"
    />

    <LoadingSpinner v-else-if="loading" />

    <!-- Projection table -->
    <template v-else-if="projection">
      <!-- Balance summary (only when budget has a starting balance) -->
      <div v-if="envelopeSummary" class="card mb-4 border-2" :class="envelopeSummary.willExceed ? 'border-red-200 bg-red-50/30' : 'border-brand-200 bg-brand-50/30'">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Starting Balance</p>
            <p class="text-lg font-semibold text-gray-900">
              {{ props.budget.currencyLabel }}{{ formatAmount(envelopeSummary.total) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Income</p>
            <p class="text-lg font-semibold text-green-600">
              +{{ props.budget.currencyLabel }}{{ formatAmount(envelopeSummary.totalIncome) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Expenses</p>
            <p class="text-lg font-semibold text-red-600">
              -{{ props.budget.currencyLabel }}{{ formatAmount(envelopeSummary.projected) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Ending Balance</p>
            <p class="text-lg font-semibold" :class="envelopeSummary.endingBalance >= 0 ? 'text-brand-600' : 'text-red-600'">
              {{ props.budget.currencyLabel }}{{ formatAmount(envelopeSummary.endingBalance) }}
            </p>
          </div>
        </div>
        <div v-if="envelopeSummary.depletionMonth" class="mt-3 text-center text-sm text-red-600">
          Your balance goes negative in {{ envelopeSummary.depletionMonth }}
        </div>
        <div v-else-if="!envelopeSummary.willExceed" class="mt-3 text-center text-sm text-brand-600">
          Balance stays positive across all {{ envelopeSummary.monthCount }} months
        </div>
      </div>

      <!-- View toggle -->
      <div class="flex items-center justify-between mb-4">
        <div class="text-sm text-gray-500">
          <span v-if="projection.totalIncome > 0">
            Income: <span class="text-green-600">{{ props.budget.currencyLabel }}{{ formatAmount(projection.totalIncome) }}</span>
            &middot;
          </span>
          Expenses: <span class="text-red-600">{{ props.budget.currencyLabel }}{{ formatAmount(projection.grandTotal) }}</span>
          <span v-if="projection.totalIncome > 0">
            &middot; Net: <span :class="projection.totalNet >= 0 ? 'text-green-600' : 'text-red-600'">{{ projection.totalNet > 0 ? '+' : '' }}{{ props.budget.currencyLabel }}{{ formatAmount(projection.totalNet) }}</span>
          </span>
        </div>
        <div class="flex gap-1">
          <button
            class="btn text-xs"
            :class="viewMode === 'items'
              ? 'bg-brand-50 text-brand-700 border border-brand-300'
              : 'bg-gray-50 text-gray-600 border border-gray-200'"
            @click="viewMode = 'items'"
          >
            Each item
          </button>
          <button
            class="btn text-xs"
            :class="viewMode === 'categories'
              ? 'bg-brand-50 text-brand-700 border border-brand-300'
              : 'bg-gray-50 text-gray-600 border border-gray-200'"
            @click="viewMode = 'categories'"
          >
            Group by category
          </button>
        </div>
      </div>

      <!-- Scrollable table with fade hint for hidden content -->
      <ScrollHint>
        <table class="w-full text-sm min-w-[600px]">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-2 pr-4 font-medium text-gray-700 sticky left-0 bg-gray-50 min-w-[140px]">
                {{ viewMode === 'items' ? 'Expense' : 'Category' }}
              </th>
              <th
                v-for="month in projection.months"
                :key="month.month"
                class="text-right py-2 px-2 font-medium text-gray-500 min-w-[80px]"
              >
                {{ formatMonth(month.month) }}
              </th>
              <th class="text-right py-2 pl-2 font-semibold text-gray-700 min-w-[90px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Item rows -->
            <template v-if="viewMode === 'items'">
              <!-- Income rows (if any) -->
              <template v-if="incomeRows.length > 0">
                <tr class="bg-green-50/50">
                  <td :colspan="projection.months.length + 2" class="py-1.5 px-2 text-xs font-semibold text-green-700 uppercase tracking-wide sticky left-0 bg-green-50/50">
                    Income
                  </td>
                </tr>
                <tr
                  v-for="row in incomeRows"
                  :key="row.expenseId"
                  class="border-b border-gray-100 hover:bg-green-50/30"
                >
                  <td class="py-2 pr-4 sticky left-0 bg-white">
                    <span class="font-medium text-gray-900">{{ row.description }}</span>
                    <span class="text-gray-400 text-xs ml-1">{{ row.category }}</span>
                  </td>
                  <td
                    v-for="month in projection.months"
                    :key="month.month"
                    class="text-right py-2 px-2 tabular-nums"
                    :class="row.amounts.get(month.month) ? 'text-green-600' : 'text-gray-300'"
                  >
                    {{ row.amounts.get(month.month)
                      ? '+' + formatAmount(row.amounts.get(month.month)!)
                      : '—' }}
                  </td>
                  <td class="text-right py-2 pl-2 font-semibold text-green-600 tabular-nums">
                    +{{ formatAmount(row.total) }}
                  </td>
                </tr>
              </template>
              <!-- Expense rows -->
              <tr v-if="incomeRows.length > 0 && expenseRows.length > 0" class="bg-red-50/50">
                <td :colspan="projection.months.length + 2" class="py-1.5 px-2 text-xs font-semibold text-red-700 uppercase tracking-wide sticky left-0 bg-red-50/50">
                  Expenses
                </td>
              </tr>
              <tr
                v-for="row in expenseRows"
                :key="row.expenseId"
                class="border-b border-gray-100 hover:bg-gray-50"
              >
                <td class="py-2 pr-4 sticky left-0 bg-white">
                  <span class="font-medium text-gray-900">{{ row.description }}</span>
                  <span class="text-gray-400 text-xs ml-1">{{ row.category }}</span>
                </td>
                <td
                  v-for="month in projection.months"
                  :key="month.month"
                  class="text-right py-2 px-2 tabular-nums"
                  :class="row.amounts.get(month.month) ? 'text-gray-700' : 'text-gray-300'"
                >
                  {{ row.amounts.get(month.month)
                    ? formatAmount(row.amounts.get(month.month)!)
                    : '—' }}
                </td>
                <td class="text-right py-2 pl-2 font-semibold text-gray-900 tabular-nums">
                  {{ formatAmount(row.total) }}
                </td>
              </tr>
            </template>

            <!-- Category rows -->
            <template v-else>
              <tr
                v-for="[category, monthMap] in sortedCategories"
                :key="category"
                class="border-b border-gray-100 hover:bg-gray-50"
              >
                <td class="py-2 pr-4 font-medium text-gray-900 sticky left-0 bg-white">
                  {{ category }}
                </td>
                <td
                  v-for="month in projection.months"
                  :key="month.month"
                  class="text-right py-2 px-2 tabular-nums"
                  :class="monthMap.get(month.month) ? 'text-gray-700' : 'text-gray-300'"
                >
                  {{ monthMap.get(month.month)
                    ? formatAmount(monthMap.get(month.month)!)
                    : '—' }}
                </td>
                <td class="text-right py-2 pl-2 font-semibold text-gray-900 tabular-nums">
                  {{ formatAmount(
                    [...monthMap.values()].reduce((s, v) => s + v, 0)
                  ) }}
                </td>
              </tr>
            </template>
          </tbody>
          <tfoot>
            <!-- Income total row (only when income lines exist) -->
            <tr v-if="projection.totalIncome > 0" class="border-t-2 border-gray-300">
              <td class="py-2 pr-4 font-bold text-green-700 sticky left-0 bg-gray-50">
                Total Income
              </td>
              <td
                v-for="month in projection.months"
                :key="month.month"
                class="text-right py-2 px-2 font-bold text-green-600 tabular-nums"
              >
                +{{ formatAmount(projection.monthlyIncome.get(month.month) ?? 0) }}
              </td>
              <td class="text-right py-2 pl-2 font-bold text-green-600 tabular-nums">
                +{{ formatAmount(projection.totalIncome) }}
              </td>
            </tr>
            <!-- Expense total row -->
            <tr :class="projection.totalIncome > 0 ? 'border-t border-gray-200' : 'border-t-2 border-gray-300'">
              <td class="py-2 pr-4 font-bold sticky left-0 bg-gray-50" :class="projection.totalIncome > 0 ? 'text-red-700' : 'text-gray-900'">
                {{ projection.totalIncome > 0 ? 'Total Expenses' : 'Total' }}
              </td>
              <td
                v-for="month in projection.months"
                :key="month.month"
                class="text-right py-2 px-2 font-bold tabular-nums"
                :class="projection.totalIncome > 0 ? 'text-red-600' : 'text-gray-900'"
              >
                {{ projection.totalIncome > 0 ? '-' : '' }}{{ formatAmount(projection.monthlyTotals.get(month.month) ?? 0) }}
              </td>
              <td class="text-right py-2 pl-2 font-bold tabular-nums" :class="projection.totalIncome > 0 ? 'text-red-600' : 'text-brand-600'">
                {{ projection.totalIncome > 0 ? '-' : '' }}{{ formatAmount(projection.grandTotal) }}
              </td>
            </tr>
            <!-- Net row (only when income lines exist) -->
            <tr v-if="projection.totalIncome > 0" class="border-t-2 border-gray-400 bg-gray-50/50">
              <td class="py-2 pr-4 font-bold text-gray-900 sticky left-0 bg-gray-50">
                Net
              </td>
              <td
                v-for="month in projection.months"
                :key="month.month"
                class="text-right py-2 px-2 font-bold tabular-nums"
                :class="(projection.monthlyNet.get(month.month) ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'"
              >
                {{ (projection.monthlyNet.get(month.month) ?? 0) > 0 ? '+' : '' }}{{ formatAmount(projection.monthlyNet.get(month.month) ?? 0) }}
              </td>
              <td
                class="text-right py-2 pl-2 font-bold tabular-nums"
                :class="projection.totalNet >= 0 ? 'text-brand-600' : 'text-red-600'"
              >
                {{ projection.totalNet > 0 ? '+' : '' }}{{ formatAmount(projection.totalNet) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </ScrollHint>
    </template>
  </div>
</template>
