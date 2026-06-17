<script setup lang="ts">
/**
 * Forecast diagnostics — advanced, out-of-sample calibration metrics from the rolling-origin
 * backtest (src/engine/validation.ts). Collapsed by default and clearly labelled "advanced"
 * because these are technical (coverage, Wilson CI, pinball, PIT) — the main MetricsGrid stays
 * non-technical per the UX rule. This panel is for verifying the forecast is honestly calibrated.
 *
 * Requirement (FORECASTING_RESEARCH.md §16.5): surface the harness's interval-calibration metrics.
 * Approach: native <details>/<summary> collapse (zero JS, accessible), styled with the Farlume
 *   design system — fl-table + fl-num + semantic tokens. PIT histogram drawn as plain bars
 *   (flat = calibrated, U = bands too narrow, ∩ = too wide); bar heights are data dimensions,
 *   not tokens.
 */
import { computed } from 'vue'
import type { BacktestSummary } from '@/engine/validation'
import type { AciResult } from '@/engine/conformal'
import { formatAmount } from '@/composables/useFormat'

const props = defineProps<{
  summary: BacktestSummary | null
  /** Adaptive-conformal calibration of the live forecast's bands */
  conformal?: AciResult | null
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
  <details v-if="summary && summary.records > 0" class="mt-4 border-t border-line-2 pt-3">
    <summary class="text-xs text-ink-muted cursor-pointer hover:text-ink select-none">
      Forecast diagnostics (advanced)
    </summary>

    <div class="mt-3 bg-sunken rounded-lg p-4 space-y-4">
      <p class="text-xs text-ink-muted">
        Out-of-sample, from a walk-forward backtest over <span class="fl-num">{{ summary.records }}</span> predictions.
        These check whether the forecast and its confidence bands are honestly calibrated.
      </p>

      <!-- Adaptive band calibration (ACI) on the live forecast -->
      <p v-if="conformal" class="text-xs text-ink-muted">
        <span class="font-medium text-ink-soft">Adaptive bands (ACI):</span>
        <template v-if="conformal.adapted">
          tuned to ≈<span class="fl-num">{{ Math.round((1 - conformal.alpha) * 100) }}%</span> coverage over
          <span class="fl-num">{{ conformal.steps }}</span> past steps
          <template v-if="conformal.alpha < 0.19"> (widened — bands were running narrow)</template>
          <template v-else-if="conformal.alpha > 0.21"> (tightened — bands were running wide)</template>
          <template v-else> (already well-calibrated)</template>.
        </template>
        <template v-else>not enough history yet; using the fixed 80% band.</template>
      </p>

      <!-- Headline calibration figures -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div class="bg-card rounded-md border border-line-2 p-3">
          <p class="fl-eyebrow mb-1">Band coverage</p>
          <p
            class="fl-num text-lg font-semibold"
            :class="coverageOk === true ? 'text-pos' : coverageOk === false ? 'text-accent-active' : 'text-ink'"
          >
            {{ summary.coverage ? pct(summary.coverage.picp) : '—' }}
          </p>
          <p v-if="summary.coverage" class="text-xs text-ink-muted mt-0.5">
            target <span class="fl-num">{{ pct(summary.coverage.nominal) }}</span> · 95% CI
            <span class="fl-num">{{ pct(summary.coverage.wilsonLo) }}–{{ pct(summary.coverage.wilsonHi) }}</span>
          </p>
        </div>

        <div class="bg-card rounded-md border border-line-2 p-3">
          <p class="fl-eyebrow mb-1">Pinball loss</p>
          <p class="fl-num text-lg font-semibold text-ink">
            {{ summary.meanPinball !== null ? `${currencyLabel}${formatAmount(summary.meanPinball)}` : '—' }}
          </p>
          <p class="text-xs text-ink-muted mt-0.5">lower is better</p>
        </div>

        <div class="bg-card rounded-md border border-line-2 p-3">
          <p class="fl-eyebrow mb-1">Interval width</p>
          <p class="fl-num text-lg font-semibold text-ink">
            {{ summary.pinaw !== null ? summary.pinaw.toFixed(2) : '—' }}
          </p>
          <p class="text-xs text-ink-muted mt-0.5">PINAW (width ÷ range)</p>
        </div>
      </div>

      <!-- Per-horizon accuracy + coverage -->
      <div v-if="summary.perHorizon.length > 0">
        <p class="fl-eyebrow mb-2">Accuracy by horizon</p>
        <div class="fl-table-wrap">
          <table class="fl-table">
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
                <td class="fl-num">{{ h.horizon }}</td>
                <td class="fl-num">{{ h.mae !== null ? `${currencyLabel}${formatAmount(h.mae)}` : '—' }}</td>
                <td class="fl-num">{{ h.coverage !== null ? pct(h.coverage) : '—' }}</td>
                <td class="fl-num">{{ h.n }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- PIT histogram (calibration shape) -->
      <div>
        <p class="fl-eyebrow mb-2">
          Calibration (PIT) — flat is good
        </p>
        <div class="flex items-end gap-1 h-16" aria-hidden="true">
          <div
            v-for="(count, i) in summary.pitHistogram"
            :key="i"
            class="flex-1 bg-accent rounded-md min-h-px"
            :style="{ height: `${(count / pitMax) * 100}%` }"
          ></div>
        </div>
        <p class="text-xs text-ink-faint mt-1">
          U-shape = bands too narrow · arch = too wide · flat = well calibrated
        </p>
      </div>
    </div>
  </details>
</template>
