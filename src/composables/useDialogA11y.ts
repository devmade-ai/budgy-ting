/**
 * Dialog accessibility composable — focus trapping and Escape key handling.
 *
 * Requirement: All modals need role="dialog", focus trapping, Escape to close.
 *   Stacked modals (e.g. a ConfirmDialog opened inside a TransactionEditModal)
 *   must only close the topmost dialog per Escape — not cascade.
 * Approach: Module-level stack of active dialogs + a single shared document
 *   keydown listener. Each useDialogA11y call pushes an entry on mount and
 *   pops on unmount. The listener only delegates to the stack's top entry, so
 *   exactly one dialog handles Escape/Tab at any moment. Focus is restored to
 *   the element that was focused before THIS dialog opened (LIFO).
 * Alternatives:
 *   - Per-instance document listener (previous version): Rejected — two open
 *     modals both received the same Escape, so pressing Escape on the inner
 *     ConfirmDialog also closed the outer edit modal.
 *   - Third-party focus-trap library: Deferred — the stack is the minimum
 *     increment needed; we can upgrade later without changing call sites.
 *   - Per-dialog DOM-scoped listener: Rejected — Escape and Tab are window
 *     concerns; the caller's dialog may not yet contain the focused element.
 */

import { onMounted, onUnmounted, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

interface DialogEntry {
  dialogRef: Ref<HTMLElement | null>
  onClose: () => void
}

// Module-level stack. Top of stack = topmost open dialog.
const stack: DialogEntry[] = []
let listenerAttached = false

function handleStackKeydown(e: KeyboardEvent) {
  const top = stack[stack.length - 1]
  if (!top) return

  if (e.key === 'Escape') {
    e.preventDefault()
    top.onClose()
    return
  }

  if (e.key === 'Tab') {
    const dialog = top.dialogRef.value
    if (!dialog) return

    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => !el.hasAttribute('disabled'))

    if (focusable.length === 0) {
      e.preventDefault()
      return
    }

    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!
    const active = document.activeElement as HTMLElement | null

    // If focus is outside the top dialog (e.g. focus leaked back to the
    // underlying modal via a background click), yank it back in.
    if (!active || !dialog.contains(active)) {
      e.preventDefault()
      first.focus()
      return
    }

    if (e.shiftKey) {
      if (active === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }
}

function ensureListener() {
  if (listenerAttached) return
  document.addEventListener('keydown', handleStackKeydown)
  listenerAttached = true
}

function releaseListenerIfIdle() {
  if (stack.length > 0 || !listenerAttached) return
  document.removeEventListener('keydown', handleStackKeydown)
  listenerAttached = false
}

export function useDialogA11y(
  dialogRef: Ref<HTMLElement | null>,
  onClose: () => void,
) {
  let previouslyFocused: HTMLElement | null = null
  let rafId: number | null = null
  const entry: DialogEntry = { dialogRef, onClose }

  onMounted(() => {
    previouslyFocused = document.activeElement as HTMLElement | null
    stack.push(entry)
    ensureListener()

    // Focus the first focusable element in the dialog.
    // Track RAF ID so it can be cancelled if the component unmounts before it fires.
    rafId = requestAnimationFrame(() => {
      rafId = null
      const dialog = dialogRef.value
      if (!dialog) return
      const first = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      first?.focus()
    })
  })

  onUnmounted(() => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    const idx = stack.lastIndexOf(entry)
    if (idx !== -1) stack.splice(idx, 1)
    releaseListenerIfIdle()
    // Restore focus to the element that was focused before this dialog opened.
    // With stacked dialogs this naturally returns to the outer dialog's last
    // focused control when the inner dialog unmounts.
    previouslyFocused?.focus()
  })
}
