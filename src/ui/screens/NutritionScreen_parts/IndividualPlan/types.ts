// --- Types & Constants ---
// ─── Types ───
export type GoalId = 'mass' | 'strength' | 'fat_loss' | 'cutting' | 'post_cut' | 'maintenance' | 'recomposition' | 'rehab' | 'health';
export type PhaseId = 'course' | 'bridge' | 'pct' | 'recovery' | 'cutting' | 'maintenance' | 'recomp' | 'fat_loss' | 'post_cut';
export type BudgetLevel = 'low' | 'medium' | 'max' | 'enhanced';
export type NutritionLevel = 'base' | 'medium' | 'enhanced' | 'max';
export type PlanType = 'classic' | 'keto' | 'highcarb' | 'mediterranean' | 'vegetarian';
export type CycleType = 'none' | 'macro' | 'butch' | 'cheatmeal' | 'carbload';
export type PlannerMode = 'pro' | 'simple' | 'minimal';

export interface DrugInjection { id: string; name: string; time: string; dose: number; unit: string; type: string; esterType: 'rapid' | 'short' | 'long' | 'none'; halfLifeHours: number; trainLinked: boolean; trainTiming: 'before' | 'after' | 'both' | 'none'; }
export interface MealPrepStep { step: number; action: string; duration: number; items: string[]; items_standby?: boolean; items_parallel?: boolean; items_can_boil_simultaneously?: boolean; }
export interface SavedPlan { id: number; date: string; name?: string; dayPlan: any; threeDayPlan: any; weekPlan: any; shoppingList: any; waterCalc: any; }

export const GOALS: { id: GoalId; label: string; icon: string; desc: string }[] = [
  { id: 'mass', label: 'Массонабор', icon: '💪', desc: 'Профицит калорий, рост мышц' },
  { id: 'strength', label: 'Сила', icon: '🏋️', desc: 'Силовые показатели, CNS recovery' },
  { id: 'fat_loss', label: 'Похудение', icon: '🔥', desc: 'Дефицит калорий, жиросжигание' },
  { id: 'cutting', label: 'Сушка', icon: '✂️', desc: 'Агрессивный дефицит, рельеф' },
  { id: 'post_cut', label: 'Выход из сушки', icon: '📈', desc: 'Плавный выход, обратная метаболическая' },
  { id: 'maintenance', label: 'Поддержка', icon: '⚖️', desc: 'Баланс, сохранение формы' },
  { id: 'recomposition', label: 'Рекомпозиция', icon: '🔄', desc: 'Одновременный рост + жиросжигание' },
  { id: 'rehab', label: 'Реабилитация', icon: '🩹', desc: 'Восстановление после травм/болезни' },
  { id: 'health', label: 'Здоровье', icon: '🩸', desc: 'Сосуды/вязкость/почки: 1.8г/кг · 30г клетчатки · PRAL±5' },
];

// ─── Эпик 2 (NUTRITION-PROFESSIONAL-PLAN): фаза = ФАРМА-контекст, а не цель.
// Прежние дубли-цели (cutting/maintenance/recomp/fat_loss/post_cut) удалены —
// направление калорий задаёт goal (карточка «Цель»). Фаза только уточняет
// фарма-гейты (курс/ПКТ/мост/восстановление). PhaseId сохранён широким для
// обратной совместимости старых сохранений.
export const PHASES: { id: PhaseId; label: string; icon: string; desc: string }[] = [
  { id: 'course', label: 'Курс', icon: '💉', desc: 'Активная фаза с фармакологической поддержкой' },
  { id: 'bridge', label: 'Мост', icon: '🌉', desc: 'Переход между курсами, низкие дозировки' },
  { id: 'pct', label: 'ПКТ', icon: '🔄', desc: 'Послекурсовая терапия, восстановление оси ГГЯ' },
  { id: 'recovery', label: 'Восстановление', icon: '🩹', desc: 'Повышенный белок, витамины, отдых' },
];

export const BUDGET_LEVELS: { id: BudgetLevel; label: string; icon: string; desc: string; color: string }[] = [
  { id: 'low', label: 'Низкий', icon: '🟢', desc: 'Бюджетные продукты, базовый набор', color: '#22c55e' },
  { id: 'medium', label: 'Средний', icon: '🟡', desc: 'Качество + цена, фермерские аналоги', color: '#f59e0b' },
  { id: 'max', label: 'Максимум', icon: '🟠', desc: 'Премиум продукты, органика', color: '#f97316' },
  { id: 'enhanced', label: 'Усиленный', icon: '🔴', desc: 'Элитные продукты, спецсорта', color: '#ef4444' },
];

export const NUTRITION_LEVELS: { id: NutritionLevel; label: string; icon: string; mult: number; desc: string }[] = [
  { id: 'base', label: 'База', icon: '🟢', mult: 1.0, desc: '0%' },
  { id: 'medium', label: '+15%', icon: '🟡', mult: 1.15, desc: 'Средний' },
  { id: 'enhanced', label: '+30%', icon: '🟠', mult: 1.3, desc: 'Усиленный' },
  { id: 'max', label: '+50%', icon: '🔴', mult: 1.5, desc: 'Максимум' },
];

// v6: nutrLevel → пресет белка (1.6–2.6 г/кг). Те же id, новая семантика — только белок,
// жиры фиксируются на физиологическом поле 0.8 г/кг, угли — остаток в диетпотолке.
// NUTRITION_LEVELS оставлен как алиас-совместимость для старых импортов/тестов.
export const PROTEIN_PRESETS: { id: NutritionLevel; label: string; icon: string; gPerKg: number; desc: string }[] = [
  { id: 'base', label: 'База', icon: '🟢', gPerKg: 1.6, desc: '1.6 г/кг' },
  { id: 'medium', label: 'Стандарт', icon: '🟡', gPerKg: 2.0, desc: '2.0 г/кг' },
  { id: 'enhanced', label: 'Актив', icon: '🟠', gPerKg: 2.2, desc: '2.2 г/кг' },
  { id: 'max', label: 'Макс', icon: '🔴', gPerKg: 2.6, desc: '2.6 г/кг' },
];

// ─── v6: Единая периодизация углеводов (cyclingMode+dietPause+periodizationEnabled → одно) ──
export type CarbPeriodization = 'none' | 'refeed' | 'carb_cycle' | 'butch' | 'flex_80_20' | 'two_one' | 'five_two' | 'wave';
export const CARB_PERIODIZATION_OPTIONS: { id: CarbPeriodization; label: string; icon: string; desc: string }[] = [
  { id: 'none', label: 'Без периодизации', icon: '⏹️', desc: 'Ровные КБЖУ каждый день' },
  { id: 'refeed', label: 'Рефид 1×/нед', icon: '🍝', desc: '1 день/нед углеводы ×2.2 (лептин/гликоген)' },
  { id: 'carb_cycle', label: 'Угл. цикл', icon: '🔄', desc: 'Трен: +15% ккал/+30% угл, отдых: −15%/−30%' },
  { id: 'butch', label: 'БУЧ', icon: '⤴️⤵️', desc: '3 дня ВУ (трен) + 1 день НУ (отдых)' },
  { id: 'flex_80_20', label: '80/20', icon: '📊', desc: '80% цельные, 20% свободные (+5% ккал)' },
  { id: 'two_one', label: '2+1', icon: '⏳', desc: '2 нед дефицит → 1 нед поддержание' },
  { id: 'five_two', label: '5:2', icon: '📅', desc: '5 дней план → 2 дня лайт (80% ккал)' },
  { id: 'wave', label: 'Волна 2+1', icon: '🌊', desc: 'Недельная волна: 2 нед работа + 1 нед поддержание' },
];

// ─── v6: Единое разнообразие (variety + varietyStrictness → один) ──
export type VarietyLevel = 'low' | 'medium' | 'high';
export const VARIETY_LEVELS: { id: VarietyLevel; label: string; icon: string; desc: string; color: string }[] = [
  { id: 'low', label: 'Базовое', icon: '🎯', desc: '5 продуктов/кат, строго без повторов 1–2 дня', color: '#22c55e' },
  { id: 'medium', label: 'Среднее', icon: '⚖️', desc: '10 продуктов/кат, мягкая ротация', color: '#f59e0b' },
  { id: 'high', label: 'Максимум', icon: '🎪', desc: '20 продуктов/кат, строгое разнообразие', color: '#8b5cf6' },
];

export const PLAN_TYPES: { id: PlanType; label: string; icon: string; desc: string; pMult?: number; fMult?: number; cMult?: number }[] = [
  { id: 'classic', label: 'Классический', icon: '🥩', desc: 'Сбалансированное питание' },
  { id: 'keto', label: 'Кето', icon: '🥑', desc: 'Низкоуглеводный, высокожировой', cMult: 0.1, fMult: 2.5 },
  { id: 'highcarb', label: 'Высоко-углеводный', icon: '🍚', desc: '60% углеводов', cMult: 1.35, pMult: 0.85 },
  { id: 'mediterranean', label: 'Средиземноморский', icon: '⚖️', desc: 'Рыба, оливки, овощи', fMult: 1.3, cMult: 0.85 },
  { id: 'vegetarian', label: 'Вегетарианский', icon: '🌱', desc: 'Растительный белок', pMult: 0.8, fMult: 1.2 },
];

export const ALLERGEN_LIST = [
  { id: 'лактоза', label: 'Лактоза', icon: '🥛' },
  { id: 'глютен', label: 'Глютен', icon: '🌾' },
  { id: 'орехи', label: 'Орехи (грецкие/миндаль/кешью)', icon: '🥜' },
  { id: 'арахис', label: 'Арахис', icon: '🥜' },
  { id: 'яйца', label: 'Яйца', icon: '🥚' },
  { id: 'соя', label: 'Соя/тофу', icon: '🫘' },
  { id: 'рыба', label: 'Рыба', icon: '🐟' },
  { id: 'морепродукты', label: 'Морепродукты (креветки/крабы)', icon: '🦐' },
  { id: 'молочные', label: 'Молочные продукты (казеин/сыворотка)', icon: '🧀' },
  { id: 'кунжут', label: 'Кунжут/тахини', icon: '🌰' },
  { id: 'сельдерей', label: 'Сельдерей', icon: '🥬' },
  { id: 'горчица', label: 'Горчица', icon: '🫙' },
  { id: 'сульфиты', label: 'Сульфиты (вино/сухофрукты)', icon: '🍷' },
  { id: 'люпин', label: 'Люпин (мука/белок)', icon: '🌱' },
];

export const HEALTH_ISSUES = [
  { id: 'oedema', label: 'Отёки', icon: '🫧', desc: 'Задержка жидкости, склонность к отёкам', foodIds: ['salt','soy_sauce','kfc_wings','kfc_soup','kfc_bucket','bk_whopper','mcd_big_mac','mcd_royale','vt_big_smoke','french_fries','bread_white','pizza_margherita','sausage'] },
  { id: 'lactose_intolerance', label: 'Непереносимость лактозы', icon: '🥛', desc: 'Вздутие, дискомфорт от молочных продуктов', foodIds: ['milk','cheese','yogurt','kefir','cheese_cream','sour_cream','condensed_milk','ice_cream','cottage_cheese_5','cottage_cheese_2','cottage_cheese_0','yogurt_greek','ricotta','mozzarella','parmesan','feta'] },
  { id: 'gluten_intolerance', label: 'Непереносимость глютена', icon: '🌾', desc: 'Реакция на пшеницу, рожь, ячмень', foodIds: ['bread_white','bread_rye','pasta','mantua','bread_protein','pancakes','pita','lavash','muesli','oats_instant','pelmeni','pizza_margherita','chebureki','pyanse','ramen_egg','falafel_pita','greek_gyros','tortilla_corn','cornmeal','rice_cakes'] },
  { id: 'diabetes', label: 'Диабет / Преддиабет', icon: '💉', desc: 'Контроль гликемии, низкий GI', foodIds: ['sugar','honey','syrup','bread_white','rice_white','rice_cakes','pasta','potato_mashed','potato_baked','french_fries','pancakes','pizza_margherita','ice_cream','watermelon','dates','banana','coca_cola','juice_apple','juice_orange','muesli','chocolate','cookie','marmalade'] },
  { id: 'hypertension', label: 'Гипертония', icon: '❤️', desc: 'Повышенное давление, ограничение натрия', foodIds: ['salt','soy_sauce','kfc_wings','kfc_bucket','bk_whopper','mcd_big_mac','mcd_royale','vt_big_smoke','french_fries','sausage','bacon','ham','ketchup','mayonnaise','chips','pickles','olives','suluguni','cheese_processed','bouillon_cube'] },
  { id: 'gi_issues', label: 'Проблемы с ЖКТ', icon: '🫀', desc: 'Гастрит, вздутие, синдром раздражённого кишечника', foodIds: ['cabbage','broccoli','cauliflower','brussels_sprouts','beans','lentils','chickpeas','peas','cornmeal','pancakes','pizza_margherita','french_fries','fried_rice_egg','chicken_curry_rice','soda','chebureki','pyanse','khachapuri','shaurma','mayonnaise','ketchup','cream_sauce','milk','ice_cream','onion_raw'] },
  { id: 'gout', label: 'Подагра', icon: '🦶', desc: 'Повышенная мочевая кислота, низкие пурины', foodIds: ['liver','kidneys','sardines','anchovies','mussels','beef_liver','chicken_liver','pork_liver','beef_kidney','green_peas','spinach','mushrooms','cauliflower','broccoli','asparagus','beer','red_meat','bacon','ham','sausage','tuna_canned','sprats','broth_bone'] },
  { id: 'kidney_stones', label: 'Камни в почках', icon: '🫘', desc: 'Оксалаты, ограничение кальция/оксалатов', foodIds: ['spinach','rhubarb','beetroot','nuts','almonds','walnuts','cashews','peanuts','chocolate','sweet_potato','okra','swiss_chard','parsley','poppy_seeds','sesame','soy_flour','buckwheat','millet','bran','berries'] },
];
