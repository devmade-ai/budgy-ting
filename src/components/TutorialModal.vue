<script setup lang="ts">
/**
 * Requirement: Multi-step tutorial modal for first-time users
 * Approach: Stepped carousel with navigation dots, following existing Teleport modal pattern
 *   (matches ConfirmDialog.vue and InstallInstructionsModal.vue).
 *   Plain language aimed at non-technical users (per CLAUDE.md UX standards).
 * Alternatives:
 *   - Single long modal: Rejected — overwhelming for new users, steps are digestible
 *   - Inline page walkthrough: Rejected — modal is consistent with existing patterns
 *   - Tooltip-based tour: Rejected — adds complexity, nothing to point at on empty state
 */

import { ref, computed } from 'vue'
import { useDialogA11y } from '@/composables/useDialogA11y'

const emit = defineEmits<{
  close: []
}>()

interface TutorialStep {
  icon: string
  title: string
  description: string
}

const steps: TutorialStep[] = [
  {
    icon: 'i-lucide-hand-heart',
    title: 'Welcome to budgy-ting',
    description: 'A simple tool to track your spending and forecast your cashflow. Everything stays on your device — no accounts, no cloud.',
  },
  {
    icon: 'i-lucide-wallet',
    title: 'Create a workspace',
    description: 'Start by creating a workspace. Give it a name, pick a time period (monthly or custom dates), and choose your currency.',
  },
  {
    icon: 'i-lucide-upload',
    title: 'Import your transactions',
    description: 'Upload your bank statement (CSV or JSON file). The app groups similar transactions and lets you classify them as recurring or once-off.',
  },
  {
    icon: 'i-lucide-repeat',
    title: 'Detect recurring patterns',
    description: 'The app automatically spots patterns like rent, subscriptions, and salary. These become the basis for your spending forecast.',
  },
  {
    icon: 'i-lucide-trending-up',
    title: 'See your forecast',
    description: 'Your dashboard shows a cashflow graph, key metrics, and a forecast based on your recurring patterns and transaction history.',
  },
  {
    icon: 'i-lucide-piggy-bank',
    title: 'Track your runway',
    description: 'Enter your cash on hand to see how long your money will last. The forecast updates automatically as you import more data.',
  },
]

const currentStep = ref(0)
const dialogRef = ref<HTMLElement | null>(null)

useDialogA11y(dialogRef, () => emit('close'))

// Computed to safely access the active step, avoiding TS2532 "possibly undefined" on array index
const activeStep = computed(() => steps[currentStep.value] as TutorialStep)

const isFirst = computed(() => currentStep.value === 0)
const isLast = computed(() => currentStep.value === steps.length - 1)

function next() {
  if (!isLast.value) {
    currentStep.value++
  }
}

function prev() {
  if (!isFirst.value) {
    currentStep.value--
  }
}

function goToStep(index: number) {
  if (index >= 0 && index < steps.length) {
    currentStep.value = index
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/40"
        aria-hidden="true"
        @click="emit('close')"
      />

      <!-- Dialog -->
      <div
        ref="dialogRef"
        role="dialog"
        aria-label="How it works"
        aria-modal="true"
        class="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
      >
        <!-- Skip/close button -->
        <button
          class="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close tutorial"
          @click="emit('close')"
        >
          <span class="i-lucide-x text-lg" />
        </button>

        <!-- Step content -->
        <div class="text-center pt-2 pb-4">
          <div
            :class="activeStep.icon"
            class="text-4xl text-brand-500 mx-auto mb-4"
            aria-hidden="true"
          />
          <h3 class="text-lg font-semibold text-gray-900 mb-2">
            {{ activeStep.title }}
          </h3>
          <p class="text-sm text-gray-600 leading-relaxed">
            {{ activeStep.description }}
          </p>
        </div>

        <!-- Step dots -->
        <div class="flex justify-center gap-1.5 mb-5" role="tablist" aria-label="Tutorial steps">
          <button
            v-for="(s, index) in steps"
            :key="index"
            role="tab"
            :aria-selected="index === currentStep"
            :aria-label="`Step ${index + 1}: ${s.title}`"
            class="w-2 h-2 rounded-full transition-colors"
            :class="index === currentStep ? 'bg-brand-500' : 'bg-gray-200 hover:bg-gray-300'"
            @click="goToStep(index)"
          />
        </div>

        <!-- Navigation buttons -->
        <div class="flex gap-3">
          <button
            v-if="!isFirst"
            class="btn-secondary flex-1"
            @click="prev"
          >
            Back
          </button>
          <button
            v-if="!isLast"
            class="btn-primary flex-1"
            @click="next"
          >
            Next
          </button>
          <button
            v-if="isLast"
            class="btn-primary flex-1"
            @click="emit('close')"
          >
            Get started
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
