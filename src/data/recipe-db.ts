import { Recipe } from '../engines/nutrition-periodization.engine';
import { FOOD_DB } from '../core/nutrition-database';
import { RECIPE_DB_P1 } from './recipe-db-p1';
import { RECIPE_DB_P2 } from './recipe-db-p2';
import { RECIPE_DB_P3 } from './recipe-db-p3';
import { RECIPE_DB_P4 } from './recipe-db-p4';
import { RECIPE_DB_P5 } from './recipe-db-p5';
import { RECIPE_DB_P6 } from './recipe-db-p6';
import { RECIPE_DB_P7 } from './recipe-db-p7';
import { RECIPE_DB_P8 } from './recipe-db-p8';
import { RECIPE_DB_P9 } from './recipe-db-p9';
import { RECIPE_DB_P10 } from './recipe-db-p10';
import { RECIPE_DB_P11 } from './recipe-db-p11';
// Шарды p12–p25 удалены (Эпик B5): 14 пустых файлов-заглушек — мёртвый вес сборки.
import { RECIPE_DB_P26 } from './recipe-db-p26';
import { RECIPE_DB_P27 } from './recipe-db-p27';
import { RECIPE_DB_P28 } from './recipe-db-p28';
import { RECIPE_DB_P29 } from './recipe-db-p29';
import { RECIPE_DB_P30 } from './recipe-db-p30';
import { RECIPE_DB_P31 } from './recipe-db-p31';
import { RECIPE_DB_P32 } from './recipe-db-p32';
import { RECIPE_DB_P33 } from './recipe-db-p33';
import { RECIPE_DB_P34 } from './recipe-db-p34';
import { RECIPE_DB_P35 } from './recipe-db-p35';
import { enrichRecipes } from './recipe-enrichment';

/**
 * C-требование «КБЖУ-консистентность ≤3%»: kcal рецепта не должен расходиться с формулой
 * 4×белки + 4×углеводы + 9×жиры более чем на 3%. Легаси-рецепты писались вручную и у части
 * записей kcal расходится вплоть до ~27%. Нормализуем kcal к формуле (округление до 5) на
 * этапе сборки БД — единственная точка правды, шардовые файлы не трогаются. Ингредиенты
 * (ingredientIds/portions) остаются авторскими — при разборе в план макросы считаются
 * из FOOD_DB, поэтому итог приёма консистентен по построению.
 *
 * Aug 28 (жалоба «рецепты ужатые»): у ~40 рецептов декларируемый kcal расходится с
 * РАЗБОРОМ ПОРЦИЙ (ingredientIds+portions → FOOD_DB) в 2-5 раз (шапка писалась «на
 * мечту», порции — реальные) → scaleToRecipeKcal резал порции ×0.2 («курица 58 г» на
 * обед). Теперь при расхождении декомпозиции с шапкой >35% ПОРЦИИ авторитетны:
 * kcal (и макросы шапки) пересчитываются из разборa.
 */
function decompKcal(r: Recipe): number {
  if (!r.ingredientIds || r.ingredientIds.length === 0) return 0;
  let sum = 0;
  for (const fid of r.ingredientIds) {
    const food = FOOD_DB.find(f => f.id === fid);
    if (!food) continue;
    const g = (r.portions?.[fid] ?? 100) / 100;
    sum += 4 * (food.protein || 0) * g + 9 * (food.fat || 0) * g + 4 * (food.carbs || 0) * g;
  }
  return sum;
}

function normalizeRecipeKcal(r: Recipe): Recipe {
  // 1. Формульная консистентность шапки: kcal = 4Б+9Ж+4У (как раньше).
  let out: Recipe = r;
  const formula = 4 * (r.protein || 0) + 4 * (r.carbs || 0) + 9 * (r.fat || 0);
  if (r.kcal > 0 && formula > 0) {
    const devPct = Math.abs(r.kcal - formula) / r.kcal * 100;
    if (devPct > 3) out = { ...r, kcal: Math.max(50, Math.round(formula / 5) * 5) };
  }
  // 2. Декомпозиция порций (ingredientIds+portions → FOOD_DB) — авторитет при расхождении
  // с шапкой >±30%: kcal и макросы пересчитываются из разбора (порции реалистичны, шапка —
  // «на мечту»). Иначе scaleToRecipeKcal резал порции ×0.2 («ужатые рецепты»).
  const dk = decompKcal(out);
  if (dk > 80 && out.kcal > 0) {
    const ratio = out.kcal / dk;
    if (ratio > 1.4 || ratio < 0.7) {
      const k = dk / Math.max(1, out.kcal);
      // Макросы масштабируем к разбору, kcal — из формулы масштабированных макросов
      // (сохраняем формульную консистентность ≤3% после пересчёта).
      const protein = Math.round((out.protein || 0) * k);
      const fat = Math.round((out.fat || 0) * k);
      const carbs = Math.round((out.carbs || 0) * k);
      return {
        ...out,
        kcal: Math.max(50, Math.round((4 * protein + 9 * fat + 4 * carbs) / 5) * 5),
        protein, fat, carbs,
      };
    }
  }
  return out;
}

/**
 * Эпик D1 (грамовки рецептов): санитайзер порций по ролям продуктов.
 * Enrichment-генератор ставил безразмерным ингредиентам дефолт 100 г —
 * «оливковое масло 100 г» (~884 ккал!) превращало «лёгкую треску 380 ккал»
 * в 1115+ ккал после normalizeRecipeKcal (порции «авторитетны»).
 * Пороги — кулинарные нормы (ст.л. масла = 8-10 г, лимон = 30-60 г).
 */
const PORTION_CAPS: Array<{ test: RegExp; cap: number }> = [
  { test: /(^|_)(olive_oil|coconut_oil|flaxseed_oil)$|^(oil_|butter_)/, cap: 15 },
  { test: /^(citrus|lemon|lime)$/, cap: 60 },
  { test: /^(sauce_|mayonnaise|mayo_|ketchup|sour_cream)/, cap: 30 },
  { test: /^(spice_|herb_|seed_cumin|seed_coriander)/, cap: 10 },
];

function sanitizeRecipePortions(r: Recipe): Recipe {
  if (!r.portions || Object.keys(r.portions).length === 0) return r;
  let changed = false;
  const portions: Record<string, number> = { ...r.portions };
  let ingredientIds: string[] | undefined;
  // Эпик D2: рецепты пишут «хлопья 45-130 г» (СУХАЯ мера), а id 'oats' — варёная овсянка
  // (71 ккал/100). Разбор занижал калорийность ×5 → normalize «легализовал» ошибки.
  // Порция oats ≤150 г = сухая мера → ремап на oats_dry (367 ккал/100).
  if (portions['oats'] !== undefined && portions['oats'] > 0 && portions['oats'] <= 150) {
    portions['oats_dry'] = portions['oats'];
    delete portions['oats'];
    if (Array.isArray(r.ingredientIds)) {
      ingredientIds = r.ingredientIds.map(id => id === 'oats' ? 'oats_dry' : id);
    }
    changed = true;
  }
  for (const [fid, g] of Object.entries(portions)) {
    for (const { test, cap } of PORTION_CAPS) {
      if (test.test(fid) && g > cap) {
        portions[fid] = cap;
        changed = true;
        break;
      }
    }
  }
  if (!changed) return r;
  return { ...r, portions, ...(ingredientIds ? { ingredientIds } : {}) } as Recipe;
}

export const RECIPE_DB: Recipe[] = enrichRecipes([
  ...RECIPE_DB_P1,
  ...RECIPE_DB_P2,
  ...RECIPE_DB_P3,
  ...RECIPE_DB_P4,
  ...RECIPE_DB_P5,
  ...RECIPE_DB_P6,
  ...RECIPE_DB_P7,
  ...RECIPE_DB_P8,
  ...RECIPE_DB_P9,
  ...RECIPE_DB_P10,
  ...RECIPE_DB_P11,
  // Шарды p12–p25 удалены (Эпик B5): 14 пустых файлов-заглушек.
  ...RECIPE_DB_P26,
  ...RECIPE_DB_P27,
  ...RECIPE_DB_P28,
  ...RECIPE_DB_P29,
  ...RECIPE_DB_P30,
  ...RECIPE_DB_P31,
  ...RECIPE_DB_P32,
  ...RECIPE_DB_P33,
  ...RECIPE_DB_P34,
  ...RECIPE_DB_P35,
]).map(sanitizeRecipePortions).map(normalizeRecipeKcal);
