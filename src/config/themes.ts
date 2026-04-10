/**
 * Requirement: DaisyUI theme combos for dark/light mode switching
 * Approach: Named combos (Approach B from glow-props THEME_DARK_MODE.md).
 *   Each combo pairs a light and dark DaisyUI theme. Users pick a combo,
 *   toggling dark/light switches between the paired themes.
 * Why combos over per-mode independent: Utility app — full theme picker
 *   would overwhelm users. Curated pairs are pre-vetted to look good.
 * Reference: glow-props docs/implementations/THEME_DARK_MODE.md
 */

export interface ThemeCombo {
  id: string
  label: string
  light: string
  dark: string
  /** PWA status bar hex color for light mode — computed from DaisyUI theme oklch values */
  metaColorLight: string
  /** PWA status bar hex color for dark mode — computed from DaisyUI theme oklch values */
  metaColorDark: string
}

export const themeCombos: ThemeCombo[] = [
  {
    id: 'vivid',
    label: 'Vivid',
    light: 'cmyk',
    dark: 'night',
    metaColorLight: '#45aeee',
    metaColorDark: '#0f172a',
  },
  // To add more combos:
  // 1. Add entry here
  // 2. Register both DaisyUI theme names in src/index.css @plugin "daisyui" { themes: ... }
  // 3. Add to index.html flash prevention script combos object (vanilla JS, must mirror this file)
  // 4. Update vite.config.ts manifest theme_color if changing the default
]

export const DEFAULT_COMBO = 'vivid'

const comboIds = new Set(themeCombos.map(c => c.id))

export function validCombo(id: string | null): string {
  return id && comboIds.has(id) ? id : DEFAULT_COMBO
}

export function getCombo(comboId: string): ThemeCombo {
  return themeCombos.find(c => c.id === comboId) ?? themeCombos[0]!
}
