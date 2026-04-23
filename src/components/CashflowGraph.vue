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
  forecastMonths: number
}>()

const emit = defineEmits<{
  'update:forecastMonths': [months: number]
}>()

const chartMode = ref<'cumulative' | 'daily'>('cumulative')
const { isDark } = useDarkMode()

// Requirement: User-selectable forecast horizon
// Approach: Preset buttons emit to parent (WorkspaceDashboard) which owns the
//   forecast computation. Separate from lookback presets — different concerns.
const forecastHorizonOptions: { value: number; label: string }[] = [
  { value: 1, label: '1M' },
  { value: 3, label: '3M' },
  { value: 6, label: '6M' },
  { value: 12, label: '1Y' },
]

// Requirement: Preset timeline ranges instead of drag-to-zoom
// Approach: Button group with lookback periods from today. Forecast (future data)
//   is always visible. xaxis min/max constrain the visible window.
// Alternatives:
//   - Drag-to-zoom: Rejected — user prefers explicit preset options
//   - Date picker inputs: Rejected — presets are faster and less cluttered
type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'
const timeRange = ref<TimeRange>('ALL')

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'All' },
]

// Requirement: Compute xaxis min from the selected lookback preset
// Approach: Use Date arithmetic for proper calendar-aware boundaries.
//   setMonth/setFullYear handle varying month lengths and leap years correctly
//   (e.g., Mar 31 → setMonth(-1) → Feb 28/29, not a fixed 30 days).
// Alternatives:
//   - Fixed ms constants (7*86400000, 30*86400000, etc.): Rejected — "1M" back
//     from Mar 31 should land on Feb 28, not Mar 1. Calendar months vary.
const xaxisRange = computed<{ min?: number }>(() => {
  if (timeRange.value === 'ALL') return {}

  const d = new Date()
  switch (timeRange.value) {
    case '1W': d.setDate(d.getDate() - 7); break
    case '1M': d.setMonth(d.getMonth() - 1); break
    case '3M': d.setMonth(d.getMonth() - 3); break
    case '6M': d.setMonth(d.getMonth() - 6); break
    case '1Y': d.setFullYear(d.getFullYear() - 1); break
  }
  return { min: d.getTime() }
})

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

// Requirement: Respect prefers-reduced-motion for chart animations.
// Approach: ApexCharts drives SVG animations via its own RAF loop — the global
//   CSS reduced-motion clamp in index.css only covers CSS animations/transitions,
//   so chart draw-in and tooltip transitions still played for motion-sensitive
//   users. We read the media query into a reactive ref and feed it to
//   chart.animations.enabled. The listener covers users who toggle the OS-level
//   preference mid-session (rare but free to support).
// Alternatives:
//   - Global setting via ApexCharts.setOption: Rejected — couples our config
//     to the singleton-style API; per-chart config is cleaner.
//   - Read once at module load: Rejected — doesn't react to preference changes
//     and leaks no cleanup path for the listener.
const reducedMotion = ref(
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches,
)
let reducedMotionQuery: MediaQueryList | undefined
function onReducedMotionChange(e: MediaQueryListEvent) {
  reducedMotion.value = e.matches
}
onMounted(() => {
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotionQuery.addEventListener('change', onReducedMotionChange)
})
onUnmounted(() => {
  reducedMotionQuery?.removeEventListener('change', onReducedMotionChange)
})

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
      name: 'Spending',
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
    if (s.name === 'Spending') return resolveThemeColor('--color-info', '#3b82f6')
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
      // Requirement: No drag-to-zoom — timeline presets handle date range selection
      // Approach: Zoom disabled, toolbar hidden. Preset buttons (1W/1M/3M/6M/1Y/All)
      //   set xaxis min/max instead.
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: 'inherit',
      background: 'transparent',
      // Disable all chart entrance + transition animations when the user has
      // requested reduced motion. ApexCharts draws SVG imperatively, so the
      // CSS reduced-motion clamp doesn't reach it.
      animations: { enabled: !reducedMotion.value },
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
      ...(xaxisRange.value.min !== undefined ? { min: xaxisRange.value.min } : {}),
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
    // Requirement: Legend at top — toolbar hidden so top space is free
    legend: {
      position: 'top' as const,
      horizontalAlign: 'left' as const,
      fontSize: '12px',
      labels: { colors: labelColor },
    },
    // Requirement: Subtle markers visible on hover only
    // Approach: Zero-size markers that expand on hover — no clutter, clear interaction
    markers: {
      size: 0,
      hover: { sizeOffset: 4 },
    },
    noData: {
      text: 'No data for selected period',
      style: { fontSize: '14px', color: labelColor },
    },
  }
})

const hasData = computed(() => actualPoints.value.length > 0 || props.forecastPoints.length > 0)

// Screen-reader text summary of the chart. ApexCharts renders SVG with no
// semantic hooks — without this, AT users get nothing about the dataset that's
// the app's primary visual surface.
// Requirement: Describe period, min/max balance, trend direction, and runway.
// Approach: Computed sentence built from actuals + forecast + runway. Kept
//   concise so AT users don't have to wade through data point-by-point.
// Alternatives:
//   - Data table alternative: Deferred — long list, less useful for cashflow shape
//   - ApexCharts' built-in a11y (accessibility: { enabled: true }): Doesn't
//     exist in the library; this text is the minimum viable alternative.
const chartSummary = computed(() => {
  if (!hasData.value) return ''
  const parts: string[] = ['Cashflow chart.']

  if (actualPoints.value.length > 0) {
    const first = actualPoints.value[0]!
    const last = actualPoints.value[actualPoints.value.length - 1]!
    const direction = last.cumulative > first.cumulative
      ? 'up'
      : last.cumulative < first.cumulative
        ? 'down'
        : 'flat'
    parts.push(
      `Spending from ${first.date} to ${last.date}, cumulative ${direction} to ${props.currencyLabel}${last.cumulative.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    )
  }

  if (props.forecastPoints.length > 0) {
    const lastForecast = props.forecastPoints[props.forecastPoints.length - 1]!
    parts.push(
      `Forecast extends to ${lastForecast.date}, projected cumulative ${props.currencyLabel}${lastForecast.cumulative.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    )
  }

  if (props.runway?.depletionDate) {
    parts.push(`Cash runs out on ${props.runway.depletionDate}.`)
  } else if (props.runway) {
    parts.push(
      `Projected end balance ${props.currencyLabel}${props.runway.endBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
    )
  }

  return parts.join(' ')
})
</script>

<template>
  <div class="mb-6">
    <!-- Chart controls — hidden in print (interactive toggles, no value on paper) -->
    <!-- Stacks vertically on mobile, single row on desktop -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-2 mb-4 no-print">
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

      <div class="flex items-center gap-2 sm:ml-auto overflow-x-auto">
        <span class="text-xs text-base-content/60 shrink-0">History</span>
        <div class="join shrink-0">
          <button
            v-for="opt in timeRangeOptions"
            :key="opt.value"
            class="join-item btn btn-xs sm:btn-sm"
            :class="timeRange === opt.value ? 'btn-active' : ''"
            @click="timeRange = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>

        <span class="text-xs text-base-content/60 shrink-0">Forecast</span>
        <div class="join shrink-0">
          <button
            v-for="opt in forecastHorizonOptions"
            :key="opt.value"
            class="join-item btn btn-xs sm:btn-sm"
            :class="forecastMonths === opt.value ? 'btn-active' : ''"
            @click="emit('update:forecastMonths', opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Chart -->
    <div v-if="hasData" role="img" :aria-label="chartSummary">
      <!-- Screen-reader summary — sr-only ensures it doesn't render visually.
           role="img" + aria-label on the wrapper gives AT users a concise
           description without announcing every SVG element inside. -->
      <span class="sr-only">{{ chartSummary }}</span>
      <VueApexCharts
        :key="`${chartMode}-${chartHeight}-${isDark}-${timeRange}-${forecastMonths}-${reducedMotion}`"
        type="line"
        :height="chartHeight"
        :options="chartOptions"
        :series="series"
        aria-hidden="true"
      />
    </div>
    <div v-else class="text-center py-12">
      <LineChart :size="36" class="text-base-content/20 mx-auto mb-3" aria-hidden="true" />
      <p class="text-base-content/70">No data to chart</p>
      <p class="text-base-content/60 text-sm mt-1">Import transactions to see your cashflow</p>
    </div>
  </div>
</template>
