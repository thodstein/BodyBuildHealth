/**
 * Test setup file for Vitest
 * Sets up global objects needed for testing
 */

import '@testing-library/jest-dom/vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();

// Mock window object
if (typeof window === 'undefined') {
  (global as any).window = {};
}

Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

// Mock other browser APIs if needed
if (typeof document === 'undefined') {
  (global as any).document = {
    createElement: () => ({}),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

// Mock navigator
if (typeof navigator === 'undefined') {
  (global as any).navigator = {};
}

// Mock matchMedia (DiaryRecordingForm и др. проверяют touch/hover через matchMedia)
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

export {};
