/**
 * coach-program-bundle.engine.ts — программа как объект тренера.
 *
 * ЗАЧЕМ. До этого программа жила только внутри пространства атлета: чтобы выдать
 * тот же блок второму человеку, тренер заново проходил конструктор. Здесь программа
 * становится переносимым набором СЫРЫХ значений ключей (как `pl-backup.engine.ts`):
 *
 *   • не пересчитываем и не переписываем формат — копируем байты;
 *   • поэтому раскладки `LMS_CYCLES` и версии движков не затрагиваются;
 *   • проверяем ровно то, что можем проверить честно: размер и «это JSON».
 *
 * ГРАНИЦА. Это НЕ выборка «всей программы»: сюда входят только ключи планирования
 * (макроциклы, готовые программы, избранное, цели, годовой план). Дневники,
 * анализы, вес и фото — данные человека, их переносить нельзя.
 */
import { toPhysicalKey } from '../../core/data-space';
import { MANUAL_STORAGE_KEYS } from '../manual-constructor/manual-storage';

export const PROGRAM_BUNDLE_KIND = 'coach-program';
export const PROGRAM_BUNDLE_VERSION = 1;
/** Потолок одного файла/шаблона: 4 МБ — больше localStorage не увезёт. */
export const PROGRAM_BUNDLE_MAX_CHARS = 4_000_000;
/** Потолок одного значения (как у PL-бэкапа: 1.5 МБ на ключ). */
export const PROGRAM_KEY_MAX_CHARS = 1_500_000;

/**
 * Что считается программой. Порядок = порядок показа в выписке.
 * Ключи берём из реестра `manual-storage`, чтобы не дублировать строки.
 */
export const PROGRAM_KEYS = [
  MANUAL_STORAGE_KEYS.PL_MACRO,
  MANUAL_STORAGE_KEYS.BB_MACRO,
  MANUAL_STORAGE_KEYS.MACROCYCLE_DESIGNS,
  MANUAL_STORAGE_KEYS.USER_PROGRAMS,
  MANUAL_STORAGE_KEYS.PROGRAM_FAV,
  MANUAL_STORAGE_KEYS.CYCLE_FAV,
  MANUAL_STORAGE_KEYS.PL_RUNTIME,
  MANUAL_STORAGE_KEYS.ANNUAL_TRAINING_PLAN,
  MANUAL_STORAGE_KEYS.TRAINING_GOALS,
] as const;

export type ProgramKey = (typeof PROGRAM_KEYS)[number];

export const PROGRAM_KEY_LABELS: Record<ProgramKey, string> = {
  [MANUAL_STORAGE_KEYS.PL_MACRO]: 'Макроцикл пауэрлифтинга',
  [MANUAL_STORAGE_KEYS.BB_MACRO]: 'Макроцикл бодибилдинга',
  [MANUAL_STORAGE_KEYS.MACROCYCLE_DESIGNS]: 'Сохранённые макроциклы',
  [MANUAL_STORAGE_KEYS.USER_PROGRAMS]: 'Готовые программы',
  [MANUAL_STORAGE_KEYS.PROGRAM_FAV]: 'Избранные программы',
  [MANUAL_STORAGE_KEYS.CYCLE_FAV]: 'Избранные циклы',
  [MANUAL_STORAGE_KEYS.PL_RUNTIME]: 'Текущий блок',
  [MANUAL_STORAGE_KEYS.ANNUAL_TRAINING_PLAN]: 'Годовой план',
  [MANUAL_STORAGE_KEYS.TRAINING_GOALS]: 'Цели тренировок',
};

export interface CoachProgramBundle {
  app: 'bodybuildhealth';
  kind: typeof PROGRAM_BUNDLE_KIND;
  version: typeof PROGRAM_BUNDLE_VERSION;
  createdAt: string;
  /** Только для читаемости файла; на применение не влияет. */
  name?: string;
  /** Пространство, откуда сняли программу (диагностика, не секрет). */
  sourceSpaceId?: string;
  keys: Partial<Record<ProgramKey, string>>;
}

export type ProgramBundleError = 'not-object' | 'kind' | 'version' | 'empty' | 'size' | 'value' | null;

export interface ProgramBundleParse {
  bundle: CoachProgramBundle | null;
  error: ProgramBundleError;
}

export interface ProgramStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const isProgramKey = (k: string): k is ProgramKey => (PROGRAM_KEYS as readonly string[]).includes(k);

/** Собрать программу пространства. Пустые ключи не попадают в набор. */
export function collectProgramBundle(
  storage: ProgramStorageLike | null | undefined,
  spaceId: string,
  opts: { createdAt?: string; name?: string } = {},
): CoachProgramBundle {
  const keys: Partial<Record<ProgramKey, string>> = {};
  if (storage) {
    for (const key of PROGRAM_KEYS) {
      try {
        const raw = storage.getItem(toPhysicalKey(spaceId, key));
        if (typeof raw === 'string' && raw.length) keys[key] = raw;
      } catch {
        /* один недоступный ключ не должен ломать выписку */
      }
    }
  }
  return {
    app: 'bodybuildhealth',
    kind: PROGRAM_BUNDLE_KIND,
    version: PROGRAM_BUNDLE_VERSION,
    createdAt: opts.createdAt ?? new Date().toISOString(),
    ...(opts.name ? { name: opts.name } : {}),
    sourceSpaceId: spaceId,
    keys,
  };
}

/** Проверить bundle из файла/шаблона. Ничего не пишет. */
export function normalizeProgramBundle(value: unknown): ProgramBundleParse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { bundle: null, error: 'not-object' };
  const obj = value as Record<string, unknown>;
  if (obj.app !== 'bodybuildhealth' || obj.kind !== PROGRAM_BUNDLE_KIND) return { bundle: null, error: 'kind' };
  if (obj.version !== PROGRAM_BUNDLE_VERSION) return { bundle: null, error: 'version' };
  const rawKeys = obj.keys;
  if (!rawKeys || typeof rawKeys !== 'object' || Array.isArray(rawKeys)) return { bundle: null, error: 'value' };
  const keys: Partial<Record<ProgramKey, string>> = {};
  let total = 0;
  for (const [k, v] of Object.entries(rawKeys as Record<string, unknown>)) {
    if (!isProgramKey(k)) continue;
    if (typeof v !== 'string' || !v.length) return { bundle: null, error: 'value' };
    if (v.length > PROGRAM_KEY_MAX_CHARS) return { bundle: null, error: 'size' };
    try {
      JSON.parse(v);
    } catch {
      // Битое значение не должно попасть в пространство атлета: движки его
      // «терпимо» проигнорируют, а тренер будет думать, что программа выдана.
      return { bundle: null, error: 'value' };
    }
    total += v.length;
    if (total > PROGRAM_BUNDLE_MAX_CHARS) return { bundle: null, error: 'size' };
    keys[k] = v;
  }
  if (!Object.keys(keys).length) return { bundle: null, error: 'empty' };
  return {
    bundle: {
      app: 'bodybuildhealth',
      kind: PROGRAM_BUNDLE_KIND,
      version: PROGRAM_BUNDLE_VERSION,
      createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : '',
      ...(typeof obj.name === 'string' && obj.name ? { name: obj.name } : {}),
      ...(typeof obj.sourceSpaceId === 'string' && obj.sourceSpaceId ? { sourceSpaceId: obj.sourceSpaceId } : {}),
      keys,
    },
    error: null,
  };
}

export interface ProgramBundleSummary {
  keys: number;
  chars: number;
  /** Что именно внутри — чтобы тренер видел, а не верил названию. */
  parts: string[];
}

export function describeProgramBundle(bundle: CoachProgramBundle): ProgramBundleSummary {
  const present = PROGRAM_KEYS.filter(k => typeof bundle.keys[k] === 'string' && bundle.keys[k]);
  let chars = 0;
  for (const k of present) chars += (bundle.keys[k] ?? '').length;
  return {
    keys: present.length,
    chars,
    parts: present.map(k => PROGRAM_KEY_LABELS[k]),
  };
}

export type ProgramApplyMode = 'replace' | 'merge';

export interface ProgramApplyResult {
  written: number;
  removed: number;
  error: 'empty' | 'invalid' | 'storage' | null;
}

/**
 * Записать программу в пространство атлета.
 *
 * `replace` (по умолчанию) сначала снимает ВСЕ программные ключи пространства:
 * иначе остался бы «хвост» старого блока и дни двух программ смешались бы.
 * Пишем через переданное хранилище (в приложении — шов), поэтому синхронизация
 * видит правку и ставит надгробия на удалённые ключи.
 */
export function applyProgramBundle(
  storage: ProgramStorageLike | null | undefined,
  spaceId: string,
  value: unknown,
  opts: { mode?: ProgramApplyMode } = {},
): ProgramApplyResult {
  if (!storage) return { written: 0, removed: 0, error: 'storage' };
  const parsed = normalizeProgramBundle(value);
  if (!parsed.bundle) {
    return { written: 0, removed: 0, error: parsed.error === 'empty' ? 'empty' : 'invalid' };
  }
  const bundle = parsed.bundle;
  const mode = opts.mode ?? 'replace';
  let removed = 0;
  if (mode === 'replace') {
    for (const key of PROGRAM_KEYS) {
      if (bundle.keys[key]) continue;
      const physical = toPhysicalKey(spaceId, key);
      try {
        if (storage.getItem(physical) !== null) {
          storage.removeItem(physical);
          removed++;
        }
      } catch {
        return { written: 0, removed, error: 'storage' };
      }
    }
  }
  let written = 0;
  for (const key of PROGRAM_KEYS) {
    const raw = bundle.keys[key];
    if (!raw) continue;
    try {
      storage.setItem(toPhysicalKey(spaceId, key), raw);
      written++;
    } catch {
      // Частичная запись честно сообщается как ошибка: тренер повторит или
      // выберет другого атлета, а не будет думать, что всё хорошо.
      return { written, removed, error: 'storage' };
    }
  }
  return { written, removed, error: null };
}

/** Понятное человеку сообщение об ошибке формата. */
export function programBundleErrorText(error: ProgramBundleError): string {
  switch (error) {
    case 'not-object':
      return 'Это не файл программы.';
    case 'kind':
      return 'Файл другого типа: нужна программа тренера.';
    case 'version':
      return 'Файл сделан другой версией приложения — обновите его.';
    case 'empty':
      return 'В программе нет ни одного плана.';
    case 'size':
      return 'Программа слишком большая, чтобы её сохранить.';
    case 'value':
      return 'Внутри программы битые данные — выдача отменена.';
    default:
      return '';
  }
}
