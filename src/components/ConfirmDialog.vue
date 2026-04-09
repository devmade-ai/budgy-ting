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
    <div class="modal modal-open z-[60]">
      <!-- Backdrop -->
      <div
        class="modal-backdrop"
        aria-hidden="true"
        @click="emit('cancel')"
      />

      <!-- Dialog -->
      <div
        ref="dialogRef"
        role="alertdialog"
        :aria-label="title"
        aria-modal="true"
        class="modal-box max-w-sm"
      >
        <h3 class="text-lg font-semibold text-base-content mb-2">{{ title }}</h3>
        <p class="text-sm text-base-content/70 mb-6">{{ message }}</p>
        <!-- Requirement: Standard button order — Cancel left, Confirm right
             Approach: Cancel (secondary) first, confirm (primary/danger) second
             Alternatives:
               - Confirm-first: Rejected — violates platform convention (macOS, Material, etc.) -->
        <div class="flex gap-3">
          <button
            class="btn btn-ghost flex-1"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            class="btn flex-1"
            :class="danger ? 'btn-error' : 'btn-primary'"
            @click="hapticConfirm(); emit('confirm')"
          >
            {{ confirmLabel || 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
