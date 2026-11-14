import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // El registro se hace a mano en main.tsx para no activar el service worker
      // dentro del WebView de Android (evita servir una versión vieja de la app).
      injectRegister: null,
      includeAssets: [
        'favicon.png',
        'brand/logo-mark.png',
        'brand/logo-wordmark.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-192.png',
        'icons/icon-maskable-512.png',
        'icons/apple-touch-icon.png',
        'media/avatar-comprador.webp',
        'media/avatar-productor.webp',
        'media/lote-agave.webp',
        'media/lote-general.webp',
        'media/lote-limon.webp',
        'media/lote-maiz.webp',
        'og/og-cover.png'
      ],
      manifest: {
        name: 'Voz de Campo · Bitácora Agronómica y Pasaporte QR',
        short_name: 'Voz de Campo',
        description:
          'Bitácora móvil para ingenieros agrónomos: dictado en parcela sin señal, validación fitosanitaria y Pasaporte QR verificable con sello SHA-256.',
        theme_color: '#14532D',
        background_color: '#F6F8F3',
        display: 'standalone',
        orientation: 'any',
        lang: 'es-MX',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-parcel-tiles-v1',
              expiration: {
                maxEntries: 160,
                maxAgeSeconds: 60 * 60 * 24 * 14
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    chunkSizeWarningLimit: 1200
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts']
  }
});
