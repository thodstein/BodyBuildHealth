import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VERCEL ? '/' : '/BodyBuildHealth/',
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          engines: ['src/engines/readiness.engine.ts', 'src/engines/risk.engine.ts', 'src/engines/dosage.engine.ts']
        }
      }
    }
  },
  server: { port: 5173, host: true }
});