/**
 * relative-strength.engine.ts — P6: относительная сила (проф. уровень). UNIFY.
 * Wilks / DOTS / IPF GLI / allometric / относительная сила — канонический модуль
 * (DOTS/GLI были в performance-analytics, Wilks не было). + классификация по уровню.
 */

export type Sex = "male" | "female";

function r1(v: number) { return Math.round(v * 10) / 10; }
function r2(v: number) { return Math.round(v * 100) / 100; }
function r3(v: number) { return Math.round(v * 1000) / 1000; }

/**
 * Wilks original (Robert Wilks 1994, полином 5-й степени).
 * Верифицировано: 90 кг / 600 кг (М) → 383.0 (LiftVault-якорь, сходится до 0.1).
 * Источник констант: IPF_GL_Coefficients-2020.pdf (там же таблица) + concalculator-разбор.
 */
export function wilksScore(total: number, bw: number, sex: Sex): number {
  if (bw <= 0 || total <= 0) return 0;
  const x = bw;
  let denom: number;
  if (sex === "male") {
    denom = -0.00000001291 * x ** 5 + 0.00000701863 * x ** 4 - 0.00113732 * x ** 3
      - 0.002388645 * x * x + 16.2606339 * x - 216.0475144;
  } else {
    denom = -0.000000009054 * x ** 5 + 0.00004731582 * x ** 4 - 0.00930733913 * x ** 3
      + 0.82112226871 * x * x - 27.23842536447 * x + 594.31747775582;
  }
  if (denom <= 0) return 0;
  return r2(total * 500 / denom);
}

/**
 * DOTS (Tim Konertz 2019, BVDK).
 * Верифицировано по реальным протоколам: М 73.9/682.5 → 494.3 (факт USAPL 494.11);
 * Ж 72.9/305 → 301.6 (факт 301.50). Женские константы — официальные BVDK
 * (b=0.0005158568, c=−0.1126655495, d=13.6175032, e=−57.96288).
 */
export function dotsScore(total: number, bw: number, sex: Sex): number {
  if (bw <= 0 || total <= 0) return 0;
  const a = sex === "male" ? -0.0000010930 : -0.0000010706;
  const b = sex === "male" ? 0.0007391293 : 0.0005158568;
  const c = sex === "male" ? -0.1918759221 : -0.1126655495;
  const d = sex === "male" ? 24.0900756 : 13.6175032;
  const e = sex === "male" ? -307.75076 : -57.96288;
  const denom = a * bw ** 4 + b * bw ** 3 + c * bw * bw + d * bw + e;
  if (denom <= 0) return 0;
  return r2(total * 500 / denom);
}

/**
 * IPF GL Points (Goodlift, официален с 01.05.2020, IPF_GL_Coefficients-2020.pdf).
 * Верифицировано: Ж 46.8/435 классика → 121.0 (факт ЧМ-2025 120.97);
 * М 90/600 классика → 79.8 (факт LiftVault 79.8).
 * ВАЖНО: старые значения движка для М использовали equipped-параметры, для Ж — смесь.
 */
export interface IPFGLParams { A: number; B: number; C: number }
export const IPF_GL_PARAMS: Record<Sex, Record<'classic' | 'equipped', Record<'total' | 'bench', IPFGLParams>>> = {
  male: {
    classic: {
      total: { A: 1199.72839, B: 1025.18162, C: 0.00921 },
      bench: { A: 320.98041, B: 281.40258, C: 0.01008 },
    },
    equipped: {
      total: { A: 1236.25115, B: 1449.21864, C: 0.01644 },
      bench: { A: 381.22073, B: 733.79378, C: 0.02398 },
    },
  },
  female: {
    classic: {
      total: { A: 610.32796, B: 1045.59282, C: 0.03048 },
      bench: { A: 142.40398, B: 442.52671, C: 0.04724 },
    },
    equipped: {
      total: { A: 758.63878, B: 949.31382, C: 0.02435 },
      bench: { A: 221.82209, B: 357.00377, C: 0.02937 },
    },
  },
};

export function ipfGLPointsFor(total: number, bw: number, sex: Sex, gear: 'classic' | 'equipped' = 'classic', event: 'total' | 'bench' = 'total'): number {
  if (bw <= 0 || total <= 0) return 0;
  const { A, B, C } = IPF_GL_PARAMS[sex][gear][event];
  const denom = A - B * Math.exp(-C * bw);
  if (denom <= 0) return 0;
  return r1((100 / denom) * total);
}

/** IPF GL по умолчанию — классика/троеборье (backward-compat сигнатура). */
export function ipfGLPoints(total: number, bw: number, sex: Sex): number {
  return ipfGLPointsFor(total, bw, sex, 'classic', 'total');
}

/**
 * McCulloch age-коэффициент (множитель к DOTS/очкам для мастерс).
 * Якоря — публикация таблицы McCulloch (StrengthBasecamp 2026, помечены ~):
 * 40:1.000, 45:~1.052, 50:~1.130, 55:~1.220, 60:~1.305, 65:~1.420, 70:~1.522, 75:~1.730, 80:~1.961.
 * Между якорями — линейная интерполяция; моложе 40 — 1.0 (юниорские поправки — по регламентам федераций, не McCulloch).
 */
const MCCULLOCH_ANCHORS: Array<[number, number]> = [
  [40, 1.0], [45, 1.052], [50, 1.13], [55, 1.22], [60, 1.305], [65, 1.42], [70, 1.522], [75, 1.73], [80, 1.961],
];
export function mccullochCoeff(age: number): number {
  if (!Number.isFinite(age) || age < 40) return 1.0;
  const anchors = MCCULLOCH_ANCHORS;
  if (age >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [a0, c0] = anchors[i];
    const [a1, c1] = anchors[i + 1];
    if (age >= a0 && age <= a1) return r3(c0 + (c1 - c0) * (age - a0) / (a1 - a0));
  }
  return 1.0;
}

/** Очки с поправкой на возраст (McCulloch, только 40+; моложе — как есть). */
export function ageAdjustedScore(score: number, age: number): number {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return r1(score * mccullochCoeff(age));
}

/** Allometric scaling: strength ∝ bw^(2/3). */
export function allometricScore(total: number, bw: number): number {
  if (bw <= 0 || total <= 0) return 0;
  return r2(total / Math.pow(bw, 2 / 3));
}

/** Относительная сила: total / bw (раз). */
export function relativeStrength(total: number, bw: number): number {
  if (bw <= 0) return 0;
  return r2(total / bw);
}

/** Относительная сила по отдельному движению */
export function liftRelativeStrength(lift: number, bw: number): number {
  if (bw <= 0) return 0;
  return r2(lift / bw);
}

export type StrengthClass = "novice" | "intermediate" | "advanced" | "elite" | "world_class";
export interface Classification { class: StrengthClass; dotsThreshold: number; label: string; }

const DOTS_THRESHOLDS: { class: StrengthClass; min: number; label: string }[] = [
  { class: "novice", min: 0, label: "Новичок" },
  { class: "intermediate", min: 300, label: "Средний" },
  { class: "advanced", min: 380, label: "Опытный" },
  { class: "elite", min: 450, label: "Элита" },
  { class: "world_class", min: 520, label: "Мировой класс" },
];

/** Классификация по DOTS-баллу. */
export function classifyByDots(dots: number): Classification {
  let cur = DOTS_THRESHOLDS[0];
  for (const t of DOTS_THRESHOLDS) if (dots >= t.min) cur = t;
  return { class: cur.class, dotsThreshold: cur.min, label: cur.label };
}

/**
 * Пороги относительной силы для отдельных движений (тотал/вес).
 * Основано на IPF/WRPS стандартах, приведённых к ×bw.
 */
export const LIFT_RS_THRESHOLDS: Record<Sex, Record<string, { class: StrengthClass; min: number; label: string }[]>> = {
  male: {
    squat: [
      { class: "novice", min: 0, label: "Новичок" },
      { class: "intermediate", min: 1.5, label: "Средний" },
      { class: "advanced", min: 2.0, label: "Опытный" },
      { class: "elite", min: 2.5, label: "Элита" },
      { class: "world_class", min: 3.0, label: "Мировой класс" },
    ],
    bench: [
      { class: "novice", min: 0, label: "Новичок" },
      { class: "intermediate", min: 1.0, label: "Средний" },
      { class: "advanced", min: 1.3, label: "Опытный" },
      { class: "elite", min: 1.6, label: "Элита" },
      { class: "world_class", min: 2.0, label: "Мировой класс" },
    ],
    deadlift: [
      { class: "novice", min: 0, label: "Новичок" },
      { class: "intermediate", min: 2.0, label: "Средний" },
      { class: "advanced", min: 2.5, label: "Опытный" },
      { class: "elite", min: 3.0, label: "Элита" },
      { class: "world_class", min: 3.5, label: "Мировой класс" },
    ],
    total: [
      { class: "novice", min: 0, label: "Новичок" },
      { class: "intermediate", min: 4.5, label: "Средний" },
      { class: "advanced", min: 6.0, label: "Опытный" },
      { class: "elite", min: 7.5, label: "Элита" },
      { class: "world_class", min: 9.0, label: "Мировой класс" },
    ],
  },
  female: {
    squat: [
      { class: "novice", min: 0, label: "Новичок" },
      { class: "intermediate", min: 1.0, label: "Средний" },
      { class: "advanced", min: 1.4, label: "Опытный" },
      { class: "elite", min: 1.8, label: "Элита" },
      { class: "world_class", min: 2.2, label: "Мировой класс" },
    ],
    bench: [
      { class: "novice", min: 0, label: "Новичок" },
      { class: "intermediate", min: 0.6, label: "Средний" },
      { class: "advanced", min: 0.85, label: "Опытный" },
      { class: "elite", min: 1.1, label: "Элита" },
      { class: "world_class", min: 1.4, label: "Мировой класс" },
    ],
    deadlift: [
      { class: "novice", min: 0, label: "Новичок" },
      { class: "intermediate", min: 1.3, label: "Средний" },
      { class: "advanced", min: 1.8, label: "Опытный" },
      { class: "elite", min: 2.2, label: "Элита" },
      { class: "world_class", min: 2.8, label: "Мировой класс" },
    ],
    total: [
      { class: "novice", min: 0, label: "Новичок" },
      { class: "intermediate", min: 3.0, label: "Средний" },
      { class: "advanced", min: 4.0, label: "Опытный" },
      { class: "elite", min: 5.0, label: "Элита" },
      { class: "world_class", min: 6.5, label: "Мировой класс" },
    ],
  },
};

/** Классификация по относительной силе для отдельного движения. */
export function classifyLiftRelative(liftRs: number, sex: Sex, lift: 'squat' | 'bench' | 'deadlift' | 'total'): { class: StrengthClass; label: string; min: number } {
  const table = LIFT_RS_THRESHOLDS[sex]?.[lift] || LIFT_RS_THRESHOLDS.male.squat;
  let cur = table[0];
  for (const t of table) if (liftRs >= t.min) cur = t;
  return { class: cur.class, label: cur.label, min: cur.min };
}

export interface RelativeStrengthReport {
  total: number; bw: number; sex: Sex;
  wilks: number; dots: number; ipfGL: number; allometric: number; relative: number;
  classification: Classification;
  lifts: {
    squat: { value: number; rs: number; class: StrengthClass; label: string };
    bench: { value: number; rs: number; class: StrengthClass; label: string };
    deadlift: { value: number; rs: number; class: StrengthClass; label: string };
  };
}

/**
 * Сводка всех формул + классификация + per-lift относительная сила.
 * NOTE: per-lift values are zero because only `total` is known.
 * Use `relativeStrengthFullReport(squat, bench, deadlift, bw, sex)` for real per-lift data.
 */
export function relativeStrengthReport(total: number, bw: number, sex: Sex): RelativeStrengthReport {
  const dots = dotsScore(total, bw, sex);
  return {
    total, bw, sex,
    wilks: wilksScore(total, bw, sex),
    dots,
    ipfGL: ipfGLPoints(total, bw, sex),
    allometric: allometricScore(total, bw),
    relative: relativeStrength(total, bw),
    classification: classifyByDots(dots),
    lifts: {
      squat: { value: 0, rs: 0, ...classifyLiftRelative(0, sex, 'squat') },
      bench: { value: 0, rs: 0, ...classifyLiftRelative(0, sex, 'bench') },
      deadlift: { value: 0, rs: 0, ...classifyLiftRelative(0, sex, 'deadlift') },
    },
  };
}

/** Отчёт с per-lift данными. */
export function relativeStrengthFullReport(squat: number, bench: number, deadlift: number, bw: number, sex: Sex): RelativeStrengthReport {
  const total = squat + bench + deadlift;
  const dots = dotsScore(total, bw, sex);
  const rsSq = liftRelativeStrength(squat, bw);
  const rsBe = liftRelativeStrength(bench, bw);
  const rsDe = liftRelativeStrength(deadlift, bw);
  return {
    total, bw, sex,
    wilks: wilksScore(total, bw, sex),
    dots,
    ipfGL: ipfGLPoints(total, bw, sex),
    allometric: allometricScore(total, bw),
    relative: relativeStrength(total, bw),
    classification: classifyByDots(dots),
    lifts: {
      squat: { value: squat, rs: rsSq, ...classifyLiftRelative(rsSq, sex, 'squat') },
      bench: { value: bench, rs: rsBe, ...classifyLiftRelative(rsBe, sex, 'bench') },
      deadlift: { value: deadlift, rs: rsDe, ...classifyLiftRelative(rsDe, sex, 'deadlift') },
    },
  };
}

export const DOTS_CLASS_TABLE = DOTS_THRESHOLDS;
