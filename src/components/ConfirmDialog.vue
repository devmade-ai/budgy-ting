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
    <div class="fl-overlay" @click.self="busy || emit('cancel')">
      <!-- Dialog -->
      <div
        ref="dialogRef"
        role="alertdialog"
        :aria-label="title"
        aria-modal="true"
        :aria-busy="busy || undefined"
        class="fl-dialog max-w-sm"
      >
        <div class="fl-dialog__head">
          <h3 class="fl-dialog__title">{{ title }}</h3>
        </div>
        <div class="fl-dialog__body">{{ message }}</div>
        <!-- Requirement: Standard button order — Cancel left, Confirm right
             Approach: Cancel (secondary) first, confirm (primary/danger) second
             Alternatives:
               - Confirm-first: Rejected — violates platform convention (macOS, Material, etc.) -->
        <div class="fl-dialog__foot">
          <button
            class="fl-btn fl-btn--ghost"
            :disabled="busy"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            class="fl-btn"
            :class="danger ? 'fl-btn--danger-solid' : 'fl-btn--primary'"
            :disabled="busy"
            @click="hapticConfirm(); emit('confirm')"
          >
            <span v-if="busy" class="fl-btn__spin" aria-hidden="true" />
            {{ busy ? 'Working…' : (confirmLabel || 'Confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
