<script setup lang="ts">
/**
 * Requirement: Confirm destructive actions with clear consequences explained
 * Approach: Reusable modal dialog with configurable title, message, and actions
 */

import { ref } from 'vue'
import { useDialogA11y } from '@/composables/useDialogA11y'
import { hapticConfirm } from '@/composables/useHaptic'

const props = defineProps<{
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  /** When true, disables both buttons and swaps confirm for a spinner — for
   *  async confirms (DB restore, network calls) where the action takes real time. */
  busy?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const dialogRef = ref<HTMLElement | null>(null)
// While busy, Escape should not cancel — the work is already running.
useDialogA11y(dialogRef, () => { if (!props.busy) emit('cancel') })
</script>

<template>
  <Teleport to="body">
    <div class="modal modal-open z-[60]">
      <!-- Backdrop -->
      <div
        class="modal-backdrop"
        aria-hidden="true"
        @click="busy || emit('cancel')"
      />

      <!-- Dialog -->
      <div
        ref="dialogRef"
        role="alertdialog"
        :aria-label="title"
        aria-modal="true"
        :aria-busy="busy || undefined"
        class="modal-box max-w-sm max-h-[90vh] overflow-y-auto"
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
            :disabled="busy"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            class="btn flex-1"
            :class="danger ? 'btn-error' : 'btn-primary'"
            :disabled="busy"
            @click="hapticConfirm(); emit('confirm')"
          >
            <span v-if="busy" class="loading loading-spinner loading-xs mr-1" aria-hidden="true" />
            {{ busy ? 'Working…' : (confirmLabel || 'Confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
