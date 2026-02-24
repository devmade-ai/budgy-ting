/**
 * Dialog accessibility composable — focus trapping and Escape key handling.
 *
 * Requirement: All modals need role="dialog", focus trapping, Escape to close
 * Approach: Reusable composable that attaches to a dialog element ref
 * Alternatives:
 *   - Per-modal implementation: Rejected — 4+ modals need the same logic
 *   - Third-party focus-trap library: Deferred — npm registry was blocked
 */

import { onMounted, onUnmounted, type Ref } from 'vue'

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function useDialogA11y(
  dialogRef: Ref<HTMLElement | null>,
  onClose: () => void,
) {
  let previouslyFocused: HTMLElement | null = null

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }

    if (e.key === 'Tab') {
      const dialog = dialogRef.value
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

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
  }

  onMounted(() => {
    previouslyFocused = document.activeElement as HTMLElement | null
    document.addEventListener('keydown', handleKeydown)

    // Focus the first focusable element in the dialog
    requestAnimationFrame(() => {
      const dialog = dialogRef.value
      if (!dialog) return
      const first = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      first?.focus()
    })
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
    // Restore focus to the element that was focused before the dialog opened
    previouslyFocused?.focus()
  })
}
