/**
 * Dialog accessibility composable — focus trapping and Escape key handling.
 *
 * Module-level stack + one shared document keydown listener. Stacked modals
 * (e.g. ConfirmDialog inside TransactionEditModal) cascade only if both
 * dialogs receive the same Escape — the stack ensures exactly one does. A
 * per-instance listener (the previous design) broke this: closing the inner
 * dialog also closed the outer one.
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

// Body scroll lock — engaged while ANY dialog is on the stack.
// Without this, pull-to-refresh and ghost-scroll fire under modals on
// mobile, and iOS rubber-band exposes the page edges.
interface LockedStyles {
  bodyOverflow: string
  bodyOverscroll: string
  htmlOverflow: string
}
let lockedStyles: LockedStyles | null = null

function lockBodyScroll() {
  if (lockedStyles) return
  lockedStyles = {
    bodyOverflow: document.body.style.overflow,
    bodyOverscroll: document.body.style.overscrollBehavior,
    htmlOverflow: document.documentElement.style.overflow,
  }
  document.body.style.overflow = 'hidden'
  document.body.style.overscrollBehavior = 'contain'
  document.documentElement.style.overflow = 'hidden'
}

function unlockBodyScroll() {
  if (!lockedStyles) return
  document.body.style.overflow = lockedStyles.bodyOverflow
  document.body.style.overscrollBehavior = lockedStyles.bodyOverscroll
  document.documentElement.style.overflow = lockedStyles.htmlOverflow
  lockedStyles = null
}

/**
 * Returns true if any dialog is currently open. Consumers (e.g. pull-to-refresh)
 * use this to suppress gestures that would otherwise fire under an overlay.
 */
export function isDialogOpen(): boolean {
  return stack.length > 0
}

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
    const wasEmpty = stack.length === 0
    stack.push(entry)
    ensureListener()
    if (wasEmpty) lockBodyScroll()

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
    if (stack.length === 0) unlockBodyScroll()
    // Restore focus to the element that was focused before this dialog opened.
    // With stacked dialogs this naturally returns to the outer dialog's last
    // focused control when the inner dialog unmounts.
    previouslyFocused?.focus()
  })
}
