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
      ? 'bg-info/10 text-info'
      : 'bg-base-200 text-base-content/50'"
  >
    {{ classification === 'recurring' ? 'Recurring' : 'Once-off' }}
  </span>
</template>
