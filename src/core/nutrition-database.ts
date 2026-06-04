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
}

export const FOOD_DB: FoodItem[] = [
  { id: 'chicken_breast', name: 'Куриная грудка (вареная)', category: 'protein', kcal: 165, protein: 31, fat: 3.6, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Классический базовый белок — минимум жира, максимум протеина. Идеальна для ежедневного рациона и сушки.',
    bestFor: ['maintenance', 'cut', 'recomp'], timing: 'any', pharmaNote: 'Нейтральный продукт, нет фармако-конфликтов', tier: 'basic' },
  { id: 'turkey_breast', name: 'Индейка (грудка вареная)', category: 'protein', kcal: 135, protein: 29, fat: 1, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Средний уровень — больше триптофана, чем в курице, улучшает сон и восстановление. Меньше жира, богаче по аминокислотному профилю.',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'after_train', pharmaNote: 'Триптофан поддерживает серотонин — полезно при приёме ингибиторов ароматазы', tier: 'mid' },
  { id: 'beef_lean', name: 'Говядина постная (тушеная)', category: 'protein', kcal: 200, protein: 26, fat: 10, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Максимальная категория — железо, цинк, B12, креатин. Ключевой продукт для набора массы и поддержки кроветворения.',
    bestFor: ['bulk', 'strength', 'recomp'], timing: 'lunch', pharmaNote: 'Высокое железо и B12 — компенсирует потерю от метформина', tier: 'max' },
  { id: 'salmon', name: 'Лосось/Семга (запеченная)', category: 'protein', kcal: 208, protein: 20, fat: 13, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Максимум — Омега-3 EPA/DHA 2.5 г, витамин D 500 IU, высококачественный белок. Анти-воспаление, суставы, сердце.',
    bestFor: ['bulk', 'recomp', 'rehab'], timing: 'lunch', pharmaNote: 'Омега-3 компенсирует потерю CoQ10 от статинов и боли в суставах от анастрозола', tier: 'max' },
  { id: 'tuna_canned', name: 'Тунец консервированный', category: 'protein', kcal: 116, protein: 25, fat: 1, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Средний — высокое содержание белка при минимуме жира. Удобный и доступный источник протеина.',
    bestFor: ['cut', 'maintenance'], timing: 'any', pharmaNote: 'Осторожно при повышенном уровне ртути — не более 3 раз/неделю', tier: 'mid' },
  { id: 'egg_whole', name: 'Яйцо куриное целое', category: 'protein', kcal: 155, protein: 13, fat: 11, carbs: 1.1, fiber: 0, gi: 0, servingSize: '1 шт (60 г)',
    description: 'Базовый — эталонный белок (PDCAAS 1.0), лецитин, холин, витамины A/D/E. Желток содержит холестерин — сырьё для синтеза тестостерона.',
    bestFor: ['bulk', 'maintenance', 'strength'], timing: 'morning', pharmaNote: 'Холин поддерживает печень — синергия с TUDCA/NAC', tier: 'basic' },
  { id: 'egg_white', name: 'Белок яичный', category: 'protein', kcal: 52, protein: 11, fat: 0, carbs: 0.7, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Базовый для сушки — чистый белок без жира. Идеален для увеличения протеина без калорий.',
    bestFor: ['cut', 'recomp'], timing: 'morning', pharmaNote: 'Нет фармако-конфликтов', tier: 'basic' },
  { id: 'pork_tenderloin', name: 'Свиная вырезка', category: 'protein', kcal: 150, protein: 22, fat: 6, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Средний — нежирная свинина, богата тиамином (B1), цинком. Хорошая альтернатива курице.',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'B1 поддерживает нервную систему при курсе ААС', tier: 'mid' },
  { id: 'whey_protein', name: 'Протеин сывороточный (1 скуп)', category: 'protein', kcal: 120, protein: 24, fat: 1.5, carbs: 2, fiber: 0, gi: 15, servingSize: '30 г',
    description: 'Базовая добавка — быстрый аминокислотный пик через 30 мин. Leucine 2.5 г — триггер mTOR для синтеза мышц.',
    bestFor: ['bulk', 'cut', 'recomp', 'strength'], timing: 'after_train', pharmaNote: 'Усвоение ускоряется при приёме с углеводами', tier: 'basic' },
  { id: 'casein', name: 'Казеин', category: 'protein', kcal: 110, protein: 22, fat: 1, carbs: 3, fiber: 0, gi: 10, servingSize: '30 г',
    description: 'Медленный белок — аминокислотный поток 6-8 часов. Защита мышц ночью, анти-катаболизм.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'before_sleep', pharmaNote: 'Замедляет всасывание — избегать одновременно с препаратами, требующими быстрого действия', tier: 'mid' },

  { id: 'rice_white', name: 'Рис белый (вареный)', category: 'grain', kcal: 130, protein: 2.7, fat: 0.3, carbs: 28, fiber: 0.4, gi: 73, servingSize: '100 г',
    description: 'Базовый углевод — быстро усваивается, высокий GI. Идеален после тренировки для восстановления гликогена.',
    bestFor: ['bulk', 'strength'], timing: 'after_train', pharmaNote: 'Высокий GI — не рекомендуется при инсулинорезистентности и метформине', tier: 'basic' },
  { id: 'rice_brown', name: 'Рис бурый/дикий', category: 'grain', kcal: 112, protein: 2.6, fat: 0.9, carbs: 23, fiber: 1.8, gi: 50, servingSize: '100 г',
    description: 'Средний — ниже GI, больше клетчатки и микроэлементов (Mg, Zn, Se). Стабильная энергия.',
    bestFor: ['maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Mg в буром рисе — дополнительный источник при дефиците от кленбутерола', tier: 'mid' },
  { id: 'oats', name: 'Овсянка (на воде)', category: 'grain', kcal: 71, protein: 2.5, fat: 1.4, carbs: 12, fiber: 1.7, gi: 55, servingSize: '100 г',
    description: 'Базовый утренний углевод — β-глюкан снижает холестерин, стабилизирует сахар. Долгое насыщение.',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'morning', pharmaNote: 'β-глюкан синергичен с телмисартаном — снижение холестерина', tier: 'basic' },
  { id: 'buckwheat', name: 'Гречка (вареная)', category: 'grain', kcal: 110, protein: 4.2, fat: 1.1, carbs: 20, fiber: 2.7, gi: 45, servingSize: '100 г',
    description: 'Средний — супер-крупа. Рутин укрепляет сосуды, Mg 85 мг/100 г, железо, клетчатка. Низкий GI.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Mg + рутин компенсируют потери калия и магния от кленбутерола', tier: 'mid' },
  { id: 'quinoa', name: 'Киноа', category: 'grain', kcal: 120, protein: 4.4, fat: 1.9, carbs: 21, fiber: 2.8, gi: 53, servingSize: '100 г',
    description: 'Максимум — полный аминокислотный профиль (редкость для злаков), Fe, Mg, Mn. Суперфуд для набора.',
    bestFor: ['bulk', 'recomp'], timing: 'lunch', pharmaNote: 'Без глютена — подходит при гастрите от НПВС и пептидов BPC-157', tier: 'max' },
  { id: 'bread_rye', name: 'Хлеб ржаной', category: 'grain', kcal: 214, protein: 6.5, fat: 1.2, carbs: 43, fiber: 5.5, gi: 60, servingSize: '1 ломтик (35 г)',
    description: 'Базовый — клетчатка 5.5 г/100 г, ниже GI чем пшеничный. Поддержка кишечника.',
    bestFor: ['maintenance', 'bulk'], timing: 'any', pharmaNote: 'Клетчатка замедляет всасывание — разводить по времени с препаратами', tier: 'basic' },
  { id: 'pasta_durum', name: 'Макароны из твердых сортов', category: 'grain', kcal: 135, protein: 5, fat: 0.6, carbs: 27, fiber: 2.1, gi: 45, servingSize: '100 г',
    description: 'Средний — твердые сорта (durum) дают стабильный GI, медленную энергию. Добавка к основному рациону.',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Умеренный GI — подходит при приёме метформина', tier: 'mid' },
  { id: 'potato_boiled', name: 'Картофель отварной', category: 'carb', kcal: 82, protein: 2, fat: 0.1, carbs: 17, fiber: 1.5, gi: 65, servingSize: '1 шт (150 г)',
    description: 'Базовый — калий 420 мг/100 г (больше чем в банане!). Восстановление электролитов после тренировки.',
    bestFor: ['bulk', 'strength', 'maintenance'], timing: 'after_train', pharmaNote: 'Высокий калий — ОСТОРОЖНО при телмисартане (повышает K)', tier: 'basic' },
  { id: 'sweet_potato', name: 'Батат', category: 'carb', kcal: 86, protein: 1.6, fat: 0.1, carbs: 20, fiber: 3, gi: 44, servingSize: '100 г',
    description: 'Средний — низкий GI, β-каротин, витамин A. Лучше картофеля для сушки и стабильной энергии.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Низкий K в отличие от картофеля — безопасно с телмисартаном', tier: 'mid' },
  { id: 'banana', name: 'Банан', category: 'veg_fruit', kcal: 89, protein: 1.1, fat: 0.3, carbs: 23, fiber: 2.6, gi: 51, servingSize: '1 шт (118 г)',
    description: 'Базовый — быстрый углевод + калий 358 мг. Удобный перекус до/после тренировки.',
    bestFor: ['bulk', 'strength'], timing: 'after_train', pharmaNote: 'Калий — ОСТОРОЖНО при телмисартане', tier: 'basic' },
  { id: 'apple', name: 'Яблоко', category: 'veg_fruit', kcal: 52, protein: 0.3, fat: 0.2, carbs: 14, fiber: 2.4, gi: 36, servingSize: '1 шт (180 г)',
    description: 'Базовый — пектин (клетчатка), низкий GI, антиоксиданты. Поддержка ЖКТ и кишечника.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'any', pharmaNote: 'Пектин помогает при гастрите от НПВС (диклофенак, мелоксикам)', tier: 'basic' },
  { id: 'berries', name: 'Ягоды (микс)', category: 'veg_fruit', kcal: 40, protein: 0.6, fat: 0.2, carbs: 9, fiber: 2.4, gi: 25, servingSize: '100 г',
    description: 'Средний — антоцианы, витамин C, антиоксиданты. Анти-воспалительный продукт номер 1.',
    bestFor: ['cut', 'maintenance', 'rehab'], timing: 'morning', pharmaNote: 'Витамин C + антиоксиданты — синергия с NAC и BPC-157 для восстановления', tier: 'mid' },

  { id: 'olive_oil', name: 'Оливковое масло', category: 'fat', kcal: 884, protein: 0, fat: 100, carbs: 0, fiber: 0, gi: 0, servingSize: '1 ст.л. (14 г)',
    description: 'Базовый — олеиновая кислота (Омега-9), снижает LDL-холестерин и воспаление. Основа средиземноморской диеты.',
    bestFor: ['maintenance', 'cut', 'recomp', 'bulk'], timing: 'any', pharmaNote: 'Снижает ALT — защитный эффект для печени при ААС', tier: 'basic' },
  { id: 'avocado', name: 'Авокадо', category: 'fat', kcal: 160, protein: 2, fat: 15, carbs: 9, fiber: 7, gi: 10, servingSize: '1/2 шт (70 г)',
    description: 'Средний — мононенасыщенные жиры, клетчатка 7 г/100 г, калий 485 мг, витамин E. Суперфуд для суставов и сердца.',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Калий 485 мг — ОСТОРОЖНО при телмисартане', tier: 'mid' },
  { id: 'nuts_mix', name: 'Орехи (грецкие/миндаль)', category: 'fat', kcal: 654, protein: 20, fat: 60, carbs: 14, fiber: 7, gi: 15, servingSize: '30 г',
    description: 'Средний — Омега-3 ALA (грецкие), витамин E (миндаль), Mg 130 мг/30 г. Перекус с пользой.',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'any', pharmaNote: 'Mg в орехах компенсирует дефицит от кленбутерола', tier: 'mid' },
  { id: 'seeds', name: 'Семена льна/чиа', category: 'fat', kcal: 534, protein: 18, fat: 31, carbs: 29, fiber: 27, gi: 1, servingSize: '1 ст.л. (10 г)',
    description: 'Максимум — Омега-3 ALA, лигнаны (фитоэстрогены), клетчатка 27 г/100 г. Супер-добавка для ЖКТ и гормонов.',
    bestFor: ['cut', 'recomp', 'rehab'], timing: 'morning', pharmaNote: 'Лигнаны мягко модулируют эстроген — полезно при анастрозоле (не конкурирует)', tier: 'max' },
  { id: 'butter', name: 'Сливочное масло', category: 'fat', kcal: 717, protein: 0.9, fat: 81, carbs: 0.1, fiber: 0, gi: 0, servingSize: '10 г',
    description: 'Базовый — бутират (короткоцепочечные жиры), витамины A/D/E/K2. В умеренных количествах — польза для кишечника и гормонов.',
    bestFor: ['bulk', 'strength'], timing: 'morning', pharmaNote: 'Насыщенные жиры — холестерин → сырье для тестостерона (умеренно!)', tier: 'basic' },
  { id: 'fish_oil_food', name: 'Скумбрия/Сельдь (запеченная)', category: 'fat', kcal: 262, protein: 17, fat: 20, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Максимум — Омега-3 EPA/DHA 2.5-3 г, витамин D 1000 IU, CoQ10. Главный пищевой источник Омега-3.',
    bestFor: ['bulk', 'recomp', 'rehab'], timing: 'lunch', pharmaNote: 'Омега-3 + CoQ10 = синергия при статинах и анастрозоле', tier: 'max' },

  { id: 'cottage_cheese_5', name: 'Творог 5%', category: 'dairy', kcal: 121, protein: 18, fat: 5, carbs: 2, fiber: 0, gi: 30, servingSize: '100 г',
    description: 'Базовый — казеин 80%, медленный белок. Идеален на ночь для антикатаболизма. Кальций 120 мг.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'before_sleep', pharmaNote: 'Казеин на ночь — синергия с казеиновым протеином для защиты мышц', tier: 'basic' },
  { id: 'kefir', name: 'Кефир 1%', category: 'dairy', kcal: 40, protein: 3, fat: 1, carbs: 4, fiber: 0, gi: 15, servingSize: '200 мл',
    description: 'Базовый — пробиотики, Ca, белок. Поддержка микрофлоры кишечника, улучшение пищеварения.',
    bestFor: ['cut', 'maintenance'], timing: 'morning', pharmaNote: 'Пробиотики синергичны с пребиотиками (клетчатка) — улучшают усвоение добавок', tier: 'basic' },
  { id: 'yogurt_greek', name: 'Греческий йогурт 2%', category: 'dairy', kcal: 60, protein: 10, fat: 2, carbs: 3.6, fiber: 0, gi: 25, servingSize: '150 г',
    description: 'Средний — концентрированный белок, пробиотики. Лучше обычного йогурта по белку в 2-3 раза.',
    bestFor: ['cut', 'recomp', 'maintenance'], timing: 'any', pharmaNote: 'Ca + пробиотики — поддержка при длительном курсе ААС', tier: 'mid' },
  { id: 'milk', name: 'Молоко 2.5%', category: 'dairy', kcal: 52, protein: 2.8, fat: 2.5, carbs: 4.7, fiber: 0, gi: 30, servingSize: '200 мл',
    description: 'Базовый — Ca 240 мг/стакан, витамин D (если обогащён), белок. Классический масс-гейнер.',
    bestFor: ['bulk', 'strength'], timing: 'morning', pharmaNote: 'Высокий инсулиновый отклик — не подходит при метформине/инсулинорезистентности', tier: 'basic' },
  { id: 'cheese_hard', name: 'Сыр твердый (Российский)', category: 'dairy', kcal: 350, protein: 24, fat: 27, carbs: 0.3, fiber: 0, gi: 0, servingSize: '30 г',
    description: 'Средний — концентрированный Ca 720 мг/100 г, белок, витамин K2 (если из травяного молока).',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Высокий Na и насыщ. жиры — ограничить при гипертонии (телмисартан)', tier: 'mid' },

  { id: 'broccoli', name: 'Брокколи (отварная)', category: 'veg_fruit', kcal: 35, protein: 2.4, fat: 0.4, carbs: 7, fiber: 3.3, gi: 15, servingSize: '100 г',
    description: 'Базовый — сульфорафан (анти-рак), индол-3-карбинол (эстроген-метаболизм), витамин C 90 мг, Ca 47 мг.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'any', pharmaNote: 'Индол-3-карбинол поддерживает метаболизм эстрогена — синергия с анастрозолом', tier: 'basic' },
  { id: 'spinach', name: 'Шпинат', category: 'veg_fruit', kcal: 23, protein: 2.9, fat: 0.4, carbs: 3.6, fiber: 2.2, gi: 15, servingSize: '100 г',
    description: 'Средний — Fe 2.7 мг, Mg 79 мг, K 558 мг, фолат 194 мкг. Супер-зелень для кроветворения.',
    bestFor: ['cut', 'recomp'], timing: 'lunch', pharmaNote: 'Fe + фолат — компенсация B12/фолатного дефицита от метформина', tier: 'mid' },
  { id: 'cucumber', name: 'Огурец', category: 'veg_fruit', kcal: 15, protein: 0.7, fat: 0.1, carbs: 2.9, fiber: 0.5, gi: 10, servingSize: '1 шт (150 г)',
    description: 'Базовый — вода 95%, минимум калорий. Наполнение желудка, гидратация. Для сушки идеален.',
    bestFor: ['cut'], timing: 'any', pharmaNote: 'Нет фармако-конфликтов', tier: 'basic' },
  { id: 'tomato', name: 'Помидор', category: 'veg_fruit', kcal: 18, protein: 0.9, fat: 0.2, carbs: 3.9, fiber: 1.2, gi: 10, servingSize: '1 шт (120 г)',
    description: 'Базовый — ликопин (антиоксидант), витамин C 14 мг, K 237 мг. Поддержка простаты.',
    bestFor: ['maintenance', 'cut'], timing: 'any', pharmaNote: 'Ликопин — синергия с пальметто для защиты простаты', tier: 'basic' },
  { id: 'pepper', name: 'Болгарский перец', category: 'veg_fruit', kcal: 27, protein: 1.3, fat: 0, carbs: 5.3, fiber: 2.1, gi: 15, servingSize: '1 шт (150 г)',
    description: 'Средний — витамин C 128 мг (больше цитрусовых!), β-каротин. Антиоксидантная защита.',
    bestFor: ['cut', 'maintenance'], timing: 'any', pharmaNote: 'Витамин C — синергия с NAC для антиоксидантной защиты печени', tier: 'mid' },

  { id: 'shawarma', name: 'Шаурма средняя', category: 'fast_food', kcal: 550, protein: 25, fat: 22, carbs: 58, fiber: 2, gi: 65, servingSize: '1 шт (350 г)',
    description: 'Фастфуд — если нет выбора, выбирайте без соуса. Белок есть, но Na и трансжиры высокие.',
    bestFor: [], timing: 'lunch', pharmaNote: 'Трансжиры усиливают воспаление — избегать при курсе ААС', tier: 'basic' },
  { id: 'pizza_margherita', name: 'Пицца Маргарита', category: 'fast_food', kcal: 240, protein: 9, fat: 8, carbs: 32, fiber: 2, gi: 70, servingSize: '1 кусок (120 г)',
    description: 'Фастфуд — рафинированная мука, высокий GI. Лишний раз — не стоит.',
    bestFor: [], timing: 'lunch', pharmaNote: 'Высокий GI + Na — усугубляет задержку воды на курсе', tier: 'basic' },
  { id: 'burger', name: 'Бургер классический', category: 'fast_food', kcal: 480, protein: 22, fat: 24, carbs: 42, fiber: 1.5, gi: 68, servingSize: '1 шт (250 г)',
    description: 'Фастфуд — белок есть, но трансжиры, Na, высокий GI. Резервный вариант.',
    bestFor: [], timing: 'lunch', pharmaNote: 'Na + трансжиры — усугубляют гипертонию и дислипидемию', tier: 'basic' },

  { id: 'creatine', name: 'Креатин моногидрат', category: 'supplement', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '5 г',
    description: 'Базовая добавка — +10-15% сила, +1-2 кг масса. Насыщает фосфокреатин, ускоряет АТФ-ресинтез.',
    bestFor: ['bulk', 'strength', 'maintenance'], timing: 'after_train', pharmaNote: 'Удерживает воду в мышцах — не влияет на почки при нормальной дозе 5 г', tier: 'basic' },
  { id: 'bcaa', name: 'BCAA 2:1:1', category: 'supplement', kcal: 20, protein: 5, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '10 г',
    description: 'Средний — лейцин (mTOR), изолейцин, валин. При достаточном белке из еды — опционально.',
    bestFor: ['cut', 'recomp'], timing: 'after_train', pharmaNote: 'При достаточном белке рационе — дублирование', tier: 'mid' },
  { id: 'glutamine', name: 'Глютамин', category: 'supplement', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '5 г',
    description: 'Средний — поддержка кишечника (энтероциты), иммунитет. При стрессе/курсе — полезен.',
    bestFor: ['rehab', 'maintenance'], timing: 'any', pharmaNote: 'Поддержка ЖКТ — синергия с BPC-157 и пробиотиками', tier: 'mid' },
  { id: 'vitamin_complex', name: 'Мультивитамин', category: 'supplement', kcal: 5, protein: 0, fat: 0, carbs: 1, fiber: 0, gi: 0, servingSize: '1 табл',
    description: 'Базовый — страховка от дефицитов. Не заменяет разнообразное питание.',
    bestFor: ['maintenance', 'bulk', 'cut', 'recomp'], timing: 'morning', pharmaNote: 'Принимать с едой — усвоение жироворастворимых (A/D/E/K)', tier: 'basic' },
  { id: 'fish_oil', name: 'Рыбий жир (Омега-3)', category: 'supplement', kcal: 90, protein: 0, fat: 10, carbs: 0, fiber: 0, gi: 0, servingSize: '1 капсула (1 г)',
    description: 'Базовая добавка — EPA/DHA 300 мг/капс. Сердце, суставы, мозг, анти-воспаление. 2-4 капс/день.',
    bestFor: ['maintenance', 'bulk', 'cut', 'recomp', 'rehab'], timing: 'any', pharmaNote: 'Синергия с анастрозолом (суставы) и статинами (CoQ10-дефицит)', tier: 'basic' },
];

const RATION_TIERS: Record<string, { basic: string[]; mid: string[]; max: string[] }> = {
  protein: { basic: [' chicken_breast', 'egg_whole', 'egg_white', 'whey_protein'], mid: ['turkey_breast', 'tuna_canned', 'pork_tenderloin', 'casein'], max: ['beef_lean', 'salmon'] },
  carb: { basic: ['rice_white', 'oats', 'potato_boiled', 'banana'], mid: ['rice_brown', 'buckwheat', 'pasta_durum', 'sweet_potato'], max: ['quinoa', 'berries'] },
  fat: { basic: ['olive_oil', 'butter'], mid: ['avocado', 'nuts_mix', 'yogurt_greek'], max: ['seeds', 'fish_oil_food'] },
  dairy: { basic: ['cottage_cheese_5', 'kefir', 'milk'], mid: ['cheese_hard', 'yogurt_greek'], max: [] },
  veg_fruit: { basic: ['broccoli', 'cucumber', 'tomato', 'apple'], mid: ['spinach', 'pepper', 'berries', 'sweet_potato'], max: [] },
  supplement: { basic: ['creatine', 'fish_oil', 'vitamin_complex'], mid: ['bcaa', 'glutamine', 'casein'], max: [] },
};

export function searchFood(query: string): FoodItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return FOOD_DB.filter(f =>
    f.name.toLowerCase().includes(q) ||
    f.category.includes(q)
  ).slice(0, 12);
}

export function getFoodById(id: string): FoodItem | undefined {
  return FOOD_DB.find(f => f.id === id);
}

export function getFoodByCategory(cat: FoodItem['category']): FoodItem[] {
  return FOOD_DB.filter(f => f.category === cat);
}

export function getFoodsByTier(cat: string, tier: 'basic' | 'mid' | 'max'): FoodItem[] {
  const ids = RATION_TIERS[cat]?.[tier] || [];
  return ids.map(id => FOOD_DB.find(f => f.id === id.trim())).filter((f): f is FoodItem => !!f);
}

export function getTopByProtein(limit: number): FoodItem[] {
  return [...FOOD_DB]
    .filter(f => f.protein > 5 && f.category !== 'supplement')
    .sort((a, b) => (b.protein / Math.max(b.kcal, 1)) - (a.protein / Math.max(a.kcal, 1)))
    .slice(0, limit);
}

export function getTopByCarbs(limit: number): FoodItem[] {
  return [...FOOD_DB]
    .filter(f => f.carbs > 5 && f.gi <= 70 && f.category !== 'supplement')
    .sort((a, b) => b.carbs - a.carbs)
    .slice(0, limit);
}

export function getTopByFat(limit: number): FoodItem[] {
  return [...FOOD_DB]
    .filter(f => f.fat > 5 && f.category !== 'supplement')
    .sort((a, b) => (b.fat / Math.max(b.kcal, 1)) - (a.fat / Math.max(a.kcal, 1)))
    .slice(0, limit);
}

export { RATION_TIERS };