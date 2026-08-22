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

// Mock indexedDB for weight-photo-store
const createIDBMock = () => {
  const stores: Record<string, Map<string, any>> = {};
  return {
    open: (name: string, version: number) => {
      const db = {
        objectStoreNames: { contains: (s: string) => stores[s] !== undefined },
        createObjectStore: (s: string) => { stores[s] = new Map(); },
        transaction: (storeNames: string | string[], mode: string) => {
          const name = Array.isArray(storeNames) ? storeNames[0] : storeNames;
          const store = stores[name] || new Map();
          return {
            objectStore: () => ({
              put: (val: any) => { store.set(val.date || val.key, val); },
              get: (key: string) => store.get(key),
              delete: (key: string) => { store.delete(key); },
              clear: () => { store.clear(); },
              getAllKeys: () => Array.from(store.keys()),
              getAll: () => Array.from(store.values()),
            }),
            oncomplete: null,
            onerror: null,
          };
        },
        onupgradeneeded: null,
      };
      return Promise.resolve(db);
    },
  };
};

if (typeof indexedDB === 'undefined') {
  (global as any).indexedDB = createIDBMock();
}

export {};
