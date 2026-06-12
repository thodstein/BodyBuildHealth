/**
 * Periodization Encyclopedia + Meet Strategy + PCT Protocols
 *
 * Periodization Models: 8 complete periodization systems with year planning
 * Powerlifting Meet Strategy: attempt selection, warmup, weight class
 * Bodybuilding Contest Prep: peak week, carb load, water, posing
 * PCT Protocols: post-cycle therapy, HPTA restart, blood work timing
 *
 * @module periodization-meet-pct-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PeriodizationModel {
  name: string;
  type: string;
  bestFor: string;
  description: string;
  macrocycleWeeks: number;
  phases: { name: string; weeks: number; volume: string; intensity: string; focus: string; description: string }[];
  pros: string[];
  cons: string[];
  exampleYearPlan: string;
}

export interface MeetStrategy {
  lift: string;
  openerKg: number;
  openerPct: number;
  secondKg: number;
  secondPct: number;
  thirdKg: number;
  thirdPct: number;
  warmupSequence: { weight: number; reps: number; restMin: number }[];
  mentalPrep: string[];
  technicalCues: string[];
  nutritionTiming: string[];
}

export interface BBContestPrep {
  weeksOut: number;
  phase: string;
  training: string;
  cardio: string;
  carbs: string;
  water: string;
  sodium: string;
  posing: string;
  supplements: string[];
  notes: string;
}

export interface PCTProtocol {
  name: string;
  forCycle: string;
  totalWeeks: number;
  timeline: { week: number; compounds: { name: string; dosage: string; frequency: string }[]; bloodWork: string[]; notes: string }[];
  expectedRecovery: string;
  risksIfSkipped: string;
  successRate: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Periodization Models Encyclopedia (8 models)
// ═══════════════════════════════════════════════════════════════════════════

const PERIODIZATION_MODELS: PeriodizationModel[] = [
  {
    name: 'Линейная периодизация (Linear)',
    type: 'linear', bestFor: 'Начинающие и средний уровень',
    description: 'Классическая модель. Объём снижается, интенсивность растёт от недели к неделе. Простая и предсказуемая.',
    macrocycleWeeks: 12,
    phases: [
      { name: 'Накопление (Hypertrophy)', weeks: 4, volume: '3-5×8-12', intensity: '65-75% 1RM', focus: 'Гипертрофия + выносливость', description: 'Высокий объём, умеренная интенсивность. База для силы.' },
      { name: 'Сила (Strength)', weeks: 4, volume: '3-5×4-6', intensity: '80-87% 1RM', focus: 'Сила', description: 'Снижение объёма, рост интенсивности. Основной силовой блок.' },
      { name: 'Пик (Peaking)', weeks: 3, volume: '2-3×1-3', intensity: '90-97% 1RM', focus: 'Максимальная сила', description: 'Минимальный объём, максимальная специфика. Выход на пик.' },
      { name: 'Разгрузка (Deload)', weeks: 1, volume: '2-3×5', intensity: '50-60% 1RM', focus: 'Восстановление', description: 'Активное восстановление перед новым циклом.' },
    ],
    pros: ['Просто', 'Предсказуемо', 'Хорошо для новичков', 'Чёткий прогресс'],
    cons: ['Скучно для продвинутых', 'Плато через 2-3 цикла', 'Не хватает вариативности'],
    exampleYearPlan: '4 × 12-недельных цикла с повышением начальных весов на 5-10% каждый цикл.',
  },
  {
    name: 'Волновая периодизация (Undulating / DUP)',
    type: 'undulating', bestFor: 'Средний и продвинутый уровень',
    description: 'Интенсивность и объём меняются КАЖДУЮ тренировку. День силы → день гипертрофии → день мощности.',
    macrocycleWeeks: 12,
    phases: [
      { name: 'День силы', weeks: 0, volume: '3-5×3-5', intensity: '85-93% 1RM', focus: 'Максимальная сила', description: 'Тяжёлый день. Низкий объём.' },
      { name: 'День гипертрофии', weeks: 0, volume: '3-4×8-12', intensity: '65-78% 1RM', focus: 'Объём + памп', description: 'Средний вес, высокий объём.' },
      { name: 'День мощности', weeks: 0, volume: '5-8×1-3', intensity: '70-82% 1RM', focus: 'Скорость + мощность', description: 'Взрывные повторения с субмаксимальным весом.' },
    ],
    pros: ['Нет плато (постоянная смена стимула)', 'Развивает все качества', 'Интересно'],
    cons: ['Сложнее планировать', 'Меньше специфичности для PL', 'Нужен опыт'],
    exampleYearPlan: 'Непрерывный DUP цикл с микро-прогрессией +2.5-5 кг каждый месяц.',
  },
  {
    name: 'Блочная периодизация (Block)',
    type: 'block', bestFor: 'Продвинутые атлеты, спортсмены',
    description: '3 блока: Накопление → Трансформация → Реализация. Каждый блок фокусируется на одном качестве, поддерживая остальные.',
    macrocycleWeeks: 12,
    phases: [
      { name: 'Накопление', weeks: 4, volume: 'Очень высокий', intensity: '60-75%', focus: 'Общая подготовка', description: 'Развитие базы: объём, выносливость, техника. 4-5 тренировок/нед.' },
      { name: 'Трансформация', weeks: 4, volume: 'Средний', intensity: '75-85%', focus: 'Специфическая сила', description: 'Перевод общей подготовки в специфическую. Соревновательные движения.' },
      { name: 'Реализация', weeks: 3, volume: 'Низкий', intensity: '85-97%', focus: 'Пик формы', description: 'Максимальная специфика. Минимум подсобки.' },
      { name: 'Разгрузка', weeks: 1, volume: 'Очень низкий', intensity: '40-60%', focus: 'Восстановление', description: 'Полное восстановление.' },
    ],
    pros: ['Максимальная специфичность', 'Научно обоснована', 'Подходит для элиты', 'Чёткие блоки'],
    cons: ['Сложно для новичков', 'Требует точного планирования', 'Дорого (нужны микроциклы)'],
    exampleYearPlan: '3 блочных цикла по 12 недель = 36 недель. + 2 переходных периода по 2 недели.',
  },
  {
    name: 'Сопряжённая (Conjugate / Westside)',
    type: 'conjugate', bestFor: 'Элитные пауэрлифтёры',
    description: 'Max Effort (верх/низ) + Dynamic Effort (верх/низ). Постоянная ротация упражнений.',
    macrocycleWeeks: 8,
    phases: [
      { name: 'Max Effort Lower', weeks: 0, volume: '1-3×1-3', intensity: '90-100%+', focus: 'Максимальная сила низа', description: 'Раз в неделю. Ротация: box squat, deadlift, good morning, safety bar.' },
      { name: 'Max Effort Upper', weeks: 0, volume: '1-3×1-3', intensity: '90-100%+', focus: 'Максимальная сила верха', description: 'Раз в неделю. Ротация: bench, floor press, board press, incline.' },
      { name: 'Dynamic Effort Lower', weeks: 0, volume: '8-12×2', intensity: '50-65% + bands', focus: 'Скорость + мощность низа', description: 'Box squat с bands/chains. 45-60 сек отдых.' },
      { name: 'Dynamic Effort Upper', weeks: 0, volume: '8-9×3', intensity: '50-60% + bands', focus: 'Скорость + мощность верха', description: 'Bench с bands. Трицепс-тяжёлая подсобка.' },
    ],
    pros: ['Постоянная смена стимула → нет адаптации', 'Выявляет слабые места', 'Элитный уровень', 'Louie Simmons'],
    cons: ['Очень сложно для новичков', 'Нужен опыт', 'Специфичное оборудование', 'Высокий риск травм'],
    exampleYearPlan: '6-8 недельный ME/DE цикл → тест 1RM → новый цикл с другими вариациями.',
  },
  {
    name: '5/3/1 (Wendler)',
    type: 'wave', bestFor: 'Средний уровень, долгосрочный прогресс',
    description: '4-недельные волновые циклы. Медленный, но устойчивый прогресс годами. Встроенный deload.',
    macrocycleWeeks: 4,
    phases: [
      { name: 'Неделя 1 (3×5)', weeks: 1, volume: '3×5+', intensity: '65-85% TM', focus: 'Объём + сила', description: 'Последний подход AMRAP.' },
      { name: 'Неделя 2 (3×3)', weeks: 1, volume: '3×3+', intensity: '70-90% TM', focus: 'Сила', description: 'Последний подход AMRAP.' },
      { name: 'Неделя 3 (5/3/1)', weeks: 1, volume: '5/3/1+', intensity: '75-95% TM', focus: 'Пик', description: 'Последний подход AMRAP. Максимальный вес.' },
      { name: 'Неделя 4 (Deload)', weeks: 1, volume: '3×5', intensity: '40-60%', focus: 'Восстановление', description: 'Без AMRAP.' },
    ],
    pros: ['Устойчивый прогресс', 'Встроенный deload', 'Гибкость подсобки', 'Годами можно'],
    cons: ['Медленный старт', 'Может быть скучно', 'Расчёт от TM'],
    exampleYearPlan: '12 циклов × 4 недели = 48 недель. TM +2.5/5 кг каждый цикл.',
  },
  {
    name: 'GPP → SPP → Пик (Спортивная)',
    type: 'gpp_spp', bestFor: 'Спортсмены, возвращение после травмы',
    description: 'От общей подготовки к специфической к пику. Три большие фазы.',
    macrocycleWeeks: 16,
    phases: [
      { name: 'GPP (Общая подготовка)', weeks: 6, volume: 'Высокий', intensity: '50-65%', focus: 'Общая физическая подготовка', description: 'Разнообразные упражнения. Кардио, мобильность, слабые места. База.' },
      { name: 'SPP (Специальная)', weeks: 6, volume: 'Средний', intensity: '70-85%', focus: 'Специфическая подготовка', description: 'Переход к соревновательным движениям. Наращивание интенсивности.' },
      { name: 'Пик (Peak)', weeks: 3, volume: 'Низкий', intensity: '85-97%', focus: 'Максимальный результат', description: 'Только специфика. Минимум подсобки.' },
      { name: 'Переходный', weeks: 1, volume: 'Очень низкий', intensity: '40-50%', focus: 'Восстановление', description: 'Активный отдых.' },
    ],
    pros: ['Системный подход', 'Хорошо для возвращения', 'Снижает риск травм', 'Научная база'],
    cons: ['Длинный цикл', 'GPP может быть скучным', 'Не для всех целей'],
    exampleYearPlan: '2 больших цикла GPP→SPP→Peak по 16 недель + 4 недели отдыха.',
  },
  {
    name: 'Ежедневный максимум (Bulgarian Method)',
    type: 'daily_max', bestFor: 'Элитные тяжелоатлеты (не рекомендуется для большинства)',
    description: 'Тренировка до ежедневного максимума каждый день. Много подходов с 90%+. Экстремальная частота.',
    macrocycleWeeks: 1,
    phases: [
      { name: 'Ежедневно', weeks: 0, volume: 'Много синглов', intensity: '90-100%', focus: 'Максимальная сила + техника', description: 'Каждый день: работа до daily max. Не до отказа. 3-6 тренировок/нед.' },
    ],
    pros: ['Максимальная специфичность', 'Огромный объём практики', 'Работает для элиты'],
    cons: ['Очень высокий риск травм', 'Только для элиты с поддержкой', 'Не для натуралов'],
    exampleYearPlan: 'Непрерывно с периодами снижения нагрузки.',
  },
  {
    name: 'PHAT / PHUL (Гибрид сила+гипертрофия)',
    type: 'hybrid', bestFor: 'Средний уровень, кто хочет и силу и массу',
    description: '2 силовых дня (верх/низ) + 3 гипертрофийных дня. Комбинация PL и BB.',
    macrocycleWeeks: 8,
    phases: [
      { name: 'Upper Power', weeks: 0, volume: '3-5×3-5', intensity: '85-93%', focus: 'Сила верха', description: 'Тяжёлый жим, тяжёлая тяга, OHP.' },
      { name: 'Lower Power', weeks: 0, volume: '3-5×3-5', intensity: '85-93%', focus: 'Сила низа', description: 'Тяжёлый присед, тяжёлая тяга.' },
      { name: 'Upper Hypertrophy', weeks: 0, volume: '3-4×8-15', intensity: '65-78%', focus: 'Памп + объём верха', description: 'Жим гантелей, тяги, плечи, руки.' },
      { name: 'Lower Hypertrophy', weeks: 0, volume: '3-4×8-15', intensity: '65-78%', focus: 'Памп + объём низа', description: 'Присед/жим ногами, RDL, разгибания, сгибания.' },
    ],
    pros: ['Лучшее из двух миров', 'Интересно', 'Хороший баланс', 'Гибкость'],
    cons: ['5 дней/нед', 'Может не хватать восстановления', 'Сложнее прогрессия'],
    exampleYearPlan: '2-3 цикла PHAT с волновой прогрессией.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 2. Powerlifting Meet Strategy
// ═══════════════════════════════════════════════════════════════════════════

export function generateMeetStrategy(
  squat1RM: number, bench1RM: number, deadlift1RM: number,
  bodyWeight: number, fed: string,
): { weightClass: number; attempts: MeetStrategy[]; total: { opener: number; second: number; third: number; wilks: number }; timeline: string[] } {
  const weightClasses = [59, 66, 74, 83, 93, 105, 120, 140];
  const weightClass = weightClasses.find(c => c >= bodyWeight) || weightClasses[weightClasses.length - 1];

  const attempts: MeetStrategy[] = [
    {
      lift: 'Squat', openerKg: Math.round(squat1RM * 0.90 * 0.5) * 2, openerPct: 90,
      secondKg: Math.round(squat1RM * 0.95 * 0.5) * 2, secondPct: 95,
      thirdKg: Math.round(squat1RM * 0.99 * 0.5) * 2, thirdPct: 99,
      warmupSequence: [
        { weight: 20, reps: 10, restMin: 1 }, { weight: Math.round(squat1RM * 0.40 * 0.5) * 2, reps: 5, restMin: 2 },
        { weight: Math.round(squat1RM * 0.60 * 0.5) * 2, reps: 3, restMin: 2 },
        { weight: Math.round(squat1RM * 0.75 * 0.5) * 2, reps: 1, restMin: 3 },
        { weight: Math.round(squat1RM * 0.85 * 0.5) * 2, reps: 1, restMin: 5 },
      ],
      mentalPrep: ['Визуализация 3 попыток: успешный подъём от setup до rack.', 'Дыхание 4-7-8 перед подходом', 'Нюхательная соль за 30 сек до', 'Агрессивная музыка в наушниках'],
      technicalCues: ['Грудь вверх', 'Колени наружу', 'Глубина — судья даст команду', 'Не спешить с rack'],
      nutritionTiming: ['Лёгкий завтрак за 2-3 часа до', 'BCAA + электролиты между попытками', 'Рисовые хлебцы + мёд для быстрой энергии'],
    },
    {
      lift: 'Bench Press', openerKg: Math.round(bench1RM * 0.88 * 0.5) * 2, openerPct: 88,
      secondKg: Math.round(bench1RM * 0.94 * 0.5) * 2, secondPct: 94,
      thirdKg: Math.round(bench1RM * 0.98 * 0.5) * 2, thirdPct: 98,
      warmupSequence: [
        { weight: 20, reps: 10, restMin: 1 }, { weight: Math.round(bench1RM * 0.50 * 0.5) * 2, reps: 5, restMin: 2 },
        { weight: Math.round(bench1RM * 0.65 * 0.5) * 2, reps: 3, restMin: 2 },
        { weight: Math.round(bench1RM * 0.80 * 0.5) * 2, reps: 1, restMin: 3 },
      ],
      mentalPrep: ['Уверенность: открывашка — вес который вы жмёте на 3 в зале.', 'Команды судьи: ждать Press после паузы.'],
      technicalCues: ['Лопатки сведены', 'Мост', 'Пауза — грудь неподвижна', 'Ждать команду Rack'],
      nutritionTiming: ['Лёгкий перекус между squat и bench', 'Гидратация'],
    },
    {
      lift: 'Deadlift', openerKg: Math.round(deadlift1RM * 0.88 * 0.5) * 2, openerPct: 88,
      secondKg: Math.round(deadlift1RM * 0.95 * 0.5) * 2, secondPct: 95,
      thirdKg: Math.round(deadlift1RM * 1.00 * 0.5) * 2, thirdPct: 100,
      warmupSequence: [
        { weight: Math.round(deadlift1RM * 0.40 * 0.5) * 2, reps: 5, restMin: 2 },
        { weight: Math.round(deadlift1RM * 0.60 * 0.5) * 2, reps: 3, restMin: 2 },
        { weight: Math.round(deadlift1RM * 0.75 * 0.5) * 2, reps: 1, restMin: 3 },
      ],
      mentalPrep: ['Тяга — последний шанс. Оставьте всё на помосте.', 'Агрессия. Нюхательная соль. Максимальный фокус.'],
      technicalCues: ['Грудь вверх', 'Толкайте пол', 'Не дёргайте — плавно', 'Ждать команду Down'],
      nutritionTiming: ['Полноценный приём пищи после bench', 'Кофеин 200 мг за 30 мин до тяги', 'Электролиты'],
    },
  ];

  const openerTotal = attempts.reduce((s, a) => s + a.openerKg, 0);
  const secondTotal = attempts.reduce((s, a) => s + a.secondKg, 0);
  const thirdTotal = attempts.reduce((s, a) => s + a.thirdKg, 0);
  const wilks = (thirdTotal * 500 / (-216.0475144 + 16.2606339 * bodyWeight - 0.002388645 * bodyWeight ** 2 - 0.00113732 * bodyWeight ** 3 + 7.01863e-6 * bodyWeight ** 4 - 1.291e-8 * bodyWeight ** 5));

  const timeline = [
    '06:00 — Подъём. Лёгкий завтрак.',
    '07:30 — Прибытие. Регистрация. Взвешивание.',
    '08:00 — Разминка squat начинается.',
    '09:00 — 🏋️ SQUAT (3 попытки)',
    '10:30 — Разминка bench.',
    '11:00 — 🏋️ BENCH (3 попытки)',
    '12:30 — Обед.',
    '13:30 — Разминка deadlift.',
    '14:00 — 🏋️ DEADLIFT (3 попытки)',
    '15:00 — 🎉 Финиш!',
  ];

  return { weightClass, attempts, total: { opener: openerTotal, second: secondTotal, third: thirdTotal, wilks: Math.round(wilks) }, timeline };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Bodybuilding Contest Prep (16-week plan)
// ═══════════════════════════════════════════════════════════════════════════

const BB_CONTEST_PREP: BBContestPrep[] = [
  { weeksOut: 16, phase: 'Начало дефицита', training: '5×/нед PPL + Upper/Lower. Тяжело.', cardio: '3×/нед × 20 мин LISS', carbs: '3-4 г/кг', water: '4-5 л', sodium: '3-4 г', posing: '15 мин 3×/нед', supplements: ['Протеин', 'Креатин', 'Омега-3', 'D3+K2'], notes: 'Небольшой дефицит 200-300 ккал.' },
  { weeksOut: 12, phase: 'Умеренный дефицит', training: '5×/нед. Сила + пампинг.', cardio: '4×/нед × 25 мин LISS', carbs: '2.5-3.5 г/кг', water: '5 л', sodium: '3-4 г', posing: '20 мин 4×/нед', supplements: ['Протеин', 'Креатин', 'Омега-3', 'Л-карнитин'], notes: 'Дефицит 400-500 ккал. +1 кардио.' },
  { weeksOut: 8, phase: 'Активный дефицит', training: '4×/нед Upper/Lower. Интенсивность сохранена.', cardio: '5×/нед × 30 мин (2 LISS + 3 MISS)', carbs: '2-3 г/кг', water: '5-6 л', sodium: '2-3 г', posing: '30 мин 5×/нед', supplements: ['Протеин', 'BCAA', 'Омега-3', 'Yohimbine', 'Кофеин'], notes: 'Дефицит 500-700 ккал. Начинать циклировать углеводы.' },
  { weeksOut: 4, phase: 'Финальный рывок', training: '3×/нед Full Body. Фокус на пампинг.', cardio: '6×/нед × 35-40 мин', carbs: '1.5-2.5 г/кг (carb cycle)', water: '6-7 л', sodium: '2-3 г', posing: '45 мин ежедневно', supplements: ['Все базовые', 'Экстракт зелёного чая', 'CLA'], notes: 'Максимальный дефицит. Carb cycle: 3 низких + 1 высокий.' },
  { weeksOut: 2, phase: 'Peak Week начинается', training: 'Full Body пампинг 2×', cardio: '5×/нед × 30 мин LISS', carbs: '2 г/кг (depletion)', water: '8 л', sodium: '3 г', posing: '60 мин ежедневно', supplements: ['Протеин', 'BCAA', 'Dandelion root'], notes: 'Depletion тренировки + высокие углеводы только из овощей.' },
  { weeksOut: 1, phase: 'Peak Week — День 1-5 CARB LOAD', training: 'Пн: Full Body пампинг. Чт: Только posing.', cardio: '3×/нед × 20 мин', carbs: 'День 1-2: 2→4→6→8→6 г/кг (front load)', water: 'Дни 1-3: 8 л → 6 л → 4 л (taper)', sodium: '3→2→1→0.5→0.5 г', posing: '30-60 мин ежедневно', supplements: ['Протеин', 'BCAA', 'Dandelion', 'Glycerol'], notes: 'Carb load: сложные углеводы. Последняя тренировка за 3-4 дня.' },
  { weeksOut: 0, phase: 'SHOW DAY', training: '—', cardio: '—', carbs: 'Рисовые хлебцы + мёд + варенье (200-300 г углеводов до выхода)', water: 'Только SIPS', sodium: '0.5 г утром', posing: '45 мин утром перед выходом', supplements: ['Кофеин 200 мг', 'L-теанин', 'Соль (sodium load опционально)'], notes: 'Рисовые хлебцы + джем каждые 2-3 часа. За 30 мин до выхода: шоколад/сникерс для пампа + соль под язык для vascularity.' },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. PCT Protocols
// ═══════════════════════════════════════════════════════════════════════════

const PCT_PROTOCOLS: PCTProtocol[] = [
  {
    name: 'Стандартный ПКТ (Тестостерон-соло)',
    forCycle: 'Тестостерон 12 недель, без 19-nor',
    totalWeeks: 4,
    timeline: [
      { week: 1, compounds: [{ name: 'Кломифен', dosage: '50 мг', frequency: 'ежедневно' }, { name: 'Тамоксифен', dosage: '20 мг', frequency: 'ежедневно' }], bloodWork: ['Тестостерон общий', 'ЛГ', 'ФСГ', 'Эстрадиол'], notes: 'Начало ПКТ через 2-3 недели после последней инъекции (зависит от эфира).' },
      { week: 2, compounds: [{ name: 'Кломифен', dosage: '50 мг', frequency: 'ежедневно' }, { name: 'Тамоксифен', dosage: '20 мг', frequency: 'ежедневно' }], bloodWork: [], notes: 'Самочувствие: возможно снижение либидо.' },
      { week: 3, compounds: [{ name: 'Кломифен', dosage: '25 мг', frequency: 'ежедневно' }, { name: 'Тамоксифен', dosage: '10 мг', frequency: 'ежедневно' }], bloodWork: [], notes: 'Снижение дозировок.' },
      { week: 4, compounds: [{ name: 'Кломифен', dosage: '25 мг', frequency: 'ежедневно' }, { name: 'Тамоксифен', dosage: '10 мг', frequency: 'ежедневно' }], bloodWork: ['Тестостерон общий', 'ЛГ', 'ФСГ', 'Эстрадиол', 'Пролактин'], notes: 'Контрольные анализы. Оценка восстановления.' },
    ],
    expectedRecovery: 'Восстановление собственного тестостерона до baseline за 4-8 недель после ПКТ.',
    risksIfSkipped: 'Гипогонадизм. Потеря 50-70% набранной массы. Депрессия. Остеопороз при длительном гипогонадизме.',
    successRate: '70-85%',
  },
  {
    name: 'Расширенный ПКТ (19-nor / Тренболон)',
    forCycle: 'Тестостерон + Тренболон/Нандролон 12-16 недель',
    totalWeeks: 6,
    timeline: [
      { week: -3, compounds: [{ name: 'ХГЧ', dosage: '500 МЕ', frequency: '2×/нед' }], bloodWork: [], notes: 'ХГЧ за 2-3 недели ДО начала ПКТ (пока эфиры выходят).' },
      { week: -2, compounds: [{ name: 'ХГЧ', dosage: '500 МЕ', frequency: '2×/нед' }], bloodWork: [], notes: 'Стимуляция яичек до приёма SERM.' },
      { week: 1, compounds: [{ name: 'Кломифен', dosage: '100 мг', frequency: 'ежедневно' }, { name: 'Тамоксифен', dosage: '40 мг', frequency: 'ежедневно' }], bloodWork: ['Тестостерон', 'ЛГ', 'ФСГ', 'Пролактин', 'Прогестерон', 'E2'], notes: 'Ударные дозы первую неделю при 19-nor.' },
      { week: 2, compounds: [{ name: 'Кломифен', dosage: '50 мг', frequency: 'ежедневно' }, { name: 'Тамоксифен', dosage: '20 мг', frequency: 'ежедневно' }], bloodWork: [], notes: 'Стандартные дозы.' },
      { week: 3, compounds: [{ name: 'Кломифен', dosage: '50 мг', frequency: 'ежедневно' }, { name: 'Тамоксифен', dosage: '20 мг', frequency: 'ежедневно' }], bloodWork: [], notes: '' },
      { week: 4, compounds: [{ name: 'Кломифен', dosage: '25 мг', frequency: 'ежедневно' }, { name: 'Тамоксифен', dosage: '10 мг', frequency: 'ежедневно' }], bloodWork: [], notes: 'Снижение.' },
      { week: 5, compounds: [{ name: 'Кломифен', dosage: '25 мг', frequency: 'ежедневно' }], bloodWork: [], notes: 'Завершение Тамоксифена.' },
      { week: 6, compounds: [{ name: 'Кломифен', dosage: '12.5 мг', frequency: 'ежедневно' }], bloodWork: ['Полная гормональная панель'], notes: 'Контрольные анализы.' },
    ],
    expectedRecovery: '50-70% вероятность возврата к baseline. 19-nor метаболиты сохраняются 6-18 месяцев.',
    risksIfSkipped: 'Полный гипогонадизм. Азооспермия. Пожизненная ЗГТ может потребоваться.',
    successRate: '50-70%',
  },
  {
    name: 'ПКТ с ХГЧ-мостом (Тяжёлые циклы)',
    forCycle: 'Любой цикл >16 недель или несколько соединений',
    totalWeeks: 8,
    timeline: [
      { week: -4, compounds: [{ name: 'ХГЧ', dosage: '250 МЕ', frequency: '2×/нед' }], bloodWork: [], notes: 'ХГЧ во время курса для предотвращения атрофии (на długих циклах).' },
      { week: -3, compounds: [{ name: 'ХГЧ', dosage: '250 МЕ', frequency: '2×/нед' }], bloodWork: [], notes: '' },
      { week: -2, compounds: [{ name: 'ХГЧ', dosage: '500 МЕ', frequency: '2×/нед' }], bloodWork: [], notes: 'Увеличение дозы за 2 недели до ПКТ.' },
      { week: -1, compounds: [{ name: 'ХГЧ', dosage: '500 МЕ', frequency: '3×/нед' }], bloodWork: [], notes: 'Максимальная стимуляция перед SERM.' },
      { week: 1, compounds: [{ name: 'Кломифен', dosage: '100 мг', frequency: 'ежедневно' }, { name: 'Тамоксифен', dosage: '40 мг', frequency: 'ежедневно' }], bloodWork: ['Полная панель'], notes: 'Начало SERM.' },
      { week: 2, compounds: [{ name: 'Кломифен', dosage: '100 мг', frequency: 'ежедневно' }, { name: 'Тамоксифен', dosage: '40 мг', frequency: 'ежедневно' }], bloodWork: [], notes: '' },
      { week: 3, compounds: [{ name: 'Кломифен', dosage: '50 мг', frequency: 'ежедневно' }, { name: 'Тамоксифен', dosage: '20 мг', frequency: 'ежедневно' }], bloodWork: [], notes: '' },
      { week: 4, compounds: [{ name: 'Кломифен', dosage: '50 мг', frequency: 'ежедневно' }, { name: 'Тамоксифен', dosage: '20 мг', frequency: 'ежедневно' }], bloodWork: [], notes: '' },
      { week: 5, compounds: [{ name: 'Кломифен', dosage: '25 мг', frequency: 'ежедневно' }, { name: 'Тамоксифен', dosage: '10 мг', frequency: 'ежедневно' }], bloodWork: [], notes: 'Снижение.' },
      { week: 6, compounds: [{ name: 'Кломифен', dosage: '25 мг', frequency: 'ежедневно' }, { name: 'Тамоксифен', dosage: '10 мг', frequency: 'ежедневно' }], bloodWork: [], notes: '' },
      { week: 7, compounds: [{ name: 'Кломифен', dosage: '12.5 мг', frequency: 'ежедневно' }], bloodWork: [], notes: '' },
      { week: 8, compounds: [{ name: 'Кломифен', dosage: '12.5 мг', frequency: 'через день' }], bloodWork: ['Полная гормональная панель'], notes: 'Финальные анализы. Оценка восстановления.' },
    ],
    expectedRecovery: '60-80% при правильном использовании ХГЧ на цикле.',
    risksIfSkipped: 'Атрофия яичек. Длительное бесплодие.',
    successRate: '60-80%',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

export function getPeriodizationModels(): PeriodizationModel[] { return PERIODIZATION_MODELS; }
export function getPeriodizationByType(type: string): PeriodizationModel | undefined { return PERIODIZATION_MODELS.find(p => p.type === type); }
export function getBBContestPrep(): BBContestPrep[] { return BB_CONTEST_PREP; }
export function getPCTProtocols(): PCTProtocol[] { return PCT_PROTOCOLS; }
export function getPCTProtocol(name: string): PCTProtocol | undefined { return PCT_PROTOCOLS.find(p => p.name.toLowerCase().includes(name.toLowerCase())); }
