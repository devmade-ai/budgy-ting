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
  <div class="bg-white dark:bg-[var(--color-surface-elevated)] rounded-lg border border-gray-200 dark:border-zinc-700 p-4">
    <!-- Mobile UX: text-sm for readable labels on small screens (was text-xs) -->
    <p class="text-sm text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-1">{{ label }}</p>
    <p
      class="text-lg font-semibold"
      :class="{
        'text-green-600 dark:text-green-400': trend === 'positive',
        'text-red-600 dark:text-red-400': trend === 'negative',
        'text-gray-900 dark:text-zinc-100': !trend || trend === 'neutral',
      }"
    >
      {{ value }}
    </p>
    <p v-if="sublabel" class="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{{ sublabel }}</p>
  </div>
</template>
