<script setup lang="ts">
/**
 * Requirement: Monthly breakdown table with per-expense amounts, category rollup, totals
 * Approach: Load expenses, run projection engine, render scrollable table
 */

import { ref, computed, onMounted } from 'vue'
import { db } from '@/db'
import { calculateProjection, getDefaultPeriod } from '@/engine/projection'
import { formatAmount } from '@/composables/useFormat'
import type { Budget, Expense } from '@/types/models'
import type { ProjectionResult } from '@/engine/projection'

const props = defineProps<{ budget: Budget }>()

const expenses = ref<Expense[]>([])
const loading = ref(true)

onMounted(async () => {
  expenses.value = await db.expenses
    .where('budgetId')
    .equals(props.budget.id)
    .toArray()
  loading.value = false
})

const projection = computed<ProjectionResult | null>(() => {
  if (expenses.value.length === 0) return null

  let startDate = props.budget.startDate
  let endDate = props.budget.endDate

  if (props.budget.periodType === 'monthly' || !endDate) {
    const defaults = getDefaultPeriod()
    if (!startDate) startDate = defaults.startDate
    if (!endDate) endDate = defaults.endDate
  }

  return calculateProjection(expenses.value, startDate, endDate!)
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
</script>

<template>
  <div>
    <!-- Empty state -->
    <div v-if="!loading && !projection" class="text-center py-12">
      <div class="i-lucide-trending-up text-4xl text-gray-300 mx-auto mb-3" />
      <p class="text-gray-500">No projections yet</p>
      <p class="text-gray-400 text-sm mt-1">
        Add expenses to see projected spend over time
      </p>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="text-center py-12 text-gray-400">Loading...</div>

    <!-- Projection table -->
    <template v-else-if="projection">
      <!-- View toggle -->
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-gray-500">
          Grand total: {{ props.budget.currencyLabel }}{{ formatAmount(projection.grandTotal) }}
        </p>
        <div class="flex gap-1">
          <button
            class="btn text-xs"
            :class="viewMode === 'items'
              ? 'bg-brand-50 text-brand-700 border border-brand-300'
              : 'bg-gray-50 text-gray-600 border border-gray-200'"
            @click="viewMode = 'items'"
          >
            By Item
          </button>
          <button
            class="btn text-xs"
            :class="viewMode === 'categories'
              ? 'bg-brand-50 text-brand-700 border border-brand-300'
              : 'bg-gray-50 text-gray-600 border border-gray-200'"
            @click="viewMode = 'categories'"
          >
            By Category
          </button>
        </div>
      </div>

      <!-- Scrollable table -->
      <div class="overflow-x-auto -mx-4 px-4">
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
              <tr
                v-for="row in projection.rows"
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
            <tr class="border-t-2 border-gray-300">
              <td class="py-2 pr-4 font-bold text-gray-900 sticky left-0 bg-gray-50">
                Total
              </td>
              <td
                v-for="month in projection.months"
                :key="month.month"
                class="text-right py-2 px-2 font-bold text-gray-900 tabular-nums"
              >
                {{ formatAmount(projection.monthlyTotals.get(month.month) ?? 0) }}
              </td>
              <td class="text-right py-2 pl-2 font-bold text-brand-600 tabular-nums">
                {{ formatAmount(projection.grandTotal) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
  </div>
</template>
