export interface FoodItem {
  id: string;
  name: string;
  category: 'protein' | 'carb' | 'fat' | 'dairy' | 'veg_fruit' | 'grain' | 'supplement' | 'fast_food' | 'other';
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  gi: number; // Glycemic Index (0-100)
  servingSize: string; // e.g. "100 г", "1 шт (250 мл)"
}

export const FOOD_DB: FoodItem[] = [
  // БЕЛКИ
  { id: 'chicken_breast', name: 'Куриная грудка (вареная)', category: 'protein', kcal: 165, protein: 31, fat: 3.6, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г' },
  { id: 'beef_lean', name: 'Говядина постная (тушеная)', category: 'protein', kcal: 200, protein: 26, fat: 10, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г' },
  { id: 'pork_tenderloin', name: 'Свиная вырезка', category: 'protein', kcal: 150, protein: 22, fat: 6, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г' },
  { id: 'salmon', name: 'Лосось/Семга (запеченная)', category: 'protein', kcal: 208, protein: 20, fat: 13, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г' },
  { id: 'tuna_canned', name: 'Тунец консервированный', category: 'protein', kcal: 116, protein: 25, fat: 1, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г' },
  { id: 'egg_whole', name: 'Яйцо куриное целое', category: 'protein', kcal: 155, protein: 13, fat: 11, carbs: 1.1, fiber: 0, gi: 0, servingSize: '1 шт (60 г)' },
  { id: 'egg_white', name: 'Белок яичный', category: 'protein', kcal: 52, protein: 11, fat: 0, carbs: 0.7, fiber: 0, gi: 0, servingSize: '100 г' },
  { id: 'whey_protein', name: 'Протеин сывороточный (1 скуп)', category: 'protein', kcal: 120, protein: 24, fat: 1.5, carbs: 2, fiber: 0, gi: 15, servingSize: '30 г' },
  { id: 'casein', name: 'Казеин', category: 'protein', kcal: 110, protein: 22, fat: 1, carbs: 3, fiber: 0, gi: 10, servingSize: '30 г' },

  // УГЛЕВОДЫ / ЗЕРНОВЫЕ
  { id: 'rice_white', name: 'Рис белый (вареный)', category: 'grain', kcal: 130, protein: 2.7, fat: 0.3, carbs: 28, fiber: 0.4, gi: 73, servingSize: '100 г' },
  { id: 'rice_brown', name: 'Рис бурый/дикий', category: 'grain', kcal: 112, protein: 2.6, fat: 0.9, carbs: 23, fiber: 1.8, gi: 50, servingSize: '100 г' },
  { id: 'oats', name: 'Овсянка (на воде)', category: 'grain', kcal: 71, protein: 2.5, fat: 1.4, carbs: 12, fiber: 1.7, gi: 55, servingSize: '100 г' },
  { id: 'buckwheat', name: 'Гречка (вареная)', category: 'grain', kcal: 110, protein: 4.2, fat: 1.1, carbs: 20, fiber: 2.7, gi: 45, servingSize: '100 г' },
  { id: 'quinoa', name: 'Киноа', category: 'grain', kcal: 120, protein: 4.4, fat: 1.9, carbs: 21, fiber: 2.8, gi: 53, servingSize: '100 г' },
  { id: 'bread_rye', name: 'Хлеб ржаной', category: 'grain', kcal: 214, protein: 6.5, fat: 1.2, carbs: 43, fiber: 5.5, gi: 60, servingSize: '1 ломтик (35 г)' },
  { id: 'pasta_durum', name: 'Макароны из твердых сортов', category: 'grain', kcal: 135, protein: 5, fat: 0.6, carbs: 27, fiber: 2.1, gi: 45, servingSize: '100 г' },
  { id: 'potato_boiled', name: 'Картофель отварной', category: 'carb', kcal: 82, protein: 2, fat: 0.1, carbs: 17, fiber: 1.5, gi: 65, servingSize: '1 шт (150 г)' },
  { id: 'sweet_potato', name: 'Батат', category: 'carb', kcal: 86, protein: 1.6, fat: 0.1, carbs: 20, fiber: 3, gi: 44, servingSize: '100 г' },
  { id: 'banana', name: 'Банан', category: 'veg_fruit', kcal: 89, protein: 1.1, fat: 0.3, carbs: 23, fiber: 2.6, gi: 51, servingSize: '1 шт (118 г)' },
  { id: 'apple', name: 'Яблоко', category: 'veg_fruit', kcal: 52, protein: 0.3, fat: 0.2, carbs: 14, fiber: 2.4, gi: 36, servingSize: '1 шт (180 г)' },
  { id: 'berries', name: 'Ягоды (микс)', category: 'veg_fruit', kcal: 40, protein: 0.6, fat: 0.2, carbs: 9, fiber: 2.4, gi: 25, servingSize: '100 г' },

  // ЖИРЫ
  { id: 'olive_oil', name: 'Оливковое масло', category: 'fat', kcal: 884, protein: 0, fat: 100, carbs: 0, fiber: 0, gi: 0, servingSize: '1 ст.л. (14 г)' },
  { id: 'avocado', name: 'Авокадо', category: 'fat', kcal: 160, protein: 2, fat: 15, carbs: 9, fiber: 7, gi: 10, servingSize: '1/2 шт (70 г)' },
  { id: 'nuts_mix', name: 'Орехи (грецкие/миндаль)', category: 'fat', kcal: 654, protein: 20, fat: 60, carbs: 14, fiber: 7, gi: 15, servingSize: '30 г' },
  { id: 'seeds', name: 'Семена льна/чиа', category: 'fat', kcal: 534, protein: 18, fat: 31, carbs: 29, fiber: 27, gi: 1, servingSize: '1 ст.л. (10 г)' },
  { id: 'butter', name: 'Сливочное масло', category: 'fat', kcal: 717, protein: 0.9, fat: 81, carbs: 0.1, fiber: 0, gi: 0, servingSize: '10 г' },

  // МОЛОЧКА
  { id: 'cottage_cheese_5', name: 'Творог 5%', category: 'dairy', kcal: 121, protein: 18, fat: 5, carbs: 2, fiber: 0, gi: 30, servingSize: '100 г' },
  { id: 'kefir', name: 'Кефир 1%', category: 'dairy', kcal: 40, protein: 3, fat: 1, carbs: 4, fiber: 0, gi: 15, servingSize: '200 мл' },
  { id: 'yogurt_greek', name: 'Греческий йогурт 2%', category: 'dairy', kcal: 60, protein: 10, fat: 2, carbs: 3.6, fiber: 0, gi: 25, servingSize: '150 г' },
  { id: 'milk', name: 'Молоко 2.5%', category: 'dairy', kcal: 52, protein: 2.8, fat: 2.5, carbs: 4.7, fiber: 0, gi: 30, servingSize: '200 мл' },
  { id: 'cheese_hard', name: 'Сыр твердый (Российский)', category: 'dairy', kcal: 350, protein: 24, fat: 27, carbs: 0.3, fiber: 0, gi: 0, servingSize: '30 г' },

  // ОВОЩИ
  { id: 'broccoli', name: 'Брокколи (отварная)', category: 'veg_fruit', kcal: 35, protein: 2.4, fat: 0.4, carbs: 7, fiber: 3.3, gi: 15, servingSize: '100 г' },
  { id: 'spinach', name: 'Шпинат', category: 'veg_fruit', kcal: 23, protein: 2.9, fat: 0.4, carbs: 3.6, fiber: 2.2, gi: 15, servingSize: '100 г' },
  { id: 'cucumber', name: 'Огурец', category: 'veg_fruit', kcal: 15, protein: 0.7, fat: 0.1, carbs: 2.9, fiber: 0.5, gi: 10, servingSize: '1 шт (150 г)' },
  { id: 'tomato', name: 'Помидор', category: 'veg_fruit', kcal: 18, protein: 0.9, fat: 0.2, carbs: 3.9, fiber: 1.2, gi: 10, servingSize: '1 шт (120 г)' },
  { id: 'pepper', name: 'Болгарский перец', category: 'veg_fruit', kcal: 27, protein: 1.3, fat: 0, carbs: 5.3, fiber: 2.1, gi: 15, servingSize: '1 шт (150 г)' },

  // ФАСТФУД / ГОТОВОЕ
  { id: 'shawarma', name: 'Шаурма средняя', category: 'fast_food', kcal: 550, protein: 25, fat: 22, carbs: 58, fiber: 2, gi: 65, servingSize: '1 шт (350 г)' },
  { id: 'pizza_margherita', name: 'Пицца Маргарита', category: 'fast_food', kcal: 240, protein: 9, fat: 8, carbs: 32, fiber: 2, gi: 70, servingSize: '1 кусок (120 г)' },
  { id: 'burger', name: 'Бургер классический', category: 'fast_food', kcal: 480, protein: 22, fat: 24, carbs: 42, fiber: 1.5, gi: 68, servingSize: '1 шт (250 г)' },

  // ДОБАВКИ
  { id: 'creatine', name: 'Креатин моногидрат', category: 'supplement', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '5 г' },
  { id: 'bcaa', name: 'BCAA 2:1:1', category: 'supplement', kcal: 20, protein: 5, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '10 г' },
  { id: 'glutamine', name: 'Глютамин', category: 'supplement', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '5 г' },
  { id: 'vitamin_complex', name: 'Мультивитамин', category: 'supplement', kcal: 5, protein: 0, fat: 0, carbs: 1, fiber: 0, gi: 0, servingSize: '1 табл' },
  { id: 'fish_oil', name: 'Рыбий жир (Омега-3)', category: 'supplement', kcal: 90, protein: 0, fat: 10, carbs: 0, fiber: 0, gi: 0, servingSize: '1 капсула (1 г)' }
];

export function searchFood(query: string): FoodItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return FOOD_DB.filter(f => 
    f.name.toLowerCase().includes(q) || 
    f.category.includes(q)
  ).slice(0, 8);
}

export function getFoodById(id: string): FoodItem | undefined {
  return FOOD_DB.find(f => f.id === id);
}

export function getFoodByCategory(cat: FoodItem['category']): FoodItem[] {
  return FOOD_DB.filter(f => f.category === cat);
}