/**
 * Requirement: User-controlled dark/light mode with DaisyUI theme combos
 * Approach: Dual-layer theming — .dark class on <html> for Tailwind utilities,
 *   data-theme attribute for DaisyUI component colors. Named combos (Approach B)
 *   pair light+dark DaisyUI themes. localStorage persistence, cross-tab sync,
 *   dynamic meta theme-color, OS preference fallback.
 * Alternatives:
 *   - Per-mode independent themes: Rejected — utility app, combos are simpler
 *   - Pinia store: Rejected — theme is UI-only state, DOM is source of truth
 * Reference: glow-props docs/implementations/THEME_DARK_MODE.md
 */

import { ref, watch } from 'vue'
import { safeGetItem, safeSetItem } from '@/composables/useSafeStorage'
import { debugLog } from '@/debug/debugLog'
import { themeCombos, validCombo, getCombo } from '@/config/themes'

const DARK_MODE_KEY = 'darkMode'
const COMBO_KEY = 'themeCombo'

// Module-level singleton — shared across all components that call useDarkMode()
const isDark = ref(getInitialDarkMode())
const currentComboId = ref(getInitialCombo())

// Guard flag — prevents watchers from firing during cross-tab sync.
// Without this, setting isDark.value and currentComboId.value in the storage
// handler triggers both watchers, which redundantly call applyTheme() and
// re-persist values that came FROM another tab's localStorage write.
let syncing = false

// Apply immediately at module load (before any component mounts)
applyTheme(isDark.value, currentComboId.value)

function getInitialDarkMode(): boolean {
  const stored = safeGetItem(DARK_MODE_KEY)
  if (stored !== null) return stored === 'true'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getInitialCombo(): string {
  return validCombo(safeGetItem(COMBO_KEY))
}

/**
 * Apply both theming layers and update meta theme-color.
 * @param skipPersist - true when values came from another tab (no need to write back)
 */
function applyTheme(dark: boolean, comboId: string, skipPersist = false): void {
  const root = document.documentElement
  const combo = getCombo(comboId)
  const themeName = dark ? combo.dark : combo.light

  // Layer 1: Tailwind dark: variant
  if (dark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  // Layer 2: DaisyUI component colors
  root.setAttribute('data-theme', themeName)

  // Update PWA status bar color to match active theme
  const color = dark ? combo.metaColorDark : combo.metaColorLight
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
    meta.setAttribute('content', color)
  })

  if (!skipPersist) {
    safeSetItem(DARK_MODE_KEY, String(dark))
    safeSetItem(COMBO_KEY, comboId)
  }
}

// Watch isDark and combo changes — skipped during cross-tab sync
watch(isDark, (dark) => {
  if (syncing) return
  applyTheme(dark, currentComboId.value)
  debugLog('boot', 'info', `Theme changed to ${dark ? 'dark' : 'light'}`)
})

watch(currentComboId, (comboId) => {
  if (syncing) return
  applyTheme(isDark.value, comboId)
  debugLog('boot', 'info', `Theme combo changed to ${comboId}`)
})

// Cross-tab sync — storage event only fires in OTHER tabs (not the one that wrote),
// so there's no infinite loop risk. The syncing flag prevents the watchers from
// re-persisting values that already came from localStorage.
function handleStorageSync(e: StorageEvent): void {
  if (e.key === DARK_MODE_KEY && e.newValue !== null) {
    syncing = true
    const dark = e.newValue === 'true'
    const comboId = validCombo(safeGetItem(COMBO_KEY))
    isDark.value = dark
    currentComboId.value = comboId
    syncing = false
    applyTheme(dark, comboId, true)
  }
  if (e.key === COMBO_KEY && e.newValue !== null) {
    syncing = true
    const comboId = validCombo(e.newValue)
    currentComboId.value = comboId
    syncing = false
    applyTheme(isDark.value, comboId, true)
  }
}

// Track OS preference changes — only when user hasn't made an explicit choice.
// If they've manually toggled, their choice persists and system changes are ignored.
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
function handleSystemPreferenceChange(e: MediaQueryListEvent): void {
  if (safeGetItem(DARK_MODE_KEY) === null) {
    isDark.value = e.matches
  }
}

// Requirement: HMR-safe module-level listener attachment
// Approach: Per-concern guard flag prevents double-subscription when Vite
//   re-evaluates this module on hot reload. import.meta.hot.dispose() releases
//   the listeners when the old module copy is torn down.
// Reference: glow-props docs/implementations/TIMER_LEAKS.md §5
declare global {
  interface Window {
    __darkModeAttached?: boolean
  }
}

if (typeof window !== 'undefined' && !window.__darkModeAttached) {
  window.__darkModeAttached = true
  window.addEventListener('storage', handleStorageSync)
  mediaQuery.addEventListener('change', handleSystemPreferenceChange)
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('storage', handleStorageSync)
    mediaQuery.removeEventListener('change', handleSystemPreferenceChange)
    if (typeof window !== 'undefined') {
      window.__darkModeAttached = false
    }
  })
}

export function useDarkMode() {
  function toggle(): void {
    isDark.value = !isDark.value
  }

  function setCombo(comboId: string): void {
    currentComboId.value = validCombo(comboId)
  }

  return { isDark, currentComboId, themeCombos, toggle, setCombo }
}
