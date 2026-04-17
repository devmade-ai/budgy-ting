/**
 * Icon-change detection for installed PWAs.
 *
 * Requirement: OS home-screen / launcher / dock icons are cached by the OS
 *   against the installed app's identity — not its icon URL. Query-string
 *   cache-busting refreshes browser / CDN / SW precache / Chrome WebAPK
 *   icons, but installed users still see the old launcher icon until they
 *   reinstall. The web side can't fix this; user education is the only
 *   available mitigation.
 * Approach: Read `iconsHash` from /version.json. If it differs from the
 *   last-acknowledged hash AND the app is running in standalone display
 *   mode (so this user actually has an installed PWA), surface a reinstall
 *   banner. Dismissal stores the new hash so the same banner doesn't
 *   re-appear until icons change again.
 * Alternatives:
 *   - Toast: Rejected — auto-dismisses, easy to miss; needs a "Show how"
 *     action which is awkward in a toast.
 *   - Force modal on visit: Rejected — hostile for users who don't care.
 *   - In-browser tab users: Suppressed — they'll see the fresh icon on
 *     next favicon fetch; banner would be noise.
 * Reference: glow-props docs/implementations/PWA_ICON_CACHE_BUST.md
 *   ("User communication" section).
 */

import { ref } from 'vue'
import { debugLog } from '@/debug/debugLog'
import { safeGetItem, safeSetItem } from '@/composables/useSafeStorage'

const STORAGE_KEY = 'farlume:icon-hash-acknowledged'
const CHECK_THROTTLE_MS = 60_000 // Don't re-fetch /version.json more than once a minute

const iconNeedsRefresh = ref(false)
let currentIconsHash: string | null = null
let lastCheck = 0

function isStandalone(): boolean {
  // Requirement: Only show the banner to users who actually have an
  //   installed PWA — in-browser users will see the new favicon on next
  //   fetch, making the banner noise for them.
  // Approach: Check display-mode: standalone (Chrome/Android/desktop) or
  //   navigator.standalone (iOS Safari's non-standard flag).
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true
    // iOS Safari exposes navigator.standalone; other browsers don't.
    const navAny = navigator as Navigator & { standalone?: boolean }
    return navAny.standalone === true
  } catch {
    return false
  }
}

async function checkIconsHash(): Promise<void> {
  if (Date.now() - lastCheck < CHECK_THROTTLE_MS) return
  lastCheck = Date.now()

  if (!isStandalone()) {
    // In-browser tab — icon changes propagate on next favicon fetch.
    // No banner, no storage writes (avoids bricking the first-install flow:
    // user installs, opens from home screen, we'd otherwise flag every
    // icon change they never saw in-browser).
    return
  }

  try {
    const res = await fetch('/version.json', { cache: 'no-store' })
    if (!res.ok) return
    const payload = (await res.json()) as { iconsHash?: string }
    const fresh = payload.iconsHash
    if (!fresh || typeof fresh !== 'string') return

    currentIconsHash = fresh
    const acknowledged = safeGetItem(STORAGE_KEY)

    if (acknowledged === null) {
      // First run after install (or after clear storage). Record the current
      // hash as acknowledged so we don't flag the user for icons they've
      // never seen any other version of.
      safeSetItem(STORAGE_KEY, fresh)
      return
    }

    if (acknowledged !== fresh) {
      debugLog('pwa', 'info', 'Icons updated since last seen; surfacing reinstall banner', {
        acknowledged,
        fresh,
      })
      iconNeedsRefresh.value = true
    }
  } catch (e) {
    debugLog('pwa', 'warn', 'icon refresh check failed', { error: String(e) })
  }
}

function dismissIconRefresh(): void {
  if (currentIconsHash) {
    // Acknowledging the current hash — next time icons change, we'll flag
    // again. Dismissal is per-hash, not global.
    safeSetItem(STORAGE_KEY, currentIconsHash)
  }
  iconNeedsRefresh.value = false
}

export function useIconRefresh() {
  return {
    iconNeedsRefresh,
    checkIconsHash,
    dismissIconRefresh,
  }
}
