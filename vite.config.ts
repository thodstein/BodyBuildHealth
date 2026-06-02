import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts' },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'Health Engine',
        short_name: 'HealthEngine',
        description: 'Фармакология, Лабы, Риски, Нутриции',
        theme_color: '#0a1628',
        background_color: '#0a0a0f',
        display: 'standalone',
        icons: [
          { src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" rx="32" fill="%230a1628"/><text x="96" y="120" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="64" fill="%2300e68a">HE</text></svg>', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="64" fill="%230a1628"/><text x="256" y="310" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="160" fill="%2300e68a">HE</text></svg>', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '~': path.resolve(__dirname, 'public')
    }
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    sourcemap: true
  }
});