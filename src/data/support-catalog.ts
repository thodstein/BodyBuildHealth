// ===========================================================================
// SUPPORT CATALOG — Complete substance database with forms, organs, systems,
// mechanisms, synergies, conflicts, monitoring, contraindications, side effects.
// Each substance has ALL forms grouped (no duplicates), tier classification,
// organ/system mapping, and full interaction data.
// ===========================================================================

export interface SubstanceForm {
  id: string;
  name: string;
  nameRu: string;
  dose: string;
  best: boolean;
  notes?: string;
}

export interface SynergyInfo {
  with: string;
  effect: string;
  mechanism: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ConflictInfo {
  with: string;
  effect: string;
  mechanism: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface MonitoringItem {
  what: string;
  when: string;
  targetRange?: string;
}

export interface SupportCatalogEntry {
  id: string;
  name: string;
  nameRu: string;
  tier: 'core' | 'standard' | 'advanced' | 'specialty';
  category: string[];
  forms: SubstanceForm[];
  organs: string[];
  systems: string[];
  mechanisms: string[];
  description: string;
  synergies: SynergyInfo[];
  conflicts: ConflictInfo[];
  monitoring: MonitoringItem[];
  contraindications: string[];
  sideEffects: string[];
  dosage: { mg: number; timing: string; form?: string };
  bestForCourse: boolean;
}

export const ORGAN_LABELS: Record<string, string> = {
  LIVER: '🫁 Печень', KIDNEYS: '🫘 Почки', HEART: '❤️ Сердце', VESSELS: '🩸 Сосуды',
  BRAIN: '🧠 Мозг', NERVES: '⚡ Нервы', LUNGS: '🫁 Лёгкие', SKIN: '🧴 Кожа',
  EYES: '👁️ Глаза', IMMUNE_SYSTEM: '🛡️ Иммунитет', REPRODUCTIVE: '🧬 Репродуктивная',
  MUSCLES: '💪 Мышцы', BONES: '🦴 Кости', JOINTS: '🦴 Суставы', PANCREAS: '🫁 Поджелудочная',
  THYROID: '🦋 Щитовидная', ADRENALS: '⚖️ Надпочечники', STOMACH: '🫁 Желудок',
  INTESTINES: '🫁 Кишечник', BLOOD: '🩸 Кровь', PROSTATE: '🔴 Простата',
};

export const SYSTEM_LABELS_CATALOG: Record<string, string> = {
  hepatic: '🫁 Печень', cardio: '❤️ ССС', renal: '🫘 Почки', neuro: '🧠 Нервная',
  endocrine: '⚖️ Эндокринная', hematologic: '🩸 Кровь', reproductive: '🧬 Репродуктивная',
  musculoskeletal: '💪 Опорно-двигательная', immune: '🛡️ Иммунитет', metabolic: '⚡ Метаболизм',
};

export const CATEGORY_LABELS: Record<string, string> = {
  antioxidant: '🛡️ Антиоксидант', hepatoprotector: '🫁 Гепатопротектор', cardioprotector: '❤️ Кардиопротектор',
  mineral: '💊 Минерал', vitamin: '💊 Витамин', amino: '🧬 Аминокислота', fatty_acid: '🐟 ЖК',
  adaptogen: '🌿 Адаптоген', antiinflammatory: '🔥 Противовоспалительное', probiotic: '🦠 Пробиотик',
  choleretic: '🫁 Желчегонное', respiratory: '🫁 Дыхательная', neuroprotector: '🧠 Нейропротектор',
  renoprotector: '🫘 Нефропротектор', joint: '🦴 Суставное', hormonal: '⚖️ Гормональное',
  peptide: '🧬 Пептид', pharma: '💊 Фармакология', herb: '🌿 Трава', nootropic: '🧠 Ноотроп',
  immunomodulator: '🛡️ Иммуномодулятор', anabolic: '💪 Анаболическое', metabolic: '⚡ Метаболическое',
};

export const TIER_LABELS_CATALOG: Record<string, { label: string; emoji: string; color: string; desc: string }> = {
  core: { label: 'Ядро', emoji: '🟢', color: '#22c55e', desc: 'Обязательно на любом курсе' },
  standard: { label: 'Стандарт', emoji: '🟡', color: '#eab308', desc: 'Рекомендовано при дозах >500 мг/нед' },
  advanced: { label: 'Продвинутый', emoji: '🟠', color: '#f97316', desc: 'При специфических целях и условиях' },
  specialty: { label: 'Специальный', emoji: '🔴', color: '#ef4444', desc: 'Фармакология, рецептурные препараты' },
};


export const SUPPORT_CATALOG_DATA: Record<string, SupportCatalogEntry> = {
  nac: {
    id: "nac",
    name: "NAC",
    nameRu: "N-Ацетилцистеин",
    tier: "core",
    category: [
      "antioxidant",
      "hepatoprotector",
      "respiratory"
    ],
    forms: [
      {
        id: "nac",
        name: "NAC 600mg",
        nameRu: "NAC 600 мг",
        dose: "600 мг натощак",
        best: true
      },
      {
        id: "AA_NAC",
        name: "NAC Premium",
        nameRu: "NAC Премиум",
        dose: "600 мг 2x/д",
        best: false
      },
      {
        id: "AA_NAC_PREMIUM",
        name: "NAC Premium+",
        nameRu: "NAC Премиум+",
        dose: "900 мг натощак",
        best: false
      }
    ],
    organs: [
      "LIVER",
      "LUNGS",
      "KIDNEYS",
      "BRAIN"
    ],
    systems: [
      "hepatic",
      "neuro",
      "renal"
    ],
    mechanisms: [
      "GLUTATHIONE_SYNTHESIS",
      "MUCOLYTIC",
      "ANTIOXIDANT",
      "DETOXIFICATION"
    ],
    description: "N-Ацетилцистеин — предшественник глутатиона, главного антиоксиданта организма. Разжижает слизь, защищает печень от токсинов, снижает окислительный стресс. Обязателен на любом курсе.",
    synergies: [
      {
        with: "vitamin_c",
        effect: "Регенерация глутатиона",
        mechanism: "Витамин C восстанавливает окисленный глутатион",
        severity: "HIGH"
      },
      {
        with: "alpha_lipoic",
        effect: "Усиление антиоксидантной сети",
        mechanism: "АЛЬК регенерирует глутатион и витамин C",
        severity: "HIGH"
      },
      {
        with: "selenium",
        effect: "Глутатионпероксидаза",
        mechanism: "Селен — кофактор GPx",
        severity: "MEDIUM"
      },
      {
        with: "milk_thistle",
        effect: "Синергия гепатопротекции",
        mechanism: "Разные механизмы защиты гепатоцитов",
        severity: "MEDIUM"
      }
    ],
    conflicts: [
      {
        with: "charcoal",
        effect: "Снижение абсорбции",
        mechanism: "Активированный уголь связывает NAC",
        severity: "MEDIUM"
      },
      {
        with: "nitroglycerin",
        effect: "Гипотония",
        mechanism: "Усиление вазодилатации",
        severity: "HIGH"
      }
    ],
    monitoring: [
      {
        what: "АЛТ/АСТ",
        when: "Каждые 4 нед",
        targetRange: "<40 Ед/л"
      },
      {
        what: "ГГТП",
        when: "Каждые 6 нед",
        targetRange: "<50 Ед/л"
      }
    ],
    contraindications: [
      "Язвенная болезнь",
      "Бронхиальная астма (с осторожностью)"
    ],
    sideEffects: [
      "Тошнота натощак",
      "Изжога",
      "Редко: кожная сыпь"
    ],
    dosage: {
      mg: 1200,
      timing: "натощак, 2x/д",
      form: "капсулы"
    },
    bestForCourse: true
  },
  tudca: {
    id: "tudca",
    name: "TUDCA",
    nameRu: "Тауроурсодезоксихолевая кислота",
    tier: "core",
    category: [
      "hepatoprotector",
      "bile_acid",
      "choleretic"
    ],
    forms: [
      {
        id: "tudca",
        name: "TUDCA 250mg",
        nameRu: "TUDCA 250 мг",
        dose: "500 мг перед едой 2x/д",
        best: true
      }
    ],
    organs: [
      "LIVER",
      "GALLBLADDER",
      "KIDNEYS"
    ],
    systems: [
      "hepatic",
      "renal"
    ],
    mechanisms: [
      "BILE_FLOW_STIMULATION",
      "MITOCHONDRIAL_PROTECTION",
      "ER_STRESS_REDUCTION",
      "ANTI_APOPTOTIC"
    ],
    description: "TUDCA — урсодезоксихолевая кислота с таурином. Стимулирует желчеотток, защищает митохондрии гепатоцитов, подавляет ER-стресс. Один из важнейших гепатопротекторов.",
    synergies: [
      {
        with: "milk_thistle",
        effect: "Синергия гепатопротекции",
        mechanism: "Силимарин стабилизирует мембраны, TUDCA стимулирует желчеотток",
        severity: "HIGH"
      },
      {
        with: "phosphatidylcholine",
        effect: "Защита мембран",
        mechanism: "ФХ + TUDCA = комплексная защита гепатоцитов",
        severity: "MEDIUM"
      },
      {
        with: "nac",
        effect: "Комплексная защита печени",
        mechanism: "NAC повышает глутатион, TUDCA защищает желчные пути",
        severity: "MEDIUM"
      }
    ],
    conflicts: [],
    monitoring: [
      {
        what: "АЛТ/АСТ",
        when: "Каждые 4 нед",
        targetRange: "<40 Ед/л"
      },
      {
        what: "ГГТП",
        when: "Каждые 4 нед",
        targetRange: "<50 Ед/л"
      },
      {
        what: "Билирубин",
        when: "Каждые 6 нед",
        targetRange: "<20 мкмоль/л"
      }
    ],
    contraindications: [
      "Желчнокаменная болезнь (с осторожностью)",
      "Острый холецистит",
      "Обструкция желчных путей"
    ],
    sideEffects: [
      "Диарея при высоких дозах",
      "Редко: боли в правом подреберье"
    ],
    dosage: {
      mg: 1000,
      timing: "перед едой, 2x/д",
      form: "капсулы"
    },
    bestForCourse: true
  },
  magnesium: {
    id: "magnesium",
    name: "Magnesium",
    nameRu: "Магний",
    tier: "core",
    category: [
      "mineral",
      "neuroprotector",
      "cardioprotector"
    ],
    forms: [
      {
        id: "magnesium",
        name: "Magnesium Bisglycinate",
        nameRu: "Магний бисглицинат",
        dose: "400 мг на ночь",
        best: true
      },
      {
        id: "MIN_MG_CITRATE",
        name: "Magnesium Citrate",
        nameRu: "Магний цитрат",
        dose: "400 мг",
        best: false
      },
      {
        id: "MIN_MG_THREONATE",
        name: "Magnesium L-Threonate",
        nameRu: "Магний L-треонат",
        dose: "200 мг (для мозга)",
        best: false
      },
      {
        id: "MIN_MG_MALATE",
        name: "Magnesium Malate",
        nameRu: "Магний малат",
        dose: "400 мг (для мышц)",
        best: false
      },
      {
        id: "MIN_MG_OXIDE",
        name: "Magnesium Oxide",
        nameRu: "Магний оксид",
        dose: "400 мг (низкая усвояемость)",
        best: false,
        notes: "Низкая биодоступность (~4%)"
      }
    ],
    organs: [
      "BRAIN",
      "HEART",
      "MUSCLES",
      "NERVES"
    ],
    systems: [
      "neuro",
      "cardio",
      "musculoskeletal"
    ],
    mechanisms: [
      "GABA_RECEPTOR_MODULATION",
      "NMDA_ANTAGONISM",
      "MUSCLE_RELAXATION",
      "ATP_PRODUCTION",
      "INSULIN_SENSITIVITY",
      "BLOOD_PRESSURE_REGULATION"
    ],
    description: "Магний — эссенциальный минерал, участвующий в 300+ ферментных реакциях. Успокаивает нервную систему (GABA), расслабляет мышцы, снижает давление, улучшает сон. Бисглицинат — лучшая форма.",
    synergies: [
      {
        with: "vitamin_b6",
        effect: "Улучшение усвоения Mg",
        mechanism: "B6 усиливает транспорт Mg в клетки",
        severity: "MEDIUM"
      },
      {
        with: "taurine",
        effect: "Синергия расслабления",
        mechanism: "Таурин + Mg = кардиопротекция и расслабление мышц",
        severity: "MEDIUM"
      },
      {
        with: "vitamin_d3",
        effect: "Взаимное усвоение",
        mechanism: "Mg необходим для активации витамина D",
        severity: "MEDIUM"
      },
      {
        with: "zinc",
        effect: "Баланс минералов",
        mechanism: "Сбалансированный приём Zn и Mg",
        severity: "LOW"
      }
    ],
    conflicts: [
      {
        with: "calcium_high",
        effect: "Конкуренция за всасывание",
        mechanism: "Ca и Mg конкурируют за транспортёры",
        severity: "LOW"
      },
      {
        with: "iron",
        effect: "Раздельный приём",
        mechanism: "Mg снижает всасывание железа при одновременном приёме",
        severity: "LOW"
      }
    ],
    monitoring: [
      {
        what: "Магний сыворотки",
        when: "Каждые 8 нед",
        targetRange: "0.75-0.95 ммоль/л"
      },
      {
        what: "Магний эритроцитов",
        when: "При возможности",
        targetRange: ">1.8 ммоль/л"
      }
    ],
    contraindications: [
      "Тяжёлая почечная недостаточность (ClCr<30)",
      "Атриовентрикулярная блокада"
    ],
    sideEffects: [
      "Диарея при высоких дозах (цитрат/оксид)",
      "Сонливость при приёме на ночь"
    ],
    dosage: {
      mg: 400,
      timing: "на ночь (бисглицинат)",
      form: "бисглицинат"
    },
    bestForCourse: true
  },
  coq10: {
    id: 'coq10', name: 'CoQ10 (Ubiquinol)', nameRu: 'Коэнзим Q10 (Убихинол)',
    tier: 'core', category: ['antioxidant', 'cardioprotector', 'mitochondrial'],
    forms: [
      { id: 'coq10', name: 'Ubiquinol 200mg', nameRu: 'Убихинол 200 мг', dose: '200 мг с едой', best: true },
      { id: 'AO_COQ10_UBIQUINONE', name: 'Ubiquinone', nameRu: 'Убихинон 200 мг', dose: '200 мг с едой', best: false, notes: 'Менее биодоступен' },
      { id: 'AO_COQ10_MQ10', name: 'MitoQ', nameRu: 'MitoQ 10 мг', dose: '10 мг', best: false, notes: 'Целевая доставка в митохондрии' },
    ],
    organs: ['HEART', 'KIDNEYS', 'LIVER', 'MUSCLES'],
    systems: ['cardio', 'renal', 'hepatic'],
    mechanisms: ['ELECTRON_TRANSPORT_CHAIN', 'ANTIOXIDANT', 'ATP_PRODUCTION', 'MEMBRANE_STABILIZATION'],
    description: 'Коэнзим Q10 — ключевой компонент дыхательной цепи митохондрий. Защищает сердце от окислительного стресса, поддерживает продукцию АТФ. Обязателен при приёме ААС.',
    synergies: [
      { with: 'selenium', effect: 'Защита митохондрий', mechanism: 'Se — кофактор GPx', severity: 'MEDIUM' },
      { with: 'alpha_lipoic', effect: 'Регенерация CoQ10', mechanism: 'АЛЬК регенерирует окисленный CoQ10', severity: 'HIGH' },
      { with: 'omega3', effect: 'Кардиопротекция', mechanism: 'Разные механизмы защиты миокарда', severity: 'MEDIUM' },
    ],
    conflicts: [
      { with: 'warfarin', effect: 'Снижение антикоагулянтного эффекта', mechanism: 'CoQ10 структурно похож на витамин K', severity: 'MEDIUM' },
    ],
    monitoring: [
      { what: 'CoQ10 сыворотки', when: 'Каждые 12 нед', targetRange: '>0.5 мкг/мл' },
    ],
    contraindications: ['Приём варфарина (конфликт)', 'Гипотония (с осторожностью)'],
    sideEffects: ['Редко: тошнота при приёме натощак', 'Редко: бессонница при вечернем приёме'],
    dosage: { mg: 200, timing: 'с едой (убихинол)', form: 'убихинол' },
    bestForCourse: true,
  },
  vitamin_d3: {
    id: 'vitamin_d3', name: 'Vitamin D3', nameRu: 'Витамин D3',
    tier: 'core', category: ['vitamin', 'hormonal', 'immunomodulator'],
    forms: [
      { id: 'vitamin_d3', name: 'Vitamin D3 5000 IU', nameRu: 'Витамин D3 5000 МЕ', dose: '5000 МЕ с едой', best: true },
      { id: 'VIT_D3_LIP', name: 'Vitamin D3 Liposomal', nameRu: 'Липосомальный D3 5000 МЕ', dose: '5000 МЕ', best: false, notes: 'Лучшая биодоступность' },
    ],
    organs: ['BONES', 'IMMUNE_SYSTEM', 'THYROID', 'REPRODUCTIVE'],
    systems: ['endocrine', 'hepatic', 'hematologic'],
    mechanisms: ['VDR_RECEPTOR_ACTIVATION', 'CALCIUM_REGULATION', 'IMMUNE_MODULATION', 'TESTOSTERONE_SYNTHESIS'],
    description: 'Витамин D3 — прогормон, регулирующий кальций, иммунитет и гормональный баланс. 80% населения в дефиците. Критически важен на курсе ААС.',
    synergies: [
      { with: 'vitamin_k2', effect: 'Направление Ca в кости', mechanism: 'K2 активирует остеокальцин', severity: 'HIGH' },
      { with: 'magnesium', effect: 'Активация D3', mechanism: 'Mg необходим для конвертации D3 в 25-OH-D', severity: 'HIGH' },
      { with: 'zinc', effect: 'Усиление иммунитета', mechanism: 'Синергичная модуляция иммунного ответа', severity: 'MEDIUM' },
    ],
    conflicts: [
      { with: 'calcium_high', effect: 'Гиперкальциемия', mechanism: 'D3 увеличивает абсорбцию Ca', severity: 'LOW' },
    ],
    monitoring: [
      { what: '25(OH)D', when: 'Каждые 8 нед', targetRange: '50-80 нг/мл' },
      { what: 'Кальций общий', when: 'Каждые 12 нед', targetRange: '2.1-2.55 ммоль/л' },
    ],
    contraindications: ['Гиперкальциемия', 'Саркоидоз', 'Гиперпаратиреоз'],
    sideEffects: ['Гиперкальциемия при передозировке', 'Тошнота при высоких дозах'],
    dosage: { mg: 5000, timing: 'с едой (МЕ)', form: 'капсулы' },
    bestForCourse: true,
  },
  zinc: {
    id: 'zinc', name: 'Zinc', nameRu: 'Цинк',
    tier: 'core', category: ['mineral', 'immunomodulator', 'hormonal'],
    forms: [
      { id: 'zinc', name: 'Zinc Picolinate 30mg', nameRu: 'Цинк пиколинат 30 мг', dose: '30 мг на ночь', best: true },
      { id: 'MIN_ZN_BISGLYCINATE', name: 'Zinc Bisglycinate', nameRu: 'Цинк бисглицинат 30 мг', dose: '30 мг', best: false },
      { id: 'MIN_ZN_CITRATE', name: 'Zinc Citrate', nameRu: 'Цинк цитрат 30 мг', dose: '30 мг', best: false },
    ],
    organs: ['REPRODUCTIVE', 'IMMUNE_SYSTEM', 'SKIN', 'PROSTATE'],
    systems: ['reproductive', 'endocrine', 'hematologic'],
    mechanisms: ['TESTOSTERONE_SYNTHESIS', 'AR_RECEPTOR_MODULATION', 'IMMUNE_CELL_PROLIFERATION', 'WOUND_HEALING'],
    description: 'Цинк — эссенциальный микроэлемент для синтеза тестостерона, иммунитета и репродукции. Пиколинат — лучшая форма для усвоения.',
    synergies: [
      { with: 'vitamin_c', effect: 'Улучшение всасывания', mechanism: 'Витамин C усиливает абсорбцию цинка', severity: 'MEDIUM' },
      { with: 'vitamin_d3', effect: 'Усиление иммунитета', mechanism: 'Синергичная модуляция иммунного ответа', severity: 'MEDIUM' },
      { with: 'selenium', effect: 'Защита простаты', mechanism: 'Zn + Se = защита от окислительного стресса', severity: 'MEDIUM' },
    ],
    conflicts: [
      { with: 'copper', effect: 'Дисбаланс Zn/Cu', mechanism: 'Высокий Zn истощает медь при длительном приёме', severity: 'MEDIUM' },
      { with: 'iron', effect: 'Конкуренция за всасывание', mechanism: 'Zn и Fe конкурируют за DMT1', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Цинк сыворотки', when: 'Каждые 8 нед', targetRange: '11-18 мкмоль/л' },
      { what: 'Медь сыворотки', when: 'Каждые 12 нед', targetRange: '11-22 мкмоль/л' },
    ],
    contraindications: ['Болезнь Вильсона (медь)', 'Приём медьсодержащих препаратов'],
    sideEffects: ['Тошнота натощак', 'Металлический привкус', 'Дефицит меди при длительном приёме'],
    dosage: { mg: 30, timing: 'на ночь (пиколинат)', form: 'пиколинат' },
    bestForCourse: true,
  },
  selenium: {
    id: 'selenium', name: 'Selenium', nameRu: 'Селен',
    tier: 'core', category: ['mineral', 'antioxidant', 'thyroid'],
    forms: [
      { id: 'selenium', name: 'Selenium Methionine 200mcg', nameRu: 'Селен метионин 200 мкг', dose: '200 мкг с едой', best: true },
      { id: 'MIN_SE_YEAST', name: 'Selenium Yeast', nameRu: 'Селен дрожжевой 200 мкг', dose: '200 мкг', best: false },
    ],
    organs: ['THYROID', 'LIVER', 'IMMUNE_SYSTEM', 'REPRODUCTIVE'],
    systems: ['endocrine', 'hepatic', 'hematologic'],
    mechanisms: ['GPX_SYNTHESIS', 'THYROID_HORMONE_ACTIVATION', 'ANTIOXIDANT', 'DNA_REPAIR'],
    description: 'Селен — кофактор глутатионпероксидазы и дейодиназы щитовидной железы. Критически важен для антиоксидантной защиты и мужской фертильности.',
    synergies: [
      { with: 'vitamin_e', effect: 'Антиоксидантная синергия', mechanism: 'Se (GPx) + вит. E = двойная защита мембран', severity: 'HIGH' },
      { with: 'nac', effect: 'Глутатионовая система', mechanism: 'Se = GPx, NAC = предшественник глутатиона', severity: 'HIGH' },
    ],
    conflicts: [],
    monitoring: [
      { what: 'Селен сыворотки', when: 'Каждые 12 нед', targetRange: '70-150 нг/мл' },
    ],
    contraindications: ['Гипертиреоз (с осторожностью)', 'Приём других селен-содержащих добавок'],
    sideEffects: ['Запах чеснока при передозировке', 'Выпадение волос при >400 мкг/д'],
    dosage: { mg: 200, timing: 'с едой (мкг)', form: 'метионин' },
    bestForCourse: true,
  },
  milk_thistle: {
    id: 'milk_thistle', name: 'Milk Thistle (Silymarin)', nameRu: 'Расторопша (Силимарин)',
    tier: 'core', category: ['hepatoprotector', 'antioxidant', 'herb'],
    forms: [
      { id: 'milk_thistle', name: 'Silymarin 600mg', nameRu: 'Силимарин 600 мг', dose: '600 мг с едой 2x/д', best: true },
      { id: 'AO_SILYMARIN_PHOSPHO', name: 'Silymarin + Phospholipids', nameRu: 'Силимарин + фосфолипиды 300 мг 2x/д', dose: '300 мг 2x/д', best: false, notes: 'Лучшая биодоступность' },
    ],
    organs: ['LIVER', 'GALLBLADDER'],
    systems: ['hepatic'],
    mechanisms: ['MEMBRANE_STABILIZATION', 'ANTIOXIDANT', 'PROTEIN_SYNTHESIS_STIMULATION', 'ANTIFIBROTIC'],
    description: 'Расторопша (силимарин) — стандартизированный экстракт. Стабилизирует мембраны гепатоцитов, подавляет фиброз. Один из основных гепатопротекторов.',
    synergies: [
      { with: 'nac', effect: 'Комплексная гепатопротекция', mechanism: 'NAC = глутатион, силимарин = мембраны', severity: 'HIGH' },
      { with: 'tudca', effect: 'Максимальная гепатопротекция', mechanism: 'TUDCA + силимарин = полный охват', severity: 'HIGH' },
    ],
    conflicts: [],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед', targetRange: '<40 Ед/л' },
    ],
    contraindications: ['Желчнокаменная болезнь (с осторожностью)', 'Аллергия на астровые'],
    sideEffects: ['Редко: диарея', 'Редко: аллергия'],
    dosage: { mg: 600, timing: 'с едой, 2x/д', form: 'капсулы' },
    bestForCourse: true,
  },
  curcumin: {
    id: 'curcumin', name: 'Curcumin + Piperine', nameRu: 'Куркумин + Пиперин',
    tier: 'core', category: ['polyphenol', 'antiinflammatory', 'antioxidant'],
    forms: [
      { id: 'curcumin', name: 'Curcumin + Piperine 1000mg', nameRu: 'Куркумин + Пиперин 1000 мг', dose: '1000 мг с пиперином, с едой', best: true },
      { id: 'PP_CURCUMIN_MERIVA', name: 'Curcumin Meriva (фитосомы)', nameRu: 'Куркумин Мерива 500 мг', dose: '500 мг', best: false, notes: 'Лучшая биодоступность' },
      { id: 'PP_CURCUMIN_THERACURMIN', name: 'Theracurmin', nameRu: 'Теракурмин 300 мг', dose: '300 мг', best: false, notes: 'Максимальная биодоступность' },
    ],
    organs: ['LIVER', 'JOINTS', 'BRAIN', 'INTESTINES'],
    systems: ['hepatic', 'musculoskeletal', 'neuro'],
    mechanisms: ['NF_KB_INHIBITION', 'COX2_INHIBITION', 'ANTIOXIDANT', 'ANTI_FIBROTIC', 'BDNF_INCREASE'],
    description: 'Куркумин — мощный противовоспалительный агент. Ингибирует NF-kB и COX-2. Пиперин увеличивает биодоступность на 2000%. Обязателен для печени и суставов.',
    synergies: [
      { with: 'omega3', effect: 'Противовоспалительная синергия', mechanism: 'COX-2 + резольвины', severity: 'MEDIUM' },
      { with: 'boswellia', effect: 'Суставная синергия', mechanism: '5-LOX + COX-2 = полный путь воспаления', severity: 'MEDIUM' },
      { with: 'vitamin_c', effect: 'Синтез коллагена', mechanism: 'Куркумин подавляет MMP, вит. C стимулирует коллаген', severity: 'LOW' },
    ],
    conflicts: [
      { with: 'anticoagulants', effect: 'Усиление антикоагуляции', mechanism: 'Ингибирование агрегации тромбоцитов', severity: 'MEDIUM' },
      { with: 'piperine_high', effect: 'Взаимодействие с лекарствами', mechanism: 'Пиперин ингибирует CYP3A4', severity: 'HIGH' },
    ],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 6 нед', targetRange: '<40 Ед/л' },
      { what: 'СРБ', when: 'Каждые 8 нед', targetRange: '<5 мг/л' },
    ],
    contraindications: ['Желчнокаменная болезнь', 'Приём антикоагулянтов', 'Беременность'],
    sideEffects: ['Диарея при высоких дозах', 'Редко: аллергия'],
    dosage: { mg: 1000, timing: 'с пиперином, с едой', form: 'капсулы + пиперин' },
    bestForCourse: true,
  },
  ashwagandha: {
    id: 'ashwagandha', name: 'Ashwagandha KSM-66', nameRu: 'Ашваганда KSM-66',
    tier: 'core', category: ['adaptogen', 'antiinflammatory', 'hormonal'],
    forms: [
      { id: 'ashwagandha', name: 'Ashwagandha KSM-66 600mg', nameRu: 'Ашваганда KSM-66 600 мг', dose: '600 мг вечером', best: true },
      { id: 'AD_ASHWAGANDHA_SENSORIL', name: 'Ashwagandha Sensoril 250mg', nameRu: 'Ашваганда Sensoril 250 мг', dose: '250 мг', best: false, notes: 'Больше расслабления' },
    ],
    organs: ['ADRENALS', 'BRAIN', 'THYROID', 'REPRODUCTIVE'],
    systems: ['neuro', 'endocrine', 'reproductive'],
    mechanisms: ['CORTISOL_REDUCTION', 'GABA_RECEPTOR_AGONISM', 'THYROID_T3_INCREASE', 'TESTOSTERONE_SUPPORT'],
    description: 'Ашваганда KSM-66 — адаптоген, снижающий кортизол на 30%, повышающий тестостерон, улучшающий сон.',
    synergies: [
      { with: 'magnesium', effect: 'Синергия кортизол/расслабление', mechanism: 'Максимальное снижение кортизола', severity: 'HIGH' },
      { with: 'taurine', effect: 'Расслабление + кардиопротекция', mechanism: 'Снижение давления и кортизола', severity: 'MEDIUM' },
    ],
    conflicts: [
      { with: 'thyroid_medication', effect: 'Усиление действия гормонов щитовидной', mechanism: 'Ашваганда повышает T3/T4', severity: 'MEDIUM' },
    ],
    monitoring: [
      { what: 'Кортизол утренний', when: 'Каждые 8 нед', targetRange: '6-23 мкг/дл' },
      { what: 'ТТГ', when: 'Каждые 12 нед', targetRange: '0.4-4.0 мМЕ/л' },
    ],
    contraindications: ['Гипертиреоз', 'Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Сонливость в начале приёма', 'Редко: ЖК-дискомфорт'],
    dosage: { mg: 600, timing: 'вечер (KSM-66)', form: 'KSM-66' },
    bestForCourse: true,
  },
  vitamin_c: {
    id: 'vitamin_c', name: 'Vitamin C', nameRu: 'Витамин C (Аскорбиновая кислота)',
    tier: 'core', category: ['vitamin', 'antioxidant', 'immunomodulator'],
    forms: [
      { id: 'vitamin_c', name: 'Vitamin C 1000mg', nameRu: 'Витамин C 1000 мг', dose: '1000 мг натощак', best: true },
      { id: 'VIT_C_LIP', name: 'Liposomal Vitamin C', nameRu: 'Липосомальный витамин C 1000 мг', dose: '1000 мг', best: false, notes: 'Лучшая биодоступность' },
    ],
    organs: ['IMMUNE_SYSTEM', 'SKIN', 'BLOOD', 'ADRENALS'],
    systems: ['hematologic', 'hepatic', 'immune'],
    mechanisms: ['COLLAGEN_SYNTHESIS', 'ANTIOXIDANT', 'IMMUNE_CELL_FUNCTION', 'IRON_ABSORPTION', 'GLUTATHIONE_REGENERATION'],
    description: 'Витамин C — водорастворимый антиоксидант, необходимый для синтеза коллагена, иммунитета и регенерации глутатиона.',
    synergies: [
      { with: 'iron', effect: 'Усиление всасывания железа', mechanism: 'Витамин C восстанавливает Fe3+ в Fe2+', severity: 'HIGH' },
      { with: 'zinc', effect: 'Улучшение всасывания цинка', mechanism: 'Витамин C усиливает абсорбцию', severity: 'MEDIUM' },
      { with: 'collagen', effect: 'Синтез коллагена', mechanism: 'Витамин C — кофактор гидроксилирования пролина', severity: 'HIGH' },
      { with: 'nac', effect: 'Регенерация глутатиона', mechanism: 'Витамин C восстанавливает окисленный глутатион', severity: 'HIGH' },
    ],
    conflicts: [
      { with: 'copper', effect: 'Снижение меди при высоких дозах', mechanism: 'Высокие дозы вит. C истощают медь', severity: 'LOW' },
    ],
    monitoring: [],
    contraindications: ['Гемохроматоз (с осторожностью)', 'Оксалатные камни почек'],
    sideEffects: ['Диарея при дозах >2000 мг', 'Риск камней при склонности'],
    dosage: { mg: 1000, timing: 'натощак', form: 'порошок/таблетки' },
    bestForCourse: true,
  },
  taurine: {
    id: 'taurine', name: 'Taurine', nameRu: 'Таурин',
    tier: 'core', category: ['amino', 'cardioprotector', 'neuroprotector'],
    forms: [
      { id: 'taurine', name: 'Taurine 2000mg', nameRu: 'Таурин 2000 мг', dose: '2000 мг натощак', best: true },
    ],
    organs: ['HEART', 'BRAIN', 'LIVER', 'KIDNEYS'],
    systems: ['cardio', 'neuro', 'hepatic', 'renal'],
    mechanisms: ['OSMOREGULATION', 'ANTIOXIDANT', 'CALCIUM_REGULATION', 'GABA_RECEPTOR_MODULATION', 'BILE_ACID_CONJUGATION'],
    description: 'Таурин — условно-заменимая аминокислота. Кардиопротектор, нейропротектор, антиоксидант. Снижает давление, улучшает сократимость миокарда.',
    synergies: [
      { with: 'magnesium', effect: 'Кардиопротекция и расслабление', mechanism: 'Таурин + Mg = максимальная защита сердца', severity: 'MEDIUM' },
      { with: 'caffeine', effect: 'Сглаживание стимуляции', mechanism: 'Таурин уменьшает тревожность от кофеина', severity: 'LOW' },
    ],
    conflicts: [],
    monitoring: [],
    contraindications: ['Тяжёлая почечная недостаточность'],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 2000, timing: 'натощак', form: 'порошок' },
    bestForCourse: true,
  },
  alpha_lipoic: {
    id: 'alpha_lipoic', name: 'Alpha-Lipoic Acid (R-ALA)', nameRu: 'АЛЬК R-форма',
    tier: 'core', category: ['antioxidant', 'neuroprotector', 'metabolic'],
    forms: [
      { id: 'alpha_lipoic', name: 'R-ALA 300mg', nameRu: 'АЛЬК R-форма 300 мг', dose: '300 мг натощак', best: true },
      { id: 'VIT_LIPOIC_R', name: 'R-Lipoic Acid 100mg', nameRu: 'R-липоевая кислота 100 мг', dose: '100 мг натощак', best: false, notes: 'R-форма более биодоступна' },
    ],
    organs: ['LIVER', 'BRAIN', 'NERVES', 'KIDNEYS'],
    systems: ['neuro', 'hepatic', 'renal'],
    mechanisms: ['ANTIOXIDANT_NETWORK', 'GLUTATHIONE_REGENERATION', 'MITOCHONDRIAL_FUNCTION', 'INSULIN_SENSITIVITY'],
    description: 'АЛЬК R-форма — универсальный антиоксидант. Регенерирует витамин C, E и глутатион. Улучшает инсулиновую чувствительность и нейропатию.',
    synergies: [
      { with: 'nac', effect: 'Усиление антиоксидантной сети', mechanism: 'АЛЬК регенерирует глутатион и вит. C', severity: 'HIGH' },
      { with: 'coq10', effect: 'Регенерация CoQ10', mechanism: 'АЛЬК восстанавливает окисленный CoQ10', severity: 'MEDIUM' },
      { with: 'vitamin_c', effect: 'Регенерация витамина E', mechanism: 'АЛЬК → вит. C → вит. E', severity: 'MEDIUM' },
    ],
    conflicts: [],
    monitoring: [],
    contraindications: ['Тяжёлая почечная недостаточность', 'Беременность'],
    sideEffects: ['Тошнота натощак', 'Редко: кожная сыпь', 'Редко: гипогликемия'],
    dosage: { mg: 300, timing: 'натощак (R-форма)', form: 'R-форма' },
    bestForCourse: true,
  },
  berberine: {
    id: 'berberine', name: 'Berberine', nameRu: 'Берберин',
    tier: 'core', category: ['antioxidant', 'metabolic', 'cardioprotector'],
    forms: [
      { id: 'berberine', name: 'Berberine HCl 500mg', nameRu: 'Берберин HCl 500 мг', dose: '500 мг с едой 2x/д', best: true },
    ],
    organs: ['LIVER', 'PANCREAS', 'INTESTINES', 'HEART'],
    systems: ['endocrine', 'hepatic', 'cardio'],
    mechanisms: ['AMPK_ACTIVATION', 'INSULIN_SENSITIVITY', 'CYP3A4_INHIBITION', 'NF_KB_INHIBITION', 'CHOLESTEROL_REDUCTION'],
    description: 'Берберин — алкалоид с мощной АМПК-активацией. Снижает сахар и триглицериды. Ингибирует CYP3A4 — осторожно с лекарствами.',
    synergies: [
      { with: 'milk_thistle', effect: 'Гепатопротекция + метаболизм', mechanism: 'Разные механизмы защиты печени', severity: 'MEDIUM' },
    ],
    conflicts: [
      { with: 'cyp3a4_substrates', effect: 'Взаимодействие с лекарствами', mechanism: 'Ингибирует CYP3A4', severity: 'HIGH' },
    ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед', targetRange: '3.9-5.5 ммоль/л' },
      { what: 'АЛТ/АСТ', when: 'Каждые 6 нед', targetRange: '<40 Ед/л' },
    ],
    contraindications: ['Приём CYP3A4-субстратов', 'Беременность', 'Тяжёлая печёночная недостаточность'],
    sideEffects: ['Запор', 'Тошнота при высоких дозах', 'Взаимодействие с лекарствами (CYP3A4)'],
    dosage: { mg: 500, timing: 'с едой, 2x/д', form: 'HCl' },
    bestForCourse: true,
  },
  vitamin_k2: {
    id: 'vitamin_k2', name: 'Vitamin K2 (MK-7)', nameRu: 'Витамин K2 (МК-7)',
    tier: 'core', category: ['vitamin', 'cardioprotector', 'bone'],
    forms: [
      { id: 'vitamin_k2', name: 'Vitamin K2 MK-7 200mcg', nameRu: 'Витамин K2 МК-7 200 мкг', dose: '200 мкг с едой', best: true },
      { id: 'VIT_K2_MK4', name: 'Vitamin K2 MK-4 45mg', nameRu: 'Витамин K2 МК-4 45 мг', dose: '45 мг (частый приём)', best: false, notes: 'Короткий период полувыведения' },
    ],
    organs: ['BONES', 'HEART', 'VESSELS'],
    systems: ['cardio', 'hematologic'],
    mechanisms: ['OSTEOCALCIN_ACTIVATION', 'MATRIX_GLA_PROTEIN_ACTIVATION', 'CALCIUM_DISTRIBUTION'],
    description: 'Витамин K2 (МК-7) — активатор остеокальцина и MGP. Направляет кальций из сосудов в кости. Критически важен с витамином D3.',
    synergies: [
      { with: 'vitamin_d3', effect: 'Направление Ca в кости', mechanism: 'D3 увеличивает всасывание Ca, K2 направляет в кости', severity: 'HIGH' },
    ],
    conflicts: [
      { with: 'warfarin', effect: 'Антагонизм', mechanism: 'K2 конкурирует с варфарином', severity: 'HIGH' },
    ],
    monitoring: [],
    contraindications: ['Приём варфарина/антикоагулянтов', 'Тромбофилия'],
    sideEffects: ['Редко при передозировке'],
    dosage: { mg: 200, timing: 'с едой (мкг)', form: 'МК-7' },
    bestForCourse: true,
  },
  probiotics: {
    id: 'probiotics', name: 'Probiotics', nameRu: 'Пробиотики',
    tier: 'standard', category: ['probiotic', 'immunomodulator', 'hepatoprotector'],
    forms: [
      { id: 'probiotics', name: 'Multi-Strain Probiotic 20B CFU', nameRu: 'Мультиштаммовый пробиотик 20 млрд КОЕ', dose: '20 млрд КОЕ натощак', best: true },
      { id: 'PRO_L_RHAMNOSUS', name: 'L. Rhamnosus GG', nameRu: 'Л. Рамнозус GG', dose: '10 млрд КОЕ', best: false },
      { id: 'PRO_B_BIFIDUM', name: 'B. Bifidum', nameRu: 'Б. Бифидум', dose: '5 млрд КОЕ', best: false },
      { id: 'PRO_SACCHAROMYCES', name: 'S. Boulardii', nameRu: 'С. Буларди', dose: '5 млрд КОЕ', best: false, notes: 'Дрожжевой пробиотик, не уничтожается антибиотиками' },
    ],
    organs: ['INTESTINES', 'LIVER', 'IMMUNE_SYSTEM'],
    systems: ['hepatic', 'immune', 'hematologic'],
    mechanisms: ['GUT_MICROBIOME_MODULATION', 'IMMUNE_REGULATION', 'GUT_BARRIER_INTEGRITY', 'SHORT_CHAIN_FATTY_ACID_PRODUCTION', 'PATHOGEN_EXCLUSION'],
    description: 'Пробиотики — живые микроорганизмы, улучшающие микробиом кишечника. Укрепляют кишечный барьер, модулируют иммунитет, подавляют патогенную флору. Обязательны на курсе ААС.',
    synergies: [
      { with: 'prebiotics', effect: 'Синергия пребиотик + пробиотик', mechanism: 'Пребиотики обеспечивают питание для пробиотиков', severity: 'HIGH' },
      { with: 'milk_thistle', effect: 'Кишечно-печёночная ось', mechanism: 'Пробиотики улучшают всасывание силимарина', severity: 'LOW' },
      { with: 'vitamin_d3', effect: 'Усиление иммунитета', mechanism: 'Пробиотики + D3 = синергичная иммунная модуляция', severity: 'MEDIUM' },
    ],
    conflicts: [],
    monitoring: [],
    contraindications: ['Тяжёлый иммунодефицит', 'Центральный венозный катетер (риск бактериемии)'],
    sideEffects: ['Вздутие в начале приёма', 'Редко: диарея', 'Редко: аллергия на штамм'],
    dosage: { mg: 20, timing: 'натощак (млрд КОЕ)', form: 'капсулы' },
    bestForCourse: true,
  },
  collagen: {
    id: 'collagen', name: 'Collagen Hydrolysate', nameRu: 'Коллаген гидролизат',
    tier: 'standard', category: ['amino', 'joint', 'beauty'],
    forms: [
      { id: 'collagen', name: 'Collagen Hydrolysate 10g', nameRu: 'Коллаген гидролизат 10 г', dose: '10 г с едой', best: true },
      { id: 'AA_COLLAGEN_AMINO', name: 'Collagen Peptides', nameRu: 'Коллагеновые пептиды 10 г', dose: '10 г', best: false },
    ],
    organs: ['JOINTS', 'SKIN', 'BONES', 'MUSCLES'],
    systems: ['musculoskeletal'],
    mechanisms: ['COLLAGEN_SYNTHESIS', 'CARTILAGE_REPAIR', 'SKIN_ELASTICITY', 'TENDON_STRENGTH'],
    description: 'Гидролизованный коллаген — источник аминокислот для восстановления хрящей, сухожилий и кожи. Синергичен с витамином C для синтеза нового коллагена.',
    synergies: [
      { with: 'vitamin_c', effect: 'Синтез коллагена', mechanism: 'Витамин C — кофактор гидроксилирования пролина в коллагене', severity: 'HIGH' },
      { with: 'glucosamine', effect: 'Суставная синергия', mechanism: 'Коллаген + глюкозамин = восстановление хрящей', severity: 'MEDIUM' },
      { with: 'msm', effect: 'Сера для коллагена', mechanism: 'MSM поставляет серу для дисульфидных связей', severity: 'MEDIUM' },
    ],
    conflicts: [],
    monitoring: [],
    contraindications: [],
    sideEffects: ['Редко: тяжесть в желудке при приёме натощак'],
    dosage: { mg: 10000, timing: 'с едой (мг, гидролизат)', form: 'гидролизат' },
    bestForCourse: true,
  },
  glucosamine: {
    id: 'glucosamine', name: 'Glucosamine', nameRu: 'Глюкозамин',
    tier: 'standard', category: ['amino', 'joint'],
    forms: [
      { id: 'glucosamine', name: 'Glucosamine Sulfate 1500mg', nameRu: 'Глюкозамин сульфат 1500 мг', dose: '1500 мг с едой', best: true },
    ],
    organs: ['JOINTS', 'BONES'],
    systems: ['musculoskeletal'],
    mechanisms: ['CARTILAGE_REPAIR', 'SYNOVIAL_FLUID_PRODUCTION', 'ANTI_INFLAMMATORY'],
    description: 'Глюкозамин — строительный блок хрящевой ткани. Улучшает продукцию синовиальной жидкости и замедляет дегенерацию суставов.',
    synergies: [
      { with: 'chondroitin', effect: 'Суставная синергия', mechanism: 'Глюкозамин строит хрящ, хондроитин удерживает воду', severity: 'HIGH' },
      { with: 'msm', effect: 'Противовоспалительная синергия', mechanism: 'MSM снижает воспаление + глюкозамин восстанавливает хрящ', severity: 'MEDIUM' },
      { with: 'collagen', effect: 'Восстановление суставов', mechanism: 'Коллаген + глюкозамин = полный набор для хряща', severity: 'MEDIUM' },
    ],
    conflicts: [],
    monitoring: [],
    contraindications: ['Аллергия на моллюсков (для хондроитина из моллюсков)', 'С осторожностью при диабете'],
    sideEffects: ['Редко: дискомфорт в ЖКТ', 'Редко: аллергия'],
    dosage: { mg: 1500, timing: 'с едой', form: 'сульфат' },
    bestForCourse: false,
  },
  telmisartan: {
    id: 'telmisartan', name: 'Telmisartan', nameRu: 'Тельмисартан',
    tier: 'specialty', category: ['pharma', 'cardioprotector', 'metabolic'],
    forms: [
      { id: 'telmisartan', name: 'Telmisartan 40mg', nameRu: 'Тельмисартан 40 мг', dose: '40 мг утром (КАД контроль!)', best: true },
    ],
    organs: ['HEART', 'VESSELS', 'KIDNEYS'],
    systems: ['cardio', 'renal', 'endocrine'],
    mechanisms: ['ANGIOTENSIN_RECEPTOR_BLOCKADE', 'PPAR_GAMMA_ACTIVATION', 'BP_REDUCTION', 'RENOPROTECTION'],
    description: 'Тельмисартан — сартан с уникальным PPAR-γ эффектом. Снижает давление, защищает почки, улучшает инсулиновую чувствительность. Препарат выбора на курсе ААС для контроля давления.',
    synergies: [
      { with: 'omega3', effect: 'Кардиопротекция', mechanism: 'Разные механизмы снижения давления и воспаления', severity: 'MEDIUM' },
      { with: 'nebivolol', effect: 'Максимальный контроль давления и ЧСС', mechanism: 'Сартан + бета-блокатор = аддитивный эффект', severity: 'MEDIUM' },
    ],
    conflicts: [
      { with: 'ace_inhibitors', effect: 'Риск гиперкалиемии', mechanism: 'Двойная блокада РААС', severity: 'HIGH' },
      { with: 'potassium_supplements', effect: 'Гиперкалиемия', mechanism: 'Сартаны снижают экскрецию калия', severity: 'MEDIUM' },
    ],
    monitoring: [
      { what: 'АД', when: 'Ежедневно', targetRange: '<130/85 мм рт.ст.' },
      { what: 'Калий', when: 'Каждые 4 нед', targetRange: '3.5-5.0 ммоль/л' },
      { what: 'Креатинин', when: 'Каждые 8 нед', targetRange: '<110 мкмоль/л' },
    ],
    contraindications: ['Беременность', 'Двусторонний стеноз почечных артерий', 'Тяжёлая печёночная недостаточность'],
    sideEffects: ['Головокружение при первом приёме', 'Редко: гипотония', 'Гиперкалиемия при комбинировании с калийсберегающими'],
    dosage: { mg: 40, timing: 'утро (КАД контроль!)', form: 'таблетки' },
    bestForCourse: true,
  },
  nebivolol: {
    id: 'nebivolol', name: 'Nebivolol', nameRu: 'Небиволол',
    tier: 'specialty', category: ['pharma', 'cardioprotector'],
    forms: [
      { id: 'nebivolol', name: 'Nebivolol 5mg', nameRu: 'Небиволол 5 мг', dose: '5 мг утром (ЧСС контроль!)', best: true },
    ],
    organs: ['HEART', 'VESSELS'],
    systems: ['cardio'],
    mechanisms: ['BETA1_BLOCKADE', 'NO_RELEASE', 'HR_REDUCTION', 'BP_REDUCTION'],
    description: 'Небиволол — кардиоселективный бета-блокатор с уникальным NO-модулирующим эффектом. Снижает ЧСС и давление, улучшает эндотелиальную функцию. Препарат выбора для контроля ЧСС на курсе ААС.',
    synergies: [
      { with: 'telmisartan', effect: 'Контроль давления и ЧСС', mechanism: 'Бета-блокатор + сартан = аддитивный эффект', severity: 'MEDIUM' },
      { with: 'taurine', effect: 'Кардиопротекция', mechanism: 'Таурин + небиволол = максимальная защита миокарда', severity: 'LOW' },
    ],
    conflicts: [
      { with: 'beta_agonists', effect: 'Антагонизм', mechanism: 'Бета-блокаторы блокируют бета-агонисты', severity: 'MEDIUM' },
      { with: 'verapamil', effect: 'Риск брадикардии', mechanism: 'Аддитивное замедление AV-проводимости', severity: 'HIGH' },
    ],
    monitoring: [
      { what: 'ЧСС', when: 'Ежедневно', targetRange: '55-70 уд/мин' },
      { what: 'АД', when: 'Ежедневно', targetRange: '<130/85 мм рт.ст.' },
    ],
    contraindications: ['Бронхиальная астма (с осторожностью)', 'AV-блокада 2-3 степени', 'Брадикардия <50'],
    sideEffects: ['Брадикардия', 'Усталость', 'Редко: эректильная дисфункция', 'Редко: бронхоспазм'],
    dosage: { mg: 5, timing: 'утро (ЧСС контроль!)', form: 'таблетки' },
    bestForCourse: true,
  },





  iron: {
    id: 'iron', name: 'Iron', nameRu: 'Железо', tier: 'core',
    category: ['mineral', 'hematologic'],
    forms: [
      { id: 'iron', name: 'Iron Bisglycinate', nameRu: 'Железо бисглицинат', dose: '18 мг натощак или с витамином С', best: true },
      { id: 'MIN_IRON', name: 'Iron Chelate', nameRu: 'Железо хелат', dose: '25 мг натощак', best: false },
      { id: 'BLOOD_IRON', name: 'Iron Complex', nameRu: 'Железо Комплекс', dose: '30 мг с витамином С', best: false },
    ],
    organs: ['BLOOD', 'LIVER', 'MUSCLES'],
    systems: ['hematologic', 'hepatic', 'musculoskeletal'],
    mechanisms: ['HEMOGLOBIN_SYNTHESIS', 'MYOGLOBIN_SYNTHESIS', 'OXYGEN_TRANSPORT', 'ENERGY_PRODUCTION'],
    description: 'Железо — ключевой компонент гемоглобина и миоглобина. На курсе ААС предотвращает анемию. Бисглицинат — лучшая форма. Синергично с витамином С.',
    synergies: [
      { with: 'vitamin_c', effect: 'Усиление всасывания железа', mechanism: 'Витамин С восстанавливает Fe3+ в Fe2+, улучшает абсорбцию 3-6x', severity: 'HIGH' },
      { with: 'copper', effect: 'Мобилизация железа из депо', mechanism: 'Медь через церулоплазмин обеспечивает транспорт железа', severity: 'MEDIUM' },
      { with: 'folate', effect: 'Синергия кроветворения', mechanism: 'Железо + фолат — кофакторы эритропоэза', severity: 'MEDIUM' },
    ],
    conflicts: [
      { with: 'zinc', effect: 'Конкуренция за всасывание', mechanism: 'Железо и цинк конкурируют за DMT1', severity: 'MEDIUM' },
      { with: 'calcium', effect: 'Снижение всасывания железа', mechanism: 'Кальций блокирует транспорт железа, интервал 2 часа', severity: 'MEDIUM' },
    ],
    monitoring: [
      { what: 'Ферритин', when: 'Каждые 8 нед', targetRange: '30-150 нг/мл' },
      { what: 'Гемоглобин', when: 'Каждые 8 нед', targetRange: '>130 г/л' },
    ],
    contraindications: ['Гемохроматоз', 'Гемосидероз', 'Талассемия'],
    sideEffects: ['Запор (при сульфате)', 'Тёмный стул (норма)', 'Тошнота натощак'],
    dosage: { mg: 18, timing: 'натощак или с витамином С', form: 'бисглицинат железа (хелат)' },
    bestForCourse: true,
  },
  copper: {
    id: 'copper', name: 'Copper', nameRu: 'Медь', tier: 'standard',
    category: ['mineral', 'antioxidant'],
    forms: [
      { id: 'copper', name: 'Copper Bisglycinate', nameRu: 'Медь бисглицинат', dose: '2 мг с едой', best: true },
      { id: 'MIN_COPPER', name: 'Copper Chelate', nameRu: 'Медь хелат', dose: '2 мг с едой', best: false },
    ],
    organs: ['LIVER', 'BLOOD', 'BONES'],
    systems: ['hepatic', 'hematologic', 'musculoskeletal'],
    mechanisms: ['IRON_METABOLISM', 'CERULOPLASMIN', 'COLLAGEN_CROSS_LINKING', 'MELANIN_SYNTHESIS'],
    description: 'Медь — кофактор церулоплазмина, критична для метаболизма железа и перекрёстных связей коллагена. На курсе ААС поддерживает кроветворение и прочность связок.',
    synergies: [
      { with: 'iron', effect: 'Мобилизация железа из депо', mechanism: 'Медь через церулоплазмин окисляет Fe2+ и обеспечивает транспорт', severity: 'HIGH' },
    ],
    conflicts: [
      { with: 'zinc', effect: 'Конкуренция за всасывание', mechanism: 'Высокие дозы цинка индуцируют металлотионеин, связывающий медь', severity: 'HIGH' },
    ],
    monitoring: [
      { what: 'Церулоплазмин', when: 'Каждые 12 нед', targetRange: '0.2-0.6 г/л' },
      { what: 'Медь в крови', when: 'Каждые 12 нед', targetRange: '12-20 мкмоль/л' },
    ],
    contraindications: ['Болезнь Вильсона'],
    sideEffects: ['Тошнота при высоких дозах', 'Вкус металла', 'Антагонизм с цинком'],
    dosage: { mg: 2, timing: 'с едой', form: 'медь бисглицинат' },
    bestForCourse: true,
  },
  vitamin_b12: {
    id: 'vitamin_b12', name: 'Vitamin B12', nameRu: 'Витамин В12 (Кобаламин)', tier: 'core',
    category: ['vitamin', 'hematologic'],
    forms: [
      { id: 'vitamin_b12', name: 'Methylcobalamin', nameRu: 'Метилкобаламин', dose: '1000 мкг с едой', best: true },
      { id: 'VIT_B12_METHYL', name: 'Methylcobalamin Premium', nameRu: 'Метилкобаламин Премиум', dose: '5000 мкг сублингвально', best: false },
      { id: 'VIT_B12_ADENO', name: 'Adenosylcobalamin', nameRu: 'Аденозилкобаламин', dose: '1000 мкг с едой', best: false },
      { id: 'VIT_B12_HYDROXO', name: 'Hydroxocobalamin', nameRu: 'Гидроксокобаламин', dose: '1000 мкг с едой', best: false },
      { id: 'VIT_B12_CYANO', name: 'Cyanocobalamin', nameRu: 'Цианокобаламин', dose: '1000 мкг с едой', best: false },
    ],
    organs: ['BLOOD', 'BRAIN', 'NERVES'],
    systems: ['hematologic', 'neuro'],
    mechanisms: ['METHYLATION', 'DNA_SYNTHESIS', 'MYELIN_SYNTHESIS', 'HOMOCYSTEINE_LOWERING'],
    description: 'Витамин В12 (кобаламин) — ключевой кофактор метилирования, синтеза ДНК и миелина. Метилкобаламин — активная форма для метилирования. На курсе ААС критичен для кроветворения и профилактики нейропатии.',
    synergies: [
      { with: 'folate', effect: 'Синергия метилирования', mechanism: 'В12 + фолат — кофакторы метионинсинтазы и синтеза тимидилата', severity: 'HIGH' },
      { with: 'vitamin_b6', effect: 'Снижение гомоцистеина', mechanism: 'В12 + В6 + фолат — тройная синергия метилирования', severity: 'HIGH' },
      { with: 'iron', effect: 'Синергия эритропоэза', mechanism: 'В12 и железо — необходимые кофакторы продукции эритроцитов', severity: 'MEDIUM' },
    ],
    conflicts: [
      { with: 'metformin', effect: 'Снижение всасывания В12', mechanism: 'Метформин блокирует рецептор кальция в подвздошной кишке, снижая абсорбцию В12 на 30%', severity: 'HIGH' },
    ],
    monitoring: [
      { what: 'В12 в крови', when: 'Каждые 12 нед', targetRange: '>300 пг/мл' },
      { what: 'Гомоцистеин', when: 'Каждые 8 нед', targetRange: '<15 мкмоль/л' },
    ],
    contraindications: ['Болезнь Лебера', 'Аллергия на кобальт'],
    sideEffects: ['Редко: акне при высоких дозах', 'Маскировка фолат-дефицита'],
    dosage: { mg: 1, timing: 'с едой или натощак (метилкобаламин)', form: 'метилкобаламин (сублингвальный)' },
    bestForCourse: true,
  },
  potassium: {
    id: 'potassium', name: 'Potassium', nameRu: 'Калий', tier: 'core',
    category: ['mineral', 'cardioprotector'],
    forms: [
      { id: 'potassium', name: 'Potassium Citrate', nameRu: 'Калия цитрат', dose: '300 мг с едой 2x/д', best: true },
      { id: 'MIN_POTASSIUM', name: 'Potassium Chloride', nameRu: 'Калия хлорид', dose: '300 мг с едой', best: false },
    ],
    organs: ['HEART', 'MUSCLES', 'KIDNEYS'],
    systems: ['cardio', 'renal', 'metabolic'],
    mechanisms: ['ELECTROLYTE_BALANCE', 'MUSCLE_CONTRACTION', 'HEART_RHYTHM', 'FLUID_REGULATION'],
    description: 'Калий — ключевой внутриклеточный электролит, критичен для ритма сердца и мышечного сокращения. На курсе ААС компенсирует потери, особенно при использовании диуретиков.',
    synergies: [
      { with: 'magnesium', effect: 'Синергия электролитов', mechanism: 'Калий + магний — координация мембранного потенциала и ритма сердца', severity: 'HIGH' },
    ],
    conflicts: [
      { with: 'ace_inhibitor_drugs', effect: 'Риск гиперкалиемии', mechanism: 'ИАПФ снижают экскрецию калия, дополнительный калий опасен', severity: 'HIGH' },
    ],
    monitoring: [
      { what: 'Калий в сыворотке', when: 'Каждые 4 нед', targetRange: '3.5-5.0 ммоль/л' },
    ],
    contraindications: ['Гиперкалиемия', 'Почечная недостаточность'],
    sideEffects: ['Тошнота', 'Диарея при высоких дозах', 'Риск аритмии при избытке'],
    dosage: { mg: 300, timing: 'с едой 2x/д', form: 'цитрат калия' },
    bestForCourse: true,
  },
  electrolyte_complex: {
    id: 'electrolyte_complex', name: 'Electrolyte Complex', nameRu: 'Электролитный комплекс', tier: 'core',
    category: ['mineral', 'cardioprotector'],
    forms: [
      { id: 'electrolyte_complex', name: 'Electrolyte Complex', nameRu: 'Электролитный комплекс (K+Mg+Ca+Na)', dose: '1 порция 2x/д с едой', best: true },
    ],
    organs: ['HEART', 'MUSCLES', 'KIDNEYS'],
    systems: ['cardio', 'renal', 'metabolic'],
    mechanisms: ['ELECTROLYTE_BALANCE', 'FLUID_REGULATION', 'MUSCLE_FUNCTION', 'HEART_RHYTHM'],
    description: 'Комплекс электролитов (K, Na, Mg, Ca) — критичен на курсе ААС для поддержания ритма сердца, мышечной функции и гидратации. Особенно важен при диуретиках.',
    synergies: [
      { with: 'magnesium', effect: 'Максимальная кардиопротекция', mechanism: 'К+Mg — координация ритма сердца и мембранного потенциала', severity: 'HIGH' },
      { with: 'taurine', effect: 'Усиление калий-натриевого насоса', mechanism: 'Таурин усиливает функцию Na+/K+-АТФазы', severity: 'MEDIUM' },
    ],
    conflicts: [
      { with: 'ace_inhibitor_drugs', effect: 'Риск гиперкалиемии', mechanism: 'ИАПФ + калий — опасное повышение калия', severity: 'HIGH' },
    ],
    monitoring: [
      { what: 'Калий', when: 'Каждые 4 нед', targetRange: '3.5-5.0 ммоль/л' },
      { what: 'Магний', when: 'Каждые 4 нед', targetRange: '>0.75 ммоль/л' },
    ],
    contraindications: ['Гиперкалиемия', 'Почечная недостаточность'],
    sideEffects: ['Редко: диарея при высоких дозах Mg'],
    dosage: { mg: 1, timing: '2x/д с едой', form: 'электролитный комплекс (K+Mg+Ca+Na)' },
    bestForCourse: true,
  },
  vitamin_b6: {
    id: 'vitamin_b6', name: 'Vitamin B6', nameRu: 'Витамин В6 (Пиридоксин)', tier: 'core',
    category: ['vitamin', 'neuroprotector'],
    forms: [
      { id: 'vitamin_b6', name: 'Pyridoxal-5-Phosphate', nameRu: 'Пиридоксаль-5-фосфат (P-5-P)', dose: '50 мг с едой', best: true },
      { id: 'VIT_B6', name: 'Pyridoxine HCl', nameRu: 'Пиридоксин HCl', dose: '50 мг с едой', best: false },
      { id: 'VIT_B6_P5P', name: 'P-5-P Premium', nameRu: 'P-5-P Премиум', dose: '50 мг натощак', best: false },
    ],
    organs: ['BRAIN', 'NERVES', 'LIVER'],
    systems: ['neuro', 'hepatic', 'hematologic'],
    mechanisms: ['PLP_COENZYME', 'AMINO_ACID_METABOLISM', 'NEUROTRANSMITTER_SYNTHESIS', 'HOMOCYSTEINE_LOWERING'],
    description: 'Пиридоксаль-5-фосфат — активная форма В6, кофермент 140+ реакций. Ключевой для метаболизма аминокислот, синтеза нейромедиаторов и снижения гомоцистеина. На курсе ААС критичен для профилактики нейропатии. P-5-P предпочтительнее пиридоксина.',
    synergies: [
      { with: 'magnesium', effect: 'Синергия нервной системы', mechanism: 'В6 активирует P-5-P, магний — кофактор 300+ ферментов', severity: 'HIGH' },
      { with: 'folate', effect: 'Снижение гомоцистеина', mechanism: 'В6 + фолат + В12 — тройная синергия', severity: 'HIGH' },
    ],
    conflicts: [
      { with: 'levodopa', effect: 'Снижение эффективности леводопы', mechanism: 'В6 ускоряет декарбоксилирование на периферии', severity: 'HIGH' },
    ],
    monitoring: [
      { what: 'Гомоцистеин', when: 'Каждые 8 нед', targetRange: '<15 мкмоль/л' },
    ],
    contraindications: ['Болезнь Паркинсона (при приёме леводопы)'],
    sideEffects: ['При дозах >200 мг/д — нейропатия', 'Фотосенсибилизация'],
    dosage: { mg: 50, timing: 'с едой (P-5-P) или натощак', form: 'пиридоксаль-5-фосфат (P-5-P)' },
    bestForCourse: true,
  },
  vitamin_a: {
    id: 'vitamin_a',
    name: 'Vitamin A',
    nameRu: 'Витамин А (Ретинол)',
    tier: 'standard',
    category: ['vitamin', 'antioxidant'],
    forms: [
      { id: 'vitamin_a', name: 'Vitamin A', nameRu: 'Ретинола пальмитат 10000 МЕ', dose: '1 мг', best: true },
      { id: 'vitamin_a_2', name: 'Vitamin A', nameRu: 'Бета-каротин 25000 МЕ', dose: '1 мг', best: false }
    ],
    organs: ['EYES', 'SKIN', 'IMMUNE_SYSTEM'],
    systems: ['neuro', 'endocrine'],
    mechanisms: ['RETINOID_RECEPTOR', 'VISION_CYCLE', 'IMMUNE_MODULATION', 'EPITHELIAL_MAINTENANCE'],
    description: 'Ретинол — жирорастворимый витамин, критичный для зрения и иммунитета. На курсе ААС помогает кожным проблемам.',
    synergies: [
      { with: "zinc", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "astaxanthin", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "lutein", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "anthocyanins", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "antioxidant_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "brand_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "vitamin_d3", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Витамин А в крови', when: 'Каждые 8 нед', targetRange: '0.3-0.8 мкг/мл' }
    ],
    contraindications: ['Беременность (тератогенность)', 'Гипервитаминоз А'],
    sideEffects: ['Тошнота при избытке', 'Сухость кожи', 'Головная боль при передозировке'],
    dosage: { mg: 1, timing: 'с едой (жирорастворимый)', form: 'капсулы ретинола пальмитат' },
    bestForCourse: false,
  },
  vitamin_b1: {
    id: 'vitamin_b1',
    name: 'Vitamin B1',
    nameRu: 'Витамин В1 (Тиамин)',
    tier: 'standard',
    category: ['vitamin', 'neuroprotector'],
    forms: [
      { id: 'vitamin_b1', name: 'Vitamin B1', nameRu: 'Тиамин HCl 100 мг', dose: '100 мг 2x/д', best: true },
      { id: 'vitamin_b1_2', name: 'Vitamin B1', nameRu: 'Бенфотиамин 150 мг', dose: '100 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES', 'HEART'],
    systems: ['neuro', 'cardio'],
    mechanisms: ['THIAMINE_PYROPHOSPHATE', 'GLUCOSE_METABOLISM', 'NERVE_CONDUCTION', 'ENERGY_PRODUCTION'],
    description: 'Тиамин — кофермент пируватдегидрогеназы. Критичен для метаболизма глюкозы и нервной проводимости. Дефицит на курсе ведёт к нейропатии.',
    synergies: [
      { with: "vitamin_b1", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Тиамин в крови', when: 'Каждые 12 нед', targetRange: '>70 нмоль/л' }
    ],
    contraindications: [],
    sideEffects: ['Редко: аллергия при в/в введении', 'При высоких дозах — бессонница'],
    dosage: { mg: 100, timing: 'утро с едой', form: 'тиамин или бенфотиамин' },
    bestForCourse: false,
  },
  vitamin_b2: {
    id: 'vitamin_b2',
    name: 'Vitamin B2',
    nameRu: 'Витамин В2 (Рибофлавин)',
    tier: 'standard',
    category: ['vitamin', 'antioxidant'],
    forms: [
      { id: 'vitamin_b2', name: 'Vitamin B2', nameRu: 'Рибофлавин 10 мг', dose: '10 мг', best: true },
      { id: 'vitamin_b2_2', name: 'Vitamin B2', nameRu: 'R-5-P (Рибофлавин-5-фосфат) 10 мг', dose: '10 мг', best: false }
    ],
    organs: ['EYES', 'SKIN', 'LIVER'],
    systems: ['hepatic', 'neuro'],
    mechanisms: ['FAD_COENZYME', 'ELECTRON_TRANSPORT', 'GLUTATHIONE_RECYCLING', 'IRON_ABSORPTION'],
    description: 'Рибофлавин — предшественник FAD и FMN. Участвует в рециклинге глутатиона и метаболизме железа.',
    synergies: [
      { with: "vitamin_b2", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Рибофлавин в моче', when: 'Каждые 12 нед' }
    ],
    contraindications: [],
    sideEffects: ['Окрашивание мочи в жёлтый', 'Редко: зуд кожи'],
    dosage: { mg: 10, timing: 'с едой', form: 'рибофлавин или R-5-P' },
    bestForCourse: false,
  },
  vitamin_b3: {
    id: 'vitamin_b3',
    name: 'Vitamin B3',
    nameRu: 'Витамин В3 (Ниацин)',
    tier: 'standard',
    category: ['vitamin', 'cardioprotector', 'metabolic'],
    forms: [
      { id: 'vitamin_b3', name: 'Vitamin B3', nameRu: 'Ниацин 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'vitamin_b3_2', name: 'Vitamin B3', nameRu: 'Ниацинамид 500 мг', dose: '500 мг', best: false }
    ],
    organs: ['LIVER', 'HEART', 'VESSELS', 'SKIN'],
    systems: ['cardio', 'hepatic', 'endocrine'],
    mechanisms: ['NAD_PRECURSOR', 'LIPID_LOWERING', 'VASODILATION', 'CHOLESTEROL_MODULATION'],
    description: 'Ниацин — предшественник NAD+, снижает ЛПНП и ТГ, повышает ЛПВП. На курсе ААС помогает контролировать липидный профиль.',
    synergies: [
      { with: "vitamin_b3", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "pterostilbene", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед', targetRange: 'ЛПНП<3.0 ЛПВП>1.0' }
    ],
    contraindications: ['Подагра', 'Язвенная болезнь', 'Декомпенсированный диабет'],
    sideEffects: ['Флаш (покраснение кожи)', 'Зуд', 'Повышение глюкозы', 'Повышение мочевой кислоты'],
    dosage: { mg: 500, timing: 'с едой', form: 'ниацин или ниацинамид' },
    bestForCourse: true,
  },
  vitamin_b5: {
    id: 'vitamin_b5',
    name: 'Vitamin B5',
    nameRu: 'Витамин В5 (Пантотеновая к-та)',
    tier: 'standard',
    category: ['vitamin', 'metabolic'],
    forms: [
      { id: 'vitamin_b5', name: 'Vitamin B5', nameRu: 'Пантотенат кальция 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'vitamin_b5_2', name: 'Vitamin B5', nameRu: 'Пантетин 300 мг', dose: '500 мг', best: false }
    ],
    organs: ['ADRENALS', 'SKIN', 'LIVER'],
    systems: ['endocrine', 'hepatic'],
    mechanisms: ['COENZYME_A_SYNTHESIS', 'ACETYLATION', 'STEROIDOGENESIS', 'WOUND_HEALING'],
    description: 'Пантотеновая кислота — предшественник Коэнзима А, критичного для стероидогенеза. Поддерживает надпочечники.',
    synergies: [
      { with: "vitamin_b5", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Кортизол утром', when: 'Каждые 8 нед', targetRange: '6-23 мкг/дл' }
    ],
    contraindications: [],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'пантотенат или пантетин' },
    bestForCourse: false,
  },
  biotin: {
    id: 'biotin',
    name: 'Biotin',
    nameRu: 'Биотин (Витамин В7)',
    tier: 'standard',
    category: ['vitamin', 'metabolic'],
    forms: [
      { id: 'biotin', name: 'Biotin', nameRu: 'Биотин 5000 мкг', dose: '5 мг', best: true },
      { id: 'biotin_2', name: 'Biotin', nameRu: 'Биотин 10000 мкг', dose: '5 мг', best: false }
    ],
    organs: ['SKIN', 'MUSCLES'],
    systems: ['endocrine', 'metabolic'],
    mechanisms: ['CARBOXYLASE_COENZYME', 'KERATIN_SYNTHESIS', 'GLUCONEOGENESIS', 'FATTY_ACID_SYNTHESIS'],
    description: 'Биотин — кофермент карбоксилаз, критичен для синтеза кератина. На курсе ААС поддерживает кожу и волосы.',
    synergies: [
      { with: "biotin", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Биотин в крови', when: 'Каждые 12 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: акне при высоких дозах', 'Мешает лабораторным тестам'],
    dosage: { mg: 5, timing: 'с едой', form: 'биотин капсулы' },
    bestForCourse: false,
  },
  folate: {
    id: 'folate',
    name: 'Folate',
    nameRu: 'Фолат (Витамин В9)',
    tier: 'core',
    category: ['vitamin', 'hematologic'],
    forms: [
      { id: 'folate', name: 'Folate', nameRu: 'Метилфолат (5-MTHF) 800 мкг', dose: '800 мкг', best: true },
      { id: 'folate_2', name: 'Folate', nameRu: 'Фолиевая кислота 400 мкг', dose: '800 мкг', best: false },
      { id: 'folate_3', name: 'Folate', nameRu: 'Фолиновая кислота 400 мкг', dose: '800 мкг', best: false }
    ],
    organs: ['LIVER', 'BLOOD', 'BRAIN'],
    systems: ['hematologic', 'hepatic', 'neuro'],
    mechanisms: ['METHYLATION', 'DNA_SYNTHESIS', 'HOMOCYSTEINE_LOWERING', 'RED_BLOOD_CELL_PRODUCTION'],
    description: 'Фолат — ключевой витамин для метилирования и синтеза ДНК. Метилфолат предпочтительнее фолиевой кислоты. На курсе ААС критичен для профилактики анемии.',
    synergies: [
      { with: "vitamin_b12", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "betaine", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "folate", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "immunosuppressant_drugs", effect: "", mechanism: "", severity: "HIGH" },
      { with: "anticonvulsant_drugs", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Гомоцистеин', when: 'Каждые 8 нед', targetRange: '<15 мкмоль/л' },
      { what: 'Фолат в крови', when: 'Каждые 12 нед', targetRange: '>10 нмоль/л' }
    ],
    contraindications: ['В12-дефицитная анемия (маскировка)', 'Эпилепсия (с осторожностью)'],
    sideEffects: ['Редко: аллергия', 'Маскировка В12-дефицита без В12'],
    dosage: { mg: 0.8, timing: 'с едой', form: 'метилфолат (5-MTHF)' },
    bestForCourse: true,
  },
  vitamin_e: {
    id: 'vitamin_e',
    name: 'Vitamin E',
    nameRu: 'Витамин Е (Токоферол)',
    tier: 'standard',
    category: ['vitamin', 'antioxidant'],
    forms: [
      { id: 'vitamin_e', name: 'Vitamin E', nameRu: 'Смешанные токоферолы 400 МЕ', dose: '200 мг 2x/д', best: true },
      { id: 'vitamin_e_2', name: 'Vitamin E', nameRu: 'd-Альфа-токоферол 200 МЕ', dose: '200 мг', best: false },
      { id: 'vitamin_e_3', name: 'Vitamin E', nameRu: 'Токотриенолы 100 мг', dose: '200 мг', best: false }
    ],
    organs: ['HEART', 'VESSELS', 'SKIN', 'LIVER'],
    systems: ['cardio', 'hepatic'],
    mechanisms: ['LIPID_PEROXIDATION_INHIBITION', 'MEMBRANE_STABILIZATION', 'IMMUNE_MODULATION', 'ANTIATHEROGENIC'],
    description: 'Витамин Е — главный жирорастворимый антиоксидант. На курсе ААС защищает сердце и печень от окислительного стресса.',
    synergies: [
      { with: "vitamin_e", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "astaxanthin", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Витамин Е в крови', when: 'Каждые 12 нед', targetRange: '12-46 мкмоль/л' }
    ],
    contraindications: ['Приём антикоагулянтов', 'Дефицит витамина К'],
    sideEffects: ['При высоких дозах — кровоточивость', 'Взаимодействие с антикоагулянтами'],
    dosage: { mg: 200, timing: 'с едой (жирорастворимый)', form: 'смешанные токоферолы' },
    bestForCourse: true,
  },
  vitamin_b_complex: {
    id: 'vitamin_b_complex',
    name: 'Vitamin B Complex',
    nameRu: 'Витамин В-Комплекс',
    tier: 'standard',
    category: ['vitamin', 'metabolic', 'neuroprotector'],
    forms: [
      { id: 'vitamin_b_complex', name: 'Vitamin B Complex', nameRu: 'B-50 Комплекс', dose: '50 мг', best: true },
      { id: 'vitamin_b_complex_2', name: 'Vitamin B Complex', nameRu: 'B-100 Комплекс', dose: '50 мг', best: false }
    ],
    organs: ['BRAIN', 'LIVER', 'NERVES'],
    systems: ['neuro', 'hepatic', 'hematologic'],
    mechanisms: ['B_VITAMIN_SYNERGY', 'METHYLATION_SUPPORT', 'ENERGY_PRODUCTION', 'NEUROTRANSMITTER_SYNTHESIS'],
    description: 'Комплекс витаминов группы В — синергетическая формула для нервной системы и метилирования. На курсе ААС компенсирует возросшую потребность.',
    synergies: [
      { with: "vitamin_b_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Гомоцистеин', when: 'Каждые 8 нед', targetRange: '<15 мкмоль/л' }
    ],
    contraindications: [],
    sideEffects: ['Окрашивание мочи (В2)', 'Тошнота натощак', 'При высоких дозах B6 — нейропатия'],
    dosage: { mg: 50, timing: 'утро с едой', form: 'капсулы B-50 или B-100' },
    bestForCourse: true,
  },
  inositol: {
    id: 'inositol',
    name: 'Inositol',
    nameRu: 'Инозитол (Мио-инозитол)',
    tier: 'advanced',
    category: ['metabolic', 'hormonal'],
    forms: [
      { id: 'inositol', name: 'Inositol', nameRu: 'Мио-инозитол 2000 мг', dose: '2 г 2x/д', best: true },
      { id: 'inositol_2', name: 'Inositol', nameRu: 'Смесь мио/D-хиро-инозитол 40:1', dose: '2 г', best: false }
    ],
    organs: ['BRAIN', 'LIVER', 'REPRODUCTIVE'],
    systems: ['neuro', 'endocrine', 'reproductive'],
    mechanisms: ['INSULIN_SIGNALING', 'SEROTONIN_MODULATION', 'LIPID_SIGNALING', 'OOCYTE_MATURATION'],
    description: 'Инозитол — второй мессенджер инсулина и серотонина. Улучшает чувствительность к инсулину. На курсе поддерживает инсулиновую чувствительность.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Инсулин натощак', when: 'Каждые 8 нед', targetRange: '<12 мкЕд/мл' }
    ],
    contraindications: ['Беременность (с осторожностью)'],
    sideEffects: ['Редко: диарея при высоких дозах', 'Метеоризм'],
    dosage: { mg: 2000, timing: '2x/д с едой', form: 'мио-инозитол или смесь 40:1' },
    bestForCourse: false,
  },
  betaine: {
    id: 'betaine',
    name: 'Betaine',
    nameRu: 'Бетаин (Триметилглицин)',
    tier: 'advanced',
    category: ['metabolic', 'hepatoprotector'],
    forms: [
      { id: 'betaine', name: 'Betaine', nameRu: 'Бетаин HCl 3 г', dose: '3 г 2x/д', best: true },
      { id: 'betaine_2', name: 'Betaine', nameRu: 'Безводный бетаин (ТМГ) 3 г', dose: '3 г', best: false }
    ],
    organs: ['LIVER', 'HEART'],
    systems: ['hepatic', 'cardio', 'metabolic'],
    mechanisms: ['METHYL_DONATION', 'HOMOCYSTEINE_LOWERING', 'OSMOPROTECTION', 'LIPID_REDUCTION'],
    description: 'Бетаин — донор метильных групп, снижает гомоцистеин и защищает печень. На курсе ААС поддерживает метилирование.',
    synergies: [
      { with: "folate", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "betaine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Гомоцистеин', when: 'Каждые 8 нед', targetRange: '<15 мкмоль/л' },
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед', targetRange: '<40 Ед/л' }
    ],
    contraindications: ['Тяжёлая почечная недостаточность'],
    sideEffects: ['Диарея при высоких дозах', 'Тошнота'],
    dosage: { mg: 3000, timing: 'с едой 2x/д', form: 'бетаин HCl или безводный бетаин' },
    bestForCourse: false,
  },
  pqq: {
    id: 'pqq',
    name: 'PQQ',
    nameRu: 'Пирролохинолинхинон (PQQ)',
    tier: 'advanced',
    category: ['antioxidant', 'neuroprotector'],
    forms: [
      { id: 'pqq', name: 'PQQ', nameRu: 'PQQ 20 мг', dose: '20 мг', best: true },
      { id: 'pqq_2', name: 'PQQ', nameRu: 'PQQ + CoQ10 комплекс', dose: '20 мг', best: false }
    ],
    organs: ['BRAIN', 'HEART'],
    systems: ['neuro', 'cardio', 'metabolic'],
    mechanisms: ['MITOCHONDRIAL_BIOGENESIS', 'ANTIOXIDANT', 'NGF_STIMULATION', 'ENERGY_PRODUCTION'],
    description: 'PQQ — редокс-кофактор, стимулирует биогенез митохондрий через PGC-1a. Синергичен с CoQ10.',
    synergies: [
      { with: "coq10", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Энергия/усталость', when: 'Субъективно каждые 4 нед' }
    ],
    contraindications: ['Беременность', 'Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: бессонница при приёме вечером', 'Головная боль'],
    dosage: { mg: 20, timing: 'утро с едой', form: 'PQQ динатриевая соль' },
    bestForCourse: false,
  },
  vitamin_complex: {
    id: 'vitamin_complex',
    name: 'Vitamin Complex',
    nameRu: 'Витаминный комплекс',
    tier: 'standard',
    category: ['vitamin', 'metabolic'],
    forms: [
      { id: 'vitamin_complex', name: 'Vitamin Complex', nameRu: 'Мультивитаминный комплекс для мужчин', dose: '1 мг', best: true },
      { id: 'vitamin_complex_2', name: 'Vitamin Complex', nameRu: 'Мультивитаминный комплекс спорт', dose: '1 мг', best: false }
    ],
    organs: ['LIVER', 'BRAIN', 'IMMUNE_SYSTEM'],
    systems: ['hepatic', 'neuro', 'immune', 'metabolic'],
    mechanisms: ['MICRONUTRIENT_REPLETION', 'COFACTOR_SUPPORT', 'ANTIOXIDANT_NETWORK', 'METHYLATION'],
    description: 'Мультивитаминный комплекс — базовая добавка для покрытия дефицитов. На курсе ААС потребность в витаминах возрастает на 30-50%.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'ОАК', when: 'Каждые 8 нед' },
      { what: 'Ферритин', when: 'Каждые 12 нед', targetRange: '30-150 нг/мл' }
    ],
    contraindications: ['Гипервитаминоз А или D', 'Гемохроматоз (формы с железом)'],
    sideEffects: ['Окрашивание мочи (В2)', 'Тошнота натощак'],
    dosage: { mg: 1, timing: 'утро с едой', form: 'капсулы мультивитаминов' },
    bestForCourse: true,
  },
  pterostilbene: {
    id: 'pterostilbene',
    name: 'Pterostilbene',
    nameRu: 'Птеростильбен',
    tier: 'advanced',
    category: ['antioxidant', 'cardioprotector'],
    forms: [
      { id: 'pterostilbene', name: 'Pterostilbene', nameRu: 'Птеростильбен 250 мг', dose: '250 мг 2x/д', best: true },
      { id: 'pterostilbene_2', name: 'Pterostilbene', nameRu: 'Птеростильбен + Ресвератрол комплекс', dose: '250 мг', best: false }
    ],
    organs: ['HEART', 'BRAIN', 'LIVER'],
    systems: ['cardio', 'neuro', 'hepatic'],
    mechanisms: ['SIRT1_ACTIVATION', 'ANTIOXIDANT', 'LIPID_LOWERING', 'ANTI_INFLAMMATORY'],
    description: 'Птеростильбен — диметиловый аналог ресвератрола с биодоступностью 80%. Активирует SIRT1, снижает холестерин.',
    synergies: [
      { with: "vitamin_b3", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед', targetRange: 'ЛПНП<3.0' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Редко: диарея', 'Головная боль при высоких дозах'],
    dosage: { mg: 250, timing: 'утро с едой', form: 'птеростильбен капсулы' },
    bestForCourse: false,
  },
  saw_palmetto: {
    id: 'saw_palmetto',
    name: 'Saw Palmetto',
    nameRu: 'Сереноа ползучая (Пальметто)',
    tier: 'advanced',
    category: ['herb', 'hormonal'],
    forms: [
      { id: 'saw_palmetto', name: 'Saw Palmetto', nameRu: 'Экстракт сереноа 320 мг', dose: '320 мг 2x/д', best: true },
      { id: 'saw_palmetto_2', name: 'Saw Palmetto', nameRu: 'Сереноа + Цинк комплекс', dose: '320 мг', best: false }
    ],
    organs: ['PROSTATE', 'REPRODUCTIVE'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['5AR_INHIBITION', 'DHT_REDUCTION', 'PROSTATE_SHRINKAGE', 'ANTI_ANDROGENIC'],
    description: 'Сереноа — ингибитор 5-альфа-редуктазы, снижает DHT локально в простате. На курсе ААС защищает простату от гипертрофии.',
    synergies: [
      { with: "vitamin_b6", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "saw_palmetto", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'ПСА', when: 'Каждые 12 нед', targetRange: '<4 нг/мл' },
      { what: 'Свободный тестостерон', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Рак простаты (может маскировать ПСА)'],
    sideEffects: ['Редко: снижение либидо', 'Редко: желудочный дискомфорт'],
    dosage: { mg: 320, timing: 'с едой 2x/д', form: 'экстракт сереноа 85-95% жирных кислот' },
    bestForCourse: true,
  },
  hcg: {
    id: 'hcg',
    name: 'HCG',
    nameRu: 'ХГЧ (Хорионический гонадотропин)',
    tier: 'specialty',
    category: ['peptide', 'hormonal'],
    forms: [
      { id: 'hcg', name: 'HCG', nameRu: 'ХГЧ 5000 МЕ', dose: '250 мг 2x/д', best: true },
      { id: 'hcg_2', name: 'HCG', nameRu: 'ХГЧ 10000 МЕ', dose: '250 мг', best: false }
    ],
    organs: ['REPRODUCTIVE', 'TESTES'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['LH_MIMIC', 'TESTOSTERONE_PRODUCTION', 'SPERMATOGENESIS_RESTORE', 'TESTICULAR_VOLUME_PRESERVATION'],
    description: 'ХГЧ — мимик ЛГ, стимулирует клетки Лейдига к продукции тестостерона. На курсе ААС предотвращает атрофию яичек.',
    synergies: [
      { with: "testosterone", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Тестостерон общий', when: 'Каждые 4 нед', targetRange: '12-33 нмоль/л' },
      { what: 'Эстрадиол', when: 'Каждые 4 нед', targetRange: '<200 пмоль/л' }
    ],
    contraindications: ['Рак яичек', 'Рак простаты', 'Гинекомастия в анамнезе'],
    sideEffects: ['Гинекомастия (без ИА)', 'Задержка жидкости', 'Повышение эстрадиола'],
    dosage: { mg: 250, timing: '2x/нед п/к или в/м', form: 'ХГЧ лиофилизат (реконструкция)' },
    bestForCourse: true,
  },
  l_carnitine: {
    id: 'l_carnitine',
    name: 'L-Carnitine',
    nameRu: 'Л-Карнитин',
    tier: 'standard',
    category: ['amino', 'metabolic', 'cardioprotector'],
    forms: [
      { id: 'l_carnitine', name: 'L-Carnitine', nameRu: 'Л-Карнитин тартрат 1000 мг', dose: '2 г 2x/д', best: true },
      { id: 'l_carnitine_2', name: 'L-Carnitine', nameRu: 'Ацетил-Л-Карнитин 500 мг', dose: '2 г', best: false },
      { id: 'l_carnitine_3', name: 'L-Carnitine', nameRu: 'Пропионил-Л-Карнитин 500 мг', dose: '2 г', best: false }
    ],
    organs: ['HEART', 'MUSCLES', 'LIVER'],
    systems: ['cardio', 'metabolic', 'hepatic'],
    mechanisms: ['FATTY_ACID_TRANSPORT', 'MITOCHONDRIAL_BETA_OXIDATION', 'ENERGY_PRODUCTION', 'CARDIAC_FUEL'],
    description: 'Л-Карнитин — транспортировщик жирных кислот в митохондрии. АЛК дополнительно повышает ацетилхолин. На курсе — кардиопротектор.',
    synergies: [
      { with: "caffeine", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "alpha_lipoic", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "lions_mane", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "thyroid_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'ТМАО', when: 'Каждые 12 нед', targetRange: '<5 мкмоль/л' },
      { what: 'Липидограмма', when: 'Каждые 8 нед', targetRange: 'ТГ<1.7 ммоль/л' }
    ],
    contraindications: ['Эпилепсия (с осторожностью)', 'Гипотиреоз (с осторожностью)'],
    sideEffects: ['Рыбный запах тела при высоких дозах', 'Тошнота натощак'],
    dosage: { mg: 2000, timing: 'натощак, 30 мин до тренировки', form: 'Л-карнитин тартрат или АЛК' },
    bestForCourse: true,
  },
  phosphatidylcholine: {
    id: 'phosphatidylcholine',
    name: 'Phosphatidylcholine',
    nameRu: 'Фосфатидилхолин (Лецитин/PPC)',
    tier: 'core',
    category: ['hepatoprotector', 'neuroprotector'],
    forms: [
      { id: 'phosphatidylcholine', name: 'Phosphatidylcholine', nameRu: 'PPC (Эссенциале) 1200 мг', dose: '1.2 г 2x/д', best: true },
      { id: 'phosphatidylcholine_2', name: 'Phosphatidylcholine', nameRu: 'Лецитин 1200 мг', dose: '1.2 г', best: false },
      { id: 'phosphatidylcholine_3', name: 'Phosphatidylcholine', nameRu: 'Альфа-GPC 300 мг', dose: '1.2 г', best: false }
    ],
    organs: ['LIVER', 'BRAIN'],
    systems: ['hepatic', 'neuro'],
    mechanisms: ['MEMBRANE_SYNTHESIS', 'BILE_FLOW', 'LIPID_TRANSPORT', 'ACETYLCHOLINE_PRECURSOR'],
    description: 'Фосфатидилхолин — главный компонент мембран и желчи. В форме PPC защищает печень от жировой инфильтрации. На курсе — препарат выбора для гепатопротекции.',
    synergies: [
      { with: "huperzine_a", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "antipsychotic_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед', targetRange: '<40 Ед/л' },
      { what: 'ГГТ', when: 'Каждые 4 нед', targetRange: '<50 Ед/л' },
      { what: 'УЗИ печени', when: 'Каждые 12 нед' }
    ],
    contraindications: [],
    sideEffects: ['Диарея при высоких дозах', 'Редко: тошнота'],
    dosage: { mg: 1200, timing: 'с едой 2x/д', form: 'PPC (полиенилфосфатидилхолин) или лецитин' },
    bestForCourse: true,
  },
  prebiotics: {
    id: 'prebiotics',
    name: 'Prebiotics',
    nameRu: 'Пребиотики',
    tier: 'standard',
    category: ['probiotic', 'gut'],
    forms: [
      { id: 'prebiotics', name: 'Prebiotics', nameRu: 'Пребиотический комплекс 5 г', dose: '5 г 2x/д', best: true },
      { id: 'prebiotics_2', name: 'Prebiotics', nameRu: 'Инулин 5 г', dose: '5 г', best: false },
      { id: 'prebiotics_3', name: 'Prebiotics', nameRu: 'ФОС 3 г', dose: '5 г', best: false }
    ],
    organs: ['INTESTINES'],
    systems: ['hepatic', 'immune', 'metabolic'],
    mechanisms: ['PROBIOTIC_GROWTH', 'SHORT_CHAIN_FATTY_ACID_PRODUCTION', 'GUT_BARRIER_INTEGRITY', 'IMMUNE_MODULATION'],
    description: 'Пребиотики — неперевариваемые пищевые волокна, питающие полезную микрофлору. На курсе ААС поддерживают микробиом.',
    synergies: [
      { with: "probiotics", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma_drugs", effect: "", mechanism: "", severity: "LOW" },
      { with: "colloidal_minerals", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Калпротектин', when: 'Каждые 8 нед', targetRange: '<50 мкг/г' }
    ],
    contraindications: ['SIBO', 'FODMAP-непереносимость'],
    sideEffects: ['Метеоризм при начале', 'Диарея при высоких дозах'],
    dosage: { mg: 5000, timing: 'с едой, начать с 2-3 г', form: 'порошок пребиотического комплекса' },
    bestForCourse: true,
  },
  glutamine: {
    id: 'glutamine',
    name: 'Glutamine',
    nameRu: 'Глутамин (Л-Глутамин)',
    tier: 'standard',
    category: ['amino', 'gut', 'immune'],
    forms: [
      { id: 'glutamine', name: 'Glutamine', nameRu: 'Л-Глутамин 5 г', dose: '5 г 2x/д', best: true },
      { id: 'glutamine_2', name: 'Glutamine', nameRu: 'Глутамин Премиум 5 г', dose: '5 г', best: false },
      { id: 'glutamine_3', name: 'Glutamine', nameRu: 'Аланил-глутамин 5 г', dose: '5 г', best: false }
    ],
    organs: ['INTESTINES', 'IMMUNE_SYSTEM', 'MUSCLES'],
    systems: ['immune', 'hepatic', 'metabolic'],
    mechanisms: ['INTESTINAL_CELL_FUEL', 'IMMUNE_CELL_PROLIFERATION', 'GLUTATHIONE_PRECURSOR', 'NITROGEN_TRANSPORT'],
    description: 'Глутамин — условно-незаменимая аминокислота, топливо для энтероцитов. Предшественник глутатиона. На курсе поддерживает кишечный барьер и иммунитет.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Глутамин в плазме', when: 'Каждые 12 нед', targetRange: '500-900 мкмоль/л' }
    ],
    contraindications: ['Тяжёлая печёночная недостаточность'],
    sideEffects: ['Метеоризм при высоких дозах', 'Диарея при >15 г/д'],
    dosage: { mg: 5000, timing: 'натощак или после тренировки', form: 'Л-глутамин порошок' },
    bestForCourse: true,
  },
  molybdenum: {
    id: 'molybdenum',
    name: 'Molybdenum',
    nameRu: 'Молибден',
    tier: 'advanced',
    category: ['mineral', 'metabolic'],
    forms: [
      { id: 'molybdenum', name: 'Molybdenum', nameRu: 'Молибден 100 мкг', dose: '100 мкг', best: true },
      { id: 'molybdenum_2', name: 'Molybdenum', nameRu: 'Молибден 200 мкг', dose: '100 мкг', best: false }
    ],
    organs: ['LIVER', 'KIDNEYS'],
    systems: ['hepatic', 'renal', 'metabolic'],
    mechanisms: ['SULFITE_OXIDASE', 'XANTHINE_OXIDASE', 'DETOXIFICATION'],
    description: 'Молибден — кофактор сульфитоксидазы и ксантиноксидазы, критичен для детоксикации сульфитов.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Мочевая кислота', when: 'Каждые 12 нед', targetRange: '<420 мкмоль/л' }
    ],
    contraindications: ['Молибденовая подагра (редко)'],
    sideEffects: ['Тошнота'],
    dosage: { mg: 0.1, timing: 'с едой', form: 'молибден цитрат' },
    bestForCourse: false,
  },
  boron: {
    id: 'boron',
    name: 'Boron',
    nameRu: 'Бор',
    tier: 'advanced',
    category: ['mineral', 'hormonal'],
    forms: [
      { id: 'boron', name: 'Boron', nameRu: 'Бор цитрат 3 мг', dose: '3 мг', best: true },
      { id: 'boron_2', name: 'Boron', nameRu: 'Бор глицинат 3 мг', dose: '3 мг', best: false }
    ],
    organs: ['BONES', 'REPRODUCTIVE'],
    systems: ['endocrine', 'musculoskeletal'],
    mechanisms: ['BONE_MINERALIZATION', 'FREE_TESTOSTERONE_INCREASE', 'VITAMIN_D_ACTIVATION', 'ESTROGEN_MODULATION'],
    description: 'Бор — следовой минерал, повышает свободный тестостерон и активирует витамин D. На курсе ААС поддерживает костную ткань.',
    synergies: [
      { with: "zinc", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Свободный тестостерон', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: тошнота при высоких дозах'],
    dosage: { mg: 3, timing: 'с едой', form: 'бор цитрат или глицинат' },
    bestForCourse: false,
  },
  silicon: {
    id: 'silicon',
    name: 'Silicon',
    nameRu: 'Кремний',
    tier: 'advanced',
    category: ['mineral', 'joint'],
    forms: [
      { id: 'silicon', name: 'Silicon', nameRu: 'Ортокремниевая кислота 10 мг', dose: '10 мг', best: true },
      { id: 'silicon_2', name: 'Silicon', nameRu: 'Экстракт хвоща 10 мг', dose: '10 мг', best: false }
    ],
    organs: ['BONES', 'JOINTS', 'SKIN'],
    systems: ['musculoskeletal'],
    mechanisms: ['COLLAGEN_SYNTHESIS', 'BONE_MINERALIZATION', 'CONNECTIVE_TISSUE', 'CARTILAGE_FORMATION'],
    description: 'Кремний — важен для синтеза коллагена и минерализации костей. На курсе ААС поддерживает соединительную ткань.',
    synergies: [
      { with: "silicon", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "calcium", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "glycine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Костная плотность', when: 'Каждые 12 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 10, timing: 'с едой', form: 'ортокремниевая кислота или экстракт хвоща' },
    bestForCourse: false,
  },
  calcium: {
    id: 'calcium',
    name: 'Calcium',
    nameRu: 'Кальций',
    tier: 'standard',
    category: ['mineral', 'bone'],
    forms: [
      { id: 'calcium', name: 'Calcium', nameRu: 'Цитрат кальция 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'calcium_2', name: 'Calcium', nameRu: 'Карбонат кальция 500 мг', dose: '500 мг', best: false }
    ],
    organs: ['BONES', 'MUSCLES', 'HEART'],
    systems: ['musculoskeletal', 'cardio', 'hematologic'],
    mechanisms: ['BONE_MINERALIZATION', 'MUSCLE_CONTRACTION', 'BLOOD_CLOTTING', 'NERVE_SIGNALING'],
    description: 'Кальций — основной минерал костной ткани. На курсе ААС поддерживает плотность костей, особенно при ИА.',
    synergies: [
      { with: "vitamin_d3", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "vitamin_k2", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "sulforaphane", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "silicon", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "calcium", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "glycine", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "diuretic_drugs", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "iron", effect: "", mechanism: "", severity: "HIGH" },
      { with: "magnesium", effect: "", mechanism: "", severity: "HIGH" },
      { with: "ppi_drugs", effect: "", mechanism: "", severity: "HIGH" },
      { with: "magnesium", effect: "", mechanism: "", severity: "LOW" },
      { with: "iron", effect: "", mechanism: "", severity: "LOW" },
      { with: "diuretic_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Кальций общий', when: 'Каждые 12 нед', targetRange: '2.1-2.6 ммоль/л' }
    ],
    contraindications: ['Гиперкальциемия', 'Камни в почках (с осторожностью)'],
    sideEffects: ['Запор при карбонате', 'Риск камней в почках при избытке'],
    dosage: { mg: 500, timing: 'с едой (2x/д)', form: 'цитрат или карбонат кальция' },
    bestForCourse: true,
  },
  sodium: {
    id: 'sodium',
    name: 'Sodium',
    nameRu: 'Натрий',
    tier: 'standard',
    category: ['mineral', 'electrolyte'],
    forms: [
      { id: 'sodium', name: 'Sodium', nameRu: 'Натрия цитрат 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'sodium_2', name: 'Sodium', nameRu: 'Натрия хлорид 500 мг', dose: '500 мг', best: false }
    ],
    organs: ['KIDNEYS', 'HEART', 'MUSCLES'],
    systems: ['renal', 'cardio', 'metabolic'],
    mechanisms: ['ELECTROLYTE_BALANCE', 'FLUID_REGULATION', 'BLOOD_PRESSURE', 'NERVE_SIGNALING'],
    description: 'Натрий — основной внеклеточный электролит. На курсе ААС важен для электролитного баланса.',
    synergies: [],
    conflicts: [
      { with: "lithium", effect: "", mechanism: "", severity: "HIGH" },
      { with: "magnesium", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Натрий в сыворотке', when: 'Каждые 4 нед', targetRange: '135-145 ммоль/л' }
    ],
    contraindications: ['Гипертоническая болезнь (ограничить)'],
    sideEffects: ['Отёки при избытке', 'Повышение давления при избытке'],
    dosage: { mg: 500, timing: 'с едой', form: 'натрия хлорид или цитрат' },
    bestForCourse: false,
  },
  manganese: {
    id: 'manganese',
    name: 'Manganese',
    nameRu: 'Марганец',
    tier: 'advanced',
    category: ['mineral', 'metabolic'],
    forms: [
      { id: 'manganese', name: 'Manganese', nameRu: 'Марганца глицинат 5 мг', dose: '5 мг', best: true },
      { id: 'manganese_2', name: 'Manganese', nameRu: 'Марганца цитрат 5 мг', dose: '5 мг', best: false }
    ],
    organs: ['BONES', 'LIVER', 'JOINTS'],
    systems: ['hepatic', 'musculoskeletal', 'metabolic'],
    mechanisms: ['SOD_MITOCHONDRIAL', 'BONE_FORMATION', 'GLUCONEOGENESIS', 'COLLAGEN_SYNTHESIS'],
    description: 'Марганец — кофактор митохондриальной СОД. На курсе ААС защищает суставы.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Марганец в крови', when: 'Каждые 12 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: нейротоксичность при высоких дозах'],
    dosage: { mg: 5, timing: 'с едой', form: 'марганца глицинат' },
    bestForCourse: false,
  },
  iodine: {
    id: 'iodine',
    name: 'Iodine',
    nameRu: 'Йод',
    tier: 'standard',
    category: ['mineral', 'hormonal'],
    forms: [
      { id: 'iodine', name: 'Iodine', nameRu: 'Йодид калия 150 мкг', dose: '150 мкг', best: true },
      { id: 'iodine_2', name: 'Iodine', nameRu: 'Ламинария 150 мкг', dose: '150 мкг', best: false }
    ],
    organs: ['THYROID', 'REPRODUCTIVE'],
    systems: ['endocrine', 'reproductive'],
    mechanisms: ['THYROID_HORMONE_SYNTHESIS', 'ENERGY_METABOLISM', 'BRAIN_DEVELOPMENT', 'ESTROGEN_METABOLISM'],
    description: 'Йод — ключевой элемент синтеза тиреоидных гормонов. На курсе ААС поддерживает функцию щитовидной железы.',
    synergies: [
      { with: "selenium", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "thyroid_drugs", effect: "", mechanism: "", severity: "LOW" },
      { with: "lithium", effect: "", mechanism: "", severity: "HIGH" },
      { with: "antithyroid_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'ТТГ', when: 'Каждые 8 нед', targetRange: '0.4-4.0 мЕд/л' },
      { what: 'Т3 свободный', when: 'Каждые 8 нед', targetRange: '2.3-6.5 пмоль/л' }
    ],
    contraindications: ['Гипертиреоз', 'Тиреотоксикоз'],
    sideEffects: ['Акне при высоких дозах', 'Йод-индуцированный гипертиреоз (редко)'],
    dosage: { mg: 0.15, timing: 'с едой', form: 'йодид калия или ламинария' },
    bestForCourse: false,
  },
  lithium: {
    id: 'lithium',
    name: 'Lithium',
    nameRu: 'Литий (микродозы)',
    tier: 'specialty',
    category: ['mineral', 'neuroprotector'],
    forms: [
      { id: 'lithium', name: 'Lithium', nameRu: 'Оротат лития 1 мг', dose: '1 мг', best: true },
      { id: 'lithium_2', name: 'Lithium', nameRu: 'Аспартат лития 1 мг', dose: '1 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['MOOD_STABILIZATION', 'NEUROPROTECTION', 'GSK3_INHIBITION', 'BDNF_INCREASE'],
    description: 'Литий в микродозах — нейропротектор, стабилизирует настроение через ингибирование GSK-3b и повышение BDNF.',
    synergies: [],
    conflicts: [
      { with: "sodium", effect: "", mechanism: "", severity: "HIGH" },
      { with: "nsaid_drugs", effect: "", mechanism: "", severity: "HIGH" },
      { with: "iodine", effect: "", mechanism: "", severity: "HIGH" },
      { with: "magnesium", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Литий в крови', when: 'Каждые 12 нед', targetRange: '<0.6 ммоль/л (микродозы)' }
    ],
    contraindications: ['Болезнь почек', 'Дегидратация'],
    sideEffects: ['Редко побочные в микродозах', 'При превышении — тремор', ' полиурия'],
    dosage: { mg: 1, timing: 'утро', form: 'оротат лития или аспартат' },
    bestForCourse: false,
  },
  vanadium: {
    id: 'vanadium',
    name: 'Vanadium',
    nameRu: 'Ванадий',
    tier: 'specialty',
    category: ['mineral', 'metabolic'],
    forms: [
      { id: 'vanadium', name: 'Vanadium', nameRu: 'Ванадила сульфат 100 мкг', dose: '100 мкг', best: true },
      { id: 'vanadium_2', name: 'Vanadium', nameRu: 'BMV (бис-мальтолатооксо-ванадий) 100 мкг', dose: '100 мкг', best: false }
    ],
    organs: ['LIVER', 'PANCREAS', 'MUSCLES'],
    systems: ['hepatic', 'endocrine', 'metabolic'],
    mechanisms: ['INSULIN_MIMETIC', 'GLUCONEOGENESIS_INHIBITION', 'GLYCOGEN_SYNTHESIS', 'PTP_INHIBITION'],
    description: 'Ванадий — инсулиномиметик. На курсе ААС поддерживает углеводный обмен.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед', targetRange: '<6.1 ммоль/л' }
    ],
    contraindications: ['Беременность', 'Кормление грудью'],
    sideEffects: ['Тошнота', 'Зелёный стул (ванадила сульфат)'],
    dosage: { mg: 0.1, timing: 'с едой', form: 'ванадила сульфат или BMV' },
    bestForCourse: false,
  },
  phosphorus: {
    id: 'phosphorus',
    name: 'Phosphorus',
    nameRu: 'Фосфор',
    tier: 'standard',
    category: ['mineral', 'bone'],
    forms: [
      { id: 'phosphorus', name: 'Phosphorus', nameRu: 'Дикальцийфосфат 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'phosphorus_2', name: 'Phosphorus', nameRu: 'Фосфат калия 500 мг', dose: '500 мг', best: false }
    ],
    organs: ['BONES', 'KIDNEYS', 'MUSCLES'],
    systems: ['musculoskeletal', 'renal', 'metabolic'],
    mechanisms: ['BONE_MINERALIZATION', 'ATP_SYNTHESIS', 'PHOSPHOLIPID_SYNTHESIS', 'ENERGY_PRODUCTION'],
    description: 'Фосфор — ключевой компонент костей и АТФ. На курсе ААС поддерживает костную ткань.',
    synergies: [],
    conflicts: [
      { with: "magnesium", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Фосфор в крови', when: 'Каждые 12 нед', targetRange: '0.8-1.5 ммоль/л' }
    ],
    contraindications: ['Гиперфосфатемия', 'Почечная недостаточность'],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 500, timing: 'с едой', form: 'дикальцийфосфат или фосфат калия' },
    bestForCourse: false,
  },
  msm: {
    id: 'msm',
    name: 'MSM',
    nameRu: 'МСМ (Метилсульфонилметан)',
    tier: 'advanced',
    category: ['joint', 'antiinflammatory'],
    forms: [
      { id: 'msm', name: 'MSM', nameRu: 'МСМ 1500 мг', dose: '1.5 г 2x/д', best: true },
      { id: 'msm_2', name: 'MSM', nameRu: 'МСМ порошок 3 г', dose: '1.5 г', best: false }
    ],
    organs: ['JOINTS', 'SKIN', 'MUSCLES'],
    systems: ['musculoskeletal'],
    mechanisms: ['SULFUR_DONOR', 'COLLAGEN_SYNTHESIS', 'ANTI_INFLAMMATORY', 'GLUCOSAMINE_POTENTIATION'],
    description: 'МСМ — органическая сера, донор сульфидных групп для синтеза коллагена. Синергичен с глюкозамином. На курсе защищает суставы.',
    synergies: [
      { with: "glucosamine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Боль в суставах', when: 'Субъективно каждые 2 нед' }
    ],
    contraindications: ['Аллергия на серу (редко)'],
    sideEffects: ['Редко: тошнота', 'Диарея при высоких дозах'],
    dosage: { mg: 1500, timing: 'с едой 2x/д', form: 'МСМ капсулы или порошок' },
    bestForCourse: false,
  },
  trace_minerals: {
    id: 'trace_minerals',
    name: 'Trace Minerals',
    nameRu: 'Комплекс микроэлементов',
    tier: 'standard',
    category: ['mineral', 'metabolic'],
    forms: [
      { id: 'trace_minerals', name: 'Trace Minerals', nameRu: 'Хелатный комплекс микроэлементов', dose: '1 мг', best: true },
      { id: 'trace_minerals_2', name: 'Trace Minerals', nameRu: 'Коллоидные минералы', dose: '1 мг', best: false }
    ],
    organs: ['LIVER', 'IMMUNE_SYSTEM'],
    systems: ['hepatic', 'immune', 'metabolic'],
    mechanisms: ['ENZYME_COFACTOR', 'IMMUNE_FUNCTION', 'ANTIOXIDANT_DEFENSE', 'HORMONE_SYNTHESIS'],
    description: 'Комплекс микроэлементов (Se, Mn, Mo, Cr, V, B, Si) — обеспечивает работу 300+ ферментов.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Микроэлементы в волосах', when: 'Каждые 12 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: тошнота натощак'],
    dosage: { mg: 1, timing: 'с едой', form: 'хелатный комплекс микроэлементов' },
    bestForCourse: false,
  },
  chromium: {
    id: 'chromium',
    name: 'Chromium',
    nameRu: 'Хром',
    tier: 'standard',
    category: ['mineral', 'metabolic'],
    forms: [
      { id: 'chromium', name: 'Chromium', nameRu: 'Хрома пиколинат 200 мкг', dose: '200 мкг', best: true },
      { id: 'chromium_2', name: 'Chromium', nameRu: 'Хром хелат 200 мкг', dose: '200 мкг', best: false }
    ],
    organs: ['PANCREAS', 'MUSCLES', 'LIVER'],
    systems: ['endocrine', 'metabolic'],
    mechanisms: ['INSULIN_SENSITIVITY', 'GLUCOSE_METABOLISM', 'GLYCOGEN_SYNTHESIS', 'LIPID_METABOLISM'],
    description: 'Хром — усиливает действие инсулина через хромодулин. На курсе ААС поддерживает инсулиновую чувствительность.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 8 нед', targetRange: '<6.1 ммоль/л' },
      { what: 'Инсулин натощак', when: 'Каждые 8 нед', targetRange: '<12 мкЕд/мл' }
    ],
    contraindications: [],
    sideEffects: ['Редко: тошнота', 'Головная боль при высоких дозах'],
    dosage: { mg: 0.2, timing: 'с едой', form: 'хрома пиколинат или хелат' },
    bestForCourse: false,
  },
  colloidal_minerals: {
    id: 'colloidal_minerals',
    name: 'Colloidal Minerals',
    nameRu: 'Коллоидные минералы',
    tier: 'advanced',
    category: ['mineral', 'metabolic'],
    forms: [
      { id: 'colloidal_minerals', name: 'Colloidal Minerals', nameRu: 'Коллоидные минералы жидкие', dose: '15 мг', best: true },
      { id: 'colloidal_minerals_2', name: 'Colloidal Minerals', nameRu: 'Коллоидные минералы + витамины', dose: '15 мг', best: false }
    ],
    organs: ['BONES', 'LIVER', 'KIDNEYS'],
    systems: ['hepatic', 'renal', 'musculoskeletal'],
    mechanisms: ['MINERAL_REPLETION', 'ENZYME_ACTIVATION', 'PH_BALANCE', 'ELECTROLYTE_SUPPORT'],
    description: 'Коллоидные минералы — жидкая форма 70+ микроэлементов с высокой биодоступностью.',
    synergies: [],
    conflicts: [
      { with: "prebiotics", effect: "", mechanism: "", severity: "LOW" },
      { with: "ppi_drugs", effect: "", mechanism: "", severity: "HIGH" },
      { with: "magnesium", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Общий минеральный статус', when: 'Каждые 12 нед' }
    ],
    contraindications: [],
    sideEffects: ['Металлический привкус', 'Редко: тошнота'],
    dosage: { mg: 15, timing: 'натощак', form: 'коллоидная жидкая форма' },
    bestForCourse: false,
  },
  strontium: {
    id: 'strontium',
    name: 'Strontium',
    nameRu: 'Стронций',
    tier: 'specialty',
    category: ['mineral', 'bone'],
    forms: [
      { id: 'strontium', name: 'Strontium', nameRu: 'Стронция ренелат 680 мг', dose: '680 мкг', best: true },
      { id: 'strontium_2', name: 'Strontium', nameRu: 'Стронция цитрат 340 мг', dose: '680 мкг', best: false }
    ],
    organs: ['BONES'],
    systems: ['musculoskeletal'],
    mechanisms: ['BONE_FORMATION', 'OSTEOCLAST_INHIBITION', 'CALCIUM_ABSORPTION', 'BONE_MINERAL_DENSITY'],
    description: 'Стронций (ренелат) — увеличивает костное формирование и подавляет резорбцию.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Денситометрия', when: 'Каждые 12 мес' },
      { what: 'Кальций', when: 'Каждые 12 нед', targetRange: '2.1-2.6 ммоль/л' }
    ],
    contraindications: ['Тяжёлая почечная недостаточность', 'Венозная тромбоэмболия'],
    sideEffects: ['Тошнота', 'Диарея', 'Редко: сыпь'],
    dosage: { mg: 0.68, timing: 'на ночь (отдельно от Ca)', form: 'стронция ренелат' },
    bestForCourse: false,
  },
  omega6: {
    id: 'omega6',
    name: 'Omega-6',
    nameRu: 'Омега-6 (GLA)',
    tier: 'standard',
    category: ['fatty_acid', 'antiinflammatory'],
    forms: [
      { id: 'omega6', name: 'Omega-6', nameRu: 'Масло энотеры 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'omega6_2', name: 'Omega-6', nameRu: 'Масло бурачника 500 мг', dose: '500 мг', best: false }
    ],
    organs: ['SKIN', 'REPRODUCTIVE'],
    systems: ['endocrine', 'reproductive'],
    mechanisms: ['GLA_ANTI_INFLAMMATORY', 'PROSTAGLANDIN_BALANCE', 'SKIN_BARRIER', 'HORMONE_REGULATION'],
    description: 'Омега-6 (гамма-линоленовая кислота) — из энотеры и бурачника. Противовоспалительная через PGE1.',
    synergies: [
      { with: "omega6", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Кожные покровы', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: диарея', 'Рыбная отрыжка'],
    dosage: { mg: 500, timing: 'с едой', form: 'масло энотеры или бурачника' },
    bestForCourse: false,
  },
  omega7: {
    id: 'omega7',
    name: 'Omega-7',
    nameRu: 'Омега-7 (Пальмитолеиновая к-та)',
    tier: 'advanced',
    category: ['fatty_acid', 'metabolic'],
    forms: [
      { id: 'omega7', name: 'Omega-7', nameRu: 'Масло облепихи 250 мг', dose: '250 мг 2x/д', best: true },
      { id: 'omega7_2', name: 'Omega-7', nameRu: 'Пальмитолеат 250 мг', dose: '250 мг', best: false }
    ],
    organs: ['SKIN', 'MUCOSA', 'LIVER'],
    systems: ['hepatic', 'metabolic'],
    mechanisms: ['MUCOSA_PROTECTION', 'LIPID_METABOLISM', 'SKIN_BARRIER', 'INSULIN_SENSITIVITY'],
    description: 'Омега-7 — из облепихи. Защищает слизистые и кожу. На курсе ААС — поддержка слизистых ЖКТ.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Кожа/слизистые', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: диарея'],
    dosage: { mg: 250, timing: 'с едой', form: 'масло облепихи или пальмитолеат' },
    bestForCourse: false,
  },
  omega9: {
    id: 'omega9',
    name: 'Omega-9',
    nameRu: 'Омега-9 (Олеиновая к-та)',
    tier: 'standard',
    category: ['fatty_acid', 'cardioprotector'],
    forms: [
      { id: 'omega9', name: 'Omega-9', nameRu: 'Оливковое масло 1 ст.л.', dose: '1 мг', best: true },
      { id: 'omega9_2', name: 'Omega-9', nameRu: 'Авокадо масло 1 ст.л.', dose: '1 мг', best: false }
    ],
    organs: ['HEART', 'VESSELS', 'LIVER'],
    systems: ['cardio', 'hepatic'],
    mechanisms: ['OLEIC_ACID_ANTI_INFLAMMATORY', 'LIPID_LOWERING', 'BILE_FLOW_STIMULATION', 'INSULIN_SENSITIVITY'],
    description: 'Омега-9 (олеиновая кислота) — из оливкового масла. Снижает ЛПНП, поддерживает желчеотток.',
    synergies: [
      { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega9", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "egcg", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "mushroom_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед', targetRange: 'ЛПНП<3.0' }
    ],
    contraindications: [],
    sideEffects: ['Редко: диарея при избытке'],
    dosage: { mg: 1, timing: 'с едой', form: 'оливковое масло или авокадо' },
    bestForCourse: false,
  },
  cla: {
    id: 'cla',
    name: 'CLA',
    nameRu: 'КЛА (Конъюгированная линолевая к-та)',
    tier: 'advanced',
    category: ['fatty_acid', 'metabolic'],
    forms: [
      { id: 'cla', name: 'CLA', nameRu: 'CLA 1500 мг 2x/д', dose: '3 г 2x/д', best: true },
      { id: 'cla_2', name: 'CLA', nameRu: 'CLA порошок 3 г', dose: '3 г', best: false }
    ],
    organs: ['MUSCLES', 'LIVER', 'REPRODUCTIVE'],
    systems: ['metabolic', 'endocrine'],
    mechanisms: ['FAT_OXIDATION', 'LEAN_MASS_PRESERVATION', 'INSULIN_SENSITIVITY', 'ANTI_INFLAMMATORY'],
    description: 'КЛА — улучшает композицию тела через стимуляцию окисления жиров и сохранение сухой массы.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Жировая масса', when: 'Каждые 4 нед' },
      { what: 'Инсулин натощак', when: 'Каждые 8 нед', targetRange: '<12 мкЕд/мл' }
    ],
    contraindications: [],
    sideEffects: ['Диарея', 'Тошнота', 'Редко: инсулинорезистентность при высоких дозах'],
    dosage: { mg: 3000, timing: 'с едой 2x/д', form: 'CLA капсулы (т10ц12+ц9т11 изомеры)' },
    bestForCourse: false,
  },
  mct: {
    id: 'mct',
    name: 'MCT Oil',
    nameRu: 'МСТ Масло',
    tier: 'advanced',
    category: ['fatty_acid', 'metabolic'],
    forms: [
      { id: 'mct', name: 'MCT Oil', nameRu: 'МСТ масло С8 (каприловое)', dose: '15 г 2x/д', best: true },
      { id: 'mct_2', name: 'MCT Oil', nameRu: 'МСТ масло С8/С10 смесь', dose: '15 г', best: false }
    ],
    organs: ['LIVER', 'MUSCLES', 'BRAIN'],
    systems: ['hepatic', 'metabolic', 'neuro'],
    mechanisms: ['KETONE_PRODUCTION', 'QUICK_ENERGY', 'LIPID_METABOLISM', 'MCT_KETOSIS'],
    description: 'МСТ масло — среднецепочечные триглицериды, быстро конвертируются в кетоны. На курсе обеспечивает быструю энергию.',
    synergies: [],
    conflicts: [
      { with: "antidiabetic_drugs", effect: "", mechanism: "", severity: "LOW" },
      { with: "electrolyte_complex", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Кетоны в крови', when: 'По показаниям' }
    ],
    contraindications: ['Декомпенсированный диабет'],
    sideEffects: ['Диарея при высоких дозах (старт с малых)', 'Тошнота при превышении'],
    dosage: { mg: 15000, timing: 'с едой (старт с 5 мл)', form: 'МСТ масло (С8>С10)' },
    bestForCourse: false,
  },
  ceramides: {
    id: 'ceramides',
    name: 'Ceramides',
    nameRu: 'Церамиды',
    tier: 'advanced',
    category: ['fatty_acid', 'skin'],
    forms: [
      { id: 'ceramides', name: 'Ceramides', nameRu: 'Церамиды 30 мг', dose: '1 мг', best: true },
      { id: 'ceramides_2', name: 'Ceramides', nameRu: 'Церамиды + коллаген комплекс', dose: '1 мг', best: false }
    ],
    organs: ['SKIN', 'JOINTS', 'MUSCLES'],
    systems: ['musculoskeletal'],
    mechanisms: ['SKIN_BARRIER', 'JOINT_LUBRICATION', 'CELL_SIGNALING', 'APOPTOSIS_REGULATION'],
    description: 'Церамиды — сфинголипиды, ключевые компоненты кожного барьера и суставной жидкости.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Кожа/суставы', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 1, timing: 'с едой', form: 'церамиды (экстракт или синтетические)' },
    bestForCourse: false,
  },
  butyrate: {
    id: 'butyrate',
    name: 'Butyrate',
    nameRu: 'Бутират (Масляная кислота)',
    tier: 'advanced',
    category: ['fatty_acid', 'gut'],
    forms: [
      { id: 'butyrate', name: 'Butyrate', nameRu: 'Бутират натрия 1500 мг', dose: '1.5 г 2x/д', best: true },
      { id: 'butyrate_2', name: 'Butyrate', nameRu: 'Бутират кальция 1500 мг', dose: '1.5 г', best: false }
    ],
    organs: ['INTESTINES', 'LIVER'],
    systems: ['hepatic', 'metabolic'],
    mechanisms: ['GUT_BARRIER_INTEGRITY', 'ANTI_INFLAMMATORY', 'HDAC_INHIBITION', 'COLONOCYTE_FUEL'],
    description: 'Бутират — короткоцепочечная жирная кислота, главный энергетический субстрат колоноцитов. Укрепляет кишечный барьер.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Калпротектин', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: тошнота', 'Диарея при высоких дозах'],
    dosage: { mg: 1500, timing: 'с едой 2x/д', form: 'бутират натрия или кальция' },
    bestForCourse: false,
  },
  glycine: {
    id: 'glycine',
    name: 'Glycine',
    nameRu: 'Глицин',
    tier: 'advanced',
    category: ['amino', 'neuroprotector'],
    forms: [
      { id: 'glycine', name: 'Glycine', nameRu: 'Глицин 1000 мг', dose: '3 г 2x/д', best: true },
      { id: 'glycine_2', name: 'Glycine', nameRu: 'Глицин порошок 3 г', dose: '3 г', best: false }
    ],
    organs: ['BRAIN', 'LIVER', 'JOINTS'],
    systems: ['neuro', 'hepatic', 'musculoskeletal'],
    mechanisms: ['INHIBITORY_NEUROTRANSMITTER', 'COLLAGEN_SYNTHESIS', 'GLUTATHIONE_PRECURSOR', 'SLEEP_IMPROVEMENT'],
    description: 'Глицин — тормозной нейромедиатор, предшественник коллагена и глутатиона. Улучшает сон.',
    synergies: [
      { with: "magnesium", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "silicon", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "calcium", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "glycine", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "zinc", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Качество сна', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: тошнота при высоких дозах'],
    dosage: { mg: 3000, timing: 'на ночь или 2x/д', form: 'глицин порошок или капсулы' },
    bestForCourse: false,
  },
  theanine: {
    id: 'theanine',
    name: 'L-Theanine',
    nameRu: 'Л-Теанин',
    tier: 'advanced',
    category: ['amino', 'neuroprotector'],
    forms: [
      { id: 'theanine', name: 'L-Theanine', nameRu: 'Л-Теанин 200 мг', dose: '200 мг 2x/д', best: true },
      { id: 'theanine_2', name: 'L-Theanine', nameRu: 'Теанин + Кофеин комплекс', dose: '200 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['ALPHA_WAVE_INDUCTION', 'GABA_MODULATION', 'CORTISOL_REDUCTION', 'FOCUS_ENHANCEMENT'],
    description: 'Л-Теанин — аминокислота из зелёного чая, индуцирует альфа-волны, снижает кортизол. Улучшает фокус без сонливости.',
    synergies: [
      { with: "caffeine", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "gaba", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Качество сна', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: сонливость при высоких дозах'],
    dosage: { mg: 200, timing: 'на ночь или утром', form: 'Л-теанин капсулы' },
    bestForCourse: false,
  },
  tyrosine: {
    id: 'tyrosine',
    name: 'L-Tyrosine',
    nameRu: 'Л-Тирозин',
    tier: 'advanced',
    category: ['amino', 'nootropic'],
    forms: [
      { id: 'tyrosine', name: 'L-Tyrosine', nameRu: 'Л-Тирозин 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'tyrosine_2', name: 'L-Tyrosine', nameRu: 'N-Ацетил-Л-Тирозин 300 мг', dose: '500 мг', best: false }
    ],
    organs: ['BRAIN', 'ADRENALS'],
    systems: ['neuro', 'endocrine'],
    mechanisms: ['DOPAMINE_PRECURSOR', 'NOREPINEPHRINE_SYNTHESIS', 'THYROID_HORMONE_PRECURSOR', 'STRESS_RESILIENCE'],
    description: 'Л-Тирозин — предшественник дофамина, норадреналина и тиреоидных гормонов. Улучшает стрессоустойчивость и фокус.',
    synergies: [
      { with: "stimulant_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "rhodiola", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "antidepressant_drugs", effect: "", mechanism: "", severity: "HIGH" },
      { with: "l_dopa", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Тирозин в плазме', when: 'Каждые 12 нед' }
    ],
    contraindications: [],
    sideEffects: ['Тошнота натощак при высоких дозах'],
    dosage: { mg: 500, timing: 'натощак утром', form: 'Л-тирозин капсулы' },
    bestForCourse: false,
  },
  tryptophan: {
    id: 'tryptophan',
    name: 'L-Tryptophan',
    nameRu: 'Л-Триптофан',
    tier: 'advanced',
    category: ['amino', 'neuroprotector'],
    forms: [
      { id: 'tryptophan', name: 'L-Tryptophan', nameRu: 'Л-Триптофан 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'tryptophan_2', name: 'L-Tryptophan', nameRu: '5-HTP 100 мг', dose: '500 мг', best: false }
    ],
    organs: ['BRAIN', 'INTESTINES'],
    systems: ['neuro', 'metabolic'],
    mechanisms: ['SEROTONIN_PRECURSOR', 'MELATONIN_SYNTHESIS', 'SLEEP_IMPROVEMENT', 'MOOD_REGULATION'],
    description: 'Л-Триптофан — предшественник серотонина и мелатонина. Улучшает сон и настроение.',
    synergies: [],
    conflicts: [
      { with: "x5htp", effect: "", mechanism: "", severity: "LOW" },
      { with: "antidepressant_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Качество сна', when: 'Субъективно' }
    ],
    contraindications: ['Приём антидепрессантов СИОЗС (серотониновый синдром)'],
    sideEffects: ['Сонливость', 'Тошнота натощак'],
    dosage: { mg: 500, timing: 'на ночь или натощак', form: 'Л-триптофан капсулы' },
    bestForCourse: false,
  },
  x5htp: {
    id: 'x5htp',
    name: '5-HTP',
    nameRu: '5-HTP (5-Гидрокситриптофан)',
    tier: 'advanced',
    category: ['amino', 'neuroprotector'],
    forms: [
      { id: 'x5htp', name: '5-HTP', nameRu: '5-HTP 100 мг', dose: '100 мг 2x/д', best: true },
      { id: '5htp_2', name: '5-HTP', nameRu: '5-HTP 50 мг', dose: '100 мг', best: false }
    ],
    organs: ['BRAIN', 'INTESTINES'],
    systems: ['neuro', 'metabolic'],
    mechanisms: ['SEROTONIN_PRECURSOR', 'MELATONIN_SYNTHESIS', 'MOOD_REGULATION', 'APPETITE_CONTROL'],
    description: '5-HTP — прямой предшественник серотонина, эффективнее триптофана. Улучшает настроение и сон.',
    synergies: [
      { with: "magnesium", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "antidepressant_drugs", effect: "", mechanism: "", severity: "HIGH" },
      { with: "tryptophan", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Качество сна', when: 'Субъективно' }
    ],
    contraindications: ['Приём антидепрессантов СИОЗС (серотониновый синдром)'],
    sideEffects: ['Тошнота при начале', 'Сонливость'],
    dosage: { mg: 100, timing: 'на ночь или 2x/д', form: '5-HTP капсулы' },
    bestForCourse: false,
  },
  gaba: {
    id: 'gaba',
    name: 'GABA',
    nameRu: 'ГАМК (Гамма-аминомасляная кислота)',
    tier: 'advanced',
    category: ['amino', 'neuroprotector'],
    forms: [
      { id: 'gaba', name: 'GABA', nameRu: 'ГАМК 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'gaba_2', name: 'GABA', nameRu: 'ГАМК порошок 3 г', dose: '500 мг', best: false },
      { id: 'gaba_3', name: 'GABA', nameRu: 'Фенибут (производное)', dose: '500 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['INHIBITORY_NEUROTRANSMITTER', 'ANXIOLYTIC', 'SLEEP_IMPROVEMENT', 'MUSCLE_RELAXATION'],
    description: 'ГАМК — главный тормозной нейромедиатор. Снижает тревожность и улучшает сон. Плохо проникает ГГБ.',
    synergies: [
      { with: "magnesium", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "anxiolytic_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "ashwagandha", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "theanine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "melatonin", effect: "", mechanism: "", severity: "HIGH" },
      { with: "nsaid_drugs", effect: "", mechanism: "", severity: "HIGH" },
      { with: "anxiolytic_drugs", effect: "", mechanism: "", severity: "HIGH" },
      { with: "antidepressant_drugs", effect: "", mechanism: "", severity: "LOW" },
      { with: "gaba", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Тревожность/сон', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: покалывание кожи', 'Сонливость'],
    dosage: { mg: 500, timing: 'на ночь', form: 'ГАМК капсулы или порошок' },
    bestForCourse: false,
  },
  creatine: {
    id: 'creatine',
    name: 'Creatine',
    nameRu: 'Креатин',
    tier: 'standard',
    category: ['amino', 'metabolic'],
    forms: [
      { id: 'creatine', name: 'Creatine', nameRu: 'Креатин моногидрат 5 г', dose: '5 г 2x/д', best: true },
      { id: 'creatine_2', name: 'Creatine', nameRu: 'Креатин HCl 3 г', dose: '5 г', best: false }
    ],
    organs: ['MUSCLES', 'BRAIN', 'HEART'],
    systems: ['musculoskeletal', 'neuro', 'metabolic'],
    mechanisms: ['ATP_REGENERATION', 'PHOSPHOCREATINE_BUFFER', 'MUSCLE_HYPERTROPHY', 'BRAIN_ENERGY'],
    description: 'Креатин — фосфагенная система быстрого ресинтеза АТФ. Улучшает силу, мощность и когнитивную функцию.',
    synergies: [
      { with: "beta_alanine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Креатин в крови', when: 'Каждые 12 нед', targetRange: '0.5-1.0 мг/дл' }
    ],
    contraindications: ['Не выявлено'],
    sideEffects: ['Задержка воды (1-2 кг)', 'Редко: дискомфорт в ЖКТ'],
    dosage: { mg: 5000, timing: 'с едой или после тренировки', form: 'креатин моногидрат' },
    bestForCourse: true,
  },
  beta_alanine: {
    id: 'beta_alanine',
    name: 'Beta-Alanine',
    nameRu: 'Бета-Аланин',
    tier: 'advanced',
    category: ['amino', 'metabolic'],
    forms: [
      { id: 'beta_alanine', name: 'Beta-Alanine', nameRu: 'Бета-аланин 1600 мг 2x/д', dose: '3.2 г 2x/д', best: true },
      { id: 'beta_alanine_2', name: 'Beta-Alanine', nameRu: 'Бета-аланин порошок 3.2 г', dose: '3.2 г', best: false }
    ],
    organs: ['MUSCLES'],
    systems: ['musculoskeletal', 'metabolic'],
    mechanisms: ['CARNOSINE_SYNTHESIS', 'PH_BUFFER', 'MUSCLE_ENDURANCE', 'ANTIOXIDANT'],
    description: 'Бета-аланин — предшественник карнозина, внутриклеточного буфера. Улучшает выносливость при высокоинтенсивной нагрузке.',
    synergies: [
      { with: "creatine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Карнозин в мышцах', when: 'Каждые 12 нед' }
    ],
    contraindications: [],
    sideEffects: ['Парестезия (покалывание кожи)', 'Редко: тошнота'],
    dosage: { mg: 3200, timing: '2x/д с едой', form: 'бета-аланин порошок или капсулы' },
    bestForCourse: false,
  },
  citrulline: {
    id: 'citrulline',
    name: 'L-Citrulline',
    nameRu: 'Л-Цитруллин',
    tier: 'advanced',
    category: ['amino', 'cardioprotector'],
    forms: [
      { id: 'citrulline', name: 'L-Citrulline', nameRu: 'Л-Цитруллин 6 г', dose: '6 г 2x/д', best: true },
      { id: 'citrulline_2', name: 'L-Citrulline', nameRu: 'Цитруллин малат 6 г', dose: '6 г', best: false }
    ],
    organs: ['VESSELS', 'MUSCLES', 'KIDNEYS'],
    systems: ['cardio', 'renal', 'metabolic'],
    mechanisms: ['NITRIC_OXIDE_PRODUCTION', 'AMMONIA_DETOXIFICATION', 'BLOOD_FLOW_ENHANCEMENT', 'MUSCLE_PUMP'],
    description: 'Л-Цитруллин — предшественник оксида азота, эффективнее аргинина. Улучшает кровоток и мышечный памп.',
    synergies: [
      { with: "arginine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Артериальное давление', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: тошнота при высоких дозах'],
    dosage: { mg: 6000, timing: 'натощак, 30 мин до тренировки', form: 'Л-цитруллин или цитруллин малат' },
    bestForCourse: false,
  },
  arginine: {
    id: 'arginine',
    name: 'L-Arginine',
    nameRu: 'Л-Аргинин',
    tier: 'advanced',
    category: ['amino', 'cardioprotector'],
    forms: [
      { id: 'arginine', name: 'L-Arginine', nameRu: 'Л-Аргинин 3 г', dose: '3 г 2x/д', best: true },
      { id: 'arginine_2', name: 'L-Arginine', nameRu: 'Аргинин альфа-кетоглутарат 3 г', dose: '3 г', best: false }
    ],
    organs: ['VESSELS', 'MUSCLES'],
    systems: ['cardio', 'reproductive', 'metabolic'],
    mechanisms: ['NITRIC_OXIDE_PRODUCTION', 'GROWTH_HORMONE_RELEASE', 'AMMONIA_DETOXIFICATION', 'WOUND_HEALING'],
    description: 'Л-Аргинин — предшественник оксида азота и гормона роста. Улучшает кровоток. Цитруллин предпочтительнее.',
    synergies: [
      { with: "citrulline", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Артериальное давление', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: тошнота', 'Диарея при высоких дозах'],
    dosage: { mg: 3000, timing: 'натощак или на ночь', form: 'Л-аргинин капсулы или порошок' },
    bestForCourse: false,
  },
  agmatine: {
    id: 'agmatine',
    name: 'Agmatine',
    nameRu: 'Агматин',
    tier: 'advanced',
    category: ['amino', 'neuroprotector'],
    forms: [
      { id: 'agmatine', name: 'Agmatine', nameRu: 'Агматин сульфат 1000 мг', dose: '1 г 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES', 'MUSCLES'],
    systems: ['neuro', 'metabolic'],
    mechanisms: ['NITRIC_OXIDE_MODULATION', 'NMDA_REGULATION', 'NORADRENALINE_RELEASE', 'INSULIN_SENSITIVITY'],
    description: 'Агматин — метаболит аргинина, нейромодулятор. Регулирует оксид азота и NMDA-рецепторы. Улучшает памп и настроение.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Настроение/памп', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: тошнота при высоких дозах'],
    dosage: { mg: 1000, timing: 'натощак или 2x/д', form: 'агматин сульфат' },
    bestForCourse: false,
  },
  bcaa: {
    id: 'bcaa',
    name: 'BCAA',
    nameRu: 'BCAA (Аминокислоты с разветвлённой цепью)',
    tier: 'standard',
    category: ['amino', 'metabolic'],
    forms: [
      { id: 'bcaa', name: 'BCAA', nameRu: 'BCAA 2:1:1 порошок 10 г', dose: '10 г 2x/д', best: true },
      { id: 'bcaa_2', name: 'BCAA', nameRu: 'BCAA капсулы 5 г', dose: '10 г', best: false }
    ],
    organs: ['MUSCLES', 'LIVER'],
    systems: ['musculoskeletal', 'hepatic', 'metabolic'],
    mechanisms: ['MUSCLE_PROTEIN_SYNTHESIS', 'MUSCLE_BREAKDOWN_PREVENTION', 'ENERGY_PRODUCTION', 'MTOR_ACTIVATION'],
    description: 'BCAA (лейцин, изолейцин, валин) — стимулируют синтез белка через mTOR. Предотвращают катаболизм на курсе ААС.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Мышечная масса', when: 'Каждые 4 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: тошнота при натощак'],
    dosage: { mg: 10000, timing: 'до или после тренировки', form: 'BCAA порошок (лейцин:изолейцин:валин 2:1:1)' },
    bestForCourse: false,
  },
  hmb: {
    id: 'hmb',
    name: 'HMB',
    nameRu: 'HMB (Бета-гидрокси-бета-метилмасляная кислота)',
    tier: 'advanced',
    category: ['amino', 'metabolic'],
    forms: [
      { id: 'hmb', name: 'HMB', nameRu: 'HMB-Ca 1500 мг 2x/д', dose: '3 г 2x/д', best: true },
      { id: 'hmb_2', name: 'HMB', nameRu: 'HMB Free Acid 3000 мг', dose: '3 г', best: false }
    ],
    organs: ['MUSCLES'],
    systems: ['musculoskeletal', 'metabolic'],
    mechanisms: ['MUSCLE_BREAKDOWN_PREVENTION', 'MTOR_ACTIVATION', 'CORTISOL_ANTAGONISM', 'RECOVERY_ENHANCEMENT'],
    description: 'HMB — метаболит лейцина, мощный антикатаболик. Предотвращает распад мышц при калорийном дефиците и стрессе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Мышечная масса', when: 'Каждые 4 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: тошнота при натощак'],
    dosage: { mg: 3000, timing: '2x/д с едой', form: 'HMB кальций порошок или капсулы' },
    bestForCourse: false,
  },
  glutathione: {
    id: 'glutathione',
    name: 'Glutathione',
    nameRu: 'Глутатион',
    tier: 'advanced',
    category: ['antioxidant', 'hepatoprotector'],
    forms: [
      { id: 'glutathione', name: 'Glutathione', nameRu: 'Липосомальный глутатион 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'glutathione_2', name: 'Glutathione', nameRu: 'Глутатион редуцированный 500 мг', dose: '500 мг', best: false }
    ],
    organs: ['LIVER', 'BRAIN', 'IMMUNE_SYSTEM'],
    systems: ['hepatic', 'neuro', 'immune'],
    mechanisms: ['ANTIOXIDANT_MASTER', 'DETOXIFICATION_PHASE2', 'IMMUNE_REGULATION', 'MITOCHONDRIAL_PROTECTION'],
    description: 'Глутатион — главный внутриклеточный антиоксидант и детоксикант. На курсе ААС критичен для защиты печени. Липосомальная форма предпочтительнее.',
    synergies: [
      { with: "alpha_lipoic", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Глутатион в крови', when: 'Каждые 8 нед', targetRange: '>600 мкмоль/л' }
    ],
    contraindications: [],
    sideEffects: ['Редко: аллергия при в/в введении'],
    dosage: { mg: 500, timing: 'натощак', form: 'липосомальный глутатион или NAC+витамин С' },
    bestForCourse: false,
  },
  eaa: {
    id: 'eaa',
    name: 'EAA',
    nameRu: 'EAA (Незаменимые аминокислоты)',
    tier: 'standard',
    category: ['amino', 'metabolic'],
    forms: [
      { id: 'eaa', name: 'EAA', nameRu: 'EAA порошок 10 г', dose: '10 г 2x/д', best: true },
      { id: 'eaa_2', name: 'EAA', nameRu: 'EAA капсулы 5 г', dose: '10 г', best: false }
    ],
    organs: ['MUSCLES', 'LIVER'],
    systems: ['musculoskeletal', 'metabolic'],
    mechanisms: ['MUSCLE_PROTEIN_SYNTHESIS', 'MTOR_ACTIVATION', 'ESSENTIAL_AMINO_ACID_SUPPLY', 'RECOVERY_ENHANCEMENT'],
    description: 'EAA — полный набор незаменимых аминокислот для синтеза белка. Альтернатива протеину с быстрой абсорбцией.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Мышечная масса', when: 'Каждые 4 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: тошнота натощак'],
    dosage: { mg: 10000, timing: 'до или после тренировки', form: 'EAA порошок' },
    bestForCourse: false,
  },
  d_aspartic_acid: {
    id: 'd_aspartic_acid',
    name: 'D-Aspartic Acid',
    nameRu: 'D-Аспарагиновая кислота',
    tier: 'specialty',
    category: ['amino', 'hormonal'],
    forms: [
      { id: 'd_aspartic_acid', name: 'D-Aspartic Acid', nameRu: 'D-Аспарагиновая кислота 3 г', dose: '3 г 2x/д', best: true }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['TESTOSTERONE_SYNTHESIS', 'LH_RELEASE', 'SPERMATOGENESIS', 'NMDA_RECEPTOR_ACTIVATION'],
    description: 'D-Аспарагиновая кислота — стимулирует высвобождение ЛГ и синтез тестостерона. Эффект кратковременный (12-15 дней).',
    synergies: [
      { with: "zinc", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "maca", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Свободный тестостерон', when: 'Каждые 2 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: головная боль', 'Тошнота'],
    dosage: { mg: 3000, timing: 'утро натощак, курс 12-15 дней', form: 'D-аспарагиновая кислота порошок' },
    bestForCourse: false,
  },
  phenibut: {
    id: 'phenibut',
    name: 'Phenibut',
    nameRu: 'Фенибут',
    tier: 'specialty',
    category: ['amino', 'anxiolytic'],
    forms: [
      { id: 'phenibut', name: 'Phenibut', nameRu: 'Фенибут 250 мг', dose: '250 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['GABA_B_AGONIST', 'ANXIOLYTIC', 'COGNITIVE_ENHANCEMENT', 'SLEEP_IMPROVEMENT'],
    description: 'Фенибут — производное ГАМК с фенильным кольцом, проникает через ГГБ. Снижает тревожность, улучшает сон. Риск зависимости.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Тревожность/сон', when: 'Субъективно' }
    ],
    contraindications: ['Эпилепсия (с осторожностью)', 'Беременность'],
    sideEffects: ['Сонливость при начале', 'Зависимость при длительном приёме'],
    dosage: { mg: 250, timing: 'на ночь или 2x/д, курс 2-4 нед', form: 'фенибут 250 мг' },
    bestForCourse: false,
  },
  carnosine: {
    id: 'carnosine',
    name: 'Carnosine',
    nameRu: 'Карнозин',
    tier: 'advanced',
    category: ['amino', 'antioxidant'],
    forms: [
      { id: 'carnosine', name: 'Carnosine', nameRu: 'Карнозин 500 мг 2x/д', dose: '1 г 2x/д', best: true }
    ],
    organs: ['MUSCLES', 'BRAIN', 'HEART'],
    systems: ['musculoskeletal', 'neuro', 'metabolic'],
    mechanisms: ['PH_BUFFER', 'ANTIOXIDANT', 'ANTI_GLYCATION', 'MUSCLE_ENDURANCE'],
    description: 'Карнозин — дипептид (бета-аланин + гистидин), внутриклеточный буфер и антиоксидант. Предотвращает гликирование.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Мышечная выносливость', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: покалывание кожи (от бета-аланина)'],
    dosage: { mg: 1000, timing: '2x/д с едой', form: 'карнозин капсулы' },
    bestForCourse: false,
  },
  alanine: {
    id: 'alanine',
    name: 'Alanine',
    nameRu: 'Аланин',
    tier: 'standard',
    category: ['amino', 'metabolic'],
    forms: [
      { id: 'alanine', name: 'Alanine', nameRu: 'Аланин 2 г', dose: '2 г 2x/д', best: true }
    ],
    organs: ['LIVER', 'MUSCLES'],
    systems: ['hepatic', 'metabolic'],
    mechanisms: ['GLUCONEOGENESIS', 'AMINO_ACID_METABOLISM', 'LIVER_PROTECTION', 'GLUCOSE_REGULATION'],
    description: 'Аланин — заменимая аминокислота, ключевой субстрат глюконеогенеза в печени. Поддерживает уровень глюкозы.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: тошнота при высоких дозах'],
    dosage: { mg: 2000, timing: 'с едой', form: 'аланин порошок' },
    bestForCourse: false,
  },
  l_dopa: {
    id: 'l_dopa',
    name: 'L-DOPA',
    nameRu: 'Леводопа (L-DOPA)',
    tier: 'specialty',
    category: ['amino', 'nootropic'],
    forms: [
      { id: 'l_dopa', name: 'L-DOPA', nameRu: 'Л-ДОФА (Мукуна) 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['DOPAMINE_PRECURSOR', 'NOREPINEPHRINE_PRECURSOR', 'MOTOR_FUNCTION', 'MOOD_REGULATION'],
    description: 'Л-ДОФА — прямой предшественник дофамина. Используется для кратковременного повышения дофамина. Ряд побочных эффектов.',
    synergies: [],
    conflicts: [
      { with: "tyrosine", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Настроение/фокус', when: 'Субъективно' }
    ],
    contraindications: ['Приём антидепрессантов СИОЗС', 'Болезнь Паркинсона (без назначения)'],
    sideEffects: ['Тошнота', 'Ортостатическая гипотензия', 'Риск дискинезии при длительном приёме'],
    dosage: { mg: 500, timing: 'натощак, курс 5-7 дней', form: 'Л-ДОФА (экстракт мукуны) капсулы' },
    bestForCourse: false,
  },
  phosphatidylserine: {
    id: 'phosphatidylserine',
    name: 'Phosphatidylserine',
    nameRu: 'Фосфатидилсерин',
    tier: 'advanced',
    category: ['lipid', 'neuroprotector'],
    forms: [
      { id: 'phosphatidylserine', name: 'Phosphatidylserine', nameRu: 'Фосфатидилсерин 100 мг 3x/д', dose: '300 мг 2x/д', best: true },
      { id: 'phosphatidylserine_2', name: 'Phosphatidylserine', nameRu: 'Фосфатидилсерин 300 мг на ночь', dose: '300 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES', 'ADRENALS'],
    systems: ['neuro', 'endocrine'],
    mechanisms: ['CORTISOL_REDUCTION', 'MEMORY_ENHANCEMENT', 'CELL_SIGNALING', 'NEUROPROTECTION'],
    description: 'Фосфатидилсерин — фосфолипид мембран нейронов, снижает кортизол на 30% после нагрузки. Улучшает память и когницию.',
    synergies: [
      { with: "bacopa", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Кортизол утром', when: 'Каждые 4 нед', targetRange: '6-23 мкг/дл' }
    ],
    contraindications: [],
    sideEffects: ['Редко: бессонница при приёме вечером'],
    dosage: { mg: 300, timing: 'с едой 2x/д', form: 'фосфатидилсерин из соевого лецитина' },
    bestForCourse: false,
  },
  methionine: {
    id: 'methionine',
    name: 'Methionine',
    nameRu: 'Метионин',
    tier: 'standard',
    category: ['amino', 'hepatoprotector'],
    forms: [
      { id: 'methionine', name: 'Methionine', nameRu: 'Метионин 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'methionine_2', name: 'Methionine', nameRu: 'N-Ацетил-Л-метионин 500 мг', dose: '500 мг', best: false }
    ],
    organs: ['LIVER'],
    systems: ['hepatic', 'metabolic'],
    mechanisms: ['METHYL_DONATION', 'LIPOTROPIC_EFFECT', 'GLUTATHIONE_PRECURSOR', 'HOMOCYSTEINE_SOURCE'],
    description: 'Метионин — незаменимая аминокислота, донор метильных групп и липотропик. Предшественник SAMe и глутатиона.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Гомоцистеин', when: 'Каждые 8 нед', targetRange: '<15 мкмоль/л' }
    ],
    contraindications: ['Гипергомоцистеинемия (без фолата/B12/B6)'],
    sideEffects: ['Тошнота при высоких дозах', 'Повышение гомоцистеина при избытке'],
    dosage: { mg: 500, timing: 'с едой', form: 'метионин капсулы' },
    bestForCourse: false,
  },
  s_adenosyl_methionine: {
    id: 's_adenosyl_methionine',
    name: 'SAMe',
    nameRu: 'SAMe (S-Аденозилметионин)',
    tier: 'advanced',
    category: ['amino', 'hepatoprotector', 'antidepressant'],
    forms: [
      { id: 's_adenosyl_methionine', name: 'SAMe', nameRu: 'SAMe 200 мг 2x/д', dose: '400 мг 2x/д', best: true },
      { id: 's_adenosyl_methionine_2', name: 'SAMe', nameRu: 'SAMe 400 мг 2x/д', dose: '400 мг', best: false }
    ],
    organs: ['LIVER', 'BRAIN'],
    systems: ['hepatic', 'neuro'],
    mechanisms: ['METHYL_DONATION', 'ANTIDEPRESSANT', 'JOINT_PROTECTION', 'LIVER_DETOXIFICATION'],
    description: 'SAMe — главный донор метильных групп в организме. Антидепрессант, гепатопротектор, хондропротектор.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Настроение', when: 'Субъективно' },
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед', targetRange: '<40 Ед/л' }
    ],
    contraindications: ['Биполярное расстройство (может вызвать манию)'],
    sideEffects: ['Тошнота натощак', 'Редко: мания при биполярном расстройстве'],
    dosage: { mg: 400, timing: 'натощак 2x/д', form: 'SAMe энтеросолюбильный' },
    bestForCourse: false,
  },
  ginseng: {
    id: 'ginseng',
    name: 'Ginseng',
    nameRu: 'Женьшень (Panax Ginseng)',
    tier: 'advanced',
    category: ['adaptogen', 'hormonal'],
    forms: [
      { id: 'ginseng', name: 'Ginseng', nameRu: 'Экстракт женьшеня 200 мг', dose: '200 мг 2x/д', best: true },
      { id: 'ginseng_2', name: 'Ginseng', nameRu: 'Женьшень Премиум 400 мг', dose: '200 мг', best: false }
    ],
    organs: ['BRAIN', 'ADRENALS', 'REPRODUCTIVE'],
    systems: ['neuro', 'endocrine', 'reproductive'],
    mechanisms: ['ADAPTOGENIC', 'CORTISOL_REGULATION', 'NO_PRODUCTION', 'ENERGY_ENHANCEMENT'],
    description: 'Женьшень — король адаптогенов, повышает энергетику, снижает кортизол, улучшает когницию и либидо. На курсе ААС помогает с восстановлением.',
    synergies: [
      { with: "ginkgo", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "stimulant_complex", effect: "", mechanism: "", severity: "LOW" },
      { with: "anticoagulant_drugs", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Кортизол утром', when: 'Каждые 4 нед', targetRange: '6-23 мкг/дл' }
    ],
    contraindications: ['Беременность', 'Гипертония (с осторожностью)'],
    sideEffects: ['Бессонница при приёме вечером', 'Головная боль при высоких дозах'],
    dosage: { mg: 200, timing: 'утро с едой', form: 'экстракт женьшеня (5% гинзенозидов)' },
    bestForCourse: false,
  },
  rhodiola: {
    id: 'rhodiola',
    name: 'Rhodiola',
    nameRu: 'Родиола розовая',
    tier: 'advanced',
    category: ['adaptogen', 'neuroprotector'],
    forms: [
      { id: 'rhodiola', name: 'Rhodiola', nameRu: 'Родиола 300 мг', dose: '300 мг 2x/д', best: true },
      { id: 'rhodiola_2', name: 'Rhodiola', nameRu: 'Родиола + Женьшень комплекс', dose: '300 мг', best: false }
    ],
    organs: ['BRAIN', 'ADRENALS', 'HEART'],
    systems: ['neuro', 'endocrine', 'cardio'],
    mechanisms: ['ADAPTOGENIC', 'CORTISOL_REDUCTION', 'FOCUS_ENHANCEMENT', 'PHYSICAL_ENDURANCE'],
    description: 'Родиола розовая — адаптоген, снижает кортизол и утомление, повышает фокус и выносливость. На курсе ААС помогает с восстановлением.',
    synergies: [
      { with: "ashwagandha", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "tyrosine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "stimulant_complex", effect: "", mechanism: "", severity: "LOW" },
      { with: "antidepressant_drugs", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Утомление/фокус', when: 'Субъективно' }
    ],
    contraindications: ['Биполярное расстройство (с осторожностью)'],
    sideEffects: ['Бессонница при приёме вечером', 'Раздражительность при высоких дозах'],
    dosage: { mg: 300, timing: 'утро натощак', form: 'экстракт родиолы (3% розавин)' },
    bestForCourse: false,
  },
  bacopa: {
    id: 'bacopa',
    name: 'Bacopa',
    nameRu: 'Бакопа моньери',
    tier: 'advanced',
    category: ['adaptogen', 'nootropic'],
    forms: [
      { id: 'bacopa', name: 'Bacopa', nameRu: 'Бакопа 300 мг', dose: '300 мг 2x/д', best: true },
      { id: 'bacopa_2', name: 'Bacopa', nameRu: 'Бакопа 150 мг 2x/д', dose: '300 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['MEMORY_ENHANCEMENT', 'ANTI_INFLAMMATORY', 'ANTIOXIDANT', 'ANXIOLYTIC'],
    description: 'Бакопа — ноотропный адаптоген, улучшает память и когницию через серотонинергические и холинергические механизмы.',
    synergies: [
      { with: "ginkgo", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "phosphatidylserine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Память/фокус', when: 'Субъективно (4-12 нед)' }
    ],
    contraindications: [],
    sideEffects: ['Тошнота при натощак', 'Разжижение стула'],
    dosage: { mg: 300, timing: 'с едой 2x/д', form: 'экстракт бакопы (50% бакозидов)' },
    bestForCourse: false,
  },
  lions_mane: {
    id: 'lions_mane',
    name: 'Lions Mane',
    nameRu: 'Ежовик гребенчатый',
    tier: 'advanced',
    category: ['adaptogen', 'nootropic'],
    forms: [
      { id: 'lions_mane', name: 'Lions Mane', nameRu: 'Ежовик экстракт 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'lions_mane_2', name: 'Lions Mane', nameRu: 'Ежовик + Бакопа комплекс', dose: '500 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['NGF_STIMULATION', 'MYELIN_REPAIR', 'MEMORY_ENHANCEMENT', 'NEUROPROTECTION'],
    description: 'Ежовик гребенчатый — стимулирует фактор роста нервов (NGF), восстанавливает миелин. На курсе ААС нейропротектор.',
    synergies: [
      { with: "l_carnitine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Когниция/память', when: 'Субъективно (4-12 нед)' }
    ],
    contraindications: [],
    sideEffects: ['Редко: аллергия при грибковой непереносимости'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт ежовика (50% эринацинов)' },
    bestForCourse: false,
  },
  cordyceps: {
    id: 'cordyceps',
    name: 'Cordyceps',
    nameRu: 'Кордицепс',
    tier: 'advanced',
    category: ['adaptogen', 'metabolic'],
    forms: [
      { id: 'cordyceps', name: 'Cordyceps', nameRu: 'Кордицепс 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'cordyceps_2', name: 'Cordyceps', nameRu: 'Кордицепс CS-4 1000 мг', dose: '500 мг', best: false }
    ],
    organs: ['LUNGS', 'MUSCLES', 'KIDNEYS'],
    systems: ['cardio', 'renal', 'metabolic'],
    mechanisms: ['ATP_PRODUCTION', 'OXYGEN_UTILIZATION', 'ADAPTOGENIC', 'TESTOSTERONE_SUPPORT'],
    description: 'Кордицепс — адаптоген, повышает VO2max и продукцию АТФ. Улучшает кислородное снабжение. На курсе поддерживает выносливость.',
    synergies: [
      { with: "cordyceps", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "ss31", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'VO2max', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 500, timing: 'утро с едой', form: 'экстракт кордицепса (7% кордицепина)' },
    bestForCourse: false,
  },
  maca: {
    id: 'maca',
    name: 'Maca',
    nameRu: 'Мака (Лепидиум мейени)',
    tier: 'advanced',
    category: ['adaptogen', 'hormonal'],
    forms: [
      { id: 'maca', name: 'Maca', nameRu: 'Мака порошок 1.5 г', dose: '1.5 г 2x/д', best: true },
      { id: 'maca_2', name: 'Maca', nameRu: 'Мака экстракт 500 мг', dose: '1.5 г', best: false }
    ],
    organs: ['REPRODUCTIVE', 'ADRENALS'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['LIBIDO_ENHANCEMENT', 'ENERGY_BOOST', 'HORMONE_BALANCE', 'FERTILITY_SUPPORT'],
    description: 'Мака — перуанский адаптоген, повышает либидо и энергетику. Не влияет на гормоны напрямую, но балансирует ГГЯ ось.',
    synergies: [
      { with: "d_aspartic_acid", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Либидо/энергия', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Метеоризм при начале', 'Редко: бессонница при приёме вечером'],
    dosage: { mg: 1500, timing: 'с едой', form: 'порошок или экстракт маки (желатинизированный)' },
    bestForCourse: false,
  },
  holy_basil: {
    id: 'holy_basil',
    name: 'Holy Basil',
    nameRu: 'Туласи (Святой базилик)',
    tier: 'advanced',
    category: ['adaptogen', 'antiinflammatory'],
    forms: [
      { id: 'holy_basil', name: 'Holy Basil', nameRu: 'Туласи 400 мг', dose: '400 мг 2x/д', best: true },
      { id: 'holy_basil_2', name: 'Holy Basil', nameRu: 'Святой базилик экстракт 300 мг', dose: '400 мг', best: false }
    ],
    organs: ['BRAIN', 'ADRENALS', 'LIVER'],
    systems: ['neuro', 'endocrine', 'hepatic'],
    mechanisms: ['CORTISOL_REDUCTION', 'ADAPTOGENIC', 'ANTI_INFLAMMATORY', 'ANTIOXIDANT'],
    description: 'Туласи — священный базилик Аюрведы, мощный адаптоген. Снижает кортизол, сахар и воспаление. На курсе ААС помогает с восстановлением.',
    synergies: [
      { with: "soy_isoflavones", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "antidepressant_drugs", effect: "", mechanism: "", severity: "HIGH" },
      { with: "progesterone", effect: "", mechanism: "", severity: "HIGH" },
      { with: "anticoagulant_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Кортизол/сахар', when: 'Каждые 4 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 400, timing: 'с едой 2x/д', form: 'экстракт туласи (2% урсоловой кислоты)' },
    bestForCourse: false,
  },
  gotu_kola: {
    id: 'gotu_kola',
    name: 'Gotu Kola',
    nameRu: 'Готу Кола',
    tier: 'advanced',
    category: ['adaptogen', 'nootropic'],
    forms: [
      { id: 'gotu_kola', name: 'Gotu Kola', nameRu: 'Готу Кола 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'SKIN', 'JOINTS'],
    systems: ['neuro', 'musculoskeletal'],
    mechanisms: ['COLLAGEN_SYNTHESIS', 'NEUROPROTECTION', 'CIRCULATION_ENHANCEMENT', 'ANXIOLYTIC'],
    description: 'Готу Кола — ноотропный адаптоген, стимулирует синтез коллагена, улучшает кровообращение и память.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когниция/кожа', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: головная боль при высоких дозах'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт готу колы' },
    bestForCourse: false,
  },
  ecdysterone: {
    id: 'ecdysterone',
    name: 'Ecdysterone',
    nameRu: 'Экдистерон',
    tier: 'advanced',
    category: ['adaptogen', 'anabolic'],
    forms: [
      { id: 'ecdysterone', name: 'Ecdysterone', nameRu: 'Экдистерон 200 мг 2x/д', dose: '400 мг 2x/д', best: true }
    ],
    organs: ['MUSCLES', 'LIVER'],
    systems: ['musculoskeletal', 'metabolic'],
    mechanisms: ['PROTEIN_SYNTHESIS', 'MTOR_ACTIVATION', 'LEAN_MASS_GAIN', 'INSULIN_SENSITIVITY'],
    description: 'Экдистерон — фитостероид из левзеи, стимулирует синтез белка через mTOR без андрогенных эффектов. Улучшает композицию тела.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Мышечная масса', when: 'Каждые 4 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: тошнота'],
    dosage: { mg: 400, timing: 'с едой (с белком)', form: 'экдистерон (95%)' },
    bestForCourse: false,
  },
  shilajit: {
    id: 'shilajit',
    name: 'Shilajit',
    nameRu: 'Мумиё (Шиладжит)',
    tier: 'advanced',
    category: ['adaptogen', 'metabolic'],
    forms: [
      { id: 'shilajit', name: 'Shilajit', nameRu: 'Мумиё очищенное 250 мг', dose: '250 мг 2x/д', best: true },
      { id: 'shilajit_2', name: 'Shilajit', nameRu: 'Шиладжит экстракт 250 мг', dose: '250 мг', best: false }
    ],
    organs: ['BRAIN', 'MUSCLES', 'KIDNEYS'],
    systems: ['neuro', 'renal', 'metabolic'],
    mechanisms: ['FULVIC_ACID_DELIVERY', 'MINERAL_REPLETION', 'MITOCHONDRIAL_ENHANCEMENT', 'TESTOSTERONE_SUPPORT'],
    description: 'Шиладжит — минеральная смола из Гималаев, содержит фульвокислоты и 80+ минералов. Повышает тестостерон и энергетику.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Тестостерон общий', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: аллергия'],
    dosage: { mg: 250, timing: 'с едой', form: 'мумиё очищенное или экстракт' },
    bestForCourse: false,
  },
  schisandra: {
    id: 'schisandra',
    name: 'Schisandra',
    nameRu: 'Лимонник китайский (Шизандра)',
    tier: 'advanced',
    category: ['adaptogen', 'hepatoprotector'],
    forms: [
      { id: 'schisandra', name: 'Schisandra', nameRu: 'Шизандра 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'schisandra_2', name: 'Schisandra', nameRu: 'Лимонник экстракт 300 мг', dose: '500 мг', best: false }
    ],
    organs: ['LIVER', 'BRAIN', 'ADRENALS'],
    systems: ['hepatic', 'neuro', 'endocrine'],
    mechanisms: ['ADAPTOGENIC', 'LIVER_PROTECTION', 'CORTISOL_REGULATION', 'ANTIOXIDANT'],
    description: 'Шизандра — адаптоген и гепатопротектор, содержит схизандрины. Защищает печень и повышает выносливость.',
    synergies: [
      { with: "adaptogen_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед', targetRange: '<40 Ед/л' }
    ],
    contraindications: [],
    sideEffects: ['Редко: бессонница при приёме вечером'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт шизандры (9% схизандринов)' },
    bestForCourse: false,
  },
  ginger: {
    id: 'ginger',
    name: 'Ginger',
    nameRu: 'Имбирь',
    tier: 'standard',
    category: ['herb', 'antiinflammatory'],
    forms: [
      { id: 'ginger', name: 'Ginger', nameRu: 'Имбирь экстракт 1000 мг', dose: '1 г 2x/д', best: true },
      { id: 'ginger_2', name: 'Ginger', nameRu: 'Имбирь порошок 2 г', dose: '1 г', best: false }
    ],
    organs: ['STOMACH', 'INTESTINES', 'MUSCLES'],
    systems: ['hepatic', 'metabolic'],
    mechanisms: ['ANTI_INFLAMMATORY', 'NAUSEA_RELIEF', 'DIGESTION_ENHANCEMENT', 'MUSCLE_RECOVERY'],
    description: 'Имбирь — противовоспалительное и противорвотное. Джинджеролы ингибируют COX-2 и LOX. На курсе помогает с тошнотой.',
    synergies: [
      { with: "nsaid_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "arb_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "curcumin", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "anticoagulant_drugs", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Тошнота/воспаление', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: изжога при высоких дозах'],
    dosage: { mg: 1000, timing: 'с едой', form: 'имбиря экстракт (5% джинджеролов)' },
    bestForCourse: false,
  },
  astaxanthin: {
    id: 'astaxanthin',
    name: 'Astaxanthin',
    nameRu: 'Астаксантин',
    tier: 'advanced',
    category: ['antioxidant', 'cardioprotector'],
    forms: [
      { id: 'astaxanthin', name: 'Astaxanthin', nameRu: 'Астаксантин 12 мг', dose: '12 мг', best: true },
      { id: 'astaxanthin_2', name: 'Astaxanthin', nameRu: 'Астаксантин 4 мг', dose: '12 мг', best: false }
    ],
    organs: ['SKIN', 'EYES', 'HEART', 'MUSCLES'],
    systems: ['cardio', 'neuro'],
    mechanisms: ['ANTIOXIDANT_6000X', 'UV_PROTECTION', 'ANTI_INFLAMMATORY', 'ENDURANCE_ENHANCEMENT'],
    description: 'Астаксантин — в 6000 раз сильнее витамина С. Защищает кожу от UV и мышцы от окисления.',
    synergies: [
      { with: "lycopene", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "vitamin_e", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Окислительный стресс', when: 'Каждые 12 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: лососёвый оттенок кожи'],
    dosage: { mg: 12, timing: 'с едой (жирорастворимый)', form: 'астаксантин из Haematococcus' },
    bestForCourse: false,
  },
  resveratrol: {
    id: 'resveratrol',
    name: 'Resveratrol',
    nameRu: 'Ресвератрол',
    tier: 'advanced',
    category: ['antioxidant', 'cardioprotector'],
    forms: [
      { id: 'resveratrol', name: 'Resveratrol', nameRu: 'Транс-ресвератрол 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'resveratrol_2', name: 'Resveratrol', nameRu: 'Ресвератрол + Кверцетин', dose: '500 мг', best: false }
    ],
    organs: ['HEART', 'BRAIN', 'LIVER'],
    systems: ['cardio', 'neuro', 'hepatic'],
    mechanisms: ['SIRT1_ACTIVATION', 'ANTIOXIDANT', 'ANTI_INFLAMMATORY', 'NRF2_ACTIVATION'],
    description: 'Ресвератрол — активатор SIRT1 и NRF2. Биодоступность около 20 процентов, птеростильбен предпочтительнее.',
    synergies: [
      { with: "statin_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "nmn", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "anticoagulant_drugs", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед', targetRange: 'ЛПНП<3.0' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 500, timing: 'с едой', form: 'транс-ресвератрол' },
    bestForCourse: false,
  },
  quercetin: {
    id: 'quercetin',
    name: 'Quercetin',
    nameRu: 'Кверцетин',
    tier: 'advanced',
    category: ['antioxidant', 'cardioprotector'],
    forms: [
      { id: 'quercetin', name: 'Quercetin', nameRu: 'Кверцетин 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'quercetin_2', name: 'Quercetin', nameRu: 'Кверцетин + Бромелайн', dose: '500 мг', best: false }
    ],
    organs: ['HEART', 'LUNGS', 'BRAIN'],
    systems: ['cardio', 'neuro', 'hepatic'],
    mechanisms: ['ANTI_INFLAMMATORY', 'ANTIHISTAMINE', 'SENOLYTIC', 'NRF2_ACTIVATION'],
    description: 'Кверцетин — флавоноид с противовоспалительным и антигистаминным действием. Сенолитик.',
    synergies: [
      { with: "antihistamine_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "vitamin_c", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "anthocyanins", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "antibiotic_drugs", effect: "", mechanism: "", severity: "LOW" },
      { with: "immunosuppressant_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Окислительный стресс', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Редко: головная боль'],
    dosage: { mg: 500, timing: 'с едой (с жирами)', form: 'кверцетин' },
    bestForCourse: false,
  },
  egcg: {
    id: 'egcg',
    name: 'EGCG',
    nameRu: 'EGCG',
    tier: 'advanced',
    category: ['antioxidant', 'metabolic'],
    forms: [
      { id: 'egcg', name: 'EGCG', nameRu: 'EGCG 400 мг', dose: '400 мг 2x/д', best: true },
      { id: 'egcg_2', name: 'EGCG', nameRu: 'Зелёный чай экстракт 500 мг', dose: '400 мг', best: false }
    ],
    organs: ['LIVER', 'BRAIN', 'HEART'],
    systems: ['hepatic', 'neuro', 'metabolic'],
    mechanisms: ['ANTIOXIDANT', 'FAT_OXIDATION', 'ANTI_INFLAMMATORY', 'AMPK_ACTIVATION'],
    description: 'EGCG — главный катехин зелёного чая. Активирует AMPK, стимулирует жиросжигание.',
    synergies: [
      { with: "vitamin_d3", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega9", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "mushroom_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед', targetRange: '<40 Ед/л' }
    ],
    contraindications: ['Беременность', 'Тяжёлая анемия'],
    sideEffects: ['Тошнота натощак'],
    dosage: { mg: 400, timing: 'натощак или с едой', form: 'EGCG экстракт' },
    bestForCourse: false,
  },
  sulforaphane: {
    id: 'sulforaphane',
    name: 'Sulforaphane',
    nameRu: 'Сульфорафан',
    tier: 'advanced',
    category: ['antioxidant', 'hepatoprotector'],
    forms: [
      { id: 'sulforaphane', name: 'Sulforaphane', nameRu: 'Сульфорафан 20 мг', dose: '20 мг', best: true },
      { id: 'sulforaphane_2', name: 'Sulforaphane', nameRu: 'Проростки брокколи экстракт', dose: '20 мг', best: false }
    ],
    organs: ['LIVER', 'LUNGS', 'INTESTINES'],
    systems: ['hepatic', 'immune', 'metabolic'],
    mechanisms: ['NRF2_ACTIVATION', 'PHASE2_DETOXIFICATION', 'ANTI_INFLAMMATORY', 'ANTICANCER'],
    description: 'Сульфорафан — мощнейший активатор NRF2. Из брокколи. На курсе — ключевая гепатопротекция.',
    synergies: [
      { with: "calcium", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Окислительный стресс', when: 'Каждые 12 нед' }
    ],
    contraindications: [],
    sideEffects: ['Тошнота при натощак'],
    dosage: { mg: 20, timing: 'натощак или с едой', form: 'экстракт проростков брокколи' },
    bestForCourse: false,
  },
  melatonin: {
    id: 'melatonin',
    name: 'Melatonin',
    nameRu: 'Мелатонин',
    tier: 'advanced',
    category: ['hormonal', 'neuroprotector'],
    forms: [
      { id: 'melatonin', name: 'Melatonin', nameRu: 'Мелатонин 3 мг', dose: '3 мг', best: true },
      { id: 'melatonin_2', name: 'Melatonin', nameRu: 'Мелатонин 5 мг', dose: '3 мг', best: false }
    ],
    organs: ['BRAIN', 'IMMUNE_SYSTEM', 'INTESTINES'],
    systems: ['neuro', 'immune', 'metabolic'],
    mechanisms: ['SLEEP_REGULATION', 'ANTIOXIDANT', 'IMMUNE_MODULATION', 'CIRCADIAN_RHYTHM'],
    description: 'Мелатонин — гормон сна, мощный антиоксидант. На курсе улучшает восстановление.',
    synergies: [
      { with: "magnesium", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "anxiolytic_drugs", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "gaba", effect: "", mechanism: "", severity: "HIGH" },
      { with: "antidepressant_drugs", effect: "", mechanism: "", severity: "LOW" },
      { with: "stimulant_complex", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Качество сна', when: 'Субъективно' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Сонливость', 'Редко: яркие сновидения'],
    dosage: { mg: 3, timing: 'на ночь за 30 мин до сна', form: 'мелатонин капсулы' },
    bestForCourse: false,
  },
  ginkgo: {
    id: 'ginkgo',
    name: 'Ginkgo Biloba',
    nameRu: 'Гинкго Билоба',
    tier: 'advanced',
    category: ['nootropic', 'cardioprotector'],
    forms: [
      { id: 'ginkgo', name: 'Ginkgo Biloba', nameRu: 'Гинкго 60 мг 2x/д', dose: '120 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'VESSELS', 'EYES'],
    systems: ['neuro', 'cardio'],
    mechanisms: ['CEREBRAL_BLOOD_FLOW', 'ANTIOXIDANT', 'MEMORY_ENHANCEMENT', 'PLATELET_AGGREGATION_INHIBITION'],
    description: 'Гинкго — улучшает мозговой кровоток и память.',
    synergies: [
      { with: "bacopa", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "ginseng", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "vinpocetine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Когниция/память', when: 'Субъективно' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Редко: головная боль', 'Риск кровотечения'],
    dosage: { mg: 120, timing: 'с едой 2x/д', form: 'экстракт гинкго' },
    bestForCourse: false,
  },
  cjc1295: {
    id: 'cjc1295',
    name: 'CJC-1295',
    nameRu: 'CJC-1295 (с модагриком)',
    tier: 'specialty',
    category: ['peptide', 'hormonal'],
    forms: [
      { id: 'cjc1295', name: 'CJC-1295', nameRu: 'CJC-1295 + Ipamorelin 2 мг', dose: '2 мг 2x/д', best: true },
      { id: 'cjc1295_2', name: 'CJC-1295', nameRu: 'CJC-1295 5 мг', dose: '2 мг', best: false }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['GH_RELEASING_IGH_INCREASE', 'LH_RELEASE', 'MUSCLE_GROWTH', 'FAT_LOSS'],
    description: 'CJC-1295 с модагриком — пептид GHRH-аналог, стимулирует выброс ГР и ИФР-1. Улучшает композицию тела и восстановление.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'ИФР-1', when: 'Каждые 4 нед', targetRange: '150-450 нг/мл' }
    ],
    contraindications: ['Беременность', 'Активный онкологический процесс'],
    sideEffects: ['Редко: задержка жидкости', 'Покраснение в месте инъекции'],
    dosage: { mg: 2, timing: '1x/нед п/к', form: 'CJC-1295 2 мг' },
    bestForCourse: false,
  },
  ipamorelin: {
    id: 'ipamorelin',
    name: 'Ipamorelin',
    nameRu: 'Ипаморелин',
    tier: 'specialty',
    category: ['peptide', 'hormonal'],
    forms: [
      { id: 'ipamorelin', name: 'Ipamorelin', nameRu: 'Ипаморелин 100 мкг', dose: '100 мкг 2x/д', best: true },
      { id: 'ipamorelin_2', name: 'Ipamorelin', nameRu: 'Ипаморелин 200 мкг', dose: '100 мкг', best: false }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['GH_RELEASE_SELECTIVE', 'LH_RELEASE', 'MUSCLE_RECOVERY', 'FAT_LOSS'],
    description: 'Ипаморелин — селективный секретагог ГР, не повышает кортизол и пролактин. На курсе — восстановление и жиросжигание.',
    synergies: [
      { with: "insulin", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'ИФР-1', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: покраснение в месте инъекции', 'Тошнота при начале'],
    dosage: { mg: 0.1, timing: '2-3x/д п/к', form: 'Ипаморелин 100 мкг' },
    bestForCourse: false,
  },
  ghrp2: {
    id: 'ghrp2',
    name: 'GHRP-2',
    nameRu: 'GHRP-2',
    tier: 'specialty',
    category: ['peptide', 'hormonal'],
    forms: [
      { id: 'ghrp2', name: 'GHRP-2', nameRu: 'GHRP-2 100 мкг', dose: '100 мкг 2x/д', best: true }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['GH_RELEASE', 'CORTISOL_MODULATION', 'APPETITE_STIMULATION', 'MUSCLE_RECOVERY'],
    description: 'GHRP-2 — секретагог ГР, стимулирует аппетит и восстановление. Менее селективный чем ипаморелин.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'ИФР-1', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Повышение аппетита', 'Покраснение в месте инъекции'],
    dosage: { mg: 0.1, timing: '2-3x/д п/к', form: 'GHRP-2 100 мкг' },
    bestForCourse: false,
  },
  ghrp6: {
    id: 'ghrp6',
    name: 'GHRP-6',
    nameRu: 'GHRP-6',
    tier: 'specialty',
    category: ['peptide', 'hormonal'],
    forms: [
      { id: 'ghrp6', name: 'GHRP-6', nameRu: 'GHRP-6 100 мкг', dose: '100 мкг 2x/д', best: true }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['GH_RELEASE', 'APPETITE_STIMULATION', 'CORTISOL_INCREASE', 'MUSCLE_RECOVERY'],
    description: 'GHRP-6 — секретагог ГР с сильным стимулирующим аппетит действием. На курсе — набор массы.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'ИФР-1', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Сильное повышение аппетита', 'Покраснение в месте инъекции'],
    dosage: { mg: 0.1, timing: '2-3x/д п/к', form: 'GHRP-6 100 мкг' },
    bestForCourse: false,
  },
  follistatin: {
    id: 'follistatin',
    name: 'Follistatin',
    nameRu: 'Фоллистатин',
    tier: 'specialty',
    category: ['peptide', 'hormonal'],
    forms: [
      { id: 'follistatin', name: 'Follistatin', nameRu: 'Фоллистатин 1 мг', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['MUSCLES', 'REPRODUCTIVE'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['MYOSTATIN_INHIBITION', 'MUSCLE_GROWTH', 'FOLLICLE_REGULATION'],
    description: 'Фоллистатин — белок-ингибитор миостатина, блокирует ограничитель роста мышц. Потенцирует гипертрофию на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Миостатин', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Беременность', 'Онкология'],
    sideEffects: ['Редко: реакция в месте инъекции'],
    dosage: { mg: 1, timing: '2x/нед п/к', form: 'Фоллистатин 1 мг' },
    bestForCourse: false,
  },
  semax: {
    id: 'semax',
    name: 'Semax',
    nameRu: 'Семакс',
    tier: 'specialty',
    category: ['peptide', 'nootropic'],
    forms: [
      { id: 'semax', name: 'Semax', nameRu: 'Семакс 0.1% капли', dose: '0.3 мкг 2x/д', best: true },
      { id: 'semax_2', name: 'Semax', nameRu: 'Семакс 0.3% капли', dose: '0.3 мкг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['NGF_STIMULATION', 'BDNF_INCREASE', 'NEUROPROTECTION', 'COGNITION_ENHANCEMENT'],
    description: 'Семакс — нейропептид, стимулирует синтез NGF и BDNF, улучшает память, внимание и нейропротекцию. Обязателен на курсе ААС.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Эпилепсия', 'Острый психоз'],
    sideEffects: ['Редко: раздражение слизистой'],
    dosage: { mg: 0.0003, timing: '2x/д интраназально', form: 'Семакс 0.3 мг/капли' },
    bestForCourse: true,
  },
  selank: {
    id: 'selank',
    name: 'Selank',
    nameRu: 'Селанк',
    tier: 'specialty',
    category: ['peptide', 'nootropic'],
    forms: [
      { id: 'selank', name: 'Selank', nameRu: 'Селанк 0.1% капли', dose: '0.3 мкг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['nero'],
    mechanisms: ['GABA_MODULATION', 'ANXIOLYTIC', 'NEUROPROTECTION', 'MOOD_REGULATION'],
    description: 'Селанк — анксиолитический пептид, модулирует ГАМК-систему, снижает тревожность и улучшает сон. На курсе — антистресс.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость'],
    sideEffects: ['Редко: раздражение слизистой'],
    dosage: { mg: 0.0003, timing: '2-3x/д интраназально', form: 'Селанк 0.3 мг/капли' },
    bestForCourse: false,
  },
  dsip: {
    id: 'dsip',
    name: 'DSIP',
    nameRu: 'DSIP (Дельта-сон-индуцирующий пептид)',
    tier: 'specialty',
    category: ['peptide', 'neuroprotector'],
    forms: [
      { id: 'dsip', name: 'DSIP', nameRu: 'DSIP 1 мг', dose: '1 мг 2x/д', best: true },
      { id: 'dsip_2', name: 'DSIP', nameRu: 'DSIP 2 мг', dose: '1 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['nero'],
    mechanisms: ['SLEEP_REGULATION', 'ANALGESIC', 'CORTISOL_REDUCTION', 'STRESS_MODULATION'],
    description: 'DSIP — дельта-сон-индуцирующий пептид, нормализует структуру сна, снижает кортизол. На курсе — улучшение восстановления.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Сон (соно-графия)', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 1, timing: 'на ночь п/к', form: 'DSIP 1 мг' },
    bestForCourse: false,
  },
  p21: {
    id: 'p21',
    name: 'P21',
    nameRu: 'P21 (Пептид 21)',
    tier: 'specialty',
    category: ['peptide', 'nootropic'],
    forms: [
      { id: 'p21', name: 'P21', nameRu: 'P21 1 мг', dose: '1 мкг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['NEUROGENESIS', 'MEMORY_ENHANCEMENT', 'BDNF_INCREASE', 'NEUROPROTECTION'],
    description: 'P21 — ноотропный пептид, стимулирует нейрогенез и BDNF. Улучшает память и обучение на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 0.001, timing: '1x/д п/к', form: 'P21 1 мг' },
    bestForCourse: false,
  },
  mots_c: {
    id: 'mots_c',
    name: 'MOTS-c',
    nameRu: 'MOTS-c',
    tier: 'specialty',
    category: ['peptide', 'metabolic'],
    forms: [
      { id: 'mots_c', name: 'MOTS-c', nameRu: 'MOTS-c 10 мг', dose: '10 мг 2x/д', best: true }
    ],
    organs: ['MUSCLES', 'LIVER', 'BRAIN'],
    systems: ['hepatic', 'metabolic'],
    mechanisms: ['AMPK_ACTIVATION', 'FAT_OXIDATION', 'INSULIN_SENSITIVITY', 'MUSCLE_REGULATION'],
    description: 'MOTS-c — митохондриальный пептид, активирует AMPK, улучшает инсулиновую чувствительность и жиросжигание.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 10, timing: '1x/д п/к', form: 'MOTS-c 10 мг' },
    bestForCourse: false,
  },
  humanin: {
    id: 'humanin',
    name: 'Humanin',
    nameRu: 'Хьюманин',
    tier: 'specialty',
    category: ['peptide', 'neuroprotector'],
    forms: [
      { id: 'humanin', name: 'Humanin', nameRu: 'Хьюманин 5 мг', dose: '5 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'MUSCLES', 'HEART'],
    systems: ['neuro', 'cardio'],
    mechanisms: ['NEUROPROTECTION', 'APOPTOSIS_INHIBITION', 'MITOCHONDRIAL_PROTECTION', 'INSULIN_SENSITIVITY'],
    description: 'Хьюманин — митохондриальный пептид, подавляет апоптоз, нейропротекция и защита митохондрий. Анти-возрастной.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 5, timing: '1x/д п/к', form: 'Хьюманин 5 мг' },
    bestForCourse: false,
  },
  ss31: {
    id: 'ss31',
    name: 'SS-31',
    nameRu: 'SS-31 (Элампирад)',
    tier: 'specialty',
    category: ['peptide', 'mitochondrial'],
    forms: [
      { id: 'ss31', name: 'SS-31', nameRu: 'SS-31 1 мг', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['MUSCLES', 'HEART', 'KIDNEYS'],
    systems: ['cardio', 'renal'],
    mechanisms: ['MITOCHONDRIAL_PROTECTION', 'ATP_PRODUCTION', 'OXIDATIVE_STRESS_REDUCTION', 'MUSCLE_RECOVERY'],
    description: 'SS-31 — митохондриальный пептид, защищает внутреннюю мембрану митохондрий, снижает окислительный стресс.',
    synergies: [
      { with: "cordyceps", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'КФК', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 1, timing: '1x/д п/к', form: 'SS-31 1 мг' },
    bestForCourse: false,
  },
  thymosin_alpha1: {
    id: 'thymosin_alpha1',
    name: 'Thymosin Alpha-1',
    nameRu: 'Тимозин Альфа-1',
    tier: 'specialty',
    category: ['peptide', 'immunomodulator'],
    forms: [
      { id: 'thymosin_alpha1', name: 'Thymosin Alpha-1', nameRu: 'Тимозин Альфа-1 1.6 мг', dose: '1.6 мг 2x/д', best: true }
    ],
    organs: ['THYMUS', 'IMMUNE_SYSTEM'],
    systems: ['immune'],
    mechanisms: ['IMMUNE_REGULATION', 'T_CELL_ACTIVATION', 'ANTI_INFLAMMATORY', 'INFECTION_RESISTANCE'],
    description: 'Тимозин Альфа-1 — иммуномодулирующий пептид, активирует Т-клетки и NK-клетки. На курсе — защита от инфекций.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Иммунограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 1.6, timing: '2x/нед п/к', form: 'Тимозин Альфа-1 1.6 мг' },
    bestForCourse: false,
  },
  ghk_cu: {
    id: 'ghk_cu',
    name: 'GHK-Cu',
    nameRu: 'GHK-Cu (Глицил-гистидил-лизин-медь)',
    tier: 'advanced',
    category: ['peptide', 'joint', 'antioxidant'],
    forms: [
      { id: 'ghk_cu', name: 'GHK-Cu', nameRu: 'GHK-Cu 2 мг', dose: '2 мг 2x/д', best: true },
      { id: 'ghk_cu_2', name: 'GHK-Cu', nameRu: 'GHK-Cu крем 1%', dose: '2 мг', best: false }
    ],
    organs: ['SKIN', 'JOINTS', 'HAIR'],
    systems: ['musculoskeletal'],
    mechanisms: ['WOUND_HEALING', 'COLLAGEN_SYNTHESIS', 'ANTI_INFLAMMATORY', 'COPPER_DELIVERY'],
    description: 'GHK-Cu — медный пептид, стимулирует синтез коллагена, заживление ран, антиоксидант. На курсе — кожа, связки, волосы.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Медь сыворотки', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Болезнь Вильсона', 'Избыток меди'],
    sideEffects: ['Покраснение', 'Редко: тошнота'],
    dosage: { mg: 2, timing: '1x/д п/к или наружно', form: 'GHK-Cu 2 мг' },
    bestForCourse: false,
  },
  bpc157: {
    id: 'bpc157',
    name: 'BPC-157',
    nameRu: 'BPC-157 (Пептид защиты тела)',
    tier: 'specialty',
    category: ['peptide', 'joint'],
    forms: [
      { id: 'bpc157', name: 'BPC-157', nameRu: 'BPC-157 250 мкг', dose: '250 мкг 2x/д', best: true },
      { id: 'bpc157_2', name: 'BPC-157', nameRu: 'BPC-157 500 мкг', dose: '250 мкг', best: false }
    ],
    organs: ['JOINTS', 'GUT', 'MUSCLES'],
    systems: ['musculoskeletal', 'gastrointestinal'],
    mechanisms: ['WOUND_HEALING', 'ANGIOGENESIS', 'GUT_PROTECTION', 'ANTI_INFLAMMATORY'],
    description: 'BPC-157 — пептид защиты тела, ускоряет заживление связок, сухожилий, кишки. На курсе — защита суставов и ЖКТ.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Контроль суставов', when: 'Субъективно' }
    ],
    contraindications: ['Беременность', 'Онкология'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 0.25, timing: '2x/д п/к или перорально', form: 'BPC-157 250 мкг' },
    bestForCourse: true,
  },
  tb500: {
    id: 'tb500',
    name: 'TB-500',
    nameRu: 'TB-500 (Тимозин Бета-4)',
    tier: 'specialty',
    category: ['peptide', 'joint'],
    forms: [
      { id: 'tb500', name: 'TB-500', nameRu: 'TB-500 5 мг', dose: '5 мг 2x/д', best: true },
      { id: 'tb500_2', name: 'TB-500', nameRu: 'TB-500 10 мг', dose: '5 мг', best: false }
    ],
    organs: ['JOINTS', 'MUSCLES', 'HEART'],
    systems: ['musculoskeletal'],
    mechanisms: ['ACTIN_REGULATION', 'WOUND_HEALING', 'MUSCLE_RECOVERY', 'ANTI_INFLAMMATORY'],
    description: 'TB-500 — пептид на основе тимозина бета-4, регулирует актин, ускоряет заживление мышц и связок. На курсе — восстановление.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Контроль суставов', when: 'Субъективно' }
    ],
    contraindications: ['Беременность', 'Онкология'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 5, timing: '2x/нед п/к', form: 'TB-500 5 мг' },
    bestForCourse: true,
  },
  melanotan1: {
    id: 'melanotan1',
    name: 'Melanotan-1',
    nameRu: 'Меланотан-1',
    tier: 'specialty',
    category: ['peptide', 'hormonal'],
    forms: [
      { id: 'melanotan1', name: 'Melanotan-1', nameRu: 'Меланотан-1 1 мг', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['SKIN', 'REPRODUCTIVE'],
    systems: ['reproductive'],
    mechanisms: ['MELANOGENESIS', 'SKIN_PROTECTION', 'UV_PROTECTION', 'APHRODISIAC_EFFECT'],
    description: 'Меланотан-1 — пептид, стимулирующий меланогенез, защиту кожи от УФ. Минимальные побочные эффекты.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Пигментация кожи', when: 'Субъективно' }
    ],
    contraindications: ['Беременность', 'Меланома в анамнезе'],
    sideEffects: ['Тошнота при начале', 'Покраснение'],
    dosage: { mg: 1, timing: '1x/д п/к', form: 'Меланотан-1 1 мг' },
    bestForCourse: false,
  },
  melanotan2: {
    id: 'melanotan2',
    name: 'Melanotan-2',
    nameRu: 'Меланотан-2',
    tier: 'specialty',
    category: ['peptide', 'hormonal'],
    forms: [
      { id: 'melanotan2', name: 'Melanotan-2', nameRu: 'Меланотан-2 0.5 мг', dose: '500 мкг 2x/д', best: true }
    ],
    organs: ['SKIN', 'REPRODUCTIVE'],
    systems: ['reproductive'],
    mechanisms: ['MELANOGENESIS', 'APHRODISIAC_EFFECT', 'APPETITE_SUPPRESSION', 'UV_PROTECTION'],
    description: 'Меланотан-2 — сильнее МТ1, стимулирует загар и либидо, но с больше побочными. На курсе — защита кожи.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Пигментация кожи', when: 'Субъективно' }
    ],
    contraindications: ['Беременность', 'Меланома', 'Сердечно-сосудистые заболевания'],
    sideEffects: ['Тошнота', 'Приливы', 'Потемнение веснушек'],
    dosage: { mg: 0.5, timing: '1x/д п/к (титровать)', form: 'Меланотан-2 0.5 мг' },
    bestForCourse: false,
  },
  pt141: {
    id: 'pt141',
    name: 'PT-141',
    nameRu: 'PT-141 (Бремеланотид)',
    tier: 'specialty',
    category: ['peptide', 'hormonal'],
    forms: [
      { id: 'pt141', name: 'PT-141', nameRu: 'PT-141 2 мг', dose: '2 мг 2x/д', best: true }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive'],
    mechanisms: ['MELANOCORTIN_ACTIVATION', 'APHRODISIAC_EFFECT', 'LIBIDO_ENHANCEMENT', 'ERECTILE_FUNCTION'],
    description: 'PT-141 — пептид для лечения сексуальной дисфункции, активирует меланокортиновые рецепторы. На курсе — либидо.',
    synergies: [],
    conflicts: [
      { with: "stimulant_complex", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Либидо', when: 'Субъективно' }
    ],
    contraindications: ['Беременность', 'Неконтролируемая гипертензия'],
    sideEffects: ['Тошнота', 'Приливы', 'Повышение АД'],
    dosage: { mg: 2, timing: 'за 30 мин до п/к', form: 'PT-141 2 мг' },
    bestForCourse: false,
  },
  gonadorelin: {
    id: 'gonadorelin',
    name: 'Gonadorelin',
    nameRu: 'Гонадорелин',
    tier: 'specialty',
    category: ['peptide', 'hormonal'],
    forms: [
      { id: 'gonadorelin', name: 'Gonadorelin', nameRu: 'Гонадорелин 100 мкг', dose: '100 мкг 2x/д', best: true }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['GNRH_RELEASE', 'LH_FSH_REGULATION', 'TESTOSTERONE_RESTORE', 'PCT_SUPPORT'],
    description: 'Гонадорелин — стимулятор ГнРГ, восстанавливает ось ГРГ-ЛГ-ФСГ. Для ПКТ и восстановления после курса.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'ЛГ/ФСГ', when: 'Каждые 2 нед' }
    ],
    contraindications: ['Беременность', 'Гипофизарная недостаточность'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 0.1, timing: '2-3x/д п/к', form: 'Гонадорелин 100 мкг' },
    bestForCourse: false,
  },
  kisspeptin: {
    id: 'kisspeptin',
    name: 'Kisspeptin',
    nameRu: 'Киссептин',
    tier: 'specialty',
    category: ['peptide', 'hormonal'],
    forms: [
      { id: 'kisspeptin', name: 'Kisspeptin', nameRu: 'Киссептин 100 мкг', dose: '100 мкг 2x/д', best: true }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['GNRH_RELEASE', 'LH_FSH_STIMULATION', 'PUBERTY_REGULATION', 'REPRODUCTIVE_RECOVERY'],
    description: 'Киссептин — пептид, стимулирующий выброс ГнРГ, восстанавливает репродуктивную ось. Для ПКТ и восстановления.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'ЛГ/ФСГ', when: 'Каждые 2 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 0.1, timing: '1x/д п/к', form: 'Киссептин 100 мкг' },
    bestForCourse: false,
  },
  glp1: {
    id: 'glp1',
    name: 'GLP-1',
    nameRu: 'ГПП-1 (Глюкагоноподобный пептид-1)',
    tier: 'specialty',
    category: ['peptide', 'metabolic'],
    forms: [
      { id: 'glp1', name: 'GLP-1', nameRu: 'ГПП-1 0.5 мг', dose: '500 мкг 2x/д', best: true }
    ],
    organs: ['PANCREAS', 'BRAIN', 'GUT'],
    systems: ['metabolic', 'gastrointestinal'],
    mechanisms: ['INSULIN_SECRETION', 'GLUCOSE_REGULATION', 'APPETITE_SUPPRESSION', 'WEIGHT_LOSS'],
    description: 'ГПП-1 — инкретиновый пептид, стимулирует инсулин, подавляет аппетит. На курсе — контроль глюкозы и веса.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Медуллярный рак щитовидной железы', 'МЭН2'],
    sideEffects: ['Тошнота', 'Диарея при начале'],
    dosage: { mg: 0.5, timing: '1-2x/д п/к', form: 'ГПП-1 0.5 мг' },
    bestForCourse: false,
  },
  gip: {
    id: 'gip',
    name: 'GIP',
    nameRu: 'ГИП (Глюкозозависимый инсулинотропный полипептид)',
    tier: 'specialty',
    category: ['peptide', 'metabolic'],
    forms: [
      { id: 'gip', name: 'GIP', nameRu: 'ГИП 0.5 мг', dose: '500 мкг 2x/д', best: true }
    ],
    organs: ['PANCREAS', 'GUT', 'BONE'],
    systems: ['metabolic'],
    mechanisms: ['INSULIN_SECRETION', 'BONE_FORMATION', 'FAT_METABOLISM', 'GLUCOSE_REGULATION'],
    description: 'ГИП — инкретиновый пептид, стимулирует инсулин и формирование кости. Дополнение к ГПП-1.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: тошнота'],
    dosage: { mg: 0.5, timing: '1x/д п/к', form: 'ГИП 0.5 мг' },
    bestForCourse: false,
  },
  cerebrolysin: {
    id: 'cerebrolysin',
    name: 'Cerebrolysin',
    nameRu: 'Церебролизин',
    tier: 'specialty',
    category: ['peptide', 'nootropic'],
    forms: [
      { id: 'cerebrolysin', name: 'Cerebrolysin', nameRu: 'Церебролизин 5 мл', dose: '5 мг 2x/д', best: true },
      { id: 'cerebrolysin_2', name: 'Cerebrolysin', nameRu: 'Церебролизин 10 мл', dose: '5 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['NEUROTROPHIC_STIMULATION', 'NEUROPROTECTION', 'SYNAPTIC_PLASTICITY', 'MEMORY_ENHANCEMENT'],
    description: 'Церебролизин — комплекс нейропептидов, нейротрофическая активность, улучшает память и когницию. На курсе — нейропротекция.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Эпилепсия', 'Острый инсульт'],
    sideEffects: ['Редко: возбуждение', 'Боль в месте инъекции'],
    dosage: { mg: 5, timing: 'в/м или в/в 1x/д', form: 'Церебролизин 5 мл' },
    bestForCourse: false,
  },
  cortexin: {
    id: 'cortexin',
    name: 'Cortexin',
    nameRu: 'Кортексин',
    tier: 'specialty',
    category: ['peptide', 'nootropic'],
    forms: [
      { id: 'cortexin', name: 'Cortexin', nameRu: 'Кортексин 10 мг', dose: '10 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['NEUROPROTECTION', 'COGNITION_ENHANCEMENT', 'BDNF_INCREASE', 'MEMORY_IMPROVEMENT'],
    description: 'Кортексин — комплекс корковых пептидов, нейропротектор и ноотроп. Улучшает память и внимание на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость'],
    sideEffects: ['Редко: аллергическая реакция'],
    dosage: { mg: 10, timing: 'в/м 1x/д', form: 'Кортексин 10 мг' },
    bestForCourse: false,
  },
  peptide_complex: {
    id: 'peptide_complex',
    name: 'Peptide Complex',
    nameRu: 'Пептидный комплекс',
    tier: 'advanced',
    category: ['peptide', 'adaptogen'],
    forms: [
      { id: 'peptide_complex', name: 'Peptide Complex', nameRu: 'Пептидный комплекс 5 мг', dose: '5 мг 2x/д', best: true },
      { id: 'peptide_complex_2', name: 'Peptide Complex', nameRu: 'Пептидный комплекс (BPC+TB+GHK) 5 мл', dose: '5 мг', best: false }
    ],
    organs: ['MUSCLES', 'JOINTS', 'BRAIN'],
    systems: ['musculoskeletal', 'neuro'],
    mechanisms: ['TISSUE_RECOVERY', 'IMMUNE_MODULATION', 'NEUROPROTECTION', 'ANTI_AGING'],
    description: 'Пептидный комплекс — комбинация восстановительных пептидов для комплексной поддержки организма на курсе.',
    synergies: [
      { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "lycopene", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "chaga", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "amino_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "cordyceps", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "ss31", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "alpha_ketoglutarate", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Контроль суставов', when: 'Субъективно' }
    ],
    contraindications: ['Беременность', 'Онкология'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 5, timing: '1x/д п/к', form: 'Пептидный комплекс 5 мг' },
    bestForCourse: false,
  },
  elastin: {
    id: 'elastin',
    name: 'Elastin',
    nameRu: 'Эластин',
    tier: 'advanced',
    category: ['amino', 'joint'],
    forms: [
      { id: 'elastin', name: 'Elastin', nameRu: 'Эластин пептиды 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['SKIN', 'JOINTS', 'MUSCLES'],
    systems: ['musculoskeletal'],
    mechanisms: ['ELASTICITY_RESTORATION', 'JOINT_FUNCTION', 'SKIN_ELASTICITY', 'ANTI_AGING'],
    description: 'Эластин — структурный белок соединительной ткани, обеспечивает упругость кожи и связок. На курсе — поддержка связок.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Кожа/суставы', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: аллергия'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'эластин пептиды' },
    bestForCourse: false,
  },
  histidine: {
    id: 'histidine',
    name: 'Histidine',
    nameRu: 'Гистидин',
    tier: 'standard',
    category: ['amino', 'antioxidant'],
    forms: [
      { id: 'histidine', name: 'Histidine', nameRu: 'L-Гистидин 1000 мг', dose: '1 г 2x/д', best: true }
    ],
    organs: ['MUSCLES', 'BLOOD', 'SKIN'],
    systems: ['musculoskeletal', 'hematologic'],
    mechanisms: ['HISTAMINE_SYNTHESIS', 'CARNOSINE_PRECURSOR', 'METAL_CHELATION', 'ANTI_INFLAMMATORY'],
    description: 'Гистидин — незаменимая аминокислота, предшественник гистамина и карнозина. Хелатирует тяжёлые металлы, поддерживает иммунитет.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Общий белок', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Беременность', 'Подагра'],
    sideEffects: ['Редко: аллергия', 'Тошнота при высоких дозах'],
    dosage: { mg: 1000, timing: 'натощак 2x/д', form: 'L-Гистидин 1000 мг' },
    bestForCourse: false,
  },
  cysteine: {
    id: 'cysteine',
    name: 'Cysteine',
    nameRu: 'Цистеин',
    tier: 'standard',
    category: ['amino', 'antioxidant'],
    forms: [
      { id: 'cysteine', name: 'Cysteine', nameRu: 'N-Ацетилцистеин 600 мг', dose: '500 мг 2x/д', best: true },
      { id: 'cysteine_2', name: 'Cysteine', nameRu: 'L-Цистеин 500 мг', dose: '500 мг', best: false }
    ],
    organs: ['LIVER', 'KIDNEYS', 'SKIN'],
    systems: ['hepatic', 'renal'],
    mechanisms: ['GLUTATHIONE_SYNTHESIS', 'METAL_CHELATION', 'SKIN_HEALTH', 'DETOXIFICATION'],
    description: 'Цистеин — серосодержащая аминокислота, предшественник глутатиона. Защищает печень, хелатирует тяжёлые металлы.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Бронхиальная астма (с осторожностью)'],
    sideEffects: ['Тошнота натощак', 'Изжога'],
    dosage: { mg: 500, timing: 'натощак 2x/д', form: 'N-Ацетилцистеин 600 мг' },
    bestForCourse: true,
  },
  serine: {
    id: 'serine',
    name: 'Serine',
    nameRu: 'Серин',
    tier: 'standard',
    category: ['amino', 'neuroprotector'],
    forms: [
      { id: 'serine', name: 'Serine', nameRu: 'L-Серин 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES', 'MUSCLES'],
    systems: ['neuro'],
    mechanisms: ['SERINE_SYNTHESIS', 'PHOSPHOLIPID_PRECURSOR', 'NEUROPROTECTION', 'MEMORY_SUPPORT'],
    description: 'Серин — заменимая аминокислота, предшественник фосфолипидов и сериновых протеаз. Поддержка мозга и нервной системы.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'L-Серин 500 мг' },
    bestForCourse: false,
  },
  proline: {
    id: 'proline',
    name: 'Proline',
    nameRu: 'Пролин',
    tier: 'standard',
    category: ['amino', 'joint'],
    forms: [
      { id: 'proline', name: 'Proline', nameRu: 'L-Пролин 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['SKIN', 'JOINTS', 'MUSCLES'],
    systems: ['musculoskeletal'],
    mechanisms: ['COLLAGEN_SYNTHESIS', 'JOINT_SUPPORT', 'SKIN_HEALTH', 'WOUND_HEALING'],
    description: 'Пролин — заменимая аминокислота, ключевой компонент коллагена. Поддержка суставов, связок и кожи на курсе.',
    synergies: [
      { with: "lysine", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "collagen", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Кожа/суставы', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'L-Пролин 500 мг' },
    bestForCourse: false,
  },
  aspartate: {
    id: 'aspartate',
    name: 'Aspartate',
    nameRu: 'Аспартат',
    tier: 'standard',
    category: ['amino', 'metabolic'],
    forms: [
      { id: 'aspartate', name: 'Aspartate', nameRu: 'L-Аспартат 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['MUSCLES', 'LIVER', 'BRAIN'],
    systems: ['hepatic', 'metabolic'],
    mechanisms: ['UREA_CYCLE', 'MALATE_AS_PARTATE_SHUTTLE', 'ENERGY_PRODUCTION', 'AMMONIA_DETOX'],
    description: 'Аспартат — заменимая аминокислота, участвует в цикле мочевины и малат-аспартатном челноке. Детоксикация аммиака.',
    synergies: [
      { with: "amino_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Аммиак', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'L-Аспартат 500 мг' },
    bestForCourse: false,
  },
  ornithine: {
    id: 'ornithine',
    name: 'Ornithine',
    nameRu: 'Орнитин',
    tier: 'standard',
    category: ['amino', 'hepatoprotector'],
    forms: [
      { id: 'ornithine', name: 'Ornithine', nameRu: 'L-Орнитин 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'ornithine_2', name: 'Ornithine', nameRu: 'L-Орнитин-L-Аргинин 500 мг', dose: '500 мг', best: false }
    ],
    organs: ['LIVER', 'MUSCLES'],
    systems: ['hepatic'],
    mechanisms: ['UREA_CYCLE', 'AMMONIA_DETOX', 'GH_RELEASE', 'LIVER_PROTECTION'],
    description: 'Орнитин — заменимая аминокислота, участвует в цикле мочевины, снижает аммиак, стимулирует выброс ГР. На курсе — защита печени.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Аммиак', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'натощак на ночь', form: 'L-Орнитин 500 мг' },
    bestForCourse: false,
  },
  threonine: {
    id: 'threonine',
    name: 'Threonine',
    nameRu: 'Треонин',
    tier: 'standard',
    category: ['amino', 'immunomodulator'],
    forms: [
      { id: 'threonine', name: 'Threonine', nameRu: 'L-Треонин 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['LIVER', 'GUT', 'IMMUNE_SYSTEM'],
    systems: ['hepatic', 'immune'],
    mechanisms: ['MUCIN_SYNTHESIS', 'LIVER_LIPID_REGULATION', 'IMMUNE_FUNCTION', 'COLLAGEN_SYNTHESIS'],
    description: 'Треонин — незаменимая аминокислота, важна для синтеза муцина (защита ЖКТ) и иммунных белков. На курсе — защита ЖКТ.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Общий белок', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'L-Треонин 500 мг' },
    bestForCourse: false,
  },
  lysine: {
    id: 'lysine',
    name: 'Lysine',
    nameRu: 'Лизин',
    tier: 'standard',
    category: ['amino', 'immunomodulator'],
    forms: [
      { id: 'lysine', name: 'Lysine', nameRu: 'L-Лизин 1000 мг', dose: '1 г 2x/д', best: true },
      { id: 'lysine_2', name: 'Lysine', nameRu: 'L-Лизин 500 мг', dose: '1 г', best: false }
    ],
    organs: ['MUSCLES', 'BONES', 'IMMUNE_SYSTEM'],
    systems: ['musculoskeletal', 'immune'],
    mechanisms: ['COLLAGEN_CROSS_LINKING', 'ANTI_VIRAL', 'CALCIUM_ABSORPTION', 'MUSCLE_RECOVERY'],
    description: 'Лизин — незаменимая аминокислота, необходима для кросс-линкинга коллагена и усвоения кальция. Антивирусная защита.',
    synergies: [
      { with: "proline", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "collagen", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Кальций сыворотки', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Печёночная недостаточность'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'натощак 2x/д', form: 'L-Лизин 1000 мг' },
    bestForCourse: false,
  },
  phenylalanine: {
    id: 'phenylalanine',
    name: 'Phenylalanine',
    nameRu: 'Фенилаланин',
    tier: 'standard',
    category: ['amino', 'nootropic'],
    forms: [
      { id: 'phenylalanine', name: 'Phenylalanine', nameRu: 'DL-Фенилаланин 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES', 'THYROID'],
    systems: ['neuro', 'endocrine'],
    mechanisms: ['DOPAMINE_PRECURSOR', 'NOREPINEPHRINE_SYNTHESIS', 'PAIN_MODULATION', 'MOOD_REGULATION'],
    description: 'Фенилаланин — незаменимая аминокислота, предшественник дофамина и норадреналина. Улучшает настроение и концентрацию.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Фенилкетонурия', 'Шизофрения'],
    sideEffects: ['Тошнота при высоких дозах', 'Бессонница'],
    dosage: { mg: 500, timing: 'натощак 2x/д', form: 'DL-Фенилаланин 500 мг' },
    bestForCourse: false,
  },
  amino_complex: {
    id: 'amino_complex',
    name: 'Amino Complex',
    nameRu: 'Аминокислотный комплекс',
    tier: 'standard',
    category: ['amino', 'recovery'],
    forms: [
      { id: 'amino_complex', name: 'Amino Complex', nameRu: 'Аминокислотный комплекс 5 г', dose: '5 г 2x/д', best: true },
      { id: 'amino_complex_2', name: 'Amino Complex', nameRu: 'BCAA+ЕАА комплекс 3 г', dose: '5 г', best: false }
    ],
    organs: ['MUSCLES', 'LIVER', 'BRAIN'],
    systems: ['musculoskeletal', 'hepatic'],
    mechanisms: ['MUSCLE_RECOVERY', 'LIVER_PROTECTION', 'NITROGEN_BALANCE', 'PROTEIN_SYNTHESIS'],
    description: 'Аминокислотный комплекс — полный спектр незаменимых и заменимых аминокислот для восстановления и защиты на курсе.',
    synergies: [
      { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "lycopene", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "chaga", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "amino_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "aspartate", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Общий белок', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 5000, timing: 'с едой 2x/д', form: 'Аминокислотный комплекс 5 г' },
    bestForCourse: false,
  },
  glutamate: {
    id: 'glutamate',
    name: 'Glutamate',
    nameRu: 'Глутамат',
    tier: 'standard',
    category: ['amino', 'neuroprotector'],
    forms: [
      { id: 'glutamate', name: 'Glutamate', nameRu: 'L-Глутамат 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES', 'MUSCLES'],
    systems: ['neuro'],
    mechanisms: ['NEUROTRANSMISSION', 'AMMONIA_DETOX', 'GABA_PRECURSOR', 'ENERGY_PRODUCTION'],
    description: 'Глутамат — заменимая аминокислота, главный возбуждающий нейромедиатор. В избытке — эксайтотоксичность.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Аммиак', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Эпилепсия', 'Нейродегенеративные заболевания'],
    sideEffects: ['Возбуждение при высоких дозах'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'L-Глутамат 500 мг' },
    bestForCourse: false,
  },
  alpha_ketoglutarate: {
    id: 'alpha_ketoglutarate',
    name: 'Alpha-Ketoglutarate',
    nameRu: 'Альфа-кетоглутарат',
    tier: 'standard',
    category: ['amino', 'metabolic'],
    forms: [
      { id: 'alpha_ketoglutarate', name: 'Alpha-Ketoglutarate', nameRu: 'Альфа-кетоглутарат 1 г', dose: '1 г 2x/д', best: true }
    ],
    organs: ['MUSCLES', 'LIVER', 'KIDNEYS'],
    systems: ['hepatic', 'renal'],
    mechanisms: ['KREBS_CYCLE_INTERMEDIATE', 'AMMONIA_DETOX', 'NITROGEN_TRANSPORT', 'ENERGY_PRODUCTION'],
    description: 'Альфа-кетоглутарат — интермедиат цикла Кребса, снижает аммиак и поддерживает энергообмен. На курсе — детокс.',
    synergies: [
      { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Аммиак', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'Альфа-кетоглутарат 1 г' },
    bestForCourse: false,
  },
  reishi: {
    id: 'reishi',
    name: 'Reishi',
    nameRu: 'Рейши (Ганодерма)',
    tier: 'advanced',
    category: ['mushroom', 'adaptogen', 'immunomodulator'],
    forms: [
      { id: 'reishi', name: 'Reishi', nameRu: 'Рейши экстракт 1000 мг', dose: '1 г 2x/д', best: true },
      { id: 'reishi_2', name: 'Reishi', nameRu: 'Рейши + Кордицепс комплекс 500 мг', dose: '1 г', best: false }
    ],
    organs: ['LIVER', 'IMMUNE_SYSTEM', 'BRAIN'],
    systems: ['hepatic', 'immune', 'neuro'],
    mechanisms: ['IMMUNE_REGULATION', 'ANTI_INFLAMMATORY', 'LIVER_PROTECTION', 'STRESS_REDUCTION'],
    description: 'Рейши — король грибов, иммуномодулятор и адаптоген. Защищает печень, снижает воспаление и стресс на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)', 'Приём антикоагулянтов'],
    sideEffects: ['Редко: сухость во рту', 'Желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'экстракт рейши' },
    bestForCourse: false,
  },
  chaga: {
    id: 'chaga',
    name: 'Chaga',
    nameRu: 'Чага',
    tier: 'advanced',
    category: ['mushroom', 'antioxidant', 'immunomodulator'],
    forms: [
      { id: 'chaga', name: 'Chaga', nameRu: 'Чага экстракт 1000 мг', dose: '1 г 2x/д', best: true },
      { id: 'chaga_2', name: 'Chaga', nameRu: 'Чага порошок 2 г', dose: '1 г', best: false }
    ],
    organs: ['IMMUNE_SYSTEM', 'LIVER', 'GUT'],
    systems: ['hepatic', 'immune', 'gastrointestinal'],
    mechanisms: ['ANTIOXIDANT', 'IMMUNE_REGULATION', 'ANTI_INFLAMMATORY', 'DNA_PROTECTION'],
    description: 'Чага — мощный антиоксидант с высоким ORAC. Поддерживает иммунитет и защищает ДНК от повреждений на курсе.',
    synergies: [
      { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "lycopene", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "amino_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'экстракт чаги' },
    bestForCourse: false,
  },
  maitake: {
    id: 'maitake',
    name: 'Maitake',
    nameRu: 'Майтаке',
    tier: 'advanced',
    category: ['mushroom', 'immunomodulator', 'metabolic'],
    forms: [
      { id: 'maitake', name: 'Maitake', nameRu: 'Майтаке экстракт 1000 мг', dose: '1 г 2x/д', best: true }
    ],
    organs: ['IMMUNE_SYSTEM', 'PANCREAS', 'GUT'],
    systems: ['immune', 'metabolic'],
    mechanisms: ['IMMUNE_ACTIVATION', 'GLUCOSE_REGULATION', 'BETA_GLUCAN_DELIVERY', 'ANTI_INFLAMMATORY'],
    description: 'Майтаке — гриб с высоким содержанием бета-глюканов, активирует иммунитет и регулирует глюкозу. На курсе — метаболическая поддержка.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'экстракт майтаке' },
    bestForCourse: false,
  },
  shiitake: {
    id: 'shiitake',
    name: 'Shiitake',
    nameRu: 'Шиитаке',
    tier: 'advanced',
    category: ['mushroom', 'immunomodulator', 'cardioprotector'],
    forms: [
      { id: 'shiitake', name: 'Shiitake', nameRu: 'Шиитаке экстракт 1000 мг', dose: '1 г 2x/д', best: true }
    ],
    organs: ['IMMUNE_SYSTEM', 'HEART', 'LIVER'],
    systems: ['immune', 'cardio', 'hepatic'],
    mechanisms: ['IMMUNE_REGULATION', 'CHOLESTEROL_LOWERING', 'B_VITAMIN_SOURCE', 'LIVER_PROTECTION'],
    description: 'Шиитаке — гриб с лентинаном, снижает холестерин и поддерживает иммунитет. Источник витаминов группы В.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: кожная сыпь'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'экстракт шиитаке' },
    bestForCourse: false,
  },
  mushroom_complex: {
    id: 'mushroom_complex',
    name: 'Mushroom Complex',
    nameRu: 'Грибной комплекс',
    tier: 'advanced',
    category: ['mushroom', 'adaptogen', 'immunomodulator'],
    forms: [
      { id: 'mushroom_complex', name: 'Mushroom Complex', nameRu: 'Грибной комплекс 1000 мг', dose: '1 г 2x/д', best: true },
      { id: 'mushroom_complex_2', name: 'Mushroom Complex', nameRu: 'Грибной комплекс 6-в-1 500 мг', dose: '1 г', best: false }
    ],
    organs: ['IMMUNE_SYSTEM', 'LIVER', 'BRAIN'],
    systems: ['immune', 'hepatic', 'neuro'],
    mechanisms: ['IMMUNE_REGULATION', 'STRESS_ADAPTATION', 'ANTI_INFLAMMATORY', 'NEUROPROTECTION'],
    description: 'Грибной комплекс — комбинация 6+ лекарственных грибов (рейши, чага, кордицепс, майтаке, шиитаке, хвост индейки). Комплексная поддержка.',
    synergies: [
      { with: "omega9", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "egcg", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "mushroom_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'грибной комплекс экстракт' },
    bestForCourse: false,
  },
  agaricus: {
    id: 'agaricus',
    name: 'Agaricus',
    nameRu: 'Агарикус (Бразильский гриб)',
    tier: 'advanced',
    category: ['mushroom', 'immunomodulator'],
    forms: [
      { id: 'agaricus', name: 'Agaricus', nameRu: 'Агарикус экстракт 1000 мг', dose: '1 г 2x/д', best: true }
    ],
    organs: ['IMMUNE_SYSTEM', 'LIVER', 'GUT'],
    systems: ['immune', 'hepatic', 'gastrointestinal'],
    mechanisms: ['IMMUNE_ACTIVATION', 'BETA_GLUCAN_DELIVERY', 'LIVER_PROTECTION', 'ANTI_INFLAMMATORY'],
    description: 'Агарикус — бразильский гриб с мощными бета-глюканами, активирует NK-клетки и макрофаги. Поддержка иммунитета на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'экстракт агарикуса' },
    bestForCourse: false,
  },
  turkey_tail: {
    id: 'turkey_tail',
    name: 'Turkey Tail',
    nameRu: 'Хвост индейки (Траметес)',
    tier: 'advanced',
    category: ['mushroom', 'immunomodulator'],
    forms: [
      { id: 'turkey_tail', name: 'Turkey Tail', nameRu: 'Хвост индейки экстракт 1000 мг', dose: '1 г 2x/д', best: true }
    ],
    organs: ['IMMUNE_SYSTEM', 'GUT', 'LIVER'],
    systems: ['immune', 'gastrointestinal', 'hepatic'],
    mechanisms: ['IMMUNE_REGULATION', 'BETA_GLUCAN_DELIVERY', 'GUT_MICROBIOME_SUPPORT', 'ANTI_INFLAMMATORY'],
    description: 'Хвост индейки — мощный иммуномодулятор с PSP и PSK полисахаридами. Поддержка кишечника и иммунитета на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'экстракт хвоста индейки' },
    bestForCourse: false,
  },
  lutein: {
    id: 'lutein',
    name: 'Lutein',
    nameRu: 'Лютеин',
    tier: 'standard',
    category: ['antioxidant', 'eye_protector'],
    forms: [
      { id: 'lutein', name: 'Lutein', nameRu: 'Лютеин 20 мг', dose: '20 мг 2x/д', best: true },
      { id: 'lutein_2', name: 'Lutein', nameRu: 'Лютеин + Зеаксантин 20 мг', dose: '20 мг', best: false }
    ],
    organs: ['EYES', 'BRAIN', 'SKIN'],
    systems: ['neuro'],
    mechanisms: ['MACULA_PROTECTION', 'BLUE_LIGHT_FILTER', 'ANTIOXIDANT', 'SKIN_HEALTH'],
    description: 'Лютеин — каротиноид, защищает макулу глаза от синего света и окислительного стресса. На курсе — защита зрения.',
    synergies: [
      { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Офтальмолог', when: 'Каждые 12 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: кожный зуд при высоких дозах'],
    dosage: { mg: 20, timing: 'с едой 1x/д', form: 'лютеин 20 мг' },
    bestForCourse: false,
  },
  lycopene: {
    id: 'lycopene',
    name: 'Lycopene',
    nameRu: 'Ликопин',
    tier: 'standard',
    category: ['antioxidant', 'cardioprotector'],
    forms: [
      { id: 'lycopene', name: 'Lycopene', nameRu: 'Ликопин 15 мг', dose: '15 мг 2x/д', best: true },
      { id: 'lycopene_2', name: 'Lycopene', nameRu: 'Ликопин + Селен 15 мг', dose: '15 мг', best: false }
    ],
    organs: ['HEART', 'PROSTATE', 'SKIN'],
    systems: ['cardio', 'reproductive'],
    mechanisms: ['ANTIOXIDANT', 'PROSTATE_PROTECTION', 'UV_PROTECTION', 'CHOLESTEROL_LOWERING'],
    description: 'Ликопин — каротиноид из томатов, мощный антиоксидант. Защищает простату и сердце, снижает окислительный стресс.',
    synergies: [
      { with: "astaxanthin", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "chaga", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "amino_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "olive_extract", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "flavonoids", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'ПСА', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Лycopin аллергия'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 15, timing: 'с едой 1x/д', form: 'ликопин 15 мг' },
    bestForCourse: false,
  },
  anthocyanins: {
    id: 'anthocyanins',
    name: 'Anthocyanins',
    nameRu: 'Антоцианы',
    tier: 'standard',
    category: ['antioxidant', 'eye_protector'],
    forms: [
      { id: 'anthocyanins', name: 'Anthocyanins', nameRu: 'Антоцианы экстракт 200 мг', dose: '200 мг 2x/д', best: true },
      { id: 'anthocyanins_2', name: 'Anthocyanins', nameRu: 'Черника + Лютеин комплекс', dose: '200 мг', best: false }
    ],
    organs: ['EYES', 'HEART', 'BRAIN'],
    systems: ['cardio', 'neuro'],
    mechanisms: ['ANTIOXIDANT', 'MICROCIRCULATION_IMPROVEMENT', 'VISION_SUPPORT', 'ANTI_INFLAMMATORY'],
    description: 'Антоцианы — флавоноиды из ягод, улучшают микроциркуляцию и защищают сосуды сетчатки. На курсе — зрение и сосуды.',
    synergies: [
      { with: "vitamin_c", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "quercetin", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "anthocyanins", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Офтальмолог', when: 'Каждые 12 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: аллергия'],
    dosage: { mg: 200, timing: 'с едой 1x/д', form: 'антоцианы экстракт 200 мг' },
    bestForCourse: false,
  },
  grape_seed_extract: {
    id: 'grape_seed_extract',
    name: 'Grape Seed Extract',
    nameRu: 'Экстракт косточек винограда',
    tier: 'standard',
    category: ['antioxidant', 'cardioprotector'],
    forms: [
      { id: 'grape_seed_extract', name: 'Grape Seed Extract', nameRu: 'Экстракт косточек винограда 200 мг', dose: '200 мг 2x/д', best: true }
    ],
    organs: ['HEART', 'BLOOD_VESSELS', 'SKIN'],
    systems: ['cardio'],
    mechanisms: ['ANTIOXIDANT', 'ENDOTHELIAL_PROTECTION', 'COLLAGEN_SYNTHESIS', 'MICROCIRCULATION'],
    description: 'Экстракт косточек винограда — богат проантоцианидинами, защищает эндотелий и коллаген. На курсе — сосуды и кожа.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 200, timing: 'с едой 1x/д', form: 'экстракт косточек винограда 200 мг' },
    bestForCourse: false,
  },
  pycnogenol: {
    id: 'pycnogenol',
    name: 'Pycnogenol',
    nameRu: 'Пикногенол',
    tier: 'standard',
    category: ['antioxidant', 'cardioprotector'],
    forms: [
      { id: 'pycnogenol', name: 'Pycnogenol', nameRu: 'Пикногенол 100 мг', dose: '100 мг 2x/д', best: true }
    ],
    organs: ['HEART', 'BLOOD_VESSELS', 'SKIN'],
    systems: ['cardio', 'neuro'],
    mechanisms: ['ANTIOXIDANT', 'ENDOTHELIAL_PROTECTION', 'COLLAGEN_PROTECTION', 'MICROCIRCULATION'],
    description: 'Пикногенол — экстракт коры приморской сосны, мощный антиоксидант. Защищает сосуды, кожу и эндотелий.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 100, timing: 'с едой 1x/д', form: 'пикногенол 100 мг' },
    bestForCourse: false,
  },
  cocoa_flavanols: {
    id: 'cocoa_flavanols',
    name: 'Cocoa Flavanols',
    nameRu: 'Какао-флаванолы',
    tier: 'standard',
    category: ['antioxidant', 'cardioprotector'],
    forms: [
      { id: 'cocoa_flavanols', name: 'Cocoa Flavanols', nameRu: 'Какао-флаванолы 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['HEART', 'BRAIN', 'BLOOD_VESSELS'],
    systems: ['cardio', 'neuro'],
    mechanisms: ['ANTIOXIDANT', 'NITRIC_OXIDE_PRODUCTION', 'BLOOD_FLOW_IMPROVEMENT', 'COGNITION_ENHANCEMENT'],
    description: 'Какао-флаванолы — улучшают производство NO, кровоток мозга и сердца. На курсе — кардио- и нейропротекция.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: аллергия на какао'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'какао-флаванолы 500 мг' },
    bestForCourse: false,
  },
  c60: {
    id: 'c60',
    name: 'C60',
    nameRu: 'C60 (Фуллерен)',
    tier: 'advanced',
    category: ['antioxidant', 'anti_aging'],
    forms: [
      { id: 'c60', name: 'C60', nameRu: 'C60 в оливковом масле 1 мг', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['CELLS', 'MITOCHONDRIA', 'LIVER'],
    systems: ['hepatic'],
    mechanisms: ['ANTIOXIDANT', 'MITOCHONDRIAL_PROTECTION', 'ANTI_INFLAMMATORY', 'ANTI_AGING'],
    description: 'C60 фуллерен — наночастица с мощнейшей антиоксидантной активностью, защищает митохондрии. Экспериментальный анти-возрастной.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Окислительный стресс', when: 'Субъективно' }
    ],
    contraindications: ['Беременность', 'Недостаточно данных'],
    sideEffects: ['Недостаточно данных по долгосрочной безопасности'],
    dosage: { mg: 1, timing: 'с едой 1x/д', form: 'C60 в оливковом масле 1 мг' },
    bestForCourse: false,
  },
  antioxidant_complex: {
    id: 'antioxidant_complex',
    name: 'Antioxidant Complex',
    nameRu: 'Антиоксидантный комплекс',
    tier: 'standard',
    category: ['antioxidant', 'anti_aging'],
    forms: [
      { id: 'antioxidant_complex', name: 'Antioxidant Complex', nameRu: 'Антиоксидантный комплекс 1 капсула', dose: '1 мг 2x/д', best: true },
      { id: 'antioxidant_complex_2', name: 'Antioxidant Complex', nameRu: 'Антиоксидантный комплекс форте', dose: '1 мг', best: false }
    ],
    organs: ['CELLS', 'LIVER', 'HEART'],
    systems: ['hepatic', 'cardio'],
    mechanisms: ['ANTIOXIDANT_NETWORK', 'OXIDATIVE_STRESS_REDUCTION', 'CELL_PROTECTION', 'ANTI_AGING'],
    description: 'Антиоксидантный комплекс — комбинация витаминов С, Е, А, селена, АЛЬК для комплексной антиоксидантной защиты.',
    synergies: [
      { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Окислительный стресс', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1, timing: 'с едой 1x/д', form: 'антиоксидантный комплекс капсула' },
    bestForCourse: false,
  },
  nrf2_activator: {
    id: 'nrf2_activator',
    name: 'Nrf2 Activator',
    nameRu: 'Nrf2-активатор',
    tier: 'advanced',
    category: ['antioxidant', 'hepatoprotector'],
    forms: [
      { id: 'nrf2_activator', name: 'Nrf2 Activator', nameRu: 'Nrf2-активатор 20 мг', dose: '20 мг 2x/д', best: true }
    ],
    organs: ['LIVER', 'CELLS', 'BRAIN'],
    systems: ['hepatic', 'neuro'],
    mechanisms: ['NRF2_ACTIVATION', 'ANTIOXIDANT_ENZYME_INDUCTION', 'DETOXIFICATION', 'ANTI_INFLAMMATORY'],
    description: 'Nrf2-активатор (сульфорафан+куркумин) — индуцирует антиоксидантные ферменты через Nrf2-путь. Мощная гепатопротекция.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 20, timing: 'с едой 1x/д', form: 'Nrf2-активатор 20 мг' },
    bestForCourse: false,
  },
  olive_extract: {
    id: 'olive_extract',
    name: 'Olive Extract',
    nameRu: 'Экстракт оливы (гидрокситирозол)',
    tier: 'standard',
    category: ['antioxidant', 'cardioprotector'],
    forms: [
      { id: 'olive_extract', name: 'Olive Extract', nameRu: 'Экстракт оливы 250 мг', dose: '250 мг 2x/д', best: true }
    ],
    organs: ['HEART', 'BLOOD_VESSELS', 'SKIN'],
    systems: ['cardio'],
    mechanisms: ['ANTIOXIDANT', 'ENDOTHELIAL_PROTECTION', 'ANTI_INFLAMMATORY', 'LIPID_IMPROVEMENT'],
    description: 'Экстракт оливы с гидрокситирозолом — мощный антиоксидант, защищает эндотелий и снижает окисление ЛПНП.',
    synergies: [
      { with: "lycopene", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "flavonoids", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "olive_extract", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 250, timing: 'с едой 1x/д', form: 'экстракт оливы 250 мг' },
    bestForCourse: false,
  },
  polyphenol_complex: {
    id: 'polyphenol_complex',
    name: 'Polyphenol Complex',
    nameRu: 'Полифенольный комплекс',
    tier: 'standard',
    category: ['antioxidant', 'cardioprotector'],
    forms: [
      { id: 'polyphenol_complex', name: 'Polyphenol Complex', nameRu: 'Полифенольный комплекс 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['HEART', 'BRAIN', 'BLOOD_VESSELS'],
    systems: ['cardio', 'neuro'],
    mechanisms: ['ANTIOXIDANT', 'ANTI_INFLAMMATORY', 'MICROCIRCULATION', 'BRAIN_PROTECTION'],
    description: 'Полифенольный комплекс — комбинация 10+ полифенолов для сосудистой и нейропротекции. На курсе — антиоксидантный щит.',
    synergies: [
      { with: "lycopene", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "chaga", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "amino_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "olive_extract", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "flavonoids", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega9", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "egcg", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "mushroom_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'полифенольный комплекс 500 мг' },
    bestForCourse: false,
  },
  citrus_bioflavonoids: {
    id: 'citrus_bioflavonoids',
    name: 'Citrus Bioflavonoids',
    nameRu: 'Цитрусовые биофлавоноиды',
    tier: 'standard',
    category: ['antioxidant', 'cardioprotector'],
    forms: [
      { id: 'citrus_bioflavonoids', name: 'Citrus Bioflavonoids', nameRu: 'Цитрусовые биофлавоноиды 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['BLOOD_VESSELS', 'EYES', 'SKIN'],
    systems: ['cardio'],
    mechanisms: ['ANTIOXIDANT', 'VITAMIN_C_POTENTIATION', 'MICROCIRCULATION', 'ANTI_INFLAMMATORY'],
    description: 'Цитрусовые биофлавоноиды — гесперидин, рутин, нарингенин. Усиливают витамин С, защищают сосуды.',
    synergies: [],
    conflicts: [
      { with: "statin_drugs", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: аллергия на цитрусовые'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'цитрусовые биофлавоноиды 500 мг' },
    bestForCourse: false,
  },
  flavonoids: {
    id: 'flavonoids',
    name: 'Flavonoids',
    nameRu: 'Флавоноиды',
    tier: 'standard',
    category: ['antioxidant', 'cardioprotector'],
    forms: [
      { id: 'flavonoids', name: 'Flavonoids', nameRu: 'Флавоноиды комплекс 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['HEART', 'BRAIN', 'BLOOD_VESSELS'],
    systems: ['cardio', 'neuro'],
    mechanisms: ['ANTIOXIDANT', 'ANTI_INFLAMMATORY', 'VASCULAR_PROTECTION', 'COGNITION_SUPPORT'],
    description: 'Флавоноиды — класс полифенолов с антиоксидантным и противовоспалительным действием. Защита сосудов и мозга.',
    synergies: [
      { with: "lycopene", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "olive_extract", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'флавоноиды комплекс 500 мг' },
    bestForCourse: false,
  },
  ellagic_acid: {
    id: 'ellagic_acid',
    name: 'Ellagic Acid',
    nameRu: 'Эллаговая кислота',
    tier: 'standard',
    category: ['antioxidant', 'hepatoprotector'],
    forms: [
      { id: 'ellagic_acid', name: 'Ellagic Acid', nameRu: 'Эллаговая кислота 250 мг', dose: '250 мг 2x/д', best: true }
    ],
    organs: ['LIVER', 'CELLS', 'GUT'],
    systems: ['hepatic', 'gastrointestinal'],
    mechanisms: ['ANTIOXIDANT', 'LIVER_DETOXIFICATION', 'ANTI_MUTAGENIC', 'ANTI_INFLAMMATORY'],
    description: 'Эллаговая кислота — полифенол из граната и малины, гепатопротектор и антимутаген. Защищает печень и ДНК.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 250, timing: 'с едой 1x/д', form: 'эллаговая кислота 250 мг' },
    bestForCourse: false,
  },
  ursolic_acid: {
    id: 'ursolic_acid',
    name: 'Ursolic Acid',
    nameRu: 'Урсоловая кислота',
    tier: 'advanced',
    category: ['antioxidant', 'metabolic'],
    forms: [
      { id: 'ursolic_acid', name: 'Ursolic Acid', nameRu: 'Урсоловая кислота 150 мг', dose: '150 мг 2x/д', best: true }
    ],
    organs: ['MUSCLES', 'LIVER', 'SKIN'],
    systems: ['musculoskeletal', 'hepatic'],
    mechanisms: ['ANTI_INFLAMMATORY', 'MUSCLE_GROWTH', 'LIPID_LOWERING', 'ANTI_CATABOLIC'],
    description: 'Урсоловая кислота — тритерпен из яблочных шкурок, антикатаболическое и антивоспалительное действие. Поддержка мышц.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'КФК', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 150, timing: 'с едой 2x/д', form: 'урсоловая кислота 150 мг' },
    bestForCourse: false,
  },
  magnolia: {
    id: 'magnolia',
    name: 'Magnolia',
    nameRu: 'Магнолия (хонокиол)',
    tier: 'advanced',
    category: ['anxiolytic', 'neuroprotector'],
    forms: [
      { id: 'magnolia', name: 'Magnolia', nameRu: 'Экстракт магнолии 200 мг', dose: '200 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES', 'LIVER'],
    systems: ['neuro', 'hepatic'],
    mechanisms: ['ANXIOLYTIC', 'MUSCLE_RELAXATION', 'NEUROPROTECTION', 'LIVER_PROTECTION'],
    description: 'Магнолия (хонокиол) — анксиолитик и нейропротектор, расслабляет мышцы и улучшает сон. На курсе — антистресс.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Седативные препараты (усиление)'],
    sideEffects: ['Сонливость при начале'],
    dosage: { mg: 200, timing: 'на ночь 1x/д', form: 'экстракт магнолии 200 мг' },
    bestForCourse: false,
  },
  gentian: {
    id: 'gentian',
    name: 'Gentian',
    nameRu: 'Горечавка',
    tier: 'standard',
    category: ['gastrointestinal', 'hepatoprotector'],
    forms: [
      { id: 'gentian', name: 'Gentian', nameRu: 'Экстракт горечавки 250 мг', dose: '250 мг 2x/д', best: true }
    ],
    organs: ['LIVER', 'GUT', 'STOMACH'],
    systems: ['hepatic', 'gastrointestinal'],
    mechanisms: ['DIGESTION_STIMULATION', 'BILE_SECRETION', 'APPETITE_IMPROVEMENT', 'LIVER_PROTECTION'],
    description: 'Горечавка — горький тоник, стимулирует пищеварение и желчеотток. Улучшает аппетит и усвоение на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Пищеварение', when: 'Субъективно' }
    ],
    contraindications: ['Язвенная болезнь'],
    sideEffects: ['Редко: изжога при избытке'],
    dosage: { mg: 250, timing: 'за 15 мин до еды', form: 'экстракт горечавки 250 мг' },
    bestForCourse: false,
  },
  artichoke: {
    id: 'artichoke',
    name: 'Artichoke',
    nameRu: 'Артишок',
    tier: 'standard',
    category: ['hepatoprotector', 'gastrointestinal'],
    forms: [
      { id: 'artichoke', name: 'Artichoke', nameRu: 'Экстракт артишока 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'artichoke_2', name: 'Artichoke', nameRu: 'Артишок + Расторопша комплекс', dose: '500 мг', best: false }
    ],
    organs: ['LIVER', 'GALLBLADDER', 'GUT'],
    systems: ['hepatic', 'gastrointestinal'],
    mechanisms: ['BILE_SECRETION', 'LIVER_PROTECTION', 'CHOLESTEROL_LOWERING', 'DETOXIFICATION'],
    description: 'Артишок — гепатопротектор и холеретик, стимулирует желчеотток и защищает печень. На курсе — защита печени.',
    synergies: [
      { with: "milk_thistle", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Желчнокаменная болезнь'],
    sideEffects: ['Редко: метеоризм'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт артишока 500 мг' },
    bestForCourse: false,
  },
  garlic: {
    id: 'garlic',
    name: 'Garlic',
    nameRu: 'Чеснок (аллицин)',
    tier: 'standard',
    category: ['cardioprotector', 'antioxidant'],
    forms: [
      { id: 'garlic', name: 'Garlic', nameRu: 'Чесночный экстракт 1000 мг', dose: '1 г 2x/д', best: true },
      { id: 'garlic_2', name: 'Garlic', nameRu: 'Аллицин 600 мг', dose: '1 г', best: false }
    ],
    organs: ['HEART', 'BLOOD_VESSELS', 'IMMUNE_SYSTEM'],
    systems: ['cardio', 'immune'],
    mechanisms: ['CHOLESTEROL_LOWERING', 'ANTI_INFLAMMATORY', 'ANTIMICROBIAL', 'BLOOD_PRESSURE_REGULATION'],
    description: 'Чеснок (аллицин) — кардиопротектор, снижает холестерин и АД, антимикробное действие. На курсе — сосуды и иммунитет.',
    synergies: [],
    conflicts: [
      { with: "anticoagulant_drugs", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Запах изо рта', 'Желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 1x/д', form: 'чесночный экстракт 1000 мг' },
    bestForCourse: false,
  },
  mangosteen: {
    id: 'mangosteen',
    name: 'Mangosteen',
    nameRu: 'Мангостин',
    tier: 'standard',
    category: ['antioxidant', 'anti_aging'],
    forms: [
      { id: 'mangosteen', name: 'Mangosteen', nameRu: 'Экстракт мангостина 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['SKIN', 'IMMUNE_SYSTEM', 'GUT'],
    systems: ['immune', 'gastrointestinal'],
    mechanisms: ['ANTIOXIDANT', 'ANTI_INFLAMMATORY', 'SKIN_HEALTH', 'IMMUNE_REGULATION'],
    description: 'Мангостин — источник ксантонов, мощных антиоксидантов. Противовоспалительное и антиоксидантное действие.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Окислительный стресс', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: аллергия'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'экстракт мангостина 500 мг' },
    bestForCourse: false,
  },
  nattokinase: {
    id: 'nattokinase',
    name: 'Nattokinase',
    nameRu: 'Наттокиназа',
    tier: 'standard',
    category: ['cardioprotector', 'anticoagulant'],
    forms: [
      { id: 'nattokinase', name: 'Nattokinase', nameRu: 'Наттокиназа 2000 FU', dose: '2 г 2x/д', best: true },
      { id: 'nattokinase_2', name: 'Nattokinase', nameRu: 'Наттокиназа + Омега-3 комплекс', dose: '2 г', best: false }
    ],
    organs: ['HEART', 'BLOOD_VESSELS', 'BRAIN'],
    systems: ['cardio'],
    mechanisms: ['FIBRINOLYSIS', 'BLOOD_THINNING', 'MICROCIRCULATION', 'THROMBUS_PREVENTION'],
    description: 'Наттокиназа — фермент из натто, растворяет фибрин и предотвращает тромбы. На курсе — защита сосудов.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Фибриноген', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Приём антикоагулянтов', 'Язвенная болезнь'],
    sideEffects: ['Редко: кровотечение при высоких дозах'],
    dosage: { mg: 2000, timing: 'натощак 1x/д', form: 'наттокиназа 2000 FU' },
    bestForCourse: false,
  },
  grapefruit_seed: {
    id: 'grapefruit_seed',
    name: 'Grapefruit Seed',
    nameRu: 'Экстракт грейпфрутовых косточек',
    tier: 'standard',
    category: ['antimicrobial', 'immunomodulator'],
    forms: [
      { id: 'grapefruit_seed', name: 'Grapefruit Seed', nameRu: 'Экстракт грейпфрутовых косточек 250 мг', dose: '250 мг 2x/д', best: true }
    ],
    organs: ['GUT', 'IMMUNE_SYSTEM', 'SKIN'],
    systems: ['gastrointestinal', 'immune'],
    mechanisms: ['ANTIMICROBIAL', 'ANTI_INFLAMMATORY', 'IMMUNE_REGULATION', 'GUT_FLORA_BALANCE'],
    description: 'Экстракт грейпфрутовых косточек — мощный антимикробный агент, поддерживает микрофлору кишечника и иммунитет.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Микрофлора', when: 'Субъективно' }
    ],
    contraindications: ['Приём иммуносупрессоров'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 250, timing: 'с едой 2x/д', form: 'экстракт грейпфрутовых косточек 250 мг' },
    bestForCourse: false,
  },
  nobiletin: {
    id: 'nobiletin',
    name: 'Nobiletin',
    nameRu: 'Нобилетин',
    tier: 'advanced',
    category: ['antioxidant', 'metabolic'],
    forms: [
      { id: 'nobiletin', name: 'Nobiletin', nameRu: 'Нобилетин 100 мг', dose: '100 мг 2x/д', best: true }
    ],
    organs: ['LIVER', 'BRAIN', 'CELLS'],
    systems: ['hepatic', 'metabolic'],
    mechanisms: ['CIRCADIAN_RHYTHM_REGULATION', 'METABOLIC_IMPROVEMENT', 'ANTI_INFLAMMATORY', 'ANTIOXIDANT'],
    description: 'Нобилетин — флавоноид из цитрусовых, регулирует циркадные ритмы и метаболизм. Антивоспалительное действие.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 100, timing: 'с едой 1x/д', form: 'нобилетин 100 мг' },
    bestForCourse: false,
  },
  fisetin: {
    id: 'fisetin',
    name: 'Fisetin',
    nameRu: 'Физетин',
    tier: 'advanced',
    category: ['antioxidant', 'anti_aging'],
    forms: [
      { id: 'fisetin', name: 'Fisetin', nameRu: 'Физетин 100 мг', dose: '100 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'CELLS', 'KIDNEYS'],
    systems: ['neuro', 'renal'],
    mechanisms: ['SENOLYTIC', 'ANTIOXIDANT', 'NEUROPROTECTION', 'ANTI_INFLAMMATORY'],
    description: 'Физетин — флавоноид с сенолитической активностью, избирательно удаляет стареющие клетки. Анти-возрастной.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Окислительный стресс', when: 'Субъективно' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 100, timing: 'с едой 2x/д', form: 'физетин 100 мг' },
    bestForCourse: false,
  },
  baicalin: {
    id: 'baicalin',
    name: 'Baicalin',
    nameRu: 'Байкалин',
    tier: 'advanced',
    category: ['antioxidant', 'neuroprotector'],
    forms: [
      { id: 'baicalin', name: 'Baicalin', nameRu: 'Байкалин 200 мг', dose: '200 мг 2x/д', best: true }
    ],
    organs: ['LIVER', 'BRAIN', 'NERVES'],
    systems: ['hepatic', 'neuro'],
    mechanisms: ['ANTI_INFLAMMATORY', 'NEUROPROTECTION', 'LIVER_PROTECTION', 'ANXIOLYTIC'],
    description: 'Байкалин — флавоноид из шлемника байкальского, нейропротектор и гепатопротектор. Успокаивает и защищает.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Седативные препараты (усиление)'],
    sideEffects: ['Сонливость при начале'],
    dosage: { mg: 200, timing: 'с едой 2x/д', form: 'байкалин 200 мг' },
    bestForCourse: false,
  },
  taxifolin: {
    id: 'taxifolin',
    name: 'Taxifolin',
    nameRu: 'Таксифолин (Дигидрокверцетин)',
    tier: 'advanced',
    category: ['antioxidant', 'cardioprotector'],
    forms: [
      { id: 'taxifolin', name: 'Taxifolin', nameRu: 'Таксифолин 100 мг', dose: '100 мг 2x/д', best: true },
      { id: 'taxifolin_2', name: 'Taxifolin', nameRu: 'Дигидрокверцетин 100 мг', dose: '100 мг', best: false }
    ],
    organs: ['HEART', 'LIVER', 'BLOOD_VESSELS'],
    systems: ['cardio', 'hepatic'],
    mechanisms: ['ANTIOXIDANT', 'ANTI_INFLAMMATORY', 'VASCULAR_PROTECTION', 'MITOCHONDRIAL_PROTECTION'],
    description: 'Таксифолин (дигидрокверцетин) — флавоноид из лиственницы, мощный антиоксидент. Защищает сосуды и митохондрии.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: аллергия'],
    dosage: { mg: 100, timing: 'с едой 1x/д', form: 'таксифолин 100 мг' },
    bestForCourse: false,
  },
  soy_isoflavones: {
    id: 'soy_isoflavones',
    name: 'Soy Isoflavones',
    nameRu: 'Соевые изофлавоны',
    tier: 'standard',
    category: ['hormonal', 'cardioprotector'],
    forms: [
      { id: 'soy_isoflavones', name: 'Soy Isoflavones', nameRu: 'Соевые изофлавоны 100 мг', dose: '100 мг 2x/д', best: true }
    ],
    organs: ['REPRODUCTIVE', 'HEART', 'BONES'],
    systems: ['reproductive', 'cardio'],
    mechanisms: ['PHYTOESTROGEN', 'BONE_PROTECTION', 'CHOLESTEROL_LOWERING', 'HOT_FLASH_REDUCTION'],
    description: 'Соевые изофлавоны — фитоэстрогены, облегчают симптомы менопаузы и защищают кости. На курсе — гормональный баланс.',
    synergies: [
      { with: "holy_basil", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Эстрадиол', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Эстроген-зависимые опухоли'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 100, timing: 'с едой 1x/д', form: 'соевые изофлавоны 100 мг' },
    bestForCourse: false,
  },
  rosemary: {
    id: 'rosemary',
    name: 'Rosemary',
    nameRu: 'Розмарин (карнозиновая кислота)',
    tier: 'standard',
    category: ['antioxidant', 'neuroprotector'],
    forms: [
      { id: 'rosemary', name: 'Rosemary', nameRu: 'Экстракт розмарина 200 мг', dose: '200 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'LIVER', 'HEART'],
    systems: ['neuro', 'hepatic'],
    mechanisms: ['ANTIOXIDANT', 'NEUROPROTECTION', 'LIVER_PROTECTION', 'ANTI_INFLAMMATORY'],
    description: 'Розмарин (карнозиновая кислота) — мощный антиоксидант и нейропротектор. Улучшает память и защищает мозг.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: аллергия'],
    dosage: { mg: 200, timing: 'с едой 1x/д', form: 'экстракт розмарина 200 мг' },
    bestForCourse: false,
  },
  cinnamon: {
    id: 'cinnamon',
    name: 'Cinnamon',
    nameRu: 'Корица (коричный альдегид)',
    tier: 'standard',
    category: ['metabolic', 'antioxidant'],
    forms: [
      { id: 'cinnamon', name: 'Cinnamon', nameRu: 'Корица экстракт 1000 мг', dose: '1 г 2x/д', best: true },
      { id: 'cinnamon_2', name: 'Cinnamon', nameRu: 'Корица + Хром комплекс', dose: '1 г', best: false }
    ],
    organs: ['PANCREAS', 'LIVER', 'BLOOD_VESSELS'],
    systems: ['metabolic', 'hepatic'],
    mechanisms: ['INSULIN_SENSITIVITY', 'GLUCOSE_LOWERING', 'ANTI_INFLAMMATORY', 'ANTIMICROBIAL'],
    description: 'Корица — улучшает чувствительность к инсулину и снижает глюкозу. На курсе — метаболическая поддержка.',
    synergies: [
      { with: "berberine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Заболевания печени (кассия)'],
    sideEffects: ['Редко: аллергия', 'Раздражение слизистой'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'корица экстракт 1000 мг' },
    bestForCourse: false,
  },
  pomegranate: {
    id: 'pomegranate',
    name: 'Pomegranate',
    nameRu: 'Гранат (эллаговая кислота)',
    tier: 'standard',
    category: ['antioxidant', 'cardioprotector'],
    forms: [
      { id: 'pomegranate', name: 'Pomegranate', nameRu: 'Экстракт граната 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'pomegranate_2', name: 'Pomegranate', nameRu: 'Гранат + Омега-3 комплекс', dose: '500 мг', best: false }
    ],
    organs: ['HEART', 'BLOOD_VESSELS', 'REPRODUCTIVE'],
    systems: ['cardio', 'reproductive'],
    mechanisms: ['ANTIOXIDANT', 'NITRIC_OXIDE_PRODUCTION', 'PROSTATE_PROTECTION', 'ANTI_INFLAMMATORY'],
    description: 'Гранат — богат эллаготаннинами, улучшает NO-продукцию и защищает простату. Кардиопротекция на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'ПСА', when: 'Каждые 12 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: аллергия'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'экстракт граната 500 мг' },
    bestForCourse: false,
  },
  cranberry: {
    id: 'cranberry',
    name: 'Cranberry',
    nameRu: 'Клюква (проантоцианидины)',
    tier: 'standard',
    category: ['antioxidant', 'urinary_protector'],
    forms: [
      { id: 'cranberry', name: 'Cranberry', nameRu: 'Экстракт клюквы 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'cranberry_2', name: 'Cranberry', nameRu: 'Клюква + D-манноза комплекс', dose: '500 мг', best: false }
    ],
    organs: ['URINARY_TRACT', 'HEART', 'GUT'],
    systems: ['renal', 'cardio'],
    mechanisms: ['UTI_PREVENTION', 'ANTIOXIDANT', 'ANTI_INFLAMMATORY', 'MICROCIRCULATION'],
    description: 'Клюква — проантоцианидины предотвращают ИМП, антиоксидантная и противовоспалительная защита. На курсе — почки и МП.',
    synergies: [
      { with: "cranberry", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "probiotics", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Общий анализ мочи', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Оксалатные камни (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт клюквы 500 мг' },
    bestForCourse: false,
  },
  urolithin_a: {
    id: 'urolithin_a',
    name: 'Urolithin A',
    nameRu: 'Уролитин А',
    tier: 'advanced',
    category: ['anti_aging', 'mitochondrial'],
    forms: [
      { id: 'urolithin_a', name: 'Urolithin A', nameRu: 'Уролитин А 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['MUSCLES', 'MITOCHONDRIA', 'BRAIN'],
    systems: ['musculoskeletal', 'neuro'],
    mechanisms: ['MITOPHAGY_ACTIVATION', 'MITOCHONDRIAL_BIOGENESIS', 'MUSCLE_FUNCTION', 'ANTI_AGING'],
    description: 'Уролитин А — метаболит эллаготаннинов, активирует митофагию (очистку митохондрий). Анти-возрастной и мышечная поддержка.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'КФК', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'уролитин А 500 мг' },
    bestForCourse: false,
  },
  bile_acids: {
    id: 'bile_acids',
    name: 'Bile Acids',
    nameRu: 'Жёлчные кислоты (урсодезоксихолевая)',
    tier: 'standard',
    category: ['hepatoprotector', 'gastrointestinal'],
    forms: [
      { id: 'bile_acids', name: 'Bile Acids', nameRu: 'УДХК 250 мг', dose: '250 мг 2x/д', best: true },
      { id: 'bile_acids_2', name: 'Bile Acids', nameRu: 'УДХК 500 мг', dose: '250 мг', best: false }
    ],
    organs: ['LIVER', 'GALLBLADDER', 'GUT'],
    systems: ['hepatic', 'gastrointestinal'],
    mechanisms: ['BILE_FLOW_STIMULATION', 'CHOLESTEROL_SOLUBILIZATION', 'LIVER_PROTECTION', 'GALLSTONE_PREVENTION'],
    description: 'Жёлчные кислоты (УДХК) — стимулируют желчеотток, растворяют камни, защищают печень. На курсе — гепатопротекция.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Желчнокаменная болезнь (острая)'],
    sideEffects: ['Диарея при начале'],
    dosage: { mg: 250, timing: 'с едой 2x/д', form: 'урсодезоксихолевая кислота 250 мг' },
    bestForCourse: false,
  },
  piracetam: {
    id: 'piracetam',
    name: 'Piracetam',
    nameRu: 'Пирацетам',
    tier: 'standard',
    category: ['nootropic', 'neuroprotector'],
    forms: [
      { id: 'piracetam', name: 'Piracetam', nameRu: 'Пирацетам 800 мг', dose: '1.6 г 2x/д', best: true },
      { id: 'piracetam_2', name: 'Piracetam', nameRu: 'Пирацетам 1200 мг', dose: '1.6 г', best: false }
    ],
    organs: ['BRAIN', 'NERVES', 'BLOOD'],
    systems: ['neuro'],
    mechanisms: ['ACETYLCHOLINE_MODULATION', 'NEUROPROTECTION', 'MEMORY_ENHANCEMENT', 'MICROCIRCULATION'],
    description: 'Пирацетам — классический ноотроп, улучшает память, концентрацию и мозговой кровоток. На курсе — нейропротекция.',
    synergies: [
      { with: "caffeine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Геморрагический инсульт (острый)'],
    sideEffects: ['Редко: возбуждение', 'Головная боль при начале'],
    dosage: { mg: 1600, timing: 'с едой 2x/д', form: 'пирацетам 800 мг' },
    bestForCourse: false,
  },
  aniracetam: {
    id: 'aniracetam',
    name: 'Aniracetam',
    nameRu: 'Анирацетам',
    tier: 'advanced',
    category: ['nootropic', 'anxiolytic'],
    forms: [
      { id: 'aniracetam', name: 'Aniracetam', nameRu: 'Анирацетам 750 мг', dose: '750 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['ACETYLCHOLINE_MODULATION', 'ANXIOLYTIC', 'MEMORY_ENHANCEMENT', 'CREATIVITY_BOOST'],
    description: 'Анирацетам — ноотроп с анксиолитическим действием, улучшает память и снижает тревожность. На курсе — антистресс.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Тяжёлая печёночная недостаточность'],
    sideEffects: ['Редко: головная боль'],
    dosage: { mg: 750, timing: 'с едой 2x/д', form: 'анирацетам 750 мг' },
    bestForCourse: false,
  },
  oxiracetam: {
    id: 'oxiracetam',
    name: 'Oxiracetam',
    nameRu: 'Оксирацетам',
    tier: 'advanced',
    category: ['nootropic', 'neuroprotector'],
    forms: [
      { id: 'oxiracetam', name: 'Oxiracetam', nameRu: 'Оксирацетам 800 мг', dose: '800 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['MEMORY_ENHANCEMENT', 'NEUROPROTECTION', 'FOCUS_IMPROVEMENT', 'ENERGY_BOOST'],
    description: 'Оксирацетам — стимулирующий ноотроп, улучшает память и фокус. На курсе — концентрация при тренировках.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: бессонница при вечернем приёме'],
    dosage: { mg: 800, timing: 'с едой 2x/д', form: 'оксирацетам 800 мг' },
    bestForCourse: false,
  },
  pramiracetam: {
    id: 'pramiracetam',
    name: 'Pramiracetam',
    nameRu: 'Прамирацетам',
    tier: 'advanced',
    category: ['nootropic'],
    forms: [
      { id: 'pramiracetam', name: 'Pramiracetam', nameRu: 'Прамирацетам 400 мг', dose: '400 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['MEMORY_ENHANCEMENT', 'FOCUS_IMPROVEMENT', 'ACETYLCHOLINE_MODULATION', 'LEARNING_BOOST'],
    description: 'Прамирацетам — мощный ноотроп, в 10-30 раз сильнее пирацетама. Улучшает память и обучение на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: головная боль', 'Раздражительность'],
    dosage: { mg: 400, timing: 'с едой 2x/д', form: 'прамирацетам 400 мг' },
    bestForCourse: false,
  },
  fasoracetam: {
    id: 'fasoracetam',
    name: 'Fasoracetam',
    nameRu: 'Фасорацетам',
    tier: 'advanced',
    category: ['nootropic', 'anxiolytic'],
    forms: [
      { id: 'fasoracetam', name: 'Fasoracetam', nameRu: 'Фасорацетам 50 мг', dose: '50 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES', 'ADRENALS'],
    systems: ['neuro', 'endocrine'],
    mechanisms: ['GLUTAMATE_MODULATION', 'ANXIOLYTIC', 'MEMORY_ENHANCEMENT', 'ADRENAL_RECOVERY'],
    description: 'Фасорацетам — ноотроп нового поколения, модулирует глутаматные рецепторы и восстанавливает надпочечники.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: головная боль'],
    dosage: { mg: 50, timing: 'натощак 2x/д', form: 'фасорацетам 50 мг' },
    bestForCourse: false,
  },
  coluracetam: {
    id: 'coluracetam',
    name: 'Coluracetam',
    nameRu: 'Колурацетам',
    tier: 'advanced',
    category: ['nootropic', 'neuroprotector'],
    forms: [
      { id: 'coluracetam', name: 'Coluracetam', nameRu: 'Колурацетам 20 мг', dose: '20 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['CHOLINE_UPTAKE_ENHANCEMENT', 'MEMORY_ENHANCEMENT', 'VISION_IMPROVEMENT', 'NEUROPROTECTION'],
    description: 'Колурацетам — усиливает захват холина, улучшает память и зрение. На курсе — нейропротекция и фокус.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: головная боль'],
    dosage: { mg: 20, timing: 'натощак 2x/д', form: 'колурацетам 20 мг' },
    bestForCourse: false,
  },
  noopept: {
    id: 'noopept',
    name: 'Noopept',
    nameRu: 'Ноопепт',
    tier: 'advanced',
    category: ['nootropic', 'neuroprotector'],
    forms: [
      { id: 'noopept', name: 'Noopept', nameRu: 'Ноопепт 10 мг', dose: '10 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['BDNF_INCREASE', 'NGF_STIMULATION', 'MEMORY_ENHANCEMENT', 'NEUROPROTECTION'],
    description: 'Ноопепт — ноотроп нового поколения, увеличивает BDNF и NGF, улучшает память и нейропротекцию.',
    synergies: [
      { with: "citicoline", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Беременность', 'Эпилепсия'],
    sideEffects: ['Редко: раздражительность'],
    dosage: { mg: 10, timing: 'с едой 2x/д', form: 'ноопепт 10 мг' },
    bestForCourse: false,
  },
  citicoline: {
    id: 'citicoline',
    name: 'Citicoline',
    nameRu: 'Цитиколин (ЦДФ-холин)',
    tier: 'standard',
    category: ['nootropic', 'neuroprotector'],
    forms: [
      { id: 'citicoline', name: 'Citicoline', nameRu: 'Цитиколин 250 мг', dose: '250 мг 2x/д', best: true },
      { id: 'citicoline_2', name: 'Citicoline', nameRu: 'Цитиколин 500 мг', dose: '250 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES', 'LIVER'],
    systems: ['neuro', 'hepatic'],
    mechanisms: ['ACETYLCHOLINE_SYNTHESIS', 'MEMORY_ENHANCEMENT', 'NEUROPROTECTION', 'PHOSPHOLIPID_SYNTHESIS'],
    description: 'Цитиколин — предшественник ацетилхолина и фосфолипидов, улучшает память и нейропротекцию. На курсе — мозг.',
    synergies: [
      { with: "alpha_gpc", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "noopept", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: головная боль при начале'],
    dosage: { mg: 250, timing: 'с едой 2x/д', form: 'цитиколин 250 мг' },
    bestForCourse: false,
  },
  alpha_gpc: {
    id: 'alpha_gpc',
    name: 'Alpha-GPC',
    nameRu: 'Альфа-ГФХ (Альфа-глицерофосфохолин)',
    tier: 'standard',
    category: ['nootropic', 'neuroprotector'],
    forms: [
      { id: 'alpha_gpc', name: 'Alpha-GPC', nameRu: 'Альфа-ГФХ 300 мг', dose: '300 мг 2x/д', best: true },
      { id: 'alpha_gpc_2', name: 'Alpha-GPC', nameRu: 'Альфа-ГФХ 600 мг', dose: '300 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES', 'MUSCLES'],
    systems: ['neuro', 'musculoskeletal'],
    mechanisms: ['ACETYLCHOLINE_SYNTHESIS', 'MEMORY_ENHANCEMENT', 'POWER_OUTPUT', 'NEUROPROTECTION'],
    description: 'Альфа-ГФХ — лучший источник холина, увеличивает ацетилхолин, улучшает память и силовой выход. На курсе — мозг и сила.',
    synergies: [
      { with: "citicoline", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: головная боль при начале'],
    dosage: { mg: 300, timing: 'с едой 2x/д', form: 'Альфа-ГФХ 300 мг' },
    bestForCourse: false,
  },
  vinpocetine: {
    id: 'vinpocetine',
    name: 'Vinpocetine',
    nameRu: 'Винпоцетин',
    tier: 'standard',
    category: ['nootropic', 'cardioprotector'],
    forms: [
      { id: 'vinpocetine', name: 'Vinpocetine', nameRu: 'Винпоцетин 10 мг', dose: '10 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'BLOOD_VESSELS', 'HEART'],
    systems: ['neuro', 'cardio'],
    mechanisms: ['CEREBRAL_BLOOD_FLOW', 'MEMORY_ENHANCEMENT', 'NEUROPROTECTION', 'ANTIOXIDANT'],
    description: 'Винпоцетин — улучшает мозговой кровоток и память. Нейропротектор с сосудорасширяющим действием.',
    synergies: [
      { with: "ginkgo", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Редко: головная боль'],
    dosage: { mg: 10, timing: 'с едой 2x/д', form: 'винпоцетин 10 мг' },
    bestForCourse: false,
  },
  modafinil: {
    id: 'modafinil',
    name: 'Modafinil',
    nameRu: 'Модафинил',
    tier: 'specialty',
    category: ['nootropic', 'stimulant'],
    forms: [
      { id: 'modafinil', name: 'Modafinil', nameRu: 'Модафинил 100 мг', dose: '100 мг 2x/д', best: true },
      { id: 'modafinil_2', name: 'Modafinil', nameRu: 'Модафинил 200 мг', dose: '100 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['WAKEFULNESS', 'PROMOTING', 'FOCUS_ENHANCEMENT', 'DOPAMINE_MODULATION', 'FATIGUE_REDUCTION'],
    description: 'Модафинил — стимулятор бодрствования, улучшает фокус и снижает усталость. На курсе — при тренировках в 5 утра.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Аритмия', 'Гипертония (тяжёлая)'],
    sideEffects: ['Бессонница при вечернем приёме', 'Головная боль'],
    dosage: { mg: 100, timing: 'утром 1x/д', form: 'модафинил 100 мг' },
    bestForCourse: false,
  },
  selegiline: {
    id: 'selegiline',
    name: 'Selegiline',
    nameRu: 'Селегилин',
    tier: 'specialty',
    category: ['nootropic', 'neuroprotector'],
    forms: [
      { id: 'selegiline', name: 'Selegiline', nameRu: 'Селегилин 5 мг', dose: '5 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['MAO_B_INHIBITION', 'DOPAMINE_PROTECTION', 'NEUROPROTECTION', 'ANTI_AGING'],
    description: 'Селегилин — ингибитор МАО-Б, защищает дофамин и обладает нейропротекторным действием. Анти-возрастной.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Дофамин', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Приём СИОЗС (серотониновый синдром)'],
    sideEffects: ['Бессонница при вечернем приёме'],
    dosage: { mg: 5, timing: 'утром 1x/д', form: 'селегилин 5 мг' },
    bestForCourse: false,
  },
  memantine: {
    id: 'memantine',
    name: 'Memantine',
    nameRu: 'Мемантин',
    tier: 'specialty',
    category: ['nootropic', 'neuroprotector'],
    forms: [
      { id: 'memantine', name: 'Memantine', nameRu: 'Мемантин 5 мг', dose: '5 мг 2x/д', best: true },
      { id: 'memantine_2', name: 'Memantine', nameRu: 'Мемантин 10 мг', dose: '5 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['NMDA_ANTAGONISM', 'NEUROPROTECTION', 'MEMORY_PRESERVATION', 'NEUROPLASTICITY'],
    description: 'Мемантин — антагонист NMDA-рецепторов, нейропротектор. Предотвращает эксайтотоксичность на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Тяжёлая почечная недостаточность'],
    sideEffects: ['Головокружение при начале'],
    dosage: { mg: 5, timing: 'с едой 1x/д', form: 'мемантин 5 мг' },
    bestForCourse: false,
  },
  bromantane: {
    id: 'bromantane',
    name: 'Bromantane',
    nameRu: 'Бромантан',
    tier: 'advanced',
    category: ['nootropic', 'adaptogen'],
    forms: [
      { id: 'bromantane', name: 'Bromantane', nameRu: 'Бромантан 50 мг', dose: '50 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES', 'ADRENALS'],
    systems: ['neuro', 'endocrine'],
    mechanisms: ['DOPAMINE_SYNTHESIS_UPREGULATION', 'ANXIOLYTIC', 'ANTI_FATIGUE', 'STRESS_ADAPTATION'],
    description: 'Бромантан — ноотроп и адаптоген, стимулирует синтез дофамина и снижает тревожность. На курсе — антистресс и фокус.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: возбуждение при передозировке'],
    dosage: { mg: 50, timing: 'утром 1x/д', form: 'бромантан 50 мг' },
    bestForCourse: false,
  },
  tianeptine: {
    id: 'tianeptine',
    name: 'Tianeptine',
    nameRu: 'Тианептин',
    tier: 'specialty',
    category: ['nootropic', 'antidepressant'],
    forms: [
      { id: 'tianeptine', name: 'Tianeptine', nameRu: 'Тианептин 12.5 мг', dose: '12.5 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['SEROTONIN_REUPTAKE_ENHANCEMENT', 'NEUROPROTECTION', 'BDNF_INCREASE', 'ANXIOLYTIC'],
    description: 'Тианептин — антидепрессант с нейропротекторным действием, увеличивает BDNF. На курсе — настроение и мозг.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Настроение', when: 'Субъективно' }
    ],
    contraindications: ['Приём СИОЗС (серотониновый синдром)'],
    sideEffects: ['Редко: сухость во рту', 'Сонливость при начале'],
    dosage: { mg: 12.5, timing: 'утром 1x/д', form: 'тианептин 12.5 мг' },
    bestForCourse: false,
  },
  huperzine_a: {
    id: 'huperzine_a',
    name: 'Huperzine A',
    nameRu: 'Гуперзин А',
    tier: 'advanced',
    category: ['nootropic', 'neuroprotector'],
    forms: [
      { id: 'huperzine_a', name: 'Huperzine A', nameRu: 'Гуперзин А 100 мкг', dose: '100 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['ACETYLCHOLINESTERASE_INHIBITION', 'MEMORY_ENHANCEMENT', 'NEUROPROTECTION', 'NMDA_MODULATION'],
    description: 'Гуперзин А — ингибитор ацетилхолинэстеразы, усиливает память и нейропротекцию. Циклический приём 4 нед/2 нед.',
    synergies: [
      { with: "phosphatidylcholine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "stimulant_complex", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Брадикардия', 'Астма'],
    sideEffects: ['Тошнота при высоких дозах'],
    dosage: { mg: 100, timing: 'с едой 1x/д', form: 'гуперзин А 100 мкг' },
    bestForCourse: false,
  },
  apigenin: {
    id: 'apigenin',
    name: 'Apigenin',
    nameRu: 'Апигенин',
    tier: 'standard',
    category: ['nootropic', 'anxiolytic', 'antioxidant'],
    forms: [
      { id: 'apigenin', name: 'Apigenin', nameRu: 'Апигенин 50 мг', dose: '50 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES', 'CELLS'],
    systems: ['neuro'],
    mechanisms: ['GABA_MODULATION', 'ANXIOLYTIC', 'ANTIOXIDANT', 'ANTI_INFLAMMATORY'],
    description: 'Апигенин — флавоноид из ромашки, модулирует ГАМК-рецепторы, снижает тревожность и улучшает сон.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Приём седативных (потенцирование)'],
    sideEffects: ['Сонливость при начале'],
    dosage: { mg: 50, timing: 'на ночь 1x/д', form: 'апигенин 50 мг' },
    bestForCourse: false,
  },
  lemon_balm: {
    id: 'lemon_balm',
    name: 'Lemon Balm',
    nameRu: 'Мелисса (мелисса лекарственная)',
    tier: 'standard',
    category: ['anxiolytic', 'neuroprotector'],
    forms: [
      { id: 'lemon_balm', name: 'Lemon Balm', nameRu: 'Экстракт мелиссы 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES', 'GUT'],
    systems: ['neuro', 'gastrointestinal'],
    mechanisms: ['GABA_MODULATION', 'ANXIOLYTIC', 'DIGESTION_IMPROVEMENT', 'SLEEP_REGULATION'],
    description: 'Мелисса — анксиолитик с ГАМК-модулирующим действием, улучшает сон и пищеварение. На курсе — антистресс.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Гипотиреоз (с осторожностью)'],
    sideEffects: ['Редко: сонливость'],
    dosage: { mg: 500, timing: 'на ночь 1x/д', form: 'экстракт мелиссы 500 мг' },
    bestForCourse: false,
  },
  saffron: {
    id: 'saffron',
    name: 'Saffron',
    nameRu: 'Шафран (крокин)',
    tier: 'standard',
    category: ['nootropic', 'antidepressant'],
    forms: [
      { id: 'saffron', name: 'Saffron', nameRu: 'Шафран экстракт 30 мг', dose: '30 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES', 'EYES'],
    systems: ['neuro'],
    mechanisms: ['SEROTONIN_MODULATION', 'ANTIDEPRESSANT', 'VISION_PROTECTION', 'ANTI_INFLAMMATORY'],
    description: 'Шафран — антидепрессант и ноотроп, модулирует серотонин и защищает зрение. На курсе — настроение.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Настроение', when: 'Субъективно' }
    ],
    contraindications: ['Приём СИОЗС (серотониновый синдром)'],
    sideEffects: ['Редко: сухость во рту'],
    dosage: { mg: 30, timing: 'с едой 1x/д', form: 'шафран экстракт 30 мг' },
    bestForCourse: false,
  },
  metformin: {
    id: 'metformin',
    name: 'Metformin',
    nameRu: 'Метформин',
    tier: 'specialty',
    category: ['pharma', 'metabolic'],
    forms: [
      { id: 'metformin', name: 'Metformin', nameRu: 'Метформин 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'metformin_2', name: 'Metformin', nameRu: 'Метформин 850 мг', dose: '500 мг', best: false }
    ],
    organs: ['LIVER', 'PANCREAS', 'MUSCLES'],
    systems: ['hepatic', 'metabolic'],
    mechanisms: ['AMPK_ACTIVATION', 'INSULIN_SENSITIVITY', 'GLUCOSE_LOWERING', 'MITOCHONDRIAL_PROTECTION'],
    description: 'Метформин — препарат первой линии при инсулинорезистентности, активирует AMPK. На курсе — метаболическая защита.',
    synergies: [
      { with: "berberine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "vitamin_b12", effect: "", mechanism: "", severity: "HIGH" },
      { with: "berberine", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед', targetRange: '3.5-5.5 ммоль/л' }
    ],
    contraindications: ['Лактоацидоз в анамнезе', 'Тяжёлая почечная недостаточность'],
    sideEffects: ['Желудочный дискомфорт', 'Диарея при начале'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'метформин 500 мг' },
    bestForCourse: false,
  },
  semaglutide: {
    id: 'semaglutide',
    name: 'Semaglutide',
    nameRu: 'Семаглутид',
    tier: 'specialty',
    category: ['pharma', 'metabolic'],
    forms: [
      { id: 'semaglutide', name: 'Semaglutide', nameRu: 'Семаглутид 0.25 мг', dose: '250 мкг 2x/д', best: true },
      { id: 'semaglutide_2', name: 'Semaglutide', nameRu: 'Семаглутид 0.5 мг', dose: '250 мкг', best: false }
    ],
    organs: ['PANCREAS', 'BRAIN', 'GUT'],
    systems: ['metabolic'],
    mechanisms: ['GLP1_RECEPTOR_AGONISM', 'APPETITE_SUPPRESSION', 'GLUCOSE_REGULATION', 'WEIGHT_LOSS'],
    description: 'Семаглутид — агонист ГПП-1 рецепторов, мощное снижение аппетита и веса. На курсе — контроль метаболизма.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед', targetRange: '3.5-5.5 ммоль/л' }
    ],
    contraindications: ['Медуллярный рак щитовидной железы', 'МЭН2', 'Беременность'],
    sideEffects: ['Тошнота', 'Диарея при начале', 'Риск панкреатита'],
    dosage: { mg: 0.25, timing: '1x/нед п/к', form: 'семаглутид 0.25 мг' },
    bestForCourse: false,
  },
  finasteride: {
    id: 'finasteride',
    name: 'Finasteride',
    nameRu: 'Финастерид',
    tier: 'specialty',
    category: ['pharma', 'hormonal'],
    forms: [
      { id: 'finasteride', name: 'Finasteride', nameRu: 'Финастерид 1 мг', dose: '1 мг 2x/д', best: true },
      { id: 'finasteride_2', name: 'Finasteride', nameRu: 'Финастерид 5 мг', dose: '1 мг', best: false }
    ],
    organs: ['PROSTATE', 'HAIR', 'REPRODUCTIVE'],
    systems: ['reproductive'],
    mechanisms: ['DHT_INHIBITION_5AR', 'PROSTATE_PROTECTION', 'HAIR_LOSS_PREVENTION', 'PSA_LOWERING'],
    description: 'Финастерид — ингибитор 5-альфа-редуктазы, снижает ДГТ на 70%. Защита простаты и волос на курсе.',
    synergies: [
      { with: "testosterone", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "testosterone", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'ПСА', when: 'Каждые 12 нед', targetRange: '<4 нг/мл' }
    ],
    contraindications: ['Беременность женщин', 'Рак простаты'],
    sideEffects: ['Снижение либидо', 'Эректильная дисфункция (5-10%)'],
    dosage: { mg: 1, timing: '1x/д', form: 'финастерид 1 мг' },
    bestForCourse: false,
  },
  cabergoline: {
    id: 'cabergoline',
    name: 'Cabergoline',
    nameRu: 'Каберголин',
    tier: 'specialty',
    category: ['pharma', 'hormonal'],
    forms: [
      { id: 'cabergoline', name: 'Cabergoline', nameRu: 'Каберголин 0.5 мг', dose: '0.5 мкг 2x/д', best: true }
    ],
    organs: ['PITUITARY', 'REPRODUCTIVE'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['PROLACTIN_INHIBITION', 'DOPAMINE_D2_AGONISM', 'LH_PULSE_RESTORE', 'LIBIDO_RECOVERY'],
    description: 'Каберголин — агонист D2-рецепторов, подавляет пролактин. Восстанавливает ЛГ и либидо на курсе.',
    synergies: [],
    conflicts: [
      { with: "testosterone", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Пролактин', when: 'Каждые 2 нед', targetRange: '<15 нг/мл' }
    ],
    contraindications: ['Фиброз сердца', 'Тяжёлая печёночная недостаточность'],
    sideEffects: ['Тошнота', 'Головокружение', 'Риск фиброза при длительном'],
    dosage: { mg: 0.0005, timing: '2x/нед', form: 'каберголин 0.5 мг' },
    bestForCourse: false,
  },
  testosterone: {
    id: 'testosterone',
    name: 'Testosterone',
    nameRu: 'Тестостерон',
    tier: 'specialty',
    category: ['pharma', 'hormonal'],
    forms: [
      { id: 'testosterone', name: 'Testosterone', nameRu: 'Тестостерон энантат 250 мг', dose: '200 мг 2x/д', best: true },
      { id: 'testosterone_2', name: 'Testosterone', nameRu: 'Тестостерон ципионат 200 мг', dose: '200 мг', best: false }
    ],
    organs: ['REPRODUCTIVE', 'MUSCLES', 'BRAIN'],
    systems: ['reproductive', 'musculoskeletal', 'endocrine'],
    mechanisms: ['ANABOLIC_EFFECT', 'ANDROGENIC_EFFECT', 'PROTEIN_SYNTHESIS', 'MUSCLE_GROWTH'],
    description: 'Тестостерон — основной андроген, увеличивает мышечную массу, силу и либидо. Основа курса ААС.',
    synergies: [
      { with: "finasteride", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "nac", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "telmisartan", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "hcg", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "cabergoline", effect: "", mechanism: "", severity: "LOW" },
      { with: "finasteride", effect: "", mechanism: "", severity: "LOW" },
      { with: "tudca", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Тестостерон', when: 'Каждые 4 нед', targetRange: '700-1100 нг/дл' }
    ],
    contraindications: ['Рак простаты', 'Беременность'],
    sideEffects: ['Акне', 'Задержка жидкости', 'Алопеция'],
    dosage: { mg: 200, timing: '1x/нед в/м', form: 'тестостерон энантат 200 мг' },
    bestForCourse: false,
  },
  caffeine: {
    id: 'caffeine',
    name: 'Caffeine',
    nameRu: 'Кофеин',
    tier: 'standard',
    category: ['stimulant', 'nootropic'],
    forms: [
      { id: 'caffeine', name: 'Caffeine', nameRu: 'Кофеин 200 мг', dose: '200 мг 2x/д', best: true },
      { id: 'caffeine_2', name: 'Caffeine', nameRu: 'Кофеин 100 мг', dose: '200 мг', best: false }
    ],
    organs: ['BRAIN', 'HEART', 'MUSCLES'],
    systems: ['neuro', 'cardio'],
    mechanisms: ['ADENOSINE_ANTAGONISM', 'CNS_STIMULATION', 'FAT_OXIDATION', 'POWER_OUTPUT'],
    description: 'Кофеин — стимулятор ЦНС, блокирует аденозин, повышает силу и жиросжигание. На курсе — предтренировочный буст.',
    synergies: [
      { with: "theanine", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "stimulant_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "piracetam", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "l_carnitine", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "stimulant_complex", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Пульс', when: 'Субъективно' }
    ],
    contraindications: ['Тяжёлая гипертензия', 'Аритмия'],
    sideEffects: ['Бессонница при вечернем приёме', 'Тахикардия'],
    dosage: { mg: 200, timing: 'утром за 30 мин до тренировки', form: 'кофеин 200 мг' },
    bestForCourse: false,
  },
  diclofenac: {
    id: 'diclofenac',
    name: 'Diclofenac',
    nameRu: 'Диклофенак',
    tier: 'specialty',
    category: ['pharma', 'nsaid'],
    forms: [
      { id: 'diclofenac', name: 'Diclofenac', nameRu: 'Диклофенак 50 мг', dose: '50 мг 2x/д', best: true }
    ],
    organs: ['JOINTS', 'MUSCLES', 'KIDNEYS'],
    systems: ['musculoskeletal', 'renal'],
    mechanisms: ['COX_INHIBITION', 'ANTI_INFLAMMATORY', 'ANALGESIC', 'ANTIPYRETIC'],
    description: 'Диклофенак — НПВС, ингибитор ЦОГ-1/2, мощное противовоспалительное и обезболивающее. На курсе — суставы (краткосрочно).',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Креатинин', when: 'Каждые 2 нед' }
    ],
    contraindications: ['Язвенная болезнь', 'Почечная недостаточность', 'Беременность III триместр'],
    sideEffects: ['Желудочный дискомфорт', 'Риск язвы', 'Нефротоксичность'],
    dosage: { mg: 50, timing: 'с едой 2x/д (макс 5 дн)', form: 'диклофенак 50 мг' },
    bestForCourse: false,
  },
  meloxicam: {
    id: 'meloxicam',
    name: 'Meloxicam',
    nameRu: 'Мелоксикам',
    tier: 'specialty',
    category: ['pharma', 'nsaid'],
    forms: [
      { id: 'meloxicam', name: 'Meloxicam', nameRu: 'Мелоксикам 7.5 мг', dose: '7.5 мг 2x/д', best: true },
      { id: 'meloxicam_2', name: 'Meloxicam', nameRu: 'Мелоксикам 15 мг', dose: '7.5 мг', best: false }
    ],
    organs: ['JOINTS', 'MUSCLES', 'KIDNEYS'],
    systems: ['musculoskeletal', 'renal'],
    mechanisms: ['COX2_SELECTIVE_INHIBITION', 'ANTI_INFLAMMATORY', 'ANALGESIC', 'JOINT_PROTECTION'],
    description: 'Мелоксикам — селективный ингибитор ЦОГ-2, меньше гастротоксичности чем диклофенак. На курсе — суставы.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Креатинин', when: 'Каждые 2 нед' }
    ],
    contraindications: ['Язвенная болезнь', 'Почечная недостаточность'],
    sideEffects: ['Желудочный дискомфорт (меньше чем диклофенак)'],
    dosage: { mg: 7.5, timing: 'с едой 1x/д (макс 7 дн)', form: 'мелоксикам 7.5 мг' },
    bestForCourse: false,
  },
  ppi_drugs: {
    id: 'ppi_drugs',
    name: 'PPI Drugs',
    nameRu: 'ИПП (Омепразол/Пантопразол)',
    tier: 'specialty',
    category: ['pharma', 'gastrointestinal'],
    forms: [
      { id: 'ppi_drugs', name: 'PPI Drugs', nameRu: 'Омепразол 20 мг', dose: '20 мг 2x/д', best: true },
      { id: 'ppi_drugs_2', name: 'PPI Drugs', nameRu: 'Пантопразол 40 мг', dose: '20 мг', best: false }
    ],
    organs: ['STOMACH', 'GUT'],
    systems: ['gastrointestinal'],
    mechanisms: ['PROTON_PUMP_INHIBITION', 'GASTRIC_PROTECTION', 'ACID_REDUCTION', 'ULCER_PREVENTION'],
    description: 'Ингибиторы протонной помпы — снижают кислотность желудка, предотвращают язвы и рефлюкс. На курсе — защита ЖКТ.',
    synergies: [
      { with: "probiotics", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "curcumin", effect: "", mechanism: "", severity: "LOW" },
      { with: "colloidal_minerals", effect: "", mechanism: "", severity: "HIGH" },
      { with: "vitamin_b12", effect: "", mechanism: "", severity: "HIGH" },
      { with: "calcium", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Гастроскопия', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Длительный приём >6 мес (риск остеопороза)'],
    sideEffects: ['Головная боль', 'Дефицит B12/Mg при длительном'],
    dosage: { mg: 20, timing: 'утром натощак 1x/д', form: 'омепразол 20 мг' },
    bestForCourse: false,
  },
  spironolactone: {
    id: 'spironolactone',
    name: 'Spironolactone',
    nameRu: 'Спиронолактон',
    tier: 'specialty',
    category: ['pharma', 'cardioprotector'],
    forms: [
      { id: 'spironolactone', name: 'Spironolactone', nameRu: 'Спиронолактон 50 мг', dose: '50 мг 2x/д', best: true },
      { id: 'spironolactone_2', name: 'Spironolactone', nameRu: 'Спиронолактон 25 мг', dose: '50 мг', best: false }
    ],
    organs: ['KIDNEYS', 'HEART', 'REPRODUCTIVE'],
    systems: ['renal', 'cardio'],
    mechanisms: ['ALDOSTERONE_ANTAGONISM', 'POTASSIUM_SPARING', 'ANTI_ANDROGEN', 'EDEMA_REDUCTION'],
    description: 'Спиронолактон — антагонист альдостерона, калийсберегающий диуретик с антиандрогенным действием. На курсе — отёки и калий.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Калий', when: 'Каждые 2 нед', targetRange: '4.0-5.0 ммоль/л' }
    ],
    contraindications: ['Гиперкалиемия', 'Тяжёлая почечная недостаточность'],
    sideEffects: ['Гинекомастия при высоких дозах', 'Снижение либидо'],
    dosage: { mg: 50, timing: 'с едой 1x/д', form: 'спиронолактон 50 мг' },
    bestForCourse: false,
  },
  pharma_drugs: {
    id: 'pharma_drugs',
    name: 'Pharma Drugs',
    nameRu: 'Фарма-препараты (комплекс)',
    tier: 'specialty',
    category: ['pharma', 'recovery'],
    forms: [
      { id: 'pharma_drugs', name: 'Pharma Drugs', nameRu: 'Фарма-комплекс индивидуальный', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['LIVER', 'HEART', 'KIDNEYS'],
    systems: ['hepatic', 'cardio', 'renal'],
    mechanisms: ['MULTI_ORGAN_PROTECTION', 'RISK_REDUCTION', 'COURSE_SUPPORT', 'PCT_PREPARATION'],
    description: 'Фарма-препараты — комплексная поддержка на курсе: ИПП, кардиопротекторы, гепатопротекторы. Индивидуальный подбор.',
    synergies: [],
    conflicts: [
      { with: "prebiotics", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Биохимия крови', when: 'Каждые 4 нед' }
    ],
    contraindications: [],
    sideEffects: ['Индивидуально'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'фарма-комплекс' },
    bestForCourse: false,
  },
  antidepressant_drugs: {
    id: 'antidepressant_drugs',
    name: 'Antidepressant Drugs',
    nameRu: 'Антидепрессанты',
    tier: 'specialty',
    category: ['pharma', 'neuroprotector'],
    forms: [
      { id: 'antidepressant_drugs', name: 'Antidepressant Drugs', nameRu: 'Антидепрессант (по назначению врача)', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES', 'ADRENALS'],
    systems: ['neuro'],
    mechanisms: ['SEROTONIN_MODULATION', 'NOREPINEPHRINE_MODULATION', 'MOOD_REGULATION', 'ANXIOLYTIC'],
    description: 'Антидепрессанты — СИОЗС/СИОЗСН для стабилизации настроения на ПКТ. Только по назначению врача.',
    synergies: [],
    conflicts: [
      { with: "x5htp", effect: "", mechanism: "", severity: "HIGH" },
      { with: "tryptophan", effect: "", mechanism: "", severity: "HIGH" },
      { with: "holy_basil", effect: "", mechanism: "", severity: "HIGH" },
      { with: "gaba", effect: "", mechanism: "", severity: "LOW" },
      { with: "rhodiola", effect: "", mechanism: "", severity: "LOW" },
      { with: "tyrosine", effect: "", mechanism: "", severity: "HIGH" },
      { with: "melatonin", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Настроение', when: 'Субъективно' }
    ],
    contraindications: ['Приём МАО-ингибиторов', 'Серотониновый синдром'],
    sideEffects: ['Тошнота при начале', 'Снижение либидо', 'Бессонница'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'антидепрессант (по назначению)' },
    bestForCourse: false,
  },
  anxiolytic_drugs: {
    id: 'anxiolytic_drugs',
    name: 'Anxiolytic Drugs',
    nameRu: 'Анксиолитики',
    tier: 'specialty',
    category: ['pharma', 'neuroprotector'],
    forms: [
      { id: 'anxiolytic_drugs', name: 'Anxiolytic Drugs', nameRu: 'Анксиолитик (по назначению врача)', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['GABA_MODULATION', 'ANXIOLYTIC', 'MUSCLE_RELAXATION', 'SLEEP_REGULATION'],
    description: 'Анксиолитики — бензодиазепины или небензодиазепиновые препараты для снижения тревожности. Только по назначению.',
    synergies: [
      { with: "melatonin", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "ashwagandha", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "gaba", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "gaba", effect: "", mechanism: "", severity: "HIGH" },
      { with: "stimulant_complex", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Тревожность', when: 'Субъективно' }
    ],
    contraindications: ['Зависимость при длительном приёме'],
    sideEffects: ['Сонливость', 'Зависимость', 'Синдром отмены'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'анксиолитик (по назначению)' },
    bestForCourse: false,
  },
  antipsychotic_drugs: {
    id: 'antipsychotic_drugs',
    name: 'Antipsychotic Drugs',
    nameRu: 'Антипсихотики',
    tier: 'specialty',
    category: ['pharma', 'neuroprotector'],
    forms: [
      { id: 'antipsychotic_drugs', name: 'Antipsychotic Drugs', nameRu: 'Антипсихотик (по назначению врача)', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['DOPAMINE_ANTAGONISM', 'PSYCHOSIS_PREVENTION', 'MOOD_STABILIZATION', 'PROLACTIN_INCREASE'],
    description: 'Антипсихотики — для предотвращения психоза на высоких дозах ААС. Только по назначению врача.',
    synergies: [],
    conflicts: [
      { with: "phosphatidylcholine", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Психический статус', when: 'Субъективно' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Седация', 'Увеличение веса', 'Экстрапирамидные симптомы'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'антипсихотик (по назначению)' },
    bestForCourse: false,
  },
  anticonvulsant_drugs: {
    id: 'anticonvulsant_drugs',
    name: 'Anticonvulsant Drugs',
    nameRu: 'Противоэпилептические препараты',
    tier: 'specialty',
    category: ['pharma', 'neuroprotector'],
    forms: [
      { id: 'anticonvulsant_drugs', name: 'Anticonvulsant Drugs', nameRu: 'Противоэпилептический (по назначению врача)', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['SEIZURE_PREVENTION', 'NEUROPROTECTION', 'MOOD_STABILIZATION', 'NERVE_PAIN_RELIEF'],
    description: 'Противоэпилептические препараты — предотвращают судороги и нейропатию на курсе. Только по назначению.',
    synergies: [],
    conflicts: [
      { with: "folate", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'ЭЭГ', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Беременность (с осторожностью)'],
    sideEffects: ['Сонливость', 'Головокружение', 'Тремор'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'противоэпилептический (по назначению)' },
    bestForCourse: false,
  },
  ketamine: {
    id: 'ketamine',
    name: 'Ketamine',
    nameRu: 'Кетамин',
    tier: 'specialty',
    category: ['pharma', 'nootropic', 'antidepressant'],
    forms: [
      { id: 'ketamine', name: 'Ketamine', nameRu: 'Кетамин (клиническое применение)', dose: '500 мкг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['NMDA_ANTAGONISM', 'RAPID_ANTIDEPRESSANT', 'ANALGESIC', 'NEUROPLASTICITY'],
    description: 'Кетамин — NMDA-антагонист с быстрым антидепрессивным действием. Только в клинике под наблюдением.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Настроение', when: 'Субъективно' }
    ],
    contraindications: ['Гипертензия', 'Психоз'],
    sideEffects: ['Диссоциация', 'Повышение АД', 'Зависимость'],
    dosage: { mg: 0.5, timing: 'в клинике 1x/нед в/в', form: 'кетамин 0.5 мг/кг в/в' },
    bestForCourse: false,
  },
  antidiabetic_drugs: {
    id: 'antidiabetic_drugs',
    name: 'Antidiabetic Drugs',
    nameRu: 'Противодиабетические препараты',
    tier: 'specialty',
    category: ['pharma', 'metabolic'],
    forms: [
      { id: 'antidiabetic_drugs', name: 'Antidiabetic Drugs', nameRu: 'Противодиабетический (по назначению врача)', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['PANCREAS', 'LIVER', 'MUSCLES'],
    systems: ['metabolic', 'hepatic'],
    mechanisms: ['INSULIN_SENSITIVITY', 'GLUCOSE_LOWERING', 'HBA1C_REDUCTION', 'METABOLIC_PROTECTION'],
    description: 'Противодиабетические препараты — метформин, СГЛТ2-ингибиторы и др. для контроля глюкозы на курсе.',
    synergies: [],
    conflicts: [
      { with: "mct", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед', targetRange: '3.5-5.5 ммоль/л' }
    ],
    contraindications: ['Кетоацидоз', 'Тяжёлая почечная недостаточность'],
    sideEffects: ['Индивидуально'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'противодиабетический (по назначению)' },
    bestForCourse: false,
  },
  thyroid_drugs: {
    id: 'thyroid_drugs',
    name: 'Thyroid Drugs',
    nameRu: 'Тиреоидные препараты',
    tier: 'specialty',
    category: ['pharma', 'hormonal'],
    forms: [
      { id: 'thyroid_drugs', name: 'Thyroid Drugs', nameRu: 'Левотироксин (по назначению)', dose: '1 мг 2x/д', best: true },
      { id: 'thyroid_drugs_2', name: 'Thyroid Drugs', nameRu: 'Лиотиронин (по назначению)', dose: '1 мг', best: false }
    ],
    organs: ['THYROID', 'BRAIN', 'HEART'],
    systems: ['endocrine', 'cardio', 'neuro'],
    mechanisms: ['THYROID_HORMONE_REGULATION', 'METABOLIC_RATE', 'T3_T4_BALANCE', 'ENERGY_PRODUCTION'],
    description: 'Тиреоидные препараты — левотироксин (Т4) и лиотиронин (Т3) для регуляции метаболизма. Только по назначению.',
    synergies: [
      { with: "selenium", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "ashwagandha", effect: "", mechanism: "", severity: "LOW" },
      { with: "l_carnitine", effect: "", mechanism: "", severity: "HIGH" },
      { with: "iodine", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'ТТГ/Т3/Т4', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Тиреотоксикоз', 'Острый инфаркт'],
    sideEffects: ['Тахикардия', 'Потливость', 'Остеопороз при длительном'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'тиреоидный препарат (по назначению)' },
    bestForCourse: false,
  },
  corticosteroid_drugs: {
    id: 'corticosteroid_drugs',
    name: 'Corticosteroid Drugs',
    nameRu: 'Глюкокортикоиды',
    tier: 'specialty',
    category: ['pharma', 'anti_inflammatory'],
    forms: [
      { id: 'corticosteroid_drugs', name: 'Corticosteroid Drugs', nameRu: 'Глюкокортикоид (по назначению врача)', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['ADRENALS', 'JOINTS', 'IMMUNE_SYSTEM'],
    systems: ['endocrine', 'musculoskeletal', 'immune'],
    mechanisms: ['ANTI_INFLAMMATORY', 'IMMUNOSUPPRESSION', 'CORTISOL_REPLACEMENT', 'EDEMA_REDUCTION'],
    description: 'Глюкокортикоиды — преднизолон, дексаметазон для снятия воспаления. Только краткосрочно на курсе.',
    synergies: [
      { with: "curcumin", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Кортизол', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Системные инфекции', 'Остеопороз'],
    sideEffects: ['Остеопороз', 'Увеличение веса', 'Синдром Кушинга'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'глюкокортикоид (по назначению)' },
    bestForCourse: false,
  },
  statin_drugs: {
    id: 'statin_drugs',
    name: 'Statin Drugs',
    nameRu: 'Статины',
    tier: 'specialty',
    category: ['pharma', 'cardioprotector'],
    forms: [
      { id: 'statin_drugs', name: 'Statin Drugs', nameRu: 'Аторвастатин 20 мг', dose: '20 мг 2x/д', best: true },
      { id: 'statin_drugs_2', name: 'Statin Drugs', nameRu: 'Розувастатин 10 мг', dose: '20 мг', best: false }
    ],
    organs: ['LIVER', 'HEART', 'BLOOD_VESSELS'],
    systems: ['hepatic', 'cardio'],
    mechanisms: ['HMG_COA_REDUCTION', 'CHOLESTEROL_LOWERING', 'PLAQUE_STABILIZATION', 'ANTI_INFLAMMATORY'],
    description: 'Статины — аторвастатин/розувастатин, снижают холестерин и стабилизируют бляшки. На курсе — кардиопротекция.',
    synergies: [
      { with: "resveratrol", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "coq10", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "citrus_bioflavonoids", effect: "", mechanism: "", severity: "HIGH" },
      { with: "coq10", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед', targetRange: 'ЛПНП<2.6 ммоль/л' }
    ],
    contraindications: ['Активное заболевание печени', 'Беременность'],
    sideEffects: ['Миалгия', 'Рабдомиолиз (редко)', 'Повышение трансаминаз'],
    dosage: { mg: 20, timing: 'на ночь 1x/д', form: 'аторвастатин 20 мг' },
    bestForCourse: false,
  },
  antiplatelet_drugs: {
    id: 'antiplatelet_drugs',
    name: 'Antiplatelet Drugs',
    nameRu: 'Антиагреганты',
    tier: 'specialty',
    category: ['pharma', 'cardioprotector'],
    forms: [
      { id: 'antiplatelet_drugs', name: 'Antiplatelet Drugs', nameRu: 'Аспирин 100 мг', dose: '100 мг 2x/д', best: true },
      { id: 'antiplatelet_drugs_2', name: 'Antiplatelet Drugs', nameRu: 'Клопидогрель 75 мг', dose: '100 мг', best: false }
    ],
    organs: ['HEART', 'BLOOD_VESSELS', 'BLOOD'],
    systems: ['cardio', 'hematologic'],
    mechanisms: ['PLATELET_INHIBITION', 'THROMBUS_PREVENTION', 'MICROCIRCULATION', 'STROKE_PREVENTION'],
    description: 'Антиагреганты — аспирин/клопидогрел для предотвращения тромбов. На курсе — защита сосудов при эритроцитозе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Гемоглобин/Гематокрит', when: 'Каждые 8 нед', targetRange: 'Ht<54%' }
    ],
    contraindications: ['Язвенная болезнь', 'Геморрагический диатез'],
    sideEffects: ['Желудочный дискомфорт', 'Риск кровотечения'],
    dosage: { mg: 100, timing: 'с едой 1x/д', form: 'аспирин 100 мг' },
    bestForCourse: false,
  },
  anticoagulant_drugs: {
    id: 'anticoagulant_drugs',
    name: 'Anticoagulant Drugs',
    nameRu: 'Антикоагулянты',
    tier: 'specialty',
    category: ['pharma', 'cardioprotector'],
    forms: [
      { id: 'anticoagulant_drugs', name: 'Anticoagulant Drugs', nameRu: 'Антикоагулянт (по назначению врача)', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['HEART', 'BLOOD_VESSELS', 'BLOOD'],
    systems: ['cardio', 'hematologic'],
    mechanisms: ['COAGULATION_INHIBITION', 'THROMBUS_PREVENTION', 'DVT_PREVENTION', 'STROKE_PREVENTION'],
    description: 'Антикоагулянты — эноксапарин/ривароксабан для профилактики тромбозов. На курсе — при высоком гематокрите.',
    synergies: [],
    conflicts: [
      { with: "vitamin_k2", effect: "", mechanism: "", severity: "HIGH" },
      { with: "omega3", effect: "", mechanism: "", severity: "LOW" },
      { with: "holy_basil", effect: "", mechanism: "", severity: "HIGH" },
      { with: "curcumin", effect: "", mechanism: "", severity: "LOW" },
      { with: "resveratrol", effect: "", mechanism: "", severity: "LOW" },
      { with: "ginseng", effect: "", mechanism: "", severity: "LOW" },
      { with: "coq10", effect: "", mechanism: "", severity: "LOW" },
      { with: "ginger", effect: "", mechanism: "", severity: "LOW" },
      { with: "garlic", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'МНО/АЧТВ', when: 'Каждые 2-4 нед' }
    ],
    contraindications: ['Активное кровотечение', 'Тромбоцитопения'],
    sideEffects: ['Риск кровотечения', 'Гематомы'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'антикоагулянт (по назначению)' },
    bestForCourse: false,
  },
  ace_inhibitor_drugs: {
    id: 'ace_inhibitor_drugs',
    name: 'ACE Inhibitor Drugs',
    nameRu: 'ИАПФ',
    tier: 'specialty',
    category: ['pharma', 'cardioprotector'],
    forms: [
      { id: 'ace_inhibitor_drugs', name: 'ACE Inhibitor Drugs', nameRu: 'Эналаприл 10 мг', dose: '10 мг 2x/д', best: true },
      { id: 'ace_inhibitor_drugs_2', name: 'ACE Inhibitor Drugs', nameRu: 'Рамиприл 5 мг', dose: '10 мг', best: false }
    ],
    organs: ['HEART', 'BLOOD_VESSELS', 'KIDNEYS'],
    systems: ['cardio', 'renal'],
    mechanisms: ['ACE_INHIBITION', 'BLOOD_PRESSURE_LOWERING', 'RENAL_PROTECTION', 'REMODELING_PREVENTION'],
    description: 'ИАПФ — эналаприл/рамиприл, снижают АД и защищают почки. На курсе — кардиопротекция при гипертензии.',
    synergies: [],
    conflicts: [
      { with: "potassium", effect: "", mechanism: "", severity: "HIGH" },
      { with: "zinc", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'АД', when: 'Каждые 2 нед', targetRange: '<130/85 мм рт.ст.' }
    ],
    contraindications: ['Беременность', 'Двусторонний стеноз почечных артерий'],
    sideEffects: ['Сухой кашель', 'Гиперкалиемия'],
    dosage: { mg: 10, timing: '1x/д', form: 'эналаприл 10 мг' },
    bestForCourse: false,
  },
  arb_drugs: {
    id: 'arb_drugs',
    name: 'ARB Drugs',
    nameRu: 'БРА (Сартаны)',
    tier: 'specialty',
    category: ['pharma', 'cardioprotector'],
    forms: [
      { id: 'arb_drugs', name: 'ARB Drugs', nameRu: 'Лозартан 50 мг', dose: '50 мг 2x/д', best: true },
      { id: 'arb_drugs_2', name: 'ARB Drugs', nameRu: 'Валсартан 160 мг', dose: '50 мг', best: false }
    ],
    organs: ['HEART', 'BLOOD_VESSELS', 'KIDNEYS'],
    systems: ['cardio', 'renal'],
    mechanisms: ['ANGIOTENSIN_RECEPTOR_BLOCKADE', 'BLOOD_PRESSURE_LOWERING', 'RENAL_PROTECTION', 'FIBROSIS_REDUCTION'],
    description: 'БРА (сартаны) — лозартан/валсартан, альтернатива ИАПФ без кашля. На курсе — кардиопротекция.',
    synergies: [
      { with: "ginger", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'АД', when: 'Каждые 2 нед', targetRange: '<130/85 мм рт.ст.' }
    ],
    contraindications: ['Беременность', 'Тяжёлая почечная недостаточность'],
    sideEffects: ['Редко: головокружение', 'Гиперкалиемия'],
    dosage: { mg: 50, timing: '1x/д', form: 'лозартан 50 мг' },
    bestForCourse: false,
  },
  ccb_drugs: {
    id: 'ccb_drugs',
    name: 'CCB Drugs',
    nameRu: 'БКК (Блокаторы кальциевых каналов)',
    tier: 'specialty',
    category: ['pharma', 'cardioprotector'],
    forms: [
      { id: 'ccb_drugs', name: 'CCB Drugs', nameRu: 'Амлодипин 5 мг', dose: '5 мг 2x/д', best: true },
      { id: 'ccb_drugs_2', name: 'CCB Drugs', nameRu: 'Амлодипин 10 мг', dose: '5 мг', best: false }
    ],
    organs: ['HEART', 'BLOOD_VESSELS'],
    systems: ['cardio'],
    mechanisms: ['CALCIUM_CHANNEL_BLOCKADE', 'BLOOD_PRESSURE_LOWERING', 'VASODILATION', 'ANGINA_PREVENTION'],
    description: 'БКК — амлодипин/нифедипин, снижают АД и расширяют сосуды. На курсе — гипертензия.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'АД', when: 'Каждые 2 нед', targetRange: '<130/85 мм рт.ст.' }
    ],
    contraindications: ['Тяжёлая гипотензия', 'Сердечная недостаточность'],
    sideEffects: ['Отёки голеней', 'Головная боль', 'Приливы'],
    dosage: { mg: 5, timing: '1x/д', form: 'амлодипин 5 мг' },
    bestForCourse: false,
  },
  beta_blocker_drugs: {
    id: 'beta_blocker_drugs',
    name: 'Beta Blocker Drugs',
    nameRu: 'Бета-блокаторы',
    tier: 'specialty',
    category: ['pharma', 'cardioprotector'],
    forms: [
      { id: 'beta_blocker_drugs', name: 'Beta Blocker Drugs', nameRu: 'Бисопролол 5 мг', dose: '5 мг 2x/д', best: true },
      { id: 'beta_blocker_drugs_2', name: 'Beta Blocker Drugs', nameRu: 'Метопролол 50 мг', dose: '5 мг', best: false }
    ],
    organs: ['HEART', 'BLOOD_VESSELS', 'LUNGS'],
    systems: ['cardio'],
    mechanisms: ['BETA_RECEPTOR_BLOCKADE', 'HEART_RATE_REDUCTION', 'BLOOD_PRESSURE_LOWERING', 'ARRHYTHMIA_PREVENTION'],
    description: 'Бета-блокаторы — бисопролол/метопролол, снижают ЧСС и АД. На курсе — контроль пульса и АД.',
    synergies: [],
    conflicts: [
      { with: "stimulant_complex", effect: "", mechanism: "", severity: "HIGH" },
      { with: "potassium", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Пульс/АД', when: 'Каждые 2 нед', targetRange: 'пульс 60-70' }
    ],
    contraindications: ['Бронхиальная астма (неселективные)'],
    sideEffects: ['Брадикардия', 'Усталость', 'Редко: бронхоспазм'],
    dosage: { mg: 5, timing: '1x/д', form: 'бисопролол 5 мг' },
    bestForCourse: false,
  },
  diuretic_drugs: {
    id: 'diuretic_drugs',
    name: 'Diuretic Drugs',
    nameRu: 'Диуретики',
    tier: 'specialty',
    category: ['pharma', 'cardioprotector'],
    forms: [
      { id: 'diuretic_drugs', name: 'Diuretic Drugs', nameRu: 'Диуретик (по назначению врача)', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['KIDNEYS', 'HEART'],
    systems: ['renal', 'cardio'],
    mechanisms: ['FLUID_REMOVAL', 'POTASSIUM_SPARING', 'BLOOD_PRESSURE_LOWERING', 'EDEMA_REDUCTION'],
    description: 'Диуретики — фуросемид/гидрохлоротиазид для снятия отёков. На курсе — контроль АД и отёков.',
    synergies: [
      { with: "calcium", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "electrolyte_complex", effect: "", mechanism: "", severity: "LOW" },
      { with: "magnesium", effect: "", mechanism: "", severity: "HIGH" },
      { with: "potassium", effect: "", mechanism: "", severity: "LOW" },
      { with: "potassium", effect: "", mechanism: "", severity: "HIGH" },
      { with: "calcium", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Калий/Креатинин', when: 'Каждые 2 нед', targetRange: 'К+ 4.0-5.0' }
    ],
    contraindications: ['Анурия', 'Тяжёлая почечная недостаточность'],
    sideEffects: ['Гипокалиемия', 'Дегидратация', 'Мышечные судороги'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'диуретик (по назначению)' },
    bestForCourse: false,
  },
  immunosuppressant_drugs: {
    id: 'immunosuppressant_drugs',
    name: 'Immunosuppressant Drugs',
    nameRu: 'Иммунодепрессанты',
    tier: 'specialty',
    category: ['pharma', 'immunomodulator'],
    forms: [
      { id: 'immunosuppressant_drugs', name: 'Immunosuppressant Drugs', nameRu: 'Иммунодепрессант (по назначению врача)', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['IMMUNE_SYSTEM', 'KIDNEYS', 'HEART'],
    systems: ['immune', 'renal'],
    mechanisms: ['IMMUNE_SUPPRESSION', 'ANTI_INFLAMMATORY', 'AUTOIMMUNE_TREATMENT', 'TRANSPLANT_PROTECTION'],
    description: 'Иммунодепрессанты — циклоспорин/такролимус, подавляют иммунитет. Только по строгим показаниям.',
    synergies: [],
    conflicts: [
      { with: "folate", effect: "", mechanism: "", severity: "HIGH" },
      { with: "berberine", effect: "", mechanism: "", severity: "HIGH" },
      { with: "quercetin", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Иммунограмма', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Активные инфекции', 'Беременность'],
    sideEffects: ['Инфекции', 'Нефротоксичность', 'Увеличение веса'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'иммунодепрессант (по назначению)' },
    bestForCourse: false,
  },
  antibiotic_drugs: {
    id: 'antibiotic_drugs',
    name: 'Antibiotic Drugs',
    nameRu: 'Антибиотики',
    tier: 'specialty',
    category: ['pharma', 'antimicrobial'],
    forms: [
      { id: 'antibiotic_drugs', name: 'Antibiotic Drugs', nameRu: 'Антибиотик (по назначению врача)', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['GUT', 'IMMUNE_SYSTEM', 'REPRODUCTIVE'],
    systems: ['gastrointestinal', 'immune', 'reproductive'],
    mechanisms: ['BACTERIAL_INFECTION_TREATMENT', 'GUT_FLORA_DISRUPTION', 'IMMUNE_MODULATION', 'INFECTION_PREVENTION'],
    description: 'Антибиотики — для лечения инфекций на курсе. Обязательно с пробиотиками для защиты микрофлоры.',
    synergies: [],
    conflicts: [
      { with: "nac", effect: "", mechanism: "", severity: "LOW" },
      { with: "probiotics", effect: "", mechanism: "", severity: "HIGH" },
      { with: "berberine", effect: "", mechanism: "", severity: "LOW" },
      { with: "quercetin", effect: "", mechanism: "", severity: "LOW" },
      { with: "vitamin_c", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 2 нед' }
    ],
    contraindications: ['Аллергия на пенициллины (для бета-лактамов)'],
    sideEffects: ['Диарея', 'Дисбактериоз', 'Кандидоз'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'антибиотик (по назначению)' },
    bestForCourse: false,
  },
  antihistamine_drugs: {
    id: 'antihistamine_drugs',
    name: 'Antihistamine Drugs',
    nameRu: 'Антигистаминные препараты',
    tier: 'standard',
    category: ['pharma', 'immunomodulator'],
    forms: [
      { id: 'antihistamine_drugs', name: 'Antihistamine Drugs', nameRu: 'Цетиризин 10 мг', dose: '10 мг 2x/д', best: true },
      { id: 'antihistamine_drugs_2', name: 'Antihistamine Drugs', nameRu: 'Лоратадин 10 мг', dose: '10 мг', best: false }
    ],
    organs: ['IMMUNE_SYSTEM', 'LUNGS', 'SKIN'],
    systems: ['immune'],
    mechanisms: ['H1_RECEPTOR_BLOCKADE', 'ALLERGY_REDUCTION', 'ITCHING_RELIEF', 'SLEEP_IMPROVEMENT'],
    description: 'Антигистаминные — цетиризин/лоратадин для снижения аллергических реакций на курсе.',
    synergies: [
      { with: "quercetin", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "stimulant_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Аллергические симптомы', when: 'Субъективно' }
    ],
    contraindications: ['Тяжёлая почечная недостаточность'],
    sideEffects: ['Сонливость (I поколение)', 'Сухость во рту'],
    dosage: { mg: 10, timing: '1x/д', form: 'цетиризин 10 мг' },
    bestForCourse: false,
  },
  nsaid_drugs: {
    id: 'nsaid_drugs',
    name: 'NSAID Drugs',
    nameRu: 'НПВС',
    tier: 'specialty',
    category: ['pharma', 'anti_inflammatory'],
    forms: [
      { id: 'nsaid_drugs', name: 'NSAID Drugs', nameRu: 'Ибупрофен 400 мг', dose: '400 мг 2x/д', best: true },
      { id: 'nsaid_drugs_2', name: 'NSAID Drugs', nameRu: 'Напроксен 250 мг', dose: '400 мг', best: false }
    ],
    organs: ['JOINTS', 'MUSCLES', 'STOMACH'],
    systems: ['musculoskeletal', 'gastrointestinal'],
    mechanisms: ['COX_INHIBITION', 'ANTI_INFLAMMATORY', 'ANALGESIC', 'ANTIPYRETIC'],
    description: 'НПВС — ибупрофен/напроксен для снятия боли и воспаления. На курсе — краткосрочно для суставов.',
    synergies: [
      { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "nac", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "curcumin", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "ginger", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "gaba", effect: "", mechanism: "", severity: "HIGH" },
      { with: "lithium", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Креатинин', when: 'Каждые 2 нед' }
    ],
    contraindications: ['Язвенная болезнь', 'Почечная недостаточность'],
    sideEffects: ['Желудочный дискомфорт', 'Риск язвы', 'Нефротоксичность'],
    dosage: { mg: 400, timing: 'с едой (макс 5 дн)', form: 'ибупрофен 400 мг' },
    bestForCourse: false,
  },
  levothyroxine: {
    id: 'levothyroxine',
    name: 'Levothyroxine',
    nameRu: 'Левотироксин',
    tier: 'specialty',
    category: ['pharma', 'hormonal'],
    forms: [
      { id: 'levothyroxine', name: 'Levothyroxine', nameRu: 'Левотироксин 50 мкг', dose: '50 мкг 2x/д', best: true },
      { id: 'levothyroxine_2', name: 'Levothyroxine', nameRu: 'Левотироксин 100 мкг', dose: '50 мкг', best: false }
    ],
    organs: ['THYROID', 'BRAIN', 'HEART'],
    systems: ['endocrine', 'cardio', 'neuro'],
    mechanisms: ['T4_REPLACEMENT', 'THYROID_HORMONE_NORMALIZATION', 'METABOLIC_RATE', 'BMR_REGULATION'],
    description: 'Левотироксин — замещающая терапия при гипотиреозе. Нормализует ТТГ и метаболизм. Только по назначению.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'ТТГ', when: 'Каждые 8 нед', targetRange: '0.5-3.0 мкМЕ/мл' }
    ],
    contraindications: ['Тиреотоксикоз', 'Острый инфаркт'],
    sideEffects: ['Тахикардия при передозировке', 'Остеопороз при длительном'],
    dosage: { mg: 0.05, timing: 'натощак за 30 мин до еды 1x/д', form: 'левотироксин 50 мкг' },
    bestForCourse: false,
  },
  antithyroid_drugs: {
    id: 'antithyroid_drugs',
    name: 'Antithyroid Drugs',
    nameRu: 'Антитиреоидные препараты',
    tier: 'specialty',
    category: ['pharma', 'hormonal'],
    forms: [
      { id: 'antithyroid_drugs', name: 'Antithyroid Drugs', nameRu: 'Тиамазол 10 мг', dose: '10 мг 2x/д', best: true }
    ],
    organs: ['THYROID'],
    systems: ['endocrine'],
    mechanisms: ['THYROID_HORMONE_SYNTHESIS_INHIBITION', 'T3_T4_LOWERING', 'HYPERTHYROIDISM_TREATMENT', 'METABOLIC_RATE_REDUCTION'],
    description: 'Антитиреоидные препараты — тирозол/пропилтиоурацил для лечения гипертиреоза. Только по назначению.',
    synergies: [],
    conflicts: [
      { with: "iodine", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'ТТГ/Т3/Т4', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Агранулоцитоз в анамнезе'],
    sideEffects: ['Кожная сыпь', 'Агранулоцитоз (редко)', 'Зоб'],
    dosage: { mg: 10, timing: 'с едой 2x/д', form: 'тиамазол 10 мг' },
    bestForCourse: false,
  },
  postbiotics: {
    id: 'postbiotics',
    name: 'Postbiotics',
    nameRu: 'Постбиотики',
    tier: 'standard',
    category: ['gut', 'immunomodulator'],
    forms: [
      { id: 'postbiotics', name: 'Postbiotics', nameRu: 'Постбиотик комплекс 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['GUT', 'IMMUNE_SYSTEM', 'BRAIN'],
    systems: ['gastrointestinal', 'immune'],
    mechanisms: ['GUT_BARRIER_STRENGTHENING', 'ANTI_INFLAMMATORY', 'IMMUNE_REGULATION', 'MICROBIOME_SUPPORT'],
    description: 'Постбиотики — метаболиты пробиотиков (бутират, лактат, короткоцепочечные кислоты). Укрепляют кишечный барьер.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Микрофлора', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: вздутие при начале'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'постбиотик комплекс 500 мг' },
    bestForCourse: false,
  },
  paraprobiotics: {
    id: 'paraprobiotics',
    name: 'Paraprobiotics',
    nameRu: 'Парабиотики',
    tier: 'standard',
    category: ['gut', 'immunomodulator'],
    forms: [
      { id: 'paraprobiotics', name: 'Paraprobiotics', nameRu: 'Парабиотик комплекс 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['GUT', 'IMMUNE_SYSTEM'],
    systems: ['gastrointestinal', 'immune'],
    mechanisms: ['IMMUNE_REGULATION', 'ANTI_INFLAMMATORY', 'GUT_BARRIER_INTEGRITY', 'MICROBIOME_BALANCE'],
    description: 'Парабиотики — инактивированные пробиотические штаммы, обладают иммуномодулирующим действием без риска для иммунокомпрометированных.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Микрофлора', when: 'Субъективно' }
    ],
    contraindications: ['Иммунокомпрометация (безопасно)'],
    sideEffects: ['Редко: вздутие'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'парабиотик комплекс 500 мг' },
    bestForCourse: false,
  },
  resistant_starch: {
    id: 'resistant_starch',
    name: 'Resistant Starch',
    nameRu: 'Резистентный крахмал',
    tier: 'standard',
    category: ['gut', 'metabolic'],
    forms: [
      { id: 'resistant_starch', name: 'Resistant Starch', nameRu: 'Резистентный крахмал 20 г', dose: '20 г 2x/д', best: true },
      { id: 'resistant_starch_2', name: 'Resistant Starch', nameRu: 'Резистентный крахмал (картофельный) 15 г', dose: '20 г', best: false }
    ],
    organs: ['GUT', 'LIVER', 'PANCREAS'],
    systems: ['gastrointestinal', 'metabolic'],
    mechanisms: ['BUTYRATE_PRODUCTION', 'INSULIN_SENSITIVITY', 'GUT_FLORA_SUPPORT', 'FAT_OXIDATION'],
    description: 'Резистентный крахмал — пребиотик, ферментируется кишечной микрофлорой с образованием бутирата. Улучшает инсулиновую чувствительность.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Вздутие при начале'],
    dosage: { mg: 20000, timing: 'с едой 1x/д', form: 'резистентный крахмал 20 г' },
    bestForCourse: false,
  },
  beta_glucan: {
    id: 'beta_glucan',
    name: 'Beta Glucan',
    nameRu: 'Бета-глюкан',
    tier: 'standard',
    category: ['gut', 'immunomodulator'],
    forms: [
      { id: 'beta_glucan', name: 'Beta Glucan', nameRu: 'Бета-глюкан 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['GUT', 'IMMUNE_SYSTEM', 'HEART'],
    systems: ['gastrointestinal', 'immune', 'cardio'],
    mechanisms: ['IMMUNE_ACTIVATION', 'CHOLESTEROL_LOWERING', 'GUT_FLORA_SUPPORT', 'ANTI_INFLAMMATORY'],
    description: 'Бета-глюкан — полисахарид из овса/грибов, активирует иммунитет и снижает холестерин. На курсе — иммунитет и сосуды.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: вздутие'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'бета-глюкан 500 мг' },
    bestForCourse: false,
  },
  fiber: {
    id: 'fiber',
    name: 'Fiber',
    nameRu: 'Клетчатка (пищевые волокна)',
    tier: 'standard',
    category: ['gut', 'metabolic'],
    forms: [
      { id: 'fiber', name: 'Fiber', nameRu: 'Псиллиум 5 г', dose: '10 г 2x/д', best: true },
      { id: 'fiber_2', name: 'Fiber', nameRu: 'Псиллиум + Пребиотик комплекс 5 г', dose: '10 г', best: false }
    ],
    organs: ['GUT', 'HEART', 'PANCREAS'],
    systems: ['gastrointestinal', 'metabolic', 'cardio'],
    mechanisms: ['GUT_MOTILITY', 'CHOLESTEROL_LOWERING', 'INSULIN_SENSITIVITY', 'SATIETY'],
    description: 'Клетчатка — пищевые волокна для нормализации моторики кишечника, снижения холестерина и контроля глюкозы.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Стул', when: 'Субъективно' }
    ],
    contraindications: ['Кишечная непроходимость'],
    sideEffects: ['Вздутие при начале', 'Метеоризм'],
    dosage: { mg: 10000, timing: 'с едой 2x/д', form: 'псиллиум 5 г' },
    bestForCourse: false,
  },
  hmo_prebiotics: {
    id: 'hmo_prebiotics',
    name: 'HMO Prebiotics',
    nameRu: 'Олигосахариды грудного молока',
    tier: 'advanced',
    category: ['gut', 'immunomodulator'],
    forms: [
      { id: 'hmo_prebiotics', name: 'HMO Prebiotics', nameRu: 'HMO пребиотик 1 г', dose: '1 г 2x/д', best: true },
      { id: 'hmo_prebiotics_2', name: 'HMO Prebiotics', nameRu: '2-FL пребиотик 1 г', dose: '1 г', best: false }
    ],
    organs: ['GUT', 'IMMUNE_SYSTEM', 'BRAIN'],
    systems: ['gastrointestinal', 'immune', 'neuro'],
    mechanisms: ['BIFIDOBACTERIA_GROWTH', 'GUT_BARRIER_STRENGTHENING', 'IMMUNE_REGULATION', 'BRAIN_GUT_AXIS'],
    description: 'Олигосахариды грудного молока (HMO) — пребиотики, стимулирующие рост бифидобактерий. Поддержка микробиома и иммунитета.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Микрофлора', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: вздутие при начале'],
    dosage: { mg: 1000, timing: 'с едой 1x/д', form: 'HMO пребиотик 1 г' },
    bestForCourse: false,
  },
  lactate: {
    id: 'lactate',
    name: 'Lactate',
    nameRu: 'Лактат (молочная кислота)',
    tier: 'standard',
    category: ['gut', 'metabolic'],
    forms: [
      { id: 'lactate', name: 'Lactate', nameRu: 'Лактат натрия 1000 мг', dose: '1 г 2x/д', best: true }
    ],
    organs: ['MUSCLES', 'LIVER', 'GUT'],
    systems: ['musculoskeletal', 'gastrointestinal'],
    mechanisms: ['ENERGY_PRODUCTION', 'GUT_FLORA_SUPPORT', 'MITOCHONDRIAL_FUNCTION', 'MUSCLE_RECOVERY'],
    description: 'Лактат — молочная кислота, используется как энергетический субстрат. Улучшает восстановление и митохондриальную функцию.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'КФК', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 1x/д', form: 'лактат натрия 1000 мг' },
    bestForCourse: false,
  },
  digestive_enzymes: {
    id: 'digestive_enzymes',
    name: 'Digestive Enzymes',
    nameRu: 'Пищеварительные ферменты',
    tier: 'standard',
    category: ['gut', 'hepatoprotector'],
    forms: [
      { id: 'digestive_enzymes', name: 'Digestive Enzymes', nameRu: 'Пищеварительные ферменты 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'digestive_enzymes_2', name: 'Digestive Enzymes', nameRu: 'Ферментный комплекс форте', dose: '500 мг', best: false }
    ],
    organs: ['STOMACH', 'PANCREAS', 'GUT'],
    systems: ['gastrointestinal'],
    mechanisms: ['DIGESTION_IMPROVEMENT', 'PROTEIN_ABSORPTION', 'NUTRIENT_BIOAVAILABILITY', 'GUT_PROTECTION'],
    description: 'Пищеварительные ферменты — амилаза, протеаза, липаза для улучшения усвоения белка и нутриентов. На курсе — ЖКТ.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Пищеварение', when: 'Субъективно' }
    ],
    contraindications: ['Острый панкреатит'],
    sideEffects: ['Редко: изжога'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'пищеварительные ферменты 500 мг' },
    bestForCourse: false,
  },
  zinc_carnosine: {
    id: 'zinc_carnosine',
    name: 'Zinc Carnosine',
    nameRu: 'Цинк-карнозин',
    tier: 'standard',
    category: ['gut', 'immunomodulator'],
    forms: [
      { id: 'zinc_carnosine', name: 'Zinc Carnosine', nameRu: 'Цинк-карнозин 75 мг', dose: '75 мг 2x/д', best: true },
      { id: 'zinc_carnosine_2', name: 'Zinc Carnosine', nameRu: 'Цинк-карнозин + Пищеварительные ферменты', dose: '75 мг', best: false }
    ],
    organs: ['STOMACH', 'GUT', 'IMMUNE_SYSTEM'],
    systems: ['gastrointestinal', 'immune'],
    mechanisms: ['GUT_BARRIER_STRENGTHENING', 'ANTI_INFLAMMATORY', 'WOUND_HEALING', 'IMMUNE_SUPPORT'],
    description: 'Цинк-карнозин — комплекс цинка и карнозина, заживляет слизистую желудка и кишечника. На курсе — защита ЖКТ.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Гастроскопия', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: тошнота'],
    dosage: { mg: 75, timing: 'с едой 2x/д', form: 'цинк-карнозин 75 мг' },
    bestForCourse: false,
  },
  colostrum: {
    id: 'colostrum',
    name: 'Colostrum',
    nameRu: 'Молозиво',
    tier: 'standard',
    category: ['gut', 'immunomodulator'],
    forms: [
      { id: 'colostrum', name: 'Colostrum', nameRu: 'Молозиво 3 г', dose: '3 г 2x/д', best: true },
      { id: 'colostrum_2', name: 'Colostrum', nameRu: 'Молозиво IgG 500 мг', dose: '3 г', best: false }
    ],
    organs: ['GUT', 'IMMUNE_SYSTEM', 'MUSCLES'],
    systems: ['gastrointestinal', 'immune'],
    mechanisms: ['IMMUNE_REGULATION', 'GUT_BARRIER_STRENGTHENING', 'GROWTH_FACTORS', 'ANTI_INFLAMMATORY'],
    description: 'Молозиво — первый секрет молочных желёз, богат иммуноглобулинами и факторами роста. Поддержка иммунитета и ЖКТ.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Молочная аллергия'],
    sideEffects: ['Редко: вздутие при начале'],
    dosage: { mg: 3000, timing: 'с едой 2x/д', form: 'молозиво 3 г' },
    bestForCourse: false,
  },
  ahcc: {
    id: 'ahcc',
    name: 'AHCC',
    nameRu: 'AHCC (Активированный гексозный коррелят)',
    tier: 'advanced',
    category: ['mushroom', 'immunomodulator'],
    forms: [
      { id: 'ahcc', name: 'AHCC', nameRu: 'AHCC 1000 мг', dose: '1 г 2x/д', best: true },
      { id: 'ahcc_2', name: 'AHCC', nameRu: 'AHCC 500 мг', dose: '1 г', best: false }
    ],
    organs: ['IMMUNE_SYSTEM', 'LIVER'],
    systems: ['immune', 'hepatic'],
    mechanisms: ['IMMUNE_ACTIVATION', 'NK_CELL_INCREASE', 'LIVER_PROTECTION', 'ANTI_INFLAMMATORY'],
    description: 'AHCC — экстракт грибов шиитаке, активирует NK-клетки и макрофаги. Поддержка иммунитета и печени на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'NK-клетки', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'натощак 2x/д', form: 'AHCC 1000 мг' },
    bestForCourse: false,
  },
  cortisol: {
    id: 'cortisol',
    name: 'Cortisol',
    nameRu: 'Кортизол (маркер)',
    tier: 'standard',
    category: ['hormonal', 'marker'],
    forms: [
      { id: 'cortisol', name: 'Cortisol', nameRu: 'Нет (маркер)', dose: '0 мкг 2x/д', best: true }
    ],
    organs: ['ADRENALS', 'MUSCLES', 'BRAIN'],
    systems: ['endocrine', 'musculoskeletal', 'neuro'],
    mechanisms: ['STRESS_RESPONSE', 'ANTI_INFLAMMATORY', 'METABOLIC_REGULATION', 'MORNING_CORTISOL_RHYTHM'],
    description: 'Кортизол — маркер стрессовой реакции надпочечников. Не добавка, а показатель для контроля на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Кортизол утренний', when: 'Каждые 8 нед', targetRange: '6-23 мкг/дл' }
    ],
    contraindications: [],
    sideEffects: ['Не препарат — маркер для контроля'],
    dosage: { mg: 0, timing: 'контроль маркера', form: 'кортизол сыворотки (анализ)' },
    bestForCourse: false,
  },
  adrenaline: {
    id: 'adrenaline',
    name: 'Adrenaline',
    nameRu: 'Адреналин (маркер)',
    tier: 'standard',
    category: ['hormonal', 'marker'],
    forms: [
      { id: 'adrenaline', name: 'Adrenaline', nameRu: 'Нет (маркер)', dose: '0 мкг 2x/д', best: true }
    ],
    organs: ['ADRENALS', 'HEART'],
    systems: ['endocrine', 'cardio'],
    mechanisms: ['FIGHT_OR_FLIGHT', 'HEART_RATE_INCREASE', 'BRONCHODILATION', 'GLUCOSE_ELEVATION'],
    description: 'Адреналин — маркер симпатической активации. Не добавка, а показатель стресс-реакции для контроля на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Адреналин', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Не препарат — маркер для контроля'],
    dosage: { mg: 0, timing: 'контроль маркера', form: 'адреналин (анализ)' },
    bestForCourse: false,
  },
  endocrine_marker: {
    id: 'endocrine_marker',
    name: 'Endocrine Marker',
    nameRu: 'Эндокринный маркер (комплекс)',
    tier: 'standard',
    category: ['hormonal', 'marker'],
    forms: [
      { id: 'endocrine_marker', name: 'Endocrine Marker', nameRu: 'Нет (маркер)', dose: '0 мкг 2x/д', best: true }
    ],
    organs: ['ADRENALS', 'PITUITARY', 'THYROID'],
    systems: ['endocrine'],
    mechanisms: ['HORMONE_BALANCE', 'CORTISOL_REGULATION', 'THYROID_FUNCTION', 'REPRODUCTIVE_HORMONES'],
    description: 'Эндокринный маркер — комплексный анализ: кортизол, ТТГ, тестостерон, эстрадиол, пролактин. Для контроля на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Эндокринный профиль', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Не препарат — маркер для контроля'],
    dosage: { mg: 0, timing: 'контроль маркера', form: 'эндокринный профиль (анализ)' },
    bestForCourse: false,
  },
  neurosteroid: {
    id: 'neurosteroid',
    name: 'Neurosteroid',
    nameRu: 'Нейростероид (маркер)',
    tier: 'standard',
    category: ['hormonal', 'marker', 'neuroprotector'],
    forms: [
      { id: 'neurosteroid', name: 'Neurosteroid', nameRu: 'Нет (маркер)', dose: '0 мкг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES', 'ADRENALS'],
    systems: ['neuro', 'endocrine'],
    mechanisms: ['GABA_MODULATION', 'NEUROPROTECTION', 'STRESS_RESPONSE', 'MOOD_REGULATION'],
    description: 'Нейростероид — маркер нейроэндокринного баланса (ДГЭА, прегненолон, аллопрегнанолон). Для контроля на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'ДГЭА-S', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Не препарат — маркер для контроля'],
    dosage: { mg: 0, timing: 'контроль маркера', form: 'нейростероидный профиль (анализ)' },
    bestForCourse: false,
  },
  glucagon: {
    id: 'glucagon',
    name: 'Glucagon',
    nameRu: 'Глюкагон (маркер)',
    tier: 'standard',
    category: ['hormonal', 'marker'],
    forms: [
      { id: 'glucagon', name: 'Glucagon', nameRu: 'Нет (маркер)', dose: '0 мкг 2x/д', best: true }
    ],
    organs: ['PANCREAS', 'LIVER'],
    systems: ['metabolic', 'hepatic'],
    mechanisms: ['GLUCOSE_ELEVATION', 'Glycogenolysis', 'KETOGENESIS_REGULATION', 'INSULIN_COUNTER_REGULATION'],
    description: 'Глюкагон — маркер метаболизма, контр-инсулиновый гормон. Не добавка, а показатель для контроля на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Глюкагон', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Не препарат — маркер для контроля'],
    dosage: { mg: 0, timing: 'контроль маркера', form: 'глюкагон (анализ)' },
    bestForCourse: false,
  },
  water: {
    id: 'water',
    name: 'Water',
    nameRu: 'Вода (гидратация)',
    tier: 'core',
    category: ['hydration', 'metabolic'],
    forms: [
      { id: 'water', name: 'Water', nameRu: 'Вода 2.5 л/день', dose: '2.5 г 2x/д', best: true },
      { id: 'water_2', name: 'Water', nameRu: 'Вода + Электролиты', dose: '2.5 г', best: false }
    ],
    organs: ['KIDNEYS', 'HEART', 'MUSCLES'],
    systems: ['renal', 'cardio', 'musculoskeletal'],
    mechanisms: ['HYDRATION', 'TEMPERATURE_REGULATION', 'NUTRIENT_TRANSPORT', 'WASTE_REMOVAL'],
    description: 'Вода — основа гидратации и метаболизма. 30-40 мл/кг/день — обязательна на курсе для всех процессов.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Электролиты', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Нет'],
    sideEffects: ['Нет'],
    dosage: { mg: 2500, timing: 'в течение дня', form: 'вода 2.5 л/день' },
    bestForCourse: true,
  },
  nmn: {
    id: 'nmn',
    name: 'NMN',
    nameRu: 'NMN (Никотинамид мононуклеотид)',
    tier: 'advanced',
    category: ['anti_aging', 'metabolic'],
    forms: [
      { id: 'nmn', name: 'NMN', nameRu: 'NMN 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'nmn_2', name: 'NMN', nameRu: 'NMN 1000 мг', dose: '500 мг', best: false }
    ],
    organs: ['MITOCHONDRIA', 'CELLS', 'BRAIN'],
    systems: ['metabolic', 'neuro'],
    mechanisms: ['NAD_PRODUCTION', 'MITOCHONDRIAL_FUNCTION', 'ANTI_AGING', 'ENERGY_PRODUCTION'],
    description: 'NMN — предшественник NAD+, улучшает митохондриальную функцию и продлевает жизнь клеток. Анти-возрастной.',
    synergies: [
      { with: "resveratrol", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "nmn", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'NAD+', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: желудочный дискомфорт при начале'],
    dosage: { mg: 500, timing: 'натощак 1x/д', form: 'NMN 500 мг' },
    bestForCourse: false,
  },
  omega3: {
    id: 'omega3',
    name: 'Omega-3',
    nameRu: 'Омега-3 (EPA/DHA)',
    tier: 'core',
    category: ['fatty_acid', 'cardioprotector'],
    forms: [
      { id: 'omega3', name: 'Omega-3', nameRu: 'Омега-3 1000 мг EPA+DHA', dose: '2 г 2x/д', best: true },
      { id: 'omega3_2', name: 'Omega-3', nameRu: 'Омега-3 Премиум 1200 мг', dose: '2 г', best: false },
      { id: 'omega3_3', name: 'Omega-3', nameRu: 'Омега-3 Ультра 1500 мг', dose: '2 г', best: false }
    ],
    organs: ['HEART', 'BRAIN', 'BLOOD_VESSELS'],
    systems: ['cardio', 'neuro'],
    mechanisms: ['EPA_ANTI_INFLAMMATORY', 'DHA_BRAIN_STRUCTURE', 'TRIGLYCERIDE_LOWERING', 'BLOOD_PRESSURE_REGULATION'],
    description: 'Омега-3 (EPA+DHA) — незаменимые жирные кислоты, кардиопротектор и нейропротектор. Снижает триглицериды и воспаление.',
    synergies: [
      { with: "nsaid_drugs", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "vitamin_d3", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "coq10", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "phosphatidylcholine", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "vitamin_e", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "astaxanthin", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega9", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "egcg", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "polyphenol_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "mushroom_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "lutein", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "anthocyanins", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "antioxidant_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "peptide_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "brand_complex", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "anticoagulant_drugs", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед', targetRange: 'ТГ<1.7 ммоль/л' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)', 'Рыбная аллергия'],
    sideEffects: ['Рыбная отрыжка', 'Диарея при высоких дозах'],
    dosage: { mg: 2000, timing: 'с едой 2x/д', form: 'Омега-3 1000 мг EPA+DHA' },
    bestForCourse: true,
  },
  adaptogen_complex: {
    id: 'adaptogen_complex',
    name: 'Adaptogen Complex',
    nameRu: 'Адаптогенный комплекс',
    tier: 'advanced',
    category: ['adaptogen', 'neuroprotector'],
    forms: [
      { id: 'adaptogen_complex', name: 'Adaptogen Complex', nameRu: 'Адаптогенный комплекс 1000 мг', dose: '1 г 2x/д', best: true },
      { id: 'adaptogen_complex_2', name: 'Adaptogen Complex', nameRu: 'Адаптогенный комплекс форте', dose: '1 г', best: false }
    ],
    organs: ['ADRENALS', 'BRAIN', 'MUSCLES'],
    systems: ['endocrine', 'neuro'],
    mechanisms: ['STRESS_ADAPTATION', 'CORTISOL_REGULATION', 'ENERGY_PRODUCTION', 'IMMUNE_SUPPORT'],
    description: 'Адаптогенный комплекс — комбинация ашваганды, родиолы, элеутерококка для комплексной антистресс-поддержки.',
    synergies: [
      { with: "schisandra", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Кортизол', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Гипертиреоз', 'Беременность'],
    sideEffects: ['Редко: возбуждение при передозировке'],
    dosage: { mg: 1000, timing: 'утром с едой', form: 'адаптогенный комплекс 1000 мг' },
    bestForCourse: false,
  },
  astragalus: {
    id: 'astragalus',
    name: 'Astragalus',
    nameRu: 'Астрагал',
    tier: 'standard',
    category: ['adaptogen', 'immunomodulator'],
    forms: [
      { id: 'astragalus', name: 'Astragalus', nameRu: 'Экстракт астрагала 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['IMMUNE_SYSTEM', 'HEART', 'KIDNEYS'],
    systems: ['immune', 'cardio', 'renal'],
    mechanisms: ['IMMUNE_ACTIVATION', 'ANTI_AGING', 'TELOMERE_SUPPORT', 'KIDNEY_PROTECTION'],
    description: 'Астрагал — адаптоген и иммуномодулятор, поддерживает теломеры и защищает почки. На курсе — иммунитет и анти-возраст.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт астрагала 500 мг' },
    bestForCourse: false,
  },
  oxytocin: {
    id: 'oxytocin',
    name: 'Oxytocin',
    nameRu: 'Окситоцин',
    tier: 'specialty',
    category: ['hormonal', 'neuroprotector'],
    forms: [
      { id: 'oxytocin', name: 'Oxytocin', nameRu: 'Окситоцин интраназально 40 МЕ', dose: '40 мкг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'REPRODUCTIVE', 'HEART'],
    systems: ['neuro', 'reproductive'],
    mechanisms: ['BONDING_ENHANCEMENT', 'ANXIOLYTIC', 'MUSCLE_REGENERATION', 'WOUND_HEALING'],
    description: 'Окситоцин — гормон привязанности, снижает тревожность и улучшает восстановление мышц. На курсе — антистресс.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Настроение', when: 'Субъективно' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: головная боль'],
    dosage: { mg: 0.04, timing: 'интраназально 1x/д', form: 'окситоцин 40 МЕ/доза' },
    bestForCourse: false,
  },
  dhea: {
    id: 'dhea',
    name: 'DHEA',
    nameRu: 'ДГЭА (Дегидроэпиандростерон)',
    tier: 'advanced',
    category: ['hormonal', 'anti_aging'],
    forms: [
      { id: 'dhea', name: 'DHEA', nameRu: 'ДГЭА 25 мг', dose: '25 мг 2x/д', best: true },
      { id: 'dhea_2', name: 'DHEA', nameRu: 'ДГЭА 50 мг', dose: '25 мг', best: false }
    ],
    organs: ['ADRENALS', 'BRAIN', 'MUSCLES'],
    systems: ['endocrine', 'neuro', 'musculoskeletal'],
    mechanisms: ['DHEA_PRODUCTION', 'ANDROGEN_PRECURSOR', 'CORTISOL_BALANCE', 'ANTI_AGING'],
    description: 'ДГЭА — предшественник половых гормонов, снижается с возрастом. На курсе — гормональный баланс и анти-возраст.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'ДГЭА-S', when: 'Каждые 8 нед', targetRange: '150-420 мкг/дл' }
    ],
    contraindications: ['Рак простаты', 'Рак молочной железы'],
    sideEffects: ['Акне при высоких дозах', 'У женщин: гирсутизм'],
    dosage: { mg: 25, timing: 'утром с едой', form: 'ДГЭА 25 мг' },
    bestForCourse: false,
  },
  estradiol: {
    id: 'estradiol',
    name: 'Estradiol',
    nameRu: 'Эстрадиол (маркер)',
    tier: 'standard',
    category: ['hormonal', 'marker'],
    forms: [
      { id: 'estradiol', name: 'Estradiol', nameRu: 'Нет (маркер)', dose: '0 мкг 2x/д', best: true }
    ],
    organs: ['REPRODUCTIVE', 'BONES', 'HEART'],
    systems: ['reproductive', 'cardio'],
    mechanisms: ['BONE_DENSITY_REGULATION', 'CARDIOVASCULAR_PROTECTION', 'REPRODUCTIVE_FUNCTION', 'MOOD_REGULATION'],
    description: 'Эстрадиол — основной эстроген, маркер феминизации на курсе. Контроль для корректировки ПКТ и антиэстрогенов.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Эстрадиол', when: 'Каждые 4 нед', targetRange: '10-40 пг/мл (муж.)' }
    ],
    contraindications: [],
    sideEffects: ['Не препарат — маркер для контроля'],
    dosage: { mg: 0, timing: 'контроль маркера', form: 'эстрадиол (анализ)' },
    bestForCourse: false,
  },
  progesterone: {
    id: 'progesterone',
    name: 'Progesterone',
    nameRu: 'Прогестерон (маркер)',
    tier: 'standard',
    category: ['hormonal', 'marker'],
    forms: [
      { id: 'progesterone', name: 'Progesterone', nameRu: 'Нет (маркер)', dose: '0 мкг 2x/д', best: true }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive', 'neuro'],
    mechanisms: ['PROGESTERONE_BALANCE', 'NEUROPROTECTION', 'ANTI_INFLAMMATORY', 'SLEEP_REGULATION'],
    description: 'Прогестерон — маркер для контроля на курсе. У мужчин — маркер подавления оси ГРГ-ЛГ-ФСГ.',
    synergies: [],
    conflicts: [
      { with: "holy_basil", effect: "", mechanism: "", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Прогестерон', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Не препарат — маркер для контроля'],
    dosage: { mg: 0, timing: 'контроль маркера', form: 'прогестерон (анализ)' },
    bestForCourse: false,
  },
  insulin: {
    id: 'insulin',
    name: 'Insulin',
    nameRu: 'Инсулин',
    tier: 'specialty',
    category: ['pharma', 'metabolic'],
    forms: [
      { id: 'insulin', name: 'Insulin', nameRu: 'Инсулин (по назначению врача)', dose: '10 мкг 2x/д', best: true }
    ],
    organs: ['PANCREAS', 'MUSCLES', 'LIVER'],
    systems: ['metabolic', 'musculoskeletal'],
    mechanisms: ['GLUCOSE_UPTAKE', 'PROTEIN_SYNTHESIS', 'GLYCOGEN_STORAGE', 'ANABOLIC_EFFECT'],
    description: 'Инсулин — анаболический гормон, ускоряет транспорт глюкозы и аминокислот в мышцы. Только по назначению!',
    synergies: [
      { with: "ipamorelin", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Глюкоза', when: 'Каждые 4 нед', targetRange: '3.5-5.5 ммоль/л' }
    ],
    contraindications: ['Гипогликемия', 'Диабет типа 1'],
    sideEffects: ['Гипогликемия', 'Набор жира при избытке'],
    dosage: { mg: 0.01, timing: 'индивидуально п/к', form: 'инсулин (по назначению)' },
    bestForCourse: false,
  },
  vasopressin: {
    id: 'vasopressin',
    name: 'Vasopressin',
    nameRu: 'Вазопрессин',
    tier: 'specialty',
    category: ['hormonal', 'neuroprotector'],
    forms: [
      { id: 'vasopressin', name: 'Vasopressin', nameRu: 'Вазопрессин интраназально', dose: '20 мкг 2x/д', best: true }
    ],
    organs: ['KIDNEYS', 'BRAIN', 'BLOOD_VESSELS'],
    systems: ['renal', 'neuro'],
    mechanisms: ['WATER_RETENTION', 'BLOOD_PRESSURE_REGULATION', 'MEMORY_ENHANCEMENT', 'SOCIAL_BONDING'],
    description: 'Вазопрессин — антидиуретический гормон, регулирует водный баланс и память. На курсе — контроль гидратации.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Натрий/Осмолярность', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Синдром неадекватной секреции АДГ'],
    sideEffects: ['Задержка воды', 'Гипонатриемия'],
    dosage: { mg: 0.02, timing: 'интраназально 1x/д', form: 'вазопрессин интраназально' },
    bestForCourse: false,
  },
  endocannabinoid: {
    id: 'endocannabinoid',
    name: 'Endocannabinoid',
    nameRu: 'Эндоканнабиноидная система',
    tier: 'standard',
    category: ['neuroprotector', 'immunomodulator'],
    forms: [
      { id: 'endocannabinoid', name: 'Endocannabinoid', nameRu: 'Эндоканнабиноидная поддержка (ПНЖК+терпены)', dose: '0 мкг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'IMMUNE_SYSTEM', 'GUT'],
    systems: ['neuro', 'immune', 'gastrointestinal'],
    mechanisms: ['PAIN_MODULATION', 'APPETITE_REGULATION', 'MOOD_REGULATION', 'ANTI_INFLAMMATORY'],
    description: 'Эндоканнабиноидная система — регулятор боли, аппетита и настроения. Модулируется фитоканнабиноидами и ПНЖК.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Настроение', when: 'Субъективно' }
    ],
    contraindications: [],
    sideEffects: ['Редко: седация'],
    dosage: { mg: 0, timing: 'поддержка системы', form: 'эндоканнабиноидная поддержка' },
    bestForCourse: false,
  },
  pectin: {
    id: 'pectin',
    name: 'Pectin',
    nameRu: 'Пектин',
    tier: 'standard',
    category: ['gut', 'hepatoprotector'],
    forms: [
      { id: 'pectin', name: 'Pectin', nameRu: 'Пектин 5 г', dose: '5 г 2x/д', best: true },
      { id: 'pectin_2', name: 'Pectin', nameRu: 'Яблочный пектин 3 г', dose: '5 г', best: false }
    ],
    organs: ['GUT', 'LIVER', 'BLOOD'],
    systems: ['gastrointestinal', 'hepatic'],
    mechanisms: ['GUT_DETOXIFICATION', 'CHOLESTEROL_LOWERING', 'BILE_ACID_BINDING', 'GUT_FLORA_SUPPORT'],
    description: 'Пектин — растворимое пищевое волокно, связывает токсины и желчные кислоты в кишечнике. На курсе — детокс.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Холестерин', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Вздутие при высоких дозах'],
    dosage: { mg: 5000, timing: 'с едой 2x/д', form: 'пектин 5 г' },
    bestForCourse: false,
  },
  fadogia: {
    id: 'fadogia',
    name: 'Fadogia',
    nameRu: 'Фадогия агрестис',
    tier: 'advanced',
    category: ['hormonal', 'adaptogen'],
    forms: [
      { id: 'fadogia', name: 'Fadogia', nameRu: 'Экстракт фадогии 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['REPRODUCTIVE', 'MUSCLES'],
    systems: ['reproductive', 'musculoskeletal'],
    mechanisms: ['TESTOSTERONE_PRODUCTION', 'LH_STIMULATION', 'LIBIDO_ENHANCEMENT', 'MUSCLE_RECOVERY'],
    description: 'Фадогия агрестис — африканское растение, стимулирует ЛГ и тестостерон. На курсе — либидо и восстановление.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Тестостерон', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Беременность', 'Подростки'],
    sideEffects: ['Редко: желудочный дискомфорт при начале'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт фадогии 500 мг' },
    bestForCourse: false,
  },
  pregnenolone: {
    id: 'pregnenolone',
    name: 'Pregnenolone',
    nameRu: 'Прегненолон',
    tier: 'advanced',
    category: ['hormonal', 'nootropic'],
    forms: [
      { id: 'pregnenolone', name: 'Pregnenolone', nameRu: 'Прегненолон 50 мг', dose: '50 мг 2x/д', best: true },
      { id: 'pregnenolone_2', name: 'Pregnenolone', nameRu: 'Прегненолон 100 мг', dose: '50 мг', best: false }
    ],
    organs: ['ADRENALS', 'BRAIN', 'REPRODUCTIVE'],
    systems: ['endocrine', 'neuro'],
    mechanisms: ['NEUROSTEROID_PRECURSOR', 'MEMORY_ENHANCEMENT', 'CORTISOL_BALANCE', 'ANTI_AGING'],
    description: 'Прегненолон — прегормон, предшественник всех стероидных гормонов. Улучшает память и снижает кортизол на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Прегненолон/Кортизол', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Рак гормонозависимый'],
    sideEffects: ['Редко: бессонница при вечернем приёме'],
    dosage: { mg: 50, timing: 'утром с едой', form: 'прегненолон 50 мг' },
    bestForCourse: false,
  },
  immune_support: {
    id: 'immune_support',
    name: 'Immune Support',
    nameRu: 'Иммунная поддержка (комплекс)',
    tier: 'standard',
    category: ['immunomodulator', 'adaptogen'],
    forms: [
      { id: 'immune_support', name: 'Immune Support', nameRu: 'Иммунный комплекс 1 капсула', dose: '1 мг 2x/д', best: true },
      { id: 'immune_support_2', name: 'Immune Support', nameRu: 'Иммунный комплекс форте', dose: '1 мг', best: false }
    ],
    organs: ['IMMUNE_SYSTEM', 'LIVER', 'BLOOD'],
    systems: ['immune', 'hepatic', 'hematologic'],
    mechanisms: ['IMMUNE_REGULATION', 'ANTI_INFLAMMATORY', 'WHITE_BLOOD_CELL_SUPPORT', 'INFECTION_RESISTANCE'],
    description: 'Иммунная поддержка — комплекс витаминов С, D, цинка, селена и пробиотиков для защиты иммунитета на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1, timing: 'с едой 1x/д', form: 'иммунный комплекс 1 капсула' },
    bestForCourse: false,
  },
  andrographis: {
    id: 'andrographis',
    name: 'Andrographis',
    nameRu: 'Андографис',
    tier: 'standard',
    category: ['immunomodulator', 'hepatoprotector'],
    forms: [
      { id: 'andrographis', name: 'Andrographis', nameRu: 'Экстракт андографиса 200 мг', dose: '200 мг 2x/д', best: true }
    ],
    organs: ['LIVER', 'IMMUNE_SYSTEM', 'BLOOD'],
    systems: ['hepatic', 'immune'],
    mechanisms: ['IMMUNE_ACTIVATION', 'ANTI_INFLAMMATORY', 'LIVER_PROTECTION', 'FEVER_REDUCTION'],
    description: 'Андографис — иммуномодулятор и гепатопротектор, активирует NK-клетки и защищает печень. На курсе — иммунитет.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 200, timing: 'с едой 2x/д', form: 'экстракт андографиса 200 мг' },
    bestForCourse: false,
  },
  boswellia: {
    id: 'boswellia',
    name: 'Boswellia',
    nameRu: 'Босвеллия',
    tier: 'standard',
    category: ['anti_inflammatory', 'joint'],
    forms: [
      { id: 'boswellia', name: 'Boswellia', nameRu: 'Экстракт босвеллии 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'boswellia_2', name: 'Boswellia', nameRu: 'Босвеллия + Куркумин комплекс', dose: '500 мг', best: false }
    ],
    organs: ['JOINTS', 'LUNGS', 'BRAIN'],
    systems: ['musculoskeletal', 'respiratory', 'neuro'],
    mechanisms: ['ANTI_INFLAMMATORY', 'JOINT_PROTECTION', '5_LOX_INHIBITION', 'PAIN_RELIEF'],
    description: 'Босвеллия — мощный ингибитор 5-ЛОГ, противовоспалительное для суставов и лёгких. На курсе — суставы.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Суставы', when: 'Субъективно' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт босвеллии 500 мг' },
    bestForCourse: false,
  },
  cissus: {
    id: 'cissus',
    name: 'Cissus',
    nameRu: 'Циссус',
    tier: 'standard',
    category: ['joint', 'anti_inflammatory'],
    forms: [
      { id: 'cissus', name: 'Cissus', nameRu: 'Экстракт циссуса 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['JOINTS', 'BONES', 'MUSCLES'],
    systems: ['musculoskeletal'],
    mechanisms: ['BONE_HEALING', 'JOINT_PROTECTION', 'ANTI_INFLAMMATORY', 'COLLAGEN_SYNTHESIS'],
    description: 'Циссус — растение для заживления костей и суставов, стимулирует синтез коллагена. На курсе — связки и кости.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Кальций/Кости', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт циссуса 500 мг' },
    bestForCourse: false,
  },
  licorice: {
    id: 'licorice',
    name: 'Licorice',
    nameRu: 'Солодка (глицирризиновая кислота)',
    tier: 'standard',
    category: ['hepatoprotector', 'anti_inflammatory'],
    forms: [
      { id: 'licorice', name: 'Licorice', nameRu: 'Экстракт солодки 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['LIVER', 'ADRENALS', 'GUT'],
    systems: ['hepatic', 'endocrine', 'gastrointestinal'],
    mechanisms: ['ANTI_INFLAMMATORY', 'LIVER_PROTECTION', 'ADRENAL_SUPPORT', 'MUCUS_PROTECTION'],
    description: 'Солодка — гепатопротектор и адаптоген, поддерживает надпочечники и защищает слизистую ЖКТ.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Калий/АД', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Гипертония', 'Гипокалиемия'],
    sideEffects: ['Задержка натрия/воды', 'Повышение АД при длительном'],
    dosage: { mg: 500, timing: 'с едой 2x/д (макс 6 нед)', form: 'экстракт солодки 500 мг' },
    bestForCourse: false,
  },
  stimulant_complex: {
    id: 'stimulant_complex',
    name: 'Stimulant Complex',
    nameRu: 'Стимуляторный комплекс',
    tier: 'advanced',
    category: ['stimulant', 'nootropic'],
    forms: [
      { id: 'stimulant_complex', name: 'Stimulant Complex', nameRu: 'Стимуляторный комплекс 1 капсула', dose: '1 мг 2x/д', best: true },
      { id: 'stimulant_complex_2', name: 'Stimulant Complex', nameRu: 'Стимуляторный комплекс форте', dose: '1 мг', best: false }
    ],
    organs: ['BRAIN', 'HEART', 'MUSCLES'],
    systems: ['neuro', 'cardio'],
    mechanisms: ['CNS_STIMULATION', 'FAT_OXIDATION', 'POWER_OUTPUT', 'FOCUS_ENHANCEMENT'],
    description: 'Стимуляторный комплекс — кофеин+теакрин+L-тирозин для предтренировочного буста. На курсе — энергия и фокус.',
    synergies: [
      { with: "caffeine", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "stimulant_complex", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "tyrosine", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "antihistamine_drugs", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "caffeine", effect: "", mechanism: "", severity: "HIGH" },
      { with: "magnesium", effect: "", mechanism: "", severity: "LOW" },
      { with: "beta_blocker_drugs", effect: "", mechanism: "", severity: "HIGH" },
      { with: "ginseng", effect: "", mechanism: "", severity: "LOW" },
      { with: "rhodiola", effect: "", mechanism: "", severity: "LOW" },
      { with: "huperzine_a", effect: "", mechanism: "", severity: "LOW" },
      { with: "anxiolytic_drugs", effect: "", mechanism: "", severity: "LOW" },
      { with: "melatonin", effect: "", mechanism: "", severity: "HIGH" },
      { with: "stimulant_complex", effect: "", mechanism: "", severity: "HIGH" },
      { with: "pt141", effect: "", mechanism: "", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Пульс/АД', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Тяжёлая гипертензия', 'Аритмия'],
    sideEffects: ['Бессонница при вечернем приёме', 'Тахикардия'],
    dosage: { mg: 1, timing: 'за 30 мин до тренировки', form: 'стимуляторный комплекс 1 капсула' },
    bestForCourse: false,
  },
  lipid_complex: {
    id: 'lipid_complex',
    name: 'Lipid Complex',
    nameRu: 'Липидный комплекс',
    tier: 'standard',
    category: ['fatty_acid', 'cardioprotector'],
    forms: [
      { id: 'lipid_complex', name: 'Lipid Complex', nameRu: 'Липидный комплекс 3 г', dose: '3 г 2x/д', best: true },
      { id: 'lipid_complex_2', name: 'Lipid Complex', nameRu: 'Омега 3-6-9 комплекс', dose: '3 г', best: false }
    ],
    organs: ['HEART', 'BRAIN', 'BLOOD_VESSELS'],
    systems: ['cardio', 'neuro'],
    mechanisms: ['OMEGA3_6_9_BALANCE', 'CHOLESTEROL_LOWERING', 'ANTI_INFLAMMATORY', 'BRAIN_PROTECTION'],
    description: 'Липидный комплекс — Омега-3+6+9+CLA+МСТ для баланса жирных кислот и кардиопротекции на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Рыбная отрыжка', 'Диарея при высоких дозах'],
    dosage: { mg: 3000, timing: 'с едой 2x/д', form: 'липидный комплекс 3 г' },
    bestForCourse: false,
  },
  brand_complex: {
    id: 'brand_complex',
    name: 'Brand Complex',
    nameRu: 'Брендовый комплекс',
    tier: 'standard',
    category: ['multivitamin', 'recovery'],
    forms: [
      { id: 'brand_complex', name: 'Brand Complex', nameRu: 'Брендовый комплекс 1 капсула', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['WHOLE_BODY'],
    systems: ['all_systems'],
    mechanisms: ['COMPREHENSIVE_NUTRITION', 'VITAMIN_MINERAL_SUPPORT', 'RECOVERY_ENHANCEMENT', 'IMMUNE_SUPPORT'],
    description: 'Брендовый комплекс — мультивитаминный препарат от производителя для общей поддержки на курсе.',
    synergies: [
      { with: "vitamin_a", effect: "", mechanism: "", severity: "MEDIUM" },
      { with: "omega3", effect: "", mechanism: "", severity: "MEDIUM" }
    ],
    conflicts: [],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: [],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1, timing: 'с едой 1x/д', form: 'брендовый комплекс 1 капсула' },
    bestForCourse: false,
  },
  antacid: {
    id: 'antacid',
    name: 'Antacid',
    nameRu: 'Антацид',
    tier: 'standard',
    category: ['gastrointestinal'],
    forms: [
      { id: 'antacid', name: 'Antacid', nameRu: 'Антацид 1000 мг', dose: '1 г 2x/д', best: true },
      { id: 'antacid_2', name: 'Antacid', nameRu: 'Антацид + ИПП комплекс', dose: '1 г', best: false }
    ],
    organs: ['STOMACH', 'GUT'],
    systems: ['gastrointestinal'],
    mechanisms: ['ACID_NEUTRALIZATION', 'GASTRIC_PROTECTION', 'HEARTBURN_RELIEF', 'ESOPHAGUS_PROTECTION'],
    description: 'Антацид — нейтрализует желудочную кислоту, снимает изжогу и защищает пищевод. На курсе — ЖКТ защита при НПВС.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Гастроскопия', when: 'Субъективно' }
    ],
    contraindications: ['Почечная недостаточность'],
    sideEffects: ['Запор или диарея (зависит от типа)'],
    dosage: { mg: 1000, timing: 'через 1 ч после еды', form: 'антацид 1000 мг' },
    bestForCourse: false,
  },
  igf1: {
    id: 'igf1',
    name: 'IGF-1',
    nameRu: 'ИФР-1 (Инсулиноподобный фактор роста)',
    tier: 'specialty',
    category: ['peptide', 'hormonal'],
    forms: [
      { id: 'igf1', name: 'IGF-1', nameRu: 'ИФР-1 100 мкг', dose: '100 мкг 2x/д', best: true }
    ],
    organs: ['MUSCLES', 'BONES', 'BRAIN'],
    systems: ['musculoskeletal', 'endocrine', 'neuro'],
    mechanisms: ['MUSCLE_GROWTH', 'BONE_DENSITY', 'NERVE_REGENERATION', 'ANABOLIC_EFFECT'],
    description: 'ИФР-1 — инсулиноподобный фактор роста, анаболический гормон для мышц и костей. Маркер ГР на курсе.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'ИФР-1', when: 'Каждые 4 нед', targetRange: '150-450 нг/мл' }
    ],
    contraindications: ['Активный онкологический процесс', 'Беременность'],
    sideEffects: ['Риск гипогликемии', 'Покраснение в месте инъекции'],
    dosage: { mg: 0.1, timing: 'индивидуально п/к', form: 'ИФР-1 100 мкг' },
    bestForCourse: false,
  },
  mgf: {
    id: 'mgf',
    name: 'MGF',
    nameRu: 'MGF (Механо-фактор роста)',
    tier: 'specialty',
    category: ['peptide', 'hormonal'],
    forms: [
      { id: 'mgf', name: 'MGF', nameRu: 'MGF 200 мкг', dose: '200 мкг 2x/д', best: true }
    ],
    organs: ['MUSCLES', 'BONES'],
    systems: ['musculoskeletal'],
    mechanisms: ['MUSCLE_REGENERATION', 'SATELLITE_CELL_ACTIVATION', 'HYPERTROPHY', 'RECOVERY'],
    description: 'MGF — механо-фактор роста, вариант ИФР-1, стимулирует сателлитные клетки и гипертрофию мышц. На курсе — восстановление.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'ИФР-1', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Активный онкологический процесс'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 0.2, timing: 'после тренировки п/к', form: 'MGF 200 мкг' },
    bestForCourse: false,
  },
  kpv: {
    id: 'kpv',
    name: 'KPV',
    nameRu: 'KPV (пептид противовоспалительный)',
    tier: 'specialty',
    category: ['peptide', 'anti_inflammatory'],
    forms: [
      { id: 'kpv', name: 'KPV', nameRu: 'KPV 500 мкг', dose: '500 мкг 2x/д', best: true }
    ],
    organs: ['GUT', 'IMMUNE_SYSTEM', 'SKIN'],
    systems: ['gastrointestinal', 'immune'],
    mechanisms: ['ANTI_INFLAMMATORY', 'GUT_BARRIER_STRENGTHENING', 'IMMUNE_REGULATION', 'WOUND_HEALING'],
    description: 'KPV — противовоспалительный пептид, заживляет слизистую кишечника и кожу. На курсе — защита ЖКТ.',
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Воспалительные маркеры', when: 'Субъективно' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 0.5, timing: '1x/д п/к', form: 'KPV 500 мкг' },
    bestForCourse: false,
  },
};


