/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'

// Requirement: PWA icons must bust browser + CDN + SW precache + WebAPK caches
//   when their contents change. Stable filenames survive reinstalls — returning
//   users see the old icon for weeks.
// Approach: Append ?v=<sha256-8> to every icon URL (HTML link tags + manifest
//   icons). Workbox config strips the ?v= param on precache lookup so the
//   versioned URL still matches the base precache entry.
// Alternatives:
//   - Content-hashed filenames: Rejected — requires rename + stale-file cleanup
//     in /public + asset-graph integration that vite-plugin-pwa doesn't provide.
//   - Timestamp-based versioning: Rejected — bumps on every build, causing
//     spurious WebAPK regeneration + cache invalidation.
// Reference: glow-props docs/implementations/PWA_ICON_CACHE_BUST.md
const PUBLIC_DIR = resolve(__dirname, 'public')

function iconVersion(relPath: string): string {
  const full = resolve(PUBLIC_DIR, relPath)
  if (!existsSync(full)) {
    console.warn(`[iconVersion] missing icon at ${full} — using '0' as version.`)
    return '0'
  }
  return createHash('sha256').update(readFileSync(full)).digest('hex').slice(0, 8)
}

const ICON_PATHS = [
  'favicon.ico',
  'favicon-48x48.png',
  'apple-touch-icon.png',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'pwa-maskable-1024x1024.png',
]

const ICON_VERSIONS: Record<string, string> = Object.fromEntries(
  ICON_PATHS.map((p) => [p, iconVersion(p)]),
)

function versioned(relPath: string): string {
  const v = ICON_VERSIONS[relPath]
  if (!v) throw new Error(`[versioned] unknown icon path: ${relPath} — add it to ICON_PATHS.`)
  return `${relPath}?v=${v}`
}

// Requirement: Single stable token that changes iff any icon bytes change.
//   Consumed by useIconRefresh.ts to detect icon-only deploys and surface a
//   reinstall banner to installed users (OS icon cache is the one cache layer
//   the web side can't bust — user action is required).
// Approach: sha256(concat(iconVersion for each ICON_PATH, sorted)) → 12 hex.
//   Sorting makes the hash stable against ICON_PATHS reordering.
// Reference: glow-props docs/implementations/PWA_ICON_CACHE_BUST.md (OS layer)
const ICONS_HASH = createHash('sha256')
  .update([...ICON_PATHS].sort().map((p) => `${p}:${ICON_VERSIONS[p]}`).join('|'))
  .digest('hex')
  .slice(0, 12)

// Requirement: Replace stable icon hrefs in index.html with versioned URLs
//   at build time so browsers refetch on content change.
// Approach: transformIndexHtml runs once per build. Uses a REPLACEMENTS table
//   of exact literal matches — throws if a literal isn't found so silent drift
//   (someone reformats a link tag) is caught at build time instead of shipping.
function iconCacheBustHtml(): Plugin {
  const REPLACEMENTS: Array<{ from: string; to: () => string }> = [
    {
      from: 'href="/favicon-48x48.png"',
      to: () => `href="/${versioned('favicon-48x48.png')}"`,
    },
    {
      from: 'href="/favicon.ico"',
      to: () => `href="/${versioned('favicon.ico')}"`,
    },
    {
      from: 'href="/apple-touch-icon.png"',
      to: () => `href="/${versioned('apple-touch-icon.png')}"`,
    },
  ]

  return {
    name: 'icon-cache-bust-html',
    transformIndexHtml(html) {
      let out = html
      for (const { from, to } of REPLACEMENTS) {
        if (!out.includes(from)) {
          throw new Error(
            `[icon-cache-bust-html] expected literal not found in index.html: ${from}\n` +
              `Update REPLACEMENTS in vite.config.ts to match the current tag formatting.`,
          )
        }
        out = out.replaceAll(from, to())
      }
      return out
    },
  }
}

// Requirement: Supplementary update detection independent of SW changes.
// Approach: Emit version.json with buildTime + iconsHash during build.
//   buildTime — detects any deploy that changed precached assets
//     (usePWAUpdate.ts reads this on visibilitychange).
//   iconsHash — stable across icon-unchanged deploys, changes only when
//     icon bytes change (useIconRefresh.ts reads this to show a reinstall
//     banner to installed users whose OS-cached launcher icon won't
//     auto-refresh — the one cache layer the web side can't bust).
// Reference: glow-props docs/implementations/PWA_SYSTEM.md (version.json) +
//   docs/implementations/PWA_ICON_CACHE_BUST.md (OS icon cache)
function versionJsonPlugin(iconsHash: string): Plugin {
  return {
    name: 'version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          buildTime: new Date().toISOString(),
          iconsHash,
        }),
      })
    },
  }
}

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    versionJsonPlugin(ICONS_HASH),
    iconCacheBustHtml(),
    VitePWA({
      registerType: 'prompt',
      // Requirement: Icon files must reach the precache even though they
      //   aren't referenced from bundled JS/CSS.
      // Approach: The globPatterns entry `**/*.{...,ico,png,svg}` below already
      //   sweeps all /public assets into the precache manifest. An explicit
      //   `includeAssets` list duplicated every entry (apple-touch-icon.png
      //   appeared twice in dist/sw.js) so it's been dropped in favour of the
      //   glob-only path.
      // Reference: glow-props docs/implementations/PWA_SYSTEM.md
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Requirement: Remove stale caches from incompatible older Workbox versions
        // Without this, stale caches accumulate across deployments
        // Reference: glow-props docs/implementations/PWA_SYSTEM.md
        cleanupOutdatedCaches: true,
        // Requirement: Icon URLs carry a ?v=<hash> cache-bust param (see
        //   iconCacheBustHtml + versioned() above). Workbox precache keys off
        //   URL, so /icon?v=abc won't match the precached /icon entry.
        // Approach: Strip the v param before precache lookup so versioned
        //   fetches still resolve from cache.
        // Reference: glow-props docs/implementations/PWA_ICON_CACHE_BUST.md
        ignoreURLParametersMatching: [/^v$/],
      },
      manifest: {
        name: 'Farlume',
        short_name: 'Farlume',
        description: 'Plan and track expenses against budgets',
        // Requirement: Stable identity for Chrome PWA install system.
        // Approach: Explicit id so Chrome doesn't derive it from start_url
        //   (which can cause mismatches on path changes).
        id: '/',
        // Must match default combo's light metaColor (vivid = cmyk → #45aeee)
        theme_color: '#45aeee',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        // Requirement: Prevent Chrome from preferring a native app store listing.
        // Without this, Chrome may skip beforeinstallprompt if it thinks a
        // related native app exists.
        prefer_related_applications: false,
        // Requirement: Register as PWA share target for CSV/JSON files
        // Approach: share_target in manifest lets users share files directly
        //   to Farlume from their phone's file manager or banking app
        share_target: {
          action: '/',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [{ name: 'file', accept: ['.csv', 'text/csv', '.json', 'application/json'] }],
          },
        },
        icons: [
          {
            src: versioned('pwa-192x192.png'),
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: versioned('pwa-512x512.png'),
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          // Requirement: Maskable icon for Android adaptive-icon cropping.
          // Approach: Dedicated 1024px image with safe-zone padding (content
          //   within 80% inner zone). OS applies its own mask shape on top.
          // Alternatives:
          //   - Combined 'any maskable': Rejected — triggers Chrome DevTools warning.
          //   - Reuse same image: Rejected — rounded corners create artifacts
          //     when OS applies its own mask shape.
          {
            src: versioned('pwa-maskable-1024x1024.png'),
            sizes: '1024x1024',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Requirement: ML tag suggestion worker uses ESM imports (Transformers.js)
  // Approach: Set worker format to 'es' so Vite doesn't try IIFE (which breaks code-splitting)
  worker: {
    format: 'es',
  },
  // Requirement: Transformers.js uses dynamic imports and WASM internally
  // Approach: Exclude from Vite's dependency pre-bundling to avoid build errors
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
