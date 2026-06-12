/**
 * Sleep Optimization + Program Selector + Competition Prep Engines
 *
 * Sleep Engine: analyzes sleep patterns, calculates sleep debt, gives optimization tips
 * Program Selector: auto-picks the best training program based on 12 user parameters
 * Competition Prep: meet day strategy, attempt selection, warmup timing, nutrition timing
 *
 * @module consolidated-engines
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface SleepInput {
  bedTime: string;       // "23:00"
  wakeTime: string;      // "07:00"
  sleepLatency: number;  // minutes to fall asleep
  nightAwakenings: number;
  sleepQuality: number;  // 1-5
  screenTimeBeforeBed: number; // minutes
  caffeineAfter4pm: boolean;
  alcoholBeforeBed: boolean;
  lateMeal: boolean;
  bedroomTemp: number;   // celsius
  exerciseTime: string;  // "morning" | "afternoon" | "evening" | "none"
}

export interface SleepOutput {
  totalSleepHours: number;
  sleepEfficiency: number;     // %
  sleepDebt: number;           // hours accumulated
  circadianScore: number;      // 0-100
  deepSleepEstimate: number;   // hours
  remEstimate: number;         // hours
  issues: string[];
  recommendations: string[];
  optimalBedtime: string;
  chronotype: 'lark' | 'owl' | 'hummingbird';
}

export interface ProgramSelectorInput {
  goal: 'strength' | 'hypertrophy' | 'fat_loss' | 'athleticism' | 'powerlifting' | 'bodybuilding';
  level: 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek: number;
  sessionLengthMin: number;
  equipment: string[];
  injuries: string[];
  age: number;
  trainingAge: number;
  weakPoints: string[];
  preferenceCompound: boolean;
  preferenceMachines: boolean;
  enjoyCardio: boolean;
}

export interface ProgramRecommendation {
  name: string;
  description: string;
  type: string;
  daysPerWeek: number;
  sessionDuration: string;
  focus: string;
  progressionModel: string;
  suitabilityScore: number; // 0-100
  pros: string[];
  cons: string[];
  sampleWeek: string[];
}

export interface MeetPrepInput {
  meetDate: string;
  currentWeights: { squat: number; bench: number; deadlift: number };
  bodyWeight: number;
  weightClass: number;
  fed: 'IPF' | 'WPC' | 'WRPF' | 'USPA' | 'other';
  experience: number; // meets done
  cuttingWater: boolean;
  usesKneeWraps: boolean;
}

export interface MeetAttempt {
  lift: 'squat' | 'bench' | 'deadlift';
  opener: number;
  second: number;
  third: number;
  confidence: 'safe' | 'moderate' | 'aggressive';
  notes: string;
}

export interface MeetPrepOutput {
  attempts: MeetAttempt[];
  weekByWeek: { week: number; label: string; squat: string; bench: string; deadlift: string; notes: string }[];
  meetDaySchedule: { time: string; action: string }[];
  warmupProtocol: { lift: string; sets: { weight: number; reps: number; restMin: number }[] }[];
  waterCutProtocol: string[];
  totalProjection: number;
  wilksProjection: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Sleep Optimization Engine
// ═══════════════════════════════════════════════════════════════════════════

export function analyzeSleep(input: SleepInput): SleepOutput {
  const issues: string[] = [];
  const recs: string[] = [];

  // Parse times
  const bed = input.bedTime.split(':').map(Number);
  const wake = input.wakeTime.split(':').map(Number);
  const bedMinutes = bed[0] * 60 + bed[1];
  const wakeMinutes = wake[0] * 60 + wake[1];
  const sleepMinutes = wakeMinutes >= bedMinutes ? wakeMinutes - bedMinutes : (1440 - bedMinutes) + wakeMinutes;
  const totalHours = sleepMinutes / 60;

  // Sleep efficiency: (sleep time - latency - awakenings*5min) / time in bed
  const timeInBed = totalHours * 60;
  const awakeTime = input.sleepLatency + input.nightAwakenings * 5;
  const efficiency = timeInBed > 0 ? ((timeInBed - awakeTime) / timeInBed) * 100 : 85;

  // Sleep debt: if < 7.5h, accumulate debt
  const idealSleep = 8;
  const debt = Math.max(0, idealSleep - totalHours) * 7;

  // Circadian score
  let circadianScore = 70;
  const midSleep = (bedMinutes + sleepMinutes / 2) % 1440;
  const midSleepHours = midSleep / 60;

  // Optimal midpoint is 2-4 AM for most people
  if (midSleepHours >= 2 && midSleepHours <= 4) circadianScore += 20;
  else if (midSleepHours >= 1 && midSleepHours <= 5) circadianScore += 5;
  else { circadianScore -= 15; issues.push('Смещённая середина сна'); }

  // Chronotype
  let chronotype: SleepOutput['chronotype'] = 'hummingbird';
  if (midSleepHours < 2) chronotype = 'lark';
  else if (midSleepHours > 4) chronotype = 'owl';

  // Deep sleep estimate (~20% of total, more if early sleep)
  const deepSleep = Math.round(totalHours * 0.22 * (chronotype === 'lark' ? 1.1 : 0.95) * 10) / 10;
  const remEstimate = Math.round(totalHours * 0.25 * 10) / 10;

  // Issues
  if (totalHours < 7) { issues.push(`Недостаточно сна (${totalHours.toFixed(1)}ч < 7ч)`); circadianScore -= 10; }
  if (input.sleepLatency > 30) { issues.push(`Долгое засыпание (${input.sleepLatency}мин)`); circadianScore -= 5; }
  if (input.nightAwakenings >= 3) { issues.push(`${input.nightAwakenings} пробуждений за ночь`); circadianScore -= 10; }
  if (input.screenTimeBeforeBed > 60) { issues.push('Экран >1ч перед сном'); circadianScore -= 10; recs.push('Уберите экраны за 60 мин до сна'); }
  if (input.caffeineAfter4pm) { issues.push('Кофеин после 16:00'); recs.push('Последний кофеин до 14:00'); }
  if (input.alcoholBeforeBed) { issues.push('Алкоголь перед сном'); recs.push('Алкоголь разрушает REM-сон — исключите'); }
  if (input.lateMeal) { issues.push('Поздний приём пищи'); recs.push('Последний приём пищи за 2-3ч до сна'); }
  if (input.bedroomTemp > 22) { issues.push('Слишком тепло в спальне'); recs.push('Оптимальная температура 18-20°C'); }
  if (input.exerciseTime === 'evening') { recs.push('Тренировки вечером — завершайте за 3ч до сна'); }

  // Optimal bedtime
  const optimalBedtime = chronotype === 'lark' ? '22:00' : chronotype === 'owl' ? '00:00' : '23:00';

  // Recommendations
  if (recs.length === 0) recs.push('Режим сна оптимален. Продолжайте.');
  if (debt > 5) recs.push(`Накоплен долг сна ${debt.toFixed(0)}ч — ложитесь раньше на этой неделе`);
  recs.push('Магний 400мг бисглицинат + Мелатонин 3мг за 30мин до сна');

  return {
    totalSleepHours: Math.round(totalHours * 10) / 10,
    sleepEfficiency: Math.round(efficiency),
    sleepDebt: Math.round(debt),
    circadianScore: Math.max(0, Math.min(100, circadianScore)),
    deepSleepEstimate: deepSleep,
    remEstimate,
    issues,
    recommendations: recs,
    optimalBedtime,
    chronotype,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Program Auto-Selector
// ═══════════════════════════════════════════════════════════════════════════

const PROGRAM_DB: ProgramRecommendation[] = [
  {
    name: 'Starting Strength', description: 'Классическая программа для новичков. 3 базовых упражнения, линейная прогрессия.',
    type: 'fullbody', daysPerWeek: 3, sessionDuration: '60 мин', focus: 'Сила + техника',
    progressionModel: 'Linear (+2.5 кг/тренировка)', suitabilityScore: 0,
    pros: ['Быстрый прогресс', 'Простота', 'Минимум оборудования'], cons: ['Мало объёма', 'Быстрое плато'],
    sampleWeek: ['Присед + Жим + Тяга', 'Присед + Жим над головой + Тяга', 'Присед + Жим + Тяга'],
  },
  {
    name: '5/3/1 Boring But Big', description: 'Проверенная программа Джима Вендлера. 4 дня, волновая периодизация.',
    type: 'upper/lower', daysPerWeek: 4, sessionDuration: '60-75 мин', focus: 'Сила + гипертрофия',
    progressionModel: 'Wave (месячный цикл)', suitabilityScore: 0,
    pros: ['Гибкость', 'Устойчивый прогресс', 'Подходит среднему уровню'], cons: ['Медленный старт', 'Сложнее для новичков'],
    sampleWeek: ['Жим 5/3/1 + подсобка', 'Тяга 5/3/1 + подсобка', 'Жим над головой 5/3/1 + подсобка', 'Присед 5/3/1 + подсобка'],
  },
  {
    name: 'Push/Pull/Legs (PPL)', description: 'Классический бодибилдерский сплит. 6 дней, высокая частота.',
    type: 'ppl', daysPerWeek: 6, sessionDuration: '60-75 мин', focus: 'Гипертрофия',
    progressionModel: 'Double Progression', suitabilityScore: 0,
    pros: ['Высокая частота', 'Большой объём', 'Гибкость упражнений'], cons: ['6 дней/нед', 'Требует времени', 'Риск перетрена'],
    sampleWeek: ['Push (грудь+плечи+трицепс)', 'Pull (спина+бицепс)', 'Legs (квадры+ягодицы+икры)', 'Push', 'Pull', 'Legs'],
  },
  {
    name: 'Upper/Lower Split', description: '4 дня в неделю, чередование верха и низа. Универсальный сплит.',
    type: 'upper/lower', daysPerWeek: 4, sessionDuration: '60-75 мин', focus: 'Сила + гипертрофия',
    progressionModel: 'Linear / Double', suitabilityScore: 0,
    pros: ['Сбалансирован', '4 дня', 'Восстановление'], cons: ['Меньше частоты чем PPL'],
    sampleWeek: ['Upper Strength', 'Lower Strength', 'Upper Hypertrophy', 'Lower Hypertrophy'],
  },
  {
    name: 'Full Body (FBW)', description: '3 тренировки в неделю, каждая на всё тело. Идеально для начинающих.',
    type: 'fullbody', daysPerWeek: 3, sessionDuration: '60-75 мин', focus: 'Базовая сила',
    progressionModel: 'Linear', suitabilityScore: 0,
    pros: ['3 дня', 'Частая стимуляция', 'Гормональный отклик'], cons: ['Длинные тренировки', 'Меньше изоляции'],
    sampleWeek: ['FBW A (Присед-доминант)', 'FBW B (Тяга-доминант)', 'FBW C (Жим-доминант)'],
  },
  {
    name: 'Sheiko (PL)', description: 'Программа Бориса Шейко для пауэрлифтёров. Высокий объём, субмаксимальные веса.',
    type: 'powerlifting', daysPerWeek: 3, sessionDuration: '90-120 мин', focus: 'Специфика PL',
    progressionModel: 'Periodized (мезоциклы)', suitabilityScore: 0,
    pros: ['Специфика PL', 'Огромный объём', 'Проверена'], cons: ['Очень долгие тренировки', 'Только для PL', 'Сложная'],
    sampleWeek: ['Присед + Жим', 'Тяга + Жим', 'Присед + Жим + подсобка'],
  },
];

function scoreProgram(program: ProgramRecommendation, input: ProgramSelectorInput): number {
  let score = 50;

  // Days per week match
  const dayDiff = Math.abs(program.daysPerWeek - input.daysPerWeek);
  score -= dayDiff * 10;

  // Level match
  if (input.level === 'beginner' && program.type === 'fullbody') score += 15;
  if (input.level === 'advanced' && program.type === 'ppl') score += 10;
  if (input.level === 'beginner' && program.type === 'ppl') score -= 15;

  // Goal match
  if (input.goal === 'strength' && program.focus.includes('Сила')) score += 10;
  if (input.goal === 'hypertrophy' && program.focus.includes('Гипертрофия')) score += 10;
  if (input.goal === 'powerlifting' && program.type === 'powerlifting') score += 20;

  // Session length match
  const progTime = parseInt(program.sessionDuration);
  if (Math.abs(progTime - input.sessionLengthMin) <= 15) score += 5;

  // Equipment
  if (program.name === 'Starting Strength' && input.equipment.length <= 3) score += 10;

  // Injury considerations
  if (input.injuries.length > 0 && program.name !== 'Starting Strength') score += 5;

  // Age consideration
  if (input.age > 40 && program.daysPerWeek <= 4) score += 10;

  return Math.max(0, Math.min(100, score));
}

export function selectBestProgram(input: ProgramSelectorInput): ProgramRecommendation[] {
  return PROGRAM_DB.map(p => ({
    ...p,
    suitabilityScore: scoreProgram(p, input),
  })).sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Competition Meet Prep Engine
// ═══════════════════════════════════════════════════════════════════════════

export function generateMeetPrep(input: MeetPrepInput): MeetPrepOutput {
  const { currentWeights, bodyWeight, fed } = input;
  const total = currentWeights.squat + currentWeights.bench + currentWeights.deadlift;

  // Attempt selection (90% / 95% / 97.5-100%)
  const attempts: MeetAttempt[] = [
    {
      lift: 'squat', opener: Math.round(currentWeights.squat * 0.90 * 0.5) * 2,
      second: Math.round(currentWeights.squat * 0.95 * 0.5) * 2,
      third: Math.round(currentWeights.squat * 0.99 * 0.5) * 2,
      confidence: 'safe', notes: 'Открывашка: уверенно. Вторая: целевой результат. Третья: PR при хорошем самочувствии.',
    },
    {
      lift: 'bench', opener: Math.round(currentWeights.bench * 0.88 * 0.5) * 2,
      second: Math.round(currentWeights.bench * 0.94 * 0.5) * 2,
      third: Math.round(currentWeights.bench * 0.98 * 0.5) * 2,
      confidence: 'moderate', notes: 'Жим самый вариабельный. Убедитесь в командах судьи.',
    },
    {
      lift: 'deadlift', opener: Math.round(currentWeights.deadlift * 0.88 * 0.5) * 2,
      second: Math.round(currentWeights.deadlift * 0.95 * 0.5) * 2,
      third: Math.round(currentWeights.deadlift * 1.0 * 0.5) * 2,
      confidence: 'aggressive', notes: 'Тяга — последний шанс. Если нужен тотал — идите на PR.',
    },
  ];

  const projectedTotal = attempts[0].third + attempts[1].third + attempts[2].third;
  const wilks = Math.round(fed === 'IPF'
    ? (projectedTotal * 500 / (-216.0475144 + 16.2606339 * bodyWeight - 0.002388645 * Math.pow(bodyWeight, 2)
      - 0.00113732 * Math.pow(bodyWeight, 3) + 7.01863e-6 * Math.pow(bodyWeight, 4) - 1.291e-8 * Math.pow(bodyWeight, 5)))
    : 300);

  const weekByWeek = [
    { week: 4, label: 'За 4 нед.', squat: '3×3@85% + сингл 90%', bench: '3×3@85% + сингл 90%', deadlift: '2×2@85%', notes: 'Последняя тяжёлая неделя' },
    { week: 3, label: 'За 3 нед.', squat: '2×2@88%', bench: '2×2@88%', deadlift: 'Сингл 92%', notes: 'Снижение объёма' },
    { week: 2, label: 'За 2 нед.', squat: 'Открывашка ×1', bench: 'Открывашка ×1', deadlift: 'Лёгкая тяга 70%', notes: 'Открывашки' },
    { week: 1, label: 'Неделя старта', squat: 'Пн: 60%×3', bench: 'Пн: 60%×3', deadlift: 'НЕТ', notes: 'Только активация' },
  ];

  const meetDaySchedule = [
    { time: '06:30', action: 'Подъём. Лёгкий завтрак: рис + яйца + банан + кофе.' },
    { time: '08:00', action: 'Прибытие. Взвешивание. Размещение.' },
    { time: '08:30', action: 'Разминка squat: пустой×10, 40%×5, 60%×3, 75%×1, 85%×1' },
    { time: '09:00', action: '🏋️ SQUAT — 3 попытки' },
    { time: '10:30', action: 'Разминка bench: пустой×10, 50%×5, 65%×3, 80%×1' },
    { time: '11:00', action: '🏋️ BENCH — 3 попытки' },
    { time: '12:30', action: 'Обед: рис + курица. Гидратация.' },
    { time: '13:30', action: 'Разминка deadlift: 40%×5, 60%×3, 75%×1' },
    { time: '14:00', action: '🏋️ DEADLIFT — 3 попытки' },
    { time: '15:30', action: '🎉 Финиш! Восстановительное питание.' },
  ];

  const warmupProtocol: MeetPrepOutput['warmupProtocol'] = [
    {
      lift: 'Squat',
      sets: [
        { weight: 20, reps: 10, restMin: 1 }, { weight: Math.round(currentWeights.squat * 0.4 * 0.5) * 2, reps: 5, restMin: 2 },
        { weight: Math.round(currentWeights.squat * 0.6 * 0.5) * 2, reps: 3, restMin: 2 },
        { weight: Math.round(currentWeights.squat * 0.75 * 0.5) * 2, reps: 1, restMin: 3 },
        { weight: Math.round(currentWeights.squat * 0.85 * 0.5) * 2, reps: 1, restMin: 3 },
      ],
    },
    {
      lift: 'Bench',
      sets: [
        { weight: 20, reps: 10, restMin: 1 }, { weight: Math.round(currentWeights.bench * 0.5 * 0.5) * 2, reps: 5, restMin: 2 },
        { weight: Math.round(currentWeights.bench * 0.65 * 0.5) * 2, reps: 3, restMin: 2 },
        { weight: Math.round(currentWeights.bench * 0.80 * 0.5) * 2, reps: 1, restMin: 3 },
      ],
    },
    {
      lift: 'Deadlift',
      sets: [
        { weight: Math.round(currentWeights.deadlift * 0.4 * 0.5) * 2, reps: 5, restMin: 2 },
        { weight: Math.round(currentWeights.deadlift * 0.6 * 0.5) * 2, reps: 3, restMin: 2 },
        { weight: Math.round(currentWeights.deadlift * 0.75 * 0.5) * 2, reps: 1, restMin: 3 },
      ],
    },
  ];

  const waterCutProtocol = input.cuttingWater ? [
    'День -2: 8л воды + 3г натрия',
    'День -1: 4л воды + 1г натрия, горячая ванна 20 мин',
    'День 0: SIPS only до взвешивания. После — регидрация электролитами',
  ] : ['Без сушки. Пейте нормально.'];

  return { attempts, weekByWeek, meetDaySchedule, warmupProtocol, waterCutProtocol, totalProjection: projectedTotal, wilksProjection: wilks };
}
