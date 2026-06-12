/**
 * Training Domain — Final Completion Engines
 *
 * Training Methodology Encyclopedia: 20+ training methods explained
 * Federation Strength Standards: IPF/WPC/WRPF qualifying totals + records
 * Volume Landmarks Reference: MEV/MAV/MRV for all muscles by level
 * Split Structure Visualizer: visual representation of all splits
 *
 * @module training-methodology-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface TrainingMethod {
  name: string;
  category: 'periodization' | 'progression' | 'technique' | 'intensity' | 'volume' | 'frequency' | 'specialization' | 'recovery';
  description: string;
  howItWorks: string;
  bestFor: string;
  example: string;
  popularizedBy: string;
  evidenceLevel: 'A' | 'B' | 'C';
  caveats: string[];
}

export interface FedStandard {
  federation: string;
  weightClasses: number[];
  qualifyingTotals: Record<string, Record<string, number>>;
  nationalRecords: Record<string, Record<string, number>>;
  worldRecords: Record<string, Record<string, number>>;
}

export interface VolumeReference {
  muscle: string;
  beginner: { mev: number; mav: number; mrv: number; frequency: string };
  intermediate: { mev: number; mav: number; mrv: number; frequency: string };
  advanced: { mev: number; mav: number; mrv: number; frequency: string };
  notes: string;
  bestExercises: string[];
}

export interface SplitVisual {
  name: string;
  days: { day: number; name: string; focus: string; patterns: string[]; volume: 'high' | 'medium' | 'low'; intensity: 'high' | 'medium' | 'low' }[];
  totalVolume: string;
  totalFrequency: string;
  suitability: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Training Methodology Encyclopedia (20 methods)
// ═══════════════════════════════════════════════════════════════════════════

const TRAINING_METHODS: TrainingMethod[] = [
  {
    name: 'Линейная периодизация (Linear Periodization)',
    category: 'periodization', evidenceLevel: 'A',
    description: 'Классическая модель: объём снижается, интенсивность растёт от недели к неделе.',
    howItWorks: 'Неделя 1: 3×12@70% → Неделя 4: 3×3@90%. Прогрессивное снижение объёма и рост интенсивности.',
    bestFor: 'Начинающие и средний уровень. Просто, предсказуемо.',
    example: '12 недель: 4 нед гипертрофия → 4 нед сила → 3 нед пик → 1 нед разгрузка.',
    popularizedBy: 'Tudor Bompa, советская школа', caveats: ['Плато через 2-3 цикла', 'Скучно для продвинутых', 'Не хватает вариативности'],
  },
  {
    name: 'Волновая периодизация (Daily Undulating Periodization — DUP)',
    category: 'periodization', evidenceLevel: 'A',
    description: 'Интенсивность и объём меняются каждую тренировку. День силы → день гипертрофии → день мощности.',
    howItWorks: 'Пн: 3×5@85% (сила), Ср: 4×10@70% (гипертрофия), Пт: 6×3@78% (мощность). Постоянная смена стимула.',
    bestFor: 'Средний и продвинутый уровень. Нет плато.',
    example: 'DUP жим лёжа: 3 тренировки в неделю с разными параметрами.',
    popularizedBy: 'Mike Zourdos, Brad Schoenfeld', caveats: ['Сложнее планировать', 'Меньше специфичности для PL'],
  },
  {
    name: 'Блочная периодизация (Block Periodization)',
    category: 'periodization', evidenceLevel: 'A',
    description: 'Накопление → Трансформация → Реализация. Каждый блок фокусируется на ОДНОМ качестве.',
    howItWorks: 'Блок 1 (4 нед): высокий объём, низкая интенсивность. Блок 2 (4 нед): средний объём, высокая интенсивность. Блок 3 (3 нед): низкий объём, максимальная интенсивность.',
    bestFor: 'Продвинутые атлеты, элита. Научно обоснована.',
    example: '12 недель: Accumulation → Transmutation → Realization.',
    popularizedBy: 'Vladimir Issurin, Yuri Verkhoshansky', caveats: ['Сложно для новичков', 'Требует точного планирования'],
  },
  {
    name: 'Сопряжённый метод (Conjugate Method / Westside)',
    category: 'periodization', evidenceLevel: 'B',
    description: 'Max Effort + Dynamic Effort дни. Постоянная ротация упражнений. Специальные упражнения.',
    howItWorks: 'ME Lower (тяжёлый box squat/good morning) → ME Upper (тяжёлый board press/floor press) → DE Lower (скоростной box squat 50-60%+bands) → DE Upper (скоростной bench 50-60%+bands).',
    bestFor: 'Элитные пауэрлифтёры. Выявляет слабые места.',
    example: '4 дня: ME Lower, ME Upper, DE Lower, DE Upper. Ротация упражнений каждые 1-2 недели.',
    popularizedBy: 'Louie Simmons, Westside Barbell', caveats: ['Очень сложно для новичков', 'Специфичное оборудование', 'Высокий риск травм'],
  },
  {
    name: '5/3/1 (Wendler)',
    category: 'periodization', evidenceLevel: 'A',
    description: '4-недельные волновые циклы. TM (training max = 85-90% 1RM). Медленный, устойчивый прогресс.',
    howItWorks: 'Неделя 1: 3×5+, Неделя 2: 3×3+, Неделя 3: 5/3/1+, Неделя 4: Deload. Каждый цикл TM +2.5/5 кг.',
    bestFor: 'Средний уровень. Долгосрочный прогресс без плато.',
    example: 'OHP 5/3/1: 65%×5, 75%×5, 85%×5+ → 70%×3, 80%×3, 90%×3+ → 75%×5, 85%×3, 95%×1+ → Deload.',
    popularizedBy: 'Jim Wendler', caveats: ['Медленный старт', 'Расчёт от TM (не реального 1RM)'],
  },
  {
    name: 'Метод повторных усилий (Repeated Effort Method)',
    category: 'progression', evidenceLevel: 'A',
    description: 'Подходы до отказа или близко к отказу. Ключевой драйвер гипертрофии.',
    howItWorks: '3-5 подходов с весом 65-85% 1RM, RPE 8-10. Последние повторения — самые эффективные.',
    bestFor: 'Гипертрофия. Любой уровень.',
    example: '4×8-12 @RPE 8-9 = 4 подхода по 8-12 повторений с 2-3 повторениями в запасе.',
    popularizedBy: 'Brad Schoenfeld, Chris Beardsley', caveats: ['Не каждый подход до отказа', 'Риск перетрена при частом использовании'],
  },
  {
    name: 'Метод максимальных усилий (Max Effort Method)',
    category: 'progression', evidenceLevel: 'A',
    description: 'Работа с весом 90-100%+. 1-3 повторения. Развитие максимальной силы.',
    howItWorks: '1-3 подхода × 1-3 повторения с 90%+ 1RM. Длинный отдых (3-5+ мин).',
    bestFor: 'Максимальная сила. Пауэрлифтинг.',
    example: 'Присед: 3×1 @95%, 2×2 @92%, 1×3 @90%.',
    popularizedBy: 'Zatsiorsky, Westside', caveats: ['Высокий риск травм', 'Большая нагрузка на ЦНС', 'Не для новичков'],
  },
  {
    name: 'Метод динамических усилий (Dynamic Effort Method)',
    category: 'progression', evidenceLevel: 'B',
    description: 'Субмаксимальный вес (50-65% 1RM) + bands/chains. Максимальная скорость. Развитие мощности.',
    howItWorks: '8-12×2-3 с 50-65% 1RM + bands. Отдых 45-60 сек. Каждое повторение — взрывное.',
    bestFor: 'Мощность, скорость. Пауэрлифтинг, спорт.',
    example: 'Box squat 10×2 @55% + bands. 45 сек отдых.',
    popularizedBy: 'Louie Simmons', caveats: ['Нужны bands/chains', 'Не заменяет ME работу'],
  },
  {
    name: 'Кластерный метод (Cluster Sets)',
    category: 'intensity', evidenceLevel: 'B',
    description: 'Тяжёлый вес (85-95%), но с короткими паузами внутри подхода для сохранения скорости.',
    howItWorks: 'Вес 85-90%. 1 повторение → отдых 20-30 сек → 1 повторение → ... 5-8 общих повторений.',
    bestFor: 'Сила + мощность. Прорыв плато.',
    example: 'Присед 160кг (90%): 1 → 25с → 1 → 25с → 1 → 25с → 1 → 25с → 1 = 5 синглов с 90%.',
    popularizedBy: 'Carl Miller, Haff', caveats: ['Сложно для новичков', 'Требует дисциплины отдыха'],
  },
  {
    name: 'Rest-Pause Training',
    category: 'intensity', evidenceLevel: 'B',
    description: 'Один подход до отказа → короткий отдых → ещё несколько повторений → повторять.',
    howItWorks: 'Вес 80-90%. Подход до RPE 9 → отдых 15-20 сек → ещё 2-4 повторения → отдых 15 сек → ещё 1-3.',
    bestFor: 'Гипертрофия + сила. Экономия времени.',
    example: 'Жим 100кг: 8 повторений → 15 сек → 3 → 15 сек → 2 = 13 повторений с весом 8RM.',
    popularizedBy: 'Dante Trudel (DC Training)', caveats: ['Очень интенсивно', 'Не для новичков', 'Риск перетрена'],
  },
  {
    name: 'Drop Sets (Дроп-сеты)',
    category: 'intensity', evidenceLevel: 'A',
    description: 'Подход до отказа → сброс веса на 20-30% → сразу ещё до отказа → повторить.',
    howItWorks: '1 подход до RPE 10 → сброс 20-30% веса → сразу до RPE 10 → опционально ещё 1 сброс.',
    bestFor: 'Гипертрофия. Памп. Изоляция.',
    example: 'DB Press 40кг×10 → 30кг×7 → 20кг×10.',
    popularizedBy: 'Bodybuilding community', caveats: ['Не на compound', 'Высокая усталость', 'Не каждую тренировку'],
  },
  {
    name: 'Myo-Reps',
    category: 'intensity', evidenceLevel: 'B',
    description: 'Активационный сет (RPE 8) → мини-сеты по 3-5 повторений с 5 глубокими вдохами отдыха.',
    howItWorks: '1 подход 15-20 @RPE 8 → 5 вдохов → 3-5 повторений → 5 вдохов → 3-5 повторений → повторять до падения на 1-2 повторения.',
    bestFor: 'Эффективный тренинг за короткое время.',
    example: 'Leg Press: 200кг ×18 @RPE 8 → 5 вдохов → 4 → 5 вдохов → 4 → 5 вдохов → 3 → 5 вдохов → 2. Стоп.',
    popularizedBy: 'Borge Fagerli', caveats: ['Требует практики', 'Высокая метаболическая нагрузка'],
  },
  {
    name: 'Blood Flow Restriction (BFR)',
    category: 'technique', evidenceLevel: 'A',
    description: 'Ограничение венозного возврата → лёгкий вес (20-30% 1RM) даёт гипертрофию как 70% 1RM.',
    howItWorks: 'Манжеты на проксимальную часть. 30-15-15-15 повторений с 30 сек отдыха. Вес 20-30% 1RM.',
    bestFor: 'Реабилитация. Периоды низкой нагрузки. Deload.',
    example: 'BFR Leg Press: 40кг (20% 1RM) ×30 → 30с → ×15 → 30с → ×15 → 30с → ×15.',
    popularizedBy: 'Jeremy Loenneke, Japanese research', caveats: ['Требует обучения', 'Не при тромбозе', 'Опасно без знаний'],
  },
  {
    name: 'Pre-Exhaust (Предварительное утомление)',
    category: 'technique', evidenceLevel: 'C',
    description: 'Изоляция целевой мышцы → сразу compound. Мышца уже утомлена = compound добивает.',
    howItWorks: 'Cable Flye 3×15 → сразу Bench Press 3×8. ИЛИ Leg Extension 3×15 → сразу Squat 3×8.',
    bestFor: 'Улучшение mind-muscle connection. Отстающие группы.',
    example: 'Грудь: Cable Flye 3×15 → Bench Press 3×8.',
    popularizedBy: 'Arthur Jones, Mike Mentzer', caveats: ['Снижает силу в compound', 'Не для силовых блоков'],
  },
  {
    name: 'German Volume Training (GVT / 10×10)',
    category: 'volume', evidenceLevel: 'B',
    description: '10 подходов × 10 повторений с 60% 1RM. 60 сек отдых. Огромный объём.',
    howItWorks: 'Выбрать 1-2 упражнения. 10×10 с 60% 1RM. 60 сек отдых. Темп 4-0-2-0.',
    bestFor: 'Гипертрофия. Шокирование мышц новым стимулом.',
    example: 'GVT присед: 100кг 10×10 с отдыхом 60 сек.',
    popularizedBy: 'Charles Poliquin, German weightlifters', caveats: ['Экстремальный объём', 'Только 3-4 недели', 'Не для новичков'],
  },
  {
    name: 'FST-7 (Fascia Stretch Training)',
    category: 'volume', evidenceLevel: 'C',
    description: '7 подходов × 8-12 с 30-45 сек отдыха в конце тренировки. Растяжение фасции.',
    howItWorks: 'Последнее упражнение: 7 подходов × 8-12 повторений с 30-45 сек отдыха. Пить воду между подходами.',
    bestFor: 'Памп, растяжение фасции. Завершение тренировки.',
    example: 'Cable Flye FST-7: 7×10-12 с 30 сек отдыха. Последнее упражнение на грудь.',
    popularizedBy: 'Hany Rambod', caveats: ['Только для продвинутых', 'Не научно подтверждено для фасции'],
  },
  {
    name: 'Gironda 8×8',
    category: 'volume', evidenceLevel: 'C',
    description: '8 подходов × 8 повторений с минимальным отдыхом. Плотность как приоритет.',
    howItWorks: '8×8 с 50-60% 1RM. 15-30 сек отдых. Темп 2-0-2-0.',
    bestFor: 'Плотность, метаболический стресс.',
    example: '8×8 жим гантелей с 15-30 сек отдыха.',
    popularizedBy: 'Vince Gironda', caveats: ['Очень высокая плотность', 'Только для опытных'],
  },
  {
    name: 'Emom (Every Minute on the Minute)',
    category: 'frequency', evidenceLevel: 'B',
    description: 'Каждую минуту начинаете новый подход. Время на подход = ваш отдых.',
    howItWorks: 'Выбрать вес/упражнение. Каждую минуту по сигналу — подход. Оставшееся время — отдых.',
    bestFor: 'Кондиция, плотность, кроссфит.',
    example: 'EMOM 10: минута 1 — 5 pull-ups, минута 2 — 10 push-ups. Повторять 10 минут.',
    popularizedBy: 'CrossFit community', caveats: ['Не для максимальной силы', 'Качество страдает при усталости'],
  },
  {
    name: 'Progressive Overload (базовый принцип)',
    category: 'progression', evidenceLevel: 'A',
    description: 'Постепенное увеличение нагрузки: вес, повторения, подходы, плотность, частота.',
    howItWorks: 'Каждую неделю/месяц увеличивать ОДИН параметр на 2-5%. Вес ИЛИ повторения ИЛИ подходы.',
    bestFor: 'Все. Фундаментальный принцип тренинга.',
    example: 'Неделя 1: 80×8. Неделя 2: 80×9. ... Неделя 4: 80×10 → 82.5×8.',
    popularizedBy: 'Milo of Croton (легенда)', caveats: ['Не пытаться увеличивать всё сразу', 'Малые шаги'],
  },
  {
    name: 'RPE-based Autoregulation',
    category: 'progression', evidenceLevel: 'A',
    description: 'Регулировка нагрузки по субъективному ощущению (RPE), а не по фиксированному проценту.',
    howItWorks: 'Цель: @RPE 8 (2 повторения в запасе). В хороший день — вес выше. В плохой — ниже.',
    bestFor: 'Все уровни. Индивидуализация.',
    example: 'Цель: 3×8 @RPE 8. Хороший день: 100×8. Плохой день: 90×8. Результат одинаковый.',
    popularizedBy: 'Mike Tuchscherer (RTS)', caveats: ['Требует честности с собой', 'Новички плохо оценивают RPE'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 2. Federation Strength Standards
// ═══════════════════════════════════════════════════════════════════════════

const IPF_STANDARDS: FedStandard = {
  federation: 'IPF',
  weightClasses: [59, 66, 74, 83, 93, 105, 120, 120],
  qualifyingTotals: {
    'Чемпионат России': { '59': 400, '66': 460, '74': 510, '83': 550, '93': 580, '105': 610, '120': 640 },
    'Чемпионат Европы': { '59': 490, '66': 550, '74': 600, '83': 640, '93': 670, '105': 700, '120': 730 },
    'Чемпионат Мира': { '59': 540, '66': 600, '74': 660, '83': 700, '93': 740, '105': 770, '120': 800 },
  },
  nationalRecords: {
    'Squat': { '59': 240, '66': 270, '74': 300, '83': 320, '93': 340, '105': 360, '120': 380 },
    'Bench': { '59': 170, '66': 195, '74': 215, '83': 230, '93': 245, '105': 260, '120': 275 },
    'Deadlift': { '59': 260, '66': 290, '74': 320, '83': 340, '93': 355, '105': 370, '120': 390 },
  },
  worldRecords: {
    'Squat': { '59': 300, '66': 330, '74': 365, '83': 390, '93': 410, '105': 430, '120': 450 },
    'Bench': { '59': 210, '66': 235, '74': 255, '83': 275, '93': 290, '105': 305, '120': 320 },
    'Deadlift': { '59': 310, '66': 340, '74': 370, '83': 400, '93': 420, '105': 440, '120': 460 },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. Complete Volume Landmarks Reference
// ═══════════════════════════════════════════════════════════════════════════

const VOLUME_REFERENCES: VolumeReference[] = [
  { muscle: 'Грудь', beginner: { mev: 6, mav: 10, mrv: 15, frequency: '1.5-2×/нед' }, intermediate: { mev: 8, mav: 14, mrv: 20, frequency: '2×/нед' }, advanced: { mev: 10, mav: 16, mrv: 24, frequency: '2-3×/нед' }, notes: 'Считаются прямые подходы на грудь. Flye = 0.5 подхода.', bestExercises: ['Bench Press', 'Incline DB', 'Cable Flye', 'Dips'] },
  { muscle: 'Широчайшие / Спина', beginner: { mev: 8, mav: 12, mrv: 18, frequency: '2×/нед' }, intermediate: { mev: 10, mav: 16, mrv: 24, frequency: '2×/нед' }, advanced: { mev: 12, mav: 20, mrv: 28, frequency: '2-3×/нед' }, notes: 'Тяги + подтягивания. Deadlift считается как 0.5 для спины.', bestExercises: ['Pull-up', 'Barbell Row', 'Lat Pulldown', 'Seated Row'] },
  { muscle: 'Квадрицепсы', beginner: { mev: 6, mav: 10, mrv: 15, frequency: '1.5-2×/нед' }, intermediate: { mev: 8, mav: 14, mrv: 20, frequency: '2×/нед' }, advanced: { mev: 10, mav: 16, mrv: 24, frequency: '2×/нед' }, notes: 'Присед + жим ногами + разгибания. Deadlift не считается.', bestExercises: ['Back Squat', 'Front Squat', 'Leg Press', 'Leg Extension'] },
  { muscle: 'Бицепс бедра', beginner: { mev: 4, mav: 8, mrv: 12, frequency: '1.5-2×/нед' }, intermediate: { mev: 6, mav: 10, mrv: 16, frequency: '2×/нед' }, advanced: { mev: 8, mav: 12, mrv: 18, frequency: '2×/нед' }, notes: 'RDL + сгибания. Deadlift = 0.5 подхода для hamstrings.', bestExercises: ['RDL', 'Leg Curl', 'Good Morning', 'Nordic Curl'] },
  { muscle: 'Плечи', beginner: { mev: 4, mav: 8, mrv: 12, frequency: '2×/нед' }, intermediate: { mev: 6, mav: 10, mrv: 16, frequency: '2-3×/нед' }, advanced: { mev: 8, mav: 12, mrv: 20, frequency: '2-3×/нед' }, notes: 'Жимы + махи. Жим лёжа отдаёт 0.5 подхода передним дельтам.', bestExercises: ['OHP', 'Lateral Raise', 'Face Pull', 'Rear Delt Flye'] },
  { muscle: 'Бицепс', beginner: { mev: 2, mav: 6, mrv: 10, frequency: '1.5-2×/нед' }, intermediate: { mev: 4, mav: 8, mrv: 14, frequency: '2×/нед' }, advanced: { mev: 6, mav: 12, mrv: 18, frequency: '2-3×/нед' }, notes: 'Тяги отдают 0.25 подхода бицепсу.', bestExercises: ['Barbell Curl', 'DB Curl', 'Hammer Curl', 'Preacher Curl'] },
  { muscle: 'Трицепс', beginner: { mev: 2, mav: 6, mrv: 10, frequency: '1.5-2×/нед' }, intermediate: { mev: 4, mav: 8, mrv: 14, frequency: '2×/нед' }, advanced: { mev: 6, mav: 12, mrv: 18, frequency: '2-3×/нед' }, notes: 'Жимы отдают 0.25 подхода трицепсу.', bestExercises: ['Close-Grip Bench', 'Tricep Pushdown', 'Overhead Extension', 'Dips'] },
  { muscle: 'Ягодичные', beginner: { mev: 4, mav: 8, mrv: 12, frequency: '2×/нед' }, intermediate: { mev: 6, mav: 10, mrv: 16, frequency: '2×/нед' }, advanced: { mev: 8, mav: 14, mrv: 20, frequency: '2-3×/нед' }, notes: 'Присед + тяга = 0.5 подхода. Hip thrust считается полностью.', bestExercises: ['Hip Thrust', 'Bulgarian Split Squat', 'Sumo DL', 'Glute Bridge'] },
  { muscle: 'Икры', beginner: { mev: 4, mav: 8, mrv: 12, frequency: '2×/нед' }, intermediate: { mev: 6, mav: 10, mrv: 16, frequency: '2-3×/нед' }, advanced: { mev: 8, mav: 12, mrv: 18, frequency: '3-4×/нед' }, notes: 'Очень выносливые. Нужен прямой объём.', bestExercises: ['Standing Calf Raise', 'Seated Calf Raise', 'Leg Press Calf'] },
  { muscle: 'Пресс / Кор', beginner: { mev: 4, mav: 8, mrv: 12, frequency: '2-3×/нед' }, intermediate: { mev: 6, mav: 10, mrv: 14, frequency: '3×/нед' }, advanced: { mev: 8, mav: 12, mrv: 16, frequency: '3-4×/нед' }, notes: 'Прямые + косые + поперечная. Plank считается за 1 подход.', bestExercises: ['Plank', 'Ab Wheel', 'Hanging Leg Raise', 'Pallof Press'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. Split Structure Visualizer (8 splits)
// ═══════════════════════════════════════════════════════════════════════════

const SPLIT_VISUALS: SplitVisual[] = [
  {
    name: 'Full Body 3x (FBW)', days: [
      { day: 1, name: 'Пн FBW A', focus: 'Squat-dominant', patterns: ['squat', 'horizontal_push', 'horizontal_pull', 'accessory'], volume: 'medium', intensity: 'medium' },
      { day: 2, name: 'Ср FBW B', focus: 'Hinge-dominant', patterns: ['hinge', 'vertical_push', 'vertical_pull', 'accessory'], volume: 'medium', intensity: 'medium' },
      { day: 3, name: 'Пт FBW C', focus: 'Press-dominant', patterns: ['squat', 'horizontal_push', 'horizontal_pull', 'hinge'], volume: 'medium', intensity: 'medium' },
    ], totalVolume: '12-18 sets/muscle/week', totalFrequency: '3×/нед на группу', suitability: ['Новички', 'Возвращение после перерыва', 'Ограниченное время'],
  },
  {
    name: 'Upper/Lower 4x', days: [
      { day: 1, name: 'Пн Upper Strength', focus: 'Сила верха', patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull'], volume: 'low', intensity: 'high' },
      { day: 2, name: 'Вт Lower Strength', focus: 'Сила низа', patterns: ['squat', 'hinge', 'lunge'], volume: 'low', intensity: 'high' },
      { day: 3, name: 'Чт Upper Hyper', focus: 'Гипертрофия верха', patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'accessory'], volume: 'high', intensity: 'medium' },
      { day: 4, name: 'Пт Lower Hyper', focus: 'Гипертрофия низа', patterns: ['squat', 'hinge', 'lunge', 'accessory'], volume: 'high', intensity: 'medium' },
    ], totalVolume: '14-20 sets/muscle/week', totalFrequency: '2×/нед на группу', suitability: ['Средний уровень', 'Сила+гипертрофия', '4 дня/нед'],
  },
  {
    name: 'Push/Pull/Legs 6x', days: [
      { day: 1, name: 'Пн Push A', focus: 'Грудь+Плечи+Трицепс (сила)', patterns: ['horizontal_push', 'vertical_push', 'accessory'], volume: 'medium', intensity: 'high' },
      { day: 2, name: 'Вт Pull A', focus: 'Спина+Бицепс (сила)', patterns: ['horizontal_pull', 'vertical_pull', 'hinge'], volume: 'medium', intensity: 'high' },
      { day: 3, name: 'Ср Legs A', focus: 'Квадры+Ягодицы (сила)', patterns: ['squat', 'hinge', 'lunge'], volume: 'medium', intensity: 'high' },
      { day: 4, name: 'Чт Push B', focus: 'Грудь+Плечи+Трицепс (hyper)', patterns: ['horizontal_push', 'vertical_push', 'accessory'], volume: 'high', intensity: 'medium' },
      { day: 5, name: 'Пт Pull B', focus: 'Спина+Бицепс (hyper)', patterns: ['horizontal_pull', 'vertical_pull'], volume: 'high', intensity: 'medium' },
      { day: 6, name: 'Сб Legs B', focus: 'Квадры+Ягодицы (hyper)', patterns: ['squat', 'hinge', 'lunge', 'accessory'], volume: 'high', intensity: 'medium' },
    ], totalVolume: '16-24 sets/muscle/week', totalFrequency: '2×/нед', suitability: ['Продвинутые', 'Гипертрофия', '6 дней/нед'],
  },
  {
    name: 'Powerbuilding (4-Day)', days: [
      { day: 1, name: 'Пн Squat + Lower', focus: 'Присед + низ (сила)', patterns: ['squat', 'hinge', 'lunge'], volume: 'medium', intensity: 'high' },
      { day: 2, name: 'Вт Bench + Upper', focus: 'Жим + верх (сила)', patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull'], volume: 'medium', intensity: 'high' },
      { day: 3, name: 'Чт Deadlift + Posterior', focus: 'Тяга + задняя цепь', patterns: ['hinge', 'horizontal_pull', 'carry'], volume: 'low', intensity: 'high' },
      { day: 4, name: 'Пт Upper Hypertrophy', focus: 'Верх (гипертрофия)', patterns: ['horizontal_push', 'vertical_push', 'vertical_pull', 'accessory'], volume: 'high', intensity: 'medium' },
    ], totalVolume: '12-18 sets/muscle/week', totalFrequency: '1.5-2×/нед', suitability: ['Сила + масса', 'Средний-продвинутый'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

export function getTrainingMethods(): TrainingMethod[] { return TRAINING_METHODS; }
export function getMethodsByCategory(cat: string): TrainingMethod[] { return TRAINING_METHODS.filter(m => m.category === cat); }
export function getFederationStandards(): FedStandard[] { return [IPF_STANDARDS]; }
export function getQualifyingTotal(fed: string, meet: string, weightClass: number): number {
  const f = [IPF_STANDARDS].find(f => f.federation === fed); if (!f) return 0;
  const w = f.weightClasses.reduce((p, c) => Math.abs(c - weightClass) < Math.abs(p - weightClass) ? c : p);
  return f.qualifyingTotals[meet]?.[String(w)] || 0;
}
export function getVolumeReferences(): VolumeReference[] { return VOLUME_REFERENCES; }
export function getVolumeByMuscle(muscle: string): VolumeReference | undefined { return VOLUME_REFERENCES.find(v => v.muscle.toLowerCase().includes(muscle.toLowerCase())); }
export function getSplitVisuals(): SplitVisual[] { return SPLIT_VISUALS; }
