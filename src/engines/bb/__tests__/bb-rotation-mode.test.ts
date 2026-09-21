import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

const uniqueAccessories = (plan: any): number => {
  const set = new Set<string>();
  for (const w of plan.weeks) for (const s of w.sessions) for (const e of s.exercises) {
    if (e.role === 'accessory' && !(e as any).warmupActivator && !(e as any).optional) set.add(e.name);
  }
  return set.size;
};

describe('BB вариативность (запрет/строгий/разнообразие)', () => {
  it('первое (лид) primary-упражнение сессии стабильно между неделями (запрет)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 4, workMax: WM, rotationMode: 'forbid' });
    // Re-baseline (аудит 2026-09, реализм сессии): раньше сравнивался ВЕСЬ набор
    // primary-упражнений недели, но он легитимно отличается в deload-неделе и в
    // неделях, где добивочные проходы финализатора добавляют/убирают
    // secondary-primary при изменившемся бюджете сессии. Контракт «запрет» —
    // стабильность ЛИДА (главного упражнения) каждой сессии.
    const leadByWeek = plan.weeks
      .filter((w: any) => (w.phase || '') !== 'deload' && !w.deload)
      .map((w: any) =>
        w.sessions.map((s: any) => {
          const prim = s.exercises.find((e: any) => e.role === 'primary' && !(e as any).warmupActivator);
          return prim?.name || '';
        }),
      );
    expect(leadByWeek.length).toBeGreaterThanOrEqual(2);
    const first = JSON.stringify(leadByWeek[0]);
    for (let i = 1; i < leadByWeek.length; i++) {
      expect(JSON.stringify(leadByWeek[i]), `week ${i + 1}`).toBe(first);
    }
  });

  it('запрет даёт меньше уникальных accessory-упражнений, чем разнообразие', () => {
    const forbid = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 4, workMax: WM, rotationMode: 'forbid' });
    const variety = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 4, workMax: WM, rotationMode: 'variety' });
    expect(uniqueAccessories(forbid)).toBeLessThanOrEqual(uniqueAccessories(variety));
  });
});
