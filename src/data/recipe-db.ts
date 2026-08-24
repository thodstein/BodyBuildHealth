import { Recipe } from '../engines/nutrition-periodization.engine';
import { RECIPE_DB_P1 } from './recipe-db-p1';
import { RECIPE_DB_P2 } from './recipe-db-p2';
import { RECIPE_DB_P3 } from './recipe-db-p3';
import { enrichRecipes } from './recipe-enrichment';

export const RECIPE_DB: Recipe[] = enrichRecipes([
  ...RECIPE_DB_P1,
  ...RECIPE_DB_P2,
  ...RECIPE_DB_P3,
]);
