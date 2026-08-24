/**
 * recipe-enrichment.ts — enrichment-данные для существующих рецептов.
 *
 * Проблема: 224 рецепта в recipe-db-p1/p2 имеют ingredients как строки ("Куриная грудка 200г"),
 * но НЕ имеют ingredientIds/portions/difficulty/batchFriendly/cookSkill — полей, нужных для
 * интеграции с recipe-engine.ts. Добавлять эти поля в каждый из 224 рецептов — огромная работа.
 *
 * Решение: enrichment-map по имени рецепта. recipe-engine.ts при декомпозиции сначала
 * проверяет enrichment (ingredientIds + portions), потом fallback на парсинг строк.
 * Этот файл содержит enrichment для ~40 ключевых рецептов ББ (завтраки/обеды/ужины).
 *
 * Приоритет: рецепты с высоким usefulness ≥ 8.0 — те, что чаще всего предлагаются.
 */

import type { Recipe } from '../../../engines/nutrition-periodization.engine';

export interface RecipeEnrichment {
  ingredientIds: string[];
  portions: Record<string, number>;
  difficulty: 'easy' | 'medium' | 'hard';
  batchFriendly?: boolean;
  cookSkill: 'basic' | 'medium' | 'advanced';
  flavorProfile?: { sweet?: number; salty?: number; sour?: number; spicy?: number; umami?: number };
  pairsWith?: string[];
}

export const RECIPE_ENRICHMENT: Record<string, RecipeEnrichment> = {
  'Протеиновые овсяноблины': {
    ingredientIds: ['oats', 'egg_whole', 'whey_isolate', 'milk'],
    portions: { oats: 80, egg_whole: 120, whey_isolate: 30, milk: 100 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'basic',
    flavorProfile: { sweet: 2, salty: 1 },
  },
  'Курица с рисом в одной кастрюле': {
    ingredientIds: ['chicken_breast', 'rice_basmati', 'broccoli', 'soy_sauce'],
    portions: { chicken_breast: 200, rice_basmati: 100, broccoli: 200, soy_sauce: 30 },
    difficulty: 'easy', batchFriendly: true, cookSkill: 'basic',
    flavorProfile: { salty: 2, umami: 2 },
  },
  'Белковый смузи (1000 ккал)': {
    ingredientIds: ['milk', 'whey_isolate', 'banana', 'oats', 'peanut_butter'],
    portions: { milk: 400, whey_isolate: 40, banana: 118, oats: 50, peanut_butter: 30 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'basic',
    flavorProfile: { sweet: 3 },
  },
  'Запечённая белая рыба с овощами': {
    ingredientIds: ['white_fish_cod', 'egg_whole', 'whey_isolate', 'broccoli'],
    portions: { white_fish_cod: 400, egg_whole: 120, whey_isolate: 20, broccoli: 200 },
    difficulty: 'easy', batchFriendly: true, cookSkill: 'basic',
    flavorProfile: { salty: 1, umami: 1 },
  },
  'Говядина с гречкой и овощами': {
    ingredientIds: ['beef_lean', 'buckwheat', 'broccoli', 'olive_oil'],
    portions: { beef_lean: 200, buckwheat: 80, broccoli: 150, olive_oil: 10 },
    difficulty: 'medium', batchFriendly: true, cookSkill: 'medium',
    flavorProfile: { salty: 2, umami: 2 },
  },
  'Лосось на гриле с киноа': {
    ingredientIds: ['salmon', 'quinoa', 'spinach', 'olive_oil', 'lemon'],
    portions: { salmon: 200, quinoa: 80, spinach: 100, olive_oil: 10, lemon: 30 },
    difficulty: 'medium', batchFriendly: false, cookSkill: 'medium',
    flavorProfile: { salty: 1, sour: 1, umami: 2 },
  },
  'Творожная запеканка с ягодами': {
    ingredientIds: ['cottage_cheese_5', 'egg_whole', 'oats', 'blueberries', 'honey'],
    portions: { cottage_cheese_5: 200, egg_whole: 120, oats: 30, blueberries: 100, honey: 15 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'basic',
    flavorProfile: { sweet: 3 },
  },
  'Индейка с булгуром и шпинатом': {
    ingredientIds: ['turkey_breast', 'bulgur', 'spinach', 'olive_oil', 'garlic'],
    portions: { turkey_breast: 200, bulgur: 80, spinach: 100, olive_oil: 10, garlic: 10 },
    difficulty: 'medium', batchFriendly: true, cookSkill: 'medium',
    flavorProfile: { salty: 2, umami: 1 },
  },
  'Яичные маффины с овощами': {
    ingredientIds: ['egg_whole', 'egg_white', 'spinach', 'red_pepper', 'cheese_hard'],
    portions: { egg_whole: 150, egg_white: 100, spinach: 50, red_pepper: 50, cheese_hard: 30 },
    difficulty: 'easy', batchFriendly: true, cookSkill: 'basic',
    flavorProfile: { salty: 2 },
  },
  'Протеиновые панкейки': {
    ingredientIds: ['oats', 'whey_isolate', 'egg_whole', 'milk', 'banana'],
    portions: { oats: 60, whey_isolate: 30, egg_whole: 120, milk: 100, banana: 100 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'basic',
    flavorProfile: { sweet: 2 },
  },
  'Куриный салат с авокадо': {
    ingredientIds: ['chicken_breast', 'avocado', 'spinach', 'tomato', 'olive_oil', 'lemon'],
    portions: { chicken_breast: 200, avocado: 70, spinach: 100, tomato: 100, olive_oil: 10, lemon: 15 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'basic',
    flavorProfile: { salty: 1, sour: 1 },
  },
  'Стейк из говядины с картофелем': {
    ingredientIds: ['beef_steak', 'potato_boiled', 'asparagus', 'olive_oil', 'garlic'],
    portions: { beef_steak: 250, potato_boiled: 300, asparagus: 150, olive_oil: 10, garlic: 10 },
    difficulty: 'medium', batchFriendly: false, cookSkill: 'medium',
    flavorProfile: { salty: 2, umami: 2 },
  },
  'Тунец с пастой и томатами': {
    ingredientIds: ['tuna_fresh', 'pasta_durum', 'tomato', 'olive_oil', 'garlic', 'basil'],
    portions: { tuna_fresh: 200, pasta_durum: 100, tomato: 150, olive_oil: 15, garlic: 10, basil: 5 },
    difficulty: 'medium', batchFriendly: true, cookSkill: 'medium',
    flavorProfile: { salty: 1, sour: 1, umami: 2 },
  },
  'Овсянка с протеином и ягодами': {
    ingredientIds: ['oats', 'whey_isolate', 'milk', 'blueberries', 'chia_seeds'],
    portions: { oats: 80, whey_isolate: 30, milk: 200, blueberries: 100, chia_seeds: 10 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'basic',
    flavorProfile: { sweet: 2 },
  },
  'Куриный бульон с яйцом': {
    ingredientIds: ['chicken_breast', 'egg_whole', 'carrot', 'onion', 'broth_bone'],
    portions: { chicken_breast: 150, egg_whole: 120, carrot: 100, onion: 50, broth_bone: 300 },
    difficulty: 'easy', batchFriendly: true, cookSkill: 'basic',
    flavorProfile: { salty: 2, umami: 1 },
  },
  'Скумбрия запечённая с картофелем': {
    ingredientIds: ['mackerel_atlantic', 'potato_boiled', 'broccoli', 'olive_oil', 'lemon'],
    portions: { mackerel_atlantic: 200, potato_boiled: 250, broccoli: 150, olive_oil: 10, lemon: 20 },
    difficulty: 'easy', batchFriendly: true, cookSkill: 'basic',
    flavorProfile: { salty: 1, sour: 1, umami: 2 },
  },
  'Греческий йогурт с орехами и мёдом': {
    ingredientIds: ['yogurt_greek', 'walnuts', 'honey', 'blueberries'],
    portions: { yogurt_greek: 200, walnuts: 30, honey: 15, blueberries: 80 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'basic',
    flavorProfile: { sweet: 3, sour: 1 },
  },
  'Куриные котлеты на пару': {
    ingredientIds: ['chicken_breast', 'egg_white', 'oats', 'onion'],
    portions: { chicken_breast: 200, egg_white: 100, oats: 20, onion: 50 },
    difficulty: 'medium', batchFriendly: true, cookSkill: 'medium',
    flavorProfile: { salty: 1 },
  },
  'Говяжий фарш с овощами': {
    ingredientIds: ['beef_minced', 'red_pepper', 'zucchini', 'tomato', 'olive_oil'],
    portions: { beef_minced: 200, red_pepper: 100, zucchini: 150, tomato: 100, olive_oil: 10 },
    difficulty: 'medium', batchFriendly: true, cookSkill: 'medium',
    flavorProfile: { salty: 1, umami: 2 },
  },
  'Творог с бананом и корицей': {
    ingredientIds: ['cottage_cheese_5', 'banana', 'cinnamon', 'walnuts'],
    portions: { cottage_cheese_5: 200, banana: 118, cinnamon: 2, walnuts: 20 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'basic',
    flavorProfile: { sweet: 2 },
  },
  'Курица в духовке с бататом': {
    ingredientIds: ['chicken_breast', 'sweet_potato', 'broccoli', 'olive_oil', 'garlic'],
    portions: { chicken_breast: 200, sweet_potato: 200, broccoli: 150, olive_oil: 10, garlic: 10 },
    difficulty: 'easy', batchFriendly: true, cookSkill: 'basic',
    flavorProfile: { salty: 1, sweet: 1 },
  },
  'Протеиновый батончик (домашний)': {
    ingredientIds: ['oats', 'whey_isolate', 'peanut_butter', 'honey', 'dried_apricots'],
    portions: { oats: 100, whey_isolate: 50, peanut_butter: 40, honey: 30, dried_apricots: 50 },
    difficulty: 'easy', batchFriendly: true, cookSkill: 'basic',
    flavorProfile: { sweet: 3 },
  },
  'Сёмга с спаржей и лимоном': {
    ingredientIds: ['salmon', 'asparagus', 'lemon', 'olive_oil', 'garlic'],
    portions: { salmon: 200, asparagus: 200, lemon: 30, olive_oil: 10, garlic: 10 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'medium',
    flavorProfile: { salty: 1, sour: 1, umami: 2 },
  },
  'Чечевичный суп с овощами': {
    ingredientIds: ['lentils', 'carrot', 'onion', 'tomato', 'olive_oil'],
    portions: { lentils: 100, carrot: 100, onion: 50, tomato: 100, olive_oil: 10 },
    difficulty: 'easy', batchFriendly: true, cookSkill: 'basic',
    flavorProfile: { salty: 1, umami: 1 },
  },
  'Яичница с томатами и шпинатом': {
    ingredientIds: ['egg_whole', 'tomato', 'spinach', 'olive_oil'],
    portions: { egg_whole: 180, tomato: 100, spinach: 50, olive_oil: 10 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'basic',
    flavorProfile: { salty: 1 },
  },
  'Салат с тунцом и авокадо': {
    ingredientIds: ['tuna_fresh', 'avocado', 'spinach', 'tomato', 'olive_oil', 'lemon'],
    portions: { tuna_fresh: 200, avocado: 70, spinach: 100, tomato: 100, olive_oil: 10, lemon: 15 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'basic',
    flavorProfile: { salty: 1, sour: 1, umami: 1 },
  },
  'Курица терияки с рисом': {
    ingredientIds: ['chicken_breast', 'rice_white', 'broccoli', 'soy_sauce', 'honey', 'garlic'],
    portions: { chicken_breast: 200, rice_white: 100, broccoli: 150, soy_sauce: 20, honey: 15, garlic: 10 },
    difficulty: 'medium', batchFriendly: true, cookSkill: 'medium',
    flavorProfile: { sweet: 1, salty: 2, umami: 2 },
  },
  'Овощное рагу с фасолью': {
    ingredientIds: ['beans', 'tomato', 'zucchini', 'red_pepper', 'onion', 'olive_oil'],
    portions: { beans: 150, tomato: 150, zucchini: 150, red_pepper: 100, onion: 50, olive_oil: 10 },
    difficulty: 'easy', batchFriendly: true, cookSkill: 'basic',
    flavorProfile: { salty: 1, umami: 1 },
  },
  'Творожники с изюмом': {
    ingredientIds: ['cottage_cheese_5', 'egg_whole', 'oats', 'raisins'],
    portions: { cottage_cheese_5: 200, egg_whole: 120, oats: 30, raisins: 30 },
    difficulty: 'medium', batchFriendly: false, cookSkill: 'medium',
    flavorProfile: { sweet: 2 },
  },
  'Креветки с чесноком и пастой': {
    ingredientIds: ['shrimp', 'pasta_durum', 'garlic', 'olive_oil', 'lemon', 'parsley'],
    portions: { shrimp: 200, pasta_durum: 100, garlic: 15, olive_oil: 15, lemon: 20, parsley: 10 },
    difficulty: 'medium', batchFriendly: false, cookSkill: 'medium',
    flavorProfile: { salty: 1, sour: 1, umami: 2 },
  },
  'Гречка с грибами и луком': {
    ingredientIds: ['buckwheat', 'mushrooms', 'onion', 'olive_oil'],
    portions: { buckwheat: 100, mushrooms: 150, onion: 80, olive_oil: 15 },
    difficulty: 'easy', batchFriendly: true, cookSkill: 'basic',
    flavorProfile: { salty: 1, umami: 2 },
  },
  'Смузи-боул с ягодами и гранолой': {
    ingredientIds: ['yogurt_greek', 'blueberries', 'strawberry', 'banana', 'almonds', 'honey'],
    portions: { yogurt_greek: 200, blueberries: 80, strawberry: 80, banana: 100, almonds: 20, honey: 10 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'basic',
    flavorProfile: { sweet: 3, sour: 1 },
  },
  'Курица карри с нутом': {
    ingredientIds: ['chicken_breast', 'chickpeas', 'tomato', 'onion', 'olive_oil'],
    portions: { chicken_breast: 200, chickpeas: 150, tomato: 100, onion: 80, olive_oil: 10 },
    difficulty: 'medium', batchFriendly: true, cookSkill: 'medium',
    flavorProfile: { salty: 1, spicy: 2, umami: 1 },
  },
  'Запечённый батат с творогом': {
    ingredientIds: ['sweet_potato', 'cottage_cheese_5', 'walnuts', 'honey', 'cinnamon'],
    portions: { sweet_potato: 300, cottage_cheese_5: 150, walnuts: 20, honey: 15, cinnamon: 2 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'basic',
    flavorProfile: { sweet: 2 },
  },
  'Омлет с грибами и сыром': {
    ingredientIds: ['egg_whole', 'egg_white', 'mushrooms', 'cheese_hard', 'olive_oil'],
    portions: { egg_whole: 120, egg_white: 100, mushrooms: 100, cheese_hard: 30, olive_oil: 10 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'basic',
    flavorProfile: { salty: 2, umami: 2 },
  },
  'Лодочки из кабачков с фаршем': {
    ingredientIds: ['zucchini', 'beef_minced', 'tomato', 'cheese_hard', 'onion', 'olive_oil'],
    portions: { zucchini: 200, beef_minced: 150, tomato: 100, cheese_hard: 30, onion: 50, olive_oil: 10 },
    difficulty: 'medium', batchFriendly: true, cookSkill: 'medium',
    flavorProfile: { salty: 1, umami: 2 },
  },
  'Рисовый пудинг с протеином': {
    ingredientIds: ['cream_of_rice', 'whey_isolate', 'milk', 'honey', 'cinnamon'],
    portions: { cream_of_rice: 60, whey_isolate: 30, milk: 250, honey: 15, cinnamon: 2 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'basic',
    flavorProfile: { sweet: 2 },
  },
  'Салат Цезарь с курицей': {
    ingredientIds: ['chicken_breast', 'lettuce', 'parmesan', 'olive_oil', 'lemon', 'bread_rye'],
    portions: { chicken_breast: 200, lettuce: 100, parmesan: 30, olive_oil: 15, lemon: 15, bread_rye: 35 },
    difficulty: 'easy', batchFriendly: false, cookSkill: 'medium',
    flavorProfile: { salty: 2, sour: 1, umami: 2 },
  },
  'Фаршированные перцы с индейкой': {
    ingredientIds: ['red_pepper', 'turkey_breast', 'rice_brown', 'tomato', 'onion', 'olive_oil'],
    portions: { red_pepper: 200, turkey_breast: 150, rice_brown: 60, tomato: 100, onion: 50, olive_oil: 10 },
    difficulty: 'medium', batchFriendly: true, cookSkill: 'medium',
    flavorProfile: { salty: 1, umami: 1 },
  },
};

/**
 * Обогащает рецепт полями из RECIPE_ENRICHMENT (если есть match по имени).
 * Возвращает новый объект рецепта с enrichment-полями.
 */
export function enrichRecipe(recipe: Recipe): Recipe {
  const enr = RECIPE_ENRICHMENT[recipe.name];
  if (!enr) return recipe;
  return {
    ...recipe,
    ingredientIds: enr.ingredientIds,
    portions: enr.portions,
    difficulty: enr.difficulty,
    batchFriendly: enr.batchFriendly,
    cookSkill: enr.cookSkill,
    flavorProfile: enr.flavorProfile,
    pairsWith: enr.pairsWith,
  };
}

/**
 * Обогащает массив рецептов.
 */
export function enrichRecipes(recipes: Recipe[]): Recipe[] {
  return recipes.map(enrichRecipe);
}