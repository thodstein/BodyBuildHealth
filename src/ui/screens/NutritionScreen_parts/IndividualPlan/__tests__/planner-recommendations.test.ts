import { describe, expect, it } from 'vitest';
import { buildRecommendations, type RecsInput } from '../planner-recommendations';

function input(overrides: Partial<RecsInput> = {}): RecsInput {
  return {
    goal: 'maintenance',
    phase: 'maintenance',
    weight: 80,
    effectiveKcal: 2400,
    effectiveP: 160,
    effectiveF: 70,
    effectiveC: 280,
    injections: [],
    linkToTraining: false,
    trainStart: '18:00',
    trainEnd: '19:30',
    sex: 'male',
    bodyFatPct: 15,
    trainType: 'bodybuilding',
    v2Phase: 'LEAN_MASS',
    v2Pharma: {},
    v2Labs: {},
    histamineSensitive: false,
    generated: true,
    planDays: 1,
    dayPlan: { meals: [{ items: [] }], totals: { kcal: 2000, p: 100, f: 60, c: 250 } },
    threeDayPlan: null,
    weekPlan: null,
    carbPeriodization: 'none',
    ...overrides,
  };
}

describe('planner recommendations — dietary restrictions', () => {
  it('does not suggest whey for a milk allergy or vegetarian preference', () => {
    const recs = buildRecommendations(input({ allergens: ['молочные'], dietPrefs: ['vegetarian'] }));
    const text = recs.join('\n');
    expect(text).toContain('разрешённый источник белка');
    expect(text).not.toContain('сывороточного');
    expect(text).not.toContain('whey');
    expect(text).toMatch(/тофу|белковый продукт/i);
  });

  it('filters explicit foods and categories from food hints', () => {
    const recs = buildRecommendations(input({ excludedFoods: ['tofu', 'chicken_breast'], excludedCategories: ['protein'] }));
    const text = recs.join('\n');
    expect(text).toContain('учитывают выбранные');
    expect(text).not.toMatch(/куриц|тофу/i);
  });

  it('does not throw on malformed pharma data', () => {
    expect(() => buildRecommendations(input({ injections: null as any, v2Pharma: null as any, v2Labs: null as any }))).not.toThrow();
  });
});
