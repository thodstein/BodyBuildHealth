/**
 * planner-micro-pools.ts — Эпик 4 (NUTRITION-PROFESSIONAL-PLAN):
 * микро-нутриентные дефициты дня → prefer-пулы СЛЕДУЮЩЕГО дня (4б) и
 * DIAAS-слабое звено приёма → полные белки следующего дня (4в).
 *
 * Мягкий сигнал (prefer, не хард-фильтр): день N+1 склоняется к источникам
 * дефицитов дня N. Чистые функции, детерминированные, тестируемые.
 */

import { FOOD_DB } from "../../../../core/nutrition-database";

/** Микро → продукты-источники (id FOOD_DB). Топ-2 на нутриент, вег-фолбэк. */
export const MICRO_SOURCE_POOLS: Record<string, { ids: string[]; vegIds?: string[] }> = {
  Zn: { ids: ['oysters', 'beef_lean', 'pumpkin_seeds', 'beef_minced'], vegIds: ['pumpkin_seeds', 'lentils', 'chickpeas', 'tofu'] },
  Mg: { ids: ['almonds', 'pumpkin_seeds', 'spinach', 'buckwheat'], vegIds: ['buckwheat', 'spinach', 'almonds', 'banana'] },
  K: { ids: ['potato_baked', 'banana', 'avocado', 'sweet_potato'], vegIds: ['banana', 'potato_baked', 'avocado', 'spinach'] },
  Ca: { ids: ['cottage_cheese_5', 'cheese_parmesan', 'yogurt_greek', 'milk'], vegIds: ['tofu', 'broccoli', 'kale', 'chickpeas'] },
  Fe: { ids: ['beef_liver', 'chicken_liver_cooked', 'beef_lean'], vegIds: ['lentils', 'spinach', 'chickpeas', 'buckwheat'] },
  VitD: { ids: ['salmon', 'mackerel', 'egg_whole'], vegIds: ['mushrooms', 'egg_whole'] },
  B12: { ids: ['beef_liver', 'chicken_liver_cooked', 'egg_whole', 'salmon'], vegIds: [] },
  Omega3: { ids: ['salmon', 'mackerel', 'herring'], vegIds: ['flaxseed', 'chia_seeds', 'walnuts'] },
};

/** Полные белки (полный аминопрофиль, DIAAS ≥ 0.9): яйца/мясо/рыба/сыворотка. */
export const COMPLETE_PROTEIN_IDS = [
  'egg_whole', 'chicken_breast', 'beef_lean', 'salmon', 'turkey_breast',
  'whey_protein', 'cottage_cheese_5', 'tuna_canned', 'egg_white', 'milk',
];

const DEFICIT_PCT = 70;

export interface MicroCoverageEntryLike { nutrient: string; pct: number; status?: string; }

/**
 * Топ-2 дефицита дня → id продуктов-источников (с вег-фолбэком и гейтами).
 * Возвращает { preferIds, note } — note для проNotes следующего дня.
 */
export function microDeficitToPreferIds(
  coverage: MicroCoverageEntryLike[] | undefined,
  isVegetarian: boolean,
  excludedIds?: Set<string>,
): { preferIds: string[]; note: string | null } {
  if (!Array.isArray(coverage) || coverage.length === 0) return { preferIds: [], note: null };
  const deficits = coverage
    .filter(c => (c.status === 'deficit' || (typeof c.pct === 'number' && c.pct < DEFICIT_PCT)) && c.nutrient !== 'Na' && c.nutrient !== 'VitA')
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 2);
  if (deficits.length === 0) return { preferIds: [], note: null };
  const preferIds: string[] = [];
  const labels: string[] = [];
  for (const d of deficits) {
    const pool = MICRO_SOURCE_POOLS[d.nutrient];
    if (!pool) continue;
    const candidates = isVegetarian ? (pool.vegIds && pool.vegIds.length > 0 ? pool.vegIds : pool.ids) : pool.ids;
    for (const id of candidates) {
      if (excludedIds && excludedIds.has(id)) continue;
      if (FOOD_DB.some(f => f.id === id)) { preferIds.push(id); break; }
    }
    labels.push(d.nutrient);
  }
  if (preferIds.length === 0) return { preferIds: [], note: null };
  return {
    preferIds,
    note: `🔬 Микро-контур: вчерашние дефициты (${labels.join(', ')}) — источники приоритетны в сегодняшнем рационе.`,
  };
}

/**
 * DIAAS-слабое звено приёма (любой приём дня с DIAAS < 0.85) → полные белки
 * в следующий день. Мягкий сигнал, не хард-фильтр.
 */
export function diaasWeakLinkToPreferIds(
  mealDiaas: Array<{ label: string; diaas: number | null }> | undefined,
  excludedIds?: Set<string>,
): { preferIds: string[]; note: string | null } {
  if (!Array.isArray(mealDiaas) || mealDiaas.length === 0) return { preferIds: [], note: null };
  const weak = mealDiaas.filter(m => typeof m.diaas === 'number' && m.diaas < 0.85);
  if (weak.length === 0) return { preferIds: [], note: null };
  const preferIds: string[] = [];
  for (const id of COMPLETE_PROTEIN_IDS) {
    if (excludedIds && excludedIds.has(id)) continue;
    if (FOOD_DB.some(f => f.id === id)) { preferIds.push(id); }
    if (preferIds.length >= 3) break;
  }
  return {
    preferIds,
    note: `🛡 DIAAS-контур: слабое аминозвено дня (${weak.map(w => w.label).join(', ')}) — в следующий день приоритет полным белкам (яйца/мясо/рыба/сыворотка).`,
  };
}

/** Растительные белковые продукты (неполный аминопрофиль, DIAAS < 0.85 типичен). */
export const VEG_PROTEIN_IDS = ['tofu', 'tempeh', 'lentils', 'chickpeas', 'quinoa'];

/**
 * Эпик-хвост (4в, внутридневной контур): комплиментарный белок — если приём
 * содержит растительный белок (слабое аминозвено), до 50% его граммовки
 * заменяется полным белком (яйца/мясо/рыба/сыворотка), не присутствующим
 * в приёме и не исключённым. Пропорции и ккал приёма почти не меняются
 * (замена 1:1 по граммам, белок приёма растёт — это и есть цель).
 * Возвращает новые meals + notes.
 */
export function repairDiaasWeakLinks(
  meals: Array<{ label: string; items: any[]; totals: any }>,
  excludedIds?: Set<string>,
): { meals: Array<{ label: string; items: any[]; totals: any }>; notes: string[] } {
  const notes: string[] = [];
  if (!Array.isArray(meals) || meals.length === 0) return { meals, notes };
  const next = meals.map(m => {
    if (!Array.isArray(m.items) || m.items.length === 0) return m;
    const vegIdx = m.items.findIndex(it => VEG_PROTEIN_IDS.includes(it.id) && (it.p || 0) > 3);
    if (vegIdx < 0) return m;
    const veg = m.items[vegIdx];
    const inMeal = new Set(m.items.map((it: any) => it.id));
    const repl = COMPLETE_PROTEIN_IDS.find(id => !inMeal.has(id) && !(excludedIds && excludedIds.has(id)) && FOOD_DB.some(f => f.id === id));
    if (!repl) return m;
    const food = FOOD_DB.find(f => f.id === repl)!;
    const swapGrams = Math.max(20, Math.min(Math.round(veg.amount * 0.5), 150));
    const factor = swapGrams / 100;
    const pG = Math.round(food.protein * factor);
    if (pG < 5) return m; // слишком маленькая замена — не имеет смысла
    const items = [...m.items];
    const restG = veg.amount - swapGrams;
    if (restG > 0) {
      const rf = restG / 100;
      items[vegIdx] = {
        ...veg,
        amount: restG,
        kcal: Math.round((veg.kcal || 0) * (restG / veg.amount)),
        p: Math.round((veg.p || 0) * (restG / veg.amount)),
        f: Math.round((veg.f || 0) * (restG / veg.amount)),
        c: Math.round((veg.c || 0) * (restG / veg.amount)),
      };
    } else {
      items.splice(vegIdx, 1);
    }
    items.push({
      id: food.id, name: food.name, amount: swapGrams,
      kcal: Math.round(food.kcal * factor), p: pG, f: Math.round(food.fat * factor), c: Math.round(food.carbs * factor),
      fiber: Math.round((food.fiber || 0) * factor), role: 'protein',
    });
    const totals = items.reduce((acc, it) => ({
      kcal: acc.kcal + (it.kcal || 0), p: acc.p + (it.p || 0), f: acc.f + (it.f || 0),
      c: acc.c + (it.c || 0), fiber: acc.fiber + (it.fiber || 0),
    }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0 });
    notes.push(`🛡 DIAAS-ремонт приёма «${m.label}»: ${veg.name} ${veg.amount}г → ${veg.name} ${restG}г + ${food.name} ${swapGrams}г (комплиментарный белок, слабое аминозвено)`);
    return { ...m, items, totals };
  });
  return { meals: next, notes };
}