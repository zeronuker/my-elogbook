import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { resolve } from 'path'
import { commitSha } from './brand-kit/scripts/commit-sha.mjs'

// https://vite.dev/config/
export default defineConfig({
  define: {
    __COMMIT_SHA__: JSON.stringify(commitSha()),
  },
  resolve: {
    alias: {
      '@brand/BrandBanner': resolve(__dirname, 'brand-kit/component/BrandBanner.jsx'),
      '@brand/SplashScreen': resolve(__dirname, 'brand-kit/component/SplashScreen.jsx'),
      '@brand/UpdatePrompt': resolve(__dirname, 'brand-kit/component/UpdatePrompt.jsx'),
      '@brand/useUpdate': resolve(__dirname, 'brand-kit/component/useUpdate.js'),
      '@brand/Changelog': resolve(__dirname, 'brand-kit/component/Changelog.jsx'),
    },
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'brand-kit/static/css/brand.css',  dest: 'brand' },
        { src: 'brand-kit/static/logo/logo-mark.svg',       dest: 'brand' },
        { src: 'brand-kit/static/logo/logo-mark-light.svg', dest: 'brand' },
      ],
    }),
    VitePWA({
      registerType: 'prompt',        // show update prompt instead of auto-updating
      includeAssets: [
        'favicon.svg',
        'brand/icons/elogbook/apple-touch-icon-180.png',
        'brand/icons/elogbook/icon-192.png',
        'brand/icons/elogbook/icon-512.png',
        'brand/icons/elogbook/icon-maskable-512.png',
      ],
      // Brand manifest lives at /brand/manifest.webmanifest — disable plugin generation
      manifest: false,
      workbox: {
        // Cache app shell + all static assets
        // airportCoords.json is bundled into JS by Vite — no separate cache entry needed
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}'],
        // Main bundle is ~2.4MB — raise limit to accommodate
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MiB
      },
    }),
  ],
  server: {
    fs: { allow: ['.'] },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('airportCoords')) return 'airports';
        },
      },
    },
  },
})
