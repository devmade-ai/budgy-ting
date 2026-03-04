<script setup lang="ts">
/**
 * Requirement: Consistent, engaging empty state display across all views
 * Approach: Larger icon in a soft circular background + clear title + description + action slot.
 *   More visually engaging than a tiny gray icon, without needing custom illustrations.
 * Alternatives:
 *   - Custom SVG illustrations: Deferred — nice-to-have but requires design work
 *   - Tiny gray icon: Rejected — too stark, doesn't invite action
 */

defineProps<{
  icon: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="text-center py-12">
    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <div :class="icon" class="text-3xl text-gray-400" />
    </div>
    <p class="text-gray-600 font-medium text-lg">{{ title }}</p>
    <p v-if="description" class="text-gray-400 text-sm mt-1.5 mb-5 max-w-xs mx-auto">
      {{ description }}
    </p>
    <slot />
  </div>
</template>
