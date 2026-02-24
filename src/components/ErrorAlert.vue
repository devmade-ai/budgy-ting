<script setup lang="ts">
/**
 * Requirement: Reusable dismissible error banner across all views
 * Approach: Extracted from 8+ duplicated instances into shared component
 * Alternatives:
 *   - Toast/notification system: Deferred — inline banners are simpler for MVP
 */

defineProps<{
  message: string
  variant?: 'error' | 'success' | 'warning'
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const variantClasses: Record<string, { wrapper: string; button: string }> = {
  error: { wrapper: 'bg-red-50 text-red-600', button: 'text-red-400 hover:text-red-600' },
  success: { wrapper: 'bg-green-50 text-green-700', button: 'text-green-500 hover:text-green-700' },
  warning: { wrapper: 'bg-amber-50 text-amber-700', button: 'text-amber-500 hover:text-amber-700' },
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
      <span class="i-lucide-x" />
    </button>
  </div>
</template>
