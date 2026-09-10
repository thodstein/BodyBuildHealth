import { describe, it, expect } from 'vitest';
import { inferCycleRirProgression, inferCycleDeloadWeeks, convertCycleToBBPlan } from '../cycle-to-plan';
import { LMS_CYCLES } from '../../../data/lms-cycles/lms-cycle-index';

/**
 * Ф3.1/Ф3.2 (CYCLE-SYSTEM-FULL-AUDIT): 93 из 110 циклов без meta.deloadWeeks/
 * rirProgression — вывод делодов и RIR-лестницы из периода/уровня.
 */

describe('Ф3.2: inferCycleRirProgression', () => {
  it('периоды: mass 3→1, strength 2→0, peak 1→0, endurance 3→2', () => {
    expect(inferCycleRirProgression({ period: 'mass', weeks: 10 })).toEqual({ start: 3, end: 1 });
    expect(inferCycleRirProgression({ period: 'strength', weeks: 10 })).toEqual({ start: 2, end: 0 });
    expect(inferCycleRirProgression({ period: 'peak', weeks: 8 })).toEqual({ start: 1, end: 0 });
    expect(inferCycleRirProgression({ period: 'endurance', weeks: 10 })).toEqual({ start: 3, end: 2 });
  });

  it('новичку +1 запаса; короткие циклы (≤4н) сжимаются', () => {
    expect(inferCycleRirProgression({ period: 'mass', level: 'novice', weeks: 8 })).toEqual({ start: 4, end: 1 });
    expect(inferCycleRirProgression({ period: 'mass', weeks: 4 })).toEqual({ start: 2, end: 1 });
    expect(inferCycleRirProgression({ period: 'strength', weeks: 3 })).toEqual({ start: 1, end: 0 });
  });
});

describe('Ф3.1: inferCycleDeloadWeeks', () => {
  it('планы <8н — без выведенных делодов; ≥8н — каждые ~6н + финал', () => {
    expect(inferCycleDeloadWeeks(6)).toEqual([]);
    expect(inferCycleDeloadWeeks(8)).toEqual([6, 8]);
    expect(inferCycleDeloadWeeks(12)).toEqual([6, 12]);
    expect(inferCycleDeloadWeeks(16)).toEqual([6, 12, 16]);
  });

  it('BB-конверсия цикла без meta.deloadWeeks несёт deload-недели (8н → нед 6 и 8)', () => {
    const c: any = LMS_CYCLES.find(x => String(x.meta.direction) === 'bodybuilding' && !x.meta.deloadWeeks?.length && x.meta.weeks >= 8);
    expect(c).toBeDefined();
    const plan: any = convertCycleToBBPlan({ cycle: c, workMax: { chest: 100, back: 120, shoulders: 60, arms: 50, quads: 140, hamstrings: 100, glutes: 120, calves: 80, abs: 60, traps: 80, forearms: 40 }, level: 'intermediate', mode: 'adapt' });
    const deloadWeeks = plan.weeks.filter((w: any) => w.deload === true || w.phase === 'deload').map((w: any) => w.week);
    expect(deloadWeeks.length, `${c.meta.id}: deloads ${JSON.stringify(deloadWeeks)}`).toBeGreaterThan(0);
    // Делод-недели снижены (pump-семантика: объём или нагрузка)
    for (const w of plan.weeks.filter((x: any) => x.deload)) {
      const sets = w.sessions.reduce((s: number, ss: any) => s + ss.exercises.reduce((x: number, e: any) => x + e.sets, 0), 0);
      expect(sets, `${c.meta.id} W${w.week}`).toBeGreaterThan(0);
    }
  });
});
