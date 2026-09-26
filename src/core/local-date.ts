/**
 * local-date.ts — ЕДИНЫЙ канон «календарной» даты (YYYY-MM-DD) во всём проекте.
 *
 * Зачем отдельный файл: до него `localIsoDate` был продублирован в трёх местах
 * (workout-logger.engine, diary-shared, planner-date-utils), а `toISOString().slice(0,10)`
 * использовался как «дата» по всему коду. `toISOString()` отдаёт UTC, поэтому в
 * UTC+3…+12 (РФ/Казахстан/Владивосток — наша машина как раз Asia/Vladivostok)
 * вечером «сегодня» превращалось во «вчера»: раскладка плана уезжала на день,
 * чек-ины и отчёты ставились не на ту дату, дефолты соревнований смещались.
 *
 * ПРАВИЛО: для даты, которую видит человек (день тренировки, дата отчёта, день
 * недели, дата соревнования) — только этот модуль. Для СОБЫТИЯ во времени
 * (builtAt/updatedAt/savedAt/createdAt) UTC корректен, там `toISOString()` — правильно.
 *
 * Витрина долга: `src/engines/__tests__/date-canon-census.test.ts` считает оставшиеся
 * date-only места и не даёт долгу расти.
 */

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Локальная календарная дата YYYY-MM-DD. По умолчанию — сегодня. */
export function localIsoDate(value: Date = new Date()): string {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}

/**
 * Дата через N дней от точки отсчёта, в локальном календаре.
 * Нужен там, где писали `new Date(Date.now() + 60*86400000).toISOString().slice(0,10)`:
 * такая запись берёт UTC и на границе суток даёт ±1 день к цели.
 */
export function localIsoDateOffset(days: number, from: Date = new Date()): string {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + Math.trunc(days));
  return localIsoDate(d);
}

/** Разбор локальной даты YYYY-MM-DD в полночь по МЕСТНОМУ времени. */
export function parseLocalIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Сдвиг ISO-даты на N дней (строковая арифметика календаря, без Date-объекта). */
export function shiftIsoDate(iso: string, days: number): string {
  const d = parseLocalIsoDate(iso);
  if (!d) return String(iso ?? '');
  return localIsoDateOffset(days, d);
}
