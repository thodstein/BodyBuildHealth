/**
 * planner-extreme-micro.test.ts — §3I (NUTRITION-EXTREME-SCALE-PRO-PLAN §7, остаток I).
 *
 * Проблема: на 8000+ ккал RDA не масштабируется, а калорийная пища бедна микро —
 * VitA 26–32%, VitE 49–61% в дампах. Фикс: поздний проход `closeExtremeMicroGaps`
 * (после ВСЕХ писателей углеводов — иначе добавка съедала кап тарелок и день терял У):
 * морковь (VitA ~835 мкг/100 г, ~35 ккал) + семечки (VitE ~35 мг/100 г) малыми порциями,
 * бюджет ≤2% ккал цели; в рецептурном пути — после рецептов + срез гибких жировых сайдов
 * (иначе Ж +21% при honest-строке только о белке). VitD-нормализация IU→мкг (÷40) в
 * getMicroFromFood не дублируется.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, _getMicroFromFoodForTest, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals } from '../planner-recipe-mode';
import { RECIPE_DB } from '../../../../../data/recipe-db';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { analyzeMicroCoverage, sumMicros } from '../planner-micro-coverage';

const base = (over: any = {}): MealPlanInput => ({
  weightKg: 120, lbmKg: 100, bodyFatPct: 16, sex: 'male' as const,
  goalKcal: 8900, goalProteinG: 500, goalFatG: 100, goalCarbsG: 1500,
  mealsCount: 10, isTrainingDay: false, budget: 'max' as const, dayOffset: 0,
  cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  quality: 'full' as const, randomSalt: 3, carbCapGPerKg: 0,
  wakeTime: '07:00', bedTime: '23:00', dinnerTime: '19:00',
  ...over,
});

const insulin = [
  { type: 'инсулин', name: 'А', time: '08:00', dose: 40, esterType: 'short' },
  { type: 'инсулин', name: 'Б', time: '13:00', dose: 40, esterType: 'short' },
  { type: 'инсулин', name: 'В', time: '19:30', dose: 40, esterType: 'short' },
] as any;

const train = { isTrainingDay: true, trainStartMin: 17 * 60, trainDurationMin: 90, allowIntraWorkout: true };
const microOf = (plan: any) => {
  const items = (plan.meals as any[]).flatMap(m => (m.items || []).map((it: any) => ({ id: it.id, amount: it.amount })));
  return analyzeMicroCoverage(sumMicros(items as any, FOOD_DB as any), 'male', 120, 'course', !!plan.meals);
};
const pct = (res: any, n: string): number => res.coverage.find((c: any) => c.nutrient === n)?.pct ?? 0;

describe('§3I микро-плотные на 8000+ (VitA/VitE)', () => {
  const cells: Array<[string, MealPlanInput]> = [
    ['rest, без инсулина', base()],
    ['train, без инсулина', base(train)],
    ['rest, 3×40 ЕД', base({ injections: insulin })],
    ['train, 3×40 ЕД', base({ ...train, injections: insulin })],
  ];

  for (const [label, inp] of cells) {
    it(`${label}: VitA/VitE ≥70%, рост ккал ≤2%, тарелки ≤900`, { timeout: 240000 }, () => {
      const p = buildDayPlan(inp);
      const micro = microOf(p);
      expect(pct(micro, 'VitA'), `VitA ${pct(micro, 'VitA')}%`).toBeGreaterThanOrEqual(70);
      expect(pct(micro, 'VitE'), `VitE ${pct(micro, 'VitE')}%`).toBeGreaterThanOrEqual(70);
      // Добавка ≤2% ккал цели — рост честно указан в ноте (гейт бюджета внутри прохода).
      const note = p.notes.find(n => /Микро-плотные \(8900 ккал\)/.test(n || ''));
      expect(note, 'нет ноты добавки').toBeTruthy();
      const growth = Number((note!.match(/рост ккал \+([\d.]+)%/) || [])[1]);
      expect(Number.isFinite(growth), `рост: ${note}`).toBe(true);
      expect(growth, `рост ккал ${growth}%`).toBeLessThanOrEqual(2);
      expect(p.totals.kcal, `ккал ${p.totals.kcal}`).toBeLessThanOrEqual(8900 * 1.06);
      for (const m of p.meals as any[]) {
        const solid = (m.items || []).filter((it: any) => it.role !== 'liquid').reduce((s: number, it: any) => s + (it.amount || 0), 0);
        expect(solid, `${m.label} ${solid} г`).toBeLessThanOrEqual(900);
      }
      // Честная строка о добавке есть (или честный хинт при недостижимости).
      expect(p.notes.some(n => /Микро-плотные \(8900 ккал\)|Микро на 8900 ккал/.test(n || ''))).toBe(true);
    });
  }

  it('обычный день (3000 ккал): проход не активен, морковь/семечки не добавлены', () => {
    const p = buildDayPlan(base({
      weightKg: 90, lbmKg: 75, goalKcal: 3000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 340,
      mealsCount: 5, isTrainingDay: true, budget: 'medium' as const,
    }));
    expect(p.notes.some(n => /Микро-плотные|Микро на 3000 ккал/.test(n || ''))).toBe(false);
    expect((p.meals as any[]).flatMap(m => m.items).some((it: any) => it.id === 'carrot' && (it as any)._fixedGrams)).toBe(false);
  });

  it('источники заблокированы (аллергены): честный хинт вместо тихого дефицита', { timeout: 120000 }, () => {
    const p = buildDayPlan(base({ ...train, excludedIds: new Set(['carrot', 'sweet_potato', 'spinach', 'sunflower_seeds', 'almonds', 'olive_oil']) }));
    expect(p.notes.some(n => /Микро на 8900 ккал/.test(n || ''))).toBe(true);
    expect(p.notes.some(n => /VitA|VitE/.test(n || ''))).toBe(true);
  });

  it('рецептурный экстрим: VitA/VitE ≥70% (после рецептов, не только в продукт-дне)', { timeout: 240000 }, () => {
    const src = buildDayPlan(base({ ...train, injections: insulin }));
    const res = assembleRecipeDay({
      meals: (src.meals as any[]).map((m: any) => ({ ...m, items: (m.items || []).map((i: any) => ({ ...i })), totals: { ...m.totals } })),
      pool: RECIPE_DB as any, targets: { kcal: 8600, p: 280, f: 120, c: 1500 },
      excludedIds: new Set<string>(), trainDay: true, athleteWeightKg: 120, seed: 3, goal: 'mass', sex: 'male',
    } as any);
    const items = (res.meals as any[]).flatMap(m => (m.items || []).map((it: any) => ({ id: it.id, amount: it.amount })));
    const micro = analyzeMicroCoverage(sumMicros(items as any, FOOD_DB as any), 'male', 120, 'course', true);
    expect(pct(micro, 'VitA'), `VitA ${pct(micro, 'VitA')}%`).toBeGreaterThanOrEqual(70);
    expect(pct(micro, 'VitE'), `VitE ${pct(micro, 'VitE')}%`).toBeGreaterThanOrEqual(70);
  });

  it('VitD: нормализация IU→мкг (÷40) в getMicroFromFood не продублирована/не сломана', () => {
    const salmon = FOOD_DB.find(f => f.id === 'salmon');
    expect(salmon).toBeTruthy();
    const v = _getMicroFromFoodForTest(salmon as any, 'VitD');
    // лосось в FOOD_DB хранит 500 (IU-дрейф) → ÷40 = 12.5 мкг (RDA 15), а не 500 и не 12.5/40
    expect(v).toBeGreaterThan(5);
    expect(v).toBeLessThan(50);
  });
});
