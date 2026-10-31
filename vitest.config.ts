import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    // Тяжёлые DOM-экраны (кардио-хаб, дневник, taper) под параллельной нагрузкой
    // не укладывались в дефолтные 5 с — это давало «плавающие» падения без реальных
    // регрессий. 15 с всё ещё отсекает настоящие зависания.
    testTimeout: 15000,
    hookTimeout: 15000,
    exclude: ['**/node_modules/**', '**/.tmp/**', '**/dist/**', '**/.git/**'],
    coverage: {
      provider: 'v8',
    },
  },
});
