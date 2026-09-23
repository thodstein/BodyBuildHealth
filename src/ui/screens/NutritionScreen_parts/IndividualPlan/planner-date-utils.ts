/**
 * planner-date-utils.ts — локальные ISO-даты планировщика (без UTC-сдвига).
 *
 * P1-fix: `dt.setDate(...)` (локально) + `dt.toISOString().slice(0,10)` в UTC+
 * до ~03:00 отдавал ПРЕДЫДУЩИЙ день: раскладка 7/3-дневного плана в дневник
 * уезжала на −1 день, брифинг брал вчерашний дневник, дата шоу и имя файла
 * тренеру путались. Единый источник — локальные геттеры даты (прецедент
 * `_toLocalIso` в настройках и diary-helpers).
 */
export function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
