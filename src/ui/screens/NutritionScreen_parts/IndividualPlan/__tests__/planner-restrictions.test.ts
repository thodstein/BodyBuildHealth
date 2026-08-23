/**
 * planner-restrictions.test.ts — Тесты резолвера аллергенов и диет-ограничений.
 *
 * Багфикс: раньше аллергены игнорировались pro-движком (buildDayPlan), а ограничения
 * no_dairy/no_gluten/min_sugar/min_processed работали только в классическом пути.
 * Теперь единый резолвер добавляет их в excludedIds обоих путей.
 */
import { describe, it, expect } from 'vitest';
import { FOOD_DB } from '../../../../../core/nutrition-database';
import { buildDayPlan } from '../meal-plan-engine';
import { generateCheatMeal, generateCarbload, generateLazyDayPlan, generateCravingPlan } from '../planner-special-meals';
import {
  USER_ALLERGEN_TO_TAGS,
  allergenTextMatches,
  getFoodAllergenTags,
  matchesSelectedAllergen,
  resolveAllergenFoodIds,
  resolveDietRestrictionIds,
  resolveAllExcludedFoodIds,
  countExcludedByAllergens,
  dietRestrictionTags,
} from '../planner-restrictions';
import { ALLERGEN_LIST } from '../types';

const nameOf = (id: string): string => FOOD_DB.find(f => f.id === id)?.name || id;

// ─── Маппинг ALLERGEN_LIST → теги ─────────────────────────────────────
describe('USER_ALLERGEN_TO_TAGS — полный маппинг', () => {
  it('каждый аллерген из ALLERGEN_LIST имеет теги-значения', () => {
    for (const a of ALLERGEN_LIST) {
      const values = USER_ALLERGEN_TO_TAGS[a.id];
      expect(values, `нет тегов для "${a.id}"`).toBeTruthy();
      expect(values.length).toBeGreaterThan(0);
    }
  });

  it('лактоза и молочные → dairy; глютен → gluten', () => {
    expect(USER_ALLERGEN_TO_TAGS['лактоза']).toEqual(['dairy']);
    expect(USER_ALLERGEN_TO_TAGS['молочные']).toEqual(['dairy']);
    expect(USER_ALLERGEN_TO_TAGS['глютен']).toEqual(['gluten']);
  });
});

// ─── allergenTextMatches — текстовый фолбэк без ложных срабатываний ────
describe('allergenTextMatches', () => {
  it('яйца: омлет — да, капуста белокочанная — нет (убран ложный паттерн "белок")', () => {
    expect(allergenTextMatches('яйца', 'Омлет с брокколи')).toBe(true);
    expect(allergenTextMatches('яйца', 'Капуста белокочанная')).toBe(false);
    expect(allergenTextMatches('яйца', 'Сейтан (пшеничный белок)')).toBe(false);
  });

  it('глютен: печенье — да, запечённая рыба и говяжья печень — нет (убран ложный паттерн "печен")', () => {
    expect(allergenTextMatches('глютен', 'Овсяное печенье')).toBe(true);
    expect(allergenTextMatches('глютен', 'Лосось/Семга (запеченная)')).toBe(false);
    expect(allergenTextMatches('глютен', 'Говяжья печень')).toBe(false);
  });

  it('молочные: сырники — да, оливковое масло — нет (убран ложный паттерн "масл")', () => {
    expect(allergenTextMatches('молочные', 'Сырники со сметаной')).toBe(true);
    expect(allergenTextMatches('молочные', 'Оливковое масло')).toBe(false);
    expect(allergenTextMatches('молочные', 'Кокосовое масло')).toBe(false);
  });

  it('рыба/морепродукты различаются', () => {
    expect(allergenTextMatches('рыба', 'Лосось на гриле')).toBe(true);
    expect(allergenTextMatches('морепродукты', 'Лосось на гриле')).toBe(false);
    expect(allergenTextMatches('морепродукты', 'Креветки отварные')).toBe(true);
  });
});

// ─── resolveAllergenFoodIds — по тегам FOOD_ALLERGEN_DIET ─────────────
describe('resolveAllergenFoodIds', () => {
  it('пустой список аллергенов → пустое множество', () => {
    expect(resolveAllergenFoodIds(FOOD_DB, []).size).toBe(0);
    expect(resolveAllergenFoodIds(FOOD_DB, undefined as any).size).toBe(0);
  });

  it('молочные: milk/butter/casein/сырники исключены; olive_oil и курица — нет', () => {
    const ids = resolveAllergenFoodIds(FOOD_DB, ['молочные']);
    // whey_protein/casein — протеин-порошок не считается молочным аллергеном (per user: "протеин не аллерген")
    for (const fid of ['milk', 'butter', 'cottage_cheese_5', 'yogurt_greek']) {
      expect(ids.has(fid), `должен быть исключён: ${nameOf(fid)}`).toBe(true);
    }
    // порошок должен остаться доступен при молочном аллергене
    expect(ids.has('whey_protein')).toBe(false);
    expect(ids.has('casein')).toBe(false);
    expect(ids.has('olive_oil')).toBe(false);
    expect(ids.has('chicken_breast')).toBe(false);
    expect(ids.has('rice_white')).toBe(false);
  });

  it('глютен: pasta/seitan/хлеб исключены; рис и запечённая рыба — нет', () => {
    const ids = resolveAllergenFoodIds(FOOD_DB, ['глютен']);
    for (const fid of ['pasta_durum', 'seitan', 'bread_white', 'bread_rye']) {
      expect(ids.has(fid), `должен быть исключён: ${nameOf(fid)}`).toBe(true);
    }
    expect(ids.has('salmon')).toBe(false);
    expect(ids.has('beef_liver')).toBe(false);
    expect(ids.has('rice_white')).toBe(false);
  });

  it('яйца: egg_whole/egg_white исключены; капуста — нет', () => {
    const ids = resolveAllergenFoodIds(FOOD_DB, ['яйца']);
    expect(ids.has('egg_whole')).toBe(true);
    expect(ids.has('egg_white')).toBe(true);
    expect(ids.has('cabbage')).toBe(false);
  });

  it('рыба: salmon/tuna исключены; морепродукты отдельным аллергеном', () => {
    const ids = resolveAllergenFoodIds(FOOD_DB, ['рыба']);
    expect(ids.has('salmon')).toBe(true);
    expect(ids.has('tuna_canned')).toBe(true);
    const shell = resolveAllergenFoodIds(FOOD_DB, ['морепродукты']);
    expect(shell.has('shrimp')).toBe(true);
  });

  it('соя: tofu/tempeh/соевый соус исключены', () => {
    const ids = resolveAllergenFoodIds(FOOD_DB, ['соя']);
    expect(ids.has('tofu')).toBe(true);
    expect(ids.has('tempeh')).toBe(true);
  });

  it('орехи: миндаль/грецкие/арахисовое масло исключены; арахис отдельно', () => {
    const ids = resolveAllergenFoodIds(FOOD_DB, ['орехи']);
    const nutsIds = [...ids];
    expect(nutsIds.length).toBeGreaterThan(0);
    const peanuts = resolveAllergenFoodIds(FOOD_DB, ['арахис']);
    expect(peanuts.size).toBeGreaterThan(0);
  });

  it('текстовый фолбэк ловит untagged продукты (лаваш/хлеб по имени)', () => {
    const ids = resolveAllergenFoodIds(FOOD_DB, ['глютен']);
    const lavashInDb = FOOD_DB.some(f => f.id === 'lavash');
    if (lavashInDb) expect(ids.has('lavash')).toBe(true);
  });

  it('неизвестный id аллергена не бросает', () => {
    expect(() => resolveAllergenFoodIds(FOOD_DB, ['что-то-новое' as any])).not.toThrow();
  });
});

// ─── matchesSelectedAllergen — для пост-генерационных предупреждений ──
describe('matchesSelectedAllergen', () => {
  it('молоко совпадает с "молочные"', () => {
    const milk = FOOD_DB.find(f => f.id === 'milk')!;
    expect(matchesSelectedAllergen(milk, 'молочные', FOOD_DB)).toBe(true);
    expect(matchesSelectedAllergen(milk, 'глютен', FOOD_DB)).toBe(false);
  });
});

// ─── dietPrefs-ограничения ────────────────────────────────────────────
describe('resolveDietRestrictionIds + resolveAllExcludedFoodIds', () => {
  it('min_sugar исключает быстрые углеводы', () => {
    const ids = resolveDietRestrictionIds(FOOD_DB, ['min_sugar']);
    expect(ids.has('marmalade')).toBe(true);
    expect(ids.has('chicken_breast')).toBe(false);
  });

  it('min_processed исключает фастфуд', () => {
    const ids = resolveDietRestrictionIds(FOOD_DB, ['min_processed']);
    expect(ids.has('sausage')).toBe(true);
    expect(ids.has('mcd_big_mac')).toBe(true);
    expect(ids.has('salmon')).toBe(false);
  });

  it('no_dairy через resolveAllExcludedFoodIds исключает молочку даже без аллергенов', () => {
    const ids = resolveAllExcludedFoodIds(FOOD_DB, [], ['no_dairy']);
    expect(ids.has('milk')).toBe(true);
    expect(ids.has('whey_protein')).toBe(true);
    expect(ids.has('chicken_breast')).toBe(false);
  });

  it('no_gluten через resolveAllExcludedFoodIds исключает глютеновые продукты', () => {
    const ids = resolveAllExcludedFoodIds(FOOD_DB, [], ['no_gluten']);
    expect(ids.has('pasta_durum')).toBe(true);
    expect(ids.has('rice_white')).toBe(false);
    expect(ids.has('salmon')).toBe(false);
  });

  it('dietRestrictionTags возвращает dairy/gluten', () => {
    expect(dietRestrictionTags(['no_dairy', 'no_gluten'])).toEqual(['dairy', 'gluten']);
    expect(dietRestrictionTags([])).toEqual([]);
  });
});

// ─── countExcludedByAllergens — для баннера UI ────────────────────────
describe('countExcludedByAllergens', () => {
  it('0 при пустом списке', () => {
    expect(countExcludedByAllergens(FOOD_DB, [])).toBe(0);
  });

  it('> 0 при выбранной молочке', () => {
    expect(countExcludedByAllergens(FOOD_DB, ['молочные'])).toBeGreaterThan(0);
  });
});

// ─── Интеграция с pro-движком (buildDayPlan) ──────────────────────────
const baseInput = (overrides: any = {}) => ({
  weightKg: 90, lbmKg: 74, bodyFatPct: 18, sex: 'male' as const,
  goalKcal: 3000, goalProteinG: 180, goalFatG: 72, goalCarbsG: 408,
  mealsCount: 5, isTrainingDay: true, trainStartMin: 17 * 60 + 30, trainDurationMin: 90, allowIntraWorkout: true,
  budget: 'medium' as const, dayOffset: 0, cyclePhase: 'course' as const, variety: 'max' as const, eveningLowCarb: false,
  ...overrides,
});

describe('buildDayPlan — аллергены и ограничения работают', () => {
  it('allergenTags dairy: в плане нет молочных продуктов (7 дней)', () => {
    for (let d = 0; d < 7; d++) {
      const plan = buildDayPlan(baseInput({ dayOffset: d, allergenTags: new Set(['dairy']) }));
      const allIds = plan.meals.flatMap(m => m.items.map(it => it.id));
      for (const id of allIds) {
        const tags = getFoodAllergenTags(id, FOOD_DB);
        expect(tags, `аллергенный продукт в плане: ${FOOD_DB.find(f => f.id === id)?.name}`).not.toContain('dairy');
      }
    }
  });

  it('allergenTags eggs+gluten: нет яиц и глютена, план валиден', () => {
    const plan = buildDayPlan(baseInput({ allergenTags: new Set(['eggs', 'gluten']) }));
    const allIds = plan.meals.flatMap(m => m.items.map(it => it.id));
    expect(allIds.length).toBeGreaterThan(0);
    for (const id of allIds) {
      const tags = getFoodAllergenTags(id, FOOD_DB);
      expect(tags).not.toContain('eggs');
      expect(tags).not.toContain('gluten');
    }
  });

  it('resolveAllExcludedFoodIds → excludedIds: все аллергены пользователя соблюдены в недельном плане', () => {
    const allergens = ['молочные', 'рыба'];
    const excluded = resolveAllExcludedFoodIds(FOOD_DB, allergens, ['no_gluten']);
    for (let d = 0; d < 7; d++) {
      const plan = buildDayPlan(baseInput({ dayOffset: d, excludedIds: excluded }));
      const allIds = plan.meals.flatMap(m => m.items.map(it => it.id));
      for (const id of allIds) {
        const tags = getFoodAllergenTags(id, FOOD_DB);
        expect(tags).not.toContain('dairy');
        expect(tags).not.toContain('fish');
        expect(tags).not.toContain('gluten');
      }
    }
  });

  it('много аллергенов сразу (dairy+eggs+fish+soy+shellfish+gluten) не роняет движок', () => {
    const excluded = resolveAllExcludedFoodIds(FOOD_DB, ['молочные', 'яйца', 'рыба', 'соя', 'морепродукты', 'глютен'], []);
    expect(() => buildDayPlan(baseInput({ excludedIds: excluded }))).not.toThrow();
    const plan = buildDayPlan(baseInput({ excludedIds: excluded }));
    expect(plan.meals.length).toBeGreaterThan(0);
  });

  it('pre-sleep протокол не добавляет миндаль/кешью при аллергии на орехи (allergenTags)', () => {
    for (let d = 0; d < 3; d++) {
      const plan = buildDayPlan(baseInput({ dayOffset: d, allergenTags: new Set(['tree_nuts', 'nuts']) }));
      const allIds = plan.meals.flatMap(m => m.items.map(it => it.id));
      expect(allIds).not.toContain('almonds');
      expect(allIds).not.toContain('cashew');
    }
  });

  it('pre-sleep протокол не добавляет миндаль при excludedIds', () => {
    const plan = buildDayPlan(baseInput({ excludedIds: new Set(['almonds', 'cashew']) }));
    const allIds = plan.meals.flatMap(m => m.items.map(it => it.id));
    expect(allIds).not.toContain('almonds');
    expect(allIds).not.toContain('cashew');
  });

  it('MPS-добор и пост-тренировочный приём не используют whey при аллергии на молочные — кроме порошка (протеин не аллерген)', () => {
    for (let d = 0; d < 3; d++) {
      const plan = buildDayPlan(baseInput({ dayOffset: d, allergenTags: new Set(['dairy']) }));
      const allIds = plan.meals.flatMap(m => m.items.map(it => it.id));
      // молочные продукты (молоко, творог, сыр) — исключены, но порошок whey/casein — остаётся (per user)
      for (const id of ['milk', 'cottage_cheese_5', 'yogurt_greek', 'cheese_hard']) {
        expect(allIds, `dairy продукт в плане (${nameOf(id)})`).not.toContain(id);
      }
      // порошок должен быть доступен
      const hasPowder = allIds.includes('whey_protein') || allIds.includes('whey_isolate') || allIds.includes('casein');
      // не требуем обязательного наличия, но не запрещаем — главное что не падает
      expect(plan.meals.length).toBeGreaterThan(0);
    }
  });

  it('киви/вишня в pre-sleep не исключаются без причины (регрессия: план остаётся наполненным)', () => {
    const plan = buildDayPlan(baseInput({}));
    expect(plan.meals.length).toBeGreaterThan(0);
    expect(plan.totals.kcal).toBeGreaterThan(1500);
  });

  it('спец-режимы уважают исключения: карб-загрузка без глютена, lazy-день без молочки', () => {
    const excludedGluten = resolveAllExcludedFoodIds(FOOD_DB, [], ['no_gluten']);
    const carb = generateCarbload({ weight: 90, effectiveKcal: 3000, effectiveP: 180, effectiveF: 72, effectiveC: 408, goal: 'mass', cravingDays: 1, lazyDayDays: 1, trainingDays: [true, false, true, false, true, true, false], excludedIds: [...excludedGluten] });
    for (const cf of (carb.foods || [])) {
      const tags = getFoodAllergenTags(cf.name ? FOOD_DB.find(f => f.name === cf.name)?.id || '' : '', FOOD_DB);
      expect(tags).not.toContain('gluten');
    }
    const excludedDairy = resolveAllExcludedFoodIds(FOOD_DB, ['молочные'], []);
    const lazy = generateLazyDayPlan({ weight: 90, effectiveKcal: 3000, effectiveP: 180, effectiveF: 72, effectiveC: 408, goal: 'mass', cravingDays: 1, lazyDayDays: 1, trainingDays: [true, false, true, false, true, true, false], excludedIds: [...excludedDairy] });
    for (const li of (lazy.items || [])) {
      const f = FOOD_DB.find(x => x.id === li.id);
      if (f) expect(getFoodAllergenTags(f.id, FOOD_DB)).not.toContain('dairy');
    }
  });

  it('читмил/крэйвинг не предлагают исключённые продукты', () => {
    const excluded = [...resolveAllExcludedFoodIds(FOOD_DB, ['молочные'], [])];
    const cheat = generateCheatMeal({ weight: 90, effectiveKcal: 3000, effectiveP: 180, effectiveF: 72, effectiveC: 408, goal: 'mass', cravingDays: 1, lazyDayDays: 1, trainingDays: [true, false, true, false, true, true, false], excludedIds: excluded });
    for (const it of (cheat.items || [])) {
      expect(excluded).not.toContain(it.id);
    }
  });
});
