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

// Mock indexedDB. Контракт обязан быть настоящим: `open()` возвращает
// IDBOpenDBRequest (с onsuccess/onerror/onupgradeneeded, отвечающий асинхронно),
// а `transaction()` доводит oncomplete. Прежняя заглушка возвращала Promise —
// db.init() назначал обработчики на Promise, ответа не получал и сжигал полный
// бюджет попытки (8с) на каждую из 3 попыток: ~25с мёртвого времени на любой
// маунт, который читает дневник (combat/labs/pharma/cloud-kv), и падения
// тяжёлых UI-тестов по таймауту.
const createIDBMock = () => {
  const stores: Record<string, Map<string, any>> = {};
  const ensureStore = (name: string) => {
    if (!stores[name]) stores[name] = new Map();
    return stores[name];
  };
  // Ключ записи: db.ts использует keyPath 'id' с фолбэком на date/key —
  // иначе put() складывал бы всё под одним ключом undefined.
  const keyOf = (val: any) =>
    val && typeof val === 'object' ? (val.id ?? val.date ?? val.key) : val;
  // Запрос чтения: настоящий IDBRequest отвечает АСИНХРОННО, и вызывающий код
  // назначает onsuccess/onerror уже после вызова — иначе `await db.get/getAll()`
  // не встречает резолва и подвешивает промис навсегда (это и был реальный hang).
  const req = <T>(result: T | undefined, error: any = null) => {
    const r: any = { result, error, onsuccess: null, onerror: null };
    Promise.resolve().then(() => {
      if (error) r.onerror?.();
      else r.onsuccess?.();
    });
    return r;
  };
  const makeStore = (store: Map<string, any>) => ({
    put: (val: any) => { store.set(keyOf(val), val); return req(undefined); },
    add: (val: any) => { store.set(keyOf(val), val); return req(undefined); },
    get: (key: string) => req(store.get(key)),
    delete: (key: string) => { store.delete(key); return req(undefined); },
    clear: () => { store.clear(); return req(undefined); },
    count: () => req(store.size),
    getAllKeys: () => req(Array.from(store.keys())),
    getAll: () => req(Array.from(store.values())),
    index: (name: string) => ({
      getAll: (v: any) => req(Array.from(store.values()).filter(x => x && x[name] === v)),
    }),
  });
  const makeDb = () => ({
    // Схема считается созданной: апгрейд не нужен, хранилища ленивые.
    objectStoreNames: { contains: () => true, length: 0 },
    close: () => {},
    createObjectStore: (s: string) => makeStore(ensureStore(s)),
    transaction: (storeNames: string | string[], _mode: string) => {
      const name = Array.isArray(storeNames) ? storeNames[0] : storeNames;
      const store = ensureStore(String(name));
      const tx: any = { objectStore: () => makeStore(store), oncomplete: null, onerror: null, onabort: null };
      // Настоящая транзакция завершается асинхронно — oncomplete назначается
      // вызывающим кодом ПОСЛЕ операции, поэтому планируем микротаск.
      Promise.resolve().then(() => { tx.oncomplete?.(); });
      return tx;
    },
  });
  return {
    open: (_name: string, _version?: number) => {
      const req: any = {
        result: makeDb(),
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      Promise.resolve().then(() => { req.onsuccess?.(); });
      return req;
    },
    deleteDatabase: () => {
      const req: any = { onsuccess: null, onerror: null, onblocked: null };
      Promise.resolve().then(() => { req.onsuccess?.(); });
      return req;
    },
  };
};

if (typeof indexedDB === 'undefined') {
  (global as any).indexedDB = createIDBMock();
}

export {};
