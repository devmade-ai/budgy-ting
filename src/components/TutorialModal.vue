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
    description: 'A simple tool to plan your spending and see where your money actually goes. Everything stays on your device — no accounts, no cloud.',
  },
  {
    icon: 'i-lucide-wallet',
    title: 'Create a budget',
    description: 'Start by creating a budget. Give it a name, pick a time period (monthly or custom dates), and choose your currency.',
  },
  {
    icon: 'i-lucide-list-plus',
    title: 'Add your expenses',
    description: 'Add the things you plan to spend on — rent, groceries, subscriptions, whatever. Set how often each one repeats (weekly, monthly, etc.).',
  },
  {
    icon: 'i-lucide-calendar-range',
    title: 'See your projections',
    description: 'View a month-by-month breakdown of your planned spending. Spot expensive months before they happen.',
  },
  {
    icon: 'i-lucide-upload',
    title: 'Import actual spending',
    description: 'Upload your bank statement (CSV or JSON file) and the app will match transactions to your planned expenses automatically.',
  },
  {
    icon: 'i-lucide-scale',
    title: 'Compare plan vs reality',
    description: 'See at a glance where you spent more or less than planned — by item, by category, or by month.',
  },
]

const currentStep = ref(0)

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
  currentStep.value = index
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/40"
        @click="emit('close')"
      />

      <!-- Dialog -->
      <div class="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
        <!-- Skip/close button -->
        <button
          class="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          @click="emit('close')"
        >
          <span class="i-lucide-x text-lg" />
        </button>

        <!-- Step content -->
        <div class="text-center pt-2 pb-4">
          <div
            :class="activeStep.icon"
            class="text-4xl text-brand-500 mx-auto mb-4"
          />
          <h3 class="text-lg font-semibold text-gray-900 mb-2">
            {{ activeStep.title }}
          </h3>
          <p class="text-sm text-gray-600 leading-relaxed">
            {{ activeStep.description }}
          </p>
        </div>

        <!-- Step dots -->
        <div class="flex justify-center gap-1.5 mb-5">
          <button
            v-for="(_, index) in steps"
            :key="index"
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
