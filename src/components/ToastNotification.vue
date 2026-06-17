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

// Farlume toast tone classes. Warning maps to the accent tone (the design
// system has no dedicated warning toast; amber accent reads as "caution").
const variantClasses: Record<string, string> = {
  success: 'fl-toast--success',
  error: 'fl-toast--error',
  warning: 'fl-toast--accent',
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
        class="fl-toast fixed left-1/2 -translate-x-1/2 z-[70] max-w-sm"
        style="bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px))"
        :class="variantClasses[state.variant]"
        role="status"
        aria-live="polite"
      >
        <span class="fl-toast__icon">
          <component :is="variantIcons[state.variant]" :size="20" aria-hidden="true" />
        </span>
        <div class="fl-toast__body">
          <p class="fl-toast__msg">{{ state.message }}</p>
        </div>
        <!-- Mobile UX: 32x32px touch target for dismiss (was 14px icon) -->
        <button
          class="fl-toast__x w-8 h-8"
          aria-label="Dismiss"
          @click="dismiss"
        >
          <X :size="18" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
