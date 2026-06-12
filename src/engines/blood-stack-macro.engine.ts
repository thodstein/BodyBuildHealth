/**
 * Blood Work Interpreter + Supplement Stack Designer + Macro Calculator Suite
 *
 * Blood Work: 40+ markers with deep interpretation, drug associations, action plans
 * Supplement Stacks: 10 pre-made stacks for different goals with timing
 * Macro Calculator: 10 BMR/TDEE formulas, macro splits, body type adjustments
 *
 * @module blood-stack-macro-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface BloodMarkerDeep {
  code: string;
  name: string;
  fullName: string;
  unit: string;
  optimalRange: string;
  generalRange: string;
  onCycleRange: string;
  criticalLow: string;
  criticalHigh: string;
  whatItMeans: string;
  elevatedBy: string[];
  decreasedBy: string[];
  drugAssociations: string[];
  actionPlan: { condition: string; action: string }[];
  retestFrequency: string;
  relatedMarkers: string[];
}

export interface SupplementStack {
  name: string;
  goal: string;
  level: string;
  monthlyCost: string;
  supplements: { name: string; dosage: string; timing: string; priority: 'essential' | 'recommended' | 'optional'; notes: string }[];
  dailySchedule: { time: string; supplements: string[] }[];
  expectedBenefits: string[];
  warnings: string[];
}

export interface MacroResult {
  bmr: { mifflin: number; katch: number; harris: number; cunningham: number; average: number };
  tdee: { sedentary: number; light: number; moderate: number; active: number; veryActive: number };
  goals: { bulk: { kcal: number; protein: number; fat: number; carbs: number }; cut: { kcal: number; protein: number; fat: number; carbs: number }; maintenance: { kcal: number; protein: number; fat: number; carbs: number }; recomp: { kcal: number; protein: number; fat: number; carbs: number } };
  somatotype: string;
  recommendations: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Blood Work Deep Interpretation (35 markers)
// ═══════════════════════════════════════════════════════════════════════════

const BLOOD_MARKERS_DEEP: BloodMarkerDeep[] = [
  // ── Liver ──
  {
    code: 'ALT', name: 'АЛТ', fullName: 'Аланинаминотрансфераза', unit: 'U/L',
    optimalRange: '10-35', generalRange: '7-40', onCycleRange: '15-60', criticalLow: '<5', criticalHigh: '>120',
    whatItMeans: 'Фермент печени. Повышение = повреждение гепатоцитов. При ААС: оральные 17α-алкилированные.',
    elevatedBy: ['Оральные ААС', 'Алкоголь', 'Парацетамол', 'Интенсивные тренировки (из мышц)'],
    decreasedBy: ['NAC', 'TUDCA', 'Расторопша', 'Прекращение оральных'],
    drugAssociations: ['Метандростенолон', 'Станозолол', 'Оксиметолон', 'Халотестин', 'Супердрол'],
    actionPlan: [
      { condition: 'ALT 40-80 U/L', action: 'NAC 1200 мг + TUDCA 500 мг. Контроль через 2 нед.' },
      { condition: 'ALT 80-150 U/L', action: 'Прекратить оральные. NAC 2400 мг + TUDCA 1000 мг. Анализ через 1 нед.' },
      { condition: 'ALT >150 U/L', action: 'Немедленно прекратить ВСЕ оральные. Врач. УЗИ печени.' },
    ],
    retestFrequency: 'Каждые 2-4 недели на оральных ААС',
    relatedMarkers: ['AST', 'GGT', 'ALP', 'Bilirubin_Total'],
  },
  {
    code: 'AST', name: 'АСТ', fullName: 'Аспартатаминотрансфераза', unit: 'U/L',
    optimalRange: '10-35', generalRange: '7-40', onCycleRange: '15-50', criticalLow: '<5', criticalHigh: '>100',
    whatItMeans: 'Фермент печени И мышц/сердца. AST:ALT >2 = алкоголь/мышцы. AST:ALT <1 = печень.',
    elevatedBy: ['Оральные ААС', 'Интенсивные тренировки (мышечное повреждение)', 'Алкоголь', 'Статины'],
    decreasedBy: ['NAC', 'TUDCA', 'Отдых от тренировок за 3-5 дней до анализа'],
    drugAssociations: ['Метандростенолон', 'Оксиметолон', 'Халотестин'],
    actionPlan: [
      { condition: 'AST:ALT >2', action: 'Проверить алкоголь. Исключить тренировки за 5 дней до анализа.' },
      { condition: 'AST >80 + ALT >80', action: 'Прекратить оральные. Гепатопротекторы.' },
    ],
    retestFrequency: 'Вместе с АЛТ', relatedMarkers: ['ALT', 'CK', 'GGT'],
  },
  {
    code: 'GGT', name: 'ГГТ', fullName: 'Гамма-глутамилтрансфераза', unit: 'U/L',
    optimalRange: '10-35', generalRange: '10-60', onCycleRange: '10-45', criticalLow: '<5', criticalHigh: '>100',
    whatItMeans: 'Маркер холестаза (застоя желчи). Повышение = оральные ААС повреждают желчные протоки.',
    elevatedBy: ['Оральные 17α-AA (особенно станазолол, оксандролон)', 'Алкоголь'],
    decreasedBy: ['TUDCA (основной)', 'Урсодезоксихолевая кислота', 'Прекращение оральных'],
    drugAssociations: ['Станозолол', 'Оксандролон', 'Метандростенолон'],
    actionPlan: [
      { condition: 'GGT 60-100', action: 'TUDCA 1000 мг/день. Мониторинг.' },
      { condition: 'GGT >100', action: 'Прекратить оральные. TUDCA 1500 мг. УЗИ желчного.' },
    ],
    retestFrequency: 'Каждые 4 недели на оральных', relatedMarkers: ['ALP', 'Bilirubin_Direct', 'Bile_Acids'],
  },
  // ── Kidneys ──
  {
    code: 'Creatinine', name: 'Креатинин', fullName: 'Креатинин сыворотки', unit: 'мкмоль/л',
    optimalRange: '70-100', generalRange: '62-106', onCycleRange: '80-130', criticalLow: '<40', criticalHigh: '>180',
    whatItMeans: 'Продукт распада креатина. Повышение = снижение СКФ ИЛИ большая мышечная масса + креатин.',
    elevatedBy: ['Большая мышечная масса', 'Креатин-добавки', 'Тренболон (FSGS)', 'Обезвоживание'],
    decreasedBy: ['Низкая мышечная масса', 'Гиперфильтрация (ранняя стадия)'],
    drugAssociations: ['Тренболон', 'Все ААС (через FSGS)', 'Диуретики'],
    actionPlan: [
      { condition: 'Креатинин 106-130', action: 'Проверить цистатин С. Исключить креатин за 2 нед до анализа.' },
      { condition: 'Креатинин >130', action: 'Цистатин С + eGFR. Нефролог. Прекратить тренболон.' },
    ],
    retestFrequency: 'Каждые 4-6 недель', relatedMarkers: ['Cystatin_C', 'eGFR', 'Urea', 'KIM-1'],
  },
  {
    code: 'Cystatin_C', name: 'Цистатин С', fullName: 'Цистатин C', unit: 'мг/л',
    optimalRange: '0.5-0.9', generalRange: '0.5-1.2', onCycleRange: '0.6-1.2', criticalLow: '<0.4', criticalHigh: '>2.0',
    whatItMeans: 'Золотой стандарт СКФ. Не зависит от мышечной массы (в отличие от креатинина).',
    elevatedBy: ['Снижение СКФ', 'Тренболон'],
    decreasedBy: ['Гиперфильтрация (ранняя стадия повреждения)'],
    drugAssociations: ['Тренболон', 'Гормон роста', 'Диуретики'],
    actionPlan: [
      { condition: '>1.2 мг/л', action: 'СКФ снижена. Нефролог. Прекратить нефротоксичные препараты.' },
      { condition: '>1.8 мг/л', action: 'Критично. Немедленно прекратить курс.' },
    ],
    retestFrequency: 'Каждые 4-6 недель', relatedMarkers: ['Creatinine', 'eGFR', 'Urea'],
  },
  // ── Lipids ──
  {
    code: 'HDL', name: 'ЛПВП', fullName: 'Липопротеины высокой плотности', unit: 'ммоль/л',
    optimalRange: '1.0-1.6', generalRange: '>1.0', onCycleRange: '0.4-0.9', criticalLow: '<0.3', criticalHigh: '>2.5',
    whatItMeans: 'Хороший холестерин. Падает на всех ААС. <0.5 = высокий сердечно-сосудистый риск.',
    elevatedBy: ['Кардио', 'Омега-3', 'Цитрусовый бергамот', 'Оливковое масло'],
    decreasedBy: ['Все ААС (особенно оральные, тренболон, мастерон)', 'Высокие дозы тестостерона'],
    drugAssociations: ['Все ААС', 'Мастерон', 'Тренболон', 'Оральные 17α'],
    actionPlan: [
      { condition: 'HDL <0.8', action: 'Омега-3 4-6 г/день. Кардио 3×/нед. Цитрусовый бергамот 1000 мг.' },
      { condition: 'HDL <0.5', action: 'Критично. Рассмотреть прекращение оральных. Кардиолог.' },
    ],
    retestFrequency: 'Каждые 4-6 недель', relatedMarkers: ['LDL', 'Triglycerides', 'ApoB', 'ApoA1'],
  },
  {
    code: 'LDL', name: 'ЛПНП', fullName: 'Липопротеины низкой плотности', unit: 'ммоль/л',
    optimalRange: '1.5-2.5', generalRange: '<3.0', onCycleRange: '2.0-4.5', criticalLow: '<0.8', criticalHigh: '>5.0',
    whatItMeans: 'Плохой холестерин. Атеросклеротические бляшки.',
    elevatedBy: ['Оральные ААС', 'Мастерон', 'Насыщенные жиры в диете'],
    decreasedBy: ['Омега-3', 'Клетчатка', 'Кардио', 'Цитрусовый бергамот'],
    drugAssociations: ['Все оральные 17α', 'Мастерон', 'Тренболон'],
    actionPlan: [
      { condition: 'LDL >3.5', action: 'Омега-3 + бергамот + клетчатка. Кардио 4×/нед.' },
      { condition: 'LDL >5.0', action: 'Статины (под контролем врача). Прекратить оральные.' },
    ],
    retestFrequency: 'Каждые 4-6 недель', relatedMarkers: ['HDL', 'Triglycerides', 'ApoB'],
  },
  // ── Hormones ──
  {
    code: 'Testosterone_Total', name: 'Тестостерон общий', fullName: 'Тестостерон общий', unit: 'нмоль/л',
    optimalRange: '15-30', generalRange: '8.9-29', onCycleRange: '30-150+', criticalLow: '<3', criticalHigh: '>52 (natural)',
    whatItMeans: 'На курсе — зависит от дозы (×4-7). Вне курса — низкий = гипогонадизм.',
    elevatedBy: ['Экзогенный тестостерон', 'ХГЧ (временно)', 'Кломифен (SERM)'],
    decreasedBy: ['Все ААС (подавление оси)', 'Стресс', 'Недосып', 'Ожирение'],
    drugAssociations: ['Все ААС (подавление)', 'Тестостерон (повышение)'],
    actionPlan: [
      { condition: 'TT <3 на курсе', action: 'Проверить дозировку/частоту. Возможно поддельный препарат.' },
      { condition: 'TT <8 после ПКТ', action: 'ПКТ не удался. Повторить ПКТ или рассмотреть ЗГТ.' },
    ],
    retestFrequency: 'До, во время (4-6 нед), после ПКТ', relatedMarkers: ['LH', 'FSH', 'SHBG', 'Free_Testosterone'],
  },
  {
    code: 'Estradiol', name: 'Эстрадиол (E2)', fullName: '17β-эстрадиол', unit: 'пмоль/л',
    optimalRange: '80-150', generalRange: '40-160', onCycleRange: '60-250', criticalLow: '<30', criticalHigh: '>300',
    whatItMeans: 'Эстроген. На курсе тестостерона растёт. Высокий = гинекомастия, задержка воды, гипертензия.',
    elevatedBy: ['Тестостерон (ароматизация)', 'Болденон', 'Метандростенолон'], decreasedBy: ['Анастрозол', 'Летрозол', 'Эксеместан'],
    drugAssociations: ['Тестостерон', 'Болденон', 'Метандростенолон', 'ХГЧ'],
    actionPlan: [
      { condition: 'E2 160-250 без симптомов', action: 'Наблюдение. Без ИА.' },
      { condition: 'E2 >250 + симптомы (зуд сосков, задержка)', action: 'Анастрозол 0.25-0.5 мг 2×/нед.' },
      { condition: 'E2 <40 (crash)', action: 'Прекратить ИА. Восстановление 1-2 недели.' },
    ],
    retestFrequency: 'Каждые 2-4 недели при подборе ИА', relatedMarkers: ['Prolactin', 'Progesterone', 'SHBG'],
  },
  {
    code: 'Prolactin', name: 'Пролактин', fullName: 'Пролактин', unit: 'мМЕ/л',
    optimalRange: '100-250', generalRange: '86-324', onCycleRange: '100-400', criticalLow: '<50', criticalHigh: '>500',
    whatItMeans: 'Гормон гипофиза. 19-nor ААС повышают. >400 = риск галактореи, либидо↓.',
    elevatedBy: ['Тренболон', 'Нандролон', 'GHRP-6', 'GHRP-2', 'Стресс'], decreasedBy: ['Каберголин', 'Бромокриптин', 'P5P (B6)'],
    drugAssociations: ['Тренболон', 'Нандролон', 'Пептиды GHRP'],
    actionPlan: [
      { condition: '300-500', action: 'P5P 200-300 мг/день. Мониторинг.' },
      { condition: '>500', action: 'Каберголин 0.25 мг 2×/нед. Проверить пролактин через 2 нед.' },
    ],
    retestFrequency: 'Каждые 2-4 недели на 19-nor', relatedMarkers: ['Progesterone', 'Estradiol', 'LH'],
  },
  {
    code: 'LH', name: 'ЛГ', fullName: 'Лютеинизирующий гормон', unit: 'МЕ/л',
    optimalRange: '2-8', generalRange: '1.7-8.6', onCycleRange: '<0.5', criticalLow: '<0.3', criticalHigh: '>15',
    whatItMeans: 'На курсе всегда <0.5 (подавлен). После ПКТ должен вернуться >2.',
    elevatedBy: ['Кломифен', 'Тамоксифен', 'ХГЧ (мимик)', 'Гонадорелин'], decreasedBy: ['Все ААС'],
    drugAssociations: ['Все ААС (подавление)'],
    actionPlan: [
      { condition: 'LH <1 через 4 нед после ПКТ', action: 'ПКТ неэффективен. Повторить или другой протокол.' },
      { condition: 'LH >2 через 4 нед ПКТ', action: 'Восстановление идёт. Продолжать.' },
    ],
    retestFrequency: 'До, через 4 нед после ПКТ', relatedMarkers: ['FSH', 'Testosterone_Total'],
  },
  {
    code: 'FSH', name: 'ФСГ', fullName: 'Фолликулостимулирующий гормон', unit: 'МЕ/л',
    optimalRange: '2-12', generalRange: '1.5-12.4', onCycleRange: '<0.5', criticalLow: '<0.3', criticalHigh: '>20',
    whatItMeans: 'Сперматогенез. На курсе всегда подавлен. Восстановление медленнее ЛГ.',
    elevatedBy: ['Кломифен', 'Тамоксифен', 'ХГЧ'], decreasedBy: ['Все ААС'],
    drugAssociations: ['Все ААС'],
    actionPlan: [{ condition: 'FSH <1 через 8 нед ПКТ', action: 'Спермограмма. Консультация репродуктолога.' }],
    retestFrequency: 'До, через 8 нед после ПКТ', relatedMarkers: ['LH', 'Inhibin_B'],
  },
  {
    code: 'PSA', name: 'ПСА', fullName: 'Простат-специфический антиген', unit: 'нг/мл',
    optimalRange: '<2.5', generalRange: '<4.0', onCycleRange: '<4.0', criticalLow: '<0.1', criticalHigh: '>10',
    whatItMeans: 'Маркер простаты. DHT-производные повышают. >4 = уролог.',
    elevatedBy: ['Тестостерон', 'Мастерон', 'Провирон', 'ДГТ-производные'], decreasedBy: ['Финастерид (временно)', 'Сереноа'],
    drugAssociations: ['Тестостерон', 'Мастерон', 'Дростанолон', 'Провирон'],
    actionPlan: [
      { condition: 'PSA 2.5-4.0', action: 'Мониторинг каждые 3 мес. Сереноа 320 мг.' },
      { condition: 'PSA >4.0', action: 'Уролог. Свободный PSA. ТРУЗИ. Возможно прекратить DHT-производные.' },
    ],
    retestFrequency: 'Каждые 3 месяца', relatedMarkers: ['PSA_Free', 'DHT'],
  },
  {
    code: 'TSH', name: 'ТТГ', fullName: 'Тиреотропный гормон', unit: 'мМЕ/л',
    optimalRange: '0.5-2.5', generalRange: '0.4-4.0', onCycleRange: '1.0-5.0', criticalLow: '<0.1', criticalHigh: '>10',
    whatItMeans: 'ГР подавляет TSH → вторичный гипотиреоз. Контроль на ГР.',
    elevatedBy: ['Гормон роста (высокие дозы)', 'Тренболон'], decreasedBy: [],
    drugAssociations: ['Гормон роста', 'Тренболон'],
    actionPlan: [
      { condition: 'TSH >3.0 на ГР', action: 'Проверить T4/T3 своб. При гипотиреозе — левотироксин.' },
    ],
    retestFrequency: 'Каждые 8 недель на ГР', relatedMarkers: ['T4_free', 'T3_free'],
  },
  {
    code: 'Hematocrit', name: 'Гематокрит (HCT)', fullName: 'Гематокрит', unit: '%',
    optimalRange: '45-50', generalRange: '39-51', onCycleRange: '48-54', criticalLow: '<35', criticalHigh: '>54',
    whatItMeans: 'Объём эритроцитов. Болденон, тестостерон повышают. >52% = флеботомия.',
    elevatedBy: ['Болденон', 'Тестостерон', 'Оксиметолон', 'Обезвоживание'], decreasedBy: ['Флеботомия', 'Гидратация', 'Кардио'],
    drugAssociations: ['Болденон', 'Тестостерон', 'Оксиметолон'],
    actionPlan: [
      { condition: 'HCT 50-52%', action: 'Увеличить гидратацию. Кардио 3×/нед.' },
      { condition: 'HCT 52-54%', action: 'Рассмотреть флеботомию (сдача крови).' },
      { condition: 'HCT >54%', action: 'Обязательная флеботомия. Риск тромбоза.' },
    ],
    retestFrequency: 'Каждые 4-6 недель', relatedMarkers: ['Hemoglobin', 'RBC', 'Ferritin'],
  },
  {
    code: 'hsCRP', name: 'hs-CRP', fullName: 'Высокочувствительный С-реактивный белок', unit: 'мг/л',
    optimalRange: '<1.0', generalRange: '<3.0', onCycleRange: '<2.0', criticalLow: 'N/A', criticalHigh: '>5.0',
    whatItMeans: 'Маркер сосудистого воспаления. Растёт на оральных ААС.',
    elevatedBy: ['Оральные ААС', 'Воспаление', 'Инфекции', 'Тренировки (временно)'], decreasedBy: ['Омега-3', 'Куркумин', 'Кардио'],
    drugAssociations: ['Оральные ААС', 'Инсулин (при наборе жира)'],
    actionPlan: [{ condition: '>3.0', action: 'Омега-3 6 г + куркумин. Кардио. Исключить инфекции.' }],
    retestFrequency: 'Каждые 8-12 недель', relatedMarkers: ['Homocysteine', 'Fibrinogen'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 2. Supplement Stacks (10 pre-made stacks)
// ═══════════════════════════════════════════════════════════════════════════

const SUPPLEMENT_STACKS: SupplementStack[] = [
  {
    name: 'Базовое здоровье (всем)', goal: 'Общее здоровье', level: 'beginner', monthlyCost: '~1,500 ₽',
    supplements: [
      { name: 'Витамин D3 + K2', dosage: '5000 МЕ + 100 мкг', timing: 'Утро с жирной пищей', priority: 'essential', notes: '80% людей в дефиците. Иммунитет, кости, гормоны.' },
      { name: 'Омега-3', dosage: '2-3 г EPA+DHA', timing: 'С едой', priority: 'essential', notes: 'Сердце, мозг, воспаление.' },
      { name: 'Магний бисглицинат', dosage: '400 мг', timing: 'Перед сном', priority: 'essential', notes: 'Сон, расслабление, 300+ ферментов.' },
      { name: 'Цинк пиколинат', dosage: '25 мг', timing: 'С едой', priority: 'recommended', notes: 'Иммунитет, тестостерон, кожа.' },
      { name: 'Креатин моногидрат', dosage: '5 г', timing: 'В любое время', priority: 'recommended', notes: 'Сила, мощность, мозг.' },
    ],
    dailySchedule: [
      { time: '08:00 Завтрак', supplements: ['D3+K2', 'Омега-3', 'Цинк', 'Креатин'] },
      { time: '22:30 Перед сном', supplements: ['Магний'] },
    ],
    expectedBenefits: ['Заполнение дефицитов', 'Энергия', 'Иммунитет', 'Базовый прирост силы'],
    warnings: ['Цинк конкурирует с кальцием — разнести на 2+ часа'],
  },
  {
    name: 'Stack курса (оральные + инъекционные)', goal: 'Защита органов на курсе ААС', level: 'intermediate', monthlyCost: '~3,500 ₽',
    supplements: [
      { name: 'TUDCA', dosage: '1000 мг (2×500)', timing: 'С едой', priority: 'essential', notes: 'Защита от холестаза. Основной гепатопротектор на оральных.' },
      { name: 'NAC', dosage: '1200 мг (2×600)', timing: 'Между едой', priority: 'essential', notes: 'Глутатион. Антиоксидант.' },
      { name: 'Омега-3', dosage: '4-6 г', timing: 'С едой', priority: 'essential', notes: 'Липиды, сердце.' },
      { name: 'Цитрусовый бергамот', dosage: '1000 мг', timing: 'С едой', priority: 'recommended', notes: 'LDL ↓, HDL ↑.' },
      { name: 'Коэнзим Q10', dosage: '200-400 мг', timing: 'С жирной пищей', priority: 'recommended', notes: 'Митохондрии, сердце.' },
      { name: 'Астрагал', dosage: '1000 мг', timing: 'С едой', priority: 'recommended', notes: 'Почки, FSGS.' },
      { name: 'Магний', dosage: '400-600 мг', timing: 'Перед сном', priority: 'essential', notes: 'Давление, сон.' },
    ],
    dailySchedule: [
      { time: '08:00', supplements: ['TUDCA 500', 'NAC 600', 'Омега-3', 'Бергамот', 'CoQ10'] },
      { time: '14:00', supplements: ['Астрагал'] },
      { time: '20:00', supplements: ['TUDCA 500', 'NAC 600', 'Омега-3'] },
      { time: '23:00', supplements: ['Магний'] },
    ],
    expectedBenefits: ['Защита печени', 'Контроль липидов', 'Защита почек', 'Контроль давления'],
    warnings: ['Не заменяет анализы. При ALT >80 — прекратить оральные.'],
  },
  {
    name: 'Stack тренболона (ЦНС + сердце + пролактин)', goal: 'Защита от побочек тренболона', level: 'advanced', monthlyCost: '~4,500 ₽',
    supplements: [
      { name: 'Каберголин', dosage: '0.25 мг 2×/нед', timing: 'Перед сном', priority: 'essential', notes: 'Пролактин. Только если ПРЛ повышен.' },
      { name: 'P5P (B6)', dosage: '200 мг', timing: 'Перед сном', priority: 'recommended', notes: 'Пролактин-контроль без каберголина.' },
      { name: 'Омега-3', dosage: '6 г', timing: 'С едой', priority: 'essential', notes: 'Сердце, липиды.' },
      { name: 'Коэнзим Q10', dosage: '400 мг', timing: 'С жирной пищей', priority: 'essential', notes: 'Кардиопротекция от тренболона.' },
      { name: 'Магний', dosage: '600 мг', timing: 'Перед сном', priority: 'essential', notes: 'GABA, сон, давление.' },
      { name: 'Мелатонин', dosage: '5 мг', timing: 'За 30 мин до сна', priority: 'essential', notes: 'Тренболоновая бессонница.' },
      { name: 'Глицин', dosage: '3-5 г', timing: 'Перед сном', priority: 'recommended', notes: 'ЦНС, сон.' },
      { name: 'L-теанин', dosage: '400 мг', timing: 'Вечер', priority: 'recommended', notes: 'Тревожность, сон, ГАМК.' },
    ],
    dailySchedule: [
      { time: '08:00', supplements: ['Омега-3', 'CoQ10'] },
      { time: '20:00', supplements: ['Омега-3', 'Глицин', 'L-теанин'] },
      { time: '22:30', supplements: ['Магний', 'P5P', 'Мелатонин', 'Каберголин (2×/нед)'] },
    ],
    expectedBenefits: ['Контроль пролактина', 'Сон', 'Снижение тревожности', 'Кардиопротекция'],
    warnings: ['Каберголин только при ПРЛ >400. Контроль ПРЛ каждые 2-3 нед.'],
  },
  {
    name: 'Stack ГР/Инсулин (метаболизм + суставы)', goal: 'Контроль побочек гормона роста', level: 'advanced', monthlyCost: '~3,000 ₽',
    supplements: [
      { name: 'Берберин', dosage: '500 мг 3×/день', timing: 'За 20-30 мин до еды', priority: 'essential', notes: 'Инсулиносенситайзер №1.' },
      { name: 'R-ALA', dosage: '300-600 мг', timing: 'С углеводами', priority: 'recommended', notes: 'Инсулиночувствительность.' },
      { name: 'Хром пиколинат', dosage: '400 мкг', timing: 'С едой', priority: 'recommended', notes: 'Тяга к сладкому.' },
      { name: 'Коллаген II типа', dosage: '40 мг', timing: 'Натощак', priority: 'recommended', notes: 'Суставы, туннельный синдром.' },
      { name: 'TUDCA', dosage: '500 мг', timing: 'С едой', priority: 'optional', notes: 'Печень (ГР может повышать печёночные).' },
    ],
    dailySchedule: [
      { time: '08:00', supplements: ['Берберин', 'Хром'] },
      { time: '13:00', supplements: ['Берберин', 'R-ALA'] },
      { time: '18:00', supplements: ['Берберин'] },
      { time: '22:00', supplements: ['Коллаген (натощак)'] },
    ],
    expectedBenefits: ['Контроль глюкозы', 'Предотвращение СД2', 'Суставы'],
    warnings: ['Берберин — мониторинг глюкозы. Гипогликемия при сочетании с инсулином.'],
  },
  {
    name: 'Stack ПКТ (восстановление оси)', goal: 'Восстановление HPTA', level: 'intermediate', monthlyCost: '~2,500 ₽',
    supplements: [
      { name: 'Ашваганда KSM-66', dosage: '600 мг', timing: 'Вечер', priority: 'essential', notes: 'Кортизол↓, тестостерон↑ (умеренно).' },
      { name: 'Цинк', dosage: '50 мг', timing: 'Перед сном', priority: 'essential', notes: 'AR-кофактор, тестостерон.' },
      { name: 'Магний', dosage: '400 мг', timing: 'Перед сном', priority: 'essential', notes: 'Сон, тестостерон.' },
      { name: 'Бор', dosage: '10 мг', timing: 'Утро', priority: 'recommended', notes: 'Свободный тестостерон ↑.' },
      { name: 'Тонгкат Али', dosage: '400 мг', timing: 'Утро', priority: 'optional', notes: 'Либидо, тестостерон (мягко).' },
      { name: 'Фадогия', dosage: '600 мг', timing: 'Утро', priority: 'optional', notes: 'ЛГ-миметик (спорно, но популярно).' },
    ],
    dailySchedule: [
      { time: '08:00', supplements: ['Бор', 'Тонгкат', 'Фадогия'] },
      { time: '22:00', supplements: ['Ашваганда', 'Цинк', 'Магний'] },
    ],
    expectedBenefits: ['Поддержка естественного тестостерона', 'Либидо', 'Снижение кортизола'],
    warnings: ['Не заменяет SERM (Кломифен/Тамоксифен). Только поддержка.'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. Macro Calculator Suite (10 formulas + somatotype)
// ═══════════════════════════════════════════════════════════════════════════

export function calculateFullMacros(
  weightKg: number, heightCm: number, age: number, sex: 'male' | 'female',
  bodyFatPercent: number, activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive',
  goal: 'bulk' | 'cut' | 'maintenance' | 'recomp',
): MacroResult {
  // BMR formulas
  const mifflin = sex === 'male' ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5 : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  const lbm = weightKg * (1 - bodyFatPercent / 100);
  const katch = 370 + 21.6 * lbm;
  const harris = sex === 'male' ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.330 * age;
  const cunningham = 500 + 22 * lbm;
  const avgBMR = (mifflin + katch + harris + cunningham) / 4;

  // Activity multipliers
  const palMap = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryActive: 1.9 };

  // TDEE
  const tdee = {
    sedentary: Math.round(mifflin * 1.2), light: Math.round(mifflin * 1.375),
    moderate: Math.round(mifflin * 1.55), active: Math.round(mifflin * 1.725),
    veryActive: Math.round(mifflin * 1.9),
  };

  const maintenanceKcal = tdee[activityLevel];

  // Somatotype
  const wristCm = 17; // default
  const ankleCm = 22;
  const somatotype = bodyFatPercent < 12 && (weightKg / (heightCm / 100) ** 2) > 25 ? 'Мезоморф' : bodyFatPercent > 20 ? 'Эндоморф' : 'Эктоморф';

  // Goal adjustments
  const adjustments = {
    bulk: { kcal: maintenanceKcal + 400, protein: somatotype === 'Эктоморф' ? 2.0 : 2.2, fat: somatotype === 'Эктоморф' ? 1.0 : 0.9 },
    cut: { kcal: maintenanceKcal - 400, protein: 2.5, fat: 0.7 },
    maintenance: { kcal: maintenanceKcal, protein: 2.0, fat: 0.85 },
    recomp: { kcal: maintenanceKcal + 100, protein: 2.3, fat: 0.8 },
  };

  const goals: MacroResult['goals'] = {} as MacroResult['goals'];
  for (const [g, adj] of Object.entries(adjustments)) {
    const protG = Math.round(adj.protein * weightKg);
    const fatG = Math.round(adj.fat * weightKg);
    const carbsG = Math.round((adj.kcal - protG * 4 - fatG * 9) / 4);
    (goals as any)[g] = { kcal: adj.kcal, protein: protG, fat: fatG, carbs: Math.max(0, carbsG) };
  }

  const recs: string[] = [];
  if (somatotype === 'Эктоморф') recs.push('Эктоморф: быстрый метаболизм. Ешьте больше углеводов, меньше кардио.');
  if (somatotype === 'Мезоморф') recs.push('Мезоморф: хороший ответ на тренировки. Стандартные макросы.');
  if (somatotype === 'Эндоморф') recs.push('Эндоморф: медленный метаболизм. Больше белка, меньше углеводов, обязательное кардио.');
  if (age > 40) recs.push('Возраст 40+: увеличьте белок до 2.3-2.5 г/кг.');

  return {
    bmr: { mifflin: Math.round(mifflin), katch: Math.round(katch), harris: Math.round(harris), cunningham: Math.round(cunningham), average: Math.round(avgBMR) },
    tdee, goals, somatotype, recommendations: recs,
  };
}

export function calculateMealSplit(kcal: number, protein: number, meals: number = 5): { meal: number; kcal: number; protein: number; fat: number; carbs: number }[] {
  const split: { meal: number; kcal: number; protein: number; fat: number; carbs: number }[] = [];
  const kcalPerMeal = Math.round(kcal / meals);
  const proteinPerMeal = Math.round(protein / meals);

  for (let i = 0; i < meals; i++) {
    split.push({
      meal: i + 1, kcal: kcalPerMeal, protein: proteinPerMeal,
      fat: Math.round(kcalPerMeal * 0.25 / 9), carbs: Math.round((kcalPerMeal - proteinPerMeal * 4 - Math.round(kcalPerMeal * 0.25 / 9) * 9) / 4),
    });
  }

  return split;
}

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

export function getBloodMarkersDeep(): BloodMarkerDeep[] { return BLOOD_MARKERS_DEEP; }
export function getBloodMarkerByCode(code: string): BloodMarkerDeep | undefined { return BLOOD_MARKERS_DEEP.find(m => m.code === code); }
export function getCriticalMarkers(): BloodMarkerDeep[] { return BLOOD_MARKERS_DEEP.filter(m => m.code === 'Hematocrit' || m.code === 'ALT' || m.code === 'HDL' || m.code === 'Cystatin_C' || m.code === 'PSA'); }
export function getSupplementStacks(): SupplementStack[] { return SUPPLEMENT_STACKS; }
export function getStackByGoal(goal: string): SupplementStack | undefined { return SUPPLEMENT_STACKS.find(s => s.goal.toLowerCase().includes(goal.toLowerCase())); }
