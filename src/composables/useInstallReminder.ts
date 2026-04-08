/**
 * Requirement: Gentle install reminder for repeat users who haven't installed the PWA
 * Approach: After 3+ visits, show a subtle reminder banner if not already installed or dismissed.
 *   Uses a separate localStorage counter from the main install prompt.
 *   Module-level ref ensures shared state if imported from multiple components.
 * Alternatives:
 *   - Merge with usePWAInstall: Rejected — separate concern, different trigger logic
 *   - Inline in view: Rejected — extracted for reuse and testability
 *   - Per-call ref: Rejected — would create independent state per component
 */

import { ref } from 'vue'
import { safeGetItem, safeSetItem } from './useSafeStorage'

const VISIT_COUNT_KEY = 'farlume:visit-count'
const REMINDER_DISMISSED_KEY = 'farlume:install-reminder-dismissed'

/** Minimum visits before showing the install reminder */
const MIN_VISITS_FOR_REMINDER = 3

// Module-level state — shared across all consumers (consistent with usePWAInstall pattern)
const showInstallReminder = ref(false)

export function useInstallReminder() {
  function checkInstallReminder() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    if (isStandalone) return
    if (safeGetItem(REMINDER_DISMISSED_KEY) === 'true') return

    const count = parseInt(safeGetItem(VISIT_COUNT_KEY) ?? '0', 10) + 1
    safeSetItem(VISIT_COUNT_KEY, String(count))

    if (count >= MIN_VISITS_FOR_REMINDER) {
      showInstallReminder.value = true
    }
  }

  function dismissInstallReminder() {
    showInstallReminder.value = false
    safeSetItem(REMINDER_DISMISSED_KEY, 'true')
  }

  return { showInstallReminder, checkInstallReminder, dismissInstallReminder }
}
