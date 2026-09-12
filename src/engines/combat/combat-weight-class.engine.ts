/**
 * combat-weight-class.engine.ts — весовые категории единоборств (P4 PRO).
 * Чистые таблицы М/Ж + арифметика до границы (прецедент armlift-weight-class).
 * Источники лимитов: Olympic boxing Paris-2024, UFC (lbs→кг), UWW (FS/W/GR), типовые кик (Glory-подобные),
 * IJF seniors (дзюдо), FIAS adults 2026 (самбо), IBJJF gi adults (BJJ — лимиты с кимоно).
 * Категория — опциональный селект; без неё поведение 1-в-1 (кг в вакууме, как раньше).
 */

export interface WeightClassRow { limitKg: number; label: string; }

/** Лимиты категорий по дисциплине × полу (возрастание). */
export const COMBAT_WEIGHT_CLASSES: Record<string, Record<'male' | 'female', WeightClassRow[]>> = {
  boxing: {
    // Olympic Paris-2024
    male: [
      { limitKg: 51, label: '51 кг' }, { limitKg: 57, label: '57 кг' }, { limitKg: 63.5, label: '63.5 кг' },
      { limitKg: 71, label: '71 кг' }, { limitKg: 80, label: '80 кг' }, { limitKg: 92, label: '92 кг' },
      { limitKg: Infinity, label: '92+ кг' },
    ],
    female: [
      { limitKg: 50, label: '50 кг' }, { limitKg: 54, label: '54 кг' }, { limitKg: 57, label: '57 кг' },
      { limitKg: 60, label: '60 кг' }, { limitKg: 66, label: '66 кг' }, { limitKg: 75, label: '75 кг' },
    ],
  },
  mma: {
    // UFC: 125/135/145/155/170/185/205/265 lbs → кг
    male: [
      { limitKg: 56.7, label: '125 lbs (56.7 кг)' }, { limitKg: 61.2, label: '135 lbs (61.2 кг)' },
      { limitKg: 65.8, label: '145 lbs (65.8 кг)' }, { limitKg: 70.3, label: '155 lbs (70.3 кг)' },
      { limitKg: 77.1, label: '170 lbs (77.1 кг)' }, { limitKg: 83.9, label: '185 lbs (83.9 кг)' },
      { limitKg: 93, label: '205 lbs (93 кг)' }, { limitKg: 120.2, label: '265 lbs (120.2 кг)' },
    ],
    female: [
      { limitKg: 52.2, label: '115 lbs (52.2 кг)' }, { limitKg: 56.7, label: '125 lbs (56.7 кг)' },
      { limitKg: 61.2, label: '135 lbs (61.2 кг)' }, { limitKg: 65.8, label: '145 lbs (65.8 кг)' },
    ],
  },
  wrestling: {
    // UWW freestyle / women / greco-roman (мужчинам — FS по умолчанию)
    male: [
      { limitKg: 57, label: '57 кг' }, { limitKg: 61, label: '61 кг' }, { limitKg: 65, label: '65 кг' },
      { limitKg: 70, label: '70 кг' }, { limitKg: 74, label: '74 кг' }, { limitKg: 79, label: '79 кг' },
      { limitKg: 86, label: '86 кг' }, { limitKg: 92, label: '92 кг' }, { limitKg: 97, label: '97 кг' },
      { limitKg: 125, label: '125 кг' },
    ],
    female: [
      { limitKg: 50, label: '50 кг' }, { limitKg: 53, label: '53 кг' }, { limitKg: 55, label: '55 кг' },
      { limitKg: 57, label: '57 кг' }, { limitKg: 59, label: '59 кг' }, { limitKg: 62, label: '62 кг' },
      { limitKg: 65, label: '65 кг' }, { limitKg: 68, label: '68 кг' }, { limitKg: 72, label: '72 кг' },
      { limitKg: 76, label: '76 кг' },
    ],
  },
  kickboxing: {
    // типовые (Glory-подобные) — честная подпись, не официальный канон
    male: [
      { limitKg: 65, label: '65 кг' }, { limitKg: 70, label: '70 кг' }, { limitKg: 77, label: '77 кг' },
      { limitKg: 85, label: '85 кг' }, { limitKg: 95, label: '95 кг' }, { limitKg: Infinity, label: '95+ кг' },
    ],
    female: [
      { limitKg: 55, label: '55 кг' }, { limitKg: 60, label: '60 кг' }, { limitKg: 65, label: '65 кг' },
    ],
  },
  judo: {
    // IJF seniors: M 60/66/73/81/90/100/+100, W 48/52/57/63/70/78/+78
    male: [
      { limitKg: 60, label: '60 кг' }, { limitKg: 66, label: '66 кг' }, { limitKg: 73, label: '73 кг' },
      { limitKg: 81, label: '81 кг' }, { limitKg: 90, label: '90 кг' }, { limitKg: 100, label: '100 кг' },
      { limitKg: Infinity, label: '100+ кг' },
    ],
    female: [
      { limitKg: 48, label: '48 кг' }, { limitKg: 52, label: '52 кг' }, { limitKg: 57, label: '57 кг' },
      { limitKg: 63, label: '63 кг' }, { limitKg: 70, label: '70 кг' }, { limitKg: 78, label: '78 кг' },
      { limitKg: Infinity, label: '78+ кг' },
    ],
  },
  sambo: {
    // FIAS adults 2026 (sport+combat): M 58/64/71/79/88/98/+98, W 50/54/59/65/72/80/+80
    male: [
      { limitKg: 58, label: '58 кг' }, { limitKg: 64, label: '64 кг' }, { limitKg: 71, label: '71 кг' },
      { limitKg: 79, label: '79 кг' }, { limitKg: 88, label: '88 кг' }, { limitKg: 98, label: '98 кг' },
      { limitKg: Infinity, label: '98+ кг' },
    ],
    female: [
      { limitKg: 50, label: '50 кг' }, { limitKg: 54, label: '54 кг' }, { limitKg: 59, label: '59 кг' },
      { limitKg: 65, label: '65 кг' }, { limitKg: 72, label: '72 кг' }, { limitKg: 80, label: '80 кг' },
      { limitKg: Infinity, label: '80+ кг' },
    ],
  },
  bjj: {
    // IBJJF gi adults (лимиты С кимоно; no-gi легче на ~2–3 кг — честная подпись в UI):
    // M 57.5/64/70/76/82.3/88.3/94.3/100.5/ultra, W 48.5/53.5/58.5/64/69/74/79.3/super (без лимита)
    male: [
      { limitKg: 57.5, label: '57.5 кг' }, { limitKg: 64, label: '64 кг' }, { limitKg: 70, label: '70 кг' },
      { limitKg: 76, label: '76 кг' }, { limitKg: 82.3, label: '82.3 кг' }, { limitKg: 88.3, label: '88.3 кг' },
      { limitKg: 94.3, label: '94.3 кг' }, { limitKg: 100.5, label: '100.5 кг' }, { limitKg: Infinity, label: 'ultra (без лимита)' },
    ],
    female: [
      { limitKg: 48.5, label: '48.5 кг' }, { limitKg: 53.5, label: '53.5 кг' }, { limitKg: 58.5, label: '58.5 кг' },
      { limitKg: 64, label: '64 кг' }, { limitKg: 69, label: '69 кг' }, { limitKg: 74, label: '74 кг' },
      { limitKg: 79.3, label: '79.3 кг' }, { limitKg: Infinity, label: 'super (без лимита)' },
    ],
  },
  general: { male: [], female: [] },
};

function normDisc(d: string | null | undefined): string {
  const s = (d || 'general').toLowerCase();
  if (s in COMBAT_WEIGHT_CLASSES) return s;
  return 'general';
}

export function weightClassesFor(discipline: string, sex: 'male' | 'female'): WeightClassRow[] {
  return COMBAT_WEIGHT_CLASSES[normDisc(discipline)]?.[sex] || [];
}

/**
 * Категория для текущего веса: первый лимит ≥ веса (взвешивание сверху).
 * Возвращает null без таблиц (general) или без веса.
 */
export function weightClassFor(
  discipline: string,
  sex: 'male' | 'female',
  bodyweightKg: number | null | undefined
): WeightClassRow | null {
  if (typeof bodyweightKg !== 'number' || !Number.isFinite(bodyweightKg) || bodyweightKg <= 30) return null;
  const rows = weightClassesFor(discipline, sex);
  if (!rows.length) return null;
  return rows.find(r => bodyweightKg <= r.limitKg) || rows[rows.length - 1] || null;
}

/** Сколько кг до лимита категории (целевого веса): >0 — влезет с запасом, <0 — не дотянет. */
export function weightToClassBoundary(
  bodyweightKg: number,
  cutKg: number,
  classLimitKg: number | null | undefined
): number | null {
  if (typeof classLimitKg !== 'number' || !Number.isFinite(classLimitKg)) return null;
  const target = bodyweightKg - (cutKg || 0);
  return Math.round((classLimitKg - target) * 10) / 10;
}

/** Строка категории для UI/печати: «лимит L · цель T · запас D». */
export function weightClassLine(
  bodyweightKg: number,
  cutKg: number,
  classLimitKg: number | null | undefined,
  classLabel?: string | null
): string | null {
  const d = weightToClassBoundary(bodyweightKg, cutKg, classLimitKg);
  if (d == null || classLimitKg == null) return null;
  const target = Math.round((bodyweightKg - (cutKg || 0)) * 10) / 10;
  const lim = Number.isFinite(classLimitKg) ? `${classLimitKg} кг` : 'open';
  const fit = d >= 0 ? `запас +${d} кг` : `не хватает ${Math.abs(d)} кг`;
  return `Категория ${classLabel || lim}: цель ${target} кг vs лимит ${lim} — ${fit}`;
}

/**
 * Валиден ли выбранный лимит для дисциплины × пола (против stale после смены дисциплины:
 * бокс 80кг ≠ MMA-лимит). Пустой лимит — валиден (категория не выбрана).
 */
export function weightClassLimitValid(
  discipline: string,
  sex: 'male' | 'female',
  classLimitKg: number | null | undefined
): boolean {
  if (classLimitKg == null || classLimitKg === 0) return true;
  return weightClassesFor(discipline, sex).some(r => r.limitKg === classLimitKg);
}
