/**
 * planner-special-meals-store.ts — единый стор спец-приёмов (`he_special_meals`).
 *
 * FIX B18 (аудит 2026-10): ключ `he_special_meals` писали ДВА независимых места:
 *  - `IndividualPlanSettings` — держал снимок в state, прочитанный ОДИН раз при
 *    монтировании, и при добавлении писал `[...снимок, новое]`;
 *  - `RefeedCalendarCard` — писал в ключ напрямую (read-modify-write в момент клика).
 *
 * Пользователь нажимал «добавить рефиды на 8 недель» (в ключе 8 записей), затем
 * добавлял читмил в настройках — и в ключе оставалась ОДНА запись: рефиды исчезали
 * (молчаливая потеря данных).
 *
 * Теперь все записи идут через этот модуль: чтение-изменение-запись выполняется
 * В МОМЕНТ КЛИКА от актуального содержимого ключа, а подписчики получают событие.
 *
 * ВАЖНО: не путать с `planner-special-meals.ts` — там ЧИСТЫЕ генераторы рационов
 * спец-режимов (читмил/карб-загрузка/БУЧ/сладкое/ленивый день).
 */

export const SPECIAL_MEALS_KEY = 'he_special_meals';
/** Событие для подписчиков в том же документе (`storage` не приходит сам себе). */
export const SPECIAL_MEALS_EVENT = 'he_special_meals_changed';
export const SPECIAL_MEALS_LIMIT = 400;

export interface SpecialMeal {
  type: string;
  typeLabel?: string;
  date: string;
  notes?: string;
  replaceMeal?: string;
}

/**
 * Идентичность записи: дата + тип. Две записи «рефид 2026-11-01» — это дубль,
 * даже если заметки разные (календарь вообще не пишет notes).
 */
export function specialMealKey(m: any): string {
  return `${String(m?.date ?? '')}|${String(m?.type ?? '')}`;
}

/** Валидная запись: непустые дата и тип (иначе это мусор из старой версии/ручной правки). */
function isSpecialMeal(m: any): boolean {
  return !!m
    && typeof m.date === 'string' && m.date.trim().length > 0
    && typeof m.type === 'string' && m.type.trim().length > 0;
}

/** Прочитать актуальный список из хранилища (никогда не бросает). */
export function readSpecialMeals(): SpecialMeal[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SPECIAL_MEALS_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(isSpecialMeal);
  } catch { return []; }
}

/** Записать список и уведомить подписчиков. `false` — запись не удалась (квота/приватный режим). */
export function writeSpecialMeals(list: SpecialMeal[]): boolean {
  try {
    localStorage.setItem(SPECIAL_MEALS_KEY, JSON.stringify(list.slice(-SPECIAL_MEALS_LIMIT)));
  } catch { return false; }
  try { window.dispatchEvent(new Event(SPECIAL_MEALS_EVENT)); } catch { /* нет window — тесты/SSR */ }
  return true;
}

/**
 * Добавить записи к АКТУАЛЬНОМУ содержимому ключа.
 * Возвращает получившийся список и число реально добавленных (дубли отбрасываются).
 */
export function addSpecialMeals(incoming: SpecialMeal[]): { list: SpecialMeal[]; added: number; persisted: boolean } {
  const list = readSpecialMeals();
  const have = new Set(list.map(specialMealKey));
  let added = 0;
  for (const m of incoming) {
    if (!isSpecialMeal(m)) continue;
    const k = specialMealKey(m);
    if (have.has(k)) continue;
    list.push(m);
    have.add(k);
    added++;
  }
  if (added === 0) return { list, added: 0, persisted: true };
  const persisted = writeSpecialMeals(list);
  return { list, added, persisted };
}

/** Удалить запись (по дате+типу) из АКТУАЛЬНОГО содержимого ключа. */
export function removeSpecialMeal(target: any): { list: SpecialMeal[]; removed: number; persisted: boolean } {
  const key = specialMealKey(target);
  const before = readSpecialMeals();
  const list = before.filter(m => specialMealKey(m) !== key);
  const removed = before.length - list.length;
  if (removed === 0) return { list, removed: 0, persisted: true };
  const persisted = writeSpecialMeals(list);
  return { list, removed, persisted };
}

/**
 * Подписка на изменения ключа из любого места приложения.
 * Возвращает функцию отписки.
 */
export function subscribeSpecialMeals(cb: (list: SpecialMeal[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => cb(readSpecialMeals());
  window.addEventListener(SPECIAL_MEALS_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(SPECIAL_MEALS_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
