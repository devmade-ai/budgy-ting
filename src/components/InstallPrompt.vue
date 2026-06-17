<script setup lang="ts">
/**
 * Requirement: Install prompt banner — native install on Chromium, manual
 *   instructions link on Safari/Firefox, dismissable
 * Approach: Conditional rendering based on usePWAInstall state. Hidden when
 *   already installed, dismissed, or unsupported browser.
 */

import { usePWAInstall } from '@/composables/usePWAInstall'
import { Smartphone } from 'lucide-vue-next'

const {
  isNativeInstallAvailable,
  needsManualInstructions,
  showInstallPrompt,
  triggerInstall,
  dismiss,
  trackInstructionsViewed,
} = usePWAInstall()

const emit = defineEmits<{
  'show-instructions': []
}>()

function handleInstall() {
  triggerInstall()
}

function handleShowInstructions() {
  trackInstructionsViewed()
  emit('show-instructions')
}
</script>

<template>
  <div
    v-if="showInstallPrompt"
    class="bg-accent-soft border-b border-line-2 px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3"
  >
    <div class="flex items-center gap-2 min-w-0">
      <Smartphone :size="16" class="text-accent shrink-0" />
      <span class="text-sm text-accent-active truncate">
        Install Farlume for quick access
      </span>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <!-- Chromium: native install button -->
      <button
        v-if="isNativeInstallAvailable"
        class="fl-btn fl-btn--primary fl-btn--sm"
        @click="handleInstall"
      >
        Install
      </button>

      <!-- Safari/Firefox: show instructions -->
      <button
        v-else-if="needsManualInstructions"
        class="fl-btn fl-btn--primary fl-btn--sm"
        @click="handleShowInstructions"
      >
        How to Install
      </button>

      <!-- Dismiss -->
      <button
        class="text-sm text-accent hover:text-accent-hover transition-colors"
        @click="dismiss"
      >
        Not now
      </button>
    </div>
  </div>
</template>
