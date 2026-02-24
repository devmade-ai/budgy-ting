import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

// GitHub Pages deploys to /<repo-name>/ — VITE_BASE_URL is set by the
// CI workflow so asset paths and PWA scope resolve correctly.
const raw = process.env.VITE_BASE_URL || '/'
const base = raw.endsWith('/') ? raw : `${raw}/`

export default defineConfig({
  base,
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
        theme_color: '#10b981',
        background_color: '#ffffff',
        display: 'standalone',
        scope: base,
        start_url: base,
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
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
})
