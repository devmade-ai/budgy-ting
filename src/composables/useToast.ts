/**
 * Requirement: User feedback after actions (save, delete, export, import)
 * Approach: Reactive singleton — components call useToast().show(), AppLayout renders the toast.
 *   Auto-dismisses after a timeout. Supports success/error/warning variants.
 * Alternatives:
 *   - Per-component inline alerts: Rejected — inconsistent, clutters each view
 *   - Third-party toast library: Rejected — adds a dependency for a simple feature
 */

import { ref, readonly } from 'vue'

export type ToastVariant = 'success' | 'error' | 'warning'

interface ToastState {
  message: string
  variant: ToastVariant
  visible: boolean
}

const DISMISS_MS = 3000

const state = ref<ToastState>({
  message: '',
  variant: 'success',
  visible: false,
})

let dismissTimer: ReturnType<typeof setTimeout> | null = null

function show(message: string, variant: ToastVariant = 'success') {
  if (dismissTimer) clearTimeout(dismissTimer)

  state.value = { message, variant, visible: true }

  dismissTimer = setTimeout(() => {
    state.value = { ...state.value, visible: false }
  }, DISMISS_MS)
}

function dismiss() {
  if (dismissTimer) clearTimeout(dismissTimer)
  state.value = { ...state.value, visible: false }
}

export function useToast() {
  return {
    state: readonly(state),
    show,
    dismiss,
  }
}
