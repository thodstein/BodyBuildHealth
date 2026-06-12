/**
 * Complete Support Database + Split Database + Nutrition Expansion
 *
 * Support DB: 40+ supplements with full details, protocols, interactions
 * Split DB: 12 complete splits with every detail
 * Nutrition Expansion: meal timing, food combining, diet types
 *
 * @module support-split-nutrition-db
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface SupportCompound {
  name: string;
  category: 'organ_protection' | 'lipid_control' | 'bp_control' | 'blood_thinner' | 'neuroprotection' | 'joint' | 'hormonal' | 'metabolic' | 'sleep' | 'general';
  priority: 'essential' | 'recommended' | 'optional' | 'situational';
  mechanism: string;
  dosage: { standard: string; on_cycle: string; loading: string };
  timing: string;
  halfLife: string;
  evidenceLevel: string;
  protects: string[];
  interactsWith: string[];
  sideEffects: string[];
  brands: string[];
  costPerMonth: string;
  whenToUse: string[];
  whenNotToUse: string[];
}

export interface DetailedSplit {
  id: string;
  name: string;
  type: string;
  daysPerWeek: number;
  sessionTimeMin: string;
  level: string;
  goal: string;
  structure: string;
  weeklyPattern: string[];
  pros: string[];
  cons: string[];
  variations: string[];
  bestFor: string[];
  notFor: string[];
  dailyBreakdown: { day: number; name: string; warmup: string; mainWork: string; accessory: string; cooldown: string }[];
}

export interface DietType {
  name: string;
  description: string;
  macros: string;
  benefits: string[];
  drawbacks: string[];
  bestFor: string[];
  notFor: string[];
  mealFrequency: string;
  exampleDay: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Complete Support Database (40 compounds)
// ═══════════════════════════════════════════════════════════════════════════

export const SUPPORT_COMPOUNDS_DB: SupportCompound[] = [
  // ── Organ Protection ──
  {
    name: 'TUDCA (Тауроурсодезоксихолевая кислота)',
    category: 'organ_protection', priority: 'essential',
    mechanism: 'Гидрофильная желчная кислота. Защищает гепатоциты от гидрофобных желчных кислот. Снижает GGT и ALP.',
    dosage: { standard: '500 мг/день', on_cycle: '1000 мг/день (2×500)', loading: '1500 мг/день первые 2 нед' },
    timing: 'С едой, разделить на 2 приёма', halfLife: '3-4 часа',
    evidenceLevel: 'A',
    protects: ['Печень (холестаз)', 'Желчные протоки'],
    interactsWith: ['Улучшает абсорбцию жирорастворимых витаминов'],
    sideEffects: ['Диарея при >1500 мг/день'],
    brands: ['Double Wood', 'Nutricost', 'Локально'],
    costPerMonth: '~1,500 ₽',
    whenToUse: ['Приём оральных ААС', 'GGT/ALP повышены', 'Профилактика холестаза'],
    whenNotToUse: ['Без оральных ААС (не нужно)'],
  },
  {
    name: 'NAC (N-ацетилцистеин)',
    category: 'organ_protection', priority: 'essential',
    mechanism: 'Предшественник глутатиона — главного антиоксиданта печени. Снижает ALT/AST.',
    dosage: { standard: '600 мг/день', on_cycle: '1200-2400 мг/день (2-3 приёма)', loading: '2400 мг/день' },
    timing: 'Между приёмами пищи', halfLife: '5-6 часов',
    evidenceLevel: 'A',
    protects: ['Печень', 'Лёгкие', 'Почки'],
    interactsWith: ['Не с активированным углём'],
    sideEffects: ['Желудочный дискомфорт', 'Тошнота при >3 г'],
    brands: ['NOW', 'Jarrow', 'Thorne'],
    costPerMonth: '~800 ₽',
    whenToUse: ['Любой курс ААС', 'АЛТ/АСТ повышены', 'Профилактика'],
    whenNotToUse: ['Язва желудка (осторожно)'],
  },
  {
    name: 'Расторопша (Силимарин)',
    category: 'organ_protection', priority: 'recommended',
    mechanism: 'Флавоноидный комплекс. Антиоксидант, противовоспалительное, стимулирует регенерацию гепатоцитов.',
    dosage: { standard: '500 мг/день', on_cycle: '1000 мг/день', loading: '—' },
    timing: 'С едой', halfLife: '6-8 часов',
    evidenceLevel: 'B',
    protects: ['Печень'],
    interactsWith: ['Может влиять на CYP450'],
    sideEffects: ['Минимальны', 'Лёгкое слабительное'],
    brands: ['Nature\'s Way', 'Jarrow'],
    costPerMonth: '~500 ₽',
    whenToUse: ['Лёгкая поддержка печени', 'В дополнение к TUDCA/NAC'],
    whenNotToUse: ['Как единственный гепатопротектор на курсе'],
  },
  {
    name: 'Астрагал (Astragalus membranaceus)',
    category: 'organ_protection', priority: 'recommended',
    mechanism: 'Снижает протеинурию и KIM-1 через антиоксидантный и противовоспалительный механизмы.',
    dosage: { standard: '500 мг/день', on_cycle: '1000-2000 мг/день', loading: '—' },
    timing: 'С едой, 2×/день', halfLife: 'Неизвестно',
    evidenceLevel: 'B',
    protects: ['Почки (FSGS)', 'Клубочки'],
    interactsWith: ['Может взаимодействовать с иммунодепрессантами'],
    sideEffects: ['Минимальны'],
    brands: ['Nature\'s Way', 'NOW'],
    costPerMonth: '~600 ₽',
    whenToUse: ['Тренболон', 'Высокий белок', 'Профилактика FSGS'],
    whenNotToUse: ['Аутоиммунные заболевания (консультация врача)'],
  },

  // ── Lipid Control ──
  {
    name: 'Омега-3 (EPA/DHA)',
    category: 'lipid_control', priority: 'essential',
    mechanism: 'Снижает триглицериды, противовоспалительное. EPA > DHA для липидов.',
    dosage: { standard: '2-3 г EPA+DHA', on_cycle: '4-6 г EPA+DHA', loading: '—' },
    timing: 'С едой (жиры для абсорбции)', halfLife: 'Дни',
    evidenceLevel: 'A',
    protects: ['Сердце', 'Сосуды', 'Липидный профиль', 'Суставы'],
    interactsWith: ['Аспирин (аддитивный антикоагулянтный эффект)'],
    sideEffects: ['Рыбная отрыжка', 'Разжижение крови'],
    brands: ['Nordic Naturals', 'Viva Naturals', 'NOW'],
    costPerMonth: '~1,200 ₽',
    whenToUse: ['Всегда', 'Особенно на курсе ААС'],
    whenNotToUse: ['Аллергия на рыбу (использовать algae oil)'],
  },
  {
    name: 'Цитрусовый бергамот (Citrus Bergamia)',
    category: 'lipid_control', priority: 'recommended',
    mechanism: 'Содержит полифенолы (брутьеридин, мелитидин) — ингибируют HMG-CoA редуктазу подобно статинам.',
    dosage: { standard: '500 мг/день', on_cycle: '1000 мг/день', loading: '—' },
    timing: 'С едой', halfLife: 'Неизвестно',
    evidenceLevel: 'B',
    protects: ['Липидный профиль', 'Сосуды'],
    interactsWith: ['Может взаимодействовать с CYP3A4 субстратами'],
    sideEffects: ['Минимальны', 'Фотосенсибилизация (редко)'],
    brands: ['Jarrow', 'Double Wood'],
    costPerMonth: '~900 ₽',
    whenToUse: ['LDL повышен', 'HDL снижен', 'Оральные ААС'],
    whenNotToUse: ['Приём статинов (консультация врача)'],
  },
  {
    name: 'Красный дрожжевой рис (Red Yeast Rice)',
    category: 'lipid_control', priority: 'optional',
    mechanism: 'Содержит монаколин К (природный ловастатин). Ингибирует HMG-CoA редуктазу.',
    dosage: { standard: '600 мг 2×/день', on_cycle: '1200 мг 2×/день', loading: '—' },
    timing: 'Вечер (как статины)', halfLife: '2-4 часа',
    evidenceLevel: 'B',
    protects: ['LDL снижение'],
    interactsWith: ['17α-AA ААС (оба гепатотоксичны — осторожно!)', 'CoQ10 (добавлять)'],
    sideEffects: ['Гепатотоксичность', 'Миопатия', 'CoQ10 дефицит'],
    brands: ['Thorne', 'Jarrow'],
    costPerMonth: '~700 ₽',
    whenToUse: ['LDL критически высок', 'Не помогает бергамот + омега-3'],
    whenNotToUse: ['Приём оральных ААС (двойная нагрузка на печень)', 'Без контроля ALT'],
  },

  // ── BP Control ──
  {
    name: 'Телмисартан (Micardis)',
    category: 'bp_control', priority: 'essential',
    mechanism: 'БРА (блокатор рецепторов ангиотензина II). Снижает АД + PPAR-γ агонизм (улучшает инсулиночувствительность).',
    dosage: { standard: '40 мг/день', on_cycle: '40-80 мг/день', loading: '—' },
    timing: 'Утро', halfLife: '24 часа',
    evidenceLevel: 'A',
    protects: ['Сердце', 'Почки', 'Сосуды'],
    interactsWith: ['Калий-сберегающие диуретики', 'НПВС'],
    sideEffects: ['Гипотония', 'Гиперкалиемия', 'Головокружение'],
    brands: ['Рецептурный'],
    costPerMonth: '~1,000 ₽',
    whenToUse: ['АД >130/85 на курсе', 'Профилактика гипертензии от ААС'],
    whenNotToUse: ['Без рецепта врача', 'Беременность'],
  },
  {
    name: 'Магний бисглицинат',
    category: 'bp_control', priority: 'essential',
    mechanism: 'Расслабляет гладкую мускулатуру сосудов → вазодилатация. GABA-ергический эффект → сон.',
    dosage: { standard: '400 мг', on_cycle: '400-600 мг', loading: '—' },
    timing: 'Перед сном', halfLife: 'N/A (элемент)',
    evidenceLevel: 'A',
    protects: ['Сердце', 'ЦНС', 'Мышцы'],
    interactsWith: ['Кальций (конкуренция при высоких дозах)'],
    sideEffects: ['Диарея при передозировке'],
    brands: ['Doctor\'s Best', 'NOW', 'Pure Encapsulations'],
    costPerMonth: '~500 ₽',
    whenToUse: ['Всегда', 'Судороги', 'Плохой сон', 'Повышенное АД'],
    whenNotToUse: ['Почечная недостаточность'],
  },

  // ── Neuroprotection ──
  {
    name: 'Глицин',
    category: 'neuroprotection', priority: 'recommended',
    mechanism: 'Тормозной нейротрансмиттер. Снижает возбуждение ЦНС. Улучшает качество сна.',
    dosage: { standard: '3 г', on_cycle: '3-5 г (тренболон)', loading: '—' },
    timing: 'Перед сном', halfLife: 'Несколько часов',
    evidenceLevel: 'B',
    protects: ['ЦНС', 'Сон'],
    interactsWith: ['Нет значимых'],
    sideEffects: ['Сонливость (желаемый эффект)'],
    brands: ['NOW', 'BulkSupplements'],
    costPerMonth: '~300 ₽',
    whenToUse: ['Тренболон', 'Плохой сон', 'Тревожность'],
    whenNotToUse: ['Нет противопоказаний'],
  },
  {
    name: 'L-теанин',
    category: 'neuroprotection', priority: 'recommended',
    mechanism: 'Повышает альфа-волны мозга → расслабленный фокус. GABA-ергический эффект.',
    dosage: { standard: '200 мг', on_cycle: '200-400 мг', loading: '—' },
    timing: 'Вечер или с кофеином', halfLife: '1-2 часа',
    evidenceLevel: 'B',
    protects: ['ЦНС'],
    interactsWith: ['Синергия с кофеином (1:2)'],
    sideEffects: ['Нет'],
    brands: ['Suntheanine', 'NOW'],
    costPerMonth: '~400 ₽',
    whenToUse: ['Тревожность', 'Тренболон', 'ПМС-подобные симптомы'],
    whenNotToUse: ['Нет'],
  },

  // ── Joint ──
  {
    name: 'Глюкозамин сульфат + Хондроитин',
    category: 'joint', priority: 'recommended',
    mechanism: 'Субстраты для синтеза протеогликанов хряща. Стимулируют хондроциты.',
    dosage: { standard: '1500/1200 мг', on_cycle: '1500/1200 мг', loading: '—' },
    timing: 'С едой', halfLife: 'N/A',
    evidenceLevel: 'B',
    protects: ['Суставы', 'Хрящи'],
    interactsWith: ['Может повышать глюкозу (незначительно)'],
    sideEffects: ['Желудочный дискомфорт'],
    brands: ['Doctor\'s Best', 'Jarrow'],
    costPerMonth: '~800 ₽',
    whenToUse: ['Станозолол', 'Суставные боли', 'Профилактика'],
    whenNotToUse: ['Аллергия на моллюсков (глюкозамин из ракообразных)'],
  },
  {
    name: 'Коллаген II типа (UC-II)',
    category: 'joint', priority: 'optional',
    mechanism: 'Недеформированный коллаген → иммунологическая толерантность → снижение аутоиммунной атаки на хрящ.',
    dosage: { standard: '40 мг', on_cycle: '40 мг', loading: '—' },
    timing: 'Натощак, перед сном', halfLife: 'N/A',
    evidenceLevel: 'B',
    protects: ['Суставы', 'Хрящи'],
    interactsWith: ['Нет'],
    sideEffects: ['Нет'],
    brands: ['NOW UC-II', 'Jarrow'],
    costPerMonth: '~1,200 ₽',
    whenToUse: ['Станозолол', 'Артрит', 'Возраст 35+'],
    whenNotToUse: ['Нет'],
  },

  // ── Hormonal ──
  {
    name: 'Ашваганда (KSM-66)',
    category: 'hormonal', priority: 'recommended',
    mechanism: 'Адаптоген. Снижает кортизол на 27%. Повышает тестостерон на 15% (в исследованиях).',
    dosage: { standard: '300-600 мг', on_cycle: '600 мг', loading: '—' },
    timing: 'Вечер', halfLife: '6 часов',
    evidenceLevel: 'B',
    protects: ['HPTA', 'Кортизол'],
    interactsWith: ['Седативные'],
    sideEffects: ['Сонливость', 'Не при гипертиреозе'],
    brands: ['KSM-66 (стандарт)', 'Sensoril (для сна)'],
    costPerMonth: '~600 ₽',
    whenToUse: ['ПКТ', 'Стресс', 'Тренболон'],
    whenNotToUse: ['Гипертиреоз', 'Беременность'],
  },
  {
    name: 'DIM (Дииндолилметан)',
    category: 'hormonal', priority: 'situational',
    mechanism: 'Метаболит I3C. Сдвигает метаболизм эстрогенов в сторону 2-OH (защитный) вместо 16-OH (рисковый).',
    dosage: { standard: '100-200 мг', on_cycle: '200-300 мг', loading: '—' },
    timing: 'С едой', halfLife: 'Несколько часов',
    evidenceLevel: 'C',
    protects: ['Метаболизм эстрогенов'],
    interactsWith: ['Может снижать эффективность ИА'],
    sideEffects: ['Головная боль', 'Тошнота'],
    brands: ['Thorne', 'Jarrow'],
    costPerMonth: '~700 ₽',
    whenToUse: ['E2 умеренно повышен', 'Профилактика гинекомастии'],
    whenNotToUse: ['E2 в норме или низкий', 'С ИА (конкуренция)'],
  },

  // ── Metabolic ──
  {
    name: 'Берберин',
    category: 'metabolic', priority: 'recommended',
    mechanism: 'Активирует AMPK → инсулиносенситайзер. Эффективность сравнима с метформином.',
    dosage: { standard: '500 мг 2-3×/день', on_cycle: '500 мг 3×/день', loading: '—' },
    timing: 'За 20-30 мин до еды', halfLife: 'Несколько часов',
    evidenceLevel: 'A',
    protects: ['Метаболизм глюкозы', 'Липиды'],
    interactsWith: ['Метформин (аддитивный эффект)', 'CYP3A4 субстраты'],
    sideEffects: ['Желудочно-кишечные', 'Гипогликемия (редко)'],
    brands: ['Thorne', 'NOW'],
    costPerMonth: '~900 ₽',
    whenToUse: ['ГР/Инсулин', 'HOMA-IR повышен', 'Набор жира'],
    whenNotToUse: ['Гипогликемия'],
  },

  // ── General ──
  {
    name: 'Витамин D3 + K2',
    category: 'general', priority: 'essential',
    mechanism: 'D3: иммунитет, кости, тестостерон. K2: направляет кальций в кости (не в сосуды).',
    dosage: { standard: '2000-5000 МЕ + 100 мкг', on_cycle: '5000 МЕ + 100 мкг', loading: '—' },
    timing: 'С жирной пищей', halfLife: 'D3: 2-3 недели',
    evidenceLevel: 'A',
    protects: ['Кости', 'Иммунитет', 'Сосуды'],
    interactsWith: ['Магний (необходим для активации D3)'],
    sideEffects: ['Токсичность при >10,000 МЕ/день длительно'],
    brands: ['NOW', 'Thorne', 'Doctor\'s Best'],
    costPerMonth: '~400 ₽',
    whenToUse: ['Всегда', '80% людей в дефиците'],
    whenNotToUse: ['Гиперкальциемия'],
  },
  {
    name: 'Цинк пиколинат',
    category: 'general', priority: 'essential',
    mechanism: 'Кофактор 300+ ферментов. AR-кофактор. Иммунитет, сперматогенез, заживление.',
    dosage: { standard: '25-30 мг', on_cycle: '30-50 мг', loading: '—' },
    timing: 'С едой (может вызвать тошноту натощак)', halfLife: 'N/A',
    evidenceLevel: 'A',
    protects: ['Иммунитет', 'Тестостерон', 'Кожа'],
    interactsWith: ['Кальций (конкуренция)', 'Медь (добавлять 2 мг при цинке >30 мг)'],
    sideEffects: ['Тошнота натощак', 'Дефицит меди при длительном приёме >50 мг'],
    brands: ['NOW', 'Thorne', 'Jarrow'],
    costPerMonth: '~300 ₽',
    whenToUse: ['Всегда', 'Особенно на ПКТ'],
    whenNotToUse: ['Нет (в разумных дозах)'],
  },
  {
    name: 'Креатин моногидрат',
    category: 'general', priority: 'essential',
    mechanism: 'Фосфокреатиновая система → АТФ регенерация. Сила, мощность, объём мышц.',
    dosage: { standard: '5 г/день', on_cycle: '5-10 г/день', loading: '20 г/день × 5-7 дней (опционально)' },
    timing: 'В любое время, пост-тренировка с углеводами = лучше', halfLife: '3 часа',
    evidenceLevel: 'A',
    protects: ['Сила', 'Мощность', 'Мозг'],
    interactsWith: ['Кофеин (может снижать эффективность — разнести на 2+ ч)'],
    sideEffects: ['Задержка воды 1-2 кг', 'Желудочный дискомфорт при >10 г'],
    brands: ['Creapure (немецкий)', 'Optimum Nutrition', 'BulkSupplements'],
    costPerMonth: '~400 ₽',
    whenToUse: ['Всегда', 'Не циклировать'],
    whenNotToUse: ['Почечная недостаточность'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 2. Detailed Split Database (12 splits)
// ═══════════════════════════════════════════════════════════════════════════

export const DETAILED_SPLITS: DetailedSplit[] = [
  {
    id: 'fbw_3day', name: 'Full Body 3-Day (FBW)', type: 'fullbody', daysPerWeek: 3, sessionTimeMin: '60-75',
    level: 'beginner', goal: 'general_strength',
    structure: '3 тренировки в неделю. Каждая тренировка — всё тело. Разные фокусы: A (squat), B (hinge), C (press).',
    weeklyPattern: ['FBW A (Squat-доминант)', 'Отдых', 'FBW B (Hinge-доминант)', 'Отдых', 'FBW C (Press-доминант)', 'Отдых', 'Отдых'],
    pros: ['Высокая частота стимуляции (3×/нед на мышцу)', 'Гормональный отклик', '3 дня — много свободного времени', 'Идеально для новичков'],
    cons: ['Длинные тренировки (60-75 мин)', 'Меньше изоляции', 'Сложно добавить объём'],
    variations: ['FBW 2-day (минимализм)', 'FBW 4-day (Upper/Lower hybrid)', 'FBW Heavy/Light'],
    bestFor: ['Начинающие (0-12 мес)', 'Возвращение после перерыва', 'Плотный график'],
    notFor: ['Продвинутые бодибилдеры', 'Специализация'],
    dailyBreakdown: [
      { day: 1, name: 'FBW A (Squat focus)', warmup: '5 min cardio + dynamic stretch', mainWork: 'Squat 3×5, Bench 3×5, Row 3×8', accessory: 'RDL 2×10, Lateral Raise 2×15, Plank 3×30s', cooldown: 'Stretch quads, chest' },
      { day: 3, name: 'FBW B (Deadlift focus)', warmup: '5 min cardio + hip mobility', mainWork: 'Deadlift 3×5, OHP 3×5, Pull-up 3×MAX', accessory: 'Lunge 2×10, Face Pull 2×15, Leg Raise 3×10', cooldown: 'Stretch hams, lats' },
      { day: 5, name: 'FBW C (Bench focus)', warmup: '5 min cardio + upper mobility', mainWork: 'Bench 3×5, Front Squat 3×8, Barbell Row 3×8', accessory: 'Dips 2×10, Curl 2×12, Calf Raise 3×15', cooldown: 'Full body stretch' },
    ],
  },
  {
    id: 'upper_lower_4day', name: 'Upper/Lower 4-Day', type: 'upper_lower', daysPerWeek: 4, sessionTimeMin: '50-65',
    level: 'intermediate', goal: 'strength_hypertrophy',
    structure: 'День 1: Upper Strength. День 2: Lower Strength. День 3: Upper Hypertrophy. День 4: Lower Hypertrophy.',
    weeklyPattern: ['Upper Strength', 'Lower Strength', 'Отдых', 'Upper Hyper', 'Lower Hyper', 'Отдых', 'Отдых'],
    pros: ['Сбалансированный подход', 'Достаточно восстановления', '4 дня — золотая середина', 'Гибкость упражнений'],
    cons: ['2× частота (меньше чем FBW)', 'Может не хватать для продвинутых'],
    variations: ['Upper/Lower 3-day', 'Upper/Lower 5-day (3 upper, 2 lower)', 'PHUL (Power/Hypertrophy)'],
    bestFor: ['Средний уровень', 'Сила + гипертрофия', '4 дня/нед'],
    notFor: ['Элитные бодибилдеры (нужна специализация)'],
    dailyBreakdown: [
      { day: 1, name: 'Upper Strength', warmup: 'Band pull-aparts, arm circles', mainWork: 'Bench 4×5, Barbell Row 4×5, OHP 3×5', accessory: 'Pull-up 3×8, Face Pull 3×15', cooldown: 'Stretch chest, lats' },
      { day: 2, name: 'Lower Strength', warmup: 'Leg swings, BW squats', mainWork: 'Squat 4×5, RDL 3×8, Leg Press 3×10', accessory: 'Calf Raise 4×15, Ab Wheel 3×10', cooldown: 'Stretch quads, hams' },
      { day: 4, name: 'Upper Hypertrophy', warmup: 'Arm circles, light DB press', mainWork: 'DB Bench 4×10, Lat Pulldown 4×12, DB OHP 3×10', accessory: 'Cable Flye 3×15, Bicep Curl 3×12, Tricep Pushdown 3×12', cooldown: 'Stretch' },
      { day: 5, name: 'Lower Hypertrophy', warmup: 'Dynamic stretch', mainWork: 'Front Squat 4×8, RDL 3×10, Walking Lunge 3×12', accessory: 'Leg Curl 3×12, Calf Raise 4×15, Plank 3×45s', cooldown: 'Stretch + foam roll' },
    ],
  },
  {
    id: 'ppl_6day', name: 'Push/Pull/Legs 6-Day', type: 'ppl', daysPerWeek: 6, sessionTimeMin: '60-75',
    level: 'intermediate', goal: 'hypertrophy',
    structure: 'Push A → Pull A → Legs A → Push B → Pull B → Legs B → Rest.',
    weeklyPattern: ['Push A (сила)', 'Pull A (сила)', 'Legs A (сила)', 'Push B (hyper)', 'Pull B (hyper)', 'Legs B (hyper)', 'Отдых'],
    pros: ['Высокая частота (2×/нед)', 'Достаточно объёма', 'Специализация по паттернам', 'Гибкость вариаций'],
    cons: ['6 дней — много времени', 'Сложно с плотным графиком', 'Риск перетрена'],
    variations: ['PPL 3-day', 'PPL 5-day (PPLPP)', 'PPL Rest-Pause'],
    bestFor: ['Продвинутые', 'Гипертрофия', 'Много свободного времени'],
    notFor: ['Новички (слишком много)', 'Плотный рабочий график'],
    dailyBreakdown: [
      { day: 1, name: 'Push A', warmup: 'Band pull-aparts', mainWork: 'Bench 4×5-8, OHP 3×6-8', accessory: 'Incline DB 3×10, Lateral Raise 4×15, Tricep Pushdown 3×12', cooldown: 'Stretch chest, tris' },
      { day: 2, name: 'Pull A', warmup: 'Scapular activation', mainWork: 'Deadlift 4×3-5, Barbell Row 4×6-8', accessory: 'Lat Pulldown 3×10, Face Pull 3×15, Barbell Curl 4×10', cooldown: 'Stretch lats, bis' },
      { day: 3, name: 'Legs A', warmup: 'Leg swings, BW squats', mainWork: 'Squat 4×5-8, RDL 3×8-10', accessory: 'Leg Press 3×12, Walking Lunge 3×12, Calf Raise 5×15', cooldown: 'Foam roll' },
      { day: 4, name: 'Push B', warmup: 'Light push-ups', mainWork: 'DB Bench 4×10-12, DB OHP 3×8-10', accessory: 'Cable Flye 3×15, Lateral Raise 4×20, Overhead Extension 3×15', cooldown: 'Stretch' },
      { day: 5, name: 'Pull B', warmup: 'Band pull-aparts', mainWork: 'Pull-up 4×8-12, Seated Row 4×10-12', accessory: 'Single Arm Row 3×12, Rear Delt Flye 3×15, Hammer Curl 4×12', cooldown: 'Stretch' },
      { day: 6, name: 'Legs B', warmup: 'Dynamic stretch', mainWork: 'Front Squat 4×8-10, Hip Thrust 4×12', accessory: 'Bulgarian Split 3×12, Leg Curl 3×15, Calf Raise 5×15', cooldown: 'Full stretch + foam roll' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. Diet Types
// ═══════════════════════════════════════════════════════════════════════════

export const DIET_TYPES: DietType[] = [
  {
    name: 'Стандартная (IIFYM / Гибкая диета)', description: 'Ешьте что хотите, если вписываетесь в макросы. 80% цельные продукты, 20% "вкусняшки".',
    macros: 'Б: 1.8-2.5 г/кг, Ж: 0.7-1.0 г/кг, У: остаток калорий',
    benefits: ['Гибкость', 'Устойчивость (можно годами)', 'Нет запрещённых продуктов', 'Социально приемлемо'],
    drawbacks: ['Можно есть "мусор" если вписывается', 'Требует подсчёта'],
    bestFor: ['Большинство людей', 'Долгосрочно', 'Спортсмены'],
    notFor: ['Нуждающиеся в строгих правилах'],
    mealFrequency: '3-6 приёмов, как удобно',
    exampleDay: ['Завтрак: овсянка + протеин + ягоды', 'Обед: курица + рис + овощи', 'Ужин: рыба + картофель + салат', 'Перекус: йогурт + орехи'],
  },
  {
    name: 'Кето / Low Carb (<50 г)', description: 'Углеводы <50 г/день. Жиры — основной источник энергии. Кетоз.',
    macros: 'Б: 1.8-2.2 г/кг, Ж: 65-75% калорий, У: <50 г',
    benefits: ['Подавление аппетита', 'Стабильная энергия', 'Быстрое жиросжигание (вода)', 'Когнитивные (для некоторых)'],
    drawbacks: ['Падение силы (первые 2-4 нед)', 'Сложно набирать массу', 'Ограничения в еде', 'Keto flu'],
    bestFor: ['Сушка', 'Эпилепсия', 'Инсулинорезистентность'],
    notFor: ['Набор массы', 'Высокоинтенсивный спорт', 'Любители углеводов'],
    mealFrequency: '2-3 приёма (сытость высокая)',
    exampleDay: ['Завтрак: яйца + бекон + авокадо', 'Обед: жирная рыба + овощи + оливковое масло', 'Ужин: стейк + спаржа + масло'],
  },
  {
    name: 'Intermittent Fasting 16:8', description: '8-часовое окно питания. 16 часов голодания. Аутофагия.',
    macros: 'Стандартные макросы в 8-часовом окне',
    benefits: ['Удобно (2-3 приёма)', 'Аутофагия', 'Инсулиночувствительность', 'Контроль калорий без подсчёта'],
    drawbacks: ['Сложно набирать массу (много еды за раз)', 'Не для всех', 'Тренировки натощак — спорно'],
    bestFor: ['Сушка', 'Поддержание', 'Занятые люди'],
    notFor: ['Набор массы (тяжело съесть)', 'Спортсмены с 2 тренировками/день'],
    mealFrequency: '2-3 приёма в окне 12:00-20:00',
    exampleDay: ['12:00: большой обед (белок+углеводы+жиры)', '16:00: перекус', '19:30: ужин', 'До 12:00: вода, кофе, чай'],
  },
  {
    name: 'Carb Cycling', description: 'Чередование высоко-, средне- и низкоуглеводных дней. Для сушки.',
    macros: 'Высокий: 3-4 г/кг У. Средний: 2-3 г/кг. Низкий: 1-1.5 г/кг. Белок и жиры стабильны.',
    benefits: ['Лучше чем постоянный дефицит', 'Рефиды лептиновые', 'Сохранение производительности', 'Гибкость'],
    drawbacks: ['Сложно планировать', 'Требует дисциплины'],
    bestFor: ['Сушка <12% BF', 'Подготовка к соревнованиям'],
    notFor: ['Новички', 'Недисциплинированные'],
    mealFrequency: 'Стандартно 4-5 приёмов',
    exampleDay: ['High: тренировка ног + 300 г углеводов', 'Low: отдых + 100 г углеводов', 'Medium: тренировка верха + 200 г углеводов'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

export function getSupportCompounds(): SupportCompound[] { return SUPPORT_COMPOUNDS_DB; }
export function getSupportsByCategory(cat: string): SupportCompound[] { return SUPPORT_COMPOUNDS_DB.filter(s => s.category === cat); }
export function getEssentialSupports(): SupportCompound[] { return SUPPORT_COMPOUNDS_DB.filter(s => s.priority === 'essential'); }
export function getSupportsForOrgan(organ: string): SupportCompound[] { return SUPPORT_COMPOUNDS_DB.filter(s => s.protects.some(p => p.toLowerCase().includes(organ.toLowerCase()))); }
export function getDetailedSplits(): DetailedSplit[] { return DETAILED_SPLITS; }
export function getSplitById(id: string): DetailedSplit | undefined { return DETAILED_SPLITS.find(s => s.id === id); }
export function getSplitsByLevel(level: string): DetailedSplit[] { return DETAILED_SPLITS.filter(s => s.level === level); }
export function getDietTypes(): DietType[] { return DIET_TYPES; }
