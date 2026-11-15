/**
 * coach-course-store.ts — запись выданного курса в базу пространства атлета.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ. Курс живёт не в localStorage, а в IndexedDB
 * (`course_log`), причём в базе КОНКРЕТНОГО пространства: у каждого атлета она
 * своя (`HealthEngineDB_v3__<space>`). Поэтому «выдать курс» — это транзакция в
 * чужой базе, а не копирование ключа.
 *
 * ПОЧЕМУ ЗДЕСЬ, А НЕ В КАРТОЧКЕ. Вкладка тренера не имеет права тянуть базу в
 * свой статический граф (есть страж `coach-tab-imports-guard`). Модуль грузится
 * по нажатию «Выдать» и тянет базу через ленивый шов `core/lazy-db`.
 *
 * ГРАНИЦЫ (это главное):
 *  • удаляем ТОЛЬКО строки с префиксом `coach_course_` — то есть выданное
 *    тренером; строки, которые атлет создал сам, остаются как были;
 *  • если база пространства не открылась, возвращаем ошибку, а не «ок»: иначе
 *    тренер решит, что курс выдан;
 *  • ничего не считаем и не проверяем медицински — это чужие данные, мы их
 *    только перекладываем.
 */
import { loadDb } from '../../core/lazy-db';
import { COACH_COURSE_ID_PREFIX, type CoachCourseRow } from './coach-course.engine';

export type CoachCourseStoreError = 'db' | 'write' | null;

export interface CoachCourseWriteResult {
  ok: boolean;
  /** Сколько строк тренера записано. */
  written: number;
  /** Сколько прежних строк тренера снято. */
  removed: number;
  error: CoachCourseStoreError;
}

const STORE = 'course_log';

const isCoachRow = (value: unknown): boolean =>
  typeof value === 'string' && value.startsWith(COACH_COURSE_ID_PREFIX);

/**
 * Прочитать курс атлета (все строки `course_log` его пространства).
 * Ошибки не бросают: нет базы — значит нет и курса.
 */
export async function readCourseRows(spaceId: string): Promise<Record<string, unknown>[]> {
  if (!spaceId) return [];
  try {
    const db = await loadDb();
    const database = await db.openSpaceDb(spaceId, false);
    if (!database) return [];
    try {
      if (!database.objectStoreNames.contains(STORE)) return [];
      return await new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const tx = database.transaction([STORE], 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => {
          const rows = Array.isArray(req.result) ? req.result : [];
          resolve(rows.filter((r: unknown) => !!r && typeof r === 'object') as Record<string, unknown>[]);
        };
        req.onerror = () => reject(req.error);
      });
    } finally {
      try {
        database.close();
      } catch {
        /* закрытие не влияет на результат */
      }
    }
  } catch {
    return [];
  }
}

/**
 * Заменить выданный тренером курс: снять прежние строки `coach_course_*` и
 * записать новые. Строки атлета не трогаются.
 */
export async function writeCoachCourse(
  spaceId: string,
  rows: readonly CoachCourseRow[],
): Promise<CoachCourseWriteResult> {
  const fail = (error: CoachCourseStoreError): CoachCourseWriteResult => ({
    ok: false,
    written: 0,
    removed: 0,
    error,
  });
  if (!spaceId) return fail('db');
  let database: IDBDatabase | null = null;
  try {
    const db = await loadDb();
    database = await db.openSpaceDb(spaceId, true);
  } catch {
    return fail('db');
  }
  if (!database) return fail('db');
  const opened = database;
  try {
    if (!opened.objectStoreNames.contains(STORE)) return fail('write');
    return await new Promise<CoachCourseWriteResult>(resolve => {
      let removed = 0;
      let written = 0;
      let settled = false;
      const finish = (result: CoachCourseWriteResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      let tx: IDBTransaction;
      try {
        tx = opened.transaction([STORE], 'readwrite');
      } catch {
        finish(fail('write'));
        return;
      }
      const store = tx.objectStore(STORE);

      // 1. Снять прежние строки тренера (курсор, чтобы не знать их id заранее).
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          // 2. Записать новый план в той же транзакции: либо всё, либо ничего.
          for (const row of rows) {
            try {
              const putReq = store.put(row);
              putReq.onsuccess = () => {
                written++;
              };
            } catch {
              /* ошибка транзакции обработается в onerror */
            }
          }
          return;
        }
        if (isCoachRow(cursor.primaryKey)) {
          try {
            cursor.delete();
            removed++;
          } catch {
            /* см. onerror */
          }
        }
        cursor.continue();
      };
      cursorReq.onerror = () => finish(fail('write'));
      tx.oncomplete = () => finish({ ok: true, written, removed, error: null });
      tx.onerror = () => finish({ ok: false, written, removed, error: 'write' });
      tx.onabort = () => finish({ ok: false, written, removed, error: 'write' });
    });
  } finally {
    try {
      opened.close();
    } catch {
      /* закрытие не влияет на результат */
    }
  }
}

export function coachCourseStoreErrorText(error: CoachCourseStoreError): string {
  switch (error) {
    case 'db':
      return 'Не удалось открыть базу атлета — курс не записан.';
    case 'write':
      return 'База атлета не приняла запись — курс не выдан.';
    default:
      return '';
  }
}
