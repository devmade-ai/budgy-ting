/**
 * Requirement: First-time user tutorial that shows once and can be re-triggered
 * Approach: Shared reactive state backed by localStorage for persistence across sessions
 * Alternatives:
 *   - IndexedDB storage: Rejected — overkill for a single boolean flag
 *   - Per-component state: Rejected — tutorial needs to be accessible from header help button
 */

import { ref } from 'vue'

// Namespace all localStorage keys with 'budgy-ting:' prefix (colon separator)
const STORAGE_KEY = 'budgy-ting:tutorial-dismissed'

/** Module-level shared state (same pattern as usePWAInstall) */
const showTutorial = ref(false)

function hasBeenDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function markDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // localStorage unavailable (private browsing, storage full) — degrade silently
  }
}

export function useTutorial() {
  /** Show automatically on first visit (never dismissed before) */
  function showIfFirstVisit() {
    if (!hasBeenDismissed()) {
      showTutorial.value = true
    }
  }

  /** User explicitly opens tutorial from help button */
  function openTutorial() {
    showTutorial.value = true
  }

  /** Dismiss and persist the choice */
  function dismissTutorial() {
    showTutorial.value = false
    markDismissed()
  }

  return {
    showTutorial,
    showIfFirstVisit,
    openTutorial,
    dismissTutorial,
  }
}
