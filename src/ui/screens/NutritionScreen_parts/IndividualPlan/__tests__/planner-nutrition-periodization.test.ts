/**
 * planner-nutrition-periodization.test.ts — тесты профессиональной периодизации питания.
 *
 * Покрытие: general-режим (цель + карб-периодизация), prep-режим (контест-преп:
 * подготовка/taper/пик/diet-break/рефид), тяжёлый день, детерминизм, горизонт,
 * честность «показано = сгенерированному дню» (та же арифметика, что buildOneDay).
 */
import { describe, it, expect } from 'vitest';
import {
  buildNutritionPeriodization,
  prepPeriodizationHorizon,
  weekdayIndexForIso,
  PERIODIZATION_GOAL_RU,
  type PeriodizationInput,
} from '../planner-nutrition-periodization.engine';
import { buildBBContestPrepPlan, isoToday, isoAddDays, type BBContestPrepConfig } from '../../../../../engines/bb/bb-contest-prep.engine';
import { shiftIsoDate } from '../../../../../core/local-date';

const TRAIN_MWF = (offset: number) => [0, 2, 4].includes(((offset % 7) + 7) % 7);
const NO_TRAIN = () => false;

function baseInput(over: Partial<PeriodizationInput> = {}): PeriodizationInput {
  return {
    startDate: '2026-03-02', // понедельник
    horizonWeeks: 2,
    prepPlan: null,
    base: { kcal: 3000, proteinG: 180, fatG: 75, carbsG: 350, waterMl: 3500, sodiumMg: 3500 },
    goal: 'cutting',
    carbPeriodization: 'none',
    isTrainingDayForOffset: TRAIN_MWF,
    heavyTrainDay: null,
    dayLabels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    ...over,
  };
}

function prepConfig(over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  return {
    sex: 'male',
    category: 'mens_physique',
    weightKg: 85,
    bodyFatPct: 8,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 2,
    showDate: isoAddDays(isoToday(), 120),
    weeksOut: 2,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'minimal',
    sodiumStrategy: 'constant',
    ...over,
  };
}

describe('Периодизация питания — general-режим', () => {
  it('строит горизонт, помечает тренировочные дни и отдаёт цели дня', () => {
    const p = buildNutritionPeriodization(baseInput());
    expect(p.mode).toBe('general');
    expect(p.days).toHaveLength(14);
    expect(p.weeks).toHaveLength(2);
    // Пн/Ср/Пт тренировки.
    expect(p.days[0].isTraining).toBe(true);
    expect(p.days[1].isTraining).toBe(false);
    expect(p.days[2].isTraining).toBe(true);
    // Цели из базы (none → без модификаций).
    expect(p.days[0].kcal).toBe(3000);
    expect(p.days[0].proteinG).toBe(180);
    expect(p.days[0].carbsG).toBe(350);
    expect(p.days[0].phaseLabel).toBe(PERIODIZATION_GOAL_RU.cutting);
  });

  it('карб-цикл: тренировочный день выше, отдых ниже (детерминированно)', () => {
    const p = buildNutritionPeriodization(baseInput({ carbPeriodization: 'carb_cycle' }));
    const train = p.days[0]; // Пн
    const rest = p.days[1];  // Вт
    expect(train.carbsG).toBeGreaterThan(rest.carbsG);
    expect(train.kcal).toBeGreaterThan(rest.kcal);
    // Повторный вызов — байт-в-байт (детерминизм).
    const p2 = buildNutritionPeriodization(baseInput({ carbPeriodization: 'carb_cycle' }));
    expect(p2.days).toEqual(p.days);
    expect(p2.weeks).toEqual(p.weeks);
  });

  it('рефид: 7-й день (offset 6) — рефид с ×2.2 углеводов', () => {
    const p = buildNutritionPeriodization(baseInput({ carbPeriodization: 'refeed', horizonWeeks: 1 }));
    const d6 = p.days[6];
    expect(d6.isRefeed).toBe(true);
    expect(d6.carbsG).toBe(Math.round(350 * 2.2));
    expect(p.summary.refeedDays).toBe(1);
  });

  it('тяжёлый день: понедельник помечен, угли +25%, ккал +5%', () => {
    const p = buildNutritionPeriodization(baseInput({ heavyTrainDay: 'Пн', horizonWeeks: 1 }));
    const mon = p.days[0];
    expect(mon.isHeavy).toBe(true);
    expect(mon.carbsG).toBe(Math.round(350 * 1.25));
    expect(mon.kcal).toBe(Math.round(3000 * 1.05));
    // Вторник не тяжёлый.
    expect(p.days[1].isHeavy).toBe(false);
  });

  it('запланированный читмил: kcal ≥ ×1.12 + метка isCheat', () => {
    const p = buildNutritionPeriodization(baseInput({ horizonWeeks: 1, specialMeals: [{ date: '2026-03-04', type: 'cheat_meal' }] }));
    const d = p.days.find(x => x.date === '2026-03-04')!;
    expect(d.isCheat).toBe(true);
    expect(d.kcal).toBe(Math.round(3000 * 1.12));
  });

  it('запланированный фастинг: kcal ≤ ×0.75, угли ≤ ×0.7 + метка isFast', () => {
    const p = buildNutritionPeriodization(baseInput({ horizonWeeks: 1, specialMeals: [{ date: '2026-03-04', type: 'fast' }] }));
    const d = p.days.find(x => x.date === '2026-03-04')!;
    expect(d.isFast).toBe(true);
    expect(d.kcal).toBe(Math.round(3000 * 0.75));
    expect(d.carbsG).toBe(Math.round(350 * 0.7));
  });

  it('запланированный рефид: ×2.2 углеводов + метка', () => {
    const p = buildNutritionPeriodization(baseInput({ horizonWeeks: 1, specialMeals: [{ date: '2026-03-04', type: 'refeed' }] }));
    const d = p.days.find(x => x.date === '2026-03-04')!;
    expect(d.isRefeed).toBe(true);
    expect(d.carbsG).toBe(Math.round(350 * 2.2));
  });

  it('невалидная дата → пустая структура без исключения', () => {
    const p = buildNutritionPeriodization(baseInput({ startDate: 'bad' }));
    expect(p.days).toHaveLength(0);
    expect(p.weeks).toHaveLength(0);
  });
});

describe('Периодизация питания — prep-режим (контест-преп)', () => {
  const plan = buildBBContestPrepPlan(prepConfig(), { prepWeeks: 12, taperWeeks: 2 });

  it('горизонт покрывает подготовку + taper + пик + post-show', () => {
    const horizon = prepPeriodizationHorizon(plan);
    // 12 + 2 + 1 (пик) + 12 (post-show) ≈ 27 недель
    expect(horizon).toBeGreaterThanOrEqual(26);
    expect(horizon).toBeLessThanOrEqual(30);
  });

  it('дни препа берут цели движка (не общую базу)', () => {
    const p = buildNutritionPeriodization(baseInput({
      prepPlan: plan,
      startDate: plan.preparation.startDate,
      horizonWeeks: prepPeriodizationHorizon(plan),
    }));
    expect(p.mode).toBe('prep');
    expect(p.days.length).toBe(p.horizonWeeks * 7);
    // Фазы подготовки присутствуют.
    expect(p.summary.prepWeeks).toBeGreaterThan(0);
    expect(p.summary.taperWeeks).toBeGreaterThan(0);
    // День подготовки несёт белок из профиля категории (≈ 85 × 1.8–2.8), не 180.
    const prepDay = p.days.find(d => d.phaseKey === 'preparation');
    expect(prepDay).toBeTruthy();
    expect(prepDay!.proteinG).toBeGreaterThanOrEqual(150);
    expect(prepDay!.proteinG).toBeLessThanOrEqual(240);
    // Белок стабилен (не зависит от carb-периодизации).
    expect(prepDay!.fatG).toBeGreaterThan(0);
    expect(prepDay!.source).toBe('prep');
  });

  it('целевой вес: снижается по темпу %/нед, taper/пик держат stage-вес, post-show — нет', () => {
    const p = buildNutritionPeriodization(baseInput({
      prepPlan: plan,
      startDate: plan.preparation.startDate,
      horizonWeeks: prepPeriodizationHorizon(plan),
    }));
    const w1 = p.weeks[0].targetWeightKg!;
    const w2 = p.weeks[1].targetWeightKg!;
    expect(w1).toBeLessThan(plan.preparation.startingWeightKg);
    expect(w2).toBeLessThan(w1);
    const lastPrep = p.weeks.filter(w => w.phaseKey === 'preparation' || w.phaseKey === 'final_preparation').slice(-1)[0];
    const taper = p.weeks.find(w => w.phaseKey === 'taper');
    expect(taper?.targetWeightKg).toBe(lastPrep.targetWeightKg);
    const post = p.weeks.find(w => w.phaseKey === 'post_show');
    if (post) expect(post.targetWeightKg).toBeNull();
  });

  it('факт веса недели: среднее из дневника + дельта к цели', () => {
    const start = plan.preparation.startDate;
    const w1 = plan.preparation.startingWeightKg;
    const p = buildNutritionPeriodization(baseInput({
      prepPlan: plan, startDate: start, horizonWeeks: 2,
      weightLog: [{ date: start, weightKg: w1 + 1 }, { date: shiftIsoDate(start, 1), weightKg: w1 + 3 }],
    }));
    expect(p.weeks[0].actualWeightKg).toBeCloseTo(w1 + 2, 1);
    expect(p.weeks[0].targetWeightKg).not.toBeNull();
    expect(p.weeks[0].weightDeltaKg).not.toBeNull();
    // Неделя без записей — факт null.
    expect(p.weeks[1].actualWeightKg).toBeNull();
  });

  it('пик-неделя помечена (isPeakWeek) и содержит 7 дней', () => {
    const p = buildNutritionPeriodization(baseInput({
      prepPlan: plan,
      startDate: plan.preparation.startDate,
      horizonWeeks: prepPeriodizationHorizon(plan),
    }));
    const peakDays = p.days.filter(d => d.isPeakWeek);
    expect(peakDays.length).toBe(7);
  });

  it('длинный преп (≥16 нед) даёт diet-break-дни', () => {
    const longPlan = buildBBContestPrepPlan(prepConfig(), { prepWeeks: 20, taperWeeks: 2 });
    const p = buildNutritionPeriodization(baseInput({
      prepPlan: longPlan,
      startDate: longPlan.preparation.startDate,
      horizonWeeks: prepPeriodizationHorizon(longPlan),
    }));
    expect(p.summary.dietBreakDays).toBeGreaterThan(0);
    expect(p.notes.join(' ')).toMatch(/Diet-break/);
  });
});

describe('Периодизация питания — утилиты', () => {
  it('weekdayIndexForIso: понедельник = 0, воскресенье = 6', () => {
    expect(weekdayIndexForIso('2026-03-02')).toBe(0); // Пн
    expect(weekdayIndexForIso('2026-03-08')).toBe(6); // Вс
  });

  it('горизонт general-режима без препа — минимум', () => {
    expect(prepPeriodizationHorizon(null)).toBe(4);
  });
});
