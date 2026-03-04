<script setup lang="ts">
/**
 * Requirement: Category comparison view extracted from CompareTab (#1 refactor)
 * Approach: Receives comparison data as props, renders table + bar visualization
 */

import { formatAmount } from '@/composables/useFormat'
import type { ComparisonResult } from '@/engine/variance'

const props = defineProps<{
  comparison: ComparisonResult
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
          <th class="text-left py-2 pr-3 font-medium text-gray-700">Category</th>
          <th class="text-right py-2 px-2 font-medium text-gray-500">Budgeted</th>
          <th class="text-right py-2 px-2 font-medium text-gray-500">Actual</th>
          <th class="text-right py-2 px-2 font-medium text-gray-500">Variance</th>
          <th class="text-right py-2 pl-2 font-medium text-gray-500">%</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="cat in props.comparison.categories"
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

    <!-- Simple bar visualization -->
    <div class="mt-6 space-y-3">
      <div v-for="cat in props.comparison.categories" :key="cat.category">
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
            :title="`Budgeted: ${formatAmount(cat.budgeted)}`"
          />
          <div
            class="rounded-sm h-full transition-all"
            :class="cat.direction === 'over' ? 'bg-red-300' : 'bg-green-300'"
            :style="{
              width: `${Math.min(100, (cat.actual / Math.max(cat.budgeted, cat.actual, 1)) * 100)}%`
            }"
            :title="`Actual: ${formatAmount(cat.actual)} (${cat.direction === 'over' ? 'over budget' : 'under budget'})`"
          />
        </div>
        <!-- Colorblind-safe text label alongside color bars -->
        <div class="text-xs mt-0.5" :class="varianceClass(cat.direction, cat.variancePercent)">
          {{ cat.direction === 'over' ? 'Over' : cat.direction === 'under' ? 'Under' : 'On track' }}
        </div>
      </div>
      <div class="flex gap-4 text-xs text-gray-400 mt-2">
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 bg-blue-200 rounded-sm inline-block" aria-hidden="true" /> Budgeted
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 bg-green-300 rounded-sm inline-block" aria-hidden="true" /> Under budget
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 bg-red-300 rounded-sm inline-block" aria-hidden="true" /> Over budget
        </span>
      </div>
    </div>
  </div>
</template>
