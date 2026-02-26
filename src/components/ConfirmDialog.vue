<script setup lang="ts">
/**
 * Requirement: Confirm destructive actions with clear consequences explained
 * Approach: Reusable modal dialog with configurable title, message, and actions
 */

import { ref } from 'vue'
import { useDialogA11y } from '@/composables/useDialogA11y'

defineProps<{
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const dialogRef = ref<HTMLElement | null>(null)
useDialogA11y(dialogRef, () => emit('cancel'))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/40"
        aria-hidden="true"
        @click="emit('cancel')"
      />

      <!-- Dialog -->
      <div
        ref="dialogRef"
        role="alertdialog"
        :aria-label="title"
        aria-modal="true"
        class="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ title }}</h3>
        <p class="text-sm text-gray-600 mb-6">{{ message }}</p>
        <div class="flex gap-3">
          <button
            class="flex-1"
            :class="danger ? 'btn-danger' : 'btn-primary'"
            @click="emit('confirm')"
          >
            {{ confirmLabel || 'Confirm' }}
          </button>
          <button
            class="btn-secondary flex-1"
            @click="emit('cancel')"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
