import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';

function firstGripSupportWeight(p: any, weekIdx: number): number {
  const wk = p.weeks[weekIdx];
  for (const s of wk.sessions) {
    const ex = s.exercises.find((e: any) => e.muscle === 'grip_support');
    if (ex) return ex.workSets[0].weight;
  }
  throw new Error('no grip_support');
}

// Ручной мини-план: столовая + Support (4 упр, не стол) — детерминирован,
// RNG билдера не участвует. Обе недели accumulation, не делоад.
function handPlan(discipline: string, snapshot: any): any {
  const supportEx = (muscle: string) => ({
    muscle, name: muscle, role: 'accessory', character: 'памп',
    sets: 2, repsRange: [10, 12], rir: 2,
    workSets: [{ reps: 10, rir: 2, weight: 0 }, { reps: 10, rir: 2, weight: 0 }],
  });
  const mkWeek = (week: number) => ({
    week, phase: 'accumulation', deload: false, sessions: [
      {
        day: 1, weekOffset: week - 1, character: 'тяж', sessionTag: 'TableHeavy', tableTime: true,
        exercises: [supportEx('wrist_flexors'), supportEx('brachialis')],
      },
      {
        day: 4, weekOffset: week - 1, character: 'памп', sessionTag: 'Support', tableTime: false,
        exercises: [supportEx('back_pressure'), supportEx('side_pressure'), supportEx('shoulder_stab'), supportEx('core_anchor')],
      },
    ],
  });
  return {
    pattern: { id: 'hand', name: 'hand' }, level: 'intermediate', discipline,
    weeks: [mkWeek(1), mkWeek(2)], rationale: [], inputSnapshot: snapshot,
  };
}

describe('arm-cycle-r8 (weekly pct + table floor)', () => {
  it('без correctionPct веса стоят понедельно (байт-в-байт)', () => {
    const p: any = buildArmPlan({ discipline: 'armlifting', patternId: 'grip_3_support', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 8 });
    // w1 и w3 — обе accumulation/тяж: один и тот же вес
    expect(firstGripSupportWeight(p, 2)).toBe(firstGripSupportWeight(p, 0));
    expect(p.rationale.some((l: string) => /Прогрессия весов/.test(l))).toBe(false);
  });
  it('correctionPct 2: вес растёт внутри цикла (~1.02^(w-1))', () => {
    const p: any = buildArmPlan({ discipline: 'armlifting', patternId: 'grip_3_support', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 8, correctionPct: 2 } as any);
    const w1 = firstGripSupportWeight(p, 0);
    const w3 = firstGripSupportWeight(p, 2);
    expect(w3).toBeGreaterThan(w1);
    expect(w3).toBeCloseTo(w1 * Math.pow(1.02, 2), 1);
    expect(p.rationale.some((l: string) => /Прогрессия весов \+2%\/нед/.test(l))).toBe(true);
    for (const wk of p.weeks) for (const s of wk.sessions) for (const e of s.exercises) expect(e.sets).toBe(e.workSets.length);
  });
  it('table-floor: kuznica (2×) дотягивает Support до TableTech', () => {
    const p: any = finalizeArmPlan(handPlan('armwrestling', { cycleId: 'kuznica_6_8' }), { level: 'intermediate' });
    for (const wk of p.weeks) {
      expect(wk.sessions.filter((s: any) => s.tableTime).length).toBeGreaterThanOrEqual(2);
      expect(wk.sessions.some((s: any) => s.sessionTag === 'TableTech')).toBe(true);
    }
    expect(p.rationale.some((l: string) => /цикл .* просит стол/.test(l))).toBe(true);
  });
  it('table-floor: без цикла Support не трогается (байт-в-байт)', () => {
    const p: any = finalizeArmPlan(handPlan('armwrestling', {}), { level: 'intermediate' });
    for (const wk of p.weeks) {
      expect(wk.sessions.filter((s: any) => s.tableTime).length).toBe(1);
      expect(wk.sessions.some((s: any) => s.sessionTag === 'TableTech')).toBe(false);
    }
    expect(p.rationale.some((l: string) => /просит стол/.test(l))).toBe(false);
  });
  it('table-floor: чистый armlifting скипается (стол другой природы)', () => {
    const p: any = finalizeArmPlan(handPlan('armlifting', { cycleId: 'kuznica_6_8' }), { level: 'intermediate' });
    for (const wk of p.weeks) {
      expect(wk.sessions.some((s: any) => s.sessionTag === 'TableTech')).toBe(false);
    }
    expect(p.rationale.some((l: string) => /просит стол/.test(l))).toBe(false);
  });
});
