/**
 * Service worker update management.
 *
 * Requirement: Users control when updates apply; periodic background checks
 * Approach: Wrap vite-plugin-pwa's useRegisterSW with registerType 'prompt'.
 *   Checks for new SW versions every 60 minutes. Exposes hasUpdate + updateApp
 *   to the UI. Offline-ready notification auto-dismisses after 3 seconds.
 * Alternatives:
 *   - Auto-update (registerType 'autoUpdate'): Rejected — users should control
 *     when the app reloads, especially mid-workflow
 *   - Manual SW registration: Rejected — vite-plugin-pwa handles caching strategy
 */

import { ref, computed, watch } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { debugLog } from '@/debug/debugLog'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 60 minutes
const OFFLINE_DISMISS_MS = 3000
const UPDATE_SUPPRESSION_MS = 30_000 // 30 seconds
const SUPPRESSION_KEY = 'budgy-ting:pwa-update-applied'

const offlineReady = ref(false)
const checking = ref(false)

// Stored at module level so checkForUpdate() can access it outside the callback
let swRegistration: ServiceWorkerRegistration | undefined
let updateCheckInterval: ReturnType<typeof setInterval> | undefined

const {
  needRefresh: hasUpdate,
  updateServiceWorker,
} = useRegisterSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    debugLog('pwa', 'info', 'Service worker registered', { swUrl })
    swRegistration = registration

    // Periodic update checks — app-lifetime interval.
    // Tracked so HMR module replacement doesn't leak duplicate intervals.
    if (registration) {
      if (updateCheckInterval !== undefined) clearInterval(updateCheckInterval)
      updateCheckInterval = setInterval(() => {
        debugLog('pwa', 'info', 'Periodic SW update check')
        registration.update()
      }, CHECK_INTERVAL_MS)
    }
  },
  onRegisterError(error) {
    debugLog('pwa', 'error', 'Service worker registration failed', { error: String(error) })
  },
  onOfflineReady() {
    debugLog('pwa', 'success', 'App ready for offline use')
    offlineReady.value = true
    setTimeout(() => {
      offlineReady.value = false
    }, OFFLINE_DISMISS_MS)
  },
})

// Requirement: Suppress update banner for 30 seconds after applying an update
// Approach: sessionStorage timestamp written before update. On reload, the new
//   SW may briefly signal needRefresh again — suppress it if within 30 seconds.
//   sessionStorage survives the reload but clears when the browser session ends.
// Alternatives:
//   - localStorage: Rejected — persists across sessions, could permanently suppress
//   - In-memory flag: Rejected — lost on the reload that the update itself triggers
function wasJustUpdated(): boolean {
  try {
    const ts = sessionStorage.getItem(SUPPRESSION_KEY)
    if (!ts) return false
    const elapsed = Date.now() - Number(ts)
    if (elapsed < UPDATE_SUPPRESSION_MS) {
      debugLog('pwa', 'info', `Update suppression active (${Math.round(elapsed / 1000)}s ago)`)
      return true
    }
    sessionStorage.removeItem(SUPPRESSION_KEY)
  } catch {
    // sessionStorage unavailable — no suppression
  }
  return false
}

function markUpdateApplied() {
  try {
    sessionStorage.setItem(SUPPRESSION_KEY, String(Date.now()))
  } catch {
    // sessionStorage unavailable — skip
  }
}

// Expose a suppression-aware computed instead of raw hasUpdate
const hasSuppressedUpdate = computed(() => hasUpdate.value && !wasJustUpdated())

// Log when update becomes available
watch(hasUpdate, (ready) => {
  if (ready) {
    debugLog('pwa', 'info', 'New service worker available — update ready')
  }
})

// Requirement: Check for SW updates when tab regains focus
// Approach: visibilitychange listener triggers registration.update() when
//   the document transitions from hidden to visible. Catches updates that
//   arrived while the user had the tab backgrounded.
// Alternatives:
//   - Only rely on periodic timer: Rejected — 60-minute interval means users
//     who switch back after a deploy could wait up to an hour
function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && swRegistration) {
    debugLog('pwa', 'info', 'Tab regained focus — checking for SW updates')
    swRegistration.update()
  }
}
document.addEventListener('visibilitychange', handleVisibilityChange)

function updateApp() {
  debugLog('pwa', 'info', 'User triggered SW update')
  markUpdateApplied()
  updateServiceWorker(true)
}

/**
 * Requirement: Manual "Check for updates" action in burger menu
 * Approach: Call registration.update() on demand, show brief checking state
 * Alternatives:
 *   - Reuse periodic timer: Rejected — user expects immediate feedback
 */
async function checkForUpdate() {
  if (!swRegistration) {
    debugLog('pwa', 'warn', 'No service worker registration — cannot check for updates')
    return
  }
  debugLog('pwa', 'info', 'User triggered manual update check')
  checking.value = true
  try {
    await swRegistration.update()
  } finally {
    checking.value = false
  }
}

export function usePWAUpdate() {
  return {
    hasUpdate: hasSuppressedUpdate,
    offlineReady,
    checking,
    updateApp,
    checkForUpdate,
  }
}
