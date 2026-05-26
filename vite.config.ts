import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          engines: ['src/engines/readiness.engine.ts'],
          workers: ['src/workers/calc.worker.ts']
        }
      }
    }
  },
  server: {
    https: true, // Обязательно для Telegram Web App
    port: 5173,
    host: '0.0.0.0'
  },
  css: {
    modules: true
  }
});