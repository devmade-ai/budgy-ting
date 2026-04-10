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
  <div class="bg-base-100 rounded-lg border border-base-300 p-4">
    <!-- Mobile UX: text-sm for readable labels on small screens (was text-xs) -->
    <p class="text-sm text-base-content/60 uppercase tracking-wide mb-1">{{ label }}</p>
    <p
      class="text-lg font-semibold"
      :class="{
        'text-success': trend === 'positive',
        'text-error': trend === 'negative',
        'text-base-content': !trend || trend === 'neutral',
      }"
    >
      {{ value }}
    </p>
    <p v-if="sublabel" class="text-xs text-base-content/40 mt-0.5">{{ sublabel }}</p>
  </div>
</template>
