/**
 * planner-date-utils.ts — локальные ISO-даты планировщика (без UTC-сдвига).
 *
 * P1-fix: `dt.setDate(...)` (локально) + `dt.toISOString().slice(0,10)` в UTC+
 * до ~03:00 отдавал ПРЕДЫДУЩИЙ день: раскладка 7/3-дневного плана в дневник
 * уезжала на −1 день, брифинг брал вчерашний дневник, дата шоу и имя файла
 * тренеру путались. Единый источник — локальные геттеры даты (прецедент
 * `_toLocalIso` в настройках и diary-helpers).
 *
 * Реализация вынесена в `src/core/local-date.ts` (общий канон проекта). Здесь
 * сохранена исходная сигнатура (аргумент обязателен) — ею пользуются десятки
 * мест в планировщике, ломать их нельзя.
 */
import { localIsoDate as localIsoDateCanon } from '../../../../core/local-date';

export function localIsoDate(d: Date): string {
  return localIsoDateCanon(d);
}
