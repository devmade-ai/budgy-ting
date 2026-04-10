<script setup lang="ts">
/**
 * Requirement: Daily cashflow graph with actuals, forecast, confidence bands, and runway overlay
 * Approach: ApexCharts mixed line/area chart. Multiple series toggled by data availability.
 *   Actuals as solid blue, forecast as dashed amber, bands as shaded area, runway as filled gradient.
 * Alternatives:
 *   - Chart.js: Rejected — ApexCharts has better Vue 3 integration and built-in tooltips
 *   - D3: Rejected — too low-level for this use case
 */

import { computed, ref, onMounted, onUnmounted } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { LineChart } from 'lucide-vue-next'
import { useDarkMode } from '@/composables/useDarkMode'
import { resolveThemeColor } from '@/composables/useThemeColor'
import type { Transaction } from '@/types/models'
import type { DailyForecastPoint } from '@/engine/forecast'
import type { RunwayResult } from '@/engine/runway'

const props = defineProps<{
  transactions: Transaction[]
  forecastPoints: DailyForecastPoint[]
  runway: RunwayResult | null
  currencyLabel: string
}>()

const chartMode = ref<'cumulative' | 'daily'>('cumulative')
const { isDark } = useDarkMode()

// Requirement: Responsive chart height — smaller on mobile, larger on desktop
// Approach: Track window width and compute height from breakpoints.
// Alternatives:
//   - CSS-only height: Rejected — ApexCharts requires a numeric height prop
//   - Fixed 350px: Rejected — too tall on small phones, too short on large desktops
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
const chartHeight = computed(() => {
  if (windowWidth.value < 640) return 280
  if (windowWidth.value < 1024) return 350
  return 420
})

function handleResize() { windowWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', handleResize))
onUnmounted(() => window.removeEventListener('resize', handleResize))

// Build actual daily points from transactions
const actualDailyMap = computed(() => {
  const map = new Map<string, number>()
  for (const t of props.transactions) {
    map.set(t.date, (map.get(t.date) ?? 0) + t.amount)
  }
  return map
})

const actualPoints = computed(() => {
  const entries = [...actualDailyMap.value.entries()].sort(([a], [b]) => a.localeCompare(b))
  let cumulative = 0
  return entries.map(([date, amount]) => {
    cumulative += amount
    return { date, amount, cumulative }
  })
})

const series = computed(() => {
  const result: Array<{
    name: string
    data: Array<{ x: string; y: number }>
    type?: string
    color?: string
  }> = []

  // Actuals
  if (actualPoints.value.length > 0) {
    result.push({
      name: 'Actuals',
      data: actualPoints.value.map((p) => ({
        x: p.date,
        y: chartMode.value === 'cumulative' ? p.cumulative : p.amount,
      })),
    })
  }

  // Forecast — bridge from last actual so lines connect without a gap
  // Requirement: No visual gap between actuals line and forecast line
  // Approach: Prepend the last actual data point to the forecast series so the
  //   forecast line starts where actuals end. This creates a seamless visual join.
  // Alternatives:
  //   - Extend actuals to today with zero amounts: Rejected — misleading data
  //   - Overlap date ranges: Rejected — tooltip shows duplicate entries
  if (props.forecastPoints.length > 0) {
    const forecastData = props.forecastPoints.map((p) => ({
      x: p.date,
      y: chartMode.value === 'cumulative' ? p.cumulative : p.amount,
    }))

    // If we have actuals, prepend the last actual point so the forecast line
    // connects visually to where actuals end (no gap)
    if (actualPoints.value.length > 0) {
      const lastActual = actualPoints.value[actualPoints.value.length - 1]!
      const firstForecastDate = props.forecastPoints[0]?.date
      // Only bridge if there's actually a date gap
      if (firstForecastDate && lastActual.date < firstForecastDate) {
        forecastData.unshift({
          x: lastActual.date,
          y: chartMode.value === 'cumulative' ? lastActual.cumulative : lastActual.amount,
        })
      }
    }

    result.push({
      name: 'Forecast',
      data: forecastData,
    })
  }

  // Runway (balance progression)
  if (props.runway && props.runway.dailyBalance.length > 0 && chartMode.value === 'cumulative') {
    result.push({
      name: 'Cash balance',
      data: props.runway.dailyBalance.map((p) => ({
        x: p.date,
        y: p.balance,
      })),
    })
  }

  return result
})

const chartOptions = computed(() => {
  const seriesCount = series.value.length
  const strokeWidths = Array(seriesCount).fill(2) as number[]
  const dashArray = series.value.map((s) => s.name === 'Forecast' ? 5 : 0)
  // Requirement: Chart colors must come from DaisyUI theme tokens
  // Approach: resolveThemeColor reads computed oklch values from <html> and
  //   converts to hex via canvas pixel — ApexCharts can't use CSS variables.
  //   Colors re-resolve on every chartOptions recompute (isDark triggers this).
  const colors = series.value.map((s) => {
    if (s.name === 'Actuals') return resolveThemeColor('--color-info', '#3b82f6')
    if (s.name === 'Forecast') return resolveThemeColor('--color-warning', '#f59e0b')
    if (s.name === 'Cash balance') return resolveThemeColor('--color-success', '#10b981')
    return resolveThemeColor('--color-base-content', '#6b7280')
  })

  const labelColor = resolveThemeColor('--color-base-content', '#9ca3af')
  const gridColor = resolveThemeColor('--color-base-300', '#e5e7eb')
  const tooltipTheme = isDark.value ? 'dark' : 'light'

  return {
    chart: {
      id: 'cashflow-graph',
      type: 'line' as const,
      height: chartHeight.value,
      toolbar: { show: true, tools: { download: true, zoom: true, pan: true, reset: true } },
      zoom: { enabled: true },
      fontFamily: 'inherit',
      background: 'transparent',
    },
    theme: { mode: isDark.value ? 'dark' as const : 'light' as const },
    stroke: {
      width: strokeWidths,
      dashArray,
      curve: 'smooth' as const,
    },
    colors,
    xaxis: {
      type: 'datetime' as const,
      labels: {
        format: 'dd MMM',
        style: { fontSize: '11px', colors: labelColor },
      },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `${props.currencyLabel}${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        style: { fontSize: '11px', colors: labelColor },
      },
      title: {
        text: chartMode.value === 'cumulative' ? 'Cumulative' : 'Daily Net',
        style: { fontSize: '12px', color: labelColor },
      },
    },
    tooltip: {
      shared: true,
      theme: tooltipTheme,
      x: { format: 'dd MMM yyyy' },
      y: {
        formatter: (val: number) =>
          `${props.currencyLabel}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4,
    },
    legend: {
      position: 'top' as const,
      horizontalAlign: 'left' as const,
      fontSize: '12px',
      labels: { colors: labelColor },
    },
    noData: {
      text: 'No data for selected period',
      style: { fontSize: '14px', color: labelColor },
    },
  }
})

const hasData = computed(() => actualPoints.value.length > 0 || props.forecastPoints.length > 0)
</script>

<template>
  <div class="mb-6">
    <!-- Chart controls — hidden in print (interactive toggles, no value on paper) -->
    <div class="flex flex-wrap items-center gap-2 mb-4 no-print">
      <div class="join">
        <button
          class="join-item btn btn-sm"
          :class="chartMode === 'cumulative' ? 'btn-active' : ''"
          @click="chartMode = 'cumulative'"
        >
          Cumulative
        </button>
        <button
          class="join-item btn btn-sm"
          :class="chartMode === 'daily' ? 'btn-active' : ''"
          @click="chartMode = 'daily'"
        >
          Daily net
        </button>
      </div>
    </div>

    <!-- Chart -->
    <div v-if="hasData">
      <VueApexCharts
        :key="`${chartMode}-${chartHeight}-${isDark}`"
        type="line"
        :height="chartHeight"
        :options="chartOptions"
        :series="series"
      />
    </div>
    <div v-else class="text-center py-12">
      <LineChart :size="36" class="text-base-content/20 mx-auto mb-3" />
      <p class="text-base-content/60">No data to chart</p>
      <p class="text-base-content/40 text-sm mt-1">Import transactions to see your cashflow</p>
    </div>
  </div>
</template>
