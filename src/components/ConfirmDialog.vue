<script setup lang="ts">
/**
 * Requirement: Confirm destructive actions with clear consequences explained
 * Approach: Reusable modal dialog with configurable title, message, and actions
 */

import { ref } from 'vue'
import { useDialogA11y } from '@/composables/useDialogA11y'
import { hapticConfirm } from '@/composables/useHaptic'

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
    <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
        class="relative bg-white dark:bg-[var(--color-surface-elevated)] rounded-xl shadow-xl dark:shadow-none max-w-sm w-full max-w-[calc(100%-2rem)] p-6"
      >
        <h3 class="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">{{ title }}</h3>
        <p class="text-sm text-gray-600 dark:text-zinc-300 mb-6">{{ message }}</p>
        <!-- Requirement: Standard button order — Cancel left, Confirm right
             Approach: Cancel (secondary) first, confirm (primary/danger) second
             Alternatives:
               - Confirm-first: Rejected — violates platform convention (macOS, Material, etc.) -->
        <div class="flex gap-3">
          <button
            class="btn-secondary flex-1"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            class="flex-1"
            :class="danger ? 'btn-danger' : 'btn-primary'"
            @click="hapticConfirm(); emit('confirm')"
          >
            {{ confirmLabel || 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
