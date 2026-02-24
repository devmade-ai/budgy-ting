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
  <div class="text-center py-12 text-gray-400" role="status" aria-live="polite">
    {{ message ?? 'Loading...' }}
  </div>
</template>
