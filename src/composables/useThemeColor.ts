/**
 * Requirement: Read DaisyUI theme colors as hex for libraries that can't use CSS variables
 * Approach: getComputedStyle reads the resolved oklch value from <html>, then
 *   a canvas 1x1 pixel converts it to hex via the browser's color engine.
 *   No manual oklch→sRGB math — the browser handles gamut mapping natively.
 * Why: ApexCharts config objects require hex/rgb strings. DaisyUI stores
 *   colors as oklch CSS custom properties that only resolve at render time.
 * Reference: glow-props docs/implementations/THEME_DARK_MODE.md
 */

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null

/**
 * Convert any CSS color string to #rrggbb hex via a 1x1 canvas pixel.
 * Returns fallback if conversion fails (SSR, unsupported color space, etc.).
 */
function cssColorToHex(cssColor: string, fallback: string): string {
  try {
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      ctx = canvas.getContext('2d', { willReadFrequently: true })
    }
    if (!ctx) return fallback

    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = cssColor
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return '#' + [r, g, b].map(v => v!.toString(16).padStart(2, '0')).join('')
  } catch {
    return fallback
  }
}

/**
 * Read a DaisyUI CSS custom property from <html> and return it as a hex string.
 * @param prop - CSS property name including --, e.g. '--color-primary'
 * @param fallback - hex fallback if reading fails
 */
export function resolveThemeColor(prop: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(prop).trim()
  if (!raw) return fallback
  return cssColorToHex(raw, fallback)
}
