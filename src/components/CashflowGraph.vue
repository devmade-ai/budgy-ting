<script setup lang="ts">
/**
 * Requirement: One intuitive cashflow picture — "how much cash do I have, and when
 *   does it run out?" — with the forecast's uncertainty shown as a band.
 * Approach: ApexCharts combo chart following the Farlume chart language.
 *   Default "Balance" mode draws a single continuous absolute-cash line: history is
 *   reconstructed backward from today's cash-on-hand, the forecast projects it forward,
 *   and the line crosses a zero reference exactly at the runway depletion date. The
 *   forecast's optimistic/pessimistic spread is a translucent amber range area. A
 *   "Daily net" mode keeps the per-day in/out view. History = solid ink line, forecast
 *   = dashed amber line, range = amber fill — colors pulled from the Farlume tokens.
 * Alternatives:
 *   - Cumulative net from zero: Rejected — the zero crossing was meaningless; users read
 *     runway as "when does the line hit zero", which only works on absolute cash.
 *   - Separate history-net + runway-balance lines: Rejected — two lines on different
 *     baselines/scales, confusing.
 *   - Chart.js / D3: Rejected — ApexCharts has better Vue 3 integration, built-in
 *     tooltips, and native range-area support.
 */

import { computed, ref, onMounted, onUnmounted } from 'vue'
import VueApexCharts from 'vue3-apexcharts'
import { LineChart, Info } from 'lucide-vue-next'
import { useDarkMode } from '@/composables/useDarkMode'
import { resolveThemeColor } from '@/composables/useThemeColor'
import type { Transaction } from '@/types/models'
import type { DailyForecastPoint } from '@/engine/forecast'
import type { RunwayResult } from '@/engine/runway'

const props = defineProps<{
  transactions: Transaction[]
  forecastPoints: DailyForecastPoint[]
  runway: RunwayResult | null
  /** Today's cash on hand — anchors the balance reconstruction (null = show net position). */
  cashOnHand: number | null
  currencyLabel: string
  forecastMonths: number
}>()

const emit = defineEmits<{
  'update:forecastMonths': [months: number]
}>()

const chartMode = ref<'balance' | 'daily'>('balance')
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

// Read prefers-reduced-motion once at init. ApexCharts draws SVG animations
// imperatively via its own RAF loop, so the global CSS reduced-motion clamp
// doesn't reach it — we have to pass `chart.animations.enabled` explicitly.
// Mid-session OS-level toggles don't update the chart; users reload to pick
// up a preference change. Acceptable trade-off for an OS-level preference.
const reducedMotion = typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

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

const round2 = (n: number) => Math.round(n * 100) / 100

// Cumulative net of all history (running total at the last actual point).
const lastActualCumulative = computed(() =>
  actualPoints.value.length > 0
    ? actualPoints.value[actualPoints.value.length - 1]!.cumulative
    : 0,
)

// Absolute-cash anchor. Balance mode reconstructs around today's cash-on-hand;
// when it's missing/non-positive we can't draw absolute cash, so we fall back to
// the net-position framing (history from zero, forecast continuing from last actual).
const balanceAnchor = computed(() =>
  props.cashOnHand != null && props.cashOnHand > 0 ? props.cashOnHand : null,
)

// Whether the forecast carries prediction bands worth drawing as a range area.
const hasBand = computed(
  () =>
    chartMode.value === 'balance' &&
    props.forecastPoints.length > 0 &&
    props.forecastPoints.some((p) => p.band),
)

// rangeArea chart type only when a band is actually drawn; otherwise a plain line
// chart. ApexCharts honours per-series `type`, so line series render correctly
// inside a rangeArea combo and vice-versa.
const chartType = computed<'rangeArea' | 'line'>(() => (hasBand.value ? 'rangeArea' : 'line'))

// Series name for the historical line — "Cash balance" when anchored to real cash,
// "Net position" in the from-zero fallback. Drives color/legend.
const historyLineName = computed(() => (balanceAnchor.value != null ? 'Cash balance' : 'Net position'))

type Pt = { x: string; y: number | [number, number] }

const series = computed(() => {
  const result: Array<{ name: string; type: string; data: Pt[] }> = []

  // ── Daily-net mode: signed per-day amounts, history + forecast as two lines ──
  if (chartMode.value === 'daily') {
    if (actualPoints.value.length > 0) {
      result.push({
        name: 'Spending',
        type: 'line',
        data: actualPoints.value.map((p) => ({ x: p.date, y: p.amount })),
      })
    }
    if (props.forecastPoints.length > 0) {
      result.push({
        name: 'Forecast',
        type: 'line',
        data: props.forecastPoints.map((p) => ({ x: p.date, y: p.amount })),
      })
    }
    return result
  }

  // ── Balance mode (default): one continuous absolute-cash trajectory ──
  // Requirement: a single line that reads as "cash I have" and crosses zero at the
  //   runway date, with the forecast's uncertainty as a band around it.
  // Approach: anchor the boundary (today) at cash-on-hand. History balance =
  //   cash today − net change since each past date = p.cumulative + historyOffset,
  //   where historyOffset = cashToday − lastActualCumulative. Forecast balance =
  //   boundary + cumulative forecast net. The band cumulates the per-day optimistic
  //   (band.upper) / pessimistic (band.lower) amounts the same way runway.ts does.
  const lastActual =
    actualPoints.value.length > 0 ? actualPoints.value[actualPoints.value.length - 1]! : null
  const historyOffset =
    balanceAnchor.value != null ? balanceAnchor.value - lastActualCumulative.value : 0
  // Boundary balance where history ends and forecast begins (today's cash, or the
  // last actual cumulative in the from-zero fallback). forecastBase keeps the two
  // halves continuous: history ends here and the forecast bridges from the same point.
  const forecastBase = lastActualCumulative.value + historyOffset

  // History line
  if (actualPoints.value.length > 0) {
    result.push({
      name: historyLineName.value,
      type: 'line',
      data: actualPoints.value.map((p) => ({ x: p.date, y: round2(p.cumulative + historyOffset) })),
    })
  }

  // Forecast uncertainty range (drawn first so the lines sit on top of the fill)
  if (hasBand.value) {
    const bandData: Pt[] = []
    if (lastActual) bandData.push({ x: lastActual.date, y: [forecastBase, forecastBase] })
    let cumUpper = 0
    let cumLower = 0
    for (const p of props.forecastPoints) {
      cumUpper += p.band ? p.band.upper : p.amount
      cumLower += p.band ? p.band.lower : p.amount
      bandData.push({
        x: p.date,
        y: [round2(forecastBase + cumLower), round2(forecastBase + cumUpper)],
      })
    }
    result.push({ name: 'Likely range', type: 'rangeArea', data: bandData })
  }

  // Forecast (expected) line — bridged from the boundary so it connects with no gap
  if (props.forecastPoints.length > 0) {
    const forecastData: Pt[] = []
    if (lastActual) forecastData.push({ x: lastActual.date, y: round2(forecastBase) })
    for (const p of props.forecastPoints) {
      forecastData.push({ x: p.date, y: round2(forecastBase + p.cumulative) })
    }
    result.push({ name: 'Forecast', type: 'line', data: forecastData })
  }

  return result
})

const chartOptions = computed(() => {
  // Requirement: Chart colors follow the Farlume chart language — history is a
  //   solid ink line, the forecast is a dashed amber line, the uncertainty range
  //   is a translucent amber fill. Colors come from the Farlume token layer.
  // Approach: resolveThemeColor reads the computed CSS custom property from
  //   <html> and converts to hex via a canvas pixel — ApexCharts can't consume
  //   CSS variables. Re-resolves on every chartOptions recompute (isDark deps).
  //   All per-series arrays (colors/stroke/dash/fill) map over series.value so
  //   they stay index-aligned regardless of which series are present.
  const isHistory = (n: string) => n === 'Spending' || n === 'Cash balance' || n === 'Net position'
  const isForecast = (n: string) => n === 'Forecast' || n === 'Likely range'
  const colors = series.value.map((s) => {
    if (isHistory(s.name)) return resolveThemeColor('--chart-history', '#444A54')
    if (isForecast(s.name)) return resolveThemeColor('--chart-forecast', '#CC8A2E')
    return resolveThemeColor('--text-muted', '#777E89')
  })
  // Range area carries no stroke (fill only); lines are 2px. Forecast line dashed.
  const strokeWidths = series.value.map((s) => (s.name === 'Likely range' ? 0 : 2))
  const dashArray = series.value.map((s) => (s.name === 'Forecast' ? 6 : 0))
  // Fill opacity is only meaningful for the range area; line series ignore fill.
  const fillOpacity = series.value.map((s) => (s.name === 'Likely range' ? 0.16 : 1))

  const labelColor = resolveThemeColor('--text-muted', '#777E89')
  const gridColor = resolveThemeColor('--chart-grid', 'rgba(22,25,31,0.10)')
  const negColor = resolveThemeColor('--neg', '#C0492F')
  const tooltipTheme = isDark.value ? 'dark' : 'light'

  // Zero-reference + depletion markers — only in balance mode anchored to real cash,
  // where "balance hits zero" is the runway story. Net-position / daily modes omit them.
  const showRunwayMarkers = chartMode.value === 'balance' && balanceAnchor.value != null
  const depletion = props.runway?.depletionDate
  const yAnnotations = showRunwayMarkers
    ? [
        {
          y: 0,
          borderColor: negColor,
          strokeDashArray: 4,
          label: {
            text: 'Out of cash',
            position: 'left' as const,
            textAnchor: 'start' as const,
            borderColor: 'transparent',
            style: { color: '#fff', background: negColor, fontSize: '10px' },
          },
        },
      ]
    : []
  const xAnnotations =
    showRunwayMarkers && depletion
      ? [
          {
            x: new Date(depletion + 'T00:00:00').getTime(),
            borderColor: negColor,
            strokeDashArray: 4,
            label: {
              text: 'Runs out',
              orientation: 'horizontal' as const,
              position: 'top' as const,
              borderColor: 'transparent',
              style: { color: '#fff', background: negColor, fontSize: '10px' },
            },
          },
        ]
      : []

  return {
    chart: {
      id: 'cashflow-graph',
      type: chartType.value,
      height: chartHeight.value,
      // Requirement: No drag-to-zoom — timeline presets handle date range selection
      // Approach: Zoom disabled, toolbar hidden. Preset buttons (1W/1M/3M/6M/1Y/All)
      //   set xaxis min/max instead.
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: 'inherit',
      background: 'transparent',
      animations: { enabled: !reducedMotion },
    },
    theme: { mode: isDark.value ? 'dark' as const : 'light' as const },
    // rangeArea defaults data labels ON (one per band edge) — force off so the
    // chart stays a clean trajectory, not a wall of numbers.
    dataLabels: { enabled: false },
    annotations: { yaxis: yAnnotations, xaxis: xAnnotations },
    stroke: {
      width: strokeWidths,
      dashArray,
      curve: 'smooth' as const,
    },
    fill: { type: 'solid', opacity: fillOpacity },
    colors,
    xaxis: {
      type: 'datetime' as const,
      ...(xaxisRange.value.min !== undefined ? { min: xaxisRange.value.min } : {}),
      labels: {
        // Browser-locale-aware axis labels. ApexCharts' internal `format: 'dd MMM'`
        // always emits English month abbreviations; a custom formatter lets us
        // defer to `toLocaleDateString(undefined, …)`, matching the formatting
        // already used by the tooltip Y value, the SR chart summary, and
        // `useFormat.formatDateForDisplay()`. Currently moot while the UI is
        // English-only, but zero-cost to wire now so chart axes track the
        // locale the moment any copy is translated.
        formatter: (_value: string, timestamp?: number) =>
          timestamp === undefined
            ? ''
            : new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        style: { fontSize: '11px', colors: labelColor },
      },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `${props.currencyLabel}${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        style: { fontSize: '11px', colors: labelColor },
      },
      title: {
        text: chartMode.value === 'balance' ? 'Cash balance' : 'Daily net',
        style: { fontSize: '12px', color: labelColor },
      },
    },
    tooltip: {
      shared: true,
      theme: tooltipTheme,
      x: {
        // Same locale-aware custom formatter as the x-axis labels (see above).
        formatter: (value: number) =>
          new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
      },
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

// Screen-reader summary of the chart — ApexCharts renders SVG with no
// semantic hooks, so AT users get nothing about the primary visual surface
// without a text alternative. Sentence form (not data-table) keeps it scannable.
const chartSummary = computed(() => {
  if (!hasData.value) return ''
  const money = (n: number) =>
    `${props.currencyLabel}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  // Balance mode anchored to real cash: describe the runway trajectory.
  if (chartMode.value === 'balance' && balanceAnchor.value != null) {
    const parts: string[] = [
      'Cash balance over time chart.',
      `${money(balanceAnchor.value)} cash on hand today.`,
    ]
    if (props.runway?.depletionDate) {
      parts.push(`Projected to run out of cash on ${props.runway.depletionDate}.`)
    } else if (props.runway) {
      parts.push(`Projected balance of ${money(props.runway.endBalance)} at the end of the forecast.`)
    }
    return parts.join(' ')
  }

  // Net-position / daily-net fallback: describe history direction and forecast reach.
  const parts: string[] = ['Cashflow chart.']
  if (actualPoints.value.length > 0) {
    const first = actualPoints.value[0]!
    const last = actualPoints.value[actualPoints.value.length - 1]!
    const direction =
      last.cumulative > first.cumulative
        ? 'up'
        : last.cumulative < first.cumulative
          ? 'down'
          : 'flat'
    parts.push(`History from ${first.date} to ${last.date}, net ${direction} to ${money(last.cumulative)}.`)
  }
  if (props.forecastPoints.length > 0) {
    const lastForecast = props.forecastPoints[props.forecastPoints.length - 1]!
    parts.push(`Forecast extends to ${lastForecast.date}.`)
  }
  return parts.join(' ')
})
</script>

<template>
  <div class="mb-6">
    <!-- Chart controls — hidden in print (interactive toggles, no value on paper) -->
    <!-- Stacks vertically on mobile, single row on desktop -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 no-print">
      <div class="fl-seg">
        <button
          class="fl-seg__opt"
          :data-active="chartMode === 'balance'"
          @click="chartMode = 'balance'"
        >
          Balance
        </button>
        <button
          class="fl-seg__opt"
          :data-active="chartMode === 'daily'"
          @click="chartMode = 'daily'"
        >
          Daily net
        </button>
      </div>

      <div class="flex items-center gap-2 sm:ml-auto overflow-x-auto">
        <span class="fl-eyebrow shrink-0">History</span>
        <div class="fl-seg fl-seg--sm fl-seg--mono shrink-0">
          <button
            v-for="opt in timeRangeOptions"
            :key="opt.value"
            class="fl-seg__opt"
            :data-active="timeRange === opt.value"
            @click="timeRange = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>

        <span class="fl-eyebrow shrink-0">Forecast</span>
        <div class="fl-seg fl-seg--sm fl-seg--mono shrink-0">
          <button
            v-for="opt in forecastHorizonOptions"
            :key="opt.value"
            class="fl-seg__opt"
            :data-active="forecastMonths === opt.value"
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
        :key="`${chartMode}-${chartType}-${chartHeight}-${isDark}-${timeRange}-${forecastMonths}`"
        :type="chartType"
        :height="chartHeight"
        :options="chartOptions"
        :series="series"
        aria-hidden="true"
      />
      <!-- Honesty note: the history half of the Balance line is reconstructed — the app
           stores transactions + a single cash-on-hand figure, never past balances, so it
           works backward from today's cash. A continuous line LOOKS like recorded fact;
           this flags that it's derived (and thus only as good as the data) without a
           scary banner. Shown only when there's a real cash anchor and history to derive. -->
      <p
        v-if="chartMode === 'balance' && balanceAnchor != null && actualPoints.length > 0"
        class="flex items-start gap-1.5 text-xs text-ink-muted mt-2 no-print"
      >
        <Info :size="13" class="text-ink-faint shrink-0 mt-0.5" aria-hidden="true" />
        <span>Past balance is worked out from your cash on hand and your transactions, so it's only as accurate as your records.</span>
      </p>
    </div>
    <div v-else class="text-center py-12">
      <LineChart :size="36" class="text-ink-faint mx-auto mb-3" aria-hidden="true" />
      <p class="text-ink-soft">No data to chart</p>
      <p class="text-ink-muted text-sm mt-1">Import transactions to see your cashflow</p>
    </div>
  </div>
</template>
