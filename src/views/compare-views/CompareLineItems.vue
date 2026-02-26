<script setup lang="ts">
/**
 * Requirement: Line-item comparison view extracted from CompareTab (#1 refactor)
 * Approach: Receives comparison data + currency label as props, renders table + unbudgeted section
 */

import { formatAmount } from '@/composables/useFormat'
import type { ComparisonResult } from '@/engine/variance'

const props = defineProps<{
  comparison: ComparisonResult
  currencyLabel: string
}>()

function formatPercent(n: number | null): string {
  if (n === null) return 'N/A'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function varianceClass(direction: string, percent: number | null): string {
  if (direction === 'neutral') return 'text-gray-500'
  if (percent !== null && Math.abs(percent) <= 5) return 'text-gray-500'
  return direction === 'over' ? 'text-red-600' : 'text-green-600'
}
</script>

<template>
  <div class="overflow-x-auto">
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
          v-for="item in props.comparison.lineItems"
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
    <div v-if="props.comparison.unbudgeted.length > 0" class="mt-6">
      <h3 class="section-title mb-2 text-gray-500">Unbudgeted Spending</h3>
      <div class="space-y-2">
        <div
          v-for="(item, i) in props.comparison.unbudgeted"
          :key="i"
          class="card p-3 border-dashed"
        >
          <div class="flex justify-between">
            <div>
              <p class="text-sm text-gray-700">{{ item.description || item.category || 'Uncategorized' }}</p>
              <p class="text-xs text-gray-400">{{ item.date }}</p>
            </div>
            <p class="text-sm font-medium text-gray-900">
              {{ props.currencyLabel }}{{ formatAmount(item.amount) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
