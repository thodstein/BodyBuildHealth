/**
 * relative-strength.engine.ts — P6: относительная сила (проф. уровень). UNIFY.
 * Wilks / DOTS / IPF GLI / allometric / относительная сила — канонический модуль
 * (DOTS/GLI были в performance-analytics, Wilks не было). + классификация по уровню.
 */

export type Sex = "male" | "female";

function r1(v: number) { return Math.round(v * 10) / 10; }
function r2(v: number) { return Math.round(v * 100) / 100; }

/** Wilks (классический, IPF до 2019). */
export function wilksScore(total: number, bw: number, sex: Sex): number {
  if (bw <= 0 || total <= 0) return 0;
  const x = bw;
  let denom: number;
  if (sex === "male") {
    const a = -216.0475145, b = 16.2606339, c = -2.1688383e-3, d = 1.1375105e-5, e = -3.49e-9;
    denom = a + b * x + c * x * x + d * x ** 3 + e * x ** 4;
  } else {
    const a = 594.3161, b = -27.2384, c = 0.8211, d = -9.7974e-3, e = 4.3923e-5;
    denom = a + b * x + c * x * x + d * x ** 3 + e * x ** 4;
  }
  if (denom <= 0) return 0;
  return r2(total * 500 / denom);
}

/** DOTS (IPF с 2019). Коэффициенты из performance-analytics (проверены). */
export function dotsScore(total: number, bw: number, sex: Sex): number {
  if (bw <= 0 || total <= 0) return 0;
  const a = sex === "male" ? -0.0000010930 : -0.0000010702;
  const b = sex === "male" ? 0.0007391293 : 0.0007195833;
  const c = sex === "male" ? -0.1918759221 : -0.1881243692;
  const d = sex === "male" ? 24.0900756 : 22.8480074;
  const e = sex === "male" ? -307.75076 : -281.2251;
  const denom = a * bw ** 4 + b * bw ** 3 + c * bw * bw + d * bw + e;
  if (denom <= 0) return 0;
  return r2(total * 500 / denom);
}

/** IPF GLI Points (Goodleigh). */
export function ipfGLPoints(total: number, bw: number, sex: Sex): number {
  if (bw <= 0 || total <= 0) return 0;
  const A = sex === "male" ? 1236.25115 : 758.63878;
  const B = sex === "male" ? 1449.21864 : 949.31382;
  const C = sex === "male" ? 0.01644 : 0.00936;
  const denom = A - B * Math.exp(-C * bw);
  if (denom <= 0) return 0;
  return r1((100 / denom) * total);
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

/** Сводка всех формул + классификация + per-lift относительная сила. */
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
