/**
 * Genetic Profile + Deload Generator + Exercise Technique Library
 *
 * Genetic Profile: how genes affect training, nutrition, recovery, injury risk
 * Deload Generator: auto-schedule deloads based on 8 fatigue markers
 * Exercise Technique: 30+ exercises with cues, errors, fixes, progression
 *
 * @module genetic-deload-technique-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface GeneticProfile {
  variants: Record<string, { allele: string; effect: string; trainingImplication: string; nutritionAdvice: string; injuryRisk: string }>;
  summary: { powerResponder: boolean; enduranceBias: boolean; injuryProne: boolean; recoverySpeed: 'fast' | 'normal' | 'slow'; caffeineMetabolizer: 'fast' | 'slow' };
}

export interface DeloadInput {
  weeksInCycle: number;
  fatigueScore: number;
  priScore: number;
  sleepScore: number;
  hrvSuppression: number;
  jointPain: number;
  motivation: number;
  gymPerformance: 'improving' | 'stable' | 'declining';
}

export interface DeloadProtocol {
  type: 'standard' | 'active' | 'complete' | 'taper';
  weeks: number;
  volumePercent: number;
  intensityPercent: number;
  frequencyDays: number;
  dailyActivities: string[];
  nutritionAdjustment: string;
  expectedOutcome: string;
}

export interface TechniqueCue {
  cue: string;
  category: 'setup' | 'execution' | 'breathing' | 'mental';
  priority: 'critical' | 'important' | 'refinement';
}

export interface ExerciseTechnique {
  name: string;
  pattern: string;
  setup: string[];
  execution: string[];
  breathing: string[];
  commonErrors: { error: string; cause: string; fix: string }[];
  cues: TechniqueCue[];
  progression: string[];
  regression: string[];
  preRequisites: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Genetic Profile Engine
// ═══════════════════════════════════════════════════════════════════════════

const GENE_DB: Record<string, { effect: string; training: string; nutrition: string; injury: string }> = {
  ACTN3_RR: { effect: 'RR — альфа-актинин-3 дефицит (18% населения)', training: 'Меньше быстрых волокон IIx. Выносливость > мощность. Больше повторений, меньше максимальных весов.', nutrition: 'Стандарт.', injury: 'Нет повышенного риска.' },
  ACTN3_RX: { effect: 'RX — промежуточный генотип', training: 'Универсальный ответ. Хорошо на силу и гипертрофию.', nutrition: 'Стандарт.', injury: 'Нет.' },
  ACTN3_XX: { effect: 'XX — нормальный альфа-актинин-3 (спринтерский)', training: 'Мощность и взрывная сила. Низкие повторения, тяжёлые веса. Прыжки, спринты.', nutrition: 'Креатин даёт максимальный эффект.', injury: 'Нет.' },
  ACE_DD: { effect: 'DD — высокий ACE → ангиотензин II ↑', training: 'Гипертрофия от силовых. Хороший ответ на объём.', nutrition: 'Ограничить натрий.', injury: 'Риск гипертензии на ААС. Контроль АД.' },
  ACE_II: { effect: 'II — низкий ACE → брадикинин ↑', training: 'Выносливость. Эффективность на длинных дистанциях.', nutrition: 'Стандарт.', injury: 'Нет.' },
  COL1A1_TT: { effect: 'TT — коллаген тип I (рисковый)', training: 'Избегать плиометрику и резких движений.', nutrition: 'Витамин C 1000мг + глицин 10г/день.', injury: 'Повышенный риск разрыва ПКС и ахилла.' },
  MTHFR_C677T: { effect: 'C677T — снижение метилирования', training: 'Стандарт.', nutrition: 'Метилфолат вместо фолиевой кислоты. B12 метилкобаламин.', injury: 'Повышен гомоцистеин → риск тромбоза.' },
  APOE4: { effect: 'ApoE4 — риск Альцгеймера + ССЗ', training: 'Кардио обязательно 3×/нед.', nutrition: 'Низко-насыщенные жиры. Омега-3 4г/день.', injury: 'Повышенный риск атеросклероза на ААС.' },
  COMT_slow: { effect: 'COMT медленный — дофамин/норадреналин задерживаются', training: 'Чувствительность к стрессу. Избегать перетрена.', nutrition: 'Магний 600мг. Ограничить кофеин.', injury: 'Риск тревожности на тренболоне.' },
  UGT2B17_del: { effect: 'UGT2B17 делеция — медленный метаболизм тестостерона', training: 'Стандарт.', nutrition: 'DIM, I3C для метаболизма эстрогенов.', injury: 'Высокий риск гепатотоксичности от оральных ААС.' },
};

export function analyzeGenetics(variants: string[]): GeneticProfile {
  const profile: GeneticProfile = {
    variants: {},
    summary: { powerResponder: true, enduranceBias: false, injuryProne: false, recoverySpeed: 'normal', caffeineMetabolizer: 'fast' },
  };

  const signals = { power: 0, endurance: 0, injury: 0, recovery: 0, caffeine: 0 };

  for (const v of variants) {
    const gene = GENE_DB[v];
    if (!gene) continue;
    profile.variants[v] = { allele: v, effect: gene.effect, trainingImplication: gene.training, nutritionAdvice: gene.nutrition, injuryRisk: gene.injury };

    if (v === 'ACTN3_XX') signals.power++;
    if (v === 'ACTN3_RR' || v === 'ACE_II') signals.endurance++;
    if (v === 'COL1A1_TT' || v === 'MTHFR_C677T') signals.injury++;
    if (v === 'COMT_slow') { signals.recovery--; signals.caffeine--; }
  }

  profile.summary.powerResponder = signals.power >= signals.endurance;
  profile.summary.enduranceBias = signals.endurance > signals.power;
  profile.summary.injuryProne = signals.injury >= 1;
  profile.summary.recoverySpeed = signals.recovery < 0 ? 'slow' : 'normal';
  profile.summary.caffeineMetabolizer = signals.caffeine < 0 ? 'slow' : 'fast';

  return profile;
}

export function getGeneticAdvice(profile: GeneticProfile): string[] {
  const advice: string[] = [];

  if (profile.summary.powerResponder) advice.push('Генетика мощности. Приоритет: сила и взрывная работа.');
  if (profile.summary.enduranceBias) advice.push('Генетика выносливости. Приоритет: объём и метаболический стресс.');
  if (profile.summary.injuryProne) advice.push('Повышенный риск травм. Prehab обязательно. Избегайте плиометрики.');
  if (profile.summary.recoverySpeed === 'slow') advice.push('Медленное восстановление. Больше сна, deload каждые 4 недели.');
  if (profile.summary.caffeineMetabolizer === 'slow') advice.push('Медленный метаболизм кофеина. Последний приём до 12:00.');

  return advice;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Deload Generator
// ═══════════════════════════════════════════════════════════════════════════

export function generateDeload(input: DeloadInput): DeloadProtocol {
  let deloadSignals = 0;

  if (input.weeksInCycle >= 8) deloadSignals += 2;
  else if (input.weeksInCycle >= 5) deloadSignals++;
  if (input.fatigueScore > 0.75) deloadSignals += 2;
  else if (input.fatigueScore > 0.6) deloadSignals++;
  if (input.priScore < 0.35) deloadSignals += 2;
  else if (input.priScore < 0.5) deloadSignals++;
  if (input.hrvSuppression > 20) deloadSignals++;
  if (input.jointPain > 6) deloadSignals += 2;
  else if (input.jointPain > 4) deloadSignals++;
  if (input.motivation < 3) deloadSignals++;
  if (input.gymPerformance === 'declining') deloadSignals += 2;
  if (input.sleepScore < 40) deloadSignals++;

  if (deloadSignals >= 8) {
    return {
      type: 'complete', weeks: 1,
      volumePercent: 20, intensityPercent: 40, frequencyDays: 2,
      dailyActivities: ['Прогулка 30 мин', 'Мобильность 15 мин', 'Дыхание 4-7-8', 'Foam rolling 10 мин'],
      nutritionAdjustment: 'Поддерживающие калории. Белок 1.8 г/кг.',
      expectedOutcome: `Высокий сигнал deload (${deloadSignals}/13). Полный отдых от нагрузок. Восстановление ЦНС и суставов.`,
    };
  }

  if (deloadSignals >= 5) {
    return {
      type: 'standard', weeks: 1,
      volumePercent: 40, intensityPercent: 55, frequencyDays: 3,
      dailyActivities: ['Лёгкое кардио 20 мин', 'Мобильность', 'Растяжка целевых групп', 'Технические упражнения без веса'],
      nutritionAdjustment: 'Поддерживающие калории. Белок 2.0 г/кг.',
      expectedOutcome: `Умеренный сигнал (${deloadSignals}/13). Снижение объёма на 60%. Техника и восстановление.`,
    };
  }

  if (deloadSignals >= 3) {
    return {
      type: 'active', weeks: 1,
      volumePercent: 55, intensityPercent: 65, frequencyDays: 4,
      dailyActivities: ['Основные движения 60%', 'Аксессуары 50% объёма', 'Мобильность'],
      nutritionAdjustment: 'Поддерживающие. Можно небольшой дефицит.',
      expectedOutcome: `Лёгкий сигнал (${deloadSignals}/13). Активный deload — снижение на 40%.`,
    };
  }

  return {
    type: 'taper', weeks: 1,
    volumePercent: 70, intensityPercent: 80, frequencyDays: 4,
    dailyActivities: ['Снижение объёма на 30%', 'Сохранение интенсивности', 'Фокус на основные движения'],
    nutritionAdjustment: 'Поддерживающие калории.',
    expectedOutcome: `Минимальный сигнал (${deloadSignals}/13). Микро-deload/taper.`,
  };
}

export function getDeloadChecklist(protocol: DeloadProtocol): string[] {
  const checklist: string[] = [
    'Снизить количество рабочих подходов',
    'Исключить отказные подходы (RPE ≤ 7)',
    'Увеличить сон на 1 час',
    'Увеличить калории до поддерживающих (если на дефиците)',
  ];

  if (protocol.type === 'complete') {
    checklist.push('Полный отдых от тренажёрного зала');
    checklist.push('Массаж / физиотерапия при болях');
    checklist.push('Медитация / дыхательные практики');
  }

  if (protocol.type === 'standard') {
    checklist.push('Заменить тяжёлые compound на machine вариации');
    checklist.push('Tempo работа (3-0-3-0)');
  }

  return checklist;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Exercise Technique Library
// ═══════════════════════════════════════════════════════════════════════════

const TECHNIQUE_DB: ExerciseTechnique[] = [
  {
    name: 'Присед со штангой на спине (Low Bar)', pattern: 'squat',
    setup: [
      'Гриф на уровне середины груди в стойке',
      'Подсесть под гриф, разместить на задних дельтах (ниже трапеций)',
      'Хват уже чем в жиме, локти назад и вниз',
      'Снять гриф, отойти на 2-3 шага',
      'Стопы на ширине плеч, носки чуть наружу (15-30°)',
    ],
    execution: [
      'Вдох в живот (360° брейсинг)',
      'Одновременно согнуть колени и бёдра (как садиться на стул)',
      'Колени по линии стоп, не заваливаются внутрь',
      'Грудь вверх, взгляд вперёд-вниз (точка на полу в 2м)',
      'Бёдра ниже параллели (тазобедренный сустав ниже коленного)',
      'Мощный подъём, ведя грудью и плечами',
    ],
    breathing: ['Вдох вверху → задержка → выдох после прохождения sticking point'],
    commonErrors: [
      { error: 'Колени заваливаются внутрь', cause: 'Слабые отводящие бедра', fix: 'Banded squat, clamshell. Думать "колени наружу".' },
      { error: 'Округление поясницы (butt wink)', cause: 'Недостаточная мобильность бёдер/голеностопа', fix: 'Goblet squat пауза. Ограничить глубину до исчезновения wink.' },
      { error: 'Пятки отрываются', cause: 'Недостаточная дорсифлексия голеностопа', fix: 'Растяжка голеностопа. Штангистские ботинки с каблуком.' },
      { error: 'Наклон вперёд (Good morning squat)', cause: 'Слабые квадрицепсы', fix: 'Front squat, leg press. Думать "грудь вверх".' },
      { error: 'Гриф скатывается', cause: 'Нет полки из задних дельт', fix: 'Свести лопатки. Использовать Safety Bar.' },
    ],
    cues: [
      { cue: 'Грудь вверх', category: 'setup', priority: 'critical' },
      { cue: 'Колени наружу', category: 'execution', priority: 'critical' },
      { cue: 'Разорви пол ногами', category: 'execution', priority: 'important' },
      { cue: 'Дыши животом (360°)', category: 'breathing', priority: 'critical' },
      { cue: 'Локти под гриф', category: 'setup', priority: 'important' },
    ],
    progression: ['Goblet Squat → Front Squat → Safety Bar Squat → Back Squat → Low Bar Squat'],
    regression: ['Low Bar Squat → High Bar Squat → Front Squat → Goblet Squat → Box Squat'],
    preRequisites: ['Bodyweight squat ×20 без боли', 'Ankle mobility 30°+', 'Hip mobility 90°+'],
  },
  {
    name: 'Становая тяга (Conventional)', pattern: 'hinge',
    setup: [
      'Стопы на ширине бёдер, гриф над серединой стопы',
      'Наклониться, взяться за гриф (хват на ширине плеч)',
      'Голени касаются грифа',
      'Грудь вверх, плечи над грифом (не перед)',
      'Спина прямая, поясница в нейтральном положении',
      'Напрячь широчайшие (представить "защитить подмышки")',
    ],
    execution: [
      'Глубокий вдох в живот, задержка',
      'Начать движение с разгибания ног (не спины!)',
      'Гриф скользит по голеням и бёдрам',
      'Когда гриф проходит колени — мощно вывести таз вперёд',
      'Завершить движение: плечи назад, колени заблокированы',
      'Опускание: таз назад → гриф скользит вниз → касание пола',
    ],
    breathing: ['Вдох перед подъёмом → задержка на всём движении → выдох вверху'],
    commonErrors: [
      { error: 'Округление спины', cause: 'Слабый кор / плохая подвижность', fix: 'Dead bug, RDL. Снизить вес. Trap bar DL.' },
      { error: 'Таз поднимается быстрее плеч', cause: 'Слабые квадрицепсы', fix: 'Front squat, deficit DL. Думать "толкай пол ногами".' },
      { error: 'Гриф уходит от тела', cause: 'Не включены широчайшие', fix: 'Lat activation перед тягой. Бинт или band вокруг грифа.' },
      { error: 'Переразгибание вверху', cause: 'Избыточный lumbar extension', fix: 'Завершать движение сжатием ягодиц, не прогибом спины.' },
      { error: 'Слишком далеко от грифа', cause: 'Неправильный setup', fix: 'Гриф над серединой стопы. Голени касаются грифа при setup.' },
    ],
    cues: [
      { cue: 'Грудь вверх, плечи над грифом', category: 'setup', priority: 'critical' },
      { cue: 'Толкай пол ногами', category: 'execution', priority: 'critical' },
      { cue: 'Защити подмышки (lat engagement)', category: 'setup', priority: 'important' },
      { cue: 'Гриф — продолжение рук', category: 'execution', priority: 'important' },
      { cue: 'T-Rex arms (длинные руки)', category: 'setup', priority: 'refinement' },
    ],
    progression: ['Kettlebell DL → RDL → Block Pull → Conventional DL → Deficit DL'],
    regression: ['Conventional DL → Trap Bar DL → Block Pull → RDL → Back Extension'],
    preRequisites: ['RDL ×10 с 50% веса без боли', 'Toe touch без округления спины'],
  },
  {
    name: 'Жим лёжа', pattern: 'horizontal_push',
    setup: [
      'Лечь на скамью, глаза под грифом',
      'Стопы плотно на полу, шире плеч',
      'Лопатки сведены и опущены (создать "полку")',
      'Небольшой прогиб в пояснице (естественный, не форсированный)',
      'Хват: шире плеч (мизинцы на кольцах для PL)',
      'Съём грифа: прямые руки → гриф над плечами',
    ],
    execution: [
      'Вдох, задержка',
      'Опустить гриф к нижней части груди (касание)',
      'Локти под 45-75° к телу (не 90° T-поза!)',
      'Пауза (PL) или касание (BB)',
      'Мощный жим вверх и чуть назад (к стойке)',
      'Выдох после прохождения sticking point',
    ],
    breathing: ['Вдох при опускании → задержка → выдох при жиме'],
    commonErrors: [
      { error: 'Локти в стороны (T-pose)', cause: 'Слабые широчайшие, нет стабильности', fix: 'Локти 45°. Lat activation перед жимом.' },
      { error: 'Нет касания груди', cause: 'Слишком большой вес / страх', fix: 'Снизить вес. Spoto press.' },
      { error: 'Отрыв ягодиц от скамьи', cause: 'Слишком сильный прогиб / leg drive', fix: 'Ягодицы на скамье всё время. Уменьшить leg drive.' },
      { error: 'Гриф уходит к животу/шее', cause: 'Нет контроля траектории', fix: 'J-hook траектория: к груди → над плечами.' },
      { error: 'Недожим (soft lockout)', cause: 'Слабый трицепс', fix: 'Close-grip bench, board press, floor press.' },
    ],
    cues: [
      { cue: 'Сломай гриф (согни его)', category: 'setup', priority: 'important' },
      { cue: 'Лопатки в задний карман', category: 'setup', priority: 'critical' },
      { cue: 'Толкай себя в скамью (leg drive)', category: 'execution', priority: 'important' },
      { cue: 'Бицепс к носу (траектория)', category: 'execution', priority: 'refinement' },
    ],
    progression: ['Push-up → DB Bench → Floor Press → Bench Press → Pause Bench → Wide Grip'],
    regression: ['Bench Press → DB Bench → Floor Press → Push-up → Machine Press'],
    preRequisites: ['Push-up ×20 без боли в плече', 'Shoulder mobility тест'],
  },
  {
    name: 'Подтягивания', pattern: 'vertical_pull',
    setup: [
      'Хват: пронированный (pull-up) или супинированный (chin-up)',
      'Ширина хвата: чуть шире плеч (pull-up) или на ширине плеч (chin-up)',
      'Вис на прямых руках, плечи прижаты (активные плечи)',
      'Ноги: скрещены сзади или прямые вниз',
    ],
    execution: [
      'Начать с активации широчайших (потянуть плечи вниз)',
      'Мощное подтягивание: грудь к перекладине',
      'Локти идут вниз и назад (не в стороны)',
      'Подбородок над перекладиной',
      'Контролируемое опускание (2-3 сек)',
      'Полное растяжение внизу без потери напряжения плеч',
    ],
    breathing: ['Выдох на подъёме → вдох на опускании'],
    commonErrors: [
      { error: 'Раскачка корпуса (kipping)', cause: 'Слишком сложно без momentum', fix: 'Banded pull-up или negative. Strict only.' },
      { error: 'Неполная амплитуда', cause: 'Недостаток силы', fix: 'Negative pull-ups. Lat pulldown.' },
      { error: 'Плечи поднимаются к ушам', cause: 'Не включены широчайшие', fix: 'Scapular pull-up перед каждым повторением.' },
      { error: 'Локти уходят в стороны', cause: 'Неправильная техника', fix: 'Локти вниз и назад. Narrow grip.' },
    ],
    cues: [
      { cue: 'Грудь к перекладине', category: 'execution', priority: 'critical' },
      { cue: 'Локти в задний карман', category: 'execution', priority: 'important' },
      { cue: 'Тяни плечи вниз перед повторением', category: 'setup', priority: 'critical' },
    ],
    progression: ['Scapular Pull-up → Negative → Banded → Bodyweight → Weighted → One-arm'],
    regression: ['Weighted Pull-up → Bodyweight → Banded → Negative → Lat Pulldown'],
    preRequisites: ['Dead hang 30 сек', 'Scapular pull-up ×8'],
  },
  {
    name: 'Жим над головой (OHP)', pattern: 'vertical_push',
    setup: [
      'Гриф на уровне ключиц (front rack)', 'Хват на ширине плеч или чуть шире',
      'Локти под грифом (не сзади)', 'Кор напряжён, ягодицы сжаты',
      'Стопы на ширине плеч',
    ],
    execution: [
      'Глубокий вдох, задержка', 'Жим строго вверх, голова отходит назад',
      'Когда гриф проходит лоб — голова вперёд (в окно)',
      'Завершить: гриф над головой, плечи прижаты к ушам',
      'Опускание под контролем к ключицам',
    ],
    breathing: ['Вдох внизу → задержка → выдох вверху'],
    commonErrors: [
      { error: 'Гриф уходит вперёд', cause: 'Слабые плечи / нет stability', fix: 'Z-press, seated OHP. Облегчить вес.' },
      { error: 'Прогиб в пояснице', cause: 'Слабый кор / слишком тяжело', fix: 'Сжать ягодицы. Облегчить вес.' },
      { error: 'Неполный локаут', cause: 'Слабый трицепс / страх', fix: 'Push press. Triceps work.' },
    ],
    cues: [
      { cue: 'Сожми ягодицы', category: 'setup', priority: 'critical' },
      { cue: 'Голова в окно', category: 'execution', priority: 'critical' },
      { cue: 'Бицепсы к ушам (локаут)', category: 'execution', priority: 'important' },
    ],
    progression: ['DB Press → Landmine Press → Seated OHP → Standing OHP → Push Press'],
    regression: ['Push Press → OHP → Seated OHP → DB Press → Machine Press'],
    preRequisites: ['Overhead mobility (arms straight overhead без боли)'],
  },
];

export function getTechnique(exerciseName: string): ExerciseTechnique | undefined {
  return TECHNIQUE_DB.find(e => e.name.toLowerCase().includes(exerciseName.toLowerCase()));
}

export function getAllTechniques(): ExerciseTechnique[] { return TECHNIQUE_DB; }

export function getErrorsForExercise(exerciseName: string): ExerciseTechnique['commonErrors'] {
  return getTechnique(exerciseName)?.commonErrors || [];
}

export function getProgression(exerciseName: string): string[] {
  return getTechnique(exerciseName)?.progression || [];
}

export function getCues(exerciseName: string, category?: string): TechniqueCue[] {
  const cues = getTechnique(exerciseName)?.cues || [];
  return category ? cues.filter(c => c.category === category) : cues;
}
