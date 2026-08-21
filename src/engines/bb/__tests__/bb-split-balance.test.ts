import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';

const WM = { chest: 120, back: 130, shoulders: 70, biceps: 60, triceps: 65, quads: 150, hamstrings: 110, glutes: 150, calves: 90, abs: 70, traps: 90, forearms: 45 };

const weeklyDirect = (plan: any): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
    if ((e as any).warmupActivator) continue;
    out[e.muscle] = (out[e.muscle] || 0) + (e.sets || 0);
  }
  return out;
};

describe('BB корректность распределения в разных сплитах', () => {
  it('upper/lower: грудь не голодает против спины (co-main в Upper)', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 8, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'heavy' });
    const d = weeklyDirect(plan);
    // Грудь — со-главная со спиной: не менее ~50% объёма спины (не 18 при спине 51).
    expect(d.back).toBeGreaterThanOrEqual(d.chest);
    expect(d.chest).toBeGreaterThanOrEqual(Math.round(d.back * 0.5));
    // Бицепс не голодает (минимум ~4)
    expect(d.biceps).toBeGreaterThanOrEqual(4);
  });

  it('во всех сплитах нет превышения MRV, single-set, >5 сетов/упр', () => {
    const splits = ['fullbody_3', 'fullbody_4', 'upper_lower_4', 'ppl_6', 'bro_5', 'arnold_6', 'torso_limb_4', 'rolling_3_1_3_1'];
    for (const id of splits) {
      const plan = buildBBPlan({ patternId: id, level: 'enhanced', trainingYears: 8, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'heavy' });
      const mrv = (plan as any).mrvByMuscle || {};
      const d = weeklyDirect(plan);
      for (const [m, sets] of Object.entries(d)) {
        if (mrv[m] && sets > mrv[m]) throw new Error(`${id}: ${m} ${sets} > MRV ${mrv[m]}`);
      }
      for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
        if ((e as any).warmupActivator) continue;
        expect(e.sets).toBeGreaterThanOrEqual(2);
        expect(e.sets).toBeLessThanOrEqual(5);
      }
    }
  });
});
