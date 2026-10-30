/**
 * planner-meal-times-before-bed.test.ts — B15 (аудит 2026-10).
 *
 * Находка: время приёмов не ограничивалось сверху временем отбоя. При большом числе
 * приёмов (8–10) «вынужденная точка» в gapFillTimes уходила до 23:30 даже при отбое
 * 22:00, и последние приёмы вставали ПОСЛЕ отбоя, а preSleep при этом помечался как
 * «за 30 мин до сна» — то есть расписание противоречило само себе.
 *
 * Замок: ни один приём не может стоять позже, чем «отбой − 45 мин» (последний приём
 * минимум за 45 мин до сна), а preSleep — позже «отбой − 30 мин».
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan } from '../meal-plan-engine';

const planInput = (over: any = {}) => ({
  weightKg: 80, lbmKg: 65, bodyFatPct: 18, sex: 'male' as const,
  goalKcal: 2600, goalProteinG: 180, goalFatG: 75, goalCarbsG: 300,
  mealsCount: 6, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90,
  allowIntraWorkout: false, budget: 'medium' as const, dayOffset: 0,
  cyclePhase: 'none' as const, variety: 'medium' as const, eveningLowCarb: false,
  wakeTime: '07:00', bedTime: '22:00',
  ...over,
});

const mins = (t: string): number => {
  const [h, m] = String(t || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};

describe('B15: приёмы не встают после отбоя', () => {
  const bed = mins('22:00'); // 1320

  it('6 приёмов, отбой 22:00: все приёмы (кроме preSleep) не позже 21:15', () => {
    const plan = buildDayPlan(planInput({ mealsCount: 6 }) as any);
    for (const m of plan.meals) {
      const t = mins((m as any).time);
      if (!Number.isFinite(t)) continue;
      if ((m as any).type === 'presleep') {
        expect(t, `preSleep (${(m as any).time}) позже отбоя−30`).toBeLessThanOrEqual(bed - 30);
      } else {
        expect(t, `приём «${(m as any).label}» в ${(m as any).time} позже отбоя−45`)
          .toBeLessThanOrEqual(bed - 45);
      }
    }
  });

  it('10 приёмов, отбой 22:00: перекусы не уезжают за отбой (главный кейс находки)', () => {
    const plan = buildDayPlan(planInput({
      mealsCount: 10, goalKcal: 3400, goalProteinG: 200, goalFatG: 85, goalCarbsG: 430,
    }) as any);
    // sanity: приёмов действительно много
    expect(plan.meals.length).toBeGreaterThanOrEqual(8);
    for (const m of plan.meals) {
      const t = mins((m as any).time);
      if (!Number.isFinite(t)) continue;
      if ((m as any).type === 'presleep') {
        expect(t, `preSleep (${(m as any).time}) позже отбоя−30`).toBeLessThanOrEqual(bed - 30);
      } else {
        expect(t, `приём «${(m as any).label}» в ${(m as any).time} позже отбоя−45`)
          .toBeLessThanOrEqual(bed - 45);
      }
    }
  });

  it('ранний отбой (21:00) тоже удерживает окно', () => {
    const plan = buildDayPlan(planInput({
      mealsCount: 8, bedTime: '21:00', wakeTime: '05:30',
      goalKcal: 3000, goalProteinG: 190, goalFatG: 80, goalCarbsG: 360,
    }) as any);
    const b = mins('21:00');
    for (const m of plan.meals) {
      const t = mins((m as any).time);
      if (!Number.isFinite(t)) continue;
      if ((m as any).type === 'presleep') {
        expect(t).toBeLessThanOrEqual(b - 30);
      } else {
        expect(t, `приём «${(m as any).label}» в ${(m as any).time} при отбое 21:00`)
          .toBeLessThanOrEqual(b - 45);
      }
    }
  });

  it('вечерняя тренировка не загоняет приём за отбой', () => {
    const plan = buildDayPlan(planInput({
      mealsCount: 5, isTrainingDay: true, trainStartMin: 19 * 60 + 30, trainDurationMin: 90,
      bedTime: '22:00', wakeTime: '07:00',
    }) as any);
    const b = mins('22:00');
    for (const m of plan.meals) {
      const t = mins((m as any).time);
      if (!Number.isFinite(t)) continue;
      if ((m as any).type === 'presleep') {
        expect(t).toBeLessThanOrEqual(b - 30);
      } else {
        expect(t, `приём «${(m as any).label}» в ${(m as any).time} после вечерней тренировки`)
          .toBeLessThanOrEqual(b - 45);
      }
    }
  });
});
