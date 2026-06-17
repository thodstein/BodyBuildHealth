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
  "omega3": {
    id: "omega3",
    name: "Omega-3 (EPA/DHA)",
    nameRu: "Омега-3 (EPA/DHA)",
    tier: "core",
    category: [
      "fatty_acid",
      "cardioprotector",
      "antiinflammatory"
    ],
    forms: [
      {
        id: "omega3",
        name: "Omega-3 EPA+DHA 60%",
        nameRu: "Омега-3 EPA+DHA 60%",
        dose: "2000 мг с едой 2x/д",
        best: true
      },
      {
        id: "FA_OMEGA3_KRILL",
        name: "Krill Oil",
        nameRu: "Крилевое масло",
        dose: "2000 мг",
        best: false
      },
      {
        id: "FA_OMEGA3_ALGAE_DHA",
        name: "Algae DHA",
        nameRu: "Веганская DHA",
        dose: "1000 мг DHA",
        best: false
      },
      {
        id: "FA_OMEGA3_HIGH_EPA",
        name: "High EPA",
        nameRu: "Высокое EPA",
        dose: "2000 мг EPA",
        best: false
      },
      {
        id: "FA_OMEGA3_MONOGLYCERIDE",
        name: "Monoglyceride Omega-3",
        nameRu: "Моноглицеридная форма",
        dose: "1000 мг",
        best: false
      }
    ],
    organs: [
      "HEART",
      "VESSELS",
      "BRAIN",
      "LIVER",
      "EYES"
    ],
    systems: [
      "cardio",
      "neuro",
      "hepatic"
    ],
    mechanisms: [
      "EPA_DHA_ANTIINFLAMMATORY",
      "TRIGLYCERIDE_REDUCTION",
      "MEMBRANE_FLUIDITY",
      "RESOLVIN_SYNTHESIS"
    ],
    description: "Омега-3 EPA/DHA — ключевой кардиопротектор. Снижает триглицериды, улучшает эндотелиальную функцию, подавляет воспаление через резольвины. Обязателен на курсах ААС.",
    synergies: [
      {
        with: "vitamin_e",
        effect: "Защита от окисления",
        mechanism: "Токоферол предотвращает перекисное окисление Омега-3",
        severity: "MEDIUM"
      },
      {
        with: "coq10",
        effect: "Кардиопротекция",
        mechanism: "Разные механизмы защиты миокарда",
        severity: "MEDIUM"
      },
      {
        with: "curcumin",
        effect: "Противовоспалительная синергия",
        mechanism: "Ингибирование COX-2 и NF-kB",
        severity: "MEDIUM"
      },
      {
        with: "vitamin_d3",
        effect: "Взаимное усвоение",
        mechanism: "Жирорастворимые витамины усиливают абсорбцию",
        severity: "LOW"
      }
    ],
    conflicts: [
      {
        with: "warfarin",
        effect: "Усиление антикоагуляции",
        mechanism: "Уменьшение агрегации тромбоцитов",
        severity: "HIGH"
      }
    ],
    monitoring: [
      {
        what: "Триглицериды",
        when: "Каждые 6 нед",
        targetRange: "<1.7 ммоль/л"
      },
      {
        what: "ЛПВП",
        when: "Каждые 8 нед",
        targetRange: ">1.0 ммоль/л"
      }
    ],
    contraindications: [
      "Гемофилия",
      "Приём антикоагулянтов (с осторожностью)"
    ],
    sideEffects: [
      "Рыбная отрыжка",
      "Разжижение стула при высоких дозах"
    ],
    dosage: {
      mg: 4000,
      timing: "с едой, 2x/д (EPA+DHA 60%)",
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
    synergies: [],
    conflicts: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
    conflicts: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
    conflicts: [],
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
    synergies: [],
    conflicts: [],
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
    synergies: [],
    conflicts: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
    conflicts: [],
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
    conflicts: [],
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
    synergies: [],
    conflicts: [],
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
    conflicts: [],
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
    conflicts: [],
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
    synergies: [],
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
    conflicts: [],
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
    synergies: [],
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
    synergies: [],
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
    conflicts: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
    conflicts: [],
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
    conflicts: [],
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
    synergies: [],
    conflicts: [],
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
    synergies: [],
    conflicts: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
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
    conflicts: [],
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
    synergies: [],
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
    synergies: [],
    conflicts: [],
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
    synergies: [],
    conflicts: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
    conflicts: [],
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
    synergies: [],
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
    synergies: [],
    conflicts: [],
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
    synergies: [],
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
    synergies: [],
    conflicts: [],
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
    synergies: [],
    conflicts: [],
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
    synergies: [],
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
    synergies: [],
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
    synergies: [],
    conflicts: [],
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
    synergies: [],
    conflicts: [],
    monitoring: [
      { what: 'Когниция/память', when: 'Субъективно' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Редко: головная боль', 'Риск кровотечения'],
    dosage: { mg: 120, timing: 'с едой 2x/д', form: 'экстракт гинкго' },
    bestForCourse: false,
  },
};


