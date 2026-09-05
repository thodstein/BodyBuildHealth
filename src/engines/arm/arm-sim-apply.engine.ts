/**
 * arm-sim-apply.engine.ts — TOP wave-4: contest-sim применяется к плану.
 *
 * Берёт готовый ArmPlan и превращает ПОСЛЕДНЮЮ неделю в sim-неделю:
 * характер сессий → техника, сеты ×0.5 (мин 1, workSets режутся синхронно —
 * инвариант sets===workSets.length цел), RIR+2, судейская процедура и чеклист
 * в note недели/сессий. Остальные недели побайтово не трогаются.
 * Короткий план (<2 нед) — честный no-op с предупреждением.
 */

import { buildContestSimWeek } from './arm-contest-sim.engine';

export interface SimApplyInput {
  level?: string;
  discipline?: string;
  strapExpected?: boolean;
  foulIds?: string[];
  targetKg?: number;
  supermatch?: boolean;
}

export interface SimApplyResult {
  plan: any;
  applied: boolean;
  simNote: string;
  attempts: number[];
  warning: string | null;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/** Применить contest-sim к последней неделе плана (возвращает новый план). */
export function applyContestSimToPlan(plan: any, input: SimApplyInput = {}): SimApplyResult {
  const sim = buildContestSimWeek({
    level: (input as any).level,
    discipline: (input as any).discipline,
    strapExpected: !!(input as any).strapExpected,
    foulIds: (input as any).foulIds,
    targetKg: Number((input as any).targetKg ?? NaN),
    supermatch: !!(input as any).supermatch,
  });
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length < 2) {
    return { plan, applied: false, simNote: sim.note, attempts: sim.attempts, warning: 'Contest-sim пропущен: план короче 2 недель — нечего репетировать.' };
  }
  const next = clone(plan);
  const last = next.weeks[next.weeks.length - 1];
  const simDays = sim.days;
  last.taper = true;
  last.note = `Contest-sim: ${sim.note} Чеклист: ${sim.checklist.join(' · ')}`;
  last.sessions.forEach((sess: any, si: number) => {
    sess.character = 'техника';
    const day = simDays[si % simDays.length];
    sess.note = `${day.title}: ${day.steps[0]}`;
    for (const ex of sess.exercises || []) {
      const sets = Math.max(1, Math.round(Number(ex.sets || 1) * 0.5));
      ex.sets = sets;
      if (Array.isArray(ex.workSets)) ex.workSets = ex.workSets.slice(0, sets);
      ex.rir = Math.min(5, Number(ex.rir || 0) + 2);
      for (const ws of ex.workSets || []) ws.rir = Math.min(5, Number((ws as any).rir || 0) + 2);
      ex.comment = `Contest-sim (${day.title}) · ${ex.comment || ''}`.trim();
    }
  });
  if (!Array.isArray(next.rationale)) next.rationale = [];
  next.rationale.push(`Contest-sim: последняя неделя — генеральная репетиция (${sim.note})`);
  if (sim.attempts.length) next.rationale.push(`Contest-sim попытки: ${sim.attempts.join(' / ')} кг.`);
  return { plan: next, applied: true, simNote: sim.note, attempts: sim.attempts, warning: null };
}
