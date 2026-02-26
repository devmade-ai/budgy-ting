<script setup lang="ts">
/**
 * Requirement: Visual feedback after user actions (save, delete, import, export)
 * Approach: Fixed-position toast at bottom-center, auto-dismisses after 3s.
 *   Uses useToast singleton for state. Mounted once in AppLayout.
 * Alternatives:
 *   - Top-of-page banner: Rejected — can be missed if user scrolled down
 *   - Modal confirmation: Rejected — too disruptive for routine actions
 */

import { useToast } from '@/composables/useToast'

const { state, dismiss } = useToast()

const variantClasses: Record<string, string> = {
  success: 'bg-brand-600 text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-amber-500 text-white',
}

const variantIcons: Record<string, string> = {
  success: 'i-lucide-check-circle',
  error: 'i-lucide-alert-circle',
  warning: 'i-lucide-alert-triangle',
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div
        v-if="state.visible"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium max-w-sm"
        :class="variantClasses[state.variant]"
        role="status"
        aria-live="polite"
      >
        <span :class="variantIcons[state.variant]" aria-hidden="true" />
        <span>{{ state.message }}</span>
        <button
          class="ml-2 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
          @click="dismiss"
        >
          <span class="i-lucide-x text-sm" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
