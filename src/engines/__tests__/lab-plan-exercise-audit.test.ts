/**
 * lab-plan-exercise-audit.test.ts — Epic D: аудит портфеля + score + травмы в safety.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  auditLabPlan,
  calcLabScore,
  labSafetyFlags,
  loadLabPlanFromStorage,
} from '../lab-plan-exercise-audit.engine';

function planWith(names: string[]) {
  return {
    weeks: [
      {
        sessions: [
          {
            exercises: names.map((name, i) => ({
              // audit резолвит каталог по exerciseName (id) или name
              exerciseName: name,
              name,
              muscle: 'chest',
              sets: 3,
              rir: 2,
            })),
          },
        ],
      },
    ],
  };
}

describe('lab-plan-exercise-audit', () => {
  beforeEach(() => {
    localStorage.removeItem('he_bb_plan_saved');
    localStorage.removeItem('he_bb_plans');
  });

  it('null без плана', () => {
    expect(auditLabPlan(null)).toBeNull();
    expect(auditLabPlan({})).toBeNull();
    expect(auditLabPlan({ weeks: [] })).toBeNull();
  });

  it('агрегаты на реальном портфеле: avgSfr задан, lengthened 0..1', () => {
    const r = auditLabPlan(planWith(['bench_bar', 'incline_db', 'fly_db']));
    expect(r).not.toBeNull();
    expect(r!.totalExercises).toBe(3);
    expect(r!.totalSets).toBe(9);
    expect(r!.audit.avgSfr).not.toBeNull();
    expect(r!.audit.lengthenedRatio).toBeGreaterThanOrEqual(0);
    expect(r!.audit.lengthenedRatio).toBeLessThanOrEqual(1);
  });

  it('покрытия присутствуют по мышце (углы/strict/подрегионы)', () => {
    const r = auditLabPlan(planWith(['bench_bar', 'incline_db']));
    const m = r!.audit.byMuscle['chest'];
    expect(m).toBeTruthy();
    expect(m.angleCoverage.total).toBeGreaterThan(0);
    expect(m.regionalCoverage.total).toBeGreaterThan(0);
    expect(Number.isFinite(r!.audit.fatigueDensity)).toBe(true);
  });

  it('labScore 0–100 и монотинен: хороший портфель выше плохого', () => {
    const good = auditLabPlan(planWith(['fly_db', 'incline_db', 'pullup']));
    const bad = auditLabPlan(planWith(['bench_bar', 'bench_bar', 'dips_chest']));
    expect(good!.labScore).toBeGreaterThanOrEqual(0);
    expect(good!.labScore).toBeLessThanOrEqual(100);
    expect(good!.labScore).toBeGreaterThan(bad!.labScore);
  });

  it('calcLabScore: нет данных SFR → −10, но не ниже 0', () => {
    const r = auditLabPlan(planWith(['no_such_exercise_xyz']));
    expect(r!.audit.avgSfr).toBeNull();
    expect(r!.labScore).toBeLessThanOrEqual(90);
    expect(r!.labScore).toBeGreaterThanOrEqual(0);
    expect(calcLabScore(r!.audit)).toBe(r!.labScore);
  });

  it('safety без травм — тишина (blocked=false везде)', () => {
    const flags = labSafetyFlags(
      [{ id: 'dips_chest', name: 'Брусья' }],
      [],
    );
    expect(flags).toHaveLength(1);
    expect(flags[0].blocked).toBe(false);
  });

  it('safety с травмой: dips_chest (плечо high) + «импинджмент» → blocked', () => {
    const flags = labSafetyFlags([{ id: 'dips_chest', name: 'Брусья' }], ['импинджмент']);
    expect(flags[0].blocked).toBe(true);
    expect(flags[0].notes.join(' ')).toMatch(/щадящий/);
  });

  it('loadLabPlanFromStorage читает he_bb_plan_saved (план внутри .plan)', () => {
    const plan = planWith(['bench_bar']);
    localStorage.setItem('he_bb_plan_saved', JSON.stringify({ plan }));
    expect(loadLabPlanFromStorage()).toEqual(plan);
  });

  it('loadLabPlanFromStorage: битый стор и пусто → null', () => {
    localStorage.setItem('he_bb_plan_saved', '{broken');
    expect(loadLabPlanFromStorage()).toBeNull();
  });
});
