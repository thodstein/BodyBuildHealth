/**
 * db.init() — ретраи вместо одного жёсткого окна в 5 с.
 *
 * Зачем лок: дефект был не «красивый», а смертный для части телефонов.
 * Прежний код отклонял промис через 5 с и на `blocked` мгновенно:
 * - на старом Android/WebView (Android 9–10, Huawei/Honor без Google-сервисов)
 *   апгрейд схемы (23 хранилища + индексы) холодным стартом дольше 5 с;
 * - WebView держит зомби-соединение → `blocked` навсегда.
 * Оба случаи давали красный экран «Ошибка инициализации базы данных»,
 * то есть на устройстве пользователя «приложение не работает».
 *
 * Здесь нет настоящего IndexedDB: подменяем `globalThis.indexedDB` минимальной
 * заглушкой open() — ровно те три сигнала, которые смотрит db.ts
 * (onupgradeneeded / onsuccess / onerror / onblocked).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

/** Объект «базы», который db.ts кладёт в this.db и потом закрывает. */
function fakeDbHandle() {
  return { close: () => {} };
}

/**
 * Заглушка open(): на каждый вызов вызывается onAttempt(1-based) →
 * она решает, что «ответит» WebView.
 */
function installFakeIndexedDB(onAttempt: (attempt: number, req: any) => void) {
  let attempts = 0;
  const open = vi.fn((_name: string, _version?: number) => {
    attempts += 1;
    const req: any = {
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      onblocked: null,
      result: fakeDbHandle(),
      error: null,
    };
    // Обработчики назначаются синхронно внутри openOnce, а ответ — позже.
    Promise.resolve().then(() => onAttempt(attempts, req));
    return req;
  });
  (globalThis as any).indexedDB = { open };
  return { open, attemptCount: () => attempts };
}

/** Событие апгрейда: проверяем, что схема (хранилища+индексы) всё ещё создаётся. */
function fireUpgrade(req: any) {
  const indexNames = { contains: () => false };
  const created: string[] = [];
  const store = {
    indexNames,
    createIndex: () => {},
  };
  const fakeStore = { ...store, indexNames };
  req.transaction = () => ({
    objectStore: () => fakeStore,
  });
  req.result = {
    objectStoreNames: { contains: () => false },
    createObjectStore: (s: string) => {
      created.push(s);
      return fakeStore;
    },
  };
  req.onupgradeneeded?.({ target: req });
  return created;
}

/** Ответ «успех»: апгрейд (если есть) + onsuccess. */
function fireSuccess(req: any, withUpgrade = false) {
  if (withUpgrade) fireUpgrade(req);
  req.result = fakeDbHandle();
  req.onsuccess?.();
}

function fireError(req: any, message = 'open failed') {
  req.error = { name: 'UnknownError', message };
  req.onerror?.();
}

const originalIdb = (globalThis as any).indexedDB;

afterEach(() => {
  vi.useRealTimers();
  (globalThis as any).indexedDB = originalIdb;
  vi.resetModules();
});

describe('db.init — устойчивость на старых/заблокированных WebView', () => {
  it('таймаут первой попытки не убивает запуск — вторая доводит до успеха', async () => {
    vi.useFakeTimers();
    const fake = installFakeIndexedDB((attempt, req) => {
      if (attempt === 1) return; // WebView молчит — срабатывает бюджет попытки
      fireSuccess(req, true);
    });

    const { db, dbInitDiagnostics } = await import('../db');
    const p = db.init();
    // бюджет попытки (8с) + пауза между попытками + старт второй попытки
    await vi.advanceTimersByTimeAsync(20_000);

    await expect(p).resolves.toBeUndefined();
    expect(fake.attemptCount()).toBeGreaterThanOrEqual(2);

    const diag = dbInitDiagnostics();
    expect(diag.ok).toBe(true);
    expect(diag.attempts).toBeGreaterThanOrEqual(2);
    expect(diag.error).toBeNull();
    vi.useRealTimers();
  });

  it('blocked ЖДЁТ освобождения соединения, а не отклоняет промис', async () => {
    // Сценарий Huawei: зомби-соединение держит апгрейд, но через 20мс отпускает.
    installFakeIndexedDB((_attempt, req) => {
      req.onblocked?.();
      setTimeout(() => fireSuccess(req, true), 20);
    });

    const { db, dbInitDiagnostics } = await import('../db');
    await expect(db.init()).resolves.toBeUndefined();
    // Одна попытка — ретраи не понадобились, `blocked` не съел запуск
    expect(dbInitDiagnostics().attempts).toBe(1);
    expect(dbInitDiagnostics().ok).toBe(true);
  });

  it('ошибка на всех попытках честно отклоняется и попытки видно в диагностике', async () => {
    const fake = installFakeIndexedDB((_attempt, req) => fireError(req, 'disk io error'));

    const { db, dbInitDiagnostics } = await import('../db');
    await expect(db.init()).rejects.toBeTruthy();
    expect(fake.attemptCount()).toBe(3);

    const diag = dbInitDiagnostics();
    expect(diag.ok).toBe(false);
    expect(diag.attempts).toBe(3);
    // Текст ошибки должен быть читаемым, а не пустым (на этом спотыкались раньше)
    expect(diag.error).toBeTruthy();
    expect(String(diag.error)).not.toBe('');
  });

  it('апгрейд схемы на успешной попытке по-прежнему создаёт все хранилища', async () => {
    let created: string[] = [];
    installFakeIndexedDB((_attempt, req) => {
      if (req.onupgradeneeded) created = fireUpgrade(req);
      req.result = fakeDbHandle();
      req.onsuccess?.();
    });

    const { db, STORES } = await import('../db');
    await expect(db.init()).resolves.toBeUndefined();

    // Регресс-лок на реальную работу openOnce: без onupgradeneeded
    // база осталась бы пустой и все чтения падали бы в 'DB not init'.
    expect(created.length).toBe(STORES.length);
    expect(created).toContain('users');
    expect(created).toContain('workout_log');
  });

  it('ретраи и ожидание blocked зафиксированы в коде (source-guard)', async () => {
    // Мутация «вернуть одно окно 5с и резать на blocked» должна ронять этот лок.
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.join(process.cwd(), 'src/core/db.ts'), 'utf8');
    expect(src).toContain('DB_INIT_MAX_ATTEMPTS');
    // onblocked обязан быть пустым ожиданием, а не отклонением
    expect(src).not.toMatch(/onblocked\s*=\s*\(\)\s*=>\s*\{[^}]*rej\(/);
    // бюджет попытки должен быть больше прежних 5 секунд
    expect(src).toMatch(/DB_INIT_ATTEMPT_TIMEOUT_MS\s*=\s*(?!5000\b)\d+/);
  });
});