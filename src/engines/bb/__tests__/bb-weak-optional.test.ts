import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';

const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

describe('BB слабые группы +1 optional упражнение без капа', () => {
  it('weakPoints добавляет +1 optional-упражнение слабой мышцы (не в MRV-кап)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM, weakPoints: ['biceps'] });
    const week = plan.weeks[0];
    // PPL-финишеры дельт тоже optional — ищем optional именно слабой мышцы.
    const bicepsOptional = week.sessions.flatMap(s => s.exercises)
      .filter((e: any) => (e as any).optional && e.muscle === 'biceps');
    expect(bicepsOptional.length).toBeGreaterThan(0);
    for (const e of bicepsOptional) {
      expect(e.muscle).toBe('biceps');
      expect(e.sets).toBeGreaterThanOrEqual(3);
    }
  });

  it('без weakPoints не добавляет optional-упражнений слабой мышцы', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM });
    let optionalCount = 0;
    for (const week of plan.weeks) for (const s of week.sessions) for (const e of s.exercises) {
      if ((e as any).optional && (e as any).rationale?.includes('слабая группа')) optionalCount++;
    }
    expect(optionalCount).toBe(0);
  });
});
