import { defineConfig } from 'vite';

export default defineConfig({
  // Авто-базовый путь: для Vercel — '/', для GitHub Pages — '/имя-репо/'
  base: process.env.VERCEL ? '/' : (process.env.GITHUB_ACTIONS ? '/BodyBuildHealth/' : '/'),
  
  plugins: [],
  
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          engines: ['src/engines/readiness.engine.ts', 'src/engines/risk.engine.ts', 'src/engines/dosage.engine.ts'],
          workers: ['src/workers/calc.worker.ts']
        }
      }
    }
  },
  
  server: {
    port: 5173,
    host: '0.0.0.0'
  },
  
  css: {
    modules: true
  },
  
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
});
