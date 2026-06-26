import { SupportStack } from './support-stacks-types';
export const STACKS_PART_3: SupportStack[] = [
  // 48. МЕМБРАННЫЙ НООТРОП: PS + PC + Alpha-GPC
  // ========================================================
  {
    id: 'membrane_ps_ump_pc_stack',
    name: 'Мембранный ноотроп: фосфатидилсерин + фосфатидилхолин + UMP',
    problem: 'Снижение когнитивных функций, ухудшение памяти, дефицит фосфолипидов нейрональных мембран на ААС',
    system: 'Нервная',
    description: 'Фосфатидилсерин (PS) — основной фосфолипид нейрональных мембран, ^ нейропластичность и v кортизол. Фосфатидилхолин (PC) — субстрат для синтеза мембран и миелина. Уридин монофосфат (UMP) — предшествентор РНК и дофамина, ^ синаптическую пластичность и память.',
    synergyPrinciple: 'PS ^ структурную целостность мембран и v стресс, PC ^ субстрат мембран и миелин, UMP ^ дофамин и синаптическую пластичность. Структура + субстрат + нейропластичность.',
    substances: [
      { id: 'phosphatidylserine', dose: '300 мг', timing: 'evening', mechanism: '^ нейрональные мембраны, v кортизол через HPA-ось, ^ BDNF, ^ нейропластичность' },
      { id: 'phosphatidylcholine', dose: '1200 мг', timing: 'morning', mechanism: 'Субстрат для синтеза нейрональных мембран и миелина, ^ PC в ГЭБ' },
      { id: 'uridine_monophosphate', dose: '250 мг', timing: 'evening', mechanism: 'Предшественник РНК, ^ синтез PC через CDP-холиновый путь, ^ дофамин D2, ^ синаптическую пластичность' },
    ],
    synergyScore: 80,
    timingSummary: 'Утро: PC 1200 мг с едой. Вечер: PS 300 мг + UMP 250 мг за 1 ч до сна.',
    monitoring: 'Когнитивные тесты (MMSE, Струп), BDNF, кортизол утренний — каждые 4-8 нед.',
    specialInstructions: 'PS + UMP вместе вечером (синергия мембранного синтеза). PC утром с жирной едой.',
    contraindications: 'Подагра (UMP ^ мочевую кислоту). Тяжёлая гипотония (PS).',
    warnings: '? PS может v АД. ? PC >2400 мг/сут — дискомфорт ЖКТ. ? UMP >500 мг — головокружение.',
    anatomicalMapping: {
      organSystems: ['Нервная', 'Эндокринная'],
      targetOrgans: ['Головной мозг (нейрональные мембраны)', 'Гипоталамо-гипофизарная ось'],
      organMechanisms: 'Синаптическая пластичность, миелинизация, проведение нервного импульса, нейроэндокринная регуляция',
      drugMechanisms: [
        'PS — v 11?-HSD1 > v кортизол, ^ PKC/BDNF, ^ D2-рецепторы',
        'PC — ^ PC в нейрональных мембранах, ^ миелин, ^ текучесть мембран',
        'UMP — ^ CDP-холин > ^ PC, ^ дофамин D2, ^ синаптогенез',
      ],
      mechanismCodes: ['MEMBRANE_PHOSPHOLIPID', 'CORTISOL_REGULATION', 'NEUROPLASTICITY', 'DOPAMINE_MODULATION', 'MYELIN_SYNTHESIS'],
      finalEffect: '^ когнитивной гибкости, v кортизола, ^ памяти (вербальной и пространственной), ^ фокуса и мотивации',
    },
    structuredInteractions: {
      synergies: [
        { with: 'ps+pc', effect: 'Структура + функция', mechanism: 'PS ^ целостность, PC ^ субстрат — синергия мембран', strength: 'HIGH' },
        { with: 'ump+pc', effect: 'Два пути синтеза PC', mechanism: 'UMP ^ CDP-холин, PC ^ прямой PC — полный синтез мембран', strength: 'HIGH' },
        { with: 'ps+ump', effect: 'Кортизол + дофамин', mechanism: 'PS v кортизол, UMP ^ дофамин — ^ когниции + ^ мотивации', strength: 'MEDIUM' },
      ],
      conflicts: [
        { with: 'глюкокортикоиды', effect: 'Антагонизм с PS', mechanism: 'GS ^ кортизол, PS v — конкуренция', strength: 'MEDIUM' },
      ],
      specialInstructions: 'PS+UMP вечером за 1 ч до сна. PC утром с жирной едой. Омега-3 дополнит мембранную терапию.',
      cautions: 'При ^ мочевой кислоте — v UMP до 125 мг. При v кортизоле — v PS до 100 мг.',
    },
    structuredLabControl: {
      markers: [
        { marker: 'Кортизол утренний', when: 'Каждые 4 нед', targetRange: '140-690 нмоль/л' },
        { marker: 'BDNF плазма', when: 'Каждые 8 нед', targetRange: '>7500 пг/мл' },
        { marker: 'MMSE', when: '1 раз в 4 нед', targetRange: '>28 баллов' },
        { marker: 'АД', when: 'Еженедельно', targetRange: '<130/85 мм рт.ст.' },
        { marker: 'Мочевая кислота', when: '1 раз в 8 нед', targetRange: '<420 мкмоль/л' },
      ],
    },
  },
  // ========================================================
  // 49. NAD+/ДОЛГОЛЕТИЕ: спермидин + ресвератрол + CoQ10 + пиперин
  // ========================================================
  {
    id: 'longevity_nad_stack',
    name: 'NAD+/долголетие: спермидин + NR + ресвератрол + CoQ10 + пиперин',
    problem: 'Снижение NAD+, ослабление аутофагии, ускоренное старение на фоне ААС, митохондриальная дисфункция',
    system: 'Метаболизм / Эпигенетика',
    description: 'NR — предшественник NAD+ (^ NAD+ на 30-50%), спермидин — индуктор аутофагии, ресвератрол — активатор SIRT1 (v mTOR, ^ AMPK), CoQ10 — митохондриальная поддержка, пиперин — ^ биодоступность ресвератрола на 2000%.',
    synergyPrinciple: 'NR ^ NAD+ (субстрат сиртуинов), спермидин ^ аутофагию через EP300, ресвератрол ^ SIRT1/AMPK, CoQ10 ^ ЭТЦ, пиперин ^ биодоступность. Пять механизмов замедления старения.',
    substances: [
      { id: 'spermidine', dose: '10 мг', timing: 'morning', mechanism: 'Ингибитор EP300 > ^ аутофагия, v NF-?B, ^ митохондриальный контроль качества' },
      { id: 'nicotinamide_riboside', dose: '300 мг', timing: 'morning', mechanism: 'Предшественник NAD+ через NRK1/NRK2, ^ NAD+ на 30-50%, активация SIRT1/SIRT6' },
      { id: 'resveratrol', dose: '500 мг', timing: 'morning', mechanism: '^ SIRT1, ^ AMPK, v mTOR, ^ PGC1?, v Nf-?B' },
      { id: 'coq10', dose: '200 мг', timing: 'morning', mechanism: 'Переносчик e? в ЭТЦ, v митохондриальный ROS, ^ АТФ' },
      { id: 'piperine', dose: '10 мг', timing: 'morning', mechanism: 'Ингибитор глюкуронидации, ^ биодоступность ресвератрола на 2000%' },
    ],
    synergyScore: 88,
    timingSummary: 'Утро (с завтраком): спермидин 10 мг + NR 300 мг + ресвератрол 500 мг + CoQ10 200 мг + пиперин 10 мг.',
    monitoring: 'Маркеры аутофагии (LC3-II/I), NAD+ уровень, SIRT1 активность, липидный профиль, СРБ — каждые 8-12 нед.',
    specialInstructions: 'Принимать с жирной едой (^ абсорбцию CoQ10 и ресвератрола). Пиперин обязателен для биодоступности.',
    contraindications: 'Беременность (спермидин). Эстроген-зависимые опухоли (ресвератрол). Гипотония.',
    warnings: '? Спермидин >20 мг/сут — тошнота, головокружение. ? Ресвератрол >1 г/сут — v абсорбцию B12.',
    anatomicalMapping: {
      organSystems: ['Метаболизм', 'Сердечно-сосудистая', 'Нервная'],
      targetOrgans: ['Митохондрии', 'Эпигеном', 'Сосуды', 'Головной мозг'],
      organMechanisms: 'Аутофагия, сиртуиновый путь, митохондриальный биогенез, эпигенетическая регуляция',
      drugMechanisms: [
        'Спермидин — v EP300 (ацетилирование), ^ TFEB, ^ аутофагия, v Nf-?B',
        'Ресвератрол — ^ SIRT1, ^ AMPK, v mTORC1, ^ PGC1?, ^ FOXO',
        'CoQ10 — ^ ЭТЦ, v ROS, ^ АТФ, ^ мембранный потенциал митохондрий',
        'Piperine — v UDP-глюкуронилтрансфераза, ^ абсорбцию ресвератрола',
      ],
      mechanismCodes: ['AUTOPHAGY_INDUCER', 'SIRTUIN_ACTIVATION', 'AMPK_ACTIVATION', 'MITOCHONDRIAL_ENERGY', 'EPIGENETIC_MODULATION', 'BIOAVAILABILITY_ENHANCER'],
      finalEffect: '^ аутофагии, ^ NAD+/SIRT1, v СРБ, ^ митохондриальной функции, ^ метаболической гибкости',
    },
    structuredInteractions: {
      synergies: [
        { with: 'spermidine+resveratrol', effect: 'Аутофагия + SIRT1', mechanism: 'Спермидин ^ аутофагию, ресвератрол ^ SIRT1 — синергия долголетия', strength: 'HIGH' },
        { with: 'resveratrol+coq10', effect: 'SIRT1 + ЭТЦ', mechanism: 'Ресвератрол ^ PGC1?, CoQ10 ^ ЭТЦ — ^ митохондриального биогенеза + функции', strength: 'MEDIUM' },
        { with: 'spermidine+coq10', effect: 'Аутофагия + митохондрии', mechanism: 'Спермидин ^ митофагию, CoQ10 ^ ЭТЦ — v старых митохондрий + ^ новых', strength: 'MEDIUM' },
      ],
      conflicts: [
        { with: 'высокие дозы лейцина (>10 г)', effect: 'mTOR ^ > v аутофагии', mechanism: 'Лейцин ^ mTORC1, против аутофагии от спермидина', strength: 'MEDIUM' },
      ],
      specialInstructions: 'Все утром с жирной едой. Не с молоком (пиперин v абсорбцию). Интервал с B12 — 2 ч.',
      cautions: 'Спермидин натощак для ^ аутофагии. Ресвератрол может ^ АД первую неделю.',
    },
    structuredLabControl: {
      markers: [
        { marker: 'NAD+ (эритроциты)', when: 'Каждые 8 нед', targetRange: '^ >20% от базы' },
        { marker: 'LC3-II/I (моноциты)', when: 'По показаниям', targetRange: '^ аутофагии' },
        { marker: 'СРБ', when: 'Каждые 8 нед', targetRange: '<1 мг/л' },
        { marker: 'Липидный профиль', when: 'Каждые 8 нед', targetRange: 'Улучшение' },
        { marker: 'АД', when: 'Еженедельно', targetRange: '<130/85 мм рт.ст.' },
      ],
    },
  },
  // ========================================================
  // 50. ХОЛИНОВЫЙ НООТРОП: Alpha-GPC + гинкго
  // ========================================================
  {
    id: 'choline_ginkgo_stack',
    name: 'Холиновый ноотроп: альфа-ГФХ + холина битартрат + гинкго',
    problem: 'Снижение ацетилхолина, ухудшение памяти и фокуса, снижение церебрального кровотока на ААС',
    system: 'Нервная',
    description: 'Alpha-GPC — ГЭБ-проницаемый донатор холина (^ ACh + ^ GH), холина битартрат — дополнительный субстрат холина (доступная форма), гинкго — ^ церебральный кровоток + холинергическая модуляция. Комбинация для максимальной холинергической поддержки.',
    synergyPrinciple: 'Alpha-GPC ^ холин в мозге через ГЭБ, холина битартрат ^ общий пул холина (периферия + мозг), гинкго ^ церебральный кровоток и защищает нейроны. Три точки холинергической поддержки.',
    substances: [
      { id: 'alpha_gpc', dose: '600 мг', timing: 'morning', mechanism: '^ холин в мозге (ГЭБ-проницаем), ^ ACh, ^ GH, ^ PC мембран' },
      { id: 'choline_bitartrate', dose: '500 мг', timing: 'morning', mechanism: '^ общий пул холина, ^ ACh, ^ PC, ^ метилирование через бетаин' },
      { id: 'ginkgo', dose: '120 мг', timing: 'morning', mechanism: '^ церебральный кровоток (v PAF, ^ NO), v агрегацию тромбоцитов, ^ холинергическую передачу' },
    ],
    synergyScore: 82,
    timingSummary: 'Утро (натощак): Alpha-GPC 600 мг + холина битартрат 500 мг + гинкго 120 мг. Не после 14:00.',
    monitoring: 'Когнитивные тесты (MMSE, Струп), BDNF, церебральный кровоток (ТКДГ) — каждые 4-8 нед.',
    specialInstructions: 'Принимать утром натощак. Не после 14:00. Гинкго может v АД — контроль первую неделю.',
    contraindications: 'Эпилепсия (гинкго v порог судорог). Геморрагический инсульт. Триметиламинурия (холин).',
    warnings: '? Гинкго ^ риск кровотечений (v PAF). ? Холин >2 г/сут — рыбный запах. ? Alpha-GPC >1200 мг — ^ АД.',
    anatomicalMapping: {
      organSystems: ['Нервная', 'Сердечно-сосудистая', 'Эндокринная'],
      targetOrgans: ['Головной мозг', 'Сосуды мозга', 'Гипофиз'],
      organMechanisms: 'Холинергическая нейротрансмиссия, церебральный кровоток, целостность мембран нейронов',
      drugMechanisms: [
        'Alpha-GPC — ^ холин через ГЭБ, ^ ACh, ^ PC, ^ GH через GHRH',
        'Гинкго — ^ PAF ингибитор, ^ NO, ^ церебральный кровоток на 20-30%, ^ ?7-nAChR',
      ],
      mechanismCodes: ['CHOLINERGIC', 'CEREBRAL_BLOOD_FLOW', 'NO_UP', 'NEUROPROTECTION', 'MEMBRANE_PHOSPHOLIPID'],
      finalEffect: '^ памяти (вербальной + пространственной), ^ скорости реакции, ^ когнитивной гибкости, ^ церебрального кровотока',
    },
    structuredInteractions: {
      synergies: [
        { with: 'alpha_gpc+ginkgo', effect: 'Холин + кровоток', mechanism: 'Alpha-GPC ^ холин, гинкго ^ кровоток — синергия когниции', strength: 'HIGH' },
      ],
      conflicts: [
        { with: 'антикоагулянты', effect: 'Гинкго ^ риск кровотечений', mechanism: 'Гинкго v PAF, v агрегацию', strength: 'HIGH' },
        { with: 'антихолинергики (димедрол)', effect: 'Антагонизм с Alpha-GPC', mechanism: 'Блокада мускариновых рецепторов', strength: 'MEDIUM' },
      ],
      specialInstructions: 'Утром натощак. Не с антикоагулянтами. Не после 14:00.',
      cautions: 'При брадикардии — v дозу Alpha-GPC. При ^ АД — v дозу. Контроль АД первую неделю гинкго.',
    },
    structuredLabControl: {
      markers: [
        { marker: 'Струп-тест (время реакции)', when: 'Еженедельно', targetRange: '+20% vs базовая' },
        { marker: 'MMSE', when: '1 раз в 4 нед', targetRange: '>28 баллов' },
        { marker: 'BDNF плазма', when: '1 раз в 8 нед', targetRange: '>7500 пг/мл' },
        { marker: 'АД', when: 'Еженедельно', targetRange: '<130/85 мм рт.ст.' },
        { marker: 'Время реакции (PSR)', when: 'Еженедельно', targetRange: 'v на 10-20%' },
      ],
    },
  },
  // ========================================================
  // 51. НЕЙРО-ВАСКУЛЯРНЫЙ: АЛЬК + хром
  // ========================================================
  {
    id: 'neuro_vascular_stack',
    name: 'Нейро-васкулярный: бенфотиамин + АЛЬК + хром',
    problem: 'Инсулинорезистентность, метаболическая нейропатия, сосудистые нарушения на курсе ААС',
    system: 'Нервная / Метаболизм',
    description: 'Бенфотиамин — жирорастворимый B1 (v AGE, ^ транскетолаза, защита нервов). АЛЬК — мощный антиоксидант и инсулиносенситайзер (^ GLUT4, v AGE, v окислительный стресс в нервах). Хром — ^ чувствительность к инсулину (активация хромодулина). Тройная нейро-васкулярная защита.',
    synergyPrinciple: 'Бенфотиамин v гликирование и ^ пентозофосфатный путь, АЛЬК ^ Nrf2/ARE + ^ инсулиновую чувствительность, хром ^ инсулиновый сигналинг. Три точки метаболической и нейро-сосудистой защиты.',
    substances: [
      { id: 'benfotiamine', dose: '300 мг', timing: 'morning', mechanism: '^ транскетолаза, v AGE-образование, ^ пентозофосфатный путь, ^ АТФ' },
      { id: 'alpha_lipoic', dose: '600 мг', timing: 'morning', mechanism: '^ Nrf2/ARE, хелатор металлов, ^ GLUT4-транслокация, v AGE, ^ GSH' },
      { id: 'chromium', dose: '200 мкг', timing: 'morning', mechanism: 'Компонент хромодулина, ^ активацию инсулинового рецептора (IR), ^ GLUT4' },
    ],
    synergyScore: 85,
    timingSummary: 'Утро (с завтраком): бенфотиамин 300 мг + АЛЬК 600 мг + хром 200 мкг.',
    monitoring: 'Глюкоза натощак, HbA1c, HOMA-IR, инсулин, AGE (пентозидин) — каждые 4-8 нед. Неврологический статус — каждые 12 нед.',
    specialInstructions: 'Принимать с едой для v раздражения ЖКТ. АЛЬК можно разделить 300+300 утро/вечер.',
    contraindications: 'Язва желудка (АЛЬК >600 мг). Тяжёлая почечная недостаточность (хром). Аллергия на тиамин.',
    warnings: '? Хром >1000 мкг/сут — v ферритин. ? АЛЬК >1200 мг — тошнота. ? Бенфотиамин >600 мг — ЖКТ дискомфорт.',
    anatomicalMapping: {
      organSystems: ['Нервная', 'Метаболизм', 'Эндокринная', 'Сосудистая'],
      targetOrgans: ['Периферические нервы', 'Поджелудочная железа', 'Сосуды (эндотелий)', 'Печень'],
      organMechanisms: 'Инсулиновый сигналинг, утилизация глюкозы, антиоксидантная защита нервов, эндотелиальная функция, анти-гликирование',
      drugMechanisms: [
        'Бенфотиамин — ^ транскетолаза (пентозофосфатный путь), v AGE, v Nf-?B',
        'АЛЬК — ^ Nrf2/ARE, ^ GLUT4, v AGE, v Nf-?B, ^ GSH',
        'Хром — v апоБ-хромодулин > ^ активация IR, ^ GLUT4-экспрессия',
      ],
      mechanismCodes: ['INSULIN_SENSITIVITY', 'NRF2_ACTIVATION', 'GLUCOSE_UPTAKE', 'NEUROPROTECTION', 'ANTI_GLYCATION', 'VITAMIN_B1', 'CHROMIUM_COFACTOR'],
      finalEffect: 'v HOMA-IR на 20-40%, v HbA1c на 0.3-0.5%, v AGE на 30%, v нейропатической боли, ^ чувствительности к инсулину',
    },
    structuredInteractions: {
      synergies: [
        { with: 'benfotiamine+alpha_lipoic', effect: 'Анти-AGE + Nrf2', mechanism: 'Бенфотиамин v образование AGE, АЛЬК ^ Nrf2/v AGE-сигналинг — двойной анти-AGE', strength: 'HIGH' },
        { with: 'alpha_lipoic+chromium', effect: 'Nrf2 + IR', mechanism: 'АЛЬК ^ Nrf2/^ GLUT4, хром ^ IR — ^ утилизации глюкозы + ^ антиоксиданта', strength: 'HIGH' },
        { with: 'benfotiamine+chromium', effect: 'B1 + Cr = метаболическая синергия', mechanism: 'Бенфотиамин ^ пентозофосфатный путь, хром ^ IR — ^ глюкозу в энергию + ^ чувствительность', strength: 'MEDIUM' },
      ],
      conflicts: [
        { with: 'антациды (Mg, Ca)', effect: 'v абсорбцию хрома', mechanism: 'Антациды хелатируют Cr', strength: 'MEDIUM' },
        { with: 'цисплатин', effect: 'АЛЬК v эффективность', mechanism: 'Хелатация Pt АЛЬК', strength: 'MEDIUM' },
      ],
      specialInstructions: 'Утро с завтраком. Не с антацидами. Интервал с железом 2 ч (хелация).',
      cautions: 'При HOMA-IR >5 — добавить берберин 500 мг 2x/д. Контроль глюкозы 1 раз в нед.',
    },
    structuredLabControl: {
      markers: [
        { marker: 'Глюкоза натощак', when: 'Каждые 4 нед', targetRange: '3.9-5.6 ммоль/л' },
        { marker: 'HbA1c', when: 'Каждые 8 нед', targetRange: '<5.7%' },
        { marker: 'HOMA-IR', when: 'Каждые 8 нед', targetRange: '<2.5' },
        { marker: 'Инсулин натощак', when: 'Каждые 8 нед', targetRange: '2-25 мкЕд/мл' },
        { marker: 'Неврологический статус', when: 'Каждые 12 нед', targetRange: 'Улучшение чувствительности' },
      ],
    },
  },
];
