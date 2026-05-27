import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    port: 5173,
    host: true,
    open: false
  },
  optimizeDeps: {
    exclude: ['@telegram-web-app']
  }
});