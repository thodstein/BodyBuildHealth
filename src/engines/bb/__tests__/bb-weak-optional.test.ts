import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

describe('BB слабые группы +1 optional упражнение без капа', () => {
  it('weakPoints добавляет +1 optional-упражнение слабой мышцы (не в MRV-кап)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, weakPoints: ['biceps'] });
    const week = plan.weeks[0];
    let optionalFound = false;
    for (const s of week.sessions) {
      for (const e of s.exercises) {
        if ((e as any).optional) {
          optionalFound = true;
          expect(e.muscle).toBe('biceps');
          expect(e.sets).toBeGreaterThanOrEqual(3);
          break;
        }
      }
    }
    expect(optionalFound).toBe(true);
  });

  it('без weakPoints не добавляет optional-упражнений', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM });
    let optionalCount = 0;
    for (const week of plan.weeks) for (const s of week.sessions) for (const e of s.exercises) {
      if ((e as any).optional) optionalCount++;
    }
    expect(optionalCount).toBe(0);
  });
});
