<script setup lang="ts">
/**
 * Requirement: Consistent empty state display across all views
 * Approach: Extracted from 5+ duplicated instances with icon + title + description + optional action
 */

defineProps<{
  icon: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="text-center py-12">
    <div :class="icon" class="text-4xl text-gray-300 mx-auto mb-3" />
    <p class="text-gray-500">{{ title }}</p>
    <p v-if="description" class="text-gray-400 text-sm mt-1 mb-4">
      {{ description }}
    </p>
    <slot />
  </div>
</template>
