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
const DIST_DIR = resolve(REPO_ROOT, 'dist')
const DIST_AVAILABLE = existsSync(DIST_DIR)
const VERSIONED = /\?v=[0-9a-f]{8}(?=[^0-9a-f]|$)/

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

  it('manifest icons use versioned() helper', () => {
    expect(VITE_CONFIG).toMatch(/src:\s*versioned\('pwa-192x192\.png'\)/)
    expect(VITE_CONFIG).toMatch(/src:\s*versioned\('pwa-512x512\.png'\)/)
    expect(VITE_CONFIG).toMatch(/src:\s*versioned\('pwa-maskable-1024x1024\.png'\)/)
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

  it('dist/index.html icon <link> hrefs are versioned', () => {
    const html = readFileSync(resolve(DIST_DIR, 'index.html'), 'utf8')
    const links = html.match(/<link[^>]+rel="(?:icon|apple-touch-icon)"[^>]*>/g) ?? []
    expect(links.length).toBeGreaterThanOrEqual(3)
    for (const link of links) {
      const href = link.match(/href="([^"]+)"/)?.[1]
      expect(href).toBeDefined()
      expect(href!).toMatch(VERSIONED)
    }
  })

  it('dist/sw.js has cleanupOutdatedCaches() and /^v$/ ignore', () => {
    const sw = readFileSync(resolve(DIST_DIR, 'sw.js'), 'utf8')
    expect(sw).toMatch(/cleanupOutdatedCaches\(\)/)
    expect(sw).toMatch(/ignoreURLParametersMatching:\s*\[[^\]]*\/\^v\$\//)
  })
})
