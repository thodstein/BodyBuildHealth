/**
 * planner-recipe-portion-drift.test.ts — §4.4 «легаси-дрейф порций рецептурного пути».
 *
 * Дефект (docs/NUTRITION-PLANNER-PRO-AUDIT-2026-10.md): финальная «посадка»
 * рецептурного дня масштабировала ядра рецептов в коридоре ±10% (кумулятивно) —
 * авторские порции уезжали на ~12%, тогда как продуктовый путь сходится в ≤3%
 * вообще без дрейфа порций.
 *
 * Решение: коридор посадки сужен до ±5% (остаток сходимости добирают поздние
 * проходы — extremeCarbTopUp/снэки, а не распухание порции). Лок держит границу:
 * ни одна нота «⚖️ Порция … ×N%» не выходит за ±5%.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals } from '../planner-recipe-mode';
import { RECIPE_DB } from '../../../../../data/recipe-db';

const base = (over: any = {}): MealPlanInput => ({
  weightKg: 120, lbmKg: 100, bodyFatPct: 16, sex: 'male' as const,
  goalKcal: 8900, goalProteinG: 500, goalFatG: 100, goalCarbsG: 1500,
  mealsCount: 10, isTrainingDay: false, budget: 'max' as const, dayOffset: 0,
  cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3, carbCapGPerKg: 0,
  wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...over,
} as any);

const assemble = (inp: MealPlanInput) => {
  const src = buildDayPlan(inp);
  const meals = (src.meals as any[]).map((m: any) => ({
    ...m, items: (m.items || []).map((i: any) => ({ ...i })), totals: { ...m.totals },
  }));
  return assembleRecipeDay({
    meals, pool: RECIPE_DB as any,
    targets: { kcal: (inp as any).goalKcal, p: (inp as any).goalProteinG, f: (inp as any).goalFatG, c: (inp as any).goalCarbsG },
    excludedIds: new Set<string>(), trainDay: !!inp.isTrainingDay, athleteWeightKg: (inp as any).weightKg,
    seed: 3, goal: 'mass', sex: 'male',
  } as any);
};

// Максимальное отклонение порции от авторской (по нотам «⚖️ Порция ×N%»).
const maxPortionDrift = (notes: string[]): number => {
  let max = 0;
  for (const n of notes) {
    const m = n.match(/×(\d+)%/);
    if (m) max = Math.max(max, Math.abs(Number(m[1]) - 100));
  }
  return max;
};

const CELLS: Array<[string, MealPlanInput]> = [
  ['R-1500 rest', base()],
  ['R-1500 train', base({ isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90, allowIntraWorkout: true })],
  ['plain 3500', base({ weightKg: 95, lbmKg: 80, goalKcal: 3600, goalProteinG: 200, goalFatG: 95, goalCarbsG: 490, goal: 'mass' })],
  ['plain 2600', base({ weightKg: 85, lbmKg: 72, goalKcal: 2600, goalProteinG: 175, goalFatG: 80, goalCarbsG: 320 })],
  ['plain 2600 s0', base({ weightKg: 85, lbmKg: 72, goalKcal: 2600, goalProteinG: 175, goalFatG: 80, goalCarbsG: 320, randomSalt: 0 })],
];

describe('§4.4/§4.6 коридор порций ≤3% и сходимость рецептурного пути', () => {
  for (const [label, inp] of CELLS) {
    it(`${label}: ни одна порция не уезжает от авторской больше чем на 3%`, () => {
      const res = assemble(inp);
      const drift = maxPortionDrift(res.notes);
      expect(drift, `ноты: ${res.notes.filter(n => /×\d+%/.test(n)).join(' | ')}`).toBeLessThanOrEqual(3);
    });
  }

  it('сходимость дня: обычные клетки ≤4%, экстрим — в честном капе', () => {
    for (const [label, inp] of CELLS) {
      const res = assemble(inp);
      const t = sumDayTotals(res.meals as any);
      const target = (inp as any).goalKcal;
      // Экстрим-R-HV — документированный honest-cap (effective-цель vs цель пользователя);
      // обычные дни — 4% порог из ЗАМЕРА (база с коридором ±10% давала 5.4% на s0 и 5.1%
      // на 3500; порог усилен относительно базы, не ослаблен).
      const isExtreme = label.startsWith('R-1500');
      const dev = Math.abs(t.kcal - target) / target * 100;
      expect(dev, `${label}: kcal ${Math.round(t.kcal)}/${target} (${dev.toFixed(1)}%)`).toBeLessThanOrEqual(isExtreme ? 30 : 4);
    }
  });

  it('§4.6: жир/углеводный перекос обычного дня сведён свопом не-ядрового сайда', () => {
    // Было (замер): plain 2600 финишировал с Ж +4.1% при У −4.0% — ребаланс молчал
    // (порог 120 ккал). Стало: не-ядровой жировой сайд меняется на углеводный носитель
    // с ккал-паритетом, оси сходятся.
    const res = assemble(CELLS.find(c => c[0] === 'plain 2600')![1]);
    const t = sumDayTotals(res.meals as any);
    const goal = { f: 80, c: 320 };
    const devF = Math.abs(t.f - goal.f) / goal.f * 100;
    const devC = Math.abs(t.c - goal.c) / goal.c * 100;
    expect(devF, `Ж ${Math.round(t.f)}/${goal.f} (${devF.toFixed(1)}%)`).toBeLessThanOrEqual(3);
    expect(devC, `У ${Math.round(t.c)}/${goal.c} (${devC.toFixed(1)}%)`).toBeLessThanOrEqual(3);
  });

  it('детерминизм: тот же вход → тот же дрейф и та же сходимость', () => {
    const a = assemble(CELLS[1][1]);
    const b = assemble(CELLS[1][1]);
    expect(maxPortionDrift(a.notes)).toBe(maxPortionDrift(b.notes));
    expect(a.deviationPct).toBe(b.deviationPct);
  });
});
