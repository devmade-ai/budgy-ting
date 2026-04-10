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
  metaColorLight: string
  metaColorDark: string
}

export const themeCombos: ThemeCombo[] = [
  {
    id: 'vivid',
    label: 'Vivid',
    light: 'cmyk',
    dark: 'night',
    metaColorLight: '#45b5e6',
    metaColorDark: '#0f1729',
  },
  {
    id: 'classic',
    label: 'Classic',
    light: 'lofi',
    dark: 'black',
    metaColorLight: '#808080',
    metaColorDark: '#000000',
  },
  {
    id: 'nature',
    label: 'Nature',
    light: 'emerald',
    dark: 'forest',
    metaColorLight: '#66CC8A',
    metaColorDark: '#1a2e1a',
  },
]

export const DEFAULT_COMBO = 'vivid'

const comboIds = new Set(themeCombos.map(c => c.id))

export function validCombo(id: string | null): string {
  return id && comboIds.has(id) ? id : DEFAULT_COMBO
}

export function getCombo(comboId: string): ThemeCombo {
  return themeCombos.find(c => c.id === comboId) ?? themeCombos[0]!
}
