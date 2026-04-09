<script setup lang="ts">
/**
 * Requirement: Browser-specific step-by-step install guides for non-Chromium browsers
 * Approach: Modal with variants based on detected browser type. Includes iOS non-Safari
 *   redirect (Chrome/Firefox/Edge on iOS can't install PWAs — must open in Safari),
 *   per-browser warning notes, and "why install" benefits section for non-technical users.
 * Alternatives:
 *   - Single generic instruction: Rejected — steps differ significantly across browsers
 *   - External link to docs: Rejected — user stays in-app, instructions are contextual
 *   - Separate getInstallInstructions() function: Considered — co-locating data with the
 *     modal is simpler while we only have one consumer
 * Reference: glow-props docs/implementations/PWA_SYSTEM.md
 */

import { ref, computed } from 'vue'
import type { Component } from 'vue'
import { usePWAInstall } from '@/composables/usePWAInstall'
import { useDialogA11y } from '@/composables/useDialogA11y'
import { Share, PlusSquare, Check, Menu, MoreVertical, Download, AlertTriangle } from 'lucide-vue-next'

const emit = defineEmits<{
  close: []
}>()

const { browser } = usePWAInstall()
const dialogRef = ref<HTMLElement | null>(null)
useDialogA11y(dialogRef, () => emit('close'))

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

interface InstructionStep {
  step: number
  text: string
  icon?: Component
}

interface InstructionSet {
  title: string
  steps: InstructionStep[]
  note?: string
}

const instructions = computed<InstructionSet>(() => {
  // iOS non-Safari: Chrome/Firefox/Edge on iOS use WebKit but can't install PWAs.
  // Redirect to Safari with explanation.
  // Reference: glow-props docs/implementations/PWA_SYSTEM.md (Key Lesson #9)
  if (isIOS && !['safari-ios'].includes(browser.value)) {
    return {
      title: 'Install on iPhone / iPad',
      steps: [
        { step: 1, text: 'Open this page in Safari (the blue compass icon)' },
        { step: 2, text: 'Tap the Share button at the bottom of the screen', icon: Share },
        { step: 3, text: 'Scroll down and tap "Add to Home Screen"', icon: PlusSquare },
        { step: 4, text: 'Tap "Add" in the top right corner', icon: Check },
      ],
      note: 'On iPhone and iPad, only Safari can install web apps. Your current browser uses Safari\'s engine but can\'t add apps to the home screen.',
    }
  }

  switch (browser.value) {
    case 'safari-ios':
      return {
        title: 'Install on iPhone / iPad',
        steps: [
          { step: 1, text: 'Tap the Share button at the bottom of the screen', icon: Share },
          { step: 2, text: 'Scroll down and tap "Add to Home Screen"', icon: PlusSquare },
          { step: 3, text: 'Tap "Add" in the top right corner', icon: Check },
          { step: 4, text: 'Farlume will appear on your home screen' },
        ],
      }

    case 'safari-macos':
      return {
        title: 'Install on Mac',
        steps: [
          { step: 1, text: 'Click "File" in the menu bar at the top', icon: Menu },
          { step: 2, text: 'Click "Add to Dock"', icon: PlusSquare },
          { step: 3, text: 'Farlume will appear in your Dock' },
        ],
      }

    case 'firefox-android':
      return {
        title: 'Install on Android',
        steps: [
          { step: 1, text: 'Tap the three-dot menu at the top right', icon: MoreVertical },
          { step: 2, text: 'Tap "Install"', icon: Download },
          { step: 3, text: 'Confirm by tapping "Install" again' },
          { step: 4, text: 'Farlume will appear on your home screen' },
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
        note: 'Firefox removed desktop PWA support in 2021. Mobile Firefox still supports it.',
      }

    // Chromium fallback — shown when the native prompt was suppressed (Chrome hides it
    // for 90 days after dismissal) or didn't fire for other reasons.
    case 'chrome':
    case 'edge':
    case 'brave':
    case 'opera':
    case 'samsung':
    case 'vivaldi':
    case 'arc':
      return {
        title: 'Install Farlume',
        steps: [
          { step: 1, text: 'Look for the install icon in the address bar (a small screen with a down arrow)', icon: Download },
          { step: 2, text: 'Or open the browser menu and look for "Install app"', icon: MoreVertical },
          { step: 3, text: 'Click "Install" to confirm' },
        ],
        note: browser.value === 'brave'
          ? 'If the install option doesn\'t appear, check that Brave Shields isn\'t blocking it.'
          : undefined,
      }

    default:
      return {
        title: 'Install Farlume',
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
    <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
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

        <!-- Warning note — browser-specific caveats (Brave Shields, Firefox desktop, iOS non-Safari) -->
        <div v-if="instructions.note" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mt-4">
          <div class="flex items-start gap-2">
            <AlertTriangle :size="14" class="text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
            <p class="text-xs text-amber-700 dark:text-amber-300">{{ instructions.note }}</p>
          </div>
        </div>

        <!-- Benefits — helps non-technical users understand WHY to install.
             Reference: glow-props docs/implementations/PWA_SYSTEM.md -->
        <div class="border-t border-gray-100 dark:border-zinc-800 pt-3 mt-4">
          <p class="text-xs text-gray-500 dark:text-zinc-400 mb-1.5">Why install?</p>
          <ul class="text-xs text-gray-400 dark:text-zinc-500 space-y-1">
            <li class="flex items-center gap-2">
              <Check :size="12" class="text-brand-500 shrink-0" aria-hidden="true" />
              Works offline — no internet needed
            </li>
            <li class="flex items-center gap-2">
              <Check :size="12" class="text-brand-500 shrink-0" aria-hidden="true" />
              Opens from your home screen or dock
            </li>
            <li class="flex items-center gap-2">
              <Check :size="12" class="text-brand-500 shrink-0" aria-hidden="true" />
              Full-screen experience without browser controls
            </li>
          </ul>
        </div>

        <button
          class="btn-secondary w-full mt-4"
          @click="emit('close')"
        >
          Got it
        </button>
      </div>
    </div>
  </Teleport>
</template>
