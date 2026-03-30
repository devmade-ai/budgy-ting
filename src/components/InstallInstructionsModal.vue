<script setup lang="ts">
/**
 * Requirement: Browser-specific step-by-step install guides for non-Chromium browsers
 * Approach: Modal with four variants based on detected browser type.
 *   Plain language aimed at non-technical users (per CLAUDE.md UX standards).
 * Alternatives:
 *   - Single generic instruction: Rejected — steps differ significantly across browsers
 *   - External link to docs: Rejected — user stays in-app, instructions are contextual
 */

import { ref, computed } from 'vue'
import type { Component } from 'vue'
import { usePWAInstall } from '@/composables/usePWAInstall'
import { useDialogA11y } from '@/composables/useDialogA11y'
import { Share, PlusSquare, Check, Menu, MoreVertical, Download } from 'lucide-vue-next'

const emit = defineEmits<{
  close: []
}>()

const { browser } = usePWAInstall()
const dialogRef = ref<HTMLElement | null>(null)
useDialogA11y(dialogRef, () => emit('close'))

interface InstructionStep {
  step: number
  text: string
  icon?: Component
}

const instructions = computed<{ title: string; steps: InstructionStep[] }>(() => {
  switch (browser.value) {
    case 'safari-ios':
      return {
        title: 'Install on iPhone / iPad',
        steps: [
          { step: 1, text: 'Tap the Share button at the bottom of the screen', icon: Share },
          { step: 2, text: 'Scroll down and tap "Add to Home Screen"', icon: PlusSquare },
          { step: 3, text: 'Tap "Add" in the top right corner', icon: Check },
          { step: 4, text: 'budgy-ting will appear on your home screen' },
        ],
      }

    case 'safari-macos':
      return {
        title: 'Install on Mac',
        steps: [
          { step: 1, text: 'Click "File" in the menu bar at the top', icon: Menu },
          { step: 2, text: 'Click "Add to Dock"', icon: PlusSquare },
          { step: 3, text: 'budgy-ting will appear in your Dock' },
        ],
      }

    case 'firefox-android':
      return {
        title: 'Install on Android',
        steps: [
          { step: 1, text: 'Tap the three-dot menu at the top right', icon: MoreVertical },
          { step: 2, text: 'Tap "Install"', icon: Download },
          { step: 3, text: 'Confirm by tapping "Install" again' },
          { step: 4, text: 'budgy-ting will appear on your home screen' },
        ],
      }

    case 'firefox-desktop':
      return {
        title: 'Install on Desktop',
        steps: [
          { step: 1, text: 'Firefox on desktop doesn\'t support installing web apps.' },
          { step: 2, text: 'For the best experience, open this page in Chrome or Edge.' },
          { step: 3, text: 'Then you\'ll see an "Install" button to add the app.' },
        ],
      }

    default:
      return {
        title: 'Install budgy-ting',
        steps: [
          { step: 1, text: 'Look for an install option in your browser\'s menu.' },
          { step: 2, text: 'If you don\'t see one, try opening this page in Chrome or Safari.' },
        ],
      }
  }
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40" aria-hidden="true" @click="emit('close')" />

      <!-- Dialog -->
      <div
        ref="dialogRef"
        role="dialog"
        :aria-label="instructions.title"
        aria-modal="true"
        class="relative bg-white dark:bg-[var(--color-surface-elevated)] rounded-xl shadow-xl dark:shadow-none max-w-sm w-full p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-4">
          {{ instructions.title }}
        </h3>

        <ol class="space-y-3">
          <li
            v-for="step in instructions.steps"
            :key="step.step"
            class="flex items-start gap-3"
          >
            <span
              class="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
            >
              {{ step.step }}
            </span>
            <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
              <component v-if="step.icon" :is="step.icon" :size="16" class="text-gray-400 dark:text-zinc-500 shrink-0" aria-hidden="true" />
              <span>{{ step.text }}</span>
            </div>
          </li>
        </ol>

        <button
          class="btn-secondary w-full mt-6"
          @click="emit('close')"
        >
          Got it
        </button>
      </div>
    </div>
  </Teleport>
</template>
