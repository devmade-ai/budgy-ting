/**
 * Dialog accessibility composable — focus trapping and Escape key handling.
 *
 * Module-level stack + one shared document keydown listener. Stacked modals
 * (e.g. ConfirmDialog inside TransactionEditModal) cascade only if both
 * dialogs receive the same Escape — the stack ensures exactly one does. A
 * per-instance listener (the previous design) broke this: closing the inner
 * dialog also closed the outer one.
 */

import { onMounted, onUnmounted, watch, toValue, type Ref, type MaybeRefOrGetter } from 'vue'

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

/**
 * @param isOpen Optional reactive open-state (ref or getter). Supply it for a
 *   dialog that stays mounted and gates visibility via a prop — e.g. BottomSheet,
 *   which must stay mounted so its slide `<Transition>` can animate open/close.
 *   When given, the stack registration / scroll-lock / focus-trap engage on open
 *   and release on close, NOT on mount. Omit it for the common case where the
 *   component is `v-if`-mounted only while open (mount == open), preserving the
 *   original mount/unmount lifecycle.
 *
 * Requirement: a closed-but-mounted bottom sheet was locking page scroll on the
 *   workspace detail screen — its mount-time `lockBodyScroll()` fired while the
 *   sheet sat invisible and never released, freezing the whole page.
 * Approach: drive engagement from the open state when it's provided, so a mounted
 *   dialog only registers (and locks scroll) while actually visible.
 * Alternatives:
 *   - `v-if` the BottomSheet in the parent: Rejected — unmounts the component
 *     before its leave transition can play, killing the slide-down animation, and
 *     leaves the same footgun for the next always-mounted consumer.
 */
export function useDialogA11y(
  dialogRef: Ref<HTMLElement | null>,
  onClose: () => void,
  isOpen?: MaybeRefOrGetter<boolean>,
) {
  let previouslyFocused: HTMLElement | null = null
  let rafId: number | null = null
  // Guard so the reactive watcher and the onUnmounted safety net can't
  // double-engage or double-disengage (e.g. unmounting while still open).
  let engaged = false
  const entry: DialogEntry = { dialogRef, onClose }

  function engage() {
    if (engaged) return
    engaged = true
    previouslyFocused = document.activeElement as HTMLElement | null
    const wasEmpty = stack.length === 0
    stack.push(entry)
    ensureListener()
    if (wasEmpty) lockBodyScroll()

    // Focus the first focusable element in the dialog.
    // Track RAF ID so it can be cancelled if the dialog closes before it fires.
    rafId = requestAnimationFrame(() => {
      rafId = null
      const dialog = dialogRef.value
      if (!dialog) return
      const first = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      first?.focus()
    })
  }

  function disengage() {
    if (!engaged) return
    engaged = false
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    const idx = stack.lastIndexOf(entry)
    if (idx !== -1) stack.splice(idx, 1)
    releaseListenerIfIdle()
    if (stack.length === 0) unlockBodyScroll()
    // Restore focus to the element that was focused before this dialog opened.
    // With stacked dialogs this naturally returns to the outer dialog's last
    // focused control when the inner dialog closes.
    previouslyFocused?.focus()
  }

  if (isOpen !== undefined) {
    // Always-mounted dialog: engage on open, release on close. `immediate`
    // runs the closed case on setup so nothing locks while the dialog is hidden.
    watch(
      () => toValue(isOpen),
      (open) => {
        if (open) engage()
        else disengage()
      },
      { immediate: true },
    )
    // Safety net: unmounting while still open must release the lock + listener.
    onUnmounted(disengage)
  } else {
    // `v-if`-mounted dialog: mount == open, so engage for the component's lifetime.
    onMounted(engage)
    onUnmounted(disengage)
  }
}
