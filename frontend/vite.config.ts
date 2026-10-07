import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['brand-mark.svg', 'favicon.svg'],
      manifest: {
        name: 'Parole & Espérance — Ministère pastoral CBCA',
        short_name: 'Parole & Espérance',
        description: 'Écoutez et partagez les prédications du ministère pastoral CBCA.',
        theme_color: '#071b2b',
        background_color: '#fbf9f5',
        display: 'standalone',
        start_url: '/',
        lang: 'fr',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/v1/sermons'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sermons-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 40, maxAgeSeconds: 86400 }
            }
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'sermon-images',
              expiration: { maxEntries: 60, maxAgeSeconds: 2592000 }
            }
          }
        ]
      },
      devOptions: { enabled: true }
    })
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
});
