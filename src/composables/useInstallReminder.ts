/**
 * Requirement: Gentle install reminder for repeat users who haven't installed the PWA
 * Approach: After 3+ visits, show a subtle reminder banner if not already installed or dismissed.
 *   Uses a separate localStorage counter from the main install prompt.
 * Alternatives:
 *   - Merge with usePWAInstall: Rejected — separate concern, different trigger logic
 *   - Inline in view: Rejected — extracted for reuse and testability
 */

import { ref } from 'vue'
import { safeGetItem, safeSetItem } from './useSafeStorage'

const VISIT_COUNT_KEY = 'budgy-ting:visit-count'
const REMINDER_DISMISSED_KEY = 'budgy-ting:install-reminder-dismissed'

/** Minimum visits before showing the install reminder */
const MIN_VISITS_FOR_REMINDER = 3

export function useInstallReminder() {
  const showInstallReminder = ref(false)

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
