<script setup lang="ts">
/**
 * Requirement: Reusable dismissible error banner across all views
 * Approach: Extracted from 8+ duplicated instances into shared component
 * Alternatives:
 *   - Toast/notification system: Deferred — inline banners are simpler for MVP
 */

import { X } from 'lucide-vue-next'

defineProps<{
  message: string
  variant?: 'error' | 'success' | 'warning'
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const variantClasses: Record<string, { wrapper: string; button: string }> = {
  error: { wrapper: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400', button: 'text-red-400 hover:text-red-600 dark:hover:text-red-300' },
  success: { wrapper: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400', button: 'text-green-500 hover:text-green-700 dark:hover:text-green-300' },
  warning: { wrapper: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400', button: 'text-amber-500 hover:text-amber-700 dark:hover:text-amber-300' },
}
</script>

<template>
  <div
    class="mb-4 p-3 text-sm rounded-lg flex items-center justify-between"
    :class="variantClasses[variant ?? 'error']?.wrapper"
    role="alert"
  >
    <span>{{ message }}</span>
    <button
      :class="variantClasses[variant ?? 'error']?.button"
      aria-label="Dismiss message"
      @click="emit('dismiss')"
    >
      <X :size="16" />
    </button>
  </div>
</template>
