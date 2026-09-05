/**
 * arm-sim-apply.engine.ts — TOP wave-4/wave-9: contest-sim применяется к плану.
 *
 * Берёт готовый ArmPlan и превращает ПОСЛЕДНЮЮ неделю в sim-неделю:
 * характер сессий → техника, объём → 50% от средней рабочей недели
 * (абсолютная цель, wave-9: НЕ повторная половинка — иначе складывается
 * с peaking-weekMult 0.45 и годовым тейпером в двойной делод), RIR+2,
 * судейская процедура и чеклист в note недели/сессий.
 * Инвариант sets===workSets.length цел. Остальные недели побайтово не трогаются.
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
  // Wave-9: абсолютная цель 50% от средней рабочей недели (без делодов) —
  // не зависит от того, порезана ли последняя неделя тейпером/пиком до нас.
  const baseWeeks = next.weeks.slice(0, -1).filter((w: any) => !w.deload);
  const baseTotal = baseWeeks.length
    ? baseWeeks.reduce((a: number, w: any) => a + (w.sessions || []).reduce((x: number, s: any) => x + (s.exercises || []).reduce((y: number, e: any) => y + (Number(e.sets) || 0), 0), 0), 0) / baseWeeks.length
    : 0;
  const lastTotal = (last.sessions || []).reduce((x: number, s: any) => x + (s.exercises || []).reduce((y: number, e: any) => y + (Number(e.sets) || 0), 0), 0);
  const factor = lastTotal > 0 && baseTotal > 0 ? Math.min(1, (baseTotal * 0.5) / lastTotal) : 0.5;
  last.taper = true;
  // Wave-9: маркер идемпотентности тейпера — годовой applyArmTaperToWeeks пропускает
  // sim-неделю сам (она и есть пик, резать её тейпер-кривой поверх = двойной делод).
  last.note = `Contest-sim: ${sim.note} Чеклист: ${sim.checklist.join(' · ')} [arm-taper:sim]`;
  last.sessions.forEach((sess: any, si: number) => {
    sess.character = 'техника';
    const day = simDays[si % simDays.length];
    sess.note = `${day.title}: ${day.steps[0]}`;
    for (const ex of sess.exercises || []) {
      const sets = Math.max(1, Math.round(Number(ex.sets || 1) * factor));
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
