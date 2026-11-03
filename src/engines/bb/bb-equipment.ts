/**
 * bb-equipment.ts — нормализация списка оборудования на входе движка.
 *
 * Каталог упражнений (`EXERCISE_CATALOG`) использует ЕДИНСТВЕННОЕ число:
 * `barbell`, `dumbbell`, `cable`, `machine`, `plate`, `band`, `kettlebell`,
 * `bodyweight`, `smith`, `suspension`, `rope`, `other`.
 *
 * А интерфейсы/сохранённые профили исторически присылают множественное число и
 * свои имена: `bb-step-params.tsx` отдаёт `bands`, старые профили — `dumbbells`,
 * импорт — `bands_resistance` и т.п. Фильтр пула сравнивает строки ТОЧНО
 * (`opts.equipmentList.includes(eq)`), поэтому «Резинки» у пользователя не
 * находили ни одного упражнения с резинкой — выбор молча игнорировался, а при
 * единственном таком снаряде пул мышцы становился пустым.
 *
 * Модуль листовой (без импортов), чтобы его можно было использовать и в
 * билдере, и в валидаторе.
 */

/** Синонимы/опечатки → каноническое имя каталога. */
const EQUIPMENT_ALIASES: Record<string, string> = {
  barbell: 'barbell',
  barbells: 'barbell',
  'штанга': 'barbell',
  dumbbell: 'dumbbell',
  dumbbells: 'dumbbell',
  'гантели': 'dumbbell',
  'гантель': 'dumbbell',
  cable: 'cable',
  cables: 'cable',
  'блок': 'cable',
  machine: 'machine',
  machines: 'machine',
  'тренажер': 'machine',
  'тренажёр': 'machine',
  plate: 'plate',
  plates: 'plate',
  band: 'band',
  bands: 'band',
  bands_resistance: 'band',
  resistance_band: 'band',
  'резинки': 'band',
  'резинка': 'band',
  kettlebell: 'kettlebell',
  kettlebells: 'kettlebell',
  'гири': 'kettlebell',
  bodyweight: 'bodyweight',
  'body weight': 'bodyweight',
  bw: 'bodyweight',
  'свой вес': 'bodyweight',
  smith: 'smith',
  'smith machine': 'smith',
  smith_machine: 'smith',
  suspension: 'suspension',
  trx: 'suspension',
  rope: 'rope',
  rope_machine: 'rope',
  other: 'other',
};

/**
 * Приводит список к именам каталога: нижний регистр, алиасы, дедуп, пустые
 * значения выброшены. Неизвестные значения сохраняются как есть — так поведение
 * для них не меняется (они просто ни с чем не совпадут), но и не теряются
 * молча из диагностики.
 */
export function normalizeEquipmentIds(list: readonly string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of list || []) {
    const key = String(raw ?? '').trim().toLowerCase();
    if (!key) continue;
    const id = EQUIPMENT_ALIASES[key] || key;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** Быстрая проверка «снаряд пользователя поддерживает упражнение».
 *  Пустой список = без ограничений. `bodyweight` разрешён всегда. */
export function equipmentAllows(
  userEquipment: readonly string[],
  exerciseEquipment: string | readonly string[] | null | undefined,
): boolean {
  if (!userEquipment.length) return true;
  const list = Array.isArray(exerciseEquipment)
    ? exerciseEquipment
    : (exerciseEquipment ? [String(exerciseEquipment)] : []);
  if (!list.length) return true;
  if (list.includes('bodyweight')) return true;
  return list.some((eq) => userEquipment.includes(eq));
}
