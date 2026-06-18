<script setup lang="ts">
/**
 * Requirement: Consistent loading state display across all views
 * Approach: Extracted from 9+ duplicated instances
 */

defineProps<{
  message?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 py-12 text-ink-muted" role="status" aria-live="polite">
    <span class="fl-spinner fl-spinner--lg" aria-hidden="true" />
    <span class="text-sm">{{ message ?? 'Loading…' }}</span>
  </div>
</template>
