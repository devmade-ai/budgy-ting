<script setup lang="ts">
/**
 * Forecast diagnostics — advanced, out-of-sample calibration metrics from the rolling-origin
 * backtest (src/engine/validation.ts). Collapsed by default and clearly labelled "advanced"
 * because these are technical (coverage, Wilson CI, pinball, PIT) — the main MetricsGrid stays
 * non-technical per the UX rule. This panel is for verifying the forecast is honestly calibrated.
 *
 * Requirement (FORECASTING_RESEARCH.md §16.5): surface the harness's interval-calibration metrics.
 * Approach: native <details>/<summary> collapse (zero JS, accessible, DaisyUI-compatible in v5),
 *   DaisyUI table + badges + semantic tokens. PIT histogram drawn as plain bars (flat = calibrated,
 *   U = bands too narrow, ∩ = too wide); bar heights are data dimensions, not tokens.
 */
import { computed } from 'vue'
import type { BacktestSummary } from '@/engine/validation'
import { formatAmount } from '@/composables/useFormat'

const props = defineProps<{
  summary: BacktestSummary | null
  currencyLabel: string
}>()

// Coverage is "good" when the nominal target sits inside the Wilson 95% CI of observed coverage.
const coverageOk = computed(() => {
  const c = props.summary?.coverage
  if (!c) return null
  return c.nominal >= c.wilsonLo && c.nominal <= c.wilsonHi
})

const pitMax = computed(() => Math.max(1, ...(props.summary?.pitHistogram ?? [1])))

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}
</script>

<template>
  <details v-if="summary && summary.records > 0" class="mt-4 border-t border-base-300 pt-3">
    <summary class="text-xs text-base-content/60 cursor-pointer hover:text-base-content select-none">
      Forecast diagnostics (advanced)
    </summary>

    <div class="mt-3 bg-base-200 rounded-box p-4 space-y-4">
      <p class="text-xs text-base-content/60">
        Out-of-sample, from a walk-forward backtest over {{ summary.records }} predictions.
        These check whether the forecast and its confidence bands are honestly calibrated.
      </p>

      <!-- Headline calibration figures -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div class="bg-base-100 rounded-field border border-base-300 p-3">
          <p class="text-xs text-base-content/60 uppercase tracking-wide mb-1">Band coverage</p>
          <p
            class="text-lg font-semibold"
            :class="coverageOk === true ? 'text-success' : coverageOk === false ? 'text-warning' : 'text-base-content'"
          >
            {{ summary.coverage ? pct(summary.coverage.picp) : '—' }}
          </p>
          <p v-if="summary.coverage" class="text-xs text-base-content/60 mt-0.5">
            target {{ pct(summary.coverage.nominal) }} · 95% CI
            {{ pct(summary.coverage.wilsonLo) }}–{{ pct(summary.coverage.wilsonHi) }}
          </p>
        </div>

        <div class="bg-base-100 rounded-field border border-base-300 p-3">
          <p class="text-xs text-base-content/60 uppercase tracking-wide mb-1">Pinball loss</p>
          <p class="text-lg font-semibold text-base-content">
            {{ summary.meanPinball !== null ? `${currencyLabel}${formatAmount(summary.meanPinball)}` : '—' }}
          </p>
          <p class="text-xs text-base-content/60 mt-0.5">lower is better</p>
        </div>

        <div class="bg-base-100 rounded-field border border-base-300 p-3">
          <p class="text-xs text-base-content/60 uppercase tracking-wide mb-1">Interval width</p>
          <p class="text-lg font-semibold text-base-content">
            {{ summary.pinaw !== null ? summary.pinaw.toFixed(2) : '—' }}
          </p>
          <p class="text-xs text-base-content/60 mt-0.5">PINAW (width ÷ range)</p>
        </div>
      </div>

      <!-- Per-horizon accuracy + coverage -->
      <div v-if="summary.perHorizon.length > 0">
        <p class="text-xs text-base-content/60 uppercase tracking-wide mb-2">Accuracy by horizon</p>
        <div class="overflow-x-auto">
          <table class="table table-xs">
            <thead>
              <tr>
                <th>Days ahead</th>
                <th>Avg error</th>
                <th>Coverage</th>
                <th>Samples</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in summary.perHorizon" :key="h.horizon">
                <td>{{ h.horizon }}</td>
                <td>{{ h.mae !== null ? `${currencyLabel}${formatAmount(h.mae)}` : '—' }}</td>
                <td>{{ h.coverage !== null ? pct(h.coverage) : '—' }}</td>
                <td>{{ h.n }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- PIT histogram (calibration shape) -->
      <div>
        <p class="text-xs text-base-content/60 uppercase tracking-wide mb-2">
          Calibration (PIT) — flat is good
        </p>
        <div class="flex items-end gap-1 h-16" aria-hidden="true">
          <div
            v-for="(count, i) in summary.pitHistogram"
            :key="i"
            class="flex-1 bg-primary rounded-selector min-h-px"
            :style="{ height: `${(count / pitMax) * 100}%` }"
          ></div>
        </div>
        <p class="text-xs text-base-content/50 mt-1">
          U-shape = bands too narrow · arch = too wide · flat = well calibrated
        </p>
      </div>
    </div>
  </details>
</template>
