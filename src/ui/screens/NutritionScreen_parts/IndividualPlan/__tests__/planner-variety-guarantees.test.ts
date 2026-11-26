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

const BASE = (over: Partial<MealPlanInput> = {}): MealPlanInput =>
  ({
    weightKg: 85,
    lbmKg: 70,
    bodyFatPct: 16,
    sex: 'male',
    goalKcal: 3000,
    goalProteinG: 180,
    goalFatG: 80,
    goalCarbsG: 350,
    mealsCount: 5,
    isTrainingDay: false,
    budget: 'medium',
    cyclePhase: 'course' as any,
    variety: 'max',
    eveningLowCarb: false,
    randomSalt: 7,
    ...over,
  }) as MealPlanInput;

const STAPLE_FAMS = ['rice', 'buckwheat', 'pasta', 'potato', 'oats', 'bread', 'other_grain'];
const isStaple = (id: string) => STAPLE_FAMS.includes(stapleFamilyOf(id) || '');
const dayIds = (plan: any): string[] => plan.meals.flatMap((m: any) => (m.items || []).map((it: any) => it.id));

describe('D: разнообразие — 7-дневная серия (чейнинг как в Context)', () => {
  const plans: any[] = [];
  const recent = new Set<string>();
  const hardWindow: string[][] = [];
  for (let d = 0; d < 7; d++) {
    const plan = buildDayPlan(
      BASE({
        dayOffset: d,
        randomSalt: 100 + d,
        recentFoodIds: recent,
        hardRecentIds: new Set(hardWindow.flat()),
      }),
    );
    const ids = dayIds(plan);
    ids.forEach((id) => recent.add(id));
    hardWindow.push(ids);
    if (hardWindow.length > 2) hardWindow.shift();
    plans.push(plan);
  }

  it('стейпл-семейство не встречается во ВСЕХ 7 днях (ротация гарниров работает; oats — завтрак-стейпл, исключён)', () => {
    for (const fam of STAPLE_FAMS.filter((f) => f !== 'oats')) {
      const daysWith = plans.filter((p) => dayIds(p).some((id) => stapleFamilyOf(id) === fam)).length;
      expect(daysWith, `семейство «${fam}» в ${daysWith}/7 днях`).toBeLessThanOrEqual(5);
    }
  });

  it('основной белок (курица/говядина/треска…) не чаще 5 из 7 дней', () => {
    const proteins = ['chicken_breast', 'turkey_breast', 'beef_lean', 'cod', 'pollock', 'salmon'];
    for (const pid of proteins) {
      const daysWith = plans.filter((p) => dayIds(p).includes(pid)).length;
      expect(daysWith, `${pid} в ${daysWith}/7 днях`).toBeLessThanOrEqual(5);
    }
  });

  it('смежные дни делят не более 3 стейпл-id (жёсткое окно прошлого дня работает)', () => {
    let worstShared = 0;
    for (let i = 1; i < plans.length; i++) {
      const prev = new Set(dayIds(plans[i - 1]).filter(isStaple));
      const shared = dayIds(plans[i])
        .filter(isStaple)
        .filter((id) => prev.has(id)).length;
      worstShared = Math.max(worstShared, shared);
    }
    expect(worstShared, `максимум общих стейпл-id у смежных дней = ${worstShared}`).toBeLessThanOrEqual(3);
  });
});

describe('D: рецепты не повторяются при сквозном usedNamesAcrossDays (7 дней)', () => {
  it('ни один рецепт не применяется дважды за 7 дней', () => {
    const pool = getRecipes().filter((r) => r.meal === 'lunch' || r.meal === 'dinner');
    const used = new Set<string>(); // движок мутирует этот Set (usedNamesAcrossDays.add)
    const seen = new Set<string>(); // свой контроль повторов
    const failures: string[] = [];
    for (let d = 0; d < 7; d++) {
      const meals = [
        {
          label: 'Завтрак',
          time: '07:30',
          items: [],
          totals: { kcal: 0, p: 0, f: 0, c: 0 },
          target: { p: 45, c: 70, f: 18 },
        },
        {
          label: 'Обед',
          time: '12:30',
          items: [],
          totals: { kcal: 0, p: 0, f: 0, c: 0 },
          target: { p: 50, c: 75, f: 20 },
        },
        {
          label: 'Ужин',
          time: '19:00',
          items: [],
          totals: { kcal: 0, p: 0, f: 0, c: 0 },
          target: { p: 45, c: 60, f: 18 },
        },
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
      for (const name of applied) {
        if (seen.has(name)) failures.push(`день ${d}: «${name}» повторно`);
        seen.add(name);
      }
      applied.forEach((name) => used.add(name));
    }
    expect(failures, failures.join(' | ')).toEqual([]);
    expect(used.size).toBeGreaterThanOrEqual(14); // 7 дней × 2+ основных приёма
  });

  // §8.143: леджер — не только «между днями одной генерации», но и «между генерациями»
  // (`IndividualPlanContext.tsx` держит живые `_ledger.recipes` и передаёт их как
  // `usedNamesAcrossDays`). Перегенерация того же дня с непустым леджером обязана взять
  // ДРУГИЕ блюда: иначе вся персистентность леджера — декорация. Замер 40/40 имён свежие
  // (2026-11-25). Мутации, которые обязаны красить тест: убрать `...(usedNamesAcrossDays || [])`
  // из `excludeNames` в `assembleRecipeDay` (`planner-recipe-mode.ts:3319-3322`); убрать
  // `usedNamesAcrossDays?.add(...)` после посадки (`:3915`, `:3922`).
  it('перегенерация дня с непустым леджером не повторяет прошлые имена и пополняет леджер', () => {
    const pool = getRecipes();
    const targets = { kcal: 2800, p: 180, f: 80, c: 340 };
    const meals = () => [
      {
        label: 'Завтрак',
        type: 'breakfast',
        items: [],
        totals: { kcal: 0, p: 0, f: 0, c: 0 },
        target: { p: 45, c: 90, f: 20 },
      },
      {
        label: 'Обед',
        type: 'lunch',
        items: [],
        totals: { kcal: 0, p: 0, f: 0, c: 0 },
        target: { p: 50, c: 100, f: 20 },
      },
      {
        label: 'Ужин',
        type: 'dinner',
        items: [],
        totals: { kcal: 0, p: 0, f: 0, c: 0 },
        target: { p: 45, c: 80, f: 18 },
      },
    ];
    const common = {
      pool,
      targets,
      excludedIds: new Set<string>(),
      maxPrepTimeMin: 120,
      isVegetarian: false,
      goal: 'mass',
      athleteWeightKg: 85,
      canonPct: 3,
    } as any;
    const namesOf = (res: any) =>
      (res.meals as any[]).flatMap((m: any) => [m.recipeApplied, m.recipeApplied2].filter(Boolean).map(String));
    const pass1 = assembleRecipeDay({
      ...common,
      meals: meals() as any,
      usedNamesAcrossDays: new Set<string>(),
    } as any);
    const prev = new Set<string>(namesOf(pass1));
    expect(prev.size, 'первый проход должен поставить рецепты').toBeGreaterThanOrEqual(3);
    // Снимок ДО второй посадки: движок мутирует переданный Set (`usedNamesAcrossDays.add`),
    // поэтому сравнивать с живым `prev` — значит сравнивать день с самим собой.
    const snapshot = new Set(prev);
    const pass2 = assembleRecipeDay({ ...common, meals: meals() as any, usedNamesAcrossDays: prev } as any);
    const names2 = namesOf(pass2);
    expect(names2.length, 'второй проход должен поставить рецепты').toBeGreaterThanOrEqual(3);
    expect(
      names2.filter((n) => snapshot.has(n)),
      'имена прошлой генерации',
    ).toEqual([]);
    expect(new Set(names2).size, `дубли внутри дня: ${names2.join(', ')}`).toBe(names2.length);
    // Леджер живой: имена сегодняшнего дня в него попали.
    for (const n of names2) expect(prev.has(n), `«${n}» не попал в леджер`).toBe(true);
  });
});
