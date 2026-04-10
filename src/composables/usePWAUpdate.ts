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

// ── Supplementary version detection ──
// Requirement: Detect app changes that don't modify sw.js
// Approach: Fetch /version.json (generated at build time) and compare buildTime
//   against localStorage. Catches the edge case where precached assets change but
//   the SW file itself doesn't (no revision change in the precache manifest).
// Alternatives:
//   - SW-only detection: Covers most cases but misses config-only or asset-only changes
//   - Polling version.json on interval: Rejected — visibility check is sufficient
// Reference: glow-props docs/implementations/PWA_SYSTEM.md (version.json)
const VERSION_KEY = 'farlume:app-build-time'
const VERSION_THROTTLE_MS = 60_000 // Don't fetch more than once per minute
let lastVersionCheck = 0

async function checkVersionUpdate(): Promise<boolean> {
  if (Date.now() - lastVersionCheck < VERSION_THROTTLE_MS) return false
  lastVersionCheck = Date.now()

  try {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) return false
    const { buildTime } = await res.json()
    const stored = localStorage.getItem(VERSION_KEY)
    // Always persist the latest buildTime so a detected change is only
    // reported once. Previously, localStorage was only set on the no-change
    // path, causing every subsequent check to re-detect the same "update"
    // after the 30-second suppression window expired.
    localStorage.setItem(VERSION_KEY, buildTime)
    if (stored && stored !== buildTime) {
      debugLog('pwa', 'info', 'New app version detected via version.json', { stored, buildTime })
      return true
    }
    return false
  } catch { return false }
}

// Check version on initial load — if a new build was deployed since last visit,
// show the update banner immediately instead of waiting for visibilitychange.
checkVersionUpdate().then(changed => {
  if (changed && !hasUpdate.value) {
    hasUpdate.value = true
  }
})

// ── Visibility-based checks ──
// Requirement: Detect updates when tab regains focus
// Approach: Listen for visibilitychange at module level. When the page becomes visible,
//   check both the SW registration AND version.json. This catches deploys that happened
//   while the tab was backgrounded, without waiting for the next hourly interval.
// Alternatives:
//   - Polling only: Rejected — 60-minute gaps miss updates for long-backgrounded tabs
//   - Focus event: Rejected — fires on window focus even within same tab (noisy)
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return

  // SW update check
  if (swRegistration) {
    swRegistration.update()
  }

  // Supplementary version.json check (throttled to once per minute)
  const versionChanged = await checkVersionUpdate()
  if (versionChanged && !hasUpdate.value) {
    hasUpdate.value = true
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

// Requirement: "Update now" must always result in a visible refresh
// Approach: Try SW skipWaiting first, fall back to hard reload after 2s.
//   When version.json detected the change (not the SW lifecycle), there's no
//   waiting SW — updateServiceWorker(true) sends SKIP_WAITING to nothing.
//   The timeout ensures the user always gets the new version.
// Alternatives:
//   - Track detection source: Rejected — adds state for a rare edge case
//   - Always hard reload: Rejected — SW skipWaiting is cleaner when available
const UPDATE_RELOAD_FALLBACK_MS = 2000

function updateApp() {
  debugLog('pwa', 'info', 'User triggered SW update')
  try { sessionStorage.setItem(SUPPRESSION_KEY, String(Date.now())) } catch {}
  updateServiceWorker(true)
  // Fallback: if SW update doesn't reload within 2s (e.g., version.json
  // detected the change but no new SW is waiting), hard reload
  setTimeout(() => {
    window.location.reload()
  }, UPDATE_RELOAD_FALLBACK_MS)
}

/**
 * Requirement: Manual "Check for updates" action in burger menu
 * Approach: Call registration.update() on demand, show brief checking state.
 *   1500ms settle delay after update() lets async SW lifecycle events propagate
 *   (onNeedRefresh may fire after update() resolves, not during it).
 * Alternatives:
 *   - Reuse periodic timer: Rejected — user expects immediate feedback
 *   - No settle delay: Rejected — "Checking..." state flashes invisibly fast,
 *     and SW events may not have fired yet when checking resets to false
 */
const CHECK_SETTLE_MS = 1500

async function checkForUpdate() {
  if (!swRegistration) {
    debugLog('pwa', 'warn', 'No service worker registration — cannot check for updates')
    return
  }
  debugLog('pwa', 'info', 'User triggered manual update check')
  checking.value = true
  try {
    await swRegistration.update()
    // Settle delay — SW lifecycle events (onNeedRefresh, onOfflineReady) fire
    // asynchronously after update() resolves. Without this delay, the checking
    // state resets before the user sees feedback and before events propagate.
    await new Promise(r => setTimeout(r, CHECK_SETTLE_MS))
  } catch (e) {
    debugLog('pwa', 'error', 'Update check failed', { error: String(e) })
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
