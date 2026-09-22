/**
 * pl-deload.test.ts — корректная вставка делода в PL-план по кнопке пользователя
 * (дельoad-мост: DeloadSchedulerTab / PeriodizationDesignerTab / Quality Hub).
 *
 * Контракт:
 *  - объём ×volumeMult (флор 1), RIR +rirShift, флаг недели `deload`;
 *  - соревновательные недели (meet/mock/post/taper) и уже-делоды не трогаются;
 *  - метрики дня/цикла пересчитываются (таблица = печать = графики);
 *  - пустой список недель → ближайшая подходящая от текущей;
 *  - входной план не мутируется, повторный клик идемпотентен.
 */
import { describe, expect, it } from 'vitest';
import { applyPLDeload, pickDeloadWeeks, planHasDeload } from '../lms-deload.engine';
import type { LMSBuildOutput, LMSPlanWeek } from '../lms-builder.engine';

const ex = (name: string, sets: number, rir: number, weight = 100, reps = 5, pct = 0.8) => ({
  name, group: 'Спина', coef: 1, mnosz: 1, pm: 150, rir,
  workSets: [{ weight, reps, pct, sets, rir }],
});

const day = (exs: ReturnType<typeof ex>[]) => ({
  exercises: exs as never,
  metrics: { tonnage: exs.reduce((s, e) => s + e.workSets[0].weight * e.workSets[0].reps * e.workSets[0].sets, 0), kpsh: 0, avgWeight: 0, relIntensity: 0, intFB: 0, uoi: 0, exerciseCount: exs.length } as never,
});

function week(n: number, opts: Partial<LMSPlanWeek> = {}): LMSPlanWeek {
  return {
    week: n,
    pmRow: { 'Присед': 200 },
    days: [day([ex('Присед', 4, 2), ex('Тяга', 3, 2)])] as never,
    ...opts,
  };
}

const mkPlan = (weeks: LMSPlanWeek[]): LMSBuildOutput => ({
  template: { meta: { title: 'Тест', weeks: weeks.length } } as never,
  progressionRationale: 'База.',
  weeks,
  cycleMetrics: { tonnage: 0, kpsh: 0, avgWeight: 0, relIntensity: 0, intFB: 0, uoi: 0, sessions: 0, perSession: [] } as never,
});

describe('applyPLDeload — корректный делод по кнопке', () => {
  it('объём ×0.5, RIR +3, флаг deload, метрики пересчитаны, вес/pct сохранены', () => {
    const plan = mkPlan([week(1), week(2), week(3)]);
    const beforeTonnage = plan.weeks[1].days[0].metrics.tonnage;
    const res = applyPLDeload(plan, { weeks: [2], volumeMult: 0.5, rirShift: 3 });
    expect(res.applied).toEqual([2]);
    const w2 = res.plan.weeks[1];
    expect(w2.deload).toBe(true);
    expect(w2.days[0].exercises[0].workSets[0].sets).toBe(2);
    expect(w2.days[0].exercises[0].workSets[0].rir).toBe(5);
    expect(w2.days[0].exercises[0].rir).toBe(5);
    // интенсивность (вес/pct) не тронута
    expect(w2.days[0].exercises[0].workSets[0].weight).toBe(100);
    expect(w2.days[0].exercises[0].workSets[0].pct).toBe(0.8);
    // метрики пересчитаны
    expect(res.plan.weeks[1].days[0].metrics.tonnage).toBeLessThan(beforeTonnage);
    // rationale честный
    expect(res.plan.progressionRationale).toContain('Делод: нед 2');
    expect(res.notes[0]).toContain('объём ×0.5');
    // нетронутые недели — те же объекты
    expect(res.plan.weeks[0]).toBe(plan.weeks[0]);
    expect(res.plan.weeks[2]).toBe(plan.weeks[2]);
  });

  it('не трогает соревновательные недели и уже-делоды (честные причины)', () => {
    const plan = mkPlan([
      week(1, { taperWeek: true }),
      week(2, { mockMeet: true }),
      week(3, { meetWeek: true }),
      week(4, { postMeet: true }),
      week(5, { deload: true }),
      week(6),
    ]);
    const res = applyPLDeload(plan, { weeks: [1, 2, 3, 4, 5, 6] });
    expect(res.applied).toEqual([6]);
    expect(res.skipped.map(s => s.reason)).toEqual(['тапер', 'mock meet', 'неделя соревнований', 'пост-старт', 'уже делод']);
    expect(res.notes[0]).toContain('Пропущено');
  });

  it('пустой список недель → ближайшая подходящая от текущей (вперёд, затем назад)', () => {
    const plan = mkPlan([week(1), week(2, { taperWeek: true }), week(3), week(4)]);
    // текущая 2 — защищена, берём 3
    expect(pickDeloadWeeks(plan, [], 2).weeks).toEqual([3]);
    const res = applyPLDeload(plan, { currentWeek: 3 });
    expect(res.applied).toEqual([3]);
    // с конца: текущая 4 занята? нет — берём 4
    expect(pickDeloadWeeks(plan, [], 4).weeks).toEqual([4]);
    // все защищены — честная заметка, план не меняется
    const onlyProtected = mkPlan([week(1, { deload: true }), week(2, { meetWeek: true })]);
    const none = applyPLDeload(onlyProtected, { currentWeek: 1 });
    expect(none.applied).toEqual([]);
    expect(none.plan).toBe(onlyProtected);
    expect(none.notes[0]).toContain('Делод не добавлен');
  });

  it('идемпотентно: повторный клик не режет объём дважды', () => {
    const plan = mkPlan([week(1), week(2)]);
    const once = applyPLDeload(plan, { weeks: [2] });
    const twice = applyPLDeload(once.plan, { weeks: [2] });
    expect(twice.applied).toEqual([]);
    expect(twice.skipped).toEqual([{ week: 2, reason: 'уже делод' }]);
    expect(twice.plan.weeks[1].days[0].exercises[0].workSets[0].sets).toBe(2);
  });

  it('флор объёма: 1 сет остаётся 1, 3 сета → 2 (round 1.5)', () => {
    const plan = mkPlan([{ ...week(1), days: [day([ex('Присед', 1, 2), ex('Тяга', 3, 2)])] as never }]);
    const res = applyPLDeload(plan, { weeks: [1] });
    const sets = res.plan.weeks[0].days[0].exercises.map(e => e.workSets[0].sets);
    expect(sets).toEqual([1, 2]);
  });

  it('входной план не мутируется, planHasDeload отражает факт', () => {
    const plan = mkPlan([week(1), week(2)]);
    expect(planHasDeload(plan)).toBe(false);
    const res = applyPLDeload(plan, { weeks: [1] });
    expect(plan.weeks[0].days[0].exercises[0].workSets[0].sets).toBe(4);
    expect(plan.weeks[0].deload).toBeUndefined();
    expect(res.plan.weeks[0].days[0].exercises[0].workSets[0].sets).toBe(2);
    expect(planHasDeload(res.plan)).toBe(true);
  });

  it('plVolumeLandmarks пересчитываются при указанном уровне', () => {
    const plan = mkPlan([week(1), week(2), week(3)]);
    plan.plVolumeLandmarks = [{ group: 'back', muscle: 'Спина', peakWeek: 2, sets: 10, mev: 8, mav: 14, mrv: 20, status: 'optimal' }];
    const res = applyPLDeload(plan, { weeks: [2], level: 'II-KMS' });
    expect(res.plan.plVolumeLandmarks).toBeTruthy();
    expect(res.plan.plVolumeLandmarks!.length).toBeGreaterThan(0);
  });
});
