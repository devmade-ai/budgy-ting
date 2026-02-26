<script setup lang="ts">
/**
 * Requirement: Prevent white-screen crashes from unhandled errors
 * Approach: Vue error boundary using onErrorCaptured to catch child component errors
 * Alternatives:
 *   - Global error handler only: Rejected — doesn't prevent white screen, just logs
 *   - Try/catch in every component: Rejected — too verbose, easy to miss
 */

import { ref, onErrorCaptured } from 'vue'

const hasError = ref(false)
const errorMessage = ref('')

onErrorCaptured((err: unknown) => {
  hasError.value = true
  errorMessage.value = err instanceof Error ? err.message : 'Something went wrong'
  // Return false to stop error propagation
  return false
})

function retry() {
  hasError.value = false
  errorMessage.value = ''
}
</script>

<template>
  <div v-if="hasError" class="max-w-md mx-auto mt-16 text-center">
    <div class="i-lucide-alert-triangle text-5xl text-amber-400 mx-auto mb-4" />
    <h2 class="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
    <p class="text-gray-500 text-sm mb-1">
      The app ran into a problem. Your data is safe.
    </p>
    <p v-if="errorMessage" class="text-gray-400 text-xs mb-6 font-mono">
      {{ errorMessage }}
    </p>
    <div class="flex gap-3 justify-center">
      <button class="btn-primary" @click="retry">
        Try again
      </button>
      <button
        class="btn-secondary"
        @click="$router.push({ name: 'budget-list' })"
      >
        Go to budgets
      </button>
    </div>
  </div>
  <slot v-else />
</template>
