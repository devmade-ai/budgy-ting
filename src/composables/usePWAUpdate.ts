/**
 * Service worker update management.
 *
 * Requirement: Users control when updates apply; periodic + visibility-based checks
 * Approach: Wrap vite-plugin-pwa's useRegisterSW with registerType 'prompt'.
 *   Checks for new SW versions every 60 minutes AND when tab regains focus
 *   (visibilitychange). 30-second suppression after applying an update prevents
 *   false re-detection while the browser's SW lifecycle settles.
 * Alternatives:
 *   - Auto-update (registerType 'autoUpdate'): Rejected — users should control
 *     when the app reloads, especially mid-workflow
 *   - Manual SW registration: Rejected — vite-plugin-pwa handles caching strategy
 *   - Polling only (no visibility check): Rejected — hourly interval is too slow
 *     to detect updates when user returns to a backgrounded tab
 * Reference: glow-props docs/implementations/PWA_SYSTEM.md
 */

import { ref, watch } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { debugLog } from '@/debug/debugLog'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 60 minutes
const OFFLINE_DISMISS_MS = 3000

// Requirement: 30-second suppression after applying an update
// Approach: sessionStorage timestamp checked before accepting onNeedRefresh.
//   Prevents false re-detection when the browser's SW lifecycle hasn't fully
//   settled after reload (new SW may fire statechange events during activation).
// Alternatives:
//   - In-memory flag: Rejected — doesn't survive the page reload that updateApp triggers
//   - localStorage: Rejected — persists across sessions; sessionStorage auto-clears
const SUPPRESSION_KEY = 'farlume:pwa-update-applied'
const SUPPRESSION_MS = 30_000

function wasJustUpdated(): boolean {
  try {
    const ts = sessionStorage.getItem(SUPPRESSION_KEY)
    if (!ts) return false
    return Date.now() - Number(ts) < SUPPRESSION_MS
  } catch { return false }
}

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

// Requirement: Visibility-based update checks — detect updates when tab regains focus
// Approach: Listen for visibilitychange at module level. When the page becomes visible,
//   call registration.update() to check for a new SW. This catches deploys that happened
//   while the tab was backgrounded, without waiting for the next hourly interval.
// Alternatives:
//   - Polling only: Rejected — 60-minute gaps miss updates for long-backgrounded tabs
//   - Focus event: Rejected — fires on window focus even within same tab (noisy)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && swRegistration) {
    swRegistration.update()
  }
})

// Suppress false re-detection within 30s of applying an update, otherwise log
watch(hasUpdate, (ready) => {
  if (ready) {
    if (wasJustUpdated()) {
      debugLog('pwa', 'info', 'Suppressed update re-detection (within 30s of last update)')
      hasUpdate.value = false
      return
    }
    debugLog('pwa', 'info', 'New service worker available — update ready')
  }
})

function updateApp() {
  debugLog('pwa', 'info', 'User triggered SW update')
  try { sessionStorage.setItem(SUPPRESSION_KEY, String(Date.now())) } catch {}
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
    hasUpdate,
    offlineReady,
    checking,
    updateApp,
    checkForUpdate,
  }
}
