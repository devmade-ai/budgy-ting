/**
 * Requirement: First-time user tutorial that shows once and can be re-triggered
 * Approach: Shared reactive state backed by localStorage for persistence across sessions
 * Alternatives:
 *   - IndexedDB storage: Rejected — overkill for a single boolean flag
 *   - Per-component state: Rejected — tutorial needs to be accessible from header help button
 */

import { ref } from 'vue'
import { safeGetItem, safeSetItem } from './useSafeStorage'

// Namespace all localStorage keys with 'farlume:' prefix (colon separator)
const STORAGE_KEY = 'farlume:tutorial-dismissed'

/** Module-level shared state (same pattern as usePWAInstall) */
const showTutorial = ref(false)

function hasBeenDismissed(): boolean {
  return safeGetItem(STORAGE_KEY) === '1'
}

function markDismissed() {
  safeSetItem(STORAGE_KEY, '1')
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
