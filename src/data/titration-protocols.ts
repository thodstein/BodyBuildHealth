// ════════════════════════════════════════════════════════════════════════════
//  TITRATION-PROTOCOLS — пошаговая титрация с привязкой к анализам
//
//  Каждый протокол: старт → шаги титрации → целевые лабы → стоп-условия
// ════════════════════════════════════════════════════════════════════════════

export interface TitrationStep {
  dose: string;
  duration: string;         // «5 дней», «2 недели»
  trigger?: string;          // условие перехода к следующему шагу
  labs?: string;             // какие анализы сдать перед переходом
  labTarget?: string;        // целевое значение лаб
}

export interface TitrationProtocol {
  substanceId: string;
  name: string;
  startDose: string;
  maxDose: string;
  steps: TitrationStep[];
  stopConditions: string[];
  monitorLabs: string[];     // список маркёров для контроля
  frequency: string;         // как часто сдавать анализы
  flushWarning?: string;
  cycleBreaks?: string;
  note?: string;
}

export const TITRATION_PROTOCOLS: Record<string, TitrationProtocol> = {

  anastrozole: {
    substanceId: 'anastrozole',
    name: 'Анастрозол (AI)',
    startDose: '0.25 мг 2×/нед',
    maxDose: '1 мг/день',
    steps: [
      { dose: '0.25 мг 2×/нед', duration: '10-14 дней', trigger: 'Старт при любом test-курсе', labs: 'E2, Estradiol', labTarget: '20-40 pg/mL' },
      { dose: '0.5 мг 2×/нед', duration: '10-14 дней', trigger: 'E2 > 40 pg/mL', labs: 'E2', labTarget: '20-40 pg/mL' },
      { dose: '1 мг/день', duration: 'на усмотрение', trigger: 'E2 > 60 pg/mL на 0.5 мг', labs: 'E2, lipid panel (HDL)', labTarget: 'E2 20-40, HDL > 0.8' },
    ],
    stopConditions: [
      'E2 < 20 pg/mL → STOP AI, повторить через 7 дней',
      'Суставы болят/хрустят → ↓ AI dose (E2 слишком низко)',
      'Сильное ↓ либидо/депрессия → ↓ AI (E2 критически низко)',
      'HDL < 0.6 mmol/L → рассмотреть снижение AI',
    ],
    monitorLabs: ['E2', 'HDL', 'LDL', 'Тестостерон общий', 'Свободный T'],
    frequency: 'E2 каждые 10-14 дней до стабилизации, затем 1×/мес',
    note: '⚠ ТОЛЬКО ПОД КОНТРОЛЕМ АНАЛИЗОВ. Anadrol — AI НЕ работает, нужен SERM (tamoxifen).',
  },

  cabergoline: {
    substanceId: 'cabergoline',
    name: 'Каберголин (D2-агонист)',
    startDose: '0.125 мг 2×/нед',
    maxDose: '0.5 мг 2×/нед',
    steps: [
      { dose: '0.125 мг 2×/нед', duration: '14 дней', trigger: 'Старт при пролактине >15 на трен/нандрон/болден', labs: 'Пролактин', labTarget: '<15 ng/mL' },
      { dose: '0.25 мг 2×/нед', duration: '14 дней', trigger: 'Пролактин >15 нa 0.125 мг', labs: 'Пролактин', labTarget: '<15 ng/mL' },
      { dose: '0.5 мг 2×/нед', duration: '14 дней', trigger: 'Пролактин >25 на 0.25 мг', labs: 'Пролактин, ЭКГ (клапаны)', labTarget: '<15 ng/mL' },
    ],
    stopConditions: [
      'Пролактин < 5 ng/mL → STOP или ↓ до 0.125 мг',
      'Брадикардия (ЧСС <50) → ↓ или STOP',
      'Гипотония (АД <100/60) → ↓ или STOP',
      'Клапанная регургитация (ЭКГ) → STOP немедленно',
      'Импульсивность/агрессия/gambling → STOP (D2-дисрегуляция)',
    ],
    monitorLabs: ['Пролактин', 'ЧСС', 'АД', 'ЭКГ (клапаны)'],
    frequency: 'Пролактин каждые 14 дней до стабилизации, ЭКГ 1×/мес',
    note: '⚠ ТОЛЬКО ПОД КОНТРОЛЕМ АНАЛИЗОВ. При ≥0.5 мг — ЭКГ для клапанов.',
  },

  niacin: {
    substanceId: 'niacin',
    name: 'Ниацин (B3)',
    startDose: '100 мг на ночь',
    maxDose: '1500 мг на ночь',
    steps: [
      { dose: '100 мг на ночь', duration: '5 дней', trigger: 'Старт при HDL < 1.0 или LDL > 3.5' },
      { dose: '250 мг на ночь', duration: '5 дней', trigger: 'Переносим 100 мг — ↑' },
      { dose: '500 мг на ночь', duration: '5 дней', trigger: 'Переносим 250 мг', labs: 'HDL, LDL, Glucose, Uric acid' },
      { dose: '1000 мг на ночь', duration: 'поддержание', trigger: 'HDL не достиг цели + переносим', labs: 'HDL, LDL, Glucose, Uric acid, ALT', labTarget: 'HDL > 1.0' },
      { dose: '1500 мг на ночь', duration: 'крайний случай', trigger: 'HDL < 0.6 несмотря на 1000 мг', labs: 'Full panel + CK', labTarget: 'HDL > 0.8' },
    ],
    stopConditions: [
      '↑ Uric acid > 480 (подагра) → STOP или ↓ + allopurinol (через врача)',
      'Glucose ↑↑ (loss glycemic control) → пересмотреть',
      'ALT > 100 на ниацине → STOP (гепато)',
      'Прошивающий флаш не проходит за 4 нед → экстендир форма (Slo-Niacin)',
    ],
    monitorLabs: ['HDL', 'LDL', 'Glucose', 'Uric acid', 'ALT', 'CK (если на статине)'],
    frequency: 'Липиды + glucose каждые 4 нед до стабилизации, затем 1×/3 мес',
    flushWarning: 'Профилактика флаша: 100 мг аспирина за 30 мин до + с жирной едой. Флаш проходит за 2-4 нед.',
    note: '↑HDL 15-35%, ↓LDL 5-25%, ↓TG 20-50%. Niacinamide — НЕ альтернатива (нет липидного эффекта).',
  },

  metformin: {
    substanceId: 'metformin',
    name: 'Метформин (Glucophage XR)',
    startDose: '250 мг × 2/день',
    maxDose: '2000 мг/день',
    steps: [
      { dose: '250 мг после завтрака + 250 мг после ужина', duration: '7 дней', trigger: 'Старт при HbA1c > 5.8 или GH > 6 МЕ/день или инсулин > 15 МЕ/день' },
      { dose: '500 мг × 2/день', duration: '7 дней', trigger: 'Переносим 250 мг — ↑' },
      { dose: '500 мг завтрак + 1000 мг ужин (XR)', duration: 'поддержание', trigger: 'Переносим 1000 мг', labs: 'HbA1c, Glucose, eGFR', labTarget: 'HbA1c < 5.7, Glucose < 5.6' },
      { dose: '1000 мг × 2/день (XR)', duration: 'крайний', trigger: 'HbA1c > 6.0 на 1500 мг', labs: 'HbA1c, eGFR, Lactate' },
    ],
    stopConditions: [
      'eGFR < 30 → STOP (лактоацидоз)',
      'Контрастное исследование → STOP за 48 ч до и 48 ч после',
      'Lactate > 5 mmol/L → STOP немедленно',
      'ЖКТ непереносимость (диарея, nausea) — ↓ доза или STOP → berberine',
    ],
    monitorLabs: ['HbA1c', 'Glucose', 'eGFR', 'Lactate (редко)', 'B12 (длительно ↓)'],
    frequency: 'HbA1c 1×/3 мес, eGFR 1×/3 мес, B12 1×/год',
    note: '⚠ Через врача. XR форма (пролонг) лучше переносится. B12 ↓ при длительном приёме.',
  },

  berberine: {
    substanceId: 'berberine',
    name: 'Берберин (AMPK-активатор)',
    startDose: '500 мг × 2/день',
    maxDose: '2000 мг/день',
    steps: [
      { dose: '500 мг с едой × 2/день', duration: '7 дней', trigger: 'Старт при glucose↑, IR, GH-курс' },
      { dose: '500 мг × 3/день или 1000 мг × 2/день', duration: 'поддержание', trigger: 'Переносим 1000 мг', labs: 'HbA1c, Glucose, Insulin', labTarget: 'HbA1c < 5.7' },
      { dose: '1000 мг × 2/день', duration: 'max', trigger: 'Glucose > 6.1 на 1500 мг', labs: 'HbA1c, Glucose', labTarget: 'HbA1c < 5.7' },
    ],
    stopConditions: [
      '8 нед ON → 2 нед OFF (tolerance / microbiome reset)',
      'Glucose < 3.9 на берерине + инсулин → ↓ доза',
      'ЖКТ побочки (запор/диарея) — ↓ или с едой обязательно',
    ],
    monitorLabs: ['HbA1c', 'Glucose', 'Insulin'],
    frequency: 'Glucose 1×/нед (самоконтроль), HbA1c 1×/3 мес',
    cycleBreaks: '8 нед ON → 2 нед OFF',
    note: 'Эффект ≈ metformin. С пиперином ↑ биодоступность 10×.',
  },

  telmisartan: {
    substanceId: 'telmisartan',
    name: 'Тельмисартан (ARB)',
    startDose: '20 мг/утро',
    maxDose: '80 мг/утро',
    steps: [
      { dose: '20 мг/утро', duration: '7 дней', trigger: 'Старт на курсе', labs: 'АД утро/вечер', labTarget: '<130/85' },
      { dose: '40 мг/утро', duration: '7 дней', trigger: 'АД > 130/85 на 20 мг', labs: 'АД, K⁺', labTarget: '<130/85' },
      { dose: '60 мг/утро', duration: '7 дней', trigger: 'АД > 140/90 на 40 мг', labs: 'АД, K⁺', labTarget: '<130/85' },
      { dose: '80 мг/утро', duration: 'поддержание', trigger: 'АД > 140/90 на 60 мг', labs: 'АД, K⁺, Creatinine', labTarget: '<130/85' },
    ],
    stopConditions: [
      'АД < 100/60 (гипотония) → ↓ или STOP',
      'K⁺ > 5.5 → STOP (гиперкалиемия)',
      'Двусторонний стеноз почечной артерии → STOP',
      'Беременность → STOP немедленно',
    ],
    monitorLabs: ['АД (самоконтроль 2×/день)', 'K⁺', 'Creatinine', 'eGFR'],
    frequency: 'АД ежедневно 1 нед, затем 1×/нед. K⁺ 1×/мес.',
    note: 'Лучший ARB на курсе: PPAR-γ активация (↓ IR). НЕ снижает VO₂max.',
  },

  tadalafil: {
    substanceId: 'tadalafil',
    name: 'Тадалафил (PDE5i)',
    startDose: '5 мг/утро',
    maxDose: '20 мг/день (10 мг on-demand)',
    steps: [
      { dose: '5 мг/утро (daily)', duration: 'постоянно', trigger: 'Простата + BP + NO-путь на курсе', labs: 'АД', labTarget: 'без гипотонии' },
      { dose: '10 мг on-demand', duration: 'за 30 мин до', trigger: 'Сексуальная активность (ED)', labs: '', labTarget: '≈36 ч эффект' },
    ],
    stopConditions: [
      'Нитраты (грибочки, нитроглицерин) → STOP за 48 ч',
      'α-блокеры (доксазозин) → STOP или разнести на 4+ ч',
      'Приапизм (>4 ч эрекция) → ER немедленно',
      'Внезапная потеря зрения → STOP (NAION risk)',
      'Внезапная потеря слуха → STOP',
    ],
    monitorLabs: ['АД'],
    frequency: 'АД при старте, потом 1×/мес',
    note: '5 мг/день — простата, BP, NO. ⛔ НЕ комбинировать с нитратами!',
  },

  milk_thistle: {
    substanceId: 'milk_thistle',
    name: 'Силимарин (Легалон)',
    startDose: '280 мг/день',
    maxDose: '800 мг/день',
    steps: [
      { dose: '280 мг (1 таб Легалон 140 × 2/день)', duration: 'постоянно', trigger: 'Старт при курсе AAS (профилактика)', labs: 'ALT, AST' },
      { dose: '420 мг (3 таб/день)', duration: 'на отклонении', trigger: 'ALT > 40', labs: 'ALT, AST, GGT' },
      { dose: '600 мг (4 таб/день)', duration: 'лечение', trigger: 'ALT > 80', labs: 'ALT, AST, GGT, Bilirubin', labTarget: 'ALT < 40' },
    ],
    stopConditions: [
      'Аллергическая реакция → STOP',
      '8-12 нед ON → 2-4 нед OFF (восстановление ферментов)',
    ],
    monitorLabs: ['ALT', 'AST', 'GGT'],
    frequency: 'АЛТ 1×/мес на курсе',
    note: 'С лецитином ↑ всасывание ×8 (Meriva форма).',
  },

  tudca: {
    substanceId: 'tudca',
    name: 'TUDCA (тауро-UDCA)',
    startDose: '500 мг/день',
    maxDose: '2000 мг/день',
    steps: [
      { dose: '500 мг/день', duration: 'постоянно на курсе', trigger: 'Базовая гепатопротекция', labs: 'ALT, AST' },
      { dose: '1000 мг/день', duration: 'лечение', trigger: 'ALT > 60 или оральные AAS', labs: 'ALT, AST, GGT, Bili', labTarget: 'ALT < 40' },
      { dose: '1500-2000 мг/день', duration: 'тяжёлая', trigger: 'ALT > 120 или холестаз (GGT↑↑, Bili↑)', labs: 'Full LFT panel', labTarget: '↓ тренд' },
    ],
    stopConditions: [
      'Полная обструкция жёлчных путей → STOP (острая)',
      'Острый холецистит → STOP + хирург',
      'Диарея (часто при >1000 мг) → ↓ доза',
    ],
    monitorLabs: ['ALT', 'AST', 'GGT', 'Bilirubin', 'ЩФ'],
    frequency: 'LFT 1×/мес на курсе, 2×/мес при оральных',
    note: 'TUDCA 50% BA vs UDCA 90%. В аптечных формах — УДХК (Урсосан). Натощак за 30 мин до еды.',
  },

  vitamin_d3: {
    substanceId: 'vitamin_d3',
    name: 'Витамин D3',
    startDose: '5000 МЕ/день',
    maxDose: '20000 МЕ/день (под контролем)',
    steps: [
      { dose: '5000 МЕ/день + K2 100 мкг', duration: '12 недель', trigger: 'Базовая доза', labs: '25-OH-D3', labTarget: '40-60 ng/mL' },
      { dose: '10000 МЕ/день + K2 200 мкг', duration: '8 недель', trigger: '25-OH-D3 < 30 ng/mL', labs: '25-OH-D3', labTarget: '40-60' },
      { dose: '20000 МЕ/день + K2 200 мкг', duration: '4-8 недель', trigger: '25-OH-D3 < 15 ng/mL', labs: '25-OH-D3, Ca²⁺', labTarget: '40-60, Ca < 2.6' },
    ],
    stopConditions: [
      '25-OH-D3 > 100 ng/mL → STOP (токсичность)',
      'Ca²⁺ > 2.6 mmol/L → STOP (гиперкальциемия)',
      '25-OH-D3 в цели (40-60) → снизить до 2000-4000 МЕ/день',
    ],
    monitorLabs: ['25-OH-D3', 'Ca²⁺', 'PTH'],
    frequency: '25-OH-D3 через 12 нед после старта, затем 2×/год',
    note: 'С K2 ОБЯЗАТЕЛЬНО. С жирной едой. Цель 40-60 ng/mL (не 30).',
  },

  // ─── ДИУРЕТИКИ (отиазидные) ───
  hydrochlorothiazide: {
    substanceId: 'hydrochlorothiazide',
    name: 'Гидрохлоротиазид (тиазидный диуретик)',
    startDose: '12.5 мг/утро',
    maxDose: '25 мг/утро',
    steps: [
      { dose: '12.5 мг/утро', duration: '5-7 дней', trigger: 'Отёки сохраняются → ↑ до 25 мг', labs: 'K⁺, Na⁺, Mg, мочевая кислота', labTarget: 'K⁺ >3.5, Na⁺ >135, Mg >0.7, Uric <420' },
      { dose: '25 мг/утро', duration: '7-14 дней', trigger: 'Отёки ↓↓ → вернуться на 12.5 мг поддержание', labs: 'K⁺, Na⁺, АД', labTarget: 'K⁺ >3.5, АД >100/60' },
    ],
    stopConditions: [
      'K⁺ <3.5 (гипокалиемия)',
      'Na⁺ <130 (гипонатриемия)',
      'АД <90/60 (гипотензия)',
      'Мочевая кислота >480 (острый приступ подагры)',
      'Кожно сыпь/аллергия (сульфаниламид)',
    ],
    monitorLabs: ['K⁺', 'Na⁺', 'Mg', 'Мочевая кислота', 'Глюкоза натощак'],
    frequency: 'K⁺/Na⁺ каждые 2 нед при титрации, затем ежемесячно',
    flushWarning: '⚠ Тиазиды вымывают K⁺/Na⁺/Mg — обязательно восполнение. Калий 200 мг + магний бисглицинат.',
    note: '⚠ через врача. Старт 12.5 мг (половина таблетки 25 мг). Действие через 2 ч, пик 4-6 ч. '
        + 'Принимать утром ( 避免 ночной диурез). Краткий курс 2-4 нед → поддержка натуральной (dandelion).',
  },

  indapamide: {
    substanceId: 'indapamide',
    name: 'Индапамид (тиазидоподобный диуретик)',
    startDose: '1.5 мг/утро',
    maxDose: '2.5 мг/утро',
    steps: [
      { dose: '1.5 мг/утро', duration: '7-10 дней', trigger: 'Отёки сохраняются → ↑ до 2.5 мг', labs: 'K⁺, Na⁺', labTarget: 'K⁺ >3.5, Na⁺ >135' },
      { dose: '2.5 мг/утро', duration: '10-14 дней', trigger: 'Отёки ↓↓ → вернуться на 1.5 мг', labs: 'K⁺, Na⁺, АД', labTarget: 'K⁺ >3.5, АД >100/60' },
    ],
    stopConditions: [
      'K⁺ <3.0 (тяжёлая гипокалиемия)',
      'Na⁺ <130 (гипонатриемия)',
      'АД <90/60 (гипотензия)',
      'Печёночная энцефалопатия',
      'Кожно сыпь/аллергия',
    ],
    monitorLabs: ['K⁺', 'Na⁺', 'Глюкоза натощак'],
    frequency: 'K⁺/Na⁺ каждые 2 нед при титрации, затем ежемесячно',
    flushWarning: 'Индапамид вымывает K⁺ меньше HCTZ, но контроль необходим. Mg бисглицинат 400 мг.',
    note: '⚠ через врача. Дольше T½ (14ч) — более плавный эффект. Меньше гиперурикемии чем HCTZ. '
        + 'Дополнительно: вазодилятация (↑NO в эндотелии). Утро. Курс 2-4 нед.',
  },
};

export function getTitrationProtocol(id: string): TitrationProtocol | null {
  return TITRATION_PROTOCOLS[id] || TITRATION_PROTOCOLS[id.toLowerCase()] || null;
}

export function hasTitration(id: string): boolean {
  return !!getTitrationProtocol(id);
}