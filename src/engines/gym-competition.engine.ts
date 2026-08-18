/**
 * Gym Equipment + Plate Math + Competition Strategy + Recovery Protocols
 *
 * Gym Equipment DB: machine settings, seat positions, common mistakes
 * Plate Math: calculate plates needed for target weight, bar loading order
 * Competition Strategy: weight class selection, attempt picking, warmup room timing
 * Recovery Protocols: contrast therapy, active recovery, massage, compression
 * Mental Performance: pre-competition routine, focus techniques, arousal control
 *
 * @module gym-competition-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface GymMachine {
  name: string;
  type: string;
  settings: { name: string; options: string[] }[];
  tips: string[];
  commonMistakes: string[];
}

export interface PlateMathResult {
  targetWeight: number;
  barWeight: number;
  platesPerSide: { plate: number; count: number }[];
  totalPlates: number;
  actualWeight: number;
  deviation: number;
}

export interface CompetitionStrategy {
  weightClass: number;
  weightClassLimit: number;
  cuttingRequired: boolean;
  cuttingAmount: number;
  projectedTotal: number;
  projectedWilks: number;
  attemptStrategy: { lift: string; opener: string; second: string; third: string; warmupRoom: string }[];
  timeline: { time: string; action: string }[];
}

export interface RecoveryProtocol {
  name: string;
  type: 'contrast' | 'active' | 'massage' | 'compression' | 'stretching' | 'breathing';
  durationMin: number;
  instructions: string[];
  whenToUse: string;
  benefits: string[];
}

export interface MentalRoutine {
  name: string;
  steps: { action: string; duration: string; notes: string }[];
  whenToUse: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Gym Equipment Database
// ═══════════════════════════════════════════════════════════════════════════

const GYM_MACHINES: GymMachine[] = [
  {
    name: 'Leg Press (45-degree)',
    type: 'plate_loaded',
    settings: [
      { name: 'Seat angle', options: ['45°', 'Flat', 'Vertical'] },
      { name: 'Foot position', options: ['High (glutes)', 'Middle (quads)', 'Low (quads)', 'Wide (adductors)'] },
      { name: 'Safety stops', options: ['Engaged', 'Disengaged'] },
    ],
    tips: ['Поясница прижата к спинке', 'Не блокируйте колени вверху', 'Полная амплитуда без отрыва таза'],
    commonMistakes: ['Слишком тяжело → частичная амплитуда', 'Руки на коленях → срыв спины', 'Скорость → травма колена'],
  },
  {
    name: 'Leg Extension Machine',
    type: 'selectorized',
    settings: [
      { name: 'Seat depth', options: ['Forward', 'Middle', 'Back'] },
      { name: 'Ankle pad height', options: ['High', 'Low'] },
      { name: 'Backrest angle', options: ['90°', '100°', '110°'] },
    ],
    tips: ['Ось вращения совпадает с коленным суставом', 'Задержка вверху 1-2с', 'Контролируемая эксцентрика'],
    commonMistakes: ['Слишком быстрый темп', 'Неполное разгибание', 'Задержка дыхания'],
  },
  {
    name: 'Cable Crossover Station',
    type: 'cable',
    settings: [
      { name: 'Pulley height', options: ['High', 'Mid', 'Low'] },
      { name: 'Attachment', options: ['D-handle', 'Straight bar', 'Rope', 'Ankle strap'] },
      { name: 'Stance', options: ['Split', 'Parallel', 'Staggered'] },
    ],
    tips: ['Контролируйте обе фазы движения', 'Лёгкий наклон вперёд для груди', 'Сводите руки до касания'],
    commonMistakes: ['Слишком большой вес → рывки', 'Сгибание в локтях вместо движения плечом', 'Потеря натяжения троса'],
  },
  {
    name: 'Smith Machine',
    type: 'guided_barbell',
    settings: [
      { name: 'Safety stops', options: ['Set at chest', 'Set at parallel', 'Removed'] },
      { name: 'Bar path', options: ['Vertical', 'Slight angle 7°'] },
      { name: 'Hook position', options: ['High', 'Mid', 'Low'] },
    ],
    tips: ['Не заменяйте свободные веса полностью', 'Используйте для добивки/drop-set', 'Контролируйте амплитуду'],
    commonMistakes: ['Слишком большой вес из-за фиксации траектории', 'Игнорирование стабилизаторов', 'Неправильная постановка ног'],
  },
  {
    name: 'Lat Pulldown',
    type: 'selectorized',
    settings: [
      { name: 'Seat height', options: ['Высоко (ноги закреплены)', 'Средне'] },
      { name: 'Thigh pad', options: ['Зафиксирован', 'Свободен'] },
      { name: 'Grip', options: ['Широкий пронированный', 'Узкий параллельный', 'Обратный', 'V-bar'] },
    ],
    tips: ['Грудь к перекладине', 'Лопатки вниз и вместе', 'Без раскачки корпуса'],
    commonMistakes: ['Тяга за голову (риск импинджмента)', 'Слишком большой вес → читинг', 'Неполная амплитуда'],
  },
  {
    name: 'Pec Deck (Butterfly)',
    type: 'selectorized',
    settings: [
      { name: 'Seat height', options: ['Локти на уровне плеч', 'Выше плеч', 'Ниже плеч'] },
      { name: 'Arm pad position', options: ['Переднее', 'Среднее', 'Заднее'] },
    ],
    tips: ['Локти чуть согнуты', 'Сводите руки до касания', 'Медленная эксцентрика 3-4с'],
    commonMistakes: ['Полное выпрямление рук', 'Слишком быстрый темп', 'Подъём плеч'],
  },
  {
    name: 'Hack Squat Machine',
    type: 'plate_loaded',
    settings: [
      { name: 'Foot position', options: ['High (glutes/hamstrings)', 'Mid (quads)', 'Low (quads)', 'Narrow', 'Wide'] },
      { name: 'Shoulder pads', options: ['Standard', 'Thick'] },
      { name: 'Safety', options: ['Set at parallel', 'Bottom'] },
    ],
    tips: ['Спина прижата к подушке', 'Колени по линии стоп', 'Глубина: бёдра параллельно или ниже'],
    commonMistakes: ['Слишком тяжело → полуприсед', 'Отрыв пяток', 'Блокировка коленей'],
  },
];

export function getGymMachines(): GymMachine[] { return GYM_MACHINES; }
export function getMachineByName(name: string): GymMachine | undefined { return GYM_MACHINES.find(m => m.name.toLowerCase().includes(name.toLowerCase())); }

// ═══════════════════════════════════════════════════════════════════════════
// 2. Plate Math Calculator
// ═══════════════════════════════════════════════════════════════════════════

export type WeightUnit = 'kg' | 'lbs';

const METRIC_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const IMPERIAL_PLATES = [45, 35, 25, 10, 5, 2.5];

export function calculatePlates(
  targetWeight: number, 
  barWeight: number = 20, 
  unit: WeightUnit = 'kg',
  availablePlates?: number[]
): PlateMathResult {
  const platesSet = availablePlates || (unit === 'kg' ? METRIC_PLATES : IMPERIAL_PLATES);
  const weightPerSide = (targetWeight - barWeight) / 2;

  if (weightPerSide < 0) {
    return {
      targetWeight, barWeight, platesPerSide: [], totalPlates: 0,
      actualWeight: barWeight, deviation: barWeight - targetWeight,
    };
  }

  const platesPerSide: PlateMathResult['platesPerSide'] = [];
  let remaining = weightPerSide;

  for (const plate of platesSet.sort((a, b) => b - a)) {
    if (remaining >= plate) {
      const count = Math.floor(remaining / plate);
      platesPerSide.push({ plate, count });
      remaining = Math.round((remaining - count * plate) * 100) / 100;
    }
  }

  const totalPlates = platesPerSide.reduce((s, p) => s + p.count * 2, 0);
  const sideWeight = platesPerSide.reduce((s, p) => s + p.plate * p.count, 0);
  const actualWeight = Math.round((barWeight + sideWeight * 2) * 100) / 100;

  return {
    targetWeight, barWeight, platesPerSide, totalPlates,
    actualWeight, deviation: Math.round((actualWeight - targetWeight) * 100) / 100,
  };
}

export function getPlateLoadingOrder(targetWeight: number, barWeight: number = 20, unit: WeightUnit = 'kg'): string[] {
  const result = calculatePlates(targetWeight, barWeight, unit);
  const unitLabel = unit === 'kg' ? 'кг' : 'lb';
  const steps: string[] = [];

  steps.push(`Пустой гриф: ${barWeight} ${unitLabel}`);

  let current = barWeight;
  for (const pp of result.platesPerSide) {
    for (let i = 0; i < pp.count; i++) {
      current += pp.plate * 2;
      steps.push(`+ ${pp.plate}${unitLabel} ×2 = ${current} ${unitLabel}`);
    }
  }

  steps.push(`Итого: ${result.actualWeight} ${unitLabel} (цель: ${targetWeight} ${unitLabel})`);
  return steps;
}

/** Common warmup plate loading for powerlifting */
export function warmupPlateSequence(workingWeight: number, barWeight: number = 20, unit: WeightUnit = 'kg', availablePlates?: number[]): { set: number; weight: number; plates: string; reps: number; restMin: number }[] {
  const steps = [0.2, 0.4, 0.6, 0.75, 0.85].map((pct, i) => ({
    set: i + 1,
    weight: Math.round(workingWeight * pct * 0.5) * 2,
    plates: '',
    reps: [10, 5, 3, 1, 1][i],
    restMin: [1, 2, 2, 3, 3][i],
  }));

  for (const step of steps) {
    const result = calculatePlates(Math.max(barWeight, step.weight), barWeight, unit, availablePlates);
    step.plates = result.platesPerSide.map(p => `${p.plate}×${p.count}`).join(' + ') || 'пустой';
  }

  return steps;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Competition Strategy
// ═══════════════════════════════════════════════════════════════════════════

const IPF_WEIGHT_CLASSES_MEN = [59, 66, 74, 83, 93, 105, 120, 120];
/** IPF Classic/Equipped женские категории (кг). */
export const IPF_WEIGHT_CLASSES_WOMEN = [43, 47, 52, 57, 63, 69, 76, 84, 84];
/** Общие (не-IPF) женские категории (кг). */
export const GENERAL_WEIGHT_CLASSES_WOMEN = [44, 48, 52, 56, 60, 67.5, 75, 82.5, 90, 100, 110];

export function selectWeightClassForSex(
  sex: 'male' | 'female',
  bodyWeight: number,
  fed: string = 'IPF',
): { weightClass: number; cuttingRequired: boolean; cuttingAmount: number; recommendation: string } {
  const classes = sex === 'female'
    ? (fed === 'IPF' ? IPF_WEIGHT_CLASSES_WOMEN : GENERAL_WEIGHT_CLASSES_WOMEN)
    : (fed === 'IPF' ? IPF_WEIGHT_CLASSES_MEN : [60, 67.5, 75, 82.5, 90, 100, 110, 125, 140]);

  const above = classes.find(c => c >= bodyWeight);
  const below = [...classes].reverse().find(c => c < bodyWeight);

  if (above && bodyWeight >= above * 0.95) {
    const cut = Math.max(0, bodyWeight - above);
    return {
      weightClass: above,
      cuttingRequired: cut > 0,
      cuttingAmount: Math.round(cut * 10) / 10,
      recommendation: cut === 0
        ? 'Входите в категорию без сушки. Идеально.'
        : cut <= 2
          ? `Лёгкая сушка ${cut}кг за 3-5 дней. Водная манипуляция.`
          : cut <= 5
            ? `Сушка ${cut}кг за 1-2 недели. Водная + углеводная манипуляция.`
            : `Сушка ${cut}кг — значительно. Рассмотрите категорию выше (${below}кг).`,
    };
  }

  if (below) {
    return {
      weightClass: below,
      cuttingRequired: false, cuttingAmount: 0,
      recommendation: `Вы ниже категории ${below}. Набирайте до ${below}кг для максимизации тотала.`,
    };
  }

  return { weightClass: bodyWeight, cuttingRequired: false, cuttingAmount: 0, recommendation: 'Нет подходящей категории.' };
}

export function selectWeightClass(
  bodyWeight: number, fed: string,
): { weightClass: number; cuttingRequired: boolean; cuttingAmount: number; recommendation: string } {
  return selectWeightClassForSex('male', bodyWeight, fed);
}

export interface WeightCutRecommendation {
  /** Текущий вес тела, кг. */
  currentWeight: number;
  /** Целевой вес (категория), кг. */
  targetWeight: number;
  /** Сколько нужно сбросить, кг (0 если вес ниже целевого). */
  toCut: number;
  /** Безопасный темп сброса, кг/нед (0.5–1.0% массы тела). */
  safeWeeklyRate: number;
  /** Минимальное число недель при безопасном темпе. */
  weeksNeeded: number;
  /** Есть ли время на безопасный сброс до соревнования. */
  feasible: boolean;
  /** Недельный дефицит калорий, ккал (≈7700 ккал/кг жира). */
  weeklyDeficitKcal: number;
  /** Дневной дефицит, ккал. */
  dailyDeficitKcal: number;
  /** Понедельный план снижения веса. */
  timeline: { week: number; weight: number; note: string }[];
  /** Рекомендации текстом. */
  recommendations: string[];
  /** Сколько нужно НАБРАТЬ, кг (0 если вес выше/равен целевому). */
  toGain: number;
  /** Безопасный темп набора, кг/нед (0.5 кг/нед, максимум 1.0 для весовой категории). */
  safeGainRate: number;
  /** Минимальное число недель при безопасном темпе набора. */
  weeksNeededForGain: number;
  /** Успевается ли набор за оставшиеся недели. */
  gainFeasible: boolean;
  /** Недельный профицит калорий, ккал (≈7700 ккал/кг массы). */
  weeklySurplusKcal: number;
  /** Дневной профицит, ккал. */
  dailySurplusKcal: number;
  /** Понедельный план набора веса. */
  gainTimeline: { week: number; weight: number; note: string }[];
  /** Рекомендации по набору текстом. */
  gainRecommendations: string[];
}

/**
 * Рекомендации по приведению веса к целевой категории перед соревнованием:
 * сброс (текущий > целевой) ИЛИ набор (текущий < целевой — переход в более
 * тяжёлую категорию). Безопасный темп сброса: 0.5–1.0% массы тела в неделю
 * (Helms 2018, NSCA); безопасный темп набора: 0.5 кг/нед (0.25–0.5 — мышечная
 * масса, до 1.0 для весовой категории). 1 кг массы ≈ 7700 ккал.
 */
export function recommendWeightCut(currentWeight: number, targetWeight: number, weeksToMeet: number): WeightCutRecommendation {
  const toCut = Math.max(0, currentWeight - targetWeight);
  const safeWeeklyRate = currentWeight > 0 ? Math.max(0.25, Math.round(currentWeight * 0.0075 * 10) / 10) : 0.5;
  const weeksNeeded = safeWeeklyRate > 0 ? Math.ceil(toCut / safeWeeklyRate) : 0;
  const feasible = toCut === 0 || weeksNeeded <= weeksToMeet;
  const weeklyLoss = weeksToMeet > 0 ? toCut / weeksToMeet : 0;
  const weeklyDeficitKcal = Math.round(weeklyLoss * 7700);
  const dailyDeficitKcal = Math.round(weeklyDeficitKcal / 7);
  const timeline: WeightCutRecommendation['timeline'] = [];
  for (let w = 1; w <= weeksToMeet; w++) {
    const weight = Math.max(targetWeight, Math.round((currentWeight - weeklyLoss * w) * 10) / 10);
    const note = w === weeksToMeet
      ? 'Взвешивание. Вода/углеводы: не вносить дефицит за 24-48ч до.'
      : w >= weeksToMeet - 1 && toCut >= 2
        ? 'Водная манипуляция: ±соль/вода (при необходимости).'
        : weeklyLoss > 0 ? `−${weeklyLoss.toFixed(1)} кг/нед` : 'поддержание';
    timeline.push({ week: w, weight, note });
  }
  const recommendations: string[] = [];
  if (toCut <= 0) {
    recommendations.push(`✓ Вы уже в категории до ${targetWeight} кг — сброс не требуется. Сфокусируйтесь на пике формы.`);
  } else {
    recommendations.push(`Сброс: ${toCut.toFixed(1)} кг за ${weeksToMeet} нед → темп ${weeklyLoss.toFixed(2)} кг/нед.`);
    if (feasible) {
      recommendations.push(`✅ Безопасный темп (${safeWeeklyRate.toFixed(1)} кг/нед при 0.75% массы тела) — успеваете. Дефицит ≈${dailyDeficitKcal} ккал/день.`);
      if (weeklyLoss > safeWeeklyRate) {
        recommendations.push(`⚠ Темп ${weeklyLoss.toFixed(2)} кг/нед выше безопасного ${safeWeeklyRate.toFixed(1)} — усильте шаги/кардио или начните сброс раньше.`);
      }
    } else {
      recommendations.push(`❌ За ${weeksToMeet} нед безопасно сбросить только ${(safeWeeklyRate * weeksToMeet).toFixed(1)} кг (нужно ${toCut.toFixed(1)}). Рассмотрите категорию выше или водную манипуляцию (макс. ~2-3 кг).`);
    }
    if (toCut >= 4) {
      recommendations.push('Белок 2.2–2.6 г/кг, дефицит не более 20-25% от TDEE, силовая интенсивность сохраняется (Helms 2018).');
    }
    if (weeksToMeet <= 3 && toCut <= 3) {
      recommendations.push('Лёгкая сушка ≤3 кг за 3 нед: умеренный дефицит + контроль натрия/воды в последнюю неделю.');
    }
  }
  recommendations.push('Взвешивание в федерации обычно утром — взвесьтесь за 2-3 дня до, чтобы учесть запас.');

  // ── Набор веса (текущий вес НИЖЕ целевого — переход в более тяжёлую категорию) ──
  const toGain = Math.max(0, targetWeight - currentWeight);
  const safeGainRate = Math.min(1.0, Math.max(0.25, Math.round(currentWeight * 0.006 * 10) / 10));
  const weeksNeededForGain = safeGainRate > 0 ? Math.ceil(toGain / safeGainRate) : 0;
  const gainFeasible = toGain === 0 || weeksNeededForGain <= weeksToMeet;
  const weeklyGain = weeksToMeet > 0 ? toGain / weeksToMeet : 0;
  const weeklySurplusKcal = Math.round(weeklyGain * 7700);
  const dailySurplusKcal = Math.round(weeklySurplusKcal / 7);
  const gainTimeline: WeightCutRecommendation['gainTimeline'] = [];
  for (let w = 1; w <= weeksToMeet; w++) {
    const weight = Math.min(targetWeight, Math.round((currentWeight + weeklyGain * w) * 10) / 10);
    const note = w === weeksToMeet
      ? 'Взвешивание. Набор остановить за 24-48ч — лишний вес/вода уйдут.'
      : w === weeksToMeet - 1 && toGain > 0
        ? 'Вода/соль в норме, обычная еда — взвешивание НАВЕРХ: жидкость не сгонять.'
        : weeklyGain > 0 ? `+${weeklyGain.toFixed(1)} кг/нед` : 'поддержание';
    gainTimeline.push({ week: w, weight, note });
  }
  const gainRecommendations: string[] = [];
  if (toGain > 0) {
    gainRecommendations.push(`Набор: +${toGain.toFixed(1)} кг за ${weeksToMeet} нед → темп ${weeklyGain.toFixed(2)} кг/нед.`);
    if (gainFeasible) {
      gainRecommendations.push(`✅ Темп ${safeGainRate.toFixed(1)} кг/нед — успеваете. Профицит ≈${dailySurplusKcal} ккал/день (350–700).`);
    } else {
      gainRecommendations.push(`❌ За ${weeksToMeet} нед безопасно набрать только ${(safeGainRate * weeksToMeet).toFixed(1)} кг (нужно ${toGain.toFixed(1)}). Снизьте категорию или начните набор раньше.`);
    }
    if (weeklyGain > safeGainRate) {
      gainRecommendations.push(`⚠ Темп ${weeklyGain.toFixed(2)} кг/нед выше безопасного ${safeGainRate.toFixed(1)} — большая часть будет жиром.`);
    }
    if (toGain >= 2) {
      gainRecommendations.push('Белок 1.8–2.2 г/кг, профицит 10-15% от TDEE, силовая прогрессия сохраняется — набирайте мышцы, а не жир.');
    }
    gainRecommendations.push('Взвешивание НАВЕРХ: за 24-48ч до — обычная еда и вода, лёгкий завтрак утром; жидкость не сгонять (в отличие от сброса), максимизируйте вес на взвешивании.');
  }
  return {
    currentWeight, targetWeight, toCut, safeWeeklyRate, weeksNeeded, feasible,
    weeklyDeficitKcal, dailyDeficitKcal, timeline, recommendations,
    toGain, safeGainRate, weeksNeededForGain, gainFeasible,
    weeklySurplusKcal, dailySurplusKcal, gainTimeline, gainRecommendations,
  };
}

export function generateAttemptStrategy(squat: number, bench: number, deadlift: number): CompetitionStrategy['attemptStrategy'] {
  const lifts = [
    { name: 'Squat', max: squat },
    { name: 'Bench Press', max: bench },
    { name: 'Deadlift', max: deadlift },
  ];

  return lifts.map(l => ({
    lift: l.name,
    opener: `${Math.round(l.max * 0.90 * 0.5) * 2} кг (90% — уверенно)`,
    second: `${Math.round(l.max * 0.95 * 0.5) * 2} кг (95% — целевой)`,
    third: `${Math.round(l.max * 1.0 * 0.5) * 2} кг (100% — PR при возможности)`,
    warmupRoom: l.name === 'Squat'
      ? 'Разминка: пустой×10, 40%×5, 60%×3, 75%×1, 85%×1. Последний разминочный за 8-10 мин до выхода.'
      : l.name === 'Bench Press'
        ? 'Разминка: пустой×10, 50%×5, 65%×3, 80%×1. Следите за командами судьи на открывашке.'
        : 'Разминка: 40%×5, 60%×3, 75%×1. Последняя тяга — всё или ничего.',
  }));
}

export function generateCompetitionTimeline(weighInTime: string, startTime: string): CompetitionStrategy['timeline'] {
  return [
    { time: weighInTime, action: 'Взвешивание. Легко одет. Не забудьте паспорт и карту федерации.' },
    { time: 'После взвешивания', action: 'Регидрация: 1л воды + электролиты. Углеводы: рис/баранки + мёд. Белок: whey shake.' },
    { time: 'За 60 мин до старта', action: 'Лёгкая разминка: велотренажёр 5 мин, динамическая растяжка.' },
    { time: 'За 30 мин', action: 'Начать разминку squat. Кофеин 200-400 мг (если используете).' },
    { time: startTime, action: 'Старт потока. Будьте готовы за 2-3 попытки до вашей.' },
    { time: 'Между попытками', action: 'Отдых 5-8 мин. Белок + углеводы (глотками). Не переедать.' },
    { time: 'После squats', action: 'Разминка bench. Не остывайте.' },
    { time: 'После bench', action: 'Полноценный приём пищи. Рис + курица. 1 час до deadlift.' },
    { time: 'После deadlift', action: '🎉 Поздравляем! Восстановительное питание. Анализ выступления.' },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Recovery Protocols
// ═══════════════════════════════════════════════════════════════════════════

const RECOVERY_PROTOCOLS: RecoveryProtocol[] = [
  {
    name: 'Контрастный душ',
    type: 'contrast', durationMin: 15,
    instructions: [
      '2 мин горячая вода (38-40°C)',
      '30 сек холодная вода (10-15°C)',
      'Повторить 4-6 циклов',
      'Закончить холодной',
    ],
    whenToUse: 'После тяжёлой тренировки. Не перед соревнованиями (снижает мощность).',
    benefits: ['Улучшение кровотока', 'Снижение DOMS', 'Ускорение вывода метаболитов'],
  },
  {
    name: 'Активное восстановление (LISS)',
    type: 'active', durationMin: 30,
    instructions: [
      'Ходьба 3-4 км/ч или велотренажёр 60-70 об/мин',
      'Пульс 120-130 уд/мин (зона 1-2)',
      'Без одышки — можете говорить',
      'Идеально на следующий день после тяжёлых ног',
    ],
    whenToUse: 'День после тренировки. 1-2×/нед.',
    benefits: ['Усиление кровотока без нагрузки', 'Снижение кортизола', 'Улучшение качества сна'],
  },
  {
    name: 'Foam Rolling (Миофасциальный релиз)',
    type: 'massage', durationMin: 15,
    instructions: [
      'Квадрицепсы: 60 сек на ногу, медленно',
      'IT Band: 45 сек на ногу (осторожно, чувствительно)',
      'Грудной отдел: 60 сек, руки за голову',
      'Задняя цепь: сидя на ролле, 90 сек',
      'Задержка на болевых точках 20-30 сек',
    ],
    whenToUse: 'После тренировки или вечером. Ежедневно безопасно.',
    benefits: ['Снижение мышечного тонуса', 'Улучшение ROM', 'Профилактика триггерных точек'],
  },
  {
    name: 'Компрессионная терапия',
    type: 'compression', durationMin: 20,
    instructions: [
      'Компрессионные гетры/рукава на 2-4 часа после тренировки',
      'Давление 20-30 мм рт.ст.',
      'Носить во время сна при сильной крепатуре',
    ],
    whenToUse: 'После тяжёлых ног/приседа. Соревнования (между попытками).',
    benefits: ['Снижение отёка', 'Ускорение венозного возврата', 'Снижение DOMS на 20-30%'],
  },
  {
    name: 'Дыхание 4-7-8 (Парасимпатическая активация)',
    type: 'breathing', durationMin: 5,
    instructions: [
      'Вдох через нос: 4 секунды',
      'Задержка дыхания: 7 секунд',
      'Выдох через рот (с шумом): 8 секунд',
      'Повторить 5-10 циклов',
      'Язык прижат к нёбу за передними зубами',
    ],
    whenToUse: 'Перед сном. При тревожности. Перед тяжёлым подходом (1-2 цикла).',
    benefits: ['Активация вагуса', 'Снижение ЧСС', 'Снижение кортизола', 'Улучшение качества сна'],
  },
  {
    name: 'Статическая растяжка (Cool-down)',
    type: 'stretching', durationMin: 10,
    instructions: [
      'Растяжка нагруженных мышц: 30-45 сек каждая',
      'Без боли — только до ощущения натяжения',
      'Quad stretch, Hamstring stretch, Chest doorway, Lat stretch, Hip flexor',
      'Дыхание: выдох на углубление растяжки',
    ],
    whenToUse: 'Сразу после тренировки. Не перед силовой работой.',
    benefits: ['Восстановление длины мышц', 'Снижение тонуса', 'Улучшение ROM'],
  },
];

export function getRecoveryProtocols(): RecoveryProtocol[] { return RECOVERY_PROTOCOLS; }
export function getRecoveryByType(type: string): RecoveryProtocol[] { return RECOVERY_PROTOCOLS.filter(r => r.type === type); }

// ═══════════════════════════════════════════════════════════════════════════
// 5. Mental Performance
// ═══════════════════════════════════════════════════════════════════════════

const MENTAL_ROUTINES: MentalRoutine[] = [
  {
    name: 'Предсоревновательный ритуал',
    steps: [
      { action: 'Визуализация', duration: '5 мин', notes: 'Закрыть глаза. Увидеть успешный подъём от начала до конца. Все 3 попытки.' },
      { action: 'Дыхание 4-7-8', duration: '2 мин', notes: '3 цикла для активации парасимпатики.' },
      { action: 'Аффирмации', duration: '1 мин', notes: 'Проговорить: "Я готов. Я силён. Это мой вес. Техника идеальна."' },
      { action: 'Активация', duration: '3 мин', notes: 'Прыжки на месте, динамическая растяжка, пощёчины по ногам/груди.' },
      { action: 'Подход к штанге', duration: '30 сек', notes: 'Глубокий вдох. Нюхательная соль (опционально). Хват. Поехали.' },
    ],
    whenToUse: 'За 15-20 минут до каждого выхода на помост.',
  },
  {
    name: 'Утренний ритуал фокуса',
    steps: [
      { action: 'Стакан воды', duration: '1 мин', notes: 'Регидрация после сна. С лимоном.' },
      { action: 'Дневник благодарности', duration: '2 мин', notes: '3 вещи, за которые благодарен. Переключает мозг с негатива.' },
      { action: 'Дыхание Wim Hof', duration: '5 мин', notes: '30 глубоких вдохов → задержка на выдохе → 3 цикла. Энергия и фокус.' },
      { action: 'План на день', duration: '2 мин', notes: '3 главные задачи. Тренировка — всегда в топ-3.' },
    ],
    whenToUse: 'Каждое утро. 10 минут.',
  },
  {
    name: 'Восстановление после неудачного подхода',
    steps: [
      { action: 'Принять эмоцию', duration: '30 сек', notes: 'Злость/разочарование — нормально. Не подавлять.' },
      { action: 'Анализ', duration: '1 мин', notes: 'Что пошло не так: техника? вес? подготовка? Не "я слабый", а "гриф ушёл вперёд".' },
      { action: 'Сброс', duration: '30 сек', notes: 'Глубокий выдох. Встряхнуть руки. Физически сбросить напряжение.' },
      { action: 'План коррекции', duration: '1 мин', notes: 'Что изменить: grip, stance, взгляд. Конкретное действие.' },
      { action: 'Переключение', duration: '2 мин', notes: 'Музыка. Следующий подход/упражнение. Не зацикливаться.' },
    ],
    whenToUse: 'После неудачного подхода или плохой тренировки.',
  },
];

export function getMentalRoutines(): MentalRoutine[] { return MENTAL_ROUTINES; }
