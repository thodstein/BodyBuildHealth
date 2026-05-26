import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false, // отключаем для ускорения сборки
    minify: 'terser',
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 5173
  }
});
