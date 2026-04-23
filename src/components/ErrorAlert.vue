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
  error: { wrapper: 'bg-error/10 text-error', button: 'text-error/60 hover:text-error' },
  success: { wrapper: 'bg-success/10 text-success', button: 'text-success/60 hover:text-success' },
  warning: { wrapper: 'bg-warning/10 text-warning', button: 'text-warning/60 hover:text-warning' },
}
</script>

<template>
  <div
    class="mb-4 pl-3 pr-1 py-1 text-sm rounded-lg flex items-center justify-between gap-2"
    :class="variantClasses[variant ?? 'error']?.wrapper"
    role="alert"
  >
    <span class="py-2">{{ message }}</span>
    <!-- Mobile UX: 40×40 touch target (was a bare 16px icon with no padding).
         Flex centering keeps the icon visually identical to the old version. -->
    <button
      class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
      :class="variantClasses[variant ?? 'error']?.button"
      aria-label="Dismiss message"
      @click="emit('dismiss')"
    >
      <X :size="16" aria-hidden="true" />
    </button>
  </div>
</template>
