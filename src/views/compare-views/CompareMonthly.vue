<script setup lang="ts">
/**
 * Requirement: Monthly comparison view extracted from CompareTab (#1 refactor)
 * Approach: Receives comparison data as props, renders table + bar chart visualization
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
          <th class="text-left py-2 pr-3 font-medium text-gray-700">Month</th>
          <th class="text-right py-2 px-2 font-medium text-gray-500">Projected</th>
          <th class="text-right py-2 px-2 font-medium text-gray-500">Actual</th>
          <th class="text-right py-2 px-2 font-medium text-gray-500">Variance</th>
          <th class="text-right py-2 pl-2 font-medium text-gray-500">%</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="m in props.comparison.monthly"
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

    <!-- Simple bar visualization -->
    <div class="mt-6">
      <div class="flex items-end gap-1 h-32">
        <div
          v-for="m in props.comparison.monthly"
          :key="m.month"
          class="flex-1 flex flex-col items-center gap-0.5"
        >
          <div class="w-full flex gap-0.5 items-end" style="height: 100px;">
            <div
              class="flex-1 bg-blue-200 rounded-t-sm transition-all"
              :style="{
                height: `${props.comparison.totalBudgeted > 0
                  ? Math.max(2, (m.projected / (Math.max(...props.comparison.monthly.map(x => Math.max(x.projected, x.actual))))) * 100)
                  : 2}%`
              }"
            />
            <div
              v-if="m.hasActuals"
              class="flex-1 rounded-t-sm transition-all"
              :class="m.direction === 'over' ? 'bg-red-300' : 'bg-green-300'"
              :style="{
                height: `${props.comparison.totalBudgeted > 0
                  ? Math.max(2, (m.actual / (Math.max(...props.comparison.monthly.map(x => Math.max(x.projected, x.actual))))) * 100)
                  : 2}%`
              }"
            />
          </div>
          <span class="text-xs text-gray-400 truncate w-full text-center">
            {{ m.monthLabel.slice(0, 3) }}
          </span>
        </div>
      </div>
      <div class="flex gap-4 text-xs text-gray-400 mt-2">
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 bg-blue-200 rounded-sm inline-block" aria-hidden="true" /> Projected
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
