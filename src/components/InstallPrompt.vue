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
    class="bg-brand-50 dark:bg-brand-900/20 border-b border-brand-200 dark:border-brand-800 px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3"
  >
    <div class="flex items-center gap-2 min-w-0">
      <Smartphone :size="16" class="text-brand-600 shrink-0" />
      <span class="text-sm text-brand-800 dark:text-brand-200 truncate">
        Install Farlume for quick access
      </span>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <!-- Chromium: native install button -->
      <button
        v-if="isNativeInstallAvailable"
        class="text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 px-3 py-1 rounded-lg transition-colors"
        @click="handleInstall"
      >
        Install
      </button>

      <!-- Safari/Firefox: show instructions -->
      <button
        v-else-if="needsManualInstructions"
        class="text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 px-3 py-1 rounded-lg transition-colors"
        @click="handleShowInstructions"
      >
        How to Install
      </button>

      <!-- Dismiss -->
      <button
        class="text-sm text-brand-500 hover:text-brand-700 transition-colors"
        @click="dismiss"
      >
        Not now
      </button>
    </div>
  </div>
</template>
