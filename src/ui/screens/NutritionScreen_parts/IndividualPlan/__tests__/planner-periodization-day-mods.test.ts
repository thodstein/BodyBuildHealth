/**
 * planner-periodization-day-mods.test.ts — §4.2 «показано ≠ сгенерируется»
 * (docs/NUTRITION-PLANNER-PRO-AUDIT-2026-10.md).
 *
 * Дефект: ожидание недели (`expectedWeekKcal`) и карточка периодизации
 * (`buildNutritionPeriodization`) знали только периодизацию углеводов и тяжёлый
 * день. Менструальная фаза (_mp.kcalMod), дефицит категории бодибилдинга
 * (_defMod) и дневниковая компенсация (diaryComp) в ожидание не входили —
 * расхождение ±8% (женщина, лютеиновая фаза).
 *
 * Фикс: callback `dayModsByOffset` из Context (та же арифметика, что в
 * buildOneDay) прокидывается в оба потребителя; демпфирование компенсации и
 * «затирание» мода спец-днями сохранены в том же порядке, что в генераторе.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { expectedWeekKcal } from '../planner-carb-periodization';
import { buildNutritionPeriodization } from '../planner-nutrition-periodization.engine';

const TRAIN_DAYS = [false, false, false, false, false, false, false];

beforeEach(() => { try { localStorage.clear(); } catch { /* noop */ } });

describe('§4.2 expectedWeekKcal — дневные моды из генератора', () => {
  it('без callback — прежнее поведение (только периодизация)', () => {
    const base = expectedWeekKcal(3000, 'none', 0, TRAIN_DAYS);
    expect(base).toBe(21000);
  });

  it('ккал-мод callback-мода умножает ожидание недели (лютеиновая ×0.95)', () => {
    const base = expectedWeekKcal(3000, 'none', 0, TRAIN_DAYS);
    const modded = expectedWeekKcal(3000, 'none', 0, TRAIN_DAYS, '', undefined,
      () => ({ kcalMod: 0.95 }));
    expect(modded).toBe(Math.round(base * 0.95));
  });

  it('абсолютная дельта (дневниковая компенсация) прибавляется к каждому дню', () => {
    const base = expectedWeekKcal(3000, 'none', 0, TRAIN_DAYS);
    const modded = expectedWeekKcal(3000, 'none', 0, TRAIN_DAYS, '', undefined,
      () => ({ kcalDelta: 100 }));
    expect(modded).toBe(base + 700); // 7 дней × +100
  });

  it('моды и дельта работают вместе', () => {
    const base = expectedWeekKcal(3000, 'none', 0, TRAIN_DAYS);
    const modded = expectedWeekKcal(3000, 'none', 0, TRAIN_DAYS, '', undefined,
      () => ({ kcalMod: 0.9, kcalDelta: -50 }));
    expect(modded).toBe(Math.round(base * 0.9) - 350);
  });

  it('callback бросает исключение → ожидание не падает (best-effort)', () => {
    const base = expectedWeekKcal(3000, 'none', 0, TRAIN_DAYS);
    const modded = expectedWeekKcal(3000, 'none', 0, TRAIN_DAYS, '', undefined,
      () => { throw new Error('boom'); });
    expect(modded).toBe(base);
  });

  it('периодизация и callback не double-count: wave + мод = произведение', () => {
    const waveOnly = expectedWeekKcal(3000, 'wave', 2, TRAIN_DAYS);
    const wavePlus = expectedWeekKcal(3000, 'wave', 2, TRAIN_DAYS, '', undefined,
      () => ({ kcalMod: 0.95 }));
    expect(wavePlus).toBeLessThan(waveOnly);
    expect(wavePlus).toBe(Math.round(waveOnly * 0.95));
  });
});

describe('§4.2 карточка периодизации — dayModsByOffset', () => {
  const input = (over: any = {}) => ({
    startDate: '2026-10-12',
    horizonWeeks: 1,
    prepPlan: null,
    base: { kcal: 2500, proteinG: 170, fatG: 75, carbsG: 280, waterMl: 3000, sodiumMg: 2800 },
    goal: 'maintenance' as const,
    carbPeriodization: 'none' as const,
    isTrainingDayForOffset: () => false,
    dayLabels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
    ...over,
  });

  it('без callback — базовая цель дня (регресс-лок)', () => {
    const p = buildNutritionPeriodization(input());
    expect(p.days.length).toBe(7);
    expect(p.days[0].kcal).toBe(2500);
  });

  it('ккал-мод callback-мода меняет цель дня', () => {
    const p = buildNutritionPeriodization(input({ dayModsByOffset: () => ({ kcalMod: 0.95 }) }));
    expect(p.days[0].kcal).toBe(Math.round(2500 * 0.95));
    expect(p.weeks[0].avgKcal).toBe(Math.round(2500 * 0.95));
  });

  it('дневниковая компенсация прибавляется к цели конкретного дня', () => {
    const p = buildNutritionPeriodization(input({
      dayModsByOffset: (offset: number) => (offset === 3 ? { kcalDelta: 200 } : null),
    }));
    expect(p.days[3].kcal).toBe(2700);
    expect(p.days[0].kcal).toBe(2500);
  });

  it('спец-день (refeed) затирает мод — как в генераторе', () => {
    const p = buildNutritionPeriodization(input({
      dayModsByOffset: () => ({ kcalMod: 0.95 }),
      specialMeals: [{ date: '2026-10-14', type: 'refeed' as const }],
    }));
    // refeed: dayKcalMod = 1.12 (затирание), компенсация/мод фазы уже не умножаются
    expect(p.days[2].kcal).toBe(Math.round(2500 * 1.12));
  });

  it('prep-режим: callback НЕ применяется к абсолютным целям фазы', () => {
    const prepPlan: any = {
      id: 'p1', version: 1, algorithmVersion: 1, status: 'active', createdAt: '', updatedAt: '', source: 'test',
      preparation: { weeks: 4, finalWeeks: 0, targetRatePctPerWeek: 0.5, currentCalories: 2400, steps: [], cardio: {} },
      taper: {}, peakWeek: {}, phases: [], safety: {}, frozenWeeks: [],
      preparationStartDate: '2026-10-12',
    };
    const p = buildNutritionPeriodization(input({
      prepPlan,
      dayModsByOffset: () => ({ kcalMod: 0.5, kcalDelta: 500 }),
    }));
    expect(p.mode).toBe('prep');
    // Цели дня — из nutritionTargetsForPrepDate (2400 ккал дефицит), не из callback-мода.
    expect(p.days[0].kcal).not.toBe(Math.round(2400 * 0.5) + 500);
  });

  it('карточка и expectedWeekKkal согласованы на одном callback (один источник)', () => {
    const dm = () => ({ kcalMod: 0.93, kcalDelta: 75 });
    const card = buildNutritionPeriodization(input({ dayModsByOffset: dm }));
    const week = expectedWeekKcal(2500, 'none', 0, TRAIN_DAYS, '', undefined, dm);
    const cardSum = card.days.reduce((s, d) => s + d.kcal, 0);
    // Округление по дням — расхождение максимум ±7 ккал (stacking-допуск).
    expect(Math.abs(cardSum - week)).toBeLessThanOrEqual(7);
  });
});
