/**
 * ru-deli-foods.ts — бытовые названия российской гастрономии для поиска в дневнике.
 *
 * Зачем отдельный массив, а не FOOD_DB: автоплан приёмов (IndividualPlan/meal-plan-engine)
 * строит пулы 1-в-1 из FOOD_DB и сеет выбор по индексу пула — любая новая позиция в FOOD_DB
 * сдвигает seeded-пики и валит замки §8.112/§8.128/канон 3% (проверено: даже один
 * продукт-клон ломает planner-portion-hygiene-8112 при корректных КБЖУ). Колбаса/сосиски
 * к тому же не «еда автоплана» — тот же принцип, что у консервов (foodAvailableForPlan:
 * «вручную через поиск добавить можно; в БД id остаются»). Поэтому эти позиции живут
 * отдельным каталогом: его видит поиск дневника (AddFoodPanel) и не видит генератор рациона.
 *
 * Только то, чего нет в FOOD_DB: «Сосиски Ратимировские», «Колбаса вареная Докторская
 * Ратимир» и «Свиной окорок (варёный)» уже в каталоге — дублей не держим.
 *
 * Числа КБЖУ и микросы — из USDA FoodData Central (SR Legacy), fdcId указан рядом с позицией.
 * Ничего не «примерно»: у каждой записи есть конкретный fdcId.
 */
import type { FoodItem } from '../core/nutrition-database';

export const RU_DELI_FOODS: FoodItem[] = [
  // FDC 173864 «Ham, sliced, regular (approximately 11% fat)»
  {
    id: 'ham_boiled_ru',
    name: 'Ветчина варёная',
    category: 'protein',
    kcal: 164,
    protein: 16.6,
    fat: 8.8,
    carbs: 3.63,
    fiber: 0,
    gi: 0,
    servingSize: '100 г',
    tier: 'basic',
    bestFor: ['maintenance', 'cutting'],
    timing: 'any',
    description: 'Варёная ветчина нарезкой, солёный мясной продукт с заметным содержанием натрия',
    micros: { Ca: 24, Fe: 1.02, Mg: 22, Zn: 1.35, K: 287, Na: 814 },
  },
  // FDC 172939 «Sausage, smoked link sausage, pork and beef (nonfat dry milk added)»
  {
    id: 'sausage_short_ru',
    name: 'Сардельки',
    category: 'protein',
    kcal: 313,
    protein: 13.3,
    fat: 27.6,
    carbs: 1.92,
    fiber: 0,
    gi: 0,
    servingSize: '2 шт (100 г)',
    tier: 'basic',
    bestFor: ['maintenance'],
    timing: 'any',
    description: 'Короткие толстые сосиски из свинины и говядины, высокожировой продукт',
    micros: { Ca: 41, Fe: 1.47, Mg: 16, Zn: 1.96, K: 286, Na: 1170 },
  },
  // FDC 172954 «Sausage, Polish, pork and beef, smoked»
  {
    id: 'sausage_half_smoked_ru',
    name: 'Колбаса полукопчёная',
    category: 'protein',
    kcal: 301,
    protein: 12.1,
    fat: 26.6,
    carbs: 1.98,
    fiber: 0,
    gi: 0,
    servingSize: '50 г',
    tier: 'basic',
    bestFor: ['maintenance'],
    timing: 'any',
    description: 'Полукопчёная колбаса из свинины и говядины, солёная и жирная, небольшими порциями',
    micros: { Ca: 7, Fe: 1, Mg: 12, Zn: 2.11, K: 189, Na: 848 },
  },
  // FDC 167844 «Pork, fresh, shoulder, whole, separable lean and fat, cooked, roasted» — свежая запечённая лопатка (не солёная буженина: Na 68 мг/100 г)
  {
    id: 'pork_shoulder_roasted_ru',
    name: 'Свинина запечённая (лопатка)',
    category: 'protein',
    kcal: 292,
    protein: 23.3,
    fat: 21.4,
    carbs: 0,
    fiber: 0,
    gi: 0,
    servingSize: '100 г',
    tier: 'mid',
    bestFor: ['mass', 'maintenance'],
    timing: 'any',
    description: 'Запечённая свежая свиная лопатка без оболочки: мясной вкус и много жира, без добавленной соли',
    micros: { Ca: 24, Fe: 1.32, Mg: 18, Zn: 3.71, K: 329, Na: 68 },
  },
  // FDC 167842 «Pork, fresh, loin, top loin (roasts), boneless, separable lean and fat, cooked, roasted»
  {
    id: 'meat_carbonade_ru',
    name: 'Карбонад (запечённая свиная корейка)',
    category: 'protein',
    kcal: 192,
    protein: 26.4,
    fat: 8.82,
    carbs: 0,
    fiber: 0,
    gi: 0,
    servingSize: '100 г',
    tier: 'max',
    bestFor: ['cutting', 'maintenance', 'recomp'],
    timing: 'any',
    description: 'Запечённая спинная часть свинины без кости, постный мясной продукт',
    micros: { Ca: 7, Fe: 0.64, Mg: 25, Zn: 2.11, K: 349, Na: 46 },
  },
  // FDC 168277 «Pork, cured, bacon, unprepared» (солёно-копчёная свиная грудинка)
  {
    id: 'meat_brisket_smoked_ru',
    name: 'Грудинка копчёная',
    category: 'protein',
    kcal: 393,
    protein: 13.7,
    fat: 37.1,
    carbs: 0,
    fiber: 0,
    gi: 0,
    servingSize: '30 г',
    tier: 'basic',
    bestFor: ['mass', 'bulk'],
    timing: 'any',
    description: 'Солёно-копчёная свиная грудинка, очень высокая жирность, малые порции',
    micros: { Ca: 6, Fe: 0.38, Mg: 13, Zn: 1.14, K: 201, Na: 751 },
  },
];
