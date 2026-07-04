/**
 * Genetic Profile + Exercise Technique Library
 *
 * Genetic Profile: how genes affect training, nutrition, recovery, injury risk
 * Exercise Technique: 30+ exercises with cues, errors, fixes, progression
 *
 * Deload-логика вынесена в `deload-engine.ts` (реэкспортируется для обратной совместимости).
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

// Deload-функции вынесены в deload-engine.ts, реэкспорт для обратной совместимости:
export { generateDeload, getDeloadChecklist, type DeloadInput, type DeloadProtocol } from './deload-engine';

// ═══════════════════════════════════════════════════════════════════════════
// 2. Exercise Technique Library
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

  // ═══════════════════════ ГРУДЬ ═══════════════════════
  {
    name: 'Жим гантелей лёжа', pattern: 'horizontal_push',
    setup: ['Сесть на край скамьи, гантели на коленях', 'Лечь, гантели на уровне груди, локти под 45-60°', 'Стопы плотно на полу, лопатки сведены', 'Небольшой естественный прогиб в пояснице'],
    execution: ['Мощный жим вверх по J-траектории', 'Вверху гантели почти касаются друг друга (над плечами)', 'Контролируемое опускание до глубокого растяжения', 'Локти не уходят в стороны (T-pose) — держать 45-60°', 'Внизу растяжение грудных 1с — взрыв вверх'],
    breathing: ['Вдох при опускании → выдох при жиме → задержка внизу для растяжения'],
    commonErrors: [
      { error: 'Гантели стукаются вверху', cause: 'Слишком сильный жим без контроля', fix: 'Останавливать за 2-3 см до касания. Напрягать грудь вверху.' },
      { error: 'Локти в стороны (T-pose)', cause: 'Слабые широчайшие / мало контроля', fix: 'Держать локти под 45-60°. Представить "сломай гантель пополам".' },
      { error: 'Неравномерный жим (одна рука отстаёт)', cause: 'Дисбаланс силы', fix: 'Начинать жим со слабой руки. Unilateral work.' },
      { error: 'Сокращение амплитуды', cause: 'Слишком большой вес', fix: 'Снизить вес. Полное растяжение внизу — гантели касаются груди (или близко).' },
    ],
    cues: [
      { cue: 'Растяни грудь внизу', category: 'execution', priority: 'critical' },
      { cue: 'Сведи гантели вверху', category: 'execution', priority: 'important' },
      { cue: 'Локти 45°, не T-pose', category: 'setup', priority: 'critical' },
    ],
    progression: ['Жим гантелей лёжа → Жим гантелей на наклонной → Жим гантелей с паузой внизу'],
    regression: ['Жим гантелей лёжа → Жим в тренажёре → Отжимания → Жим лёгких гантелей'],
    preRequisites: ['Отжимания ×15 без боли в плече'],
  },
  {
    name: 'Жим на наклонной скамье', pattern: 'horizontal_push',
    setup: ['Угол скамьи 30-45° (не больше!)', 'Гриф над глазами в стойке', 'Лопатки сведены, стопы плотно на полу', 'Хват чуть шире плеч'],
    execution: ['Съём грифа, опускание к верхней части груди (ключицы)', 'Локти под 45-60° к телу', 'Касание верха груди → мощный жим вверх', 'Траектория: немного назад (к стойке) вверху'],
    breathing: ['Вдох при опускании → задержка → выдох при прохождении sticking point'],
    commonErrors: [
      { error: 'Угол скамьи >45°', cause: 'Неправильная настройка скамьи', fix: '30-45° максимум. При большем угле нагрузка уходит в передние дельты.' },
      { error: 'Гриф опускается слишком высоко (к шее)', cause: 'Неправильная траектория', fix: 'Опускать к верхней части груди, не к ключицам. Контролируемая траектория.' },
      { error: 'Отрыв ягодиц', cause: 'Слишком тяжёлый вес / сильный leg drive', fix: 'Ягодицы на скамье. Умеренный leg drive.' },
    ],
    cues: [
      { cue: 'Угол 30-45°', category: 'setup', priority: 'critical' },
      { cue: 'Гриф к верху груди', category: 'execution', priority: 'critical' },
      { cue: 'Локти 45°', category: 'execution', priority: 'important' },
    ],
    progression: ['Жим на наклонной (пустой гриф) → Рабочий вес → Жим с паузой'],
    regression: ['Жим на наклонной → Жим гантелей на наклонной → Жим в Смите на наклонной'],
    preRequisites: ['Жим лёжа с правильной техникой'],
  },
  {
    name: 'Отжимания на брусьях', pattern: 'horizontal_push',
    setup: ['Хват на ширине плеч (или чуть шире)', 'Прямые руки вверху, плечи опущены (active shoulders)', 'Ноги скрещены сзади или прямые вниз', 'Торс слегка наклонён вперёд (для акцента на грудь)'],
    execution: ['Контролируемое опускание: локти уходят в стороны (не назад)', 'Плечо опускается ниже локтя (глубокое растяжение)', 'Мощный подъём вверх, не блокируя локти полностью вверху', 'Грудь "колесом", лопатки сведены'],
    breathing: ['Вдох при опускании → выдох при подъёме'],
    commonErrors: [
      { error: 'Неполная амплитуда', cause: 'Недостаток силы', fix: 'Band-assisted dips или negative dips. Глубина: плечо ниже локтя.' },
      { error: 'Плечи поднимаются к ушам', cause: 'Не включены широчайшие', fix: 'Активно давить плечами вниз перед каждым повтором. Scapular depression.' },
      { error: 'Слишком вертикальный торс (трицепсовый стиль)', cause: 'Нет наклона вперёд', fix: 'Наклон 15-30° вперёд для акцента на грудь.' },
      { error: 'Боль в плече', cause: 'Избыточная глубина / неправильный угол', fix: 'Ограничить глубину до комфортной. Укрепить ротаторную манжету.' },
    ],
    cues: [
      { cue: 'Наклон вперёд (грудной стиль)', category: 'execution', priority: 'critical' },
      { cue: 'Плечи вниз (active shoulders)', category: 'setup', priority: 'critical' },
      { cue: 'Глубокое растяжение', category: 'execution', priority: 'important' },
    ],
    progression: ['Bench dips → Band-assisted dips → Bodyweight dips → Weighted dips'],
    regression: ['Weighted dips → Bodyweight dips → Band-assisted dips → Negative dips'],
    preRequisites: ['Push-ups ×20', 'Без боли в плече при отжиманиях'],
  },

  // ═══════════════════════ СПИНА ═══════════════════════
  {
    name: 'Тяга штанги в наклоне', pattern: 'horizontal_pull',
    setup: ['Стопы на ширине плеч, гриф на полу', 'Наклон 45-60° (почти параллельно полу)', 'Хват чуть шире плеч (пронированный)', 'Спина прямая, поясница в нейтральном положении', 'Колени мягкие (чуть согнуты)'],
    execution: ['Мощная тяга грифа к нижней части живота (пояс)', 'Локти идут вдоль тела (не в стороны)', 'Сведение лопаток в верхней точке', 'Контролируемое опускание до полного растяжения широчайших', 'Корпус неподвижен — работает только спина и руки'],
    breathing: ['Вдох перед тягой → выдох в верхней точке → вдох при опускании'],
    commonErrors: [
      { error: 'Округление спины', cause: 'Слабый кор / слишком большой вес', fix: 'Снизить вес. Грудь вверх, спина прямая. Chest-supported row.' },
      { error: 'Рывки и читинг', cause: 'Слишком большой вес', fix: 'Контролируемое движение. Использовать 70-80% от 1RM.' },
      { error: 'Тяга к груди (не к поясу)', cause: 'Неправильная траектория', fix: 'Тянуть к низу живота. Локти вдоль тела.' },
      { error: 'Локти в стороны', cause: 'Слишком широкий хват', fix: 'Хват чуть шире плеч. Локти идут вдоль корпуса.' },
    ],
    cues: [
      { cue: 'Спина прямая, грудь вверх', category: 'setup', priority: 'critical' },
      { cue: 'Тяни к поясу (не к груди)', category: 'execution', priority: 'critical' },
      { cue: 'Сведи лопатки вверху', category: 'execution', priority: 'important' },
    ],
    progression: ['Тяга гантелей в наклоне → Тяга штанги в наклоне → Тяга Т-грифа → Pendlay Row'],
    regression: ['Тяга штанги → Тяга с опорой грудью (Chest-supported) → Тяга нижнего блока сидя'],
    preRequisites: ['Romanian deadlift ×10 с 50% веса', 'Планка 60с'],
  },
  {
    name: 'Тяга верхнего блока', pattern: 'vertical_pull',
    setup: ['Сидя, бёдра зафиксированы валиком', 'Хват широкий (пронированный), чуть шире плеч', 'Торс вертикально или с лёгким отклонением назад', 'Плечи вверх (пассивный вис)'],
    execution: ['Начать с активации широчайших (потянуть плечи вниз)', 'Мощная тяга к верхней части груди', 'Локти идут вниз и назад', 'Лёгкий прогиб в грудном отделе в нижней точке', 'Контролируемое возвращение в исходное положение'],
    breathing: ['Выдох при тяге → вдох при возврате'],
    commonErrors: [
      { error: 'Рывки и инерция', cause: 'Слишком большой вес', fix: 'Плавное контролируемое движение. Вес, при котором можно сделать 8-12 чистых повторов.' },
      { error: 'Тяга за голову', cause: 'Опасная техника', fix: 'Тянуть к груди (к ключицам). Тяга за голову — риск импинджмента.' },
      { error: 'Отклонение назад >15°', cause: 'Читинг спиной', fix: 'Держать торс почти вертикально. Лёгкий наклон допустим.' },
    ],
    cues: [
      { cue: 'Грудь к перекладине', category: 'execution', priority: 'critical' },
      { cue: 'Локти вниз и назад', category: 'execution', priority: 'important' },
      { cue: 'Плавно, без рывков', category: 'execution', priority: 'important' },
    ],
    progression: ['Тяга верхнего блока → Широким хватом → За голову (осторожно) → Тяга с V-рукоятью'],
    regression: ['Тяга верхнего блока → Straight-arm pulldown → Лёгкий вес'],
    preRequisites: ['Мобильность плеч без боли над головой'],
  },
  {
    name: 'Тяга Т-грифа', pattern: 'horizontal_pull',
    setup: ['Гриф зафиксирован в углу или в стойке', 'Сесть в наклон над грифом, спина прямая', 'Хват: V-рукоять или узкий пронированный', 'Колени мягкие, корпус почти параллельно полу'],
    execution: ['Мощная тяга к нижней части груди', 'Локти идут вдоль тела', 'Сведение лопаток и задержка 1с вверху', 'Медленное контролируемое опускание до полного растяжения'],
    breathing: ['Выдох при тяге → вдох при опускании'],
    commonErrors: [
      { error: 'Округление спины', cause: 'Слабый кор / усталость', fix: 'Снизить вес. Грудь вверх. Укрепить разгибатели спины.' },
      { error: 'Рывки', cause: 'Слишком большой вес', fix: 'Контролируемое движение. 2-1-2-0 темп.' },
    ],
    cues: [
      { cue: 'Грудь вверх', category: 'setup', priority: 'critical' },
      { cue: 'Сведи лопатки', category: 'execution', priority: 'critical' },
    ],
    progression: ['Seated cable row → Chest-supported row → T-bar row → Barbell row'],
    regression: ['T-bar row → Chest-supported row → Seated cable row'],
    preRequisites: ['Seated row ×10 с правильной техникой'],
  },
  {
    name: 'Тяга нижнего блока сидя', pattern: 'horizontal_pull',
    setup: ['Сидя, ноги на платформе, колени мягкие', 'Взяться за V-рукоять (или прямую)', 'Торс вертикально, плечи вперёд (растяжение)', 'Грудь вперёд, лопатки разведены'],
    execution: ['Начать с движения лопаток (свести их)', 'Мощная тяга к животу, локти вдоль тела', 'Задержка 1-2с в пиковом сокращении', 'Медленное возвращение (растяжение широчайших)', 'Торс неподвижен — работает только спина и руки'],
    breathing: ['Выдох при тяге → вдох при возврате'],
    commonErrors: [
      { error: 'Раскачка корпуса', cause: 'Слишком большой вес', fix: 'Зафиксировать корпус. Снизить вес. Использовать лямки для фокуса на спине.' },
      { error: 'Нет полного растяжения', cause: 'Неполная амплитуда', fix: 'Позволить плечам уйти вперёд в растяжение перед каждым повтором.' },
    ],
    cues: [
      { cue: 'Сведи лопатки первыми', category: 'execution', priority: 'critical' },
      { cue: 'Пауза 1-2с в пике', category: 'execution', priority: 'important' },
      { cue: 'Растяни широчайшие вперёд', category: 'setup', priority: 'important' },
    ],
    progression: ['Seated row → Close-grip → Wide-grip → Single-arm'],
    regression: ['Seated row → Лёгкий вес → Straight-arm pulldown'],
    preRequisites: ['Без боли в пояснице при тяговых движениях'],
  },
  {
    name: 'Подтягивания обратным хватом', pattern: 'vertical_pull',
    setup: ['Хват супинированный (ладони к себе) на ширине плеч', 'Вис на прямых руках, активные плечи', 'Грудь вверх, взгляд вперёд'],
    execution: ['Активация широчайших → тяга вверх', 'Локти идут вниз и назад', 'Подбородок над перекладиной', 'Контролируемое опускание 2-3с', 'Полное растяжение внизу'],
    breathing: ['Выдох на подъёме → вдох на опускании'],
    commonErrors: [
      { error: 'Раскачка (kipping)', cause: 'Недостаток силы', fix: 'Strict only. Band-assisted. Negative chin-ups.' },
      { error: 'Неполная амплитуда (chin over bar?)', cause: 'Слабый бицепс', fix: 'Negative chin-ups. Подтягиваться до касания грудью (если возможно).' },
    ],
    cues: [
      { cue: 'Грудь к перекладине', category: 'execution', priority: 'critical' },
      { cue: 'Локти вниз', category: 'execution', priority: 'important' },
    ],
    progression: ['Negative chin-up → Band-assisted → Bodyweight → Weighted chin-up'],
    regression: ['Weighted chin-up → Bodyweight → Band-assisted → Lat pulldown (supinated)'],
    preRequisites: ['Dead hang 30с', 'Scapular pull-up ×8'],
  },
  {
    name: 'Румынская тяга', pattern: 'hinge',
    setup: ['Стопы на ширине бёдер, гриф в руках (хват на ширине плеч)', 'Гриф касается бёдер, колени мягкие (чуть согнуты)', 'Грудь вверх, спина прямая, плечи назад'],
    execution: ['Таз назад (как закрывать дверь ягодицами)', 'Гриф скользит по бёдрам и голеням', 'Спина прямая всё время (нейтральный позвоночник)', 'Опускание до ощущения растяжения в бицепсе бедра (гриф ~середина голени)', 'Мощное возвращение: таз вперёд + ягодицы'],
    breathing: ['Вдох при опускании → выдох при подъёме'],
    commonErrors: [
      { error: 'Округление спины', cause: 'Слабый кор / слишком глубоко', fix: 'Ограничить глубину до начала округления. Грудь вверх.' },
      { error: 'Сгибание коленей (превращение в тягу)', cause: 'Неправильная техника', fix: 'Колени фиксированы (мягкие). Движение ТОЛЬКО в тазобедренном суставе.' },
      { error: 'Гриф уходит от ног', cause: 'Не включены широчайшие', fix: 'Прижимать гриф к ногам. Lat engagement.' },
    ],
    cues: [
      { cue: 'Таз назад (дверь ягодицами)', category: 'execution', priority: 'critical' },
      { cue: 'Гриф скользит по ногам', category: 'execution', priority: 'critical' },
      { cue: 'Колени мягкие, не сгибать', category: 'setup', priority: 'critical' },
    ],
    progression: ['DB RDL → Barbell RDL → Single-leg RDL → Deficit RDL'],
    regression: ['Barbell RDL → DB RDL → Cable pull-through → Back extension'],
    preRequisites: ['Toe touch без округления спины', 'Планка 45с'],
  },
  {
    name: 'Face Pull', pattern: 'horizontal_pull',
    setup: ['Блок на уровне лица (или чуть выше)', 'Взяться за верёвочную рукоять (концы)', 'Отойти на 1-2 шага, натянуть трос', 'Стопы на ширине плеч, корпус вертикально'],
    execution: ['Тяга к лицу: локти высоко и в стороны', 'Внешнее вращение плеч в конечной точке', 'Кисти над локтями в конечной позиции', 'Задержка 1-2с в пике', 'Медленное возвращение'],
    breathing: ['Выдох при тяге → вдох при возврате'],
    commonErrors: [
      { error: 'Тяга к груди (не к лицу)', cause: 'Слишком низкий блок', fix: 'Блок на уровне лба. Тянуть к лицу (между глаз и подбородком).' },
      { error: 'Локти вниз', cause: 'Неправильная техника', fix: 'Локти высоко — на уровне плеч или выше. Внешнее вращение.' },
      { error: 'Слишком большой вес', cause: 'Эго', fix: 'Лёгкий вес, высокие повторения (15-20). Акцент на ротаторную манжету.' },
    ],
    cues: [
      { cue: 'Тяни к лицу', category: 'execution', priority: 'critical' },
      { cue: 'Локти выше кистей', category: 'execution', priority: 'critical' },
      { cue: 'Внешнее вращение', category: 'execution', priority: 'important' },
    ],
    progression: ['Band pull-apart → Face pull (лёгкий) → Face pull (рабочий) → Single-arm face pull'],
    regression: ['Face pull → Band pull-apart → Лёгкая резинка'],
    preRequisites: ['Без боли в плече при внешнем вращении'],
  },

  // ═══════════════════════ НОГИ ═══════════════════════
  {
    name: 'Фронтальный присед', pattern: 'squat',
    setup: ['Гриф на передних дельтах (не на ключицах!)', 'Руки скрещены (cross-arm) или чистый хват (rack position)', 'Локти высоко (параллельно полу)', 'Стопы на ширине плеч, носки чуть наружу'],
    execution: ['Вдох в живот, задержка', 'Вертикальное опускание (торс вертикально)', 'Колени по линии стоп', 'Бёдра ниже параллели', 'Мощный подъём, ведя локтями вверх'],
    breathing: ['Вдох вверху → задержка → выдох после sticking point'],
    commonErrors: [
      { error: 'Локти падают (гриф скатывается)', cause: 'Недостаточная мобильность запястий/плеч', fix: 'Cross-arm grip. Мобильность: растяжка lat/triceps.' },
      { error: 'Наклон вперёд', cause: 'Слабые квадрицепсы / кор', fix: 'Goblet squat. Думать "локти вверх". Снизить вес.' },
      { error: 'Гриф давит на горло', cause: 'Неправильная позиция', fix: 'Гриф на передних дельтах, не на ключицах.' },
    ],
    cues: [
      { cue: 'Локти вверх', category: 'setup', priority: 'critical' },
      { cue: 'Торс вертикально', category: 'execution', priority: 'critical' },
      { cue: 'Колени наружу', category: 'execution', priority: 'important' },
    ],
    progression: ['Goblet Squat → Front Squat (пустой гриф) → Front Squat (рабочий) → Zombie Squat'],
    regression: ['Front Squat → Goblet Squat → Leg Press → Bodyweight squat'],
    preRequisites: ['Goblet squat ×10 с правильной техникой'],
  },
  {
    name: 'Болгарские сплит-приседы', pattern: 'squat',
    setup: ['Задняя нога на скамье (высота 30-40см), носок на скамье', 'Передняя нога в 60-80см от скамьи', 'Торс вертикально, гантели в руках (или гиря у груди)', 'Вес на передней ноге (не на задней!)'],
    execution: ['Контролируемое опускание: переднее колено сгибается до 90°', 'Колено не уходит далеко вперёд носка', 'Заднее колено почти касается пола', 'Мощный подъём через пятку передней ноги', 'Торс вертикально всё движение'],
    breathing: ['Вдох при опускании → выдох при подъёме'],
    commonErrors: [
      { error: 'Колено уходит вперёд носка', cause: 'Неправильная постановка ног', fix: 'Отставить переднюю ногу дальше от скамьи. Голень вертикально.' },
      { error: 'Вес на задней ноге', cause: 'Неправильная техника', fix: '~80% веса на передней ноге. Задняя нога только для баланса.' },
      { error: 'Наклон вперёд', cause: 'Слабый кор', fix: 'Goblet hold помогает держать торс вертикально.' },
    ],
    cues: [
      { cue: 'Вес на передней ноге', category: 'execution', priority: 'critical' },
      { cue: 'Пятка прижата', category: 'execution', priority: 'important' },
      { cue: 'Торс вертикально', category: 'setup', priority: 'important' },
    ],
    progression: ['Bodyweight split squat → Goblet → DB → Barbell Bulgarian'],
    regression: ['Bulgarian → Split squat (без скамьи) → Leg press (single-leg) → Step-up'],
    preRequisites: ['Walking lunge ×10 на каждую ногу с правильной техникой'],
  },
  {
    name: 'Жим ногами', pattern: 'squat',
    setup: ['Спина и таз плотно прижаты к сиденью', 'Стопы на платформе на ширине плеч (или чуть шире)', 'Носки чуть наружу', 'Угол в коленях ~90° в исходном положении (ручки безопасности сняты)'],
    execution: ['Контролируемое опускание: колени к груди', 'Поясница прижата (не отрывается!)', 'Колени по линии стоп', 'Опускание до 90° в коленях (или глубже, если позволяет мобильность)', 'Мощный жим, не блокируя колени полностью вверху'],
    breathing: ['Вдох при опускании → выдох при жиме'],
    commonErrors: [
      { error: 'Отрыв поясницы (butt wink)', cause: 'Слишком глубокая амплитуда / недостаток мобильности', fix: 'Ограничить глубину. Руками держаться за ручки для фиксации таза.' },
      { error: 'Колени заваливаются внутрь', cause: 'Слабые отводящие бедра', fix: 'Banded work. Думать "колени наружу". Резинка на коленях.' },
      { error: 'Полное выпрямление коленей', cause: 'Опасная техника', fix: 'Не блокировать колени вверху. Оставлять 5-10° сгибания.' },
    ],
    cues: [
      { cue: 'Поясница прижата', category: 'setup', priority: 'critical' },
      { cue: 'Колени по линии стоп', category: 'execution', priority: 'critical' },
      { cue: 'Не блокировать колени', category: 'execution', priority: 'important' },
    ],
    progression: ['Leg press (лёгкий) → Рабочий → Single-leg → High foot placement (glute focus)'],
    regression: ['Leg press → Goblet squat → Bodyweight squat'],
    preRequisites: ['Bodyweight squat ×20 с правильной техникой'],
  },
  {
    name: 'Ягодичный мост со штангой', pattern: 'hinge',
    setup: ['Сесть на пол, лопатки на край скамьи', 'Гриф на таз (использовать подушку/свернутый коврик!)', 'Стопы на ширине плеч, голень вертикально', 'Подбородок прижат к груди'],
    execution: ['Мощный подъём таза вверх', 'Бёдра полностью разогнуты (прямая линия плечи-колени)', 'Колени под 90° в верхней точке', 'Задержка 1-2с в верхней точке (сжать ягодицы)', 'Контролируемое опускание (таз не касается пола)'],
    breathing: ['Выдох при подъёме → вдох при опускании'],
    commonErrors: [
      { error: 'Гиперэкстензия поясницы', cause: 'Слишком высокий подъём / слабые ягодицы', fix: 'Остановиться на прямой линии плечи-колени. Задний наклон таза.' },
      { error: 'Давление грифа на таз', cause: 'Нет подушки', fix: 'Использовать pad/свернутый коврик. Не терпеть боль.' },
      { error: 'Стопы далеко от таза', cause: 'Неправильная постановка', fix: 'Голень вертикально в верхней точке. Подвинуть стопы ближе.' },
    ],
    cues: [
      { cue: 'Сжать ягодицы вверху', category: 'execution', priority: 'critical' },
      { cue: 'Подбородок прижат', category: 'setup', priority: 'critical' },
      { cue: 'Голень вертикально', category: 'setup', priority: 'important' },
    ],
    progression: ['Glute bridge → Single-leg bridge → Barbell hip thrust → Banded hip thrust'],
    regression: ['Barbell hip thrust → DB hip thrust → Glute bridge → Single-leg bridge'],
    preRequisites: ['Glute bridge ×20 с активацией ягодиц'],
  },
  {
    name: 'Кубковый присед', pattern: 'squat',
    setup: ['Гантель/гиря вертикально у груди (обеими руками)', 'Локти между колен', 'Стопы на ширине плеч, носки чуть наружу'],
    execution: ['Вертикальное опускание: торс прямо', 'Локти касаются внутренней стороны колен', 'Бёдра ниже параллели', 'Мощный подъём через пятки'],
    breathing: ['Вдох при опускании → выдох при подъёме'],
    commonErrors: [
      { error: 'Наклон вперёд', cause: 'Слабый кор', fix: 'Держать гантель близко к груди. Грудь вверх.' },
      { error: 'Колени заваливаются', cause: 'Слабые отводящие', fix: 'Разводить колени локтями. Banded squat.' },
    ],
    cues: [
      { cue: 'Локти между колен', category: 'execution', priority: 'critical' },
      { cue: 'Грудь вверх', category: 'setup', priority: 'critical' },
    ],
    progression: ['Bodyweight squat → Goblet squat → Double KB front squat → Barbell front squat'],
    regression: ['Goblet squat → Bodyweight squat → Box squat'],
    preRequisites: ['Bodyweight squat ×20 без боли'],
  },
  {
    name: 'Выпады с гантелями', pattern: 'squat',
    setup: ['Гантели в опущенных руках', 'Стопы на ширине бёдер', 'Грудь вверх, плечи назад'],
    execution: ['Шаг вперёд (длина шага: голень вертикально в нижней точке)', 'Заднее колено почти касается пола', 'Переднее колено над стопой (не уходит вперёд)', 'Мощный толчок передней ногой → возврат в исходное', 'Чередовать ноги или все повторы на одну'],
    breathing: ['Вдох при опускании → выдох при подъёме'],
    commonErrors: [
      { error: 'Колено уходит вперёд носка', cause: 'Слишком короткий шаг', fix: 'Удлинить шаг. Голень вертикально.' },
      { error: 'Наклон вперёд', cause: 'Слабый кор', fix: 'Грудь вверх. Взгляд вперёд.' },
    ],
    cues: [
      { cue: 'Шаг: голень вертикально', category: 'execution', priority: 'critical' },
      { cue: 'Толчок передней ногой', category: 'execution', priority: 'important' },
    ],
    progression: ['Bodyweight lunge → DB lunge → Walking lunge → Barbell lunge'],
    regression: ['DB lunge → Bodyweight lunge → Split squat (статичный) → Step-up'],
    preRequisites: ['Bodyweight lunge ×10 на каждую ногу'],
  },

  // ═══════════════════════ ПЛЕЧИ ═══════════════════════
  {
    name: 'Махи гантелями в стороны', pattern: 'vertical_push',
    setup: ['Гантели в опущенных руках, ладони к бёдрам', 'Лёгкий наклон корпуса вперёд (5-10°)', 'Мягкие локти (чуть согнуты, зафиксированы)', 'Плечи опущены (не к ушам)'],
    execution: ['Подъём гантелей в стороны до уровня плеч (не выше!)', 'Мизинец чуть выше большого пальца (как наливать воду из кувшина)', 'Задержка 1с в верхней точке', 'Медленное опускание (2-3с негатив)', 'НЕ использовать инерцию корпуса'],
    breathing: ['Выдох при подъёме → вдох при опускании'],
    commonErrors: [
      { error: 'Подъём выше плеч', cause: 'Слишком большой вес', fix: 'До уровня плеч. Выше — включаются трапеции. Снизить вес.' },
      { error: 'Раскачка корпуса (читинг)', cause: 'Слишком большой вес', fix: 'Лёгкий вес. Высокие повторения (12-20). Контролируемое движение.' },
      { error: 'Плечи к ушам (shrug)', cause: 'Включаются трапеции', fix: 'Держать плечи опущенными. Думать "тяни гантели в стороны, не вверх".' },
      { error: 'Слишком быстрый негатив', cause: 'Нет контроля', fix: 'Медленное опускание 2-3с. Негативная фаза = 50% роста.' },
    ],
    cues: [
      { cue: 'Мизинец вверх (кувшин)', category: 'execution', priority: 'critical' },
      { cue: 'Не выше плеч', category: 'execution', priority: 'critical' },
      { cue: 'Медленный негатив 2-3с', category: 'execution', priority: 'important' },
    ],
    progression: ['Лёгкие гантели (2-5кг) → Рабочий вес → Drop-set → Partials (lengthened)'],
    regression: ['Махи гантелями → Cable lateral → Machine lateral → Лёгкая резинка'],
    preRequisites: ['Мобильность плеч без боли при подъёме рук в стороны'],
  },
  {
    name: 'Жим Арнольда', pattern: 'vertical_push',
    setup: ['Сидя на скамье с опорой спины (85°), гантели на уровне плеч', 'Ладони к себе (супинированный хват) — стартовая позиция', 'Локти впереди корпуса'],
    execution: ['Жим вверх с одновременным разворотом ладоней наружу (пронация)', 'Вверху: ладони вперёд, гантели над плечами', 'Обратное движение: опускание с разворотом ладоней к себе', 'Полная амплитуда: гантели до уровня плеч внизу'],
    breathing: ['Выдох при жиме → вдох при опускании'],
    commonErrors: [
      { error: 'Слишком большой вес (нет контроля)', cause: 'Эго', fix: 'Лёгкий вес вначале. Техника > вес.' },
      { error: 'Неполный разворот', cause: 'Спешка', fix: 'Контролируемый разворот на 180° от начала до конца.' },
    ],
    cues: [
      { cue: 'Ладони к себе → от себя', category: 'execution', priority: 'critical' },
      { cue: 'Полный разворот 180°', category: 'execution', priority: 'important' },
    ],
    progression: ['DB press → Arnold press (лёгкий) → Arnold press (рабочий)'],
    regression: ['Arnold press → Seated DB press → Machine press'],
    preRequisites: ['Seated DB shoulder press ×10 с правильной техникой'],
  },
  {
    name: 'Тяга к подбородку', pattern: 'vertical_push',
    setup: ['Гриф в опущенных руках, хват уже ширины плеч', 'Ладони к себе (пронированный)', 'Грудь вверх, плечи назад'],
    execution: ['Тяга грифа вдоль тела до уровня ключиц', 'Локти идут вверх и в стороны', 'Гриф близко к телу всё движение', 'Пик: локти на уровне плеч (не выше!)', 'Медленное опускание'],
    breathing: ['Выдох при тяге → вдох при опускании'],
    commonErrors: [
      { error: 'Тяга выше ключиц', cause: 'Слишком высоко', fix: 'Остановиться на уровне ключиц. Выше — импинджмент плеча.' },
      { error: 'Слишком узкий хват (боль в запястьях)', cause: 'Неправильный хват', fix: 'Хват на ширине плеч или чуть шире. Не уже!' },
    ],
    cues: [
      { cue: 'Гриф близко к телу', category: 'execution', priority: 'important' },
      { cue: 'Локти до уровня плеч', category: 'execution', priority: 'critical' },
    ],
    progression: ['Лёгкий гриф → EZ-бар → Штанга → Wide grip upright row'],
    regression: ['Штанга → EZ-бар → Cable upright row → DB upright row'],
    preRequisites: ['Без боли в плече при подъёме рук'],
  },

  // ═══════════════════════ РУКИ ═══════════════════════
  {
    name: 'Сгибание рук со штангой', pattern: 'accessory',
    setup: ['Хват на ширине плеч (или чуть уже), ладони вперёд (супинированный)', 'Локти прижаты к бокам (неподвижны!)', 'Плечи назад, грудь вперёд'],
    execution: ['Сгибание: только предплечья двигаются (локти — шарниры)', 'Мощное сгибание до полного сокращения бицепса', 'Пиковое сокращение 1с вверху', 'Медленное опускание (2-3с негатив)', 'НЕ раскачивать корпус!'],
    breathing: ['Выдох при сгибании → вдох при опускании'],
    commonErrors: [
      { error: 'Раскачка корпуса (читинг)', cause: 'Слишком большой вес', fix: 'Снизить вес. Прижаться спиной к стене для контроля.' },
      { error: 'Локти уходят вперёд', cause: 'Включаются передние дельты', fix: 'Локти прижаты к бокам и НЕПОДВИЖНЫ. Представить "локти прибиты гвоздями".' },
      { error: 'Неполная амплитуда', cause: 'Слишком большой вес', fix: 'Снизить вес. Полное растяжение внизу, полное сокращение вверху.' },
    ],
    cues: [
      { cue: 'Локти прижаты — не двигаются', category: 'execution', priority: 'critical' },
      { cue: 'Медленный негатив 2-3с', category: 'execution', priority: 'important' },
      { cue: 'Пик 1с вверху', category: 'execution', priority: 'important' },
    ],
    progression: ['Лёгкий гриф → EZ-бар → Штанга → Cheat curl (продвинутый)'],
    regression: ['Штанга → EZ-бар → DB curl → Cable curl'],
    preRequisites: ['DB curl ×15 с правильной техникой'],
  },
  {
    name: 'Французский жим (разгибание рук лёжа)', pattern: 'accessory',
    setup: ['Лёжа на скамье, EZ-бар или гриф в руках', 'Руки перпендикулярно полу (прямые)', 'Хват узкий (на ширине плеч или уже)', 'Локти направлены вперёд (к ногам)'],
    execution: ['Сгибание в локтях: гриф опускается ко лбу (или за голову)', 'Локти неподвижны — двигаются ТОЛЬКО предплечья', 'Опускание до угла ~90° в локтях', 'Мощное разгибание до полного выпрямления'],
    breathing: ['Вдох при сгибании → выдох при разгибании'],
    commonErrors: [
      { error: 'Локти разъезжаются в стороны', cause: 'Нет контроля / усталость', fix: 'Держать локти узко. Представить "локти смотрят в потолок".' },
      { error: 'Опускание за голову (нагрузка на плечи)', cause: 'Избыточная амплитуда', fix: 'Опускать ко лбу (skull crusher) или за голову только если мобильность позволяет.' },
      { error: 'Блокировка локтей (гиперэкстензия)', cause: 'Слишком резкое разгибание', fix: 'Контролируемое разгибание. Мягкая блокировка вверху.' },
    ],
    cues: [
      { cue: 'Локти неподвижны и узко', category: 'execution', priority: 'critical' },
      { cue: 'Гриф ко лбу', category: 'execution', priority: 'important' },
    ],
    progression: ['DB skullcrusher → EZ-bar → Barbell → Decline skullcrusher'],
    regression: ['EZ-bar skullcrusher → DB skullcrusher → Cable pushdown → Band pushdown'],
    preRequisites: ['Без боли в локтях при разгибании'],
  },
  {
    name: 'Разгибание рук на блоке', pattern: 'accessory',
    setup: ['Блок верхний, прямая рукоять или верёвка', 'Локти прижаты к бокам (неподвижны)', 'Наклон корпуса вперёд 10-15°', 'Хват: ладони вниз (пронированный)'],
    execution: ['Разгибание ТОЛЬКО в локтях (плечи и корпус неподвижны)', 'Полное разгибание до выпрямления рук', 'Задержка 1с внизу (пиковое сокращение трицепса)', 'Медленное возвращение до 90° в локтях'],
    breathing: ['Выдох при разгибании → вдох при возврате'],
    commonErrors: [
      { error: 'Локти уходят вперёд/назад', cause: 'Слишком большой вес', fix: 'Локти прижаты к бокам. Снизить вес.' },
      { error: 'Наклон корпуса (читинг)', cause: 'Слишком большой вес', fix: 'Зафиксировать корпус. Использовать только трицепс.' },
    ],
    cues: [
      { cue: 'Локти прижаты — не двигаются', category: 'execution', priority: 'critical' },
      { cue: 'Пик внизу 1с', category: 'execution', priority: 'important' },
    ],
    progression: ['Лёгкий вес → Рабочий → Rope pushdown → Single-arm pushdown'],
    regression: ['Cable pushdown → Band pushdown → Лёгкий вес'],
    preRequisites: ['Без боли в локтях при разгибании'],
  },
  {
    name: 'Сгибание рук с гантелями (попеременное)', pattern: 'accessory',
    setup: ['Гантели в опущенных руках, ладони к бёдрам', 'Локти прижаты к бокам', 'Грудь вверх, плечи назад'],
    execution: ['Сгибание одной руки с супинацией (разворот ладони вверх)', 'Пиковое сокращение бицепса вверху', 'Медленное опускание (2-3с)', 'Повторить другой рукой'],
    breathing: ['Выдох при сгибании → вдох при опускании'],
    commonErrors: [
      { error: 'Нет супинации (ладони не разворачиваются)', cause: 'Неправильная техника', fix: 'Начинать с нейтрального хвата (ладони к бёдрам), заканчивать супинированным (ладони к плечам).' },
      { error: 'Раскачка', cause: 'Слишком большой вес', fix: 'Снизить вес. Сидя на скамье для контроля корпуса.' },
    ],
    cues: [
      { cue: 'Супинация (разворот ладони)', category: 'execution', priority: 'critical' },
      { cue: 'Пик 1с вверху', category: 'execution', priority: 'important' },
    ],
    progression: ['Лёгкие DB → Рабочие → Incline DB curl → Concentration curl'],
    regression: ['DB curl → Cable curl → Machine curl'],
    preRequisites: ['DB curl ×15 без читинга'],
  },
  {
    name: 'Молотковые сгибания', pattern: 'accessory',
    setup: ['Гантели в опущенных руках, нейтральный хват (ладони друг к другу)', 'Локти прижаты к бокам'],
    execution: ['Сгибание без супинации (ладони остаются друг к другу)', 'Движение как "забивание гвоздя молотком"', 'Пиковое сокращение вверху', 'Медленное опускание'],
    breathing: ['Выдох при сгибании → вдох при опускании'],
    commonErrors: [
      { error: 'Раскачка корпуса', cause: 'Слишком большой вес', fix: 'Снизить вес. Контролируемое движение.' },
    ],
    cues: [
      { cue: 'Молоток — ладони друг к другу', category: 'execution', priority: 'critical' },
      { cue: 'Локти прижаты', category: 'setup', priority: 'critical' },
    ],
    progression: ['Лёгкие DB → Рабочие → Rope hammer curl → Cross-body hammer curl'],
    regression: ['DB hammer curl → Cable hammer curl → Лёгкий вес'],
    preRequisites: ['DB curl ×15 без боли в запястьях'],
  },

  // ═══════════════════════ КОР ═══════════════════════
  {
    name: 'Подъём ног в висе', pattern: 'accessory',
    setup: ['Вис на перекладине, хват на ширине плеч', 'Плечи активные (не висим пассивно)', 'Ноги прямые вниз (или колени чуть согнуты для облегчения)'],
    execution: ['Контролируемый подъём ног до уровня пояса (или выше)', 'Таз немного подкручивается вперёд в верхней точке', 'Избегать раскачки — строгий подъём', 'Медленное опускание (без падения)'],
    breathing: ['Выдох при подъёме → вдох при опускании'],
    commonErrors: [
      { error: 'Раскачка корпуса', cause: 'Недостаток силы кора', fix: 'Строгий подъём без momentum. Согнуть колени для облегчения.' },
      { error: 'Неполная амплитуда', cause: 'Слабый кор', fix: 'Knee raise (колени к груди) вместо прямых ног. Постепенно выпрямлять.' },
      { error: 'Пассивный вис', cause: 'Не включены плечи', fix: 'Активные плечи (давить вниз). Не расслаблять плечевой пояс.' },
    ],
    cues: [
      { cue: 'Без раскачки', category: 'execution', priority: 'critical' },
      { cue: 'Активные плечи', category: 'setup', priority: 'important' },
    ],
    progression: ['Knee raise → Hanging leg raise (согнутые) → Straight leg raise → Toes to bar'],
    regression: ['Hanging leg raise → Lying leg raise → Knee raise (капитанский стул) → Crunch'],
    preRequisites: ['Dead hang 30с', 'Lying leg raise ×15'],
  },
  {
    name: 'Планка', pattern: 'accessory',
    setup: ['Локти под плечами, предплечья на полу', 'Ноги прямые, носки на полу', 'Тело — прямая линия от головы до пяток', 'Таз не провисает и не поднят'],
    execution: ['Удержание позиции', 'Кор напряжён (как перед ударом в живот)', 'Ягодицы сжаты', 'Дыхание ровное (не задерживать!)', 'Лопатки разведены (не сводить)'],
    breathing: ['Ровное дыхание: вдох 3с → выдох 3с'],
    commonErrors: [
      { error: 'Провисание таза', cause: 'Слабый кор', fix: 'Сжать ягодицы. Подтянуть таз вперёд (задний наклон).' },
      { error: 'Таз слишком высоко', cause: 'Неправильная техника', fix: 'Опустить таз до прямой линии. Проверить в зеркале.' },
      { error: 'Задержка дыхания', cause: 'Слишком сильное напряжение', fix: 'Дышать ровно. Считать вдох-выдох.' },
    ],
    cues: [
      { cue: 'Прямая линия (проверь в зеркале)', category: 'execution', priority: 'critical' },
      { cue: 'Сжать ягодицы', category: 'execution', priority: 'important' },
      { cue: 'Дыши ровно', category: 'breathing', priority: 'important' },
    ],
    progression: ['Plank 30с → 60с → 120с → Weighted plank → Single-arm plank'],
    regression: ['Plank → Plank на коленях → Dead bug'],
    preRequisites: ['Dead bug ×10 с контролем'],
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
