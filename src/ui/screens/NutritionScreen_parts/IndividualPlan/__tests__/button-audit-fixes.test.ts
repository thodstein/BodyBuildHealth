/**
 * button-audit-fixes.test.ts — Тесты критических багфиксов аудита кнопок планировщика (Aug 3 2026).
 *
 * Покрытие:
 *   P0-1: generateBUTCH возвращает bjuHigh/bjuLow (раньше UI крашился на butchPlan.bjuHigh.kcal)
 *   P0-2: generateCheatMeal возвращает bjuBreakdown (раньше UI рендерил undefined)
 *   P0-3: generateCarbload — bju.p = протокол белка (1.2 г/кг), не суточный effectiveP
 *   P0-4: generateAllergenReportPure — null-guard на allergens (new Set(null) бросал TypeError)
 *   P0-5: generateRiskReportPure — weight guard (деление на 0 → Infinity)
 *   P0-6: buildDayPlan — mealsCount undefined → fallback на 5 (раньше 3 приёма без pre/post-workout)
 *   P1-7: generateQualityReportPure — budget=null guard ("Ваш бюджет «undefined»")
 *   P1-8: buildRecommendations — daysCount=0 guard (reduce/0 = NaN)
 */
import { describe, it, expect } from 'vitest';
import { generateBUTCH, generateCheatMeal, generateCarbload } from '../planner-special-meals';
import {
  generateAllergenReportPure,
  generateRiskReportPure,
  generateQualityReportPure,
} from '../planner-reports';
import { buildRecommendations } from '../planner-recommendations';
import { buildDayPlan } from '../meal-plan-engine';
import { FOOD_DB } from '../../../../../core/nutrition-database';

const baseDeps = {
  weight: 80,
  effectiveKcal: 2500,
  effectiveP: 160,
  effectiveF: 70,
  effectiveC: 300,
  goal: 'mass',
  cravingDays: 1,
  lazyDayDays: 1,
  trainingDays: [true, true, true, true, false, false, false],
};

const sampleDayPlan = {
  meals: [
    {
      label: 'Завтрак',
      time: '08:00',
      items: [
        { id: 'oatmeal', name: 'Овсянка', amount: 100, kcal: 350, p: 10, f: 5, c: 60, fiber: 8 },
        { id: 'egg_whole', name: 'Яйцо', amount: 100, kcal: 155, p: 13, f: 11, c: 1, fiber: 0 },
      ],
      totals: { kcal: 505, p: 23, f: 16, c: 61, fiber: 8 },
    },
  ],
  totals: { kcal: 505, p: 23, f: 16, c: 61, fiber: 8 },
};

describe('P0-1: generateBUTCH возвращает bjuHigh/bjuLow', () => {
  it('должен возвращать bjuHigh с kcal, p, f, c', () => {
    const result = generateBUTCH(baseDeps);
    expect(result.bjuHigh).toBeDefined();
    expect(result.bjuHigh.kcal).toBeGreaterThan(0);
    expect(result.bjuHigh.p).toBe(baseDeps.effectiveP);
    expect(result.bjuHigh.f).toBe(Math.round(baseDeps.effectiveF * 0.8));
    expect(result.bjuHigh.c).toBe(Math.round(baseDeps.effectiveC * 1.3));
  });

  it('должен возвращать bjuLow с kcal, p, f, c', () => {
    const result = generateBUTCH(baseDeps);
    expect(result.bjuLow).toBeDefined();
    expect(result.bjuLow.kcal).toBeGreaterThan(0);
    expect(result.bjuLow.p).toBe(baseDeps.effectiveP);
    expect(result.bjuLow.f).toBe(Math.round(baseDeps.effectiveF * 1.2));
    expect(result.bjuLow.c).toBe(Math.round(baseDeps.effectiveC * 0.5));
  });

  it('bjuHigh.kcal должен равняться highCarb*4 + protein*4 + fatHigh*9', () => {
    const result = generateBUTCH(baseDeps);
    const expected = result.highCarb * 4 + result.protein * 4 + result.fatHigh * 9;
    expect(result.bjuHigh.kcal).toBe(expected);
  });
});

describe('P0-2: generateCheatMeal возвращает bjuBreakdown', () => {
  it('должен возвращать bjuBreakdown строку с процентами', () => {
    const result = generateCheatMeal(baseDeps);
    expect(result.bjuBreakdown).toBeDefined();
    expect(typeof result.bjuBreakdown).toBe('string');
    expect(result.bjuBreakdown).toMatch(/\d+% Б/);
    expect(result.bjuBreakdown).toMatch(/\d+% Ж/);
    expect(result.bjuBreakdown).toMatch(/\d+% У/);
  });
});

describe('P0-3: generateCarbload — bju.p = протокол белка, не effectiveP', () => {
  it('bju.p должен быть ~1.2 г/кг (96г для 80кг), не 160г (effectiveP)', () => {
    const result = generateCarbload(baseDeps);
    expect(result.bju.p).toBe(Math.round(80 * 1.2)); // 96
    expect(result.bju.p).not.toBe(baseDeps.effectiveP); // не 160
  });

  it('bju.f должен быть ~0.5 г/кг (40г для 80кг)', () => {
    const result = generateCarbload(baseDeps);
    expect(result.bju.f).toBe(Math.round(80 * 0.5)); // 40
  });

  it('bju.c должен быть totalCarbs (640г для 80кг × 8г/кг)', () => {
    const result = generateCarbload(baseDeps);
    expect(result.bju.c).toBe(640);
  });
});

describe('P0-4: generateAllergenReportPure — null-guard на allergens', () => {
  it('не должен бросать TypeError при allergens=null', () => {
    expect(() => generateAllergenReportPure(sampleDayPlan, null as any, FOOD_DB)).not.toThrow();
  });

  it('не должен бросать TypeError при allergens=undefined', () => {
    expect(() => generateAllergenReportPure(sampleDayPlan, undefined as any, FOOD_DB)).not.toThrow();
  });

  it('должен возвращать корректный отчёт при allergens=[]', () => {
    const result = generateAllergenReportPure(sampleDayPlan, [], FOOD_DB);
    expect(result.riskLevel).toBe('low');
    expect(result.conflicts).toHaveLength(0);
  });
});

describe('P0-5: generateRiskReportPure — weight guard', () => {
  it('не должен возвращать Infinity при weight=0', () => {
    const result = generateRiskReportPure(sampleDayPlan, 0);
    expect(result.systems.renal.impact).not.toContain('Infinity');
    expect(result.systems.renal.impact).not.toContain('NaN');
  });

  it('не должен возвращать Infinity при weight=null', () => {
    const result = generateRiskReportPure(sampleDayPlan, null as any);
    expect(result.systems.renal.impact).not.toContain('Infinity');
  });

  it('должен использовать fallback weight=80 при weight=0', () => {
    const result = generateRiskReportPure(sampleDayPlan, 0);
    // 23г белка / 80кг = 0.3 г/кг (низкий)
    expect(result.systems.renal.score).toBe(1);
  });
});

describe('P0-6: buildDayPlan — mealsCount undefined fallback', () => {
  const baseInput = {
    mealsCount: undefined as any,
    weightKg: 80,
    goalKcal: 2500,
    goalProteinG: 160,
    goalFatG: 70,
    goalCarbsG: 300,
    isTrainingDay: true,
    trainStart: '17:00',
    trainEnd: '18:30',
    wakeTime: '07:00',
    bedTime: '22:00',
    lunchTime: '13:00',
    dinnerTime: '19:00',
    excludedIds: new Set<string>(),
    preferredIds: new Set<string>(),
    budget: 'medium' as const,
    variety: 'medium' as const,
    varietyStrictness: 'soft' as const,
    dayOffset: 0,
    recentFoodIds: new Set<string>(),
    hardRecentIds: new Set<string>(),
    randomSalt: 1,
  };

  it('не должен бросать при mealsCount=undefined', () => {
    expect(() => buildDayPlan(baseInput)).not.toThrow();
  });

  it('должен сгенерировать >3 приёмов при mealsCount=undefined (fallback на 5)', () => {
    const result = buildDayPlan(baseInput);
    expect(result.meals.length).toBeGreaterThan(3);
  });

  it('не должен бросать при mealsCount=0', () => {
    expect(() => buildDayPlan({ ...baseInput, mealsCount: 0 as any })).not.toThrow();
  });

  it('не должен бросать при mealsCount=NaN', () => {
    expect(() => buildDayPlan({ ...baseInput, mealsCount: NaN as any })).not.toThrow();
  });
});

describe('P1-7: generateQualityReportPure — budget=null guard', () => {
  it('не должен показывать "undefined" в recommendations при budget=null', () => {
    const result = generateQualityReportPure(sampleDayPlan, null as any, FOOD_DB);
    const allRecs = result.recommendations.join(' ');
    expect(allRecs).not.toContain('undefined');
  });

  it('должен использовать fallback budget="medium" при budget=null', () => {
    const result = generateQualityReportPure(sampleDayPlan, null as any, FOOD_DB);
    expect(result.budget).toBe('medium');
  });

  it('должен использовать fallback budget="medium" при budget=undefined', () => {
    const result = generateQualityReportPure(sampleDayPlan, undefined as any, FOOD_DB);
    expect(result.budget).toBe('medium');
  });
});

describe('P1-8: buildRecommendations — daysCount=0 guard', () => {
  it('не должен возвращать NaN в рекомендациях при пустом dayPlan', () => {
    const deps = {
      goal: 'mass',
      phase: 'course',
      weight: 80,
      effectiveKcal: 2500,
      effectiveP: 160,
      effectiveF: 70,
      effectiveC: 300,
      injections: [],
      linkToTraining: false,
      trainStart: '17:00',
      trainEnd: '18:30',
      sex: 'male' as const,
      bodyFatPct: 15,
      trainType: 'strength',
      v2Phase: 'LEAN_MASS',
      v2Pharma: {},
      v2Labs: {},
      histamineSensitive: false,
      generated: true,
      planDays: 1 as 1 | 3 | 7,
      dayPlan: null,
      threeDayPlan: null,
      weekPlan: null,
      carbPeriodization: 'none',
    };
    const result = buildRecommendations(deps);
    const allRecs = result.join(' ');
    expect(allRecs).not.toContain('NaN');
  });
});
