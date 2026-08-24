/**
 * bb-insulin-window.engine.ts — инсулиновое памп-окно (GH+insulin синергия).
 *
 * Активируется только при GH+insulin вместе (PMC5723243: GH→IGF-1 через печень только при высоком инсулине).
 * Не ломает тяж-дни: меняет только памп/лёг дни (подсказка intra-carbs + лёгкий акцент).
 * Heavy дни остаются тяжёлыми, но получают peri-WO нутриент-подсказку.
 */
import type { BBPlan } from './bb-builder.engine';

export interface InsulinWindowInput {
  hasGH: boolean; ghDose?: number;
  hasInsulin: boolean; insulinDose?: number;
  hasAAS?: boolean;
}

export function insulinWindowActive(input: InsulinWindowInput): boolean {
  return !!input.hasGH && !!input.hasInsulin && (input.ghDose ?? 0) >= 2 && (input.insulinDose ?? 0) >= 5;
}

export function insulinWindowRationale(input: InsulinWindowInput): string | null {
  if (!insulinWindowActive(input)) return null;
  return `💉 GH ${input.ghDose}МЕ + инсулин ${input.insulinDose}МЕ — pump window активно: intra 30-60г + 10г EAA, памп-дни 15-20, BFR опционально`;
}

export function applyInsulinWindowToPlan(plan: BBPlan, input: InsulinWindowInput): BBPlan {
  if (!insulinWindowActive(input)) return plan;
  const copy: BBPlan = {
    ...plan,
    weeks: plan.weeks.map(w => ({ ...w, sessions: w.sessions.map(s => ({ ...s, exercises: s.exercises.map(e => ({ ...e, workSets: [...e.workSets] })) })) })),
    rationale: [...plan.rationale],
  };
  const intraNote = '💉 Insulin window: intra 30-60г быстрых + 10г EAA (GH+insulin синергия)';
  for (const w of copy.weeks) {
    if ((w as any).deload || (w as any).phase === 'deload') continue;
    for (const s of w.sessions) {
      // Только памп/лёг — тяж не трогаем
      if (s.character !== 'памп' && s.character !== 'лёг') continue;
      for (const ex of s.exercises) {
        if (!ex.comment) ex.comment = '';
        if (!ex.comment.includes('Insulin window')) {
          ex.comment = `${ex.comment} | ${intraNote}`.trim().replace(/^\|\s*/, '');
        }
      }
    }
    // Тяж-дни — только peri-WO заметка в rationale, без переписывания
  }
  copy.rationale.push(intraNote + ' (тяж-дни сохранены, памп-дни получили подсказку)');
  return copy;
}
