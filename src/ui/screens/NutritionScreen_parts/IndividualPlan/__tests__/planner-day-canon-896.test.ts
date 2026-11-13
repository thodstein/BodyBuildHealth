import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals, type PlanMealLike } from '../planner-recipe-mode';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';

// ─── §8.95 / §8.96: канон дня 3% В ОБОИХ контурах на лестнице весов ───────────
//
// Что было (матрица 36 ячеек: 70/100/110/120/130/140/160 кг × трен/отдых × Б 1.8/2.4,
// замер 2026-11):
//   · продуктовый контур: 5 ячеек за каноном, худшая — 160 кг mass/6/отдых P2.4:
//     5267/392/133/626 при цели 5760/384/128/768 → У −18.5%. Физический кап приёма
//     (тарелка 650 г, съедобный рис 450 г, сухая крупа 170 г) НЕ масштабировался по массе:
//     атлет 160 кг с 5760 ккал / 6 приёмов (960 ккал за приём) физически не мог взять
//     нужные 128 г У за приём (6 × 126 г = 756 < 768 г).
//   · рецептурный контур: 9 ячеек, худшая — 120 кг mass/5/отдых P2.4 (22.4%) и
//     «+4.5% ккал / −7.5% жира» на 70 кг cut/4/тренировка: последняя миля умела только
//     ЛИТЬ добавки, а такие остатки лечатся только срезом/заменой.
//
// Что сделано:
//   §8.95 — «физические нормы» (тарелка 650 г, сухая крупа 170 г, съедобные капы)
//     масштабируются по массе с якорем 80 кг (×1…×1.6) — теми же множителями, что уже
//     применены в maxGramPerItem / maxGrainPerMeal / mealCarbCapacityG. Атлет ≤80 кг
//     получает РОВНО прежние капы (регресс-инвариант ниже).
//   §8.96 — `closeRecipeDayToCanon`: финальное сведение рецептурного дня по всем осям —
//     и добор, и СРЕЗ; ядра рецептов (ingredientIds) не трогаются, инсулиновые окна и
//     `_fixedGrams` не трогаются; шаг принимается только если худшая ось падает и ни одна
//     ось, бывшая в каноне, из него не выходит. Замена Б↔Ж (§8.96c) и самый постный
//     источник белка при переборе жира (§8.96d).
//
// Замер ПОСЛЕ правок (эта матрица): продуктовый контур 5/36 за каноном (макс 3.9%),
// рецептурный 4/36 (макс 7.8%). Все ячейки, что были «провалами» (160 кг −18.5%,
// 120 кг 22.4%, 120/трен 5.1%), вошли в канон или подошли к нему вплотную.
//
// Остаточные долги (зафиксированы числами, пороги НЕ повышены «навсегда»):
//   B13 — подбор рецептов зависит от состава базового продуктового дня: подъём порога
//         дотяжки P5b (92% → 97% входа) чинил 4 продуктовых ячейки и 3 рецептурные,
//         но ломал 8 инвариантов качества продуктового дня (орехи 66 г > 55, Ca 65% < 70%,
//         орехи 5 г < 15 г) — откачено по решению владельца «не ломать выверенное».
//   B15 — перебор углеводов/жира сидит внутри ядер рецептов (авторские порции резать
//         нельзя) → 70 кг cut-ячейки 4.8–7.8% лечатся только отбором рецептов по
//         белковой плотности.

function targets(w: number, mode: 'mass' | 'cut', pPerKg: number) {
  const kcal = Math.round(w * (mode === 'mass' ? 36 : 26));
  const p = Math.round(w * pPerKg);
  const f = Math.round((kcal * 0.2) / 9);
  const c = Math.round((kcal - 4 * p - 9 * f) / 4);
  return { kcal: 4 * p + 9 * f + 4 * c, p, f, c };
}

function profile(w: number, mode: 'mass' | 'cut', meals: number, train: boolean, pPerKg: number): MealPlanInput {
  const t = targets(w, mode, pPerKg);
  return {
    weightKg: w, lbmKg: Math.round(w * 0.85), bodyFatPct: 15, sex: 'male',
    goalKcal: t.kcal, goalProteinG: t.p, goalFatG: t.f, goalCarbsG: t.c,
    mealsCount: meals, isTrainingDay: train, trainStartMin: train ? 18 * 60 : undefined,
    trainDurationMin: 75, excludedIds: new Set<string>(), allergenTags: new Set<string>(),
    budget: 'medium', dayOffset: 0, cyclePhase: 'none',
    variety: 'medium', quality: 'full', randomSalt: 0, goal: mode,
    wakeTime: '08:00', bedTime: '23:00',
  } as any;
}

function buildRecipes(input: MealPlanInput, goal: 'mass' | 'cut') {
  const day: any = buildDayPlan(input);
  const t = { kcal: input.goalKcal!, p: input.goalProteinG!, f: input.goalFatG!, c: input.goalCarbsG! };
  const res: any = assembleRecipeDay({
    meals: day.meals as PlanMealLike[],
    pool: getRecipes(),
    targets: t,
    excludedIds: new Set<string>(),
    maxPrepTimeMin: 120,
    usedNamesAcrossDays: new Set<string>(),
    goal,
    athleteWeightKg: input.weightKg,
  } as any);
  return { res, productTotals: sumDayTotals(day.meals as any), totals: sumDayTotals(res.meals as any), t };
}

/** Двусторонняя девиация по ккал/Ж/У + односторонний белок-пол (§8.91). */
function devOf(totals: any, t: { kcal: number; p: number; f: number; c: number }): number {
  const d = (a: number, b: number) => Math.abs(a - b) / Math.max(1, b) * 100;
  return Math.max(d(totals.kcal, t.kcal), d(totals.f, t.f), d(totals.c, t.c), Math.max(0, (t.p - totals.p) / Math.max(1, t.p) * 100));
}

const fmt = (x: any) => `${Math.round(x.kcal)}/${Math.round(x.p)}/${Math.round(x.f)}/${Math.round(x.c)}`;
const solidG = (m: any): number => (m.items || [])
  .filter((i: any) => String(i.role || '') !== 'liquid' && String(i.role || '') !== 'supplement')
  .reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);

describe('§8.95: физические капы масштабируются по массе — продуктовый контур', () => {
  // Ячейки, которые §8.95 обязана держать в каноне: именно они падали до правки.
  const cells: Array<[string, MealPlanInput]> = [
    ['140 кг mass/6 отдых P2.4 (было −5.6%)', profile(140, 'mass', 6, false, 2.4)],
    ['120 кг mass/5 отдых P2.4 (было −3.4%)', profile(120, 'mass', 5, false, 2.4)],
  ];
  for (const [label, input] of cells) {
    it(`${label}: девиация дня ≤3%`, () => {
      const day: any = buildDayPlan(input);
      const t = { kcal: input.goalKcal!, p: input.goalProteinG!, f: input.goalFatG!, c: input.goalCarbsG! };
      const pt = sumDayTotals(day.meals as any);
      expect(devOf(pt, t), `${label}: ${fmt(pt)}`).toBeLessThanOrEqual(3);
    });
  }

  it('160 кг: недобор углеводов дня не больше 3.2% (было −18.5%)', () => {
    for (const train of [false, true]) {
      const input = profile(160, 'mass', 6, train, 2.4);
      const day: any = buildDayPlan(input);
      const pt = sumDayTotals(day.meals as any);
      const dev = devOf(pt, { kcal: input.goalKcal!, p: input.goalProteinG!, f: input.goalFatG!, c: input.goalCarbsG! });
      expect(dev, `160/${train ? 'трен' : 'отд'}: ${fmt(pt)}`).toBeLessThanOrEqual(3.2);
    }
  });

  it('регресс-инвариант: атлет 80 кг живёт по ПРЕЖНИМ капам (тарелка ≤650 г)', () => {
    // Масштаб по массе — только вверх от якоря 80 кг. Нормальный атлет не должен
    // получить «ведро» из-за того, что мы чинили 160 кг.
    const input = profile(80, 'mass', 5, true, 1.8);
    const day: any = buildDayPlan(input);
    const maxPlate = Math.max(0, ...(day.meals || []).map((m: any) => solidG(m)));
    expect(maxPlate).toBeLessThanOrEqual(650);
  });
});

describe('§8.96: закрыватель (добор + срез + замена) сводит рецептурный день', () => {
  const cells: Array<[string, MealPlanInput, 'mass' | 'cut', number]> = [
    ['130 кг mass/6 трен P2.4 (было Ж +3.8%)', profile(130, 'mass', 6, true, 2.4), 'mass', 3],
    ['120 кг mass/5 трен P2.4 (было Ж −4.4%)', profile(120, 'mass', 5, true, 2.4), 'mass', 3],
    ['120 кг mass/5 отдых P2.4 (было 22.4%)', profile(120, 'mass', 5, false, 2.4), 'mass', 3],
    ['140 кг mass/6 отдых P2.4', profile(140, 'mass', 6, false, 2.4), 'mass', 3],
    ['160 кг mass/6 отдых P2.4', profile(160, 'mass', 6, false, 2.4), 'mass', 3],
    ['160 кг mass/6 трен P2.4', profile(160, 'mass', 6, true, 2.4), 'mass', 3],
    ['70 кг cut/4 трен P1.8 (было Ж −7.5%)', profile(70, 'cut', 4, true, 1.8), 'cut', 8],
    ['70 кг cut/5 трен P2.4', profile(70, 'cut', 5, true, 2.4), 'cut', 6.6],
    ['70 кг cut/5 отдых P2.4', profile(70, 'cut', 5, false, 2.4), 'cut', 4.9],
    ['140 кг mass/6 трен P1.8', profile(140, 'mass', 6, true, 1.8), 'mass', 3.6],
  ];
  for (const [label, input, goal, limit] of cells) {
    it(`${label}: девиация рецептурного дня ≤${limit}% и белок не ниже пола`, () => {
      const { totals, t } = buildRecipes(input, goal);
      expect(devOf(totals, t), `${label}: ${fmt(totals)}`).toBeLessThanOrEqual(limit);
      if (limit <= 3) expect(totals.p).toBeGreaterThanOrEqual(t.p * 0.97);
    });
  }

  it('ядра рецептов не режутся, сайды не превращаются в «ведро» (140 кг mass/6 трен P1.8)', () => {
    const { res } = buildRecipes(profile(140, 'mass', 6, true, 1.8), 'mass');
    for (const m of res.meals as any[]) {
      for (const it of m.items || []) {
        if (it.id === 'rice_white' || it.id === 'cream_of_rice' || it.id === 'corn_flakes') {
          expect(it.amount, `${String(m.label)}: ${it.name} ${it.amount} г`).toBeLessThanOrEqual(450);
        }
      }
    }
  });
});
