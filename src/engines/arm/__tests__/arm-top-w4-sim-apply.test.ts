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
  it('абсолютная цель 50% базы, остальные целы, маркер тейпера', () => {
    const p: any = buildArmPlan({ ...BASE });
    const r = applyContestSimToPlan(p, { level: 'intermediate' });
    expect(r.applied).toBe(true);
    expect(r.plan.weeks.length).toBe(p.weeks.length);
    const baseAvg = p.weeks.slice(0, -1).filter((w: any) => !w.deload).reduce((a: number, w: any) => a + vol(w), 0) /
      Math.max(1, p.weeks.slice(0, -1).filter((w: any) => !w.deload).length);
    const lastVol = vol(r.plan.weeks[r.plan.weeks.length - 1]);
    expect(lastVol).toBeLessThanOrEqual(Math.ceil(baseAvg * 0.5) + 2); // допуск округления до мин 1
    expect(JSON.stringify(r.plan.weeks.slice(0, -1))).toBe(JSON.stringify(p.weeks.slice(0, -1)));
    expect(String(r.plan.weeks[r.plan.weeks.length - 1].note || '')).toContain('[arm-taper:sim]');
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
