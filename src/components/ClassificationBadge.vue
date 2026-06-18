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
    class="fl-badge"
    :class="classification === 'recurring' ? 'fl-badge--info' : 'fl-badge--neutral'"
  >
    {{ classification === 'recurring' ? 'Recurring' : 'Once-off' }}
  </span>
</template>
