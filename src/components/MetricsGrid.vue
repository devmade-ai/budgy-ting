<script setup lang="ts">
/**
 * Requirement: Responsive grid of metric cards showing key financial stats
 * Approach: Compute metrics from transactions + forecast + runway data
 * Alternatives:
 *   - Inline in workspace view: Rejected — extraction keeps the view manageable
 */

import { computed } from 'vue'
import MetricCard from './MetricCard.vue'
import { formatAmount } from '@/composables/useFormat'
import type { Transaction, RecurringPattern } from '@/types/models'
import type { ForecastResult } from '@/engine/forecast'
import type { RunwayResult } from '@/engine/runway'
import type { AccuracySummary } from '@/engine/accuracy'

const props = defineProps<{
  transactions: Transaction[]
  patterns: RecurringPattern[]
  currencyLabel: string
  forecast: ForecastResult | null
  runway: RunwayResult | null
  accuracy: AccuracySummary | null
}>()

const metrics = computed(() => {
  const txns = props.transactions
  const cards: Array<{ label: string; value: string; sublabel?: string; trend?: 'positive' | 'negative' | 'neutral' }> = []

  if (txns.length === 0) return cards

  // Date range
  const dates = txns.map((t) => t.date).sort()
  const firstDate = dates[0]!
  const lastDate = dates[dates.length - 1]!
  const daySpan = Math.max(1, Math.ceil((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / 86400000) + 1)

  // Totals
  const totalIncome = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalExpenses = txns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const netCashflow = totalIncome - totalExpenses

  // Daily averages
  const dailyIncome = totalIncome / daySpan
  const dailyExpenses = totalExpenses / daySpan
  const dailyNet = netCashflow / daySpan

  cards.push({
    label: 'Daily income',
    value: `${props.currencyLabel}${formatAmount(dailyIncome)}`,
    trend: 'positive',
  })

  cards.push({
    label: 'Daily spend',
    value: `${props.currencyLabel}${formatAmount(dailyExpenses)}`,
    trend: 'negative',
  })

  cards.push({
    label: 'Daily net',
    value: `${dailyNet >= 0 ? '+' : '-'}${props.currencyLabel}${formatAmount(Math.abs(dailyNet))}`,
    trend: dailyNet >= 0 ? 'positive' : 'negative',
  })

  // Monthly burn rate (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysStr = thirtyDaysAgo.toISOString().slice(0, 10)
  const recentExpenses = txns
    .filter((t) => t.amount < 0 && t.date >= thirtyDaysStr)
    .reduce((s, t) => s + Math.abs(t.amount), 0)
  cards.push({
    label: 'Monthly spend',
    value: `${props.currencyLabel}${formatAmount(recentExpenses)}`,
  })

  // Transaction count
  cards.push({
    label: 'Transactions',
    value: String(txns.length),
  })

  // Recurring patterns
  const activePatterns = props.patterns.filter((p) => p.isActive)
  if (activePatterns.length > 0) {
    cards.push({
      label: 'Recurring items',
      value: String(activePatterns.length),
    })
  }

  // Forecast accuracy (when available)
  if (props.accuracy && props.accuracy.mae !== null) {
    cards.push({
      label: 'Forecast accuracy',
      value: `±${props.currencyLabel}${formatAmount(props.accuracy.mae)}`,
      sublabel: 'avg daily error',
    })
  }

  if (props.accuracy && props.accuracy.wmape !== null) {
    const pct = Math.round((1 - props.accuracy.wmape / 100) * 100)
    cards.push({
      label: 'Accuracy %',
      value: `${pct}%`,
      trend: pct >= 80 ? 'positive' : pct >= 60 ? 'neutral' : 'negative',
    })
  }

  // Cash runway (when available)
  if (props.runway) {
    if (props.runway.daysRemaining !== null) {
      cards.push({
        label: 'Cash lasts until',
        value: props.runway.depletionDate ?? '—',
        sublabel: `${props.runway.daysRemaining} days`,
        trend: 'negative',
      })
    } else if (props.runway.dailyBalance.length > 0) {
      cards.push({
        label: 'Projected balance',
        value: `${props.currencyLabel}${formatAmount(props.runway.endBalance)}`,
        trend: props.runway.endBalance >= 0 ? 'positive' : 'negative',
      })
    }

    if (props.runway.minimumBalanceDate) {
      cards.push({
        label: 'Tightest point',
        value: `${props.currencyLabel}${formatAmount(props.runway.minimumBalance)}`,
        sublabel: props.runway.minimumBalanceDate,
        trend: props.runway.minimumBalance >= 0 ? 'neutral' : 'negative',
      })
    }
  }

  return cards
})
</script>

<template>
  <div v-if="metrics.length > 0" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
    <MetricCard
      v-for="(m, i) in metrics"
      :key="m.label"
      :label="m.label"
      :value="m.value"
      :sublabel="m.sublabel"
      :trend="m.trend"
    />
  </div>
</template>
