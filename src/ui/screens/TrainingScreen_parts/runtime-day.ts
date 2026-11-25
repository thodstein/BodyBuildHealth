/**
 * runtime-day.ts — ручной выбор «дня плана» на экране «Тренировка».
 *
 * `he_runtime_day` хранит НЕ день недели, а индекс в списке тренировочных дней
 * микроцикла: `0` — первый тренировочный день, `1` — второй и так далее
 * (`ExecutionZone` фильтрует `currentMicrocycle.days` по `isTraining`). Поэтому
 * индекс зависит от плана: после смены плана с другим числом тренировочных дней
 * то же число указывает на другой день, а индекс за пределами списка клампится
 * через `resolveRuntimeDayIndex`. Календарный день недели нигде не хранится.
 *
 * До правки якоря дня плана дефолт был `1`, и ключ писался в localStorage при
 * первом же рендере — то есть у всех существующих установок там лежит `1`, даже
 * если пользователь день не выбирал. Новый дефолт `0` такие установки не
 * меняет: без миграции человек продолжал видеть «второй день плана», а плеер и
 * виджет уже считали день от якоря плана.
 *
 * Миграция одноразовая: пока нет флага `he_runtime_day_migrated`, значение `1`
 * считается унаследованным дефолтом и приводится к `0`. Точная цена: старый ключ
 * не хранил признака «выбрано пользователем», поэтому осознанный выбор второго
 * дня, сделанный до миграции, тоже один раз сбрасывается на первый. После
 * флага миграции любые записанные значения (включая `1`) не трогаются.
 */

export const RUNTIME_DAY_KEY = 'he_runtime_day';
export const RUNTIME_DAY_MIGRATED_KEY = 'he_runtime_day_migrated';

function clampDay(value: unknown): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? Math.max(0, Math.min(6, n)) : 0;
}

function parseStoredDay(raw: string | null): number {
  if (raw == null || raw === '') return 0;
  try {
    return clampDay(JSON.parse(raw));
  } catch {
    // Ключ могли записать не через JSON.stringify — читаем как число.
    return clampDay(raw);
  }
}

/**
 * Прочитать выбранный день, одноразово сняв унаследованный дефолт `1`.
 * Ничего не бросает: приватный режим/квота — работаем на значении по умолчанию.
 */
export function readRuntimeDay(): number {
  let raw: string | null;
  let migrated: boolean;
  try {
    raw = localStorage.getItem(RUNTIME_DAY_KEY);
    migrated = localStorage.getItem(RUNTIME_DAY_MIGRATED_KEY) === '1';
  } catch {
    return 0;
  }
  const stored = parseStoredDay(raw);
  if (migrated) return stored;
  const next = stored === 1 ? 0 : stored;
  // Сначала значение, потом флаг: если запись значения не легла (квота/приватный
  // режим), флаг ставить нельзя — иначе миграция больше не повторится и унаследованная
  // единица останется навсегда. Возвращаем прочитанное, а не выдуманный 0.
  if (next !== stored) {
    try {
      localStorage.setItem(RUNTIME_DAY_KEY, JSON.stringify(next));
    } catch {
      return stored;
    }
  }
  try {
    localStorage.setItem(RUNTIME_DAY_MIGRATED_KEY, '1');
  } catch {
    /* флаг не лёг: значение уже мигрировано, следующее чтение повторит миграцию безвредно */
  }
  return next;
}

/**
 * Записать выбор дня (0…6). Возвращает клампленное значение: при провале записи
 * (приватный режим/квота) оно живёт только в состоянии экрана — про успех записи
 * функция не сообщает.
 */
export function writeRuntimeDay(day: number): number {
  const next = clampDay(day);
  try {
    localStorage.setItem(RUNTIME_DAY_KEY, JSON.stringify(next));
    localStorage.setItem(RUNTIME_DAY_MIGRATED_KEY, '1');
  } catch {
    /* приватный режим: выбор живёт только в состоянии экрана */
  }
  return next;
}

/**
 * Привести сохранённый индекс к реальному списку тренировочных дней.
 *
 * Индекс зависит от плана, поэтому после смены плана сохранённое число может
 * указывать за пределы списка (или список окажется пустым). Возвращаем валидный
 * индекс: 0 для пустого списка и клампинг последним днём иначе.
 */
export function resolveRuntimeDayIndex(stored: number, trainingDaysCount: number): number {
  const count = Math.max(0, Math.trunc(Number(trainingDaysCount) || 0));
  if (count === 0) return 0;
  const n = Math.trunc(Number(stored));
  return Number.isFinite(n) ? Math.max(0, Math.min(n, count - 1)) : 0;
}
