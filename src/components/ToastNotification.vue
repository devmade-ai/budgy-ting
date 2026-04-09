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
import { CheckCircle, AlertCircle, AlertTriangle, X } from 'lucide-vue-next'
import type { Component } from 'vue'

const { state, dismiss } = useToast()

const variantClasses: Record<string, string> = {
  success: 'bg-success text-success-content',
  error: 'bg-error text-error-content',
  warning: 'bg-warning text-warning-content',
}

const variantIcons: Record<string, Component> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
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
        class="fixed left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium max-w-sm"
        style="bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px))"
        :class="variantClasses[state.variant]"
        role="status"
        aria-live="polite"
      >
        <component :is="variantIcons[state.variant]" :size="16" aria-hidden="true" />
        <span>{{ state.message }}</span>
        <!-- Mobile UX: 32x32px touch target for dismiss (was 14px icon) -->
        <button
          class="ml-2 w-8 h-8 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity rounded-full"
          aria-label="Dismiss"
          @click="dismiss"
        >
          <X :size="18" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
