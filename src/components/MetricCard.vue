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
  <div class="bg-white rounded-lg border border-gray-200 p-4">
    <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">{{ label }}</p>
    <p
      class="text-lg font-semibold"
      :class="{
        'text-green-600': trend === 'positive',
        'text-red-600': trend === 'negative',
        'text-gray-900': !trend || trend === 'neutral',
      }"
    >
      {{ value }}
    </p>
    <p v-if="sublabel" class="text-xs text-gray-400 mt-0.5">{{ sublabel }}</p>
  </div>
</template>
