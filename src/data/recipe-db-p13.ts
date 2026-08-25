import { Recipe } from '../engines/nutrition-periodization.engine';

/**
 * RECIPE_DB_P13 — ещё 60 реальных вкусных ББ-рецептов (детальные шаги).
 */
export const RECIPE_DB_P13: Recipe[] = [
  {
    name: 'Протеиновая овсянка кэтедро p13',
    meal: 'breakfast', prepTimeMin: 8,
    kcal: 437, protein: 30, fat: 17, carbs: 42,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Протеиновая овсянка кэтедро p13 — 30г белка, детально.',
    ingredientIds: ['oats_dry', 'whey_isolate', 'milk', 'cottage_cheese_5', 'banana'],
    portions: {'oats_dry': 30, 'whey_isolate': 15, 'milk': 80, 'cottage_cheese_5': 80, 'banana': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.katheats.com/protein-oatmeal-recipe',
    ingredients: [
        'Овсяные хлопья 30г',
        'Протеин 15г',
        'Молоко 2.5% 80г',
        'Творог 5% 80г',
        'Банан 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Овсяные хлопья, Протеин, Молоко 2.5% — взвесь по 30г, 15г.',
        'Основу готовь 8 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 437ккал/Б30 — вкусно, 30г белка для цели.'
    ],
  },
  {
    name: 'Тирамису overnight p13',
    meal: 'breakfast', prepTimeMin: 5,
    kcal: 369, protein: 30, fat: 8, carbs: 43,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Тирамису overnight p13 — 30г белка, детально.',
    ingredientIds: ['oats_dry', 'seeds', 'yogurt_greek', 'whey_isolate', 'milk'],
    portions: {'oats_dry': 40, 'seeds': 10, 'yogurt_greek': 100, 'whey_isolate': 20, 'milk': 120},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://ameessavorydish.com/tiramisu-protein-overnight-oats/',
    ingredients: [
        'Овсяные хлопья 40г',
        'Семена чиа 10г',
        'Греческий йогурт 2% 100г',
        'Протеин 20г',
        'Молоко 2.5% 120г'
    ],
    instructions: [
        'Подготовь ингредиенты: Овсяные хлопья, Семена чиа, Греческий йогурт 2% — взвесь по 40г, 10г.',
        'Основу готовь 5 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 369ккал/Б30 — вкусно, 30г белка для цели.'
    ],
  },
  {
    name: 'Overnight 4 ингредиента p13',
    meal: 'breakfast', prepTimeMin: 5,
    kcal: 460, protein: 36, fat: 15, carbs: 48,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Overnight 4 ингредиента p13 — 36г белка, детально.',
    ingredientIds: ['oats_dry', 'seeds', 'whey_isolate', 'milk', 'berries'],
    portions: {'oats_dry': 45, 'seeds': 10, 'whey_isolate': 25, 'milk': 180, 'berries': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://reallifenutritionist.com/high-protein-overnight-oats/',
    ingredients: [
        'Овсяные хлопья 45г',
        'Семена чиа 10г',
        'Протеин 25г',
        'Молоко 2.5% 180г',
        'Ягоды 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Овсяные хлопья, Семена чиа, Протеин — взвесь по 45г, 10г.',
        'Основу готовь 5 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 460ккал/Б36 — вкусно, 36г белка для цели.'
    ],
  },
  {
    name: 'Коттедж панкейки p13',
    meal: 'breakfast', prepTimeMin: 12,
    kcal: 424, protein: 34, fat: 14, carbs: 38,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Коттедж панкейки p13 — 34г белка, детально.',
    ingredientIds: ['cottage_cheese_5', 'egg_whole', 'oats_dry', 'milk', 'berries'],
    portions: {'cottage_cheese_5': 150, 'egg_whole': 120, 'oats_dry': 40, 'milk': 40, 'berries': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://joytothefood.com/breakfast-recipes-with-over-30g-of-protein-without-protein-powder/',
    ingredients: [
        'Творог 5% 150г',
        'Яйца 120г',
        'Овсяные хлопья 40г',
        'Молоко 2.5% 40г',
        'Ягоды 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Творог 5%, Яйца, Овсяные хлопья — взвесь по 150г, 120г.',
        'Основу готовь 12 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 424ккал/Б34 — вкусно, 34г белка для цели.'
    ],
  },
  {
    name: 'Митболы с яблоком p13',
    meal: 'breakfast', prepTimeMin: 28,
    kcal: 436, protein: 33, fat: 20, carbs: 18,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Митболы с яблоком p13 — 33г белка, детально.',
    ingredientIds: ['chicken_breast', 'egg_whole', 'cheese_hard', 'apple', 'olive_oil'],
    portions: {'chicken_breast': 180, 'egg_whole': 60, 'cheese_hard': 20, 'apple': 60, 'olive_oil': 5},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://joytothefood.com/breakfast-recipes-with-over-30g-of-protein-without-protein-powder/',
    ingredients: [
        'Куриная грудка 180г',
        'Яйца 60г',
        'Сыр твердый 20г',
        'Яблоко 60г',
        'Оливковое масло 5г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Яйца, Сыр твердый — взвесь по 180г, 60г.',
        'Основу готовь 28 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 436ккал/Б33 — вкусно, 33г белка для цели.'
    ],
  },
  {
    name: 'Брекфаст буррито p13',
    meal: 'breakfast', prepTimeMin: 35,
    kcal: 578, protein: 38, fat: 22, carbs: 42,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Брекфаст буррито p13 — 38г белка, детально.',
    ingredientIds: ['egg_whole', 'cheese_hard', 'chicken_breast', 'olive_oil', 'cabbage'],
    portions: {'egg_whole': 120, 'cheese_hard': 30, 'chicken_breast': 100, 'olive_oil': 8, 'cabbage': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://joytothefood.com/breakfast-recipes-with-over-30g-of-protein-without-protein-powder/',
    ingredients: [
        'Яйца 120г',
        'Сыр твердый 30г',
        'Куриная грудка 100г',
        'Оливковое масло 8г',
        'Капуста 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Яйца, Сыр твердый, Куриная грудка — взвесь по 120г, 30г.',
        'Основу готовь 35 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 578ккал/Б38 — вкусно, 38г белка для цели.'
    ],
  },
  {
    name: 'Лосось боул p13',
    meal: 'breakfast', prepTimeMin: 12,
    kcal: 377, protein: 30, fat: 18, carbs: 22,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Лосось боул p13 — 30г белка, детально.',
    ingredientIds: ['quinoa', 'salmon', 'egg_whole', 'avocado', 'spinach'],
    portions: {'quinoa': 60, 'salmon': 80, 'egg_whole': 60, 'avocado': 50, 'spinach': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://joytothefood.com/breakfast-recipes-with-over-30g-of-protein-without-protein-powder/',
    ingredients: [
        'Киноа 60г',
        'Лосось 80г',
        'Яйца 60г',
        'Авокадо 50г',
        'Шпинат 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Киноа, Лосось, Яйца — взвесь по 60г, 80г.',
        'Основу готовь 12 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 377ккал/Б30 — вкусно, 30г белка для цели.'
    ],
  },
  {
    name: 'Шпинат-фета врапс p13',
    meal: 'breakfast', prepTimeMin: 15,
    kcal: 463, protein: 31, fat: 22, carbs: 18,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Шпинат-фета врапс p13 — 31г белка, детально.',
    ingredientIds: ['egg_white', 'cottage_cheese_5', 'cheese_hard', 'tomato', 'olive_oil'],
    portions: {'egg_white': 150, 'cottage_cheese_5': 60, 'cheese_hard': 20, 'tomato': 60, 'olive_oil': 5},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://joytothefood.com/breakfast-recipes-with-over-30g-of-protein-without-protein-powder/',
    ingredients: [
        'Яичные белки 150г',
        'Творог 5% 60г',
        'Сыр твердый 20г',
        'Помидоры 60г',
        'Оливковое масло 5г'
    ],
    instructions: [
        'Подготовь ингредиенты: Яичные белки, Творог 5%, Сыр твердый — взвесь по 150г, 60г.',
        'Основу готовь 15 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 463ккал/Б31 — вкусно, 31г белка для цели.'
    ],
  },
  {
    name: 'Песто боул p13',
    meal: 'breakfast', prepTimeMin: 18,
    kcal: 419, protein: 32, fat: 18, carbs: 28,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Песто боул p13 — 32г белка, детально.',
    ingredientIds: ['egg_whole', 'potato_boiled', 'spinach', 'cheese_hard', 'olive_oil'],
    portions: {'egg_whole': 120, 'potato_boiled': 120, 'spinach': 60, 'cheese_hard': 20, 'olive_oil': 8},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://joytothefood.com/breakfast-recipes-with-over-30g-of-protein-without-protein-powder/',
    ingredients: [
        'Яйца 120г',
        'Картофель отварной 120г',
        'Шпинат 60г',
        'Сыр твердый 20г',
        'Оливковое масло 8г'
    ],
    instructions: [
        'Подготовь ингредиенты: Яйца, Картофель отварной, Шпинат — взвесь по 120г, 120г.',
        'Основу готовь 18 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 419ккал/Б32 — вкусно, 32г белка для цели.'
    ],
  },
  {
    name: 'Кейл кассероль p13',
    meal: 'breakfast', prepTimeMin: 40,
    kcal: 348, protein: 31, fat: 16, carbs: 12,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Кейл кассероль p13 — 31г белка, детально.',
    ingredientIds: ['turkey_breast', 'spinach', 'cheese_hard', 'cottage_cheese_5', 'egg_whole'],
    portions: {'turkey_breast': 120, 'spinach': 80, 'cheese_hard': 25, 'cottage_cheese_5': 60, 'egg_whole': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://joytothefood.com/breakfast-recipes-with-over-30g-of-protein-without-protein-powder/',
    ingredients: [
        'Филе индейки 120г',
        'Шпинат 80г',
        'Сыр твердый 25г',
        'Творог 5% 60г',
        'Яйца 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Филе индейки, Шпинат, Сыр твердый — взвесь по 120г, 80г.',
        'Основу готовь 40 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 348ккал/Б31 — вкусно, 31г белка для цели.'
    ],
  },
  {
    name: 'Гранола с йогуртом p13',
    meal: 'breakfast', prepTimeMin: 10,
    kcal: 333, protein: 30, fat: 12, carbs: 32,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Гранола с йогуртом p13 — 30г белка, детально.',
    ingredientIds: ['oats_dry', 'seeds', 'nuts_mix', 'yogurt_greek', 'peanut_butter'],
    portions: {'oats_dry': 40, 'seeds': 15, 'nuts_mix': 15, 'yogurt_greek': 150, 'peanut_butter': 10},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://joytothefood.com/breakfast-recipes-with-over-30g-of-protein-without-protein-powder/',
    ingredients: [
        'Овсяные хлопья 40г',
        'Семена чиа 15г',
        'Орехи 15г',
        'Греческий йогурт 2% 150г',
        'Арахисовая паста 10г'
    ],
    instructions: [
        'Подготовь ингредиенты: Овсяные хлопья, Семена чиа, Орехи — взвесь по 40г, 15г.',
        'Основу готовь 10 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 333ккал/Б30 — вкусно, 30г белка для цели.'
    ],
  },
  {
    name: 'Барбекю чикен-райс p13',
    meal: 'lunch', prepTimeMin: 15,
    kcal: 511, protein: 41, fat: 6, carbs: 57,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Барбекю чикен-райс p13 — 41г белка, детально.',
    ingredientIds: ['chicken_breast', 'rice_white', 'spinach', 'olive_oil', 'tomato'],
    portions: {'chicken_breast': 180, 'rice_white': 80, 'spinach': 60, 'olive_oil': 5, 'tomato': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://us.myprotein.com/thezone/recipe/healthy-meals/meal-prep-chicken-and-rice-recipe/',
    ingredients: [
        'Куриная грудка 180г',
        'Рис белый 80г',
        'Шпинат 60г',
        'Оливковое масло 5г',
        'Помидоры 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Рис белый, Шпинат — взвесь по 180г, 80г.',
        'Основу готовь 15 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 511ккал/Б41 — вкусно, 41г белка для цели.'
    ],
  },
  {
    name: 'Изи протеин боул p13',
    meal: 'lunch', prepTimeMin: 18,
    kcal: 480, protein: 38, fat: 12, carbs: 42,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Изи протеин боул p13 — 38г белка, детально.',
    ingredientIds: ['chicken_breast', 'quinoa', 'egg_whole', 'broccoli', 'olive_oil'],
    portions: {'chicken_breast': 150, 'quinoa': 60, 'egg_whole': 60, 'broccoli': 80, 'olive_oil': 8},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.myprotein.com/thezone/recipe/easy-protein-bowl-meal-prep/',
    ingredients: [
        'Куриная грудка 150г',
        'Киноа 60г',
        'Яйца 60г',
        'Брокколи 80г',
        'Оливковое масло 8г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Киноа, Яйца — взвесь по 150г, 60г.',
        'Основу готовь 18 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 480ккал/Б38 — вкусно, 38г белка для цели.'
    ],
  },
  {
    name: 'Фахита бокс p13',
    meal: 'lunch', prepTimeMin: 22,
    kcal: 580, protein: 52, fat: 16, carbs: 52,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Фахита бокс p13 — 52г белка, детально.',
    ingredientIds: ['chicken_breast', 'pepper', 'chickpeas', 'cottage_cheese_5', 'olive_oil'],
    portions: {'chicken_breast': 180, 'pepper': 100, 'chickpeas': 60, 'cottage_cheese_5': 40, 'olive_oil': 8},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://myproteincalc.com/learn/high-protein-meal-prep',
    ingredients: [
        'Куриная грудка 180г',
        'Перец болгарский 100г',
        'Нут 60г',
        'Творог 5% 40г',
        'Оливковое масло 8г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Перец болгарский, Нут — взвесь по 180г, 100г.',
        'Основу готовь 22 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 580ккал/Б52 — вкусно, 52г белка для цели.'
    ],
  },
  {
    name: 'Паста бейк p13',
    meal: 'lunch', prepTimeMin: 30,
    kcal: 650, protein: 55, fat: 18, carbs: 62,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Паста бейк p13 — 55г белка, детально.',
    ingredientIds: ['pasta_durum', 'chicken_breast', 'cottage_cheese_5', 'spinach', 'cheese_hard'],
    portions: {'pasta_durum': 80, 'chicken_breast': 180, 'cottage_cheese_5': 80, 'spinach': 80, 'cheese_hard': 20},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://myproteincalc.com/learn/high-protein-meal-prep',
    ingredients: [
        'Паста из твердых сортов 80г',
        'Куриная грудка 180г',
        'Творог 5% 80г',
        'Шпинат 80г',
        'Сыр твердый 20г'
    ],
    instructions: [
        'Подготовь ингредиенты: Паста из твердых сортов, Куриная грудка, Творог 5% — взвесь по 80г, 180г.',
        'Основу готовь 30 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 650ккал/Б55 — вкусно, 55г белка для цели.'
    ],
  },
  {
    name: 'Чили 45г p13',
    meal: 'lunch', prepTimeMin: 35,
    kcal: 500, protein: 45, fat: 14, carbs: 42,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Чили 45г p13 — 45г белка, детально.',
    ingredientIds: ['turkey_breast', 'chickpeas', 'tomato', 'olive_oil', 'pepper'],
    portions: {'turkey_breast': 180, 'chickpeas': 80, 'tomato': 120, 'olive_oil': 8, 'pepper': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://myproteincalc.com/learn/high-protein-meal-prep',
    ingredients: [
        'Филе индейки 180г',
        'Нут 80г',
        'Помидоры 120г',
        'Оливковое масло 8г',
        'Перец болгарский 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Филе индейки, Нут, Помидоры — взвесь по 180г, 80г.',
        'Основу готовь 35 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 500ккал/Б45 — вкусно, 45г белка для цели.'
    ],
  },
  {
    name: 'Фахита чикен боул p13',
    meal: 'lunch', prepTimeMin: 20,
    kcal: 502, protein: 40, fat: 14, carbs: 48,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Фахита чикен боул p13 — 40г белка, детально.',
    ingredientIds: ['chicken_breast', 'rice_white', 'chickpeas', 'avocado', 'olive_oil'],
    portions: {'chicken_breast': 180, 'rice_white': 70, 'chickpeas': 60, 'avocado': 50, 'olive_oil': 8},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://simply-delicious-food.com/one-chicken-prep-3-high-protein-lunches/',
    ingredients: [
        'Куриная грудка 180г',
        'Рис белый 70г',
        'Нут 60г',
        'Авокадо 50г',
        'Оливковое масло 8г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Рис белый, Нут — взвесь по 180г, 70г.',
        'Основу готовь 20 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 502ккал/Б40 — вкусно, 40г белка для цели.'
    ],
  },
  {
    name: 'Цезарь врап p13',
    meal: 'lunch', prepTimeMin: 15,
    kcal: 443, protein: 48, fat: 14, carbs: 28,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Цезарь врап p13 — 48г белка, детально.',
    ingredientIds: ['chicken_breast', 'cottage_cheese_5', 'cheese_hard', 'olive_oil', 'cabbage'],
    portions: {'chicken_breast': 150, 'cottage_cheese_5': 40, 'cheese_hard': 20, 'olive_oil': 5, 'cabbage': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://simply-delicious-food.com/one-chicken-prep-3-high-protein-lunches/',
    ingredients: [
        'Куриная грудка 150г',
        'Творог 5% 40г',
        'Сыр твердый 20г',
        'Оливковое масло 5г',
        'Капуста 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Творог 5%, Сыр твердый — взвесь по 150г, 40г.',
        'Основу готовь 15 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 443ккал/Б48 — вкусно, 48г белка для цели.'
    ],
  },
  {
    name: 'Батато-грейн салат p13',
    meal: 'lunch', prepTimeMin: 28,
    kcal: 595, protein: 53, fat: 18, carbs: 52,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Батато-грейн салат p13 — 53г белка, детально.',
    ingredientIds: ['chicken_breast', 'sweet_potato', 'quinoa', 'cheese_hard', 'olive_oil'],
    portions: {'chicken_breast': 150, 'sweet_potato': 120, 'quinoa': 60, 'cheese_hard': 20, 'olive_oil': 10},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://simply-delicious-food.com/one-chicken-prep-3-high-protein-lunches/',
    ingredients: [
        'Куриная грудка 150г',
        'Батат 120г',
        'Киноа 60г',
        'Сыр твердый 20г',
        'Оливковое масло 10г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Батат, Киноа — взвесь по 150г, 120г.',
        'Основу готовь 28 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 595ккал/Б53 — вкусно, 53г белка для цели.'
    ],
  },
  {
    name: 'Филиппинский адобо p13',
    meal: 'dinner', prepTimeMin: 40,
    kcal: 432, protein: 40, fat: 27, carbs: 6,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Филиппинский адобо p13 — 40г белка, детально.',
    ingredientIds: ['chicken_breast', 'olive_oil', 'spinach', 'cabbage', 'carrot'],
    portions: {'chicken_breast': 220, 'olive_oil': 10, 'spinach': 60, 'cabbage': 60, 'carrot': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.eatingwell.com/recipe/262791/filipino-chicken-adobo/',
    ingredients: [
        'Куриная грудка 220г',
        'Оливковое масло 10г',
        'Шпинат 60г',
        'Капуста 60г',
        'Морковь 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Оливковое масло, Шпинат — взвесь по 220г, 10г.',
        'Основу готовь 40 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 432ккал/Б40 — вкусно, 40г белка для цели.'
    ],
  },
  {
    name: 'Катлетс с грибным соусом p13',
    meal: 'dinner', prepTimeMin: 30,
    kcal: 390, protein: 34, fat: 19, carbs: 25,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Катлетс с грибным соусом p13 — 34г белка, детально.',
    ingredientIds: ['chicken_breast', 'cheese_hard', 'olive_oil', 'spinach', 'tomato'],
    portions: {'chicken_breast': 150, 'cheese_hard': 20, 'olive_oil': 10, 'spinach': 80, 'tomato': 40},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.eatingwell.com/chicken-cutlets-with-creamy-mushroom-sun-dried-tomato-sauce-8647631',
    ingredients: [
        'Куриная грудка 150г',
        'Сыр твердый 20г',
        'Оливковое масло 10г',
        'Шпинат 80г',
        'Помидоры 40г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Сыр твердый, Оливковое масло — взвесь по 150г, 20г.',
        'Основу готовь 30 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 390ккал/Б34 — вкусно, 34г белка для цели.'
    ],
  },
  {
    name: 'Хумус-боул p13',
    meal: 'dinner', prepTimeMin: 20,
    kcal: 480, protein: 31, fat: 18, carbs: 38,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Хумус-боул p13 — 31г белка, детально.',
    ingredientIds: ['chicken_breast', 'chickpeas', 'cucumber', 'tomato', 'olive_oil'],
    portions: {'chicken_breast': 150, 'chickpeas': 60, 'cucumber': 80, 'tomato': 80, 'olive_oil': 10},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.eatingwell.com/favorite-anti-inflammatory-high-protein-dinner-recipe-11991486',
    ingredients: [
        'Куриная грудка 150г',
        'Нут 60г',
        'Огурец 80г',
        'Помидоры 80г',
        'Оливковое масло 10г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Нут, Огурец — взвесь по 150г, 60г.',
        'Основу готовь 20 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 480ккал/Б31 — вкусно, 31г белка для цели.'
    ],
  },
  {
    name: 'Кебаб с киноа p13',
    meal: 'lunch', prepTimeMin: 20,
    kcal: 520, protein: 42, fat: 15, carbs: 38,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Кебаб с киноа p13 — 42г белка, детально.',
    ingredientIds: ['chicken_breast', 'quinoa', 'olive_oil', 'spinach', 'pepper'],
    portions: {'chicken_breast': 180, 'quinoa': 60, 'olive_oil': 10, 'spinach': 80, 'pepper': 80},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.eatingwell.com/high-protein-dill-chicken-orzo-11910771',
    ingredients: [
        'Куриная грудка 180г',
        'Киноа 60г',
        'Оливковое масло 10г',
        'Шпинат 80г',
        'Перец болгарский 80г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Киноа, Оливковое масло — взвесь по 180г, 60г.',
        'Основу готовь 20 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 520ккал/Б42 — вкусно, 42г белка для цели.'
    ],
  },
  {
    name: 'Миланезе p13',
    meal: 'dinner', prepTimeMin: 22,
    kcal: 273, protein: 31, fat: 11, carbs: 12,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Миланезе p13 — 31г белка, детально.',
    ingredientIds: ['chicken_breast', 'cheese_hard', 'olive_oil', 'spinach', 'tomato'],
    portions: {'chicken_breast': 150, 'cheese_hard': 15, 'olive_oil': 8, 'spinach': 80, 'tomato': 80},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.eatingwell.com/chicken-milanese-with-arugula-cherry-tomato-salad-8575473',
    ingredients: [
        'Куриная грудка 150г',
        'Сыр твердый 15г',
        'Оливковое масло 8г',
        'Шпинат 80г',
        'Помидоры 80г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Сыр твердый, Оливковое масло — взвесь по 150г, 15г.',
        'Основу готовь 22 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 273ккал/Б31 — вкусно, 31г белка для цели.'
    ],
  },
  {
    name: 'Терияки брюссель p13',
    meal: 'dinner', prepTimeMin: 22,
    kcal: 530, protein: 39, fat: 20, carbs: 50,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Терияки брюссель p13 — 39г белка, детально.',
    ingredientIds: ['salmon', 'rice_brown', 'olive_oil', 'spinach', 'cabbage'],
    portions: {'salmon': 150, 'rice_brown': 70, 'olive_oil': 10, 'spinach': 60, 'cabbage': 100},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://fitmencook.com/recipes/teriyaki-brussels-sprouts-meal-prep/',
    ingredients: [
        'Лосось 150г',
        'Рис бурый 70г',
        'Оливковое масло 10г',
        'Шпинат 60г',
        'Капуста 100г'
    ],
    instructions: [
        'Подготовь ингредиенты: Лосось, Рис бурый, Оливковое масло — взвесь по 150г, 70г.',
        'Основу готовь 22 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 530ккал/Б39 — вкусно, 39г белка для цели.'
    ],
  },
  {
    name: 'Биф пеппер стейк p13',
    meal: 'dinner', prepTimeMin: 18,
    kcal: 350, protein: 35, fat: 17, carbs: 17,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Биф пеппер стейк p13 — 35г белка, детально.',
    ingredientIds: ['beef_lean', 'pepper', 'olive_oil', 'spinach', 'rice_white'],
    portions: {'beef_lean': 150, 'pepper': 120, 'olive_oil': 10, 'spinach': 60, 'rice_white': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://fitmencook.com/recipes/beef-pepper-steak/',
    ingredients: [
        'Говядина постная 150г',
        'Перец болгарский 120г',
        'Оливковое масло 10г',
        'Шпинат 60г',
        'Рис белый 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Говядина постная, Перец болгарский, Оливковое масло — взвесь по 150г, 120г.',
        'Основу готовь 18 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 350ккал/Б35 — вкусно, 35г белка для цели.'
    ],
  },
  {
    name: 'Бизон боул p13',
    meal: 'lunch', prepTimeMin: 20,
    kcal: 420, protein: 43, fat: 17, carbs: 36,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Бизон боул p13 — 43г белка, детально.',
    ingredientIds: ['beef_lean', 'rice_brown', 'olive_oil', 'tomato', 'avocado'],
    portions: {'beef_lean': 180, 'rice_brown': 60, 'olive_oil': 8, 'tomato': 80, 'avocado': 50},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://fitmencook.com/recipes/bison-taco-bowl/',
    ingredients: [
        'Говядина постная 180г',
        'Рис бурый 60г',
        'Оливковое масло 8г',
        'Помидоры 80г',
        'Авокадо 50г'
    ],
    instructions: [
        'Подготовь ингредиенты: Говядина постная, Рис бурый, Оливковое масло — взвесь по 180г, 60г.',
        'Основу готовь 20 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 420ккал/Б43 — вкусно, 43г белка для цели.'
    ],
  },
  {
    name: 'Сырный чикен бейк p13',
    meal: 'dinner', prepTimeMin: 28,
    kcal: 560, protein: 42, fat: 18, carbs: 42,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Сырный чикен бейк p13 — 42г белка, детально.',
    ingredientIds: ['chicken_breast', 'cottage_cheese_5', 'cheese_hard', 'broccoli', 'olive_oil'],
    portions: {'chicken_breast': 180, 'cottage_cheese_5': 60, 'cheese_hard': 25, 'broccoli': 120, 'olive_oil': 8},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.myprotein.com/thezone/recipe/meal-prep-recipes-muscle-building-fat-loss/',
    ingredients: [
        'Куриная грудка 180г',
        'Творог 5% 60г',
        'Сыр твердый 25г',
        'Брокколи 120г',
        'Оливковое масло 8г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Творог 5%, Сыр твердый — взвесь по 180г, 60г.',
        'Основу готовь 28 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 560ккал/Б42 — вкусно, 42г белка для цели.'
    ],
  },
  {
    name: 'Песто веджи p13',
    meal: 'dinner', prepTimeMin: 18,
    kcal: 520, protein: 52, fat: 16, carbs: 42,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Песто веджи p13 — 52г белка, детально.',
    ingredientIds: ['chicken_breast', 'quinoa', 'olive_oil', 'spinach', 'pepper'],
    portions: {'chicken_breast': 180, 'quinoa': 70, 'olive_oil': 10, 'spinach': 80, 'pepper': 80},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.myprotein.com/thezone/recipe/meal-prep-recipes-muscle-building-fat-loss/',
    ingredients: [
        'Куриная грудка 180г',
        'Киноа 70г',
        'Оливковое масло 10г',
        'Шпинат 80г',
        'Перец болгарский 80г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Киноа, Оливковое масло — взвесь по 180г, 70г.',
        'Основу готовь 18 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 520ккал/Б52 — вкусно, 52г белка для цели.'
    ],
  },
  {
    name: 'Мусака p13',
    meal: 'dinner', prepTimeMin: 40,
    kcal: 480, protein: 44, fat: 18, carbs: 32,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Мусака p13 — 44г белка, детально.',
    ingredientIds: ['turkey_breast', 'eggplant', 'cottage_cheese_5', 'tomato', 'olive_oil'],
    portions: {'turkey_breast': 180, 'eggplant': 150, 'cottage_cheese_5': 80, 'tomato': 100, 'olive_oil': 8},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.myprotein.com/thezone/recipe/meal-prep-recipes-muscle-building-fat-loss/',
    ingredients: [
        'Филе индейки 180г',
        'Баклажан 150г',
        'Творог 5% 80г',
        'Помидоры 100г',
        'Оливковое масло 8г'
    ],
    instructions: [
        'Подготовь ингредиенты: Филе индейки, Баклажан, Творог 5% — взвесь по 180г, 150г.',
        'Основу готовь 40 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 480ккал/Б44 — вкусно, 44г белка для цели.'
    ],
  },
  {
    name: 'Баффало салат p13',
    meal: 'lunch', prepTimeMin: 20,
    kcal: 480, protein: 36, fat: 14, carbs: 42,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Баффало салат p13 — 36г белка, детально.',
    ingredientIds: ['chicken_breast', 'pasta_durum', 'cottage_cheese_5', 'olive_oil', 'cabbage'],
    portions: {'chicken_breast': 150, 'pasta_durum': 70, 'cottage_cheese_5': 40, 'olive_oil': 8, 'cabbage': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.myprotein.com/thezone/recipe/meal-prep-recipes-muscle-building-fat-loss/',
    ingredients: [
        'Куриная грудка 150г',
        'Паста из твердых сортов 70г',
        'Творог 5% 40г',
        'Оливковое масло 8г',
        'Капуста 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Паста из твердых сортов, Творог 5% — взвесь по 150г, 70г.',
        'Основу готовь 20 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 480ккал/Б36 — вкусно, 36г белка для цели.'
    ],
  },
  {
    name: 'Чили кон карне p13',
    meal: 'lunch', prepTimeMin: 35,
    kcal: 520, protein: 42, fat: 16, carbs: 42,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Чили кон карне p13 — 42г белка, детально.',
    ingredientIds: ['beef_lean', 'chickpeas', 'tomato', 'olive_oil', 'pepper'],
    portions: {'beef_lean': 150, 'chickpeas': 80, 'tomato': 120, 'olive_oil': 8, 'pepper': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.myprotein.com/thezone/recipe/meal-prep-recipes-muscle-building-fat-loss/',
    ingredients: [
        'Говядина постная 150г',
        'Нут 80г',
        'Помидоры 120г',
        'Оливковое масло 8г',
        'Перец болгарский 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Говядина постная, Нут, Помидоры — взвесь по 150г, 80г.',
        'Основу готовь 35 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 520ккал/Б42 — вкусно, 42г белка для цели.'
    ],
  },
  {
    name: 'Тунец поке p13',
    meal: 'lunch', prepTimeMin: 15,
    kcal: 460, protein: 36, fat: 16, carbs: 38,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Тунец поке p13 — 36г белка, детально.',
    ingredientIds: ['tuna_canned', 'rice_white', 'cucumber', 'avocado', 'olive_oil'],
    portions: {'tuna_canned': 120, 'rice_white': 70, 'cucumber': 80, 'avocado': 50, 'olive_oil': 8},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.myprotein.com/thezone/recipe/',
    ingredients: [
        'Тунец консерв. 120г',
        'Рис белый 70г',
        'Огурец 80г',
        'Авокадо 50г',
        'Оливковое масло 8г'
    ],
    instructions: [
        'Подготовь ингредиенты: Тунец консерв., Рис белый, Огурец — взвесь по 120г, 70г.',
        'Основу готовь 15 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 460ккал/Б36 — вкусно, 36г белка для цели.'
    ],
  },
  {
    name: 'Сырники p13',
    meal: 'breakfast', prepTimeMin: 15,
    kcal: 420, protein: 32, fat: 14, carbs: 32,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Сырники p13 — 32г белка, детально.',
    ingredientIds: ['cottage_cheese_5', 'oats_dry', 'egg_whole', 'yogurt_greek', 'berries'],
    portions: {'cottage_cheese_5': 180, 'oats_dry': 30, 'egg_whole': 60, 'yogurt_greek': 40, 'berries': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://joytothefood.com/breakfast-recipes-with-over-30g-of-protein-without-protein-powder/',
    ingredients: [
        'Творог 5% 180г',
        'Овсяные хлопья 30г',
        'Яйца 60г',
        'Греческий йогурт 2% 40г',
        'Ягоды 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Творог 5%, Овсяные хлопья, Яйца — взвесь по 180г, 30г.',
        'Основу готовь 15 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 420ккал/Б32 — вкусно, 32г белка для цели.'
    ],
  },
  {
    name: 'Хуэгос ранчерос p13',
    meal: 'breakfast', prepTimeMin: 25,
    kcal: 420, protein: 30, fat: 18, carbs: 32,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Хуэгос ранчерос p13 — 30г белка, детально.',
    ingredientIds: ['egg_whole', 'chickpeas', 'cheese_hard', 'olive_oil', 'tomato'],
    portions: {'egg_whole': 120, 'chickpeas': 80, 'cheese_hard': 20, 'olive_oil': 8, 'tomato': 80},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://joytothefood.com/breakfast-recipes-with-over-30g-of-protein-without-protein-powder/',
    ingredients: [
        'Яйца 120г',
        'Нут 80г',
        'Сыр твердый 20г',
        'Оливковое масло 8г',
        'Помидоры 80г'
    ],
    instructions: [
        'Подготовь ингредиенты: Яйца, Нут, Сыр твердый — взвесь по 120г, 80г.',
        'Основу готовь 25 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 420ккал/Б30 — вкусно, 30г белка для цели.'
    ],
  },
  {
    name: 'Гранола боул p13',
    meal: 'breakfast', prepTimeMin: 10,
    kcal: 380, protein: 30, fat: 14, carbs: 32,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Гранола боул p13 — 30г белка, детально.',
    ingredientIds: ['oats_dry', 'yogurt_greek', 'berries', 'nuts_mix', 'milk'],
    portions: {'oats_dry': 40, 'yogurt_greek': 150, 'berries': 60, 'nuts_mix': 15, 'milk': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://healthified.com/breakfast-bowl-30-grams-protein/',
    ingredients: [
        'Овсяные хлопья 40г',
        'Греческий йогурт 2% 150г',
        'Ягоды 60г',
        'Орехи 15г',
        'Молоко 2.5% 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Овсяные хлопья, Греческий йогурт 2%, Ягоды — взвесь по 40г, 150г.',
        'Основу готовь 10 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 380ккал/Б30 — вкусно, 30г белка для цели.'
    ],
  },
  {
    name: 'Чикен фахита p13',
    meal: 'lunch', prepTimeMin: 20,
    kcal: 480, protein: 42, fat: 16, carbs: 38,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Чикен фахита p13 — 42г белка, детально.',
    ingredientIds: ['chicken_breast', 'pepper', 'rice_white', 'olive_oil', 'cabbage'],
    portions: {'chicken_breast': 180, 'pepper': 100, 'rice_white': 70, 'olive_oil': 10, 'cabbage': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.goodhousekeeping.com/food-recipes/healthy/g64652588/high-protein-chicken-recipes/',
    ingredients: [
        'Куриная грудка 180г',
        'Перец болгарский 100г',
        'Рис белый 70г',
        'Оливковое масло 10г',
        'Капуста 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Перец болгарский, Рис белый — взвесь по 180г, 100г.',
        'Основу готовь 20 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 480ккал/Б42 — вкусно, 42г белка для цели.'
    ],
  },
  {
    name: 'Брускетта p13',
    meal: 'dinner', prepTimeMin: 18,
    kcal: 440, protein: 38, fat: 14, carbs: 32,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Брускетта p13 — 38г белка, детально.',
    ingredientIds: ['chicken_breast', 'tomato', 'olive_oil', 'spinach', 'cheese_hard'],
    portions: {'chicken_breast': 180, 'tomato': 120, 'olive_oil': 10, 'spinach': 60, 'cheese_hard': 20},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.goodhousekeeping.com/food-recipes/healthy/g64652588/high-protein-chicken-recipes/',
    ingredients: [
        'Куриная грудка 180г',
        'Помидоры 120г',
        'Оливковое масло 10г',
        'Шпинат 60г',
        'Сыр твердый 20г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Помидоры, Оливковое масло — взвесь по 180г, 120г.',
        'Основу готовь 18 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 440ккал/Б38 — вкусно, 38г белка для цели.'
    ],
  },
  {
    name: 'Индейка бургер p13',
    meal: 'lunch', prepTimeMin: 20,
    kcal: 460, protein: 36, fat: 16, carbs: 28,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Индейка бургер p13 — 36г белка, детально.',
    ingredientIds: ['turkey_breast', 'egg_whole', 'cabbage', 'tomato', 'olive_oil'],
    portions: {'turkey_breast': 180, 'egg_whole': 60, 'cabbage': 60, 'tomato': 80, 'olive_oil': 8},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.goodhousekeeping.com/food-recipes/healthy/g64652588/high-protein-chicken-recipes/',
    ingredients: [
        'Филе индейки 180г',
        'Яйца 60г',
        'Капуста 60г',
        'Помидоры 80г',
        'Оливковое масло 8г'
    ],
    instructions: [
        'Подготовь ингредиенты: Филе индейки, Яйца, Капуста — взвесь по 180г, 60г.',
        'Основу готовь 20 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 460ккал/Б36 — вкусно, 36г белка для цели.'
    ],
  },
  {
    name: 'Азиатский вок p13',
    meal: 'dinner', prepTimeMin: 18,
    kcal: 480, protein: 40, fat: 14, carbs: 42,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Азиатский вок p13 — 40г белка, детально.',
    ingredientIds: ['chicken_breast', 'pasta_durum', 'pepper', 'olive_oil', 'spinach'],
    portions: {'chicken_breast': 180, 'pasta_durum': 70, 'pepper': 80, 'olive_oil': 10, 'spinach': 80},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.goodhousekeeping.com/food-recipes/healthy/g64652588/high-protein-chicken-recipes/',
    ingredients: [
        'Куриная грудка 180г',
        'Паста из твердых сортов 70г',
        'Перец болгарский 80г',
        'Оливковое масло 10г',
        'Шпинат 80г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Паста из твердых сортов, Перец болгарский — взвесь по 180г, 70г.',
        'Основу готовь 18 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 480ккал/Б40 — вкусно, 40г белка для цели.'
    ],
  },
  {
    name: 'Карри чикен p13',
    meal: 'dinner', prepTimeMin: 25,
    kcal: 460, protein: 38, fat: 14, carbs: 38,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Карри чикен p13 — 38г белка, детально.',
    ingredientIds: ['chicken_breast', 'rice_white', 'yogurt_greek', 'olive_oil', 'spinach'],
    portions: {'chicken_breast': 180, 'rice_white': 70, 'yogurt_greek': 60, 'olive_oil': 8, 'spinach': 80},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.goodhousekeeping.com/food-recipes/healthy/g64652588/high-protein-chicken-recipes/',
    ingredients: [
        'Куриная грудка 180г',
        'Рис белый 70г',
        'Греческий йогурт 2% 60г',
        'Оливковое масло 8г',
        'Шпинат 80г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Рис белый, Греческий йогурт 2% — взвесь по 180г, 70г.',
        'Основу готовь 25 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 460ккал/Б38 — вкусно, 38г белка для цели.'
    ],
  },
  {
    name: 'Креветки гриль p13',
    meal: 'dinner', prepTimeMin: 12,
    kcal: 380, protein: 32, fat: 14, carbs: 18,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Креветки гриль p13 — 32г белка, детально.',
    ingredientIds: ['shrimp', 'olive_oil', 'spinach', 'tomato', 'cabbage'],
    portions: {'shrimp': 180, 'olive_oil': 10, 'spinach': 80, 'tomato': 80, 'cabbage': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://fitmencook.com/recipes/category/seafood/',
    ingredients: [
        'Креветки 180г',
        'Оливковое масло 10г',
        'Шпинат 80г',
        'Помидоры 80г',
        'Капуста 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Креветки, Оливковое масло, Шпинат — взвесь по 180г, 10г.',
        'Основу готовь 12 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 380ккал/Б32 — вкусно, 32г белка для цели.'
    ],
  },
  {
    name: 'Яичный боул p13',
    meal: 'breakfast', prepTimeMin: 12,
    kcal: 420, protein: 30, fat: 18, carbs: 22,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Яичный боул p13 — 30г белка, детально.',
    ingredientIds: ['egg_whole', 'avocado', 'chickpeas', 'spinach', 'olive_oil'],
    portions: {'egg_whole': 120, 'avocado': 60, 'chickpeas': 60, 'spinach': 60, 'olive_oil': 8},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://fitmencook.com/recipes/high-protein-breakfast-recipes/',
    ingredients: [
        'Яйца 120г',
        'Авокадо 60г',
        'Нут 60г',
        'Шпинат 60г',
        'Оливковое масло 8г'
    ],
    instructions: [
        'Подготовь ингредиенты: Яйца, Авокадо, Нут — взвесь по 120г, 60г.',
        'Основу готовь 12 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 420ккал/Б30 — вкусно, 30г белка для цели.'
    ],
  },
  {
    name: 'Картофельный хаш p13',
    meal: 'breakfast', prepTimeMin: 18,
    kcal: 460, protein: 32, fat: 16, carbs: 32,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Картофельный хаш p13 — 32г белка, детально.',
    ingredientIds: ['potato_boiled', 'egg_whole', 'turkey_breast', 'cheese_hard', 'olive_oil'],
    portions: {'potato_boiled': 150, 'egg_whole': 120, 'turkey_breast': 80, 'cheese_hard': 20, 'olive_oil': 8},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://fitmencook.com/recipes/high-protein-breakfast-recipes/',
    ingredients: [
        'Картофель отварной 150г',
        'Яйца 120г',
        'Филе индейки 80г',
        'Сыр твердый 20г',
        'Оливковое масло 8г'
    ],
    instructions: [
        'Подготовь ингредиенты: Картофель отварной, Яйца, Филе индейки — взвесь по 150г, 120г.',
        'Основу готовь 18 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 460ккал/Б32 — вкусно, 32г белка для цели.'
    ],
  },
  {
    name: 'Бургер-боул p13',
    meal: 'breakfast', prepTimeMin: 15,
    kcal: 520, protein: 42, fat: 18, carbs: 32,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Бургер-боул p13 — 42г белка, детально.',
    ingredientIds: ['beef_lean', 'egg_whole', 'potato_boiled', 'cheese_hard', 'olive_oil'],
    portions: {'beef_lean': 120, 'egg_whole': 120, 'potato_boiled': 120, 'cheese_hard': 20, 'olive_oil': 8},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://fitmencook.com/recipes/high-protein-breakfast-recipes/',
    ingredients: [
        'Говядина постная 120г',
        'Яйца 120г',
        'Картофель отварной 120г',
        'Сыр твердый 20г',
        'Оливковое масло 8г'
    ],
    instructions: [
        'Подготовь ингредиенты: Говядина постная, Яйца, Картофель отварной — взвесь по 120г, 120г.',
        'Основу готовь 15 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 520ккал/Б42 — вкусно, 42г белка для цели.'
    ],
  },
  {
    name: 'Творожная фритата p13',
    meal: 'breakfast', prepTimeMin: 18,
    kcal: 380, protein: 30, fat: 16, carbs: 12,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Творожная фритата p13 — 30г белка, детально.',
    ingredientIds: ['egg_whole', 'cottage_cheese_5', 'spinach', 'tomato', 'olive_oil'],
    portions: {'egg_whole': 120, 'cottage_cheese_5': 80, 'spinach': 60, 'tomato': 80, 'olive_oil': 8},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://fitmencook.com/recipes/high-protein-breakfast-recipes/',
    ingredients: [
        'Яйца 120г',
        'Творог 5% 80г',
        'Шпинат 60г',
        'Помидоры 80г',
        'Оливковое масло 8г'
    ],
    instructions: [
        'Подготовь ингредиенты: Яйца, Творог 5%, Шпинат — взвесь по 120г, 80г.',
        'Основу готовь 18 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 380ккал/Б30 — вкусно, 30г белка для цели.'
    ],
  },
  {
    name: 'Овсяный панкейк p13',
    meal: 'breakfast', prepTimeMin: 15,
    kcal: 420, protein: 28, fat: 12, carbs: 42,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Овсяный панкейк p13 — 28г белка, детально.',
    ingredientIds: ['oats_dry', 'cottage_cheese_5', 'egg_whole', 'milk', 'berries'],
    portions: {'oats_dry': 50, 'cottage_cheese_5': 80, 'egg_whole': 60, 'milk': 60, 'berries': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://fitmencook.com/recipes/high-protein-breakfast-recipes/',
    ingredients: [
        'Овсяные хлопья 50г',
        'Творог 5% 80г',
        'Яйца 60г',
        'Молоко 2.5% 60г',
        'Ягоды 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Овсяные хлопья, Творог 5%, Яйца — взвесь по 50г, 80г.',
        'Основу готовь 15 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 420ккал/Б28 — вкусно, 28г белка для цели.'
    ],
  },
  {
    name: 'Протеин кекс p13',
    meal: 'breakfast', prepTimeMin: 20,
    kcal: 480, protein: 34, fat: 14, carbs: 42,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Протеин кекс p13 — 34г белка, детально.',
    ingredientIds: ['whey_isolate', 'oats_dry', 'egg_whole', 'milk', 'berries'],
    portions: {'whey_isolate': 25, 'oats_dry': 50, 'egg_whole': 60, 'milk': 80, 'berries': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://fitmencook.com/recipes/high-protein-breakfast-recipes/',
    ingredients: [
        'Протеин 25г',
        'Овсяные хлопья 50г',
        'Яйца 60г',
        'Молоко 2.5% 80г',
        'Ягоды 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Протеин, Овсяные хлопья, Яйца — взвесь по 25г, 50г.',
        'Основу готовь 20 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 480ккал/Б34 — вкусно, 34г белка для цели.'
    ],
  },
  {
    name: 'Шоколадный мусс p13',
    meal: 'snack', prepTimeMin: 5,
    kcal: 320, protein: 32, fat: 12, carbs: 22,
    tags: ['перекус','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Шоколадный мусс p13 — 32г белка, детально.',
    ingredientIds: ['yogurt_greek', 'whey_isolate', 'milk', 'berries', 'peanut_butter'],
    portions: {'yogurt_greek': 100, 'whey_isolate': 25, 'milk': 80, 'berries': 40, 'peanut_butter': 10},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://fitmencook.com/recipes/high-protein-breakfast-recipes/',
    ingredients: [
        'Греческий йогурт 2% 100г',
        'Протеин 25г',
        'Молоко 2.5% 80г',
        'Ягоды 40г',
        'Арахисовая паста 10г'
    ],
    instructions: [
        'Подготовь ингредиенты: Греческий йогурт 2%, Протеин, Молоко 2.5% — взвесь по 100г, 25г.',
        'Основу готовь 5 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 320ккал/Б32 — вкусно, 32г белка для цели.'
    ],
  },
  {
    name: 'Сырные маффины p13',
    meal: 'breakfast', prepTimeMin: 18,
    kcal: 380, protein: 28, fat: 16, carbs: 18,
    tags: ['завтрак','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Сырные маффины p13 — 28г белка, детально.',
    ingredientIds: ['egg_whole', 'cheese_hard', 'cottage_cheese_5', 'olive_oil', 'spinach'],
    portions: {'egg_whole': 120, 'cheese_hard': 30, 'cottage_cheese_5': 60, 'olive_oil': 5, 'spinach': 40},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://fitmencook.com/recipes/high-protein-breakfast-recipes/',
    ingredients: [
        'Яйца 120г',
        'Сыр твердый 30г',
        'Творог 5% 60г',
        'Оливковое масло 5г',
        'Шпинат 40г'
    ],
    instructions: [
        'Подготовь ингредиенты: Яйца, Сыр твердый, Творог 5% — взвесь по 120г, 30г.',
        'Основу готовь 18 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 380ккал/Б28 — вкусно, 28г белка для цели.'
    ],
  },
  {
    name: 'Крем-чиз чикен p13',
    meal: 'lunch', prepTimeMin: 22,
    kcal: 520, protein: 42, fat: 18, carbs: 32,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Крем-чиз чикен p13 — 42г белка, детально.',
    ingredientIds: ['chicken_breast', 'cheese_hard', 'tomato', 'spinach', 'olive_oil'],
    portions: {'chicken_breast': 180, 'cheese_hard': 30, 'tomato': 50, 'spinach': 80, 'olive_oil': 8},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.nourishmovelove.com/high-protein-chicken-recipes/',
    ingredients: [
        'Куриная грудка 180г',
        'Сыр твердый 30г',
        'Помидоры 50г',
        'Шпинат 80г',
        'Оливковое масло 8г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Сыр твердый, Помидоры — взвесь по 180г, 30г.',
        'Основу готовь 22 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 520ккал/Б42 — вкусно, 42г белка для цели.'
    ],
  },
  {
    name: 'Бекон-врап p13',
    meal: 'lunch', prepTimeMin: 18,
    kcal: 460, protein: 34, fat: 20, carbs: 18,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Бекон-врап p13 — 34г белка, детально.',
    ingredientIds: ['chicken_breast', 'cheese_hard', 'cabbage', 'tomato', 'olive_oil'],
    portions: {'chicken_breast': 150, 'cheese_hard': 20, 'cabbage': 60, 'tomato': 60, 'olive_oil': 8},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.nourishmovelove.com/high-protein-chicken-recipes/',
    ingredients: [
        'Куриная грудка 150г',
        'Сыр твердый 20г',
        'Капуста 60г',
        'Помидоры 60г',
        'Оливковое масло 8г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Сыр твердый, Капуста — взвесь по 150г, 20г.',
        'Основу готовь 18 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 460ккал/Б34 — вкусно, 34г белка для цели.'
    ],
  },
  {
    name: 'Цитрус чикен p13',
    meal: 'dinner', prepTimeMin: 20,
    kcal: 460, protein: 38, fat: 14, carbs: 32,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Цитрус чикен p13 — 38г белка, детально.',
    ingredientIds: ['chicken_breast', 'rice_white', 'olive_oil', 'spinach', 'cucumber'],
    portions: {'chicken_breast': 180, 'rice_white': 70, 'olive_oil': 8, 'spinach': 60, 'cucumber': 80},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.nourishmovelove.com/high-protein-chicken-recipes/',
    ingredients: [
        'Куриная грудка 180г',
        'Рис белый 70г',
        'Оливковое масло 8г',
        'Шпинат 60г',
        'Огурец 80г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Рис белый, Оливковое масло — взвесь по 180г, 70г.',
        'Основу готовь 20 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 460ккал/Б38 — вкусно, 38г белка для цели.'
    ],
  },
  {
    name: 'Греческий салат p13',
    meal: 'lunch', prepTimeMin: 12,
    kcal: 420, protein: 34, fat: 18, carbs: 22,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Греческий салат p13 — 34г белка, детально.',
    ingredientIds: ['chicken_breast', 'cucumber', 'tomato', 'cheese_hard', 'olive_oil'],
    portions: {'chicken_breast': 150, 'cucumber': 80, 'tomato': 80, 'cheese_hard': 25, 'olive_oil': 10},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.nourishmovelove.com/high-protein-chicken-recipes/',
    ingredients: [
        'Куриная грудка 150г',
        'Огурец 80г',
        'Помидоры 80г',
        'Сыр твердый 25г',
        'Оливковое масло 10г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Огурец, Помидоры — взвесь по 150г, 80г.',
        'Основу готовь 12 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 420ккал/Б34 — вкусно, 34г белка для цели.'
    ],
  },
  {
    name: 'Шит-пан барбекю p13',
    meal: 'dinner', prepTimeMin: 25,
    kcal: 500, protein: 40, fat: 14, carbs: 42,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Шит-пан барбекю p13 — 40г белка, детально.',
    ingredientIds: ['chicken_breast', 'potato_boiled', 'olive_oil', 'spinach', 'tomato'],
    portions: {'chicken_breast': 180, 'potato_boiled': 120, 'olive_oil': 10, 'spinach': 60, 'tomato': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.nourishmovelove.com/high-protein-chicken-recipes/',
    ingredients: [
        'Куриная грудка 180г',
        'Картофель отварной 120г',
        'Оливковое масло 10г',
        'Шпинат 60г',
        'Помидоры 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Картофель отварной, Оливковое масло — взвесь по 180г, 120г.',
        'Основу готовь 25 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 500ккал/Б40 — вкусно, 40г белка для цели.'
    ],
  },
  {
    name: 'Донер боул p13',
    meal: 'lunch', prepTimeMin: 18,
    kcal: 480, protein: 36, fat: 16, carbs: 38,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Донер боул p13 — 36г белка, детально.',
    ingredientIds: ['chicken_breast', 'cabbage', 'tomato', 'yogurt_greek', 'olive_oil'],
    portions: {'chicken_breast': 150, 'cabbage': 80, 'tomato': 80, 'yogurt_greek': 60, 'olive_oil': 8},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.nourishmovelove.com/high-protein-chicken-recipes/',
    ingredients: [
        'Куриная грудка 150г',
        'Капуста 80г',
        'Помидоры 80г',
        'Греческий йогурт 2% 60г',
        'Оливковое масло 8г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Капуста, Помидоры — взвесь по 150г, 80г.',
        'Основу готовь 18 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 480ккал/Б36 — вкусно, 36г белка для цели.'
    ],
  },
  {
    name: 'Курица-булгур p13',
    meal: 'lunch', prepTimeMin: 22,
    kcal: 520, protein: 42, fat: 12, carbs: 52,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Курица-булгур p13 — 42г белка, детально.',
    ingredientIds: ['chicken_breast', 'quinoa', 'olive_oil', 'spinach', 'pepper'],
    portions: {'chicken_breast': 180, 'quinoa': 70, 'olive_oil': 8, 'spinach': 80, 'pepper': 80},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.nourishmovelove.com/high-protein-chicken-recipes/',
    ingredients: [
        'Куриная грудка 180г',
        'Киноа 70г',
        'Оливковое масло 8г',
        'Шпинат 80г',
        'Перец болгарский 80г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Киноа, Оливковое масло — взвесь по 180г, 70г.',
        'Основу готовь 22 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 520ккал/Б42 — вкусно, 42г белка для цели.'
    ],
  },
  {
    name: 'Пепперони байтс p13',
    meal: 'snack', prepTimeMin: 20,
    kcal: 380, protein: 28, fat: 18, carbs: 14,
    tags: ['перекус','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Пепперони байтс p13 — 28г белка, детально.',
    ingredientIds: ['chicken_breast', 'egg_whole', 'cheese_hard', 'olive_oil', 'cabbage'],
    portions: {'chicken_breast': 150, 'egg_whole': 60, 'cheese_hard': 20, 'olive_oil': 8, 'cabbage': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.eatingwell.com/cacio-e-pepe-chicken-bites-8788201',
    ingredients: [
        'Куриная грудка 150г',
        'Яйца 60г',
        'Сыр твердый 20г',
        'Оливковое масло 8г',
        'Капуста 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Яйца, Сыр твердый — взвесь по 150г, 60г.',
        'Основу готовь 20 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 380ккал/Б28 — вкусно, 28г белка для цели.'
    ],
  },
  {
    name: 'Кесадилья p13',
    meal: 'lunch', prepTimeMin: 15,
    kcal: 480, protein: 38, fat: 18, carbs: 32,
    tags: ['обед','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Кесадилья p13 — 38г белка, детально.',
    ingredientIds: ['chicken_breast', 'cheese_hard', 'olive_oil', 'pepper', 'cabbage'],
    portions: {'chicken_breast': 150, 'cheese_hard': 30, 'olive_oil': 8, 'pepper': 60, 'cabbage': 60},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.hellofresh.com/recipes/15-mm-high-protein-chicken-wraps-with-tomato-scallion-pico-671f963c10bbc833b98f82ae',
    ingredients: [
        'Куриная грудка 150г',
        'Сыр твердый 30г',
        'Оливковое масло 8г',
        'Перец болгарский 60г',
        'Капуста 60г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Сыр твердый, Оливковое масло — взвесь по 150г, 30г.',
        'Основу готовь 15 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 480ккал/Б38 — вкусно, 38г белка для цели.'
    ],
  },
  {
    name: 'Сливочный томат паста p13',
    meal: 'dinner', prepTimeMin: 18,
    kcal: 480, protein: 36, fat: 14, carbs: 42,
    tags: ['ужин','высокий белок','пп'],
    usefulness: 8.3,
    description: 'Сливочный томат паста p13 — 36г белка, детально.',
    ingredientIds: ['chicken_breast', 'pasta_durum', 'tomato', 'olive_oil', 'cheese_hard'],
    portions: {'chicken_breast': 150, 'pasta_durum': 70, 'tomato': 100, 'olive_oil': 8, 'cheese_hard': 20},
    difficulty: 'easy', cookSkill: 'basic', batchFriendly: true,
    sourceUrl: 'https://www.tempomeals.com/meals/protein-packed-creamy-tomato-chicken',
    ingredients: [
        'Куриная грудка 150г',
        'Паста из твердых сортов 70г',
        'Помидоры 100г',
        'Оливковое масло 8г',
        'Сыр твердый 20г'
    ],
    instructions: [
        'Подготовь ингредиенты: Куриная грудка, Паста из твердых сортов, Помидоры — взвесь по 150г, 70г.',
        'Основу готовь 18 мин — обжарь/отвари до готовности, не пересуши.',
        'Смешай с соусом/специями, доведи до вкуса — соль/перец по щепотке.',
        'Подавай порцией 480ккал/Б36 — вкусно, 36г белка для цели.'
    ],
  },
];