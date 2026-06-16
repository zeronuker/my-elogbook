import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',        // show update prompt instead of auto-updating
      includeAssets: [
        'favicon.svg',
        'brand/icons/elogbook/apple-touch-icon-180.png',
        'brand/icons/elogbook/icon-192.png',
        'brand/icons/elogbook/icon-512.png',
        'brand/icons/elogbook/icon-maskable-512.png',
      ],
      manifest: {
        name: 'ClaudeBorne eLogBook',
        short_name: 'C·B eLogBook',
        description: 'Professional aviation eLogbook by ClaudeBorne',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0a1020',
        theme_color: '#0a1020',
        icons: [
          {
            src: '/brand/icons/elogbook/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/brand/icons/elogbook/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/brand/icons/elogbook/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache app shell + all static assets
        // airportCoords.json is bundled into JS by Vite — no separate cache entry needed
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Main bundle is ~2.4MB — raise limit to accommodate
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MiB
        runtimeCaching: [
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
})
