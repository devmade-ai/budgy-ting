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

  // Update PWA status bar color
  const color = dark ? combo.metaColorDark : combo.metaColorLight
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => {
    meta.setAttribute('content', color)
  })

  if (!skipPersist) {
    safeSetItem(DARK_MODE_KEY, String(dark))
    safeSetItem(COMBO_KEY, comboId)
  }
}

// Watch isDark and combo changes
watch(isDark, (dark) => {
  applyTheme(dark, currentComboId.value)
  debugLog('boot', 'info', `Theme changed to ${dark ? 'dark' : 'light'}`)
})

watch(currentComboId, (comboId) => {
  applyTheme(isDark.value, comboId)
  debugLog('boot', 'info', `Theme combo changed to ${comboId}`)
})

// Cross-tab sync — storage event only fires in OTHER tabs
function handleStorageSync(e: StorageEvent): void {
  if (e.key === DARK_MODE_KEY && e.newValue !== null) {
    const dark = e.newValue === 'true'
    const comboId = validCombo(safeGetItem(COMBO_KEY))
    isDark.value = dark
    currentComboId.value = comboId
    applyTheme(dark, comboId, true)
  }
  if (e.key === COMBO_KEY && e.newValue !== null) {
    const comboId = validCombo(e.newValue)
    currentComboId.value = comboId
    applyTheme(isDark.value, comboId, true)
  }
}
window.addEventListener('storage', handleStorageSync)

// Track OS preference changes — only when user hasn't made an explicit choice
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
function handleSystemPreferenceChange(e: MediaQueryListEvent): void {
  if (safeGetItem(DARK_MODE_KEY) === null) {
    isDark.value = e.matches
  }
}
mediaQuery.addEventListener('change', handleSystemPreferenceChange)

export function useDarkMode() {
  function toggle(): void {
    isDark.value = !isDark.value
  }

  function setCombo(comboId: string): void {
    currentComboId.value = validCombo(comboId)
  }

  return { isDark, currentComboId, themeCombos, toggle, setCombo }
}
