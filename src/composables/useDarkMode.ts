/**
 * Requirement: User-controlled dark/light mode with system preference fallback
 * Approach: Module-level singleton state. localStorage persistence, .dark class on <html>,
 *   matchMedia listener for OS preference (fallback only), cross-tab sync via storage event,
 *   dynamic meta theme-color update on toggle.
 * Alternatives:
 *   - CSS-only prefers-color-scheme: Rejected — no user override possible
 *   - Vue provide/inject context: Rejected — overkill for web (DOM class is source of truth)
 *   - Pinia store: Rejected — theme is UI-only state, no cross-component actions needed
 * Reference: glow-props CLAUDE.md "Theme & Dark Mode"
 */

import { ref, watch } from 'vue'
import { safeGetItem, safeSetItem } from '@/composables/useSafeStorage'
import { debugLog } from '@/debug/debugLog'

const STORAGE_KEY = 'darkMode'

// Theme-color uses brand color for both modes — the status bar is a branding
// surface, not a content surface. A mid-tone brand color (#10b981) provides
// enough contrast for status bar text in both light and dark OS modes.
// Using page background colors causes visibility problems when the OS color
// scheme differs from the app's theme.
const THEME_COLOR_LIGHT = '#10b981'
const THEME_COLOR_DARK = '#10b981'

// Module-level singleton — shared across all components that call useDarkMode()
const isDark = ref(getInitialDarkMode())

// Apply immediately at module load (before any component mounts)
applyTheme(isDark.value)

function getInitialDarkMode(): boolean {
  const stored = safeGetItem(STORAGE_KEY)
  if (stored !== null) return stored === 'true'
  // Fall back to OS preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(dark: boolean): void {
  const root = document.documentElement
  if (dark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  // Dynamically update ALL meta theme-color tags so Android Chrome address bar
  // syncs with manual toggles, not just system preference changes.
  // querySelectorAll (not querySelector) is required because there may be two tags
  // with different media attributes — querySelector only returns the first one.
  const color = dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
    meta.setAttribute('content', color)
  })
}

// Watch isDark and apply changes — runs for any component that imports this
watch(isDark, (dark) => {
  applyTheme(dark)
  safeSetItem(STORAGE_KEY, String(dark))
  debugLog('boot', 'info', `Theme changed to ${dark ? 'dark' : 'light'}`)
})

// Cross-tab sync — storage event only fires in OTHER tabs (not the one that wrote),
// so there's no infinite loop risk. Without this, two tabs show different themes
// until the stale tab is refreshed.
function handleStorageSync(e: StorageEvent): void {
  if (e.key === STORAGE_KEY && e.newValue !== null) {
    isDark.value = e.newValue === 'true'
  }
}
window.addEventListener('storage', handleStorageSync)

// Track OS preference changes — only when user hasn't made an explicit choice.
// If they've manually toggled, their choice persists and system changes are ignored.
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
function handleSystemPreferenceChange(e: MediaQueryListEvent): void {
  if (safeGetItem(STORAGE_KEY) === null) {
    isDark.value = e.matches
  }
}
mediaQuery.addEventListener('change', handleSystemPreferenceChange)

export function useDarkMode() {
  function toggle(): void {
    isDark.value = !isDark.value
  }

  return { isDark, toggle }
}
