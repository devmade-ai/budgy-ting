/**
 * Requirement: Light/dark theme switching for the Farlume design system.
 * Approach: A single brand combo pairs the Farlume light + dark token themes.
 *   `light`/`dark` are the values written to the <html data-theme> attribute;
 *   the Farlume token layer (src/styles/tokens/colors.css) keys dark mode off
 *   [data-theme="dark"] and treats anything else as light (:root defaults).
 * Why a combo (not a bare boolean): keeps the existing useDarkMode plumbing,
 *   cross-tab sync, and meta-color logic intact, and leaves room for more
 *   brand palettes later without a rewrite.
 *
 * Sync points when changing theme names / colors:
 *   1. this file (source of truth)
 *   2. index.html flash-prevention script (vanilla JS, must mirror this)
 *   3. vite.config.ts manifest theme_color (must match the light status-bar color)
 */

export interface ThemeCombo {
  id: string
  label: string
  /** data-theme value for light mode (anything but "dark" = light tokens). */
  light: string
  /** data-theme value for dark mode (must be "dark" to trigger the dark scope). */
  dark: string
  /** PWA status-bar color, light mode — Farlume paper (surface-app). */
  metaColorLight: string
  /** PWA status-bar color, dark mode — Farlume deep ink (surface-app). */
  metaColorDark: string
}

export const themeCombos: ThemeCombo[] = [
  {
    id: 'farlume',
    label: 'Farlume',
    light: 'light',
    dark: 'dark',
    metaColorLight: '#F4F0E8',
    metaColorDark: '#0F1217',
  },
]

export const DEFAULT_COMBO = 'farlume'

const comboIds = new Set(themeCombos.map(c => c.id))

export function validCombo(id: string | null): string {
  return id && comboIds.has(id) ? id : DEFAULT_COMBO
}

export function getCombo(comboId: string): ThemeCombo {
  return themeCombos.find(c => c.id === comboId) ?? themeCombos[0]!
}
