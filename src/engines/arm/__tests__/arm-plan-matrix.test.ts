/**
 * arm-plan-matrix.test.ts — инварианты выдачи на полной матрице:
 * дисциплины × уровни × цели × техники (× недели/дни).
 * build → finalize → validate: без бросков, без пустых сессий/упражнений,
 * сеты/повторы/RIR/веса в допусках, валидация зелёная везде.
 */
import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { validateArmPlan } from '../arm-validator.engine';

const DISCS = ['armwrestling', 'armlifting', 'hybrid'];
const LEVELS = ['beginner', 'intermediate', 'advanced', 'enhanced'];
const GOALS = ['strength', 'hypertrophy', 'peaking', 'endurance', 'maintenance'];
const TECHS = ['balanced', 'hook', 'toproll', 'press'];

function checkPlan(p: any, tag: string, bad: string[]): void {
  p.validation = validateArmPlan(p, p.level);
  if (!p.validation.valid) bad.push(`${tag}: invalid ${(p.validation.errors || []).join('; ')}`);
  for (const w of p.weeks) {
    if (!w.sessions?.length) bad.push(`${tag}: week ${w.week} no sessions`);
    for (const s of w.sessions ?? []) {
      if (!s.exercises?.length) bad.push(`${tag}: w${w.week} ${s.sessionTag} no exercises`);
      for (const ex of s.exercises ?? []) {
        if (!(ex.sets >= 1)) bad.push(`${tag}: ${ex.name} sets=${ex.sets}`);
        if (!(ex.repsRange?.[0] >= 1 && ex.repsRange[0] <= ex.repsRange[1])) bad.push(`${tag}: ${ex.name} reps=${ex.repsRange}`);
        if (!(ex.rir >= 0 && ex.rir <= 5)) bad.push(`${tag}: ${ex.name} rir=${ex.rir}`);
        for (const ws of ex.workSets ?? []) {
          if (!Number.isFinite(ws.weight) || ws.weight < 0) bad.push(`${tag}: ${ex.name} bad weight ${ws.weight}`);
          if (!(ws.reps >= 1)) bad.push(`${tag}: ${ex.name} bad ws reps ${ws.reps}`);
        }
      }
    }
  }
}

function build(tag: string, opts: any): any {
  let p: any = null;
  try {
    p = buildArmPlan({ daysPerWeek: 4, weeks: 8, ...opts });
    p = finalizeArmPlan(p, { level: opts.level });
  } catch (e: any) {
    throw new Error(`${tag}: THROW ${e?.message}`);
  }
  return p;
}

describe('arm-plan-matrix', () => {
  it('240 планов: инварианты + валидация', () => {
    const bad: string[] = [];
    for (const discipline of DISCS) {
      for (const level of LEVELS) {
        for (const goal of GOALS) {
          for (const technique of TECHS) {
            const tag = `${discipline}/${level}/${goal}/${technique}`;
            checkPlan(build(tag, { discipline, level, goal, technique }), tag, bad);
          }
        }
      }
    }
    expect(bad.slice(0, 20)).toEqual([]);
  });
  it('границы: 2 нед / 6 дн в неделю', () => {
    const bad: string[] = [];
    for (const discipline of DISCS) {
      for (const level of LEVELS) {
        const t1 = `${discipline}/${level}/short`;
        checkPlan(build(t1, { discipline, level, goal: 'strength', technique: 'balanced', weeks: 2, daysPerWeek: 2 }), t1, bad);
        const t2 = `${discipline}/${level}/dense`;
        checkPlan(build(t2, { discipline, level, goal: 'strength', technique: 'balanced', weeks: 8, daysPerWeek: 6 }), t2, bad);
      }
    }
    expect(bad.slice(0, 20)).toEqual([]);
  });
});
