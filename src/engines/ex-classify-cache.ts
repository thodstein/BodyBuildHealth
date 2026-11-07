/**
 * ex-classify-cache.ts — кэш чистых классификаторов упражнений.
 *
 * ЗАМЕР (2026-11-07, `bench-build.ts`, CPU-профиль `buildBBPlan`):
 *   generic 8 недель — ~700 мс, enhanced 12 недель — ~1.5 с.
 * Профиль self-time: `trueMuscleOf` 500 мс, `sfrOf` 176 мс,
 * `isCarryExercise` 141 мс, `bbExerciseTier` 101 мс, плюс ~430 мс внутри
 * самих RegExp. Это не «тяжёлая математика», а повторный разбор ОДНИХ И ТЕХ ЖЕ
 * названий каталога (500+ упражнений × десятки проходов сборки).
 *
 * Все эти функции — чистые: от одного и того же упражнения ответ не меняется.
 * Поэтому считаем один раз на набор значимых полей. Ключ строится из полей,
 * которые реально читают классификаторы, — если билдер поменяет `muscle`/`role`
 * у копии упражнения, кэш не «залипнет» на старом ответе.
 *
 * Ограничение размера: каталог статичен, ключей ~несколько тысяч; при выходе за
 * MAX_ENTRIES кэш просто очищается (страховка от утечки в долгой сессии).
 */

/** Поля, от которых зависят классификаторы (movement-pattern / SFR / tier). */
const SIGNIFICANT_FIELDS = [
  'id',
  'name',
  'movementPattern',
  'targetMuscle',
  'group',
  'muscle',
  'type',
  'equipment',
  'difficulty',
  'substitutionGroup',
  'movementType',
  'jointStress',
] as const;

/**
 * Поля, которые реально читает каждый классификатор. Короткий ключ =
 * быстрее хеширование и никакого «перекэша» от полей, которые не влияют
 * на ответ (например, `equipment` для определения паттерна).
 */
const SLOT_FIELDS: Record<string, readonly (typeof SIGNIFICANT_FIELDS)[number][]> = {
  bodyweight: ['name', 'type', 'equipment'],
  carry: ['name'],
  pattern: ['name', 'group', 'targetMuscle', 'type', 'muscle'],
  trueMuscle: ['name', 'movementPattern', 'targetMuscle', 'group', 'type', 'muscle'],
  sfr: ['id', 'name'],
  tier: ['id', 'name', 'equipment', 'difficulty', 'substitutionGroup', 'movementType', 'jointStress'],
};

const MAX_ENTRIES = 30000;
const SEP = '\u0001';
const cache = new Map<string, unknown>();

/**
 * Счётчики для ратчет-теста: сколько раз классификатор реально считался.
 * До кэша одна сборка плана давала ~1.1 млн вызовов (несколько секунд).
 */
const stats = { hits: 0, misses: 0 };

/** Только для тестов: снимок счётчиков вычислений/попаданий. */
export function getClassificationStats(): { hits: number; misses: number } {
  return { hits: stats.hits, misses: stats.misses };
}

/** Только для тестов: сброс счётчиков. */
export function resetClassificationStats(): void {
  stats.hits = 0;
  stats.misses = 0;
}

/** Стабильный ключ упражнения по значимым полям. */
export function exKey(ex: any, extra = ''): string {
  if (!ex || typeof ex !== 'object') return `v${SEP}${String(ex)}${SEP}${extra}`;
  let key = '';
  for (const f of SIGNIFICANT_FIELDS) {
    const v = ex[f];
    key += (v == null ? '' : Array.isArray(v) ? v.join(',') : typeof v === 'object' ? JSON.stringify(v) : String(v)) + SEP;
  }
  return key + extra;
}

/**
 * Вернуть закэшированный результат чистой функции классификации.
 * `slot` разделяет пространства имён (например, `'trueMuscle'`, `'tier'`).
 */
export function cachedClassification<T>(slot: string, ex: any, compute: (ex: any) => T): T {
  const fields = SLOT_FIELDS[slot];
  let key = slot + SEP;
  if (!ex || typeof ex !== 'object') {
    key += 'v' + SEP + String(ex);
  } else if (fields) {
    for (const f of fields) {
      const v = ex[f];
      key += (v == null ? '' : Array.isArray(v) ? v.join(',') : typeof v === 'object' ? JSON.stringify(v) : String(v)) + SEP;
    }
  } else {
    key += exKey(ex);
  }
  const hit = cache.get(key);
  if (hit !== undefined) { stats.hits++; return hit as T; }
  stats.misses++;
  const value = compute(ex);
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(key, value);
  return value;
}

/** Только для тестов: сброс кэша. */
export function clearClassificationCache(): void {
  cache.clear();
}
