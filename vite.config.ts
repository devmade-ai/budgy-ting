/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    UnoCSS(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'budgy-ting',
        short_name: 'budgy-ting',
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
          // Approach: Separate entry with purpose 'maskable' (same image).
          // Alternatives:
          //   - Combined 'any maskable': Rejected — triggers Chrome DevTools warning.
          //   - Dedicated padded maskable image: Ideal but not yet designed.
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
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
  test: {
    include: ['src/**/*.test.ts'],
  },
})
