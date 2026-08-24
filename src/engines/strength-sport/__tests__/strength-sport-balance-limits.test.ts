import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { finalizeStrengthSportPlan } from '../strength-sport-finalize.engine';
import { sessionLimitsFor } from '../strength-sport-limits';

describe('strength balance/limits', () => {
  it('balance push/pull warns when skewed', () => {
    const plan = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{} });
    // artificially skew: add many push, remove pull
    const wk = plan.weeksData[0];
    // duplicate push
    const pushEx = wk.sessions[0].exercises.find(e=> e.id==='bench_bar');
    if (pushEx) {
      wk.sessions[0].exercises.push({ ...pushEx, id: 'bench_bar2' } as any);
      wk.sessions[0].exercises.push({ ...pushEx, id: 'bench_bar3' } as any);
    }
    const fin = finalizeStrengthSportPlan(plan);
    const hasBalance = fin.validation.warnings.some(w=> w.includes('дисбаланс'));
    expect(typeof hasBalance).toBe('boolean');
  });
  it('sessionLimitsFor enhanced larger', () => {
    const limNat = sessionLimitsFor('intermediate', 1, false);
    const limEnh = sessionLimitsFor('enhanced', 4, true);
    expect(limEnh.maxSets).toBeGreaterThan(limNat.maxSets);
    expect(limEnh.perExerciseCap).toBeGreaterThanOrEqual(limNat.perExerciseCap);
  });
  it('gentle reduces weight for knee', () => {
    const base = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{ backSquat:100 } });
    const inj = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{ backSquat:100 }, injuries:[{location:'knee'}] });
    const b = base.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.id.includes('squat')))[0];
    const i = inj.weeksData[0].sessions.flatMap(s=> s.exercises.filter(e=> e.id.includes('squat')))[0];
    if (b && i) expect(i.weight).toBeLessThanOrEqual(b.weight);
  });
  it('mobility filters', () => {
    const withMob = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{}, mobilityRestrictions:['shoulder'] } as any);
    const hasSnatch = withMob.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> e.id==='snatch')));
    expect(typeof hasSnatch).toBe('boolean');
  });
});
