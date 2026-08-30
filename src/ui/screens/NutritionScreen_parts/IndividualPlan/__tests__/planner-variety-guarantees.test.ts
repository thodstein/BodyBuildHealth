/**
 * planner-variety-guarantees.test.ts — D (Эпик D, NUTRITION-PLANNER-QUALITY-PLAN).
 * Гарантии разнообразия мультидней:
 *  - стейплы/основные белки прошлого дня ЖЁСТКО исключены из следующего (любой strictness);
 *  - recentFoodIds-чейнинг даёт ротацию белков в 7-дневной серии;
 *  - рецепты не повторяются при сквозном usedNamesAcrossDays.
 */
import { describe, it, expect } from 'vitest';
import { buildDayPlan, type MealPlanInput } from '../meal-plan-engine';
import { stapleFamilyOf } from '../food-availability';
import { getRecipes } from '../../../../../engines/nutrition-periodization.engine';
import { assembleRecipeDay } from '../planner-recipe-mode';

const BASE = (over: Partial<MealPlanInput> = {}): MealPlanInput => ({
  weightKg: 85, lbmKg: 70, bodyFatPct: 16, sex: 'male',
  goalKcal: 3000, goalProteinG: 180, goalFatG: 80, goalCarbsG: 350,
  mealsCount: 5, isTrainingDay: false, budget: 'medium', cyclePhase: 'course' as any,
  variety: 'max', eveningLowCarb: false, randomSalt: 7,
  ...over,
} as MealPlanInput);

const STAPLE_FAMS = ['rice', 'buckwheat', 'pasta', 'potato', 'oats', 'bread', 'other_grain'];
const isStaple = (id: string) => STAPLE_FAMS.includes(stapleFamilyOf(id) || '');
const dayIds = (plan: any): string[] => plan.meals.flatMap((m: any) => (m.items || []).map((it: any) => it.id));

describe('D: разнообразие — 7-дневная серия (чейнинг как в Context)', () => {
  const plans: any[] = [];
  const recent = new Set<string>();
  const hardWindow: string[][] = [];
  for (let d = 0; d < 7; d++) {
    const plan = buildDayPlan(BASE({
      dayOffset: d,
      randomSalt: 100 + d,
      recentFoodIds: recent,
      hardRecentIds: new Set(hardWindow.flat()),
    }));
    const ids = dayIds(plan);
    ids.forEach(id => recent.add(id));
    hardWindow.push(ids);
    if (hardWindow.length > 2) hardWindow.shift();
    plans.push(plan);
  }

  it('стейпл-семейство не встречается во ВСЕХ 7 днях (ротация гарниров работает; oats — завтрак-стейпл, исключён)', () => {
    for (const fam of STAPLE_FAMS.filter(f => f !== 'oats')) {
      const daysWith = plans.filter(p => dayIds(p).some(id => stapleFamilyOf(id) === fam)).length;
      expect(daysWith, `семейство «${fam}» в ${daysWith}/7 днях`).toBeLessThanOrEqual(5);
    }
  });

  it('основной белок (курица/говядина/треска…) не чаще 5 из 7 дней', () => {
    const proteins = ['chicken_breast', 'turkey_breast', 'beef_lean', 'cod', 'pollock', 'salmon'];
    for (const pid of proteins) {
      const daysWith = plans.filter(p => dayIds(p).includes(pid)).length;
      expect(daysWith, `${pid} в ${daysWith}/7 днях`).toBeLessThanOrEqual(5);
    }
  });

  it('смежные дни делят не более 3 стейпл-id (жёсткое окно прошлого дня работает)', () => {
    let worstShared = 0;
    for (let i = 1; i < plans.length; i++) {
      const prev = new Set(dayIds(plans[i - 1]).filter(isStaple));
      const shared = dayIds(plans[i]).filter(isStaple).filter(id => prev.has(id)).length;
      worstShared = Math.max(worstShared, shared);
    }
    expect(worstShared, `максимум общих стейпл-id у смежных дней = ${worstShared}`).toBeLessThanOrEqual(3);
  });
});

describe('D: рецепты не повторяются при сквозном usedNamesAcrossDays (7 дней)', () => {
  it('ни один рецепт не применяется дважды за 7 дней', () => {
    const pool = getRecipes().filter(r => r.meal === 'lunch' || r.meal === 'dinner');
    const used = new Set<string>(); // движок мутирует этот Set (usedNamesAcrossDays.add)
    const seen = new Set<string>(); // свой контроль повторов
    const dbg: string[] = [];
    const failures: string[] = [];
    for (let d = 0; d < 7; d++) {
      const meals = [
        { label: 'Завтрак', time: '07:30', items: [], totals: { kcal: 0, p: 0, f: 0, c: 0 }, target: { p: 45, c: 70, f: 18 } },
        { label: 'Обед', time: '12:30', items: [], totals: { kcal: 0, p: 0, f: 0, c: 0 }, target: { p: 50, c: 75, f: 20 } },
        { label: 'Ужин', time: '19:00', items: [], totals: { kcal: 0, p: 0, f: 0, c: 0 }, target: { p: 45, c: 60, f: 18 } },
      ];
      const res = assembleRecipeDay({
        meals: meals as any,
        pool,
        targets: { kcal: 2800, p: 180, f: 80, c: 320 },
        excludedIds: new Set<string>(),
        usedNamesAcrossDays: used,
        athleteWeightKg: 85,
      });
      const applied = res.meals.filter((m: any) => m.recipeApplied).map((m: any) => m.recipeApplied as string);
      dbg.push(`d${d}: ${JSON.stringify(applied)}`);
      for (const name of applied) {
        if (seen.has(name)) failures.push(`день ${d}: «${name}» повторно`);
        seen.add(name);
      }
      applied.forEach(name => used.add(name));
    }
    require('fs').writeFileSync('.tmp-dbg3.txt', dbg.join('\n'), 'utf8');
    expect(failures, failures.join(' | ')).toEqual([]);
    expect(used.size).toBeGreaterThanOrEqual(14); // 7 дней × 2+ основных приёма
  });
});
