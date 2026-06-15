export interface FoodItem {
  id: string;
  name: string;
  category: 'protein' | 'carb' | 'fat' | 'dairy' | 'veg_fruit' | 'grain' | 'supplement' | 'fast_food' | 'other';
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  gi: number;
  servingSize: string;
  description?: string;
  bestFor?: string[];
  timing?: string;
  pharmaNote?: string;
  tier?: 'basic' | 'mid' | 'max';
  allergens?: string[];
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isDairyFree?: boolean;
  dietTags?: string[];
  micros?: {
    Ca?: number; Fe?: number; Mg?: number; P?: number; K?: number; Na?: number;
    Zn?: number; Se?: number; Cu?: number; Mn?: number;
    VitA?: number; VitB1?: number; VitB2?: number; VitB3?: number; VitB5?: number; VitB6?: number; VitB9?: number; VitB12?: number;
    VitC?: number; VitD?: number; VitE?: number; VitK?: number;
    Omega3?: number; Cholesterol?: number;
  };
}

export const FOOD_DB: FoodItem[] = [
  { id: 'chicken_breast', name: 'Куриная грудка (вареная)', category: 'protein', kcal: 165, protein: 31, fat: 3.6, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Классический базовый белок — минимум жира, максимум протеина. Идеальна для ежедневного рациона и сушки.',
    bestFor: ['maintenance', 'cut', 'recomp'], timing: 'any', pharmaNote: 'Нейтральный продукт, нет фармако-конфликтов', tier: 'basic',
    micros: { Ca: 11, Fe: 0.7, Mg: 29, P: 200, K: 256, Na: 68, Zn: 0.8, Se: 22, VitB3: 13.7, VitB6: 0.6, VitB12: 0.3 } },
  { id: 'turkey_breast', name: 'Индейка (грудка вареная)', category: 'protein', kcal: 135, protein: 29, fat: 1, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Средний уровень — больше триптофана, чем в курице, улучшает сон и восстановление. Меньше жира, богаче по аминокислотному профилю.',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'after_train', pharmaNote: 'Триптофан поддерживает серотонин — полезно при приёме ингибиторов ароматазы', tier: 'mid',
    micros: { Ca: 14, Fe: 0.5, Mg: 27, P: 220, K: 250, Na: 47, Zn: 1.1, Se: 25, VitB3: 11.8, VitB6: 0.5 } },
  { id: 'beef_lean', name: 'Говядина постная (тушеная)', category: 'protein', kcal: 200, protein: 26, fat: 10, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Максимальная категория — железо, цинк, B12, креатин. Ключевой продукт для набора массы и поддержки кроветворения.',
    bestFor: ['bulk', 'strength', 'recomp'], timing: 'lunch', pharmaNote: 'Высокое железо и B12 — компенсирует потерю от метформина', tier: 'max',
    micros: { Ca: 12, Fe: 2.6, Mg: 22, P: 210, K: 315, Na: 58, Zn: 5.5, Se: 16, VitB3: 5.4, VitB6: 0.4, VitB12: 2.5, Cholesterol: 70 } },
  { id: 'salmon', name: 'Лосось/Семга (запеченная)', category: 'protein', kcal: 208, protein: 20, fat: 13, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Максимум — Омега-3 EPA/DHA 2.5 г, витамин D 500 IU, высококачественный белок. Анти-воспаление, суставы, сердце.',
    bestFor: ['bulk', 'recomp', 'rehab'], timing: 'lunch', pharmaNote: 'Омега-3 компенсирует потерю CoQ10 от статинов и боли в суставах от анастрозола', tier: 'max',
    micros: { Ca: 12, Fe: 0.3, Mg: 30, P: 240, K: 350, Na: 56, Zn: 0.6, Se: 31, VitB3: 8.5, VitB12: 3.2, Omega3: 2.5 } },
  { id: 'tuna_canned', name: 'Тунец консервированный', category: 'protein', kcal: 116, protein: 25, fat: 1, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Средний — высокое содержание белка при минимуме жира. Удобный и доступный источник протеина.',
    bestFor: ['cut', 'maintenance'], timing: 'any', pharmaNote: 'Осторожно при повышенном уровне ртути — не более 3 раз/неделю', tier: 'mid',
    micros: { Ca: 11, Fe: 1.0, Mg: 30, P: 220, K: 220, Na: 338, Zn: 0.6, Se: 58, VitB3: 18.7, VitB6: 0.3, VitB12: 2.8 } },
  { id: 'egg_whole', name: 'Яйцо куриное целое', category: 'protein', kcal: 155, protein: 13, fat: 11, carbs: 1.1, fiber: 0, gi: 0, servingSize: '1 шт (60 г)',
    description: 'Базовый — эталонный белок (PDCAAS 1.0), лецитин, холин, витамины A/D/E. Желток содержит холестерин — сырьё для синтеза тестостерона.',
    bestFor: ['bulk', 'maintenance', 'strength'], timing: 'morning', pharmaNote: 'Холин поддерживает печень — синергия с TUDCA/NAC', tier: 'basic',
    micros: { Ca: 56, Fe: 1.8, Mg: 12, P: 198, K: 138, Na: 142, Zn: 1.1, Se: 31, VitA: 149, VitB2: 0.5, VitB12: 0.9, VitD: 2, Cholesterol: 373 } },
  { id: 'egg_white', name: 'Белок яичный', category: 'protein', kcal: 52, protein: 11, fat: 0, carbs: 0.7, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Базовый для сушки — чистый белок без жира. Идеален для увеличения протеина без калорий.',
    bestFor: ['cut', 'recomp'], timing: 'morning', pharmaNote: 'Нет фармако-конфликтов', tier: 'basic',
    micros: { Ca: 7, Fe: 0.1, Mg: 11, P: 15, K: 163, Na: 166, Zn: 0.03, Se: 13, VitB2: 0.4 } },
  { id: 'pork_tenderloin', name: 'Свиная вырезка', category: 'protein', kcal: 150, protein: 22, fat: 6, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Средний — нежирная свинина, богата тиамином (B1), цинком. Хорошая альтернатива курице.',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'B1 поддерживает нервную систему при курсе ААС', tier: 'mid',
    micros: { Ca: 6, Fe: 0.9, Mg: 28, P: 230, K: 370, Na: 52, Zn: 2.4, Se: 33, VitB1: 0.9, VitB6: 0.5, VitB12: 0.6 } },
  { id: 'whey_protein', name: 'Протеин сывороточный (1 скуп)', category: 'protein', kcal: 120, protein: 24, fat: 1.5, carbs: 2, fiber: 0, gi: 15, servingSize: '30 г',
    description: 'Базовая добавка — быстрый аминокислотный пик через 30 мин. Leucine 2.5 г — триггер mTOR для синтеза мышц.',
    bestFor: ['bulk', 'cut', 'recomp', 'strength'], timing: 'after_train', pharmaNote: 'Усвоение ускоряется при приёме с углеводами', tier: 'basic',
    micros: { Ca: 267, Fe: 1.0, Mg: 133, P: 533, K: 500, Na: 667, Zn: 5.0, VitB2: 0.67 } },
  { id: 'casein', name: 'Казеин', category: 'protein', kcal: 110, protein: 22, fat: 1, carbs: 3, fiber: 0, gi: 10, servingSize: '30 г',
    description: 'Медленный белок — аминокислотный поток 6-8 часов. Защита мышц ночью, анти-катаболизм.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'before_sleep', pharmaNote: 'Замедляет всасывание — избегать одновременно с препаратами, требующими быстрого действия', tier: 'mid',
    micros: { Ca: 267, Fe: 0.33, Mg: 53, P: 567, K: 333, Na: 500, Zn: 1.33 } },

  { id: 'rice_white', name: 'Рис белый (вареный)', category: 'grain', kcal: 130, protein: 2.7, fat: 0.3, carbs: 28, fiber: 0.4, gi: 73, servingSize: '100 г',
    description: 'Базовый углевод — быстро усваивается, высокий GI. Идеален после тренировки для восстановления гликогена.',
    bestFor: ['bulk', 'strength'], timing: 'after_train', pharmaNote: 'Высокий GI — не рекомендуется при инсулинорезистентности и метформине', tier: 'basic',
    micros: { Ca: 10, Fe: 0.2, Mg: 12, P: 43, K: 35, Na: 1, Zn: 0.5, VitB1: 0.02, VitB3: 0.4 } },
  { id: 'rice_brown', name: 'Рис бурый/дикий', category: 'grain', kcal: 112, protein: 2.6, fat: 0.9, carbs: 23, fiber: 1.8, gi: 50, servingSize: '100 г',
    description: 'Средний — ниже GI, больше клетчатки и микроэлементов (Mg, Zn, Se). Стабильная энергия.',
    bestFor: ['maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Mg в буром рисе — дополнительный источник при дефиците от кленбутерола', tier: 'mid',
    micros: { Ca: 10, Fe: 0.4, Mg: 44, P: 150, K: 79, Na: 5, Zn: 0.6, Se: 12, VitB1: 0.19, VitB3: 2.6, VitB6: 0.15 } },
  { id: 'oats', name: 'Овсянка (на воде)', category: 'grain', kcal: 71, protein: 2.5, fat: 1.4, carbs: 12, fiber: 1.7, gi: 55, servingSize: '100 г',
    description: 'Базовый утренний углевод — β-глюкан снижает холестерин, стабилизирует сахар. Долгое насыщение.',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'morning', pharmaNote: 'β-глюкан синергичен с телмисартаном — снижение холестерина', tier: 'basic',
    micros: { Ca: 54, Fe: 4.7, Mg: 177, P: 410, K: 400, Na: 2, Zn: 3.9, Se: 34, VitB1: 0.76, VitB3: 0.9, VitB6: 0.12 } },
  { id: 'buckwheat', name: 'Гречка (вареная)', category: 'grain', kcal: 110, protein: 4.2, fat: 1.1, carbs: 20, fiber: 2.7, gi: 45, servingSize: '100 г',
    description: 'Средний — супер-крупа. Рутин укрепляет сосуды, Mg 85 мг/100 г, железо, клетчатка. Низкий GI.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Mg + рутин компенсируют потери калия и магния от кленбутерола', tier: 'mid',
    micros: { Ca: 18, Fe: 2.2, Mg: 85, P: 200, K: 340, Na: 1, Zn: 1.5, Se: 3, VitB1: 0.1, VitB3: 1.8, VitB6: 0.2 } },
  { id: 'quinoa', name: 'Киноа', category: 'grain', kcal: 120, protein: 4.4, fat: 1.9, carbs: 21, fiber: 2.8, gi: 53, servingSize: '100 г',
    description: 'Максимум — полный аминокислотный профиль (редкость для злаков), Fe, Mg, Mn. Суперфуд для набора.',
    bestFor: ['bulk', 'recomp'], timing: 'lunch', pharmaNote: 'Без глютена — подходит при гастрите от НПВС и пептидов BPC-157', tier: 'max',
    micros: { Ca: 17, Fe: 1.5, Mg: 64, P: 150, K: 170, Na: 1, Zn: 1.1, Se: 2, VitB1: 0.11, VitB3: 1.5, VitB6: 0.12, VitB9: 42 } },
  { id: 'bread_rye', name: 'Хлеб ржаной', category: 'grain', kcal: 214, protein: 6.5, fat: 1.2, carbs: 43, fiber: 5.5, gi: 60, servingSize: '1 ломтик (35 г)',
    description: 'Базовый — клетчатка 5.5 г/100 г, ниже GI чем пшеничный. Поддержка кишечника.',
    bestFor: ['maintenance', 'bulk'], timing: 'any', pharmaNote: 'Клетчатка замедляет всасывание — разводить по времени с препаратами', tier: 'basic',
    micros: { Ca: 22, Fe: 1.6, Mg: 44, P: 140, K: 180, Na: 430, Zn: 1.2, VitB1: 0.18 } },
  { id: 'pasta_durum', name: 'Макароны из твердых сортов', category: 'grain', kcal: 135, protein: 5, fat: 0.6, carbs: 27, fiber: 2.1, gi: 45, servingSize: '100 г',
    description: 'Средний — твердые сорта (durum) дают стабильный GI, медленную энергию. Добавка к основному рациону.',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Умеренный GI — подходит при приёме метформина', tier: 'mid',
    micros: { Ca: 18, Fe: 1.3, Mg: 35, P: 140, K: 160, Na: 5, Zn: 0.9, VitB1: 0.09, VitB3: 1.5 } },
  { id: 'potato_boiled', name: 'Картофель отварной', category: 'carb', kcal: 82, protein: 2, fat: 0.1, carbs: 17, fiber: 1.5, gi: 65, servingSize: '1 шт (150 г)',
    description: 'Базовый — калий 420 мг/100 г (больше чем в банане!). Восстановление электролитов после тренировки.',
    bestFor: ['bulk', 'strength', 'maintenance'], timing: 'after_train', pharmaNote: 'Высокий калий — ОСТОРОЖНО при телмисартане (повышает K)', tier: 'basic',
    micros: { Ca: 12, Fe: 0.6, Mg: 22, P: 54, K: 420, Na: 5, Zn: 0.3, VitC: 20, VitB6: 0.3 } },
  { id: 'sweet_potato', name: 'Батат', category: 'carb', kcal: 86, protein: 1.6, fat: 0.1, carbs: 20, fiber: 3, gi: 44, servingSize: '100 г',
    description: 'Средний — низкий GI, β-каротин, витамин A. Лучше картофеля для сушки и стабильной энергии.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Низкий K в отличие от картофеля — безопасно с телмисартаном', tier: 'mid',
    micros: { Ca: 30, Fe: 0.6, Mg: 25, P: 47, K: 340, Na: 55, Zn: 0.3, VitA: 709, VitC: 2.4, VitB6: 0.2 } },
  { id: 'banana', name: 'Банан', category: 'veg_fruit', kcal: 89, protein: 1.1, fat: 0.3, carbs: 23, fiber: 2.6, gi: 51, servingSize: '1 шт (118 г)',
    description: 'Базовый — быстрый углевод + калий 358 мг. Удобный перекус до/после тренировки.',
    bestFor: ['bulk', 'strength'], timing: 'after_train', pharmaNote: 'Калий — ОСТОРОЖНО при телмисартане', tier: 'basic',
    micros: { Ca: 5, Fe: 0.3, Mg: 27, P: 22, K: 358, Na: 1, Zn: 0.2, VitB6: 0.4, VitC: 8.7 } },
  { id: 'apple', name: 'Яблоко', category: 'veg_fruit', kcal: 52, protein: 0.3, fat: 0.2, carbs: 14, fiber: 2.4, gi: 36, servingSize: '1 шт (180 г)',
    description: 'Базовый — пектин (клетчатка), низкий GI, антиоксиданты. Поддержка ЖКТ и кишечника.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'any', pharmaNote: 'Пектин помогает при гастрите от НПВС (диклофенак, мелоксикам)', tier: 'basic',
    micros: { Ca: 6, Fe: 0.1, Mg: 5, P: 11, K: 107, Na: 1, Zn: 0.04, VitC: 4.6 } },
  { id: 'berries', name: 'Ягоды (микс)', category: 'veg_fruit', kcal: 40, protein: 0.6, fat: 0.2, carbs: 9, fiber: 2.4, gi: 25, servingSize: '100 г',
    description: 'Средний — антоцианы, витамин C, антиоксиданты. Анти-воспалительный продукт номер 1.',
    bestFor: ['cut', 'maintenance', 'rehab'], timing: 'morning', pharmaNote: 'Витамин C + антиоксиданты — синергия с NAC и BPC-157 для восстановления', tier: 'mid',
    micros: { Ca: 15, Fe: 0.3, Mg: 7, P: 12, K: 80, Na: 1, Zn: 0.1, VitC: 14, VitK: 7 } },

  { id: 'olive_oil', name: 'Оливковое масло', category: 'fat', kcal: 884, protein: 0, fat: 100, carbs: 0, fiber: 0, gi: 0, servingSize: '1 ст.л. (14 г)',
    description: 'Базовый — олеиновая кислота (Омега-9), снижает LDL-холестерин и воспаление. Основа средиземноморской диеты.',
    bestFor: ['maintenance', 'cut', 'recomp', 'bulk'], timing: 'any', pharmaNote: 'Снижает ALT — защитный эффект для печени при ААС', tier: 'basic',
    micros: { Ca: 1, Fe: 0.6, Mg: 0, P: 0, K: 1, Na: 2, Zn: 0, VitE: 14.4, VitK: 60 } },
  { id: 'avocado', name: 'Авокадо', category: 'fat', kcal: 160, protein: 2, fat: 15, carbs: 9, fiber: 7, gi: 10, servingSize: '1/2 шт (70 г)',
    description: 'Средний — мононенасыщенные жиры, клетчатка 7 г/100 г, калий 485 мг, витамин E. Суперфуд для суставов и сердца.',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Калий 485 мг — ОСТОРОЖНО при телмисартане', tier: 'mid',
    micros: { Ca: 12, Fe: 0.5, Mg: 29, P: 52, K: 485, Na: 7, Zn: 0.6, VitB6: 0.3, VitC: 10, VitE: 2.1, VitK: 21 } },
  { id: 'nuts_mix', name: 'Орехи (грецкие/миндаль)', category: 'fat', kcal: 654, protein: 20, fat: 60, carbs: 14, fiber: 7, gi: 15, servingSize: '30 г',
    description: 'Средний — Омега-3 ALA (грецкие), витамин E (миндаль), Mg 130 мг/30 г. Перекус с пользой.',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'any', pharmaNote: 'Mg в орехах компенсирует дефицит от кленбутерола', tier: 'mid',
    micros: { Ca: 70, Fe: 2.8, Mg: 130, P: 340, K: 440, Na: 3, Zn: 2.8, Se: 3, VitB1: 0.2, VitB3: 1.6, VitE: 5, Omega3: 3 } },
  { id: 'seeds', name: 'Семена льна/чиа', category: 'fat', kcal: 534, protein: 18, fat: 31, carbs: 29, fiber: 27, gi: 1, servingSize: '1 ст.л. (10 г)',
    description: 'Максимум — Омега-3 ALA, лигнаны (фитоэстрогены), клетчатка 27 г/100 г. Супер-добавка для ЖКТ и гормонов.',
    bestFor: ['cut', 'recomp', 'rehab'], timing: 'morning', pharmaNote: 'Лигнаны мягко модулируют эстроген — полезно при анастрозоле (не конкурирует)', tier: 'max',
    micros: { Ca: 255, Fe: 5.7, Mg: 350, P: 560, K: 500, Na: 25, Zn: 5.2, Se: 25, VitB1: 1.6, VitB3: 4.5, Omega3: 18 } },
  { id: 'butter', name: 'Сливочное масло', category: 'fat', kcal: 717, protein: 0.9, fat: 81, carbs: 0.1, fiber: 0, gi: 0, servingSize: '10 г',
    description: 'Базовый — бутират (короткоцепочечные жиры), витамины A/D/E/K2. В умеренных количествах — польза для кишечника и гормонов.',
    bestFor: ['bulk', 'strength'], timing: 'morning', pharmaNote: 'Насыщенные жиры — холестерин → сырье для тестостерона (умеренно!)', tier: 'basic',
    micros: { Ca: 24, Fe: 0.02, Mg: 2, P: 24, K: 24, Na: 550, Zn: 0.05, VitA: 684, VitE: 2.3, Cholesterol: 215 } },
  { id: 'fish_oil_food', name: 'Скумбрия/Сельдь (запеченная)', category: 'fat', kcal: 262, protein: 17, fat: 20, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Максимум — Омега-3 EPA/DHA 2.5-3 г, витамин D 1000 IU, CoQ10. Главный пищевой источник Омега-3.',
    bestFor: ['bulk', 'recomp', 'rehab'], timing: 'lunch', pharmaNote: 'Омега-3 + CoQ10 = синергия при статинах и анастрозоле', tier: 'max',
    micros: { Ca: 12, Fe: 0.5, Mg: 30, P: 240, K: 350, Na: 80, Zn: 0.6, Se: 40, VitD: 25, VitB12: 8, Omega3: 2500 } },

  { id: 'cottage_cheese_5', name: 'Творог 5%', category: 'dairy', kcal: 121, protein: 18, fat: 5, carbs: 2, fiber: 0, gi: 30, servingSize: '100 г',
    description: 'Базовый — казеин 80%, медленный белок. Идеален на ночь для антикатаболизма. Кальций 120 мг.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'before_sleep', pharmaNote: 'Казеин на ночь — синергия с казеиновым протеином для защиты мышц', tier: 'basic',
    micros: { Ca: 120, Fe: 0.1, Mg: 8, P: 150, K: 80, Na: 330, Zn: 0.4, VitB2: 0.2, VitB12: 0.5 } },
  { id: 'kefir', name: 'Кефир 1%', category: 'dairy', kcal: 40, protein: 3, fat: 1, carbs: 4, fiber: 0, gi: 15, servingSize: '200 мл',
    description: 'Базовый — пробиотики, Ca, белок. Поддержка микрофлоры кишечника, улучшение пищеварения.',
    bestFor: ['cut', 'maintenance'], timing: 'morning', pharmaNote: 'Пробиотики синергичны с пребиотиками (клетчатка) — улучшают усвоение добавок', tier: 'basic',
    micros: { Ca: 130, Fe: 0.1, Mg: 12, P: 100, K: 150, Na: 50, Zn: 0.3, VitB2: 0.1, VitB12: 0.3 } },
  { id: 'yogurt_greek', name: 'Греческий йогурт 2%', category: 'dairy', kcal: 60, protein: 10, fat: 2, carbs: 3.6, fiber: 0, gi: 25, servingSize: '150 г',
    description: 'Средний — концентрированный белок, пробиотики. Лучше обычного йогурта по белку в 2-3 раза.',
    bestFor: ['cut', 'recomp', 'maintenance'], timing: 'any', pharmaNote: 'Ca + пробиотики — поддержка при длительном курсе ААС', tier: 'mid',
    micros: { Ca: 110, Fe: 0.1, Mg: 11, P: 135, K: 140, Na: 50, Zn: 0.4, VitB2: 0.3, VitB12: 0.7 } },
  { id: 'milk', name: 'Молоко 2.5%', category: 'dairy', kcal: 52, protein: 2.8, fat: 2.5, carbs: 4.7, fiber: 0, gi: 30, servingSize: '200 мл',
    description: 'Базовый — Ca 240 мг/стакан, витамин D (если обогащён), белок. Классический масс-гейнер.',
    bestFor: ['bulk', 'strength'], timing: 'morning', pharmaNote: 'Высокий инсулиновый отклик — не подходит при метформине/инсулинорезистентности', tier: 'basic',
    micros: { Ca: 120, Fe: 0.03, Mg: 11, P: 90, K: 150, Na: 50, Zn: 0.4, VitB2: 0.2, VitB12: 0.4, VitD: 1, Cholesterol: 10 } },
  { id: 'cheese_hard', name: 'Сыр твердый (Российский)', category: 'dairy', kcal: 350, protein: 24, fat: 27, carbs: 0.3, fiber: 0, gi: 0, servingSize: '30 г',
    description: 'Средний — концентрированный Ca 720 мг/100 г, белок, витамин K2 (если из травяного молока).',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Высокий Na и насыщ. жиры — ограничить при гипертонии (телмисартан)', tier: 'mid',
    micros: { Ca: 720, Fe: 0.2, Mg: 25, P: 510, K: 80, Na: 620, Zn: 3, VitA: 200, VitB2: 0.3, Cholesterol: 90 } },

  { id: 'broccoli', name: 'Брокколи (отварная)', category: 'veg_fruit', kcal: 35, protein: 2.4, fat: 0.4, carbs: 7, fiber: 3.3, gi: 15, servingSize: '100 г',
    description: 'Базовый — сульфорафан (анти-рак), индол-3-карбинол (эстроген-метаболизм), витамин C 90 мг, Ca 47 мг.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'any', pharmaNote: 'Индол-3-карбинол поддерживает метаболизм эстрогена — синергия с анастрозолом', tier: 'basic',
    micros: { Ca: 47, Fe: 0.7, Mg: 21, P: 66, K: 316, Na: 33, Zn: 0.4, Se: 2.5, VitC: 89, VitK: 101, VitB9: 63 } },
  { id: 'spinach', name: 'Шпинат', category: 'veg_fruit', kcal: 23, protein: 2.9, fat: 0.4, carbs: 3.6, fiber: 2.2, gi: 15, servingSize: '100 г',
    description: 'Средний — Fe 2.7 мг, Mg 79 мг, K 558 мг, фолат 194 мкг. Супер-зелень для кроветворения.',
    bestFor: ['cut', 'recomp'], timing: 'lunch', pharmaNote: 'Fe + фолат — компенсация B12/фолатного дефицита от метформина', tier: 'mid',
    micros: { Ca: 99, Fe: 2.7, Mg: 79, P: 49, K: 558, Na: 79, Zn: 0.5, Se: 1, VitA: 469, VitC: 28, VitB9: 194, VitK: 483 } },
  { id: 'cucumber', name: 'Огурец', category: 'veg_fruit', kcal: 15, protein: 0.7, fat: 0.1, carbs: 2.9, fiber: 0.5, gi: 10, servingSize: '1 шт (150 г)',
    description: 'Базовый — вода 95%, минимум калорий. Наполнение желудка, гидратация. Для сушки идеален.',
    bestFor: ['cut'], timing: 'any', pharmaNote: 'Нет фармако-конфликтов', tier: 'basic',
    micros: { Ca: 16, Fe: 0.3, Mg: 13, P: 24, K: 147, Na: 2, Zn: 0.2, VitC: 2.8, VitK: 16 } },
  { id: 'tomato', name: 'Помидор', category: 'veg_fruit', kcal: 18, protein: 0.9, fat: 0.2, carbs: 3.9, fiber: 1.2, gi: 10, servingSize: '1 шт (120 г)',
    description: 'Базовый — ликопин (антиоксидант), витамин C 14 мг, K 237 мг. Поддержка простаты.',
    bestFor: ['maintenance', 'cut'], timing: 'any', pharmaNote: 'Ликопин — синергия с пальметто для защиты простаты', tier: 'basic',
    micros: { Ca: 10, Fe: 0.3, Mg: 11, P: 24, K: 237, Na: 5, Zn: 0.2, VitC: 14, VitA: 42, VitK: 7.9 } },
  { id: 'pepper', name: 'Болгарский перец', category: 'veg_fruit', kcal: 27, protein: 1.3, fat: 0, carbs: 5.3, fiber: 2.1, gi: 15, servingSize: '1 шт (150 г)',
    description: 'Средний — витамин C 128 мг (больше цитрусовых!), β-каротин. Антиоксидантная защита.',
    bestFor: ['cut', 'maintenance'], timing: 'any', pharmaNote: 'Витамин C — синергия с NAC для антиоксидантной защиты печени', tier: 'mid',
    micros: { Ca: 7, Fe: 0.4, Mg: 12, P: 20, K: 175, Na: 4, Zn: 0.2, VitC: 128, VitA: 157, VitB6: 0.3 } },

  { id: 'shawarma', name: 'Шаурма средняя', category: 'fast_food', kcal: 550, protein: 25, fat: 22, carbs: 58, fiber: 2, gi: 65, servingSize: '1 шт (350 г)',
    description: 'Фастфуд — если нет выбора, выбирайте без соуса. Белок есть, но Na и трансжиры высокие.',
    bestFor: [], timing: 'lunch', pharmaNote: 'Трансжиры усиливают воспаление — избегать при курсе ААС', tier: 'basic',
    micros: { Na: 800, Cholesterol: 50 } },
  { id: 'pizza_margherita', name: 'Пицца Маргарита', category: 'fast_food', kcal: 240, protein: 9, fat: 8, carbs: 32, fiber: 2, gi: 70, servingSize: '1 кусок (120 г)',
    description: 'Фастфуд — рафинированная мука, высокий GI. Лишний раз — не стоит.',
    bestFor: [], timing: 'lunch', pharmaNote: 'Высокий GI + Na — усугубляет задержку воды на курсе', tier: 'basic',
    micros: { Na: 600, Cholesterol: 30 } },
  { id: 'burger', name: 'Бургер классический', category: 'fast_food', kcal: 480, protein: 22, fat: 24, carbs: 42, fiber: 1.5, gi: 68, servingSize: '1 шт (250 г)',
    description: 'Фастфуд — белок есть, но трансжиры, Na, высокий GI. Резервный вариант.',
    bestFor: [], timing: 'lunch', pharmaNote: 'Na + трансжиры — усугубляют гипертонию и дислипидемию', tier: 'basic',
    micros: { Na: 700, Cholesterol: 60 } },

  { id: 'creatine', name: 'Креатин моногидрат', category: 'supplement', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '5 г',
    description: 'Базовая добавка — +10-15% сила, +1-2 кг масса. Насыщает фосфокреатин, ускоряет АТФ-ресинтез.',
    bestFor: ['bulk', 'strength', 'maintenance'], timing: 'after_train', pharmaNote: 'Удерживает воду в мышцах — не влияет на почки при нормальной дозе 5 г', tier: 'basic',
    micros: {} },
  { id: 'bcaa', name: 'BCAA 2:1:1', category: 'supplement', kcal: 20, protein: 5, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '10 г',
    description: 'Средний — лейцин (mTOR), изолейцин, валин. При достаточном белке из еды — опционально.',
    bestFor: ['cut', 'recomp'], timing: 'after_train', pharmaNote: 'При достаточном белке рационе — дублирование', tier: 'mid',
    micros: {} },
  { id: 'glutamine', name: 'Глютамин', category: 'supplement', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '5 г',
    description: 'Средний — поддержка кишечника (энтероциты), иммунитет. При стрессе/курсе — полезен.',
    bestFor: ['rehab', 'maintenance'], timing: 'any', pharmaNote: 'Поддержка ЖКТ — синергия с BPC-157 и пробиотиками', tier: 'mid',
    micros: {} },
  { id: 'vitamin_complex', name: 'Мультивитамин', category: 'supplement', kcal: 5, protein: 0, fat: 0, carbs: 1, fiber: 0, gi: 0, servingSize: '1 табл',
    description: 'Базовый — страховка от дефицитов. Не заменяет разнообразное питание.',
    bestFor: ['maintenance', 'bulk', 'cut', 'recomp'], timing: 'morning', pharmaNote: 'Принимать с едой — усвоение жироворастворимых (A/D/E/K)', tier: 'basic',
    micros: { Ca: 100, Fe: 10, Mg: 50, Zn: 15, Se: 55, VitA: 900, VitB1: 1.5, VitB2: 1.7, VitB3: 20, VitB5: 10, VitB6: 2, VitB9: 400, VitB12: 6, VitC: 90, VitD: 15, VitE: 15 } },
  { id: 'fish_oil', name: 'Рыбий жир (Омега-3)', category: 'supplement', kcal: 90, protein: 0, fat: 10, carbs: 0, fiber: 0, gi: 0, servingSize: '1 капсула (1 г)',
    description: 'Базовая добавка — EPA/DHA 300 мг/капс. Сердце, суставы, мозг, анти-воспаление. 2-4 капс/день.',
    bestFor: ['maintenance', 'bulk', 'cut', 'recomp', 'rehab'], timing: 'any', pharmaNote: 'Синергия с анастрозолом (суставы) и статинами (CoQ10-дефицит)', tier: 'basic',
    micros: { Omega3: 1000 } },

  { id: 'chicken_thigh', name: 'Куриное бедро', category: 'protein', kcal: 209, protein: 26, fat: 15, carbs: 0, fiber: 0, gi: 0, servingSize: "150 г",
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Выше цинк и железо чем в грудке', tier: 'basic',
    micros: { Fe: 1.3, Zn: 2.6, Se: 18, VitB6: 0.4, VitB12: 0.3, VitA: 12, P: 175 } },
  { id: 'shrimp', name: 'Креветки', category: 'protein', kcal: 99, protein: 24, fat: 0.3, carbs: 0.2, fiber: 0, gi: 0, servingSize: "120 г",
    bestFor: ['cut', 'recomp', 'maintenance'], timing: 'dinner', pharmaNote: 'Высокий селен, йод, низкокалорийны', tier: 'mid',
    micros: { Se: 38, Zn: 1.1, Cu: 0.3, P: 200, VitB12: 1.1, Omega3: 300 } },
  { id: 'tuna_steak', name: 'Тунец стейк', category: 'protein', kcal: 144, protein: 23, fat: 5, carbs: 0, fiber: 0, gi: 0, servingSize: "150 г",
    bestFor: ['cut', 'recomp', 'maintenance'], timing: 'dinner', pharmaNote: 'Высокое содержание B12 и селена', tier: 'max',
    micros: { Se: 46, VitB6: 0.8, VitB12: 9.0, VitD: 5, Omega3: 1500, P: 250, Mg: 30 } },
  { id: 'sardines', name: 'Сардины', category: 'protein', kcal: 208, protein: 25, fat: 11, carbs: 0, fiber: 0, gi: 0, servingSize: "100 г",
    bestFor: ['maintenance', 'bulk'], timing: 'lunch', pharmaNote: 'Омега-3, кальций, витамин D, B12', tier: 'mid',
    micros: { Omega3: 2200, Ca: 382, Se: 37, VitB12: 8.9, VitD: 5, P: 350, Na: 350 } },
  { id: 'mackerel', name: 'Скумбрия', category: 'protein', kcal: 262, protein: 24, fat: 18, carbs: 0, fiber: 0, gi: 0, servingSize: "150 г",
    bestFor: ['bulk', 'maintenance'], timing: 'dinner', pharmaNote: 'Очень высокое содержание омега-3 и B12', tier: 'mid',
    micros: { Omega3: 2600, Se: 44, VitB12: 13, VitD: 4, P: 280 } },

  { id: 'lentils', name: 'Чечевица', category: 'carb', kcal: 116, protein: 9, fat: 0.4, carbs: 20, fiber: 8, gi: 30, servingSize: "150 г",
    bestFor: ['maintenance', 'recomp', 'bulk'], timing: 'lunch', pharmaNote: 'Растительный белок, железо, фолат', tier: 'basic',
    micros: { Fe: 3.3, Mg: 47, P: 180, K: 370, Zn: 1.3, VitB6: 0.2, VitB9: 180 } },
  { id: 'chickpeas', name: 'Нут', category: 'carb', kcal: 164, protein: 8.9, fat: 2.6, carbs: 27, fiber: 8, gi: 28, servingSize: "150 г",
    bestFor: ['maintenance', 'bulk'], timing: 'lunch', pharmaNote: 'Хороший источник растительного белка', tier: 'basic',
    micros: { Fe: 2.9, Mg: 48, P: 168, K: 290, Zn: 1.5, VitB6: 0.2, VitB9: 172 } },
  { id: 'peas_green', name: 'Зелёный горошек', category: 'veg_fruit', kcal: 81, protein: 5.4, fat: 0.2, carbs: 14, fiber: 5, gi: 39, servingSize: "100 г",
    bestFor: ['maintenance', 'bulk', 'recomp'], timing: 'lunch', pharmaNote: 'Витамины K, C, B1, фолат', tier: 'basic',
    micros: { VitK: 24.8, VitC: 40, VitB1: 0.27, VitB9: 65, Fe: 1.5, Mg: 33, P: 108, Zn: 1.2 } },
  { id: 'corn', name: 'Кукуруза', category: 'carb', kcal: 86, protein: 3.3, fat: 1.4, carbs: 19, fiber: 2.7, gi: 52, servingSize: "150 г",
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Богата клетчаткой, тиамином', tier: 'basic',
    micros: { VitB1: 0.2, Mg: 37, P: 89, K: 270, VitC: 7, Fe: 0.5 } },
  { id: 'grapefruit', name: 'Грейпфрут', category: 'veg_fruit', kcal: 42, protein: 0.8, fat: 0.1, carbs: 11, fiber: 1.6, gi: 25, servingSize: "200 г",
    bestFor: ['cut', 'recomp'], timing: 'snack', pharmaNote: 'Низкий ГИ, витамин C, нарингин', tier: 'basic',
    micros: { VitC: 31, VitA: 3, K: 135, VitB1: 0.04 } },
  { id: 'pear', name: 'Груша', category: 'veg_fruit', kcal: 57, protein: 0.4, fat: 0.1, carbs: 15, fiber: 3.1, gi: 38, servingSize: "180 г",
    bestFor: ['maintenance', 'cut'], timing: 'snack', pharmaNote: 'Пектин, антиоксиданты', tier: 'basic',
    micros: { VitC: 4, K: 116, Cu: 0.1, VitK: 4.4 } },

  { id: 'cabbage', name: 'Капуста белокочанная', category: 'veg_fruit', kcal: 25, protein: 1.3, fat: 0.1, carbs: 6, fiber: 2.5, gi: 10, servingSize: "200 г",
    bestFor: ['cut', 'recomp', 'maintenance'], timing: 'lunch', pharmaNote: 'Витамин C, K, сульфорафан', tier: 'basic',
    micros: { VitC: 37, VitK: 76, VitB6: 0.1, Mn: 0.16, Fe: 0.5 } },
  { id: 'carrot', name: 'Морковь', category: 'veg_fruit', kcal: 41, protein: 0.9, fat: 0.2, carbs: 10, fiber: 2.8, gi: 39, servingSize: "150 г",
    bestFor: ['maintenance', 'cut'], timing: 'any', pharmaNote: 'Бета-каротин, витамин A', tier: 'basic',
    micros: { VitA: 835, VitC: 6, VitK: 13.2, K: 320 } },
  { id: 'zucchini', name: 'Кабачок', category: 'veg_fruit', kcal: 17, protein: 1.2, fat: 0.3, carbs: 3.1, fiber: 1, gi: 15, servingSize: "200 г",
    bestFor: ['cut', 'recomp'], timing: 'lunch', pharmaNote: 'Очень низкокалорийный, калий', tier: 'basic',
    micros: { VitC: 18, K: 260, VitA: 10, Mg: 18 } },
  { id: 'eggplant', name: 'Баклажан', category: 'veg_fruit', kcal: 25, protein: 1, fat: 0.2, carbs: 6, fiber: 3, gi: 20, servingSize: "200 г",
    bestFor: ['cut', 'maintenance'], timing: 'lunch', pharmaNote: 'Антоцианы, назунин', tier: 'basic',
    micros: { VitC: 2, K: 230, Mg: 14, Mn: 0.23 } },

  { id: 'kefir_2', name: 'Кефир 2%', category: 'dairy', kcal: 51, protein: 3.4, fat: 2, carbs: 4, fiber: 0, gi: 15, servingSize: "250 г",
    bestFor: ['maintenance', 'recomp', 'cut'], timing: 'any', pharmaNote: 'Пробиотики, кальций, белок', tier: 'basic',
    micros: { Ca: 120, P: 95, VitB2: 0.13, VitB12: 0.4, K: 135 } },
  { id: 'yogurt_natural', name: 'Йогурт натуральный', category: 'dairy', kcal: 60, protein: 4, fat: 1.5, carbs: 7, fiber: 0, gi: 15, servingSize: "200 г",
    bestFor: ['maintenance', 'cut', 'recomp'], timing: 'snack', pharmaNote: 'Пробиотики', tier: 'basic',
    micros: { Ca: 140, P: 100, VitB2: 0.17, VitB12: 0.5 } },
  { id: 'ryazhenka', name: 'Ряженка', category: 'dairy', kcal: 66, protein: 3, fat: 3.2, carbs: 4.1, fiber: 0, gi: 15, servingSize: "250 г",
    bestFor: ['maintenance', 'bulk'], timing: 'any', pharmaNote: 'Пробиотики, легкоусвояемый белок', tier: 'basic',
    micros: { Ca: 130, P: 90, VitA: 25, VitB2: 0.14 } },
  { id: 'sour_cream_15', name: 'Сметана 15%', category: 'dairy', kcal: 160, protein: 2.6, fat: 15, carbs: 3.6, fiber: 0, gi: 15, servingSize: "50 г",
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Витамин A, D, E, K2', tier: 'basic',
    micros: { Ca: 85, VitA: 55, VitD: 0.5, VitE: 0.6 } },
  { id: 'whey_isolate', name: 'Изолят сывороточного белка', category: 'supplement', kcal: 380, protein: 88, fat: 1, carbs: 1, fiber: 0, gi: 0, servingSize: "30 г",
    bestFor: ['cut', 'recomp', 'bulk', 'maintenance', 'strength'], timing: 'post', pharmaNote: 'Быстрая абсорбция, высокая биодоступность', tier: 'mid',
    micros: { Ca: 500, P: 300, Mg: 30, Na: 300 } },

  { id: 'almonds', name: 'Миндаль', category: 'fat', kcal: 579, protein: 21, fat: 50, carbs: 22, fiber: 12, gi: 15, servingSize: "30 г",
    bestFor: ['maintenance', 'bulk', 'recomp'], timing: 'snack', pharmaNote: 'Витамин E, Mg, мононенасыщенные жиры', tier: 'mid',
    micros: { VitE: 25, Mg: 270, Ca: 269, P: 481, Fe: 3.7, Mn: 2.2, Zn: 3.1 } },
  { id: 'walnuts', name: 'Грецкие орехи', category: 'fat', kcal: 654, protein: 15, fat: 65, carbs: 14, fiber: 6.7, gi: 15, servingSize: "30 г",
    bestFor: ['maintenance', 'bulk'], timing: 'snack', pharmaNote: 'Омега-3 ALA, антиоксиданты', tier: 'mid',
    micros: { Omega3: 9000, Mg: 158, P: 346, Cu: 1.6, Mn: 3.4, VitE: 0.7, Zn: 3.1 } },
  { id: 'peanut_butter', name: 'Арахисовая паста', category: 'fat', kcal: 588, protein: 25, fat: 50, carbs: 20, fiber: 6, gi: 13, servingSize: "30 г",
    bestFor: ['bulk', 'maintenance'], timing: 'snack', pharmaNote: 'Высококалорийная, мононенасыщенные жиры', tier: 'basic',
    micros: { VitE: 9, Mg: 170, P: 340, Zn: 3.3, VitB3: 13, Fe: 1.7 } },
  { id: 'sunflower_seeds', name: 'Семена подсолнечника', category: 'fat', kcal: 584, protein: 21, fat: 51, carbs: 20, fiber: 8.6, gi: 35, servingSize: "30 г",
    bestFor: ['bulk', 'maintenance'], timing: 'snack', pharmaNote: 'Витамин E, селен, магний', tier: 'mid',
    micros: { VitE: 35, Se: 53, Mg: 330, P: 660, Zn: 5.3, VitB1: 1.5, Cu: 1.8 } },
  { id: 'flaxseed', name: 'Семена льна', category: 'fat', kcal: 534, protein: 18, fat: 42, carbs: 29, fiber: 27, gi: 15, servingSize: "20 г",
    bestFor: ['maintenance', 'cut', 'recomp'], timing: 'any', pharmaNote: 'Омега-3 ALA, лигнаны', tier: 'mid',
    micros: { Omega3: 22800, Mg: 392, P: 642, Mn: 2.5, VitB1: 1.6, Fe: 5.7, Cu: 1.2 } },
  { id: 'dark_chocolate', name: 'Тёмный шоколад 85%', category: 'fat', kcal: 598, protein: 10, fat: 47, carbs: 30, fiber: 13, gi: 20, servingSize: "25 г",
    bestFor: ['maintenance'], timing: 'snack', pharmaNote: 'Флавоноиды, Fe, Mg, цинк', tier: 'mid',
    micros: { Fe: 12, Mg: 230, Cu: 2.5, Mn: 2.1, Zn: 3.3, P: 310, K: 700 } },

  { id: 'tofu', name: 'Тофу', category: 'protein', kcal: 76, protein: 8, fat: 4.8, carbs: 1.9, fiber: 0.3, gi: 15, servingSize: "150 г",
    bestFor: ['cut', 'recomp', 'maintenance'], timing: 'lunch', pharmaNote: 'Растительный белок, изофлавоны, Ca', tier: 'mid',
    micros: { Ca: 350, Fe: 5.4, Mg: 30, P: 120, Zn: 0.8 } },
  { id: 'tempeh', name: 'Темпе', category: 'protein', kcal: 192, protein: 19, fat: 11, carbs: 7.6, fiber: 0, gi: 15, servingSize: "100 г",
    bestFor: ['maintenance', 'recomp', 'bulk'], timing: 'lunch', pharmaNote: 'Ферментированный соевый белок, витамин K2', tier: 'max',
    micros: { Ca: 111, Fe: 2.7, Mg: 81, P: 260, VitB2: 0.1, Zn: 1.1 } },
  { id: 'seitan', name: 'Сейтан (пшеничный белок)', category: 'protein', kcal: 141, protein: 75, fat: 1.9, carbs: 14, fiber: 0.8, gi: 0, servingSize: "100 г",
    bestFor: ['bulk', 'recomp'], timing: 'lunch', pharmaNote: 'Высокое содержание белка, без лактозы', tier: 'max',
    micros: { Fe: 5.2, P: 50, Se: 27, Zn: 0.6 } },

  { id: 'beetroot', name: 'Свёкла', category: 'veg_fruit', kcal: 43, protein: 1.6, fat: 0.2, carbs: 10, fiber: 2.8, gi: 61, servingSize: "200 г",
    bestFor: ['maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Нитраты → NO, улучшает кровоток', tier: 'mid',
    micros: { VitC: 5, K: 325, Fe: 0.8, Mn: 0.3, Mg: 23 } },
  { id: 'celery', name: 'Сельдерей', category: 'veg_fruit', kcal: 16, protein: 0.7, fat: 0.2, carbs: 3, fiber: 1.6, gi: 15, servingSize: "200 г",
    bestFor: ['cut', 'recomp'], timing: 'any', pharmaNote: 'Мочегонное, калий, флавоноиды', tier: 'basic',
    micros: { VitK: 29, K: 260, VitA: 22, VitC: 3 } },
  { id: 'green_bean', name: 'Стручковая фасоль', category: 'veg_fruit', kcal: 31, protein: 1.8, fat: 0.2, carbs: 7, fiber: 2.7, gi: 15, servingSize: "150 г",
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Клетчатка, витамин C, K', tier: 'basic',
    micros: { VitC: 12, VitK: 43, Fe: 1, Mg: 25, K: 210, Mn: 0.2 } },
  { id: 'asparagus', name: 'Спаржа', category: 'veg_fruit', kcal: 20, protein: 2.2, fat: 0.1, carbs: 3.9, fiber: 2.1, gi: 15, servingSize: "150 г",
    bestFor: ['cut', 'recomp'], timing: 'dinner', pharmaNote: 'Фолат, витамин K, мочегонное', tier: 'max',
    micros: { VitK: 50, VitB9: 52, VitC: 6, VitE: 1.1, Fe: 0.6, K: 200 } },
  { id: 'mushrooms', name: 'Шампиньоны', category: 'veg_fruit', kcal: 22, protein: 3.1, fat: 0.3, carbs: 3.3, fiber: 1, gi: 10, servingSize: "150 г",
    bestFor: ['cut', 'recomp', 'maintenance'], timing: 'lunch', pharmaNote: 'Витамин D (при UV-обработке), селен', tier: 'basic',
    micros: { Se: 8, VitB2: 0.3, VitB3: 3.5, VitD: 0.2, Cu: 0.4, Zn: 0.5 } },
  { id: 'seaweed_nori', name: 'Нори (морские водоросли)', category: 'veg_fruit', kcal: 35, protein: 5.8, fat: 0.3, carbs: 5.1, fiber: 0.3, gi: 10, servingSize: "10 г",
    bestFor: ['maintenance', 'recomp'], timing: 'any', pharmaNote: 'Йод, витамин B12, железо', tier: 'mid',
    micros: { Fe: 1.8, VitA: 127, VitC: 4, VitB12: 1.4, Zn: 1.1, Mn: 0.3 } },

  { id: 'watermelon', name: 'Арбуз', category: 'veg_fruit', kcal: 30, protein: 0.6, fat: 0.2, carbs: 8, fiber: 0.4, gi: 76, servingSize: "300 г",
    bestFor: ['maintenance'], timing: 'snack', pharmaNote: 'Цитруллин → аргинин, NO-продукция', tier: 'basic',
    micros: { VitC: 8, VitA: 28, K: 112, Mg: 10 } },
  { id: 'pineapple', name: 'Ананас', category: 'veg_fruit', kcal: 50, protein: 0.5, fat: 0.1, carbs: 13, fiber: 1.4, gi: 59, servingSize: "150 г",
    bestFor: ['maintenance', 'bulk'], timing: 'post', pharmaNote: 'Бромелайн (противовоспалительное)', tier: 'basic',
    micros: { VitC: 48, Mn: 1.0, VitB1: 0.08, VitB6: 0.1, Cu: 0.1, Mg: 12 } },
  { id: 'kiwi', name: 'Киви', category: 'veg_fruit', kcal: 61, protein: 1.1, fat: 0.5, carbs: 15, fiber: 3, gi: 39, servingSize: "100 г",
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'snack', pharmaNote: 'Витамин C > апельсина, клетчатка', tier: 'basic',
    micros: { VitC: 93, VitK: 40, VitE: 1.5, K: 312, VitB9: 25 } },
  { id: 'pomegranate', name: 'Гранат', category: 'veg_fruit', kcal: 83, protein: 1.7, fat: 1.2, carbs: 19, fiber: 4, gi: 35, servingSize: "150 г",
    bestFor: ['maintenance', 'recomp'], timing: 'snack', pharmaNote: 'Антиоксиданты, пуниковая кислота', tier: 'mid',
    micros: { VitC: 10, VitK: 16, K: 236, Fe: 0.3, VitB9: 38 } },

  { id: 'rice_noodles', name: 'Рисовая лапша', category: 'carb', kcal: 364, protein: 0.6, fat: 0.1, carbs: 82, fiber: 0.5, gi: 53, servingSize: "100 г",
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Быстрые углеводы, низкий ГИ', tier: 'basic',
    micros: { Fe: 0.2, Mg: 4, P: 7 } },
  { id: 'tortilla_wheat', name: 'Тортилья пшеничная', category: 'carb', kcal: 312, protein: 8, fat: 8, carbs: 50, fiber: 3, gi: 30, servingSize: "60 г",
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Удобный формат, средний ГИ', tier: 'basic',
    micros: { Fe: 2.5, VitB1: 0.3, VitB9: 30, Mg: 20, P: 110, Na: 400 } },
  { id: 'granola', name: 'Гранола', category: 'carb', kcal: 471, protein: 10, fat: 20, carbs: 64, fiber: 6, gi: 55, servingSize: "50 г",
    bestFor: ['bulk'], timing: 'breakfast', pharmaNote: 'Овсяная основа + орехи, высококалорийная', tier: 'mid',
    micros: { Fe: 3, Mg: 75, P: 230, Zn: 2, VitE: 3, Se: 12 } },
  { id: 'dried_apricots', name: 'Курага', category: 'carb', kcal: 241, protein: 3.4, fat: 0.4, carbs: 63, fiber: 7, gi: 30, servingSize: "40 г",
    bestFor: ['bulk', 'maintenance'], timing: 'snack', pharmaNote: 'Калий, железо, бета-каротин', tier: 'basic',
    micros: { K: 1162, Fe: 2.7, VitA: 127, Mg: 32, P: 67, VitB3: 2.6 } },

  { id: 'protein_bar', name: 'Протеиновый батончик', category: 'supplement', kcal: 350, protein: 30, fat: 15, carbs: 28, fiber: 3, gi: 40, servingSize: "60 г",
    bestFor: ['maintenance', 'recomp', 'cut'], timing: 'snack', pharmaNote: 'Удобный перекус, быстрый белок', tier: 'mid',
    micros: { Ca: 150, Fe: 3, P: 200, Mg: 30, VitB12: 0.6 } },
  { id: 'vitamin_complex', name: 'Витаминно-минеральный комплекс', category: 'supplement', kcal: 5, protein: 0, fat: 0, carbs: 0.5, fiber: 0, gi: 0, servingSize: "1 г",
    bestFor: ['maintenance', 'cut', 'bulk', 'recomp', 'rehab', 'strength'], timing: 'breakfast', pharmaNote: 'Базовое покрытие дефицитов', tier: 'basic',
    micros: { VitA: 900, VitC: 90, VitD: 15, VitE: 15, VitK: 120, VitB1: 1.2, VitB6: 1.7, VitB12: 2.4, VitB9: 400, Fe: 14, Mg: 40, Zn: 11, Cu: 0.9, Se: 55 } },
  { id: 'shrimp', name: 'Креветки (варёные)', category: 'protein', kcal: 99, protein: 24, fat: 0.3, carbs: 0.2, fiber: 0, gi: 0, servingSize: '100 г',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'dinner', pharmaNote: 'Йод и селен — поддержка щитовидной и иммунитета', tier: 'mid',
    micros: { Ca: 52, Fe: 0.3, Mg: 37, P: 205, K: 259, Na: 111, Zn: 1.1, Se: 38, VitB12: 1.1, VitE: 1.3 } },
  { id: 'greek_yogurt', name: 'Греческий йогурт (2%)', category: 'dairy', kcal: 59, protein: 10, fat: 2, carbs: 3.6, fiber: 0, gi: 20, servingSize: '100 г',
    bestFor: ['maintenance', 'recomp', 'cut'], timing: 'any', pharmaNote: 'Пробиотики + белок — поддержка кишечника и восстановление', tier: 'mid',
    micros: { Ca: 110, Fe: 0.1, Mg: 11, P: 135, K: 141, Na: 36, Zn: 0.4, VitB2: 0.3, VitB12: 0.8 } },
  { id: 'lentils', name: 'Чечевица (варёная)', category: 'carb', kcal: 116, protein: 9, fat: 0.4, carbs: 20, fiber: 8, gi: 30, servingSize: '100 г',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Фолат + железо + белок — веганская альтернатива мясу', tier: 'basic',
    micros: { Ca: 19, Fe: 3.3, Mg: 36, P: 180, K: 369, Na: 2, Zn: 1.3, Se: 5.5, VitB9: 180, VitB6: 0.2 } },
  { id: 'quinoa', name: 'Киноа (варёная)', category: 'grain', kcal: 120, protein: 4.4, fat: 1.9, carbs: 21, fiber: 2.8, gi: 53, servingSize: '100 г',
    bestFor: ['bulk', 'maintenance', 'recomp', 'rehab'], timing: 'lunch', pharmaNote: 'Полноценный белок + Mg + Fe — суперзерно', tier: 'max',
    micros: { Ca: 17, Fe: 1.5, Mg: 64, P: 152, K: 172, Na: 7, Zn: 1.1, Se: 2.8, VitB9: 42, VitB6: 0.1 } },
  { id: 'sweet_potato', name: 'Батат (запечённый)', category: 'carb', kcal: 90, protein: 2, fat: 0.1, carbs: 21, fiber: 3.8, gi: 44, servingSize: '100 г',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'after_train', pharmaNote: 'Бета-каротин + калий — восстановление и иммунитет', tier: 'mid',
    micros: { Ca: 38, Fe: 0.7, Mg: 27, P: 54, K: 475, Na: 36, Zn: 0.3, Se: 0.6, VitA: 961, VitC: 2.4 } },
  { id: 'blueberries', name: 'Черника', category: 'veg_fruit', kcal: 57, protein: 0.7, fat: 0.3, carbs: 14, fiber: 2.4, gi: 53, servingSize: '100 г',
    bestFor: ['cut', 'maintenance', 'rehab'], timing: 'any', pharmaNote: 'Антоцианы — мощнейший антиоксидант, нейропротекция', tier: 'max',
    micros: { Ca: 6, Fe: 0.3, Mg: 6, P: 12, K: 77, Na: 1, Zn: 0.2, Se: 0.1, VitC: 10, VitK: 19 } },
  { id: 'chia_seeds', name: 'Семена чиа', category: 'fat', kcal: 486, protein: 17, fat: 31, carbs: 42, fiber: 34, gi: 0, servingSize: '30 г',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'morning', pharmaNote: 'Омега-3 ALA + 34г клетчатки на 100г — суперфуд', tier: 'max',
    micros: { Ca: 631, Fe: 7.7, Mg: 335, P: 860, K: 407, Na: 16, Zn: 3.4, Se: 55, VitB3: 2.5, Omega3: 17.8 } },
  { id: 'dark_chocolate', name: 'Тёмный шоколад (70%)', category: 'fat', kcal: 598, protein: 8, fat: 43, carbs: 46, fiber: 11, gi: 25, servingSize: '30 г',
    bestFor: ['bulk', 'maintenance'], timing: 'snack', pharmaNote: 'Флавоноиды — антиоксидант, кардиопротекция, улучшение настроения', tier: 'max',
    micros: { Ca: 73, Fe: 11.9, Mg: 228, P: 308, K: 715, Na: 20, Zn: 3.3, Se: 6.8, VitE: 0.6, Cu: 1.7 } },
  { id: 'sardines', name: 'Сардины (консервы)', category: 'protein', kcal: 208, protein: 25, fat: 11, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    bestFor: ['bulk', 'maintenance', 'rehab'], timing: 'lunch', pharmaNote: 'Омега-3 + Ca + VitD — кости и сердце. Кости съедобны!', tier: 'max',
    micros: { Ca: 382, Fe: 2.9, Mg: 39, P: 490, K: 430, Na: 307, Zn: 1.0, Se: 52.7, VitB3: 5.2, VitB12: 8.9, VitD: 4.8 } },
  { id: 'mackerel', name: 'Скумбрия (запечённая)', category: 'protein', kcal: 262, protein: 24, fat: 18, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    bestFor: ['bulk', 'recomp', 'rehab'], timing: 'lunch', pharmaNote: 'Омега-3 EPA/DHA 2.6г — один из лучших источников. Коэнзим Q10.', tier: 'max',
    micros: { Ca: 15, Fe: 1.6, Mg: 76, P: 240, K: 360, Na: 90, Zn: 0.6, Se: 44, VitB3: 9.1, VitB12: 8.7, VitD: 360, Omega3: 2.6 } },
  { id: 'beetroot', name: 'Свёкла варёная', category: 'veg_fruit', kcal: 44, protein: 1.7, fat: 0.2, carbs: 10, fiber: 2, gi: 64, servingSize: '100 г',
    bestFor: ['recomp', 'strength', 'maintenance'], timing: 'lunch', pharmaNote: 'Нитраты -> NO -> вазодилатация -> улучшение кровотока', tier: 'max',
    micros: { Ca: 16, Fe: 0.8, Mg: 23, P: 40, K: 325, Na: 78, Zn: 0.4, Se: 0.7, VitC: 5, VitB9: 80 } },
  { id: 'kale', name: 'Кейл (листовая капуста)', category: 'veg_fruit', kcal: 35, protein: 2.9, fat: 0.6, carbs: 6, fiber: 3.6, gi: 5, servingSize: '100 г',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'any', pharmaNote: 'Витамин K 390 мкг — коагуляция + костный метаболизм', tier: 'max',
    micros: { Ca: 150, Fe: 1.5, Mg: 47, P: 92, K: 491, Na: 38, Zn: 0.4, Se: 0.9, VitC: 120, VitK: 390, VitA: 500, VitB9: 29 } },
  { id: 'almonds', name: 'Миндаль', category: 'fat', kcal: 579, protein: 21, fat: 50, carbs: 22, fiber: 12, gi: 15, servingSize: '30 г',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'snack', pharmaNote: 'Mg 270 мг/100г + VitE — кардиопротекция и восстановление ЦНС', tier: 'max',
    micros: { Ca: 269, Fe: 3.7, Mg: 270, P: 481, K: 733, Na: 1, Zn: 3.1, Se: 4.1, VitE: 25.6, VitB2: 1.1, VitB9: 50 } },
  { id: 'hemp_seeds', name: 'Семена конопли', category: 'fat', kcal: 553, protein: 31, fat: 49, carbs: 8, fiber: 4, gi: 0, servingSize: '30 г',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'any', pharmaNote: 'Омега-3:Омега-6 = 1:3 — идеальный баланс. Полноценный белок.', tier: 'max',
    micros: { Ca: 70, Fe: 8, Mg: 700, P: 1650, K: 1200, Na: 5, Zn: 7, Se: 0, VitE: 15, Omega3: 7 } },
  { id: 'dried_apricots', name: 'Курага', category: 'veg_fruit', kcal: 241, protein: 3.4, fat: 0.5, carbs: 63, fiber: 7, gi: 30, servingSize: '30 г',
    bestFor: ['bulk', 'rehab', 'maintenance'], timing: 'snack', pharmaNote: 'K 1162 мг/100г + Fe 2.7 мг — поддержка при кленбутероле', tier: 'mid',
    micros: { Ca: 55, Fe: 2.7, Mg: 32, P: 71, K: 1162, Na: 10, Zn: 0.4, Se: 2.2, VitA: 216, VitB3: 2.7, VitE: 4.3 } },
  { id: 'pomegranate', name: 'Гранат', category: 'veg_fruit', kcal: 83, protein: 1.7, fat: 1.2, carbs: 19, fiber: 4, gi: 35, servingSize: '100 г (зёрна)',
    bestFor: ['maintenance', 'recomp', 'rehab'], timing: 'snack', pharmaNote: 'Эллаговая кислота + полифенолы — антиоксидант, кардиопротекция', tier: 'max',
    micros: { Ca: 10, Fe: 0.3, Mg: 12, P: 36, K: 236, Na: 3, Se: 0.5, VitC: 10, VitK: 16, VitB9: 38 } },
  { id: 'seaweed_nori', name: 'Нори (морская капуста)', category: 'veg_fruit', kcal: 35, protein: 5.8, fat: 0.3, carbs: 5, fiber: 0.3, gi: 0, servingSize: '10 г (2 листа)',
    bestFor: ['maintenance', 'rehab', 'cut'], timing: 'any', pharmaNote: 'Йод 4600 мкг/100г — поддержка щитовидной', tier: 'mid',
    micros: { Ca: 260, Fe: 1.8, Mg: 200, P: 210, K: 300, Na: 890, Zn: 1.2, Se: 0.7, VitA: 3920, VitC: 39, VitK: 10 } },
  { id: 'turmeric', name: 'Куркума (порошок)', category: 'supplement', kcal: 312, protein: 10, fat: 3.3, carbs: 67, fiber: 23, gi: 0, servingSize: '3 г (1 ч.л.)',
    bestFor: ['rehab', 'maintenance', 'recomp'], timing: 'any', pharmaNote: 'Куркумин — мощный противовоспалительный. Биодоступность + пиперин x10', tier: 'max',
    micros: { Ca: 183, Fe: 41.4, Mg: 193, P: 268, K: 2083, Na: 27, Zn: 4.3, Se: 4.5, VitC: 26, VitB6: 1.8, VitE: 3.1 } },
  { id: 'bone_broth', name: 'Костный бульон', category: 'protein', kcal: 15, protein: 3, fat: 0.5, carbs: 0.5, fiber: 0, gi: 0, servingSize: '250 мл',
    bestFor: ['rehab', 'maintenance', 'cut'], timing: 'any', pharmaNote: 'Коллаген + гиалуроновая кислота — суставы, связки, ЖКТ', tier: 'mid',
    micros: { Ca: 10, Mg: 5, P: 20, K: 50, Na: 200, VitC: 0 } },
  { id: 'watermelon', name: 'Арбуз', category: 'veg_fruit', kcal: 30, protein: 0.6, fat: 0.2, carbs: 8, fiber: 0.4, gi: 72, servingSize: '150 г',
    bestFor: ['cut', 'maintenance'], timing: 'snack', pharmaNote: 'Цитруллин -> NO -> кровоток. L-цитруллин как эргогенный помощник', tier: 'basic',
    micros: { Ca: 7, Fe: 0.2, Mg: 10, P: 11, K: 112, Na: 1, Se: 0.1, VitC: 8.1, VitA: 28 } },
  { id: 'edamame', name: 'Эдамаме (варёные)', category: 'veg_fruit', kcal: 121, protein: 12, fat: 5, carbs: 9, fiber: 5, gi: 25, servingSize: '100 г',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'snack', pharmaNote: 'Фолат + железо + белок — поддержка кроветворения', tier: 'mid',
    micros: { Ca: 63, Fe: 2.3, Mg: 64, P: 169, K: 436, Na: 6, Zn: 1.0, Se: 1.5, VitB9: 311, VitK: 26 } },
  { id: 'feta_cheese', name: 'Сыр фета', category: 'dairy', kcal: 264, protein: 14, fat: 21, carbs: 4, fiber: 0, gi: 0, servingSize: '30 г',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Ca 360 мг/100г — но высок Na. Умеренное потребление.', tier: 'mid',
    micros: { Ca: 360, Fe: 0.3, Mg: 20, P: 280, K: 95, Na: 980, Zn: 2.0, Se: 15, VitB2: 0.4, VitB12: 1.1 } },
  { id: 'coffee_espresso', name: 'Кофе эспрессо', category: 'other', kcal: 2, protein: 0.1, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '30 мл',
    bestFor: ['cut', 'strength', 'maintenance'], timing: 'morning', pharmaNote: 'Кофеин — стимулянт ЦНС, эргогенный эффект. Антиоксидант.', tier: 'basic',
    micros: { Mg: 24, P: 2, K: 51, Na: 14 } },
  { id: 'green_tea', name: 'Зелёный чай', category: 'other', kcal: 1, protein: 0.2, fat: 0, carbs: 0.2, fiber: 0, gi: 0, servingSize: '200 мл',
    bestFor: ['cut', 'maintenance', 'rehab'], timing: 'any', pharmaNote: 'EGCG — антиоксидант, термогенный. Ингибирует COMT.', tier: 'mid',
    micros: { Ca: 2, Mg: 2, P: 1, K: 9, Na: 1, Fe: 0 } },
  // === User-specified nutrition items ===
  { id: 'beef_minced', name: 'Фарш говяжий', category: 'protein', kcal: 190, protein: 17, fat: 12, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г', description: 'Говяжий фарш до 10% жирности', tier: 'mid', allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  { id: 'red_fish', name: 'Красная рыба', category: 'protein', kcal: 200, protein: 20, fat: 13, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г', description: 'Лосось/форель/семга. Не чаще 2р/нед', tier: 'max', allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['omega3'] },
  { id: 'white_fish_cod', name: 'Треска', category: 'protein', kcal: 82, protein: 18, fat: 1, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г', description: 'Белая рыба, обезжиренный белок', tier: 'basic', allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  { id: 'white_fish_halibut', name: 'Палтус', category: 'protein', kcal: 110, protein: 21, fat: 3, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г', description: 'Белая рыба, плотная', tier: 'mid', allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  { id: 'white_fish_mintai', name: 'Минтай', category: 'protein', kcal: 72, protein: 16, fat: 1, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г', description: 'Белая рыба, бюджетный вариант', tier: 'basic', allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  { id: 'coconut_oil', name: 'Кокосовое масло', category: 'fat', kcal: 862, protein: 0, fat: 99, carbs: 0, fiber: 0, gi: 0, servingSize: '15 мл', description: 'MCT-жиры, быстрая энергия', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  { id: 'coconut_urbec', name: 'Кокосовый урбеч', category: 'fat', kcal: 570, protein: 13, fat: 45, carbs: 27, fiber: 10, gi: 35, servingSize: '30 г', description: 'Паста из кокоса, MCT + клетчатка', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  { id: 'red_caviar', name: 'Красная икра', category: 'fat', kcal: 250, protein: 30, fat: 14, carbs: 1, fiber: 0, gi: 0, servingSize: '30 г', description: 'Омега-3, витамин D, B12', tier: 'max', allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['omega3'] },
  { id: 'cream_of_rice', name: 'Cream of Rice', category: 'carb', kcal: 380, protein: 7, fat: 1, carbs: 82, fiber: 1, gi: 80, servingSize: '50 г', description: 'Рисовая каша, быстрые углеводы', tier: 'basic', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  { id: 'whole_grain_bread', name: 'Хлеб цельнозерновой', category: 'carb', kcal: 250, protein: 9, fat: 3, carbs: 47, fiber: 7, gi: 50, servingSize: '40г', description: 'Сложные углеводы + клетчатка', tier: 'mid', allergens: ['gluten'], isVegetarian: true, isVegan: true, isGlutenFree: false, isDairyFree: true, dietTags: [] },
  { id: 'corn_flakes', name: 'Кукурузные хлопья', category: 'carb', kcal: 360, protein: 7, fat: 1, carbs: 80, fiber: 3, gi: 80, servingSize: '30 г', description: 'Ограниченно. Без пшеницы', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['limited'] },
  { id: 'citrus', name: 'Цитрусовые', category: 'veg_fruit', kcal: 40, protein: 1, fat: 0, carbs: 10, fiber: 2, gi: 40, servingSize: '150г', description: 'Ограниченно. Витамин C', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['limited'] },
  { id: 'green_apple', name: 'Зелёное яблоко', category: 'veg_fruit', kcal: 52, protein: 0, fat: 0, carbs: 14, fiber: 2, gi: 35, servingSize: '180г', description: 'Ограниченно. Низкий ГИ, пектин', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['limited'] },
  { id: 'dates', name: 'Финики', category: 'carb', kcal: 280, protein: 2, fat: 0, carbs: 70, fiber: 7, gi: 55, servingSize: '60г', description: 'Ограниченно. Высокая калорийность', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['limited'] },
  { id: 'marmalade', name: 'Мармелад', category: 'carb', kcal: 300, protein: 1, fat: 0, carbs: 75, fiber: 0, gi: 70, servingSize: '30 г', description: 'Ограниченно. Желатин + сахар', tier: 'mid', allergens: [], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['limited'] },
  { id: 'tomato_juice', name: 'Томатный сок', category: 'veg_fruit', kcal: 18, protein: 1, fat: 0, carbs: 4, fiber: 1, gi: 38, servingSize: '200 мл', description: 'Ограниченно. Ликопин, калий', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['limited'] },
  { id: 'amylopectin', name: 'Амилопектин', category: 'supplement', kcal: 380, protein: 0, fat: 0, carbs: 95, fiber: 0, gi: 95, servingSize: '30 г', description: 'Ограниченно. Периоркоут углеводы', tier: 'max', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['limited', 'peri-workout'] },
  { id: 'dextrose', name: 'Декстроза', category: 'supplement', kcal: 370, protein: 0, fat: 0, carbs: 93, fiber: 0, gi: 100, servingSize: '20 г', description: 'Ограниченно. Посттренинговые углеводы', tier: 'max', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['limited', 'peri-workout'] },
  { id: 'onion', name: 'Лук', category: 'veg_fruit', kcal: 40, protein: 1, fat: 0, carbs: 9, fiber: 2, gi: 15, servingSize: '80г', description: 'Клетчатка. Кверцетин', tier: 'basic', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  { id: 'sauerkraut', name: 'Квашеная капуста', category: 'veg_fruit', kcal: 20, protein: 1, fat: 0, carbs: 4, fiber: 3, gi: 15, servingSize: '100 г', description: 'Пробиотик. Не ежедневно!', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['fermented'] },
  { id: 'tomato_paste', name: 'Томатная паста', category: 'veg_fruit', kcal: 80, protein: 4, fat: 1, carbs: 17, fiber: 3, gi: 50, servingSize: '30 г', description: 'Специя. Концентрированный ликопин', tier: 'basic', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  { id: 'himalayan_salt', name: 'Гималайская соль', category: 'other', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '2 г', description: 'Специя. Минералы', tier: 'basic', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },

];

export const FOOD_ALLERGEN_DIET: Record<string, { allergens: string[]; isVegetarian: boolean; isVegan: boolean; isGlutenFree: boolean; isDairyFree: boolean; dietTags: string[] }> = {
  chicken_breast: { allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  turkey_breast: { allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  beef_lean: { allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  salmon: { allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  tuna_canned: { allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  egg_whole: { allergens: ['eggs'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  egg_white: { allergens: ['eggs'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto'] },
  pork_tenderloin: { allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  whey_protein: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['keto'] },
  casein: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['keto'] },
  chicken_thigh: { allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  shrimp: { allergens: ['shellfish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  tuna_steak: { allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  sardines: { allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  mackerel: { allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  tofu: { allergens: ['soy'], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  tempeh: { allergens: ['soy'], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  seitan: { allergens: ['gluten'], isVegetarian: true, isVegan: true, isGlutenFree: false, isDairyFree: true, dietTags: [] },
  rice_white: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  rice_brown: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  oats: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  buckwheat: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  quinoa: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  bread_rye: { allergens: ['gluten'], isVegetarian: true, isVegan: true, isGlutenFree: false, isDairyFree: true, dietTags: [] },
  pasta_durum: { allergens: ['gluten'], isVegetarian: true, isVegan: true, isGlutenFree: false, isDairyFree: true, dietTags: ['mediterranean'] },
  potato_boiled: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  sweet_potato: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo', 'mediterranean'] },
  lentils: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  chickpeas: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  corn: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  rice_noodles: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  tortilla_wheat: { allergens: ['gluten'], isVegetarian: true, isVegan: true, isGlutenFree: false, isDairyFree: true, dietTags: [] },
  granola: { allergens: ['gluten', 'tree_nuts'], isVegetarian: true, isVegan: true, isGlutenFree: false, isDairyFree: true, dietTags: [] },
  dried_apricots: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  banana: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  apple: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo', 'mediterranean'] },
  berries: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  broccoli: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  spinach: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  cucumber: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  tomato: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  pepper: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  cabbage: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  carrot: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo', 'mediterranean'] },
  zucchini: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  eggplant: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'mediterranean'] },
  peas_green: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  grapefruit: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  pear: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  beetroot: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  celery: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  green_bean: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'mediterranean'] },
  asparagus: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  mushrooms: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  seaweed_nori: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  watermelon: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  pineapple: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  kiwi: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  pomegranate: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo', 'mediterranean'] },
  olive_oil: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  avocado: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  nuts_mix: { allergens: ['tree_nuts'], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  seeds: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  butter: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['keto'] },
  fish_oil_food: { allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  almonds: { allergens: ['tree_nuts'], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  walnuts: { allergens: ['tree_nuts'], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  peanut_butter: { allergens: ['peanuts'], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto'] },
  sunflower_seeds: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  flaxseed: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  dark_chocolate: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto'] },
  cottage_cheese_5: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['keto', 'mediterranean'] },
  kefir: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['mediterranean'] },
  yogurt_greek: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['keto', 'mediterranean'] },
  milk: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['mediterranean'] },
  cheese_hard: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['keto', 'mediterranean'] },
  kefir_2: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['mediterranean'] },
  yogurt_natural: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['mediterranean'] },
  ryazhenka: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['mediterranean'] },
  sour_cream_15: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['mediterranean'] },
  shawarma: { allergens: ['gluten', 'dairy'], isVegetarian: false, isVegan: false, isGlutenFree: false, isDairyFree: false, dietTags: [] },
  pizza_margherita: { allergens: ['dairy', 'gluten'], isVegetarian: true, isVegan: false, isGlutenFree: false, isDairyFree: false, dietTags: ['mediterranean'] },
  burger: { allergens: ['gluten', 'dairy'], isVegetarian: false, isVegan: false, isGlutenFree: false, isDairyFree: false, dietTags: [] },
  creatine: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto'] },
  bcaa: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto'] },
  glutamine: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto'] },
  vitamin_complex: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  fish_oil: { allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'mediterranean'] },
  whey_isolate: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['keto'] },
  protein_bar: { allergens: ['dairy', 'gluten'], isVegetarian: true, isVegan: false, isGlutenFree: false, isDairyFree: false, dietTags: [] },
};

function applyDietTags(foods: FoodItem[]): FoodItem[] {
  return foods.map(f => {
    const tags = FOOD_ALLERGEN_DIET[f.id];
    if (tags) {
      return { ...f, allergens: tags.allergens, isVegetarian: tags.isVegetarian, isVegan: tags.isVegan, isGlutenFree: tags.isGlutenFree, isDairyFree: tags.isDairyFree, dietTags: tags.dietTags };
    }
    return f;
  });
}

const RATION_TIERS: Record<string, { basic: string[]; mid: string[]; max: string[] }> = {
  protein: {
    basic: ['chicken_breast', 'egg_whole', 'egg_white', 'whey_protein', 'white_fish_cod', 'white_fish_mintai'],
    mid: ['turkey_breast', 'tuna_canned', 'pork_tenderloin', 'casein', 'beef_minced', 'white_fish_halibut'],
    max: ['beef_lean', 'salmon', 'red_fish'],
  },
  carb: {
    basic: ['rice_white', 'oats', 'potato_boiled', 'banana', 'cream_of_rice'],
    mid: ['rice_brown', 'buckwheat', 'pasta_durum', 'sweet_potato', 'rice_noodles', 'whole_grain_bread'],
    max: ['quinoa', 'berries'],
  },
  fat: {
    basic: ['olive_oil', 'butter'],
    mid: ['avocado', 'nuts_mix', 'yogurt_greek', 'coconut_oil', 'coconut_urbec'],
    max: ['seeds', 'fish_oil_food', 'red_caviar'],
  },
  dairy: {
    basic: ['cottage_cheese_5', 'kefir', 'milk'],
    mid: ['cheese_hard', 'yogurt_greek'],
    max: [],
  },
  veg_fruit: {
    basic: ['broccoli', 'cucumber', 'tomato', 'carrot', 'onion', 'tomato_paste'],
    mid: ['spinach', 'pepper', 'berries', 'beetroot', 'sauerkraut', 'green_apple', 'citrus', 'tomato_juice'],
    max: [],
  },
  supplement: {
    basic: ['creatine', 'fish_oil', 'vitamin_complex'],
    mid: ['bcaa', 'glutamine', 'casein', 'marmalade', 'corn_flakes', 'dates'],
    max: ['amylopectin', 'dextrose'],
  },
};

export interface FoodFilter {
  dietType?: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean';
  excludeAllergens?: string[];
  excludedIds?: string[];
}

function matchesFilter(food: FoodItem, filter?: FoodFilter): boolean {
  if (!filter) return true;
  const tags = FOOD_ALLERGEN_DIET[food.id];
  if (filter.dietType === 'vegan' && tags && !tags.isVegan) return false;
  if (filter.dietType === 'vegetarian' && tags && !tags.isVegetarian) return false;
  if (filter.dietType === 'pescatarian' && tags && !tags.isVegetarian && !tags.allergens.includes('fish')) return false;
  if (filter.dietType === 'keto' && tags && !tags.dietTags.includes('keto') && food.carbs > 15) return false;
  if (filter.dietType === 'paleo' && tags && !tags.dietTags.includes('paleo') && food.category === 'dairy') return false;
  if (filter.dietType === 'mediterranean' && tags && !tags.dietTags.includes('mediterranean') && food.category === 'fast_food') return false;
  if (filter.excludeAllergens?.length && tags) {
    for (const a of filter.excludeAllergens) {
      if (tags.allergens.includes(a)) return false;
    }
  }
  if (filter.excludedIds?.includes(food.id)) return false;
  return true;
}

export function searchFood(query: string, filter?: FoodFilter): FoodItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return applyDietTags(FOOD_DB.filter(f =>
    (f.name.toLowerCase().includes(q) || f.category.includes(q)) && matchesFilter(f, filter)
  )).slice(0, 12);
}

export function getFoodById(id: string): FoodItem | undefined {
  const f = FOOD_DB.find(f => f.id === id);
  if (!f) return undefined;
  const tags = FOOD_ALLERGEN_DIET[id];
  if (tags) return { ...f, allergens: tags.allergens, isVegetarian: tags.isVegetarian, isVegan: tags.isVegan, isGlutenFree: tags.isGlutenFree, isDairyFree: tags.isDairyFree, dietTags: tags.dietTags };
  return f;
}

export function getFoodByCategory(cat: FoodItem['category'], filter?: FoodFilter): FoodItem[] {
  return applyDietTags(FOOD_DB.filter(f => f.category === cat && matchesFilter(f, filter)));
}

export function getFoodsByTier(cat: string, tier: 'basic' | 'mid' | 'max', filter?: FoodFilter): FoodItem[] {
  const ids = RATION_TIERS[cat]?.[tier] || [];
  return applyDietTags(ids.map(id => FOOD_DB.find(f => f.id === id.trim())).filter((f): f is FoodItem => !!f && matchesFilter(f, filter)));
}

export function getTopByProtein(limit: number, filter?: FoodFilter): FoodItem[] {
  return applyDietTags([...FOOD_DB]
    .filter(f => f.protein > 5 && f.category !== 'supplement' && matchesFilter(f, filter))
    .sort((a, b) => (b.protein / Math.max(b.kcal, 1)) - (a.protein / Math.max(a.kcal, 1)))
    .slice(0, limit));
}

export function getTopByCarbs(limit: number, filter?: FoodFilter): FoodItem[] {
  return applyDietTags([...FOOD_DB]
    .filter(f => f.carbs > 5 && f.gi <= 70 && f.category !== 'supplement' && matchesFilter(f, filter))
    .sort((a, b) => b.carbs - a.carbs)
    .slice(0, limit));
}

export function getTopByFat(limit: number, filter?: FoodFilter): FoodItem[] {
  return applyDietTags([...FOOD_DB]
    .filter(f => f.fat > 5 && f.category !== 'supplement' && matchesFilter(f, filter))
    .sort((a, b) => (b.fat / Math.max(b.kcal, 1)) - (a.fat / Math.max(a.kcal, 1)))
    .slice(0, limit));
}

export { RATION_TIERS };
