/**
 * diary-quick-repeat.ts — «как вчера»: быстрый перенос приёмов предыдущего дня.
 *
 * Зачем: каждый день человек ест примерно одно и то же, а ручной ввод
 * завтрака занимает минуты. Шаблоны и «копировать день» уже есть, но требуют
 * сохранить/переключить дату/вставить. Здесь — одна кнопка.
 *
 * Правила (сознательно простые и предсказуемые):
 * - только добавление, ничего не удаляем и не перезаписываем;
 * - дубликат (то же имя и количество) не добавляется повторно — двойной клик
 *   не удваивает калории;
 * - дата «вчера» считается по локальному календарю, без UTC-сдвигов.
 */

export function previousDateKey(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((date || '').trim());
  if (!m) return date;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/** Ключ сравнения порции: имя + количество (+ foodId, если он есть). */
export function repeatItemKey(item: any): string {
  if (!item || typeof item !== 'object') return '';
  return [
    String(item.name || '').trim().toLowerCase(),
    String(item.qty || '').trim().toLowerCase(),
    String(item.foodId ?? ''),
  ].join('|');
}

export interface RepeatResult {
  meals: Record<string, any[]>;
  added: number;
  skipped: number;
}

/**
 * Аддитивное слияние: к текущим приёмам добавляем позиции из источника,
 * пропуская уже существующие порции.
 */
export function mergeMealsFromPrevious(
  target: Record<string, any[]> | undefined,
  source: Record<string, any[]> | undefined,
): RepeatResult {
  const meals: Record<string, any[]> = {};
  for (const [meal, items] of Object.entries(target || {})) {
    meals[meal] = Array.isArray(items) ? [...items] : [];
  }
  let added = 0;
  let skipped = 0;
  if (!source) return { meals, added, skipped };

  for (const [meal, items] of Object.entries(source)) {
    if (!Array.isArray(items) || items.length === 0) continue;
    const list = meals[meal] ? [...meals[meal]] : [];
    for (const item of items) {
      const key = repeatItemKey(item);
      if (key && list.some((x) => repeatItemKey(x) === key)) {
        skipped += 1;
        continue;
      }
      list.push(JSON.parse(JSON.stringify(item)));
      added += 1;
    }
    if (list.length > 0) meals[meal] = list;
  }
  return { meals, added, skipped };
}
