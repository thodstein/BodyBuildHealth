// recipe-db-p39 — 4 «карб-лоад» рецепта для экстрим-углеводных дней (У≥8 г/кг при Б≥2.3 г/кг).
// Проблема: обычные ББ-блюда несут 35–60 г белка на 500–700 ккал; на 1500У рецептурный день
// систематически перебирал белок (+24…29%) и не мог закрыть угли (день финишировал −24%).
// Эти блюда — плотные углеводы с низким Б/У-отношением (5.4–11.5), собираются по formula
// (kcal = 4Б+4У+9Ж из FOOD_DB), во всех приёмах только id из FOOD_DB.
// Движок показывает их ТОЛЬКО в экстрим-полосе (tag 'carb-load' фильтруется вне неё) —
// обычные дни байт-в-байт прежние.
import { Recipe } from '../engines/nutrition-periodization.engine';

export const RECIPE_DB_P39: Recipe[] = [
  {
    name: 'Загрузка: рисовый боул с бананом и мёдом', meal: 'breakfast', prepTimeMin: 12,
    kcal: 709, protein: 15.7, fat: 3, carbs: 154.9,
    ingredientIds: ['rice_white', 'banana', 'honey', 'kefir'],
    portions: { rice_white: 350, banana: 150, honey: 20, kefir: 150 },
    ingredients: ['Рис белый (вареный) 350 г', 'Банан 150 г', 'Мёд 20 г', 'Кефир 1% 150 мл'],
    instructions: ['Отварите рис', 'Смешайте с кефиром и мёдом', 'Сверху — нарезанный банан'],
    tags: ['завтрак', 'carb-load', 'загрузка', 'высокоуглеводное'],
    usefulness: 8.1,
    description: '155 г углеводов при 16 г белка — ультра-углеводный завтрак для загрузочных дней',
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: false,
  },
  {
    name: 'Загрузка: рисовый крем с бананом и джемом', meal: 'breakfast', prepTimeMin: 8,
    kcal: 571, protein: 11.2, fat: 2.3, carbs: 126.3,
    ingredientIds: ['cream_of_rice', 'banana', 'jam', 'kefir'],
    portions: { cream_of_rice: 100, banana: 100, jam: 25, kefir: 100 },
    ingredients: ['Cream of Rice 100 г', 'Банан 100 г', 'Джем (варенье) 25 г', 'Кефир 1% 100 мл'],
    instructions: ['Залейте рисовый крем кефиром', 'Добавьте джем и банан', 'Перемешайте'],
    tags: ['завтрак', 'carb-load', 'загрузка', 'быстро'],
    usefulness: 7.9,
    description: '126 г углеводов, 8 минут — загрузочный завтрак без готовки',
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: false,
  },
  {
    name: 'Загрузка: спагетти с кукурузой и огурцом', meal: 'lunch', prepTimeMin: 15,
    kcal: 710, protein: 26, fat: 4.7, carbs: 140.9,
    ingredientIds: ['pasta_durum', 'corn', 'cucumber'],
    portions: { pasta_durum: 400, corn: 150, cucumber: 150 },
    ingredients: ['Макароны из твердых сортов 400 г', 'Кукуруза 150 г', 'Огурец 150 г'],
    instructions: ['Отварите макароны', 'Добавьте кукурузу и нарезанный огурец', 'Перемешайте'],
    tags: ['обед', 'carb-load', 'загрузка', 'высокоуглеводное'],
    usefulness: 8.0,
    description: '141 г углеводов при 26 г белка — плотный загрузочный обед',
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
  },
  {
    name: 'Загрузка: картофель с кукурузой и кефиром', meal: 'dinner', prepTimeMin: 20,
    kcal: 625, protein: 19.6, fat: 4.3, carbs: 127,
    ingredientIds: ['potato_boiled', 'corn', 'kefir'],
    portions: { potato_boiled: 500, corn: 200, kefir: 100 },
    ingredients: ['Картофель отварной 500 г', 'Кукуруза 200 г', 'Кефир 1% 100 мл'],
    instructions: ['Отварите картофель', 'Добавьте кукурузу', 'Подайте с кефиром'],
    tags: ['ужин', 'carb-load', 'загрузка', 'высокоуглеводное'],
    usefulness: 8.0,
    description: '127 г углеводов при 20 г белка — загрузочный ужин из цельных продуктов',
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: false,
  },
];
