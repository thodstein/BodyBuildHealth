import { CANONICAL_ID_MAP } from './support-meta';

// ── FROM: support-catalog.ts ──
// ===========================================================================
// SUPPORT CATALOG — Complete substance database with forms, organs, systems,
// mechanisms, synergies, conflicts, monitoring, contraindications, side effects.
// Each substance has ALL forms grouped (no duplicates), tier classification,
// organ/system mapping, and full interaction data.
// ===========================================================================

export interface CatalogSubstanceForm {
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
  forms: CatalogSubstanceForm[];
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
  analog?: string[];
  /** Новые расширенные поля */
  targetOrgan?: string;
  organMechanism?: string;
  mechanismOfAction?: string;
  clinicalEffect?: string;
  bestForm?: string;
}

export const ORGAN_LABELS: Record<string, string> = {
  LIVER: '🫁 Печень', KIDNEYS: '🫘 Почки', HEART: '❤️ Сердце', VESSELS: '🩸 Сосуды',
  BRAIN: '🧠 Мозг', NERVES: '⚡ Нервы', LUNGS: '🫁 Лёгкие', SKIN: '🧴 Кожа',
  EYES: '👁️ Глаза', IMMUNE_SYSTEM: '🛡️ Иммунитет', REPRODUCTIVE: '🧬 Репродуктивная',
  MUSCLES: '💪 Мышцы', BONES: '🦴 Кости', JOINTS: '🦴 Суставы', PANCREAS: '🫁 Поджелудочная',
  THYROID: '🦋 Щитовидная', ADRENALS: '⚖️ Надпочечники', STOMACH: '🫁 Желудок',
  INTESTINES: '🫁 Кишечник', BLOOD: '🩸 Кровь', PROSTATE: '🔴 Простата', GUT: '🫁 Кишечник',
  BONE: '🦴 Кости', HAIR: '💇 Волосы', THYMUS: '🛡️ Тимус', MUCOSA: '🧴 Слизистая',
  GALLBLADDER: '🫁 Желчный пузырь', TESTES: '⚽ Яички',
  CELLS: '🔬 Клетки', MITOCHONDRIA: '🔋 Митохондрии', ENDOCRINE: '⚖️ Эндокринная',
  BREAST: '🔴 Грудь', PITUITARY: '🧠 Гипофиз',
};

export const SYSTEM_LABELS_CATALOG: Record<string, string> = {
  hepatic: '🫁 Печень', cardio: '❤️ ССС', renal: '🫘 Почки', neuro: '🧠 Нервная',
  endocrine: '⚖️ Эндокринная', hematologic: '🩸 Кровь', reproductive: '🧬 Репродуктивная',
  musculoskeletal: '💪 Опорно-двигательная', immune: '🛡️ Иммунитет', metabolic: '⚡ Метаболизм', gastrointestinal: '🫁 ЖКТ', nero: '🧠 Нервная',
};

export const CATEGORY_LABELS: Record<string, string> = {
  antioxidant: '🛡️ Антиоксидант', hepatoprotector: '🫁 Гепатопротектор', cardioprotector: '❤️ Кардиопротектор',
  mineral: '💊 Минерал', vitamin: '💊 Витамин', amino: '🧬 Аминокислота', fatty_acid: '🐟 ЖК',
  adaptogen: '🌿 Адаптоген', antiinflammatory: '🔥 Противовоспалительное', probiotic: '🦠 Пробиотик',
  choleretic: '🫁 Желчегонное', respiratory: '🫁 Дыхательная', neuroprotector: '🧠 Нейропротектор',
  renoprotector: '🫘 Нефропротектор', joint: '🦴 Суставное', hormonal: '⚖️ Гормональное',
  peptide: '🧬 Пептид', pharma: '💊 Фармакология', herb: '🌿 Трава', nootropic: '🧠 Ноотроп',
  immunomodulator: '🛡️ Иммуномодулятор', anabolic: '💪 Анаболическое', metabolic: '⚡ Метаболическое',
  gut: '🫁 ЖКТ', gastrointestinal: '🫁 Желудочно-кишечный', stimulant: '⚡ Стимулятор',
  anti_aging: '🕰 Антивозрастное', mitochondrial: '🔋 Митохондриальное', thyroid: '🦋 Щитовидная железа',
  anticoagulant: '🩸 Антикоагулянт', antimicrobial: '🦠 Антимикробное', anxiolytic: '😌 Анксиолитик',
  antidepressant: '😊 Антидепрессант', bone: '🦴 Костное',
  skin: '🧴 Кожное', beauty: '💅 Красота', eye_protector: '👁 Защита глаз',
  hydration: '💧 Гидратация', electrolyte: '⚡ Электролит', lipid: '🫧 Липидное',
  multivitamin: '💊 Мультивитамин', mushroom: '🍄 Грибы', recovery: '🔄 Восстановление',
  nsaid: '💊 НПВС', marker: '📊 Маркер', hematologic: '🩸 Гематологическое',
  immune: '🛡️ Иммунное', urinary_protector: '🚽 Урологическое', polyphenol: '🫐 Полифенол',
  anti_inflammatory: '🔥 Противовоспалительное', bile_acid: '🫁 Желчные кислоты',
  methylation: '🧬 Метилирование', enzyme: '🧪 Фермент', proteolytic: '🔬 Протеолитическое',
  flavonoid: '🫐 Флавоноид', sleep: '😴 Сон',
  pde_inhibitor: '💊 Ингибитор ФДЭ',
};

export const TIER_LABELS_CATALOG: Record<string, { label: string; emoji: string; color: string; desc: string }> = {
  core: { label: 'Ядро', emoji: '🟢', color: '#22c55e', desc: 'Обязательно на любом курсе' },
  standard: { label: 'Стандарт', emoji: '🟡', color: '#eab308', desc: 'Рекомендовано при дозах >500 мг/нед' },
  advanced: { label: 'Продвинутый', emoji: '🟠', color: '#f97316', desc: 'При специфических целях и условиях' },
  specialty: { label: 'Специальный', emoji: '🔴', color: '#ef4444', desc: 'Фармакология, рецептурные препараты' },
};


export const SUPPORT_CATALOG_DATA: Record<string, SupportCatalogEntry> = {
coq10: {
    id: 'coq10', name: 'CoQ10 (Ubiquinol)', nameRu: 'Коэнзим Q10 (Убихинол)',
    tier: 'core', category: ['antioxidant', 'cardioprotector', 'mitochondrial', 'anti_aging'],
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
    targetOrgan: 'Миокард, митохондрии гепатоцитов и нефронов',
    organMechanism: 'Окислительное фосфорилирование, продукция АТФ, антиоксидантная защита мембран',
    mechanismOfAction: 'Перенос электронов в дыхательной цепи (Комплекс I→III), стабилизация митохондриальной мембраны, улавливание свободных радикалов',
    clinicalEffect: 'Кардиопротекция, нефропротекция, повышение энергопродукции, снижение оксидативного стресса',
    bestForm: 'Убихинол 200 мг с едой',
  },
vitamin_d3: {
    id: 'vitamin_d3', name: 'Vitamin D3', nameRu: 'Витамин D3',
    tier: 'core', category: ['vitamin', 'bone', 'hormonal', 'immunomodulator'],
    forms: [
      { id: 'vitamin_d3', name: 'Vitamin D3 5000 IU', nameRu: 'Витамин D3 5000 МЕ', dose: '5000 МЕ с едой', best: true },
      { id: 'VIT_D3_LIP', name: 'Vitamin D3 Liposomal', nameRu: 'Липосомальный D3 5000 МЕ', dose: '5000 МЕ', best: false, notes: 'Лучшая биодоступность' },
    ],
    organs: ['BONES', 'IMMUNE_SYSTEM', 'MUSCLES', 'REPRODUCTIVE'],
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
    targetOrgan: 'Костная ткань, иммунная система, щитовидная железа',
    organMechanism: 'Костный метаболизм, кальциевый гомеостаз, минерализация матрикса, иммунный ответ',
    mechanismOfAction: 'Активация VDR-рецепторов, регуляция транскрипции генов кальций-связывающих белков (остеокальцин, TRPV6), модуляция кателицидина',
    clinicalEffect: 'Нормализация кальция, усиление врождённого иммунитета, поддержка синтеза тестостерона, профилактика остеопороза',
    bestForm: 'Витамин D3 5000 МЕ с едой (липосомальная форма для лучшей биодоступности)',
  },
zinc: {
    id: 'zinc', name: 'Zinc', nameRu: 'Цинк',
    tier: 'core', category: ['mineral', 'antioxidant', 'immunomodulator', 'skin', 'hormonal'],
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
    targetOrgan: 'Репродуктивная система, простата, кожа, иммунная система',
    organMechanism: 'Сперматогенез, синтез половых гормонов, стероидогенез, регенерация эпителия, клеточное деление',
    mechanismOfAction: 'Кофактор >300 ферментов (ароматаза, 5α-редуктаза, Cu/Zn-СОД), модуляция AR-рецепторов, стабилизация ДНК, регуляция транскрипции металлотионеинов',
    clinicalEffect: 'Повышение тестостерона, улучшение фертильности, заживление ран, иммуномодуляция, антиоксидантная защита',
    bestForm: 'Цинк пиколинат 30 мг на ночь',
  },
selenium: {
    id: 'selenium', name: 'Selenium', nameRu: 'Селен',
    tier: 'core', category: ['mineral', 'antioxidant', 'thyroid', 'immunomodulator'],
    forms: [
      { id: 'selenium', name: 'Selenium Methionine 200mcg', nameRu: 'Селен метионин 200 мкг', dose: '200 мкг с едой', best: true },
      { id: 'MIN_SE_YEAST', name: 'Selenium Yeast', nameRu: 'Селен дрожжевой 200 мкг', dose: '200 мкг', best: false },
    ],
    organs: ['THYROID', 'LIVER', 'IMMUNE_SYSTEM', 'REPRODUCTIVE'],
    systems: ['endocrine', 'hepatic', 'hematologic'],
    mechanisms: ['GPX_SYNTHESIS', 'THYROID_HORMONE_ACTIVATION', 'ANTIOXIDANT', 'DNA_REPAIR'],
    description: 'Селен — кофактор глутатионпероксидазы и дейодиназы щитовидной железы. Критически важен для антиоксидантной защиты и мужской фертильности.',
    synergies: [
      { with: 'coq10', effect: 'Защита митохондрий', mechanism: 'Se — кофактор GPx, CoQ10 — дыхательная цепь', severity: 'MEDIUM' },
      { with: 'zinc', effect: 'Защита простаты и репродукции', mechanism: 'Zn + Se = синергия антиоксидантной защиты', severity: 'MEDIUM' },
      { with: 'vitamin_e', effect: 'Антиоксидантная синергия', mechanism: 'Se (GPx) + вит. E = двойная защита мембран', severity: 'HIGH' },
      { with: 'nac', effect: 'Глутатионовая система', mechanism: 'Se = GPx, NAC = предшественник глутатиона', severity: 'HIGH' },
    ],
    conflicts: [
        {with: "vitamin_c", effect: "Снижение биодоступности Se", mechanism: "Высокие дозы C окисляют Se", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Селен сыворотки', when: 'Каждые 12 нед', targetRange: '70-150 нг/мл' },
    ],
    contraindications: ['Гипертиреоз (с осторожностью)', 'Приём других селен-содержащих добавок'],
    sideEffects: ['Запах чеснока при передозировке', 'Выпадение волос при >400 мкг/д'],
    dosage: { mg: 200, timing: 'с едой (мкг)', form: 'метионин' },
    bestForCourse: true,
    targetOrgan: 'Щитовидная железа, печень, семенники',
    organMechanism: 'Синтез тиреоидных гормонов (конверсия T4→T3), антиоксидантная защита гепатоцитов, сперматогенез',
    mechanismOfAction: 'Кофактор глутатионпероксидазы (GPx) и дейодиназ (ID1/ID2), селен-зависимые ферменты редокс-сигналинга, защита митохондрий от пероксидов',
    clinicalEffect: 'Антиоксидантная защита, нормализация функции щитовидной железы, улучшение фертильности, кардиопротекция',
    bestForm: 'Селен-метионин 200 мкг с едой',
  },
milk_thistle: {
    id: 'milk_thistle', name: 'Milk Thistle (Silymarin)', nameRu: 'Расторопша (Силимарин)',
    tier: 'core', category: ['hepatoprotector', 'antioxidant', 'herb', 'choleretic'],
    forms: [
      { id: 'milk_thistle', name: 'Silymarin 600mg', nameRu: 'Силимарин 600 мг', dose: '600 мг с едой 2x/д', best: true },
      { id: 'AO_SILYMARIN_PHOSPHO', name: 'Silymarin + Phospholipids', nameRu: 'Силимарин + фосфолипиды 300 мг 2x/д', dose: '300 мг 2x/д', best: false, notes: 'Лучшая биодоступность' },
    ],
    organs: ['LIVER', 'GALLBLADDER'],
    systems: ['hepatic'],
    mechanisms: ['MEMBRANE_STABILIZATION', 'ANTIOXIDANT', 'PROTEIN_SYNTHESIS_STIMULATION', 'ANTIFIBROTIC'],
    description: 'Расторопша (силимарин) — стандартизированный экстракт. Стабилизирует мембраны гепатоцитов, подавляет фиброз. Один из основных гепатопротекторов.',
    synergies: [
      { with: 'berberine', effect: 'Гепатопротекция + метаболизм', mechanism: 'Силимарин + берберин — разные механизмы защиты печени', severity: 'MEDIUM' },
      { with: 'probiotics', effect: 'Кишечно-печёночная ось', mechanism: 'Пробиотики улучшают всасывание силимарина, силимарин снижает эндотоксемию', severity: 'LOW' },
      { with: 'nac', effect: 'Комплексная гепатопротекция', mechanism: 'NAC = глутатион, силимарин = мембраны', severity: 'HIGH' },
      { with: 'tudca', effect: 'Максимальная гепатопротекция', mechanism: 'TUDCA + силимарин = полный охват', severity: 'HIGH' },
    ],
    conflicts: [
        {with: "pharma", effect: "Изменение метаболизма статинов", mechanism: "Силимарин ингибирует CYP3A4", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед', targetRange: '<40 Ед/л' },
    ],
    contraindications: ['Желчнокаменная болезнь (с осторожностью)', 'Аллергия на астровые'],
    sideEffects: ['Редко: диарея', 'Редко: аллергия'],
    dosage: { mg: 600, timing: 'с едой, 2x/д', form: 'капсулы' },
    bestForCourse: true,
    targetOrgan: 'Гепатоциты, эпителий жёлчных протоков',
    organMechanism: 'Детоксикация (фазы I/II), синтез белка и фосфолипидов мембран, секреция жёлчи',
    mechanismOfAction: 'Блокировка токсинов на мембране гепатоцита (конкуренция за рецепторы), стимуляция РНК-полимеразы I (синтез белка), ингибирование звездчатых клеток (антифиброз), улавливание свободных радикалов',
    clinicalEffect: 'Снижение АЛТ/АСТ, защита гепатоцитов от токсического повреждения, замедление фиброза печени',
    bestForm: 'Силимарин 600 мг с едой 2x/д',
  },
curcumin: {
    id: 'curcumin', name: 'Curcumin + Piperine', nameRu: 'Куркумин + Пиперин',
    tier: 'core', category: ['polyphenol', 'anti_inflammatory', 'antioxidant', 'neuroprotector'],
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
    targetOrgan: 'Синовиальная оболочка, гепатоциты, нейроны, энтероциты',
    organMechanism: 'Ингибирование воспалительных каскадов (NF-kB, COX-2), снижение окислительного стресса в суставах и печени',
    mechanismOfAction: 'Блокировка ядерного фактора NF-kB (подавление провоспалительных цитокинов), ингибирование циклооксигеназы-2, улавливание свободных радикалов, стимуляция нейротрофического фактора BDNF',
    clinicalEffect: 'Снижение воспаления (СРБ, IL-6), защита суставов и печени, улучшение когнитивных функций',
    bestForm: 'Куркумин + Пиперин 1000 мг с едой',
  },
ashwagandha: {
    id: 'ashwagandha', name: 'Ashwagandha KSM-66', nameRu: 'Ашваганда KSM-66',
    tier: 'core', category: ['adaptogen', 'anti_inflammatory', 'hormonal', 'anxiolytic'],
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
    targetOrgan: 'Кора надпочечников, нейроны, тироциты, клетки Лейдига',
    organMechanism: 'Регуляция гипоталамо-гипофизарно-надпочечниковой оси, снижение секреции кортизола, модуляция ГАМК-рецепторов',
    mechanismOfAction: 'Снижение кортизола через блокаду CRH, агонизм ГАМК-A рецепторов (анксиолиз), повышение T3/T4, стимуляция стероидогенеза в клетках Лейдига',
    clinicalEffect: 'Снижение кортизола на 30%, повышение тестостерона, улучшение сна и стрессоустойчивости',
    bestForm: 'Ашваганда KSM-66 600 мг вечером',
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
      { with: 'curcumin', effect: 'Синтез коллагена', mechanism: 'Куркумин подавляет MMP, вит. C стимулирует коллаген', severity: 'LOW' },
      { with: 'alpha_lipoic', effect: 'Регенерация антиоксидантной сети', mechanism: 'АЛЬК → вит. C → вит. E — каскадная регенерация', severity: 'MEDIUM' },
      { with: 'iron', effect: 'Усиление всасывания железа', mechanism: 'Витамин C восстанавливает Fe3+ в Fe2+', severity: 'HIGH' },
      { with: 'zinc', effect: 'Улучшение всасывания цинка', mechanism: 'Витамин C усиливает абсорбцию', severity: 'MEDIUM' },
      { with: 'collagen', effect: 'Синтез коллагена', mechanism: 'Витамин C — кофактор гидроксилирования пролина', severity: 'HIGH' },
      { with: 'nac', effect: 'Регенерация глутатиона', mechanism: 'Витамин C восстанавливает окисленный глутатион', severity: 'HIGH' },
    ],
    conflicts: [
      { with: 'copper', effect: 'Снижение меди при высоких дозах', mechanism: 'Высокие дозы вит. C истощают медь', severity: 'LOW' },
    ],
    monitoring: [{what:'ОАК',when:'Каждые 12 нед',targetRange:'В пределах нормы'}],
    contraindications: ['Гемохроматоз (с осторожностью)', 'Оксалатные камни почек'],
    sideEffects: ['Диарея при дозах >2000 мг', 'Риск камней при склонности'],
    dosage: { mg: 1000, timing: 'натощак', form: 'порошок/таблетки' },
    bestForCourse: true,
    targetOrgan: 'Лейкоциты, фибробласты кожи, соединительная ткань, кора надпочечников',
    organMechanism: 'Синтез коллагена, регенерация глутатиона, активация нейтрофилов и лимфоцитов',
    mechanismOfAction: 'Кофактор гидроксилирования пролина и лизина (синтез коллагена), донор электронов для антиоксидантной защиты, восстановление Fe3+→Fe2+ (всасывание железа), рециклинг окисленного глутатиона',
    clinicalEffect: 'Укрепление иммунитета, синтез коллагена, регенерация антиоксидантной системы, усиление всасывания железа',
    bestForm: 'Витамин C 1000 мг натощак',
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
      { with: 'ashwagandha', effect: 'Синергия кардиопротекции и расслабления', mechanism: 'Таурин + ашваганда = снижение кортизола и защита сердца', severity: 'LOW' },
      { with: 'nebivolol', effect: 'Кардиопротекция', mechanism: 'Таурин + небиволол — максимальная защита миокарда', severity: 'LOW' },
      { with: 'magnesium', effect: 'Кардиопротекция и расслабление', mechanism: 'Таурин + Mg = максимальная защита сердца', severity: 'MEDIUM' },
      { with: 'caffeine', effect: 'Сглаживание стимуляции', mechanism: 'Таурин уменьшает тревожность от кофеина', severity: 'LOW' },
    ],
    conflicts: [
      { with: "lithium", effect: "Таурин может снижать уровень лития", mechanism: "Осмотический диурез таурином", severity: "LOW" },
      { with: "antihypertensives", effect: "Аддитивный гипотензивный эффект", mechanism: "Таурин снижает АД через модуляцию Ca каналов", severity: "LOW" },
      { with: "alcohol", effect: "Снижение абсорбции таурина", mechanism: "Этанол нарушает транспорт таурина в кишечнике", severity: "LOW" },
    ],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 12 нед', targetRange: '<40 Ед/л' },
      { what: 'АД', when: 'Ежемесячно', targetRange: '<130/85 мм рт.ст.' },
    ],
    contraindications: ['Тяжёлая почечная недостаточность'],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 2000, timing: 'натощак', form: 'порошок' },
    bestForCourse: true,
    targetOrgan: 'Кардиомиоциты, нейроны, гепатоциты, эпителий почечных канальцев',
    organMechanism: 'Регуляция осмолярности, модуляция ионных каналов, конъюгация жёлчных кислот, антиоксидантная защита митохондрий',
    mechanismOfAction: 'Стабилизация клеточного объёма через осмолиты, модуляция потенциал-зависимых Ca2+-каналов (снижение АД), агонизм ГАМК-рецепторов, конъюгация жёлчных кислот (детоксикация)',
    clinicalEffect: 'Снижение АД, улучшение сократимости миокарда, кардио- и нейропротекция, детоксикация печени',
    bestForm: 'Таурин 2000 мг натощак',
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
    conflicts: [
        {with: "pharma", effect: "Снижение T3", mechanism: "АЛЬК может снижать T3", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед', targetRange: '3.9-5.5 ммоль/л' },
      { what: 'ТТГ', when: 'Каждые 8 нед', targetRange: '0.4-4.0 мМЕ/л' },
    ],
    contraindications: ['Тяжёлая почечная недостаточность', 'Беременность'],
    sideEffects: ['Тошнота натощак', 'Редко: кожная сыпь', 'Редко: гипогликемия'],
    dosage: { mg: 300, timing: 'натощак (R-форма)', form: 'R-форма' },
    bestForCourse: true,
    targetOrgan: 'Митохондрии гепатоцитов, нейроны, периферические нервы, почечные канальцы',
    organMechanism: 'Регенерация антиоксидантной сети, функционирование митохондриальных дегидрогеназ, утилизация глюкозы',
    mechanismOfAction: 'Кофактор пируватдегидрогеназы и α-кетоглутаратдегидрогеназы, восстановление окисленных антиоксидантов (C, E, глутатион, CoQ10), активация AMPK, хелатирование переходных металлов',
    clinicalEffect: 'Улучшение инсулиновой чувствительности, снижение окислительного стресса, регенерация антиоксидантов, защита митохондрий',
    bestForm: 'АЛЬК R-форма 300 мг натощак',
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
    targetOrgan: 'Гепатоциты, β-клетки поджелудочной, энтероциты, кардиомиоциты',
    organMechanism: 'Активация AMPK, усиление захвата глюкозы, модуляция липидного обмена, ингибирование CYP3A4',
    mechanismOfAction: 'Фосфорилирование AMPK (Thr172 через ↑AMP/ATP), ингибирование митохондриального комплекса I, блокада ядерного фактора NF-kB, подавление CYP3A4',
    clinicalEffect: 'Снижение глюкозы и триглицеридов, улучшение инсулиновой чувствительности, гепатопротекция',
    bestForm: 'Берберин HCl 500 мг с едой 2x/д',
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
    monitoring: [
      { what: 'Кальций общий', when: 'Каждые 8 нед', targetRange: '2.1-2.55 ммоль/л' },
      { what: 'МНО (при антикоагулянтах)', when: 'Еженедельно на старте', targetRange: '2.0-3.0' },
    ],
    contraindications: ['Приём варфарина/антикоагулянтов', 'Тромбофилия'],
    sideEffects: ['Редко при передозировке'],
    dosage: { mg: 200, timing: 'с едой (мкг)', form: 'МК-7' },
    bestForCourse: true,
    targetOrgan: 'Остеобласты костной ткани, гладкомышечные клетки сосудов, миокард',
    organMechanism: 'Активация витамин K-зависимых белков (остеокальцин, MGP), карбоксилирование Gla-белков, кальциевый гомеостаз',
    mechanismOfAction: 'γ-Карбоксилирование остеокальцина (фиксация Ca2+ в костной матрице) и матриксного Gla-белка (ингибирование кальцификации сосудов), активация факторов свёртывания II/VII/IX/X',
    clinicalEffect: 'Направление кальция из сосудов в кости, предотвращение кальцификации артерий, профилактика остеопороза',
    bestForm: 'Витамин K2 МК-7 200 мкг с едой',
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
    conflicts: [
        {with: "pharma", effect: "Уничтожение пробиотиков", mechanism: "Антибиотики убивают штаммы", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'СРБ', when: 'Каждые 12 нед', targetRange: '<5 мг/л' },
      { what: 'Копрограмма', when: 'При симптомах дисбиоза', targetRange: 'Нормальная флора' },
    ],
    contraindications: ['Тяжёлый иммунодефицит', 'Центральный венозный катетер (риск бактериемии)'],
    sideEffects: ['Вздутие в начале приёма', 'Редко: диарея', 'Редко: аллергия на штамм'],
    dosage: { mg: 20, timing: 'натощак (млрд КОЕ)', form: 'капсулы' },
    bestForCourse: true,
    targetOrgan: 'Эпителий кишечника (энтероциты), GALT (лимфоидная ткань), гепатоциты',
    organMechanism: 'Модуляция микробиома, укрепление кишечного барьера, иммунная регуляция через GALT',
    mechanismOfAction: 'Стимуляция продукции муцина и белков плотных контактов (ZO-1, окклюдин), конкуренция с патогенами за рецепторы (колонизационная резистентность), продукция короткоцепочечных жирных кислот (бутират), модуляция Treg/Th17',
    clinicalEffect: 'Улучшение пищеварения, укрепление иммунитета, снижение эндотоксемии, защита печени через ось кишечник-печень',
    bestForm: 'Мультиштаммовый пробиотик 20 млрд КОЕ натощак',
  },
collagen: {
    id: 'collagen', name: 'Collagen Hydrolysate', nameRu: 'Коллаген гидролизат',
    tier: 'standard', category: ['amino', 'joint', 'skin'],
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
    conflicts: [
      { with: 'vitamin_c', effect: 'Избыток витамина C может нарушать укладку коллагеновых волокон', mechanism: 'Окислительный стресс при избытке аскорбата', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'СРБ', when: 'Каждые 12 нед', targetRange: '<5 мг/л' },
      { what: 'Витамин D (25-OH)', when: 'Каждые 12 нед', targetRange: '50-80 нг/мл' },
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: тяжесть в желудке при приёме натощак'],
    dosage: { mg: 10000, timing: 'с едой (мг, гидролизат)', form: 'гидролизат' },
    bestForCourse: true,
    targetOrgan: 'Хрящевая ткань, кожа, костная ткань, сухожилия',
    organMechanism: 'Синтез коллагена, восстановление внеклеточного матрикса соединительной ткани, поддержка эластичности кожи',
    mechanismOfAction: 'Поставка глицина, пролина и гидроксипролина для синтеза коллагена; стимуляция фибробластов через коллагеновые пептиды; образование дисульфидных связей в тропоколлагене',
    clinicalEffect: 'Укрепление хрящей, сухожилий и костей, ускорение заживления тканей, улучшение эластичности и увлажнения кожи',
    bestForm: 'Коллаген гидролизат 10 г с едой',
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
    conflicts: [
        {with: "pharma", effect: "Инсулинорезистентность", mechanism: "Глюкозамин может ухудшать", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 8 нед', targetRange: '3.9-5.5 ммоль/л' },
      { what: 'СРБ', when: 'Каждые 12 нед', targetRange: '<5 мг/л' },
    ],
    contraindications: ['Аллергия на моллюсков (для хондроитина из моллюсков)', 'С осторожностью при диабете'],
    sideEffects: ['Редко: дискомфорт в ЖКТ', 'Редко: аллергия'],
    dosage: { mg: 1500, timing: 'с едой', form: 'сульфат' },
    bestForCourse: false,
    targetOrgan: 'Хрящевая ткань, костная ткань',
    organMechanism: 'Синтез протеогликанов и гликозаминогликанов, поддержка синовиальной жидкости',
    mechanismOfAction: 'Субстрат для синтеза аггрекана и гиалуроновой кислоты в хондроцитах; ингибирование металлопротеиназ (MMP), разрушающих хрящ; слабое противовоспалительное через снижение NF-κB',
    clinicalEffect: 'Замедление дегенерации суставов, улучшение подвижности, уменьшение боли в суставах',
    bestForm: 'Глюкозамин сульфат 1500 мг с едой',
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
    targetOrgan: 'Гладкомышечные клетки сосудов, юкстагломерулярный аппарат почек, кардиомиоциты',
    organMechanism: 'Регуляция тонуса сосудов, снижение периферического сопротивления, реабсорбция натрия и воды',
    mechanismOfAction: 'Блокада AT1-рецепторов ангиотензина II (вазодилатация), активация PPAR-γ (повышение инсулиновой чувствительности), снижение секреции альдостерона',
    clinicalEffect: 'Снижение АД, защита почек (антипротеинурический эффект), улучшение инсулиновой чувствительности',
    bestForm: 'Тельмисартан 40 мг утром',
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
    targetOrgan: 'СА-узел сердца, проводящая система, эндотелий сосудов',
    organMechanism: 'Снижение ЧСС через блокаду β1-адренорецепторов, NO-зависимое расширение сосудов',
    mechanismOfAction: 'Селективная блокада β1-адренорецепторов (отрицательный хронотропный и инотропный эффект), стимуляция NO-синтазы через β3-рецепторы (вазодилатация)',
    clinicalEffect: 'Снижение ЧСС и АД, защита миокарда от катехоламинов, улучшение эндотелиальной функции',
    bestForm: 'Небиволол 5 мг утром',
  },
iron: {
    id: 'iron', name: 'Iron', nameRu: 'Железо', tier: 'core',
    category: ['mineral', 'hematologic', 'metabolic'],
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
      { with: 'vitamin_b12', effect: 'Синергия эритропоэза', mechanism: 'B12 + железо — кофакторы синтеза гемоглобина', severity: 'MEDIUM' },
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
    targetOrgan: 'Костный мозг (эритробласты), миоциты, гепатоциты',
    organMechanism: 'Синтез гемоглобина и миоглобина, транспорт кислорода, окислительное фосфорилирование',
    mechanismOfAction: 'Встраивание в гем-порфириновое кольцо (гемоглобин, миоглобин, цитохромы), участие в цикле Кребса (аконитаза) и дыхательной цепи митохондрий (комплексы I-IV)',
    clinicalEffect: 'Поддержание Hb и ферритина, улучшение кислородтранспортной функции, профилактика анемии',
    bestForm: 'Железо бисглицинат 18 мг натощак или с витамином С',
  },
copper: {
    id: 'copper', name: 'Copper', nameRu: 'Медь', tier: 'standard',
    category: ['mineral', 'antioxidant', 'hematologic'],
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
    targetOrgan: 'Гепатоциты, костный мозг, остеобласты, соединительная ткань',
    organMechanism: 'Метаболизм железа (церулоплазмин), синтез коллагена (лизилоксидаза), антиоксидантная защита',
    mechanismOfAction: 'Кофактор церулоплазмина (ферроксидаза — окисление Fe2+→Fe3+ для транспорта), активация лизилоксидазы (сшивка коллагена и эластина), тирозиназа (синтез меланина), супероксиддисмутаза SOD-3',
    clinicalEffect: 'Поддержка кроветворения, прочности связок и сосудов, защита от окислительного стресса',
    bestForm: 'Медь бисглицинат 2 мг с едой',
  },
vitamin_b12: {
    id: 'vitamin_b12', name: 'Vitamin B12', nameRu: 'Витамин В12 (Кобаламин)', tier: 'core',
    category: ['vitamin', 'hematologic', 'neuroprotector'],
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
    targetOrgan: 'Эритроциты (костный мозг), нейроны, миелиновая оболочка',
    organMechanism: 'Метилирование (реметилирование гомоцистеина→метионин), синтез ДНК (тимидилат), синтез миелина',
    mechanismOfAction: 'Кофактор метионинсинтазы (гомоцистеин→метионин с донором 5-MTHF), кофактор метилмалонил-КоА-мутазы (жирные кислоты→миелин), синтез тимидилата для репликации ДНК',
    clinicalEffect: 'Снижение гомоцистеина, поддержка миелинизации нервов, профилактика мегалобластной анемии',
    bestForm: 'Метилкобаламин 1000 мкг с едой или сублингвально',
  },
potassium: {
    id: 'potassium', name: 'Potassium', nameRu: 'Калий', tier: 'core',
    category: ['mineral', 'cardioprotector', 'electrolyte'],
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
    targetOrgan: 'Кардиомиоциты, скелетные мышцы, почечные канальцы',
    organMechanism: 'Поддержание мембранного потенциала покоя, проведение потенциала действия, сокращение мышц, реабсорбция воды',
    mechanismOfAction: 'Главный внутриклеточный катион: Na+/K+-АТФаза создаёт электрохимический градиент, потенциал-зависимые K+-каналы определяют потенциал покоя, выход K+ при реполяризации',
    clinicalEffect: 'Поддержание сердечного ритма, мышечной силы, профилактика судорог и аритмий',
    bestForm: 'Калия цитрат 300 мг с едой 2x/д',
  },
vitamin_b6: {
    id: 'vitamin_b6', name: 'Vitamin B6', nameRu: 'Витамин В6 (Пиридоксин)', tier: 'core',
    category: ['vitamin', 'neuroprotector', 'metabolic'],
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
    targetOrgan: 'Нейроны, гепатоциты, эритроциты',
    organMechanism: 'Метаболизм аминокислот (трансаминирование, дезаминирование), синтез нейромедиаторов (серотонин, дофамин, ГАМК), снижение гомоцистеина',
    mechanismOfAction: 'Кофермент 140+ PLP-зависимых ферментов: трансаминазы (ALT/AST), декарбоксилазы (DOPA→дофамин, глутамат→ГАМК), синтаза δ-аминолевулиновой кислоты (гем), цистатионин-β-синтаза (гомоцистеин→цистеин)',
    clinicalEffect: 'Снижение гомоцистеина, профилактика нейропатии, улучшение когнитивных функций, поддержка кроветворения',
    bestForm: 'Пиридоксаль-5-фосфат (P-5-P) 50 мг с едой',
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
      { with: "zinc", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "vitamin_a", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "omega3", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "astaxanthin", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "lutein", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "anthocyanins", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "antioxidant_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "peptide_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "brand_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "vitamin_d3", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Витамин А в крови', when: 'Каждые 8 нед', targetRange: '0.3-0.8 мкг/мл' }
    ],
    contraindications: ['Беременность (тератогенность)', 'Гипервитаминоз А'],
    sideEffects: ['Тошнота при избытке', 'Сухость кожи', 'Головная боль при передозировке'],
    dosage: { mg: 1, timing: 'с едой (жирорастворимый)', form: 'капсулы ретинола пальмитат' },
    bestForCourse: false,
    targetOrgan: 'Сетчатка глаза, эпителий кожи, иммунные клетки',
    organMechanism: 'Фототрансдукция в палочках и колбочках, поддержание целостности эпителия, дифференцировка иммунных клеток',
    mechanismOfAction: 'Активация ретиноевых рецепторов (RAR/RXR), регулирующих транскрипцию генов; конверсия 11-цис-ретиналя в опсин для зрения; модуляция Th1/Th2 иммунного ответа; регуляция кератинизации эпителия',
    clinicalEffect: 'Поддержка сумеречного зрения, профилактика куриной слепоты, улучшение состояния кожи и слизистых, усиление иммунитета',
    bestForm: 'Ретинола пальмитат 10000 МЕ 1 мг',
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
      { with: "vitamin_b1", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: 'vitamin_b6', effect: 'Высокие дозы B6 снижают активность тиамина', mechanism: 'Конкуренция за фосфорилирование киназами', severity: 'LOW' },
      { with: 'alcohol', effect: 'Алкоголь снижает всасывание тиамина', mechanism: 'Ингибирование активного транспорта в кишечнике', severity: 'MEDIUM' },
    ],
    monitoring: [
      { what: 'Тиамин в крови', when: 'Каждые 12 нед', targetRange: '>70 нмоль/л' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: аллергия при в/в введении', 'При высоких дозах — бессонница'],
    dosage: { mg: 100, timing: 'утро с едой', form: 'тиамин или бенфотиамин' },
    bestForCourse: false,
    targetOrgan: 'Нейроны, миелиновые оболочки периферических нервов, кардиомиоциты',
    organMechanism: 'Окислительное декарбоксилирование α-кетокислот, энергопродукция в митохондриях, проведение нервного импульса',
    mechanismOfAction: 'Кофермент тиаминпирофосфат (ТПФ) для пируватдегидрогеназы и α-кетоглутаратдегидрогеназы; конверсия пирувата → ацетил-КоА; поддержка синтеза миелина; модуляция потенциал-зависимых натриевых каналов в нервах',
    clinicalEffect: 'Профилактика нейропатии, улучшение углеводного метаболизма, кардиопротекция, поддержка нервной проводимости',
    bestForm: 'Тиамин HCl 100 мг 100 мг 2x/д',
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
      { with: "vitamin_b2", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: 'iron', effect: 'Избыток рибофлавина снижает абсорбцию железа', mechanism: 'Хелатирование Fe2+ в просвете кишечника', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Рибофлавин в моче', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Окрашивание мочи в жёлтый', 'Редко: зуд кожи'],
    dosage: { mg: 10, timing: 'с едой', form: 'рибофлавин или R-5-P' },
    bestForCourse: false,
    targetOrgan: 'Гепатоциты, эпителий кожи, сетчатка глаза',
    organMechanism: 'Электрон-транспортная цепь митохондрий, антиоксидантная защита через рециклинг глутатиона, метаболизм железа',
    mechanismOfAction: 'Предшественник FAD и FMN — коферментов оксидоредуктаз дыхательной цепи (Комплексы I, II); рециклинг окисленного глутатиона (GSSG → GSH) через глутатионредуктазу; конверсия Fe3+ → Fe2+ для абсорбции железа',
    clinicalEffect: 'Антиоксидантная защита, поддержка метаболизма железа, профилактика хейлита и ангулярного стоматита',
    bestForm: 'Рибофлавин 10 мг 10 мг',
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
      { with: "vitamin_b3", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "pterostilbene", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Риск миопатии", mechanism: "Ниацин + статины — мышцы", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед', targetRange: 'ЛПНП<3.0 ЛПВП>1.0' }
    ],
    contraindications: ['Подагра', 'Язвенная болезнь', 'Декомпенсированный диабет'],
    sideEffects: ['Флаш (покраснение кожи)', 'Зуд', 'Повышение глюкозы', 'Повышение мочевой кислоты'],
    dosage: { mg: 500, timing: 'с едой', form: 'ниацин или ниацинамид' },
    bestForCourse: true,
    targetOrgan: 'Гепатоциты, эндотелий сосудов, кардиомиоциты, кожа',
    organMechanism: 'Синтез NAD+, липидный обмен, холестериновый гомеостаз, регуляция тонуса сосудов',
    mechanismOfAction: 'Предшественник NAD+ через путь Пресса-Хэндлера; субстрат для PARP (ремонт ДНК) и сиртуинов (SIRT1-7); ингибирование DGAT2 (снижение ТГ и ЛПНП, повышение ЛПВП); активация GPR109A (вазодилатация — «флаш»); снижение липопротеина(a)',
    clinicalEffect: 'Снижение ЛПНП и ТГ, повышение ЛПВП, улучшение липидного профиля на курсе ААС, коррекция дислипидемии',
    bestForm: 'Ниацин 500 мг 500 мг 2x/д',
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
      { with: "vitamin_b5", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: 'vitamin_b1', effect: 'B5 снижает абсорбцию тиамина при одновременном приёме', mechanism: 'Конкуренция за транспортные системы', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Кортизол утром', when: 'Каждые 8 нед', targetRange: '6-23 мкг/дл' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'пантотенат или пантетин' },
    bestForCourse: false,
    targetOrgan: 'Кора надпочечников, кожа, гепатоциты',
    organMechanism: 'Стероидогенез, синтез коэнзима А, ацетилирование, заживление тканей',
    mechanismOfAction: 'Предшественник КоА через 5-стадийный ферментативный путь: пантотенат → 4\'-фосфопантетеин → дефосфо-КоА → КоА; субстрат для ацил-переносящего белка (ACP) в синтезе жирных кислот; донор ацетильных групп в цикле Кребса',
    clinicalEffect: 'Поддержка стероидогенеза и синтеза половых гормонов, улучшение состояния кожи, заживление ран',
    bestForm: 'Пантотенат кальция 500 мг 500 мг 2x/д',
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
      { with: "biotin", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: 'vitamin_b5', effect: 'B5 и биотин конкурируют за всасывание в тонком кишечнике', mechanism: 'Конкуренция за Na+-зависимый транспортер SMVT', severity: 'LOW' },
      { with: 'zinc', effect: 'Цинк снижает биодоступность биотина', mechanism: 'Образование нерастворимых комплексов', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Биотин в крови', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: акне при высоких дозах', 'Мешает лабораторным тестам'],
    dosage: { mg: 5, timing: 'с едой', form: 'биотин капсулы' },
    bestForCourse: false,
    targetOrgan: 'Кератиноциты кожи, мышечные клетки',
    organMechanism: 'Синтез кератина, глюконеогенез, метаболизм жирных кислот и аминокислот',
    mechanismOfAction: 'Кофермент карбоксилаз: ацетил-КоА-карбоксилазы (синтез жирных кислот), пропионил-КоА-карбоксилазы (глюконеогенез) и пируват-карбоксилазы (цикл Кребса); донор CO2-групп; активация синтеза кератина в кератиноцитах',
    clinicalEffect: 'Укрепление ногтей и волос, улучшение состояния кожи, поддержка энергетического метаболизма',
    bestForm: 'Биотин 5000 мкг 5 мг',
  },
folate: {
    id: 'folate',
    name: 'Folate',
    nameRu: 'Фолат (Витамин В9)',
    tier: 'core',
    category: ['vitamin', 'hematologic', 'methylation'],
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
      { with: "vitamin_b12", effect: "В12 + Фолат — синергия метилирования и эритропоэза", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "betaine", effect: "Бетаин + Фолат — метилирование", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "folate", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Гомоцистеин', when: 'Каждые 8 нед', targetRange: '<15 мкмоль/л' },
      { what: 'Фолат в крови', when: 'Каждые 12 нед', targetRange: '>10 нмоль/л' }
    ],
    contraindications: ['В12-дефицитная анемия (маскировка)', 'Эпилепсия (с осторожностью)'],
    sideEffects: ['Редко: аллергия', 'Маскировка В12-дефицита без В12'],
    dosage: { mg: 0.8, timing: 'с едой', form: 'метилфолат (5-MTHF)' },
    bestForCourse: true,
    targetOrgan: 'Гепатоциты, костный мозг (эритробласты), нейроны',
    organMechanism: 'Метилирование (донор метильных групп), синтез ДНК/РНК, продукция эритроцитов, снижение гомоцистеина',
    mechanismOfAction: 'Кофактор метионинсинтазы (донор метила для реметилирования гомоцистеина через B12), кофактор тимидилатсинтазы (синтез dTMP из dUMP), участие в пуриновом синтезе',
    clinicalEffect: 'Снижение гомоцистеина, профилактика мегалобластной анемии, поддержка метилирования ДНК',
    bestForm: 'Метилфолат (5-MTHF) 800 мкг с едой',
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
      { with: "vitamin_e", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "omega3", effect: "Витамин Е защищает Омега-3 от перекисного окисления", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "astaxanthin", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "E снижает агрегацию тромбоцитов", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Витамин Е в крови', when: 'Каждые 12 нед', targetRange: '12-46 мкмоль/л' }
    ],
    contraindications: ['Приём антикоагулянтов', 'Дефицит витамина К'],
    sideEffects: ['При высоких дозах — кровоточивость', 'Взаимодействие с антикоагулянтами'],
    dosage: { mg: 200, timing: 'с едой (жирорастворимый)', form: 'смешанные токоферолы' },
    bestForCourse: true,
    targetOrgan: 'Клеточные мембраны (фосфолипидный бислой), митохондрии, сосудистый эндотелий',
    organMechanism: 'Защита полиненасыщенных жирных кислот мембран от перекисного окисления, стабилизация мембран, модуляция иммунитета',
    mechanismOfAction: 'Донор электрона для нейтрализации липидных пероксильных радикалов (TOH→TO•→регенерация аскорбатом/глутатионом), ингибирование протеинкиназы C (пролиферация гладкомышечных клеток), модуляция фосфолипазы A2',
    clinicalEffect: 'Защита клеточных мембран от окисления, предотвращение атеросклероза, поддержка иммунитета',
    bestForm: 'Смешанные токоферолы 400 МЕ (200 мг) 2x/д',
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
      { with: "vitamin_b_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: 'vitamin_c', effect: 'Высокие дозы C окисляют B12 в комплексе', mechanism: 'Окислительная деградация кобаламина', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Гомоцистеин', when: 'Каждые 8 нед', targetRange: '<15 мкмоль/л' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Окрашивание мочи (В2)', 'Тошнота натощак', 'При высоких дозах B6 — нейропатия'],
    dosage: { mg: 50, timing: 'утро с едой', form: 'капсулы B-50 или B-100' },
    bestForCourse: true,
    targetOrgan: 'Нейроны и глия, гепатоциты, миелиновые оболочки периферических нервов',
    organMechanism: 'Метилирование (SAM-цикл), энергопродукция, синтез нейротрансмиттеров, кроветворение',
    mechanismOfAction: 'Совместное действие B1 (ТПФ), B2 (FAD), B3 (NAD+), B5 (КоА), B6 (ПАЛФ), B7 (биотин), B9 (ТГФ), B12 (метилкобаламин) как коферментов в цикле Кребса, метилировании гомоцистеина и синтезе катехоламинов; донация метильных групп через метил-ТГФ и метил-B12',
    clinicalEffect: 'Комплексная поддержка нервной системы, снижение гомоцистеина, улучшение энергетического метаболизма, профилактика анемии',
    bestForm: 'B-50 Комплекс 50 мг',
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
    synergies: [
        {with: "vitamin_b_complex", effect: "Сигнальные пути", mechanism: "Инозитол — вторичный мессенджер", severity: "MEDIUM"},
        {with: "choline", effect: "Фосфолипидный обмен", mechanism: "Оба — фосфатидилинозитол", severity: "MEDIUM"},
        {with: "folic_acid", effect: "Репродуктивное здоровье", mechanism: "Инозитол + фолат — СПКЯ", severity: "HIGH"},
      ],
    conflicts: [
      { with: 'lithium', effect: 'Инозитол снижает эффективность лития при биполярном расстройстве', mechanism: 'Антагонизм на уровне инозитол-фосфатного цикла', severity: 'MEDIUM' },
    ],
    monitoring: [
      { what: 'Инсулин натощак', when: 'Каждые 8 нед', targetRange: '<12 мкЕд/мл' }
    ],
    contraindications: ['Беременность (с осторожностью)'],
    sideEffects: ['Редко: диарея при высоких дозах', 'Метеоризм'],
    dosage: { mg: 2000, timing: '2x/д с едой', form: 'мио-инозитол или смесь 40:1' },
    bestForCourse: false,
    targetOrgan: 'Нейроны, гепатоциты, клетки яичников/яичек',
    organMechanism: 'Инсулиновая сигнализация, серотониновая нейротрансмиссия, фосфолипидный обмен',
    mechanismOfAction: 'Второй мессенджер инсулина через фосфатидилинозитол-3-киназу (PI3K)/Akt путь; предшественник фосфатидилинозитола в клеточных мембранах; модуляция Ca2+-зависимых сигналов; холинергическая регуляция через синтез фосфатидилхолина',
    clinicalEffect: 'Улучшение инсулиновой чувствительности, снижение тревожности, поддержка репродуктивной функции, профилактика метаболического синдрома',
    bestForm: 'Мио-инозитол 2000 мг 2 г 2x/д',
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
      { with: "folate", effect: "Бетаин + Фолат — метилирование", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "betaine", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: 'methotrexate', effect: 'Бетаин снижает токсичность метотрексата, но может изменять его фармакокинетику', mechanism: 'Конкуренция за транспорт фолатов', severity: 'MEDIUM' },
    ],
    monitoring: [
      { what: 'Гомоцистеин', when: 'Каждые 8 нед', targetRange: '<15 мкмоль/л' },
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед', targetRange: '<40 Ед/л' }
    ],
    contraindications: ['Тяжёлая почечная недостаточность'],
    sideEffects: ['Диарея при высоких дозах', 'Тошнота'],
    dosage: { mg: 3000, timing: 'с едой 2x/д', form: 'бетаин HCl или безводный бетаин' },
    bestForCourse: false,
    targetOrgan: 'Гепатоциты, кардиомиоциты',
    organMechanism: 'Метилирование гомоцистеина, осмопротекция, липидный обмен, детоксикация',
    mechanismOfAction: 'Донор метильных групп через превращение гомоцистеина в метионин (бетаин-гомоцистеин-метилтрансфераза, BHMT); осмолит — защита клеток от осмотического стресса через накопление бетаина; стимуляция секреции жёлчи; снижение синтеза ТГ в печени через ингибирование DGAT',
    clinicalEffect: 'Снижение уровня гомоцистеина, защита печени от жировой инфильтрации, поддержка сердечно-сосудистой системы',
    bestForm: 'Бетаин HCl 3 г 3 г 2x/д',
  },
pqq: {
    id: 'pqq',
    name: 'PQQ',
    nameRu: 'Пирролохинолинхинон (PQQ)',
    tier: 'advanced',
    category: ['antioxidant', 'neuroprotector', 'mitochondrial'],
    forms: [
      { id: 'pqq', name: 'PQQ', nameRu: 'PQQ 20 мг', dose: '20 мг', best: true },
      { id: 'pqq_2', name: 'PQQ', nameRu: 'PQQ + CoQ10 комплекс', dose: '20 мг', best: false }
    ],
    organs: ['BRAIN', 'HEART'],
    systems: ['neuro', 'cardio', 'metabolic'],
    mechanisms: ['MITOCHONDRIAL_BIOGENESIS', 'ANTIOXIDANT', 'NGF_STIMULATION', 'ENERGY_PRODUCTION'],
    description: 'PQQ — редокс-кофактор, стимулирует биогенез митохондрий через PGC-1a. Синергичен с CoQ10.',
    synergies: [
      { with: "coq10", effect: "PQQ + КоКю10 — митохондриальный биогенез", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: 'niacin', effect: 'Ниацин может снижать эффект PQQ на биогенез митохондрий', mechanism: 'Конкуренция за путь NAD+-зависимой регуляции SIRT1', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Энергия/усталость', when: 'Субъективно каждые 4 нед' }
    ],
    contraindications: ['Беременность', 'Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: бессонница при приёме вечером', 'Головная боль'],
    dosage: { mg: 20, timing: 'утро с едой', form: 'PQQ динатриевая соль' },
    bestForCourse: false,
    targetOrgan: 'Митохондрии нейронов, митохондрии кардиомиоцитов',
    organMechanism: 'Митохондриальный биогенез, антиоксидантная защита ЦНС, энергопродукция',
    mechanismOfAction: 'Активация сигнального пути PGC-1α через AMPK и SIRT1; редокс-циклирование между хиноновой и гидрохиноновой формами; стимуляция экспрессии NRF2 и фактора некроза опухоли; модуляция митофагии через PINK1/Parkin',
    clinicalEffect: 'Увеличение количества и функции митохондрий, нейропротекция, повышение энергетического статуса клеток',
    bestForm: 'PQQ 20 мг 20 мг',
  },
pterostilbene: {
    id: 'pterostilbene',
    name: 'Pterostilbene',
    nameRu: 'Птеростильбен',
    tier: 'advanced',
    category: ['antioxidant', 'cardioprotector', 'metabolic'],
    forms: [
      { id: 'pterostilbene', name: 'Pterostilbene', nameRu: 'Птеростильбен 250 мг', dose: '250 мг 2x/д', best: true },
      { id: 'pterostilbene_2', name: 'Pterostilbene', nameRu: 'Птеростильбен + Ресвератрол комплекс', dose: '250 мг', best: false }
    ],
    organs: ['HEART', 'BRAIN', 'LIVER'],
    systems: ['cardio', 'neuro', 'hepatic'],
    mechanisms: ['SIRT1_ACTIVATION', 'ANTIOXIDANT', 'LIPID_LOWERING', 'ANTI_INFLAMMATORY'],
    description: 'Птеростильбен — диметиловый аналог ресвератрола с биодоступностью 80%. Активирует SIRT1, снижает холестерин.',
    synergies: [
      { with: "vitamin_b3", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: 'aspirin', effect: 'Аспирин снижает биодоступность птеростильбена', mechanism: 'Ингибирование глюкуронизации в печени', severity: 'MEDIUM' },
    ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед', targetRange: 'ЛПНП<3.0' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Редко: диарея', 'Головная боль при высоких дозах'],
    dosage: { mg: 250, timing: 'утро с едой', form: 'птеростильбен капсулы' },
    bestForCourse: false,
    targetOrgan: 'Эндотелий сосудов, гепатоциты, кардиомиоциты',
    organMechanism: 'Антиоксидантная защита, регуляция липидного профиля, противовоспалительная сигнализация',
    mechanismOfAction: 'Активация SIRT1 и AMPK (как ресвератрол, но с лучшей биодоступностью); ингибирование COX-2 и NF-κB (противовоспалительное); хелатирование Cu2+ (улавливание супероксида); снижение экспрессии SREBP-1c и липогенных генов; повышение NO в эндотелии',
    clinicalEffect: 'Снижение ЛПНП и ТГ, улучшение чувствительности к инсулину, противовоспалительное и антиоксидантное действие, кардиопротекция',
    bestForm: 'Птеростильбен 250 мг 250 мг 2x/д',
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
      { with: "vitamin_b6", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "saw_palmetto", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "hormonal_therapy", effect: "Взаимодействие с гормонами", mechanism: "Может влиять на гормональный баланс", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'ПСА', when: 'Каждые 12 нед', targetRange: '<4 нг/мл' },
      { what: 'Свободный тестостерон', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Рак простаты (может маскировать ПСА)'],
    sideEffects: ['Редко: снижение либидо', 'Редко: желудочный дискомфорт'],
    dosage: { mg: 320, timing: 'с едой 2x/д', form: 'экстракт сереноа 85-95% жирных кислот' },
    bestForCourse: true,
    targetOrgan: 'Ткань предстательной железы, волосяные фолликулы',
    organMechanism: 'Ингибирование 5-α-редуктазы II типа, снижение DHT в простате, противовоспалительная защита',
    mechanismOfAction: 'Конкурентное ингибирование фермента 5-α-редуктазы (тип II), превращающего тестостерон в DHT; блокада связывания DHT с андрогенными рецепторами в простате; снижение продукции провоспалительных цитокинов (IL-6, TNF-α); ингибирование роста эпителия простаты через модуляцию TGF-β',
    clinicalEffect: 'Уменьшение объёма простаты, облегчение мочеиспускания, профилактика гиперплазии простаты, уменьшение выпадения волос по андрогенному типу',
    bestForm: 'Экстракт сереноа 320 мг 320 мг 2x/д',
  },
hcg: {
    id: 'hcg',
    name: 'HCG',
    nameRu: 'ХГЧ (Хорионический гонадотропин)',
    tier: 'specialty',
    category: ['peptide', 'hormonal', 'pharma'],
    forms: [
      { id: 'hcg', name: 'HCG', nameRu: 'ХГЧ 5000 МЕ', dose: '500 МЕ 2р/нед', best: true },
      { id: 'hcg_2', name: 'HCG', nameRu: 'ХГЧ 10000 МЕ', dose: '500 МЕ 2р/нед', best: false }
    ],
    organs: ['REPRODUCTIVE', 'TESTES'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['LH_MIMIC', 'TESTOSTERONE_PRODUCTION', 'SPERMATOGENESIS_RESTORE', 'TESTICULAR_VOLUME_PRESERVATION'],
    description: 'ХГЧ — мимик ЛГ, стимулирует клетки Лейдига к продукции тестостерона. Стандартная схема: 500 МЕ 2 раза в неделю, 3 недели приема, 1 неделя отдыха (3/1).',
    synergies: [
      { with: "testosterone", effect: "ХГЧ + Тестостерон — восстановление оси ГРГ-ЛГ", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "aromatase_inhibitor", effect: "Десенситизация", mechanism: "Высокие дозы ХГЧ (>1000 МЕ)", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Тестостерон общий', when: 'Каждые 4 нед', targetRange: '12-33 нмоль/л' },
      { what: 'Эстрадиол', when: 'Каждые 4 нед', targetRange: '<200 пмоль/л' }
    ],
    contraindications: ['Рак яичек', 'Рак простаты', 'Гинекомастия в анамнезе'],
    sideEffects: ['Гинекомастия (без ИА)', 'Задержка жидкости', 'Повышение эстрадиола'],
    dosage: { mg: 500, timing: '2x/нед, схема 3/1 (3 нед приема, 1 нед отдых)', form: 'ХГЧ лиофилизат (реконструкция)' },
    bestForCourse: true,
    targetOrgan: 'Клетки Лейдига яичек, семенные канальцы',
    organMechanism: 'Стимуляция стероидогенеза, поддержание объёма яичек, сперматогенез',
    mechanismOfAction: 'Связывание с рецепторами ЛГ на клетках Лейдига; активация аденилатциклазы → цАМФ → StAR-белок → транспорт холестерина в митохондрии → конверсия в прегненолон; стимуляция 3β-HSD и 17α-гидроксилазы для синтеза тестостерона; паракринная поддержка клеток Сертоли (сперматогенез)',
    clinicalEffect: 'Поддержание эндогенной продукции тестостерона на курсе ААС, предотвращение атрофии яичек, сохранение фертильности',
    bestForm: 'ХГЧ 5000 МЕ 500 МЕ 2р/нед',
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
      { with: "caffeine", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "alpha_lipoic", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "lions_mane", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'ТМАО', when: 'Каждые 12 нед', targetRange: '<5 мкмоль/л' },
      { what: 'Липидограмма', when: 'Каждые 8 нед', targetRange: 'ТГ<1.7 ммоль/л' }
    ],
    contraindications: ['Эпилепсия (с осторожностью)', 'Гипотиреоз (с осторожностью)'],
    sideEffects: ['Рыбный запах тела при высоких дозах', 'Тошнота натощак'],
    dosage: { mg: 2000, timing: 'натощак, 30 мин до тренировки', form: 'Л-карнитин тартрат или АЛК' },
    bestForCourse: true,
    targetOrgan: 'Митохондрии (кардиомиоциты, миоциты), гепатоциты',
    organMechanism: 'Транспорт длинноцепочечных жирных кислот через внутреннюю мембрану митохондрий, β-окисление, энергопродукция',
    mechanismOfAction: 'Эстерификация жирных кислот с карнитином (CPT1 на внешней мембране), транслокация через карнитин-ацилкарнитин-транслоказу (CACT), деэстерификация CPT2 в матриксе, доставка ацетильных групп в цикл Кребса',
    clinicalEffect: 'Увеличение энергетического метаболизма, сжигание жира, кардиопротекция, улучшение выносливости',
    bestForm: 'Л-Карнитин тартрат 2 г 2x/д',
  },
phosphatidylcholine: {
    id: 'phosphatidylcholine',
    name: 'Phosphatidylcholine',
    nameRu: 'Фосфатидилхолин (Лецитин/PPC)',
    tier: 'core',
    category: ['hepatoprotector', 'neuroprotector', 'choleretic'],
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
      { with: "huperzine_a", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "omega3", effect: "Фосфатидилхолин + Омега-3 — фосфолипиды мозга", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед', targetRange: '<40 Ед/л' },
      { what: 'ГГТ', when: 'Каждые 4 нед', targetRange: '<50 Ед/л' },
      { what: 'УЗИ печени', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Диарея при высоких дозах', 'Редко: тошнота'],
    dosage: { mg: 1200, timing: 'с едой 2x/д', form: 'PPC (полиенилфосфатидилхолин) или лецитин' },
    bestForCourse: true,
    targetOrgan: 'Гепатоциты (мембраны, митохондрии), нейрональные мембраны',
    organMechanism: 'Синтез фосфолипидов клеточных мембран, текучесть жёлчи, липидный транспорт, нейротрансмиссия',
    mechanismOfAction: 'Встраивание в мембраны (замещение дефектных фосфолипидов), эмульгирование холестерина в жёлчи (↓литогенности), активация липопротеинлипазы (↓ТГ), донор холина для синтеза ацетилхолина',
    clinicalEffect: 'Защита печени от жировой инфильтрации, улучшение оттока жёлчи, поддержка когнитивных функций',
    bestForm: 'PPC (Эссенциале) 1200 мг 2x/д',
  },
prebiotics: {
    id: 'prebiotics',
    name: 'Prebiotics',
    nameRu: 'Пребиотики',
    tier: 'standard',
    category: ['gut', 'metabolic'],
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
      { with: "probiotics", effect: "Синбиотик — пребиотики питают пробиотики", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "colloidal_minerals", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Калпротектин', when: 'Каждые 8 нед', targetRange: '<50 мкг/г' }
    ],
    contraindications: ['SIBO', 'FODMAP-непереносимость'],
    sideEffects: ['Метеоризм при начале', 'Диарея при высоких дозах'],
    dosage: { mg: 5000, timing: 'с едой, начать с 2-3 г', form: 'порошок пребиотического комплекса' },
    bestForCourse: true,
    targetOrgan: 'Энтероциты тонкой и толстой кишки',
    organMechanism: 'Питание полезной микрофлоры, продукция короткоцепочечных жирных кислот, укрепление кишечного барьера',
    mechanismOfAction: 'Субстрат для ферментации Bifidobacterium и Lactobacillus с продукцией SCFAs (бутират, ацетат, пропионат); снижение pH в просвете кишки (подавление патогенов); укрепление плотных контактов (tight junctions) энтероцитов через активацию GPCR41/43; пребиотический эффект через стимуляцию роста Akkermansia muciniphila',
    clinicalEffect: 'Улучшение микробиома, укрепление кишечного барьера, снижение системного воспаления, улучшение пищеварения',
    bestForm: 'Пребиотический комплекс 5 г 5 г 2x/д',
  },
glutamine: {
    id: 'glutamine',
    name: 'Glutamine',
    nameRu: 'Глутамин (Л-Глутамин)',
    tier: 'standard',
    category: ['amino', 'gut', 'immunomodulator'],
    forms: [
      { id: 'glutamine', name: 'Glutamine', nameRu: 'Л-Глутамин 5 г', dose: '5 г 2x/д', best: true },
      { id: 'glutamine_2', name: 'Glutamine', nameRu: 'Глутамин Премиум 5 г', dose: '5 г', best: false },
      { id: 'glutamine_3', name: 'Glutamine', nameRu: 'Аланил-глутамин 5 г', dose: '5 г', best: false }
    ],
    organs: ['INTESTINES', 'IMMUNE_SYSTEM', 'MUSCLES'],
    systems: ['immune', 'hepatic', 'metabolic'],
    mechanisms: ['INTESTINAL_CELL_FUEL', 'IMMUNE_CELL_PROLIFERATION', 'GLUTATHIONE_PRECURSOR', 'NITROGEN_TRANSPORT'],
    description: 'Глутамин — условно-незаменимая аминокислота, топливо для энтероцитов. Предшественник глутатиона. На курсе поддерживает кишечный барьер и иммунитет.',
    synergies: [
        {with: "probiotics", effect: "Здоровье кишечника", mechanism: "Глутамин — топливо энтероцитов", severity: "HIGH"},
        {with: "vitamin_c", effect: "Иммунитет кишечника", mechanism: "Оба поддерживают иммунитет слизистых", severity: "MEDIUM"},
        {with: "zinc_carnosine", effect: "Заживление ЖКТ", mechanism: "Оба восстанавливают барьер", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Возможное снижение эффективности противоэпилептических", mechanism: "Глутамин → глутамат в ЦНС", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Глутамин в плазме', when: 'Каждые 12 нед', targetRange: '500-900 мкмоль/л' }
    ],
    contraindications: ['Тяжёлая печёночная недостаточность'],
    sideEffects: ['Метеоризм при высоких дозах', 'Диарея при >15 г/д'],
    dosage: { mg: 5000, timing: 'натощак или после тренировки', form: 'Л-глутамин порошок' },
    bestForCourse: true,
    targetOrgan: 'Энтероциты, иммунные клетки (макрофаги, лимфоциты), миоциты',
    organMechanism: 'Энергетический субстрат для тонкой кишки, пролиферация иммунных клеток, транспорт азота в мышцы',
    mechanismOfAction: 'Окисление в энтероцитах (главное топливо); активация mTOR в лимфоцитах через транспорт аминокислот; предшественник глутатиона через глутамат-цистеин-лигазу; транспорт аммиака в почки (глутаминаза); гликонеогенез в печени через глутаминазу',
    clinicalEffect: 'Укрепление кишечного барьера, поддержка иммунитета слизистых, антикатаболический эффект, ускорение заживления ЖКТ',
    bestForm: 'Л-Глутамин 5 г 5 г 2x/д',
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
    synergies: [
        {with: "sulfur_compounds", effect: "Метаболизм сульфитов", mechanism: "Молибден — кофактор сульфитоксидазы", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "copper", effect: "Конкуренция", mechanism: "Высокие дозы Молибден снижают Cu", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Мочевая кислота', when: 'Каждые 12 нед', targetRange: '<420 мкмоль/л' }
    ],
    contraindications: ['Молибденовая подагра (редко)'],
    sideEffects: ['Тошнота'],
    dosage: { mg: 0.1, timing: 'с едой', form: 'молибден цитрат' },
    bestForCourse: false,
    targetOrgan: 'Гепатоциты, нефроны почек',
    organMechanism: 'Детоксикация сульфитов и ксантина, пуриновый метаболизм',
    mechanismOfAction: 'Кофактор сульфитоксидазы (окисление сульфита → сульфат); кофактор ксантиноксидазы (пуриновый катаболизм → мочевая кислота); участие в синтезе мочевой кислоты (антиоксидант); кофактор альдегидоксидазы (метаболизм ксенобиотиков)',
    clinicalEffect: 'Детоксикация сульфитов из пищи, поддержка пуринового обмена, профилактика непереносимости сульфитов',
    bestForm: 'Молибден 100 мкг 100 мкг',
  },
boron: {
    id: 'boron',
    name: 'Boron',
    nameRu: 'Бор',
    tier: 'advanced',
    category: ['mineral', 'hormonal', 'bone'],
    forms: [
      { id: 'boron', name: 'Boron', nameRu: 'Бор цитрат 3 мг', dose: '3 мг', best: true },
      { id: 'boron_2', name: 'Boron', nameRu: 'Бор глицинат 3 мг', dose: '3 мг', best: false }
    ],
    organs: ['BONES', 'REPRODUCTIVE'],
    systems: ['endocrine', 'musculoskeletal'],
    mechanisms: ['BONE_MINERALIZATION', 'FREE_TESTOSTERONE_INCREASE', 'VITAMIN_D_ACTIVATION', 'ESTROGEN_MODULATION'],
    description: 'Бор — следовой минерал, повышает свободный тестостерон и активирует витамин D. На курсе ААС поддерживает костную ткань.',
    synergies: [
      { with: "zinc", effect: "Бор + Цинк — свободный тестостерон", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Влияние на гормональную терапию", mechanism: "Бор модулирует эстроген и тестостерон", severity: "MEDIUM" },
      { with: "pharma", effect: "Потенциальное усиление эффекта НПВП", mechanism: "Бор может усиливать противовоспалительное действие", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Свободный тестостерон', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: тошнота при высоких дозах'],
    dosage: { mg: 3, timing: 'с едой', form: 'бор цитрат или глицинат' },
    bestForCourse: false,
    targetOrgan: 'Костная ткань, остеобласты, клетки гонад',
    organMechanism: 'Минерализация костей, повышение свободного тестостерона через SHBG, активация витамина D',
    mechanismOfAction: 'Снижение связывания тестостерона с SHBG (повышение свободного Т); активация 25-гидроксивитамина D в почках (CYP27B1); ингибирование ароматазы (снижение конверсии Т → Е2); увеличение экспрессии остеокальцина через BMP-сигналинг; модуляция рецепторов эстрогена (ERβ)',
    clinicalEffect: 'Повышение свободного тестостерона, поддержка костной плотности, улучшение минерализации костей',
    bestForm: 'Бор цитрат 3 мг 3 мг',
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
      { with: "silicon", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "calcium", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "glycine", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Снижение абсорбции тиамина (теоретически)", mechanism: "Кремний может связывать тиамин в ЖКТ", severity: "LOW" },
      { with: "pharma", effect: "Повышение абсорбции алюминия", mechanism: "Кремний может усиливать всасывание алюминия", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Костная плотность', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 10, timing: 'с едой', form: 'ортокремниевая кислота или экстракт хвоща' },
    bestForCourse: false,
    targetOrgan: 'Костная ткань, хрящевая ткань, кожа',
    organMechanism: 'Синтез коллагена, минерализация костей, формирование соединительной ткани',
    mechanismOfAction: 'Кофактор лизилоксидазы и пролилгидроксилазы (синтез коллагена); стимуляция остеобластов через Wnt/β-катенин; участие в перекрёстной сшивке коллагеновых волокон (силоксановые связи); активация щелочной фосфатазы (минерализация); усиление синтеза эластина',
    clinicalEffect: 'Укрепление костей и суставов, улучшение эластичности кожи, профилактика остеопороза, поддержка соединительной ткани',
    bestForm: 'Ортокремниевая кислота 10 мг 10 мг',
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
      { with: "vitamin_d3", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "vitamin_k2", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "sulforaphane", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "silicon", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "calcium", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "glycine", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "iron", effect: "Кальций блокирует всасывание железа", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "magnesium", effect: "Избыток кальция блокирует магний", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "pharma", effect: "ИПП снижают всасывание кальция", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "magnesium", effect: "Избыток кальция блокирует магний", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "iron", effect: "Кальций блокирует всасывание железа", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Кальций общий', when: 'Каждые 12 нед', targetRange: '2.1-2.6 ммоль/л' }
    ],
    contraindications: ['Гиперкальциемия', 'Камни в почках (с осторожностью)'],
    sideEffects: ['Запор при карбонате', 'Риск камней в почках при избытке'],
    dosage: { mg: 500, timing: 'с едой (2x/д)', form: 'цитрат или карбонат кальция' },
    bestForCourse: true,
    targetOrgan: 'Костная ткань (гидроксиапатит), миоциты, кардиомиоциты',
    organMechanism: 'Минерализация костей (99% Ca), сокращение мышц через кальмодулин, коагуляция, проведение нервного импульса',
    mechanismOfAction: 'Связывание с тропонином С (мышечное сокращение); активация кальмодулина через Ca2+-зависимую киназу; структурный компонент гидроксиапатита костей (минеральная фаза); кофактор факторов свёртывания (VII, IX, X); потенциал-зависимые Ca2+-каналы (возбудимость кардиомиоцитов)',
    clinicalEffect: 'Поддержание плотности костей на курсе ААС, профилактика остеопороза при ИА, нормальная мышечная сократимость',
    bestForm: 'Цитрат кальция 500 мг 500 мг 2x/д',
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
    synergies: [
        {with: "potassium", effect: "Электролитный баланс", mechanism: "Натрий/Калий насос — основа клетки", severity: "HIGH"},
        {with: "magnesium", effect: "Нервно-мышечная проводимость", mechanism: "Оба — критичные электролиты", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "lithium", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "magnesium", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Натрий в сыворотке', when: 'Каждые 4 нед', targetRange: '135-145 ммоль/л' }
    ],
    contraindications: ['Гипертоническая болезнь (ограничить)'],
    sideEffects: ['Отёки при избытке', 'Повышение давления при избытке'],
    dosage: { mg: 500, timing: 'с едой', form: 'натрия хлорид или цитрат' },
    bestForCourse: false,
    targetOrgan: 'Нефроны (канальцы), кардиомиоциты, миоциты',
    organMechanism: 'Электролитный баланс, регуляция объёма жидкости, потенциал действия, нервно-мышечная проводимость',
    mechanismOfAction: 'Создание трансмембранного градиента через Na+/K+-АТФазу; движущая сила вторичного активного транспорта (SGLT-1/2 в почках, NHE3 в ЖКТ); генерация потенциала действия в кардиомиоцитах (Na+-каналы Nav1.5); регуляция ренин-ангиотензин-альдостероновой системы через macula densa',
    clinicalEffect: 'Поддержание электролитного гомеостаза, профилактика гипонатриемии на диуретиках, нормальное проведение нервных импульсов',
    bestForm: 'Натрия цитрат 500 мг 500 мг 2x/д',
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
    synergies: [
        {with: "glucosamine", effect: "Синтез хряща", mechanism: "Марганец — кофактор гликозилтрансфераз", severity: "MEDIUM"},
        {with: "chondroitin", effect: "Структура хряща", mechanism: "Марганец — кофактор синтеза ГАГ", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "iron", effect: "Конкуренция за всасывание", mechanism: "Оба используют DMT1", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Марганец в крови', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: нейротоксичность при высоких дозах'],
    dosage: { mg: 5, timing: 'с едой', form: 'марганца глицинат' },
    bestForCourse: false,
    targetOrgan: 'Костная ткань, хрящевая ткань, гепатоциты',
    organMechanism: 'Антиоксидантная защита митохондрий (Mn-SOD), формирование костной и хрящевой ткани, глюконеогенез',
    mechanismOfAction: 'Кофактор Mn-супероксиддисмутазы (MnSOD/SOD2) в митохондриях; кофактор гликозилтрансфераз (синтез протеогликанов хряща); активация аргиназы (цикл мочевины); кофактор глутаминсинтетазы; стимуляция синтеза ГАГ и коллагена II типа в хондроцитах',
    clinicalEffect: 'Защита суставов от окислительного стресса, поддержка синтеза хряща, антиоксидантная защита митохондрий',
    bestForm: 'Марганца глицинат 5 мг 5 мг',
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
      { with: "selenium", effect: "Йод + Селен — щитовидная железа", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "lithium", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'ТТГ', when: 'Каждые 8 нед', targetRange: '0.4-4.0 мЕд/л' },
      { what: 'Т3 свободный', when: 'Каждые 8 нед', targetRange: '2.3-6.5 пмоль/л' }
    ],
    contraindications: ['Гипертиреоз', 'Тиреотоксикоз'],
    sideEffects: ['Акне при высоких дозах', 'Йод-индуцированный гипертиреоз (редко)'],
    dosage: { mg: 0.15, timing: 'с едой', form: 'йодид калия или ламинария' },
    bestForCourse: false,
    targetOrgan: 'Тиреоциты щитовидной железы, клетки гонад',
    organMechanism: 'Синтез тиреоидных гормонов (Т3/Т4), регуляция энергетического метаболизма, метаболизм эстрогенов',
    mechanismOfAction: 'Субстрат для тиреоидной пероксидазы (TPO): йодирование тирозина → MIT → DIT → Т3/Т4; активация рецепторов TRα/TRβ в ядре; стимуляция Na+/I- симпортера (NIS) в фолликулах; модуляция обмена эстрогенов через 2-гидроксилирование в печени',
    clinicalEffect: 'Поддержка функции щитовидной железы на курсе ААС, нормализация ТТГ, профилактика гипотиреоза',
    bestForm: 'Йодид калия 150 мкг 150 мкг',
  },
lithium: {
    id: 'lithium',
    name: 'Lithium',
    nameRu: 'Литий (микродозы)',
    tier: 'specialty',
    category: ['mineral', 'neuroprotector', 'pharma'],
    forms: [
      { id: 'lithium', name: 'Lithium', nameRu: 'Оротат лития 1 мг', dose: '1 мг', best: true },
      { id: 'lithium_2', name: 'Lithium', nameRu: 'Аспартат лития 1 мг', dose: '1 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['MOOD_STABILIZATION', 'NEUROPROTECTION', 'GSK3_INHIBITION', 'BDNF_INCREASE'],
    description: 'Литий в микродозах — нейропротектор, стабилизирует настроение через ингибирование GSK-3b и повышение BDNF.',
    synergies: [
        {with: "omega3", effect: "Нейропротекция", mechanism: "Оба поддерживают мозг", severity: "MEDIUM"},
        {with: "vitamin_b_complex", effect: "Стабильность настроения", mechanism: "Литий + B — нейротрансмиттеры", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "sodium", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "iodine", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "magnesium", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Литий в крови', when: 'Каждые 12 нед', targetRange: '<0.6 ммоль/л (микродозы)' }
    ],
    contraindications: ['Болезнь почек', 'Дегидратация'],
    sideEffects: ['Редко побочные в микродозах', 'При превышении — тремор', ' полиурия'],
    dosage: { mg: 1, timing: 'утро', form: 'оротат лития или аспартат' },
    bestForCourse: false,
    targetOrgan: 'Нейроны и глия головного мозга, периферические нервы',
    organMechanism: 'Стабилизация настроения, нейропротекция, ингибирование GSK-3β, повышение BDNF',
    mechanismOfAction: 'Ингибирование киназы GSK-3β (гиперфосфорилирование тау-белка); активация PI3K/Akt (антиапоптотический сигналинг); повышение экспрессии BDNF и Bcl-2; стабилизация инозитол-фосфатного цикла (снижение IP3); модуляция NMDA-рецепторов через глутамат; снижение уровня NO в ЦНС; хелатирование Mg2+ (модуляция синаптической пластичности)',
    clinicalEffect: 'Стабилизация настроения, нейропротекция, профилактика депрессии на курсе ААС, улучшение когнитивной гибкости',
    bestForm: 'Оротат лития 1 мг 1 мг',
  },
vanadium: {
    id: 'vanadium',
    name: 'Vanadium',
    nameRu: 'Ванадий',
    tier: 'specialty',
    category: ['mineral', 'metabolic', 'pharma'],
    forms: [
      { id: 'vanadium', name: 'Vanadium', nameRu: 'Ванадила сульфат 100 мкг', dose: '100 мкг', best: true },
      { id: 'vanadium_2', name: 'Vanadium', nameRu: 'BMV (бис-мальтолатооксо-ванадий) 100 мкг', dose: '100 мкг', best: false }
    ],
    organs: ['LIVER', 'PANCREAS', 'MUSCLES'],
    systems: ['hepatic', 'endocrine', 'metabolic'],
    mechanisms: ['INSULIN_MIMETIC', 'GLUCONEOGENESIS_INHIBITION', 'GLYCOGEN_SYNTHESIS', 'PTP_INHIBITION'],
    description: 'Ванадий — инсулиномиметик. На курсе ААС поддерживает углеводный обмен.',
    synergies: [
        {with: "chromium", effect: "Метаболизм глюкозы", mechanism: "Оба имитируют инсулин", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Аддитивная гипогликемия при диабетической терапии", mechanism: "Ванадий имитирует инсулин", severity: "MEDIUM" },
      { with: "pharma", effect: "Потенцирование антикоагулянтов", mechanism: "Ванадий может влиять на гемостаз", severity: "LOW" },
      { with: "pharma", effect: "Аддитивная нефротоксичность с некоторыми препаратами", mechanism: "Ванадий выводится почками", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед', targetRange: '<6.1 ммоль/л' }
    ],
    contraindications: ['Беременность', 'Кормление грудью'],
    sideEffects: ['Тошнота', 'Зелёный стул (ванадила сульфат)'],
    dosage: { mg: 0.1, timing: 'с едой', form: 'ванадила сульфат или BMV' },
    bestForCourse: false,
    targetOrgan: 'Гепатоциты, β-клетки поджелудочной железы, миоциты',
    organMechanism: 'Инсулиномиметический эффект, ингибирование глюконеогенеза, стимуляция синтеза гликогена',
    mechanismOfAction: 'Ингибирование протеинтирозинфосфатазы-1B (PTP1B) — усиление фосфорилирования IR/IRS-1; активация PI3K/Akt пути (транслокация GLUT4); ингибирование глюкозо-6-фосфатазы (глюконеогенез); активация гликогенсинтазы; миметик инсулина через ингибирование тирозин-фосфатаз; модуляция AMPK',
    clinicalEffect: 'Улучшение чувствительности к инсулину, снижение глюкозы крови, поддержка углеводного обмена на курсе ААС',
    bestForm: 'Ванадила сульфат 100 мкг 100 мкг',
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
    synergies: [
        {with: "calcium", effect: "Костная минерализация", mechanism: "Кальций:Фосфор = 2:1 для костей", severity: "HIGH"},
        {with: "vitamin_d3", effect: "Всасывание фосфора", mechanism: "Витамин D3 регулирует фосфатный транспорт", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "magnesium", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Фосфор в крови', when: 'Каждые 12 нед', targetRange: '0.8-1.5 ммоль/л' }
    ],
    contraindications: ['Гиперфосфатемия', 'Почечная недостаточность'],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 500, timing: 'с едой', form: 'дикальцийфосфат или фосфат калия' },
    bestForCourse: false,
    targetOrgan: 'Костная ткань (кристаллы гидроксиапатита), клетки миокарда, нефроны',
    organMechanism: 'Минерализация костей, синтез АТФ, фосфолипидный синтез, буферная система',
    mechanismOfAction: 'Структурный компонент гидроксиапатита Ca10(PO4)6(OH)2; субстрат для синтеза АТФ (окислительное фосфорилирование); компонент фосфолипидов мембран; 2,3-ДФГ в эритроцитах (отдача O2 тканям); фосфатный буфер (поддержание pH); активация креатинкиназы (CrP → АТФ)',
    clinicalEffect: 'Поддержка костной плотности, обеспечение энергетического метаболизма, буферная система крови',
    bestForm: 'Дикальцийфосфат 500 мг 500 мг 2x/д',
  },
msm: {
    id: 'msm',
    name: 'MSM',
    nameRu: 'МСМ (Метилсульфонилметан)',
    tier: 'advanced',
    category: ['joint', 'anti_inflammatory'],
    forms: [
      { id: 'msm', name: 'MSM', nameRu: 'МСМ 1500 мг', dose: '1.5 г 2x/д', best: true },
      { id: 'msm_2', name: 'MSM', nameRu: 'МСМ порошок 3 г', dose: '1.5 г', best: false }
    ],
    organs: ['JOINTS', 'SKIN', 'MUSCLES'],
    systems: ['musculoskeletal'],
    mechanisms: ['SULFUR_DONOR', 'COLLAGEN_SYNTHESIS', 'ANTI_INFLAMMATORY', 'GLUCOSAMINE_POTENTIATION'],
    description: 'МСМ — органическая сера, донор сульфидных групп для синтеза коллагена. Синергичен с глюкозамином. На курсе защищает суставы.',
    synergies: [
      { with: "glucosamine", effect: "Глюкозамин + МСМ — сера для хряща + строительный блок", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Потенцирование антикоагулянтов (теоретически)", mechanism: "МСМ может замедлять свёртываемость", severity: "LOW" },
      { with: "alcohol", effect: "Снижение эффективности МСМ при регулярном алкоголе", mechanism: "Алкоголь нарушает метаболизм серы", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Боль в суставах', when: 'Субъективно каждые 2 нед' }
    ],
    contraindications: ['Аллергия на серу (редко)'],
    sideEffects: ['Редко: тошнота', 'Диарея при высоких дозах'],
    dosage: { mg: 1500, timing: 'с едой 2x/д', form: 'МСМ капсулы или порошок' },
    bestForCourse: false,
    targetOrgan: 'Хрящевая ткань, кожа, соединительная ткань мышц',
    organMechanism: 'Донор серы для синтеза коллагена, противовоспалительное действие, потенцирование глюкозамина',
    mechanismOfAction: 'Донор метилсульфонильных групп (-SO2-CH3) для синтеза серосодержащих аминокислот (метионин, цистеин); ингибирование NF-κB и COX-2 (снижение воспаления); подавление экспрессии MMP-9 (защита хряща); увеличение проницаемости клеточных мембран для глюкозамина; хелатирование Cu2+ (снижение оксидативного стресса)',
    clinicalEffect: 'Уменьшение боли в суставах, улучшение подвижности, ускорение восстановления после тренировок',
    bestForm: 'МСМ 1500 мг 1.5 г 2x/д',
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
    synergies: [
        {with: "vitamin_complex", effect: "Полный спектр", mechanism: "Следовые элементы — кофакторы", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Взаимодействие с хелатными агентами", mechanism: "Хелаторы могут снижать абсорбцию микроэлементов", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Микроэлементы в волосах', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Гемохроматоз', 'Почечная недостаточность'],
    sideEffects: ['Редко: тошнота натощак'],
    dosage: { mg: 1, timing: 'с едой', form: 'хелатный комплекс микроэлементов' },
    bestForCourse: false,
    targetOrgan: 'Гепатоциты, иммунные клетки (лейкоциты)',
    organMechanism: 'Кофактор 300+ ферментов, поддержка антиоксидантной защиты, синтез гормонов',
    mechanismOfAction: 'Комплексное действие следовых элементов: Se (GPx, дейодиназы), Mn (SOD2), Mo (сульфитоксидаза), Cr (хромодулин), V (инсулиномиметик), B (SHBG/Т), Si (коллаген); синергичное обеспечение активных центров ферментов и структурных белков',
    clinicalEffect: 'Комплексная поддержка метаболизма, восполнение дефицита микроэлементов, поддержка иммунитета',
    bestForm: 'Хелатный комплекс микроэлементов 1 мг',
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
    synergies: [
        {with: "vitamin_b3", effect: "Метаболизм глюкозы", mechanism: "Хром + ниацин — толерантность к глюкозе", severity: "MEDIUM"},
        {with: "vanadium", effect: "Инсулиноподобная активность", mechanism: "Оба усиливают инсулин", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Аддитивная гипогликемия при диабетической терапии", mechanism: "Хром усиливает действие инсулина", severity: "MEDIUM" },
      { with: "pharma", effect: "Снижение абсорбции тиреоидных гормонов", mechanism: "Хром может связывать L-тироксин", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 8 нед', targetRange: '<6.1 ммоль/л' },
      { what: 'Инсулин натощак', when: 'Каждые 8 нед', targetRange: '<12 мкЕд/мл' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: тошнота', 'Головная боль при высоких дозах'],
    dosage: { mg: 0.2, timing: 'с едой', form: 'хрома пиколинат или хелат' },
    bestForCourse: false,
    targetOrgan: 'β-клетки поджелудочной железы, миоциты, гепатоциты',
    organMechanism: 'Усиление действия инсулина через хромодулин, метаболизм глюкозы, синтез гликогена',
    mechanismOfAction: 'Активация хромодулина (олигопептидный комплекс хрома с аполипопротеином) → усиление фосфорилирования инсулинового рецептора; повышение транслокации GLUT4 в мышцах; увеличение активности гликогенсинтазы (запасание гликогена); снижение активности липазы (уменьшение липолиза); модуляция секреции инсулина β-клетками через KATP-каналы',
    clinicalEffect: 'Улучшение толерантности к глюкозе, снижение инсулинорезистентности на курсе ААС, стабилизация уровня сахара',
    bestForm: 'Хрома пиколинат 200 мкг 200 мкг',
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
    synergies: [
        {with: "vitamin_complex", effect: "Полный минеральный спектр", mechanism: "Коллоидные минералы — наноразмерные", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "prebiotics", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "magnesium", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Общий минеральный статус', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Гипервитаминоз', 'Аллергия на компоненты'],
    sideEffects: ['Металлический привкус', 'Редко: тошнота'],
    dosage: { mg: 15, timing: 'натощак', form: 'коллоидная жидкая форма' },
    bestForCourse: false,
    targetOrgan: 'Гепатоциты, костная ткань, нефроны',
    organMechanism: 'Восполнение 70+ микроэлементов в биодоступной форме, активация ферментов, электролитный баланс',
    mechanismOfAction: 'Наноразмерные коллоидные частицы минералов с высокой биодоступностью через эндоцитоз энтероцитами; прямое поступление в лимфатическую систему минуя печёночный метаболизм; одновременное восполнение макро- и микроэлементов в физиологических соотношениях; поддержка pH-буферных систем',
    clinicalEffect: 'Восполнение минерального статуса, улучшение электролитного баланса, общее укрепление организма',
    bestForm: 'Коллоидные минералы жидкие 15 мг',
  },
strontium: {
    id: 'strontium',
    name: 'Strontium',
    nameRu: 'Стронций',
    tier: 'specialty',
    category: ['mineral', 'bone', 'pharma'],
    forms: [
      { id: 'strontium', name: 'Strontium', nameRu: 'Стронция ренелат 680 мг', dose: '680 мкг', best: true },
      { id: 'strontium_2', name: 'Strontium', nameRu: 'Стронция цитрат 340 мг', dose: '680 мкг', best: false }
    ],
    organs: ['BONES'],
    systems: ['musculoskeletal'],
    mechanisms: ['BONE_FORMATION', 'OSTEOCLAST_INHIBITION', 'CALCIUM_ABSORPTION', 'BONE_MINERAL_DENSITY'],
    description: 'Стронций (ренелат) — увеличивает костное формирование и подавляет резорбцию.',
    synergies: [
        {with: "vitamin_d3", effect: "Костная плотность", mechanism: "Стронций замещает Ca, Витамин D3 — всасывание", severity: "MEDIUM"},
        {with: "vitamin_k2", effect: "Правильная минерализация", mechanism: "Витамин K2 направляет минералы в кости", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "calcium", effect: "Конкуренция за всасывание", mechanism: "Принимать в разное время", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Денситометрия', when: 'Каждые 12 мес' },
      { what: 'Кальций', when: 'Каждые 12 нед', targetRange: '2.1-2.6 ммоль/л' }
    ],
    contraindications: ['Тяжёлая почечная недостаточность', 'Венозная тромбоэмболия'],
    sideEffects: ['Тошнота', 'Диарея', 'Редко: сыпь'],
    dosage: { mg: 0.68, timing: 'на ночь (отдельно от Ca)', form: 'стронция ренелат' },
    bestForCourse: false,
    targetOrgan: 'Остеобласты и остеокласты костной ткани',
    organMechanism: 'Стимуляция костеобразования и подавление костной резорбции, модуляция кальциевого обмена',
    mechanismOfAction: 'Активация кальций-чувствительного рецептора (CaSR) на остеобластах; стимуляция репликации остеобластов через ERK1/2-MAPK; ингибирование дифференцировки остеокластов через RANKL/OPG (снижение числа остеокластов); частичное замещение Ca2+ в гидроксиапатите (увеличение прочности кристалла); апоптоз остеокластов через каспаза-9',
    clinicalEffect: 'Увеличение костной плотности, профилактика остеопороза, укрепление костной ткани на курсе ААС',
    bestForm: 'Стронция ренелат 680 мг 680 мкг',
  },
omega6: {
    id: 'omega6',
    name: 'Omega-6',
    nameRu: 'Омега-6 (GLA)',
    tier: 'standard',
    category: ['fatty_acid', 'anti_inflammatory'],
    forms: [
      { id: 'omega6', name: 'Omega-6', nameRu: 'Масло энотеры 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'omega6_2', name: 'Omega-6', nameRu: 'Масло бурачника 500 мг', dose: '500 мг', best: false }
    ],
    organs: ['SKIN', 'REPRODUCTIVE'],
    systems: ['endocrine', 'reproductive'],
    mechanisms: ['GLA_ANTI_INFLAMMATORY', 'PROSTAGLANDIN_BALANCE', 'SKIN_BARRIER', 'HORMONE_REGULATION'],
    description: 'Омега-6 (гамма-линоленовая кислота) — из энотеры и бурачника. Противовоспалительная через PGE1.',
    synergies: [
      { with: "omega6", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "omega3_excess", effect: "Нарушение баланса ЖК", mechanism: "Избыток омега-6 = воспаление", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Кожные покровы', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: диарея', 'Рыбная отрыжка'],
    dosage: { mg: 500, timing: 'с едой', form: 'масло энотеры или бурачника' },
    bestForCourse: false,
    targetOrgan: 'Кожа (кератиноциты), репродуктивные органы',
    organMechanism: 'Продукция PGE1 (противовоспалительный простагландин), поддержание кожного барьера, гормональная регуляция',
    mechanismOfAction: 'Субстрат для Δ6-десатуразы → GLA → дигомо-GLA → PGE1 (противовоспалительный); снижение продукции арахидоновой кислоты (конкурентное ингибирование Δ5-десатуразы); модуляция продукции цитокинов (снижение IL-1β, IL-6); поддержание церамидного барьера кожи; регуляция секреции пролактина через PGE1',
    clinicalEffect: 'Улучшение состояния кожи при акне и экземе, противовоспалительное действие, поддержка репродуктивной системы',
    bestForm: 'Масло энотеры 500 мг 500 мг 2x/д',
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
    synergies: [
        {with: "omega3", effect: "Комплексная ЖК поддержка", mechanism: "Омега-7 — слизистые, омега-3 — воспаление", severity: "MEDIUM"},
        {with: "probiotics", effect: "Здоровье слизистых", mechanism: "Оба поддерживают кишечный барьер", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: 'vitamin_e', effect: 'Высокие дозы Омега-7 снижают всасывание витамина E', mechanism: 'Конкуренция за встраивание в хиломикроны', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Кожа/слизистые', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: диарея'],
    dosage: { mg: 250, timing: 'с едой', form: 'масло облепихи или пальмитолеат' },
    bestForCourse: false,
    targetOrgan: 'Слизистые оболочки ЖКТ, кожа, гепатоциты',
    organMechanism: 'Защита слизистых, липидный метаболизм, улучшение чувствительности к инсулину',
    mechanismOfAction: 'Встраивание в фосфолипидный бислой мембран эпителия (укрепление барьера); активация PPAR-α и PPAR-γ (улучшение липидного профиля и чувствительности к инсулину); стимуляция секреции муцина бокаловидными клетками; снижение продукции IL-8 и TNF-α (противовоспалительное); антиоксидантное через редокс-регуляцию',
    clinicalEffect: 'Защита слизистых оболочек, улучшение состояния кожи, поддержка липидного метаболизма',
    bestForm: 'Масло облепихи 250 мг 250 мг 2x/д',
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
      { with: "omega3", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "omega9", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "egcg", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "polyphenol_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "mushroom_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: 'phytonadione', effect: 'Омега-9 может снижать абсорбцию жирорастворимых витаминов при избытке', mechanism: 'Конкуренция за мицеллярный транспорт', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед', targetRange: 'ЛПНП<3.0' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: диарея при избытке'],
    dosage: { mg: 1, timing: 'с едой', form: 'оливковое масло или авокадо' },
    bestForCourse: false,
    targetOrgan: 'Гепатоциты, эндотелий сосудов, кардиомиоциты',
    organMechanism: 'Снижение ЛПНП через стимуляцию желчеоттока, улучшение липидного профиля, противовоспалительное',
    mechanismOfAction: 'Активация PPAR-α (липогенные гены → β-окисление); снижение экспрессии SREBP-1c (синтез ТГ); стимуляция секреции жёлчных кислот через FXR (эмульгирование холестерина); встраивание в липопротеины (замещение насыщенных ЖК в ЛПНП — снижение атерогенности); модуляция NF-κB (противовоспалительное)',
    clinicalEffect: 'Снижение ЛПНП и ТГ, улучшение липидного профиля, кардиопротекция, противовоспалительное действие',
    bestForm: 'Оливковое масло 1 ст.л. 1 мг',
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
    synergies: [
        {with: "omega3", effect: "Состав тела", mechanism: "КЛК + омега-3 — жировой метаболизм", severity: "MEDIUM"},
        {with: "l_carnitine", effect: "Окисление жиров", mechanism: "Оба способствуют липолизу", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: 'vitamin_e', effect: 'CLA снижает уровень витамина E в тканях', mechanism: 'Конкуренция за антиоксидантную защиту мембран', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Жировая масса', when: 'Каждые 4 нед' },
      { what: 'Инсулин натощак', when: 'Каждые 8 нед', targetRange: '<12 мкЕд/мл' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Диарея', 'Тошнота', 'Редко: инсулинорезистентность при высоких дозах'],
    dosage: { mg: 3000, timing: 'с едой 2x/д', form: 'CLA капсулы (т10ц12+ц9т11 изомеры)' },
    bestForCourse: false,
    targetOrgan: 'Миоциты, гепатоциты, адипоциты',
    organMechanism: 'Стимуляция окисления жиров, сохранение сухой мышечной массы, улучшение инсулиновой чувствительности',
    mechanismOfAction: 'Агонист PPAR-α (усиление β-окисления) и PPAR-γ (улучшение чувствительности к инсулину); ингибирование липопротеинлипазы (снижение захвата ТГ адипоцитами); снижение экспрессии SREBP-1c (подавление липогенеза); активация AMPK (окисление жирных кислот); модуляция Δ9-десатуразы (соотношение ЖК в мембране)',
    clinicalEffect: 'Улучшение композиции тела, снижение жировой массы, сохранение мышц на дефиците калорий',
    bestForm: 'CLA 1500 мг 2x/д 3 г 2x/д',
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
    synergies: [
        {with: "l_carnitine", effect: "Производство кетонов", mechanism: "МСТ → кетоны, L-карнитин — транспорт", severity: "MEDIUM"},
        {with: "coq10", effect: "Энергетический метаболизм", mechanism: "МСТ — топливо, CoQ10 — АТФ", severity: "LOW"},
      ],
    conflicts: [
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "electrolyte_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Кетоны в крови', when: 'По показаниям' }
    ],
    contraindications: ['Декомпенсированный диабет'],
    sideEffects: ['Диарея при высоких дозах (старт с малых)', 'Тошнота при превышении'],
    dosage: { mg: 15000, timing: 'с едой (старт с 5 мл)', form: 'МСТ масло (С8>С10)' },
    bestForCourse: false,
    targetOrgan: 'Гепатоциты, миоциты, нейроны (кетоновые тела)',
    organMechanism: 'Продукция кетонов, быстрый энергетический субстрат, липидный метаболизм',
    mechanismOfAction: 'Быстрое всасывание в воротную вену (не требуется хиломикроны); митохондриальный транспорт независимо от CPT1/карнитина → прямое β-окисление; продукция кетонов (β-гидроксибутират, ацетоацетат) в печени; активация PPAR-α; кетоновые тела → энергия для мозга (альтернатива глюкозе); снижение грелина (аппетит)',
    clinicalEffect: 'Быстрый источник энергии, поддержка кетоза, улучшение когнитивной функции, контроль аппетита',
    bestForm: 'МСТ масло С8 (каприловое) 15 г 2x/д',
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
    synergies: [
        {with: "hyaluronic", effect: "Увлажнение кожи", mechanism: "Церамиды — барьер, гиалуронка — увлажнение", severity: "MEDIUM"},
        {with: "collagen", effect: "Структурная поддержка кожи", mechanism: "Оба — компоненты матрикса", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: 'vitamin_a', effect: 'Церамиды могут усиливать ретиноевый дерматит', mechanism: 'Синергичное усиление кератинизации', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Кожа/суставы', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 1, timing: 'с едой', form: 'церамиды (экстракт или синтетические)' },
    bestForCourse: false,
    targetOrgan: 'Кожа (эпидермис), хрящевая ткань, синовиальная жидкость',
    organMechanism: 'Формирование кожного барьера, смазка суставов, клеточная сигнализация, регуляция апоптоза',
    mechanismOfAction: 'Синтез церамидов из сфингозина + жирной кислоты (церамидсинтаза CerS1-6); структурный компонент lamellar bodies (роговой слой кожи); поддержка гидратации через связывание воды в stratum corneum; снижение трансэпидермальной потери воды (TEWL); смазка хряща через встраивание в синовиальную жидкость; модуляция апоптоза через сфингозин-1-фосфатный путь',
    clinicalEffect: 'Увлажнение кожи, укрепление кожного барьера, поддержка суставов, антивозрастной эффект на кожу',
    bestForm: 'Церамиды 30 мг 1 мг',
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
    synergies: [
        {with: "probiotics", effect: "Здоровье кишечника", mechanism: "Бутират — топливо колоноцитов", severity: "HIGH"},
        {with: "fiber", effect: "Производство бутирата", mechanism: "Клетчатка → бутират", severity: "MEDIUM"},
        {with: "glutamine", effect: "Заживление кишечника", mechanism: "Оба питают клетки", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: 'metformin', effect: 'Метформин снижает продукцию бутирата кишечной микробиотой', mechanism: 'Изменение состава микробиома через AMPK', severity: 'MEDIUM' },
    ],
    monitoring: [
      { what: 'Калпротектин', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: тошнота', 'Диарея при высоких дозах'],
    dosage: { mg: 1500, timing: 'с едой 2x/д', form: 'бутират натрия или кальция' },
    bestForCourse: false,
    targetOrgan: 'Колоноциты толстой кишки, энтероциты, гепатоциты',
    organMechanism: 'Энергетический субстрат для колоноцитов (70% энергии), укрепление кишечного барьера, противовоспалительное (ингибирование HDAC)',
    mechanismOfAction: 'Главное топливо колоноцитов через β-окисление в митохондриях (продукция АТФ); ингибирование гистондеацетилаз (HDAC1/3) → гиперацетилирование гистонов → регуляция экспрессии Foxp3 в Treg (иммуномодуляция); активация GPR41/GPR43 (GPCR) → продукция муцина и IL-18; укрепление tight junctions (ZO-1, occludin) через AMPK',
    clinicalEffect: 'Укрепление кишечного барьера, противовоспалительное действие, улучшение микробиома, профилактика синдрома дырявого кишечника',
    bestForm: 'Бутират натрия 1500 мг 1.5 г 2x/д',
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
      { with: "magnesium", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "silicon", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "calcium", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "glycine", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "zinc", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Потенцирование антипсихотиков", mechanism: "Глицин — коагонист NMDA-рецепторов", severity: "MEDIUM" },
      { with: "pharma", effect: "Снижение эффективности при NMDA-антагонистах", mechanism: "Конкурентное связывание с глициновым сайтом", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Качество сна', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: тошнота при высоких дозах'],
    dosage: { mg: 3000, timing: 'на ночь или 2x/д', form: 'глицин порошок или капсулы' },
    bestForCourse: false,
    targetOrgan: 'Нейроны ЦНС (глициновые рецепторы), гепатоциты, хондроциты',
    organMechanism: 'Тормозная нейротрансмиссия, синтез коллагена и глутатиона, регуляция сна',
    mechanismOfAction: 'Агонист глициновых рецепторов (GlyR) в спинном и головном мозге → Cl- ток → гиперполяризация; коагонист NMDA-рецепторов (глициновый сайт) для синаптической пластичности; субстрат для синтеза глутатиона (глутамат-цистеин-лигаза); донация глицина для коллагена (одна треть аминокислот в коллагене); снижение температуры тела (терморегуляция через NMDA)',
    clinicalEffect: 'Улучшение качества сна, снижение тревожности, поддержка синтеза коллагена, антиоксидантная (глутатион)',
    bestForm: 'Глицин 1000 мг 3 г 2x/д',
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
      { with: "caffeine", effect: "Теанин сглаживает стимуляцию кофеина", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "gaba", effect: "Теанин + ГАМК — двойное расслабление", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "stimulant_complex", effect: "Ослабление стимуляции кофеина", mechanism: "L-теанин антагонизирует возбуждающие эффекты", severity: "LOW" },
      { with: "pharma", effect: "Потенцирование седативных средств", mechanism: "Аддитивный GABA-ергический эффект", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Качество сна', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: сонливость при высоких дозах'],
    dosage: { mg: 200, timing: 'на ночь или утром', form: 'Л-теанин капсулы' },
    bestForCourse: false,
    targetOrgan: 'Нейроны ЦНС (префронтальная кора), периферические нервы',
    organMechanism: 'Индукция альфа-волн мозга, модуляция ГАМК-ергической системы, снижение кортизола, улучшение фокуса',
    mechanismOfAction: 'Связывание с глутаматными рецепторами (AMPA, каинатные) → модуляция возбуждающей нейротрансмиссии; повышение GABA через глутаматдекарбоксилазу (GAD); индукция α-волн (8-13 Гц) на ЭЭГ → релаксация без сонливости; ингибирование транспорта глутамата через EAAT; снижение норадреналина и кортизола (стресс-реакция); потенцирование дофамина в striatum',
    clinicalEffect: 'Снижение тревожности и стресса, улучшение фокуса и внимания, улучшение качества сна, мягкая седация',
    bestForm: 'Л-Теанин 200 мг 200 мг 2x/д',
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
      { with: "stimulant_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "rhodiola", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "l_dopa", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Тирозин в плазме', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Тошнота натощак при высоких дозах'],
    dosage: { mg: 500, timing: 'натощак утром', form: 'Л-тирозин капсулы' },
    bestForCourse: false,
    targetOrgan: 'Нейроны (дофаминовые, норадреналиновые), мозговое вещество надпочечников',
    organMechanism: 'Синтез дофамина и норадреналина, предшественник тиреоидных гормонов, стрессоустойчивость',
    mechanismOfAction: 'Субстрат для тирозингидроксилазы (TH) — конверсия L-тирозин → L-ДОФА (лимитирующая стадия синтеза катехоламинов); декарбоксилирование L-ДОФА → дофамин (DOPA-декарбоксилаза); β-оксигенация дофамина → норадреналин (дофамин-β-гидроксилаза); субстрат для тиреоидной пероксидазы (TPO) → тироксин; повышение устойчивости к стрессу через модуляцию HPA-оси',
    clinicalEffect: 'Улучшение когнитивной функции и фокуса, повышение стрессоустойчивости, поддержка синтеза тиреоидных гормонов',
    bestForm: 'Л-Тирозин 500 мг 500 мг 2x/д',
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
    synergies: [
        {with: "vitamin_b6", effect: "Синтез серотонина", mechanism: "B6 — кофактор декарбоксилазы", severity: "HIGH"},
        {with: "magnesium", effect: "Улучшение сна", mechanism: "Триптофан → мелатонин + Mg", severity: "MEDIUM"},
        {with: "vitamin_b3", effect: "Синтез ниацина", mechanism: "Триптофан → ниацин", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "x5htp", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "pharma", effect: "СИОЗС + Триптофан — риск серотонинового синдрома", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Качество сна', when: 'Субъективно' }
    ],
    contraindications: ['Приём антидепрессантов СИОЗС (серотониновый синдром)'],
    sideEffects: ['Сонливость', 'Тошнота натощак'],
    dosage: { mg: 500, timing: 'на ночь или натощак', form: 'Л-триптофан капсулы' },
    bestForCourse: false,
    targetOrgan: 'Нейроны ядер шва (серотониновые), эпифиз (мелатонин)',
    organMechanism: 'Синтез серотонина и мелатонина, регуляция настроения и сна, контроль аппетита',
    mechanismOfAction: 'Субстрат для триптофангидроксилазы (TPH2 в ЦНС) → 5-гидрокситриптофан (5-HTP); декарбоксилирование 5-HTP → серотонин (5-HT) через DOPA-декарбоксилазу; ацетилирование серотонина (AANAT) → N-ацетилсеротонин → мелатонин (ASMT); конкурентный транспорт через LAT1 (ограничение при высоких BCAA); активация 5-HT1A/5-HT2A рецепторов (модуляция настроения); снижение аппетита через POMC/CART в гипоталамусе',
    clinicalEffect: 'Улучшение настроения, нормализация сна, снижение тревожности, контроль аппетита',
    bestForm: 'Л-Триптофан 500 мг 500 мг 2x/д',
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
      { with: "magnesium", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "tryptophan", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Качество сна', when: 'Субъективно' }
    ],
    contraindications: ['Приём антидепрессантов СИОЗС (серотониновый синдром)'],
    sideEffects: ['Тошнота при начале', 'Сонливость'],
    dosage: { mg: 100, timing: 'на ночь или 2x/д', form: '5-HTP капсулы' },
    bestForCourse: false,
    targetOrgan: 'Нейроны ядер шва, эпифиз',
    organMechanism: 'Прямой предшественник серотонина и мелатонина, регуляция настроения и сна',
    mechanismOfAction: 'Декарбоксилирование 5-HTP → серотонин через DOPA-декарбоксилазу (AADC) в серотониновых нейронах; ацетилирование → мелатонин; активация 5-HT1A (пресинаптическая аутоингибиция) и 5-HT2C (аппетит); повышение плотности серотониновых рецепторов при хроническом приёме; модуляция BDNF/TrkB (антидепрессивный эффект)',
    clinicalEffect: 'Улучшение настроения, нормализация сна с серотонином, снижение аппетита, антидепрессивный эффект',
    bestForm: '5-HTP 100 мг 100 мг 2x/д',
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
      { with: "magnesium", effect: "Магний — кофактор ГАМК-рецепторов", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "ashwagandha", effect: "Ашваганда потенцирует ГАМК", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "theanine", effect: "Теанин потенцирует ГАМК-рецепторы", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "melatonin", effect: "Мелатонин + ГАМК — двойное расслабление", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "gaba", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Тревожность/сон', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: покалывание кожи', 'Сонливость'],
    dosage: { mg: 500, timing: 'на ночь', form: 'ГАМК капсулы или порошок' },
    bestForCourse: false,
    targetOrgan: 'Нейроны ЦНС (ГАМК-ергические синапсы), периферические нервы',
    organMechanism: 'Тормозная нейротрансмиссия, анксиолиз, улучшение сна, мышечная релаксация',
    mechanismOfAction: 'Связывание с ГАМК-А рецептором (хлорный канал → гиперполяризация); аллостерическая модуляция бензодиазепинового сайта ГАМК-А; снижение возбудимости нейронов через пресинаптическое ингибирование Ca2+-каналов; снижение норадреналина в LC (locus coeruleus); активация ГАМК-В (метаботропный) через G-белок → снижение цАМФ',
    clinicalEffect: 'Снижение тревожности, улучшение засыпания, мышечная релаксация, противотревожное действие на курсе ААС',
    bestForm: 'ГАМК 500 мг 500 мг 2x/д',
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
      { with: "beta_alanine", effect: "Креатин + β-аланин — сила + выносливость", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "caffeine", effect: "Повышение риска дегидратации", mechanism: "Кофеин усиливает диурез при нагрузке", severity: "LOW" },
      { with: "pharma", effect: "Потенциальная нефротоксичность при НПВП", mechanism: "Аддитивная нагрузка на почки", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Креатин в крови', when: 'Каждые 12 нед', targetRange: '0.5-1.0 мг/дл' }
    ],
    contraindications: ['Не выявлено'],
    sideEffects: ['Задержка воды (1-2 кг)', 'Редко: дискомфорт в ЖКТ'],
    dosage: { mg: 5000, timing: 'с едой или после тренировки', form: 'креатин моногидрат' },
    bestForCourse: true,
    targetOrgan: 'Миоциты (скелетные мышцы), нейроны, кардиомиоциты',
    organMechanism: 'Быстрый ресинтез АТФ (фосфокреатиновый буфер), энергообеспечение мышц и мозга',
    mechanismOfAction: 'Конверсия креатина в фосфокреатин (креатинкиназа CK-MM в мышцах, CK-BB в мозге); фосфокреатин + АДФ → АТФ + креатин (быстрый ресинтез АТФ при пиковой нагрузке); буфер H+ (закисление мышц); активация mTOR/S6K1 в мышцах; повышение гидратации клетки (волюмизация); антиоксидантное через стабилизацию митохондриальной мембраны; нейропротекция через фосфокреатиновый челнок',
    clinicalEffect: 'Увеличение силы и мощности, улучшение восстановления между подходами, рост мышечной массы, нейропротекция',
    bestForm: 'Креатин моногидрат 5 г 5 г 2x/д',
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
      { with: "creatine", effect: "β-аланин + Креатин — буфер + АТФ", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "taurine", effect: "Конкуренция за транспорт", mechanism: "Бета-аланин конкурирует с таурином", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Карнозин в мышцах', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Парестезия (покалывание кожи)', 'Редко: тошнота'],
    dosage: { mg: 3200, timing: '2x/д с едой', form: 'бета-аланин порошок или капсулы' },
    bestForCourse: false,
    targetOrgan: 'Миоциты (скелетные мышцы)',
    organMechanism: 'Синтез карнозина (внутриклеточный буфер H+), повышение выносливости',
    mechanismOfAction: 'Субстрат для карнозинсинтазы → карнозин (β-аланил-L-гистидин) — внутриклеточный буфер H+ (pKa 6.8); накопление карнозина в мышцах до 50-100 ммоль/кг сухого веса (повышение на 30-80% после 4 нед); отсрочка мышечного закисления (pH-буфер); повышение активности Ca2+-АТФазы в саркоплазматическом ретикулуме; хелатирование Cu2+ (снижение оксидативного стресса); донор гистидина для мышечного карнозина',
    clinicalEffect: 'Повышение выносливости при высокоинтенсивной нагрузке, отсрочка утомления, улучшение качества тренировок',
    bestForm: 'Бета-аланин 1600 мг 2x/д 3.2 г 2x/д',
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
      { with: "arginine", effect: "Цитруллин + Аргинин — усиление NO-продукции", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Гипотензия при нитратах", mechanism: "Аддитивное NO-опосредованное расширение сосудов", severity: "MEDIUM" },
      { with: "pharma", effect: "Усиление эффекта ингибиторов ФДЭ-5", mechanism: "Синергичный NO-механизм", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Артериальное давление', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: тошнота при высоких дозах'],
    dosage: { mg: 6000, timing: 'натощак, 30 мин до тренировки', form: 'Л-цитруллин или цитруллин малат' },
    bestForCourse: false,
    targetOrgan: 'Эндотелий сосудов, миоциты, нефроны почек',
    organMechanism: 'Продукция оксида азота (NO), детоксикация аммиака, улучшение кровотока и мышечного пампа',
    mechanismOfAction: 'Конверсия в L-аргинин в почках (аргининосукцинат-лиаза); L-аргинин → NO через эндотелиальную NO-синтазу (eNOS) с кофактором BH4; вазодилатация через цГМФ-зависимое расслабление гладкой мускулатуры; детоксикация аммиака через цикл мочевины в печени; увеличение орнитина (предшественник полиаминов → синтез белка); рециклинг аргинина из цитруллина (цитруллин-аргининовый шунт)',
    clinicalEffect: 'Улучшение кровотока и мышечного пампа, снижение давления, повышение выносливости, улучшение эректильной функции',
    bestForm: 'Л-Цитруллин 6 г 6 г 2x/д',
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
      { with: "citrulline", effect: "Цитруллин рециклирует аргинин → больше NO", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Взаимодействие", mechanism: "Аргинин может усиливать репликацию вирусов", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Артериальное давление', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: тошнота', 'Диарея при высоких дозах'],
    dosage: { mg: 3000, timing: 'натощак или на ночь', form: 'Л-аргинин капсулы или порошок' },
    bestForCourse: false,
    targetOrgan: 'Эндотелий сосудов, соматотрофы гипофиза, миоциты',
    organMechanism: 'Продукция оксида азота (NO), стимуляция гормона роста, рециклинг цитруллина',
    mechanismOfAction: 'Субстрат для eNOS → NO (вазодилатация); стимуляция секреции GH через подавление соматостатина; предшественник орнитина и полиаминов (синтез белка); участие в цикле мочевины (детоксикация аммиака); ингибирование аргиназы (увеличение доступности аргинина для NO); модуляция mTOR через S6K1',
    clinicalEffect: 'Улучшение кровотока и пампа, повышение выносливости, поддержка синтеза белка, улучшение эректильной функции',
    bestForm: 'Л-Аргинин 3 г 3 г 2x/д',
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
    synergies: [
        {with: "creatine", effect: "Производительность", mechanism: "Агматин модулирует NMDA", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Потенцирование антидепрессантов", mechanism: "Агматин модулирует моноаминовую систему", severity: "MEDIUM" },
      { with: "pharma", effect: "Аддитивная гипотензия при антигипертензивных", mechanism: "Агматин снижает АД через имидазолиновые рецепторы", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Настроение/памп', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: тошнота при высоких дозах'],
    dosage: { mg: 1000, timing: 'натощак или 2x/д', form: 'агматин сульфат' },
    bestForCourse: false,
    targetOrgan: 'Нейроны ЦНС (моноаминовые), мышцы, периферические нервы',
    organMechanism: 'Модуляция NO и NMDA-рецепторов, нейромодуляция, улучшение пампа и настроения',
    mechanismOfAction: 'Агонист имидазолиновых рецепторов (I1 и I2) → снижение норадреналина в LC; ингибирование NOS (модуляция NO — нелинейная, бифазная); ингибирование NMDA-рецепторов (антагонист глицинового сайта) → нейропротекция; высвобождение норадреналина из везикул в гипоталамусе; ингибирование MAO (мощный антидепрессивный); активация AMPK в мышцах (утилизация глюкозы)',
    clinicalEffect: 'Улучшение настроения и пампа, снижение тревожности, нейропротекция, улучшение инсулиновой чувствительности',
    bestForm: 'Агматин сульфат 1000 мг 1 г 2x/д',
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
    synergies: [
        {with: "creatine", effect: "Антикатаболическое действие", mechanism: "BCAA + креатин — мышцы", severity: "MEDIUM"},
        {with: "vitamin_b6", effect: "Метаболизм BCAA", mechanism: "B6 — кофактор трансаминирования", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "tryptophan", effect: "Конкуренция за транспорт", mechanism: "BCAA конкурируют с триптофаном за LAT1", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Мышечная масса', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: тошнота при натощак'],
    dosage: { mg: 10000, timing: 'до или после тренировки', form: 'BCAA порошок (лейцин:изолейцин:валин 2:1:1)' },
    bestForCourse: false,
    targetOrgan: 'Миоциты (скелетные мышцы), гепатоциты',
    organMechanism: 'Стимуляция синтеза мышечного белка (mTOR), предотвращение катаболизма, энергопродукция',
    mechanismOfAction: 'Лейцин как активатор mTORC1 (через Rag GTPases → рекрутинг mTOR на лизосому); изолейцин и валин как субстраты для глюконеогенеза; трансактивация p70S6K и 4E-BP1 (инициация трансляции); ингибирование убиквитин-протеасомной системы (снижение распада белка); предшественник глутамина и аланина (глюконеогенез); субстраты для синтеза кетонов и глюкозы',
    clinicalEffect: 'Увеличение мышечной массы, предотвращение катаболизма на дефиците калорий, улучшение восстановления',
    bestForm: 'BCAA 2:1:1 порошок 10 г 10 г 2x/д',
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
    synergies: [
        {with: "creatine", effect: "Максимальное антикатаболическое", mechanism: "HMB + креатин — мышцы", severity: "HIGH"},
        {with: "vitamin_d3", effect: "Синтез белка", mechanism: "Витамин D3 усиливает mTOR", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Потенциальное снижение эффективности при глюкокортикоидах", mechanism: "HMB антагонизирует кортизол", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Мышечная масса', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: тошнота при натощак'],
    dosage: { mg: 3000, timing: '2x/д с едой', form: 'HMB кальций порошок или капсулы' },
    bestForCourse: false,
    targetOrgan: 'Миоциты (скелетные мышцы)',
    organMechanism: 'Антикатаболический эффект, стимуляция синтеза мышечного белка, антагонизм кортизолу',
    mechanismOfAction: 'Активация mTORC1 через ингибирование REDD1 (снижение экспрессии под действием кортизола); ингибирование убиквитин-лигазы E3 (атрогин-1 и MuRF1) → снижение протеасомной деградации; антагонизм кортизолу на уровне GR (глюкокортикоидный рецептор); стимуляция синтеза белка через eIF4E/4E-BP1; повышение продукции IGF-1 в печени и мышцах',
    clinicalEffect: 'Предотвращение потери мышечной массы на дефиците калорий, ускорение восстановления, антикатаболический эффект',
    bestForm: 'HMB-Ca 1500 мг 2x/д 3 г 2x/д',
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
      { with: "alpha_lipoic", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Снижение эффективности некоторых химиотерапевтиков", mechanism: "Глутатион уменьшает окислительный стресс, необходимый для действия", severity: "MEDIUM" },
      { with: "pharma", effect: "Снижение эффекта нитроглицерина", mechanism: "Глутатион ускоряет метаболизм нитратов", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Глутатион в крови', when: 'Каждые 8 нед', targetRange: '>600 мкмоль/л' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: аллергия при в/в введении'],
    dosage: { mg: 500, timing: 'натощак', form: 'липосомальный глутатион или NAC+витамин С' },
    bestForCourse: false,
    targetOrgan: 'Гепатоциты, нейроны, иммунные клетки',
    organMechanism: 'Нейтрализация свободных радикалов, конъюгация токсинов во II фазе детоксикации, поддержка митохондриального дыхания',
    mechanismOfAction: 'Прямая антиоксидантная активность (GSH/GSH-Px), субстрат глутатион-S-трансферазы для конъюгации ксенобиотиков, рециклинг витамина С и Е, регуляция пролиферации лимфоцитов',
    clinicalEffect: 'Защита печени от гепатотоксичности ААС, снижение окислительного стресса, поддержка детоксикации',
    bestForm: 'Липосомальный глутатион 500 мг 2x/д натощак',
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
    synergies: [
        {with: "creatine", effect: "Синтез белка", mechanism: "EAA + креатин — анаболизм", severity: "MEDIUM"},
        {with: "vitamin_b6", effect: "Метаболизм аминокислот", mechanism: "B6 — кофактор трансаминаз", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Конкуренция за LAT1-транспорт с L-ДОФА", mechanism: "EAA снижают абсорбцию леводопы", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Мышечная масса', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: тошнота натощак'],
    dosage: { mg: 10000, timing: 'до или после тренировки', form: 'EAA порошок' },
    bestForCourse: false,
    targetOrgan: 'Миоциты скелетных мышц, гепатоциты',
    organMechanism: 'Субстрат для синтеза мышечного белка, активация mTOR-сигналинга, глюконеогенез в печени',
    mechanismOfAction: 'Лейцин → активация mTORC1 через Rag-ГТФазы и Sestrin2; валин/изолейцин → субстрат для окисления BCKDH; прямой субстрат для eIF2/eIF4E сборки полирибосом',
    clinicalEffect: 'Ускорение синтеза мышечного белка, улучшение восстановления после тренировки, поддержка азотистого баланса',
    bestForm: 'EAA порошок 10 г до/после тренировки',
  },
d_aspartic_acid: {
    id: 'd_aspartic_acid',
    name: 'D-Aspartic Acid',
    nameRu: 'D-Аспарагиновая кислота',
    tier: 'specialty',
    category: ['amino', 'hormonal', 'pharma'],
    forms: [
      { id: 'd_aspartic_acid', name: 'D-Aspartic Acid', nameRu: 'D-Аспарагиновая кислота', dose: '3 г 2x/д', best: true },
      { id: 'DAA_2', name: 'D-Aspartic Acid', nameRu: 'D-AA цитрат 3 г', dose: '3 г', best: false }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['TESTOSTERONE_SYNTHESIS', 'LH_RELEASE', 'SPERMATOGENESIS', 'NMDA_RECEPTOR_ACTIVATION'],
    description: 'D-Аспарагиновая кислота — стимулирует высвобождение ЛГ и синтез тестостерона. Эффект кратковременный (12-15 дней).',
    synergies: [
      { with: "zinc", effect: "D-Аспарагиновая кислота + Цинк — синтез тестостерона", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "maca", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Антагонизм с антипсихотиками", mechanism: "D-аспарагиновая кислота активирует NMDA", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Свободный тестостерон', when: 'Каждые 2 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: головная боль', 'Тошнота'],
    dosage: { mg: 3000, timing: 'утро натощак, курс 12-15 дней', form: 'D-аспарагиновая кислота порошок' },
    bestForCourse: false,
    targetOrgan: 'Гонады (клетки Лейдига), гипофиз, нейроны',
    organMechanism: 'Стимуляция секреции ЛГ из гипофиза, активация стероидогенеза в клетках Лейдига, модуляция NMDA-рецепторов в ЦНС',
    mechanismOfAction: 'Агонист NMDA-рецепторов в гипоталамусе → ↑ GnRH → ↑ ЛГ → ↑ тестостерон; внутригонадное накопление → субстрат для синтеза тестостерона через StAR-белок',
    clinicalEffect: 'Кратковременное повышение тестостерона (12-15 дней), улучшение либидо и фертильности',
    bestForm: 'D-аспарагиновая кислота 3 г/д утром натощак, курс 12-15 дней',
  },
phenibut: {
    id: 'phenibut',
    name: 'Phenibut',
    nameRu: 'Фенибут',
    tier: 'specialty',
    category: ['amino', 'anxiolytic', 'pharma'],
    forms: [
      { id: 'phenibut', name: 'Phenibut', nameRu: 'Фенибут 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'PHENIBUT_2', name: 'Phenibut', nameRu: 'Фенибут 500 мг', dose: '500 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['GABA_B_AGONIST', 'ANXIOLYTIC', 'COGNITIVE_ENHANCEMENT', 'SLEEP_IMPROVEMENT'],
    description: 'Фенибут — производное ГАМК с фенильным кольцом, проникает через ГГБ. Снижает тревожность, улучшает сон. Риск зависимости.',
    synergies: [
        {with: "magnesium", effect: "Расслабление", mechanism: "Оба усиливают GABA", severity: "MEDIUM"},
        {with: "theanine", effect: "Фокус без седации", mechanism: "Разные GABA-механизмы", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Опасная седация", mechanism: "Фенибут + бензодиазепины", severity: "HIGH"},
        {with: "alcohol", effect: "Депрессия ЦНС", mechanism: "Оба — депрессанты ЦНС", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Тревожность/сон', when: 'Субъективно' }
    ],
    contraindications: ['Эпилепсия (с осторожностью)', 'Беременность'],
    sideEffects: ['Сонливость при начале', 'Зависимость при длительном приёме'],
    dosage: { mg: 250, timing: 'на ночь или 2x/д, курс 2-4 нед', form: 'фенибут 250 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (ГАМК-ергические нейроны), спинной мозг',
    organMechanism: 'Агонизм ГАМК-Б рецепторов, блокада α2δ-субъединицы кальциевых каналов, усиление ГАМК-ергической трансмиссии',
    mechanismOfAction: 'Проходит через ГЭБ (фенильное кольцо) → связывается с ГАМК-Б рецепторами (Gi/o-белок → ингибирование аденилатциклазы) → ↓ нейрональной возбудимости; блокада α2δ → ↓ выброса глутамата',
    clinicalEffect: 'Снижение тревожности, улучшение качества сна, мягкий когнитивный стимулятор',
    bestForm: 'Фенибут 250 мг 2x/д или на ночь, курс 2-4 нед',
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
    synergies: [
        {with: "beta_alanine", effect: "Увеличение запасов карнозина", mechanism: "Бета-аланин → карнозин", severity: "HIGH"},
        {with: "creatine", effect: "Буферинг и энергетика", mechanism: "Карнозин — буфер, креатин — АТФ", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Потенцирование антикоагулянтов (теоретически)", mechanism: "Карнозин может усиливать антитромботический эффект", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Мышечная выносливость', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: покалывание кожи (от бета-аланина)'],
    dosage: { mg: 1000, timing: '2x/д с едой', form: 'карнозин капсулы' },
    bestForCourse: false,
    targetOrgan: 'Скелетные мышцы, головной мозг, миокард',
    organMechanism: 'Внутриклеточный pH-буфер в мышцах, антиоксидантная защита нейронов, предотвращение гликирования белков',
    mechanismOfAction: 'Буферизация H+ через имидазольное кольцо гистидина → поддержание pH во время анаэробной работы; хелатирование переходных металлов (Cu²⁺, Zn²⁺) → ↓ перекисное окисление; связывание карбонильных групп → антигликация',
    clinicalEffect: 'Повышение мышечной выносливости, снижение утомления, защита нейронов от AGE-продуктов',
    bestForm: 'Карнозин 1 г 2x/д с едой',
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
    synergies: [
        {with: "glycine", effect: "Метаболическая поддержка", mechanism: "Оба — заменимые аминокислоты", severity: "LOW"},
      ],
    conflicts: [
      { with: "pharma", effect: "Мониторинг глюкозы при сахарном диабете", mechanism: "Аланин — субстрат глюконеогенеза", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: тошнота при высоких дозах'],
    dosage: { mg: 2000, timing: 'с едой', form: 'аланин порошок' },
    bestForCourse: false,
    targetOrgan: 'Гепатоциты, скелетные мышцы',
    organMechanism: 'Субстрат глюконеогенеза (цикл Кори), транспорт азота из мышц в печень, поддержка гликемии',
    mechanismOfAction: 'Аланин + α-кетоглутарат → АЛТ (аланинаминотрансфераза) → пируват + глутамат → пируват → глюкоза (глюконеогенез); обратный транспорт углеродного скелета в мышцы',
    clinicalEffect: 'Стабилизация уровня глюкозы, поддержка печени, снижение катаболизма мышечного белка',
    bestForm: 'Аланин 2 г с едой 2x/д',
  },
l_dopa: {
    id: 'l_dopa',
    name: 'L-DOPA',
    nameRu: 'Леводопа (L-DOPA)',
    tier: 'specialty',
    category: ['amino', 'nootropic', 'pharma'],
    forms: [
      { id: 'l_dopa', name: 'L-DOPA', nameRu: 'Л-ДОФА (Мукуна) 500 мг', dose: '500 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['DOPAMINE_PRECURSOR', 'NOREPINEPHRINE_PRECURSOR', 'MOTOR_FUNCTION', 'MOOD_REGULATION'],
    description: 'Л-ДОФА — прямой предшественник дофамина. Используется для кратковременного повышения дофамина. Ряд побочных эффектов.',
    synergies: [
        {with: "vitamin_b6", effect: "Синтез дофамина", mechanism: "B6 — кофактор декарбоксилазы", severity: "HIGH"},
      ],
    conflicts: [
      { with: "tyrosine", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Настроение/фокус', when: 'Субъективно' }
    ],
    contraindications: ['Приём антидепрессантов СИОЗС', 'Болезнь Паркинсона (без назначения)'],
    sideEffects: ['Тошнота', 'Ортостатическая гипотензия', 'Риск дискинезии при длительном приёме'],
    dosage: { mg: 500, timing: 'натощак, курс 5-7 дней', form: 'Л-ДОФА (экстракт мукуны) капсулы' },
    bestForCourse: false,
    targetOrgan: 'Базальные ганглии, чёрная субстанция, нейроны ЦНС',
    organMechanism: 'Проникновение через ГЭБ, конверсия в дофамин в дофаминергических нейронах, усиление дофаминергической передачи',
    mechanismOfAction: 'L-ДОФА → DOPA-декарбоксилаза (кофактор B6) → дофамин → ↓ пролактина (через D2-рецепторы), ↑ мотивация через D1/D2 пути nucleus accumbens, ↑ норадреналин через дофамин-β-гидроксилазу',
    clinicalEffect: 'Кратковременное повышение фокуса, настроения и либидо, снижение пролактина',
    bestForm: 'Л-ДОФА (экстракт мукуны) 500 мг натощак, курс 5-7 дней',
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
      { with: "bacopa", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Потенцирование антикоагулянтов", mechanism: "Фосфатидилсерин может влиять на гемостаз", severity: "MEDIUM" },
      { with: "pharma", effect: "Снижение эффективности иммуносупрессоров", mechanism: "ФС модулирует иммунный ответ", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Кортизол утром', when: 'Каждые 4 нед', targetRange: '6-23 мкг/дл' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: бессонница при приёме вечером'],
    dosage: { mg: 300, timing: 'с едой 2x/д', form: 'фосфатидилсерин из соевого лецитина' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (мембраны нейронов), надпочечники',
    organMechanism: 'Структурный компонент нейрональных мембран, модуляция активности кортизола, регуляция синаптической пластичности',
    mechanismOfAction: 'Встраивание в мембраны нейронов → активация PKC (протеинкиназа C) и CaMKII → ↑ долговременная потенциация; ↓ АКТГ → ↓ кортизол (30% в ответ на стресс); активация эндогенной антиоксидантной системы',
    clinicalEffect: 'Снижение кортизола, улучшение памяти и когнитивных функций, нейропротекция',
    bestForm: 'Фосфатидилсерин 100 мг 3x/д с едой',
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
    synergies: [
        {with: "betaine", effect: "Метилирование", mechanism: "Метионин → SAMe", severity: "HIGH"},
        {with: "vitamin_b_complex", effect: "Гомоцистеин", mechanism: "B6, B12, фолат — реметилирование", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Гипертензивный криз при ИМАО", mechanism: "Метионин → метиламины → симпатомиметический эффект", severity: "HIGH" },
      { with: "pharma", effect: "Снижение эффективности антипсихотиков", mechanism: "Метил-донор может снижать уровень нейролептиков", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Гомоцистеин', when: 'Каждые 8 нед', targetRange: '<15 мкмоль/л' }
    ],
    contraindications: ['Гипергомоцистеинемия (без фолата/B12/B6)'],
    sideEffects: ['Тошнота при высоких дозах', 'Повышение гомоцистеина при избытке'],
    dosage: { mg: 500, timing: 'с едой', form: 'метионин капсулы' },
    bestForCourse: false,
    targetOrgan: 'Гепатоциты, ЦНС',
    organMechanism: 'Донор метильных групп через SAMe, участие в липотропном пути, предшественник глутатиона',
    mechanismOfAction: 'Метионин → SAMe (S-аденозилметионин) → донор CH₃ для метилирования ДНК/белков/фосфолипидов; липотропный эффект через ↓ жировой инфильтрации печени; конверсия → цистеин → глутатион',
    clinicalEffect: 'Поддержка функции печени, липотропный эффект, предшественник глутатиона',
    bestForm: 'Метионин 500 мг с едой 2x/д',
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
    synergies: [
        {with: "vitamin_b_complex", effect: "Метилирование и настроение", mechanism: "SAMe + B-кофакторы", severity: "HIGH"},
        {with: "betaine", effect: "Цикл метилирования", mechanism: "Бетаин — альтернативный путь", severity: "MEDIUM"},
        {with: "curcumin", effect: "Противовоспалительное + антидепрессивное", mechanism: "Оба модулируют воспаление", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Серотониновый синдром", mechanism: "SAMe + СИОЗС", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Настроение', when: 'Субъективно' },
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед', targetRange: '<40 Ед/л' }
    ],
    contraindications: ['Биполярное расстройство (может вызвать манию)'],
    sideEffects: ['Тошнота натощак', 'Редко: мания при биполярном расстройстве'],
    dosage: { mg: 400, timing: 'натощак 2x/д', form: 'SAMe энтеросолюбильный' },
    bestForCourse: false,
    targetOrgan: 'Гепатоциты, нейроны, хондроциты суставов',
    organMechanism: 'Универсальный донор метильных групп, синтез нейротрансмиттеров, защита суставного хряща',
    mechanismOfAction: 'SAMe → метилирование ДНК/гистонов (эпигенетическая регуляция); ↑ синтез фосфатидилхолина → ↓ холестерина в желчи; ↑ серотонин/норадреналин через метилирование катехоламинов; ↓ IL-1β/hyалуронидаза в хряще',
    clinicalEffect: 'Антидепрессивный эффект, гепатопротекция, защита суставов, снижение холестерина',
    bestForm: 'SAMe 200 мг 2x/д натощак (энтеросолюбильный)',
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
      { with: "ginkgo", effect: "Женьшень + Гинкго — энергия + кровоток", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "stimulant_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Кортизол утром', when: 'Каждые 4 нед', targetRange: '6-23 мкг/дл' }
    ],
    contraindications: ['Беременность', 'Гипертония (с осторожностью)'],
    sideEffects: ['Бессонница при приёме вечером', 'Головная боль при высоких дозах'],
    dosage: { mg: 200, timing: 'утро с едой', form: 'экстракт женьшеня (5% гинзенозидов)' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, надпочечники, репродуктивная система',
    organMechanism: 'Регуляция оси ГГНС, синтез NO, энергетический обмен',
    mechanismOfAction: 'Активация гинзенозидами PPAR-γ и PI3K/Akt; модуляция AMPK; стимуляция синтеза оксида азота через eNOS; регуляция кортизола через ось HPA',
    clinicalEffect: 'Повышение энергетики и работоспособности, снижение кортизола, улучшение когнитивных функций и либидо',
    bestForm: 'Экстракт женьшеня 200 мг 2x/д',
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
      { with: "ashwagandha", effect: "Двойной адаптоген — кортизол + стресс", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "tyrosine", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "stimulant_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Утомление/фокус', when: 'Субъективно' }
    ],
    contraindications: ['Биполярное расстройство (с осторожностью)'],
    sideEffects: ['Бессонница при приёме вечером', 'Раздражительность при высоких дозах'],
    dosage: { mg: 300, timing: 'утро натощак', form: 'экстракт родиолы (3% розавин)' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, надпочечники, сердце',
    organMechanism: 'Модуляция оси ГГНС, защита нейронов, кардиопротекция',
    mechanismOfAction: 'Ингибирование МАО-А и МАО-В (розавины); активация NF-κB и NRF2; модуляция серотониновых и дофаминовых рецепторов; снижение кортизола через ингибирование 11β-HSD',
    clinicalEffect: 'Снижение утомления и кортизола, повышение физической и умственной работоспособности',
    bestForm: 'Родиола 300 мг 2x/д',
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
      { with: "ginkgo", effect: "Бакопа + Гинкго — память + кровоток", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "phosphatidylserine", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Усиление эффекта тиреоидных гормонов", mechanism: "Бакопа может повышать уровень T4", severity: "MEDIUM" },
      { with: "pharma", effect: "Потенцирование седативных средств", mechanism: "Аддитивный анксиолитический эффект", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Память/фокус', when: 'Субъективно (4-12 нед)' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Тошнота при натощак', 'Разжижение стула'],
    dosage: { mg: 300, timing: 'с едой 2x/д', form: 'экстракт бакопы (50% бакозидов)' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, нервная система',
    organMechanism: 'Синаптическая пластичность, холинергическая передача',
    mechanismOfAction: 'Ингибирование ацетилхолинэстеразы бакозидами; модуляция серотониновых (5-HT3) и дофаминовых рецепторов; антиоксидантная защита через улавливание ROS; стимуляция нейрогенеза в гиппокампе',
    clinicalEffect: 'Улучшение памяти и когнитивных функций, снижение тревожности, нейропротекция',
    bestForm: 'Бакопа 300 мг 2x/д',
  },
  lions_mane: {
    id: 'lions_mane',
    name: 'Lions Mane',
    nameRu: 'Ежовик гребенчатый',
    tier: 'advanced',
    category: ['mushroom', 'adaptogen', 'nootropic'],
    forms: [
      { id: 'lions_mane', name: 'Lions Mane', nameRu: 'Ежовик экстракт 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'lions_mane_2', name: 'Lions Mane', nameRu: 'Ежовик + Бакопа комплекс', dose: '500 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['NGF_STIMULATION', 'MYELIN_REPAIR', 'MEMORY_ENHANCEMENT', 'NEUROPROTECTION'],
    description: 'Ежовик гребенчатый — стимулирует фактор роста нервов (NGF), восстанавливает миелин. На курсе ААС нейропротектор.',
    synergies: [
      { with: "l_carnitine", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Потенцирование коагуляции при антикоагулянтах (теоретически)", mechanism: "Ежовик может замедлять свёртываемость", severity: "LOW" },
      { with: "pharma", effect: "Снижение эффективности иммуносупрессоров", mechanism: "Стимуляция иммунитета", severity: "MEDIUM" },
      { with: "pharma", effect: "Аддитивное снижение глюкозы при диабете", mechanism: "Модуляция чувствительности к инсулину", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Когниция/память', when: 'Субъективно (4-12 нед)' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: аллергия при грибковой непереносимости'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт ежовика (50% эринацинов)' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, нервная система',
    organMechanism: 'Нейрогенез, миелинизация, синаптическая пластичность',
    mechanismOfAction: 'Стимуляция синтеза NGF через активацию TrkA-рецепторов (еринацины); модуляция NF-κB; повышение BDNF; индукция миелинизации через стимуляцию олигодендроцитов',
    clinicalEffect: 'Стимуляция нейрогенеза и восстановления миелина, улучшение памяти, нейропротекция',
    bestForm: 'Ежовик экстракт 500 мг 2x/д',
  },
cordyceps: {
    id: 'cordyceps',
    name: 'Cordyceps',
    nameRu: 'Кордицепс',
    tier: 'advanced',
    category: ['mushroom', 'adaptogen', 'metabolic'],
    forms: [
      { id: 'cordyceps', name: 'Cordyceps', nameRu: 'Кордицепс 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'cordyceps_2', name: 'Cordyceps', nameRu: 'Кордицепс CS-4 1000 мг', dose: '500 мг', best: false }
    ],
    organs: ['LUNGS', 'MUSCLES', 'KIDNEYS'],
    systems: ['cardio', 'renal', 'immune', 'metabolic'],
    mechanisms: ['ATP_PRODUCTION', 'OXYGEN_UTILIZATION', 'ADAPTOGENIC', 'TESTOSTERONE_SUPPORT'],
    description: 'Кордицепс — адаптоген, повышает VO2max и продукцию АТФ. Улучшает кислородное снабжение. На курсе поддерживает выносливость.',
    synergies: [
      { with: "cordyceps", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "ss31", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "peptide_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Снижение эффективности иммуносупрессоров", mechanism: "Кордицепс стимулирует иммунитет", severity: "MEDIUM" },
      { with: "pharma", effect: "Потенцирование антикоагулянтов", mechanism: "Кордицепс может замедлять свёртываемость", severity: "MEDIUM" },
      { with: "pharma", effect: "Аддитивное снижение глюкозы", mechanism: "Кордицепс повышает чувствительность к инсулину", severity: "LOW" },
    ],
    monitoring: [
      { what: 'VO2max', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 500, timing: 'утро с едой', form: 'экстракт кордицепса (7% кордицепина)' },
    bestForCourse: false,
    targetOrgan: 'Лёгкие, почки, мышцы',
    organMechanism: 'Утилизация кислорода, митохондриальный биогенез, продукция АТФ',
    mechanismOfAction: 'Активация AMPK и PGC-1α (кордицепин); повышение активности SOD и каталазы; модуляция иммунитета через TLR-4; увеличение синтеза АТФ',
    clinicalEffect: 'Повышение VO2max и выносливости, улучшение кислородного снабжения тканей, поддержка почек и иммунитета',
    bestForm: 'Кордицепс 500 мг 2x/д',
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
      { with: "d_aspartic_acid", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Возможное взаимодействие с тиреоидными гормонами", mechanism: "Мака может влиять на функцию щитовидной железы", severity: "LOW" },
      { with: "pharma", effect: "Потенциальное влияние на гормональную терапию", mechanism: "Мака модулирует ГГЯ ось", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Либидо/энергия', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Метеоризм при начале', 'Редко: бессонница при приёме вечером'],
    dosage: { mg: 1500, timing: 'с едой', form: 'порошок или экстракт маки (желатинизированный)' },
    bestForCourse: false,
    targetOrgan: 'Репродуктивная система, надпочечники',
    organMechanism: 'Гормональная регуляция, стероидогенез, адаптогенная модуляция',
    mechanismOfAction: 'Модуляция оси ГГЯ через амиды жирных кислот (макамиды); повышение SHBG; активация cAMP/PKA-пути в клетках Лейдига; нейромедиаторная регуляция через MAO',
    clinicalEffect: 'Повышение либидо и фертильности, улучшение энергии и настроения, гормональный баланс',
    bestForm: 'Мака порошок 1.5 г 2x/д',
  },
holy_basil: {
    id: 'holy_basil',
    name: 'Holy Basil',
    nameRu: 'Туласи (Святой базилик)',
    tier: 'advanced',
    category: ['adaptogen', 'anti_inflammatory'],
    forms: [
      { id: 'holy_basil', name: 'Holy Basil', nameRu: 'Туласи 400 мг', dose: '400 мг 2x/д', best: true },
      { id: 'holy_basil_2', name: 'Holy Basil', nameRu: 'Святой базилик экстракт 300 мг', dose: '400 мг', best: false }
    ],
    organs: ['BRAIN', 'ADRENALS', 'LIVER'],
    systems: ['neuro', 'endocrine', 'hepatic'],
    mechanisms: ['CORTISOL_REDUCTION', 'ADAPTOGENIC', 'ANTI_INFLAMMATORY', 'ANTIOXIDANT'],
    description: 'Туласи — священный базилик Аюрведы, мощный адаптоген. Снижает кортизол, сахар и воспаление. На курсе ААС помогает с восстановлением.',
    synergies: [
      { with: "soy_isoflavones", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Туласи потенцирует антидепрессанты", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "progesterone", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Кортизол/сахар', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 400, timing: 'с едой 2x/д', form: 'экстракт туласи (2% урсоловой кислоты)' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, надпочечники, печень',
    organMechanism: 'Стресс-протекция, гипоталамо-гипофизарная ось',
    mechanismOfAction: 'Снижение кортизола через ингибирование 11β-HSD; модуляция оси HPA; антиоксидантная активация NRF2; противовоспалительное действие через NF-κB и COX-2',
    clinicalEffect: 'Снижение кортизола и уровня глюкозы, противовоспалительное действие, стрессопротекция',
    bestForm: 'Туласи 400 мг 2x/д',
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
    synergies: [
        {with: "bacopa", effect: "Когнитивная функция", mechanism: "Оба — ноотропы", severity: "MEDIUM"},
        {with: "ginkgo", effect: "Кровообращение мозга", mechanism: "Оба улучшают кровоток", severity: "MEDIUM"},
        {with: "collagen", effect: "Заживление ран", mechanism: "Готу кола + синтез коллагена", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Потенцирование седативных средств", mechanism: "Аддитивный анксиолитический эффект", severity: "MEDIUM" },
      { with: "pharma", effect: "Потенциальное повышение гепатотоксичности статинов", mechanism: "Готу кола может усиливать действие статинов", severity: "LOW" },
      { with: "pharma", effect: "Аддитивное снижение глюкозы", mechanism: "Готу кола может снижать сахар", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Когниция/кожа', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: головная боль при высоких дозах'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт готу колы' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, кожа, суставы',
    organMechanism: 'Синтез коллагена, микроциркуляция, когнитивная функция',
    mechanismOfAction: 'Стимуляция синтеза коллагена через активацию TGF-β (азиатикозид); улучшение микроциркуляции через активацию eNOS; нейропротекция через ингибирование ацетилхолинэстеразы',
    clinicalEffect: 'Улучшение памяти и кровообращения, стимуляция коллагена и заживления, венопротекция',
    bestForm: 'Готу Кола 500 мг 2x/д',
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
    synergies: [
        {with: "vitamin_d3", effect: "Сигнальные пути роста", mechanism: "Экдистерон + D3", severity: "MEDIUM"},
        {with: "creatine", effect: "Анаболическая синергия", mechanism: "Оба активируют синтез белка", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Потенциальный антагонизм с гормональной терапией", mechanism: "Экдистерон — фитоэстроген", severity: "MEDIUM" },
      { with: "pharma", effect: "Снижение эффективности иммуносупрессоров", mechanism: "Экдистерон модулирует иммунитет", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Мышечная масса', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: тошнота'],
    dosage: { mg: 400, timing: 'с едой (с белком)', form: 'экдистерон (95%)' },
    bestForCourse: false,
    targetOrgan: 'Мышцы, печень',
    organMechanism: 'Синтез белка, mTOR-сигналинг, метаболизм',
    mechanismOfAction: 'Активация mTORC1 через фосфорилирование p70S6K и 4E-BP1; модуляция Akt/PKB; повышение синтеза белка; взаимодействие с эстрогеновым рецептором β (ERβ)',
    clinicalEffect: 'Набор сухой мышечной массы, улучшение композиции тела, повышение силовых показателей',
    bestForm: 'Экдистерон 200 мг 2x/д',
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
    synergies: [
        {with: "coq10", effect: "Усиление АТФ", mechanism: "Мумиё повышает биодоступность CoQ10", severity: "MEDIUM"},
        {with: "ashwagandha", effect: "Адаптогенный эффект", mechanism: "Оба модулируют стресс", severity: "MEDIUM"},
        {with: "iron", effect: "Предотвращение анемии", mechanism: "Мумиё содержит Fe", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Потенцирование антикоагулянтов (теоретически)", mechanism: "Фульвокислоты могут влиять на гемостаз", severity: "LOW" },
      { with: "pharma", effect: "Аддитивное снижение глюкозы при диабете", mechanism: "Мумиё повышает чувствительность к инсулину", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Тестостерон общий', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: аллергия'],
    dosage: { mg: 250, timing: 'с едой', form: 'мумиё очищенное или экстракт' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, почки, мышцы',
    organMechanism: 'Митохондриальная функция, минеральный обмен, нейропротекция',
    mechanismOfAction: 'Доставка фульвокислот через клеточные мембраны; хелатирование и доставка микроэлементов; активация митохондриального комплекса I-IV; антиоксидантная защита',
    clinicalEffect: 'Повышение энергетики и тестостерона, нейропротекция, восполнение минералов',
    bestForm: 'Мумиё очищенное 250 мг 2x/д',
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
      { with: "adaptogen_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Потенцирование антикоагулянтов", mechanism: "Схизандрины могут замедлять свёртываемость", severity: "MEDIUM" },
      { with: "pharma", effect: "Снижение эффективности иммуносупрессоров", mechanism: "Стимуляция иммунной системы", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед', targetRange: '<40 Ед/л' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: бессонница при приёме вечером'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт шизандры (9% схизандринов)' },
    bestForCourse: false,
    targetOrgan: 'Печень, головной мозг, надпочечники',
    organMechanism: 'Детоксикация печени, адаптогенная регуляция, антиоксидантная защита',
    mechanismOfAction: 'Индукция фазы II детоксикации через NRF2 (схизандрины); модуляция CYP3A4 и CYP2C9; ингибирование NF-κB; защита гепатоцитов через Bcl-2',
    clinicalEffect: 'Защита печени, повышение выносливости, адаптогенный эффект, антиоксидантная защита',
    bestForm: 'Шизандра 500 мг 2x/д',
  },
ginger: {
    id: 'ginger',
    name: 'Ginger',
    nameRu: 'Имбирь',
    tier: 'standard',
    category: ['herb', 'anti_inflammatory'],
    forms: [
      { id: 'ginger', name: 'Ginger', nameRu: 'Имбирь экстракт 1000 мг', dose: '1 г 2x/д', best: true },
      { id: 'ginger_2', name: 'Ginger', nameRu: 'Имбирь порошок 2 г', dose: '1 г', best: false }
    ],
    organs: ['STOMACH', 'INTESTINES', 'MUSCLES'],
    systems: ['hepatic', 'metabolic'],
    mechanisms: ['ANTI_INFLAMMATORY', 'NAUSEA_RELIEF', 'DIGESTION_ENHANCEMENT', 'MUSCLE_RECOVERY'],
    description: 'Имбирь — противовоспалительное и противорвотное. Джинджеролы ингибируют COX-2 и LOX. На курсе помогает с тошнотой.',
    synergies: [
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "curcumin", effect: "Имбирь + Куркумин — двойное противовоспалительное", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Тошнота/воспаление', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: изжога при высоких дозах'],
    dosage: { mg: 1000, timing: 'с едой', form: 'имбиря экстракт (5% джинджеролов)' },
    bestForCourse: false,
    targetOrgan: 'Желудок, кишечник, мышцы',
    organMechanism: 'Противовоспалительный каскад, ЖКТ-моторика',
    mechanismOfAction: 'Ингибирование COX-2 и 5-LOX (джинджеролы); антагонизм 5-HT3-рецепторов (противорвотное); активация TRPV1-рецепторов; модуляция NF-κB и AP-1',
    clinicalEffect: 'Противовоспалительное и противорвотное действие, улучшение пищеварения, восстановление мышц',
    bestForm: 'Имбирь экстракт 1000 мг 2x/д',
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
      { with: "lycopene", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "vitamin_e", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "omega3", effect: "Астаксантин защищает Омега-3 от окисления", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "vitamin_a", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Потенцирование антикоагулянтов (теоретически)", mechanism: "Астаксантин может влиять на свёртываемость", severity: "LOW" },
      { with: "pharma", effect: "Конкуренция за CYP3A4 с субстратами фермента", mechanism: "Астаксантин метаболизируется CYP3A4", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Окислительный стресс', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: лососёвый оттенок кожи'],
    dosage: { mg: 12, timing: 'с едой (жирорастворимый)', form: 'астаксантин из Haematococcus' },
    bestForCourse: false,
    targetOrgan: 'Кожа, глаза, сердце, мышцы',
    organMechanism: 'Антиоксидантная защита, стабилизация митохондриальной мембраны',
    mechanismOfAction: 'Улавливание синглетного кислорода (в 6000× сильнее витамина C); стабилизация мембран митохондрий; ингибирование NF-κB и COX-2; UV-протекция',
    clinicalEffect: 'Мощная антиоксидантная защита, UV-протекция кожи, снижение воспаления, повышение выносливости',
    bestForm: 'Астаксантин 12 мг',
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
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "nmn", effect: "Резвератрол + NMN — NAD+ + сиртуины", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед', targetRange: 'ЛПНП<3.0' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Редко: диарея при высоких дозах'],
    dosage: { mg: 500, timing: 'с едой', form: 'транс-ресвератрол' },
    bestForCourse: false,
    targetOrgan: 'Сердце, головной мозг, печень',
    organMechanism: 'Сиртуин-зависимый сигналинг, антиоксидантная защита',
    mechanismOfAction: 'Активация SIRT1 через деацетилирование p53 и PGC-1α; активация NRF2-ARE; ингибирование NF-κB; модуляция AMPK; индукция аутофагии',
    clinicalEffect: 'Активация сиртуинов, кардиопротекция, нейропротекция, противовоспалительное действие',
    bestForm: 'Транс-ресвератрол 500 мг 2x/д',
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
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "vitamin_c", effect: "Кверцетин + Витамин С — антиоксидантная синергия", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "anthocyanins", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Окислительный стресс', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Редко: головная боль'],
    dosage: { mg: 500, timing: 'с едой (с жирами)', form: 'кверцетин' },
    bestForCourse: false,
    targetOrgan: 'Сердце, лёгкие, головной мозг',
    organMechanism: 'Противовоспалительный каскад, сенолитический сигналинг',
    mechanismOfAction: 'Ингибирование PI3K/Akt и NF-κB; сенолитическое действие через Bcl-2 и каспазы; стабилизация тучных клеток (антигистамин); хелатирование Fe и ROS',
    clinicalEffect: 'Противовоспалительное, антигистаминное и сенолитическое действие, кардиопротекция',
    bestForm: 'Кверцетин 500 мг 2x/д',
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
      { with: "vitamin_d3", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "omega9", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "omega3", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "polyphenol_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "mushroom_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "iron", effect: "Снижение всасывания Fe", mechanism: "Дубильные вещества связывают Fe", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед', targetRange: '<40 Ед/л' }
    ],
    contraindications: ['Беременность', 'Тяжёлая анемия'],
    sideEffects: ['Тошнота натощак'],
    dosage: { mg: 400, timing: 'натощак или с едой', form: 'EGCG экстракт' },
    bestForCourse: false,
    targetOrgan: 'Печень, головной мозг, сердце',
    organMechanism: 'Метаболическая регуляция, AMPK-активация, жировой обмен',
    mechanismOfAction: 'Активация AMPK через ингибирование митохондриального комплекса I; ингибирование COMT; модуляция HMG-CoA редуктазы; хелатирование Fe',
    clinicalEffect: 'Стимуляция жиросжигания, активация AMPK, гепатопротекция, антиоксидантная защита',
    bestForm: 'EGCG 400 мг 2x/д',
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
      { with: "calcium", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Потенцирование антикоагулянтов", mechanism: "Сульфорафан может влиять на гемостаз", severity: "MEDIUM" },
      { with: "pharma", effect: "Снижение эффективности иммуносупрессоров", mechanism: "NRF2 активация модулирует иммунный ответ", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Окислительный стресс', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Тошнота при натощак'],
    dosage: { mg: 20, timing: 'натощак или с едой', form: 'экстракт проростков брокколи' },
    bestForCourse: false,
    targetOrgan: 'Печень, лёгкие, кишечник',
    organMechanism: 'NRF2-сигналинг, фаза II детоксикации',
    mechanismOfAction: 'Мощная активация NRF2 через модификацию цистеинов Keap1; индукция ферментов фазы II (GST, NQO1, HO-1); ингибирование HDAC; модуляция NF-κB',
    clinicalEffect: 'Активация NRF2, детоксикация печени, противовоспалительное и противораковое действие',
    bestForm: 'Сульфорафан 20 мг',
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
      { with: "magnesium", effect: "Мелатонин + Магний — расслабление + сон", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "gaba", effect: "Мелатонин + ГАМК — двойное расслабление", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "stimulant_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Качество сна', when: 'Субъективно' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Сонливость', 'Редко: яркие сновидения'],
    dosage: { mg: 3, timing: 'на ночь за 30 мин до сна', form: 'мелатонин капсулы' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, иммунная система, кишечник',
    organMechanism: 'Циркадная регуляция, антиоксидантная защита',
    mechanismOfAction: 'Агонизм MT1/MT2-рецепторов; улавливание •OH и ONOO−; модуляция NF-κB; синхронизация циркадных ритмов',
    clinicalEffect: 'Нормализация сна, антиоксидантная защита, иммуномодуляция, улучшение восстановления',
    bestForm: 'Мелатонин 3 мг',
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
      { with: "bacopa", effect: "Гинкго + Бакопа — кровоток + память", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "ginseng", effect: "Женьшень + Гинкго — энергия + кровоток", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "vinpocetine", effect: "Гинкго + Винпоцетин — двойной мозговой кровоток", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Риск кровотечения", mechanism: "Гинкго снижает агрегацию тромбоцитов", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Когниция/память', when: 'Субъективно' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Редко: головная боль', 'Риск кровотечения'],
    dosage: { mg: 120, timing: 'с едой 2x/д', form: 'экстракт гинкго' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, сосуды, глаза',
    organMechanism: 'Мозговой кровоток, антиоксидантная защита, микроциркуляция',
    mechanismOfAction: 'Вазодилатация через eNOS и NO; ингибирование PAF; антиоксидантная защита (гингкголиды); модуляция ацетилхолина и дофамина',
    clinicalEffect: 'Улучшение мозгового кровообращения и памяти, нейропротекция, антиоксидантная защита',
    bestForm: 'Гинкго 60 мг 2x/д',
  },
cjc1295: {
    id: 'cjc1295',
    name: 'CJC-1295',
    nameRu: 'CJC-1295 (с модагриком)',
    tier: 'specialty',
    category: ['peptide', 'hormonal', 'pharma'],
    forms: [
      { id: 'cjc1295', name: 'CJC-1295', nameRu: 'CJC-1295 2 мг', dose: '2 мг 1x/нед п/к', best: true },
      { id: 'CJC1295_2', name: 'CJC-1295 DAC', nameRu: 'CJC-1295 DAC 2 мг', dose: '2 мг', best: false, notes: 'C DAC — более длительное действие' }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['GH_RELEASING_IGH_INCREASE', 'LH_RELEASE', 'MUSCLE_GROWTH', 'FAT_LOSS'],
    description: 'CJC-1295 с модагриком — пептид GHRH-аналог, стимулирует выброс ГР и ИФР-1. Улучшает композицию тела и восстановление.',
    synergies: [
        {with: "ipamorelin", effect: "Максимальная стимуляция GH", mechanism: "CJC-1295 + ипаморелин — GHRH+GHRP", severity: "HIGH"},
        {with: "ghrp6", effect: "Усиление пульсации GH", mechanism: "GHRH+GHRP = синергия GH", severity: "HIGH"},
      ],
    conflicts: [
        {with: "somatostatin_analogues", effect: "Подавление GH", mechanism: "Соматостатин блокирует GH", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'ИФР-1', when: 'Каждые 4 нед', targetRange: '150-450 нг/мл' }
    ],
    contraindications: ['Беременность', 'Активный онкологический процесс'],
    sideEffects: ['Редко: задержка жидкости', 'Покраснение в месте инъекции'],
    dosage: { mg: 2, timing: '1x/нед п/к', form: 'CJC-1295 2 мг' },
    bestForCourse: false,
    targetOrgan: 'Гипофиз, центральная нервная система',
    organMechanism: 'Секреция гормона роста, ось ГГР-ИФР-1',
    mechanismOfAction: 'Агонизм GHRH-рецепторов (с модагриком); стимуляция пульсирующего выброса GH из соматотрофов гипофиза; повышение синтеза ИФР-1 в печени',
    clinicalEffect: 'Увеличение выработки GH и ИФР-1, улучшение композиции тела, ускорение восстановления',
    bestForm: 'CJC-1295 + Ipamorelin 2 мг 2x/д',
  },
ipamorelin: {
    id: 'ipamorelin',
    name: 'Ipamorelin',
    nameRu: 'Ипаморелин',
    tier: 'specialty',
    category: ['peptide', 'hormonal', 'pharma'],
    forms: [
      { id: 'ipamorelin', name: 'Ipamorelin', nameRu: 'Ипаморелин 100 мкг', dose: '100 мкг 2-3x/д п/к', best: true },
      { id: 'IPAMORELIN_2', name: 'Ipamorelin', nameRu: 'Ипаморелин 100 мкг', dose: '100 мкг', best: false }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['GH_RELEASE_SELECTIVE', 'LH_RELEASE', 'MUSCLE_RECOVERY', 'FAT_LOSS'],
    description: 'Ипаморелин — селективный секретагог ГР, не повышает кортизол и пролактин. На курсе — восстановление и жиросжигание.',
    synergies: [
      { with: "insulin", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "somatostatin_analogues", effect: "Блокировка GH", mechanism: "Соматостатин блокирует GH", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'ИФР-1', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: покраснение в месте инъекции', 'Тошнота при начале'],
    dosage: { mg: 0.1, timing: '2-3x/д п/к', form: 'Ипаморелин 100 мкг' },
    bestForCourse: false,
    targetOrgan: 'Гипофиз, центральная нервная система',
    organMechanism: 'Секреция GH, селективный GHRP-агонизм',
    mechanismOfAction: 'Селективный агонизм GHS-R1a (грелиновый рецептор); стимуляция выброса GH без повышения кортизола и пролактина; пульсирующий профиль секреции',
    clinicalEffect: 'Селективная стимуляция GH, улучшение восстановления и жиросжигания, минимальные побочные эффекты',
    bestForm: 'Ипаморелин 100 мкг 2x/д',
  },
ghrp2: {
    id: 'ghrp2',
    name: 'GHRP-2',
    nameRu: 'GHRP-2',
    tier: 'specialty',
    category: ['peptide', 'hormonal', 'pharma'],
    forms: [
      { id: 'ghrp2', name: 'GHRP-2', nameRu: 'GHRP-2 100 мкг', dose: '100 мкг 2-3x/д п/к', best: true },
      { id: 'GHRP2_2', name: 'GHRP-2', nameRu: 'GHRP-2 100 мкг', dose: '100 мкг', best: false }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['GH_RELEASE', 'CORTISOL_MODULATION', 'APPETITE_STIMULATION', 'MUSCLE_RECOVERY'],
    description: 'GHRP-2 — секретагог ГР, стимулирует аппетит и восстановление. Менее селективный чем ипаморелин.',
    synergies: [
        {with: "cjc1295", effect: "Максимальная стимуляция GH", mechanism: "GHRH+GHRP = синергия GH", severity: "HIGH"},
        {with: "ipamorelin", effect: "GHRP синергия", mechanism: "Оба — GHRP-агонисты", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "somatostatin_analogues", effect: "Блокировка GH", mechanism: "Соматостатин ингибирует GHRP", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'ИФР-1', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Повышение аппетита', 'Покраснение в месте инъекции'],
    dosage: { mg: 0.1, timing: '2-3x/д п/к', form: 'GHRP-2 100 мкг' },
    bestForCourse: false,
    targetOrgan: 'Гипофиз, центральная нервная система',
    organMechanism: 'Секреция GH, GHS-R1a агонизм',
    mechanismOfAction: 'Агонизм GHS-R1a; стимуляция выброса GH из соматотрофов; повышение кортизола и пролактина (менее селективный); стимуляция аппетита через нейропептид Y',
    clinicalEffect: 'Выброс GH, стимуляция аппетита, улучшение восстановления',
    bestForm: 'GHRP-2 100 мкг 2x/д',
  },
ghrp6: {
    id: 'ghrp6',
    name: 'GHRP-6',
    nameRu: 'GHRP-6',
    tier: 'specialty',
    category: ['peptide', 'hormonal', 'pharma'],
    forms: [
      { id: 'ghrp6', name: 'GHRP-6', nameRu: 'GHRP-6 100 мкг', dose: '100 мкг 2-3x/д п/к', best: true },
      { id: 'GHRP6_2', name: 'GHRP-6', nameRu: 'GHRP-6 100 мкг', dose: '100 мкг', best: false }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['GH_RELEASE', 'APPETITE_STIMULATION', 'CORTISOL_INCREASE', 'MUSCLE_RECOVERY'],
    description: 'GHRP-6 — секретагог ГР с сильным стимулирующим аппетит действием. На курсе — набор массы.',
    synergies: [
        {with: "cjc1295", effect: "Максимальная стимуляция GH", mechanism: "GHRH+GHRP = синергия GH", severity: "HIGH"},
        {with: "ghrp2", effect: "Усиление аппетита и GH", mechanism: "GHRP-6 — самый сильный GHRP", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "somatostatin_analogues", effect: "Блокировка GH", mechanism: "Соматостатин ингибирует GHRP", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'ИФР-1', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Сильное повышение аппетита', 'Покраснение в месте инъекции'],
    dosage: { mg: 0.1, timing: '2-3x/д п/к', form: 'GHRP-6 100 мкг' },
    bestForCourse: false,
    targetOrgan: 'Гипофиз, центральная нервная система',
    organMechanism: 'Секреция GH, стимуляция аппетита',
    mechanismOfAction: 'Агонизм GHS-R1a; мощная стимуляция выброса GH; значительное повышение кортизола и пролактина; сильная стимуляция аппетита через активацию NPY/AgRP',
    clinicalEffect: 'Мощный выброс GH, сильное повышение аппетита, набор массы тела',
    bestForm: 'GHRP-6 100 мкг 2x/д',
  },
follistatin: {
    id: 'follistatin',
    name: 'Follistatin',
    nameRu: 'Фоллистатин',
    tier: 'specialty',
    category: ['peptide', 'hormonal', 'pharma'],
    forms: [
      { id: 'follistatin', name: 'Follistatin', nameRu: 'Фоллистатин 1 мг', dose: '1 мг 2x/нед п/к', best: true },
      { id: 'FOLLISTATIN_2', name: 'Follistatin', nameRu: 'Фоллистатин 1 мг', dose: '1 мг', best: false }
    ],
    organs: ['MUSCLES', 'REPRODUCTIVE'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['MYOSTATIN_INHIBITION', 'MUSCLE_GROWTH', 'FOLLICLE_REGULATION'],
    description: 'Фоллистатин — белок-ингибитор миостатина, блокирует ограничитель роста мышц. Потенцирует гипертрофию на курсе.',
    synergies: [
        {with: "cjc1295", effect: "Рост мышц: миостатин+GH", mechanism: "Фоллистатин + CJC-1295", severity: "HIGH"},
      ],
    conflicts: [
        {with: "pharma", effect: "Антагонизм с гормональной терапией", mechanism: "Фоллистатин модулирует миостатин/активин", severity: "MEDIUM"},
        {with: "pharma", effect: "Взаимодействие с иммуносупрессорами", mechanism: "Фоллистатин — иммуномодулятор", severity: "LOW"},
        {with: "pharma", effect: "Конкуренция с другими ингибиторами миостатина", mechanism: "Двойное ингибирование миостатина", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Миостатин', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Беременность', 'Онкология'],
    sideEffects: ['Редко: реакция в месте инъекции'],
    dosage: { mg: 1, timing: '2x/нед п/к', form: 'Фоллистатин 1 мг' },
    bestForCourse: false,
    targetOrgan: 'Мышцы, репродуктивная система',
    organMechanism: 'Миостатин-ингибирующий сигналинг, регуляция активина',
    mechanismOfAction: 'Связывание и нейтрализация миостатина (GDF-8); ингибирование активина; дерепрессия mTORC1 и каскада роста; повышение регуляции фолликулогенеза',
    clinicalEffect: 'Рост мышечной массы через ингибирование миостатина, потенцирование гипертрофии',
    bestForm: 'Фоллистатин 1 мг 2x/нед',
  },
semax: {
    id: 'semax',
    name: 'Semax',
    nameRu: 'Семакс',
    tier: 'specialty',
    category: ['peptide', 'nootropic', 'pharma'],
    forms: [
      { id: 'semax', name: 'Semax', nameRu: 'Семакс 0.1% капли', dose: '0.3 мг/доза интраназально', best: true },
      { id: 'SEMAX_2', name: 'Semax', nameRu: 'Семакс 0.3 мг/доза', dose: '0.3 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['NGF_STIMULATION', 'BDNF_INCREASE', 'NEUROPROTECTION', 'COGNITION_ENHANCEMENT'],
    description: 'Семакс — нейропептид, стимулирует синтез NGF и BDNF, улучшает память, внимание и нейропротекцию. Обязателен на курсе ААС.',
    synergies: [
        {with: "selank", effect: "Комплексная нейропротекция", mechanism: "Семакс — BDNF, Селанк — GABA", severity: "MEDIUM"},
        {with: "citicoline", effect: "Когнитивная функция", mechanism: "Оба улучшают память", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Перевозбуждение со стимуляторами", mechanism: "Семакс усиливает дофамин + стимуляторы", severity: "MEDIUM"},
        {with: "pharma", effect: "Взаимодействие с ИМАО", mechanism: "Семакс модулирует моноаминовую систему", severity: "LOW"},
        {with: "pharma", effect: "Взаимодействие с антидепрессантами", mechanism: "Семакс стимулирует BDNF/NGF", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Эпилепсия', 'Острый психоз'],
    sideEffects: ['Редко: раздражение слизистой'],
    dosage: { mg: 0.0003, timing: '2x/д интраназально', form: 'Семакс 0.3 мг/капли' },
    bestForCourse: true,
    targetOrgan: 'Головной мозг, нервная система',
    organMechanism: 'Нейрогенез, нейротрофическая поддержка, когнитивная функция',
    mechanismOfAction: 'Стимуляция синтеза BDNF и NGF через активацию TrkB-рецепторов; модуляция дофаминовой и серотониновой систем; повышение синаптической пластичности; ингибирование апоптоза нейронов',
    clinicalEffect: 'Улучшение памяти, внимания и когнитивных функций, нейропротекция, антидепрессивный эффект',
    bestForm: 'Семакс 0.1% капли 0.3 мкг 2x/д',
  },
selank: {
    id: 'selank',
    name: 'Selank',
    nameRu: 'Селанк',
    tier: 'specialty',
    category: ['peptide', 'nootropic', 'pharma'],
    forms: [
      { id: 'selank', name: 'Selank', nameRu: 'Селанк 0.3 мг/доза', dose: '0.3 мг/доза интраназально', best: true },
      { id: 'SELANK_2', name: 'Selank', nameRu: 'Селанк 0.3 мг/доза', dose: '0.3 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['nero'],
    mechanisms: ['GABA_MODULATION', 'ANXIOLYTIC', 'NEUROPROTECTION', 'MOOD_REGULATION'],
    description: 'Селанк — анксиолитический пептид, модулирует ГАМК-систему, снижает тревожность и улучшает сон. На курсе — антистресс.',
    synergies: [
        {with: "semax", effect: "Нейропротекция + антистресс", mechanism: "Семакс — BDNF/NGF, Селанк — GABA", severity: "MEDIUM"},
        {with: "magnesium", effect: "Анксиолитический эффект", mechanism: "Оба снижают тревожность", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Усиление седации", mechanism: "Селанк модулирует GABA", severity: "MEDIUM"},
        {with: "pharma", effect: "Взаимодействие с ИМАО", mechanism: "Селанк влияет на метаболизм энкефалинов", severity: "LOW"},
        {with: "pharma", effect: "Аддитивный эффект с анксиолитиками", mechanism: "Оба снижают тревожность через GABA/серотонин", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость'],
    sideEffects: ['Редко: раздражение слизистой'],
    dosage: { mg: 0.0003, timing: '2-3x/д интраназально', form: 'Селанк 0.3 мг/капли' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, нервная система',
    organMechanism: 'ГАМК-модуляция, анксиолитический сигналинг',
    mechanismOfAction: 'Модуляция ГАМК-бензодиазепинового рецепторного комплекса; ингибирование энкефалиназы; повышение уровня серотонина и дофамина; снижение тревожности через GABAergic механизмы',
    clinicalEffect: 'Снижение тревожности, улучшение сна, анксиолитический и ноотропный эффект',
    bestForm: 'Селанк 0.1% капли 0.3 мкг 2x/д',
  },
dsip: {
    id: 'dsip',
    name: 'DSIP',
    nameRu: 'DSIP (Дельта-сон-индуцирующий пептид)',
    tier: 'specialty',
    category: ['peptide', 'neuroprotector', 'pharma'],
    forms: [
      { id: 'dsip', name: 'DSIP', nameRu: 'DSIP 1 мг', dose: '1 мг 2x/д', best: true },
      { id: 'dsip_2', name: 'DSIP', nameRu: 'DSIP 2 мг', dose: '1 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['nero'],
    mechanisms: ['SLEEP_REGULATION', 'ANALGESIC', 'CORTISOL_REDUCTION', 'STRESS_MODULATION'],
    description: 'DSIP — дельта-сон-индуцирующий пептид, нормализует структуру сна, снижает кортизол. На курсе — улучшение восстановления.',
    synergies: [
        {with: "melatonin", effect: "Глубокий сон", mechanism: "DSIP — дельта-сон, мелатонин — циркадный", severity: "MEDIUM"},
        {with: "magnesium", effect: "Расслабление", mechanism: "Оба — глубокий сон", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Усиление седации со снотворными", mechanism: "DSIP индуцирует дельта-сон", severity: "MEDIUM"},
        {with: "pharma", effect: "Влияние на кортизол с глюкокортикоидами", mechanism: "DSIP снижает кортизол", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Сон (соно-графия)', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 1, timing: 'на ночь п/к', form: 'DSIP 1 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, нервная система',
    organMechanism: 'Регуляция сна, модуляция кортизола',
    mechanismOfAction: 'Индукция дельта-сна через модуляцию GABA-ергической системы; снижение секреции кортизола через ось HPA; анальгетический эффект через опиоидные и серотониновые механизмы',
    clinicalEffect: 'Глубокий восстанавливающий сон, снижение кортизола, анальгезия, улучшение восстановления',
    bestForm: 'DSIP 1 мг на ночь',
  },
p21: {
    id: 'p21',
    name: 'P21',
    nameRu: 'P21 (Пептид 21)',
    tier: 'specialty',
    category: ['peptide', 'nootropic', 'pharma'],
    forms: [
      { id: 'p21', name: 'P21', nameRu: 'P21 1 мг', dose: '1 мкг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['NEUROGENESIS', 'MEMORY_ENHANCEMENT', 'BDNF_INCREASE', 'NEUROPROTECTION'],
    description: 'P21 — ноотропный пептид, стимулирует нейрогенез и BDNF. Улучшает память и обучение на курсе.',
    synergies: [
        {with: "semax", effect: "Нейропластичность", mechanism: "Оба стимулируют нейрогенез", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Взаимодействие со стимуляторами ЦНС", mechanism: "P21 стимулирует нейрогенез + дофамин", severity: "LOW"},
        {with: "pharma", effect: "Потенцирование нейропротекторов", mechanism: "Аддитивный эффект с другими нейропептидами", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 0.001, timing: '1x/д п/к', form: 'P21 1 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, нервная система',
    organMechanism: 'Нейрогенез, синаптическая пластичность',
    mechanismOfAction: 'Стимуляция нейрогенеза в гиппокампе; повышение BDNF и NGF; модуляция глутаматных (NMDA) рецепторов; улучшение долговременной потенциации (LTP)',
    clinicalEffect: 'Улучшение памяти и обучения, нейрогенез, нейропротекция, ноотропный эффект',
    bestForm: 'P21 1 мг 1 мкг 2x/д',
  },
mots_c: {
    id: 'mots_c',
    name: 'MOTS-c',
    nameRu: 'MOTS-c',
    tier: 'specialty',
    category: ['peptide', 'metabolic', 'pharma'],
    forms: [
      { id: 'mots_c', name: 'MOTS-c', nameRu: 'MOTS-c 10 мг', dose: '10 мг 2x/д', best: true }
    ],
    organs: ['MUSCLES', 'LIVER', 'BRAIN'],
    systems: ['hepatic', 'metabolic'],
    mechanisms: ['AMPK_ACTIVATION', 'FAT_OXIDATION', 'INSULIN_SENSITIVITY', 'MUSCLE_REGULATION'],
    description: 'MOTS-c — митохондриальный пептид, активирует AMPK, улучшает инсулиновую чувствительность и жиросжигание.',
    synergies: [
        {with: "nmn", effect: "Митохондриальная функция", mechanism: "MOTS-c + NMN — путь NAD+", severity: "MEDIUM"},
        {with: "coq10", effect: "Энергетический метаболизм", mechanism: "Оба поддерживают митохондрии", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Риск гипогликемии с антидиабетиками", mechanism: "MOTS-c активирует AMPK и снижает глюкозу", severity: "HIGH"},
        {with: "pharma", effect: "Аддитивное снижение АД", mechanism: "MOTS-c влияет на метаболизм", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 10, timing: '1x/д п/к', form: 'MOTS-c 10 мг' },
    bestForCourse: false,
    targetOrgan: 'Митохондрии, скелетные мышцы',
    organMechanism: 'Митохондриальный биогенез, метаболическая регуляция',
    mechanismOfAction: 'Активация AMPK через повышение NAD+/NADH; регуляция экспрессии генов митохондрий; улучшение чувствительности к инсулину; снижение окислительного стресса',
    clinicalEffect: 'Улучшение метаболизма и чувствительности к инсулину, повышение энергии, замедление старения',
    bestForm: 'MOTS-C 10 мг 3x/нед',
  },
humanin: {
    id: 'humanin',
    name: 'Humanin',
    nameRu: 'Хьюманин',
    tier: 'specialty',
    category: ['peptide', 'neuroprotector', 'pharma'],
    forms: [
      { id: 'humanin', name: 'Humanin', nameRu: 'Хьюманин 5 мг', dose: '5 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'MUSCLES', 'HEART'],
    systems: ['neuro', 'cardio'],
    mechanisms: ['NEUROPROTECTION', 'APOPTOSIS_INHIBITION', 'MITOCHONDRIAL_PROTECTION', 'INSULIN_SENSITIVITY'],
    description: 'Хьюманин — митохондриальный пептид, подавляет апоптоз, нейропротекция и защита митохондрий. Анти-возрастной.',
    synergies: [
        {with: "mots_c", effect: "Митохондриальная защита", mechanism: "Оба — митохондриальные пептиды", severity: "MEDIUM"},
        {with: "coq10", effect: "Клеточная защита", mechanism: "Хьюманин защищает от апоптоза", severity: "LOW"},
      ],
    conflicts: [
        {with: "pharma", effect: "Риск гипогликемии с антидиабетиками", mechanism: "Хьюманин повышает инсулиновую чувствительность", severity: "MEDIUM"},
        {with: "pharma", effect: "Аддитивное снижение АД", mechanism: "Хьюманин влияет на эндотелий", severity: "LOW"},
        {with: "pharma", effect: "Взаимодействие с иммуносупрессорами", mechanism: "Хьюманин модулирует апоптоз и иммунитет", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 5, timing: '1x/д п/к', form: 'Хьюманин 5 мг' },
    bestForCourse: false,
    targetOrgan: 'Митохондрии, головной мозг, сердце',
    organMechanism: 'Митохондриальная цитопротекция, антиапоптотический сигналинг',
    mechanismOfAction: 'Связывание с GPCR-рецептором; активация PI3K/Akt и ERK1/2; ингибирование апоптоза через Bax и каспазы; снижение окислительного стресса и воспаления',
    clinicalEffect: 'Защита митохондрий, нейропротекция, кардиопротекция, анти-эйдж эффект',
    bestForm: 'Humanin 10 мг 2x/д',
  },
ss31: {
    id: 'ss31',
    name: 'SS-31',
    nameRu: 'SS-31 (Элампирад)',
    tier: 'specialty',
    category: ['peptide', 'mitochondrial', 'pharma'],
    forms: [
      { id: 'ss31', name: 'SS-31', nameRu: 'SS-31 1 мг', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['MUSCLES', 'HEART', 'KIDNEYS'],
    systems: ['cardio', 'renal'],
    mechanisms: ['MITOCHONDRIAL_PROTECTION', 'ATP_PRODUCTION', 'OXIDATIVE_STRESS_REDUCTION', 'MUSCLE_RECOVERY'],
    description: 'SS-31 — митохондриальный пептид, защищает внутреннюю мембрану митохондрий, снижает окислительный стресс.',
    synergies: [
      { with: "cordyceps", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "peptide_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Взаимодействие с митохондриальными препаратами", mechanism: "Аддитивный эффект на митохондрии", severity: "LOW"},
      ],
    monitoring: [
      { what: 'КФК', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 1, timing: '1x/д п/к', form: 'SS-31 1 мг' },
    bestForCourse: false,
    targetOrgan: 'Митохондрии, головной мозг, сердце',
    organMechanism: 'Митохондриальная защита, энергетический обмен',
    mechanismOfAction: 'Избирательное накопление во внутренней мембране митохондрий; улавливание митохондриальных ROS; активация комплекса I и III дыхательной цепи; снижение митохондриальной поры (mPTP)',
    clinicalEffect: 'Защита митохондрий, нейропротекция, повышение энергопродукции, анти-эйдж',
    bestForm: 'SS-31 20 мг 2x/д',
  },
thymosin_alpha1: {
    id: 'thymosin_alpha1',
    name: 'Thymosin Alpha-1',
    nameRu: 'Тимозин Альфа-1',
    tier: 'specialty',
    category: ['peptide', 'immunomodulator', 'pharma'],
    forms: [
      { id: 'thymosin_alpha1', name: 'Thymosin Alpha-1', nameRu: 'Тимозин Альфа-1 1.6 мг', dose: '1.6 мг 2x/д', best: true }
    ],
    organs: ['THYMUS', 'IMMUNE_SYSTEM'],
    systems: ['immune'],
    mechanisms: ['IMMUNE_REGULATION', 'T_CELL_ACTIVATION', 'ANTI_INFLAMMATORY', 'INFECTION_RESISTANCE'],
    description: 'Тимозин Альфа-1 — иммуномодулирующий пептид, активирует Т-клетки и NK-клетки. На курсе — защита от инфекций.',
    synergies: [
        {with: "vitamin_d3", effect: "Иммунная модуляция", mechanism: "Оба усиливают Th1-иммунитет", severity: "MEDIUM"},
        {with: "zinc", effect: "Т-клеточный иммунитет", mechanism: "Оба поддерживают Т-лимфоциты", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Антагонизм", mechanism: "Тимозин стимулирует иммунитет", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Иммунограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 1.6, timing: '2x/нед п/к', form: 'Тимозин Альфа-1 1.6 мг' },
    bestForCourse: false,
    targetOrgan: 'Иммунная система, тимус',
    organMechanism: 'Иммуномодуляция, Т-клеточный ответ',
    mechanismOfAction: 'Стимуляция матурации Т-клеток в тимусе; активация TLR-2/9 на дендритных клетках; повышение продукции IL-2, IL-12 и IFN-γ; усиление цитотоксического ответа NK-клеток',
    clinicalEffect: 'Усиление иммунитета, противоинфекционная защита, модуляция иммунного ответа',
    bestForm: 'Тимозин-α1 1.6 мг 2x/нед',
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
    synergies: [
        {with: "vitamin_c", effect: "Синтез коллагена", mechanism: "GHK-Медь стимулирует синтез", severity: "HIGH"},
        {with: "zinc", effect: "Заживление ран", mechanism: "Оба — кофакторы восстановления", severity: "MEDIUM"},
        {with: "bpc157", effect: "Комплексное заживление", mechanism: "Оба стимулируют ангиогенез", severity: "HIGH"},
      ],
    conflicts: [
        {with: "pharma", effect: "Конкуренция с хелатирующими агентами", mechanism: "GHK-Cu содержит медь, хелаторы связывают медь", severity: "MEDIUM"},
        {with: "pharma", effect: "Противопоказан при нарушениях метаболизма меди", mechanism: "Болезнь Вильсона, избыток меди", severity: "HIGH"},
        {with: "pharma", effect: "Теоретическое усиление антикоагуляции", mechanism: "Влияние на факторы свёртывания через медь", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Медь сыворотки', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Болезнь Вильсона', 'Избыток меди'],
    sideEffects: ['Покраснение', 'Редко: тошнота'],
    dosage: { mg: 2, timing: '1x/д п/к или наружно', form: 'GHK-Cu 2 мг' },
    bestForCourse: false,
    targetOrgan: 'Кожа, соединительная ткань, головной мозг',
    organMechanism: 'Синтез коллагена, регенерация тканей, нейропротекция',
    mechanismOfAction: 'Повышение синтеза коллагена I-IV типов через TGF-β; антиоксидантная защита через активацию металлотионеинов; усиление репарации ДНК (XPG, ERCC1); хелатирование свободной Cu2+',
    clinicalEffect: 'Улучшение состояния кожи, заживление ран, регенерация тканей, нейропротекция',
    bestForm: 'GHK-Cu 10 мг 2x/д',
  },
bpc157: {
    id: 'bpc157',
    name: 'BPC-157',
    nameRu: 'BPC-157 (Пептид защиты тела)',
    tier: 'specialty',
    category: ['peptide', 'joint', 'pharma'],
    forms: [
      { id: 'bpc157', name: 'BPC-157', nameRu: 'BPC-157 250 мкг', dose: '250 мкг 2x/д', best: true },
      { id: 'bpc157_2', name: 'BPC-157', nameRu: 'BPC-157 500 мкг', dose: '250 мкг', best: false }
    ],
    organs: ['JOINTS', 'GUT', 'MUSCLES'],
    systems: ['musculoskeletal', 'gastrointestinal'],
    mechanisms: ['WOUND_HEALING', 'ANGIOGENESIS', 'GUT_PROTECTION', 'ANTI_INFLAMMATORY'],
    description: 'BPC-157 — пептид защиты тела, ускоряет заживление связок, сухожилий, кишки. На курсе — защита суставов и ЖКТ.',
    synergies: [
        {with: "tb500", effect: "Максимальное заживление", mechanism: "BPC-157 — ангиогенез, TB-500 — миграция", severity: "HIGH"},
        {with: "vitamin_c", effect: "Синтез коллагена", mechanism: "Оба — синтез коллагена", severity: "MEDIUM"},
        {with: "ghk_cu", effect: "Регенерация тканей", mechanism: "Оба — заживление через разные пути", severity: "HIGH"},
        {with: "glucosamine", effect: "Восстановление суставов", mechanism: "BPC-157 + глюкозамин — хрящ", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Теоретическое усиление антикоагуляции", mechanism: "BPC-157 влияет на ангиогенез и сосуды", severity: "LOW"},
        {with: "pharma", effect: "Антагонизм с иммуносупрессорами", mechanism: "BPC-157 стимулирует заживление через иммунные пути", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Контроль суставов', when: 'Субъективно' }
    ],
    contraindications: ['Беременность', 'Онкология'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 0.25, timing: '2x/д п/к или перорально', form: 'BPC-157 250 мкг' },
    bestForCourse: true,
    targetOrgan: 'Желудочно-кишечный тракт, суставы, нервная система',
    organMechanism: 'Ангиогенез, заживление, регенерация тканей',
    mechanismOfAction: 'Активация фактора роста эндотелия сосудов (VEGF) и EGFR; модуляция NO-синтазы; регуляция экспрессии рецепторов гормона роста (GHR); стимуляция ангиогенеза и заживления',
    clinicalEffect: 'Заживление язв ЖКТ, восстановление сухожилий и связок, нейропротекция, противовоспалительное',
    bestForm: 'BPC-157 500 мкг 2x/д',
  },
tb500: {
    id: 'tb500',
    name: 'TB-500',
    nameRu: 'TB-500 (Тимозин Бета-4)',
    tier: 'specialty',
    category: ['peptide', 'joint', 'pharma'],
    forms: [
      { id: 'tb500', name: 'TB-500', nameRu: 'TB-500 5 мг', dose: '5 мг 2x/д', best: true },
      { id: 'tb500_2', name: 'TB-500', nameRu: 'TB-500 10 мг', dose: '5 мг', best: false }
    ],
    organs: ['JOINTS', 'MUSCLES', 'HEART'],
    systems: ['musculoskeletal'],
    mechanisms: ['ACTIN_REGULATION', 'WOUND_HEALING', 'MUSCLE_RECOVERY', 'ANTI_INFLAMMATORY'],
    description: 'TB-500 — пептид на основе тимозина бета-4, регулирует актин, ускоряет заживление мышц и связок. На курсе — восстановление.',
    synergies: [
        {with: "bpc157", effect: "Максимальное заживление", mechanism: "TB-500 — актин, BPC-157 — ангиогенез", severity: "HIGH"},
        {with: "vitamin_c", effect: "Заживление", mechanism: "Оба способствуют восстановлению", severity: "MEDIUM"},
        {with: "ghk_cu", effect: "Регенерация", mechanism: "Оба стимулируют миграцию", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Теоретический риск кровотечения", mechanism: "TB-500 регулирует актин и миграцию клеток", severity: "LOW"},
        {with: "pharma", effect: "Антагонизм с иммуносупрессорами", mechanism: "TB-500 стимулирует миграцию клеток через актин", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Контроль суставов', when: 'Субъективно' }
    ],
    contraindications: ['Беременность', 'Онкология'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 5, timing: '2x/нед п/к', form: 'TB-500 5 мг' },
    bestForCourse: true,
    targetOrgan: 'Соединительная ткань, сухожилия, связки',
    organMechanism: 'Ангиогенез, клеточная миграция, регенерация',
    mechanismOfAction: 'Связывание с актином (актин-секвестрирующий пептид); стимуляция ангиогенеза через VEGF; ускорение миграции кератиноцитов и фибробластов; антиапоптотический эффект через PI3K/Akt',
    clinicalEffect: 'Ускорение заживления травм опорно-двигательного аппарата, восстановление сухожилий, противовоспалительное',
    bestForm: 'TB-500 10 мг 2x/нед',
  },
melanotan1: {
    id: 'melanotan1',
    name: 'Melanotan-1',
    nameRu: 'Меланотан-1',
    tier: 'specialty',
    category: ['peptide', 'hormonal', 'pharma'],
    forms: [
      { id: 'melanotan1', name: 'Melanotan-1', nameRu: 'Меланотан-1 1 мг', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['SKIN', 'REPRODUCTIVE'],
    systems: ['reproductive'],
    mechanisms: ['MELANOGENESIS', 'SKIN_PROTECTION', 'UV_PROTECTION', 'APHRODISIAC_EFFECT'],
    description: 'Меланотан-1 — пептид, стимулирующий меланогенез, защиту кожи от УФ. Минимальные побочные эффекты.',
    synergies: [
        {with: "vitamin_d3", effect: "Пигментация и синтез витамина D", mechanism: "Меланотан → меланин → D3", severity: "LOW"},
      ],
    conflicts: [
        {with: "pharma", effect: "Повышение АД", mechanism: "Меланотан стимулирует MC-рецепторы → NO-зависимая вазоконстрикция", severity: "MEDIUM"},
        {with: "pharma", effect: "Риск приапизма с ингибиторами ФДЭ5", mechanism: "Синергия с силденафилом/тадалафилом", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Пигментация кожи', when: 'Субъективно' }
    ],
    contraindications: ['Беременность', 'Меланома в анамнезе'],
    sideEffects: ['Тошнота при начале', 'Покраснение'],
    dosage: { mg: 1, timing: '1x/д п/к', form: 'Меланотан-1 1 мг' },
    bestForCourse: false,
    targetOrgan: 'Кожа, центральная нервная система',
    organMechanism: 'Меланогенез, фототип кожи',
    mechanismOfAction: 'Агонизм меланокортиновых рецепторов MC1R на меланоцитах; стимуляция пигментации эумеланином; модуляция MC4R рецепторов (аппетит); фотопротекция через повышение меланина',
    clinicalEffect: 'Загар без UV, фотопротекция кожи, умеренное снижение аппетита',
    bestForm: 'Меланотан-1 10 мг 1x/нед',
  },
melanotan2: {
    id: 'melanotan2',
    name: 'Melanotan-2',
    nameRu: 'Меланотан-2',
    tier: 'specialty',
    category: ['peptide', 'hormonal', 'pharma'],
    forms: [
      { id: 'melanotan2', name: 'Melanotan-2', nameRu: 'Меланотан-2 0.5 мг', dose: '500 мкг 2x/д', best: true }
    ],
    organs: ['SKIN', 'REPRODUCTIVE'],
    systems: ['reproductive'],
    mechanisms: ['MELANOGENESIS', 'APHRODISIAC_EFFECT', 'APPETITE_SUPPRESSION', 'UV_PROTECTION'],
    description: 'Меланотан-2 — сильнее МТ1, стимулирует загар и либидо, но с больше побочными. На курсе — защита кожи.',
    synergies: [
        {with: "vitamin_d3", effect: "Пигментация и синтез витамина D", mechanism: "Меланотан → меланин → D3", severity: "LOW"},
      ],
    conflicts: [
        {with: "pharma", effect: "Повышение АД", mechanism: "MT-2 стимулирует MC-рецепторы", severity: "MEDIUM"},
        {with: "pharma", effect: "Риск приапизма с ингибиторами ФДЭ5", mechanism: "Синергия с PDE5i", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Пигментация кожи', when: 'Субъективно' }
    ],
    contraindications: ['Беременность', 'Меланома', 'Сердечно-сосудистые заболевания'],
    sideEffects: ['Тошнота', 'Приливы', 'Потемнение веснушек'],
    dosage: { mg: 0.5, timing: '1x/д п/к (титровать)', form: 'Меланотан-2 0.5 мг' },
    bestForCourse: false,
    targetOrgan: 'Кожа, центральная нервная система, репродуктивная система',
    organMechanism: 'Меланогенез, агонизм меланокортинов, либидо',
    mechanismOfAction: 'Агонизм MC1R (загар) и MC4R (аппетит/либидо); стимуляция эумеланина; повышение либидо через MC3/MC4R; активация NO-пути в кавернозных телах',
    clinicalEffect: 'Загар, повышение либидо, снижение аппетита, фотопротекция',
    bestForm: 'Меланотан-2 10 мг 1x/нед',
  },
pt141: {
    id: 'pt141',
    name: 'PT-141',
    nameRu: 'PT-141 (Бремеланотид)',
    tier: 'specialty',
    category: ['peptide', 'hormonal', 'pharma'],
    forms: [
      { id: 'pt141', name: 'PT-141', nameRu: 'PT-141 2 мг', dose: '2 мг 2x/д', best: true }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive'],
    mechanisms: ['MELANOCORTIN_ACTIVATION', 'APHRODISIAC_EFFECT', 'LIBIDO_ENHANCEMENT', 'ERECTILE_FUNCTION'],
    description: 'PT-141 — пептид для лечения сексуальной дисфункции, активирует меланокортиновые рецепторы. На курсе — либидо.',
    synergies: [
        {with: "melanotan2", effect: "Усиление эффекта", mechanism: "PT-141 — метаболит меланотана II", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "stimulant_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Либидо', when: 'Субъективно' }
    ],
    contraindications: ['Беременность', 'Неконтролируемая гипертензия'],
    sideEffects: ['Тошнота', 'Приливы', 'Повышение АД'],
    dosage: { mg: 2, timing: 'за 30 мин до п/к', form: 'PT-141 2 мг' },
    bestForCourse: false,
    targetOrgan: 'Центральная нервная система, репродуктивная система',
    organMechanism: 'Агонизм меланокортиновых рецепторов, регуляция либидо',
    mechanismOfAction: 'Агонизм MC3R/MC4R в гипоталамусе; активация NO-синтазы в кавернозных телах; модуляция дофаминового пути; повышение сексуального возбуждения через окситоцинергические нейроны',
    clinicalEffect: 'Повышение либидо и сексуального возбуждения, лечение гипоактивного сексуального влечения',
    bestForm: 'PT-141 10 мг 1x/нед',
  },
gonadorelin: {
    id: 'gonadorelin',
    name: 'Gonadorelin',
    nameRu: 'Гонадорелин',
    tier: 'specialty',
    category: ['peptide', 'hormonal', 'pharma'],
    forms: [
      { id: 'gonadorelin', name: 'Gonadorelin', nameRu: 'Гонадорелин 100 мкг', dose: '100 мкг 2x/д', best: true }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['GNRH_RELEASE', 'LH_FSH_REGULATION', 'TESTOSTERONE_RESTORE', 'PCT_SUPPORT'],
    description: 'Гонадорелин — стимулятор ГнРГ, восстанавливает ось ГРГ-ЛГ-ФСГ. Для ПКТ и восстановления после курса.',
    synergies: [
        {with: "hcg", effect: "Стимуляция HPG-оси", mechanism: "Гонадорелин — GnRH, ХГЧ — LH-аналог", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Антагонизм с аналогами ГнРГ", mechanism: "Гонадорелин стимулирует, аналоги ГнРГ подавляют ось", severity: "HIGH"},
        {with: "pharma", effect: "Взаимодействие с кортикостероидами", mechanism: "Глюкокортикоиды подавляют гипоталамо-гипофизарную ось", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'ЛГ/ФСГ', when: 'Каждые 2 нед' }
    ],
    contraindications: ['Беременность', 'Гипофизарная недостаточность'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 0.1, timing: '2-3x/д п/к', form: 'Гонадорелин 100 мкг' },
    bestForCourse: false,
    targetOrgan: 'Гипофиз, репродуктивная система',
    organMechanism: 'Секреция ЛГ/ФСГ, ось ГГЯ',
    mechanismOfAction: 'Агонизм GnRH-рецепторов на гонадотрофах гипофиза; стимуляция пульсирующего выброса ЛГ и ФСГ; пульсирующий режим активирует, постоянный — подавляет ось',
    clinicalEffect: 'Восстановление оси ГГЯ, повышение ЛГ/ФСГ, улучшение фертильности',
    bestForm: 'Гонадорелин 100 мкг 2x/д',
  },
kisspeptin: {
    id: 'kisspeptin',
    name: 'Kisspeptin',
    nameRu: 'Киссептин',
    tier: 'specialty',
    category: ['peptide', 'hormonal', 'pharma'],
    forms: [
      { id: 'kisspeptin', name: 'Kisspeptin', nameRu: 'Киссептин 100 мкг', dose: '100 мкг 2x/д', best: true }
    ],
    organs: ['REPRODUCTIVE', 'BRAIN'],
    systems: ['reproductive', 'endocrine'],
    mechanisms: ['GNRH_RELEASE', 'LH_FSH_STIMULATION', 'PUBERTY_REGULATION', 'REPRODUCTIVE_RECOVERY'],
    description: 'Киссептин — пептид, стимулирующий выброс ГнРГ, восстанавливает репродуктивную ось. Для ПКТ и восстановления.',
    synergies: [
        {with: "gonadorelin", effect: "Стимуляция HPG-оси", mechanism: "Кисспептин → GnRH → LH/FSH", severity: "HIGH"},
      ],
    conflicts: [
        {with: "pharma", effect: "Антагонизм с аналогами ГнРГ", mechanism: "Кисспептин стимулирует GnRH, аналоги ГнРГ блокируют", severity: "HIGH"},
        {with: "pharma", effect: "Взаимодействие с гормональной терапией", mechanism: "Экзогенные стероиды подавляют кисспептиновую сигнализацию", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'ЛГ/ФСГ', when: 'Каждые 2 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 0.1, timing: '1x/д п/к', form: 'Киссептин 100 мкг' },
    bestForCourse: false,
    targetOrgan: 'Гипоталамус, гипофиз, репродуктивная система',
    organMechanism: 'Пульсовая генерация ГнРГ, активация оси ГГЯ',
    mechanismOfAction: 'Агонизм KISS1R (GPR54) на нейронах ГнРГ гипоталамуса; стимуляция пульсовой секреции ГнРГ; повышение ЛГ и ФСГ; запуск полового созревания и овуляции',
    clinicalEffect: 'Восстановление фертильности, стимуляция оси ГГЯ, повышение ЛГ/ФСГ',
    bestForm: 'Кисспептин 1 мкг/кг 2x/д',
  },
glp1: {
    id: 'glp1',
    name: 'GLP-1',
    nameRu: 'ГПП-1 (Глюкагоноподобный пептид-1)',
    tier: 'specialty',
    category: ['peptide', 'metabolic', 'pharma'],
    forms: [
      { id: 'glp1', name: 'GLP-1', nameRu: 'ГПП-1 0.5 мг', dose: '500 мкг 2x/д', best: true }
    ],
    organs: ['PANCREAS', 'BRAIN', 'GUT'],
    systems: ['metabolic', 'gastrointestinal'],
    mechanisms: ['INSULIN_SECRETION', 'GLUCOSE_REGULATION', 'APPETITE_SUPPRESSION', 'WEIGHT_LOSS'],
    description: 'ГПП-1 — инкретиновый пептид, стимулирует инсулин, подавляет аппетит. На курсе — контроль глюкозы и веса.',
    synergies: [
        {with: "berberine", effect: "Контроль глюкозы и аппетита", mechanism: "Оба снижают аппетит и глюкозу", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Риск гипогликемии", mechanism: "Двойное снижение глюкозы", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Медуллярный рак щитовидной железы', 'МЭН2'],
    sideEffects: ['Тошнота', 'Диарея при начале'],
    dosage: { mg: 0.5, timing: '1-2x/д п/к', form: 'ГПП-1 0.5 мг' },
    bestForCourse: false,
    targetOrgan: 'Поджелудочная железа, желудок, головной мозг',
    organMechanism: 'Инкретиновый сигналинг, контроль гликемии, аппетит',
    mechanismOfAction: 'Агонизм GLP-1 рецепторов на β-клетках (инсулин); ингибирование глюкагона; замедление опорожнения желудка; активация GLP-1R в гипоталамусе (насыщение)',
    clinicalEffect: 'Снижение аппетита и веса, улучшение гликемического контроля, инсулинотропный эффект',
    bestForm: 'Семаглутид 0.5 мг 1x/нед',
  },
gip: {
    id: 'gip',
    name: 'GIP',
    nameRu: 'ГИП (Глюкозозависимый инсулинотропный полипептид)',
    tier: 'specialty',
    category: ['peptide', 'metabolic', 'pharma'],
    forms: [
      { id: 'gip', name: 'GIP', nameRu: 'ГИП 0.5 мг', dose: '500 мкг 2x/д', best: true }
    ],
    organs: ['PANCREAS', 'GUT', 'BONES'],
    systems: ['metabolic'],
    mechanisms: ['INSULIN_SECRETION', 'BONE_FORMATION', 'FAT_METABOLISM', 'GLUCOSE_REGULATION'],
    description: 'ГИП — инкретиновый пептид, стимулирует инсулин и формирование кости. Дополнение к ГПП-1.',
    synergies: [
        {with: "glp1", effect: "Двойной инкретиновый эффект", mechanism: "GLP-1 + GIP — двойной инкретин", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Риск гипогликемии с GLP-1", mechanism: "GIP + GLP-1 — двойной инкретиновый эффект", severity: "MEDIUM"},
        {with: "pharma", effect: "Взаимодействие с кортикостероидами", mechanism: "Глюкокортикоиды снижают инкретиновый эффект", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: тошнота'],
    dosage: { mg: 0.5, timing: '1x/д п/к', form: 'ГИП 0.5 мг' },
    bestForCourse: false,
    targetOrgan: 'Поджелудочная железа, жировая ткань',
    organMechanism: 'Инкретиновый сигналинг, метаболизм жиров',
    mechanismOfAction: 'Агонизм GIP-рецепторов на β-клетках (инсулинотропный); стимуляция липопротеинлипазы в жировой ткани; модуляция метаболизма костной ткани',
    clinicalEffect: 'Инсулинотропный эффект, улучшение липидного профиля, потенцирование GLP-1',
    bestForm: 'GIP 10 мг 1x/нед',
  },
cerebrolysin: {
    id: 'cerebrolysin',
    name: 'Cerebrolysin',
    nameRu: 'Церебролизин',
    tier: 'specialty',
    category: ['peptide', 'nootropic', 'pharma'],
    forms: [
      { id: 'cerebrolysin', name: 'Cerebrolysin', nameRu: 'Церебролизин 5 мл', dose: '5 мг 2x/д', best: true },
      { id: 'cerebrolysin_2', name: 'Cerebrolysin', nameRu: 'Церебролизин 10 мл', dose: '5 мг', best: false }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['NEUROTROPHIC_STIMULATION', 'NEUROPROTECTION', 'SYNAPTIC_PLASTICITY', 'MEMORY_ENHANCEMENT'],
    description: 'Церебролизин — комплекс нейропептидов, нейротрофическая активность, улучшает память и когницию. На курсе — нейропротекция.',
    synergies: [
        {with: "semax", effect: "Нейропротекция", mechanism: "Оба стимулируют нейротрофические факторы", severity: "HIGH"},
        {with: "citicoline", effect: "Когнитивная функция", mechanism: "Оба улучшают память", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Взаимодействие с ИМАО", mechanism: "Церебролизин содержит активные нейропептиды", severity: "MEDIUM"},
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Церебролизин влияет на мозговой кровоток", severity: "LOW"},
        {with: "pharma", effect: "Взаимодействие с антидепрессантами", mechanism: "Церебролизин стимулирует нейротрофические факторы", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Эпилепсия', 'Острый инсульт'],
    sideEffects: ['Редко: возбуждение', 'Боль в месте инъекции'],
    dosage: { mg: 5, timing: 'в/м или в/в 1x/д', form: 'Церебролизин 5 мл' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, нервная система',
    organMechanism: 'Нейротрофическая поддержка, нейрогенез, нейропротекция',
    mechanismOfAction: 'Доставка нейротрофических факторов (BDNF, NGF, GDNF) через ГЭБ; модуляция глутаматной эксайтотоксичности; снижение β-амилоида; стимуляция синаптогенеза',
    clinicalEffect: 'Улучшение когнитивных функций, нейропротекция, восстановление после инсульта и ЧМТ',
    bestForm: 'Церебролизин 5 мл в/м 10 дней',
  },
cortexin: {
    id: 'cortexin',
    name: 'Cortexin',
    nameRu: 'Кортексин',
    tier: 'specialty',
    category: ['peptide', 'nootropic', 'pharma'],
    forms: [
      { id: 'cortexin', name: 'Cortexin', nameRu: 'Кортексин 10 мг', dose: '10 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['NEUROPROTECTION', 'COGNITION_ENHANCEMENT', 'BDNF_INCREASE', 'MEMORY_IMPROVEMENT'],
    description: 'Кортексин — комплекс корковых пептидов, нейропротектор и ноотроп. Улучшает память и внимание на курсе.',
    synergies: [
        {with: "cerebrolysin", effect: "Нейропротекция", mechanism: "Оба содержат нейропептиды", severity: "MEDIUM"},
        {with: "piracetam", effect: "Ноотропная синергия", mechanism: "Оба улучшают когницию", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Взаимодействие с ИМАО", mechanism: "Кортексин содержит нейроактивные пептиды", severity: "MEDIUM"},
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Кортексин влияет на мозговой кровоток", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость'],
    sideEffects: ['Редко: аллергическая реакция'],
    dosage: { mg: 10, timing: 'в/м 1x/д', form: 'Кортексин 10 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, нервная система',
    organMechanism: 'Нейрометаболическая регуляция, нейропротекция',
    mechanismOfAction: 'Полипептидная регуляция нейронального метаболизма; модуляция GABA- дофамин- и серотонинергической систем; улучшение синаптической передачи; снижение перекисного окисления липидов',
    clinicalEffect: 'Улучшение когниции, нейропротекция, восстановление после ЧМТ и нейроинфекций',
    bestForm: 'Кортексин 10 мг в/м 10 дней',
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
    synergies: [
        {with: "collagen", effect: "Структурная поддержка", mechanism: "Эластин + коллаген — каркас", severity: "MEDIUM"},
        {with: "vitamin_c", effect: "Синтез эластина", mechanism: "C — кофактор синтеза", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Взаимодействие с коллагеназой и ферментами", mechanism: "Эластин расщепляется эластазой", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Кожа/суставы', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: аллергия'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'эластин пептиды' },
    bestForCourse: false,
    targetOrgan: 'Кожа, соединительная ткань, сосуды',
    organMechanism: 'Эластогенез, поддержка соединительной ткани',
    mechanismOfAction: 'Доставка аминокислот для синтеза эластина; модуляция тропоэластина и фибриллина; поддержка эластических волокон кожи и сосудов; ингибирование эластазы',
    clinicalEffect: 'Улучшение эластичности кожи, поддержка сосудов и связок, антивозрастной эффект',
    bestForm: 'Эластин 500 мг 2x/д',
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
    synergies: [
        {with: "zinc", effect: "Иммунная функция", mechanism: "Гистидин — предшественник гистамина", severity: "LOW"},
        {with: "vitamin_c", effect: "Карнозиновая система", mechanism: "Гистидин + бета-аланин → карнозин", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: 'copper', effect: 'Гистидин хелатирует медь, снижая её абсорбцию', mechanism: 'Образование нерастворимых комплексов с Cu2+', severity: 'MEDIUM' },
    ],
    monitoring: [
      { what: 'Общий белок', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Беременность', 'Подагра'],
    sideEffects: ['Редко: аллергия', 'Тошнота при высоких дозах'],
    dosage: { mg: 1000, timing: 'натощак 2x/д', form: 'L-Гистидин 1000 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, мышцы, иммунная система',
    organMechanism: 'Предшественник гистамина, антиоксидантная защита',
    mechanismOfAction: 'Дскарбоксилирование в гистамин (декарбоксилаза); буферирование pH в мышцах (имидазольное кольцо); предшественник карнозина; хелатирование Zn2+ и Cu2+',
    clinicalEffect: 'Поддержка иммунитета, восстановление мышц, антиоксидантная защита',
    bestForm: 'L-Гистидин 500 мг 2x/д',
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
    synergies: [
        {with: "nac", effect: "Синтез глутатиона", mechanism: "Цистеин — предшественник глутатиона", severity: "HIGH"},
        {with: "vitamin_c", effect: "Антиоксидантная сеть", mechanism: "Оба поддерживают редокс-баланс", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: 'n_acetylcysteine', effect: 'Высокие дозы цистеина + NAC — избыточная нагрузка на почки', mechanism: 'Перегрузка пути сульфатации и риск камнеобразования', severity: 'MEDIUM' },
    ],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Бронхиальная астма (с осторожностью)'],
    sideEffects: ['Тошнота натощак', 'Изжога'],
    dosage: { mg: 500, timing: 'натощак 2x/д', form: 'N-Ацетилцистеин 600 мг' },
    bestForCourse: true,
    targetOrgan: 'Печень, иммунная система, кожа',
    organMechanism: 'Предшественник глутатиона, детоксикация, антиоксидантная защита',
    mechanismOfAction: 'Лимитирующий предшественник синтеза глутатиона (γ-глутамилцикл); донация тиоловых групп (детоксикация ксенобиотиков); антиоксидантная защита через глутатионпероксидазу; участие в кератинизации',
    clinicalEffect: 'Поддержка глутатиона, детоксикация печени, антиоксидантная защита, здоровье кожи',
    bestForm: 'N-Ацетил-L-цистеин (NAC) 600 мг 2x/д',
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
    synergies: [
        {with: "vitamin_b_complex", effect: "Фосфолипидный обмен", mechanism: "Серин — фосфатидилсерин", severity: "LOW"},
      ],
    conflicts: [
      { with: 'glycine', effect: 'Высокие дозы серина конкурируют с глицином за транспорт', mechanism: 'Общий транспортер аминокислот в ЦНС', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'L-Серин 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Печень, головной мозг, клеточные мембраны',
    organMechanism: 'Метаболизм фосфолипидов, одноуглеродный обмен',
    mechanismOfAction: 'Предшественник фосфатидилсерина и сфинголипидов; донация одноуглеродных фрагментов в цикле фолата; участие в синтезе пуринов и пиримидинов; нейромедиаторная модуляция (глицин/D-серин)',
    clinicalEffect: 'Поддержка клеточных мембран, нейропротекция, метаболическая регуляция',
    bestForm: 'L-Серин 500 мг 2x/д',
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
      { with: "lysine", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "collagen", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: 'vitamin_c', effect: 'Избыток витамина C снижает гидроксилирование пролина in vivo', mechanism: 'Окисление кофактора α-кетоглутарата', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Кожа/суставы', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'L-Пролин 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Соединительная ткань, кожа, суставы',
    organMechanism: 'Синтез коллагена, структура соединительной ткани',
    mechanismOfAction: 'Гидроксилирование в гидроксипролин (пролилгидроксилаза, Vit C); ключевой компонент тройной спирали коллагена; стабилизация коллагеновых волокон; структурный белок соединительной ткани',
    clinicalEffect: 'Поддержка синтеза коллагена, здоровье кожи, суставов и костей',
    bestForm: 'L-Пролин 500 мг 2x/д',
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
      { with: "amino_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: 'magnesium', effect: 'Аспартат может конкурировать с магнием за всасывание', mechanism: 'Общий транспортер двухвалентных катионов', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Аммиак', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'L-Аспартат 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, печень, мышцы',
    organMechanism: 'Метаболизм аминокислот, нейротрансмиссия',
    mechanismOfAction: 'Агонизм NMDA-рецепторов (возбуждающий нейротрансмиттер); субстрат цикла мочевины и малат-аспартатного челнока; предшественник D-аспарагиновой кислоты; глюконеогенез',
    clinicalEffect: 'Нейромодуляция, поддержка энергообмена, метаболическая регуляция',
    bestForm: 'L-Аспартат 500 мг 2x/д',
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
    synergies: [
        {with: "arginine", effect: "Цикл мочевины", mechanism: "Оба — компоненты цикла мочевины", severity: "MEDIUM"},
        {with: "citrulline", effect: "NO-путь", mechanism: "Орнитин → цитруллин → NO", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: 'arginine', effect: 'Избыток орнитина ингибирует синтез NO из аргинина', mechanism: 'Конкуренция за аргиназу и NOS', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Аммиак', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'натощак на ночь', form: 'L-Орнитин 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Печень, мышцы, эндокринная система',
    organMechanism: 'Цикл мочевины, детоксикация аммиака',
    mechanismOfAction: 'Активация орнитин-карбамоилтрансферазы (цикл мочевины); снижение аммиака и лактата; предшественник полиаминов (путресцин, спермидин); стимуляция выброса GH',
    clinicalEffect: 'Детоксикация аммиака, снижение утомления, поддержка восстановления',
    bestForm: 'L-Орнитин 500 мг 2x/д',
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
    synergies: [
        {with: "vitamin_b6", effect: "Метаболизм треонина", mechanism: "B6 — кофактор", severity: "LOW"},
      ],
    conflicts: [
      { with: 'serine', effect: 'Треонин и серин конкурируют за одинаковые транспортеры', mechanism: 'Конкуренция за Na+-зависимый транспортер аминокислот', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Общий белок', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'L-Треонин 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Печень, иммунная система, соединительная ткань',
    organMechanism: 'Метаболизм, синтез муцина, иммуноглобулинов',
    mechanismOfAction: 'Метаболизм через треонин-дегидразу; субстрат синтеза муцинов (гликопротеины слизистой); компонент иммуноглобулинов (IgG); предшественник глицина через треонин-альдолазу',
    clinicalEffect: 'Поддержка иммунитета, здоровье слизистых, синтез муцина',
    bestForm: 'L-Треонин 500 мг 2x/д',
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
      { with: "proline", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "collagen", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: 'arginine', effect: 'Лизин конкурирует с аргинином за всасывание и репликацию HSV', mechanism: 'Конкуренция за общий транспортер dibasic аминокислот', severity: 'MEDIUM' },
    ],
    monitoring: [
      { what: 'Кальций сыворотки', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Печёночная недостаточность'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'натощак 2x/д', form: 'L-Лизин 1000 мг' },
    bestForCourse: false,
    targetOrgan: 'Соединительная ткань, кожа, нервная система',
    organMechanism: 'Синтез коллагена, карнитина, нейротрансмиттеров',
    mechanismOfAction: 'Гидроксилирование в гидроксилизин (коллаген); предшественник карнитина и глутамата; ингибирование репликации HSV (лизин конкурирует с аргинином); метилирование ДНК/гистонов',
    clinicalEffect: 'Поддержка коллагена, противовирусное действие, синтез карнитина',
    bestForm: 'L-Лизин 1 г 2x/д',
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
    synergies: [
        {with: "vitamin_b6", effect: "Синтез дофамина", mechanism: "Фенилаланин → тирозин → дофамин", severity: "MEDIUM"},
        {with: "vitamin_c", effect: "Синтез норадреналина", mechanism: "C — кофактор дофамин-бета-гидроксилазы", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Гипертонический криз", mechanism: "Фенилаланин + ИМАО = опасно", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Фенилкетонурия', 'Шизофрения'],
    sideEffects: ['Тошнота при высоких дозах', 'Бессонница'],
    dosage: { mg: 500, timing: 'натощак 2x/д', form: 'DL-Фенилаланин 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, надпочечники, нервная система',
    organMechanism: 'Синтез катехоламинов, тирозиновый путь',
    mechanismOfAction: 'Предшественник тирозина (фенилаланин-гидроксилаза); лимитирующая стадия синтеза дофамина, норадреналина и адреналина; модуляция настроения через катехоламины',
    clinicalEffect: 'Улучшение настроения и фокуса, повышение энергии, поддержка когниции',
    bestForm: 'DL-Фенилаланин 500 мг 2x/д',
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
    synergies: [
        {with: "magnesium", effect: "Блокировка эксайтотоксичности", mechanism: "Магний блокирует NMDA при избытке глутамата", severity: "HIGH"},
      ],
    conflicts: [
        {with: "msg_sensitivity", effect: "Головная боль", mechanism: "Избыток глутамата — эксайтотоксичность", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Аммиак', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Эпилепсия', 'Нейродегенеративные заболевания'],
    sideEffects: ['Возбуждение при высоких дозах'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'L-Глутамат 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, нервная система, мышцы',
    organMechanism: 'Нейротрансмиссия, метаболизм, цикл Кребса',
    mechanismOfAction: 'Агонизм ионотропных (NMDA, AMPA) и метаботропных mGluR-рецепторов; ключевой возбуждающий нейротрансмиттер; субстрат глутамин-цикла; анаплеротическая реакция в цикле Кребса (α-кетоглутарат)',
    clinicalEffect: 'Нейромодуляция, поддержка метаболизма, энергетический обмен',
    bestForm: 'L-Глутаминовая кислота 500 мг 2x/д',
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
      { with: "peptide_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: 'glutamate', effect: 'AKG может превращаться в глутамат, усиливая эксайтотоксичность', mechanism: 'Трансаминирование через глутаматдегидрогеназу', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Аммиак', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'Альфа-кетоглутарат 1 г' },
    bestForCourse: false,
    targetOrgan: 'Митохондрии, печень, мышцы',
    organMechanism: 'Цикл Кребса, энергетический обмен, метаболизм',
    mechanismOfAction: 'Ключевой метаболит цикла Кребса (анаплеротическая реакция); предшественник глутамата и глутамина; субстрат α-кетоглутарат-зависимых диоксигеназ; ингибирование протеасомной деградации',
    clinicalEffect: 'Повышение энергопродукции, поддержка метаболизма, снижение катаболизма',
    bestForm: 'AKG 500 мг 2x/д',
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
    synergies: [
        {with: "ashwagandha", effect: "Адаптогенный и иммунный", mechanism: "Оба модулируют стресс и иммунитет", severity: "MEDIUM"},
        {with: "vitamin_c", effect: "Иммуномодуляция", mechanism: "Оба поддерживают иммунитет", severity: "MEDIUM"},
        {with: "turkey_tail", effect: "Максимальная иммуномодуляция", mechanism: "Разные бета-глюканы", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Антагонизм", mechanism: "Рейши стимулирует иммунитет", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)', 'Приём антикоагулянтов'],
    sideEffects: ['Редко: сухость во рту', 'Желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'экстракт рейши' },
    bestForCourse: false,
    targetOrgan: 'Печень, иммунная система, нервная система',
    organMechanism: 'Иммуномодуляция, гепатопротекция, адаптогенный эффект',
    mechanismOfAction: 'Модуляция NF-κB через β-глюканы и тритерпены; ингибирование 5α-редуктазы; снижение кортизола; антиоксидантная защита через NRF2; противовирусная активность через интерферон',
    clinicalEffect: 'Иммуномодуляция, защита печени, снижение кортизола, противовоспалительное действие',
    bestForm: 'Рейши 1500 мг 2x/д',
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
      { with: "polyphenol_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "lycopene", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "amino_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "peptide_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Потенцирование антикоагулянтов", mechanism: "Чага может замедлять свёртываемость", severity: "MEDIUM" },
      { with: "pharma", effect: "Снижение эффективности иммуносупрессоров", mechanism: "Чага стимулирует иммунитет", severity: "MEDIUM" },
      { with: "pharma", effect: "Аддитивное снижение глюкозы при диабете", mechanism: "Чага повышает чувствительность к инсулину", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'экстракт чаги' },
    bestForCourse: false,
    targetOrgan: 'Печень, иммунная система, ЖКТ',
    organMechanism: 'Антиоксидантная защита, иммуномодуляция, цитопротекция',
    mechanismOfAction: 'Высокое содержание меланина (улавливание ROS); активации NK-клеток через β-глюканы; ингибирование NF-κB; модуляция IL-6 и TNF-α; пребиотический эффект для микробиоты',
    clinicalEffect: 'Мощная антиоксидантная защита, иммуномодуляция, поддержка ЖКТ и печени',
    bestForm: 'Чага экстракт 1000 мг 2x/д',
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
    synergies: [
        {with: "vitamin_d3", effect: "Иммунитет", mechanism: "Майтаке-D-фракция + D3", severity: "MEDIUM"},
        {with: "turkey_tail", effect: "Иммуномодуляция", mechanism: "Оба — бета-глюканы", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Снижение эффективности иммуносупрессоров", mechanism: "Майтаке стимулирует иммунитет", severity: "MEDIUM" },
      { with: "pharma", effect: "Аддитивное снижение глюкозы при диабете", mechanism: "Майтаке регулирует глюкозу", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'экстракт майтаке' },
    bestForCourse: false,
    targetOrgan: 'Иммунная система, эндокринная система',
    organMechanism: 'Иммуномодуляция, метаболическая регуляция',
    mechanismOfAction: 'Активация дендритных клеток через D-фракцию β-глюканов; стимуляция макрофагов и NK-клеток; модуляция инсулиновой чувствительности (PPAR-γ); снижение глюкозы через α-глюкозидазу',
    clinicalEffect: 'Иммуностимуляция, модуляция метаболизма глюкозы, поддержка иммунитета',
    bestForm: 'Майтаке 500 мг 2x/д',
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
    synergies: [
        {with: "reishi", effect: "Комплексная грибная поддержка", mechanism: "Разные полисахариды", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Снижение эффективности иммуносупрессоров", mechanism: "Шиитаке стимулирует иммунитет", severity: "MEDIUM" },
      { with: "pharma", effect: "Потенцирование антикоагулянтов", mechanism: "Шиитаке может замедлять свёртываемость", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: кожная сыпь'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'экстракт шиитаке' },
    bestForCourse: false,
    targetOrgan: 'Печень, сердечно-сосудистая система, иммунная система',
    organMechanism: 'Иммуномодуляция, снижение холестерина, гепатопротекция',
    mechanismOfAction: 'Ингибирование HMG-CoA редуктазы (эритаденин); активация макрофагов через β-глюканы; стимуляция перфорина NK-клеток; антиоксидантная защита через L-эрготионеин',
    clinicalEffect: 'Снижение холестерина, иммуностимуляция, гепатопротекция',
    bestForm: 'Шиитаке 1000 мг 2x/д',
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
    synergies: [
        {with: "reishi", effect: "Иммуномодуляция", mechanism: "Оба — мощные иммуномодуляторы", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Снижение эффективности иммуносупрессоров", mechanism: "Агарикус стимулирует иммунитет", severity: "MEDIUM" },
      { with: "pharma", effect: "Потенцирование антикоагулянтов", mechanism: "Агарикус может замедлять свёртываемость", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'экстракт агарикуса' },
    bestForCourse: false,
    targetOrgan: 'Иммунная система, печень, поджелудочная железа',
    organMechanism: 'Иммуномодуляция, метаболическая регуляция',
    mechanismOfAction: 'Стимуляция TLR-4 на макрофагах; повышение натуральных киллеров (NK); модуляция апоптоза через каспазы; модуляция чувствительности к инсулину через PI3K/Akt',
    clinicalEffect: 'Иммуномодуляция, поддержка метаболизма глюкозы, противоопухолевая активность',
    bestForm: 'Агарикус 1000 мг 2x/д',
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
    synergies: [
        {with: "reishi", effect: "Комплексная иммуномодуляция", mechanism: "Оба — бета-глюканы разных типов", severity: "HIGH"},
        {with: "probiotics", effect: "Микробиом + иммунитет", mechanism: "Оба поддерживают кишечный иммунитет", severity: "MEDIUM"},
        {with: "vitamin_d3", effect: "Иммунная активация", mechanism: "Оба активируют макрофаги", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Снижение эффективности иммуносупрессоров", mechanism: "Хвост индейки стимулирует иммунитет через бета-глюканы", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'экстракт хвоста индейки' },
    bestForCourse: false,
    targetOrgan: 'Иммунная система, желудочно-кишечный тракт',
    organMechanism: 'Иммуномодуляция, поддержка микробиоты, противоопухолевая защита',
    mechanismOfAction: 'Активация дендритных клеток и макрофагов через Krestin (PSP/PSK); модуляция цитокинов (IL-2, IFN-γ); стимуляция CD8+ T-клеток; пребиотический эффект для микробиоты',
    clinicalEffect: 'Усиление иммунитета, поддержка ЖКТ, адъювантная противоопухолевая терапия',
    bestForm: 'Турция Тейл 1000 мг 2x/д',
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
      { with: "vitamin_a", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "omega3", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: 'beta_carotene', effect: 'Лютеин и бета-каротин конкурируют за всасывание', mechanism: 'Общий транспортер SCARB1 для каротиноидов', severity: 'LOW' },
    ],
    monitoring: [
      { what: 'Офтальмолог', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: кожный зуд при высоких дозах'],
    dosage: { mg: 20, timing: 'с едой 1x/д', form: 'лютеин 20 мг' },
    bestForCourse: false,
    targetOrgan: 'Глаза, кожа, головной мозг',
    organMechanism: 'Антиоксидантная защита сетчатки, макулярный пигмент',
    mechanismOfAction: 'Накопление в макуле (светофильтр синего света); улавливание синглетного кислорода; стабилизация мембран фоторецепторов; защита пигментного эпителия сетчатки от A2E',
    clinicalEffect: 'Защита зрения, профилактика макулярной дегенерации, антиоксидантная защита',
    bestForm: 'Лютеин 20 мг с зеаксантином',
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
      { with: "astaxanthin", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "polyphenol_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "chaga", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "amino_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "peptide_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "olive_extract", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "flavonoids", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "iron", effect: "Ликопин снижает всасывание негемового железа", mechanism: "Хелатирование Fe в просвете кишечника", severity: "MEDIUM" },
      { with: "vitamin_e", effect: "Конкуренция за всасывание — оба жирорастворимые", mechanism: "Конкурентное всасывание в хиломикроны", severity: "LOW" },
    ],
    monitoring: [
      { what: 'ПСА', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Лycopin аллергия'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 15, timing: 'с едой 1x/д', form: 'ликопин 15 мг' },
    bestForCourse: false,
    targetOrgan: 'Простата, сердце, кожа, кости',
    organMechanism: 'Антиоксидантная защита, модуляция IGF-1',
    mechanismOfAction: 'Мощное улавливание синглетного кислорода (в 2× сильнее β-каротина); модуляция IGF-1 сигналинга; ингибирование 5α-редуктазы; снижение окислительного стресса в простате; активация PPAR-γ',
    clinicalEffect: 'Защита простаты, кардиопротекция, профилактика атеросклероза, UV-протекция',
    bestForm: 'Ликопин 20 мг 2x/д',
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
      { with: "vitamin_c", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "quercetin", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "anthocyanins", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "vitamin_a", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "omega3", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "iron", effect: "Антоцианы хелатируют железо — снижение абсорбции негемового Fe", mechanism: "Комплексообразование Fe-антоциан", severity: "MEDIUM" },
      { with: "aspirin", effect: "Усиление антиагрегантного эффекта — риск кровотечений", mechanism: "Ингибирование COX + антоцианы", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Офтальмолог', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: аллергия'],
    dosage: { mg: 200, timing: 'с едой 1x/д', form: 'антоцианы экстракт 200 мг' },
    bestForCourse: false,
    targetOrgan: 'Сосуды, головной мозг, сердце',
    organMechanism: 'Антиоксидантная защита, эндотелиальная функция, микроциркуляция',
    mechanismOfAction: 'Активация eNOS (вазодилатация); ингибирование NF-κB и COX-2; улучшение эндотелиальной функции через PI3K/Akt; стимуляция аутофагии через AMPK; хелатирование Fe и ROS',
    clinicalEffect: 'Улучшение эндотелиальной функции, кардиопротекция, нейропротекция, снижение воспаления',
    bestForm: 'Антоцианы 150 мг 2x/д',
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
    organs: ['HEART', 'VESSELS', 'SKIN'],
    systems: ['cardio'],
    mechanisms: ['ANTIOXIDANT', 'ENDOTHELIAL_PROTECTION', 'COLLAGEN_SYNTHESIS', 'MICROCIRCULATION'],
    description: 'Экстракт косточек винограда — богат проантоцианидинами, защищает эндотелий и коллаген. На курсе — сосуды и кожа.',
    synergies: [
        {with: "vitamin_c", effect: "Антиоксидантная активность", mechanism: "Проантоцианидины + C", severity: "MEDIUM"},
        {with: "vitamin_e", effect: "Защита сосудов", mechanism: "Оба укрепляют стенки сосудов", severity: "MEDIUM"},
        {with: "curcumin", effect: "Противовоспалительное", mechanism: "Оба подавляют NF-kB", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Снижает агрегацию тромбоцитов", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 200, timing: 'с едой 1x/д', form: 'экстракт косточек винограда 200 мг' },
    bestForCourse: false,
    targetOrgan: 'Сосуды, кожа, головной мозг',
    organMechanism: 'Антиоксидантная защита, коллаген-стабилизация, микроциркуляция',
    mechanismOfAction: 'Проантоцианидины — мощное улавливание ROS (в 50× сильнее Vit C/E); стабилизация коллагена через ингибирование матриксных металлопротеиназ (MMP); активация eNOS; ингибирование NF-κB',
    clinicalEffect: 'Венопротекция, антиоксидантная защита, улучшение микроциркуляции, здоровье кожи',
    bestForm: 'Экстракт виноградных косточек 200 мг 2x/д',
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
    organs: ['HEART', 'VESSELS', 'SKIN'],
    systems: ['cardio', 'neuro'],
    mechanisms: ['ANTIOXIDANT', 'ENDOTHELIAL_PROTECTION', 'COLLAGEN_PROTECTION', 'MICROCIRCULATION'],
    description: 'Пикногенол — экстракт коры приморской сосны, мощный антиоксидант. Защищает сосуды, кожу и эндотелий.',
    synergies: [
        {with: "vitamin_c", effect: "Регенерация витамина C", mechanism: "Пикногенол + C", severity: "MEDIUM"},
        {with: "vitamin_e", effect: "Защита сосудов и кожи", mechanism: "Оба — антиоксиданты", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Антикоагуляция", mechanism: "Снижает агрегацию тромбоцитов", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 100, timing: 'с едой 1x/д', form: 'пикногенол 100 мг' },
    bestForCourse: false,
    targetOrgan: 'Сосуды, кожа, головной мозг, лёгкие',
    organMechanism: 'Антиоксидантная защита, противовоспалительный каскад, микроциркуляция',
    mechanismOfAction: 'Активация eNOS (NO-зависимая вазодилатация); ингибирование COX-1/COX-2 и 5-LOX; хелатирование Fe; ингибирование AGE-образования; улучшение микроциркуляции через модуляцию эндотелина-1',
    clinicalEffect: 'Кардиопротекция, улучшение когниции, снижение воспаления, венопротекция',
    bestForm: 'Пикногенол 100 мг 2x/д',
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
    organs: ['HEART', 'BRAIN', 'VESSELS'],
    systems: ['cardio', 'neuro'],
    mechanisms: ['ANTIOXIDANT', 'NITRIC_OXIDE_PRODUCTION', 'BLOOD_FLOW_IMPROVEMENT', 'COGNITION_ENHANCEMENT'],
    description: 'Какао-флаванолы — улучшают производство NO, кровоток мозга и сердца. На курсе — кардио- и нейропротекция.',
    synergies: [
        {with: "omega3", effect: "Кардиопротекция", mechanism: "Оба улучшают эндотелий", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Какао-флаванолы снижают агрегацию тромбоцитов", severity: "LOW"},
        {with: "pharma", effect: "Потенцирование гипотензии", mechanism: "Усиление NO-опосредованной вазодилатации", severity: "LOW"},
        {with: "pharma", effect: "Взаимодействие с ИМАО", mechanism: "Тираминоподобные соединения в какао", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: аллергия на какао'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'какао-флаванолы 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Сердце, сосуды, головной мозг',
    organMechanism: 'Эндотелиальная функция, NO-сигналинг, антиоксидантная защита',
    mechanismOfAction: 'Повышение NO через eNOS (флаванолы); ингибирование ангиотензинпревращающего фермента (АПФ); снижение АД; улучшение когнитивной функции через BDNF; антиагрегантный эффект',
    clinicalEffect: 'Улучшение эндотелиальной функции, снижение АД, кардиопротекция, улучшение когниции',
    bestForm: 'Какао флаванолы 500 мг 2x/д',
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
    synergies: [
        {with: "olive_oil", effect: "Усиление антиоксидантного эффекта", mechanism: "C60 в масле — лучшая доставка", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "C60 может изменять фармакокинетику лекарств за счет наноразмера", mechanism: "Изменение биораспределения", severity: "MEDIUM" },
      { with: "vitamin_a", effect: "Избыточная антиоксидантная нагрузка — возможный прооксидантный эффект", mechanism: "C60 + ретиноиды → ↓ ROS сверх нормы", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Окислительный стресс', when: 'Субъективно' }
    ],
    contraindications: ['Беременность', 'Недостаточно данных'],
    sideEffects: ['Недостаточно данных по долгосрочной безопасности'],
    dosage: { mg: 1, timing: 'с едой 1x/д', form: 'C60 в оливковом масле 1 мг' },
    bestForCourse: false,
    targetOrgan: 'Митохондрии, головной мозг, кожа',
    organMechanism: 'Антиоксидантная защита, митохондриальная стабилизация',
    mechanismOfAction: 'Губка для ROS (до 34 радикалов на молекулу); локализация на внутренней мембране митохондрий; модуляция NRF2 и HO-1; ингибирование NF-κB; стимуляция аутофагии',
    clinicalEffect: 'Мощная антиоксидантная защита, антивозрастной эффект, нейропротекция',
    bestForm: 'C60 (фуллерен) 500 мг/нед',
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
    synergies: [
        {with: "sulforaphane", effect: "Максимальная активация Nrf2", mechanism: "Оба активируют Nrf2", severity: "HIGH"},
        {with: "curcumin", effect: "Антиоксидантный ответ", mechanism: "Куркумин тоже активирует Nrf2", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Nrf2-активация может защищать раковые клетки от химиотерапии", mechanism: "Индукция HO-1/ NQO1 защищает ДНК", severity: "HIGH" },
      { with: "n_acetylcysteine", effect: "Избыточное усиление глутатионовой системы — возможный редокс-дисбаланс", mechanism: "Оба ↑ GSH через разные пути", severity: "LOW" },
    ],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 20, timing: 'с едой 1x/д', form: 'Nrf2-активатор 20 мг' },
    bestForCourse: false,
    targetOrgan: 'Печень, почки, лёгкие, головной мозг',
    organMechanism: 'NRF2-сигналинг, фаза II детоксикации, антиоксидантная защита',
    mechanismOfAction: 'Комплексная активация ядерного фактора NRF2 через модификацию Keap1; индукция >200 цитопротективных генов (HO-1, NQO1, GST); усиление глутатионовой системы; митохондриальная биогенез через PGC-1α',
    clinicalEffect: 'Системная цитопротекция, детоксикация, снижение окислительного стресса',
    bestForm: 'Активатор NRF2 (сульфорафан/протопиум) 20 мг',
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
    organs: ['HEART', 'VESSELS', 'SKIN'],
    systems: ['cardio'],
    mechanisms: ['ANTIOXIDANT', 'ENDOTHELIAL_PROTECTION', 'ANTI_INFLAMMATORY', 'LIPID_IMPROVEMENT'],
    description: 'Экстракт оливы с гидрокситирозолом — мощный антиоксидант, защищает эндотелий и снижает окисление ЛПНП.',
    synergies: [
      { with: "lycopene", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "flavonoids", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "polyphenol_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "olive_extract", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Аддитивное снижение АД", mechanism: "Гидрокситирозол усиливает NO-продукцию", severity: "MEDIUM"},
        {with: "pharma", effect: "Потенцирование гипогликемии", mechanism: "Олеуропеин повышает инсулиновую чувствительность", severity: "LOW"},
        {with: "pharma", effect: "Снижение всасывания железа", mechanism: "Полифенолы хелатируют железо", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 250, timing: 'с едой 1x/д', form: 'экстракт оливы 250 мг' },
    bestForCourse: false,
    targetOrgan: 'Сердце, сосуды, кишечник',
    organMechanism: 'Антиоксидантная защита, снижение АД, кардиопротекция',
    mechanismOfAction: 'Ингибирование АПФ (олеуропеин); активация eNOS и NO; ингибирование COX-2; защита митохондрий; снижение окисления LDL; антиагрегантный эффект через PAF',
    clinicalEffect: 'Снижение артериального давления, кардиопротекция, антиоксидантная защита',
    bestForm: 'Экстракт оливы 500 мг 2x/д',
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
    organs: ['VESSELS', 'EYES', 'SKIN'],
    systems: ['cardio'],
    mechanisms: ['ANTIOXIDANT', 'VITAMIN_C_POTENTIATION', 'MICROCIRCULATION', 'ANTI_INFLAMMATORY'],
    description: 'Цитрусовые биофлавоноиды — гесперидин, рутин, нарингенин. Усиливают витамин С, защищают сосуды.',
    synergies: [
        {with: "vitamin_c", effect: "Синергия", mechanism: "Флавоноиды + C", severity: "HIGH"},
        {with: "quercetin", effect: "Противовоспалительное", mechanism: "Оба — флавоноиды", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: аллергия на цитрусовые'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'цитрусовые биофлавоноиды 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Сосуды, кожа, иммунная система',
    organMechanism: 'Капилляропротекция, антиоксидантная защита, усвоение витамина C',
    mechanismOfAction: 'Комплекс флавоноидов (гесперидин, нарингенин, диосмин); усиление усвоения витамина C; стабилизация капилляров через ингибирование MMP; противовоспалительное действие через NF-κB',
    clinicalEffect: 'Венопротекция, укрепление капилляров, антиоксидантная защита, снижение воспаления',
    bestForm: 'Цитрусовые биофлавоноиды 500 мг 2x/д',
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
    organs: ['HEART', 'BRAIN', 'VESSELS'],
    systems: ['cardio', 'neuro'],
    mechanisms: ['ANTIOXIDANT', 'ANTI_INFLAMMATORY', 'VASCULAR_PROTECTION', 'COGNITION_SUPPORT'],
    description: 'Флавоноиды — класс полифенолов с антиоксидантным и противовоспалительным действием. Защита сосудов и мозга.',
    synergies: [
      { with: "lycopene", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "olive_extract", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "polyphenol_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Взаимодействие с CYP1A2", mechanism: "Флавоноиды ингибируют CYP1A2", severity: "MEDIUM"},
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Флавоноиды снижают агрегацию тромбоцитов", severity: "MEDIUM"},
        {with: "pharma", effect: "Снижение всасывания тироксина", mechanism: "Флавоноиды связывают тиреоидные гормоны", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'флавоноиды комплекс 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Сердце, сосуды, головной мозг',
    organMechanism: 'Полифенольная защита, антиоксидантный каскад',
    mechanismOfAction: 'Модуляция PI3K/Akt и NF-κB; улавливание ROS и хелатирование железа; ингибирование COX-2 и LOX; активация NRF2; модуляция эндотелиальной функции через NO',
    clinicalEffect: 'Системная антиоксидантная защита, кардиопротекция, нейропротекция',
    bestForm: 'Флавоноиды 500 мг 2x/д',
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
    synergies: [
        {with: "vitamin_c", effect: "Антиоксидант", mechanism: "Оба — антиоксиданты", severity: "LOW"},
        {with: "curcumin", effect: "Противораковая защита", mechanism: "Оба подавляют пролиферацию", severity: "LOW"},
      ],
    conflicts: [
        {with: "pharma", effect: "Теоретическое усиление антикоагуляции", mechanism: "Эллаговая кислота влияет на каскад свёртывания", severity: "LOW"},
        {with: "pharma", effect: "Взаимодействие с CYP-субстратами", mechanism: "Модуляция CYP450", severity: "LOW"},
      ],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 250, timing: 'с едой 1x/д', form: 'эллаговая кислота 250 мг' },
    bestForCourse: false,
    targetOrgan: 'Печень, кожа, толстый кишечник',
    organMechanism: 'Антиоксидантная защита, метаболизм эллаготанинов',
    mechanismOfAction: 'Метаболизм кишечной микробиотой в уролитины (уролитин A); ингибирование NF-κB; модуляция апоптоза через каспазы; снижение окислительного стресса в гепатоцитах',
    clinicalEffect: 'Антиоксидантная защита, модуляция апоптоза, здоровье кожи и ЖКТ',
    bestForm: 'Эллаговая кислота 250 мг 2x/д',
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
    synergies: [
        {with: "creatine", effect: "Анаболическая поддержка", mechanism: "Урсоловая кислота + mTOR", severity: "MEDIUM"},
        {with: "curcumin", effect: "Противовоспалительное", mechanism: "Оба подавляют NF-kB", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Потенцирование миорелаксантов", mechanism: "Урсоловая кислота влияет на ионные каналы мышц", severity: "MEDIUM"},
        {with: "pharma", effect: "Аддитивное снижение АД", mechanism: "Урсоловая кислота стимулирует NO", severity: "LOW"},
        {with: "pharma", effect: "Теоретическое усиление антикоагуляции", mechanism: "Влияние на факторы свёртывания", severity: "LOW"},
      ],
    monitoring: [
      { what: 'КФК', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 150, timing: 'с едой 2x/д', form: 'урсоловая кислота 150 мг' },
    bestForCourse: false,
    targetOrgan: 'Мышцы, кожа, печень',
    organMechanism: 'Анаболический сигналинг, ингибирование миостатина',
    mechanismOfAction: 'Ингибиция убиквитинлигазы (атрогин-1/MuRF1) → снижение протеасомной деградации; ингибирование миостатина; активация Akt/mTORC1; снижение кортизола; противовоспалительное через NF-κB',
    clinicalEffect: 'Снижение мышечного катаболизма, противовоспалительное, защита печени',
    bestForm: 'Урсоловая кислота 500 мг 2x/д',
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
    synergies: [
        {with: "theanine", effect: "Расслабление", mechanism: "Оба усиливают GABA", severity: "MEDIUM"},
        {with: "magnesium", effect: "Улучшение сна", mechanism: "Оба — расслабление", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Усиление седации", mechanism: "Магнолол потенцирует седативные", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Седативные препараты (усиление)'],
    sideEffects: ['Сонливость при начале'],
    dosage: { mg: 200, timing: 'на ночь 1x/д', form: 'экстракт магнолии 200 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, нервная система, ЖКТ',
    organMechanism: 'Анксиолитический, антивоспалительный, ГАМК-модуляция',
    mechanismOfAction: 'Модуляция GABA-A-рецепторов (магнолол, хонокиол); ингибирование NF-κB и COX-2; ингибирование 11β-HSD (снижение кортизола); антиоксидантная защита',
    clinicalEffect: 'Снижение тревожности и стресса, противовоспалительное, улучшение сна',
    bestForm: 'Магнолия кора 250 мг 2x/д',
  },
gentian: {
    id: 'gentian',
    name: 'Gentian',
    nameRu: 'Горечавка',
    tier: 'standard',
    category: ['gut', 'hepatoprotector'],
    forms: [
      { id: 'gentian', name: 'Gentian', nameRu: 'Экстракт горечавки 250 мг', dose: '250 мг 2x/д', best: true }
    ],
    organs: ['LIVER', 'GUT', 'STOMACH'],
    systems: ['hepatic', 'gastrointestinal'],
    mechanisms: ['DIGESTION_STIMULATION', 'BILE_SECRETION', 'APPETITE_IMPROVEMENT', 'LIVER_PROTECTION'],
    description: 'Горечавка — горький тоник, стимулирует пищеварение и желчеотток. Улучшает аппетит и усвоение на курсе.',
    synergies: [
        {with: "digestive_enzymes", effect: "Улучшение пищеварения", mechanism: "Горечи стимулируют секрецию", severity: "MEDIUM"},
        {with: "artichoke", effect: "Желчеотток", mechanism: "Оба стимулируют желчеотделение", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Потенцирование гипогликемии", mechanism: "Горькие гликозиды модулируют инсулин", severity: "MEDIUM"},
        {with: "pharma", effect: "Аддитивный эффект с гипотензивными", mechanism: "Расширение сосудов", severity: "LOW"},
        {with: "pharma", effect: "Снижение абсорбции лекарств", mechanism: "Усиление перистальтики", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Пищеварение', when: 'Субъективно' }
    ],
    contraindications: ['Язвенная болезнь'],
    sideEffects: ['Редко: изжога при избытке'],
    dosage: { mg: 250, timing: 'за 15 мин до еды', form: 'экстракт горечавки 250 мг' },
    bestForCourse: false,
    targetOrgan: 'Желудок, печень, желчный пузырь',
    organMechanism: 'Горечь-рефлекс, стимуляция пищеварения, желчегонное',
    mechanismOfAction: 'Стимуляция горьких рецепторов T2R на языке → увеличение секреции соляной кислоты; ингибирование 5-HT3 рецепторов (противорвотное); стимуляция продукции желчи через холецистокинин',
    clinicalEffect: 'Улучшение пищеварения, стимуляция аппетита, желчегонное действие',
    bestForm: 'Горечавка корень 500 мг до еды',
  },
artichoke: {
    id: 'artichoke',
    name: 'Artichoke',
    nameRu: 'Артишок',
    tier: 'standard',
    category: ['hepatoprotector', 'gut'],
    forms: [
      { id: 'artichoke', name: 'Artichoke', nameRu: 'Экстракт артишока 500 мг', dose: '500 мг 2x/д', best: true },
      { id: 'artichoke_2', name: 'Artichoke', nameRu: 'Артишок + Расторопша комплекс', dose: '500 мг', best: false }
    ],
    organs: ['LIVER', 'GALLBLADDER', 'GUT'],
    systems: ['hepatic', 'gastrointestinal'],
    mechanisms: ['BILE_SECRETION', 'LIVER_PROTECTION', 'CHOLESTEROL_LOWERING', 'DETOXIFICATION'],
    description: 'Артишок — гепатопротектор и холеретик, стимулирует желчеотток и защищает печень. На курсе — защита печени.',
    synergies: [
      { with: "milk_thistle", effect: "Артишок + Расторопша — двойная гепатопротекция", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Аддитивное снижение холестерина со статинами", mechanism: "Артишок снижает синтез холестерина", severity: "MEDIUM"},
        {with: "pharma", effect: "Снижение абсорбции при приёме с антацидами", mechanism: "Изменение pH желчи", severity: "LOW"},
        {with: "pharma", effect: "Теоретическое усиление антикоагуляции", mechanism: "Влияние на витамин K", severity: "LOW"},
      ],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Желчнокаменная болезнь'],
    sideEffects: ['Редко: метеоризм'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт артишока 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Печень, желчный пузырь, кишечник',
    organMechanism: 'Желчегонное, гепатопротекция, снижение холестерина',
    mechanismOfAction: 'Стимуляция синтеза и оттока желчи (цинарин); ингибирование HMG-CoA редуктазы (холестерин); индукция фазы II детоксикации через NRF2; защита гепатоцитов от окислительного стресса',
    clinicalEffect: 'Желчегонное действие, снижение холестерина, гепатопротекция',
    bestForm: 'Артишок экстракт 500 мг 2x/д',
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
    organs: ['HEART', 'VESSELS', 'IMMUNE_SYSTEM'],
    systems: ['cardio', 'immune'],
    mechanisms: ['CHOLESTEROL_LOWERING', 'ANTI_INFLAMMATORY', 'ANTIMICROBIAL', 'BLOOD_PRESSURE_REGULATION'],
    description: 'Чеснок (аллицин) — кардиопротектор, снижает холестерин и АД, антимикробное действие. На курсе — сосуды и иммунитет.',
    synergies: [
        {with: "vitamin_c", effect: "Иммунитет", mechanism: "Аллицин + C", severity: "MEDIUM"},
        {with: "omega3", effect: "Кардиопротекция", mechanism: "Оба снижают холестерин", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Чеснок потенцирует антикоагулянты", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Запах изо рта', 'Желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 1x/д', form: 'чесночный экстракт 1000 мг' },
    bestForCourse: false,
    targetOrgan: 'Сердце, сосуды, кровь, иммунная система',
    organMechanism: 'Снижение холестерина, антиагрегантное, гипотензивное',
    mechanismOfAction: 'Сульфиды (аллицин) ингибируют HMG-CoA редуктазу и АПФ; NO-опосредованная вазодилатация; антиагрегантный эффект через тромбоксан A2; антимикробное действие через аллицин',
    clinicalEffect: 'Снижение холестерина и АД, антиагрегантный эффект, антимикробная защита',
    bestForm: 'Чеснок экстракт 500 мг 2x/д',
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
    synergies: [
        {with: "curcumin", effect: "Противовоспалительное", mechanism: "Оба подавляют NF-kB и COX-2", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Ксантоны снижают агрегацию тромбоцитов", severity: "LOW"},
        {with: "pharma", effect: "Потенцирование гипогликемии", mechanism: "Альфа-мангостин повышает чувствительность к инсулину", severity: "LOW"},
        {with: "pharma", effect: "Взаимодействие с антигистаминными", mechanism: "Ксантоны влияют на гистаминовые рецепторы", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Окислительный стресс', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: аллергия'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'экстракт мангостина 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Желудочно-кишечный тракт, кожа, иммунная система',
    organMechanism: 'Антиоксидантная защита, противовоспалительный каскад',
    mechanismOfAction: 'Ингибирование COX-2 (мангостин); улавливание ROS и хелатирование металлов; ингибирование NF-κB; модуляция PI3K/Akt; антибактериальное действие через повреждение мембран',
    clinicalEffect: 'Противовоспалительное, антиоксидантное, антибактериальное, здоровье кожи',
    bestForm: 'Мангостин 500 мг 2x/д',
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
    organs: ['HEART', 'VESSELS', 'BRAIN'],
    systems: ['cardio'],
    mechanisms: ['FIBRINOLYSIS', 'BLOOD_THINNING', 'MICROCIRCULATION', 'THROMBUS_PREVENTION'],
    description: 'Наттокиназа — фермент из натто, растворяет фибрин и предотвращает тромбы. На курсе — защита сосудов.',
    synergies: [
        {with: "omega3", effect: "Антитромботическое", mechanism: "Оба снижают риск тромбов", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Риск кровотечения", mechanism: "Наттокиназа + антикоагулянты", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Фибриноген', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Приём антикоагулянтов', 'Язвенная болезнь'],
    sideEffects: ['Редко: кровотечение при высоких дозах'],
    dosage: { mg: 2000, timing: 'натощак 1x/д', form: 'наттокиназа 2000 FU' },
    bestForCourse: false,
    targetOrgan: 'Сердце, сосуды, кровь',
    organMechanism: 'Фибринолиз, антикоагуляция, снижение вязкости крови',
    mechanismOfAction: 'Прямой фибринолитический фермент (пламиноподобный); активация t-PA (тканевой активатор плазминогена); снижение PAI-1; ингибирование агрегации тромбоцитов; растворение фибрина',
    clinicalEffect: 'Профилактика тромбоза, улучшение микроциркуляции, снижение вязкости крови',
    bestForm: 'Наттокиназа 2000 FU 2x/д',
  },
grapefruit_seed: {
    id: 'grapefruit_seed',
    name: 'Grapefruit Seed',
    nameRu: 'Экстракт грейпфрутовых косточек',
    tier: 'standard',
    category: ['immunomodulator', 'gut'],
    forms: [
      { id: 'grapefruit_seed', name: 'Grapefruit Seed', nameRu: 'Экстракт грейпфрутовых косточек 250 мг', dose: '250 мг 2x/д', best: true }
    ],
    organs: ['GUT', 'IMMUNE_SYSTEM', 'SKIN'],
    systems: ['gastrointestinal', 'immune'],
    mechanisms: ['ANTIMICROBIAL', 'ANTI_INFLAMMATORY', 'IMMUNE_REGULATION', 'GUT_FLORA_BALANCE'],
    description: 'Экстракт грейпфрутовых косточек — мощный антимикробный агент, поддерживает микрофлору кишечника и иммунитет.',
    synergies: [
        {with: "probiotics", effect: "Антимикробное + пробиотическое", mechanism: "Экстракт грейпфрута — антимикробное", severity: "LOW"},
      ],
    conflicts: [
        {with: "pharma", effect: "Ингибирование CYP3A4", mechanism: "Бергамоттин ингибирует CYP3A4", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Микрофлора', when: 'Субъективно' }
    ],
    contraindications: ['Приём иммуносупрессоров'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 250, timing: 'с едой 2x/д', form: 'экстракт грейпфрутовых косточек 250 мг' },
    bestForCourse: false,
    targetOrgan: 'Желудочно-кишечный тракт, кишечник',
    organMechanism: 'Антимикробное, противогрибковое, пребиотическое',
    mechanismOfAction: 'Полифенолы (нарингенин) повреждают клеточные мембраны бактерий/грибов; хелатирование металлов; ингибирование роста Candida и H. pylori; поддержка баланса микробиоты',
    clinicalEffect: 'Антимикробное и противогрибковое действие, поддержка ЖКТ',
    bestForm: 'Экстракт грейпфрутовых косточек 500 мг 2x/д',
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
    synergies: [
        {with: "curcumin", effect: "Противовоспалительное", mechanism: "Оба — флавоноиды", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Ингибирование CYP3A4", mechanism: "Нобилетин модулирует CYP3A4", severity: "MEDIUM"},
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Нобилетин снижает агрегацию тромбоцитов", severity: "LOW"},
        {with: "pharma", effect: "Аддитивный эффект со статинами", mechanism: "Влияние на липидный обмен", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 100, timing: 'с едой 1x/д', form: 'нобилетин 100 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, печень, сердце',
    organMechanism: 'AMPK-активация, нейропротекция, метаболическая регуляция',
    mechanismOfAction: 'Активация AMPK; ингибирование воспаления через NF-κB и MAPK; снижение β-амилоида; модуляция PPAR-γ; повышение чувствительности к инсулину; нейрогенез через BDNF',
    clinicalEffect: 'Нейропротекция, улучшение метаболизма, снижение β-амилоида, AMPK-активация',
    bestForm: 'Нобилетин 100 мг 2x/д',
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
    synergies: [
        {with: "quercetin", effect: "Сенолитическая активность", mechanism: "Оба удаляют стареющие клетки", severity: "HIGH"},
        {with: "curcumin", effect: "Антиоксидантная защита", mechanism: "Оба подавляют воспаление", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Потенцирование химиотерапии", mechanism: "Физетин — сенолитик, может влиять на цитостатики", severity: "MEDIUM"},
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Физетин снижает агрегацию тромбоцитов", severity: "LOW"},
        {with: "pharma", effect: "Потенцирование гипогликемии", mechanism: "Физетин повышает инсулиновую чувствительность", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Окислительный стресс', when: 'Субъективно' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 100, timing: 'с едой 2x/д', form: 'физетин 100 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, нервная система, сосуды',
    organMechanism: 'Сенолитик, антиоксидант, NRF2-активация',
    mechanismOfAction: 'Сенолитическое действие через ингибирование Bcl-2/Bcl-xL; активация NRF2 и HO-1; ингибирование NF-κB; модуляция AMPK/SIRT1; улавливание ROS и хелатирование Fe',
    clinicalEffect: 'Сенолитический эффект, нейропротекция, противовоспалительное, антивозрастное',
    bestForm: 'Физетин 100 мг 2x/д',
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
    synergies: [
        {with: "curcumin", effect: "Противовоспалительное", mechanism: "Оба подавляют NF-kB и COX-2", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Потенцирование бензодиазепинов", mechanism: "Байкалин модулирует GABA-рецепторы", severity: "MEDIUM"},
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Байкалин ингибирует фактор Xa", severity: "MEDIUM"},
        {with: "pharma", effect: "Взаимодействие с CYP-субстратами", mechanism: "Модуляция CYP450 изоформ", severity: "LOW"},
      ],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Седативные препараты (усиление)'],
    sideEffects: ['Сонливость при начале'],
    dosage: { mg: 200, timing: 'с едой 2x/д', form: 'байкалин 200 мг' },
    bestForCourse: false,
    targetOrgan: 'Печень, головной мозг, лёгкие',
    organMechanism: 'Противовоспалительное, антиоксидантное, нейропротективное',
    mechanismOfAction: 'Ингибирование TLR-4/NF-κB и MAPK; активация NRF2/HO-1; модуляция GABA-A рецепторов (анксиолитик); антивирусное через ингибирование репликации РНК; улавливание ROS',
    clinicalEffect: 'Противовоспалительное, гепатопротекторное, нейропротективное, анксиолитическое',
    bestForm: 'Байкалин 250 мг 2x/д',
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
    organs: ['HEART', 'LIVER', 'VESSELS'],
    systems: ['cardio', 'hepatic'],
    mechanisms: ['ANTIOXIDANT', 'ANTI_INFLAMMATORY', 'VASCULAR_PROTECTION', 'MITOCHONDRIAL_PROTECTION'],
    description: 'Таксифолин (дигидрокверцетин) — флавоноид из лиственницы, мощный антиоксидент. Защищает сосуды и митохондрии.',
    synergies: [
        {with: "vitamin_c", effect: "Антиоксидантная сеть", mechanism: "Оба — флавоноиды", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Таксифолин ингибирует тромбин", severity: "MEDIUM"},
        {with: "pharma", effect: "Потенцирование гипогликемии", mechanism: "Таксифолин повышает захват глюкозы", severity: "LOW"},
        {with: "pharma", effect: "Ингибирование CYP3A4", mechanism: "Таксифолин влияет на CYP3A4", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: аллергия'],
    dosage: { mg: 100, timing: 'с едой 1x/д', form: 'таксифолин 100 мг' },
    bestForCourse: false,
    targetOrgan: 'Печень, сосуды, головной мозг',
    organMechanism: 'Антиоксидантная защита, стабилизация коллагена и эластина',
    mechanismOfAction: 'Повышение активности SOD и глутатионпероксидазы; ингибирование гиалуронидазы и эластазы; стабилизация капилляров; хелатирование Fe; uлавливание пероксинитрита; модуляция AP-1',
    clinicalEffect: 'Антиоксидантная защита, венопротекция, стабилизация соединительной ткани',
    bestForm: 'Таксифолин (дигидрокверцетин) 100 мг 2x/д',
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
      { with: "holy_basil", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "tamoxifen", effect: "Антагонизм", mechanism: "Изофлавоны могут мешать антиэстрогенной терапии", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Эстрадиол', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Эстроген-зависимые опухоли'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 100, timing: 'с едой 1x/д', form: 'соевые изофлавоны 100 мг' },
    bestForCourse: false,
    targetOrgan: 'Репродуктивная система, кости, сердце',
    organMechanism: 'Фитозстрогенный сигналинг, костный метаболизм',
    mechanismOfAction: 'Селективный агонизм ERβ (генистеин, дайдзеин); ингибирование тирозинкиназы; стимуляция остеобластов через BMP-2; модуляция апоптоза; антиоксидантная защита',
    clinicalEffect: 'Потенциальная эстрогенная модуляция, поддержка костей, кардиопротекция',
    bestForm: 'Соевые изофлавоны 50 мг 2x/д',
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
    synergies: [
        {with: "curcumin", effect: "Нейропротекция", mechanism: "Карнозная кислота + куркумин", severity: "MEDIUM"},
        {with: "omega3", effect: "Защита ЖК от окисления", mechanism: "Розмарин защищает ЖК", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Карнозиновая кислота снижает агрегацию", severity: "LOW"},
        {with: "pharma", effect: "Аддитивное снижение АД", mechanism: "Розмарин стимулирует NO", severity: "LOW"},
        {with: "pharma", effect: "Потеря калия с диуретиками", mechanism: "Розмарин обладает мягким диуретическим эффектом", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: аллергия'],
    dosage: { mg: 200, timing: 'с едой 1x/д', form: 'экстракт розмарина 200 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, печень, кожа',
    organMechanism: 'Антиоксидантная защита, когнитивная поддержка, противовоспалительное',
    mechanismOfAction: 'Карнозоловая и розмариновая кислоты: ингибирование COX-2 и 5-LOX; активация NRF2; ингибирование ацетилхолинэстеразы; улавливание ROS; антимикробное действие через терпены',
    clinicalEffect: 'Улучшение памяти и когниции, гепатопротекция, антиоксидантная защита',
    bestForm: 'Розмарин экстракт 500 мг 2x/д',
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
    organs: ['PANCREAS', 'LIVER', 'VESSELS'],
    systems: ['metabolic', 'hepatic'],
    mechanisms: ['INSULIN_SENSITIVITY', 'GLUCOSE_LOWERING', 'ANTI_INFLAMMATORY', 'ANTIMICROBIAL'],
    description: 'Корица — улучшает чувствительность к инсулину и снижает глюкозу. На курсе — метаболическая поддержка.',
    synergies: [
      { with: "berberine", effect: "Корица + Берберин — инсулиновая чувствительность", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Риск гипогликемии с антидиабетиками", mechanism: "Корица потенцирует инсулин", severity: "HIGH"},
        {with: "pharma", effect: "Риск гепатотоксичности с кумарином", mechanism: "Кассия содержит кумарин", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Заболевания печени (кассия)'],
    sideEffects: ['Редко: аллергия', 'Раздражение слизистой'],
    dosage: { mg: 1000, timing: 'с едой 2x/д', form: 'корица экстракт 1000 мг' },
    bestForCourse: false,
    targetOrgan: 'Печень, поджелудочная железа, мышцы',
    organMechanism: 'Инсулиновая чувствительность, снижение глюкозы, антиоксидант',
    mechanismOfAction: 'Активация IRS-1/PI3K/Akt; ингибирование тирозинфосфатазы PTP1B; ингибирование альдозоредуктазы; модуляция AMPK; снижение гликирования через ингибирование AGE',
    clinicalEffect: 'Снижение глюкозы и HOMA-IR, улучшение чувствительности к инсулину',
    bestForm: 'Корица экстракт 500 мг 2x/д',
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
    organs: ['HEART', 'VESSELS', 'REPRODUCTIVE'],
    systems: ['cardio', 'reproductive'],
    mechanisms: ['ANTIOXIDANT', 'NITRIC_OXIDE_PRODUCTION', 'PROSTATE_PROTECTION', 'ANTI_INFLAMMATORY'],
    description: 'Гранат — богат эллаготаннинами, улучшает NO-продукцию и защищает простату. Кардиопротекция на курсе.',
    synergies: [
        {with: "vitamin_c", effect: "Антиоксидант", mechanism: "Эллаговая кислота + C", severity: "MEDIUM"},
        {with: "curcumin", effect: "Противовоспалительное", mechanism: "Оба подавляют NF-kB", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Ингибирование CYP3A4 (аналогично грейпфруту)", mechanism: "Гранатовый сок ингибирует CYP3A4", severity: "MEDIUM"},
        {with: "pharma", effect: "Аддитивное снижение АД", mechanism: "Гранатовый сок стимулирует NO", severity: "MEDIUM"},
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Эллаготаннины снижают агрегацию", severity: "LOW"},
      ],
    monitoring: [
      { what: 'ПСА', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Аллергия на рыбу', 'Приём антикоагулянтов'],
    sideEffects: ['Редко: аллергия'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'экстракт граната 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Сердце, сосуды, простата, кишечник',
    organMechanism: 'Антиоксидантная защита, эллаготанины, NO-сигналинг',
    mechanismOfAction: 'Метаболизм эллаготанинов в уролитин A; активация eNOS и NO; ингибирование АПФ; ингибирование 5α-редуктазы; модуляция NF-κB; пребиотический эффект',
    clinicalEffect: 'Кардиопротекция, защита простаты, улучшение эндотелиальной функции',
    bestForm: 'Гранат экстракт 500 мг 2x/д',
  },
cranberry: {
    id: 'cranberry',
    name: 'Cranberry',
    nameRu: 'Клюква (проантоцианидины)',
    tier: 'standard',
    category: ['antioxidant', 'urinary_protector'],
    forms: [
      { id: 'cranberry', name: 'Cranberry', nameRu: 'Клюква (проантоцианидины)', dose: '500 мг 2x/д', best: true },
      { id: 'cranberry_2', name: 'Cranberry', nameRu: 'Клюква + D-манноза комплекс', dose: '500 мг', best: false }
    ],
    organs: ['KIDNEYS', 'HEART', 'GUT'],
    systems: ['renal', 'cardio'],
    mechanisms: ['UTI_PREVENTION', 'ANTIOXIDANT', 'ANTI_INFLAMMATORY', 'MICROCIRCULATION'],
    description: 'Клюква — проантоцианидины предотвращают ИМП, антиоксидантная и противовоспалительная защита. На курсе — почки и МП.',
    synergies: [
      { with: "cranberry", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "probiotics", effect: "Клюква + Пробиотики — МП защита", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Клюква + варфарин", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Общий анализ мочи', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Оксалатные камни (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт клюквы 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Мочевыводящие пути, почки, желудок',
    organMechanism: 'Урологическая защита, антиадгезивный эффект',
    mechanismOfAction: 'Ингибирование P-фимбрий E. coli (проантоцианидины A-типа); снижение бактериальной адгезии к уротелию; подкисление мочи; антиоксидантная защита через антоцианы',
    clinicalEffect: 'Профилактика ИМП, защита мочевыводящих путей, антиоксидантная защита',
    bestForm: 'Клюква экстракт 500 мг 2x/д',
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
    synergies: [
        {with: "nmn", effect: "Митофагия + NAD+", mechanism: "Уролитин A — митофагия, NMN — NAD+", severity: "HIGH"},
        {with: "coq10", effect: "Митохондриальная функция", mechanism: "Оба поддерживают митохондрии", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Снижение эффективности антибиотиков", mechanism: "Антибиотики нарушают микробиом, необходимый для конверсии в уролитин А", severity: "MEDIUM"},
        {with: "pharma", effect: "Взаимодействие с CYP-субстратами", mechanism: "Уролитин А влияет на CYP450", severity: "LOW"},
      ],
    monitoring: [
      { what: 'КФК', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'уролитин А 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Митохондрии, мышцы, кишечник',
    organMechanism: 'Митофагия, митохондриальный биогенез, антивозрастной',
    mechanismOfAction: 'Индукция митофагии через PINK1/Parkin-зависимый путь; активация AMPK; ингибирование NF-κB; улучшение функции митохондрий в мышцах; модуляция микробиоты',
    clinicalEffect: 'Улучшение функции митохондрий, мышечной силы и выносливости, замедление старения',
    bestForm: 'Уролитин A 500 мг 2x/д',
  },
bile_acids: {
    id: 'bile_acids',
    name: 'Bile Acids',
    nameRu: 'Жёлчные кислоты (урсодезоксихолевая)',
    tier: 'standard',
    category: ['hepatoprotector', 'gut'],
    forms: [
      { id: 'bile_acids', name: 'Bile Acids', nameRu: 'УДХК 250 мг', dose: '250 мг 2x/д', best: true },
      { id: 'bile_acids_2', name: 'Bile Acids', nameRu: 'УДХК 500 мг', dose: '250 мг', best: false }
    ],
    organs: ['LIVER', 'GALLBLADDER', 'GUT'],
    systems: ['hepatic', 'gastrointestinal'],
    mechanisms: ['BILE_FLOW_STIMULATION', 'CHOLESTEROL_SOLUBILIZATION', 'LIVER_PROTECTION', 'GALLSTONE_PREVENTION'],
    description: 'Жёлчные кислоты (УДХК) — стимулируют желчеотток, растворяют камни, защищают печень. На курсе — гепатопротекция.',
    synergies: [
        {with: "tudca", effect: "Желчеотток", mechanism: "Оба — желчные кислоты", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Конкуренция с секвестрантами желчных кислот", mechanism: "Снижение абсорбции УДХК", severity: "MEDIUM"},
        {with: "pharma", effect: "Снижение всасывания жирорастворимых витаминов", mechanism: "Изменение мицеллообразования", severity: "MEDIUM"},
        {with: "pharma", effect: "Снижение абсорбции при антацидах", mechanism: "Изменение pH кишечника", severity: "LOW"},
      ],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Желчнокаменная болезнь (острая)'],
    sideEffects: ['Диарея при начале'],
    dosage: { mg: 250, timing: 'с едой 2x/д', form: 'урсодезоксихолевая кислота 250 мг' },
    bestForCourse: false,
    targetOrgan: 'Печень, желчный пузырь, кишечник',
    organMechanism: 'Эмульгация жиров, регуляция холестерина, сигналинг FXR',
    mechanismOfAction: 'Мощные детергенты — эмульгация триглицеридов; активация ядерного рецептора FXR; модуляция синтеза холестерина (CYP7A1); регуляция TGR5 (глюкозный метаболизм); антибактериальное действие в тонкой кишке',
    clinicalEffect: 'Эмульгация и усвоение жиров, регуляция холестерина, поддержка ЖКТ',
    bestForm: 'Желчные кислоты (таурин + холин) 500 мг 2x/д',
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
      { with: "caffeine", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Пирацетам снижает агрегацию тромбоцитов", severity: "LOW"},
        {with: "pharma", effect: "Перевозбуждение с кофеином и стимуляторами", mechanism: "Пирацетам + стимуляторы ЦНС", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Геморрагический инсульт (острый)'],
    sideEffects: ['Редко: возбуждение', 'Головная боль при начале'],
    dosage: { mg: 1600, timing: 'с едой 2x/д', form: 'пирацетам 800 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (кора, гиппокамп), нервная система, микроциркуляторное русло',
    organMechanism: 'Метаболизм нейронов, микроциркуляция мозга, синаптическая пластичность',
    mechanismOfAction: 'Модуляция AMPA-глутаматных рецепторов; увеличение плотности никотиновых ацетилхолиновых рецепторов; улучшение текучести мембран нейронов; повышение синтеза АТФ; снижение агрегации тромбоцитов; улучшение микроциркуляции в капиллярах мозга',
    clinicalEffect: 'Улучшение памяти, обучения и когнитивных функций, нейропротекция, улучшение мозгового кровотока',
    bestForm: 'Пирацетам 800 мг 2x/д',
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
    synergies: [
        {with: "citicoline", effect: "Холинэргическая синергия", mechanism: "Рацетам + холин", severity: "HIGH"},
        {with: "alpha_gpc", effect: "Фокус и память", mechanism: "Анирацетам + холин", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Усиление тревожности с кофеином", mechanism: "Анирацетам + стимуляторы = перевозбуждение", severity: "MEDIUM"},
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Анирацетам снижает агрегацию тромбоцитов", severity: "LOW"},
        {with: "pharma", effect: "Антагонизм с иммуносупрессорами", mechanism: "Рацетамы модулируют иммунный ответ", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Тяжёлая печёночная недостаточность'],
    sideEffects: ['Редко: головная боль'],
    dosage: { mg: 750, timing: 'с едой 2x/д', form: 'анирацетам 750 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (кора, гиппокамп), нервная система',
    organMechanism: 'Холинергическая и глутаматергическая нейротрансмиссия, креативность и настроение',
    mechanismOfAction: 'Модуляция AMPA-рецепторов; повышение плотности мускариновых (M1) ацетилхолиновых рецепторов; модуляция дофаминовых и серотониновых рецепторов; увеличение синтеза белка в нейронах; улучшение межполушарной синхронизации',
    clinicalEffect: 'Улучшение памяти, креативности и вербальной беглости, снижение тревожности',
    bestForm: 'Анирацетам 750 мг 2x/д',
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
    synergies: [
        {with: "citicoline", effect: "Когнитивная функция", mechanism: "Рацетам + холин", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Перевозбуждение со стимуляторами", mechanism: "Оксирацетам + стимуляторы ЦНС", severity: "MEDIUM"},
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Оксирацетам влияет на микроциркуляцию", severity: "LOW"},
        {with: "pharma", effect: "Риск серотонинового синдрома с ИМАО", mechanism: "Потенцирование моноаминов", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: бессонница при вечернем приёме'],
    dosage: { mg: 800, timing: 'с едой 2x/д', form: 'оксирацетам 800 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (кора, гиппокамп), нервная система',
    organMechanism: 'Метаболизм нейронов, холинергическая передача, энергообеспечение мозга',
    mechanismOfAction: 'Увеличение плотности ацетилхолиновых рецепторов; модуляция NMDA- и AMPA-рецепторов; усиление метаболизма нейронов через повышение АТФ; улучшение синтеза фосфолипидов мембран; повышение уровня норадреналина',
    clinicalEffect: 'Улучшение памяти, фокуса и когнитивных функций, повышение ментальной энергии',
    bestForm: 'Оксирацетам 800 мг с едой 2x/д',
  },
pramiracetam: {
    id: 'pramiracetam',
    name: 'Pramiracetam',
    nameRu: 'Прамирацетам',
    tier: 'advanced',
    category: ['nootropic', 'neuroprotector'],
    forms: [
      { id: 'pramiracetam', name: 'Pramiracetam', nameRu: 'Прамирацетам 400 мг', dose: '400 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['MEMORY_ENHANCEMENT', 'FOCUS_IMPROVEMENT', 'ACETYLCHOLINE_MODULATION', 'LEARNING_BOOST'],
    description: 'Прамирацетам — мощный ноотроп, в 10-30 раз сильнее пирацетама. Улучшает память и обучение на курсе.',
    synergies: [
        {with: "citicoline", effect: "Память и фокус", mechanism: "Самый мощный рацетам + холин", severity: "HIGH"},
      ],
    conflicts: [
        {with: "pharma", effect: "Перевозбуждение со стимуляторами", mechanism: "Прамирацетам мощный рацетам + кофеин/амфетамин", severity: "MEDIUM"},
        {with: "pharma", effect: "Риск перестимуляции с холинэргиками", mechanism: "Избыток ацетилхолина", severity: "MEDIUM"},
        {with: "pharma", effect: "Усиление антикоагуляции (теоретически)", mechanism: "Влияние на микроциркуляцию", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: головная боль', 'Раздражительность'],
    dosage: { mg: 400, timing: 'с едой 2x/д', form: 'прамирацетам 400 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (гиппокамп, кора), нервная система',
    organMechanism: 'Холинергическая нейротрансмиссия, метаболизм нейронов, синаптическая пластичность',
    mechanismOfAction: 'Увеличение плотности мускариновых (M1) и никотиновых ацетилхолиновых рецепторов; модуляция NMDA- и AMPA-рецепторов; усиление метаболизма нейронов (АТФ); улучшение межполушарной передачи',
    clinicalEffect: 'Улучшение памяти, фокуса и способности к обучению, когнитивное усиление',
    bestForm: 'Прамирацетам 400 мг 2x/д',
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
    synergies: [
        {with: "magnesium", effect: "GABA-B модуляция", mechanism: "Фасорацетам + GABA-B", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "alcohol", effect: "Снижение эффекта алкоголя (маскировка опьянения)", mechanism: "Фасорацетам модулирует GABA-B", severity: "MEDIUM"},
        {with: "pharma", effect: "Перекрёстная толерантность с GABA-ергиками", mechanism: "Длительный приём снижает чувствительность GABA-рецепторов", severity: "MEDIUM"},
        {with: "pharma", effect: "Взаимодействие с антидепрессантами", mechanism: "Модуляция глутаматной системы", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: головная боль'],
    dosage: { mg: 50, timing: 'натощак 2x/д', form: 'фасорацетам 50 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (кора, гиппокамп), надпочечники, нервная система',
    organMechanism: 'Глутаматергическая нейротрансмиссия, ГАМК-ергическая модуляция, восстановление коры надпочечников',
    mechanismOfAction: 'Модуляция AMPA- и каинатных глутаматных рецепторов; активация GABA-B рецепторов; повышение экспрессии глутаматдекарбоксилазы (GAD); снижение кортизола через регуляцию оси ГГНС; увеличение α2-адренорецепторов',
    clinicalEffect: 'Снижение тревожности, улучшение памяти и когниции, восстановление надпочечников, антистресс',
    bestForm: 'Фасорацетам 50 мг 2x/д',
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
    synergies: [
        {with: "citicoline", effect: "Холинэргическая синергия", mechanism: "Колурацетам + захват холина", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Перестимуляция с холинэргиками", mechanism: "Колурацетам усиливает захват холина + холина источники", severity: "MEDIUM"},
        {with: "pharma", effect: "Усиление антикоагуляции (теоретически)", mechanism: "Влияние на микроциркуляцию", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: головная боль'],
    dosage: { mg: 20, timing: 'натощак 2x/д', form: 'колурацетам 20 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (холинергические нейроны), сетчатка глаза, нервная система',
    organMechanism: 'Высокоаффинный захват холина, холинергическая передача, нейропротекция',
    mechanismOfAction: 'Усиление высокоаффинного захвата холина (CHT1); повышение синтеза ацетилхолина в холинергических нейронах; улучшение холинергической передачи; защита нейронов сетчатки',
    clinicalEffect: 'Улучшение памяти, внимания и зрения, нейропротекция',
    bestForm: 'Колурацетам 20 мг 2x/д',
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
      { with: "citicoline", effect: "Ноопепт + Цитиколин — BDNF + ацетилхолин", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Потенциальное взаимодействие с ИМАО", mechanism: "Ноопепт метаболизируется через пролин-эндопептидазу", severity: "LOW"},
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Ноопепт влияет на микроциркуляцию", severity: "LOW"},
        {with: "pharma", effect: "Потенцирование гипогликемии", mechanism: "Ноопепт модулирует инсулиновую чувствительность", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Беременность', 'Эпилепсия'],
    sideEffects: ['Редко: раздражительность'],
    dosage: { mg: 10, timing: 'с едой 2x/д', form: 'ноопепт 10 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (гиппокамп, кора), нервная система',
    organMechanism: 'Нейрогенез, синаптическая пластичность, нейропротекция',
    mechanismOfAction: 'Повышение экспрессии BDNF и NGF; активация TrkB рецепторов; модуляция AMPA-глутаматных рецепторов; ингибирование пролиновой эндопептидазы (PEP); антиоксидантная защита через NRF2',
    clinicalEffect: 'Улучшение памяти и когнитивных функций, стимуляция нейрогенеза, нейропротекция',
    bestForm: 'Ноопепт 10 мг с едой 2x/д',
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
      { with: "alpha_gpc", effect: "Цитиколин + Альфа-ГФХ — двойной источник холина", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "noopept", effect: "Ноопепт + Цитиколин — BDNF + ацетилхолин", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Взаимодействие с ИМАО", mechanism: "Цитиколин увеличивает уровень дофамина и норадреналина", severity: "MEDIUM"},
        {with: "pharma", effect: "Перестимуляция с холинэргиками", mechanism: "Избыток ацетилхолина", severity: "LOW"},
        {with: "pharma", effect: "Усиление антикоагуляции (теоретически)", mechanism: "Цитиколин влияет на синтез фосфолипидов мембран", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: головная боль при начале'],
    dosage: { mg: 250, timing: 'с едой 2x/д', form: 'цитиколин 250 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (нейроны, глия), нервная система, гепатоциты',
    organMechanism: 'Синтез фосфолипидов мембран, холинергическая передача, репарация нейрональных мембран',
    mechanismOfAction: 'Экзогенный источник ЦДФ-холина; синтез фосфатидилхолина (мембранный фосфолипид); увеличение синтеза ацетилхолина; репарация нейрональных мембран; повышение уровня норадреналина и дофамина',
    clinicalEffect: 'Нейропротекция, улучшение памяти и когниции, репарация нейрональных мембран',
    bestForm: 'Цитиколин 250 мг с едой 2x/д',
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
      { with: "citicoline", effect: "Цитиколин + Альфа-ГФХ — двойной источник холина", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Взаимодействие с ИМАО", mechanism: "Альфа-ГФХ увеличивает ацетилхолин и дофамин", severity: "MEDIUM"},
        {with: "pharma", effect: "Антагонизм с антихолинэргиками", mechanism: "Альфа-ГФХ — холинэргик, антихолинэргики блокируют эффект", severity: "MEDIUM"},
        {with: "pharma", effect: "Теоретическое влияние на инсулин", mechanism: "Холин влияет на метаболизм гомоцистеина", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: головная боль при начале'],
    dosage: { mg: 300, timing: 'с едой 2x/д', form: 'Альфа-ГФХ 300 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (холинергические синапсы), нервная система, скелетные мышцы',
    organMechanism: 'Синтез ацетилхолина, нейромышечная передача, фосфолипидный синтез мембран',
    mechanismOfAction: 'Поставка холина для синтеза ацетилхолина (ChAT); преодоление ГЭБ в неизменённом виде; увеличение выброса ацетилхолина в синапсах; стимуляция синтеза фосфолипидов мембран; повышение GH через холинергические механизмы',
    clinicalEffect: 'Улучшение памяти и когниции, повышение силового выхода, нейропротекция',
    bestForm: 'Альфа-ГФХ 300 мг 2x/д',
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
    organs: ['BRAIN', 'VESSELS', 'HEART'],
    systems: ['neuro', 'cardio'],
    mechanisms: ['CEREBRAL_BLOOD_FLOW', 'MEMORY_ENHANCEMENT', 'NEUROPROTECTION', 'ANTIOXIDANT'],
    description: 'Винпоцетин — улучшает мозговой кровоток и память. Нейропротектор с сосудорасширяющим действием.',
    synergies: [
      { with: "ginkgo", effect: "Винпоцетин + Гинкго — мозговой кровоток", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Риск кровотечения", mechanism: "Винпоцетин + антикоагулянты", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Редко: головная боль'],
    dosage: { mg: 10, timing: 'с едой 2x/д', form: 'винпоцетин 10 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (сосуды), эндотелий сосудов, миокард',
    organMechanism: 'Церебральный кровоток, эндотелиальная функция, метаболизм нейронов',
    mechanismOfAction: 'Ингибирование ФДЭ1 (фосфодиэстеразы типа 1); блокада натриевых каналов; ингибирование NMDA-рецепторов; активация кальций/кальмодулин-зависимой протеинкиназы; улучшение утилизации глюкозы и кислорода нейронами; вазодилатация через NO',
    clinicalEffect: 'Улучшение мозгового кровообращения, памяти и когнитивных функций, нейропротекция',
    bestForm: 'Винпоцетин 10 мг с едой 2x/д',
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
    synergies: [
        {with: "l_tyrosine", effect: "Бодрость и фокус", mechanism: "Модафинил + тирозин — дофамин", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Повышение давления", mechanism: "Модафинил может повышать АД", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Аритмия', 'Гипертония (тяжёлая)'],
    sideEffects: ['Бессонница при вечернем приёме', 'Головная боль'],
    dosage: { mg: 100, timing: 'утром 1x/д', form: 'модафинил 100 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (гипоталамус, префронтальная кора), нервная система',
    organMechanism: 'Регуляция цикла сон-бодрствование, дофаминергическая нейротрансмиссия, орексиновая сигнализация',
    mechanismOfAction: 'Ингибирование DAT (дофаминовый транспортер); повышение уровня дофамина, норадреналина и серотонина; модуляция орексиновых нейронов гипоталамуса; активация гистаминовых нейронов (H1); подавление GABA-ергических нейронов',
    clinicalEffect: 'Повышение бодрствования и фокуса, снижение утомляемости, улучшение когнитивных функций',
    bestForm: 'Модафинил 100 мг утром 1x/д',
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
    synergies: [
        {with: "l_tyrosine", effect: "Дофаминергическая синергия", mechanism: "Селегилин ингибирует MAO-B", severity: "HIGH"},
      ],
    conflicts: [
        {with: "pharma", effect: "Серотониновый синдром", mechanism: "Двойное ингибирование MAO", severity: "HIGH"},
        {with: "pharma", effect: "Серотониновый синдром", mechanism: "Селегилин + СИОЗС", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Дофамин', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Приём СИОЗС (серотониновый синдром)'],
    sideEffects: ['Бессонница при вечернем приёме'],
    dosage: { mg: 5, timing: 'утром 1x/д', form: 'селегилин 5 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (базальные ганглии, кора), нервная система',
    organMechanism: 'Метаболизм дофамина, моноаминовая регуляция, антиоксидантная защита',
    mechanismOfAction: 'Необратимое ингибирование МАО-Б; повышение уровня дофамина в синаптической щели; снижение продукции ROS при метаболизме дофамина; активация антиоксидантных ферментов (SOD, каталаза); нейропротекция через ингибирование апоптоза',
    clinicalEffect: 'Сохранение дофамина, нейропротекция, анти-эйдж эффект, умеренный когнитивный стимулятор',
    bestForm: 'Селегилин 5 мг утром 1x/д',
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
    synergies: [
        {with: "magnesium", effect: "Нейропротекция", mechanism: "Оба блокируют NMDA", severity: "MEDIUM"},
        {with: "citicoline", effect: "Когнитивная функция", mechanism: "Мемантин + холин", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Антагонизм с NMDA-агонистами", mechanism: "Мемантин блокирует NMDA-рецепторы", severity: "HIGH"},
        {with: "pharma", effect: "Увеличение периода полувыведения с ощелачивателями мочи", mechanism: "pH-зависимая экскреция", severity: "MEDIUM"},
        {with: "pharma", effect: "Антагонизм с антихолинэргиками", mechanism: "Мемантин модулирует глутамат, антихолинэргики — ацетилхолин", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Тяжёлая почечная недостаточность'],
    sideEffects: ['Головокружение при начале'],
    dosage: { mg: 5, timing: 'с едой 1x/д', form: 'мемантин 5 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (гиппокамп, кора), нервная система',
    organMechanism: 'Глутаматергическая нейротрансмиссия, синаптическая пластичность, нейропротекция',
    mechanismOfAction: 'Необратимый антагонизм NMDA-рецепторов (глициновый сайт); снижение избыточного входа Ca2+ в нейроны; предотвращение эксайтотоксичности; модуляция AMPA-рецепторов; повышение BDNF и нейропластичности',
    clinicalEffect: 'Нейропротекция, сохранение памяти и когнитивных функций, предотвращение эксайтотоксичности',
    bestForm: 'Мемантин 5 мг с едой 1x/д',
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
    synergies: [
        {with: "l_tyrosine", effect: "Синтез дофамина", mechanism: "Бромантан усиливает дофамин", severity: "MEDIUM"},
        {with: "rhodiola", effect: "Адаптогенный эффект", mechanism: "Оба — актопротекторы", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Перевозбуждение со стимуляторами", mechanism: "Бромантан усиливает дофамин + стимуляторы", severity: "MEDIUM"},
        {with: "pharma", effect: "Взаимодействие с ИМАО", mechanism: "Бромантан модулирует моноаминовую систему", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: возбуждение при передозировке'],
    dosage: { mg: 50, timing: 'утром 1x/д', form: 'бромантан 50 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (стриатум, префронтальная кора), надпочечники, нервная система',
    organMechanism: 'Дофаминергическая нейротрансмиссия, адаптогенная регуляция оси ГГНС, антиоксидантная защита',
    mechanismOfAction: 'Увеличение экспрессии тирозингидроксилазы (TH) и синтеза дофамина; модуляция ГАМК-А рецепторов; снижение уровня кортизола; повышение активности супероксиддисмутазы (SOD) и каталазы; активация митохондриального дыхания',
    clinicalEffect: 'Повышение физической и умственной работоспособности, снижение утомляемости и тревожности, адаптогенный эффект',
    bestForm: 'Бромантан 50 мг утром 1x/д',
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
    synergies: [
        {with: "omega3", effect: "Нейропротекция", mechanism: "Оба поддерживают нейропластичность", severity: "LOW"},
      ],
    conflicts: [
        {with: "pharma", effect: "Серотониновый синдром", mechanism: "Тианептин + ИМАО = опасно", severity: "HIGH"},
        {with: "pharma", effect: "Серотониновый синдром", mechanism: "Тианептин + СИОЗС", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Настроение', when: 'Субъективно' }
    ],
    contraindications: ['Приём СИОЗС (серотониновый синдром)'],
    sideEffects: ['Редко: сухость во рту', 'Сонливость при начале'],
    dosage: { mg: 12.5, timing: 'утром 1x/д', form: 'тианептин 12.5 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (гиппокамп, префронтальная кора), нервная система',
    organMechanism: 'Нейрогенез в гиппокампе, синаптическая пластичность, нейропротекция',
    mechanismOfAction: 'Усиление обратного захвата серотонина (SERT); повышение BDNF и TrkB-сигнализации; модуляция глутаматной системы (NMDA и AMPA); нейропротекция через снижение эксайтотоксичности; активация нейрогенеза в гиппокампе',
    clinicalEffect: 'Улучшение настроения, снижение тревожности, нейропротекция, улучшение когнитивной гибкости',
    bestForm: 'Тианептин 12.5 мг 2x/д',
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
      { with: "phosphatidylcholine", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "stimulant_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Брадикардия', 'Астма'],
    sideEffects: ['Тошнота при высоких дозах'],
    dosage: { mg: 100, timing: 'с едой 1x/д', form: 'гуперзин А 100 мкг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (гиппокамп, кора), нервная система',
    organMechanism: 'Холинергическая нейротрансмиссия, синаптическая пластичность, нейропротекция',
    mechanismOfAction: 'Обратимое ингибирование ацетилхолинэстеразы (AChE); модуляция NMDA-рецепторов (антагонизм); повышение уровня ацетилхолина в синаптической щели; защита нейронов от эксайтотоксичности',
    clinicalEffect: 'Улучшение памяти и когнитивных функций, нейропротекция, замедление когнитивного старения',
    bestForm: 'Гуперзин А 100 мкг с едой 1x/д',
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
    synergies: [
        {with: "magnesium", effect: "Улучшение сна", mechanism: "Оба модулируют GABA", severity: "MEDIUM"},
        {with: "theanine", effect: "Расслабление", mechanism: "Оба — природные анксиолитики", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Усиление седации с бензодиазепинами", mechanism: "Апигенин модулирует GABA-рецепторы", severity: "MEDIUM"},
        {with: "pharma", effect: "Ингибирование CYP2C9", mechanism: "Апигенин влияет на метаболизм CYP2C9-субстратов", severity: "MEDIUM"},
        {with: "pharma", effect: "Усиление антикоагуляции", mechanism: "Апигенин снижает агрегацию тромбоцитов", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Приём седативных (потенцирование)'],
    sideEffects: ['Сонливость при начале'],
    dosage: { mg: 50, timing: 'на ночь 1x/д', form: 'апигенин 50 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, нервная система, клеточные мембраны',
    organMechanism: 'ГАМК-ергическая нейротрансмиссия, антиоксидантная защита, противовоспалительная сигнализация',
    mechanismOfAction: 'Модуляция ГАМК-А рецепторов (бензодиазепиновый сайт); ингибирование ЦОГ-2 и 5-ЛОГ; активация NRF2/ARE пути; ингибирование NF-κB; снижение продукции провоспалительных цитокинов',
    clinicalEffect: 'Анксиолиз, улучшение сна, снижение воспаления, антиоксидантная защита',
    bestForm: 'Апигенин 50 мг 2x/д',
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
    synergies: [
        {with: "magnesium", effect: "Анксиолитический эффект", mechanism: "Оба усиливают GABA", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Усиление седации", mechanism: "Мелисса потенцирует седативные", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Когнитивные тесты', when: 'Субъективно' }
    ],
    contraindications: ['Гипотиреоз (с осторожностью)'],
    sideEffects: ['Редко: сонливость'],
    dosage: { mg: 500, timing: 'на ночь 1x/д', form: 'экстракт мелиссы 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, нервная система, ЖКТ',
    organMechanism: 'ГАМК-ергическая передача, вегетативная регуляция, моторика ЖКТ',
    mechanismOfAction: 'Модуляция ГАМК-А рецепторов через розмариновую кислоту; повышение активности глутаматдекарбоксилазы (GAD); ингибирование ГАМК-трансаминазы; спазмолитическое действие на гладкую мускулатуру ЖКТ',
    clinicalEffect: 'Снижение тревожности, улучшение сна, спазмолитический эффект при расстройствах ЖКТ',
    bestForm: 'Экстракт мелиссы 500 мг 2x/д',
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
    synergies: [
        {with: "omega3", effect: "Антидепрессивный эффект", mechanism: "Оба улучшают настроение", severity: "MEDIUM"},
        {with: "curcumin", effect: "Противовоспалительное + антидепрессивное", mechanism: "Оба модулируют серотонин", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Серотониновый синдром", mechanism: "Шафран + СИОЗС", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Настроение', when: 'Субъективно' }
    ],
    contraindications: ['Приём СИОЗС (серотониновый синдром)'],
    sideEffects: ['Редко: сухость во рту'],
    dosage: { mg: 30, timing: 'с едой 1x/д', form: 'шафран экстракт 30 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг, сетчатка глаза, нервная система',
    organMechanism: 'Серотонинергическая передача, антиоксидантная защита нейронов, светочувствительность сетчатки',
    mechanismOfAction: 'Модуляция серотониновых (5-HT) рецепторов; ингибирование обратного захвата серотонина; антиоксидантная защита через каротиноиды (крокин, кроцетин); повышение BDNF; противовоспалительное действие через NF-κB',
    clinicalEffect: 'Улучшение настроения, снижение тревожности, защита зрения, нейропротекция',
    bestForm: 'Шафран экстракт 30 мг 2x/д',
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
      { with: "berberine", effect: "Метформин + Берберин — двойная АМПК активация", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "vitamin_b12", effect: "Метформин истощает В12 — необходима добавка", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "berberine", effect: "Метформин + Берберин — двойная АМПК активация", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед', targetRange: '3.5-5.5 ммоль/л' }
    ],
    contraindications: ['Лактоацидоз в анамнезе', 'Тяжёлая почечная недостаточность'],
    sideEffects: ['Желудочный дискомфорт', 'Диарея при начале'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'метформин 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Гепатоциты, миоциты, β-клетки поджелудочной железы',
    organMechanism: 'Активация AMPK в печени и мышцах, снижение глюконеогенеза, повышение инсулиновой чувствительности',
    mechanismOfAction: 'Ингибирование комплекса I митохондриальной дыхательной цепи → ↑ AMP/ATP → активация LKB1/AMPK → ↓ глюконеогенеза через CREB-CRTC2; ↑ транслокация GLUT4 в мышцах',
    clinicalEffect: 'Снижение глюкозы и инсулина, улучшение метаболического профиля на курсе ААС',
    bestForm: 'Метформин 500 мг с едой 2x/д',
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
    synergies: [
        {with: "berberine", effect: "Контроль глюкозы и веса", mechanism: "Оба снижают аппетит", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Риск гипогликемии", mechanism: "Двойное снижение глюкозы", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед', targetRange: '3.5-5.5 ммоль/л' }
    ],
    contraindications: ['Медуллярный рак щитовидной железы', 'МЭН2', 'Беременность'],
    sideEffects: ['Тошнота', 'Диарея при начале', 'Риск панкреатита'],
    dosage: { mg: 0.25, timing: '1x/нед п/к', form: 'семаглутид 0.25 мг' },
    bestForCourse: false,
    targetOrgan: 'β-клетки поджелудочной железы, гипоталамус, ЖКТ',
    organMechanism: 'Агонизм GLP-1 рецепторов, замедление опорожнения желудка, подавление аппетита в ЦНС',
    mechanismOfAction: 'GLP-1R → активация Gαs → ↑ цАМФ → ↑ PKA/EPAC2 → ↑ секреция инсулина (глюкозо-зависимая); в гипоталамусе → ↓ NPY/AgRP → ↓ аппетит; ↓ моторика антрального отдела желудка',
    clinicalEffect: 'Снижение веса, контроль аппетита, улучшение гликемического контроля',
    bestForm: 'Семаглутид 0.25 мг 1x/нед п/к',
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
      { with: "testosterone", effect: "Тестостерон + Финастерид — ДГТ контроль", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "testosterone", effect: "Тестостерон + Финастерид — ДГТ контроль", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'ПСА', when: 'Каждые 12 нед', targetRange: '<4 нг/мл' }
    ],
    contraindications: ['Беременность женщин', 'Рак простаты'],
    sideEffects: ['Снижение либидо', 'Эректильная дисфункция (5-10%)'],
    dosage: { mg: 1, timing: '1x/д', form: 'финастерид 1 мг' },
    bestForCourse: false,
    targetOrgan: 'Предстательная железа, волосяные фолликулы, гонады',
    organMechanism: 'Ингибирование 5α-редуктазы II типа, снижение ДГТ в простате и коже головы',
    mechanismOfAction: 'Конкурентный ингибитор 5α-редуктазы II типа (NADPH-зависимая) → ↓ конверсия тестостерона в ДГТ → ↓ ДГТ-зависимой пролиферации эпителия простаты и миниатюризации волосяных фолликулов; ↓ ПСА на 50%',
    clinicalEffect: 'Защита простаты, предотвращение андрогенной алопеции, снижение ПСА',
    bestForm: 'Финастерид 1 мг 1x/д',
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
    synergies: [
        {with: "vitamin_b6", effect: "Снижение пролактина", mechanism: "Оба снижают пролактин", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "testosterone", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Пролактин', when: 'Каждые 2 нед', targetRange: '<15 нг/мл' }
    ],
    contraindications: ['Фиброз сердца', 'Тяжёлая печёночная недостаточность'],
    sideEffects: ['Тошнота', 'Головокружение', 'Риск фиброза при длительном'],
    dosage: { mg: 0.0005, timing: '2x/нед', form: 'каберголин 0.5 мг' },
    bestForCourse: false,
    targetOrgan: 'Передняя доля гипофиза (лактотрофы), гонады',
    organMechanism: 'Агонизм дофаминовых D2-рецепторов на лактотрофах, подавление секреции пролактина',
    mechanismOfAction: 'D2-агонист (Gαi → ↓ цАМФ → ↓ активность аденилатциклазы) → ↓ транскрипция гена пролактина; восстановление пульсативного ГнРГ-ЛГ → ↑ тестостерон; ↓ пролактин-опосредованного ингибирования гонадотропов',
    clinicalEffect: 'Нормализация пролактина, восстановление либидо и ЛГ, контроль гиперпролактинемии на курсе',
    bestForm: 'Каберголин 0.5 мг 2x/нед',
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
      { with: "finasteride", effect: "Тестостерон + Финастерид — ДГТ контроль", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "nac", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "telmisartan", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "hcg", effect: "ХГЧ + Тестостерон — восстановление оси ГРГ-ЛГ", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "cabergoline", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "finasteride", effect: "Тестостерон + Финастерид — ДГТ контроль", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "tudca", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Тестостерон', when: 'Каждые 4 нед', targetRange: '700-1100 нг/дл' }
    ],
    contraindications: ['Рак простаты', 'Беременность'],
    sideEffects: ['Акне', 'Задержка жидкости', 'Алопеция'],
    dosage: { mg: 200, timing: '1x/нед в/м', form: 'тестостерон энантат 200 мг' },
    bestForCourse: false,
    targetOrgan: 'Андрогенные рецепторы во всех тканях: мышцы, гонады, ЦНС, кости',
    organMechanism: 'Активация андрогенных рецепторов в миоцитах, стимуляция белкового синтеза, эритропоэза и липолиза',
    mechanismOfAction: 'Testosterone → AR (лиганд-зависимый ядерный рецептор) → транслокация в ядро → связывание с ARE → ↓ миостатин, ↑ IGF-1; ароматизация → эстрадиол (защита костей/мозга), 5α-редукция → ДГТ (андрогенные эффекты)',
    clinicalEffect: 'Увеличение мышечной массы и силы, улучшение либидо, настроения, плотности костей',
    bestForm: 'Тестостерон энантат 200 мг 1x/нед в/м',
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
      { with: "theanine", effect: "Теанин сглаживает стимуляцию кофеина", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "stimulant_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "piracetam", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "l_carnitine", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "stimulant_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Пульс', when: 'Субъективно' }
    ],
    contraindications: ['Тяжёлая гипертензия', 'Аритмия'],
    sideEffects: ['Бессонница при вечернем приёме', 'Тахикардия'],
    dosage: { mg: 200, timing: 'утром за 30 мин до тренировки', form: 'кофеин 200 мг' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (кора, ретикулярная формация), миокард, миоциты',
    organMechanism: 'Блокада аденозиновых A1/A2A-рецепторов, повышение выброса дофамина и норадреналина',
    mechanismOfAction: 'Антагонист аденозина A1/A2A (конкурентно) → ↓ торможения ЦНС → ↑ возбуждение; ингибирование ФДЭ → ↑ цАМФ → ↑ липолиз; ↑ Ca²⁺ из саркоплазматического ретикулума через RyR → ↑ сила мышечного сокращения',
    clinicalEffect: 'Повышение энергии, фокуса, выносливости, ускорение жиросжигания',
    bestForm: 'Кофеин 200 мг за 30 мин до тренировки',
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
    synergies: [
        {with: "omeprazole", effect: "Защита желудка при НПВС", mechanism: "ИПП предотвращает НПВС-гастропатию", severity: "HIGH"},
      ],
    conflicts: [
        {with: "pharma", effect: "Риск кровотечения", mechanism: "НПВС + антикоагулянты", severity: "HIGH"},
        {with: "lithium", effect: "Токсичность лития", mechanism: "НПВС снижают выведение Li", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Креатинин', when: 'Каждые 2 нед' }
    ],
    contraindications: ['Язвенная болезнь', 'Почечная недостаточность', 'Беременность III триместр'],
    sideEffects: ['Желудочный дискомфорт', 'Риск язвы', 'Нефротоксичность'],
    dosage: { mg: 50, timing: 'с едой 2x/д (макс 5 дн)', form: 'диклофенак 50 мг' },
    bestForCourse: false,
    targetOrgan: 'Синовиальные оболочки суставов, мягкие ткани, почки',
    organMechanism: 'Ингибирование ЦОГ-1/2, снижение синтеза простагландинов, мощное противовоспалительное и анальгетическое действие',
    mechanismOfAction: 'Неселективный блокатор ЦОГ-1/2 (арахидоновая кислота → ПГН2 → ПГЕ2, ПГI2) → ↓ воспалительных простагландинов; ↓ NF-κB → ↓ IL-6, IL-1β; ↓ болевой импульс через ↓ сенситизации периферических ноцицепторов',
    clinicalEffect: 'Быстрое снятие боли и воспаления в суставах, снижение отёка, жаропонижение',
    bestForm: 'Диклофенак 50 мг с едой 2x/д (макс 5 дней)',
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
    synergies: [
        {with: "omeprazole", effect: "Защита ЖКТ", mechanism: "ИПП при НПВС", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Риск кровотечения", mechanism: "НПВС + антикоагулянты", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Креатинин', when: 'Каждые 2 нед' }
    ],
    contraindications: ['Язвенная болезнь', 'Почечная недостаточность'],
    sideEffects: ['Желудочный дискомфорт (меньше чем диклофенак)'],
    dosage: { mg: 7.5, timing: 'с едой 1x/д (макс 7 дн)', form: 'мелоксикам 7.5 мг' },
    bestForCourse: false,
    targetOrgan: 'Суставы, мягкие ткани, синовиальная жидкость',
    organMechanism: 'Селективное ингибирование ЦОГ-2, снижение воспаления с меньшим риском гастропатии',
    mechanismOfAction: 'Селективный блокатор ЦОГ-2 (в 10-20x активнее к ЦОГ-2 vs ЦОГ-1) → ↓ ПГЕ2 в очаге воспаления; ↓ активация хондроцитов → ↓ деградация хряща; ↓ iNOS/NO → ↓ нитрозативного стресса в суставах',
    clinicalEffect: 'Противовоспалительный и анальгетический эффект с меньшим GI-риском, чем неселективные НПВС',
    bestForm: 'Мелоксикам 7.5 мг с едой 1x/д (макс 7 дней)',
  },
ppi_drugs: {
    id: 'ppi_drugs',
    name: 'Omeprazole',
    nameRu: 'Омепразол',
    tier: 'specialty',
    category: ['pharma', 'gut'],
    forms: [
      { id: 'ppi_drugs', name: 'Omeprazole', nameRu: 'Омепразол 20 мг', dose: '20 мг 1x/д', best: true },
      { id: 'ppi_drugs_2', name: 'Pantoprazole', nameRu: 'Пантопразол 40 мг', dose: '40 мг', best: false }
    ],
    organs: ['STOMACH', 'GUT'],
    systems: ['gastrointestinal'],
    mechanisms: ['PROTON_PUMP_INHIBITION', 'GASTRIC_PROTECTION', 'ACID_REDUCTION', 'ULCER_PREVENTION'],
    description: 'Омепразол — ингибитор протонной помпы, снижает кислотность желудка. На курсе — защита ЖКТ от НПВП и ААС.',
    synergies: [
      { with: "probiotics", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "curcumin", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "colloidal_minerals", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "vitamin_b12", effect: "ИПП истощают В12 — необходима добавка", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "calcium", effect: "ИПП снижают всасывание кальция", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Гастроскопия', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Длительный приём >6 мес (риск остеопороза)'],
    sideEffects: ['Головная боль', 'Дефицит B12/Mg при длительном'],
    dosage: { mg: 20, timing: 'утром натощак 1x/д', form: 'омепразол 20 мг' },
    bestForCourse: false,
    targetOrgan: 'Париетальные клетки желудка',
    organMechanism: 'Необратимое ингибирование H⁺/K⁺-АТФазы, подавление секреции соляной кислоты',
    mechanismOfAction: 'Пролекарство → активация в кислой среде канальцев париетальных клеток → связывание с Cys813 H⁺/K⁺-АТФазы → необратимая блокада протонного насоса → ↓ HCl секреции на 80-95%; активация после еды (макс приём за 30мин до завтрака)',
    clinicalEffect: 'Защита желудка от НПВС-гастропатии, лечение ГЭРБ, профилактика язв',
    bestForm: 'Омепразол 20 мг утром натощак 1x/д',
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
    synergies: [
        {with: "saw_palmetto", effect: "Антиандрогенный эффект", mechanism: "Оба подавляют андрогены", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Риск гиперкалиемии", mechanism: "Спиронолактон + ИАПФ = калий", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Калий', when: 'Каждые 2 нед', targetRange: '4.0-5.0 ммоль/л' }
    ],
    contraindications: ['Гиперкалиемия', 'Тяжёлая почечная недостаточность'],
    sideEffects: ['Гинекомастия при высоких дозах', 'Снижение либидо'],
    dosage: { mg: 50, timing: 'с едой 1x/д', form: 'спиронолактон 50 мг' },
    bestForCourse: false,
    targetOrgan: 'Дистальные канальцы нефрона, миокард, сальные железы',
    organMechanism: 'Антагонизм альдостерона в почках, калийсберегающий диуретик, антиандроген',
    mechanismOfAction: 'Конкурентный антагонист MR (минералокортикоидный рецептор) в собирательных трубочках → ↓ Na⁺ реабсорбции, ↑ K⁺ задержка; ↓ фиброз миокарда через ↓ TGF-β; ↓ 5α-редуктаза → ↓ ДГТ в коже/сальных железах',
    clinicalEffect: 'Снижение отёков, контроль АД, антиандрогенный эффект, кардиопротекция',
    bestForm: 'Спиронолактон 50 мг с едой 1x/д',
  },

antidepressant_drugs: {
    id: 'antidepressant_drugs',
    name: 'Fluoxetine',
    nameRu: 'Флуоксетин',
    tier: 'specialty',
    category: ['pharma', 'neuroprotector'],
    forms: [
      { id: 'antidepressant_drugs', name: 'Fluoxetine', nameRu: 'Флуоксетин 20 мг', dose: '20 мг 1x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES', 'ADRENALS'],
    systems: ['neuro'],
    mechanisms: ['SEROTONIN_MODULATION', 'NOREPINEPHRINE_MODULATION', 'MOOD_REGULATION', 'ANXIOLYTIC'],
    description: 'Флуоксетин — СИОЗС, ингибитор обратного захвата серотонина. На ПКТ — стабилизация настроения. Только по назначению врача.',
    synergies: [
      { with: 'omega3', effect: 'Синергия антидепрессивного эффекта', mechanism: 'EPA + СИОЗС — усиление нейропластичности', severity: 'MEDIUM' },
      { with: 's_adenosyl_methionine', effect: 'Усиление метилирования и настроения', mechanism: 'SAMe + СИОЗС — аддитивное повышение серотонина', severity: 'MEDIUM' },
      { with: 'magnesium', effect: 'Снижение тревоги', mechanism: 'Mg блокирует NMDA-рецепторы, потенцирует GABA', severity: 'LOW' },
    ],
    conflicts: [
      { with: "x5htp", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "tryptophan", effect: "СИОЗС + Триптофан — риск серотонинового синдрома", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "holy_basil", effect: "Туласи потенцирует антидепрессанты", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "gaba", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "rhodiola", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "tyrosine", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "melatonin", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Настроение', when: 'Субъективно' }
    ],
    contraindications: ['Приём МАО-ингибиторов', 'Серотониновый синдром'],
    sideEffects: ['Тошнота при начале', 'Снижение либидо', 'Бессонница'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'антидепрессант (по назначению)' },
    bestForCourse: false,
    targetOrgan: 'Синапсы ЦНС (серотониновые/норадреналиновые нейроны)',
    organMechanism: 'Ингибирование обратного захвата серотонина/норадреналина, повышение нейротрансмиссии в синаптической щели',
    mechanismOfAction: 'СИОЗС: блокада SERT (серотониновый транспортер) → ↑ внеклеточного серотонина → десенситизация 5HT₁A-ауторецепторов → ↑ нейротрансмиссия; ↑ BDNF через CREB → нейропластичность гиппокампа',
    clinicalEffect: 'Стабилизация настроения, снижение тревожности, улучшение качества жизни на курсе ААС',
    bestForm: 'По назначению врача',
  },
anxiolytic_drugs: {
    id: 'anxiolytic_drugs',
    name: 'Buspirone',
    nameRu: 'Буспирон',
    tier: 'specialty',
    category: ['pharma', 'neuroprotector'],
    forms: [
      { id: 'anxiolytic_drugs', name: 'Buspirone', nameRu: 'Буспирон 10 мг', dose: '10 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['GABA_MODULATION', 'ANXIOLYTIC', 'MUSCLE_RELAXATION', 'SLEEP_REGULATION'],
    description: 'Буспирон — анксиолитик, частичный агонист 5-HT1A. На курсе — снижение тревожности без седации. Только по назначению.',
    synergies: [
      { with: "melatonin", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "ashwagandha", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "gaba", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "gaba", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "stimulant_complex", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Тревожность', when: 'Субъективно' }
    ],
    contraindications: ['Зависимость при длительном приёме'],
    sideEffects: ['Сонливость', 'Зависимость', 'Синдром отмены'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'анксиолитик (по назначению)' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (амигдала, кора, лимбическая система)',
    organMechanism: 'Усиление ГАМК-ергической передачи или частичный агонизм 5HT₁A-рецепторов',
    mechanismOfAction: 'Буспирон: частичный агонист 5-HT₁A (Gi/o → ↓ цАМФ) → ↓ тревожность; бензодиазепины: аллостерическая модуляция GABA-A (Cl⁻ канал) → ↑ частота открытия канала → ↑ Cl⁻ ток → гиперполяризация; ↓ активность амигдалы',
    clinicalEffect: 'Снижение тревожности, мышечное расслабление, улучшение сна',
    bestForm: 'По назначению врача',
  },
antipsychotic_drugs: {
    id: 'antipsychotic_drugs',
    name: 'Quetiapine',
    nameRu: 'Кветиапин',
    tier: 'specialty',
    category: ['pharma', 'neuroprotector'],
    forms: [
      { id: 'antipsychotic_drugs', name: 'Quetiapine', nameRu: 'Кветиапин 25 мг', dose: '25 мг 1x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['DOPAMINE_ANTAGONISM', 'PSYCHOSIS_PREVENTION', 'MOOD_STABILIZATION', 'PROLACTIN_INCREASE'],
    description: 'Кветиапин — атипичный антипсихотик. На курсе — контроль психотических симптомов. Только по назначению врача.',
    synergies: [
      { with: 'milk_thistle', effect: 'Гепатопротекция при метаболических эффектах', mechanism: 'Силимарин защищает печень от побочных эффектов антипсихотиков', severity: 'MEDIUM' },
      { with: 'vitamin_b6', effect: 'Снижение экстрапирамидных симптомов', mechanism: 'B6 уменьшает побочные эффекты дофаминовой блокады', severity: 'LOW' },
    ],
    conflicts: [
      { with: "phosphatidylcholine", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Психический статус', when: 'Субъективно' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Седация', 'Увеличение веса', 'Экстрапирамидные симптомы'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'антипсихотик (по назначению)' },
    bestForCourse: false,
    targetOrgan: 'Дофаминовые D2-рецепторы мезолимбического пути',
    organMechanism: 'Блокада D2-рецепторов, снижение дофаминергической активности в мезолимбическом пути',
    mechanismOfAction: 'D2-антагонизм (Gαi → ↓ цАМФ) → ↓ активность мезолимбического пути; атипичные: + блокада 5-HT₂A → ↓ экстрапирамидных симптомов; ↑ пролактина через D2-блокаду лактотрофов гипофиза',
    clinicalEffect: 'Контроль психотических симптомов, стабилизация настроения, седация',
    bestForm: 'По назначению врача',
  },
anticonvulsant_drugs: {
    id: 'anticonvulsant_drugs',
    name: 'Gabapentin',
    nameRu: 'Габапентин',
    tier: 'specialty',
    category: ['pharma', 'neuroprotector'],
    forms: [
      { id: 'anticonvulsant_drugs', name: 'Gabapentin', nameRu: 'Габапентин 300 мг', dose: '300 мг 3x/д', best: true }
    ],
    organs: ['BRAIN', 'NERVES'],
    systems: ['neuro'],
    mechanisms: ['SEIZURE_PREVENTION', 'NEUROPROTECTION', 'MOOD_STABILIZATION', 'NERVE_PAIN_RELIEF'],
    description: 'Габапентин — противоэпилептическое, аналог GABA. На курсе — нейропротекция и контроль нейропатии. Только по назначению.',
    synergies: [
      { with: 'magnesium', effect: 'Усиление нейропротекции и антиноцицепции', mechanism: 'Mg потенцирует GABA-ергический эффект габапентина', severity: 'MEDIUM' },
      { with: 'alpha_lipoic', effect: 'Синергия против нейропатии', mechanism: 'АЛЬК + габапентин — аддитивное снижение нейропатической боли', severity: 'LOW' },
    ],
    conflicts: [
      { with: "folate", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'ЭЭГ', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Беременность (с осторожностью)'],
    sideEffects: ['Сонливость', 'Головокружение', 'Тремор'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'противоэпилептический (по назначению)' },
    bestForCourse: false,
    targetOrgan: 'Нейроны ЦНС, NMDA-рецепторы, GABA-ергическая система',
    organMechanism: 'Блокада натриевых/кальциевых каналов нейронов, усиление GABA-ергического торможения',
    mechanismOfAction: 'Габапентин: блокада α2δ-субъединицы Ca²⁺ каналов (Cav2.1/2.2) → ↓ выброс глутамата; ↑ GABA через ↑ глутаматдекарбоксилазы; модуляция NMDA-рецепторов',
    clinicalEffect: 'Профилактика судорог, снижение нейропатической боли, нейропротекция',
    bestForm: 'По назначению врача',
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
    synergies: [
      { with: 'magnesium', effect: 'Потенцирование NMDA-блокады', mechanism: 'Mg блокирует NMDA-рецепторы, усиливая эффект кетамина', severity: 'MEDIUM' },
      { with: 'nac', effect: 'Нейропротекция при NMDA-антагонизме', mechanism: 'NAC снижает эксайтотоксичность и окислительный стресс', severity: 'MEDIUM' },
    ],
    conflicts: [
        {with: "pharma", effect: "Риск серотонинового синдрома", mechanism: "Кетамин + СИОЗС", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Настроение', when: 'Субъективно' }
    ],
    contraindications: ['Гипертензия', 'Психоз'],
    sideEffects: ['Диссоциация', 'Повышение АД', 'Зависимость'],
    dosage: { mg: 0.5, timing: 'в клинике 1x/нед в/в', form: 'кетамин 0.5 мг/кг в/в' },
    bestForCourse: false,
    targetOrgan: 'NMDA-рецепторы ЦНС (префронтальная кора, гиппокамп)',
    organMechanism: 'Неселективный антагонизм NMDA-рецепторов, усиление глутаматергической трансмиссии через AMPA',
    mechanismOfAction: 'Блокада NMDA-R (внутри канала → Mg²⁺-зависимое сайт-связывание) → ↓ ингибирования ГАМК-интернейронов → ↑ глутамат → ↑ AMPA → ↑ BDNF через mTORC1; ↑ синаптогенез и нейропластичность',
    clinicalEffect: 'Быстрое антидепрессивное действие (часы-дни), анальгезия, нейропластичность',
    bestForm: 'Только в клинике под наблюдением',
  },
antidiabetic_drugs: {
    id: 'pharma',
    name: 'Metformin',
    nameRu: 'Метформин',
    tier: 'specialty',
    category: ['pharma', 'metabolic'],
    forms: [
      { id: 'pharma', name: 'Metformin', nameRu: 'Метформин', dose: '500-2000 мг/сут', best: true }
    ],
    organs: ['PANCREAS', 'LIVER', 'MUSCLES'],
    systems: ['metabolic', 'hepatic'],
    mechanisms: ['INSULIN_SENSITIVITY', 'GLUCOSE_LOWERING', 'HBA1C_REDUCTION', 'METABOLIC_PROTECTION'],
    description: 'Метформин — AMPK-активатор, снижает глюкозу и инсулинорезистентность. На курсе ААС контролирует метаболический профиль.',
    synergies: [
      { with: 'berberine', effect: 'Двойная AMPK-активация', mechanism: 'Метформин + берберин — аддитивное снижение глюкозы и инсулина', severity: 'MEDIUM' },
      { with: 'alpha_lipoic', effect: 'Усиление инсулиновой чувствительности', mechanism: 'АЛЬК улучшает утилизацию глюкозы мышцами', severity: 'MEDIUM' },
      { with: 'chromium', effect: 'Гликемический контроль', mechanism: 'Хром усиливает действие инсулина', severity: 'LOW' },
    ],
    conflicts: [
      { with: "mct", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 4 нед', targetRange: '3.5-5.5 ммоль/л' }
    ],
    contraindications: ['Кетоацидоз', 'Тяжёлая почечная недостаточность'],
    sideEffects: ['Индивидуально'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'противодиабетический (по назначению)' },
    bestForCourse: false,
    targetOrgan: 'β-клетки поджелудочной, гепатоциты, миоциты',
    organMechanism: 'Глюконеогенез, утилизация глюкозы мышцами, липолиз',
    mechanismOfAction: 'Активация AMPK (фосфорилирование Thr172), ингибирование Complex I митохондрий, снижение глюконеогенеза в печени',
    clinicalEffect: 'Снижение глюкозы и HbA1c, улучшение инсулиновой чувствительности, умеренное снижение веса',
    bestForm: 'Метформин 500-2000 мг/сут с едой',
  },
thyroid_drugs: {
    id: 'pharma',
    name: 'Levothyroxine',
    nameRu: 'Левотироксин',
    tier: 'specialty',
    category: ['pharma', 'hormonal'],
    forms: [
      { id: 'pharma', name: 'Levothyroxine', nameRu: 'Левотироксин 50 мкг', dose: '50 мкг 1x/д', best: true },
      { id: 'thyroid_drugs_2', name: 'Liothyronine', nameRu: 'Лиотиронин 25 мкг', dose: '25 мкг', best: false }
    ],
    organs: ['THYROID', 'BRAIN', 'HEART'],
    systems: ['endocrine', 'cardio', 'neuro'],
    mechanisms: ['THYROID_HORMONE_REGULATION', 'METABOLIC_RATE', 'T3_T4_BALANCE', 'ENERGY_PRODUCTION'],
    description: 'Тиреоидные препараты — левотироксин (Т4) и лиотиронин (Т3) для регуляции метаболизма. Только по назначению.',
    synergies: [
      { with: "selenium", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "ashwagandha", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "l_carnitine", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "iodine", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'ТТГ/Т3/Т4', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Тиреотоксикоз', 'Острый инфаркт'],
    sideEffects: ['Тахикардия', 'Потливость', 'Остеопороз при длительном'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'тиреоидный препарат (по назначению)' },
    bestForCourse: false,
    targetOrgan: 'Тиреоциты, миокард, нейроны ЦНС',
    organMechanism: 'Метаболическая регуляция, термогенез, сократимость миокарда, когнитивные функции',
    mechanismOfAction: 'Активация ядерных рецепторов T3 (TRα/TRβ), регуляция транскрипции генов метаболизма (Na/K-АТФаза, UCP, миозин), стимуляция потребления кислорода клетками',
    clinicalEffect: 'Нормализация ТТГ и свободных Т3/Т4, повышение метаболической активности, коррекция гипотиреоза',
    bestForm: 'Левотироксин 50 мкг 1x/д утром натощак',
  },
corticosteroid_drugs: {
    id: 'corticosteroid_drugs',
    name: 'Prednisolone',
    nameRu: 'Преднизолон',
    tier: 'specialty',
    category: ['pharma', 'anti_inflammatory'],
    forms: [
      { id: 'corticosteroid_drugs', name: 'Prednisolone', nameRu: 'Преднизолон 5 мг', dose: '5 мг 1x/д', best: true }
    ],
    organs: ['ADRENALS', 'JOINTS', 'IMMUNE_SYSTEM'],
    systems: ['endocrine', 'musculoskeletal', 'immune'],
    mechanisms: ['ANTI_INFLAMMATORY', 'IMMUNOSUPPRESSION', 'CORTISOL_REPLACEMENT', 'EDEMA_REDUCTION'],
    description: 'Преднизолон — глюкокортикостероид. На курсе — краткосрочно при воспалении. Только по назначению.',
    synergies: [
      { with: "curcumin", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "calcium", effect: "Остеопороз", mechanism: "Кортикостероиды вымывают Ca", severity: "HIGH"},
        {with: "vitamin_d3", effect: "Дефицит D3", mechanism: "Кортикостероиды снижают D3", severity: "MEDIUM"},
        {with: "pharma", effect: "Риск язвы", mechanism: "КС + НПВС = язва желудка", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Кортизол', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Системные инфекции', 'Остеопороз'],
    sideEffects: ['Остеопороз', 'Увеличение веса', 'Синдром Кушинга'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'глюкокортикоид (по назначению)' },
    bestForCourse: false,
    targetOrgan: 'Надпочечники, иммунные клетки, синовиальная оболочка',
    organMechanism: 'Геномное/негеномное действие через GR-рецепторы, подавление воспалительного каскада',
    mechanismOfAction: 'GR-α активация → транслокация в ядро → связывание с GRE → ↑ липокортин-1 (↓ ФЛА2) → ↓ арахидоновой кислоты; транскрипционная репрессия NF-κB и AP-1 → ↓ IL-1, IL-6, TNF-α; ↓ инфильтрации лейкоцитов',
    clinicalEffect: 'Мощное противовоспалительное и иммуносупрессивное действие',
    bestForm: 'По назначению врача',
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
    organs: ['LIVER', 'HEART', 'VESSELS'],
    systems: ['hepatic', 'cardio'],
    mechanisms: ['HMG_COA_REDUCTION', 'CHOLESTEROL_LOWERING', 'PLAQUE_STABILIZATION', 'ANTI_INFLAMMATORY'],
    description: 'Статины — аторвастатин/розувастатин, снижают холестерин и стабилизируют бляшки. На курсе — кардиопротекция.',
    synergies: [
      { with: "resveratrol", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "coq10", effect: "Статины истощают КоКю10 — обязательная добавка", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "citrus_bioflavonoids", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "coq10", effect: "Статины истощают КоКю10 — обязательная добавка", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед', targetRange: 'ЛПНП<2.6 ммоль/л' }
    ],
    contraindications: ['Активное заболевание печени', 'Беременность'],
    sideEffects: ['Миалгия', 'Рабдомиолиз (редко)', 'Повышение трансаминаз'],
    dosage: { mg: 20, timing: 'на ночь 1x/д', form: 'аторвастатин 20 мг' },
    bestForCourse: false,
    targetOrgan: 'Гепатоциты, сосудистый эндотелий, кардиомиоциты',
    organMechanism: 'Ингибирование HMG-CoA редуктазы, снижение внутриклеточного синтеза холестерина',
    mechanismOfAction: 'Конкурентный ингибитор HMG-CoA-R → ↓ мевалонат → ↓ холестерин; ↑ рецепторов ЛПНП на гепатоцитах → клиренс ЛПНП; ↓ изопреноидов (RhoA/Rac1) → ↑ eNOS → вазодилатация; ↓ CRP через ↓ IL-6',
    clinicalEffect: 'Снижение ЛПНП и триглицеридов, стабилизация атеросклеротических бляшек, кардиопротекция',
    bestForm: 'Аторвастатин 20 мг на ночь 1x/д',
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
    organs: ['HEART', 'VESSELS', 'BLOOD'],
    systems: ['cardio', 'hematologic'],
    mechanisms: ['PLATELET_INHIBITION', 'THROMBUS_PREVENTION', 'MICROCIRCULATION', 'STROKE_PREVENTION'],
    description: 'Антиагреганты — аспирин/клопидогрел для предотвращения тромбов. На курсе — защита сосудов при эритроцитозе.',
    synergies: [
      { with: 'nattokinase', effect: 'Потенцирование фибринолиза', mechanism: 'Наттокиназа + антиагреганты — аддитивное снижение вязкости крови', severity: 'MEDIUM' },
      { with: 'omega3', effect: 'Усиление антиагрегантного эффекта', mechanism: 'Омега-3 снижает агрегацию тромбоцитов', severity: 'MEDIUM' },
    ],
    conflicts: [
        {with: "pharma", effect: "Риск кровотечения", mechanism: "Двойное подавление тромбоцитов", severity: "HIGH"},
        {with: "omega3", effect: "Усиление антиагрегантного эффекта", mechanism: "Омега-3 снижает агрегацию", severity: "MEDIUM"},
        {with: "ginger", effect: "Усиление эффекта", mechanism: "Имбирь ингибирует тромбоциты", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Гемоглобин/Гематокрит', when: 'Каждые 8 нед', targetRange: 'Ht<54%' }
    ],
    contraindications: ['Язвенная болезнь', 'Геморрагический диатез'],
    sideEffects: ['Желудочный дискомфорт', 'Риск кровотечения'],
    dosage: { mg: 100, timing: 'с едой 1x/д', form: 'аспирин 100 мг' },
    bestForCourse: false,
    targetOrgan: 'Тромбоциты, сосудистый эндотелий',
    organMechanism: 'Ингибирование агрегации тромбоцитов, профилактика тромбозов',
    mechanismOfAction: 'Аспирин: необратимое ацетилирование ЦОГ-1 (Ser529) → ↓ ТхА2 в тромбоцитах на 7-10 дней; клопидогрел: блокада P2Y12 (ADP-рецептор) → ↓ активации GPIIb/IIIa → ↓ агрегации',
    clinicalEffect: 'Профилактика тромбозов, снижение вязкости крови, защита при эритроцитозе',
    bestForm: 'Аспирин 100 мг с едой 1x/д',
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
    organs: ['HEART', 'VESSELS', 'BLOOD'],
    systems: ['cardio', 'hematologic'],
    mechanisms: ['COAGULATION_INHIBITION', 'THROMBUS_PREVENTION', 'DVT_PREVENTION', 'STROKE_PREVENTION'],
    description: 'Антикоагулянты — эноксапарин/ривароксабан для профилактики тромбозов. На курсе — при высоком гематокрите.',
    synergies: [
      { with: 'nattokinase', effect: 'Потенцирование фибринолиза (с осторожностью)', mechanism: 'Наттокиназа + антикоагулянты — аддитивный антитромботический эффект', severity: 'LOW' },
      { with: 'bromelain', effect: 'Усиление антикоагуляции (с осторожностью)', mechanism: 'Бромелайн снижает агрегацию тромбоцитов', severity: 'LOW' },
    ],
    conflicts: [
      { with: "vitamin_k2", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "omega3", effect: "Усиление антикоагулянтного эффекта — риск кровотечения", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "holy_basil", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "curcumin", effect: "Куркумин потенцирует антикоагулянты", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "resveratrol", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "ginseng", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "coq10", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "ginger", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "garlic", effect: "Чеснок потенцирует антикоагулянты", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'МНО/АЧТВ', when: 'Каждые 2-4 нед' }
    ],
    contraindications: ['Активное кровотечение', 'Тромбоцитопения'],
    sideEffects: ['Риск кровотечения', 'Гематомы'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'антикоагулянт (по назначению)' },
    bestForCourse: false,
    targetOrgan: 'Факторы свёртывания крови (печень), сосудистый эндотелий',
    organMechanism: 'Ингибирование факторов коагуляции IIa/Xa, профилактика тромбоэмболий',
    mechanismOfAction: 'Ривароксабан: прямой ингибитор FXa (конкурентно, активный центр Ser195) → ↓ тромбина → ↓ фибрина; эноксапарин: активация ATIII → ↓ FXa/IIa; варфарин: антагонизм витамина K → ↓ II,X,IX,VII',
    clinicalEffect: 'Профилактика тромбозов и эмболий, снижение риска инсульта/ТЭЛА',
    bestForm: 'По назначению врача',
  },
ace_inhibitor_drugs: {
    id: 'ace_inhibitor_drugs',
    name: 'Enalapril',
    nameRu: 'Эналаприл',
    tier: 'specialty',
    category: ['pharma', 'cardioprotector'],
    forms: [
      { id: 'ace_inhibitor_drugs', name: 'Enalapril', nameRu: 'Эналаприл 10 мг', dose: '10 мг 1x/д', best: true },
      { id: 'ace_inhibitor_drugs_2', name: 'Ramipril', nameRu: 'Рамиприл 5 мг', dose: '5 мг', best: false }
    ],
    organs: ['HEART', 'VESSELS', 'KIDNEYS'],
    systems: ['cardio', 'renal'],
    mechanisms: ['ACE_INHIBITION', 'BLOOD_PRESSURE_LOWERING', 'RENAL_PROTECTION', 'REMODELING_PREVENTION'],
    description: 'Эналаприл — ИАПФ, снижает АД, защищает почки. На курсе — кардиопротекция при гипертензии.',
    synergies: [
      { with: 'telmisartan', effect: 'Аддитивное снижение АД (с осторожностью)', mechanism: 'иАПФ + сартан — двойная блокада РААС', severity: 'MEDIUM' },
      { with: 'magnesium', effect: 'Усиление гипотензивного эффекта', mechanism: 'Mg — природный блокатор кальциевых каналов', severity: 'LOW' },
    ],
    conflicts: [
      { with: "potassium", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "zinc", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'АД', when: 'Каждые 2 нед', targetRange: '<130/85 мм рт.ст.' }
    ],
    contraindications: ['Беременность', 'Двусторонний стеноз почечных артерий'],
    sideEffects: ['Сухой кашель', 'Гиперкалиемия'],
    dosage: { mg: 10, timing: '1x/д', form: 'эналаприл 10 мг' },
    bestForCourse: false,
    targetOrgan: 'Сосудистый эндотелий, миокард, клубочки почек',
    organMechanism: 'Ингибирование АПФ, снижение ангиотензина II и альдостерона',
    mechanismOfAction: 'Связывание Zn²⁺ активного центра АПФ → ↓ АТ-II → ↓ вазоконстрикции (через AT1R); ↓ альдостерона → ↓ Na⁺/вода; ↓ распад брадикинина (через ↓ кининазы II) → ↑ NO/ПГI₂ → вазодилатация',
    clinicalEffect: 'Снижение АД, защита почек, регресс гипертрофии миокарда',
    bestForm: 'Эналаприл 10 мг 1x/д',
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
    organs: ['HEART', 'VESSELS', 'KIDNEYS'],
    systems: ['cardio', 'renal'],
    mechanisms: ['ANGIOTENSIN_RECEPTOR_BLOCKADE', 'BLOOD_PRESSURE_LOWERING', 'RENAL_PROTECTION', 'FIBROSIS_REDUCTION'],
    description: 'БРА (сартаны) — лозартан/валсартан, альтернатива ИАПФ без кашля. На курсе — кардиопротекция.',
    synergies: [
      { with: "ginger", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "potassium_supplements", effect: "Риск гиперкалиемии", mechanism: "АРБ снижают выведение K", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'АД', when: 'Каждые 2 нед', targetRange: '<130/85 мм рт.ст.' }
    ],
    contraindications: ['Беременность', 'Тяжёлая почечная недостаточность'],
    sideEffects: ['Редко: головокружение', 'Гиперкалиемия'],
    dosage: { mg: 50, timing: '1x/д', form: 'лозартан 50 мг' },
    bestForCourse: false,
    targetOrgan: 'Сосудистый эндотелий, миокард, клубочки почек',
    organMechanism: 'Блокада AT1-рецепторов ангиотензина II, вазодилатация без влияния на брадикинин',
    mechanismOfAction: 'Конкурентная блокада AT1R (Gαq/11 → ↓ IP3 → ↓ Ca²⁺) → ↓ вазоконстрикции; ↓ альдостерона → ↓ Na⁺ воды; ↑ PPAR-γ агонизм (частичный у телмисартана) → ↑ инсулиновой чувствительности',
    clinicalEffect: 'Снижение АД, защита почек, кардиопротекция',
    bestForm: 'Лозартан 50 мг 1x/д',
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
    organs: ['HEART', 'VESSELS'],
    systems: ['cardio'],
    mechanisms: ['CALCIUM_CHANNEL_BLOCKADE', 'BLOOD_PRESSURE_LOWERING', 'VASODILATION', 'ANGINA_PREVENTION'],
    description: 'БКК — амлодипин/нифедипин, снижают АД и расширяют сосуды. На курсе — гипертензия.',
    synergies: [
      { with: 'magnesium', effect: 'Потенцирование вазодилатации', mechanism: 'Mg + БКК = аддитивное расслабление гладкой мускулатуры сосудов', severity: 'MEDIUM' },
      { with: 'potassium', effect: 'Контроль электролитного баланса', mechanism: 'Калий снижает риск отёков от БКК', severity: 'LOW' },
    ],
    conflicts: [
      { with: 'grapefruit', effect: 'Повышение AUC амлодипина', mechanism: 'Грейпфрут ингибирует CYP3A4, метаболизирующий БКК', severity: 'HIGH' },
      { with: 'stimulant_complex', effect: 'Снижение антигипертензивного эффекта', mechanism: 'Стимуляторы повышают АД, противодействуя БКК', severity: 'MEDIUM' },
    ],
    monitoring: [
      { what: 'АД', when: 'Каждые 2 нед', targetRange: '<130/85 мм рт.ст.' }
    ],
    contraindications: ['Тяжёлая гипотензия', 'Сердечная недостаточность'],
    sideEffects: ['Отёки голеней', 'Головная боль', 'Приливы'],
    dosage: { mg: 5, timing: '1x/д', form: 'амлодипин 5 мг' },
    bestForCourse: false,
    targetOrgan: 'Гладкая мускулатура сосудов, кардиомиоциты',
    organMechanism: 'Блокада L-типа кальциевых каналов, вазодилатация, снижение периферического сопротивления',
    mechanismOfAction: 'Амлодипин: связывание с α1C-субъединицей Cav1.2 → ↓ Ca²⁺ вход в гладкомышечные клетки → ↓ фосфорилирования MLCK → расслабление; ↓ СА-проводимости (верапамил → ↓ ЧСС)',
    clinicalEffect: 'Снижение АД, уменьшение ангинозных болей, вазопротекция',
    bestForm: 'Амлодипин 5 мг 1x/д',
  },
beta_blocker_drugs: {
    id: 'beta_blocker_drugs',
    name: 'Bisoprolol',
    nameRu: 'Бисопролол',
    tier: 'specialty',
    category: ['pharma', 'cardioprotector'],
    forms: [
      { id: 'beta_blocker_drugs', name: 'Bisoprolol', nameRu: 'Бисопролол 5 мг', dose: '5 мг 1x/д', best: true },
      { id: 'beta_blocker_drugs_2', name: 'Metoprolol', nameRu: 'Метопролол 50 мг', dose: '50 мг', best: false }
    ],
    organs: ['HEART', 'VESSELS', 'LUNGS'],
    systems: ['cardio'],
    mechanisms: ['BETA_RECEPTOR_BLOCKADE', 'HEART_RATE_REDUCTION', 'BLOOD_PRESSURE_LOWERING', 'ARRHYTHMIA_PREVENTION'],
    description: 'Бисопролол — β1-селективный блокатор, снижает ЧСС и АД. На курсе — контроль пульса.',
    synergies: [
        {with: "coq10", effect: "Защита сердца", mechanism: "Бета-блокаторы + CoQ10", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "stimulant_complex", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "potassium", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Пульс/АД', when: 'Каждые 2 нед', targetRange: 'пульс 60-70' }
    ],
    contraindications: ['Бронхиальная астма (неселективные)'],
    sideEffects: ['Брадикардия', 'Усталость', 'Редко: бронхоспазм'],
    dosage: { mg: 5, timing: '1x/д', form: 'бисопролол 5 мг' },
    bestForCourse: false,
    targetOrgan: 'β1-адренорецепторы миокарда, β2-рецепторы бронхов/сосудов',
    organMechanism: 'Блокада β-адренорецепторов, снижение ЧСС, сократимости и потребления кислорода миокардом',
    mechanismOfAction: 'Конкурентная блокада β1-AR (Gαs → ↓ цАМФ → ↓ PKA) → ↓ хронотропного и инотропного эффекта катехоламинов; ↓ ренина в ЮГА → ↓ АТ-II; ↓ AV-проводимости',
    clinicalEffect: 'Снижение ЧСС и АД, антиаритмический эффект, кардиопротекция',
    bestForm: 'Бисопролол 5 мг 1x/д',
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
      { with: "calcium", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "electrolyte_complex", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "magnesium", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "potassium", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "potassium", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "calcium", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Калий/Креатинин', when: 'Каждые 2 нед', targetRange: 'К+ 4.0-5.0' }
    ],
    contraindications: ['Анурия', 'Тяжёлая почечная недостаточность'],
    sideEffects: ['Гипокалиемия', 'Дегидратация', 'Мышечные судороги'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'диуретик (по назначению)' },
    bestForCourse: false,
    targetOrgan: 'Нефроны (петля Генле, проксимальные/дистальные канальцы)',
    organMechanism: 'Блокада транспортёров Na⁺/Cl⁻/K⁺ в нефроне, снижение ОЦК и АД',
    mechanismOfAction: 'Фуросемид: блокада Na⁺-K⁺-2Cl⁻ (NKCC2) в петле Генле → ↓ реабсорбции Na⁺ (до 25%); ГХТЗ: блокада NCC в дистальных канальцах → ↓ реабсорбции Na⁺ (5-8%); спиронолактон: антагонизм MR → ↓ Na⁺ → ↑ K⁺',
    clinicalEffect: 'Снятие отёков, снижение АД, коррекция электролитного баланса',
    bestForm: 'По назначению врача',
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
    synergies: [
      { with: 'corticosteroid_drugs', effect: 'Аддитивное иммуноподавление', mechanism: 'Комбинация с ГКС для усиления иммуносупрессии', severity: 'MEDIUM' },
      { with: 'vitamin_d3', effect: 'Иммуномодуляция', mechanism: 'D3 снижает риск аутоиммунных реакций', severity: 'LOW' },
    ],
    conflicts: [
      { with: "folate", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "berberine", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "quercetin", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Иммунограмма', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Активные инфекции', 'Беременность'],
    sideEffects: ['Инфекции', 'Нефротоксичность', 'Увеличение веса'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'иммунодепрессант (по назначению)' },
    bestForCourse: false,
    targetOrgan: 'T-лимфоциты (кальциневриновый путь), костный мозг',
    organMechanism: 'Ингибирование активации и пролиферации T-лимфоцитов, подавление иммунного ответа',
    mechanismOfAction: 'Циклоспорин: связывание с циклофилином → ингибирование кальциневрина → ↓ NFAT-транслокации → ↓ IL-2; такролимус: FKBP-12 → ↓ кальциневрин; микофенолат: ингибирование IMPDH → ↓ гуаниновых нуклеотидов → ↓ пролиферации лимфоцитов',
    clinicalEffect: 'Иммуносупрессия при аутоиммунных заболеваниях и трансплантации',
    bestForm: 'По назначению врача',
  },
antibiotic_drugs: {
    id: 'antibiotic_drugs',
    name: 'Antibiotic Drugs',
    nameRu: 'Антибиотики',
    tier: 'specialty',
    category: ['pharma', 'immunomodulator'],
    forms: [
      { id: 'antibiotic_drugs', name: 'Antibiotic Drugs', nameRu: 'Антибиотик (по назначению врача)', dose: '1 мг 2x/д', best: true }
    ],
    organs: ['GUT', 'IMMUNE_SYSTEM', 'REPRODUCTIVE'],
    systems: ['gastrointestinal', 'immune', 'reproductive'],
    mechanisms: ['BACTERIAL_INFECTION_TREATMENT', 'GUT_FLORA_DISRUPTION', 'IMMUNE_MODULATION', 'INFECTION_PREVENTION'],
    description: 'Антибиотики — для лечения инфекций на курсе. Обязательно с пробиотиками для защиты микрофлоры.',
    synergies: [
      { with: 'probiotics', effect: 'Защита микрофлоры (раздельный приём)', mechanism: 'Пробиотики восстанавливают микробиом после антибиотиков', severity: 'HIGH' },
      { with: 'vitamin_c', effect: 'Усиление иммунного ответа', mechanism: 'Витамин C поддерживает фагоцитоз и лейкопоэз', severity: 'MEDIUM' },
      { with: 'garlic', effect: 'Аддитивное антибактериальное действие', mechanism: 'Аллицин + антибиотики — усиление бактерицидного эффекта', severity: 'LOW' },
    ],
    conflicts: [
      { with: "nac", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "probiotics", effect: "Антибиотики уничтожают пробиотики — раздельный приём", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "berberine", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "quercetin", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" },
      { with: "vitamin_c", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 2 нед' }
    ],
    contraindications: ['Аллергия на пенициллины (для бета-лактамов)'],
    sideEffects: ['Диарея', 'Дисбактериоз', 'Кандидоз'],
    dosage: { mg: 1, timing: 'индивидуально', form: 'антибиотик (по назначению)' },
    bestForCourse: false,
    targetOrgan: 'Бактериальная микрофлора, иммунная система слизистых',
    organMechanism: 'Подавление бактериальной пролиферации через различные механизмы (клеточная стенка/рибосомы/ДНК)',
    mechanismOfAction: 'β-лактамы: ингибирование транспептидазы (DD-транспептидаза) → нарушение сборки пептидогликана; макролиды: связывание с 50S-рРНК → ↓ транслокации; хинолоны: ингибирование ДНК-гиразы/топоизомеразы IV',
    clinicalEffect: 'Эрадикация бактериальной инфекции, профилактика септических осложнений',
    bestForm: 'По назначению врача',
  },
antihistamine_drugs: {
    id: 'antihistamine_drugs',
    name: 'Cetirizine',
    nameRu: 'Цетиризин',
    tier: 'standard',
    category: ['pharma', 'immunomodulator'],
    forms: [
      { id: 'antihistamine_drugs', name: 'Cetirizine', nameRu: 'Цетиризин 10 мг', dose: '10 мг 1x/д', best: true },
      { id: 'antihistamine_drugs_2', name: 'Loratadine', nameRu: 'Лоратадин 10 мг', dose: '10 мг', best: false }
    ],
    organs: ['IMMUNE_SYSTEM', 'LUNGS', 'SKIN'],
    systems: ['immune'],
    mechanisms: ['H1_RECEPTOR_BLOCKADE', 'ALLERGY_REDUCTION', 'ITCHING_RELIEF', 'SLEEP_IMPROVEMENT'],
    description: 'Антигистаминные — цетиризин/лоратадин для снижения аллергических реакций на курсе.',
    synergies: [
      { with: "quercetin", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "stimulant_complex", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Антигистаминные I поколения усиливают седацию алкоголя и бензодиазепинов", mechanism: "Центральная H1-блокада + ГАМК-А", severity: "HIGH" },
      { with: "magnesium", effect: "Магний может усиливать седативный эффект антигистаминных", mechanism: "Мышечная релаксация + H1-блокада", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Аллергические симптомы', when: 'Субъективно' }
    ],
    contraindications: ['Тяжёлая почечная недостаточность'],
    sideEffects: ['Сонливость (I поколение)', 'Сухость во рту'],
    dosage: { mg: 10, timing: '1x/д', form: 'цетиризин 10 мг' },
    bestForCourse: false,
    targetOrgan: 'H1-рецепторы тучных клеток, гладкой мускулатуры, эндотелия',
    organMechanism: 'Блокада H1-гистаминовых рецепторов, подавление аллергической реакции',
    mechanismOfAction: 'Конкурентный антагонист H1R (Gαq/11 → ↓ IP3 → ↓ Ca²⁺) → ↓ гистамин-индуцированной вазодилатации/проницаемости; ↓ гистамин-индуцированного бронхоспазма/зуда',
    clinicalEffect: 'Устранение аллергических симптомов, снижение зуда, отёка слизистых',
    bestForm: 'Цетиризин 10 мг 1x/д',
  },
nsaid_drugs: {
    id: 'pharma',
    name: 'NSAID Drugs',
    nameRu: 'НПВС',
    tier: 'specialty',
    category: ['pharma', 'anti_inflammatory'],
    forms: [
      { id: 'pharma', name: 'NSAID Drugs', nameRu: 'Ибупрофен 400 мг', dose: '400 мг 2x/д', best: true },
      { id: 'nsaid_drugs_2', name: 'NSAID Drugs', nameRu: 'Напроксен 250 мг', dose: '400 мг', best: false }
    ],
    organs: ['JOINTS', 'MUSCLES', 'STOMACH'],
    systems: ['musculoskeletal', 'gastrointestinal'],
    mechanisms: ['COX_INHIBITION', 'ANTI_INFLAMMATORY', 'ANALGESIC', 'ANTIPYRETIC'],
    description: 'НПВС — ибупрофен/напроксен для снятия боли и воспаления. На курсе — краткосрочно для суставов.',
    synergies: [
      { with: "omega3", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "nac", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "curcumin", effect: "НПВС + Куркумин — риск желудочного кровотечения", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "ginger", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "gaba", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" },
      { with: "lithium", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Креатинин', when: 'Каждые 2 нед' }
    ],
    contraindications: ['Язвенная болезнь', 'Почечная недостаточность'],
    sideEffects: ['Желудочный дискомфорт', 'Риск язвы', 'Нефротоксичность'],
    dosage: { mg: 400, timing: 'с едой (макс 5 дн)', form: 'ибупрофен 400 мг' },
    bestForCourse: false,
    targetOrgan: 'Суставной хрящ, синовиальная оболочка, слизистая желудка',
    organMechanism: 'Воспалительный каскад (COX-1/COX-2), продукция простагландинов, болевая сигнализация, защита слизистой желудка',
    mechanismOfAction: 'Обратимое ингибирование ЦОГ-1 (конститутивная) и ЦОГ-2 (индуцибельная) → ↓ синтеза PGE2, PGI2, тромбоксана A2; ↓ продукции провоспалительных цитокинов',
    clinicalEffect: 'Противовоспалительное, анальгетическое, жаропонижающее действие',
    bestForm: 'Ибупрофен 400 мг с едой 2x/д (макс 5 дней)',
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
    synergies: [
        {with: "selenium", effect: "Конверсия T4→T3", mechanism: "Селен — кофактор дейодиназ", severity: "HIGH"},
        {with: "iron", effect: "Синтез гормонов", mechanism: "Железо необходим для щитовидной", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "calcium", effect: "Снижение всасывания", mechanism: "Кальций снижает всасывание левотироксина", severity: "HIGH"},
        {with: "iron", effect: "Снижение всасывания", mechanism: "Железо снижает всасывание левотироксина", severity: "HIGH"},
        {with: "fiber", effect: "Снижение всасывания", mechanism: "Клетчатка может связывать", severity: "LOW"},
      ],
    monitoring: [
      { what: 'ТТГ', when: 'Каждые 8 нед', targetRange: '0.5-3.0 мкМЕ/мл' }
    ],
    contraindications: ['Тиреотоксикоз', 'Острый инфаркт'],
    sideEffects: ['Тахикардия при передозировке', 'Остеопороз при длительном'],
    dosage: { mg: 0.05, timing: 'натощак за 30 мин до еды 1x/д', form: 'левотироксин 50 мкг' },
    bestForCourse: false,
    targetOrgan: 'Ткани-мишени тиреоидных гормонов (миокард, ЦНС, жировая ткань)',
    organMechanism: 'Заместительная терапия: T4 → T3 → активация ядерных TR-рецепторов',
    mechanismOfAction: 'T4 → дейодиназы D1/D2 → T3 → связывание с TRα/TRβ → RXR/TR гетеродимер → связывание с TRE → ↑ Na⁺/K⁺-АТФаза, ↑ MYH6/β-MHC → ↑ сократимости; ↑ UCP1 → термогенез',
    clinicalEffect: 'Нормализация ТТГ, устранение симптомов гипотиреоза, регуляция метаболизма',
    bestForm: 'Левотироксин 50 мкг натощак за 30 мин до еды 1x/д',
  },
antithyroid_drugs: {
    id: 'antithyroid_drugs',
    name: 'Thiamazole',
    nameRu: 'Тиамазол',
    tier: 'specialty',
    category: ['pharma', 'hormonal'],
    forms: [
      { id: 'antithyroid_drugs', name: 'Thiamazole', nameRu: 'Тиамазол 10 мг', dose: '10 мг 2x/д', best: true }
    ],
    organs: ['THYROID'],
    systems: ['endocrine'],
    mechanisms: ['THYROID_HORMONE_SYNTHESIS_INHIBITION', 'T3_T4_LOWERING', 'HYPERTHYROIDISM_TREATMENT', 'METABOLIC_RATE_REDUCTION'],
    description: 'Тиамазол — тиреостатик, ингибирует синтез тиреоидных гормонов. При гипертиреозе на курсе. Только по назначению.',
    synergies: [
      { with: 'selenium', effect: 'Защита щитовидной железы', mechanism: 'Se — кофактор дейодиназы, снижает побочные эффекты тиреостатиков', severity: 'MEDIUM' },
      { with: 'l_carnitine', effect: 'Снижение тиреоидных симптомов', mechanism: 'L-карнитин блокирует T3 в клетках, уменьшая тиреотоксикоз', severity: 'MEDIUM' },
    ],
    conflicts: [
      { with: "iodine", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'ТТГ/Т3/Т4', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Агранулоцитоз в анамнезе'],
    sideEffects: ['Кожная сыпь', 'Агранулоцитоз (редко)', 'Зоб'],
    dosage: { mg: 10, timing: 'с едой 2x/д', form: 'тиамазол 10 мг' },
    bestForCourse: false,
    targetOrgan: 'Щитовидная железа (тиреоциты)',
    organMechanism: 'Ингибирование тиреоидной пероксидазы (ТПО), блокировка синтеза T3/T4',
    mechanismOfAction: 'Тиамазол: ингибирование ТПО (Fe-гем/Se-зависимая) → ↓ йодирования тирозина и конденсации йодтирозинов; ↓ тиреоидной протеазы → ↓ выделения T4/T3 в кровь',
    clinicalEffect: 'Снижение T3/T4 при гипертиреозе, контроль метаболической скорости',
    bestForm: 'Тиамазол 10 мг с едой 2x/д',
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
    synergies: [
        {with: "probiotics", effect: "Комплексная поддержка микробиома", mechanism: "Постбиотики + пробиотики", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Бутират может снижать экспрессию CYP3A4 — влияние на метаболизм лекарств", mechanism: "Ингибирование HDAC → ↓ CYP3A4", severity: "MEDIUM" },
      { with: "nsaid_drugs", effect: "НПВС разрушают кишечный барьер — нивелируют эффект постбиотиков", mechanism: "НПВС → ↑ проницаемости кишечника", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Микрофлора', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: вздутие при начале'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'постбиотик комплекс 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Кишечный эпителий, иммунные клетки GALT, нейроны энтеральной нервной системы',
    organMechanism: 'Укрепление плотных контактов энтероцитов, регуляция воспаления в GALT',
    mechanismOfAction: 'Бутират → ингибирование HDAC1/3 → ↑ Foxp3 → ↑ Treg; ↓ NF-κB в макрофагах; восстановление ZO-1/occludin плотных контактов через ↑ AMPK; активация GPR43/109A → ↑ GLP-1/PYY',
    clinicalEffect: 'Укрепление кишечного барьера, снижение системного воспаления, поддержка микробиома',
    bestForm: 'Постбиотик комплекс 500 мг с едой 1x/д',
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
    synergies: [
        {with: "probiotics", effect: "Иммуномодуляция", mechanism: "Парабиотики + живые пробиотики", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Иммуностимуляция парабиотиками может снижать эффективность иммуносупрессоров", mechanism: "Активация TLR2/4", severity: "MEDIUM" },
      { with: "antihistamine_drugs", effect: "Антигистаминные могут маскировать иммунный ответ на парабиотики", mechanism: "Блокада H1-рецепторов", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Микрофлора', when: 'Субъективно' }
    ],
    contraindications: ['Иммунокомпрометация (безопасно)'],
    sideEffects: ['Редко: вздутие'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'парабиотик комплекс 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Иммунные клетки Peyerовых бляшек и GALT',
    organMechanism: 'Иммуномодуляция через TLR2/TLR4 на дендритных клетках, безопасная активация иммунитета',
    mechanismOfAction: 'Липопротеины клеточной стенки (инактивированные) → связывание с TLR2/4 на DC → ↑ IL-10/TGF-β → Treg; ↓ воспалительного ответа без риска бактериемии',
    clinicalEffect: 'Иммуномодуляция, укрепление барьерной функции кишечника, безопасны для иммунокомпрометированных',
    bestForm: 'Парабиотик комплекс 500 мг с едой 1x/д',
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
    synergies: [
        {with: "probiotics", effect: "Пребиотический эффект", mechanism: "Резистентный крахмал — пища для пробиотиков", severity: "HIGH"},
        {with: "butyrate", effect: "Здоровье кишечника", mechanism: "Крахмал → бутират", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Может снижать всасывание лекарств за счет связывания в ЖКТ", mechanism: "Адсорбция в гелевой матрице", severity: "LOW" },
      { with: "acarbose", effect: "Акарбоза снижает ферментацию крахмала — антагонизм", mechanism: "Ингибирование α-глюкозидазы", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Глюкоза натощак', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Вздутие при начале'],
    dosage: { mg: 20000, timing: 'с едой 1x/д', form: 'резистентный крахмал 20 г' },
    bestForCourse: false,
    targetOrgan: 'Микрофлора толстой кишки, колоноциты, гепатоциты',
    organMechanism: 'Ферментация бактериями → SCFA (бутират), улучшение инсулиновой чувствительности',
    mechanismOfAction: 'Бактериальные амилазы/гликозидазы → SCFA (ацетат:пропионат:бутират 60:25:15) → бутират → HDACi → ↑ Treg; пропионат → GPR41/43 → ↑ GLP-1; ↑ AQP3/7 → гидратация стула',
    clinicalEffect: 'Повышение бутирата, улучшение чувствительности к инсулину, поддержка микробиома',
    bestForm: 'Резистентный крахмал 20 г с едой 1x/д',
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
    synergies: [
        {with: "vitamin_d3", effect: "Иммунная активация", mechanism: "Бета-глюканы + D3", severity: "MEDIUM"},
        {with: "zinc", effect: "Иммунитет", mechanism: "Оба — врождённый иммунитет", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Антагонизм", mechanism: "Стимулирует иммунитет", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: вздутие'],
    dosage: { mg: 500, timing: 'с едой 1x/д', form: 'бета-глюкан 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Макрофаги, нейтрофилы, гепатоциты, миокард',
    organMechanism: 'Активация врождённого иммунитета через Dectin-1/CR3, снижение холестерина в печени',
    mechanismOfAction: '(1→3),(1→4)-β-D-глюкан → Dectin-1 → Syk-зависимый путь → ↑ ROS/NO макрофагов; интегрин CR3 → ↑ фагоцитоз; ↓ реабсорбции желчных кислот → ↓ ХС; ↑ Bifidobacterium/Lactobacillus',
    clinicalEffect: 'Активация иммунитета, снижение холестерина, поддержка сердечно-сосудистой системы',
    bestForm: 'Бета-глюкан 500 мг с едой 1x/д',
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
    synergies: [
        {with: "probiotics", effect: "Синбиотический эффект", mechanism: "Клетчатка — пребиотик", severity: "HIGH"},
        {with: "butyrate", effect: "Здоровье кишечника", mechanism: "Клетчатка → бутират", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "iron", effect: "Снижение всасывания", mechanism: "Фитаты связывают железо", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Стул', when: 'Субъективно' }
    ],
    contraindications: ['Кишечная непроходимость'],
    sideEffects: ['Вздутие при начале', 'Метеоризм'],
    dosage: { mg: 10000, timing: 'с едой 2x/д', form: 'псиллиум 5 г' },
    bestForCourse: false,
    targetOrgan: 'Толстый кишечник, микрофлора, гепатоциты',
    organMechanism: 'Связывание желчных кислот и воды в кишечнике, нормализация моторики',
    mechanismOfAction: 'Растворимая клетчатка → гидрофильная матрица → ↑ объём → ↑ перистальтика через 5HT4-рецепторы; связывание/выведение холестерина и желчных кислот; ферментация → SCFA → ↑ Treg (бутират → HDACi)',
    clinicalEffect: 'Нормализация стула, снижение холестерина и глюкозы, поддержка микробиома',
    bestForm: 'Псиллиум 10 г с водой 2x/д',
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
    synergies: [
        {with: "probiotics", effect: "Рост бифидобактерий", mechanism: "HMO — специфический пребиотик", severity: "HIGH"},
      ],
    conflicts: [
      { with: "pharma", effect: "Антибиотики широкого спектра подавляют рост бифидобактерий — снижение эффекта HMO", mechanism: "Уничтожение целевой микрофлоры", severity: "MEDIUM" },
      { with: "iron", effect: "Железо может способствовать росту патогенов, конкурирующих за HMO", mechanism: "Селективное давление на микробиом", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Микрофлора', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: вздутие при начале'],
    dosage: { mg: 1000, timing: 'с едой 1x/д', form: 'HMO пребиотик 1 г' },
    bestForCourse: false,
    targetOrgan: 'Микрофлора (Bifidobacterium), кишечный эпителий, нейроны энтеральной системы',
    organMechanism: 'Селективный пребиотик для Bifidobacterium, укрепление GUT-барьера',
    mechanismOfAction: '2′-FL/HMO → фукозидазы Bifidobacterium → фукоза → SCFA; ↑ Bifidobacterium (в 2-3x) → ↓ патогенов; ↓ связывания патогенов с эпителием (декои-рецептор); ↑ сиалил-олигосахариды → GNS-синтез',
    clinicalEffect: 'Рост полезной микрофлоры, укрепление иммунитета, здоровье оси кишечник-мозг',
    bestForm: 'HMO пребиотик 1 г с едой 1x/д',
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
    synergies: [
        {with: "probiotics", effect: "Среда для пробиотиков", mechanism: "Лактат — метаболит лактобактерий", severity: "LOW"},
      ],
    conflicts: [
      { with: "pharma", effect: "Избыток лактата может усиливать лактатацидоз при метформине", mechanism: "Метформин ингибирует глюконеогенез → ↑ лактат", severity: "HIGH" },
      { with: "sodium_bicarbonate", effect: "Буферизация снижает эффективность лактата как субстрата", mechanism: "Изменение pH → ↓ транспорта MCT", severity: "LOW" },
    ],
    monitoring: [
      { what: 'КФК', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'с едой 1x/д', form: 'лактат натрия 1000 мг' },
    bestForCourse: false,
    targetOrgan: 'Митохондрии мышц и печени (цикл Кори), микрофлора толстой кишки',
    organMechanism: 'Субстрат для глюконеогенеза и гликогенеза, энергетический носитель',
    mechanismOfAction: 'Лактат → MCT1/4 → LDH → пируват → TCA-цикл (энергия); цикл Кори: лактат → глюкоза (гепатоциты); в микробиоме → субстрат для кросс-фидинга (пропионат/бутират)',
    clinicalEffect: 'Поддержка восстановления после тренировки, улучшение митохондриальной функции',
    bestForm: 'Лактат натрия 1000 мг с едой 1x/д',
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
    synergies: [
        {with: "probiotics", effect: "Улучшение пищеварения", mechanism: "Ферменты расщепляют, пробиотики усваивают", severity: "MEDIUM"},
        {with: "betaine", effect: "Переваривание белков", mechanism: "Бетаин HCl + ферменты", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Ферменты снижают всасывание пероральных антибиотиков", mechanism: "Протеазы разрушают антибиотики-пептиды", severity: "MEDIUM" },
      { with: "orlistat", effect: "Орлистат ингибирует липазу — антагонизм действия", mechanism: "Конкуренция за сайт связывания липазы", severity: "HIGH" },
    ],
    monitoring: [
      { what: 'Пищеварение', when: 'Субъективно' }
    ],
    contraindications: ['Острый панкреатит'],
    sideEffects: ['Редко: изжога'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'пищеварительные ферменты 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Просвет тонкой кишки, поджелудочная железа',
    organMechanism: 'Гидролиз макронутриентов, улучшение абсорбции нутриентов',
    mechanismOfAction: 'Амилаза → крахмал → мальтоза/декстрины; протеаза → белки → пептиды/аминокислоты; липаза → ТГ → 2-МГ + жирные кислоты; целлюлаза → клетчатка → простые сахара',
    clinicalEffect: 'Улучшение переваривания и усвоения белка, снижение нагрузки на ЖКТ',
    bestForm: 'Пищеварительные ферменты 500 мг с едой 2x/д',
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
    synergies: [
        {with: "probiotics", effect: "Заживление слизистой ЖКТ", mechanism: "Цинк-карнозин + пробиотики", severity: "HIGH"},
        {with: "glutamine", effect: "Целостность кишечного барьера", mechanism: "Оба восстанавливают слизистую", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Антациды и ИПП снижают всасывание цинка", mechanism: "Повышение pH желудка → ↓ растворимость Zn", severity: "MEDIUM" },
      { with: "calcium", effect: "Кальций конкурирует с цинком за всасывание в тонкой кишке", mechanism: "Конкуренция за DMT1/ ZIP4", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Гастроскопия', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Острый панкреатит', 'Язвенная болезнь'],
    sideEffects: ['Редко: тошнота'],
    dosage: { mg: 75, timing: 'с едой 2x/д', form: 'цинк-карнозин 75 мг' },
    bestForCourse: false,
    targetOrgan: 'Слизистая желудка и тонкой кишки, иммунные клетки GALT',
    organMechanism: 'Заживление эрозий слизистой, укрепление плотных контактов энтероцитов',
    mechanismOfAction: 'Zn²⁺ → ↑ металлотионеин → ↓ перекисного окисления; карнозин → хелатирование Fe → ↓ OH⁰; ↑ синтез PGE₂ (цитопротекция); ↓ H. pylori адгезии; ↑ TGF-β → заживление язв',
    clinicalEffect: 'Заживление слизистой ЖКТ, защита от НПВС-гастропатии, укрепление кишечного барьера',
    bestForm: 'Цинк-карнозин 75 мг с едой 2x/д',
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
    synergies: [
        {with: "probiotics", effect: "Иммунитет кишечника", mechanism: "Молозиво + пробиотики", severity: "MEDIUM"},
        {with: "zinc_carnosine", effect: "Заживление ЖКТ", mechanism: "Оба содержат факторы роста", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Иммуноглобулины молозива могут снижать эффективность пероральных вакцин", mechanism: "Связывание антигенов вакцин", severity: "MEDIUM" },
      { with: "pancreatic_enzymes", effect: "Протеазы поджелудочной железы разрушают IgG молозива", mechanism: "Протеолиз", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Молочная аллергия'],
    sideEffects: ['Редко: вздутие при начале'],
    dosage: { mg: 3000, timing: 'с едой 2x/д', form: 'молозиво 3 г' },
    bestForCourse: false,
    targetOrgan: 'Иммунные клетки GALT, кишечный эпителий, скелетные мышцы',
    organMechanism: 'IgG/IgA пассивная защита, факторы роста → регенерация кишечника и мышц',
    mechanismOfAction: 'IgG/IgA → нейтрализация патогенов в просвете; TGF-β/IGF-1/EGF → → MAPK/ERK → ↑ пролиферация энтероцитов; ↓ TNF-α через ↓ TLR4; ↑ секреторный IgA через ↑ pIgR',
    clinicalEffect: 'Поддержка иммунитета, укрепление кишечного барьера, регенерация мышц',
    bestForm: 'Молозиво 3 г с едой 2x/д',
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
    synergies: [
        {with: "vitamin_d3", effect: "Иммунитет", mechanism: "Оба активируют NK-клетки", severity: "MEDIUM"},
        {with: "reishi", effect: "Грибная иммуномодуляция", mechanism: "Оба — иммуномодуляторы", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Антагонизм", mechanism: "AHCC стимулирует иммунитет", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'NK-клетки', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1000, timing: 'натощак 2x/д', form: 'AHCC 1000 мг' },
    bestForCourse: false,
    targetOrgan: 'Иммунные клетки (NK, макрофаги, дендритные), гепатоциты',
    organMechanism: 'Активация врождённого иммунитета, защита печени от токсинов',
    mechanismOfAction: 'α-глюкан → Dectin-1 → Syk/CARD9 → ↑ TNF-α, IL-12, NO; ↑ NK-цитотоксичность; ↓ FAS-опосредованного апоптоза гепатоцитов; ↓ NF-κB → ↓ IL-1β, IL-6',
    clinicalEffect: 'Усиление NK-активности, иммуномодуляция, защита печени',
    bestForm: 'AHCC 1000 мг натощак 2x/д',
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
    synergies: [
      { with: "ashwagandha", effect: "Ашваганда снижает кортизол — помогает интерпретировать уровень стресса", mechanism: "Модуляция HPA-оси через снижение CRH", severity: "MEDIUM" },
      { with: "phosphatidylserine", effect: "Фосфатидилсерин снижает утренний кортизол — синергия для оценки HPA-оси", mechanism: "Нормализация кортизолового ритма через ACTH", severity: "LOW" },
    ],
    conflicts: [
      { with: "pharma", effect: "Экзогенные глюкокортикоиды искажают уровень кортизола", mechanism: "Суппрессия HPA-оси", severity: "HIGH" },
      { with: "ashwagandha", effect: "Ашваганда снижает кортизол — возможна маскировка гиперкортицизма", mechanism: "Модуляция HPA-оси", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Кортизол утренний', when: 'Каждые 8 нед', targetRange: '6-23 мкг/дл' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Не препарат — маркер для контроля'],
    dosage: { mg: 0, timing: 'контроль маркера', form: 'кортизол сыворотки (анализ)' },
    bestForCourse: false,
    targetOrgan: 'Надпочечники (кора), печень, мышцы, иммунные клетки (маркер)',
    organMechanism: 'Катаболический эффект в мышцах, глюконеогенез в печени, подавление иммунитета',
    mechanismOfAction: 'Связывание с GR → транслокация → GRE → ↑ PEPCK/G6Pase → ↑ глюкоза; ↑ убиквитин-лигазы MuRF1/atrogin-1 → ↓ мышечной массы; ↓ NF-κB → ↓ IL-1/TNF-α (противовоспалительный)',
    clinicalEffect: 'Контроль уровня стресса на курсе, предотвращение катаболизма мышц',
    bestForm: 'Кортизол сыворотки (утренний анализ)',
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
    synergies: [
      { with: "magnesium", effect: "Магний снижает выделение адреналина — помогает оценить фоновую активность", mechanism: "Ингибиция высвобождения катехоламинов через Ca²⁺-каналы", severity: "MEDIUM" },
      { with: "taurine", effect: "Таурин модулирует симпатическую активность — синергия для стресс-оценки", mechanism: "Антагонизм к β-адренорецепторам", severity: "LOW" },
    ],
    conflicts: [
        {with: "pharma", effect: "Антагонизм", mechanism: "Бета-блокаторы блокируют адреналин", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Адреналин', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Не препарат — маркер для контроля'],
    dosage: { mg: 0, timing: 'контроль маркера', form: 'адреналин (анализ)' },
    bestForCourse: false,
    targetOrgan: 'β-адренорецепторы сердца, сосудов, бронхов (маркер)',
    organMechanism: 'Симпатическая активация, ↑ ЧСС, ↑ глюкозы, бронходилатация',
    mechanismOfAction: 'β1/2-AR → Gαs → ↑ цАМФ → ↑ PKA → ↑ Ca²⁺ в кардиомиоцитах (+ инотроп/хронотроп); ↑ липолиз через HSL; ↑ гликогенолиз через фосфорилазу; бронходилатация через ↓ MLCK',
    clinicalEffect: 'Оценка стресс-реакции и симпатической активации на курсе',
    bestForm: 'Адреналин (анализ)',
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
    synergies: [
      { with: "dim", effect: "DIM помогает интерпретировать метаболизм эстрогенов в профиле", mechanism: "Модуляция 2-OH/16α-OH пути эстрогенов", severity: "LOW" },
      { with: "zinc", effect: "Цинк важен для синтеза ЛГ/ФСГ — контекст для оценки гонадной оси", mechanism: "Кофактор ароматазы и 5α-редуктазы", severity: "LOW" },
    ],
    conflicts: [
      { with: "pharma", effect: "Экзогенные гормоны искажают результаты анализа", mechanism: "ААС/СЕРМ/ИА подавляют HPG-ось", severity: "HIGH" },
      { with: "cortisol", effect: "Стресс и кортизол влияют на весь эндокринный профиль", mechanism: "Перекрестная регуляция HPA/HPG осей", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Эндокринный профиль', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Не препарат — маркер для контроля'],
    dosage: { mg: 0, timing: 'контроль маркера', form: 'эндокринный профиль (анализ)' },
    bestForCourse: false,
    targetOrgan: 'Комплексный маркер: гонады, надпочечники, щитовидная железа, гипофиз',
    organMechanism: 'Оценка гормонального профиля: тестостерон, эстрадиол, кортизол, ТТГ, пролактин, ДГЭА',
    mechanismOfAction: 'Интегральная оценка осей HPG, HPA, HPT, выявление дисбаланса для коррекции курса и ПКТ',
    clinicalEffect: 'Контроль гормонального статуса на курсе, корректировка поддержки и ПКТ',
    bestForm: 'Эндокринный профиль (анализ)',
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
    synergies: [
        {with: "pregnenolone", effect: "Нейростероидный путь", mechanism: "Прегненолон — предшественник", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Экзогенные гормоны искажают уровень нейростероидов", mechanism: "Суппрессия HPG-оси", severity: "MEDIUM" },
      { with: "alcohol", effect: "Алкоголь изменяет метаболизм нейростероидов через ГАМК-А", mechanism: "Аллопрегнанолон + этанол", severity: "LOW" },
    ],
    monitoring: [
      { what: 'ДГЭА-S', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Не препарат — маркер для контроля'],
    dosage: { mg: 0, timing: 'контроль маркера', form: 'нейростероидный профиль (анализ)' },
    bestForCourse: false,
    targetOrgan: 'ГАМК-А рецепторы ЦНС, гипоталамус (маркер)',
    organMechanism: 'Позитивная аллостерическая модуляция ГАМК-А, нейропротекция, стресс-ответ',
    mechanismOfAction: 'Аллопрегнанолон → ↑ Cl⁻ ток через ГАМК-А (модуляция α4βδ) → анксиолиз; ДГЭА → антагонизм ГАМК-А → ↑ возбуждения; нейростероиды → ↑ миелинизации через ↑ OPCs',
    clinicalEffect: 'Оценка нейроэндокринного баланса, регуляция настроения и стресса',
    bestForm: 'Нейростероидный профиль (анализ)',
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
    synergies: [
        {with: "insulin", effect: "Баланс глюкозы", mechanism: "Антагонистическая регуляция", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "insulin", effect: "Антагонизм", mechanism: "Глюкагон повышает глюкозу, инсулин снижает", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Глюкагон', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Не препарат — маркер для контроля'],
    dosage: { mg: 0, timing: 'контроль маркера', form: 'глюкагон (анализ)' },
    bestForCourse: false,
    targetOrgan: 'β-клетки поджелудочной, гепатоциты (маркер)',
    organMechanism: 'Контр-инсулиновый гормон, ↑ глюкозы через гликогенолиз/глюконеогенез',
    mechanismOfAction: 'GCGR → Gαs → ↑ цАМФ → ↑ PKA → ↑ фосфорилазы (гликогенолиз); ↑ CREB → ↑ PEPCK/G6Pase (глюконеогенез); ↑ кетогенеза через ↑ CPT-1',
    clinicalEffect: 'Оценка метаболического профиля, регуляции глюкозы и кетогенеза',
    bestForm: 'Глюкагон (анализ)',
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
      { with: "resveratrol", effect: "NMN + Резвератрол — NAD+ + сиртуины", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "nmn", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "NMN может снижать эффективность химиотерапии (защита раковых клеток)", mechanism: "NAD+ — субстрат PARP, защита ДНК", severity: "HIGH" },
      { with: "nicotinic_acid", effect: "Избыточная нагрузка NAD+ — риск флушинга", mechanism: "Оба — предшественники NAD+", severity: "LOW" },
    ],
    monitoring: [
      { what: 'NAD+', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: желудочный дискомфорт при начале'],
    dosage: { mg: 500, timing: 'натощак 1x/д', form: 'NMN 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Митохондрии всех клеток, головной мозг',
    organMechanism: 'Предшественник NAD⁺, активация сиртуинов и PARP, митохондриальное дыхание',
    mechanismOfAction: 'NMN → NMNAT3 → NAD⁺ → SIRT1/3 → деацетилирование PGC-1α/FOXO3a → ↑ биогенез митохондрий; ↑ PARP1 → репарация ДНК; ↓ CD38 → ↓ потребления NAD⁺',
    clinicalEffect: 'Повышение уровня NAD⁺, улучшение митохондриальной функции, анти-возрастной эффект',
    bestForm: 'NMN 500 мг натощак 1x/д',
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
    organs: ['HEART', 'BRAIN', 'VESSELS'],
    systems: ['cardio', 'neuro'],
    mechanisms: ['EPA_ANTI_INFLAMMATORY', 'DHA_BRAIN_STRUCTURE', 'TRIGLYCERIDE_LOWERING', 'BLOOD_PRESSURE_REGULATION'],
    description: 'Омега-3 (EPA+DHA) — незаменимые жирные кислоты, кардиопротектор и нейропротектор. Снижает триглицериды и воспаление.',
    synergies: [
      { with: "pharma", effect: "Взаимодействие с фарма-препаратом — консультация врача", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "vitamin_d3", effect: "Омега-3 усиливает рецепторы витамина Д", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "coq10", effect: "КоКю10 + Омега-3 — кардиопротекция и митохондрии", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "phosphatidylcholine", effect: "Фосфатидилхолин + Омега-3 — фосфолипиды мозга", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "vitamin_e", effect: "Витамин Е защищает Омега-3 от перекисного окисления", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "astaxanthin", effect: "Астаксантин защищает Омега-3 от окисления", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "omega9", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "egcg", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "polyphenol_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "mushroom_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "vitamin_a", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "omega3", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "lutein", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "anthocyanins", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "antioxidant_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "peptide_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" },
      { with: "brand_complex", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
      { with: "pharma", effect: "Усиление антикоагулянтного эффекта — риск кровотечения", mechanism: "Комбинированное действие", severity: "LOW" }
    ],
    monitoring: [
      { what: 'Липидограмма', when: 'Каждые 8 нед', targetRange: 'ТГ<1.7 ммоль/л' }
    ],
    contraindications: ['Приём антикоагулянтов (с осторожностью)', 'Рыбная аллергия'],
    sideEffects: ['Рыбная отрыжка', 'Диарея при высоких дозах'],
    dosage: { mg: 2000, timing: 'с едой 2x/д', form: 'Омега-3 1000 мг EPA+DHA' },
    bestForCourse: true,
    targetOrgan: 'Кардиомиоциты, нейроны, сосудистый эндотелий',
    organMechanism: 'Синтез резольвинов и протектинов, структура нейрональных мембран, снижение синтеза триглицеридов в печени',
    mechanismOfAction: 'EPA → резольвины E1 (противовоспалительные липидные медиаторы), DHA → нейропротектин D1, снижение синтеза VLDL-ТГ в печени, встраивание DHA в синаптические мембраны',
    clinicalEffect: 'Снижение триглицеридов, противовоспалительный эффект, улучшение когнитивных функций, кардиопротекция',
    bestForm: 'Омега-3 1000 мг EPA+DHA 2 г 2x/д',
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
    synergies: [
        {with: "vitamin_c", effect: "Иммунитет", mechanism: "Оба поддерживают иммунитет", severity: "MEDIUM"},
        {with: "reishi", effect: "Адаптогенный и иммунный", mechanism: "Оба — иммуномодуляторы", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Антагонизм", mechanism: "Астрагал стимулирует иммунитет", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт астрагала 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Иммунные клетки, теломеры, клубочки почек',
    organMechanism: 'Активация теломеразы через TERT, иммуномодуляция через TLR4, нефропротекция',
    mechanismOfAction: 'Астрагалозид IV → ↑ hTERT → ↑ теломераза → удлинение теломер; ↑ CD4+/NK через TLR4/MyD88 → ↑ IFN-γ; ↓ TGF-β/Smad3 → ↓ почечного фиброза; ↑ SOD/GPx → ↓ окислительного стресса',
    clinicalEffect: 'Поддержка иммунитета, защита почек, замедление клеточного старения',
    bestForm: 'Экстракт астрагала 500 мг с едой 2x/д',
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
    synergies: [
        {with: "magnesium", effect: "Расслабление", mechanism: "Оба способствуют расслаблению", severity: "LOW"},
      ],
    conflicts: [
      { with: "pharma", effect: "Окситоцин повышает активность гладкой мускулатуры — риск при приёме спазмолитиков", mechanism: "Агонизм OXTR + антихолинергические", severity: "MEDIUM" },
      { with: "alcohol", effect: "Алкоголь подавляет секрецию окситоцина — снижение эффекта", mechanism: "Ингибирование нейросекреции", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Настроение', when: 'Субъективно' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: головная боль'],
    dosage: { mg: 0.04, timing: 'интраназально 1x/д', form: 'окситоцин 40 МЕ/доза' },
    bestForCourse: false,
    targetOrgan: 'Головной мозг (амигдала, гипоталамус), гладкая мускулатура матки/протоков',
    organMechanism: 'Активация окситоциновых рецепторов, ↑ чувства привязанности, ↓ тревожности',
    mechanismOfAction: 'OXTR → Gαq/11 → ↑ IP3 → ↑ Ca²⁺ → ↑ сокращение гладкой мускулатуры; ↑ щитовидной железы (окситоцин → ↑ T3/T4); ↓ HPA-оси → ↓ кортизола; ↑ BDNF в гиппокампе',
    clinicalEffect: 'Снижение тревоги, улучшение восстановления, социальное поведение',
    bestForm: 'Окситоцин 40 МЕ/доза интраназально 1x/д',
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
    synergies: [
        {with: "vitamin_d3", effect: "Гормональная поддержка", mechanism: "Оба поддерживают гормональный баланс", severity: "MEDIUM"},
        {with: "zinc", effect: "Синтез гормонов", mechanism: "Цинк необходим для стероидогенеза", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "hormone_sensitive_conditions", effect: "Риск при гормонозависимых опухолях", mechanism: "DHEA конвертируется в гормоны", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'ДГЭА-S', when: 'Каждые 8 нед', targetRange: '150-420 мкг/дл' }
    ],
    contraindications: ['Рак простаты', 'Рак молочной железы'],
    sideEffects: ['Акне при высоких дозах', 'У женщин: гирсутизм'],
    dosage: { mg: 25, timing: 'утром с едой', form: 'ДГЭА 25 мг' },
    bestForCourse: false,
    targetOrgan: 'Надпочечники (сетчатая зона), ЦНС, мышечная ткань',
    organMechanism: 'Предшественник половых гормонов, антагонизм кортизолу, нейропротекция',
    mechanismOfAction: 'DHEA → 3β-HSD → андростендиол → тестостерон/эстрадиол; ↑ NMDA-рецепторной активности через σ1-рецептор; ↑ биогенеза митохондрий через SIRT1; ↓ IL-6/TNF-α через ↓ NF-κB',
    clinicalEffect: 'Восстановление гормонального фона, улучшение настроения, поддержка либидо',
    bestForm: 'ДГЭА 25 мг утром с едой',
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
    synergies: [
        {with: "progesterone", effect: "Гормональный баланс", mechanism: "Эстрадиол + прогестерон — цикл", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "aromatase_inhibitor", effect: "Антагонизм", mechanism: "ИА подавляют эстрадиол", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Эстрадиол', when: 'Каждые 4 нед', targetRange: '10-40 пг/мл (муж.)' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Не препарат — маркер для контроля'],
    dosage: { mg: 0, timing: 'контроль маркера', form: 'эстрадиол (анализ)' },
    bestForCourse: false,
    targetOrgan: 'Гонады, костная ткань, эндотелий сосудов, гипоталамус (маркер)',
    organMechanism: 'Регуляция костной плотности через остеокласты, кардиопротекция через eNOS, модуляция ЛГ/ФСГ',
    mechanismOfAction: 'ERα/ERβ → ARE(ERE) → ↑ остеопротегерин → ↓ остекластов; ↑ eNOS через PI3K/Akt → ↑ NO; ↑ SHBG в печени → ↓ свободных андрогенов; ↓ GnRH (негативный фидбек)',
    clinicalEffect: 'Контроль уровня эстрадиола на курсе, профилактика гинекомастии',
    bestForm: 'Эстрадиол (анализ)',
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
    synergies: [
        {with: "estradiol", effect: "Баланс эстроген/прогестерон", mechanism: "Необходим для женского баланса", severity: "MEDIUM"},
        {with: "vitamin_b6", effect: "Снижение ПМС", mechanism: "B6 поддерживает прогестерон", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "holy_basil", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "HIGH" }
    ],
    monitoring: [
      { what: 'Прогестерон', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Не препарат — маркер для контроля'],
    dosage: { mg: 0, timing: 'контроль маркера', form: 'прогестерон (анализ)' },
    bestForCourse: false,
    targetOrgan: 'Гонады, ЦНС (маркер)',
    organMechanism: 'Модуляция ГнРГ/ЛГ, нейропротекция через PR-рецепторы',
    mechanismOfAction: 'PR-B → ARE/ERE → ↓ рецепторов эстрадиола; ↑ GABA через аллопрегнанолон → анксиолиз; ↓ GnRH/ЛГ (негативный фидбек); ↑ миелинизация через ↑ OPCs',
    clinicalEffect: 'Контроль гормонального баланса, оценка подавления оси ГРГ-ЛГ-ФСГ',
    bestForm: 'Прогестерон (анализ)',
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
      { with: "ipamorelin", effect: "Синергия: усиление взаимного эффекта", mechanism: "Комбинированное действие", severity: "MEDIUM" }
    ],
    conflicts: [
        {with: "pharma", effect: "Риск гипогликемии", mechanism: "Двойное снижение глюкозы", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Глюкоза', when: 'Каждые 4 нед', targetRange: '3.5-5.5 ммоль/л' }
    ],
    contraindications: ['Гипогликемия', 'Диабет типа 1'],
    sideEffects: ['Гипогликемия', 'Набор жира при избытке'],
    dosage: { mg: 0.01, timing: 'индивидуально п/к', form: 'инсулин (по назначению)' },
    bestForCourse: false,
    targetOrgan: 'Миоциты, адипоциты, гепатоциты',
    organMechanism: 'Анаболический гормон: ↑ глюкозного транспорта, ↑ синтеза белка и гликогена',
    mechanismOfAction: 'IR → IRS-1 → PI3K → Akt → ↑ GLUT4 транслокация; mTORC1 активация через TSC1/2 → ↑ синтез белка; ↓ FOXO → ↓ глюконеогенеза; ↑ гликогенсинтазы через ↓ GSK3β',
    clinicalEffect: 'Усиление анаболизма, транспорт глюкозы в мышцы, стимуляция синтеза белка',
    bestForm: 'По назначению врача',
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
    organs: ['KIDNEYS', 'BRAIN', 'VESSELS'],
    systems: ['renal', 'neuro'],
    mechanisms: ['WATER_RETENTION', 'BLOOD_PRESSURE_REGULATION', 'MEMORY_ENHANCEMENT', 'SOCIAL_BONDING'],
    description: 'Вазопрессин — антидиуретический гормон, регулирует водный баланс и память. На курсе — контроль гидратации.',
    synergies: [
        {with: "sodium", effect: "Водный баланс", mechanism: "Вазопрессин регулирует воду", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Вазопрессин может усиливать задержку воды при комбинации с НПВС", mechanism: "НПВС ингибируют синтез PG, усиление АДГ", severity: "HIGH" },
      { with: "magnesium", effect: "Магний снижает эффект вазопрессина в собирательных трубочках", mechanism: "Антагонизм V2-рецепторов", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Натрий/Осмолярность', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Синдром неадекватной секреции АДГ'],
    sideEffects: ['Задержка воды', 'Гипонатриемия'],
    dosage: { mg: 0.02, timing: 'интраназально 1x/д', form: 'вазопрессин интраназально' },
    bestForCourse: false,
    targetOrgan: 'Собирательные трубочки почек, ЦНС, сосудистый эндотелий',
    organMechanism: 'Регуляция водного баланса через V2-рецепторы почек, вазоконстрикция через V1A',
    mechanismOfAction: 'AVP → V2R (Gαs → ↑ цАМФ → ↑ AQP2 вставка → ↑ реабсорбция H₂O); V1aR (Gαq/11 → ↑ IP3 → ↑ Ca²⁺ → вазоконстрикция); V1bR (гипофиз → ↑ АКТГ)',
    clinicalEffect: 'Контроль водного баланса, улучшение социальной памяти и фокуса',
    bestForm: 'Вазопрессин интраназально 1x/д',
  },
endocannabinoid: {
    id: 'endocannabinoid',
    name: 'Palmitoylethanolamide (PEA)',
    nameRu: 'Пальмитоилэтаноламид (PEA)',
    tier: 'standard',
    category: ['immunomodulator'],
    forms: [
      { id: 'endocannabinoid', name: 'PEA', nameRu: 'PEA 400 мг', dose: '400 мг 2x/д', best: true }
    ],
    organs: ['BRAIN', 'IMMUNE_SYSTEM', 'GUT'],
    systems: ['neuro', 'immune', 'gastrointestinal'],
    mechanisms: ['PAIN_MODULATION', 'APPETITE_REGULATION', 'MOOD_REGULATION', 'ANTI_INFLAMMATORY'],
    description: 'PEA — эндогенный амид жирной кислоты, агонист PPAR-α. Модулирует эндоканнабиноидную систему, снижает боль и воспаление.',
    synergies: [
        {with: "omega3", effect: "Эндоканнабиноидная система", mechanism: "Омега-3 — предшественник", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "PEA может усиливать седацию при комбинации с анксиолитиками", mechanism: "PPAR-α активация + ГАМК-ергические препараты", severity: "MEDIUM" },
      { with: "ibuprofen", effect: "Конкуренция за PPAR-α — снижение противовоспалительного эффекта", mechanism: "Оба действуют через PPAR-α", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Настроение', when: 'Субъективно' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: седация'],
    dosage: { mg: 0, timing: 'поддержка системы', form: 'эндоканнабиноидная поддержка' },
    bestForCourse: false,
    targetOrgan: 'CB1/CB2-рецепторы ЦНС, иммунных клеток, ЖКТ',
    organMechanism: 'Модуляция эндоканнабиноидной системы (ECS): тонкий контроль боли, настроения и аппетита',
    mechanismOfAction: 'PEA → PPAR-α → ↓ NF-κB → ↓ IL-1β, IL-6; ↑ аллокативация TRPV1 → десенситизация → ↓ боли; ANandamide → CB1 → ↓ цАМФ → ↓ нейрональной возбудимости; 2-AG → CB1/2 → иммуномодуляция',
    clinicalEffect: 'Снижение боли и воспаления, улучшение настроения, модуляция аппетита',
    bestForm: 'PEA 400 мг 2x/д',
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
    synergies: [
        {with: "probiotics", effect: "Пребиотический эффект", mechanism: "Пектин — растворимая клетчатка", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Снижение всасывания", mechanism: "Пектин может связывать лекарства", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Холестерин', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Вздутие при высоких дозах'],
    dosage: { mg: 5000, timing: 'с едой 2x/д', form: 'пектин 5 г' },
    bestForCourse: false,
    targetOrgan: 'Толстая кишка, гепатоциты (энтерогепатическая циркуляция)',
    organMechanism: 'Связывание желчных кислот и токсинов, пребиотический эффект',
    mechanismOfAction: 'Растворимый пектин → ионообменная смола → связывание желчных кислот → ↓ энтерогепатической рециркуляции → ↑ экскреции холестерина; ферментация → SCFA (бутират); хелатирование Pb/Hg → детокс',
    clinicalEffect: 'Детоксикация, снижение холестерина, поддержка микробиома',
    bestForm: 'Пектин 5 г с едой 2x/д',
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
    synergies: [
        {with: "zinc", effect: "Поддержка тестостерона", mechanism: "Оба способствуют тестостерону", severity: "MEDIUM"},
        {with: "ashwagandha", effect: "Либидо и тестостерон", mechanism: "Разные механизмы", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Фадогия стимулирует ЛГ — возможна интерференция с гормональной терапией", mechanism: "Агонизм GnRH/ЛГ", severity: "MEDIUM" },
      { with: "tribulus", effect: "Избыточная стимуляция ЛГ — возможна рефрактерность рецепторов", mechanism: "Оба стимулируют тестостерон через разные пути", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Тестостерон', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Беременность', 'Подростки'],
    sideEffects: ['Редко: желудочный дискомфорт при начале'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт фадогии 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Гонады (клетки Лейдига), гипофиз (гонадотропы)',
    organMechanism: 'Стимуляция ЛГ → ↑ тестостерон, ↑ либидо через андрогены',
    mechanismOfAction: 'Алкалоиды фадогии (фадогин) → ↑ GnRH-стимуляции → ↑ ЛГ → ↑ StAR/SCC → ↑ тестостерон в клетках Лейдига; ↑ PDE5 → ↑ NO → ↑ либидо/эрекции',
    clinicalEffect: 'Повышение тестостерона, улучшение либидо и восстановления',
    bestForm: 'Экстракт фадогии 500 мг с едой 2x/д',
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
    synergies: [
        {with: "dhea", effect: "Нейростероидный каскад", mechanism: "Прегненолон → DHEA → гормоны", severity: "HIGH"},
        {with: "vitamin_c", effect: "Стероидогенез", mechanism: "C — кофактор стероидогенеза", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Прегненолон может изменять метаболизм гормональных препаратов", mechanism: "Конкуренция за CYP17/3β-HSD", severity: "MEDIUM" },
      { with: "progesterone", effect: "Избыточная нейростероидная нагрузка", mechanism: "Прегненолон → прогестероновый каскад", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Прегненолон/Кортизол', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Рак гормонозависимый'],
    sideEffects: ['Редко: бессонница при вечернем приёме'],
    dosage: { mg: 50, timing: 'утром с едой', form: 'прегненолон 50 мг' },
    bestForCourse: false,
    targetOrgan: 'Надпочечники, нейроны ЦНС, гипофиз',
    organMechanism: 'Прегормон → каскад стероидогенеза, нейростероид → модуляция ГАМКА/AMPA',
    mechanismOfAction: 'Прегненолон → 3β-HSD/17α-OH → ДГЭА → андрогены; ↑ MAPK/ERK → ↑ нейрогенез; модуляция ГАМКА-рецепторов (α1β2γ2) → анксиолиз/антидепрессия; ↑ BDNF через CREB',
    clinicalEffect: 'Улучшение памяти и настроения, снижение кортизола, поддержка стероидогенеза',
    bestForm: 'Прегненолон 50 мг утром с едой',
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
    synergies: [
        {with: "vitamin_c", effect: "Иммунитет", mechanism: "Оба поддерживают иммунитет", severity: "MEDIUM"},
        {with: "zinc", effect: "Иммунитет", mechanism: "Оба — иммуномодуляторы", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Иммуностимуляция может снижать эффективность иммуносупрессоров", mechanism: "Антагонизм с иммуносупрессорами", severity: "HIGH" },
      { with: "autoimmune_disease", effect: "Возможное обострение аутоиммунных заболеваний", mechanism: "Стимуляция Th1/Th2", severity: "MEDIUM" },
    ],
    monitoring: [
      { what: 'Общий анализ крови', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Индивидуальная непереносимость', 'Беременность и лактация'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 1, timing: 'с едой 1x/д', form: 'иммунный комплекс 1 капсула' },
    bestForCourse: false,
    targetOrgan: 'Иммунная система (костный мозг, лимфоузлы, селезёнка)',
    organMechanism: 'Общее укрепление иммунитета через витамины C/D, цинк, селен',
    mechanismOfAction: 'Vit C → ↑ фагоцитоз/хемотаксис нейтрофилов; Vit D → ↑ кателицидин/β-дефензины; Zn → ↑ тимулина → ↑ T-клеток; Se → ↑ GPx/селенопротеинов → ↑ антиоксидантной защиты',
    clinicalEffect: 'Укрепление иммунитета на курсе, профилактика инфекций',
    bestForm: 'Иммунный комплекс 1 капсула с едой 1x/д',
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
    synergies: [
        {with: "vitamin_c", effect: "Иммунитет при простуде", mechanism: "Оба — иммуномодуляторы", severity: "MEDIUM"},
        {with: "zinc", effect: "Противовирусная активность", mechanism: "Оба подавляют вирусы", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Антагонизм", mechanism: "Андрографис стимулирует иммунитет", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'АЛТ/АСТ', when: 'Каждые 8 нед' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 200, timing: 'с едой 2x/д', form: 'экстракт андографиса 200 мг' },
    bestForCourse: false,
    targetOrgan: 'Иммунные клетки (NK, макрофаги), гепатоциты',
    organMechanism: 'Активация врождённого иммунитета, гепатопротекция через ↑ Nrf2',
    mechanismOfAction: 'Андрографолид → ↑ p38 MAPK/NF-κB → ↑ TNF-α/IL-12 → ↑ NK; ↑ HO-1/NQO1 через Nrf2 → ↓ окислительного стресса; ↓ TGF-β → ↓ фиброза печени; ↓ NF-κB → ↓ IL-1β',
    clinicalEffect: 'Стимуляция иммунитета, защита печени, противовоспалительное действие',
    bestForm: 'Экстракт андрографиса 200 мг с едой 2x/д',
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
    synergies: [
        {with: "curcumin", effect: "Двойное подавление воспаления", mechanism: "Босвеллия — 5-LOX, куркумин — COX-2", severity: "HIGH"},
        {with: "glucosamine", effect: "Здоровье суставов", mechanism: "Противовоспалительное + структурное", severity: "MEDIUM"},
        {with: "msm", effect: "Противовоспалительное для суставов", mechanism: "Оба снижают воспаление", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Аддитивный GI-риск при НПВП", mechanism: "Босвеллия ингибирует COX/LOX пути", severity: "MEDIUM" },
      { with: "pharma", effect: "Потенцирование антикоагулянтов", mechanism: "Босвеллия может замедлять свёртываемость", severity: "MEDIUM" },
      { with: "pharma", effect: "Снижение эффективности иммуносупрессоров", mechanism: "Босвеллия модулирует иммунитет", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Суставы', when: 'Субъективно' }
    ],
    contraindications: ['Аутоиммунные заболевания (с осторожностью)'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт босвеллии 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Суставы (синовиальная оболочка), лёгочная ткань, ЦНС',
    organMechanism: 'Ингибирование 5-липоксигеназы, снижение лейкотриенов в очаге воспаления',
    mechanismOfAction: 'AKBA (3-O-ацетил-11-кето-β-босвеллиевая кислота) → ↓ 5-LOX (Fe-активного центра) → ↓ LTB4/LTC4; ↓ NF-κB → ↓ COX-2/iNOS; ↓ MMPs (MMP-1,3,9) → ↓ деградации хряща; ↑ β2-AR → бронходилатация',
    clinicalEffect: 'Снижение боли и воспаления в суставах, улучшение подвижности, поддержка лёгких',
    bestForm: 'Экстракт босвеллии 500 мг с едой 2x/д (стандартизован 10% AKBA)',
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
    synergies: [
        {with: "vitamin_c", effect: "Заживление костей и связок", mechanism: "Оба поддерживают коллаген", severity: "MEDIUM"},
        {with: "calcium", effect: "Минерализация костей", mechanism: "Циссус + Кальций — костная поддержка", severity: "MEDIUM"},
        {with: "bpc157", effect: "Заживление связок", mechanism: "Оба стимулируют регенерацию", severity: "MEDIUM"},
      ],
    conflicts: [
      { with: "pharma", effect: "Потенцирование антикоагулянтов (теоретически)", mechanism: "Циссус может влиять на гемостаз", severity: "LOW" },
      { with: "pharma", effect: "Аддитивный GI-риск при НПВП", mechanism: "Комбинированное противовоспалительное действие", severity: "LOW" },
    ],
    monitoring: [
      { what: 'Кальций/Кости', when: 'Каждые 12 нед' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: желудочный дискомфорт'],
    dosage: { mg: 500, timing: 'с едой 2x/д', form: 'экстракт циссуса 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Кости (остеобласты), суставы (фибробласты), скелетные мышцы',
    organMechanism: 'Стимуляция синтеза коллагена, заживление костной ткани, анти-катаболический эффект',
    mechanismOfAction: 'Кетостероны → ↑ BMP-2/7 → ↑ остеогенез; ↑ коллаген I типа через ↑ COL1A1/TGF-β; ↓ NF-κB → ↓ IL-6/MMP-1 → ↓ резорбции хряща; ↓ кортизол-опосредованного катаболизма',
    clinicalEffect: 'Ускорение заживления костей и связок, защита суставов, противовоспалительный эффект',
    bestForm: 'Экстракт циссуса 500 мг с едой 2x/д',
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
    synergies: [
        {with: "milk_thistle", effect: "Гепатопротекция", mechanism: "Оба защищают печень", severity: "MEDIUM"},
        {with: "probiotics", effect: "Защита слизистой желудка", mechanism: "Солодка — гастропротектор", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Повышение давления", mechanism: "Солодка задерживает натрий и воду", severity: "HIGH"},
      ],
    monitoring: [
      { what: 'Калий/АД', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Гипертония', 'Гипокалиемия'],
    sideEffects: ['Задержка натрия/воды', 'Повышение АД при длительном'],
    dosage: { mg: 500, timing: 'с едой 2x/д (макс 6 нед)', form: 'экстракт солодки 500 мг' },
    bestForCourse: false,
    targetOrgan: 'Печень (гепатоциты), надпочечники, слизистая ЖКТ',
    organMechanism: 'Гепатопротекция через 11β-HSD2, гастропротекция через ↑ PGE2',
    mechanismOfAction: 'Глицирризиновая кислота → ↓ 11β-HSD2 → ↑ кортизол в тканях → противовоспаление; ↓ NF-κB → ↓ TNF-α/IL-6; ↑ PGE2/EGF → ↑ заживление язв желудка; ↓ CYP3A4 → ↑ AUC некоторых ксенобиотиков',
    clinicalEffect: 'Защита печени, поддержка надпочечников, заживление слизистой ЖКТ',
    bestForm: 'Экстракт солодки 500 мг с едой 2x/д (макс 6 нед)',
  },
antacid: {
    id: 'antacid',
    name: 'Antacid',
    nameRu: 'Антацид',
    tier: 'standard',
    category: ['gut', 'pharma'],
    forms: [
      { id: 'antacid', name: 'Antacid', nameRu: 'Антацид 1000 мг', dose: '1 г 2x/д', best: true },
      { id: 'antacid_2', name: 'Antacid', nameRu: 'Антацид + ИПП комплекс', dose: '1 г', best: false }
    ],
    organs: ['STOMACH', 'GUT'],
    systems: ['gastrointestinal'],
    mechanisms: ['ACID_NEUTRALIZATION', 'GASTRIC_PROTECTION', 'HEARTBURN_RELIEF', 'ESOPHAGUS_PROTECTION'],
    description: 'Антацид — нейтрализует желудочную кислоту, снимает изжогу и защищает пищевод. На курсе — ЖКТ защита при НПВС.',
    synergies: [
        {with: "zinc_carnosine", effect: "Защита желудка", mechanism: "Антацид + цинк-карнозин", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "iron", effect: "Снижение всасывания Fe", mechanism: "Антациды блокируют Fe", severity: "MEDIUM"},
        {with: "vitamin_b12", effect: "Снижение всасывания B12", mechanism: "Антациды нарушают B12", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'Гастроскопия', when: 'Субъективно' }
    ],
    contraindications: ['Почечная недостаточность'],
    sideEffects: ['Запор или диарея (зависит от типа)'],
    dosage: { mg: 1000, timing: 'через 1 ч после еды', form: 'антацид 1000 мг' },
    bestForCourse: false,
    targetOrgan: 'Слизистая желудка, нижний пищеводный сфинктер',
    organMechanism: 'Нейтрализация HCl, повышение pH желудка, защита слизистой',
    mechanismOfAction: 'CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂ → pH↑; Al(OH)₃ + 3HCl → AlCl₃ + 3H₂O → pH↑; ↑ PGE2 → ↑ слизи и бикарбоната; ↓ пепсиновой активности при pH>4',
    clinicalEffect: 'Быстрое снятие изжоги, защита пищевода и желудка',
    bestForm: 'Антацид 1 г при необходимости после еды',
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
    synergies: [
        {with: "cjc1295", effect: "GH-IGF-1 каскад", mechanism: "CJC-1295 стимулирует GH → IGF-1", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Риск гипогликемии с антидиабетиками", mechanism: "ИФР-1 имеет инсулиноподобную активность", severity: "HIGH"},
        {with: "pharma", effect: "Антагонизм с гормональной терапией", mechanism: "Экзогенный ИФР-1 подавляет эндогенный ГР", severity: "MEDIUM"},
        {with: "pharma", effect: "Аддитивное снижение АД", mechanism: "ИФР-1 стимулирует NO", severity: "LOW"},
      ],
    monitoring: [
      { what: 'ИФР-1', when: 'Каждые 4 нед', targetRange: '150-450 нг/мл' }
    ],
    contraindications: ['Активный онкологический процесс', 'Беременность'],
    sideEffects: ['Риск гипогликемии', 'Покраснение в месте инъекции'],
    dosage: { mg: 0.1, timing: 'индивидуально п/к', form: 'ИФР-1 100 мкг' },
    bestForCourse: false,
    targetOrgan: 'Мышцы, печень, кости, хрящи',
    organMechanism: 'Анаболический сигналинг, IGF-1R активация',
    mechanismOfAction: 'Агонизм IGF-1 рецепторов (тирозинкиназа); активация PI3K/Akt и MAPK/ERK; стимуляция синтеза белка через mTORC1; повышенение пролиферации хондроцитов и остеобластов; ингибирование апоптоза',
    clinicalEffect: 'Увеличение мышечной массы, улучшение восстановления, анаболический эффект',
    bestForm: 'IGF-1 40 мкг 2x/д',
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
    synergies: [
        {with: "igf1", effect: "Рост и восстановление мышц", mechanism: "MGF — изоформа IGF-1", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Антагонизм с гормональной терапией", mechanism: "Экзогенные гормоны влияют на IGF-1 ось", severity: "MEDIUM"},
      ],
    monitoring: [
      { what: 'ИФР-1', when: 'Каждые 4 нед' }
    ],
    contraindications: ['Активный онкологический процесс'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 0.2, timing: 'после тренировки п/к', form: 'MGF 200 мкг' },
    bestForCourse: false,
    targetOrgan: 'Мышцы, сателлитные клетки',
    organMechanism: 'Механический рост мышц, миогенез',
    mechanismOfAction: 'Связывание с IGF-1R и MGF-специфичными рецепторами; активация PI3K/Akt; стимуляция пролиферации сателлитных клеток; индукция миогенеза через MyoD и миогенин; локальный анаболизм',
    clinicalEffect: 'Локальный рост мышц в месте инъекции, гипертрофия, восстановление',
    bestForm: 'MGF 100 мкг 2x/нед',
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
    synergies: [
        {with: "bpc157", effect: "Заживление кишечника", mechanism: "Оба — пептиды для ЖКТ", severity: "MEDIUM"},
        {with: "probiotics", effect: "Восстановление слизистой", mechanism: "KPV + пробиотики — барьер", severity: "MEDIUM"},
      ],
    conflicts: [
        {with: "pharma", effect: "Антагонизм с иммуносупрессорами", mechanism: "KPV обладает противовоспалительной активностью", severity: "LOW"},
      ],
    monitoring: [
      { what: 'Воспалительные маркеры', when: 'Субъективно' }
    ],
    contraindications: ['Беременность'],
    sideEffects: ['Редко: покраснение в месте инъекции'],
    dosage: { mg: 0.5, timing: '1x/д п/к', form: 'KPV 500 мкг' },
    bestForCourse: false,
    targetOrgan: 'Кожа, иммунная система',
    organMechanism: 'Антимикробный пептид, иммуномодуляция, заживление',
    mechanismOfAction: 'Связывание с TLR-2/6 на кератиноцитах; стимуляция продукции β-дефензинов и кателицидинов; хемотаксис нейтрофилов и моноцитов; ускорение реэпителизации ран',
    clinicalEffect: 'Ускорение заживления ран, антимикробная защита, улучшение состояния кожи',
    bestForm: 'KPV 50 мг 2x/д',
  },
  "PHARMA_ANASTROZOLE": {
    id: 'PHARMA_ANASTROZOLE', name: 'Anastrozole', nameRu: 'Анастразол',
    tier: 'specialty', category: ['hormonal', 'pharma'],
    forms: [{ id: 'pharma_anastrozole', name: 'Anastrozole', nameRu: 'Анастразол 1 мг', dose: '1 мг 1x/д', best: true }],
    organs: ['ENDOCRINE', 'REPRODUCTIVE', 'LIVER'],
    systems: ['endocrine', 'reproductive', 'hepatic'],
    mechanisms: ['AROMATASE_INHIBITION', 'E2_SUPPRESSION', 'LIPID_PROFILE_ALTERATION'],
    description: 'Ингибитор ароматазы — снижает конверсию андрогенов в эстрогены. Применяется для контроля E2 на курсе ААС. Взаимодействие с липидным профилем.',
    dosage: { mg: 1, timing: '1x/д', form: 'таб' },
    bestForCourse: true,
    synergies: [{with:'tamoxifen',effect:'Контроль эстрогена',mechanism:'AI+СЕРМ',severity:'MEDIUM'},{with:'zinc',effect:'Поддержка тестостерона',mechanism:'Zn+AI',severity:'LOW'}],
    conflicts: [{with:'letrozole',effect:'Конкуренция за CYP19',mechanism:'Оба AI',severity:'LOW'}],
    monitoring: [{what:'Эстрадиол (E2)',when:'Каждые 4 нед',targetRange:'20-40 пг/мл'},{what:'ЛПВП',when:'Каждые 8 нед',targetRange:'> 40 мг/дл'},{what:'IGF-1',when:'Каждые 12 нед',targetRange:'> 150 нг/мл'}],
    contraindications: ['Остеопороз','Тяжелая гиперлипидемия','Беременность'],
    sideEffects: ['Снижение ЛПВП', 'Артралгия', 'Головная боль'],
    targetOrgan: 'Жировая ткань (ароматаза в адипоцитах), молочные железы, печень (гепатоциты), костная ткань',
    organMechanism: 'Ингибирование ароматазы CYP19, подавление конверсии андрогенов в эстрогены',
    mechanismOfAction: 'Конкурентное ингибирование ароматазы (CYP19A1) — блокирует превращение тестостерона в E2 и андростендиона в эстрон; снижение E2 в сыворотке на ~80%; повышение ЛГ/ФСГ через снятие отрицательной обратной связи; влияние на липидный профиль (снижение ЛПВП)',
    clinicalEffect: 'Контроль эстрадиола на курсе ААС, профилактика гинекомастии, подавление эстроген-зависимых процессов',
    bestForm: 'Анастразол 1 мг/д при необходимости',
  },
   "PHARMA_LETROZOLE": {
    id: 'PHARMA_LETROZOLE', name: 'Letrozole', nameRu: 'Летрозол',
    tier: 'specialty', category: ['hormonal', 'pharma'],
    forms: [{ id: 'pharma_letrozole', name: 'Letrozole', nameRu: 'Летрозол 2.5 мг', dose: '2.5 мг 1x/д', best: true }],
    organs: ['ENDOCRINE', 'REPRODUCTIVE', 'LIVER', 'BONES'],
    systems: ['endocrine', 'reproductive', 'hepatic', 'musculoskeletal'],
    mechanisms: ['AROMATASE_INHIBITION', 'E2_SUPPRESSION', 'IGF1_DECREASE'],
    description: 'Мощный ингибитор ароматазы III поколения. Блокирует превращение андрогенов в эстрогены в жировой и мышечной ткани. Применяется при гинекомастии и контроле E2.',
    dosage: { mg: 2.5, timing: '1x/д', form: 'таб' },
    bestForCourse: true,
    synergies: [{with:'vitamin_d3',effect:'Защита костей',mechanism:'D3+K2',severity:'MEDIUM'},{with:'calcium',effect:'Костная поддержка',mechanism:'AI+кальций',severity:'MEDIUM'}],
    conflicts: [
      { with: "pharma_anastrozole", effect: "Избыточное подавление эстрадиола (>95%) — риск остеопороза", mechanism: "Два AI — аддитивный эффект", severity: "HIGH" },
      { with: "tamoxifen", effect: "Конкуренция за CYP — снижение эффективности тамоксифена", mechanism: "Тамоксифен требует CYP2A6/3A4", severity: "MEDIUM" },
    ],
    monitoring: [{what:'Эстрадиол (E2), ultra-sensitive',when:'Каждые 4 нед',targetRange:'10-20 пг/мл'},{what:'Липидный профиль',when:'Каждые 8 нед',targetRange:'ЛПВП > 35 мг/дл'},{what:'DEXA (плотность костей)',when:'Каждые 12 мес',targetRange:'T-score > -1'},{what:'IGF-1',when:'Каждые 8 нед',targetRange:'> 150 нг/мл'}],
    contraindications: ['Остеопороз','Тяжелая гиперлипидемия','Печеночная недостаточность'],
    sideEffects: ['Снижение ЛПВП', 'Артралгия', 'Остеопороз при длительном приёме'],
    targetOrgan: 'Жировая ткань (ароматаза), костная ткань (остеобласты), молочные железы, печень',
    organMechanism: 'Мощное ингибирование ароматазы CYP19, подавление конверсии андрогенов в эстрогены',
    mechanismOfAction: 'Необратимое ингибирование ароматазы (CYP19A1) — связывание с гемом цитохрома P450; снижение E2 на 95-99%; повышение тестостерона за счет снятия отрицательной обратной связи; снижение IGF-1; влияние на костный метаболизм (снижение минерализации)',
    clinicalEffect: 'Мощный контроль эстрадиола на курсе ААС, подавление гинекомастии',
    bestForm: 'Летрозол 2.5 мг/д краткосрочно',
  },
   "PHARMA_CLOMIPHENE": {
    id: 'PHARMA_CLOMIPHENE', name: 'Clomiphene', nameRu: 'Кломифен',
    tier: 'specialty', category: ['hormonal', 'pharma'],
    forms: [{ id: 'pharma_clomiphene', name: 'Clomiphene', nameRu: 'Кломифен 50 мг', dose: '50 мг 1x/д', best: true }],
    organs: ['ENDOCRINE', 'PITUITARY', 'REPRODUCTIVE', 'LIVER'],
    systems: ['endocrine', 'reproductive', 'neuro'],
    mechanisms: ['SERM_ACTIVITY', 'LH_STIMULATION', 'FSH_STIMULATION', 'HPTA_RESTORATION'],
    description: 'Селективный модулятор эстрогеновых рецепторов (SERM). Блокирует ER в гипоталамусе → повышение GnRH → стимуляция ЛГ/ФСГ. Применяется для ПКТ и восстановления HPTA.',
    dosage: { mg: 50, timing: '1x/д', form: 'таб' },
    bestForCourse: true,
    synergies: [{with:'zinc',effect:'Поддержка тестостерона',mechanism:'Кломифен+Zn',severity:'MEDIUM'},{with:'vitamin_d3',effect:'Общее здоровье HPTA',mechanism:'Кломифен+D3',severity:'LOW'}],
    conflicts: [{with:'alcohol',effect:'Гепатотоксичность',mechanism:'Кломифен+алкоголь',severity:'MEDIUM'}],
    monitoring: [{what:'Эстрадиол (E2)',when:'Каждые 4 нед',targetRange:'20-40 пг/мл'},{what:'ЛГ/ФСГ',when:'Каждые 4 нед',targetRange:'ЛГ 2-8, ФСГ 2-12'}],
    contraindications: ['Гепатоцеллюлярная недостаточность','Киста яичника','Тромбофилия'],
    sideEffects: ['Нарушение зрения', 'Головная боль', 'Желудочно-кишечные расстройства'],
    targetOrgan: 'Гипоталамус (дугообразное ядро), гипофиз (гонадотрофы), яички (клетки Лейдига)',
    organMechanism: 'Блокада эстрогеновых рецепторов в гипоталамусе, стимуляция гонадотропной оси',
    mechanismOfAction: 'Антагонизм к ER-α в гипоталамусе → снятие отрицательной обратной связи E2; повышение GnRH (гонадолиберин); стимуляция секреции ЛГ/ФСГ гипофизом; активация клеток Лейдига → повышение тестостерона; частичный агонизм ER-β в костной ткани',
    clinicalEffect: 'Восстановление HPTA, повышение ЛГ/ФСГ и тестостерона, ПКТ',
    bestForm: 'Кломифен 50 мг/д курсом 4-6 нед',
  },
   "PHARMA_ENCLOMIPHENE": {
    id: 'PHARMA_ENCLOMIPHENE', name: 'Enclomiphene', nameRu: 'Энкломифен',
    tier: 'specialty', category: ['hormonal', 'pharma'],
    forms: [{ id: 'pharma_enclomiphene', name: 'Enclomiphene', nameRu: 'Энкломифен 25 мг', dose: '25 мг 1x/д', best: true }],
    organs: ['ENDOCRINE', 'PITUITARY', 'REPRODUCTIVE'],
    systems: ['endocrine', 'reproductive', 'neuro'],
    mechanisms: ['SERM_ACTIVITY', 'LH_STIMULATION', 'HPTA_RESTORATION'],
    description: 'Чистый изомер кломифена (транс-изомер). Без цитратного компонента, меньше побочных эффектов. Высокая эффективность в ПКТ и восстановлении эндогенного тестостерона.',
    dosage: { mg: 25, timing: '1x/д', form: 'таб' },
    bestForCourse: true,
    synergies: [{with:'zinc',effect:'Синергия для HPTA',mechanism:'Энкломифен+Zn',severity:'MEDIUM'},{with:'vitamin_d3',effect:'Общий анаболический фон',mechanism:'Энкломифен+D3',severity:'LOW'}],
    conflicts: [{with:'tamoxifen',effect:'Конкуренция за ER',mechanism:'Оба SERM',severity:'LOW'}],
    monitoring: [{what:'Тестостерон общий',when:'Каждые 4 нед',targetRange:'> 450 нг/дл'},{what:'Эстрадиол',when:'Каждые 4 нед',targetRange:'20-40 пг/мл'}],
    contraindications: ['Тромбофилия','Опухоли гипофиза','Выраженная гиперпролактинемия'],
    sideEffects: ['Меньше побочных по сравнению с кломифеном', 'Редко: головная боль'],
    targetOrgan: 'Гипоталамус (дугообразное ядро), гипофиз (гонадотрофы), яички (клетки Лейдига)',
    organMechanism: 'Блокада ER-α в гипоталамусе, стимуляция гонадотропной оси (без цитратного компонента)',
    mechanismOfAction: 'Чистый антагонист ER-α (транс-изомер) — снятие отрицательной обратной связи E2; повышение GnRH; стимуляция ЛГ/ФСГ; активация клеток Лейдига; минимальное накопление в жировой ткани (отличие от кломифена); отсутствие цитратного компонента (меньше побочных)',
    clinicalEffect: 'Восстановление HPTA, повышение тестостерона, ПКТ с меньшими побочными эффектами',
    bestForm: 'Энкломифен 25 мг/д курсом 4-6 нед',
  },
   "IMMUNE_LACTOFERRIN": {
    id: 'IMMUNE_LACTOFERRIN', name: 'Lactoferrin', nameRu: 'Лактоферрин',
    tier: 'core', category: ['immunomodulator', 'antioxidant', 'antimicrobial'],
    forms: [{ id: 'immune_lactoferrin', name: 'Lactoferrin', nameRu: 'Лактоферрин 500 мг', dose: '500 мг 2x/д', best: true }],
    organs: ['IMMUNE_SYSTEM', 'GUT', 'BLOOD'],
    systems: ['immune', 'gastrointestinal', 'hematologic'],
    mechanisms: ['IMMUNE_MODULATION', 'IRON_CHELATION', 'ANTIMICROBIAL', 'ANTI_INFLAMMATORY', 'GUT_BARRIER_STRENGTHENING'],
    description: 'Железосвязывающий гликопротеин из молозива. Связывает свободное железо → подавляет рост патогенов. Модулирует иммунный ответ, снижает системное воспаление, защищает барьер кишечника.',
    dosage: { mg: 1000, timing: '2x/д', form: 'капс' },
    bestForCourse: true,
    synergies: [{with:'colostrum',effect:'Иммунный комплекс',mechanism:'Лактоферрин+IgG',severity:'MEDIUM'},{with:'probiotics',effect:'Защита микробиома',mechanism:'Лактоферрин+пробиотики',severity:'MEDIUM'},{with:'vitamin_c',effect:'Усиление антимикробной активности',mechanism:'Лактоферрин+вит.C',severity:'LOW'}],
    conflicts: [{with:'iron_supplements',effect:'Снижение доступности железа',mechanism:'Хелация железа',severity:'MEDIUM'}],
    monitoring: [{what:'Ферритин',when:'Каждые 8 нед',targetRange:'> 30 нг/мл'},{what:'СРБ',when:'Каждые 8 нед',targetRange:'< 3 мг/л'}],
    contraindications: ['Гемохроматоз','Гиперчувствительность'],
    sideEffects: ['Диспепсия','Изменение вкуса'],
    targetOrgan: 'Иммунные клетки (макрофаги, нейтрофилы), эпителий кишечника (энтероциты), слизистые оболочки',
    organMechanism: 'Иммуномодуляция, хелатирование железа (бактериостаз), укрепление кишечного барьера',
    mechanismOfAction: 'Хелатирование свободного Fe³⁺ (лишение патогенов железа); связывание LPS (липополисахаридов) на мембране грам-отрицательных бактерий; модуляция TLR4/NF-κB → снижение ФНО-α и ИЛ-6; повышение IgA на слизистых; индукция апоптоза в опухолевых клетках; укрепление tight junctions (клаудины, окклюдины)',
    clinicalEffect: 'Подавление патогенной микрофлоры, иммуномодуляция, снижение воспаления, защита кишечного барьера',
    bestForm: 'Лактоферрин 500 мг 2x/д',
  },
   NAC: {
    id: 'NAC',
    name: 'N-Acetylcysteine',
    nameRu: 'N-Ацетилцистеин (NAC)',
    tier: 'core',
    category: ['antioxidant', 'hepatoprotector', 'anti_inflammatory'],
    forms: [
      { id: 'nac_600', name: 'NAC 600mg', nameRu: 'NAC 600 мг', dose: '600 мг 2x/д', best: true },
      { id: 'nac_1000', name: 'NAC 1000mg', nameRu: 'NAC 1000 мг', dose: '1000 мг/д', best: false },
      { id: 'nac_effervescent', name: 'NAC Effervescent', nameRu: 'NAC шипучий', dose: '600 мг 2x/д', best: false }
    ],
    organs: ['LIVER', 'LUNGS', 'BLOOD', 'KIDNEYS'],
    systems: ['hepatic', 'respiratory', 'hematologic', 'renal'],
    mechanisms: ['ANTIOXIDANT', 'GLUTATHIONE_PRECURSOR', 'MUCUS_REGULATION', 'HEPATIC_PROTECTION', 'CHELATION', 'DETOXIFICATION'],
    description: 'N-Ацетилцистеин — предшественник глутатиона, мощный антиоксидант и гепатопротектор. Снижает окислительный стресс, защищает печень при приёме ААС, разжижает мокроту.',
    dosage: { mg: 1200, timing: 'натощак, 2x/д', form: 'капс/шип' },
    bestForCourse: true,
    targetOrgan: 'Гепатоциты, лёгочный эпителий, эритроциты, почечные канальцы',
    organMechanism: 'Синтез глутатиона, детоксикация ксенобиотиков (фаза II), муколитическое действие, антиоксидантная защита',
    mechanismOfAction: 'Донор L-цистеина для синтеза глутатиона (лимитирующая стадия), восстановление окисленного глутатиона, разрыв дисульфидных связей муцина, хелатирование тяжёлых металлов',
    clinicalEffect: 'Повышение внутриклеточного глутатиона, защита печени от токсинов ААС, разжижение мокроты, снижение окислительного стресса',
    bestForm: 'NAC 600 мг 2x/д',
    synergies: [
      { with: 'TUDCA', effect: 'Гепатопротекторный стек', mechanism: 'NAC + TUDCA синергия', severity: 'HIGH' },
      { with: 'vitamin_c', effect: 'Усиление антиоксидантной защиты', mechanism: 'Рециклинг глутатиона', severity: 'MEDIUM' },
      { with: 'selenium', effect: 'Кофактор глутатионпероксидазы', mechanism: 'Селен необходим для GPX', severity: 'MEDIUM' },
      { with: 'lipoic_acid', effect: 'Антиоксидантный каскад', mechanism: 'ALA рециклирует глутатион', severity: 'MEDIUM' },
      { with: 'milk_thistle', effect: 'Синергия гепатопротекторов', mechanism: 'Разные пути защиты печени', severity: 'MEDIUM' }
    ],
    conflicts: [
      { with: 'activated_charcoal', effect: 'Снижение абсорбции NAC', mechanism: 'Адсорбция', severity: 'HIGH' },
      { with: 'anticoagulant_drugs', effect: 'Потенцирование антикоагуляции', mechanism: 'Усиление эффекта', severity: 'MEDIUM' }
    ],
    monitoring: [
      { what: 'Печёночные ферменты (АЛТ, АСТ)', when: 'Каждые 4 нед', targetRange: 'В пределах нормы' },
      { what: 'Уровень глутатиона (эритроциты)', when: 'Каждые 8 нед', targetRange: '> 600 мкмоль/л' }
    ],
    contraindications: [
      'Бронхиальная астма (с осторожностью)',
      'Язвенная болезнь желудка (обострение)',
      'Беременность (с осторожностью)'
    ],
    sideEffects: [
      'Тошнота/рвота (при высоких дозах >3 г/д)',
      'Диарея',
      'Головная боль',
      'Кожные аллергические реакции'
    ]
  },
  TUDCA: {
    id: 'TUDCA',
    name: 'Tauroursodeoxycholic Acid',
    nameRu: 'Тауроурсодезоксихолевая кислота (TUDCA)',
    tier: 'core',
    category: ['hepatoprotector', 'choleretic', 'antioxidant'],
    forms: [
      { id: 'tudca_250', name: 'TUDCA 250mg', nameRu: 'TUDCA 250 мг', dose: '250 мг 2x/д', best: true },
      { id: 'tudca_500', name: 'TUDCA 500mg', nameRu: 'TUDCA 500 мг', dose: '500 мг/д', best: false }
    ],
    organs: ['LIVER', 'GALLBLADDER', 'PANCREAS'],
    systems: ['hepatic', 'gastrointestinal', 'metabolic'],
    mechanisms: ['BILE_ACID_MODULATION', 'ANTIAPOPTOTIC', 'PROTEIN_FOLDING', 'CHOLERETIC', 'MITOCHONDRIAL_PROTECTION', 'ENDOPLASMIC_RETICULUM_STABILIZATION'],
    description: 'TUDCA — гидрофильная конъюгированная желчная кислота, защищает гепатоциты от токсического действия гидрофобных желчных кислот. Снижает ER-стресс, обладает антиапоптотическим действием.',
    dosage: { mg: 500, timing: 'перед едой, 2x/д', form: 'капс' },
    bestForCourse: true,
    targetOrgan: 'Гепатоциты, эпителий жёлчных протоков, ацинарные клетки поджелудочной',
    organMechanism: 'Защита эндоплазматического ретикулума (ER), модуляция апоптоза, стимуляция холереза',
    mechanismOfAction: 'Конкурентное замещение гидрофобных жёлчных кислот в пуле, ингибиция каспазы-3 (антиапоптоз), шаперонная активность (стабилизация белковой укладки), стимуляция секреции бикарбонатов',
    clinicalEffect: 'Снижение АЛТ/АСТ и ГГТ, защита гепатоцитов от ER-стресса, уменьшение холестаза',
    bestForm: 'TUDCA 250 мг 2x/д',
    synergies: [
      { with: 'NAC', effect: 'Мощный гепатопротекторный стек', mechanism: 'NAC + TUDCA', severity: 'HIGH' },
      { with: 'milk_thistle', effect: 'Дополнительная защита печени', mechanism: 'Разные механизмы', severity: 'MEDIUM' },
      { with: 'lipoic_acid', effect: 'Митохондриальная защита', mechanism: 'ALA + TUDCA', severity: 'MEDIUM' },
      { with: 'vitamin_e', effect: 'Антиоксидантная поддержка', mechanism: 'TUDCA + Витамин E', severity: 'LOW' }
    ],
    conflicts: [
      { with: 'bile_acid_drugs', effect: 'Конкуренция за рецепторы', mechanism: 'TUDCA может снижать эффективность других желчных кислот', severity: 'MEDIUM' },
      { with: 'aluminium_antacids', effect: 'Снижение абсорбции', mechanism: 'Связывание', severity: 'MEDIUM' }
    ],
    monitoring: [
      { what: 'Печёночные ферменты (АЛТ, АСТ, ГГТ, ЩФ)', when: 'Каждые 4 нед', targetRange: 'В пределах нормы' },
      { what: 'Билирубин общий и прямой', when: 'Каждые 8 нед', targetRange: '< 1.2 мг/дл' },
      { what: 'УЗИ печени/желчного пузыря', when: 'Каждые 12 нед', targetRange: 'Без патологии' }
    ],
    contraindications: [
      'Полная обструкция желчевыводящих путей',
      'Острый холецистит',
      'Тяжёлая печёночная недостаточность (Child-Pugh C)'
    ],
    sideEffects: [
      'Диарея (наиболее частый)',
      'Дискомфорт в правом подреберье',
      'Тошнота',
      'Крапивница (редко)'
    ]
  },

  DIOSMIN: {
    id: 'DIOSMIN', name: 'Diosmin', nameRu: 'Диосмин', tier: 'standard',
    category: ['flavonoid','cardioprotector','antioxidant'],
    forms: [{id:'diosmin_500',name:'Diosmin 500mg',nameRu:'Диосмин 500 мг',dose:'500 мг 2x/д',best:true},{id:'diosmin_1000',name:'Diosmin 1000mg',nameRu:'Диосмин 1000 мг',dose:'1000 мг/д',best:false}],
    organs: ['VESSELS','HEART','LIVER'], systems: ['vascular','cardio','hepatic'],
    mechanisms: ['VENOTONIC','ANTIOXIDANT','ANTIINFLAMMATORY','LYMPHATIC_DRAINAGE'],
    description: 'Флавоноид, венотоник. Укрепляет стенки вен, улучшает лимфодренаж, снижает отёки. Синергия с гесперидином для лечения ХВН.',
    dosage: { mg: 1000, timing: '2x/д во время еды', form: 'таб' },
    bestForCourse: false,
    synergies: [{with:'HESPERIDIN',effect:'Венотоник + ангиопротектор',mechanism:'Диосмин + гесперидин',severity:'HIGH'}],
    conflicts: [{with:'anticoagulant_drugs',effect:'Усиление антикоагуляции',mechanism:'Синергия',severity:'MEDIUM'}],
    monitoring: [{what:'Состояние вен (осмотр)',when:'Каждые 12 нед',targetRange:'Уменьшение отёков'}],
    contraindications: ['Индивидуальная непереносимость'],
    sideEffects: ['Диспепсия','Головная боль'],
    targetOrgan: 'Венозная стенка (клапаны вен), лимфатические сосуды, капилляры',
    organMechanism: 'Венотонус, лимфодренаж, антиоксидантная защита эндотелия',
    mechanismOfAction: 'Повышение тонуса вен через активация α1-адренорецепторов и ингибирование КФ-фосфодиэстеразы; снижение растяжимости вен; улучшение лимфатического дренажа; снижение адгезии лейкоцитов к эндотелию (ингибирование ICAM-1); ингибирование 5-ЛОГ и ЦОГ-2',
    clinicalEffect: 'Улучшение венозного оттока, уменьшение отёков, снижение тяжести в ногах',
    bestForm: 'Диосмин 500 мг 2x/д',
  },
   BERGAMOT: {
    id: 'BERGAMOT', name: 'Bergamot Extract', nameRu: 'Экстракт бергамота', tier: 'standard',
    category: ['polyphenol','lipid','metabolic'],
    forms: [{id:'bergamot_500',name:'Bergamot 500mg',nameRu:'Бергамот 500 мг',dose:'500 мг 2x/д',best:true},{id:'bergamot_1000',name:'Bergamot 1000mg',nameRu:'Бергамот 1000 мг',dose:'1000 мг/д',best:false}],
    organs: ['LIVER','HEART','BLOOD'], systems: ['hepatic','cardio','metabolic'],
    mechanisms: ['LIPID_METABOLISM','AMPK_ACTIVATION','ANTIOXIDANT','PPAR_AGONIST'],
    description: 'Экстракт бергамота — снижает ЛПНП и общий холестерин, улучшает липидный профиль через активацию AMPK и PPAR-гамма. Поддерживает метаболическое здоровье.',
    dosage: { mg: 1000, timing: '2x/д до еды', form: 'капс' },
    bestForCourse: false,
    synergies: [{with:'berberine',effect:'Липидный+метаболический',mechanism:'AMPK + бергамот',severity:'MEDIUM'},{with:'omega3',effect:'Снижение ЛПНП+триглицеридов',mechanism:'Бергамот + омега-3',severity:'MEDIUM'}],
    conflicts: [{with:'statin_drugs',effect:'Потенцирование эффекта статинов',mechanism:'Дополнительное снижение ЛПНП',severity:'MEDIUM'}],
    monitoring: [{what:'Липидный профиль',when:'Каждые 8 нед',targetRange:'ЛПНП < 2.6'}],
    contraindications: ['Беременность (с осторожностью)'],
    sideEffects: ['Изжога','Дискомфорт в ЖКТ'],
    targetOrgan: 'Гепатоциты, сосудистый эндотелий, миокард',
    organMechanism: 'Липидный обмен (синтез холестерина), AMPK-сигналинг, антиоксидантная защита',
    mechanismOfAction: 'Активация AMPK (фосфорилирование Thr172); активация PPAR-γ (повышение адипонектина); ингибирование ГМГ-КоА-редуктазы (снижение синтеза холестерина); ингибирование NF-κB (противовоспалительное); улавливание ROS (полифенолы)',
    clinicalEffect: 'Снижение ЛПНП, триглицеридов, улучшение инсулинорезистентности, защита печени',
    bestForm: 'Экстракт бергамота 500 мг 2x/д',
  },
   SERRAPEPTASE: {
    id: 'SERRAPEPTASE', name: 'Serrapeptase', nameRu: 'Серрапептаза', tier: 'standard',
    category: ['proteolytic','enzyme','anti_inflammatory'],
    forms: [{id:'serra_120k',name:'Serrapeptase 120k SPU',nameRu:'Серрапептаза 120 000 Ед',dose:'120 000 Ед 2x/д натощак',best:true},{id:'serra_80k',name:'Serrapeptase 80k SPU',nameRu:'Серрапептаза 80 000 Ед',dose:'80 000 Ед 2x/д',best:false}],
    organs: ['VESSELS','LUNGS','JOINTS','BLOOD'], systems: ['vascular','respiratory','musculoskeletal'],
    mechanisms: ['PROTEOLYTIC','ANTIINFLAMMATORY','FIBRINOLYTIC','MUCOLYTIC','EDEMA_REDUCTION'],
    description: 'Протеолитический фермент из кишечной палочки (Serratia). Расщепляет фибрин, уменьшает воспаление и отёки, разжижает мокроту. Используется при синуситах, после операций, при варикозе.',
    dosage: { mg: 0, timing: '120 000 ЕД 2x/д натощак за 30 мин до еды', form: 'капс ЕС' },
    bestForCourse: false,
    synergies: [{with:'nattokinase',effect:'Фибринолитический стек',mechanism:'Серрапептаза+наттокиназа',severity:'HIGH'},{with:'bromelain',effect:'Протеолитический комплекс',mechanism:'Системные ферменты',severity:'MEDIUM'}],
    conflicts: [{with:'anticoagulant_drugs',effect:'Усиление антикоагулянтного эффекта',mechanism:'Фибринолиз',severity:'HIGH'}],
    monitoring: [{what:'Время свертывания (АЧТВ)',when:'Перед началом и через 4 нед',targetRange:'В пределах нормы'}],
    contraindications: ['Гемофилия','Язва желудка в фазе обострения','Приём антикоагулянтов (с осторожностью)'],
    sideEffects: ['Диарея','Диспепсия','Редко: аллергические реакции'],
    targetOrgan: 'Сосудистый эндотелий, лёгочная ткань, суставные ткани (хрящ, синовия), кровь',
    organMechanism: 'Протеолиз фибрина, деградация воспалительных медиаторов, разжижение секрета',
    mechanismOfAction: 'Протеолиз фибриновых сгустков (прямая деградация фибрина); расщепление брадикинина и субстанции P (снижение боли); ингибирование NF-κB → снижение ФНО-α/ИЛ-1β; разжижение респираторной слизи (муколитик); дезагрегация белковых комплексов в зоне воспаления',
    clinicalEffect: 'Уменьшение воспаления, рассасывание отёков, разжижение мокроты, фибринолиз',
    bestForm: 'Серрапептаза 120 000 Ед 2x/д натощак',
  },
   PAPAIN: {
    id: 'PAPAIN', name: 'Papain', nameRu: 'Папаин', tier: 'standard',
    category: ['proteolytic','enzyme','gut'],
    forms: [{id:'papain_500',name:'Papain 500mg',nameRu:'Папаин 500 мг',dose:'500 мг 2x/д',best:true}],
    organs: ['GUT','JOINTS'], systems: ['gastrointestinal','musculoskeletal'],
    mechanisms: ['PROTEOLYTIC','ANTIINFLAMMATORY','DIGESTIVE_ENZYME'],
    description: 'Протеолитический фермент из папайи. Улучшает переваривание белков, уменьшает воспаление. Используется в системной энзимотерапии при травмах и отёках.',
    dosage: { mg: 500, timing: '2x/д во время еды', form: 'таб' },
    bestForCourse: false,
    synergies: [{with:'bromelain',effect:'Системная энзимотерапия',mechanism:'Папаин+бромелайн',severity:'MEDIUM'}],
    conflicts: [{with:'anticoagulant_drugs',effect:'Потенцирование',mechanism:'Фибринолиз',severity:'MEDIUM'}],
    monitoring: [{what:'СРБ',when:'Каждые 4 нед',targetRange:'< 3 мг/л'}],
    contraindications: ['Аллергия на папайю','Беременность'],
    sideEffects: ['Аллергические реакции'],
    targetOrgan: 'Желудочно-кишечный тракт (просвет), суставные ткани',
    organMechanism: 'Протеолиз белков пищи, противовоспалительное действие на синовию',
    mechanismOfAction: 'Протеолиз пептидных связей за остатками Arg, Lys, Phe (эндопротеаза); гидролиз белков пищи в ЖКТ; ингибирование ЦОГ-2 (снижение PGE2); снижение уровня СРБ; ускорение клиренса иммунных комплексов',
    clinicalEffect: 'Улучшение переваривания белка, уменьшение воспаления и отёков',
    bestForm: 'Папаин 500 мг 2x/д',
  },
   PHARMA_TADALAFIL: {
    id: 'PHARMA_TADALAFIL', name: 'Tadalafil', nameRu: 'Тадалафил', tier: 'specialty',
    category: ['pharma','cardioprotector'],
    forms: [{id:'tadalafil_5',name:'Tadalafil 5mg',nameRu:'Тадалафил 5 мг',dose:'5 мг/д постоянно',best:true},{id:'tadalafil_20',name:'Tadalafil 20mg',nameRu:'Тадалафил 20 мг',dose:'20 мг по требованию',best:false}],
    organs: ['VESSELS','HEART','REPRODUCTIVE'], systems: ['vascular','cardio','reproductive'],
    mechanisms: ['PDE5_INHIBITION','VASODILATION','ENDOTHELIAL_FUNCTION','CAMP_CGMP'],
    description: 'Ингибитор ФДЭ5. Расширяет сосуды, улучшает кровоток. На курсе ААС — для профилактики гипертрофии ЛЖ, снижения давления и поддержки эректильной функции. Период полувыведения ~17.5 ч.',
    dosage: { mg: 5, timing: '1x/д утром', form: 'таб' },
    bestForCourse: true,
    synergies: [{with:'citrulline',effect:'Усиление вазодилатации',mechanism:'NO + ФДЭ5',severity:'MEDIUM'},{with:'omega3',effect:'Эндотелиальная защита',mechanism:'PDE5+омега-3',severity:'LOW'}],
    conflicts: [{with:'nitrate_drugs',effect:'Тяжелая гипотензия',mechanism:'NO+PDE5',severity:'HIGH'},{with:'alpha_blockers',effect:'Ортостатическая гипотензия',mechanism:'Синергия',severity:'HIGH'}],
    monitoring: [{what:'АД',when:'Еженедельно',targetRange:'АД < 130/80'},{what:'ЭКГ',when:'Каждые 12 нед',targetRange:'Без признаков гипертрофии ЛЖ'}],
    contraindications: ['Приём нитратов','Тяжелая печёночная недостаточность','Нестабильная стенокардия','Инфаркт миокарда < 90 дней'],
    sideEffects: ['Гиперемия лица','Головная боль','Диспепсия','Миалгия','Приапизм (редко)'],
    targetOrgan: 'Сосудистый эндотелий, миокард, кавернозные тела полового члена',
    organMechanism: 'Вазодилатация (цГМФ-опосредованная), эндотелиальная функция, ингибирование ФДЭ5',
    mechanismOfAction: 'Ингибирование PDE5 (конкурентное, сродство к цГМФ-связывающему сайту); повышение цГМФ в гладкомышечных клетках сосудов; активация PKG → фосфорилирование белков сокращения → расслабление ГМК; улучшение эндотелий-зависимой вазодилатации; снижение пролиферации ГМК сосудистой стенки',
    clinicalEffect: 'Вазодилатация, снижение АД, улучшение эректильной функции, кардиопротекция',
    bestForm: 'Тадалафил 5 мг/д постоянно',
  },
   LUMBROKINASE: {
    id: 'LUMBROKINASE', name: 'Lumbrokinase', nameRu: 'Люмборкиназа', tier: 'standard',
    category: ['proteolytic','enzyme','anticoagulant'],
    forms: [{id:'lumbro_40mg',name:'Lumbrokinase 40mg',nameRu:'Люмборкиназа 40 мг',dose:'40 мг 2x/д натощак',best:true}],
    organs: ['BLOOD','VESSELS','HEART'], systems: ['hematologic','vascular','cardio'],
    mechanisms: ['FIBRINOLYTIC','ANTICOAGULANT','PLASMIN_ACTIVATION','THROMBUS_RESOLUTION'],
    description: 'Фибринолитический фермент из дождевого червя. Растворяет фибрин, предотвращает тромбозы. На курсе ААС — снижает риск тромбообразования, улучшает реологию крови.',
    dosage: { mg: 80, timing: '2x/д за 30 мин до еды', form: 'капс' },
    bestForCourse: true,
    synergies: [{with:'nattokinase',effect:'Мощный фибринолитик',mechanism:'Люмборкиназа+наттокиназа',severity:'HIGH'},{with:'serrapeptase',effect:'Протеолитический комплекс',mechanism:'Системные ферменты',severity:'MEDIUM'}],
    conflicts: [{with:'anticoagulant_drugs',effect:'Риск кровотечения',mechanism:'Усиление фибринолиза',severity:'HIGH'},{with:'antiplatelet_drugs',effect:'Усиление антиагрегации',mechanism:'Синергия',severity:'HIGH'}],
    monitoring: [{what:'Время свертывания (АЧТВ, ПИ)',when:'Каждые 4 нед',targetRange:'МНО < 1.5'}],
    contraindications: ['Гемофилия','Тромбоцитопения','Язва желудка','Беременность'],
    sideEffects: ['Диарея','Дискомфорт в ЖКТ','Редко: кровоточивость'],
    targetOrgan: 'Кровь (фибриновые сгустки), сосудистый эндотелий, миокард',
    organMechanism: 'Фибринолиз, плазминовая активация, реология крови',
    mechanismOfAction: 'Прямая активация плазминогена → плазмин (деградация фибрина); расщепление фибриногена; ингибирование PAI-1; снижение вязкости крови; дезагрегация тромбоцитов через снижение экспрессии GPIIb/IIIa',
    clinicalEffect: 'Профилактика тромбозов, фибринолиз, улучшение реологии крови',
    bestForm: 'Люмборкиназа 40 мг 2x/д натощак',
  },
   HORSE_CHESTNUT: {
    id: 'HORSE_CHESTNUT', name: 'Horse Chestnut', nameRu: 'Конский каштан (эсцин)', tier: 'standard',
    category: ['herb','cardioprotector','antioxidant'],
    forms: [{id:'escin_100',name:'Escin 100mg',nameRu:'Эсцин 100 мг',dose:'100 мг 2x/д',best:true}],
    organs: ['VESSELS','LIVER','SKIN'], systems: ['vascular','hepatic','integumentary'],
    mechanisms: ['VENOTONIC','ANTIOXIDANT','ANTIEDEMA','CAPILLARY_STRENGTHENING','LYMPHATIC_STIMULATION'],
    description: 'Экстракт конского каштана (эсцин). Венотоник, уменьшает отёки и воспаление. Стандарт лечения ХВН. Укрепляет капилляры, улучшает венозный отток.',
    dosage: { mg: 200, timing: '2x/д после еды', form: 'капс' },
    bestForCourse: false,
    synergies: [{with:'diosmin',effect:'Венопротекторный стек',mechanism:'Эсцин+диосмин',severity:'MEDIUM'}],
    conflicts: [{with:'anticoagulant_drugs',effect:'Усиление антикоагуляции',mechanism:'Влияние на свертывание',severity:'MEDIUM'}],
    monitoring: [{what:'Состояние вен',when:'Каждые 12 нед',targetRange:'Уменьшение симптомов'}],
    contraindications: ['Почечная недостаточность','Аллергия','Беременность (I триместр)'],
    sideEffects: ['Диспепсия','Зуд','Головокружение (редко)'],
    targetOrgan: 'Венозная стенка (клапаны вен), капилляры, кожа (дерма), печень',
    organMechanism: 'Венотонус, антиотёчное действие, укрепление капилляров',
    mechanismOfAction: 'Ингибирование гиалуронидазы → укрепление базальной мембраны капилляров; антагонизм к рецепторам серотонина (5-HT) на венозной стенке; снижение проницаемости капилляров; стимуляция лимфатического дренажа; улавливание ROS (эсцин); снижение активности лизосомальных ферментов',
    clinicalEffect: 'Уменьшение отёков, снижение тяжести в ногах, улучшение состояния вен',
    bestForm: 'Эсцин 100 мг 2x/д',
  },
   INOSINE: {
    id: 'INOSINE', name: 'Inosine', nameRu: 'Инозин', tier: 'standard',
    category: ['metabolic', 'cardioprotector'],
    forms: [{id:'inosine_500',name:'Inosine 500mg',nameRu:'Инозин 500 мг',dose:'500 мг 2x/д',best:true}],
    organs: ['HEART','LIVER','MUSCLES'], systems: ['cardio','hepatic','muscular'],
    mechanisms: ['ATP_PRECURSOR','PURINE_METABOLISM','ANTIOXIDANT','ERYTHROPOIESIS'],
    description: 'Предшественник АТФ, участвует в синтезе пуринов. Улучшает энергетический обмен в миокарде и мышцах. Синергия с креатином и рибозой для восстановления АТФ.',
    dosage: { mg: 1000, timing: '2x/д с едой', form: 'капс' },
    bestForCourse: false,
    synergies: [{with:'creatine',effect:'АТФ-синтез',mechanism:'Инозин+креатин',severity:'MEDIUM'},{with:'coq10',effect:'Митохондриальная энергия',mechanism:'Инозин+КоQ10',severity:'MEDIUM'}],
    conflicts: [{with:'colchicine',effect:'Снижение абсорбции колхицина',mechanism:'Взаимодействие',severity:'MEDIUM'}],
    monitoring: [{what:'Мочевая кислота',when:'Каждые 8 нед',targetRange:'< 420 мкмоль/л'},{what:'Ферритин',when:'Каждые 8 нед',targetRange:'> 30'}],
    contraindications: ['Подагра','Мочекаменная болезнь','Почечная недостаточность'],
    sideEffects: ['Повышение мочевой кислоты','Диспепсия'],
    targetOrgan: 'Миокард, гепатоциты, скелетные мышцы',
    organMechanism: 'Синтез АТФ, пуриновый метаболизм, энергетический обмен',
    mechanismOfAction: 'Предшественник АТФ через пуриновый каскад де novo; субстрат для синтеза аденозина; повышение активности сукцинатдегидрогеназы; стимуляция эритропоэза; улучшение коронарного кровотока',
    clinicalEffect: 'Повышение энергетического обмена, кардиопротекция, улучшение переносимости нагрузок',
    bestForm: 'Инозин 500 мг 2x/д',
  },
   NARINGIN: {
    id: 'NARINGIN', name: 'Naringin', nameRu: 'Нарингин', tier: 'standard',
    category: ['flavonoid','antioxidant','cardioprotector','hepatoprotector'],
    forms: [{id:'naringin_250',name:'Naringin 250mg',nameRu:'Нарингин 250 мг',dose:'250-500 мг/д',best:true}],
    organs: ['LIVER','HEART','BLOOD','VESSELS'], systems: ['hepatic','cardio','vascular','metabolic'],
    mechanisms: ['ANTIOXIDANT','CYP3A4_INHIBITION','LIPID_METABOLISM','ANTIINFLAMMATORY'],
    description: 'Флавоноид грейпфрута. Антиоксидант, ингибирует CYP3A4 (повышает биодоступность некоторых препаратов), снижает ЛПНП. Влияет на метаболизм ксенобиотиков.',
    dosage: { mg: 500, timing: '1x/д с едой', form: 'капс' },
    bestForCourse: false,
    synergies: [{with:'hesperidin',effect:'Цитрусовая синергия',mechanism:'Нарингин+гесперидин',severity:'MEDIUM'}],
    conflicts: [{with:'statin_drugs',effect:'Повышение концентрации статинов',mechanism:'Ингибирование CYP3A4',severity:'HIGH'},{with:'calcium_channel_blockers',effect:'Повышение гипотензивного эффекта',mechanism:'Ингибирование CYP3A4',severity:'HIGH'}],
    monitoring: [{what:'Липидный профиль',when:'Каждые 8 нед',targetRange:'ЛПНП < 100'}],
    contraindications: ['Приём лекарств CYP3A4','Беременность (с осторожностью)'],
    sideEffects: ['Взаимодействие с лекарствами (CYP3A4)','Редко: горечь во рту'],
    targetOrgan: 'Гепатоциты, сосудистый эндотелий, миокард',
    organMechanism: 'Антиоксидантная защита, метаболизм ксенобиотиков, липидный обмен',
    mechanismOfAction: 'Ингибирование CYP3A4 (конкурентное); ингибирование ГМГ-КоА-редуктазы (снижение ЛПНП); хелатирование Fe²⁺; активация Nrf2-пути; снижение экспрессии VCAM-1',
    clinicalEffect: 'Снижение ЛПНП, антиоксидантная защита, повышение биодоступности других веществ',
    bestForm: 'Нарингин 250 мг 1x/д с едой',
  },
   PHARMA_CABERGOLINE: {
    id: 'PHARMA_CABERGOLINE', name: 'Cabergoline', nameRu: 'Каберголин (Достинекс)', tier: 'specialty',
    category: ['pharma','hormonal'],
    forms: [{id:'cabergoline_0.5',name:'Cabergoline 0.5mg',nameRu:'Каберголин 0,5 мг',dose:'0.5 мг 2x/нед',best:true}],
    organs: ['BRAIN','PITUITARY','REPRODUCTIVE'], systems: ['neuro','endocrine','reproductive'],
    mechanisms: ['DOPAMINE_AGONIST','PROLACTIN_INHIBITION','D2_RECEPTOR'],
    description: 'Агонист дофамина, ингибитор пролактина. На курсе ААС — подавляет гиперпролактинемию (особенно от тренболона/нандролона), улучшает либидо и восстановление гонад.',
    dosage: { mg: 0.5, timing: '2x/нед (пн, чт)', form: 'таб' },
    bestForCourse: true,
    synergies: [{with:'vitamin_b6',effect:'Снижение пролактина',mechanism:'Каберголин+B6',severity:'LOW'},{with:'zinc',effect:'Тестостерон/пролактин баланс',mechanism:'Zn + дофамин',severity:'LOW'}],
    conflicts: [{with:'antipsychotic_drugs',effect:'Снижение эффекта каберголина',mechanism:'Антагонизм D2',severity:'HIGH'}],
    monitoring: [{what:'Пролактин',when:'Каждые 4 нед',targetRange:'< 15 нг/мл'},{what:'ЛГ, ФСГ',when:'Каждые 8 нед',targetRange:'Восстановление оси'}],
    contraindications: ['Клапанные пороки сердца','Тяжелая гипертензия','Психоз'],
    sideEffects: ['Тошнота','Головокружение','Ортостатическая гипотензия','Фиброз клапанов (длит. приём >6 мес)'],
    targetOrgan: 'Гипофиз (лактотрофы), головной мозг (полосатое тело), репродуктивная система',
    organMechanism: 'Дофаминергическая регуляция пролактина, гонадотропная ось',
    mechanismOfAction: 'Агонист D2-дофаминовых рецепторов лактотрофов гипофиза → снижение секреции пролактина; ингибирование аденилатциклазы; снижение цАМФ; уменьшение размера пролактиномы; улучшение дофаминовой передачи в стриатуме',
    clinicalEffect: 'Снижение пролактина, восстановление либидо, улучшение гонадотропной функции',
    bestForm: 'Каберголин 0,5 мг 2x/нед',
  },
   NATTOKINASE: {
    id: 'NATTOKINASE', name: 'Nattokinase', nameRu: 'Наттокиназа', tier: 'standard',
    category: ['proteolytic','enzyme','anticoagulant'],
    forms: [{id:'natto_100mg',name:'Nattokinase 100mg',nameRu:'Наттокиназа 100 мг (2000 ФЕ)',dose:'100 мг 2x/д',best:true},{id:'natto_200mg',name:'Nattokinase 200mg',nameRu:'Наттокиназа 200 мг (4000 ФЕ)',dose:'200 мг/д',best:false}],
    organs: ['BLOOD','VESSELS','HEART'], systems: ['hematologic','vascular','cardio'],
    mechanisms: ['FIBRINOLYTIC','PLASMIN_ACTIVATION','ANTICOAGULANT','BLOOD_THINNING','PAF_ANTAGONIST'],
    description: 'Фибринолитический фермент из ферментированных соевых бобов (натто). Растворяет фибрин, снижает вязкость крови, предотвращает тромбозы. Естественная альтернатива аспирину для кардиопротекции.',
    dosage: { mg: 200, timing: '2x/д за 30 мин до еды', form: 'капс' },
    bestForCourse: true,
    synergies: [{with:'serrapeptase',effect:'Системная энзимотерапия',mechanism:'Протеолитики',severity:'MEDIUM'},{with:'lumbrokinase',effect:'Мощный фибринолиз',mechanism:'Ферменты+фибринолиз',severity:'HIGH'},{with:'vitamin_k2',effect:'Баланс свертывания',mechanism:'Натто+K2 (антифиброз)',severity:'MEDIUM'}],
    conflicts: [{with:'anticoagulant_drugs',effect:'Риск кровотечения',mechanism:'Усиление фибринолиза',severity:'HIGH'},{with:'antiplatelet_drugs',effect:'Риск кровотечения',mechanism:'Синергия',severity:'HIGH'}],
    monitoring: [{what:'Время свертывания (АЧТВ, ПИ)',when:'Каждые 4 нед',targetRange:'МНО < 1.5'},{what:'D-димер',when:'Каждые 8 нед',targetRange:'< 0.5 мг/л'}],
    contraindications: ['Гемофилия','Тромбоцитопения','Язвенный колит','Беременность'],
    sideEffects: ['Диарея','Вздутие','Редко: кровоточивость'],
    targetOrgan: 'Кровь (фибриновые сгустки), сосудистый эндотелий, миокард',
    organMechanism: 'Фибринолиз, плазминовая активация, реология крови',
    mechanismOfAction: 'Прямая деградация фибрина (активация плазминогена → плазмин); ингибирование PAI-1 (ингибитор активатора плазминогена); расщепление фибриногена; снижение вязкости крови через PAFAH (фактор активации тромбоцитов); дезагрегация тромбоцитов',
    clinicalEffect: 'Профилактика тромбозов, снижение вязкости крови, фибринолиз, кардиопротекция',
    bestForm: 'Наттокиназа 100 мг 2x/д за 30 мин до еды',
  },
   HESPERIDIN: {
    id: 'HESPERIDIN', name: 'Hesperidin', nameRu: 'Гесперидин', tier: 'standard',
    category: ['flavonoid','cardioprotector','antioxidant'],
    forms: [{id:'hesperidin_500',name:'Hesperidin 500mg',nameRu:'Гесперидин 500 мг',dose:'500 мг/д',best:true}],
    organs: ['VESSELS','HEART','LIVER'], systems: ['vascular','cardio','hepatic'],
    mechanisms: ['VENOTONIC','ANTIOXIDANT','CAPILLARY_STRENGTHENING','ANTIINFLAMMATORY'],
    description: 'Цитрусовый флавоноид. Укрепляет сосуды, улучшает микроциркуляцию. В комбинации с диосмином — стандарт лечения ХВН. Снижает проницаемость капилляров.',
    dosage: { mg: 500, timing: '1x/д', form: 'таб' },
    bestForCourse: false,
    synergies: [{with:'diosmin',effect:'Венопротекторный стек',mechanism:'Гесперидин+диосмин',severity:'HIGH'}],
    conflicts: [{with:'anticoagulants',effect:'Усиление эффекта',mechanism:'Флавоноиды',severity:'LOW'}],
    monitoring: [{what:'Эластичность сосудов',when:'Каждые 12 нед',targetRange:'Улучшение'}],
    contraindications: ['Индивидуальная непереносимость'],
    sideEffects: ['Диспепсия'],
    targetOrgan: 'Венозная стенка, капилляры, печень (гепатоциты)',
    organMechanism: 'Венотонус, микроциркуляция, антиоксидантная защита',
    mechanismOfAction: 'Ингибирование гиалуронидазы → укрепление базальной мембраны капилляров; ингибирование ЦОГ-2 и 5-ЛОГ (противовоспалительное); повышение NO в эндотелии (вазодилатация); снижение адгезии лейкоцитов к эндотелию',
    clinicalEffect: 'Улучшение венозного тонуса, снижение проницаемости капилляров, антиоксидантный эффект',
    bestForm: 'Гесперидин 500 мг/д',
  },
   CITRUS_BIOFLAVONOIDS: {
    id: 'CITRUS_BIOFLAVONOIDS', name: 'Citrus Bioflavonoids', nameRu: 'Цитрусовые биофлавоноиды', tier: 'standard',
    category: ['flavonoid','antioxidant','cardioprotector'],
    forms: [{id:'citrus_bio_500',name:'Citrus Bioflavonoids 500mg',nameRu:'Биофлавоноиды 500 мг',dose:'500 мг/д',best:true}],
    organs: ['VESSELS','HEART','BLOOD'], systems: ['vascular','cardio','hematologic'],
    mechanisms: ['ANTIOXIDANT','CAPILLARY_STRENGTHENING','VITAMIN_C_SYNERGY','ANTIINFLAMMATORY'],
    description: 'Комплекс цитрусовых биофлавоноидов (гесперидин, нарингенин, рутин). Усиливает действие витамина С. Защищает капилляры, снижает окислительный стресс.',
    dosage: { mg: 500, timing: '1x/д с едой', form: 'капс' },
    bestForCourse: false,
    synergies: [{with:'vitamin_c',effect:'Антиоксидантная синергия',mechanism:'Флавоноиды+вит.С',severity:'MEDIUM'}],
    conflicts: [{with:'anticoagulants',effect:'Потенциальное усиление',mechanism:'Флавоноиды',severity:'LOW'}],
    contraindications: ['Индивидуальная непереносимость'],
    sideEffects: ['Редко: диспепсия'],
    monitoring: [{what:'Эластичность сосудов',when:'Каждые 12 нед',targetRange:'Улучшение'}],
    targetOrgan: 'Сосудистый эндотелий, капилляры, миокард, эритроциты',
    organMechanism: 'Укрепление капилляров, антиоксидантная защита сосудистой стенки, потенцирование витамина С',
    mechanismOfAction: 'Снижение проницаемости капилляров через ингибирование гиалуронидазы; потенцирование аскорбата (защита от окисления); хелатирование свободного Fe и Cu (антиоксидант); ингибирование ЦОГ-2; укрепление коллагенового матрикса',
    clinicalEffect: 'Укрепление сосудов, усиление эффекта вит.С, снижение окислительного стресса',
    bestForm: 'Цитрусовые биофлавоноиды 500 мг/д',
  },
   BROMANTANE: {
    id: 'BROMANTANE', name: 'Bromantane', nameRu: 'Бромантан (Ладастен)', tier: 'specialty',
    category: ['adaptogen','nootropic','stimulant'],
    forms: [{id:'bromantane_100',name:'Bromantane 100mg',nameRu:'Бромантан 100 мг',dose:'100-200 мг/д',best:true}],
    organs: ['BRAIN','ADRENALS'], systems: ['neuro','endocrine'],
    mechanisms: ['DOPAMINE_SYNTHESIS','SEROTONIN_MODULATION','ADAPTOGEN','ANXIOLYTIC','FATIGUE_RESISTANCE'],
    description: 'Адаптоген с дофаминергической активностью. Повышает физическую выносливость, снижает утомляемость. Активирует синтез дофамина через тирозингидроксилазу, обладает противотревожным действием.',
    dosage: { mg: 100, timing: '1-2x/д утром', form: 'таб' },
    bestForCourse: false,
    synergies: [{with:'l_tyrosine',effect:'Дофаминовый потенциал',mechanism:'Бромантан+тирозин',severity:'MEDIUM'}],
    conflicts: [{with:'mao_inhibitors',effect:'Риск серотонинового синдрома',mechanism:'Синергия',severity:'HIGH'}],
    monitoring: [{what:'АД',when:'Еженедельно',targetRange:'< 140/90'}],
    contraindications: ['Тяжелая гипертензия','Психоз','Беременность'],
    sideEffects: ['Повышение АД','Бессонница','Головная боль'],
    targetOrgan: 'Головной мозг (стриатум, префронтальная кора), кора надпочечников',
    organMechanism: 'Дофаминергическая нейротрансмиссия, адаптогенная регуляция, антиоксидантная защита',
    mechanismOfAction: 'Увеличение экспрессии тирозингидроксилазы (TH); повышение активности супероксиддисмутазы (SOD); модуляция ГАМК-А рецепторов; снижение кортизола; активация митохондриального дыхания',
    clinicalEffect: 'Повышение выносливости, снижение утомляемости, анксиолиз, адаптогенный эффект',
    bestForm: 'Бромантан 100 мг 1-2x/д утром',
  },
   FASORACETAM: {
    id: 'FASORACETAM', name: 'Fasoracetam', nameRu: 'Фасорацетам', tier: 'standard',
    category: ['nootropic','anxiolytic'],
    forms: [{id:'fasoracetam_50',name:'Fasoracetam 50mg',nameRu:'Фасорацетам 50 мг',dose:'50-100 мг/д',best:true}],
    organs: ['BRAIN'], systems: ['neuro'],
    mechanisms: ['GLUTAMATE_MODULATION','GABA_B_AGONIST','NMDA_UPREGULATION','COGNITIVE_ENHANCEMENT'],
    description: 'Ноотроп из семейства рацетамов. Модулирует глутаматные рецепторы, повышает когнитивные функции. Уникален тем, что также действует как агонист ГАМК-Б (умеренный анксиолитик).',
    dosage: { mg: 100, timing: '1x/д утром', form: 'таб' },
    bestForCourse: false,
    synergies: [{with:'citicoline',effect:'Холинергическая поддержка',mechanism:'Рацетам+холин',severity:'MEDIUM'}],
    conflicts: [{with:'anticholinergics',effect:'Снижение эффекта',mechanism:'Фасорацетам+холинолитики',severity:'MEDIUM'}],
    monitoring: [{what:'Когнитивная функция',when:'Ежемесячно',targetRange:'Субъективное улучшение'}],
    contraindications: ['Беременность'],
    sideEffects: ['Головная боль'],
    targetOrgan: 'Головной мозг (кора, гиппокамп), нервная система',
    organMechanism: 'Глутаматергическая нейротрансмиссия, GABA-B-опосредованная модуляция',
    mechanismOfAction: 'Модуляция AMPA- и каинатных глутаматных рецепторов; активация GABA-B рецепторов; повышение экспрессии глутаматдекарбоксилазы (GAD); увеличение α2-адренорецепторов; снижение кортизола через ось HPA',
    clinicalEffect: 'Улучшение когнитивных функций, снижение тревожности, восстановление надпочечников',
    bestForm: 'Фасорацетам 50 мг 1x/д утром',
  },
   AGMATINE: {
    id: 'AGMATINE', name: 'Agmatine Sulfate', nameRu: 'Агматина сульфат', tier: 'standard',
    category: ['amino','nootropic','cardioprotector'],
    forms: [{id:'agmatine_500',name:'Agmatine 500mg',nameRu:'Агматин 500 мг',dose:'500-1000 мг/д',best:true}],
    organs: ['BRAIN','BLOOD','MUSCLES'], systems: ['neuro','vascular','muscular'],
    mechanisms: ['NO_SYNTHASE_INHIBITION','NMDA_BLOCKADE','INSULIN_SENSITIVITY','NEUROTRANSMITTER_MODULATION','VASODILATION'],
    description: 'Метаболит L-аргинина. Нейромодулятор: блокирует NMDA-рецепторы (снижение тревожности, нейропротекция), ингибирует NO-синтазу (вазодилатация). Улучшает чувствительность к инсулину, снижает нейропатическую боль.',
    dosage: { mg: 1000, timing: '1x/д натощак', form: 'капс' },
    bestForCourse: false,
    synergies: [{with:'l_arginine',effect:'NO-модуляция',mechanism:'Агматин+аргинин',severity:'MEDIUM'}],
    conflicts: [{with:'antihypertensive_drugs',effect:'Потенцирование гипотензии',mechanism:'Вазодилатация',severity:'MEDIUM'}],
    monitoring: [{what:'АД',when:'Еженедельно',targetRange:'> 100/60'}],
    contraindications: ['Тяжелая гипотензия'],
    sideEffects: ['Диарея','Снижение АД'],
    targetOrgan: 'Головной мозг (NMDA-рецепторы), сосудистый эндотелий, скелетные мышцы',
    organMechanism: 'Нейромодуляция, регулировка тонуса сосудов, метаболизм глюкозы',
    mechanismOfAction: 'Блокада NMDA-рецепторов (антагонист); ингибирование NO-синтазы (nNOS и iNOS); агонизм I1-имидазолиновых рецепторов; модуляция α2-адренорецепторов; повышение выделения ЛГ через гипоталамус; ингибирование MAO-A',
    clinicalEffect: 'Улучшение настроения, снижение нейропатической боли, вазодилатация, метаболическая поддержка',
    bestForm: 'Агматина сульфат 500 мг 1x/д натощак',
  },
   TMG: {
    id: 'TMG', name: 'TMG (Trimethylglycine)', nameRu: 'ТМГ (Триметилглицин)', tier: 'standard',
    category: ['amino','methylation','metabolic'],
    forms: [{id:'tmg_500',name:'TMG 500mg',nameRu:'ТМГ 500 мг',dose:'500-1000 мг/д',best:true},{id:'tmg_1000',name:'TMG 1000mg',nameRu:'ТМГ 1000 мг',dose:'1000 мг/д',best:false}],
    organs: ['LIVER','BRAIN','BLOOD'], systems: ['hepatic','neuro','metabolic'],
    mechanisms: ['METHYL_DONOR','HOMOCYSTEINE_LOWERING','OSMOLYTE','LIVER_PROTECTION'],
    description: 'Донор метильных групп. Снижает гомоцистеин (важно для сердечно-сосудистого здоровья на ААС), поддерживает метилирование ДНК. Также осмопротектор для клеток печени.',
    dosage: { mg: 1000, timing: '1x/д с едой', form: 'порошок/капс' },
    bestForCourse: true,
    synergies: [{with:'folate',effect:'Метилирование',mechanism:'TMG+5-MTHF+B12',severity:'HIGH'},{with:'vitamin_b12',effect:'Снижение гомоцистеина',mechanism:'TMG+B12',severity:'MEDIUM'}],
    conflicts: [{with:'methotrexate',effect:'Влияние на фолатный цикл',mechanism:'ТМГ+метотрексат',severity:'MEDIUM'}],
    monitoring: [{what:'Гомоцистеин',when:'Каждые 8 нед',targetRange:'< 8 мкмоль/л'}],
    contraindications: ['Гипергомоцистеинемия (мониторинг)'],
    sideEffects: ['Диарея (высокие дозы)'],
    targetOrgan: 'Гепатоциты, головной мозг, эритроциты',
    organMechanism: 'Метилирование гомоцистеина, осморегуляция, защита печени',
    mechanismOfAction: 'Донор метильных групп (BHMT путь); реметилирование гомоцистеина в метионин; осмопротекция клеток (TMG — осмолит); снижение гомоцистеина; защита гепатоцитов от токсических метаболитов; повышение S-аденозилметионина',
    clinicalEffect: 'Снижение гомоцистеина, защита печени, поддержка метилирования, кардиопротекция',
    bestForm: 'ТМГ 500 мг 1x/д с едой',
  },
   SAME: {
    id: 'SAME', name: 'SAM-e', nameRu: 'S-Аденозилметионин (SAMe)', tier: 'standard',
    category: ['amino','methylation','hepatoprotector'],
    forms: [{id:'same_400',name:'SAM-e 400mg',nameRu:'SAMe 400 мг',dose:'400-800 мг/д натощак',best:true}],
    organs: ['LIVER','BRAIN','JOINTS'], systems: ['hepatic','neuro','musculoskeletal'],
    mechanisms: ['METHYL_DONOR','GLUTATHIONE_PRECURSOR','NEUROTRANSMITTER_SYNTHESIS','LIVER_DETOX'],
    description: 'Метилированный метаболин метионина. Главный донор метильных групп в организме. Поддерживает функцию печени, синтез нейромедиаторов (дофамин, серотонин). Эффективен при холестазе.',
    dosage: { mg: 800, timing: '1x/д натощак за 30 мин до еды', form: 'таб EC' },
    bestForCourse: true,
    synergies: [{with:'milk_thistle',effect:'Гепатопротекция',mechanism:'SAMe+расторопша',severity:'MEDIUM'},{with:'b_vitamins',effect:'Метилирование',mechanism:'SAMe+B6+B12+фолат',severity:'MEDIUM'}],
    conflicts: [{with:'antidepressant_ssri',effect:'Усиление серотонина (риск СС)',mechanism:'Синергия',severity:'MEDIUM'}],
    monitoring: [{what:'Печёночные ферменты',when:'Каждые 4 нед',targetRange:'В норме'},{what:'Гомоцистеин',when:'Каждые 8 нед',targetRange:'< 8'}],
    contraindications: ['Биполярное расстройство','Беременность'],
    sideEffects: ['Тошнота','Бессонница','Диарея'],
    targetOrgan: 'Гепатоциты, головной мозг (нейроны), хондроциты',
    organMechanism: 'Метилирование биомолекул, синтез нейротрансмиттеров, детоксикация печени',
    mechanismOfAction: 'Донор метильных групп (главный); активация цистатионин-β-синтазы; стимуляция синтеза глутатиона; ингибирование TNF-α; модуляция серотониновых (5-HT) и дофаминовых рецепторов; репарация хряща через стимуляцию хондроцитов',
    clinicalEffect: 'Гепатопротекция, улучшение настроения, защита хрящей, детоксикация',
    bestForm: 'SAMe 400 мг натощак 2x/д',
  },
   VITAMIN_B1: {
    id: 'VITAMIN_B1', name: 'Vitamin B1 (Thiamine)', nameRu: 'Витамин B1 (Тиамин)', tier: 'standard',
    category: ['vitamin','metabolic'],
    forms: [{id:'b1_100',name:'B1 100mg',nameRu:'Тиамин 100 мг',dose:'100 мг/д',best:true}],
    organs: ['BRAIN','HEART','LIVER'], systems: ['neuro','cardio','metabolic'],
    mechanisms: ['CARBOHYDRATE_METABOLISM','NERVE_CONDUCTION','ATP_SYNTHESIS','COENZYME'],
    description: 'Водорастворимый витамин B1. Кофермент энергетического метаболизма (декарбоксилирование кетокислот). Важен для нервной системы, сердечной функции. + Бенфотиамин для лучшей биодоступности.',
    dosage: { mg: 100, timing: '1x/д', form: 'таб' },
    bestForCourse: false,
    synergies: [{with:'b_complex',effect:'Комплекс B',mechanism:'B1+B2+B3+B5+B6+B7+B9+B12',severity:'MEDIUM'}],
    conflicts: [{with:'alcohol',effect:'Снижение абсорбции',mechanism:'Алкоголь+B1',severity:'HIGH'}],
    monitoring: [{what:'Уровень тиамина',when:'Каждые 12 нед',targetRange:'70-180 нмоль/л'}],
    contraindications: ['Гиперчувствительность'],
    sideEffects: ['Редко: аллергия'],
    targetOrgan: 'Головной мозг (нейроны), миокард, гепатоциты',
    organMechanism: 'Углеводный обмен, нервная проводимость, синтез АТФ',
    mechanismOfAction: 'Кофактор транскетолазы (пентозофосфатный путь); кофактор пируватдегидрогеназы (цикл Кребса); кофактор α-кетоглутаратдегидрогеназы; проведение нервных импульсов через ацетилхолиновые синапсы; синтез миелина',
    clinicalEffect: 'Поддержка энергетического обмена, улучшение нервной проводимости, когнитивная поддержка',
    bestForm: 'Тиамин 100 мг/д',
  },
   COLOSTRUM: {
    id: 'COLOSTRUM', name: 'Bovine Colostrum', nameRu: 'Коллострум (молозиво)', tier: 'standard',
    category: ['immunomodulator','gut'],
    forms: [{id:'colostrum_1000',name:'Colostrum 1000mg',nameRu:'Коллострум 1000 мг',dose:'1000 мг 2x/д',best:true}],
    organs: ['GUT','IMMUNE_SYSTEM','BLOOD'], systems: ['gastrointestinal','immune','hematologic'],
    mechanisms: ['IMMUNE_MODULATION','IGG_IGA','GUT_BARRIER_STRENGTHENING','GROWTH_FACTORS','ANTIMICROBIAL'],
    description: 'Молозиво крупного рогатого скота. Богато иммуноглобулинами (IgG), лактоферрином, ростовыми факторами. Укрепляет иммунитет, восстанавливает слизистую кишечника.',
    dosage: { mg: 2000, timing: '2x/д натощак', form: 'капс/порошок' },
    bestForCourse: true,
    synergies: [{with:'probiotics',effect:'Синергия для микробиома',mechanism:'Коллострум+пробиотики',severity:'MEDIUM'},{with:'lactoferrin',effect:'Иммунный комплекс',mechanism:'IgG+лактоферрин',severity:'MEDIUM'}],
    conflicts: [{with:'milk_allergen',effect:'Аллергия на коровье молоко',mechanism:'Казеин/лактоза',severity:'MEDIUM'}],
    monitoring: [{what:'IgG в крови',when:'Каждые 12 нед',targetRange:'Повышение'}],
    contraindications: ['Аллергия на коровье молоко'],
    sideEffects: ['Вздутие','Дискомфорт в ЖКТ'],
    targetOrgan: 'Эпителий кишечника (энтероциты), GALT (лимфоидная ткань), иммунные клетки',
    organMechanism: 'Иммунная защита слизистых, укрепление кишечного барьера, факторы роста',
    mechanismOfAction: 'Поставка IgG (иммуноглобулины G); лактоферрин (хелатирование Fe); TGF-β (регуляция иммунитета); IGF-1 (фактор роста); EGF (фактор эпидермального роста); модуляция TLR4; укрепление tight junctions',
    clinicalEffect: 'Укрепление иммунитета, восстановление слизистой кишечника, антимикробная защита',
    bestForm: 'Коллострум 1000 мг 2x/д',
  },
   PYCNOGENOL: {
    id: 'PYCNOGENOL', name: 'Pycnogenol', nameRu: 'Пикногенол (экстракт сосны)', tier: 'standard',
    category: ['antioxidant','cardioprotector','anti_inflammatory'],
    forms: [{id:'pycnogenol_100',name:'Pycnogenol 100mg',nameRu:'Пикногенол 100 мг',dose:'100-200 мг/д',best:true}],
    organs: ['VESSELS','SKIN','BRAIN','HEART'], systems: ['vascular','integumentary','neuro','cardio'],
    mechanisms: ['ANTIOXIDANT','VASODILATION','COLLAGEN_SYNTHESIS','ANTIINFLAMMATORY','ENDOTHELIAL_NOS'],
    description: 'Олигомерные проантоцианидины из коры французской морской сосны. Мощный антиоксидант (в 50x > вит.E, 20x > вит.C). Улучшает эндотелиальную функцию, снижает АД, защищает коллаген.',
    dosage: { mg: 150, timing: '1-2x/д', form: 'таб' },
    bestForCourse: true,
    synergies: [{with:'vitamin_c',effect:'Коллаген+антиоксидант',mechanism:'Пикногенол+вит.C',severity:'MEDIUM'}],
    conflicts: [{with:'anticoagulant_drugs',effect:'Усиление антикоагуляции',mechanism:'Проантоцианидины',severity:'MEDIUM'}],
    monitoring: [{what:'АД',when:'Каждые 8 нед',targetRange:'< 130/80'}],
    contraindications: ['Аутоиммунные заболевания (теоретически)'],
    sideEffects: ['Редко: дискомфорт'],
    targetOrgan: 'Сосудистый эндотелий, кожа (дерма), головной мозг, миокард',
    organMechanism: 'Антиоксидантная защита, синтез NO, синтез коллагена, эндотелиальная функция',
    mechanismOfAction: 'Активация eNOS (фосфорилирование Ser1177); повышение продукции NO (вазодилатация); ингибиция NF-κB → снижение ICAM-1/VCAM-1; стимуляция синтеза коллагена через TGF-β; улавливание ROS (50x > вит.E); ингибирование гиалуронидазы',
    clinicalEffect: 'Улучшение эндотелиальной функции, снижение АД, антиоксидантная защита, улучшение состояния кожи',
    bestForm: 'Пикногенол 100 мг 1-2x/д',
  },
   BROMELAIN: {
    id: 'BROMELAIN', name: 'Bromelain', nameRu: 'Бромелайн', tier: 'standard',
    category: ['proteolytic','enzyme','anti_inflammatory'],
    forms: [{id:'bromelain_500',name:'Bromelain 500mg',nameRu:'Бромелайн 500 мг',dose:'500 мг 2x/д натощак',best:true},{id:'bromelain_1000',name:'Bromelain 1000mg',nameRu:'Бромелайн 1000 мг',dose:'1000 мг/д',best:false}],
    organs: ['JOINTS','GUT','BLOOD'], systems: ['musculoskeletal','gastrointestinal','hematologic'],
    mechanisms: ['PROTEOLYTIC','ANTIINFLAMMATORY','FIBRINOLYTIC','EDEMA_REDUCTION'],
    description: 'Протеолитический фермент из стебля ананаса. Уменьшает воспаление, отёки, разжижает кровь. Эффективен при остеоартрите, синусите, после травм. Синергия с куркумином и папаином.',
    dosage: { mg: 1000, timing: '2x/д натощак', form: 'капс' },
    bestForCourse: false,
    synergies: [{with:'curcumin',effect:'Противовоспалительный комплекс',mechanism:'Бромелайн+куркумин',severity:'HIGH'},{with:'papain',effect:'Системная энзимотерапия',mechanism:'Бромелайн+папаин',severity:'MEDIUM'},{with:'serrapeptase',effect:'Протеолитики',mechanism:'Ферменты',severity:'MEDIUM'}],
    conflicts: [{with:'anticoagulant_drugs',effect:'Усиление антикоагуляции',mechanism:'Фибринолиз',severity:'MEDIUM'}],
    monitoring: [{what:'Воспаление (СРБ)',when:'Каждые 8 нед',targetRange:'< 3 мг/л'}],
    contraindications: ['Гемофилия','Аллергия на ананас'],
    sideEffects: ['Диарея','Диспепсия'],
    targetOrgan: 'Синовиальная оболочка суставов, энтероциты, сосудистое русло',
    organMechanism: 'Расщепление фибрина, гидролиз белков воспаления, снижение отёка',
    mechanismOfAction: 'Протеолиз фибриногена/фибрина и коллагена; ингибирование синтеза ПГЕ2; активация плазминогена; ингибирование агрегации тромбоцитов через снижение тромбоксана А2; модуляция цитокинов (снижение IL-1β, TNF-α)',
    clinicalEffect: 'Снижение воспаления и отёка, улучшение подвижности суставов, разжижение крови',
    bestForm: 'Бромелайн 500 мг 2x/д натощак',
  },
   FOLATE: {
    id: 'FOLATE', name: '5-MTHF (Folate)', nameRu: '5-МТГФ (фолат)', tier: 'core',
    category: ['vitamin','methylation','hematologic'],
    forms: [{id:'mthf_400',name:'5-MTHF 400mcg',nameRu:'5-МТГФ 400 мкг',dose:'400 мкг/д',best:true},{id:'mthf_1000',name:'5-MTHF 1000mcg',nameRu:'5-МТГФ 1000 мкг',dose:'1000 мкг/д',best:false}],
    organs: ['BLOOD','LIVER','BRAIN'], systems: ['hematologic','hepatic','neuro'],
    mechanisms: ['METHYL_DONOR','HOMOCYSTEINE_LOWERING','DNA_SYNTHESIS','NEURAL_TUBE_PROTECTION'],
    description: 'Активная форма фолата (метилфолат). Не требует метаболической активации — подходит при MTHFR-мутациях. Донор метильных групп, снижает гомоцистеин, критичен для кроветворения.',
    dosage: { mg: 0.4, timing: '1x/д', form: 'таб' },
    bestForCourse: true,
    synergies: [{with:'tmg',effect:'Метилирование',mechanism:'5-MTHF+TMG+B12',severity:'HIGH'},{with:'vitamin_b12',effect:'Гомоцистеин/цикл метилирования',mechanism:'Фолат+B12',severity:'HIGH'}],
    conflicts: [{with:'methotrexate',effect:'Конкуренция за DHFR',mechanism:'Фолат+метотрексат',severity:'HIGH'}],
    monitoring: [{what:'Гомоцистеин',when:'Каждые 8 нед',targetRange:'< 8 мкмоль/л'},{what:'Ферритин',when:'Каждые 8 нед',targetRange:'> 30'}],
    contraindications: ['Злокачественные новообразования (высокие дозы)'],
    sideEffects: ['Бессонница (высокие дозы)'],
    targetOrgan: 'Костный мозг (эритробласты), гепатоциты, нейроны',
    organMechanism: 'Метилирование ДНК, синтез пуринов/пиримидинов, гомеостаз гомоцистеина',
    mechanismOfAction: 'Кофактор MTHFR — поставка 5-метил-ТГФ для реметилирования гомоцистеина; донор метильных групп (MTR); синтез тимидина (де novo путь); поддержка эритропоэза и нейротрансмиттерного синтеза',
    clinicalEffect: 'Снижение гомоцистеина, поддержка кроветворения, профилактика нейротубулярных дефектов, улучшение метилирования',
    bestForm: '5-МТГФ 400 мкг/д',
  },
   LECITHIN: {
    id: 'LECITHIN', name: 'Lecithin', nameRu: 'Лецитин', tier: 'standard',
    category: ['lipid','hepatoprotector','neuroprotector'],
    forms: [{id:'lecithin_1200',name:'Lecithin 1200mg',nameRu:'Лецитин 1200 мг',dose:'1200 мг 2x/д',best:true}],
    organs: ['LIVER','BRAIN','BLOOD'], systems: ['hepatic','neuro','hematologic'],
    mechanisms: ['CHOLINE_SOURCE','LIPID_METABOLISM','LIVER_PROTECTION','MEMBRANE_STABILIZATION'],
    description: 'Фосфолипид (фосфатидилхолин). Источник холина, поддерживает мембраны клеток, улучшает липидный обмен. На курсе ААС — гепатопротектор, снижает жировой гепатоз.',
    dosage: { mg: 2400, timing: '2x/д с едой', form: 'капс' },
    bestForCourse: true,
    synergies: [{with:'milk_thistle',effect:'Гепатопротекция',mechanism:'Лецитин+расторопша',severity:'MEDIUM'}],
    conflicts: [{with:'cholestyramine',effect:'Снижение абсорбции',mechanism:'Холестирамин+лецитин',severity:'MEDIUM'}],
    monitoring: [{what:'Липидный профиль',when:'Каждые 8 нед',targetRange:'Триглицериды < 150'}],
    contraindications: ['Гиперчувствительность'],
    sideEffects: ['Диспепсия'],
    targetOrgan: 'Гепатоциты, нейроны (миелин), эритроциты',
    organMechanism: 'Липидный метаболизм, холиновый обмен, мембранная стабилизация',
    mechanismOfAction: 'Поставка фосфатидилхолина — основного структурного фосфолипида мембран; улучшение транспорта липидов из печени; повышение уровня ацетилхолина через поставку холина; снижение стеатоза печени',
    clinicalEffect: 'Гепатопротекция, снижение жирового гепатоза, поддержка когнитивных функций',
    bestForm: 'Лецитин 1200 мг 2x/д',
  },
   PHOSPHATIDYLSERINE: {
    id: 'PHOSPHATIDYLSERINE', name: 'Phosphatidylserine', nameRu: 'Фосфатидилсерин', tier: 'standard',
    category: ['nootropic','lipid'],
    forms: [{id:'ps_100',name:'PS 100mg',nameRu:'Фосфатидилсерин 100 мг',dose:'100-200 мг/д',best:true}],
    organs: ['BRAIN','ADRENALS'], systems: ['neuro','endocrine'],
    mechanisms: ['CORTISOL_REDUCTION','MEMBRANE_FLUIDITY','NEUROTRANSMITTER_BALANCE','COGNITIVE_ENHANCEMENT'],
    description: 'Фосфолипид клеточных мембран. Снижает кортизол (важно на курсе), улучшает память и когнитивные функции. Синергия с DHA и гингко для нейропротекции.',
    dosage: { mg: 200, timing: '2x/д', form: 'капс' },
    bestForCourse: true,
    synergies: [{with:'ginkgo',effect:'Когнитивная поддержка',mechanism:'ФC+гингко',severity:'MEDIUM'}],
    conflicts: [
      { with: "ashwagandha", effect: "Возможное чрезмерное снижение кортизола", mechanism: "Оба подавляют ось HPA", severity: "MEDIUM" },
      { with: "vitamin_b6", effect: "Усиление синтеза нейромедиаторов", mechanism: "PS + B6 = субстрат для нейротрансмиттеров", severity: "LOW" },
    ],
    monitoring: [{what:'Кортизол',when:'Каждые 8 нед',targetRange:'AM < 20 мкг/дл'}],
    contraindications: ['Беременность (высокие дозы)'],
    sideEffects: ['Бессонница (при вечернем приёме)'],
    targetOrgan: 'Головной мозг (нейрональные мембраны), кора надпочечников',
    organMechanism: 'Мембранная текучесть, нейромедиаторная передача, регуляция оси ГГНС',
    mechanismOfAction: 'Стимуляция активности PKC (протеинкиназа C); модуляция фосфолипидного бислоя; повышение эффективности нейромедиаторных рецепторов; снижение кортизола через ингибирование 11β-HSD; активация пируватдегидрогеназы',
    clinicalEffect: 'Снижение кортизола (до 30%), улучшение памяти и когнитивных функций, нейропротекция',
    bestForm: 'Фосфатидилсерин 100 мг 3x/д',
  },
   PHOSPHATIDYLCHOLINE: {
    id: 'PHOSPHATIDYLCHOLINE', name: 'Phosphatidylcholine', nameRu: 'Фосфатидилхолин', tier: 'standard',
    category: ['lipid','hepatoprotector','neuroprotector'],
    forms: [{id:'pc_500',name:'PC 500mg',nameRu:'Фосфатидилхолин 500 мг',dose:'500 мг 2x/д',best:true}],
    organs: ['LIVER','BRAIN','BLOOD'], systems: ['hepatic','neuro','hematologic'],
    mechanisms: ['CHOLINE_SOURCE','LIPID_TRANSPORT','LIVER_PROTECTION','MEMBRANE_STABILIZATION'],
    description: 'Концентрированный источник фосфатидилхолина (95%). Основной фосфолипид клеточных мембран. Гепатопротектор, улучшает липидный профиль, поддерживает когнитивные функции.',
    dosage: { mg: 1000, timing: '2x/д с едой', form: 'капс' },
    bestForCourse: true,
    synergies: [{with:'lecithin',effect:'Фосфолипидный комплекс',mechanism:'ФХ+лецитин',severity:'MEDIUM'}],
    conflicts: [{with:'phenylbutyrate',effect:'Конкуренция за всасывание',mechanism:'ФХ+фенилбутират',severity:'LOW'}],
    monitoring: [{what:'Функция печени',when:'Каждые 12 нед',targetRange:'АЛТ < 40'}],
    contraindications: ['Гиперчувствительность'],
    sideEffects: ['Рыбная отрыжка'],
    targetOrgan: 'Гепатоциты, нейроны (миелиновые оболочки), эритроциты',
    organMechanism: 'Фосфолипидный синтез, липидный транспорт, миелинизация нервных волокон',
    mechanismOfAction: 'Экзогенный источник фосфатидилхолина; поставка холина для синтеза ацетилхолина; улучшение транспорта липидов через VLDL; стабилизация клеточных мембран; обеспечение субстратом для синтеза миелина',
    clinicalEffect: 'Гепатопротекция, улучшение липидного профиля, поддержка когнитивных функций',
    bestForm: 'Фосфатидилхолин 500 мг 2x/д',
  },
   ARTICHOKE: {
    id: 'ARTICHOKE', name: 'Artichoke Extract', nameRu: 'Экстракт артишока', tier: 'standard',
    category: ['hepatoprotector','choleretic','gut'],
    forms: [{id:'artichoke_500',name:'Artichoke 500mg',nameRu:'Артишок 500 мг',dose:'500 мг 2x/д',best:true}],
    organs: ['LIVER','GALLBLADDER','GUT'], systems: ['hepatic','gastrointestinal'],
    mechanisms: ['CHOLERETIC','ANTIOXIDANT','LIPID_METABOLISM','DIGESTIVE_STIMULATION'],
    description: 'Экстракт артишока (цинарин + лютеолин). Желчегонное, гепатопротектор, снижает ЛПНП. Стимулирует регенерацию гепатоцитов. Синергия с расторопшей для защиты печени.',
    dosage: { mg: 1000, timing: '2x/д до еды', form: 'капс' },
    bestForCourse: true,
    synergies: [{with:'milk_thistle',effect:'Гепатопротекторный стек',mechanism:'Артишок+расторопша',severity:'MEDIUM'}],
    conflicts: [{with:'cholecystitis_acute',effect:'Противопоказан при острой форме',mechanism:'Усиление желчеотделения',severity:'HIGH'}],
    monitoring: [{what:'Липидный профиль',when:'Каждые 8 нед',targetRange:'ЛПНП < 2.6'}],
    contraindications: ['Острый холецистит','Желчнокаменная болезнь (обострение)'],
    sideEffects: ['Диарея','Дискомфорт в правом подреберье'],
    targetOrgan: 'Гепатоциты, эпителий жёлчных протоков, энтероциты',
    organMechanism: 'Секреция жёлчи, регенерация гепатоцитов, липидный обмен',
    mechanismOfAction: 'Стимуляция секреции жёлчи (холерез) через цинарин; повышение активности CYP7A1; снижение синтеза ЛПНП; антиоксидантная защита гепатоцитов через лютеолин; ингибирование HMG-CoA редуктазы',
    clinicalEffect: 'Улучшение желчеоттока, снижение ЛПНП, гепатопротекция, улучшение пищеварения',
    bestForm: 'Артишок 500 мг 2x/д',
  },
   VITAMIN_E: {
    id: 'VITAMIN_E', name: 'Vitamin E (Tocopherol)', nameRu: 'Витамин Е (токоферол)', tier: 'core',
    category: ['vitamin','antioxidant','lipid'],
    forms: [{id:'vit_e_400',name:'Vitamin E 400 IU',nameRu:'Витамин Е 400 МЕ',dose:'400 МЕ/д (смешанные токоферолы)',best:true},{id:'vit_e_800',name:'Vitamin E 800 IU',nameRu:'Витамин Е 800 МЕ',dose:'800 МЕ/д',best:false}],
    organs: ['LIVER','HEART','SKIN','BRAIN'], systems: ['hepatic','cardio','integumentary','neuro'],
    mechanisms: ['ANTIOXIDANT','LIPID_PEROXIDATION_INHIBITION','MEMBRANE_PROTECTION','IMMUNE_MODULATION'],
    description: 'Жирорастворимый антиоксидант. Защищает мембраны от перекисного окисления. На курсе ААС — снижает окислительный стресс, защищает печень и сердечно-сосудистую систему.',
    dosage: { mg: 268, timing: '1x/д с жирной едой', form: 'капс' },
    bestForCourse: true,
    synergies: [{with:'vitamin_c',effect:'Антиоксидантный каскад',mechanism:'Е+С',severity:'MEDIUM'},{with:'selenium',effect:'Антиоксидантная защита',mechanism:'Е+Se',severity:'MEDIUM'}],
    conflicts: [{with:'anticoagulant_drugs',effect:'Усиление антикоагуляции',mechanism:'Витамин Е',severity:'MEDIUM'}],
    monitoring: [{what:'Липидный профиль',when:'Каждые 8 нед',targetRange:'ОХ < 200'}],
    contraindications: ['Гипервитаминоз Е (редко)'],
    sideEffects: ['Редко: кровотечения при > 1000 МЕ/д'],
    targetOrgan: 'Гепатоциты, кардиомиоциты, кератиноциты кожи, нейроны',
    organMechanism: 'Защита мембран от перекисного окисления, антиоксидантная защита, иммунная модуляция',
    mechanismOfAction: 'Улавливание пероксильных радикалов (ROO•); разрыв цепи перекисного окисления липидов; защита ЛПНП от окисления; модуляция PKC; ингибирование агрегации тромбоцитов; активация PPAR-γ',
    clinicalEffect: 'Снижение окислительного стресса, защита печени и сердца, улучшение липидного профиля',
    bestForm: 'Витамин Е 400 МЕ/д (смешанные токоферолы)',
  },
   BERBERINE: {
    id: 'BERBERINE', name: 'Berberine', nameRu: 'Берберин', tier: 'core',
    category: ['metabolic','antioxidant','gut'],
    forms: [{id:'berberine_500',name:'Berberine 500mg',nameRu:'Берберин 500 мг',dose:'500 мг 2-3x/д',best:true}],
    organs: ['LIVER','PANCREAS','GUT','HEART'], systems: ['metabolic','hepatic','gastrointestinal','cardio'],
    mechanisms: ['AMPK_ACTIVATION','INSULIN_SENSITIVITY','LIPID_METABOLISM','GLUCOSE_UPTAKE','GUT_FLORA_MODULATION'],
    description: 'Алкалоид из барбариса. Активирует AMPK — «метаболический переключатель». Снижает глюкозу, инсулин, ЛПНП. Эффективен при метаболическом синдроме. Улучшает чувствительность к инсулину.',
    dosage: { mg: 1500, timing: '3x/д за 15-30 мин до еды', form: 'капс' },
    bestForCourse: true,
    synergies: [{with:'silymarin',effect:'Гепатопротекция+метаболизм',mechanism:'Берберин+силимарин',severity:'MEDIUM'},{with:'cinnamon',effect:'Снижение глюкозы',mechanism:'Берберин+корица',severity:'MEDIUM'}],
    conflicts: [{with:'metformin',effect:'Усиление гипогликемии',mechanism:'AMPK+метформин',severity:'HIGH'}],
    monitoring: [{what:'Глюкоза натощак',when:'Каждые 4 нед',targetRange:'< 5.5 ммоль/л'},{what:'HbA1c',when:'Каждые 12 нед',targetRange:'< 5.7%'},{what:'Липидный профиль',when:'Каждые 8 нед',targetRange:'ОХ < 200'}],
    contraindications: ['Беременность','Тяжелая гипогликемия'],
    sideEffects: ['Диарея','Диспепсия','Снижение аппетита'],
    targetOrgan: 'Гепатоциты, β-клетки поджелудочной, энтероциты, кардиомиоциты',
    organMechanism: 'Метаболический сигналинг AMPK, инсулиновая чувствительность, гомеостаз глюкозы, липидный обмен',
    mechanismOfAction: 'Активация AMPK (фосфорилирование Thr172); ингибирование митохондриального комплекса I; подавление глюконеогенеза в печени; повышение транслокации GLUT4; модуляция микробиома через подавление патогенов; ингибирование редуктазы HMG-CoA',
    clinicalEffect: 'Снижение глюкозы и инсулина, улучшение липидного профиля, AMPK-активация, метаболическая защита',
    bestForm: 'Берберин 500 мг 2-3x/д до еды',
  },
   L_THEANINE: {
    id: 'L_THEANINE', name: 'L-Theanine', nameRu: 'L-Теанин', tier: 'standard',
    category: ['amino','nootropic','anxiolytic'],
    forms: [{id:'theanine_200',name:'L-Theanine 200mg',nameRu:'L-Теанин 200 мг',dose:'200 мг 2x/д',best:true}],
    organs: ['BRAIN','ADRENALS'], systems: ['neuro','endocrine'],
    mechanisms: ['GABA_AGONIST','SEROTONIN_MODULATION','ALPHA_WAVE_ENHANCEMENT','GLUTAMATE_MODULATION'],
    description: 'Аминокислота из зелёного чая. Повышает альфа-волны (расслабление без сонливости), снижает тревожность, улучшает фокус. Синергия с магнием и ГАМК для сна и антистресса.',
    dosage: { mg: 400, timing: '2x/д утро+вечер', form: 'капс' },
    bestForCourse: false,
    synergies: [{with:'magnesium',effect:'Сон/антистресс',mechanism:'Теанин+магний',severity:'MEDIUM'},{with:'gaba',effect:'ГАМК-ергический комплекс',mechanism:'Теанин+ГАМК',severity:'MEDIUM'}],
    conflicts: [{with:'antipsychotics',effect:'Потенцирование седации',mechanism:'Теанин+антипсихотики',severity:'MEDIUM'}],
    monitoring: [{what:'Качество сна',when:'Еженедельно',targetRange:'Улучшение'}],
    contraindications: ['Индивидуальная непереносимость'],
    sideEffects: ['Редко: сонливость'],
    targetOrgan: 'Головной мозг (альфа-волны), кора надпочечников',
    organMechanism: 'Нейромедиаторный баланс (GABA/глутамат), вегетативная регуляция стресса',
    mechanismOfAction: 'Агонизм GABA-A и GABA-B рецепторов; модуляция глутаматных рецепторов (NMDA и AMPA); повышение продукции альфа-волн (8-12 Гц); ингибирование глутаматдекарбоксилазы; снижение кортизола через ось HPA',
    clinicalEffect: 'Расслабление без седации, улучшение качества сна, снижение тревожности и кортизола',
    bestForm: 'L-Теанин 200 мг 2x/д',
  },
   GLYCINE: {
    id: 'GLYCINE', name: 'Glycine', nameRu: 'Глицин', tier: 'standard',
    category: ['amino','nootropic','sleep'],
    forms: [{id:'glycine_1000',name:'Glycine 1000mg',nameRu:'Глицин 1000 мг',dose:'1000 мг перед сном',best:true},{id:'glycine_3000',name:'Glycine 3000mg',nameRu:'Глицин 3000 мг',dose:'3000 мг перед сном',best:false}],
    organs: ['BRAIN','LIVER','MUSCLES'], systems: ['neuro','hepatic','muscular'],
    mechanisms: ['NEUROTRANSMITTER','GLUTATHIONE_PRECURSOR','COLLAGEN_COMPONENT','SLEEP_PROMOTION'],
    description: 'Простейшая аминокислота. Нейромедиатор (глициновые рецепторы) — улучшает качество сна. Компонент синтеза глутатиона и коллагена. Снижает гомоцистеин.',
    dosage: { mg: 3000, timing: 'перед сном', form: 'порошок/капс' },
    bestForCourse: false,
    synergies: [{with:'magnesium',effect:'Сон (глицинат магния)',mechanism:'Глицин+Mg',severity:'MEDIUM'}],
    conflicts: [{with:'antipsychotics',effect:'Потенцирование седации',mechanism:'Глицин+антипсихотики',severity:'MEDIUM'}],
    monitoring: [{what:'Качество сна',when:'Еженедельно',targetRange:'Улучшение'}],
    contraindications: ['Индивидуальная непереносимость'],
    sideEffects: ['Редко: тошнота'],
    targetOrgan: 'Головной мозг (глициновые рецепторы), гепатоциты, мышечная ткань',
    organMechanism: 'Нейромедиация в ЦНС, синтез глутатиона, синтез коллагена',
    mechanismOfAction: 'Агонизм глициновых рецепторов (GlyR) в спинном мозге; поставка субстрата для синтеза глутатиона в печени; стимуляция синтеза коллагена через гидроксилирование пролина; модуляция NMDA-рецепторов',
    clinicalEffect: 'Улучшение качества сна, снижение гомоцистеина, поддержка синтеза коллагена',
    bestForm: 'Глицин 1000 мг перед сном',
  },
   ASTRAGALUS: {
    id: 'ASTRAGALUS', name: 'Astragalus', nameRu: 'Астрагал перепончатый', tier: 'standard',
    category: ['adaptogen','immunomodulator','antioxidant'],
    forms: [{id:'astragalus_500',name:'Astragalus 500mg',nameRu:'Астрагал 500 мг',dose:'500 мг 2x/д',best:true}],
    organs: ['IMMUNE_SYSTEM','HEART','LIVER','KIDNEYS'],
    systems: ['immune','cardio','hepatic','renal'],
    mechanisms: ['IMMUNE_MODULATION','TELOMERASE_ACTIVATION','ANTIOXIDANT','ADAPTOGEN','CARDIO_PROTECTION'],
    description: 'Астрагал — королевский адаптоген китайской медицины. Активирует теломеразу (защита теломер), модулирует иммунитет, защищает сердце и почки. Снижает токсичность химиотерапии.',
    dosage: { mg: 1000, timing: '2x/д', form: 'капс' },
    bestForCourse: false,
    synergies: [{with:'ashwagandha',effect:'Адаптогенный комплекс',mechanism:'Астрагал+ашваганда',severity:'MEDIUM'}],
    conflicts: [{with:'immunosuppressant_drugs',effect:'Антагонизм',mechanism:'Иммуностимуляция',severity:'MEDIUM'}],
    monitoring: [{what:'Иммуноглобулины',when:'Каждые 12 нед',targetRange:'Повышение IgA/IgG'}],
    contraindications: ['Аутоиммунные заболевания (острая фаза)'],
    sideEffects: ['Редко: аллергия'],
    targetOrgan: 'Иммунная система, миокард, гепатоциты, нефроны',
    organMechanism: 'Активация теломеразы, модуляция иммунного ответа, кардиопротекция',
    mechanismOfAction: 'Активация hTERT и каталитической субъединицы теломеразы; модуляция TLR4/NF-κB пути; увеличение продукции IL-2 и IFN-γ; защита сердечной мышцы через ингибирование iNOS; ингибирование апоптоза гепатоцитов',
    clinicalEffect: 'Укрепление иммунитета, защита теломер, кардио- и нефропротекция, адаптогенный эффект',
    bestForm: 'Астрагал 500 мг 2x/д',
  },
   RUTIN: {
    id: 'RUTIN', name: 'Rutin', nameRu: 'Рутин (рутозид)', tier: 'standard',
    category: ['flavonoid','cardioprotector','antioxidant','anti_inflammatory'],
    forms: [{id:'rutin_500',name:'Rutin 500mg',nameRu:'Рутин 500 мг',dose:'500 мг 2x/д',best:true}],
    organs: ['VESSELS','HEART','BRAIN','SKIN'], systems: ['vascular','cardio','neuro','integumentary'],
    mechanisms: ['ANTIOXIDANT','VASCULAR_PROTECTION','CAPILLARY_STRENGTHENING','ANTIINFLAMMATORY','VENOTONIC'],
    description: 'Биофлавоноид (рутозид) — укрепляет стенки капилляров, уменьшает их проницаемость. Венопротектор, антиоксидант. Синергия с витамином C и гесперидином для сосудистой защиты.',
    dosage: { mg: 1000, timing: '2x/д', form: 'капс' },
    bestForCourse: false,
    synergies: [{with:'vitamin_c',effect:'Усиление антиоксидантной защиты',mechanism:'Рутин+вит.C',severity:'MEDIUM'},{with:'hesperidin',effect:'Флавоноидный комплекс для сосудов',mechanism:'Рутин+гесперидин+диосмин',severity:'HIGH'},{with:'diosmin',effect:'Венопротекторный стек',mechanism:'Рутин+диосмин',severity:'MEDIUM'}],
    conflicts: [{with:'anticoagulant_drugs',effect:'Потенциальное усиление антикоагуляции',mechanism:'Флавоноиды',severity:'LOW'}],
    monitoring: [{what:'Состояние вен (осмотр)',when:'Каждые 12 нед',targetRange:'Уменьшение отёков'}],
    contraindications: ['Беременность (высокие дозы)'],
    sideEffects: ['Редко: лёгкое расстройство ЖКТ'],
    targetOrgan: 'Эндотелий капилляров, стенки вен, сосудистый эндотелий, кожа',
    organMechanism: 'Капиллярная проницаемость, венозный тонус, антиоксидантная защита сосудистой стенки',
    mechanismOfAction: 'Ингибирование гиалуронидазы (снижение проницаемости капилляров); укрепление коллагенового матрикса; антиоксидантное действие через хелатирование Fe2+ и Cu2+; ингибирование ЦОГ-2 и 5-ЛОГ; модуляция NF-κB',
    clinicalEffect: 'Укрепление капилляров, уменьшение отёков, венопротекция, снижение воспаления',
    bestForm: 'Рутин 500 мг 2x/д',
  },  magnesium: {
    id: 'magnesium', name: 'Magnesium', nameRu: 'Магний', tier: 'core',
    category: ['mineral','electrolyte','neuroprotector','cardioprotector'],
    forms: [{id:'magnesium_citrate',name:'Magnesium Citrate',nameRu:'Магний цитрат',dose:'400 мг/д',best:true},{id:'magnesium_glycinate',name:'Magnesium Glycinate',nameRu:'Магний глицинат',dose:'200 мг 2x/д',best:false}],
    organs: ['BRAIN','HEART','MUSCLES','NERVES'], systems: ['neuro','cardio','musculoskeletal'],
    mechanisms: ['ELECTROLYTE','ENZYME_COFACTOR','NEUROTRANSMITTER_REGULATION','ATP_SYNTHESIS','MUSCLE_RELAXATION'],
    description: 'Эссенциальный минерал. Кофактор >300 ферментов. Регулирует нервную проводимость, сокращение мышц, сердечный ритм. Критичен для энергетического обмена и синтеза белка.',
    dosage: { mg: 400, timing: '1x/д вечером', form: 'цитрат/глицинат' },
    bestForCourse: true,
    targetOrgan: 'Нейроны, кардиомиоциты, скелетные мышцы, митохондрии',
    organMechanism: 'Регуляция нервно-мышечной проводимости, кофактор 300+ ферментов, синтез АТФ, мышечная релаксация',
    mechanismOfAction: 'Физиологический блокатор NMDA-рецепторов, кофактор гексокиназы/пируваткиназы/креатинкиназы, модуляция Ca2+-каналов (антагонист кальция), стабилизация митохондриальной мембраны',
    clinicalEffect: 'Улучшение сна, снижение тревожности, профилактика судорог, улучшение сердечного ритма, повышение энергии',
    bestForm: 'Магний цитрат 400 мг/д вечером',
    synergies: [{with:'vitamin_b6',effect:'Усвоение магния',mechanism:'Магний+B6',severity:'HIGH'},{with:'taurine',effect:'Сердечная поддержка',mechanism:'Магний+таурин',severity:'MEDIUM'}],
    conflicts: [{with:'calcium',effect:'Конкуренция за абсорбцию',mechanism:'Mg+Ca',severity:'MEDIUM'}],
    monitoring: [{what:'Магний сыворотки',when:'Каждые 8 нед',targetRange:'0.75-1.0 ммоль/л'}],
    contraindications: ['Тяжёлая почечная недостаточность','Миастения'],
    sideEffects: ['Диарея (цитрат)','Желудочный дискомфорт'],
  },
  HEPTRAL: {
    id: 'heptral', name: 'Ademetionine', nameRu: 'Гептрал (адеметионин)',
    tier: 'specialty', category: ['hepatoprotector','methylation','neuroprotector','pharma'],
    forms: [
      {id:'heptral_inj',name:'Heptral 400mg',nameRu:'Гептрал 400 мг инъекции',dose:'400 мг в/в или в/м 1x/д',best:true},
      {id:'heptral_tab',name:'Heptral 500mg',nameRu:'Гептрал 500 мг таблетки',dose:'500 мг 2x/д',best:false},
    ],
    organs: ['LIVER','BRAIN','JOINTS','GALLBLADDER'], systems: ['hepatic','neuro','musculoskeletal'],
    mechanisms: ['ADEMETIONINE','METHYL_DONATION','LIVER_DETOX','CHOLERETIC','ANTIDEPRESSANT','ANTIOXIDANT','GLUTATHIONE_PRECURSOR'],
    description: 'Адеметионин (S-аденозил-L-метионин) — основной донор метильных групп. Гепатопротектор с холекинетическим (желчегонным) и антидепрессивным действием. Восстанавливает глутатион, поддерживает детоксикацию печени.',
    dosage: { mg: 500, timing: '400 мг в/в 1x/д (инъекции) / 500 мг 2x/д (таб)', form: 'инъекции/таб' },
    bestForCourse: true,
    synergies: [
      {with:'TUDCA',effect:'Комплексная защита печени',mechanism:'Гептрал+ТУДХК',severity:'HIGH'},
      {with:'NAC',effect:'Синтез глутатиона',mechanism:'Адеметионин+NAC+глицин',severity:'MEDIUM'},
      {with:'milk_thistle',effect:'Синергия гепатопротекции',mechanism:'Гептрал+расторопша',severity:'MEDIUM'},
    ],
    conflicts: [{with:'ssri',effect:'Риск серотонинового синдрома',mechanism:'Адеметионин + СИОЗС',severity:'MEDIUM'}],
    monitoring: [
      {what:'АЛТ/АСТ',when:'Каждые 4 недели',targetRange:'<40 Ед/л'},
      {what:'Билирубин',when:'Каждые 4 недели',targetRange:'<21 мкмоль/л'},
      {what:'ГГТП',when:'Каждые 8 нед',targetRange:'<61 Ед/л'},
    ],
    contraindications: ['Биполярное расстройство','Беременность (I триместр)','Детский возраст'],
    sideEffects: ['Тошнота','Сухость во рту','Бессонница','Диарея','Головокружение'],
    targetOrgan: 'Гепатоциты, нейроны, хондроциты, эпителий жёлчных протоков',
    organMechanism: 'Метилирование биомолекул, синтез глутатиона, холерез, нейротрансмиттерный синтез',
    mechanismOfAction: 'Донор метильных групп (SAMe); активация цистатионин-β-синтазы; стимуляция синтеза глутатиона; ингибирование TNF-α; модуляция серотониновых и дофаминовых рецепторов; холеретическое действие',
    clinicalEffect: 'Гепатопротекция, улучшение настроения, холеретический эффект, защита хряща',
    bestForm: 'Гептрал 400 мг в/в 1x/д',
  },
   LEGALON: {
    id: 'legalon', name: 'Silymarin', nameRu: 'Легалон (силимарин)',
    tier: 'specialty', category: ['hepatoprotector','antioxidant','herb','pharma'],
    forms: [
      {id:'legalon_70',name:'Legalon 70',nameRu:'Легалон 70 (35 мг силимарина)',dose:'3 капс 3x/д',best:false},
      {id:'legalon_forte',name:'Legalon Forte',nameRu:'Легалон Форте (140 мг силимарина)',dose:'1 капс 3x/д',best:true},
    ],
    organs: ['LIVER','KIDNEYS','SKIN','PANCREAS'], systems: ['hepatic','renal','integumentary','metabolic'],
    mechanisms: ['ANTIOXIDANT','LIVER_DETOX','CELL_REGENERATION','HYPOGLYCEMIC','ANTIFIBROTIC','ANTIINFLAMMATORY'],
    description: 'Силимарин (расторопша пятнистая) — гепатопротектор с антиоксидантным и антифибротическим действием. Стабилизирует мембраны гепатоцитов, стимулирует синтез белка и регенерацию печени.',
    dosage: { mg: 420, timing: '420 мг/д (420-840 мг в Forte)', form: 'капс' },
    bestForCourse: true,
    synergies: [
      {with:'nac',effect:'Комплексная детоксикация печени',mechanism:'Силимарин+NAC',severity:'HIGH'},
      {with:'curcumin',effect:'Противовоспалительный синергизм',mechanism:'Силимарин+куркумин',severity:'MEDIUM'},
      {with:'vitamin_e',effect:'Антиоксидантная защита',mechanism:'Силимарин+вит.E',severity:'MEDIUM'},
    ],
    conflicts: [{with:'iron',effect:'Снижение абсорбции железа',mechanism:'Силимарин хелатирует Fe',severity:'LOW'}],
    monitoring: [
      {what:'АЛТ/АСТ',when:'Каждые 4 нед',targetRange:'<40 Ед/л'},
      {what:'Билирубин',when:'Каждые 8 нед',targetRange:'Нормализация'},
    ],
    contraindications: ['Аллергия на расторопшу','Желчнокаменная болезнь (стадия обострения)'],
    sideEffects: ['Лёгкое слабительное действие','Аллергические реакции (редко)'],
    targetOrgan: 'Гепатоциты, нефроны, кератиноциты кожи, β-клетки поджелудочной',
    organMechanism: 'Детоксикация печени (фаза I/II), регенерация гепатоцитов, антиоксидантная защита',
    mechanismOfAction: 'Стабилизация мембран гепатоцитов; ингибирование 5-липоксигеназы; антиоксидантное действие (улавливание радикалов); стимуляция синтеза белка и рибосомальной РНК; антифибротическое действие через TGF-β',
    clinicalEffect: 'Снижение АЛТ/АСТ, защита печени при токсических нагрузках, гипогликемический эффект',
    bestForm: 'Легалон Форте 1 капс 3x/д',
  },
   IBUDILAST: {
    id: 'ibudilast', name: 'Ibudilast', nameRu: 'Ибудиласт',
    tier: 'specialty', category: ['neuroprotector','anti_inflammatory','pharma'],
    forms: [
      {id:'ibudilast_10',name:'Ibudilast 10mg',nameRu:'Ибудиласт 10 мг',dose:'10 мг 2-3x/д',best:false},
      {id:'ibudilast_20',name:'Ibudilast 20mg',nameRu:'Ибудиласт 20 мг',dose:'20 мг 2x/д',best:true},
    ],
    organs: ['BRAIN','NERVES','LUNGS','VESSELS'], systems: ['neuro','respiratory','vascular'],
    mechanisms: ['PDE4_INHIBITION','PDE10_INHIBITION','NEUROPROTECTION','ANTIINFLAMMATORY','GLIAL_MODULATION','NEUROTROPHIC'],
    description: 'Ингибитор PDE4/PDE10 — подавляет нейровоспаление через модуляцию микроглии. Повышает BDNF, защищает нейроны. Применяется при нейродегенеративных заболеваниях и астме.',
    dosage: { mg: 30, timing: '30-60 мг/д', form: 'таб' },
    bestForCourse: false,
    synergies: [
      {with:'NAC',effect:'Антиоксидантная синергия',mechanism:'Ибудиласт+NAC',severity:'MEDIUM'},
      {with:'curcumin',effect:'Подавление нейровоспаления',mechanism:'Ибудиласт+куркумин',severity:'MEDIUM'},
    ],
    conflicts: [{with:'nsaids',effect:'Усиление риска ЖКТ-кровотечений',mechanism:'PDE4+НПВС',severity:'LOW'}],
    monitoring: [
      {what:'Неврологический статус',when:'Каждые 12 нед',targetRange:'Улучшение когниции'},
      {what:'Тошнота/ЖКТ',when:'Первые 2 недели',targetRange:'Переносимость'},
    ],
    contraindications: ['Язвенная болезнь ЖКТ (обострение)','Беременность','Геморрагический инсульт в анамнезе'],
    sideEffects: ['Тошнота','Снижение аппетита','Дискомфорт в эпигастрии'],
    targetOrgan: 'Головной мозг (микроглия), периферические нервы, лёгкие, сосудистый эндотелий',
    organMechanism: 'Нейровоспаление, глиальная активация, бронходилатация, церебральный кровоток',
    mechanismOfAction: 'Ингибирование PDE4 и PDE10; снижение продукции TNF-α, IL-1β и MCP-1 микроглией; повышение BDNF и GDNF; модуляция TLR4; подавление активации астроцитов',
    clinicalEffect: 'Снижение нейровоспаления, нейропротекция, улучшение когнитивных функций, бронходилатация',
    bestForm: 'Ибудиласт 20 мг 2x/д',
  },
};
 
// ── FROM: catalog-exports.ts ──
﻿// Side effects file to prevent Vite tree-shaking of catalog data

// Re-export everything to ensure it stays in the bundle
export const CATALOG_SIZE = Object.keys(SUPPORT_CATALOG_DATA).length;
export const CANONICAL_SIZE = Object.keys(CANONICAL_ID_MAP).length;