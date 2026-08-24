import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { applyDUP } from '../strength-sport-dup';
import { applyIntensity } from '../strength-sport-intensity';
import { lengthenedBonus } from '../strength-sport-bonus';
import { warmupRampFor } from '../strength-sport-warmup';

describe('strength DUP/intensity/bonus/warmup', () => {
  it('DUP heavy_light flips RIR', () => {
    const plan = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{snatch:70} });
    const before = plan.weeksData[0].sessions[0].exercises[0].rir;
    applyDUP(plan, 'heavy_light');
    const afterHeavy = plan.weeksData[0].sessions[0].exercises[0].rir;
    const afterLight = plan.weeksData[0].sessions[1].exercises[0].rir;
    expect(afterHeavy).not.toBe(afterLight);
    expect(typeof before).toBe('number');
  });
  it('cluster adds comment', () => {
    const plan = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{snatch:70, cleanJerk:90, backSquat:120} });
    applyIntensity(plan, 'cluster');
    const hasCluster = plan.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> e.comment?.includes('Cluster'))));
    expect(hasCluster).toBe(true);
  });
  it('lengthenedBonus', () => {
    expect(lengthenedBonus('rdl')).toBe(10);
    expect(lengthenedBonus('bench_bar')).toBe(0);
  });
  it('warmup ramp', () => {
    const w = warmupRampFor(100);
    expect(w.length).toBeGreaterThanOrEqual(3);
    expect(w[0].weight).toBeLessThan(100);
  });
  it('dup via builder input', () => {
    const p = buildStrengthSportPlan({ mode:'weightlifting', goal:'strength', level:'intermediate', weeks:2, daysPerWeek:3, workMax:{}, dupMode:'heavy_light' });
    expect(p.weeksData.length).toBe(2);
  });
});
