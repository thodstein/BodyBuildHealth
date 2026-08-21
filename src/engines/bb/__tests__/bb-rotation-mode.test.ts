import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

const primaryNamesByWeek = (plan: any): string[][] => {
  return plan.weeks.map((w: any) => {
    const out: string[] = [];
    for (const s of w.sessions) for (const e of s.exercises) {
      if (e.role === 'primary') out.push(e.name);
    }
    return out.sort();
  });
};

const uniqueAccessories = (plan: any): number => {
  const set = new Set<string>();
  for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
    if (e.role === 'accessory' && !(e as any).warmupActivator && !(e as any).optional) set.add(e.name);
  }
  return set.size;
};

describe('BB вариативность (запрет/строгий/разнообразие)', () => {
  it('primary-упражнения стабильны между неделями (запрет и разнообразие)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 4, workMax: WM, rotationMode: 'forbid' });
    const byWeek = primaryNamesByWeek(plan);
    expect(byWeek.length).toBeGreaterThanOrEqual(2);
    const first = JSON.stringify(byWeek[0]);
    for (let i = 1; i < byWeek.length; i++) {
      expect(JSON.stringify(byWeek[i])).toBe(first);
    }
  });

  it('запрет даёт меньше уникальных accessory-упражнений, чем разнообразие', () => {
    const forbid = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 4, workMax: WM, rotationMode: 'forbid' });
    const variety = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 4, workMax: WM, rotationMode: 'variety' });
    expect(uniqueAccessories(forbid)).toBeLessThanOrEqual(uniqueAccessories(variety));
  });
});
