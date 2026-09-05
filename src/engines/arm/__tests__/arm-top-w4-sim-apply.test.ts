import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { applyContestSimToPlan } from '../arm-sim-apply.engine';

const BASE: any = {
  discipline: 'armwrestling',
  patternId: 'arm_4_upper_lower',
  level: 'intermediate',
  goal: 'strength',
  technique: 'balanced',
  weeks: 6,
};

const vol = (wk: any) => wk.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((aa: number, e: any) => aa + e.sets, 0), 0);

describe('arm TOP wave-4 sim-apply', () => {
  it('последняя неделя ужата, остальные целы', () => {
    const p: any = buildArmPlan({ ...BASE });
    const before = vol(p.weeks[p.weeks.length - 1]);
    const r = applyContestSimToPlan(p, { level: 'intermediate' });
    expect(r.applied).toBe(true);
    expect(r.plan.weeks.length).toBe(p.weeks.length);
    expect(vol(r.plan.weeks[r.plan.weeks.length - 1])).toBeLessThan(before);
    expect(JSON.stringify(r.plan.weeks.slice(0, -1))).toBe(JSON.stringify(p.weeks.slice(0, -1)));
  });
  it('инвариант sets===workSets.length + RIR+2', () => {
    const p: any = buildArmPlan({ ...BASE });
    const r = applyContestSimToPlan(p, {});
    for (const s of r.plan.weeks[r.plan.weeks.length - 1].sessions) {
      expect(s.character).toBe('техника');
      for (const e of s.exercises) {
        expect(e.workSets.length).toBe(e.sets);
        expect(String(e.comment)).toMatch(/Contest-sim/);
      }
    }
    expect(r.plan.rationale.join(' ')).toMatch(/Contest-sim/);
  });
  it('armlifting даёт попытки', () => {
    const p: any = buildArmPlan({ ...BASE, discipline: 'armlifting', patternId: 'grip_3_support', workMax: { grip_support: 100 } });
    const r = applyContestSimToPlan(p, { discipline: 'armlifting', targetKg: 100 });
    expect(r.attempts).toEqual([90, 96, 102]);
  });
  it('короткий план — честный no-op', () => {
    const p: any = buildArmPlan({ ...BASE, weeks: 1 });
    const r = applyContestSimToPlan(p, {});
    expect(r.applied).toBe(false);
    expect(r.warning).toMatch(/короче 2 недель/);
  });
  it('билдер с contestSim применяет sim', () => {
    const p: any = buildArmPlan({ ...BASE, contestSim: true });
    const last = p.weeks[p.weeks.length - 1];
    expect(last.taper).toBe(true);
    expect(String(last.note || '')).toMatch(/Contest-sim/);
  });
});
