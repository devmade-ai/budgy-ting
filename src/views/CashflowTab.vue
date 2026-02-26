<script setup lang="ts">
/**
 * Requirement: Month-by-month cashflow forecast showing running balance
 * Approach: Load expenses + actuals, run projection + cashflow engines, render summary + table
 * Alternatives:
 *   - Merge into ProjectedTab: Rejected — cashflow is a fundamentally different view
 *     (running balance over time vs per-item breakdown)
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { calculateProjection, resolveBudgetPeriod } from '@/engine/projection'
import { calculateCashflow } from '@/engine/cashflow'
import { formatAmount } from '@/composables/useFormat'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import ScrollHint from '@/components/ScrollHint.vue'
import type { Budget, Expense, Actual } from '@/types/models'
import type { CashflowResult } from '@/engine/cashflow'

const props = defineProps<{ budget: Budget }>()
const router = useRouter()

const expenses = ref<Expense[]>([])
const actuals = ref<Actual[]>([])
const loading = ref(true)

function goToEditBudget() {
  router.push({ name: 'budget-edit', params: { id: props.budget.id } })
}
const error = ref('')

onMounted(async () => {
  try {
    const [exps, acts] = await Promise.all([
      db.expenses.where('budgetId').equals(props.budget.id).toArray(),
      db.actuals.where('budgetId').equals(props.budget.id).toArray(),
    ])
    expenses.value = exps
    actuals.value = acts
  } catch {
    error.value = 'Couldn\'t load cashflow data. Please refresh and try again.'
  } finally {
    loading.value = false
  }
})

const cashflow = computed<CashflowResult | null>(() => {
  if (props.budget.startingBalance == null) return null
  if (expenses.value.length === 0) return null

  const { startDate, endDate } = resolveBudgetPeriod(props.budget)
  const projection = calculateProjection(expenses.value, startDate, endDate)
  return calculateCashflow(props.budget.startingBalance, projection, actuals.value, expenses.value)
})

const hasIncomeLines = computed(() => {
  return expenses.value.some((e) => e.type === 'income')
})

const noBalance = computed(() => {
  return props.budget.startingBalance == null
})
</script>

<template>
  <div>
    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

    <LoadingSpinner v-if="loading" />

    <!-- No starting balance set — provide direct link to edit budget -->
    <EmptyState
      v-else-if="noBalance && !error"
      icon="i-lucide-wallet"
      title="No starting balance set"
      description="Enter your current account balance to see how your money flows over time"
    >
      <button class="btn-primary" @click="goToEditBudget">
        <span class="i-lucide-pencil mr-1" />
        Set starting balance
      </button>
    </EmptyState>

    <!-- No expenses yet -->
    <EmptyState
      v-else-if="!cashflow && !error"
      icon="i-lucide-trending-up"
      title="No cashflow data yet"
      description="Add income and expense lines to see your cashflow forecast"
    />

    <!-- Cashflow view -->
    <template v-else-if="cashflow">
      <!-- Summary cards -->
      <div class="card mb-4 border-2" :class="cashflow.willGoNegative ? 'border-red-200 bg-red-50/30' : 'border-brand-200 bg-brand-50/30'">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Starting Balance</p>
            <p class="text-lg font-semibold text-gray-900">
              {{ props.budget.currencyLabel }}{{ formatAmount(cashflow.startingBalance) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Total Income</p>
            <p class="text-lg font-semibold text-green-600">
              +{{ props.budget.currencyLabel }}{{ formatAmount(cashflow.totalIncome) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Total Expenses</p>
            <p class="text-lg font-semibold text-red-600">
              -{{ props.budget.currencyLabel }}{{ formatAmount(cashflow.totalExpenses) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-400 uppercase tracking-wide">Ending Balance</p>
            <p
              class="text-lg font-semibold"
              :class="cashflow.endingBalance >= 0 ? 'text-brand-600' : 'text-red-600'"
            >
              {{ props.budget.currencyLabel }}{{ formatAmount(cashflow.endingBalance) }}
            </p>
          </div>
        </div>

        <!-- Warning / success message -->
        <div class="mt-3 text-center text-sm" :class="cashflow.willGoNegative ? 'text-red-600' : 'text-brand-600'">
          <template v-if="cashflow.willGoNegative && cashflow.zeroCrossingMonth">
            Your balance goes negative in {{ cashflow.zeroCrossingMonth }}
            <span v-if="cashflow.lowestBalance < 0">
              (lowest: {{ props.budget.currencyLabel }}{{ formatAmount(cashflow.lowestBalance) }} in {{ cashflow.lowestBalanceMonth }})
            </span>
          </template>
          <template v-else-if="!hasIncomeLines">
            Add income lines to see a complete cashflow picture
          </template>
          <template v-else>
            Your balance stays positive throughout the forecast period
          </template>
        </div>
      </div>

      <!-- Monthly cashflow table with scroll hint -->
      <ScrollHint>
        <table class="w-full text-sm min-w-[500px]">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-2 pr-4 font-medium text-gray-700 sticky left-0 bg-gray-50 min-w-[80px]">
                Month
              </th>
              <th class="text-right py-2 px-2 font-medium text-green-600 min-w-[90px]">
                Income
              </th>
              <th class="text-right py-2 px-2 font-medium text-red-600 min-w-[90px]">
                Expenses
              </th>
              <th class="text-right py-2 px-2 font-medium text-gray-500 min-w-[90px]">
                Net
              </th>
              <th class="text-right py-2 pl-2 font-semibold text-gray-700 min-w-[100px]">
                Balance
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Starting balance row -->
            <tr class="border-b border-gray-100 bg-gray-50/50">
              <td class="py-2 pr-4 text-gray-500 italic sticky left-0 bg-gray-50/50">Starting</td>
              <td class="text-right py-2 px-2 text-gray-300">—</td>
              <td class="text-right py-2 px-2 text-gray-300">—</td>
              <td class="text-right py-2 px-2 text-gray-300">—</td>
              <td class="text-right py-2 pl-2 font-semibold text-gray-900 tabular-nums">
                {{ formatAmount(cashflow.startingBalance) }}
              </td>
            </tr>
            <tr
              v-for="m in cashflow.months"
              :key="m.month"
              class="border-b border-gray-100 hover:bg-gray-50"
            >
              <td class="py-2 pr-4 font-medium text-gray-900 sticky left-0 bg-white">
                {{ m.monthLabel }}
              </td>
              <td class="text-right py-2 px-2 tabular-nums" :class="(m.actualIncome ?? m.projectedIncome) > 0 ? 'text-green-600' : 'text-gray-300'">
                <template v-if="(m.actualIncome ?? m.projectedIncome) > 0">
                  +{{ formatAmount(m.actualIncome ?? m.projectedIncome) }}
                  <span v-if="m.actualIncome !== null" class="text-xs text-green-400 block">actual</span>
                </template>
                <template v-else>—</template>
              </td>
              <td class="text-right py-2 px-2 tabular-nums" :class="(m.actualExpenses ?? m.projectedExpenses) > 0 ? 'text-red-600' : 'text-gray-300'">
                <template v-if="(m.actualExpenses ?? m.projectedExpenses) > 0">
                  -{{ formatAmount(m.actualExpenses ?? m.projectedExpenses) }}
                  <span v-if="m.actualExpenses !== null" class="text-xs text-red-400 block">actual</span>
                </template>
                <template v-else>—</template>
              </td>
              <td
                class="text-right py-2 px-2 tabular-nums font-medium"
                :class="m.effectiveNet > 0 ? 'text-green-600' : m.effectiveNet < 0 ? 'text-red-600' : 'text-gray-400'"
              >
                {{ m.effectiveNet > 0 ? '+' : '' }}{{ formatAmount(m.effectiveNet) }}
              </td>
              <td
                class="text-right py-2 pl-2 font-semibold tabular-nums"
                :class="m.balance >= 0 ? 'text-gray-900' : 'text-red-600'"
              >
                {{ formatAmount(m.balance) }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-gray-300">
              <td class="py-2 pr-4 font-bold text-gray-900 sticky left-0 bg-gray-50">Totals</td>
              <td class="text-right py-2 px-2 font-bold text-green-600 tabular-nums">
                +{{ formatAmount(cashflow.totalIncome) }}
              </td>
              <td class="text-right py-2 px-2 font-bold text-red-600 tabular-nums">
                -{{ formatAmount(cashflow.totalExpenses) }}
              </td>
              <td
                class="text-right py-2 px-2 font-bold tabular-nums"
                :class="cashflow.totalNet >= 0 ? 'text-green-600' : 'text-red-600'"
              >
                {{ cashflow.totalNet > 0 ? '+' : '' }}{{ formatAmount(cashflow.totalNet) }}
              </td>
              <td
                class="text-right py-2 pl-2 font-bold tabular-nums"
                :class="cashflow.endingBalance >= 0 ? 'text-brand-600' : 'text-red-600'"
              >
                {{ formatAmount(cashflow.endingBalance) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </ScrollHint>

      <!-- Simple balance bar chart (CSS-based) -->
      <div class="mt-6">
        <h3 class="section-title mb-3">Balance Forecast</h3>
        <div class="flex items-end gap-1 h-32">
          <div
            v-for="m in cashflow.months"
            :key="m.month"
            class="flex-1 flex flex-col items-center"
          >
            <div class="w-full flex items-end justify-center" style="height: 100px;">
              <div
                class="w-full rounded-t-sm transition-all"
                :class="m.balance >= 0 ? 'bg-brand-200' : 'bg-red-300'"
                :style="{
                  height: `${Math.max(4, (Math.abs(m.balance) / Math.max(...cashflow.months.map(x => Math.abs(x.balance)), 1)) * 100)}%`
                }"
                :title="`${m.monthLabel}: ${props.budget.currencyLabel}${formatAmount(m.balance)}`"
              />
            </div>
            <span class="text-xs text-gray-400 truncate w-full text-center mt-0.5">
              {{ m.monthLabel.slice(0, 3) }}
            </span>
          </div>
        </div>
        <div class="flex gap-4 text-xs text-gray-400 mt-2">
          <span class="flex items-center gap-1">
            <span class="w-3 h-3 bg-brand-200 rounded-sm inline-block" aria-hidden="true" /> Positive
          </span>
          <span class="flex items-center gap-1">
            <span class="w-3 h-3 bg-red-300 rounded-sm inline-block" aria-hidden="true" /> Negative
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
