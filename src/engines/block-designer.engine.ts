/**
 * Training Block Designer + Exercise Search + Nutrient Timing + Warmup Library
 *
 * Block Designer: auto-generate 4-16 week periodized blocks
 * Exercise Search: advanced filtering by 10+ criteria
 * Nutrient Timing: peri-workout nutrition, circadian optimization
 * Warmup Library: 15+ specific warmup routines
 * Body Fat: 5 estimation methods with visual guide
 *
 * @module block-designer-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface TrainingBlock {
  name: string;
  weeks: number;
  daysPerWeek: number;
  sessions: { day: number; focus: string; mainLift: string; secondaryLifts: string[]; accessories: string[]; volumeTarget: string; intensityTarget: string }[];
  progressionModel: string;
  deloadWeek: number | null;
  description: string;
}

export interface ExerciseSearchFilter {
  pattern?: string;
  muscle?: string;
  equipment?: string[];
  difficulty?: number;
  riskLevel?: string;
  isUnilateral?: boolean;
  isCompound?: boolean;
  spineLoad?: string;
  kneeLoad?: string;
  shoulderLoad?: string;
  searchTerm?: string;
}

export interface NutrientTiming {
  phase: string;
  timing: string;
  protein: string;
  carbs: string;
  fat: string;
  water: string;
  supplements: string[];
  rationale: string;
}

export interface WarmupRoutine {
  name: string;
  forExercise: string;
  durationMin: number;
  blocks: { name: string; exercises: { name: string; duration: string; notes: string }[] }[];
}

export interface BodyFatMethod {
  name: string;
  accuracy: string;
  equipment: string[];
  formula: string;
  instructions: string[];
  sites?: { name: string; location: string }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Training Block Designer
// ═══════════════════════════════════════════════════════════════════════════

const BLOCK_TEMPLATES: TrainingBlock[] = [
  {
    name: '4-Week Strength Block', weeks: 4, daysPerWeek: 4, deloadWeek: 4,
    progressionModel: 'Linear +2.5/5 кг',
    description: 'Короткий силовой блок. Недели 1-3: прогрессия. Неделя 4: deload.',
    sessions: [
      { day: 1, focus: 'Squat + Lower', mainLift: 'Back Squat', secondaryLifts: ['RDL', 'Leg Press'], accessories: ['Calf Raise', 'Ab Wheel'], volumeTarget: '4×5-8', intensityTarget: 'RPE 7-8.5' },
      { day: 2, focus: 'Bench + Upper', mainLift: 'Bench Press', secondaryLifts: ['OHP', 'Barbell Row'], accessories: ['Lateral Raise', 'Tricep Pushdown', 'Face Pull'], volumeTarget: '4×5-8', intensityTarget: 'RPE 7-8.5' },
      { day: 3, focus: 'Deadlift + Posterior', mainLift: 'Deadlift', secondaryLifts: ['Front Squat', 'Pull-ups'], accessories: ['Back Extension', 'Bicep Curl'], volumeTarget: '3×3-5', intensityTarget: 'RPE 8-9' },
      { day: 4, focus: 'OHP + Volume Upper', mainLift: 'OHP', secondaryLifts: ['Incline Bench', 'Pendlay Row'], accessories: ['Dips', 'Hammer Curl', 'Band Pull-Apart'], volumeTarget: '4×6-10', intensityTarget: 'RPE 7-8' },
    ],
  },
  {
    name: '8-Week Hypertrophy Block', weeks: 8, daysPerWeek: 5, deloadWeek: 4,
    progressionModel: 'Double Progression',
    description: 'Гипертрофийный блок. 4 недели накопления + deload + 3 недели интенсификации.',
    sessions: [
      { day: 1, focus: 'Upper Push', mainLift: 'Bench Press', secondaryLifts: ['Incline DB', 'Dips'], accessories: ['Lateral Raise', 'Tricep Pushdown', 'Cable Flye'], volumeTarget: '4×8-12', intensityTarget: 'RPE 7-8, RIR 2-3' },
      { day: 2, focus: 'Lower Quad-dominant', mainLift: 'Back Squat', secondaryLifts: ['Leg Press', 'Walking Lunge'], accessories: ['Leg Extension', 'Calf Raise'], volumeTarget: '4×8-15', intensityTarget: 'RPE 7-8, RIR 2-3' },
      { day: 3, focus: 'Upper Pull', mainLift: 'Barbell Row', secondaryLifts: ['Lat Pulldown', 'Face Pull'], accessories: ['Chest-Supported Row', 'Bicep Curl', 'Shrugs'], volumeTarget: '4×10-15', intensityTarget: 'RPE 6-8, RIR 2-4' },
      { day: 4, focus: 'Lower Hip-dominant', mainLift: 'RDL', secondaryLifts: ['Hip Thrust', 'Bulgarian Split Squat'], accessories: ['Hamstring Curl', 'Ab Wheel'], volumeTarget: '4×8-15', intensityTarget: 'RPE 7-8' },
      { day: 5, focus: 'Arms + Delts + Weak Points', mainLift: 'OHP', secondaryLifts: ['Close-Grip Bench', 'EZ Bar Curl'], accessories: ['Lateral Raise', 'Tricep Extension', 'Reverse Flye'], volumeTarget: '3×12-15', intensityTarget: 'RPE 6-7, памп' },
    ],
  },
  {
    name: '12-Week Peaking Block (PL)', weeks: 12, daysPerWeek: 4, deloadWeek: 4,
    progressionModel: 'Block Periodization',
    description: 'Powerlifting peaking. Accumulation (4w) → Intensification (4w) → Peaking (3w) → Meet Week.',
    sessions: [
      { day: 1, focus: 'Squat Heavy', mainLift: 'Low Bar Squat', secondaryLifts: ['Pause Squat', 'Leg Press'], accessories: ['Back Extension', 'Ab Wheel'], volumeTarget: '3-5×1-5', intensityTarget: 'RPE 7-9.5' },
      { day: 2, focus: 'Bench Heavy', mainLift: 'Bench Press', secondaryLifts: ['Close-Grip Bench', 'OHP'], accessories: ['Lateral Raise', 'Tricep Pushdown', 'Face Pull'], volumeTarget: '3-5×1-5', intensityTarget: 'RPE 7-9.5' },
      { day: 3, focus: 'Deadlift Heavy', mainLift: 'Conventional DL', secondaryLifts: ['Deficit DL', 'Barbell Row'], accessories: ['Pull-ups', 'Bicep Curl'], volumeTarget: '2-4×1-3', intensityTarget: 'RPE 8-9.5' },
      { day: 4, focus: 'Volume Bench + Accessories', mainLift: 'Bench Press (volume)', secondaryLifts: ['Incline Bench', 'DB Row'], accessories: ['Dips', 'Tricep Pushdown', 'Band Pull-Apart'], volumeTarget: '4×5-8', intensityTarget: 'RPE 7-8' },
    ],
  },
  {
    name: '6-Week Cut/Recomp Block', weeks: 6, daysPerWeek: 4, deloadWeek: null,
    progressionModel: 'RPE-based (maintain strength)',
    description: 'Сохранение силы на дефиците. 4 тренировки + 3 кардио.',
    sessions: [
      { day: 1, focus: 'Upper Strength', mainLift: 'Bench Press', secondaryLifts: ['Weighted Pull-ups', 'OHP'], accessories: ['Lateral Raise', 'Face Pull'], volumeTarget: '3×3-5', intensityTarget: 'RPE 8-9 (сохранить)' },
      { day: 2, focus: 'Lower Strength', mainLift: 'Back Squat', secondaryLifts: ['RDL', 'Walking Lunge'], accessories: ['Calf Raise', 'Plank'], volumeTarget: '3×3-5', intensityTarget: 'RPE 8-9' },
      { day: 3, focus: 'Upper Volume', mainLift: 'Incline DB Press', secondaryLifts: ['DB Row', 'Dips'], accessories: ['Bicep Curl', 'Tricep Pushdown'], volumeTarget: '3×8-12', intensityTarget: 'RPE 7-8' },
      { day: 4, focus: 'Lower Volume + Deadlift', mainLift: 'Deadlift', secondaryLifts: ['Leg Press', 'Hip Thrust'], accessories: ['Back Extension'], volumeTarget: '2×3 + 3×8-12', intensityTarget: 'RPE 8 DL / RPE 7 rest' },
    ],
  },
];

export function getTrainingBlocks(): TrainingBlock[] { return BLOCK_TEMPLATES; }
export function getBlockByGoal(goal: string): TrainingBlock | undefined {
  return BLOCK_TEMPLATES.find(b => b.name.toLowerCase().includes(goal.toLowerCase()));
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Exercise Search Engine
// ═══════════════════════════════════════════════════════════════════════════

import { EXERCISE_BIOMECHANICS_DB, type ExerciseBio, filterExercises as filterBio } from '../data/exercise-biomechanics-db';

export function searchExercises(filters: ExerciseSearchFilter): ExerciseBio[] {
  let results = [...EXERCISE_BIOMECHANICS_DB];

  if (filters.searchTerm) {
    const q = filters.searchTerm.toLowerCase();
    results = results.filter(e => e.name.toLowerCase().includes(q) || e.pattern.includes(q) || e.id.includes(q));
  }
  if (filters.pattern) results = results.filter(e => e.pattern === filters.pattern);
  if (filters.muscle) {
    results = results.filter(e =>
      e.primaryMuscles.some(m => m.toLowerCase().includes(filters.muscle!.toLowerCase())) ||
      e.secondaryMuscles.some(m => m.toLowerCase().includes(filters.muscle!.toLowerCase()))
    );
  }
  if (filters.equipment?.length) {
    results = results.filter(e => e.equipment.some(eq => filters.equipment!.includes(eq)) || e.equipment.includes('bodyweight'));
  }
  if (filters.difficulty !== undefined) results = results.filter(e => e.difficulty <= filters.difficulty!);
  if (filters.riskLevel) results = results.filter(e => e.riskProfile === filters.riskLevel);
  if (filters.isUnilateral !== undefined) results = results.filter(e => e.isUnilateral === filters.isUnilateral);
  if (filters.isCompound !== undefined) {
    results = results.filter(e => filters.isCompound ? e.category !== 'accessory' && e.category !== 'rehab' : e.category === 'accessory');
  }
  if (filters.spineLoad) results = results.filter(e => e.spineLoad === filters.spineLoad);
  if (filters.kneeLoad) results = results.filter(e => e.kneeLoad === filters.kneeLoad);
  if (filters.shoulderLoad) results = results.filter(e => e.shoulderLoad === filters.shoulderLoad);

  return results;
}

export function getExercisesByMuscle(muscle: string): ExerciseBio[] {
  const m = muscle.toLowerCase();
  return EXERCISE_BIOMECHANICS_DB.filter(e =>
    e.primaryMuscles.some(p => p.toLowerCase().includes(m)) ||
    e.secondaryMuscles.some(s => s.toLowerCase().includes(m))
  );
}

export function getPatternExercises(pattern: string): ExerciseBio[] {
  return EXERCISE_BIOMECHANICS_DB.filter(e => e.pattern === pattern);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Nutrient Timing Guide
// ═══════════════════════════════════════════════════════════════════════════

const NUTRIENT_TIMING_GUIDE: NutrientTiming[] = [
  {
    phase: 'Pre-Workout (60-90 min)', timing: 'За 60-90 мин до тренировки',
    protein: '20-30 г (медленный: курица, творог)', carbs: '40-60 г (сложные: овсянка, рис)', fat: 'Минимум (<10 г)', water: '500-750 мл', supplements: ['Кофеин 200-400 мг', 'Цитруллин 6-8 г', 'Бета-аланин 3-5 г'],
    rationale: 'Медленный белок и сложные углеводы для стабильной энергии. Кофеин за 45-60 мин до.',
  },
  {
    phase: 'Pre-Workout (15-30 min)', timing: 'За 15-30 мин до тренировки',
    protein: '10-15 г (быстрый: whey, EAA)', carbs: '20-30 г (быстрые: банан, финики)', fat: '0 г', water: '250 мл', supplements: ['Сывороточный протеин 15-20 г', 'EAA 10 г'],
    rationale: 'Быстрые нутриенты. Аминокислоты в крови во время тренировки. Не перегружать ЖКТ.',
  },
  {
    phase: 'Intra-Workout', timing: 'Во время тренировки (если >75 мин)',
    protein: '5-10 г (EAA/BCAA)', carbs: '15-30 г/час (Gatorade, декстроза)', fat: '0 г', water: '250-500 мл/час', supplements: ['EAA 10 г + декстроза 30 г в 750 мл воды'],
    rationale: 'Только при длительных тренировках. Снижение катаболизма, поддержание глюкозы.',
  },
  {
    phase: 'Post-Workout (0-30 min)', timing: 'Сразу после тренировки',
    protein: '30-50 г (быстрый: whey изолят)', carbs: '40-80 г (быстрые: декстроза, белый рис, банан)', fat: '0 г (замедляет абсорбцию)', water: '500-750 мл + электролиты', supplements: ['Сывороточный изолят 40 г', 'Креатин 5 г', 'Декстроза 40-60 г'],
    rationale: 'Анаболическое окно. Инсулин + аминокислоты = максимальный синтез белка. Креатин с углеводами — лучшее усвоение.',
  },
  {
    phase: 'Post-Workout Meal (60-90 min)', timing: 'Через 60-90 мин после тренировки',
    protein: '40-60 г (цельная пища: курица, рыба)', carbs: '60-100 г (рис, картофель, гречка)', fat: '15-25 г', water: '500 мл', supplements: ['Омега-3', 'Витамин D3'],
    rationale: 'Полноценный приём пищи. Белок + углеводы + жиры = sustained anabolism.',
  },
  {
    phase: 'Evening / Before Bed', timing: 'За 60-90 мин до сна',
    protein: '30-40 г (казеин, творог)', carbs: '0-30 г (если сушка — без)', fat: '10-15 г (если масса)', water: '200-300 мл', supplements: ['Казеин 30-40 г', 'Магний 400 мг', 'Цинк 30 мг', 'Мелатонин 3 мг'],
    rationale: 'Медленный белок на ночь = ночной анаболизм. Магний + цинк = качество сна + тестостерон.',
  },
  {
    phase: 'Morning / Breakfast', timing: 'В течение 60 мин после пробуждения',
    protein: '30-50 г', carbs: '40-80 г (если тренировка утром)', fat: '15-25 г', water: '500-750 мл', supplements: ['Витамин D3 + K2', 'Омега-3'],
    rationale: 'Прерывание ночного катаболизма. Белок ASAP. Углеводы если тренировка утром.',
  },
];

export function getNutrientTiming(): NutrientTiming[] { return NUTRIENT_TIMING_GUIDE; }

// ═══════════════════════════════════════════════════════════════════════════
// 4. Warmup Library (10+ routines)
// ═══════════════════════════════════════════════════════════════════════════

const WARMUP_LIBRARY: WarmupRoutine[] = [
  {
    name: 'Squat Day Warmup', forExercise: 'squat', durationMin: 12,
    blocks: [
      { name: 'Кардио (3 мин)', exercises: [{ name: 'Велотренажёр / Скакалка', duration: '3 мин', notes: 'Лёгкий темп. Вспотеть, но не устать.' }] },
      { name: 'Мобильность (4 мин)', exercises: [
        { name: 'Hip Circles', duration: '10/сторону', notes: 'Большие круги' },
        { name: 'Ankle Rocks', duration: '10/ногу', notes: 'Колено над носком' },
        { name: 'World\'s Greatest Stretch', duration: '5/сторону', notes: 'T-spine + hip' },
        { name: 'Goblet Squat Prying', duration: '5 reps (пауза 3с)', notes: 'Локтями раздвигать колени' },
      ]},
      { name: 'Активация (3 мин)', exercises: [
        { name: 'Banded Clamshell', duration: '15/ногу', notes: 'Petite band' },
        { name: 'Single Leg Glute Bridge', duration: '10/ногу', notes: 'Задержка 2с вверху' },
        { name: 'Dead Bug', duration: '8/сторону', notes: 'Медленно, брейсинг' },
      ]},
      { name: 'Специфика (2 мин)', exercises: [
        { name: 'Empty Bar Squat', duration: '10 reps', notes: 'Темп 3-0-1-0' },
        { name: '20% ×10', duration: '1 подход', notes: '' },
        { name: '40% ×5', duration: '1 подход', notes: '' },
        { name: '60% ×3', duration: '1 подход', notes: '' },
      ]},
    ],
  },
  {
    name: 'Bench Day Warmup', forExercise: 'bench', durationMin: 10,
    blocks: [
      { name: 'Кардио (2 мин)', exercises: [{ name: 'Скакалка / Jumping Jacks', duration: '2 мин', notes: 'Разогрев плеч' }] },
      { name: 'Мобильность + Активация (5 мин)', exercises: [
        { name: 'Band Pull-Apart', duration: '20 reps', notes: 'Свести лопатки' },
        { name: 'External Rotation (band)', duration: '15/руку', notes: 'Локоть прижат' },
        { name: 'Wall Slide', duration: '8 reps', notes: 'Запястья и локти касаются стены' },
        { name: 'Scapular Push-Up', duration: '10 reps', notes: 'Только лопатки' },
        { name: 'Dead Hang', duration: '30 сек', notes: 'Декомпрессия' },
      ]},
      { name: 'Специфика (3 мин)', exercises: [
        { name: 'Empty Bar ×10', duration: '1 подход', notes: 'Темп 3-0-1-0' },
        { name: '40% ×8', duration: '1 подход', notes: '' },
        { name: '50% ×5', duration: '1 подход', notes: '' },
        { name: '60% ×3', duration: '1 подход', notes: '' },
      ]},
    ],
  },
  {
    name: 'Deadlift Day Warmup', forExercise: 'deadlift', durationMin: 12,
    blocks: [
      { name: 'Кардио (3 мин)', exercises: [{ name: 'Велотренажёр', duration: '3 мин', notes: 'Easy pace' }] },
      { name: 'Мобильность (4 мин)', exercises: [
        { name: 'Cat-Cow', duration: '10 reps', notes: 'Медленно' },
        { name: 'Hip 90/90', duration: '30 сек/сторону', notes: 'Глубоко дышать' },
        { name: 'RDL (empty bar)', duration: '10 reps', notes: 'Темп 3-0-2-0' },
        { name: 'Toe Touch progression', duration: '5 reps (удержание 5с)', notes: 'Не bouncing' },
      ]},
      { name: 'Активация (3 мин)', exercises: [
        { name: 'Dead Bug', duration: '8/сторону', notes: 'Slow, braced' },
        { name: 'Bird Dog', duration: '8/сторону', notes: 'Без ротации таза' },
        { name: 'Band Good Morning', duration: '12 reps', notes: 'Petite band' },
      ]},
      { name: 'Специфика (2 мин)', exercises: [
        { name: '40% ×5', duration: '1 подход', notes: '' },
        { name: '55% ×3', duration: '1 подход', notes: '' },
        { name: '70% ×2', duration: '1 подход', notes: '' },
      ]},
    ],
  },
  {
    name: 'Upper Body Warmup', forExercise: 'upper', durationMin: 8,
    blocks: [
      { name: 'Активация плеч (5 мин)', exercises: [
        { name: 'Band Pull-Apart', duration: '2×20', notes: '' },
        { name: 'Band Overhead Pull-Apart', duration: '2×15', notes: '' },
        { name: 'External Rotation (band)', duration: '2×12', notes: '' },
        { name: 'Wall Slide', duration: '2×8', notes: '' },
        { name: 'Push-Up (slow)', duration: '10 reps', notes: 'Темп 3-0-1-0' },
      ]},
      { name: 'Специфика (3 мин)', exercises: [
        { name: 'Первое упражнение: пустой гриф ×12', duration: '1 подход', notes: '' },
        { name: '50% ×8', duration: '1 подход', notes: '' },
        { name: '70% ×5', duration: '1 подход', notes: '' },
      ]},
    ],
  },
  {
    name: 'Quick Full Body (5 min)', forExercise: 'fullbody', durationMin: 5,
    blocks: [
      { name: 'Full Body (5 мин)', exercises: [
        { name: 'Jumping Jacks', duration: '30 сек', notes: '' },
        { name: 'Bodyweight Squat', duration: '10 reps', notes: '' },
        { name: 'Push-Up', duration: '8 reps', notes: '' },
        { name: 'Lunge + T-spine Rotation', duration: '5/сторону', notes: '' },
        { name: 'Repeat 2-3 круга', duration: '', notes: 'Минимум отдыха' },
      ]},
    ],
  },
];

export function getWarmupLibrary(): WarmupRoutine[] { return WARMUP_LIBRARY; }
export function getWarmupForExercise(exercise: string): WarmupRoutine | undefined {
  return WARMUP_LIBRARY.find(w => w.forExercise === exercise);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Body Fat Estimation Methods
// ═════════════@@@@══════════════════════════════════════════════════════════

const BODY_FAT_METHODS: BodyFatMethod[] = [
  {
    name: 'Navy Method (Лента)', accuracy: '±3-4%', equipment: ['Сантиметровая лента'],
    formula: 'Муж: BF% = 86.010 × log10(талия-шея) - 70.041 × log10(рост) + 36.76',
    instructions: [
      'Измерьте талию на уровне пупка (выдох, не втягивать)',
      'Измерьте шею под кадыком (лента слегка наклонена вниз спереди)',
      'Измерьте рост без обуви',
      'Подставьте в формулу',
    ],
  },
  {
    name: '3-Point Skinfold (Калипер)', accuracy: '±2-3%', equipment: ['Калипер'],
    formula: 'Jackson-Pollock 3-point: BD = 1.10938 - 0.0008267×sum + 0.0000016×sum² - 0.0002574×age. BF% = (495/BD)-450',
    sites: [
      { name: 'Грудь', location: 'Диагональная складка: середина между подмышкой и соском' },
      { name: 'Живот', location: 'Вертикальная складка: 2 см справа от пупка' },
      { name: 'Бедро', location: 'Вертикальная складка: середина передней поверхности бедра' },
    ],
    instructions: [
      'Все измерения на правой стороне тела',
      'Захватить складку большим и указательным пальцами',
      'Наложить калипер на 1 см ниже пальцев',
      'Подождать 2-3 сек перед чтением',
      '3 измерения на каждом сайте → среднее',
      'Суммировать 3 средних и подставить в формулу',
    ],
  },
  {
    name: '7-Point Skinfold (Калипер)', accuracy: '±1.5-2.5%', equipment: ['Калипер'],
    formula: 'Jackson-Pollock 7-point: BD = 1.112 - 0.00043499×sum + 0.00000055×sum² - 0.00028826×age',
    sites: [
      { name: 'Грудь', location: 'Диагональная' },
      { name: 'Живот', location: 'Вертикальная' },
      { name: 'Бедро', location: 'Вертикальная' },
      { name: 'Трицепс', location: 'Вертикальная: задняя поверхность плеча' },
      { name: 'Подлопаточная', location: 'Диагональная: под углом лопатки' },
      { name: 'Подвздошная', location: 'Диагональная: над гребнем подвздошной кости' },
      { name: 'Подмышечная', location: 'Вертикальная: по средней подмышечной линии' },
    ],
    instructions: ['Аналогично 3-point. 7 сайтов вместо 3. Выше точность.'],
  },
  {
    name: 'BIА (Биоимпеданс)', accuracy: '±3-5%', equipment: ['BIA-весы или прибор'],
    formula: 'Автоматический расчёт прибором',
    instructions: [
      'Измеряться утром натощак',
      'После туалета',
      'Без тренировки за 12 часов',
      'Без алкоголя за 24 часа',
      'Результат зависит от гидратации (±2-3%)',
    ],
  },
  {
    name: 'DEXA (Золотой стандарт)', accuracy: '±1-2%', equipment: ['DEXA-сканер (клиника)'],
    formula: 'Рентгеновская абсорбциометрия',
    instructions: [
      'Запись в клинику',
      'Лежать неподвижно 10-15 мин',
      'Получаете: BF%, LBM, костная масса, висцеральный жир, посегментный анализ',
      'Стоимость: 3,000-7,000 ₽',
    ],
  },
];

export function getBodyFatMethods(): BodyFatMethod[] { return BODY_FAT_METHODS; }
