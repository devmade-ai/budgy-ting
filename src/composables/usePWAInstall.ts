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

// ── Browser detection ──

export type BrowserType =
  | 'chrome'
  | 'edge'
  | 'brave'
  | 'safari-ios'
  | 'safari-macos'
  | 'firefox-android'
  | 'firefox-desktop'
  | 'unknown'

function detectBrowser(): BrowserType {
  const ua = navigator.userAgent.toLowerCase()
  const isIOS = /iphone|ipad|ipod/.test(ua)
  const isAndroid = /android/.test(ua)
  const isMac = /macintosh|mac os x/.test(ua)

  // Check Safari first (before Chrome, since Chrome on iOS includes "safari")
  if (/safari/.test(ua) && !/chrome|chromium|edg|brave/.test(ua)) {
    return isIOS ? 'safari-ios' : isMac ? 'safari-macos' : 'unknown'
  }

  // Firefox
  if (/firefox/.test(ua)) {
    return isAndroid ? 'firefox-android' : 'firefox-desktop'
  }

  // Chromium browsers — order matters (Brave and Edge include "chrome")
  if (/brave/.test(ua)) return 'brave'
  if (/edg/.test(ua)) return 'edge'
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

const ANALYTICS_KEY = 'budgy-ting:install-analytics'
const MAX_EVENTS = 50

export type InstallAnalyticsEvent =
  | 'prompted'
  | 'installed'
  | 'dismissed'
  | 'instructions-viewed'

interface AnalyticsEntry {
  event: InstallAnalyticsEvent
  timestamp: string
  browser: BrowserType
}

function trackEvent(event: InstallAnalyticsEvent, browser: BrowserType) {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY)
    const entries: AnalyticsEntry[] = raw ? JSON.parse(raw) : []
    entries.push({ event, timestamp: new Date().toISOString(), browser })
    // Keep only the last MAX_EVENTS entries
    const trimmed = entries.slice(-MAX_EVENTS)
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(trimmed))
    debugLog('pwa', 'info', `Install analytics: ${event}`, { browser })
  } catch {
    // localStorage unavailable — silently skip
  }
}

// ── Dismiss persistence ──

const DISMISS_KEY = 'budgy-ting:install-dismissed'

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === 'true'
  } catch {
    return false
  }
}

function persistDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, 'true')
  } catch {
    // localStorage unavailable — dismiss is session-only
  }
}

// ── Composable ──

// Module-level state so multiple components share the same prompt event
let deferredPrompt: (Event & { prompt: () => Promise<void> }) | null = null
const canNativeInstall = ref(false)
const browser = ref<BrowserType>('unknown')
const dismissed = ref(false)
const installed = ref(false)

// Set up global listeners once at module load
if (typeof window !== 'undefined') {
  browser.value = detectBrowser()
  dismissed.value = isDismissed()
  installed.value = isStandalone()

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as Event & { prompt: () => Promise<void> }
    canNativeInstall.value = true
    debugLog('pwa', 'info', 'beforeinstallprompt captured', { browser: browser.value })
  })

  window.addEventListener('appinstalled', () => {
    canNativeInstall.value = false
    deferredPrompt = null
    installed.value = true
    trackEvent('installed', browser.value)
    debugLog('pwa', 'success', 'App installed')
  })
}

export function usePWAInstall() {
  /** True when the native Chromium install prompt is available */
  const isNativeInstallAvailable = computed(() => canNativeInstall.value && !installed.value)

  /** True when browser supports install but needs manual instructions (Safari/Firefox) */
  const needsManualInstructions = computed(() => {
    if (installed.value) return false
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
