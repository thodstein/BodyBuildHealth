import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '~': path.resolve(__dirname, 'public')
    }
  },
  worker: {
    format: 'es'
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          engines: [
            './src/engines/stack-generator.engine.ts',
            './src/engines/interactions-engine.ts',
            './src/engines/pk-pd.engine.ts',
            './src/engines/synergy-score.engine.ts'
          ],
          ui: [
            './src/ui/pharma-course.ts',
            './src/ui/labs-diagnostics.ts',
            './src/ui/articles-workflow.ts'
          ]
        }
      }
    }
  }
});