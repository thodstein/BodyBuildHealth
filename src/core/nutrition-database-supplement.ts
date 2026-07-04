/**
 * Nutrition Database Supplement — 510 additional products
 * Merges into FOOD_DB at module init (see nutrition-database.ts)
 */
import { FoodItem } from './nutrition-database';
import { SUPPLEMENT_MEAT } from './nutrition-database-supplement-meat';
import { SUPPLEMENT_DAIRY } from './nutrition-database-supplement-dairy';
import { SUPPLEMENT_PRODUCE } from './nutrition-database-supplement-produce';
import { SUPPLEMENT_OTHER } from './nutrition-database-supplement-other';

export const FOOD_DB_SUPPLEMENT: FoodItem[] = [
  ...SUPPLEMENT_MEAT,
  ...SUPPLEMENT_DAIRY,
  ...SUPPLEMENT_PRODUCE,
  ...SUPPLEMENT_OTHER,
];
