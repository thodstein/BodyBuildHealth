/**
 * strength-sport-ta-progress.engine.ts — ПРОГРЕСС ДВОЕБОРЬЯ + SINCLAIR (V3-A, V8)
 *
 * Sinclair Total = total × 10^(A × (log10(BW/B))²), BW ≤ B иначе 1.0.
 * Циклы IWF (Alberta WA / PZPC PDF, сверено с таблицами):
 *  2025–2028 (текущий, дефолт): Men A=0.700767819 B=201.159 (81.5кг → 1.28201 ✓);
 *    Women A=0.674107991 B=163.918.
 *  Сверка Sep 2026 (добойка П2): эталонные примеры codingace.net воспроизводятся
 *  до 6-го знака — М73/315 → 1.367106/430.638; М89/345 → 1.224310/422.387;
 *  Ж59/210 → 1.357552/285.086; Ж71/235 → 1.227460/288.453.
 *  ВНИМАНИЕ: ironcompare публикует на 2025–2028 чужой набор (A≈0.722/B=175.508 —
 *  это A 2021–2024 + B 2017–2020) — НЕ использовать как источник.
 *  2021–2024 (legacy): Men A=0.722762521 B=193.609; Women A=0.787004341 B=153.757.
 * Проверка legacy: F 67.9кг/257 → ≈322.9 (в PDF опечатка 67.8/67.9 — там 323.187);
 * M 81кг/305 → ≈387.07 (rpetraining: 387.09 ✓).
 * История замеров (вес+рывок+толчок+цикл) + тренд. Чистый движок + storage-хелперы.
 */

export type SinclairCycle = '2025-2028' | '2021-2024';

/** Текущий цикл по умолчанию (проверять на iwf.sport при смене олимпиады). */
export const SINCLAIR_CURRENT_CYCLE: SinclairCycle = '2025-2028';

export const SINCLAIR_MEN = { A: 0.722762521, B: 193.609 };
export const SINCLAIR_WOMEN = { A: 0.787004341, B: 153.757 };

export const SINCLAIR_2528_MEN = { A: 0.700767819, B: 201.159 };
export const SINCLAIR_2528_WOMEN = { A: 0.674107991, B: 163.918 };

export const TA_PROGRESS_KEY = 'he_ta_progress_hist_v1';

function constsFor(sex?: string | null, cycle?: SinclairCycle | string | null): { A: number; B: number } {
  const cyc: SinclairCycle = cycle === '2021-2024' ? '2021-2024' : '2025-2028';
  if (cyc === '2021-2024') return sex === 'female' ? SINCLAIR_WOMEN : SINCLAIR_MEN;
  return sex === 'female' ? SINCLAIR_2528_WOMEN : SINCLAIR_2528_MEN;
}

/** Коэффициент Sinclair (null при нет данных). */
export function sinclairCoefficient(
  bwKg: number | null | undefined,
  sex?: string | null,
  cycle?: SinclairCycle | string | null,
): number | null {
  if (bwKg == null || !Number.isFinite(bwKg) || bwKg <= 0) return null;
  const { A, B } = constsFor(sex, cycle);
  if (bwKg >= B) return 1;
  const x = Math.log10(bwKg / B);
  return Math.pow(10, A * x * x);
}

/** Sinclair Total (округление 0.01). */
export function sinclairTotal(
  totalKg: number | null | undefined,
  bwKg: number | null | undefined,
  sex?: string | null,
  cycle?: SinclairCycle | string | null,
): number | null {
  if (totalKg == null || !Number.isFinite(totalKg) || totalKg <= 0) return null;
  const c = sinclairCoefficient(bwKg, sex, cycle);
  if (c == null) return null;
  return Math.round(totalKg * c * 100) / 100;
}

export interface TAProgressEntry {
  date: string; // yyyy-mm-dd
  bodyweightKg: number;
  snatchKg: number;
  cleanJerkKg: number;
  /** V8: цикл коэффициентов снимка (старые записи без поля → текущий). */
  cycle?: SinclairCycle;
}

/** Сумма двоеборья записи. */
export function progressTotal(e: TAProgressEntry): number {
  return (Number(e.snatchKg) || 0) + (Number(e.cleanJerkKg) || 0);
}

/** Добавить/заменить снимок дня (кап 60). */
export function appendTAProgress(hist: TAProgressEntry[], entry: TAProgressEntry): TAProgressEntry[] {
  const clean = (Array.isArray(hist) ? hist : []).filter(s => s && typeof s.date === 'string');
  const next = [...clean.filter(s => s.date !== entry.date), entry]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-60);
  return next;
}

export interface TAProgressTrend {
  n: number;
  totalDelta: number;
  bwDelta: number;
  sinclairDelta: number | null;
  bestSinclair: number | null;
  bestDate: string | null;
  /** V4-добой-2 (П3): Q-points как у Sinclair — дельта/лучший/дата. */
  qDelta: number | null;
  bestQ: number | null;
  bestQDate: string | null;
}

/** Тренд: последний vs первый + лучший Sinclair/Q (каждый снимок — своим циклом). */
export function taProgressTrend(hist: TAProgressEntry[], sex?: string | null, cycle?: SinclairCycle | string | null): TAProgressTrend | null {
  const clean = (Array.isArray(hist) ? hist : []).filter(s => s && Number.isFinite(s.snatchKg) && Number.isFinite(s.cleanJerkKg));
  if (clean.length < 2) return null;
  const sorted = [...clean].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = sorted[0], last = sorted[sorted.length - 1];
  const totalDelta = Math.round((progressTotal(last) - progressTotal(first)) * 10) / 10;
  const bwDelta = Math.round(((Number(last.bodyweightKg) || 0) - (Number(first.bodyweightKg) || 0)) * 10) / 10;
  const cycOf = (s: TAProgressEntry) => (s.cycle === '2021-2024' ? '2021-2024' : (cycle ?? SINCLAIR_CURRENT_CYCLE)) as SinclairCycle;
  let bestSinclair: number | null = null;
  let bestDate: string | null = null;
  let lastSinclair: number | null = null;
  let firstSinclair: number | null = null;
  let bestQ: number | null = null;
  let bestQDate: string | null = null;
  let firstQ: number | null = null;
  let lastQ: number | null = null;
  for (const s of sorted) {
    const st = sinclairTotal(progressTotal(s), Number(s.bodyweightKg) || null, sex, cycOf(s));
    if (st != null && (bestSinclair == null || st > bestSinclair)) { bestSinclair = st; bestDate = s.date; }
    const q = qPoints(progressTotal(s), Number(s.bodyweightKg) || null, sex);
    if (q != null && (bestQ == null || q > bestQ)) { bestQ = q; bestQDate = s.date; }
  }
  firstSinclair = sinclairTotal(progressTotal(first), Number(first.bodyweightKg) || null, sex, cycOf(first));
  lastSinclair = sinclairTotal(progressTotal(last), Number(last.bodyweightKg) || null, sex, cycOf(last));
  const sinclairDelta = firstSinclair != null && lastSinclair != null ? Math.round((lastSinclair - firstSinclair) * 100) / 100 : null;
  firstQ = qPoints(progressTotal(first), Number(first.bodyweightKg) || null, sex);
  lastQ = qPoints(progressTotal(last), Number(last.bodyweightKg) || null, sex);
  const qDelta = firstQ != null && lastQ != null ? Math.round((lastQ - firstQ) * 100) / 100 : null;
  return { n: sorted.length, totalDelta, bwDelta, sinclairDelta, bestSinclair, bestDate, qDelta, bestQ, bestQDate };
}

export function loadTAProgress(): TAProgressEntry[] {
  try {
    const raw = localStorage.getItem(TA_PROGRESS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(s => s && typeof s.date === 'string') : [];
  } catch { return []; }
}

export function saveTAProgress(hist: TAProgressEntry[]): boolean {
  try {
    localStorage.setItem(TA_PROGRESS_KEY, JSON.stringify(Array.isArray(hist) ? hist.slice(-60) : []));
    return true;
  } catch { return false; }
}

/**
 * V4-добой: Q-Points (Huebner/Meltzer/Bjarnason/Perperoglou, MSSE 2023;
 * USAW — Best Lifter с 2025 вместо Sinclair/SMF). Квантильная регрессия
 * 90-го перцентиля, не зависит от рекордов/категорий — стабильнее Sinclair.
 * Муж: T×463.26/(416.70−47.87·b⁻²+18.93·b²); Жен: T×306.54/(266.50−19.44·b⁻²+18.61·b²),
 * b=BW/100. Флоры: М <50кг / Ж <41кг → null; <12 лет / <40кг — неприменимо (как Sinclair).
 * Чистая функция, без storage.
 */
export function qPoints(
  totalKg: number | null | undefined,
  bwKg: number | null | undefined,
  sex?: string | null,
): number | null {
  if (totalKg == null || !Number.isFinite(totalKg) || totalKg <= 0) return null;
  if (bwKg == null || !Number.isFinite(bwKg) || bwKg <= 0) return null;
  const female = String(sex || '').toLowerCase() === 'female';
  if (female ? bwKg < 41 : bwKg < 50) return null;
  const b = bwKg / 100;
  const denom = female
    ? 266.50 - 19.44 / (b * b) + 18.61 * b * b
    : 416.70 - 47.87 / (b * b) + 18.93 * b * b;
  if (!Number.isFinite(denom) || denom <= 0) return null;
  const scale = female ? 306.54 : 463.26;
  return Math.round((totalKg * scale / denom) * 100) / 100;
}

/**
 * V5-V5: возрастная шкала (USAW с 2025 — Best Lifter по Q-points; юношам —
 * Q-youth, мастерам — Q-masters, Huebner et al.). Точных публичных коэффициентов
 * Q-youth/Q-masters в коде нет — честно возвращаем только шкалу + пометку:
 * число qPoints остаётся базой сравнения внутри своего возраста.
 * <12 лет / <40кг — неприменимо (как Sinclair/Q флоры).
 */
/**
 * V5-П4: Q-Masters = Q-points × возрастной коэффициент (IMWA с 2025;
 * USAW Best Lifter-мастерам с 2025).
 *
 * Таблицы дословно: Meltzer–Faber (муж, 66 значений, возраст 30–95) и
 * Huebner–Meltzer–Faber (жен, 61 значение, 30–90) — путь weighttraining.nz
 * (IMWA-калькулятор, коэффициенты 2025; те же множители, что SMF/SHMF-эра).
 * Возраст целый (календарный, как у VGF/USAW — возраст на 31 дек года);
 * моложе 30 → null (там — чистые Q-points); старше таблицы → кламп к краю.
 */
const QMASTER_MEN = [
  1, 1.01, 1.018, 1.026, 1.038, 1.052, 1.064, 1.076, 1.088, 1.1,
  1.112, 1.124, 1.136, 1.148, 1.16, 1.173, 1.187, 1.201, 1.215, 1.23,
  1.247, 1.264, 1.283, 1.304, 1.327, 1.351, 1.376, 1.401, 1.425, 1.451,
  1.477, 1.504, 1.531, 1.56, 1.589, 1.62, 1.654, 1.693, 1.736, 1.784,
  1.833, 1.883, 1.932, 1.981, 2.031, 2.083, 2.139, 2.202, 2.271, 2.348,
  2.43, 2.524, 2.635, 2.755, 2.877, 3.008, 3.168, 3.356, 3.545, 3.709,
  3.88, 4.059, 4.247, 4.443, 4.648, 4.863,
];
const QMASTER_WOMEN = [
  1, 1.01, 1.021, 1.031, 1.042, 1.052, 1.063, 1.073, 1.084, 1.096,
  1.108, 1.122, 1.138, 1.155, 1.173, 1.194, 1.216, 1.24, 1.265, 1.292,
  1.321, 1.352, 1.384, 1.419, 1.456, 1.494, 1.534, 1.575, 1.617, 1.66,
  1.704, 1.748, 1.794, 1.841, 1.89, 1.942, 1.996, 2.052, 2.109, 2.168,
  2.226, 2.285, 2.343, 2.402, 2.464, 2.528, 2.597, 2.67, 2.749, 2.831,
  2.918, 3.009, 3.104, 3.201, 3.301, 3.403, 3.507, 3.613, 3.72, 3.827,
  3.935,
];

export function qMasterFactor(ageYears: number | null | undefined, sex?: string | null): number | null {
  if (ageYears == null || !Number.isFinite(ageYears)) return null;
  const a = Math.floor(ageYears);
  if (a < 30) return null;
  const female = String(sex || '').toLowerCase() === 'female';
  const table = female ? QMASTER_WOMEN : QMASTER_MEN;
  const idx = Math.min(a - 30, table.length - 1);
  return table[idx];
}

/** Q-Masters числом (округление 0.01). Моложе 30 / без данных → null. */
export function qMasters(
  totalKg: number | null | undefined,
  bwKg: number | null | undefined,
  sex?: string | null,
  ageYears?: number | null,
): number | null {
  const q = qPoints(totalKg, bwKg, sex);
  const f = qMasterFactor(ageYears, sex);
  if (q == null || f == null) return null;
  return Math.round(q * f * 100) / 100;
}

export function qAgeScale(ageYears: number | null | undefined): { scale: 'Q-youth' | 'Q-points' | 'Q-masters'; note: string } | null {
  if (ageYears == null || !Number.isFinite(ageYears) || ageYears <= 0) return null;
  if (ageYears < 12) return null;
  if (ageYears < 18) return { scale: 'Q-youth', note: `Возраст ${ageYears}: юношам — Q-youth по таблицам USAW (здесь база Q-points, сравнивай внутри возраста)` };
  if (ageYears < 35) return { scale: 'Q-points', note: `Возраст ${ageYears}: основная шкала Q-points (USAW Best Lifter с 2025)` };
  return { scale: 'Q-masters', note: `Возраст ${ageYears}: мастерам — Q-masters = Q-points × возрастной коэффициент (MF/HMF-таблицы, IMWA с 2025; число ниже)` };
}
