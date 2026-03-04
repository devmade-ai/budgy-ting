<script setup lang="ts">
/**
 * Requirement: Daily cashflow graph with actuals line and optional forecast overlay.
 *   Toggle between cumulative (running balance) and net daily flow views.
 *   Forecast period options: 1M, 3M, 6M, 12M.
 * Approach: ApexCharts mixed line/area chart. Actuals as solid line, forecast as dashed.
 *   Confidence band as shaded area when EMA provides bounds.
 * Alternatives:
 *   - Chart.js: Rejected — ApexCharts has better Vue 3 integration and built-in tooltips
 *   - D3: Rejected — too low-level for this use case, large bundle
 *   - Pure CSS: Rejected — current CSS bars in Compare views are too limited for daily data
 */

import { computed, ref } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import type { DailyPoint } from '@/engine/forecast'

const props = defineProps<{
  actualPoints: DailyPoint[]
  forecastPoints: DailyPoint[]
  currencyLabel: string
  /** Whether forecast data is available to show */
  hasForecast: boolean
}>()

const chartMode = ref<'cumulative' | 'daily'>('cumulative')
const showForecast = ref(false)

const series = computed(() => {
  const result: Array<{
    name: string
    data: Array<{ x: string; y: number }>
    type?: string
  }> = []

  // Actuals series
  if (props.actualPoints.length > 0) {
    result.push({
      name: 'Actuals',
      data: props.actualPoints.map((p) => ({
        x: p.date,
        y: chartMode.value === 'cumulative' ? p.cumulative : p.amount,
      })),
    })
  }

  // Forecast series (optional)
  if (showForecast.value && props.forecastPoints.length > 0) {
    result.push({
      name: 'Forecast',
      data: props.forecastPoints.map((p) => ({
        x: p.date,
        y: chartMode.value === 'cumulative' ? p.cumulative : p.amount,
      })),
    })
  }

  return result
})

const chartOptions = computed(() => ({
  chart: {
    id: 'cashflow-chart',
    type: 'line' as const,
    height: 350,
    toolbar: { show: true, tools: { download: true, zoom: true, pan: true, reset: true } },
    zoom: { enabled: true },
    fontFamily: 'inherit',
  },
  stroke: {
    width: series.value.map((_, i) => i === 0 ? 2 : 2),
    dashArray: series.value.map((_, i) => i === 0 ? 0 : 5),
    curve: 'smooth' as const,
  },
  colors: ['#3b82f6', '#f59e0b'],
  xaxis: {
    type: 'datetime' as const,
    labels: {
      format: 'dd MMM',
      style: { fontSize: '11px', colors: '#9ca3af' },
    },
  },
  yaxis: {
    labels: {
      formatter: (val: number) => `${props.currencyLabel}${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      style: { fontSize: '11px', colors: '#9ca3af' },
    },
    title: {
      text: chartMode.value === 'cumulative' ? 'Running Balance' : 'Daily Net',
      style: { fontSize: '12px', color: '#6b7280' },
    },
  },
  tooltip: {
    shared: true,
    x: { format: 'dd MMM yyyy' },
    y: {
      formatter: (val: number) =>
        `${props.currencyLabel}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
  },
  grid: {
    borderColor: '#f3f4f6',
    strokeDashArray: 4,
  },
  legend: {
    position: 'top' as const,
    horizontalAlign: 'left' as const,
    fontSize: '12px',
  },
  noData: {
    text: 'No data for selected period',
    style: { fontSize: '14px', color: '#9ca3af' },
  },
}))
</script>

<template>
  <div>
    <!-- Chart controls -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
      <!-- Cumulative / Daily toggle -->
      <div class="flex gap-1">
        <button
          class="btn text-xs"
          :class="chartMode === 'cumulative'
            ? 'bg-brand-50 text-brand-700 border border-brand-300'
            : 'bg-gray-50 text-gray-600 border border-gray-200'"
          @click="chartMode = 'cumulative'"
        >
          Running balance
        </button>
        <button
          class="btn text-xs"
          :class="chartMode === 'daily'
            ? 'bg-brand-50 text-brand-700 border border-brand-300'
            : 'bg-gray-50 text-gray-600 border border-gray-200'"
          @click="chartMode = 'daily'"
        >
          Daily net
        </button>
      </div>

      <!-- Forecast toggle -->
      <label v-if="hasForecast" class="flex items-center gap-1.5 text-xs text-gray-600 ml-auto cursor-pointer">
        <input
          v-model="showForecast"
          type="checkbox"
          class="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        Show forecast
      </label>
    </div>

    <!-- Chart -->
    <div v-if="actualPoints.length > 0 || (showForecast && forecastPoints.length > 0)">
      <VueApexCharts
        :key="`${chartMode}-${showForecast}`"
        type="line"
        height="350"
        :options="chartOptions"
        :series="series"
      />
    </div>
    <div v-else class="text-center py-12">
      <div class="i-lucide-line-chart text-4xl text-gray-300 mx-auto mb-3" />
      <p class="text-gray-500">No data to chart</p>
      <p class="text-gray-400 text-sm mt-1">
        Import actuals or enable forecast to see the cashflow graph
      </p>
    </div>
  </div>
</template>
