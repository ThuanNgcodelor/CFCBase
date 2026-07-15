import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const googlePopupHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // injectManifest cho phép viết Service Worker riêng (src/sw.js) để xử lý
      // push event + notificationclick, đồng thời vẫn precache qua Workbox.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['logo.png', 'og-image.png', 'icons/*.png'],
      manifest: {
        id: '/',
        name: 'CFC Booking',
        short_name: 'CFC Book',
        description: 'Hệ thống đặt phòng họp và xe nội bộ của CFC',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/login',
        lang: 'vi',
        icons: [
          { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
          { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
          { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],

        gcm_sender_id: '103953800507',
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      integration: {
        configureCustomSWViteBuild(inlineConfig) {
          const rollupOptions = inlineConfig.build?.rollupOptions
          const rollupOutput = rollupOptions?.output
          if (rollupOutput && !Array.isArray(rollupOutput)) {
            delete rollupOutput.inlineDynamicImports
          }

          inlineConfig.build = {
            ...inlineConfig.build,
            rolldownOptions: {
              ...inlineConfig.build?.rolldownOptions,
              input: rollupOptions?.input,
              plugins: rollupOptions?.plugins,
              output: {
                ...inlineConfig.build?.rolldownOptions?.output,
                ...(!Array.isArray(rollupOutput) ? { entryFileNames: rollupOutput?.entryFileNames } : {}),
                codeSplitting: false,
              },
            },
          }
        },
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  server: {
    host: true,
    allowedHosts: ['cfcbooking.io.vn', 'www.cfcbooking.io.vn'],
    headers: googlePopupHeaders,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: ['cfcbooking.io.vn', 'www.cfcbooking.io.vn'],
    headers: googlePopupHeaders,
  },
  define: {
    global: 'window',
  },
})
