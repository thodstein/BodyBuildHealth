/**
 * lms-speed-index.ts — индекс СРЦ-циклов со скоростной/координационной/технической
 * направленностью (ПЛ-сезон: период «Скорость движений, координация» 6–10 нед).
 *
 * Аддитивный: НЕ меняет ни один файл цикла. Периода 'speed' в SRPeriod нет —
 * слот скорости (Фаза 1, lms-season.engine) фильтрует кандидатов по этому индексу.
 * Заполнение — только циклами, где в source-описании реально видна скоростная/
 * координационная/техническая/темповая направленность (динамические/скоростные
 * сессии, дожимы с бруска, волновая периодизация, проходки-синглы, армрестлинг-специфика).
 */
import type { SRCycleTemplate } from './lms-types';

export type SpeedOrientation =
  | 'explosive'      // взрывные/динамические усилия (bar speed)
  | 'coordination'   // координация движений/межмышечная синхронизация
  | 'technique'      // техническое совершенствование/специализация амплитуды
  | 'tempo'          // волновая/темповая периодизация (чередование лёгких/тяжёлых)
  | 'speed_strength';// скоростно-силовая работа (синглы на высокой скорости)

/**
 * Карта id цикла → набор скоростных ориентаций. Ключи — канонические id из lms-cycle-index.
 * По умолчанию цикл НЕ считается скоростным (нет в карте) — слот скорости честно сообщает об этом.
 */
export const SPEED_CYCLE_IDS: Record<string, SpeedOrientation[]> = {
  // ДПСМ (Суровецкий): «динамическая, паузная, скоростная сессии» — явная скоростная работа.
  'src2-dpsm': ['explosive', 'tempo', 'technique'],
  // Рекорд (Суровецкий): волновая периодизация + пробные подходы/проходки до 112%.
  'src2-rekord': ['tempo', 'technique'],
  // Гусеница (Суровецкий): скользящее «окно» интенсивности, чередование объёма и интенсива.
  'src2-gusenitsa': ['tempo'],
  // Системы 1 и 2 (Суровецкий): дожимы с бруска, объёмные дубли — техника/скорость срыва.
  'src2-sistemy-1i2': ['technique'],
  // Соловьёв жим 28 дней: двойная волновая периодизация, синглы 85-100%.
  'src2-solovyov-bench-28': ['technique', 'tempo'],
  // Шейко 13 нед (жим): волновая периодизация по трём планам, специализация.
  'src2-sheiko-13': ['tempo', 'technique'],
  // Перспектива (Суровецкий): восходящие пирамиды, соревновательная проходка.
  'src2-perspektiva': ['technique'],
  // Армрестлинг (цикл 4, верх): скорость/координация рук и кистей.
  'cycle-04': ['coordination', 'explosive'],
  // Смешанный интенсифицированный (жим): темповая интенсификация.
  'cycle-13': ['tempo'],
  // Смешанный (тяга+жим, классика): тягово-жимовые пары с переключением темпа.
  'cycle-09k': ['tempo', 'speed_strength'],
  // Смешанный (тяга+жим, сумо): то же для сумо-тяги.
  'cycle-09s': ['tempo', 'speed_strength'],
  // Западные + новые: Westside — динамические усилия 50-60% с цепями
  'westside': ['explosive', 'speed_strength', 'coordination'],
  'korte-3x3': ['tempo', 'coordination'],
  'gzclp': ['tempo', 'technique'],
  'juggernaut-2': ['tempo'],
  'texas-method': ['tempo'],
};

/** Скоростные ориентации цикла; [] если цикл не помечен как скоростной. */
export function speedOrientationOf(cycle: SRCycleTemplate | undefined | null): SpeedOrientation[] {
  if (!cycle || !cycle.meta || !cycle.meta.id) return [];
  const found = SPEED_CYCLE_IDS[cycle.meta.id];
  return Array.isArray(found) ? [...found] : [];
}

/** Есть ли у цикла скоростная направленность. */
export function isSpeedCycle(cycle: SRCycleTemplate | undefined | null): boolean {
  return speedOrientationOf(cycle).length > 0;
}