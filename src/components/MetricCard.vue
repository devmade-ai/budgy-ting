<script setup lang="ts">
/**
 * Requirement: Individual metric display card for the metrics grid
 * Approach: Simple card with label, value, optional trend indicator
 */

defineProps<{
  label: string
  value: string
  /** Optional sub-label (e.g., "per day") */
  sublabel?: string
  /** Positive = good, negative = bad, zero = neutral */
  trend?: 'positive' | 'negative' | 'neutral'
}>()
</script>

<template>
  <div class="fl-card fl-card--pad">
    <!-- Eyebrow label (uppercase, wide tracking) per the Stat specimen. -->
    <p class="fl-eyebrow mb-1.5">{{ label }}</p>
    <!-- Money/data is always mono + tabular. -->
    <p
      class="fl-num text-2xl font-semibold leading-none"
      :class="{
        'text-pos': trend === 'positive',
        'text-neg': trend === 'negative',
        'text-ink': !trend || trend === 'neutral',
      }"
    >
      {{ value }}
    </p>
    <p v-if="sublabel" class="text-xs text-ink-muted mt-1">{{ sublabel }}</p>
  </div>
</template>
