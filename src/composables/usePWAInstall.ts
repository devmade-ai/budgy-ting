/**
 * PWA install detection and prompt management.
 *
 * Requirement: Detect browser type, capture install prompt, provide fallback
 *   instructions for browsers without native install (Safari, Firefox)
 * Approach: UA-string browser detection, beforeinstallprompt capture for
 *   Chromium, localStorage analytics + dismiss persistence
 * Alternatives:
 *   - Single usePWA composable: Rejected — install logic is complex enough
 *     to warrant its own module, and it must be importable from multiple components
 *   - No analytics: Rejected — understanding install funnel helps prioritise UX
 */

import { ref, computed } from 'vue'
import { debugLog } from '@/debug/debugLog'
import { safeGetItem, safeSetItem } from './useSafeStorage'

// ── Browser detection ──

export type BrowserType =
  | 'chrome'
  | 'edge'
  | 'brave'
  | 'opera'
  | 'samsung'
  | 'vivaldi'
  | 'arc'
  | 'safari-ios'
  | 'safari-macos'
  | 'firefox-android'
  | 'firefox-desktop'
  | 'unknown'

// Chromium browsers that support beforeinstallprompt — single source of truth
// used by install composable, diagnostic timeout, and debug pill.
// Reference: glow-props docs/implementations/PWA_SYSTEM.md (Key Lesson #7)
export const CHROMIUM_BROWSERS: BrowserType[] =
  ['chrome', 'edge', 'brave', 'opera', 'samsung', 'vivaldi', 'arc']

function detectBrowser(): BrowserType {
  const ua = navigator.userAgent.toLowerCase()
  const isIOS = /iphone|ipad|ipod/.test(ua)
  const isAndroid = /android/.test(ua)
  const isMac = /macintosh|mac os x/.test(ua)

  // Brave: Check navigator.brave existence first.
  // Bug: Brave Mobile strips "Brave" from the UA string (confirmed 2026-03-07).
  // Use existence check as primary, not async call or UA match.
  // Reference: glow-props docs/implementations/PWA_SYSTEM.md (Key Lesson #8)
  if ('brave' in navigator) return 'brave'

  // iOS non-Safari browsers: CriOS (Chrome), FxiOS (Firefox), EdgiOS (Edge)
  // These include "Safari" in their UA but are NOT Safari — they use WebKit but
  // cannot trigger PWA installation. Must be detected before the Safari check
  // to avoid misclassifying them as safari-ios.
  // Reference: glow-props docs/implementations/PWA_SYSTEM.md (Key Lesson #9)
  if (isIOS) {
    if (/crios/.test(ua)) return 'chrome'
    // FxiOS maps to firefox-desktop (not firefox-android) because iOS Firefox can't
    // install PWAs — same limitation as Firefox Desktop. The iOS non-Safari check in
    // needsManualInstructions catches this and shows Safari redirect instructions.
    if (/fxios/.test(ua)) return 'firefox-desktop'
    if (/edgios/.test(ua)) return 'edge'
  }

  // Safari (actual Safari — iOS Chrome/Firefox/Edge caught above)
  if (/safari/.test(ua) && !/chrome|chromium|edg|brave/.test(ua)) {
    return isIOS ? 'safari-ios' : isMac ? 'safari-macos' : 'unknown'
  }

  // Firefox
  if (/firefox/.test(ua)) {
    return isAndroid ? 'firefox-android' : 'firefox-desktop'
  }

  // Chromium browsers — order matters (some include "chrome" in UA)
  if (/samsungbrowser/.test(ua)) return 'samsung'
  if (/opr\//.test(ua) || /opera/.test(ua)) return 'opera'
  if (/vivaldi/.test(ua)) return 'vivaldi'
  if (/arc\//.test(ua)) return 'arc'
  if (/edg\//.test(ua)) return 'edge'
  if (/chrome|chromium/.test(ua)) return 'chrome'

  return 'unknown'
}

/** True when the app is already running as an installed PWA */
function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

// ── Analytics ──

const ANALYTICS_KEY = 'farlume:install-analytics'
const MAX_EVENTS = 50

export type InstallAnalyticsEvent =
  | 'prompted'
  | 'installed'
  | 'installed-via-browser'
  | 'dismissed'
  | 'instructions-viewed'

interface AnalyticsEntry {
  event: InstallAnalyticsEvent
  timestamp: string
  browser: BrowserType
}

function trackEvent(event: InstallAnalyticsEvent, browser: BrowserType) {
  const raw = safeGetItem(ANALYTICS_KEY)
  let entries: AnalyticsEntry[] = []
  if (raw) {
    try {
      entries = JSON.parse(raw)
    } catch {
      // Malformed JSON in storage — reset analytics
    }
  }
  entries.push({ event, timestamp: new Date().toISOString(), browser })
  const trimmed = entries.slice(-MAX_EVENTS)
  safeSetItem(ANALYTICS_KEY, JSON.stringify(trimmed))
  debugLog('pwa', 'info', `Install analytics: ${event}`, { browser })
}

// ── Dismiss persistence ──

const DISMISS_KEY = 'farlume:install-dismissed'

function isDismissed(): boolean {
  return safeGetItem(DISMISS_KEY) === 'true'
}

function persistDismiss() {
  safeSetItem(DISMISS_KEY, 'true')
}

// ── Composable ──

// Module-level state so multiple components share the same prompt event
let deferredPrompt: (Event & { prompt: () => Promise<void> }) | null = null
const canNativeInstall = ref(false)
const browser = ref<BrowserType>('unknown')
const dismissed = ref(false)
const installed = ref(false)
// Set true when Chromium browser's native prompt didn't fire after 5s — triggers
// manual install instructions as fallback (Chrome suppresses prompt for 90 days after dismiss)
const chromiumFallback = ref(false)

// Consume beforeinstallprompt event that may have been captured by the inline
// script in index.html before Vue modules loaded (repeat-visit race condition).
// See: glow-props docs/implementations/PWA_SYSTEM.md
function consumeEarlyCapturedEvent(): (Event & { prompt: () => Promise<void> }) | null {
  const win = window as unknown as Record<string, unknown>
  const captured = win.__pwaInstallPromptEvent as
    | (Event & { prompt: () => Promise<void> })
    | undefined
  if (captured) {
    // Set a flag before deleting the event so DebugPill's PWA diagnostics tab
    // can detect that beforeinstallprompt was received. Without this, the
    // diagnostic always shows "Not received" because this function deletes
    // __pwaInstallPromptEvent before the user opens the debug pill.
    win.__pwaInstallPromptReceived = true
    delete win.__pwaInstallPromptEvent
    return captured
  }
  return null
}

// Set up global listeners once at module load
if (typeof window !== 'undefined') {
  browser.value = detectBrowser()
  dismissed.value = isDismissed()
  installed.value = isStandalone()

  debugLog('pwa', 'info', 'Install system init', {
    browser: browser.value,
    standalone: installed.value,
    dismissed: dismissed.value,
  })

  // Check for early-captured event first (repeat visit with cached SW)
  const early = consumeEarlyCapturedEvent()
  if (early) {
    deferredPrompt = early
    canNativeInstall.value = true
    debugLog('pwa', 'info', 'beforeinstallprompt consumed from early capture', {
      browser: browser.value,
    })
  }

  // Fallback listener for first-visit case (SW registers after mount)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as Event & { prompt: () => Promise<void> }
    canNativeInstall.value = true
    debugLog('pwa', 'info', 'beforeinstallprompt captured via listener', {
      browser: browser.value,
    })
  })

  window.addEventListener('appinstalled', () => {
    canNativeInstall.value = false
    deferredPrompt = null
    installed.value = true
    trackEvent('installed', browser.value)
    debugLog('pwa', 'success', 'App installed')
  })

  // Requirement: Detect installation via browser menu (not the native prompt)
  // Approach: Watch display-mode: standalone change. When it transitions to standalone,
  //   the user installed via the browser's menu. Without this, only appinstalled
  //   event (fired by native prompt) is detected.
  // Reference: glow-props docs/implementations/PWA_SYSTEM.md
  const standaloneMediaQuery = window.matchMedia('(display-mode: standalone)')
  standaloneMediaQuery.addEventListener('change', (e: MediaQueryListEvent) => {
    if (e.matches) {
      installed.value = true
      canNativeInstall.value = false
      deferredPrompt = null
      trackEvent('installed-via-browser', browser.value)
      debugLog('pwa', 'success', 'App installed via browser menu (display-mode changed)')
    }
  })

  // Diagnostic: Log installability state after Chrome's engagement heuristic
  // window has had time to evaluate. Helps debug why beforeinstallprompt
  // may not fire on certain devices/browsers.
  // Only runs on browsers that could fire the prompt (Chromium-based).
  if (CHROMIUM_BROWSERS.includes(browser.value)) {
    const diagTimeout = setTimeout(() => {
      if (!canNativeInstall.value && !installed.value) {
        debugLog('pwa', 'warn', 'No beforeinstallprompt after 5s', {
          browser: browser.value,
          standalone: installed.value,
          dismissed: dismissed.value,
          hasManifestLink: !!document.querySelector('link[rel="manifest"]'),
          swControlled: !!navigator.serviceWorker?.controller,
        })
        // Chrome suppresses the prompt for 90 days after dismissal.
        // Show manual install instructions as fallback so users aren't stuck.
        // Reference: glow-props docs/implementations/PWA_SYSTEM.md (Key Lesson #10)
        chromiumFallback.value = true
      }
    }, 5000)
    // Clear if prompt arrives early to avoid noise
    window.addEventListener(
      'beforeinstallprompt',
      () => clearTimeout(diagTimeout),
      { once: true },
    )
  }
}

// Detect iOS at module level for install instruction routing
const isIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

export function usePWAInstall() {
  /** True when the native Chromium install prompt is available */
  const isNativeInstallAvailable = computed(() => canNativeInstall.value && !installed.value)

  /** True when browser supports install but needs manual instructions */
  const needsManualInstructions = computed(() => {
    if (installed.value) return false
    // iOS non-Safari browsers (Chrome/Firefox/Edge on iOS) can't install PWAs —
    // need instructions to redirect to Safari.
    // Reference: glow-props docs/implementations/PWA_SYSTEM.md (Key Lesson #9)
    if (isIOS && !['safari-ios'].includes(browser.value)) return true
    // Chromium fallback — native prompt didn't fire after 5s (likely 90-day suppress)
    if (chromiumFallback.value) return true
    return ['safari-ios', 'safari-macos', 'firefox-android'].includes(browser.value)
  })

  /** True when the install prompt should be shown (either native or manual) */
  const showInstallPrompt = computed(() => {
    if (installed.value || dismissed.value) return false
    return isNativeInstallAvailable.value || needsManualInstructions.value
  })

  async function triggerInstall() {
    if (!deferredPrompt) return
    trackEvent('prompted', browser.value)
    await deferredPrompt.prompt()
    // Outcome tracked via appinstalled event or lack thereof
    deferredPrompt = null
    canNativeInstall.value = false
  }

  function dismiss() {
    dismissed.value = true
    persistDismiss()
    trackEvent('dismissed', browser.value)
    debugLog('pwa', 'info', 'Install prompt dismissed by user')
  }

  function trackInstructionsViewed() {
    trackEvent('instructions-viewed', browser.value)
  }

  return {
    browser,
    installed,
    dismissed,
    isNativeInstallAvailable,
    needsManualInstructions,
    showInstallPrompt,
    triggerInstall,
    dismiss,
    trackInstructionsViewed,
  }
}
