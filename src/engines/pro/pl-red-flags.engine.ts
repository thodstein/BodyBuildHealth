/**
 * pl-red-flags.engine.ts — P4: red-flag скрининг для ПЛ-диагностики.
 *
 * Острая боль / отёк / онемение / головокружение = стоп-блок вставки
 * диагностики («к врачу, не диагноз»). Щелчок С болью = осторожность.
 * Скрининг, не диагноз: движок только гейтит, ничего не лечит.
 */

export type RedFlagId = 'sharp_pain' | 'swelling' | 'numbness' | 'dizzy' | 'painful_click';

export const RED_FLAGS: Array<{ id: RedFlagId; label: string; stop: boolean }> = [
  { id: 'sharp_pain', label: 'Острая боль в суставе/мышце', stop: true },
  { id: 'swelling', label: 'Отёк / деформация сустава', stop: true },
  { id: 'numbness', label: 'Онемение / покалывание в конечности', stop: true },
  { id: 'dizzy', label: 'Головокружение / потемнение в глазах под штангой', stop: true },
  { id: 'painful_click', label: 'Щелчок С болью (без боли — не флаг)', stop: false },
];

export interface RedFlagsResult {
  blocked: boolean;
  stopItems: string[];
  cautionItems: string[];
  text: string;
}

/** Гейт: active — ids включённых флагов. Пусто → не заблокировано. */
export function checkRedFlags(active: RedFlagId[]): RedFlagsResult {
  const stopItems = RED_FLAGS.filter(f => f.stop && active.includes(f.id)).map(f => f.label);
  const cautionItems = RED_FLAGS.filter(f => !f.stop && active.includes(f.id)).map(f => f.label);
  const blocked = stopItems.length > 0;
  const text = blocked
    ? `⛔ Стоп: ${stopItems.join('; ')} — вставка диагностики заблокирована. К врачу, это не диагноз.`
    : cautionItems.length > 0
      ? `⚠ Осторожно: ${cautionItems.join('; ')} — снизьте интенсивность, наблюдайте.`
      : 'Флагов нет — можно работать.';
  return { blocked, stopItems, cautionItems, text };
}
