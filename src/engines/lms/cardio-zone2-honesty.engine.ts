/**
 * cardio-zone2-honesty.engine.ts — честный Zone 2 (P2 PRO-2).
 * Storoschuk/Gibala/Gurd, Sports Med Jul 2025: при низком объёме
 * (<150 мин/нед) чистый Z2 недодаёт мито-сигнал/CRF — нужен 1 HIIT.
 * Только текст-гард, сборка не меняется.
 */

/** Средняя неделя <150 мин и ни одного HIIT → warn-строка, иначе null. */
export function zone2HonestyNote(avgWeekMinutes: number, hiitSessions: number): string | null {
  if (!Number.isFinite(avgWeekMinutes) || avgWeekMinutes <= 0) return null;
  if (avgWeekMinutes >= 180) return null;
  if (hiitSessions > 0) return null;
  if (avgWeekMinutes < 150) {
    return 'Низкий объём (<150 мин/нед) без HIIT: добавьте 1 HIIT/нед для VO2max (Storoschuk 2025) — чистый Z2 при таком объёме недодаёт пик формы. Talk-test остаётся оценочным (формулы подходят ~20%).';
  }
  return null;
}
