/**
 * planner-preferences.ts — 5 механизмов подбора продуктов под пользователя.
 *
 * A. Вкусовой профиль (spicy/sweet/salty/sour) — boosting, не замена preferred.
 * B. Адаптивная история — продукты, которые часто заменяли, деприоритизируются.
 * C. Категорийные предпочтения — «люблю всю птицу» / «не люблю капусту».
 * D. Специфичность — повседневные / разнообразные / гурман (ортогонально бюджету).
 * E. Непереносимости — lowFODMAP, lowHistamine, lowOxalate (авто-исключение групп).
 */

import type { FoodItem } from "../../../../core/nutrition-database";

// ── D: Specificity levels ──
export type Specificity = 'everyday' | 'varied' | 'gourmet';

const EVERYDAY_EXCLUDE = new Set([
  'lobster','crab','mussels','clams','squid','oysters','octopus','scallop','langoust','crayfish','sea_cucumber',
  'abalone','sea_urchin','caviar','roe','truffle','saffron','vanilla','quail_egg','duck_egg','goose_egg',
  'venison','rabbit','duck_breast','duck_leg','goose_roasted','ostrich','bear','whale','medlar','loquat',
  'oil_truffle','oil_macadamia','oil_perilla','oil_camelina','oil_black_cumin','oil_hazelnut','oil_almond',
  'oil_walnut','oil_cedar','oil_pistachio','oil_rice_bran_organic','oil_grapeseed_cold','oil_hemp_organic',
  'chestnut','pine_nut','macadamia',
]);

export function isEverydayFood(id: string): boolean {
  const lid = id.toLowerCase();
  if (EVERYDAY_EXCLUDE.has(lid)) return false;
  for (const k of EVERYDAY_EXCLUDE) if (lid.includes(k)) return false;
  if (lid.startsWith('lamb')) return false;
  return true;
}

export function filterBySpecificity(foods: FoodItem[], level: Specificity): FoodItem[] {
  if (level === 'gourmet') return foods;
  if (level === 'everyday') return foods.filter(f => isEverydayFood(f.id));
  return foods; // 'varied' = current behavior
}

// ── C: Category preferences ──
export type CategoryPref = { preferred: string[]; excluded: string[] };

export function matchesCategoryPref(food: FoodItem, pref: CategoryPref): boolean {
  const cat = food.category || '';
  const id = food.id.toLowerCase();
  // excluded categories
  for (const ex of pref.excluded) {
    if (cat === ex) return false;
    if (id.includes(ex.toLowerCase())) return false;
  }
  return true;
}

export function isPreferredCategory(food: FoodItem, pref: CategoryPref): boolean {
  const cat = food.category || '';
  const id = food.id.toLowerCase();
  return pref.preferred.some(p => cat === p || id.includes(p.toLowerCase()));
}

// ── E: Intolerances ──
export type Intolerances = {
  lowFODMAP?: boolean;
  lowHistamine?: boolean;
  lowOxalate?: boolean;
};

// High-histamine foods (fermented, aged, cured, certain fish)
const HIGH_HISTAMINE = new Set([
  'tuna_canned','sardines','mackerel','anchovies','fermented_cheese','cheese_aged','parmesan',
  'sausage','salami','pepperoni','bacon','ham','kefir','sauerkraut','kimchi','soy_sauce',
  'red_wine','beer','vinegar','yeast_extract','spinach','tomato','eggplant','avocado',
  'strawberry','citrus','chocolate','walnuts','peanuts',
]);

// High-oxalate foods
const HIGH_OXALATE = new Set([
  'spinach','rhubarb','beetroot','chard','cocoa','chocolate','nuts_almonds','nuts_cashews','nuts_hazelnuts',
  'tea_black','tea_green','wheat_bran','buckwheat','soy_textured','tofu','black_pepper',
]);

export function filterByIntolerance(food: FoodItem, into: Intolerances): boolean {
  const id = food.id.toLowerCase();
  if (into.lowFODMAP) {
    const fg = food.gastro_tags?.fodmap_group;
    if (fg === 'HIGH') return false;
  }
  if (into.lowHistamine) {
    for (const h of HIGH_HISTAMINE) if (id.includes(h)) return false;
  }
  if (into.lowOxalate) {
    for (const o of HIGH_OXALATE) if (id.includes(o)) return false;
  }
  return true;
}

// ── A: Taste profile ──
export type TasteProfile = {
  spicy: number;   // 0-3
  sweet: number;
  salty: number;
  sour: number;
};

// Taste tags for common foods (by id pattern). Missing = neutral (0).
const TASTE_TAGS: Record<string, Partial<TasteProfile>> = {
  // Spicy
  chili: { spicy: 3 }, pepper_chili: { spicy: 3 }, hot_sauce: { spicy: 3 }, harissa: { spicy: 3 },
  ginger: { spicy: 1 }, mustard: { spicy: 1 }, horseradish: { spicy: 2 }, wasabi: { spicy: 3 },
  // Sweet
  banana: { sweet: 2 }, honey: { sweet: 3 }, maple: { sweet: 3 }, dates: { sweet: 3 },
  apple: { sweet: 2 }, berries: { sweet: 1 }, papaya: { sweet: 2 }, mango: { sweet: 3 },
  sweet_potato: { sweet: 1 }, carrot: { sweet: 1 }, corn: { sweet: 1 }, rice_cream: { sweet: 2 },
  // Salty
  soy_sauce: { salty: 3 }, cheese: { salty: 2 }, feta: { salty: 3 }, olives: { salty: 2 },
  ham: { salty: 2 }, bacon: { salty: 3 }, canned: { salty: 1 }, broth: { salty: 1 },
  // Sour
  lemon: { sour: 3 }, lime: { sour: 3 }, yogurt: { sour: 1 }, kefir: { sour: 2 },
  sauerkraut: { sour: 2 }, kimchi: { sour: 2 }, vinegar: { sour: 3 }, pickles: { sour: 2 },
  cottage_cheese: { sour: 1 }, tomato: { sour: 1 },
};

export function getTasteTags(food: FoodItem): TasteProfile {
  const id = food.id.toLowerCase();
  const name = (food.name || '').toLowerCase();
  let tags: Partial<TasteProfile> = {};
  // match by id or name substring
  for (const [key, val] of Object.entries(TASTE_TAGS)) {
    if (id.includes(key) || name.includes(key)) {
      tags = { ...tags, ...val };
    }
  }
  return { spicy: tags.spicy || 0, sweet: tags.sweet || 0, salty: tags.salty || 0, sour: tags.sour || 0 };
}

export function tasteMatchScore(food: FoodItem, profile: TasteProfile): number {
  if (!profile || (profile.spicy + profile.sweet + profile.salty + profile.sour === 0)) return 0;
  const tags = getTasteTags(food);
  // positive: user likes a taste and food has it
  let score = 0;
  if (tags.spicy > 0 && profile.spicy > 0) score += tags.spicy * profile.spicy;
  if (tags.sweet > 0 && profile.sweet > 0) score += tags.sweet * profile.sweet;
  if (tags.salty > 0 && profile.salty > 0) score += tags.salty * profile.salty;
  if (tags.sour > 0 && profile.sour > 0) score += tags.sour * profile.sour;
  return score;
}

// ── B: Adaptive history ──
const HISTORY_KEY = 'he_food_replace_history';

export function loadReplaceHistory(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}'); } catch { return {}; }
}

export function recordReplacement(oldFoodId: string): void {
  try {
    const h = loadReplaceHistory();
    h[oldFoodId] = (h[oldFoodId] || 0) + 1;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch {}
}

export function getDeprioritizedIds(): Set<string> {
  const h = loadReplaceHistory();
  const result = new Set<string>();
  for (const [id, count] of Object.entries(h)) {
    if ((count as number) >= 3) result.add(id); // replaced 3+ times → deprioritize
  }
  return result;
}

export function clearReplaceHistory(): void {
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}