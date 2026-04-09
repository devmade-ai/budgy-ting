/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'favicon-48x48.png', 'apple-touch-icon.png'],
      // Requirement: ONNX Runtime WASM files (~22MB) must not be precached by the SW
      // Approach: Exclude .wasm from precache manifest. Transformers.js fetches and caches
      //   these via the browser Cache API at runtime, independent of the SW.
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      manifest: {
        name: 'Farlume',
        short_name: 'Farlume',
        description: 'Plan and track expenses against budgets',
        // Requirement: Stable identity for Chrome PWA install system.
        // Approach: Explicit id so Chrome doesn't derive it from start_url
        //   (which can cause mismatches on path changes).
        id: '/',
        theme_color: '#10b981',
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
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
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
            src: 'pwa-maskable-1024x1024.png',
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
