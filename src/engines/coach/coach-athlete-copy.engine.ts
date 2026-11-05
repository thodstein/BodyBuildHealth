/**
 * coach-athlete-copy.engine.ts — «копия одного атлета» одним файлом.
 *
 * ЗАЧЕМ. Бэкап всего приложения — это всё и сразу. Тренеру же часто нужно
 * передать/перенести ОДНОГО человека: отдать коллеге, восстановить после смены
 * телефона, снять слепок перед правкой программы.
 *
 * ЧТО ВНУТРИ: только данные этого пространства —
 *  • настройки/планы/дневники из localStorage (без префикса пространства:
 *    при восстановлении они лягут в НОВОЕ пространство, а не в чужое);
 *  • записи IndexedDB (тренировки, анализы, дневники, фото-записи).
 * Чего нет: облачных токенов, паролей, PIN, настроек устройства тренера и
 * библиотеки программ — они не принадлежат атлету.
 *
 * ЧЕСТНЫЕ ГРАНИЦЫ:
 *  • потолок 4 МБ: файл таскают через мессенджеры, гигантские копии там ломаются,
 *    а молча обрезать чужие данные нельзя — возвращаем `size` с объяснением;
 *  • фото веса — отдельная IndexedDB и в копию НЕ входят (как и в облако):
 *    об этом сказано в UI, а не «всё перенесено»;
 *  • восстановление всегда в НОВОЕ пространство: пустое или явно выбранное,
 *    потому что затирать существующего атлета копией — это потеря данных.
 */
import { spaceKeyPrefix, toPhysicalKey } from '../../core/data-space';

export const ATHLETE_COPY_KIND = 'coach-athlete-copy';
export const ATHLETE_COPY_VERSION = 1;
export const ATHLETE_COPY_MAX_BYTES = 4 * 1024 * 1024;
/** Технические потолки количества: защита от мусорных/враждебных файлов. */
const MAX_KEYS = 400;
const MAX_STORE_RECORDS = 200_000;

export interface AthleteCopy {
  app: 'bodybuildhealth';
  kind: typeof ATHLETE_COPY_KIND;
  version: typeof ATHLETE_COPY_VERSION;
  createdAt: string;
  /** Подпись для человека: имя атлета на момент копии. */
  label: string;
  /** Логические ключи (без `he_ath_<space>__`). */
  keys: Record<string, string>;
  /** Записи IndexedDB по хранилищам. */
  stores: Record<string, unknown[]>;
}

export type AthleteCopyError = 'not-object' | 'kind' | 'version' | 'size' | 'empty' | null;

export interface AthleteCopyParse {
  copy: AthleteCopy | null;
  error: AthleteCopyError;
}

export interface StorageLike {
  readonly length: number;
  key(i: number): string | null;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

export function collectAthleteCopy(input: {
  storage: StorageLike;
  spaceId: string;
  stores: Record<string, unknown[]>;
  label: string;
  createdAt?: string;
}): { copy: AthleteCopy; bytes: number } {
  const prefix = spaceKeyPrefix(input.spaceId);
  const keys: Record<string, string> = {};
  for (let i = 0; i < input.storage.length; i++) {
    const name = input.storage.key(i);
    if (!name || !name.startsWith(prefix)) continue;
    const logical = name.slice(prefix.length);
    // Служебные записи реестра/облака внутри пространства не копируем.
    if (!logical || logical.startsWith('he_sync_')) continue;
    const raw = input.storage.getItem(name);
    // Настройки без значения — не данные, а «ключ был когда-то»; не таскаем.
    if (raw == null) continue;
    keys[logical] = raw;
    if (Object.keys(keys).length >= MAX_KEYS) break;
  }

  const stores: Record<string, unknown[]> = {};
  for (const [name, rows] of Object.entries(input.stores ?? {})) {
    if (!Array.isArray(rows) || !rows.length) continue;
    stores[name] = rows;
  }

  const copy: AthleteCopy = {
    app: 'bodybuildhealth',
    kind: ATHLETE_COPY_KIND,
    version: ATHLETE_COPY_VERSION,
    createdAt: input.createdAt ?? new Date().toISOString(),
    label: String(input.label ?? '').slice(0, 120),
    keys,
    stores,
  };
  return { copy, bytes: byteLength(JSON.stringify(copy)) };
}

export function byteLength(text: string): number {
  // В браузере есть TextEncoder; в тестах — тоже. Фолбэк — грубая оценка.
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    return text.length * 2;
  }
}

export function normalizeAthleteCopy(value: unknown): AthleteCopyParse {
  if (!isObject(value)) return { copy: null, error: 'not-object' };
  if (value.app !== 'bodybuildhealth') return { copy: null, error: 'kind' };
  if (value.kind !== ATHLETE_COPY_KIND) return { copy: null, error: 'kind' };
  if (value.version !== ATHLETE_COPY_VERSION) return { copy: null, error: 'version' };

  const keys: Record<string, string> = {};
  if (value.keys != null) {
    if (!isObject(value.keys)) return { copy: null, error: 'empty' };
    let n = 0;
    for (const [k, v] of Object.entries(value.keys)) {
      if (typeof v !== 'string') return { copy: null, error: 'empty' };
      if (!k || k.startsWith('he_sync_')) continue;
      keys[k] = v;
      if (++n >= MAX_KEYS) break;
    }
  }

  const stores: Record<string, unknown[]> = {};
  if (value.stores != null) {
    if (!isObject(value.stores)) return { copy: null, error: 'empty' };
    let total = 0;
    for (const [name, rows] of Object.entries(value.stores)) {
      if (!Array.isArray(rows)) continue;
      total += rows.length;
      if (total > MAX_STORE_RECORDS) return { copy: null, error: 'size' };
      stores[name] = rows;
    }
  }

  if (!Object.keys(keys).length && !Object.keys(stores).length) return { copy: null, error: 'empty' };

  const copy: AthleteCopy = {
    app: 'bodybuildhealth',
    kind: ATHLETE_COPY_KIND,
    version: ATHLETE_COPY_VERSION,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    label: typeof value.label === 'string' ? value.label.slice(0, 120) : '',
    keys,
    stores,
  };
  if (byteLength(JSON.stringify(copy)) > ATHLETE_COPY_MAX_BYTES) {
    return { copy: null, error: 'size' };
  }
  return { copy, error: null };
}

export function athleteCopyErrorText(error: AthleteCopyError): string {
  switch (error) {
    case 'not-object':
      return 'Файл не похож на копию атлета: внутри не JSON-объект.';
    case 'kind':
      return 'Это не копия атлета из BodyBuildHealth.';
    case 'version':
      return 'Копия сделана другой версией приложения — обновите приложение и попробуйте снова.';
    case 'size':
      return 'Копия слишком большая (больше 4 МБ) — перенесите данные бэкапом приложения.';
    case 'empty':
      return 'В копии нет данных: ни настроек, ни записей.';
    default:
      return '';
  }
}

/** Записать настройки/планы копии в пространство (физическими ключами). */
export function applyAthleteCopyKeys(
  storage: Pick<StorageLike, 'setItem'>,
  spaceId: string,
  copy: AthleteCopy,
): number {
  let written = 0;
  for (const [logical, raw] of Object.entries(copy.keys)) {
    try {
      storage.setItem(toPhysicalKey(spaceId, logical), raw);
      written++;
    } catch {
      /* переполнение: остальное всё равно пробуем записать */
    }
  }
  return written;
}

/** Счётчики копии для честной подписи «сколько переносим». */
export function describeAthleteCopy(copy: AthleteCopy): { keys: number; records: number; stores: number } {
  const records = Object.values(copy.stores).reduce((sum, rows) => sum + rows.length, 0);
  return { keys: Object.keys(copy.keys).length, records, stores: Object.keys(copy.stores).length };
}
