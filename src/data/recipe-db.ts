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
import { enrichRecipes } from './recipe-enrichment';

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
]);
