import { describe, it, expect } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { getVolumeLandmarks } from '../../volume-landmarks.engine';

/**
 * Аудит 2026-11 (BB-17): файл был диагностической пробой без единой проверки
 * (`expect(true).toBe(true)`) — 12-недельный PPL собирался «вхолостую» и не ловил
 * ни регрессий формы плана, ни рассинхрона sets/workSets. Теперь это инвариант-тест.
 */

const WM = {
  chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 110,
  glutes: 120, biceps: 50, triceps: 55, calves: 80, traps: 70, forearms: 40,
  delt_front: 45, delt_mid: 45, delt_rear: 40, abs: 50, lower_back: 90,
};

describe('G1 attribution invariants (12-недельный PPL)', () => {
  const p: any = buildBBPlan({
    patternId: 'ppl_6', level: 'intermediate', trainingYears: 4, goal: 'mass',
    weeks: 12, workMax: WM, weakPoints: [], volumeGoal: 'mav',
  } as any);
  const actual = (m: string) => p.weeks[0].sessions
    .flatMap((s: any) => s.exercises)
    .filter((e: any) => e.muscle === m && !(e as any).warmupActivator)
    .reduce((a: number, e: any) => a + (e.sets || 0), 0);

  it('все 12 недель собраны и не пусты', () => {
    expect(p.weeks).toHaveLength(12);
    for (const w of p.weeks) {
      expect(w.sessions.length).toBeGreaterThan(0);
      for (const s of w.sessions) expect(s.exercises.length).toBeGreaterThan(0);
    }
  });

  it('sets совпадает с числом рабочих сетов в каждой неделе', () => {
    for (const w of p.weeks) {
      for (const s of w.sessions) {
        for (const e of s.exercises) {
          expect(Array.isArray(e.workSets)).toBe(true);
          expect(e.workSets.length).toBe(e.sets);
        }
      }
    }
  });

  it('канонические группы получают объём в неделе 1', () => {
    expect(actual('chest')).toBeGreaterThan(0);
    expect(actual('back')).toBeGreaterThan(0);
    expect(actual('quads')).toBeGreaterThan(0);
  });

  it('неделя 1 не превышает MRV по канону больше допуска', () => {
    // BB_MRV_TOLERANCE = 1.15 — единый допуск канона (bb-volume.engine).
    for (const m of ['chest', 'back', 'quads', 'hamstrings', 'biceps', 'triceps', 'calves']) {
      const mrv = getVolumeLandmarks('intermediate', m)?.mrv ?? 0;
      if (!mrv) continue;
      expect(actual(m)).toBeLessThanOrEqual(Math.ceil(mrv * 1.15));
    }
  });
});
