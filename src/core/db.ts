import { currentSpaceId, DATA_SPACE_KEY, HOME_SPACE_ID, parseRegistry } from './data-space';
import { closeWeightPhotoDb, weightPhotoDbNameFor } from '../engines/weight-photo-store';

const DB_NAME = 'HealthEngineDB_v3';
const DB_VERSION = 7;

export const STORES = ['users',
  'profile', 'readiness_log', 'risk_log', 'fertility_log', 'settings',
  'labs_log', 'diagnostics_log', 'phase_schedule', 'diary', 'articles',
  'gamification', 'marketplace_cart', 'food_diary', 'sync_queue',
  'course_log', 'doctor_notes', 'progress_photos', 'injuries_log',
  'training_log', 'workout_log', 'food_cache',
  'cardio_sessions'
] as const;

type StoreNames = typeof STORES[number] | string;

/**
 * Открытие БД на живых телефонах. Прежний код режал старт одним окном в 5с
 * и мгновенно отказывал на `blocked`. Обе ситуации реальны на старых
 * Android/WebView (Android 9–10, Huawei без Google-сервисов):
 * - апгрейд схемы (23 хранилища + индексы) на холодном старте спокойно
 *   занимает больше 5 секунд → было «Ошибка инициализации базы данных»;
 * - WebView держит зомби-соединение от прошлого процесса → `blocked`
 *   намертво, хотя соединение вот-вот освободится само.
 * Теперь это ретраи с растущим бюджетом, а `blocked` просто ждёт.
 */
const DB_INIT_MAX_ATTEMPTS = 3;
const DB_INIT_ATTEMPT_TIMEOUT_MS = 8000;

/** Последняя ошибка инициализации — для честной диагностики на экране. */
let lastInitError: string | null = null;
let lastInitAttempts = 0;
let dbReady = false;

export function dbInitDiagnostics(): { ok: boolean; attempts: number; error: string | null } {
  return { ok: dbReady, attempts: lastInitAttempts, error: lastInitError };
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.name + ': ' + (e.message || '(без текста)');
  if (e && typeof e === 'object') {
    const anyE = e as { name?: unknown; message?: unknown };
    const name = typeof anyE.name === 'string' ? anyE.name : 'Error';
    const msg = typeof anyE.message === 'string' ? anyE.message : '';
    return name + (msg ? ': ' + msg : '');
  }
  return String(e ?? 'unknown');
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

const INDEXES: Record<string, { name: string; keyPath: string }[]> = {
  labs_log: [
    { name: 'date', keyPath: 'date' },
    { name: 'code', keyPath: 'code' },
    { name: 'phase', keyPath: 'phase' },
  ],
  readiness_log: [{ name: 'date', keyPath: 'date' }],
  risk_log: [{ name: 'date', keyPath: 'date' }],
  diary: [{ name: 'date', keyPath: 'date' }],
  food_diary: [{ name: 'date', keyPath: 'date' }],
  sync_queue: [
    { name: 'status', keyPath: 'status' },
    { name: 'timestamp', keyPath: 'timestamp' },
  ],
  phase_schedule: [{ name: 'date', keyPath: 'date' }],
  users: [
    { name: 'email', keyPath: 'email' },
    { name: 'role', keyPath: 'role' },
  ],
  fertility_log: [{ name: 'date', keyPath: 'date' }],
  diagnostics_log: [{ name: 'date', keyPath: 'date' }],
  gamification: [{ name: 'date', keyPath: 'date' }],
  training_log: [{ name: 'date', keyPath: 'date' }, { name: 'exerciseId', keyPath: 'exerciseId' }],
  workout_log: [{ name: 'date', keyPath: 'date' }],
  cardio_sessions: [{ name: 'date', keyPath: 'date' }],
};

/**
 * Имя базы IndexedDB для пространства данных: home — как было (`HealthEngineDB_v3`,
 * нулевая миграция), атлет — своя база. Без этого дневники и анализы всех атлетов
 * лежали бы в одной базе и «изоляция» была бы только на словах.
 */
export function dbNameFor(spaceId: string): string {
  if (!spaceId || spaceId === 'home') return DB_NAME;
  return `${DB_NAME}__${spaceId}`;
}

/** Создать недостающие сторы/индексы. Одинаково для всех пространств. */
function applySchema(d: IDBDatabase, e: IDBVersionChangeEvent): void {
  STORES.forEach(s => {
    let store: IDBObjectStore;
    if (!d.objectStoreNames.contains(s)) {
      store = d.createObjectStore(s, { keyPath: 'id' });
    } else {
      store = (e.target as IDBOpenDBRequest).transaction!.objectStore(s);
    }
    const indexes = INDEXES[s];
    if (indexes) {
      indexes.forEach(idx => {
        if (!store.indexNames.contains(idx.name)) {
          store.createIndex(idx.name, idx.keyPath);
        }
      });
    }
  });
}

/**
 * Открыть базу КОНКРЕТНОГО пространства (а не открытого). Нужно бэкапу:
 * дневники тренировок и анализы атлетов лежат в их базах, и без этого бэкап
 * уносил бы только базу того пространства, в котором открыто приложение.
 *
 * `create=false` — если базы нет, вернуть `null` и не создавать пустую.
 */
export function openSpaceDb(spaceId: string, create: boolean): Promise<IDBDatabase | null> {
  return new Promise<IDBDatabase | null>(resolve => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(dbNameFor(spaceId), DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    let settled = false;
    const done = (v: IDBDatabase | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    req.onupgradeneeded = e => {
      if (!create) {
        // Базы не было. Открытие без версии создало бы пустую — прерываем.
        try {
          (e.target as IDBOpenDBRequest).transaction?.abort();
        } catch {
          /* ignore */
        }
        return;
      }
      try {
        applySchema((e.target as IDBOpenDBRequest).result, e);
      } catch {
        /* среда не дала создать схему — ниже откроем как есть */
      }
    };
    req.onsuccess = () => done(req.result);
    req.onerror = () => done(null);
    req.onblocked = () => done(null);
  });
}

/** Прочитать всю базу пространства (для бэкапа). Пустая база — пустые списки. */
export async function readSpaceStores(spaceId: string): Promise<Record<string, any[]>> {
  const out: Record<string, any[]> = {};
  const database = await openSpaceDb(spaceId, false);
  if (!database) return out;
  try {
    const names = STORES.filter(s => database.objectStoreNames.contains(s));
    if (!names.length) return out;
    const tx = database.transaction(names, 'readonly');
    await Promise.all(
      names.map(
        s =>
          new Promise<void>(res => {
            try {
              const r = tx.objectStore(s).getAll();
              r.onsuccess = () => {
                out[s] = Array.isArray(r.result) ? r.result : [];
                res();
              };
              r.onerror = () => {
                out[s] = [];
                res();
              };
            } catch {
              out[s] = [];
              res();
            }
          }),
      ),
    );
  } catch {
    /* среда не дала прочитать — считаем, что записей нет */
  } finally {
    try {
      database.close();
    } catch {
      /* ignore */
    }
  }
  return out;
}

/**
 * Заменить содержимое базы пространства (восстановление бэкапа). Пишем именно
 * в базу этого пространства: иначе данные атлета оказались бы в базе другого.
 */
export async function writeSpaceStores(
  spaceId: string,
  stores: Record<string, any[]>,
): Promise<void> {
  const database = await openSpaceDb(spaceId, true);
  if (!database) return;
  try {
    const names = STORES.filter(s => database.objectStoreNames.contains(s));
    if (!names.length) return;
    const tx = database.transaction(names, 'readwrite');
    for (const s of names) {
      try {
        const os = tx.objectStore(s);
        os.clear();
        for (const rec of stores[s] || []) {
          try {
            os.put(rec);
          } catch {
            /* сбойная запись не должна срывать восстановление остальных */
          }
        }
      } catch {
        /* ignore */
      }
    }
    await new Promise<void>(res => {
      tx.oncomplete = () => res();
      tx.onerror = () => res();
      tx.onabort = () => res();
    });
  } catch {
    /* ignore */
  } finally {
    try {
      database.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Дописать записи в базу ДРУГОГО пространства (кэш для сводок тренера).
 *
 * Базу создаём при необходимости: записи пришли — значит у атлета есть данные,
 * и сводка «кто тренировался» должна их видеть, не заставляя тренера открывать
 * пространство. Пустых баз это не плодит: писать нечего — база не создаётся
 * (см. пустой `records`). Существующие записи не заменяются целиком: пишем
 * только то, что пришло (аддитивно), удаление — отдельная операция.
 *
 * @returns число записанных записей; `null` — базу не удалось открыть (тогда
 * вызывающий не должен запоминать, что запись «уже синхронизирована»: иначе
 * при первом входе в пространство её сочтут удалённой локально и удалят в
 * облаке).
 */
export async function putSpaceRecords(
  spaceId: string,
  records: Record<string, any[]>,
): Promise<number | null> {
  const hasAny = Object.values(records).some(list => Array.isArray(list) && list.length > 0);
  if (!hasAny) return 0;
  const database = await openSpaceDb(spaceId, true);
  if (!database) return null;
  let written = 0;
  try {
    const names = STORES.filter(
      s => (records[s]?.length ?? 0) > 0 && database.objectStoreNames.contains(s),
    );
    if (!names.length) return 0;
    const tx = database.transaction(names, 'readwrite');
    for (const s of names) {
      try {
        const os = tx.objectStore(s);
        for (const rec of records[s]) {
          if (!rec || (rec as any).id == null) continue;
          try {
            os.put(rec);
            written++;
          } catch {
            /* одна битая запись не должна срывать остальные */
          }
        }
      } catch {
        /* ignore */
      }
    }
    await new Promise<void>(res => {
      tx.oncomplete = () => res();
      tx.onerror = () => res();
      tx.onabort = () => res();
    });
    return written;
  } catch {
    return written;
  } finally {
    try {
      database.close();
    } catch {
      /* ignore */
    }
  }
}

class HealthDB {
  private db: IDBDatabase | null = null;

  async init() {
    lastInitAttempts = 0;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= DB_INIT_MAX_ATTEMPTS; attempt++) {
      lastInitAttempts = attempt;
      try {
        await this.openOnce(attempt);
        dbReady = true;
        lastInitError = null;
        return;
      } catch (e) {
        lastErr = e;
        lastInitError = describeError(e);
        try {
          this.db?.close();
        } catch {
          /* ignore */
        }
        this.db = null;
        if (attempt < DB_INIT_MAX_ATTEMPTS) await delay(400 * attempt);
      }
    }
    dbReady = false;
    throw lastErr instanceof Error ? lastErr : new Error(lastInitError || 'IndexedDB init failed');
  }

  /** Одна попытка открытия. Бюджет одинаковый: повтор нужен из-за blocked/ошибки, а не из-за медленного старта. */
  private openOnce(attempt: number): Promise<void> {
    const budget = DB_INIT_ATTEMPT_TIMEOUT_MS;
    return new Promise<void>((res, rej) => {
      let r: IDBOpenDBRequest;
      try {
        r = indexedDB.open(dbNameFor(currentSpaceId()), DB_VERSION);
      } catch (e) {
        rej(e);
        return;
      }
      let settled = false;
      const done = (fn: () => void) => {
        if (!settled) {
          settled = true;
          fn();
        }
      };
      const timer = setTimeout(
        () => done(() => rej(new Error(`IndexedDB init timeout (попытка ${attempt}/${DB_INIT_MAX_ATTEMPTS})`))),
        budget,
      );
      const finish = (fn: () => void) => {
        clearTimeout(timer);
        done(fn);
      };
      r.onupgradeneeded = e => {
        try {
          applySchema((e.target as IDBOpenDBRequest).result, e);
        } catch {
          /* схема не создалась — init упадёт на следующем шаге и повторит попытку */
        }
      };
      r.onsuccess = () => {
        this.db = r.result;
        finish(() => res());
      };
      r.onerror = () => finish(() => rej(r.error || new Error('IndexedDB open error')));
      // blocked НЕ отклоняем: чужое соединение освободится само (частая
      // история на Huawei — WebView держит соединение после перезапуска
      // процесса). Если не освободится — отработает бюджет попытки.
      r.onblocked = () => {
        /* ждём освобождения соединения */
      };
    });
  }

  async put(store: StoreNames, data: any) {
    if (!this.db) throw new Error('DB not init');
    return new Promise<void>((res, rej) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).put(data);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async get<T>(store: StoreNames, id: string): Promise<T | undefined> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<T | undefined>((res, rej) => {
      const tx = this.db!.transaction(store, 'readonly');
      const r = tx.objectStore(store).get(id);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async getAll<T>(store: StoreNames): Promise<T[]> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<T[]>((res, rej) => {
      const tx = this.db!.transaction(store, 'readonly');
      const r = tx.objectStore(store).getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async delete(store: StoreNames, id: string) {
    if (!this.db) throw new Error('DB not init');
    return new Promise<void>((res, rej) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async getByIndex<K>(store: StoreNames, indexName: string, value: IDBValidKey): Promise<K[]> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<K[]>((res, rej) => {
      const tx = this.db!.transaction(store, 'readonly');
      const idx = tx.objectStore(store).index(indexName);
      const r = idx.getAll(value);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async getByDateRange<K>(store: StoreNames, startDate: string, endDate: string): Promise<K[]> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<K[]>((res, rej) => {
      const tx = this.db!.transaction(store, 'readonly');
      const idx = tx.objectStore(store).index('date');
      const range = IDBKeyRange.bound(startDate, endDate);
      const r = idx.getAll(range);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async clear(store: StoreNames): Promise<void> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<void>((res, rej) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  async count(store: StoreNames): Promise<number> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<number>((res, rej) => {
      const tx = this.db!.transaction(store, 'readonly');
      const r = tx.objectStore(store).count();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async update<K extends { id: string }>(store: StoreNames, data: Partial<K> & { id: string }): Promise<void> {
    if (!this.db) throw new Error('DB not init');
    return new Promise<void>((res, rej) => {
      const tx = this.db!.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      const getReq = os.get(data.id);
      getReq.onsuccess = () => {
        const existing = getReq.result || {};
        os.put({ ...existing, ...data });
      };
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
  /** Закрыть соединение (нужно перед удалением базы пространства). */
  close(): void {
    try {
      this.db?.close();
    } catch {
      /* ignore */
    }
    this.db = null;
    dbReady = false; // следующий доступ должен снова вызвать init()
  }
}

export const db = new HealthDB();

/**
 * Удалить базы IndexedDB указанных пространств (их дневники/анализы/фото).
 * Используется «удалить данные атлета» и полной очисткой: без этого данные
 * остались бы на диске после «всё удалено».
 */
export async function deleteSpaceDatabases(spaceIds: readonly string[]): Promise<void> {
  const ids = (spaceIds || []).filter(id => id && id !== 'home');
  if (!ids.length) return;
  // Закрываем соединение только если удаляем базу ТЕКУЩЕГО пространства:
  // закрывать рабочую базу из-за чужого атлета незачем (и это ломало бы запись).
  const current = currentSpaceId();
  if (ids.includes(current)) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
  // Фото веса живут в отдельной базе (по одной на пространство): без её удаления
  // «удалил его данные» оставило бы фотографии на диске.
  await Promise.all(ids.map(id => closeWeightPhotoDb(id).catch(() => undefined)));
  await Promise.all(
    ids.flatMap(id =>
      [dbNameFor(id), weightPhotoDbNameFor(id)].map(
        name =>
          new Promise<void>(resolve => {
            try {
              const req = indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve(); // другое окно держит базу — не подвешиваем UI
            } catch {
              resolve();
            }
          }),
      ),
    ),
  );
}

/**
 * Сколько записей в одной базе IndexedDB. `0` — базы нет (открытие создало бы
 * пустую, поэтому апгрейд прерывается), `null` — посчитать не удалось.
 */
function countDbRecords(dbName: string): Promise<number | null> {
  return new Promise<number | null>(resolve => {
    let settled = false;
    const done = (v: number | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    try {
      const req = indexedDB.open(dbName);
      req.onupgradeneeded = () => {
        // Базы ещё нет. Открытие без версии создало бы пустую — прерываем.
        try {
          req.transaction?.abort();
        } catch {
          /* ignore */
        }
        done(0);
      };
      req.onerror = () => done(0);
      req.onblocked = () => done(null);
      req.onsuccess = () => {
        const database = req.result;
        const close = () => {
          try {
            database.close();
          } catch {
            /* ignore */
          }
        };
        try {
          const stores = Array.from(database.objectStoreNames ?? []);
          if (!stores.length) {
            close();
            return done(0);
          }
          const tx = database.transaction(stores, 'readonly');
          let sum = 0;
          let failed = false;
          for (const name of stores) {
            try {
              const r = tx.objectStore(name).count();
              r.onsuccess = () => {
                if (typeof r.result === 'number') sum += r.result;
              };
              r.onerror = () => {
                failed = true;
              };
            } catch {
              failed = true;
            }
          }
          tx.oncomplete = () => {
            close();
            done(failed ? null : sum);
          };
          tx.onerror = () => {
            close();
            done(null);
          };
          tx.onabort = () => {
            close();
            done(null);
          };
        } catch {
          close();
          done(null);
        }
      };
    } catch {
      done(null);
    }
  });
}

/**
 * Сколько записей лежит в данных пространства (дневники тренировок, анализы,
 * фото веса). Нужно, чтобы «удалить данные атлета» показывало НАСТОЯЩИЙ объём:
 * `localStorage` этого атлета может быть почти пуст, а базы — на тысячи записей.
 *
 * Считаем ОБЕ базы: основную и отдельную базу фотографий веса. Иначе цифра
 * снова занижала бы то, что удаляется.
 */
export async function spaceDbRecordCount(spaceId: string): Promise<number | null> {
  const [main, photos] = await Promise.all([
    countDbRecords(dbNameFor(spaceId)),
    countDbRecords(weightPhotoDbNameFor(spaceId)),
  ]);
  if (main == null || photos == null) return null;
  return main + photos;
}

/**
 * Пространства, у которых на диске есть база.
 *
 * Зачем отдельно от реестра: запись реестра могла пропасть раньше (баг удаления
 * карточки убирал её, хотя в базе лежали дневники) — и тогда база становилась
 * невидимой: ни в списке атлетов, ни в «Данных без карточки», которые читают
 * реестр. Здесь мы смотрим на сам диск, а не на реестр.
 *
 * `indexedDB.databases()` есть не во всех средах (старый Safari, приватный
 * режим). Тогда возвращаем `null` — честное «проверить нельзя», а не пустой
 * список, который читался бы как «баз нет».
 */
export async function listSpaceDatabaseIds(): Promise<string[] | null> {
  try {
    const factory =
      typeof indexedDB !== 'undefined'
        ? (indexedDB as IDBFactory & { databases?: () => Promise<Array<{ name?: string }>> })
        : null;
    if (!factory || typeof factory.databases !== 'function') return null;
    const list = await factory.databases();
    if (!Array.isArray(list)) return null;
    const prefixes = [`${DB_NAME}__`, `${weightPhotoDbNameFor(HOME_SPACE_ID)}__`];
    const out = new Set<string>();
    for (const item of list) {
      const name = item && typeof item.name === 'string' ? item.name : '';
      if (!name) continue;
      for (const prefix of prefixes) {
        if (name.startsWith(prefix) && name.length > prefix.length) out.add(name.slice(prefix.length));
      }
    }
    return [...out];
  } catch {
    return null;
  }
}

/**
 * Удалить базу фотографий веса пространства (в т.ч. домашнего — при полном
 * сбросе). Отдельная функция: домашнюю ОСНОВНУЮ базу удалять нельзя, а фото
 * при «удалить все данные» должны уйти так же, как дневники.
 */
export async function deleteWeightPhotoDatabase(spaceId: string): Promise<void> {
  await closeWeightPhotoDb(spaceId).catch(() => undefined);
  await new Promise<void>(resolve => {
    try {
      const req = indexedDB.deleteDatabase(weightPhotoDbNameFor(spaceId));
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Удалить базы ВСЕХ пространств (аварийный сброс). Синхронная: вызывается из
 * обработчиков кнопок, где ждать нечего.
 */export function deleteAllDatabasesSync(): void {
  let spaces: string[] = [];
  try {
    spaces = parseRegistry(localStorage.getItem(DATA_SPACE_KEY)).spaces.map(s => s.id);
  } catch {
    spaces = []; // реестр недоступен — хотя бы домашнюю базу
  }
  const targets = new Set<string>([HOME_SPACE_ID, ...spaces]);
  for (const id of targets) {
    try {
      indexedDB.deleteDatabase(dbNameFor(id));
    } catch {
      /* ignore */
    }
    try {
      indexedDB.deleteDatabase(weightPhotoDbNameFor(id));
    } catch {
      /* ignore */
    }
  }
}

export type { StoreNames };