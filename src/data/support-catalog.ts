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
  }
};
