/**
 * cardio-date-utils.engine.ts — единые локальные date-helpers для кардио (B2).
 * Локальная дата YYYY-MM-DD без UTC-сдвига (исправляет toISOString-баг).
 * Используется в cardio.engine.ts и annual-training-cardio.engine.ts.
 */

export function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseLocalIso(iso: string): Date {
  return new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseLocalIso(iso);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  return toLocalIso(t);
}

export function todayLocalIso(): string {
  return toLocalIso(new Date());
}

export function weekStartIso(week: number, referenceIso?: string): string {
  const ref = referenceIso ? parseLocalIso(referenceIso) : new Date();
  const base = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + (week - 1) * 7);
  return toLocalIso(base);
}

export function dayOfWeekIso(week: number, dow: number, referenceIso?: string): string {
  const ref = referenceIso ? parseLocalIso(referenceIso) : new Date();
  const base = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + (week - 1) * 7 + dow);
  return toLocalIso(base);
}

/** День недели ISO-даты: понедельник = 0 … воскресенье = 6.
 *  P1-аудит: `new Date(iso).getDay()` парсит 10-символьную дату как UTC
 *  и на машинах с отрицательным смещением отдаёт ПРЕДЫДУЩИЙ день недели
 *  (сетка календаря уезжала на колонку). Канон — только локальный разбор. */
export function weekdayMon0Iso(iso: string): number {
  const d = parseLocalIso(iso);
  return (d.getDay() + 6) % 7;
}

/** Локальная полночь по ISO-дате (для сортировок/сравнений «начало дня»). */
export function localMidnight(iso: string): Date {
  const d = parseLocalIso(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
