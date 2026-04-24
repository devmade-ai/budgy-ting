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

const props = withDefaults(
  defineProps<{
    /**
     * When true, the "already installed and the icon looks outdated?"
     * collapsible opens by default — used when the modal is launched from
     * the icon-refresh banner so the relevant content is the first thing
     * the user sees.
     */
    expandReinstall?: boolean
  }>(),
  { expandReinstall: false },
)

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

interface ReinstallInstructions {
  title: string
  body: string
}

const instructions = computed<InstructionSet>(() => {
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

// Requirement: OS icon caches (iOS Springboard, Android launcher, Windows, macOS
//   dock) persist across browser site-data clears. An installed PWA that updated
//   its icon still shows the old icon until the user uninstalls and reinstalls.
// Approach: Platform-specific reinstall instructions in a collapsible. Uses
//   native <details>/<summary> (works with DaisyUI `collapse` classes in v5,
//   zero JS, accessible by default). Collapsed by default so first-time
//   installers stay focused on the main install flow.
// Reference: glow-props docs/implementations/PWA_ICON_CACHE_BUST.md
const reinstallInstructions = computed<ReinstallInstructions>(() => {
  if (isIOS) {
    return {
      title: 'Already installed and the icon looks outdated?',
      body: 'Your phone keeps app icons cached separately from Safari. Press and hold the Farlume icon on your home screen, tap "Remove App" then "Delete App", then reinstall from Safari using the Share button → "Add to Home Screen".',
    }
  }

  if (/android/i.test(navigator.userAgent)) {
    return {
      title: 'Already installed and the icon looks outdated?',
      body: 'Your phone keeps app icons cached separately from your browser. Press and hold the Farlume icon on your home screen, tap "App info" → "Uninstall", then reinstall from this browser using the install prompt or menu.',
    }
  }

  return {
    title: 'Already installed and the icon looks outdated?',
    body: 'Your computer keeps app icons cached separately from your browser. Open Farlume, click the three-dot menu in the app window, choose "Uninstall", then reinstall from the browser address bar install icon.',
  }
})
</script>

<template>
  <Teleport to="body">
    <div class="modal modal-open z-[60]">
      <!-- Backdrop -->
      <div class="modal-backdrop" aria-hidden="true" @click="emit('close')" />

      <!-- Dialog -->
      <div
        ref="dialogRef"
        role="dialog"
        :aria-label="instructions.title"
        aria-modal="true"
        class="modal-box max-w-sm max-h-[90vh] overflow-y-auto"
      >
        <h3 class="text-lg font-semibold text-base-content mb-4">
          {{ instructions.title }}
        </h3>

        <ol class="space-y-3">
          <li
            v-for="step in instructions.steps"
            :key="step.step"
            class="flex items-start gap-3"
          >
            <span
              class="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5"
            >
              {{ step.step }}
            </span>
            <div class="flex items-center gap-2 text-sm text-base-content/80">
              <component v-if="step.icon" :is="step.icon" :size="16" class="text-base-content/40 shrink-0" aria-hidden="true" />
              <span>{{ step.text }}</span>
            </div>
          </li>
        </ol>

        <!-- Warning note — browser-specific caveats -->
        <div v-if="instructions.note" class="bg-warning/10 border border-warning/20 rounded-lg p-3 mt-4">
          <div class="flex items-start gap-2">
            <AlertTriangle :size="14" class="text-warning shrink-0 mt-0.5" aria-hidden="true" />
            <p class="text-xs text-warning">{{ instructions.note }}</p>
          </div>
        </div>

        <!-- Benefits — helps non-technical users understand WHY to install -->
        <div class="divider"></div>
        <div>
          <p class="text-xs text-base-content/60 mb-1.5">Why install?</p>
          <ul class="text-xs text-base-content/60 space-y-1">
            <li class="flex items-center gap-2">
              <Check :size="12" class="text-primary shrink-0" aria-hidden="true" />
              Works offline — no internet needed
            </li>
            <li class="flex items-center gap-2">
              <Check :size="12" class="text-primary shrink-0" aria-hidden="true" />
              Opens from your home screen or dock
            </li>
            <li class="flex items-center gap-2">
              <Check :size="12" class="text-primary shrink-0" aria-hidden="true" />
              Full-screen experience without browser controls
            </li>
          </ul>
        </div>

        <!-- Reinstall hint for users whose OS-cached icon didn't refresh.
             `open` binds to props.expandReinstall so the icon-refresh banner
             can launch the modal with this section already visible. -->
        <details :open="props.expandReinstall" class="mt-4 border-t border-base-300 pt-3">
          <summary class="text-xs text-base-content/60 cursor-pointer hover:text-base-content">
            {{ reinstallInstructions.title }}
          </summary>
          <p class="text-xs text-base-content/60 mt-2 leading-relaxed">
            {{ reinstallInstructions.body }}
          </p>
        </details>

        <button
          class="btn btn-ghost w-full mt-4"
          @click="emit('close')"
        >
          Got it
        </button>
      </div>
    </div>
  </Teleport>
</template>
