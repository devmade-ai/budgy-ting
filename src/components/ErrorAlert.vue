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

const variantClasses: Record<string, string> = {
  error: 'fl-alert--error',
  success: 'fl-alert--success',
  warning: 'fl-alert--warning',
}
</script>

<template>
  <div
    class="fl-alert mb-4 pr-1 items-center justify-between gap-2"
    :class="variantClasses[variant ?? 'error']"
    role="alert"
  >
    <span class="py-1">{{ message }}</span>
    <!-- Mobile UX: 40×40 touch target (was a bare 16px icon with no padding).
         Flex centering keeps the icon visually identical to the old version. -->
    <button
      class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 opacity-60 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
      aria-label="Dismiss message"
      @click="emit('dismiss')"
    >
      <X :size="16" aria-hidden="true" />
    </button>
  </div>
</template>
