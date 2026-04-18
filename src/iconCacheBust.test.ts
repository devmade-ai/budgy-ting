import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

// Requirement: Prevent silent regressions in PWA icon cache-busting wiring.
// Approach: Source-level assertions on vite.config.ts + dist-level assertions
//   after a production build. If the build artifacts aren't present, the
//   dist assertions are skipped (dev-only runs still pass).
// Reference: glow-props docs/implementations/PWA_ICON_CACHE_BUST.md

const REPO_ROOT = resolve(__dirname, '..')
const VITE_CONFIG = readFileSync(resolve(REPO_ROOT, 'vite.config.ts'), 'utf8')
const INDEX_HTML = readFileSync(resolve(REPO_ROOT, 'index.html'), 'utf8')
const DIST_DIR = resolve(REPO_ROOT, 'dist')
const DIST_AVAILABLE = existsSync(DIST_DIR)
const VERSIONED = /\?v=[0-9a-f]{8}(?=[^0-9a-f]|$)/
const ICON_EXT = /\.(png|ico|jpg|jpeg|webp|svg|gif)$/i

/**
 * Extract the body of the `manifest: { icons: [...] }` array in the source.
 * Returns the substring between `icons: [` and its matching `]` so the caller
 * can scan it for bare-string srcs.
 */
function extractManifestIconsBlock(source: string): string {
  const marker = 'icons: ['
  const start = source.indexOf(marker, source.indexOf('manifest:'))
  if (start < 0) throw new Error('manifest.icons block not found in vite.config.ts')
  let depth = 1
  let i = start + marker.length
  for (; i < source.length && depth > 0; i++) {
    const c = source[i]
    if (c === '[') depth++
    else if (c === ']') depth--
  }
  if (depth !== 0) throw new Error('manifest.icons block is not balanced')
  return source.slice(start + marker.length, i - 1)
}

describe('icon cache-bust: source-level wiring', () => {
  it('vite.config.ts defines iconCacheBustHtml and wires it before VitePWA', () => {
    expect(VITE_CONFIG).toMatch(/function iconCacheBustHtml\s*\(/)
    const pluginsStart = VITE_CONFIG.indexOf('plugins: [')
    const iconPluginIdx = VITE_CONFIG.indexOf('iconCacheBustHtml()', pluginsStart)
    const vitePwaIdx = VITE_CONFIG.indexOf('VitePWA(', pluginsStart)
    expect(iconPluginIdx).toBeGreaterThan(0)
    expect(iconPluginIdx).toBeLessThan(vitePwaIdx)
  })

  it('workbox config contains cleanupOutdatedCaches and /^v$/ ignoreURLParametersMatching', () => {
    expect(VITE_CONFIG).toMatch(/cleanupOutdatedCaches:\s*true/)
    expect(VITE_CONFIG).toMatch(/ignoreURLParametersMatching:\s*\[[^\]]*\/\^v\$\//)
  })

  it('every manifest icon src uses versioned() — no bare-string filenames', () => {
    const block = extractManifestIconsBlock(VITE_CONFIG)
    const srcValues: string[] = []
    for (const m of block.matchAll(/src:\s*([^,\n]+)/g)) {
      const value = m[1]
      if (value !== undefined) srcValues.push(value.trim())
    }
    expect(srcValues.length).toBeGreaterThan(0)
    const bare = srcValues.filter((v) => {
      if (v.startsWith('versioned(')) return false
      // Strip trailing punctuation then check for raw quoted filename
      const stripped = v.replace(/[,\s]+$/, '')
      return /^['"`].+\.(png|ico|jpg|jpeg|webp|svg|gif)['"`]$/i.test(stripped)
    })
    if (bare.length > 0) {
      throw new Error(
        `Manifest icon srcs bypassing versioned(): ${JSON.stringify(bare)}\n` +
          `Wrap each with versioned('<path>') so the cache-bust hash is applied.`,
      )
    }
  })

  // Requirement: iconCacheBustHtml() throws at build time if any expected
  //   literal href is missing — this test fails the same drift before a build
  //   runs, giving faster feedback in dev/CI test runs.
  // Sync: this list must mirror REPLACEMENTS in vite.config.ts. If an icon
  //   <link> tag is added/removed in index.html, update both.
  it('index.html contains the exact literal hrefs the plugin replaces', () => {
    for (const literal of [
      'href="/favicon-48x48.png"',
      'href="/favicon.ico"',
      'href="/apple-touch-icon.png"',
    ]) {
      expect(INDEX_HTML, `index.html missing literal: ${literal}`).toContain(literal)
    }
  })

  it('versionJsonPlugin emits iconsHash so icon-only deploys are detectable', () => {
    expect(VITE_CONFIG).toMatch(/function versionJsonPlugin\s*\(\s*iconsHash\s*:/)
    expect(VITE_CONFIG).toMatch(/iconsHash\s*,?\s*\}/)
    expect(VITE_CONFIG).toMatch(/versionJsonPlugin\(ICONS_HASH\)/)
  })
})

describe.skipIf(!DIST_AVAILABLE)('icon cache-bust: dist-level verification', () => {
  it('dist/manifest.webmanifest icon srcs are versioned', () => {
    const m = JSON.parse(readFileSync(resolve(DIST_DIR, 'manifest.webmanifest'), 'utf8'))
    expect(m.icons.length).toBeGreaterThan(0)
    for (const icon of m.icons) {
      expect(icon.src).toMatch(VERSIONED)
    }
  })

  it('dist/index.html icon <link> hrefs are versioned and no bare icon href leaked', () => {
    const html = readFileSync(resolve(DIST_DIR, 'index.html'), 'utf8')
    const links = html.match(/<link[^>]+rel="(?:icon|apple-touch-icon|apple-touch-startup-image)"[^>]*>/g) ?? []
    expect(links.length).toBeGreaterThanOrEqual(3)
    for (const link of links) {
      const href = link.match(/href="([^"]+)"/)?.[1]
      expect(href).toBeDefined()
      if (href === undefined) continue
      // Any icon-file extension must carry ?v=<hash>. Non-icon hrefs (e.g. manifest) are allowed through.
      const [pathOnly] = href.split('?')
      if (pathOnly !== undefined && ICON_EXT.test(pathOnly)) {
        expect(href).toMatch(VERSIONED)
      }
    }
  })

  it('dist/sw.js has cleanupOutdatedCaches() and /^v$/ ignore', () => {
    const sw = readFileSync(resolve(DIST_DIR, 'sw.js'), 'utf8')
    expect(sw).toMatch(/cleanupOutdatedCaches\(\)/)
    expect(sw).toMatch(/ignoreURLParametersMatching:\s*\[[^\]]*\/\^v\$\//)
  })

  it('dist/sw.js precache has no duplicate URLs', () => {
    const sw = readFileSync(resolve(DIST_DIR, 'sw.js'), 'utf8')
    const urls: string[] = []
    for (const m of sw.matchAll(/url:"([^"]+)"/g)) {
      const url = m[1]
      if (url !== undefined) urls.push(url)
    }
    expect(urls.length).toBeGreaterThan(0)
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const u of urls) {
      if (seen.has(u)) dupes.push(u)
      seen.add(u)
    }
    expect(dupes, `duplicate precache URLs: ${dupes.join(', ')}`).toEqual([])
  })

  it('dist/version.json carries iconsHash', () => {
    const v = JSON.parse(readFileSync(resolve(DIST_DIR, 'version.json'), 'utf8'))
    expect(v.buildTime).toBeDefined()
    expect(v.iconsHash).toMatch(/^[0-9a-f]{12}$/)
  })
})
