<script setup lang="ts">
/**
 * Requirement: Deduplicate recurring/once-off badge markup across TransactionTable (2 instances)
 * Approach: Minimal component that maps classification to styled span
 * Alternatives:
 *   - Utility function returning class string: Rejected — still duplicates the template markup
 *   - CSS-only approach: Rejected — need conditional text + conditional classes together
 */

defineProps<{
  classification: 'recurring' | 'once-off'
}>()
</script>

<template>
  <span
    class="text-xs sm:text-sm px-1.5 py-0.5 rounded"
    :class="classification === 'recurring'
      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
      : 'bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'"
  >
    {{ classification === 'recurring' ? 'Recurring' : 'Once-off' }}
  </span>
</template>
