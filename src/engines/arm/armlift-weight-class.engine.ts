/**
 * armlift-weight-class.engine.ts — весовые категории Armlifting USA 2026 (PRO-4 A5).
 * Статика из Season Rankings / Super Series (armliftingusa.com):
 * М 60/70/80/90/100/110/125/125+, Ж 55/60/65/70/80/90/100/100+.
 * Masters/Teen — строкой, в гейты не входят. Только арифметика до границы,
 * без методики сгонки.
 */

export type ArmliftSex = 'male' | 'female';

const MALE_CLASSES = [60, 70, 80, 90, 100, 110, 125];
const FEMALE_CLASSES = [55, 60, 65, 70, 80, 90, 100];

export interface ArmliftClass {
  label: string;
  /** Верхняя граница класса (кг) или null для открытой. */
  limitKg: number | null;
  /** Сколько кг до верхней границы (минус = перевес). null — открытая. */
  toLimitKg: number | null;
}

/** Класс по весу и полу. Неизвестный пол/вес — честный фолбэк (открытая). */
export function armliftClassFor(bwKg: number, sex: string): ArmliftClass {
  const s: ArmliftSex = (sex || '').toLowerCase() === 'female' ? 'female' : 'male';
  const w = Number(bwKg);
  if (!Number.isFinite(w) || w <= 0) {
    return { label: s === 'female' ? 'Ж-открытая' : 'М-открытая', limitKg: null, toLimitKg: null };
  }
  const classes = s === 'female' ? FEMALE_CLASSES : MALE_CLASSES;
  for (const lim of classes) {
    if (w <= lim) {
      const d = Math.round((lim - w) * 10) / 10;
      return { label: `${s === 'female' ? 'Ж' : 'М'}-${lim}`, limitKg: lim, toLimitKg: d };
    }
  }
  return { label: s === 'female' ? 'Ж-100+' : 'М-125+', limitKg: null, toLimitKg: null };
}

/** Строка для хаба: «твой класс … · до границы …». */
export function armliftClassLine(bwKg: number, sex: string): string {
  const c = armliftClassFor(bwKg, sex);
  if (c.limitKg == null) return `твой класс: ${c.label} (открытая)`;
  const tail = (c.toLimitKg as number) === 0
    ? 'ровно на границе'
    : `до границы ${c.toLimitKg} кг`;
  return `твой класс: ${c.label} · ${tail}`;
}
