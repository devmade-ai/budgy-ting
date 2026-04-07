<script setup lang="ts">
/**
 * Requirement: Reusable dismissible error banner across all views
 * Approach: Extracted from 8+ duplicated instances into shared component.
 *   Uses DaisyUI alert semantic color tokens (error, success, warning).
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
