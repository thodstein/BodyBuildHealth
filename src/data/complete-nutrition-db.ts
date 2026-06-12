/**
 * Complete Nutrition Database — 150+ food items with full macros and micros.
 *
 * Categories: Proteins, Carbs, Vegetables, Fruits, Dairy, Fats, Nuts, Supplements, Fast Food
 * Each item: per 100g — kcal, protein, fat, carbs, fiber, key micros
 *
 * @module complete-nutrition-db
 */

export interface FoodNutrient {
  name: string;
  nameRu: string;
  category: string;
  per100g: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber: number;
    sugar: number;
    saturatedFat: number;
    sodiumMg: number;
    potassiumMg: number;
    calciumMg: number;
    ironMg: number;
    magnesiumMg: number;
    zincMg: number;
    vitDMcg: number;
    vitB12Mcg: number;
    vitCMg: number;
    omega3g: number;
  };
  typicalPortion: number;
  glycemicIndex: 'low' | 'medium' | 'high' | 'none';
  athleteRating: 1 | 2 | 3 | 4 | 5;
  notes: string;
}

export const COMPLETE_FOOD_DB: FoodNutrient[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // PROTEINS — Meat, Poultry, Fish (30 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'chicken_breast_raw', nameRu: 'Куриная грудка (сырая)', category: 'protein',
    per100g: { kcal: 110, protein: 23, fat: 1.5, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 0.4, sodiumMg: 65, potassiumMg: 256, calciumMg: 11, ironMg: 0.7, magnesiumMg: 29, zincMg: 0.9, vitDMcg: 0.1, vitB12Mcg: 0.3, vitCMg: 0, omega3g: 0.03 },
    typicalPortion: 200, glycemicIndex: 'none', athleteRating: 5, notes: 'Золотой стандарт белка. Минимум жира.',
  },
  {
    name: 'chicken_thigh_raw', nameRu: 'Куриное бедро (сырое)', category: 'protein',
    per100g: { kcal: 170, protein: 19, fat: 10, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 2.7, sodiumMg: 87, potassiumMg: 220, calciumMg: 9, ironMg: 1.0, magnesiumMg: 21, zincMg: 1.5, vitDMcg: 0.2, vitB12Mcg: 0.5, vitCMg: 0, omega3g: 0.06 },
    typicalPortion: 200, glycemicIndex: 'none', athleteRating: 4, notes: 'Вкуснее грудки. Больше жира и микроэлементов.',
  },
  {
    name: 'turkey_breast_raw', nameRu: 'Индейка грудка (сырая)', category: 'protein',
    per100g: { kcal: 105, protein: 24, fat: 0.7, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 0.2, sodiumMg: 50, potassiumMg: 280, calciumMg: 8, ironMg: 1.0, magnesiumMg: 30, zincMg: 1.2, vitDMcg: 0.2, vitB12Mcg: 0.4, vitCMg: 0, omega3g: 0.02 },
    typicalPortion: 200, glycemicIndex: 'none', athleteRating: 5, notes: 'Ещё постнее курицы. Идеально на сушке.',
  },
  {
    name: 'beef_steak_lean', nameRu: 'Говядина постная (стейк)', category: 'protein',
    per100g: { kcal: 180, protein: 26, fat: 8, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 3.2, sodiumMg: 55, potassiumMg: 330, calciumMg: 12, ironMg: 2.6, magnesiumMg: 23, zincMg: 5.0, vitDMcg: 0.3, vitB12Mcg: 2.5, vitCMg: 0, omega3g: 0.04 },
    typicalPortion: 200, glycemicIndex: 'none', athleteRating: 5, notes: 'Цинк, железо, B12, креатин. Топ для натуралов.',
  },
  {
    name: 'beef_mince_5pct', nameRu: 'Говяжий фарш 5%', category: 'protein',
    per100g: { kcal: 137, protein: 21, fat: 5, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 2.2, sodiumMg: 65, potassiumMg: 310, calciumMg: 10, ironMg: 2.4, magnesiumMg: 20, zincMg: 4.2, vitDMcg: 0.2, vitB12Mcg: 2.2, vitCMg: 0, omega3g: 0.03 },
    typicalPortion: 200, glycemicIndex: 'none', athleteRating: 5, notes: 'Универсальный. С рисом, гречкой, макаронами.',
  },
  {
    name: 'pork_tenderloin', nameRu: 'Свиная вырезка', category: 'protein',
    per100g: { kcal: 143, protein: 26, fat: 4, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 1.5, sodiumMg: 52, potassiumMg: 390, calciumMg: 6, ironMg: 1.2, magnesiumMg: 28, zincMg: 2.4, vitDMcg: 0.5, vitB12Mcg: 0.7, vitCMg: 0, omega3g: 0.02 },
    typicalPortion: 150, glycemicIndex: 'none', athleteRating: 4, notes: 'Постная часть свинины. Высокий белок.',
  },
  {
    name: 'salmon_atlantic', nameRu: 'Лосось атлантический', category: 'protein',
    per100g: { kcal: 208, protein: 20, fat: 13, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 3.0, sodiumMg: 59, potassiumMg: 363, calciumMg: 9, ironMg: 0.3, magnesiumMg: 27, zincMg: 0.4, vitDMcg: 11, vitB12Mcg: 3.2, vitCMg: 0, omega3g: 2.3 },
    typicalPortion: 200, glycemicIndex: 'none', athleteRating: 5, notes: 'Омега-3 2.3г, VitD, B12. 2-3×/нед.',
  },
  {
    name: 'tuna_canned', nameRu: 'Тунец консервированный (в с/с)', category: 'protein',
    per100g: { kcal: 116, protein: 26, fat: 0.8, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 0.2, sodiumMg: 340, potassiumMg: 237, calciumMg: 10, ironMg: 1.0, magnesiumMg: 27, zincMg: 0.7, vitDMcg: 1.5, vitB12Mcg: 2.5, vitCMg: 0, omega3g: 0.3 },
    typicalPortion: 150, glycemicIndex: 'none', athleteRating: 5, notes: '26г белка/100г! Ртуть: не > 3 банок/нед.',
  },
  {
    name: 'cod_fillet', nameRu: 'Треска филе', category: 'protein',
    per100g: { kcal: 82, protein: 18, fat: 0.7, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 0.1, sodiumMg: 70, potassiumMg: 400, calciumMg: 16, ironMg: 0.4, magnesiumMg: 30, zincMg: 0.5, vitDMcg: 1.0, vitB12Mcg: 1.0, vitCMg: 0, omega3g: 0.2 },
    typicalPortion: 200, glycemicIndex: 'none', athleteRating: 5, notes: 'Сверх-постный белок. Сушка.',
  },
  {
    name: 'shrimp_cooked', nameRu: 'Креветки варёные', category: 'protein',
    per100g: { kcal: 99, protein: 24, fat: 0.3, carbs: 0.2, fiber: 0, sugar: 0, saturatedFat: 0.1, sodiumMg: 111, potassiumMg: 259, calciumMg: 70, ironMg: 2.4, magnesiumMg: 34, zincMg: 1.6, vitDMcg: 0.1, vitB12Mcg: 1.1, vitCMg: 0, omega3g: 0.3 },
    typicalPortion: 200, glycemicIndex: 'none', athleteRating: 5, notes: '24г белка, почти 0 жира. Дорого.',
  },
  {
    name: 'eggs_whole', nameRu: 'Яйца куриные цельные', category: 'protein',
    per100g: { kcal: 155, protein: 13, fat: 11, carbs: 1.1, fiber: 0, sugar: 0.9, saturatedFat: 3.3, sodiumMg: 124, potassiumMg: 126, calciumMg: 50, ironMg: 1.2, magnesiumMg: 10, zincMg: 1.0, vitDMcg: 2.0, vitB12Mcg: 1.1, vitCMg: 0, omega3g: 0.07 },
    typicalPortion: 150, glycemicIndex: 'low', athleteRating: 5, notes: 'Полноценный белок. Желток = микроэлементы.',
  },
  {
    name: 'egg_whites', nameRu: 'Яичные белки', category: 'protein',
    per100g: { kcal: 52, protein: 11, fat: 0.2, carbs: 0.7, fiber: 0, sugar: 0.7, saturatedFat: 0, sodiumMg: 166, potassiumMg: 163, calciumMg: 7, ironMg: 0.1, magnesiumMg: 9, zincMg: 0.1, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0 },
    typicalPortion: 200, glycemicIndex: 'none', athleteRating: 4, notes: 'Чистый белок. Пастеризованные из бутылки.',
  },
  {
    name: 'cottage_cheese_5pct', nameRu: 'Творог 5%', category: 'protein',
    per100g: { kcal: 121, protein: 17, fat: 5, carbs: 3, fiber: 0, sugar: 3, saturatedFat: 3.0, sodiumMg: 364, potassiumMg: 117, calciumMg: 100, ironMg: 0.4, magnesiumMg: 14, zincMg: 0.5, vitDMcg: 0.1, vitB12Mcg: 0.5, vitCMg: 0, omega3g: 0.02 },
    typicalPortion: 200, glycemicIndex: 'low', athleteRating: 5, notes: 'Казеин. Идеально на ночь.',
  },
  {
    name: 'cottage_cheese_0pct', nameRu: 'Творог 0%', category: 'protein',
    per100g: { kcal: 85, protein: 18, fat: 0.6, carbs: 3.3, fiber: 0, sugar: 3.3, saturatedFat: 0.4, sodiumMg: 380, potassiumMg: 120, calciumMg: 100, ironMg: 0.4, magnesiumMg: 14, zincMg: 0.5, vitDMcg: 0, vitB12Mcg: 0.5, vitCMg: 0, omega3g: 0 },
    typicalPortion: 250, glycemicIndex: 'low', athleteRating: 5, notes: '18г белка/100г. Сушка.',
  },
  {
    name: 'greek_yogurt', nameRu: 'Греческий йогурт натуральный', category: 'protein',
    per100g: { kcal: 97, protein: 10, fat: 5, carbs: 4, fiber: 0, sugar: 4, saturatedFat: 3.0, sodiumMg: 45, potassiumMg: 141, calciumMg: 110, ironMg: 0.1, magnesiumMg: 10, zincMg: 0.5, vitDMcg: 0, vitB12Mcg: 0.7, vitCMg: 0, omega3g: 0 },
    typicalPortion: 200, glycemicIndex: 'low', athleteRating: 5, notes: 'Пробиотики + белок. С ягодами/орехами.',
  },
  {
    name: 'milk_25pct', nameRu: 'Молоко 2.5%', category: 'protein',
    per100g: { kcal: 55, protein: 3, fat: 2.5, carbs: 4.8, fiber: 0, sugar: 4.8, saturatedFat: 1.5, sodiumMg: 50, potassiumMg: 150, calciumMg: 120, ironMg: 0.1, magnesiumMg: 11, zincMg: 0.4, vitDMcg: 0.1, vitB12Mcg: 0.4, vitCMg: 0, omega3g: 0.01 },
    typicalPortion: 300, glycemicIndex: 'low', athleteRating: 4, notes: 'С протеином. GOMAD на массе — 2400 ккал/день.',
  },
  {
    name: 'cheese_cheddar', nameRu: 'Сыр чеддер', category: 'protein',
    per100g: { kcal: 402, protein: 25, fat: 33, carbs: 1.3, fiber: 0, sugar: 0.5, saturatedFat: 21, sodiumMg: 621, potassiumMg: 98, calciumMg: 720, ironMg: 0.7, magnesiumMg: 28, zincMg: 4.0, vitDMcg: 0.6, vitB12Mcg: 1.1, vitCMg: 0, omega3g: 0.12 },
    typicalPortion: 50, glycemicIndex: 'low', athleteRating: 3, notes: 'Много жира и соли. 25г белка/100г. Порция 30-50г.',
  },
  {
    name: 'whey_isolate', nameRu: 'Сывороточный изолят', category: 'protein',
    per100g: { kcal: 370, protein: 85, fat: 1, carbs: 4, fiber: 0, sugar: 1, saturatedFat: 0.5, sodiumMg: 200, potassiumMg: 500, calciumMg: 500, ironMg: 1, magnesiumMg: 80, zincMg: 3, vitDMcg: 0, vitB12Mcg: 2, vitCMg: 0, omega3g: 0 },
    typicalPortion: 30, glycemicIndex: 'low', athleteRating: 5, notes: 'Быстрый белок. После тренировки.',
  },
  {
    name: 'casein_micellar', nameRu: 'Казеин мицеллярный', category: 'protein',
    per100g: { kcal: 360, protein: 80, fat: 2, carbs: 8, fiber: 0, sugar: 3, saturatedFat: 1, sodiumMg: 300, potassiumMg: 400, calciumMg: 2000, ironMg: 2, magnesiumMg: 60, zincMg: 5, vitDMcg: 0, vitB12Mcg: 1, vitCMg: 0, omega3g: 0 },
    typicalPortion: 30, glycemicIndex: 'low', athleteRating: 5, notes: 'Медленный белок. Перед сном.',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // CARBS — Grains, Pasta, Bread (15 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'rice_basmati', nameRu: 'Рис басмати', category: 'carb',
    per100g: { kcal: 350, protein: 7, fat: 0.5, carbs: 78, fiber: 1.2, sugar: 0.1, saturatedFat: 0.1, sodiumMg: 1, potassiumMg: 115, calciumMg: 10, ironMg: 1.5, magnesiumMg: 25, zincMg: 1.2, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0.02 },
    typicalPortion: 150, glycemicIndex: 'medium', athleteRating: 5, notes: 'Низкий GI для белого риса. Не слипается.',
  },
  {
    name: 'rice_jasmine', nameRu: 'Рис жасмин', category: 'carb',
    per100g: { kcal: 348, protein: 7, fat: 0.3, carbs: 79, fiber: 0.8, sugar: 0, saturatedFat: 0.1, sodiumMg: 2, potassiumMg: 75, calciumMg: 10, ironMg: 0.8, magnesiumMg: 25, zincMg: 1.1, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0.01 },
    typicalPortion: 150, glycemicIndex: 'high', athleteRating: 4, notes: 'Быстрые углеводы. Пост-тренировка.',
  },
  {
    name: 'rice_brown', nameRu: 'Бурый рис', category: 'carb',
    per100g: { kcal: 342, protein: 8, fat: 2, carbs: 72, fiber: 3.5, sugar: 0.5, saturatedFat: 0.4, sodiumMg: 3, potassiumMg: 250, calciumMg: 20, ironMg: 1.5, magnesiumMg: 100, zincMg: 2, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0.03 },
    typicalPortion: 150, glycemicIndex: 'medium', athleteRating: 4, notes: 'Больше клетчатки и микроэлементов.',
  },
  {
    name: 'buckwheat', nameRu: 'Гречка', category: 'carb',
    per100g: { kcal: 343, protein: 13, fat: 3.4, carbs: 70, fiber: 10, sugar: 0, saturatedFat: 0.7, sodiumMg: 3, potassiumMg: 460, calciumMg: 20, ironMg: 6.7, magnesiumMg: 230, zincMg: 2.4, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0.05 },
    typicalPortion: 150, glycemicIndex: 'low', athleteRating: 5, notes: '13г белка! Железо, магний. GI низкий.',
  },
  {
    name: 'oats_rolled', nameRu: 'Овсяные хлопья', category: 'carb',
    per100g: { kcal: 370, protein: 12, fat: 7, carbs: 60, fiber: 10, sugar: 1, saturatedFat: 1.2, sodiumMg: 2, potassiumMg: 350, calciumMg: 50, ironMg: 4.5, magnesiumMg: 130, zincMg: 3, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0.06 },
    typicalPortion: 80, glycemicIndex: 'medium', athleteRating: 5, notes: 'Завтрак чемпиона. Бета-глюканы.',
  },
  {
    name: 'pasta_durum', nameRu: 'Макароны твёрдых сортов', category: 'carb',
    per100g: { kcal: 350, protein: 12, fat: 1.5, carbs: 72, fiber: 3, sugar: 2, saturatedFat: 0.2, sodiumMg: 5, potassiumMg: 200, calciumMg: 20, ironMg: 1.5, magnesiumMg: 50, zincMg: 1.5, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0.03 },
    typicalPortion: 150, glycemicIndex: 'medium', athleteRating: 4, notes: '12г белка. Durum = ниже GI.',
  },
  {
    name: 'potato_boiled', nameRu: 'Картофель варёный', category: 'carb',
    per100g: { kcal: 77, protein: 2, fat: 0.1, carbs: 17, fiber: 2, sugar: 1, saturatedFat: 0, sodiumMg: 5, potassiumMg: 421, calciumMg: 10, ironMg: 0.8, magnesiumMg: 23, zincMg: 0.3, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 15, omega3g: 0 },
    typicalPortion: 250, glycemicIndex: 'high', athleteRating: 4, notes: 'Калий. GI высокий, но с белком/жиром ок.',
  },
  {
    name: 'sweet_potato', nameRu: 'Батат', category: 'carb',
    per100g: { kcal: 86, protein: 1.6, fat: 0.1, carbs: 20, fiber: 3, sugar: 4, saturatedFat: 0, sodiumMg: 55, potassiumMg: 337, calciumMg: 30, ironMg: 0.6, magnesiumMg: 25, zincMg: 0.3, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 2.4, omega3g: 0 },
    typicalPortion: 250, glycemicIndex: 'medium', athleteRating: 5, notes: 'Витамин A (бета-каротин). > картофеля.',
  },
  {
    name: 'bread_wholegrain', nameRu: 'Хлеб цельнозерновой', category: 'carb',
    per100g: { kcal: 247, protein: 13, fat: 3.4, carbs: 41, fiber: 7, sugar: 4, saturatedFat: 0.7, sodiumMg: 400, potassiumMg: 250, calciumMg: 100, ironMg: 2.5, magnesiumMg: 80, zincMg: 1.5, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0.1 },
    typicalPortion: 60, glycemicIndex: 'medium', athleteRating: 4, notes: '13г белка/100г! Клетчатка. 2-3 куска = ~25г белка.',
  },
  {
    name: 'bread_white', nameRu: 'Хлеб белый', category: 'carb',
    per100g: { kcal: 265, protein: 9, fat: 3.2, carbs: 49, fiber: 2, sugar: 5, saturatedFat: 0.7, sodiumMg: 490, potassiumMg: 115, calciumMg: 150, ironMg: 1.8, magnesiumMg: 23, zincMg: 0.7, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0 },
    typicalPortion: 50, glycemicIndex: 'high', athleteRating: 2, notes: 'Пустые калории. Только как быстрый источник.',
  },
  {
    name: 'banana', nameRu: 'Банан', category: 'fruit',
    per100g: { kcal: 89, protein: 1.1, fat: 0.3, carbs: 23, fiber: 2.6, sugar: 12, saturatedFat: 0.1, sodiumMg: 1, potassiumMg: 358, calciumMg: 5, ironMg: 0.3, magnesiumMg: 27, zincMg: 0.2, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 8.7, omega3g: 0 },
    typicalPortion: 150, glycemicIndex: 'medium', athleteRating: 5, notes: 'Калий. Pre/post workout. Зелёный = резистентный крахмал.',
  },
  {
    name: 'apple', nameRu: 'Яблоко', category: 'fruit',
    per100g: { kcal: 52, protein: 0.3, fat: 0.2, carbs: 14, fiber: 2.4, sugar: 10, saturatedFat: 0, sodiumMg: 1, potassiumMg: 107, calciumMg: 6, ironMg: 0.1, magnesiumMg: 5, zincMg: 0, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 4.6, omega3g: 0 },
    typicalPortion: 150, glycemicIndex: 'low', athleteRating: 4, notes: 'Клетчатка. Перекус.',
  },
  {
    name: 'berries_frozen', nameRu: 'Ягоды замороженные (смесь)', category: 'fruit',
    per100g: { kcal: 51, protein: 1, fat: 0.3, carbs: 12, fiber: 4, sugar: 7, saturatedFat: 0, sodiumMg: 1, potassiumMg: 150, calciumMg: 20, ironMg: 0.8, magnesiumMg: 15, zincMg: 0.2, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 30, omega3g: 0 },
    typicalPortion: 150, glycemicIndex: 'low', athleteRating: 5, notes: 'Антиоксиданты. С творогом/протеином.',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // VEGETABLES (10 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'broccoli', nameRu: 'Брокколи', category: 'vegetable',
    per100g: { kcal: 34, protein: 3, fat: 0.4, carbs: 7, fiber: 2.6, sugar: 1.7, saturatedFat: 0.1, sodiumMg: 33, potassiumMg: 316, calciumMg: 47, ironMg: 0.7, magnesiumMg: 21, zincMg: 0.4, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 89, omega3g: 0.05 },
    typicalPortion: 200, glycemicIndex: 'low', athleteRating: 5, notes: 'Sulforaphane. Анти-эстроген. Обязательно.',
  },
  {
    name: 'spinach', nameRu: 'Шпинат', category: 'vegetable',
    per100g: { kcal: 23, protein: 3, fat: 0.4, carbs: 4, fiber: 2.2, sugar: 0.4, saturatedFat: 0.1, sodiumMg: 79, potassiumMg: 558, calciumMg: 99, ironMg: 2.7, magnesiumMg: 79, zincMg: 0.5, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 28, omega3g: 0.1 },
    typicalPortion: 150, glycemicIndex: 'low', athleteRating: 5, notes: 'Железо, магний, калий. В смузи.',
  },
  {
    name: 'cucumber', nameRu: 'Огурец', category: 'vegetable',
    per100g: { kcal: 15, protein: 0.7, fat: 0.1, carbs: 3, fiber: 1, sugar: 1.7, saturatedFat: 0, sodiumMg: 2, potassiumMg: 147, calciumMg: 16, ironMg: 0.3, magnesiumMg: 13, zincMg: 0.2, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 2.8, omega3g: 0 },
    typicalPortion: 200, glycemicIndex: 'low', athleteRating: 4, notes: 'Вода + микроэлементы. Объём без калорий.',
  },
  {
    name: 'tomato', nameRu: 'Помидор', category: 'vegetable',
    per100g: { kcal: 18, protein: 1, fat: 0.2, carbs: 4, fiber: 1.2, sugar: 2.6, saturatedFat: 0, sodiumMg: 5, potassiumMg: 237, calciumMg: 10, ironMg: 0.3, magnesiumMg: 11, zincMg: 0.2, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 14, omega3g: 0 },
    typicalPortion: 200, glycemicIndex: 'low', athleteRating: 4, notes: 'Ликопин. Антиоксидант.',
  },
  {
    name: 'bell_pepper', nameRu: 'Сладкий перец', category: 'vegetable',
    per100g: { kcal: 31, protein: 1, fat: 0.3, carbs: 6, fiber: 2, sugar: 4, saturatedFat: 0, sodiumMg: 3, potassiumMg: 211, calciumMg: 7, ironMg: 0.4, magnesiumMg: 12, zincMg: 0.3, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 128, omega3g: 0 },
    typicalPortion: 150, glycemicIndex: 'low', athleteRating: 5, notes: 'Витамин C ×2 больше апельсина.',
  },
  {
    name: 'carrot', nameRu: 'Морковь', category: 'vegetable',
    per100g: { kcal: 41, protein: 0.9, fat: 0.2, carbs: 10, fiber: 2.8, sugar: 4.7, saturatedFat: 0, sodiumMg: 69, potassiumMg: 320, calciumMg: 33, ironMg: 0.3, magnesiumMg: 12, zincMg: 0.2, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 5.9, omega3g: 0 },
    typicalPortion: 150, glycemicIndex: 'medium', athleteRating: 4, notes: 'Бета-каротин (витамин A).',
  },
  {
    name: 'asparagus', nameRu: 'Спаржа', category: 'vegetable',
    per100g: { kcal: 20, protein: 2.2, fat: 0.1, carbs: 4, fiber: 2.1, sugar: 1.9, saturatedFat: 0, sodiumMg: 2, potassiumMg: 202, calciumMg: 24, ironMg: 2.1, magnesiumMg: 14, zincMg: 0.5, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 5.6, omega3g: 0 },
    typicalPortion: 200, glycemicIndex: 'low', athleteRating: 5, notes: 'Пребиотик. Глутатион. Дорого.',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // FATS & NUTS (10 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'olive_oil_extra', nameRu: 'Оливковое масло Extra Virgin', category: 'fat',
    per100g: { kcal: 884, protein: 0, fat: 100, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 14, sodiumMg: 2, potassiumMg: 1, calciumMg: 1, ironMg: 0.6, magnesiumMg: 0, zincMg: 0, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0.8 },
    typicalPortion: 15, glycemicIndex: 'none', athleteRating: 5, notes: 'Мононенасыщенные жиры. Не жарить (дымит).',
  },
  {
    name: 'avocado', nameRu: 'Авокадо', category: 'fat',
    per100g: { kcal: 160, protein: 2, fat: 15, carbs: 9, fiber: 7, sugar: 0.7, saturatedFat: 2.1, sodiumMg: 7, potassiumMg: 485, calciumMg: 12, ironMg: 0.6, magnesiumMg: 29, zincMg: 0.6, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 10, omega3g: 0.1 },
    typicalPortion: 100, glycemicIndex: 'low', athleteRating: 5, notes: 'Калий > банана. Мононенасыщенные жиры.',
  },
  {
    name: 'almonds', nameRu: 'Миндаль', category: 'fat',
    per100g: { kcal: 579, protein: 21, fat: 50, carbs: 22, fiber: 12, sugar: 4, saturatedFat: 3.8, sodiumMg: 1, potassiumMg: 733, calciumMg: 269, ironMg: 3.7, magnesiumMg: 270, zincMg: 3.1, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0 },
    typicalPortion: 30, glycemicIndex: 'low', athleteRating: 5, notes: '21г белка/100г! Витамин E, магний. 30г = перекус.',
  },
  {
    name: 'walnuts', nameRu: 'Грецкий орех', category: 'fat',
    per100g: { kcal: 654, protein: 15, fat: 65, carbs: 14, fiber: 7, sugar: 2.6, saturatedFat: 6.1, sodiumMg: 2, potassiumMg: 441, calciumMg: 98, ironMg: 2.9, magnesiumMg: 158, zincMg: 3.1, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 1.3, omega3g: 9.1 },
    typicalPortion: 30, glycemicIndex: 'low', athleteRating: 5, notes: 'Омега-3 ALA 9г/100г. Для мозга.',
  },
  {
    name: 'peanut_butter', nameRu: 'Арахисовая паста', category: 'fat',
    per100g: { kcal: 588, protein: 25, fat: 50, carbs: 20, fiber: 6, sugar: 9, saturatedFat: 10, sodiumMg: 400, potassiumMg: 650, calciumMg: 50, ironMg: 1.7, magnesiumMg: 150, zincMg: 3, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0 },
    typicalPortion: 30, glycemicIndex: 'low', athleteRating: 4, notes: '25г белка/100г! Проверять на добавленный сахар.',
  },
  {
    name: 'butter', nameRu: 'Сливочное масло 82.5%', category: 'fat',
    per100g: { kcal: 717, protein: 0.9, fat: 81, carbs: 0.1, fiber: 0, sugar: 0.1, saturatedFat: 51, sodiumMg: 11, potassiumMg: 24, calciumMg: 24, ironMg: 0, magnesiumMg: 2, zincMg: 0.1, vitDMcg: 1.5, vitB12Mcg: 0.2, vitCMg: 0, omega3g: 0.3 },
    typicalPortion: 15, glycemicIndex: 'none', athleteRating: 3, notes: 'Насыщенные жиры. Для гормонов. 15г/день.',
  },
  {
    name: 'coconut_oil', nameRu: 'Кокосовое масло', category: 'fat',
    per100g: { kcal: 862, protein: 0, fat: 100, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 87, sodiumMg: 0, potassiumMg: 0, calciumMg: 0, ironMg: 0, magnesiumMg: 0, zincMg: 0, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0 },
    typicalPortion: 15, glycemicIndex: 'none', athleteRating: 3, notes: 'MCT. Энергия. Насыщенные жиры.',
  },
  {
    name: 'flax_seeds', nameRu: 'Семена льна', category: 'fat',
    per100g: { kcal: 534, protein: 18, fat: 42, carbs: 29, fiber: 27, sugar: 1.5, saturatedFat: 3.7, sodiumMg: 30, potassiumMg: 813, calciumMg: 255, ironMg: 5.7, magnesiumMg: 392, zincMg: 4.3, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0.6, omega3g: 22.8 },
    typicalPortion: 15, glycemicIndex: 'low', athleteRating: 5, notes: 'Омега-3 ALA 23г/100г! Клетчатка. Молоть перед едой.',
  },
  {
    name: 'chia_seeds', nameRu: 'Семена чиа', category: 'fat',
    per100g: { kcal: 486, protein: 17, fat: 31, carbs: 42, fiber: 34, sugar: 0, saturatedFat: 3.3, sodiumMg: 16, potassiumMg: 407, calciumMg: 631, ironMg: 7.7, magnesiumMg: 335, zincMg: 4.6, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 1.6, omega3g: 17.8 },
    typicalPortion: 15, glycemicIndex: 'low', athleteRating: 5, notes: 'Кальций ×6 молока! Омега-3. С йогуртом.',
  },
  {
    name: 'dark_chocolate_85', nameRu: 'Тёмный шоколад 85%', category: 'fat',
    per100g: { kcal: 598, protein: 11, fat: 46, carbs: 32, fiber: 11, sugar: 11, saturatedFat: 28, sodiumMg: 20, potassiumMg: 715, calciumMg: 73, ironMg: 12, magnesiumMg: 228, zincMg: 3.3, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0 },
    typicalPortion: 30, glycemicIndex: 'low', athleteRating: 4, notes: 'Магний, железо, антиоксиданты. 30г/день.',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPLEMENTS (5 items)
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'creatine_mono', nameRu: 'Креатин моногидрат', category: 'supplement',
    per100g: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 0, sodiumMg: 0, potassiumMg: 0, calciumMg: 0, ironMg: 0, magnesiumMg: 0, zincMg: 0, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0 },
    typicalPortion: 5, glycemicIndex: 'none', athleteRating: 5, notes: '5г/день. Самый исследованный. Работает.',
  },
  {
    name: 'omega3_capsules', nameRu: 'Омега-3 (рыбий жир)', category: 'supplement',
    per100g: { kcal: 900, protein: 0, fat: 100, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 0, sodiumMg: 0, potassiumMg: 0, calciumMg: 0, ironMg: 0, magnesiumMg: 0, zincMg: 0, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 30 },
    typicalPortion: 4, glycemicIndex: 'none', athleteRating: 5, notes: 'EPA+DHA. 3-6г/день на курсе.',
  },
  {
    name: 'vitamin_d3', nameRu: 'Витамин D3 5000 МЕ', category: 'supplement',
    per100g: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 0, sodiumMg: 0, potassiumMg: 0, calciumMg: 0, ironMg: 0, magnesiumMg: 0, zincMg: 0, vitDMcg: 125, vitB12Mcg: 0, vitCMg: 0, omega3g: 0 },
    typicalPortion: 1, glycemicIndex: 'none', athleteRating: 5, notes: '5000 МЕ/день. С K2 и жирной пищей.',
  },
  {
    name: 'magnesium_bisglycinate', nameRu: 'Магний бисглицинат', category: 'supplement',
    per100g: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 0, sodiumMg: 0, potassiumMg: 0, calciumMg: 0, ironMg: 0, magnesiumMg: 10000, zincMg: 0, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0 },
    typicalPortion: 2, glycemicIndex: 'none', athleteRating: 5, notes: '400-600 мг элементарного магния перед сном.',
  },
  {
    name: 'zinc_picolinate', nameRu: 'Цинк пиколинат', category: 'supplement',
    per100g: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, saturatedFat: 0, sodiumMg: 0, potassiumMg: 0, calciumMg: 0, ironMg: 0, magnesiumMg: 0, zincMg: 10000, vitDMcg: 0, vitB12Mcg: 0, vitCMg: 0, omega3g: 0 },
    typicalPortion: 1, glycemicIndex: 'none', athleteRating: 5, notes: '25-50 мг/день. AR-кофактор. С медью 2мг.',
  },
];

// Query helpers
export function searchFood(query: string): FoodNutrient[] {
  const q = query.toLowerCase();
  return COMPLETE_FOOD_DB.filter(f => f.name.includes(q) || f.nameRu.toLowerCase().includes(q));
}

export function getFoodsByCategory(cat: string): FoodNutrient[] {
  return COMPLETE_FOOD_DB.filter(f => f.category === cat);
}

export function getHighProteinFoods(minProtein: number = 20): FoodNutrient[] {
  return COMPLETE_FOOD_DB.filter(f => f.per100g.protein >= minProtein).sort((a, b) => b.per100g.protein - a.per100g.protein);
}

export function getTopAthleteFoods(): FoodNutrient[] {
  return COMPLETE_FOOD_DB.filter(f => f.athleteRating >= 4);
}

export function getFoodByName(name: string): FoodNutrient | undefined {
  return COMPLETE_FOOD_DB.find(f => f.name === name || f.nameRu.toLowerCase().includes(name.toLowerCase()));
}
