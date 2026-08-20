/**
 * planner-convergence.test.ts — проверка фиксов Этапа 2 (сходимость к целям КБЖУ):
 * 1. intra-приём отдаёт распределённую углеводную долю (_carbFor('intra')), а не фикс. 40 г
 *    (БАГ-10): раньше карб-веса intra/preSleep резервировались в _wSum, но не доставлялись.
 * 2. preSleep (0-углеводный) не резервирует углеводную долю, сжимая другие приёмы.
 * 3. Кэш пулов учитывает quality (БАГ-14) — смена full↔basic даёт разные пулы.
 */

import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';

const trainInput = (overrides: any = {}): MealPlanInput => ({
  weightKg: 90, lbmKg: 74, bodyFatPct: 18, sex: 'male' as const,
  goalKcal: 3200, goalProteinG: 190, goalFatG: 80, goalCarbsG: 430,
  mealsCount: 7, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium' as const, dayOffset: 0, cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3,
  wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...overrides,
});

describe('Этап 2: intra/preSleep углеводы (БАГ-10)', () => {
  it('intra-приём существует на длинной тренировке и несёт углеводы', () => {
    const plan = buildDayPlan(trainInput());
    const intra = plan.meals.find(m => m.type === 'intra');
    expect(intra).toBeTruthy();
    expect((intra?.totals.c || 0)).toBeGreaterThan(0);
    expect(intra?.items.some(it => it.role === 'liquid' && it.c > 0)).toBe(true);
  });

  it('intra не использует фикс. 40 г — углеводы масштабируются от дневного бюджета', () => {
    // Высокоуглеводный план → intra получает БОЛЬШЕ углеводов, чем низкоуглеводный.
    const hi = buildDayPlan(trainInput({ goalCarbsG: 520 }));
    const hiIntra = hi.meals.find(m => m.type === 'intra');
    expect(hiIntra).toBeTruthy();
    expect((hiIntra?.totals.c || 0)).toBeGreaterThanOrEqual(20);

    const lo = buildDayPlan(trainInput({ goalCarbsG: 120 }));
    const loIntra = lo.meals.find(m => m.type === 'intra');
    if (loIntra) {
      // Доля intra пропорциональна дневному бюджету углеводов, а не фикс. 40 г.
      expect(loIntra.totals.c).toBeLessThan(hiIntra!.totals.c);
    }
  });

  it('preSleep не резервирует углеводы — план сходится к цели без систематического недобора', () => {
    // Раньше _wOf('preSleep')=0.3 уходил в знаменатель _wSum, но не отдавался — остальные приёмы
    // систематически недополучали углеводы (~0.7 весовой доли preSleep+intra). Теперь preSleep=0.
    const plan = buildDayPlan(trainInput());
    const dev = Math.abs(plan.totals.c - 430) / 430;
    expect(dev).toBeLessThanOrEqual(0.06);
  });
});

describe('Этап 2: кэш пулов учитывает quality (БАГ-14)', () => {
  it('full и basic дают валидные, но различные пулы/микро-покрытие', () => {
    const full = buildDayPlan(trainInput({ quality: 'full' as const }));
    const basic = buildDayPlan(trainInput({ quality: 'basic' as const }));

    expect(full.meals.length).toBeGreaterThan(0);
    expect(basic.meals.length).toBeGreaterThan(0);
    expect(full.microSummary?.coverage?.length).toBeGreaterThan(0);
    expect(basic.microSummary?.coverage ?? []).toEqual([]);
  });
});
