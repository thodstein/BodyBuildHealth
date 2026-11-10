/**
 * support-names.ts — единый резолвер «id вещества → человекочитаемое имя».
 *
 * Зачем: `he_support_plan_result` хранит МАССИВ id, а экраны (Тренировки,
 * Единый интеллект-хаб, дневник) раньше ждали объект `{ substances: [...] }`
 * и показывали пустоту либо сырые id вроде `pharma_anastrozole`.
 *
 * Резолвер читает каталог (SUPPORT_CATALOG_DATA) с тремя регистрами ключа,
 * затем — явный fallback, затем человекочитаемое имя из `EXTRA`-карт.
 */

import { SUPPORT_CATALOG_DATA } from './support-database';

const CACHE: Record<string, string> = {};

/** Дополнительные русские имена для id, которых нет в каталоге как записи. */
const EXTRA_NAMES: Record<string, string> = {
  hydration: 'Водный режим',
  cardio_aerobic: 'Аэробная кардио-нагрузка',
  electrolyte_balance: 'Электролиты Na/K/Mg',
  daily_steps: 'Бытовая активность (10 000+ шагов)',
  no_smoking: 'Отказ от курения',
  no_alcohol: 'Отказ от алкоголя',
};

/**
 * Имя вещества поддержки на русском.
 * @param id   id вещества (любой регистр)
 * @param fallback явное имя-запасное (например, из локальной карты)
 */
export function supportNameRu(id: string, fallback?: string): string {
  if (!id) return fallback || '—';
  const cached = CACHE[id];
  if (cached) return cached;
  const e = SUPPORT_CATALOG_DATA[id] || SUPPORT_CATALOG_DATA[id.toLowerCase()] || SUPPORT_CATALOG_DATA[id.toUpperCase()];
  const fromDb = e?.nameRu || e?.name || EXTRA_NAMES[id] || EXTRA_NAMES[id.toLowerCase()];
  const name = fromDb || fallback || id;
  // Кэшируем ТОЛЬКО собственное имя: fallback приходит из вызывающего кода и
  // для другого вызова может отсутствовать.
  if (fromDb) CACHE[id] = name;
  return name;
}

/** Список id → список имён (без дублей, сохраняя порядок). */
export function supportNamesRu(ids: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id) continue;
    const name = supportNameRu(String(id));
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
