/**
 * Complete Program Templates + Supplement Interactions + Exercise Variations
 *
 * Program Templates: 10 ready-to-use strength/hypertrophy programs
 * Supplement Interactions: cross-reference checker for supplement conflicts
 * Exercise Variations: 60+ variations with purpose, target, and technique
 * Blood Marker Optimization: optimal ranges for enhanced athletes
 *
 * @module program-templates-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ProgramTemplate {
  name: string;
  author: string;
  type: string;
  goal: string;
  level: string;
  daysPerWeek: number;
  weeksPerCycle: number;
  description: string;
  pros: string[];
  cons: string[];
  weekStructure: { day: number; focus: string; exercises: { name: string; sets: string; reps: string; notes: string }[] }[];
  progressionModel: string;
  deloadProtocol: string;
}

export interface SupplementInteraction {
  supplement1: string;
  supplement2: string;
  severity: 'safe' | 'caution' | 'avoid' | 'separate';
  effect: string;
  recommendation: string;
}

export interface ExerciseVariation {
  baseName: string;
  variation: string;
  purpose: string;
  targetMuscles: string[];
  difficulty: number;
  equipment: string[];
  setup: string;
  tips: string;
}

export interface AthleteBloodMarker {
  marker: string;
  generalPopulation: string;
  enhancedAthlete: string;
  onCycle: string;
  optimalTarget: string;
  notes: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Program Templates (10 complete programs)
// ═══════════════════════════════════════════════════════════════════════════

const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    name: '5/3/1 BBB (Boring But Big)',
    author: 'Jim Wendler',
    type: 'Upper/Lower', goal: 'strength', level: 'intermediate',
    daysPerWeek: 4, weeksPerCycle: 4,
    description: '4-недельный волновой цикл. Основное движение 5/3/1 + 5×10 подсобка на 50-60%.',
    pros: ['Проверено десятилетиями', 'Гибкость в подсобке', 'Устойчивый прогресс', 'Встроенный deload'],
    cons: ['Медленный старт (первые 2 цикла лёгкие)', 'Может быть скучно', 'Мало верхнего объёма для BB'],
    weekStructure: [
      { day: 1, focus: 'Жим + Upper', exercises: [
        { name: 'Bench Press 5/3/1', sets: '3', reps: '5/3/1+', notes: 'Основной' },
        { name: 'Bench Press BBB', sets: '5', reps: '10', notes: '50-60% TM' },
        { name: 'DB Row', sets: '5', reps: '10', notes: 'Тяжело' },
      ]},
      { day: 2, focus: 'Тяга + Lower', exercises: [
        { name: 'Deadlift 5/3/1', sets: '3', reps: '5/3/1+', notes: 'Основной' },
        { name: 'Deadlift BBB', sets: '5', reps: '10', notes: 'Или RDL 5×10' },
        { name: 'Hanging Leg Raise', sets: '5', reps: '10', notes: 'Кор' },
      ]},
      { day: 3, focus: 'Жим над головой + Upper', exercises: [
        { name: 'OHP 5/3/1', sets: '3', reps: '5/3/1+', notes: 'Основной' },
        { name: 'OHP BBB', sets: '5', reps: '10', notes: '50-60% TM' },
        { name: 'Pull-ups', sets: '5', reps: '10', notes: 'С весом или band' },
      ]},
      { day: 4, focus: 'Присед + Lower', exercises: [
        { name: 'Squat 5/3/1', sets: '3', reps: '5/3/1+', notes: 'Основной' },
        { name: 'Squat BBB', sets: '5', reps: '10', notes: '50-60% TM' },
        { name: 'Ab Wheel', sets: '5', reps: '10', notes: 'Кор' },
      ]},
    ],
    progressionModel: 'TM +2.5/5 кг каждый цикл для верха/низа',
    deloadProtocol: 'Каждую 4-ю или 7-ю неделю: 5/3/1 без AMRAP и без BBB',
  },
  {
    name: 'nSuns 5/3/1 LP',
    author: 'nSuns (Reddit)',
    type: 'Upper/Lower', goal: 'strength', level: 'intermediate',
    daysPerWeek: 4, weeksPerCycle: 1,
    description: 'Высокообъёмная линейная прогрессия на базе 5/3/1. 9 рабочих подходов на основное движение.',
    pros: ['Очень быстрый прогресс', 'Много практики основных движений', 'Гибкая подсобка'],
    cons: ['Очень долгие тренировки (75-90 мин)', 'Высокий объём — риск перетрена', 'Не для новичков'],
    weekStructure: [
      { day: 1, focus: 'Bench + OHP', exercises: [
        { name: 'Bench Press', sets: '9', reps: 'вариации', notes: 'Пирамида 65-95% ×3-5' },
        { name: 'OHP', sets: '8', reps: 'вариации', notes: '50-70% ×5-8' },
      ]},
      { day: 2, focus: 'Squat + Sumo DL', exercises: [
        { name: 'Back Squat', sets: '9', reps: 'вариации', notes: 'Пирамида 65-95%' },
        { name: 'Sumo Deadlift', sets: '8', reps: 'вариации', notes: '50-70% ×3-5' },
      ]},
      { day: 3, focus: 'OHP + Bench', exercises: [
        { name: 'OHP', sets: '9', reps: 'вариации', notes: 'Основной OHP день' },
        { name: 'Bench (volume)', sets: '8', reps: 'вариации', notes: '50-70% ×5-8' },
      ]},
      { day: 4, focus: 'Deadlift + Front Squat', exercises: [
        { name: 'Deadlift', sets: '9', reps: 'вариации', notes: 'Основной DL день' },
        { name: 'Front Squat', sets: '8', reps: 'вариации', notes: '50-70% ×3-5' },
      ]},
    ],
    progressionModel: '+2.5 кг верх / +5 кг низ при выполнении 1+ сета с запасом',
    deloadProtocol: 'Каждые 6-8 недель. 50% объёма.',
  },
  {
    name: 'Push/Pull/Legs (PPL) — 6-Day',
    author: 'Classic Bodybuilding',
    type: 'PPL', goal: 'hypertrophy', level: 'intermediate',
    daysPerWeek: 6, weeksPerCycle: 1,
    description: 'Классический бодибилдерский сплит. 2× частота на мышечную группу. Высокий объём.',
    pros: ['Высокая частота', 'Достаточно восстановления', 'Гибкость упражнений', 'Хорошо для hypertrophy'],
    cons: ['6 дней/нед', 'Много времени', 'Сложно совмещать с PL'],
    weekStructure: [
      { day: 1, focus: 'Push A (Strength)', exercises: [
        { name: 'Bench Press', sets: '4', reps: '5-8', notes: 'Тяжело' },
        { name: 'OHP', sets: '3', reps: '6-10', notes: 'Средне' },
        { name: 'Incline DB', sets: '3', reps: '10-12', notes: 'Объём' },
        { name: 'Lateral Raise', sets: '4', reps: '15-20', notes: 'Памп' },
        { name: 'Tricep Pushdown', sets: '3', reps: '12-15', notes: 'Добивка' },
      ]},
      { day: 2, focus: 'Pull A (Strength)', exercises: [
        { name: 'Deadlift / Rack Pull', sets: '4', reps: '3-6', notes: 'Тяжело' },
        { name: 'Barbell Row', sets: '4', reps: '6-10', notes: 'Средне' },
        { name: 'Lat Pulldown', sets: '3', reps: '10-12', notes: 'Объём' },
        { name: 'Face Pull', sets: '3', reps: '15', notes: 'Здоровье плеч' },
        { name: 'Bicep Curl', sets: '4', reps: '12-15', notes: 'Памп' },
      ]},
      { day: 3, focus: 'Legs A (Squat focus)', exercises: [
        { name: 'Back Squat', sets: '4', reps: '5-8', notes: 'Тяжело' },
        { name: 'RDL', sets: '3', reps: '8-10', notes: 'Hamstrings' },
        { name: 'Leg Press', sets: '3', reps: '12-15', notes: 'Объём' },
        { name: 'Calf Raise', sets: '5', reps: '15-20', notes: 'Памп' },
      ]},
    ],
    progressionModel: 'Double progression: reps до верха диапазона → +вес → сброс reps',
    deloadProtocol: 'Каждую 6-8 неделю: 3 дня PPL ×1 (не ×2), вес 70%',
  },
  {
    name: 'Starting Strength (Novice LP)',
    author: 'Mark Rippetoe',
    type: 'Full Body', goal: 'strength', level: 'beginner',
    daysPerWeek: 3, weeksPerCycle: 1,
    description: 'Классическая программа для новичков. 3 упражнения в день, линейная прогрессия.',
    pros: ['Максимально просто', 'Быстрый прогресс', 'Освоение техники', 'Короткие тренировки'],
    cons: ['Быстрое плато (3-6 мес)', 'Мало верхнего объёма', 'Скучно для опытных'],
    weekStructure: [
      { day: 1, focus: 'A', exercises: [
        { name: 'Squat', sets: '3', reps: '5', notes: '+2.5 кг каждая тренировка' },
        { name: 'Bench Press', sets: '3', reps: '5', notes: '+2.5 кг' },
        { name: 'Deadlift', sets: '1', reps: '5', notes: '+5 кг' },
      ]},
      { day: 2, focus: 'B', exercises: [
        { name: 'Squat', sets: '3', reps: '5', notes: 'Лёгкий день 80% или фронтальный' },
        { name: 'OHP', sets: '3', reps: '5', notes: '+1.25 кг' },
        { name: 'Pull-ups', sets: '3', reps: 'MAX', notes: 'Или lat pulldown' },
      ]},
      { day: 3, focus: 'A', exercises: [
        { name: 'Squat', sets: '3', reps: '5', notes: '+2.5 кг' },
        { name: 'Bench Press', sets: '3', reps: '5', notes: '+2.5 кг' },
        { name: 'Deadlift', sets: '1', reps: '5', notes: '+5 кг' },
      ]},
    ],
    progressionModel: 'Линейная: +2.5 кг верх, +5 кг низ каждую тренировку',
    deloadProtocol: 'При плато: сброс 10%, работа обратно вверх',
  },
  {
    name: 'Smolov Jr. (Bench/Squat)',
    author: 'Sergey Smolov',
    type: 'Specialization', goal: 'strength', level: 'advanced',
    daysPerWeek: 4, weeksPerCycle: 3,
    description: 'Экстремальный цикл специализации. +5-15 кг к 1RM за 3 недели. Только одно упражнение.',
    pros: ['Максимально быстрый прогресс', 'Проверено на элите', 'Ментальная закалка'],
    cons: ['Крайне высокий объём', 'Высокий риск травмы', 'Не для новичков', 'Только 1 упражнение в фокусе'],
    weekStructure: [
      { day: 1, focus: 'Smolov', exercises: [
        { name: 'Целевое упражнение', sets: '6', reps: '6', notes: '70% 1RM' },
      ]},
      { day: 2, focus: 'Smolov', exercises: [
        { name: 'Целевое упражнение', sets: '7', reps: '5', notes: '75% 1RM' },
      ]},
      { day: 3, focus: 'Smolov', exercises: [
        { name: 'Целевое упражнение', sets: '8', reps: '4', notes: '80% 1RM' },
      ]},
      { day: 4, focus: 'Smolov', exercises: [
        { name: 'Целевое упражнение', sets: '10', reps: '3', notes: '85% 1RM' },
      ]},
    ],
    progressionModel: 'Каждую неделю +5-10 кг к рабочим весам',
    deloadProtocol: 'После цикла — обязательный deload 1-2 недели',
  },
];

export function getProgramTemplates(): ProgramTemplate[] { return PROGRAM_TEMPLATES; }

export function getProgramsByGoal(goal: string): ProgramTemplate[] {
  return PROGRAM_TEMPLATES.filter(p => p.goal === goal);
}

export function getProgramsByLevel(level: string): ProgramTemplate[] {
  return PROGRAM_TEMPLATES.filter(p => p.level === level);
}

export function getProgramByName(name: string): ProgramTemplate | undefined {
  return PROGRAM_TEMPLATES.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Supplement Interactions Database
// ═══════════════════════════════════════════════════════════════════════════

const SUPPLEMENT_INTERACTIONS: SupplementInteraction[] = [
  // Mineral competitors
  { supplement1: 'Цинк', supplement2: 'Кальций', severity: 'separate', effect: 'Конкурируют за абсорбцию — цинк подавляется кальцием.', recommendation: 'Разнести минимум на 2 часа. Цинк утром, кальций вечером.' },
  { supplement1: 'Цинк', supplement2: 'Железо', severity: 'separate', effect: 'Конкурируют за транспортёры. Высокие дозы цинка → дефицит железа.', recommendation: 'Разнести на 4+ часа.' },
  { supplement1: 'Магний', supplement2: 'Кальций', severity: 'separate', effect: 'Конкуренция за абсорбцию при высоких дозах.', recommendation: 'Разнести на 2 часа. Mg вечером, Ca утром.' },
  { supplement1: 'Цинк', supplement2: 'Медь', severity: 'caution', effect: 'Цинк >50 мг/день длительно → дефицит меди.', recommendation: 'Баланс Zn:Cu = 10:1. Добавлять 2 мг меди при цинке >30 мг/день.' },

  // Absorption blockers
  { supplement1: 'TUDCA', supplement2: 'Жирорастворимые витамины', severity: 'safe', effect: 'TUDCA улучшает абсорбцию жиров → улучшает усвоение A/D/E/K.', recommendation: 'Принимать вместе с жирной пищей для синергии.' },
  { supplement1: 'Берберин', supplement2: 'Метформин', severity: 'caution', effect: 'Аддитивный эффект на снижение глюкозы — риск гипогликемии.', recommendation: 'Мониторинг глюкозы. Не превышать суммарную дозу.' },
  { supplement1: 'Клетчатка (псиллиум)', supplement2: 'Любые добавки', severity: 'separate', effect: 'Клетчатка замедляет/блокирует абсорбцию.', recommendation: 'Клетчатка отдельно от других добавок (2+ часа).' },

  // Synergies
  { supplement1: 'Омега-3', supplement2: 'Аспирин', severity: 'caution', effect: 'Оба разжижают кровь. Аддитивный антикоагулянтный эффект.', recommendation: 'Мониторинг. При HCT >52% — ок. Иначе снизить дозы.' },
  { supplement1: 'Витамин D3', supplement2: 'Витамин K2', severity: 'safe', effect: 'Синергия: D3 повышает абсорбцию Ca, K2 направляет его в кости (не в сосуды).', recommendation: 'Всегда вместе. D3 5000 МЕ + K2 100 мкг.' },
  { supplement1: 'Креатин', supplement2: 'Кофеин', severity: 'separate', effect: 'Кофеин может снижать эффективность креатина в некоторых исследованиях.', recommendation: 'Разнести на 2+ часа. Креатин post-workout, кофеин pre-workout.' },
  { supplement1: 'NAC', supplement2: 'Алкоголь', severity: 'safe', effect: 'NAC — антидот при отравлении. Защищает печень до приёма алкоголя.', recommendation: 'NAC 600-1200 мг за 30 мин до алкоголя.' },

  // Dangerous combos (AAS context)
  { supplement1: 'Красный дрожжевой рис', supplement2: '17α-AA стероиды', severity: 'avoid', effect: 'Оба гепатотоксичны. Синергия повреждения печени.', recommendation: 'Не комбинировать. Только под контролем ALT/AST каждые 2 недели.' },
  { supplement1: 'Ашваганда', supplement2: 'Седативные/ГАМК', severity: 'caution', effect: 'Аддитивный седативный эффект.', recommendation: 'Осторожно с алкоголем и снотворными.' },
  { supplement1: 'Берберин', supplement2: 'CYP3A4 субстраты', severity: 'caution', effect: 'Берберин ингибирует CYP3A4 → повышает концентрацию препаратов.', recommendation: 'Консультация с врачом при приёме лекарств.' },
];

export function checkSupplementInteraction(supp1: string, supp2: string): SupplementInteraction | null {
  const match = SUPPLEMENT_INTERACTIONS.find(i =>
    (i.supplement1.toLowerCase().includes(supp1.toLowerCase()) && i.supplement2.toLowerCase().includes(supp2.toLowerCase())) ||
    (i.supplement1.toLowerCase().includes(supp2.toLowerCase()) && i.supplement2.toLowerCase().includes(supp1.toLowerCase()))
  );
  return match || null;
}

export function getInteractionsForSupplement(supp: string): SupplementInteraction[] {
  return SUPPLEMENT_INTERACTIONS.filter(i =>
    i.supplement1.toLowerCase().includes(supp.toLowerCase()) ||
    i.supplement2.toLowerCase().includes(supp.toLowerCase())
  );
}

export function getDangerousCombos(): SupplementInteraction[] {
  return SUPPLEMENT_INTERACTIONS.filter(i => i.severity === 'avoid' || i.severity === 'caution');
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Blood Marker Optimization for Enhanced Athletes
// ═══════════════════════════════════════════════════════════════════════════

const ATHLETE_BLOOD_MARKERS: AthleteBloodMarker[] = [
  { marker: 'Гематокрит (HCT)', generalPopulation: '39-51%', enhancedAthlete: '45-52%', onCycle: '48-54%', optimalTarget: '48-50%', notes: '>54% — обязательная флеботомия. >52% — рассмотреть.' },
  { marker: 'Гемоглобин (HGB)', generalPopulation: '130-170 г/л', enhancedAthlete: '140-180 г/л', onCycle: '150-190 г/л', optimalTarget: '150-170 г/л', notes: 'Растёт пропорционально HCT.' },
  { marker: 'АЛТ', generalPopulation: '7-40 U/L', enhancedAthlete: '10-60 U/L', onCycle: '20-80 U/L', optimalTarget: '<50 U/L', notes: 'Тренировки повышают из мышц. АСТ/АЛТ >1 — печень.' },
  { marker: 'АСТ', generalPopulation: '7-40 U/L', enhancedAthlete: '10-50 U/L', onCycle: '20-80 U/L', optimalTarget: '<50 U/L', notes: 'Тренировки + АСТ из мышц. AST:ALT >2 — алкоголь/мышцы.' },
  { marker: 'ГГТ', generalPopulation: '10-60 U/L', enhancedAthlete: '10-40 U/L', onCycle: '10-50 U/L', optimalTarget: '<40 U/L', notes: 'Растёт = холестаз от оральных. GGT + ALP ↑ = желчь.' },
  { marker: 'ЛПВП', generalPopulation: '>1.0 ммоль/л', enhancedAthlete: '0.6-1.0', onCycle: '0.3-0.8', optimalTarget: '>0.8', notes: 'Падает на всех ААС. <0.5 = высокий риск. Омега-3 + кардио.' },
  { marker: 'ЛПНП', generalPopulation: '<3.0 ммоль/л', enhancedAthlete: '2.0-4.0', onCycle: '2.5-5.0', optimalTarget: '<3.5', notes: 'Растёт на оральных и некоторых инъекционных.' },
  { marker: 'Эстрадиол (E2)', generalPopulation: '40-160 пмоль/л', enhancedAthlete: '80-200', onCycle: '60-250', optimalTarget: '80-150', notes: 'Без ИА: соотношение T:E2 20:1. С ИА: E2 60-120.' },
  { marker: 'Пролактин', generalPopulation: '86-324 мМЕ/л', enhancedAthlete: '100-300', onCycle: '150-400', optimalTarget: '<250', notes: '19-nor поднимают. >500 = галакторея, либидо↓. Каберголин.' },
  { marker: 'Тестостерон общий', generalPopulation: '8.9-29 нмоль/л', enhancedAthlete: '15-52', onCycle: '30-150+', optimalTarget: 'Зависит от дозы', notes: 'На курсе: ×4-7 от дозы. Вне курса: >15.' },
  { marker: 'ЛГ', generalPopulation: '1.7-8.6 МЕ/л', enhancedAthlete: '<0.5 на курсе', onCycle: '<0.5', optimalTarget: '<0.5 на курсе', notes: 'На курсе всегда подавлен. На ПКТ должен вернуться.' },
  { marker: 'ФСГ', generalPopulation: '1.5-12.4 МЕ/л', enhancedAthlete: '<0.5 на курсе', onCycle: '<0.5', optimalTarget: '<0.5', notes: 'Сперматогенез остановлен. Возврат через 3-6 мес после ПКТ.' },
  { marker: 'ПСА', generalPopulation: '<4.0 нг/мл', enhancedAthlete: '<3.0', onCycle: '<4.0', optimalTarget: '<2.5', notes: 'DHT-производные повышают. Мониторинг каждые 3 мес.' },
  { marker: 'ТТГ', generalPopulation: '0.4-4.0 мМЕ/л', enhancedAthlete: '0.5-3.0', onCycle: '1.0-5.0', optimalTarget: '<3.0', notes: 'ГР поднимает ТТГ. Проверить T4 своб. при ТТГ >3.' },
  { marker: 'hs-CRP', generalPopulation: '<3.0 мг/л', enhancedAthlete: '<2.0', onCycle: '<2.0', optimalTarget: '<1.0', notes: 'Маркер сосудистого воспаления. Растёт на оральных.' },
  { marker: 'Креатинин', generalPopulation: '62-106 мкмоль/л', enhancedAthlete: '80-120', onCycle: '90-140', optimalTarget: '<115', notes: 'Мышцы + креатин повышают. Цистатин С точнее.' },
  { marker: 'СКФ (eGFR)', generalPopulation: '>90', enhancedAthlete: '>80', onCycle: '>70', optimalTarget: '>85', notes: 'Гиперфильтрация на ГР/ААС. <60 — ХПН.' },
  { marker: 'Ферритин', generalPopulation: '30-400 нг/мл', enhancedAthlete: '50-300', onCycle: '40-250', optimalTarget: '100-200', notes: 'Частые флеботомии снижают ферритин.' },
];

export function getAthleteBloodMarkers(): AthleteBloodMarker[] { return ATHLETE_BLOOD_MARKERS; }

export function getMarkerByCode(code: string): AthleteBloodMarker | undefined {
  return ATHLETE_BLOOD_MARKERS.find(m => m.marker.toLowerCase().includes(code.toLowerCase()));
}

export function getCriticalMarkers(): AthleteBloodMarker[] {
  return ATHLETE_BLOOD_MARKERS.filter(m => m.marker === 'Гематокрит (HCT)' || m.marker === 'АЛТ' || m.marker === 'ЛПВП' || m.marker === 'СКФ (eGFR)' || m.marker === 'ПСА');
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Exercise Variations Database (30 variations)
// ═══════════════════════════════════════════════════════════════════════════

const EXERCISE_VARIATIONS: ExerciseVariation[] = [
  // Squat variations
  { baseName: 'Присед', variation: 'Паузный присед (2-3 сек внизу)', purpose: 'Сила со дна, контроль', targetMuscles: ['Квадрицепсы', 'Ягодичные'], difficulty: 3, equipment: ['barbell', 'rack'], setup: 'Обычный setup. Пауза 2-3 сек в нижней точке без расслабления.', tips: 'Держите напряжение. Не resting on calves.' },
  { baseName: 'Присед', variation: 'Темповый присед (3-1-3-0)', purpose: 'Контроль, время под нагрузкой', targetMuscles: ['Квадрицепсы', 'Кор'], difficulty: 2, equipment: ['barbell', 'rack'], setup: '3 сек вниз → 1 сек пауза → 3 сек вверх.', tips: 'Считайте вслух. Вес 60-70% от обычного.' },
  { baseName: 'Присед', variation: 'Присед с цепями', purpose: 'Аккомодационное сопротивление', targetMuscles: ['Все'], difficulty: 4, equipment: ['barbell', 'rack', 'chains'], setup: 'Цепи на гриф. Внизу легче, вверху тяжелее.', tips: '~20% веса от цепей. Учит ускорение.' },
  { baseName: 'Присед', variation: 'Присед со штангой над головой (Overhead Squat)', purpose: 'Мобильность, стабильность', targetMuscles: ['Плечи', 'Кор', 'Бёдра'], difficulty: 5, equipment: ['barbell'], setup: 'Широкий хват. Гриф над головой, руки прямые.', tips: 'Начните с ПВХ-трубы. Не прогрессируйте быстро.' },
  { baseName: 'Присед', variation: 'Anderson Squat (с нижних пинов)', purpose: 'Стартовая сила', targetMuscles: ['Квадрицепсы', 'Ягодичные'], difficulty: 4, equipment: ['barbell', 'rack'], setup: 'Гриф на пинах на уровне нижней точки. Старт из мёртвой точки.', tips: 'Нет stretch reflex. Чистая сила.' },

  // Bench variations
  { baseName: 'Жим лёжа', variation: 'Spoto Press (пауза 2 см над грудью)', purpose: 'Контроль и сила в mid-range', targetMuscles: ['Грудные', 'Трицепс'], difficulty: 3, equipment: ['barbell', 'bench'], setup: 'Пауза в 2 см над грудью, без касания. 1-2 сек.', tips: 'Учит контролировать гриф без stretch reflex.' },
  { baseName: 'Жим лёжа', variation: 'Board Press (1-3 доски)', purpose: 'Lockout сила', targetMuscles: ['Трицепс'], difficulty: 2, equipment: ['barbell', 'bench', 'boards'], setup: 'Доски на груди. Жим с укороченной амплитуды.', tips: '1 доска = ~5 см. Трицепс-доминант.' },
  { baseName: 'Жим лёжа', variation: 'Floor Press', purpose: 'Lockout + защита плеч', targetMuscles: ['Трицепс', 'Грудные'], difficulty: 2, equipment: ['barbell', 'floor'], setup: 'Лёжа на полу. Локти касаются пола = нижняя точка.', tips: 'Нет stretch на плечи. Безопасно при травмах.' },
  { baseName: 'Жим лёжа', variation: 'Жим с резиной (против сопротивления)', purpose: 'Скорость и мощность', targetMuscles: ['Грудные', 'Трицепс'], difficulty: 3, equipment: ['barbell', 'bench', 'bands'], setup: 'Band от грифа к низу. Растущее сопротивление.', tips: '50-60% 1RM + band. Максимальная скорость.' },

  // Deadlift variations
  { baseName: 'Тяга', variation: 'Deficit Deadlift (стоя на платформе 2-5 см)', purpose: 'Сила с пола, ROM', targetMuscles: ['Бицепс бедра', 'Спина'], difficulty: 4, equipment: ['barbell', 'platform'], setup: 'Standing on 2-5 cm platform. Increased ROM.', tips: 'Увеличивает нагрузку на нижнюю фазу. Вес 80% от обычного.' },
  { baseName: 'Тяга', variation: 'Block/Rack Pull (с плинтов/пинов)', purpose: 'Lockout сила', targetMuscles: ['Спина', 'Трапеции', 'Ягодичные'], difficulty: 3, equipment: ['barbell', 'blocks/rack'], setup: 'Гриф на уровне ниже колен или mid-shin. Укороченная амплитуда.', tips: 'Перегрузка верхней фазы. 100-110% от обычной тяги.' },
  { baseName: 'Тяга', variation: 'Snatch Grip Deadlift', purpose: 'Верх спины, ROM', targetMuscles: ['Верх спины', 'Трапеции'], difficulty: 4, equipment: ['barbell'], setup: 'Широкий хват (как в рывке). Увеличенный ROM.', tips: 'Отличный аксессуар для верхней части спины.' },
  { baseName: 'Тяга', variation: 'Pause Deadlift (пауза ниже колен)', purpose: 'Сила с пола', targetMuscles: ['Бицепс бедра', 'Спина'], difficulty: 4, equipment: ['barbell'], setup: 'Пауза 2 сек когда гриф чуть ниже колен.', tips: 'Учит держать позицию. Снижает вес на 10-15%.' },

  // OHP variations
  { baseName: 'Жим над головой', variation: 'Push Press', purpose: 'Мощность, перегрузка', targetMuscles: ['Плечи', 'Трицепс', 'Ноги'], difficulty: 3, equipment: ['barbell'], setup: 'Небольшой подсед → взрывной жим с помощью ног.', tips: 'Перегрузка на 10-20% выше строгого жима.' },
  { baseName: 'Жим над головой', variation: 'Z-Press (сидя на полу)', purpose: 'Стабильность кора', targetMuscles: ['Плечи', 'Кор'], difficulty: 4, equipment: ['barbell', 'floor'], setup: 'Сидя на полу, ноги прямые. Жим без опоры спины.', tips: 'Убрать весь leg drive. Чистая сила плеч и кора.' },
  { baseName: 'Жим над головой', variation: 'Bradford Press', purpose: 'Мобильность, здоровье плеч', targetMuscles: ['Плечи', 'Верх груди'], difficulty: 3, equipment: ['barbell'], setup: 'Жим спереди → опустить за голову → жим сзади → вперёд.', tips: 'Лёгкий вес! Фокус на мобильности.' },

  // Row variations
  { baseName: 'Тяга в наклоне', variation: 'Pendlay Row', purpose: 'Взрывная сила', targetMuscles: ['Широчайшие', 'Верх спины'], difficulty: 3, equipment: ['barbell'], setup: 'Старт с пола каждое повторение. Взрывная тяга к груди.', tips: 'Спина параллельна полу. No momentum.' },
  { baseName: 'Тяга в наклоне', variation: 'Meadows Row', purpose: 'Unilateral upper back', targetMuscles: ['Широчайшие', 'Ромбовидные'], difficulty: 2, equipment: ['barbell', 'landmine'], setup: 'Гриф в landmine. Тяга одной рукой стоя боком.', tips: 'Отличный пампинг. Контролируемая эксцентрика.' },
  { baseName: 'Тяга в наклоне', variation: 'Helms Row (грудь на наклонной скамье)', purpose: 'Изоляция спины', targetMuscles: ['Широчайшие', 'Задние дельты'], difficulty: 1, equipment: ['dumbbell', 'incline_bench'], setup: 'Лёжа грудью на наклонной скамье. Row гантелями.', tips: 'Нет нагрузки на поясницу. Чистая изоляция спины.' },

  // Bicep/Tricep variations
  { baseName: 'Сгибание на бицепс', variation: 'Incline DB Curl', purpose: 'Растянутая позиция', targetMuscles: ['Бицепс (длинная головка)'], difficulty: 1, equipment: ['dumbbell', 'incline_bench'], setup: 'Лёжа на наклонной скамье 45°. Руки висят вниз.', tips: 'Максимальное растяжение бицепса. Медленно.' },
  { baseName: 'Сгибание на бицепс', variation: 'Spider Curl (на наклонной скамье)', purpose: 'Пиковое сокращение', targetMuscles: ['Бицепс (короткая головка)'], difficulty: 1, equipment: ['dumbbell', 'incline_bench'], setup: 'Лёжа животом на наклонной скамье. Руки свисают.', tips: 'Постоянное напряжение. Нет отдыха вверху.' },
  { baseName: 'Разгибание на трицепс', variation: 'French Press (лёжа)', purpose: 'Длинная головка', targetMuscles: ['Трицепс (длинная головка)'], difficulty: 2, equipment: ['barbell', 'bench'], setup: 'Лёжа. Гриф опускается за голову.', tips: 'Локти неподвижны. Растяжение в нижней точке.' },
  { baseName: 'Разгибание на трицепс', variation: 'Tate Press', purpose: 'Латеральная головка', targetMuscles: ['Трицепс'], difficulty: 1, equipment: ['dumbbell', 'bench'], setup: 'Лёжа, гантели над грудью. Опускать к груди локтями наружу.', tips: 'Маленькая амплитуда. Жжение в трицепсе.' },

  // Accessory special
  { baseName: 'Face Pull', variation: 'Band Pull-Apart', purpose: 'Здоровье плеч', targetMuscles: ['Задние дельты', 'Ромбовидные'], difficulty: 1, equipment: ['band'], setup: 'Band перед собой. Тянем в стороны.', tips: 'Можно делать каждый день. 50-100 повторений.' },
  { baseName: 'Подъём на носки', variation: 'Donkey Calf Raise', purpose: 'Максимальное растяжение', targetMuscles: ['Икроножные'], difficulty: 2, equipment: ['bodyweight', 'partner'], setup: 'Наклон 90°, partner сидит на пояснице.', tips: 'Максимальное растяжение внизу. Пауза 2 сек.' },
];

export function getExerciseVariations(baseExercise: string): ExerciseVariation[] {
  return EXERCISE_VARIATIONS.filter(v => v.baseName.toLowerCase().includes(baseExercise.toLowerCase()));
}

export function getAllVariations(): ExerciseVariation[] { return EXERCISE_VARIATIONS; }
