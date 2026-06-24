/**
 * progression-pro.engine.ts — P5: библиотория прогрессий (проф. уровень).
 * 5/3/1 (BBB), DUP (daily undulating), conjugate (Westside), double progression,
 * Hepburn, super-squats — как данные (% templates) + генератор недель с весами.
 * % относятся к TrainingMax (TM = factor × e1RM; 5/3/1 = 0.9) или e1RM (остальные 1.0).
 */

export type ProgressionSchemeId = "531" | "dup" | "conjugate" | "double_progression" | "hepburn" | "super_squats";

export interface ProgressionSet { pct: number; reps: number; sets: number; }
export interface ProgressionDay { label: string; focus: string; sets: ProgressionSet[]; }
export interface ProgressionWeek { week: number; days: ProgressionDay[]; }
export interface ProgressionScheme {
  id: ProgressionSchemeId;
  name: string;
  description: string;
  weeks: number;
  trainingMaxFactor: number; // доля e1RM для «рабочего максимума»
  // шаблон недель в % от TM
  template: ProgressionWeek[];
}

const SQUAT = (sets: ProgressionSet[], focus = "Heavy") => ({ label: "День 1", focus, sets });
const r = (pct: number, reps: number, sets = 1): ProgressionSet => ({ pct, reps, sets });

export const PROGRESSION_SCHEMES: Record<ProgressionSchemeId, ProgressionScheme> = {
  // Wendler 5/3/1: 3 рабочих + deload-неделя. % от TM (TM = 90% e1RM).
  "531": {
    id: "531", name: "5/3/1 (Wendler)", weeks: 4, trainingMaxFactor: 0.9,
    description: "4-недельный волновой цикл: 5×3 / 3×3 / 5-3-1 / deload. % от Training Max (90% e1RM).",
    template: [
      { week: 1, days: [SQUAT([r(0.65,5), r(0.70,5), r(0.75,5)], "5×3"), { label: "День 2", focus: "BBB 5×10", sets: [r(0.5,10,5)] }, { label: "День 3", focus: "5×3", sets: [r(0.65,5), r(0.70,5), r(0.75,5)] }, { label: "День 4", focus: "BBB 5×10", sets: [r(0.5,10,5)] }] },
      { week: 2, days: [SQUAT([r(0.70,3), r(0.75,3), r(0.80,3)], "3×3"), { label: "День 2", focus: "BBB 5×10", sets: [r(0.6,10,5)] }, { label: "День 3", focus: "3×3", sets: [r(0.70,3), r(0.75,3), r(0.80,3)] }, { label: "День 4", focus: "BBB 5×10", sets: [r(0.6,10,5)] }] },
      { week: 3, days: [SQUAT([r(0.75,5), r(0.85,3), r(0.90,1)], "5-3-1"), { label: "День 2", focus: "Joker/FSL", sets: [r(0.65,5,5)] }, { label: "День 3", focus: "5-3-1", sets: [r(0.75,5), r(0.85,3), r(0.90,1)] }, { label: "День 4", focus: "FSL", sets: [r(0.65,8,3)] }] },
      { week: 4, days: [SQUAT([r(0.40,5), r(0.50,5), r(0.60,5)], "Deload"), { label: "День 2", focus: "Deload", sets: [r(0.4,5,3)] }, { label: "День 3", focus: "Deload", sets: [r(0.40,5), r(0.50,5), r(0.60,5)] }, { label: "День 4", focus: "Deload", sets: [r(0.4,5,3)] }] },
    ],
  },
  // Daily Undulating Periodization: 3 дня × 4 нед, % от e1RM.
  "dup": {
    id: "dup", name: "DUP (Daily Undulating)", weeks: 4, trainingMaxFactor: 1.0,
    description: "Ежедневное варьирование: тяжёлый(85%/5)/средний(72%/8)/лёгкий(60%/12), +2.5%/нед.",
    template: [1,2,3,4].map((w) => ({
      week: w,
      days: [
        { label: "Heavy", focus: `Нед${w} сила`, sets: [r(0.82 + (w - 1) * 0.025, 5, 4)] },
        { label: "Medium", focus: `Нед${w} гипертрофия`, sets: [r(0.70 + (w - 1) * 0.02, 8, 3)] },
        { label: "Light", focus: `Нед${w} объём`, sets: [r(0.58 + (w - 1) * 0.02, 12, 3)] },
      ],
    })),
  },
  // Conjugate (Westside): ME (work up to 3-5RM) / DE (speed 8-12×2 @ 55%) / Rep.
  "conjugate": {
    id: "conjugate", name: "Conjugate (Westside)", weeks: 4, trainingMaxFactor: 1.0,
    description: "Max Effort (до 3-5RM) + Dynamic Effort (скорость 8×2 @ 55%) + повторение. Ротация ME-движений.",
    template: [1,2,3,4].map((w) => ({
      week: w,
      days: [
        { label: "Max Effort", focus: `Нед${w}: до 3RM`, sets: [r(0.70,3), r(0.80,3), r(0.90,3), r(0.95,3)] },
        { label: "Dynamic Effort", focus: `Нед${w}: скорость`, sets: [r(0.55,2,10)] },
        { label: "Repetition", focus: `Нед${w}: гипертрофия`, sets: [r(0.65,12,4)] },
      ],
    })),
  },
  // Double progression: фиксируем диапазон 6-8 × 3, добираем повторы → потом +вес.
  "double_progression": {
    id: "double_progression", name: "Double Progression", weeks: 4, trainingMaxFactor: 1.0,
    description: "Фикс-диапазон 6-8×3. Растут повторы (6→8), затем +2.5% веса, повтор.",
    template: [1,2,3,4].map((w) => ({
      week: w,
      days: [{ label: "Work", focus: `Нед${w}: 6-8×3`, sets: [r(0.70 + (w - 1) * 0.025, Math.min(8, 6 + w - 1), 3)] }],
    })),
  },
  // Hepburn A: 8×2-3 прогрессией.
  "hepburn": {
    id: "hepburn", name: "Hepburn A", weeks: 4, trainingMaxFactor: 1.0,
    description: "8 подходов: старт 8×2 @ 80%, +1 повтор/нед до 8×3, затем +вес.",
    template: [1,2,3,4].map((w) => ({
      week: w,
      days: [
        { label: "Power", focus: `Нед${w}: 8×${Math.min(3, 2 + Math.floor((w - 1) / 2))}`, sets: [r(0.80, Math.min(3, 2 + Math.floor((w - 1) / 2)), 8)] },
        { label: "Pump", focus: `Нед${w}: 3×6`, sets: [r(0.60, 6, 3)] },
      ],
    })),
  },
  // Super-squats: 20-rep breathing squats + линейная прогрессия.
  "super_squats": {
    id: "super_squats", name: "Super Squats (20-rep)", weeks: 6, trainingMaxFactor: 1.0,
    description: "1 рабочий сет 20 повторений (дыхательные приседания) + линейная +2.5%/нед.",
    template: [1,2,3,4,5,6].map((w) => ({
      week: w,
      days: [
        { label: "20-rep squat", focus: `Нед${w}: 1×20 @ ${Math.round((0.50 + (w - 1) * 0.025) * 100)}%`, sets: [r(0.50 + (w - 1) * 0.025, 20, 1)] },
        { label: "Assistance", focus: `Нед${w}: 3×10`, sets: [r(0.60, 10, 3)] },
      ],
    })),
  },
};

export interface GeneratedWorkSet { pct: number; reps: number; sets: number; weight: number; }
export interface GeneratedDay { label: string; focus: string; sets: GeneratedWorkSet[]; }
export interface GeneratedWeek { week: number; days: GeneratedDay[]; trainingMax: number; }

export function getScheme(id: ProgressionSchemeId): ProgressionScheme | undefined { return PROGRESSION_SCHEMES[id]; }
export function listSchemes(): { id: ProgressionSchemeId; name: string; weeks: number }[] {
  return (Object.keys(PROGRESSION_SCHEMES) as ProgressionSchemeId[]).map(id => ({ id, name: PROGRESSION_SCHEMES[id].name, weeks: PROGRESSION_SCHEMES[id].weeks }));
}

/** Сгенерировать недели с расчётными весами (вес = TM × pct, TM = e1RM × factor). */
export function generateProgression(id: ProgressionSchemeId, e1RM: number): GeneratedWeek[] | null {
  const scheme = PROGRESSION_SCHEMES[id];
  if (!scheme || e1RM <= 0) return null;
  const tm = e1RM * scheme.trainingMaxFactor;
  return scheme.template.map(wk => ({
    week: wk.week,
    trainingMax: Math.round(tm * 10) / 10,
    days: wk.days.map(d => ({
      label: d.label, focus: d.focus,
      sets: d.sets.map(s => ({ pct: s.pct, reps: s.reps, sets: s.sets, weight: Math.round(tm * s.pct * 10) / 10 })),
    })),
  }));
}
