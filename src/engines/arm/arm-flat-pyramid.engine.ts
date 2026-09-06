/**
 * arm-flat-pyramid.engine.ts — Bompa Flat Pyramid для лифтов хвата.
 *
 * Источник: Bompa «Periodization Training for Sports» через climber arm-lifting
 * (Dan Beall / Yves Gravelle): рабочая зона 70–80% (3–5RM), схема
 * 3×5 → 5×5 → 7×5 на одном весе, затем +малый шаг (2.5 lb) и снова 5×5.
 * Короткие лифты 5–30с программируются как MaxHang/Density.
 *
 * Чистый модуль без импортов.
 */

export interface FlatPyramidState {
  weightKg: number;
  sets: number; // 3 | 5 | 7
  reps: number; // обычно 5
  stepKg: number; // малый шаг, дефолт 1
}

export interface FlatPyramidAdvice {
  prescription: string;
  next: FlatPyramidState;
  addWeight: boolean;
  note: string;
}

export function flatPyramidStep(state: FlatPyramidState, completedAllSets: boolean): FlatPyramidAdvice {
  const reps = Math.max(1, Math.round(state.reps || 5));
  const step = state.stepKg > 0 ? state.stepKg : 1;
  const w = Math.max(1, Number(state.weightKg || 0));
  if (!completedAllSets) {
    return {
      prescription: `${w} кг ${state.sets || 5}×${reps} — повторить вес (не все сеты закрыты)`,
      next: { weightKg: w, sets: state.sets || 5, reps, stepKg: step },
      addWeight: false,
      note: 'Flat pyramid: объём держится, вес не растёт до закрытия всех сетов.',
    };
  }
  const sets = state.sets || 5;
  if (sets < 5) {
    return {
      prescription: `${w} кг 5×${reps} — рост объёма`,
      next: { weightKg: w, sets: 5, reps, stepKg: step },
      addWeight: false,
      note: '3×5 → 5×5 на том же весе (Bompa).',
    };
  }
  if (sets < 7) {
    return {
      prescription: `${w} кг 7×${reps} — пик объёма`,
      next: { weightKg: w, sets: 7, reps, stepKg: step },
      addWeight: false,
      note: '5×5 → 7×5 на том же весе.',
    };
  }
  const nw = Math.round((w + step) * 10) / 10;
  return {
    prescription: `${nw} кг 5×${reps} — малый шаг +${step}`,
    next: { weightKg: nw, sets: 5, reps, stepKg: step },
    addWeight: true,
    note: '7×5 закрыт → сброс объёма до 5×5 с +шагом. Цикл повторяется 4–6 нед.',
  };
}

/** Стартовое состояние от 5RM (80–90% 1RM по Beall; 5RM ≈ 86–89% 1RM). */
export function flatPyramidFrom5Rm(fiveRmKg: number, stepKg = 1): FlatPyramidState {
  const w = Math.max(1, Number(fiveRmKg || 0));
  return { weightKg: Math.round(w * 10) / 10, sets: 3, reps: 5, stepKg: stepKg > 0 ? stepKg : 1 };
}
