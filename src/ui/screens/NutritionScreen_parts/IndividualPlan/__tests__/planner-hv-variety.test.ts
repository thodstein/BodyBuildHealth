/**
 * planner-hv-variety.test.ts — P1-8/P1-10 (план NUTRITION-VARIETY-PLAN §1.4/§3.1):
 * HV-экстремумы пользователя 800–1500 г углей / 500 г белка:
 *  - консервов 0 (гейт «не бич-пакет» действует и в рецепт-пути),
 *  - соусы ≤30 г (фикс «80 г соевого соуса» действует на 6 приёмах),
 *  - моно-носитель углей ≤3 приёмов/день, ≥2 семейства углей/день,
 *  - недельная ротация: ≥4 семейства углей, ≥5 источников белка за 7 дней,
 *  - детерминизм «та же соль → тот же план»,
 *  - P1-6: hvStyle practical/mixed расширяет топапы (real = байт-в-байт).
 */
import { describe, it, expect } from 'vitest';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { assembleRecipeDay, sumDayTotals } from '../planner-recipe-mode';
import { stapleFamilyOf, hvStyleWidensTopups, HV_PRACTICAL_CARB_IDS } from '../food-availability';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';

function input(carbs: number, protein: number, salt: number, extra?: Partial<MealPlanInput>): MealPlanInput {
  const kcal = Math.round(protein * 4 + carbs * 4 + 90 * 9);
  return {
    weightKg: 90, lbmKg: 75, bodyFatPct: 14, sex: 'male',
    goalKcal: kcal, goalProteinG: protein, goalFatG: 90, goalCarbsG: carbs,
    mealsCount: 6, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90,
    allowIntraWorkout: true, excludedIds: new Set<string>(), allergenTags: new Set<string>(),
    budget: 'max', dayOffset: 0, cyclePhase: 'course', variety: 'max', quality: 'full',
    randomSalt: salt, carbCapGPerKg: 0, wakeTime: '07:00', bedTime: '23:00', ...extra,
  };
}

const allItems = (p: any): any[] => p.meals.flatMap((m: any) => m.items || []);

describe('HV-экстремумы: консервы/соусы/моно-носитель', () => {
  const cells: Array<[number, number]> = [[800, 150], [800, 500], [1500, 500]];

  for (const [carbs, protein] of cells) {
    it(`${carbs}У/${protein}Б (продукты): консервов 0, соусы ≤30 г, моно-носитель ≤3 приёма, ≥2 семейства углей`, () => {
      const p = buildDayPlan(input(carbs, protein, 3));
      const items = allItems(p);
      // Консервы — вне автогенерации полностью
      expect(items.some(it => /canned/i.test(it.id || ''))).toBe(false);
      // Соус — приправа ≤30 г в любом приёме (P0-2: «80 г соевого соуса»)
      for (const it of items) {
        if (/^(sauce_|mayo_|ketchup)/.test(it.id || '')) {
          expect(it.amount, `соус ${it.id}`).toBeLessThanOrEqual(30);
        }
      }
      // Моно-носитель углей: один id не чаще 3 приёмов (HV-гарантия)
      const mealsPerId = new Map<string, number>();
      for (const m of p.meals) {
        const ids = new Set((m.items || []).map((it: any) => it.id));
        for (const id of ids) mealsPerId.set(id, (mealsPerId.get(id) || 0) + 1);
      }
      for (const [id, n] of mealsPerId) {
        const f = FOOD_DB.find(x => x.id === id);
        if (f && f.category === 'grain' || f?.category === 'carb') {
          expect(n, `моно-носитель ${id} в ${n} приёмах`).toBeLessThanOrEqual(3);
        }
      }
      // ≥2 семейства углей в дне (не весь день на одном рисе)
      const carbFams = new Set(items.filter((it: any) => ['grain', 'carb'].includes(FOOD_DB.find(x => x.id === it.id)?.category || '')).map((it: any) => stapleFamilyOf(it.id)).filter(Boolean));
      expect(carbFams.size, 'семейства углей за день').toBeGreaterThanOrEqual(2);
    });
  }

  it('1500У/500Б (рецепты): консервы замещаются, соусы ≤30 г, день сходится в best-effort', () => {
    const _in = input(1500, 500, 3);
    const base = buildDayPlan(_in);
    const meals = base.meals.map(m => ({ ...m, target: m.target || { p: 80, c: 200, f: 15 } }));
    const asm = assembleRecipeDay({
      meals: meals as any,
      pool: getRecipes(),
      targets: { kcal: _in.goalKcal!, p: _in.goalProteinG, f: _in.goalFatG, c: _in.goalCarbsG },
      excludedIds: new Set<string>(),
      athleteWeightKg: 90, trainDay: true, seed: 3, goal: 'mass',
    });
    const items = (asm.meals as any[]).flatMap(m => m.items || []);
    expect(items.some(it => /canned/i.test(it.id || ''))).toBe(false);
    for (const it of items) {
      if (/^(sauce_|mayo_|ketchup)/.test(it.id || '')) expect(it.amount, `соус ${it.id}`).toBeLessThanOrEqual(30);
    }
    const tot = sumDayTotals(asm.meals as any);
    // R-500Б — best-effort: день не обязан сходиться ровно, но не «пустой»
    expect(tot.kcal).toBeGreaterThan(_in.goalKcal! * 0.6);
  });
});

describe('HV-неделя (800У/500Б): ротация семейств и белков', () => {
  it('7 дней: ≥4 семейства углей, ≥5 источников белка, красное мясо ≤3/7', { timeout: 240000 }, () => {
    const carbFams = new Set<string>();
    const protIds = new Set<string>();
    let redDays = 0;
    const RED = ['beef', 'pork', 'lamb'];
    for (let d = 0; d < 7; d++) {
      const p = buildDayPlan(input(800, 500, 7 + d, { dayOffset: d }));
      const items = allItems(p);
      for (const it of items) {
        const f = FOOD_DB.find(x => x.id === it.id);
        const fam = stapleFamilyOf(it.id);
        if (f && ['grain', 'carb'].includes(f.category) && fam) carbFams.add(fam);
        if (it.role === 'protein') protIds.add(it.id);
      }
      if (items.some((it: any) => RED.some(r => (it.id || '').includes(r)))) redDays++;
    }
    expect(carbFams.size, 'семейства углей за неделю').toBeGreaterThanOrEqual(4);
    expect(protIds.size, 'источники белка за неделю').toBeGreaterThanOrEqual(5);
    expect(redDays, 'красное мясо дней/7').toBeLessThanOrEqual(3);
  });
});

describe('P2-2: HV моно-инвариант (≤70% ккал карб-носителя в основном приёме)', () => {
  // Инвариант (проба 60 ячеек): моно встречается только в курируемых завтраках-кашах.
  // Обед/ужин гейтятся капами (item ≤600 / приём ≤850 / порции) — тест стережёт регрессию.
  it('1500У/500Б (продукты): обед/ужин — карб-носитель ≤72% ккал приёма', { timeout: 180000 }, () => {
    const p = buildDayPlan(input(1500, 500, 11));
    for (const m of p.meals) {
      const mt = String(m.type || '');
      if (!['lunch', 'dinner'].includes(mt)) continue; // завтрак-каша легитимна, HV-снеки (крем+изолят) легитимны
      const mk = (m.items || []).reduce((s: number, it: any) => s + (it.kcal || 0), 0);
      if (mk < 400) continue;
      const carbItems = (m.items || []).filter((it: any) => it.role === 'carb_slow' || it.role === 'carb_fast');
      if (carbItems.length === 0) continue;
      const worst = Math.max(...carbItems.map((it: any) => (it.kcal || 0) / mk));
      expect(worst, `приём «${m.label}»: доля углеводного носителя ${Math.round(worst * 100)}%`).toBeLessThanOrEqual(0.72);
    }
    // день остаётся HV-объёмным
    const totK = allItems(p).reduce((s: number, it: any) => s + (it.kcal || 0), 0);
    expect(totK).toBeGreaterThan(1500 * 4 * 0.55);
  });

  it('не-HV день (300У): гейт не меняет legacy-поведение (детерминизм той же соли)', () => {
    const a = buildDayPlan(input(300, 150, 11));
    const b = buildDayPlan(input(300, 150, 11));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('P1-6: HV-стиль (real/practical/mixed)', () => {
  it('HV_PRACTICAL_CARB_IDS существуют в FOOD_DB и доступны для плана', () => {
    expect(HV_PRACTICAL_CARB_IDS.length).toBeGreaterThan(3);
    for (const id of HV_PRACTICAL_CARB_IDS) {
      const f = FOOD_DB.find(x => x.id === id);
      expect(f, `id ${id} отсутствует в FOOD_DB`).toBeTruthy();
    }
    expect(hvStyleWidensTopups('real')).toBe(false);
    expect(hvStyleWidensTopups('practical')).toBe(true);
    expect(hvStyleWidensTopups('mixed')).toBe(true);
    expect(hvStyleWidensTopups(undefined)).toBe(false);
  });

  it('hvStyle practical на 1500У: в дне есть плотный носитель из практичного пула', { timeout: 180000 }, () => {
    const p = buildDayPlan(input(1500, 500, 5, { hvStyle: 'practical' }));
    const ids = new Set(allItems(p).map((it: any) => it.id));
    const practical = [...HV_PRACTICAL_CARB_IDS, 'pryaniki', 'jam'];
    expect([...ids].some(id => practical.includes(id)), 'плотный HV-носитель в дне (practical)').toBe(true);
  });

  it('детерминизм: та же соль → тот же план (800У/500Б)', () => {
    const a = buildDayPlan(input(800, 500, 42));
    const b = buildDayPlan(input(800, 500, 42));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
