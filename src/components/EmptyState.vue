<script setup lang="ts">
/**
 * Requirement: Consistent, engaging empty state display across all views
 * Approach: Larger icon in a soft circular background + clear title + description + action slot.
 *   More visually engaging than a tiny gray icon, without needing custom illustrations.
 * Alternatives:
 *   - Custom SVG illustrations: Deferred — nice-to-have but requires design work
 *   - Tiny gray icon: Rejected — too stark, doesn't invite action
 */
import type { Component } from 'vue'

defineProps<{
  icon: Component
  title: string
  description?: string
}>()
</script>

<template>
  <div class="text-center py-12">
    <div class="w-16 h-16 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
      <component :is="icon" :size="28" class="text-gray-400 dark:text-zinc-500" />
    </div>
    <p class="text-gray-600 dark:text-zinc-300 font-medium text-lg">{{ title }}</p>
    <p v-if="description" class="text-gray-400 dark:text-zinc-500 text-sm mt-1.5 mb-5 max-w-xs mx-auto">
      {{ description }}
    </p>
    <slot />
  </div>
</template>
