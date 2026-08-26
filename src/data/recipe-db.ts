import { Recipe } from '../engines/nutrition-periodization.engine';
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
import { RECIPE_DB_P12 } from './recipe-db-p12';
import { RECIPE_DB_P13 } from './recipe-db-p13';
import { RECIPE_DB_P14 } from './recipe-db-p14';
import { RECIPE_DB_P15 } from './recipe-db-p15';
import { RECIPE_DB_P16 } from './recipe-db-p16';
import { RECIPE_DB_P17 } from './recipe-db-p17';
import { RECIPE_DB_P18 } from './recipe-db-p18';
import { RECIPE_DB_P19 } from './recipe-db-p19';
import { RECIPE_DB_P20 } from './recipe-db-p20';
import { RECIPE_DB_P21 } from './recipe-db-p21';
import { RECIPE_DB_P22 } from './recipe-db-p22';
import { RECIPE_DB_P23 } from './recipe-db-p23';
import { RECIPE_DB_P24 } from './recipe-db-p24';
import { RECIPE_DB_P25 } from './recipe-db-p25';
import { RECIPE_DB_P26 } from './recipe-db-p26';
import { RECIPE_DB_P27 } from './recipe-db-p27';
import { enrichRecipes } from './recipe-enrichment';

/**
 * C-требование «КБЖУ-консистентность ≤3%»: kcal рецепта не должен расходиться с формулой
 * 4×белки + 4×углеводы + 9×жиры более чем на 3%. Легаси-рецепты писались вручную и у части
 * записей kcal расходится вплоть до ~27%. Нормализуем kcal к формуле (округление до 5) на
 * этапе сборки БД — единственная точка правды, шардовые файлы не трогаются. Ингредиенты
 * (ingredientIds/portions) остаются авторскими — при разборе в план макросы считаются
 * из FOOD_DB, поэтому итог приёма консистентен по построению.
 */
function normalizeRecipeKcal(r: Recipe): Recipe {
  const formula = 4 * (r.protein || 0) + 4 * (r.carbs || 0) + 9 * (r.fat || 0);
  if (!(r.kcal > 0) || formula <= 0) return r;
  const devPct = Math.abs(r.kcal - formula) / r.kcal * 100;
  if (devPct <= 3) return r;
  return { ...r, kcal: Math.max(50, Math.round(formula / 5) * 5) };
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
  ...RECIPE_DB_P12,
  ...RECIPE_DB_P13,
  ...RECIPE_DB_P14,
  ...RECIPE_DB_P15,
  ...RECIPE_DB_P16,
  ...RECIPE_DB_P17,
  ...RECIPE_DB_P18,
  ...RECIPE_DB_P19,
  ...RECIPE_DB_P20,
  ...RECIPE_DB_P21,
  ...RECIPE_DB_P22,
  ...RECIPE_DB_P23,
  ...RECIPE_DB_P24,
  ...RECIPE_DB_P25,
  ...RECIPE_DB_P26,
  ...RECIPE_DB_P27,
]).map(normalizeRecipeKcal);
