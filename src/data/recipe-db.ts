import { Recipe } from '../engines/nutrition-periodization.engine';
import { RECIPE_DB_P1 } from './recipe-db-p1';
import { RECIPE_DB_P2 } from './recipe-db-p2';

export const RECIPE_DB: Recipe[] = [
  ...RECIPE_DB_P1,
  ...RECIPE_DB_P2,
];
