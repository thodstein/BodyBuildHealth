/**
 * Sleep Correlation Engine
 * Анализирует корреляции между сном и другими факторами (тренировки, препараты, питание)
 */

export interface SleepEntry {
  date: string;
  hours: number;
  quality: number;
  awakenings: number;
  bedtime: string;
  wakeTime: string;
  notes: string;
  latency?: number;
  caffeineCutoff?: string;
  alcohol?: boolean;
  screenTime?: number;
  stressLevel?: number;
  exerciseTiming?: string;
}

// Re-export for convenience
export type { SleepEntry as SleepEntryType };

export interface CorrelationResult {
  factor: string;
  correlation: number; // -1 to 1
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  direction: 'positive' | 'negative' | 'neutral';
  description: string;
  sampleSize: number;
}

export interface SleepCorrelationInput {
  sleepDiary: SleepEntry[];
  trainingDates?: string[]; // даты тренировок
  supplementIntake?: { date: string; substance: string; dose: string }[];
  weightData?: { date: string; weight: number }[];
  stressData?: { date: string; stressLevel: number }[];
}

/**
 * Анализирует корреляцию между сном и тренировками
 */
export function analyzeSleepTrainingCorrelation(
  sleepDiary: SleepEntry[],
  trainingDates: string[]
): CorrelationResult | null {
  if (sleepDiary.length < 5 || trainingDates.length < 3) return null;

  // Находим дни, когда были тренировки
  const sleepWithTraining = sleepDiary.filter(entry =>
    trainingDates.includes(entry.date)
  );
  const sleepWithoutTraining = sleepDiary.filter(entry =>
    !trainingDates.includes(entry.date)
  );

  if (sleepWithTraining.length < 3 || sleepWithoutTraining.length < 3) return null;

  // Сравниваем качество и длительность сна
  const avgQualityWithTraining = sleepWithTraining.reduce((sum, e) => sum + e.quality, 0) / sleepWithTraining.length;
  const avgQualityWithoutTraining = sleepWithoutTraining.reduce((sum, e) => sum + e.quality, 0) / sleepWithoutTraining.length;

  const avgHoursWithTraining = sleepWithTraining.reduce((sum, e) => sum + e.hours, 0) / sleepWithTraining.length;
  const avgHoursWithoutTraining = sleepWithoutTraining.reduce((sum, e) => sum + e.hours, 0) / sleepWithoutTraining.length;

  // Качество оценивается по шкале 1-5 (единые единицы — разница средних качеств)
  const qualityDiff = avgQualityWithTraining - avgQualityWithoutTraining;
  const correlation = Math.round(qualityDiff * 10) / 10;

  return {
    factor: 'Тренировки',
    correlation,
    strength: Math.abs(correlation) > 1 ? 'strong' : Math.abs(correlation) > 0.5 ? 'moderate' : 'weak',
    direction: correlation > 0 ? 'positive' : correlation < 0 ? 'negative' : 'neutral',
    description: `С тренировками: качество ${avgQualityWithTraining.toFixed(1)}/5, сон ${avgHoursWithTraining.toFixed(1)} ч. Без тренировок: ${avgQualityWithoutTraining.toFixed(1)}/5, ${avgHoursWithoutTraining.toFixed(1)} ч`,
    sampleSize: sleepWithTraining.length
  };
}

/**
 * Выбирает единую метрику для группы: латентность (если заполнена у всех),
 * иначе качество (если заполнено у всех). Никогда не смешивает минуты и баллы.
 */
const groupMetric = (entries: SleepEntry[]): { kind: 'latency' | 'quality'; vals: number[] } | null => {
  const lat = entries.map((e) => e.latency).filter((v): v is number => Number.isFinite(v));
  if (lat.length === entries.length && entries.length > 0) return { kind: 'latency', vals: lat };
  const q = entries.map((e) => e.quality).filter((v): v is number => Number.isFinite(v));
  if (q.length === entries.length && entries.length > 0) return { kind: 'quality', vals: q };
  return null;
};

const groupMean = (entries: SleepEntry[], kind: 'latency' | 'quality'): number | null => {
  const vals = entries
    .map((e) => (kind === 'latency' ? e.latency : e.quality))
    .filter((v): v is number => Number.isFinite(v));
  return vals.length === entries.length && entries.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
};

/**
 * Анализирует влияние кофеина на сон
 */
export function analyzeCaffeineCorrelation(sleepDiary: SleepEntry[]): CorrelationResult | null {
  const entriesWithCaffeine = sleepDiary.filter(e => e.caffeineCutoff && e.caffeineCutoff > '12:00');
  const entriesWithoutLateCaffeine = sleepDiary.filter(e => !e.caffeineCutoff || e.caffeineCutoff <= '12:00');

  if (entriesWithCaffeine.length < 2 || entriesWithoutLateCaffeine.length < 2) return null;

  const withMetric = groupMetric(entriesWithCaffeine);
  const withoutMetric = groupMetric(entriesWithoutLateCaffeine);
  if (!withMetric || !withoutMetric || withMetric.kind !== withoutMetric.kind) return null;
  const kind = withMetric.kind;

  const avgWith = groupMean(entriesWithCaffeine, kind);
  const avgWithout = groupMean(entriesWithoutLateCaffeine, kind);
  if (avgWith === null || avgWithout === null) return null;

  const diff = avgWith - avgWithout;
  const unit = kind === 'latency' ? 'мин' : '/5';
  const thresholds = kind === 'latency' ? [15, 8] : [1.5, 0.8];
  const strength = Math.abs(diff) > thresholds[0] ? 'strong' : Math.abs(diff) > thresholds[1] ? 'moderate' : 'weak';

  return {
    factor: 'Кофеин после 12:00',
    correlation: Math.round(diff * 10) / 10,
    strength,
    direction: diff > 0 ? 'negative' : 'positive',
    description: `При позднем кофеине ${kind === 'latency' ? 'латентность' : 'качество'} ${avgWith.toFixed(kind === 'latency' ? 0 : 1)} ${unit}, при раннем ${avgWithout.toFixed(kind === 'latency' ? 0 : 1)} ${unit}`,
    sampleSize: entriesWithCaffeine.length
  };
}

/**
 * Анализирует влияние алкоголя на сон
 */
export function analyzeAlcoholCorrelation(sleepDiary: SleepEntry[]): CorrelationResult | null {
  const alcoholDays = sleepDiary.filter(e => e.alcohol);
  const noAlcoholDays = sleepDiary.filter(e => !e.alcohol);

  if (alcoholDays.length < 2 || noAlcoholDays.length < 2) return null;

  const avgQualityAlcohol = alcoholDays.reduce((sum, e) => sum + e.quality, 0) / alcoholDays.length;
  const avgQualityNoAlcohol = noAlcoholDays.reduce((sum, e) => sum + e.quality, 0) / noAlcoholDays.length;

  const avgAwakeningsAlcohol = alcoholDays.reduce((sum, e) => sum + e.awakenings, 0) / alcoholDays.length;
  const avgAwakeningsNoAlcohol = noAlcoholDays.reduce((sum, e) => sum + e.awakenings, 0) / noAlcoholDays.length;

  const qualityDiff = avgQualityAlcohol - avgQualityNoAlcohol;

  return {
    factor: 'Алкоголь',
    correlation: Math.round(qualityDiff * 10) / 10,
    strength: Math.abs(qualityDiff) > 1.5 ? 'strong' : Math.abs(qualityDiff) > 0.8 ? 'moderate' : 'weak',
    direction: qualityDiff < 0 ? 'negative' : 'positive',
    description: `С алкоголем: качество ${avgQualityAlcohol.toFixed(1)}/5, пробуждений ${avgAwakeningsAlcohol.toFixed(1)}. Без алкоголя: ${avgQualityNoAlcohol.toFixed(1)}/5, ${avgAwakeningsNoAlcohol.toFixed(1)} пробуждений`,
    sampleSize: alcoholDays.length
  };
}

/**
 * Анализирует влияние времени перед экраном на сон
 */
export function analyzeScreenTimeCorrelation(sleepDiary: SleepEntry[]): CorrelationResult | null {
  const entriesWithScreenTime = sleepDiary.filter(e => e.screenTime && e.screenTime > 60);
  const entriesWithLowScreenTime = sleepDiary.filter(e => e.screenTime && e.screenTime <= 60);

  if (entriesWithScreenTime.length < 2 || entriesWithLowScreenTime.length < 2) return null;

  const withMetric = groupMetric(entriesWithScreenTime);
  const lowMetric = groupMetric(entriesWithLowScreenTime);
  if (!withMetric || !lowMetric || withMetric.kind !== lowMetric.kind) return null;
  const kind = withMetric.kind;

  const avgHigh = groupMean(entriesWithScreenTime, kind);
  const avgLow = groupMean(entriesWithLowScreenTime, kind);
  if (avgHigh === null || avgLow === null) return null;

  const diff = avgHigh - avgLow;
  const unit = kind === 'latency' ? 'мин' : '/5';
  const thresholds = kind === 'latency' ? [10, 5] : [1.0, 0.5];
  const strength = Math.abs(diff) > thresholds[0] ? 'strong' : Math.abs(diff) > thresholds[1] ? 'moderate' : 'weak';

  return {
    factor: 'Экран > 60 мин перед сном',
    correlation: Math.round(diff * 10) / 10,
    strength,
    direction: diff > 0 ? 'negative' : 'positive',
    description: `При долгом экране ${kind === 'latency' ? 'латентность' : 'качество'} ${avgHigh.toFixed(kind === 'latency' ? 0 : 1)} ${unit}, при коротком ${avgLow.toFixed(kind === 'latency' ? 0 : 1)} ${unit}`,
    sampleSize: entriesWithScreenTime.length
  };
}

/**
 * Анализирует влияние стресса (оценка за день 1-10) на сон.
 * Группы: высокий стресс (≥7) против низкого (≤3).
 */
export function analyzeStressCorrelation(sleepDiary: SleepEntry[]): CorrelationResult | null {
  const highStress = sleepDiary.filter(e => Number.isFinite(e.stressLevel) && e.stressLevel! >= 7);
  const lowStress = sleepDiary.filter(e => Number.isFinite(e.stressLevel) && e.stressLevel! <= 3);

  if (highStress.length < 2 || lowStress.length < 2) return null;

  const highMetric = groupMetric(highStress);
  const lowMetric = groupMetric(lowStress);
  if (!highMetric || !lowMetric || highMetric.kind !== lowMetric.kind) return null;
  const kind = highMetric.kind;

  const avgHigh = groupMean(highStress, kind);
  const avgLow = groupMean(lowStress, kind);
  if (avgHigh === null || avgLow === null) return null;

  const diff = avgHigh - avgLow;
  const unit = kind === 'latency' ? 'мин' : '/5';
  const thresholds = kind === 'latency' ? [15, 8] : [1.2, 0.7];
  const strength = Math.abs(diff) > thresholds[0] ? 'strong' : Math.abs(diff) > thresholds[1] ? 'moderate' : 'weak';

  return {
    factor: 'Стресс (≥7 vs ≤3)',
    correlation: Math.round(diff * 10) / 10,
    strength,
    direction: diff > 0 ? 'negative' : 'positive',
    description: `В дни высокого стресса ${kind === 'latency' ? 'латентность' : 'качество'} ${avgHigh.toFixed(kind === 'latency' ? 0 : 1)} ${unit}, в спокойные ${avgLow.toFixed(kind === 'latency' ? 0 : 1)} ${unit}`,
    sampleSize: highStress.length
  };
}

/**
 * Анализирует связь качества сна с динамикой веса:
 * дельта веса между соседними замерами в дни хорошего (≥4) против плохого (≤2) сна.
 */
export function analyzeWeightCorrelation(
  sleepDiary: SleepEntry[],
  weightData: { date: string; weight: number }[],
): CorrelationResult | null {
  if (sleepDiary.length < 4 || weightData.length < 3) return null;
  const sorted = [...weightData].sort((a, b) => a.date.localeCompare(b.date));

  const byDate = new Map<string, SleepEntry>();
  for (const e of sleepDiary) byDate.set(e.date, e);

  let goodDays: number[] = [];
  let badDays: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const e = byDate.get(sorted[i].date);
    if (!e || !Number.isFinite(e.quality)) continue;
    const delta = sorted[i + 1].weight - sorted[i].weight;
    if (e.quality >= 4) goodDays.push(delta);
    else if (e.quality <= 2) badDays.push(delta);
  }

  if (goodDays.length < 2 || badDays.length < 2) return null;
  const avgGood = goodDays.reduce((s, v) => s + v, 0) / goodDays.length;
  const avgBad = badDays.reduce((s, v) => s + v, 0) / badDays.length;
  const diff = avgBad - avgGood;

  return {
    factor: 'Сон и вес',
    correlation: Math.round(diff * 100) / 100,
    strength: Math.abs(diff) > 0.5 ? 'strong' : Math.abs(diff) > 0.2 ? 'moderate' : 'weak',
    direction: diff > 0 ? 'negative' : 'positive',
    description: `После хорошего сна (≥4/5) вес в среднем ${avgGood >= 0 ? '+' : ''}${avgGood.toFixed(2)} кг/день, после плохого (≤2/5) ${avgBad >= 0 ? '+' : ''}${avgBad.toFixed(2)} кг/день`,
    sampleSize: badDays.length
  };
}

/**
 * Главная функция анализа всех корреляций
 */
export function analyzeAllSleepCorrelations(input: SleepCorrelationInput): CorrelationResult[] {
  const results: CorrelationResult[] = [];

  // Корреляция с тренировками
  if (input.trainingDates && input.trainingDates.length > 0) {
    const trainingCorr = analyzeSleepTrainingCorrelation(input.sleepDiary, input.trainingDates);
    if (trainingCorr) results.push(trainingCorr);
  }

  // Корреляция с кофеином
  const caffeineCorr = analyzeCaffeineCorrelation(input.sleepDiary);
  if (caffeineCorr) results.push(caffeineCorr);

  // Корреляция с алкоголем
  const alcoholCorr = analyzeAlcoholCorrelation(input.sleepDiary);
  if (alcoholCorr) results.push(alcoholCorr);

  // Корреляция с экраном
  const screenCorr = analyzeScreenTimeCorrelation(input.sleepDiary);
  if (screenCorr) results.push(screenCorr);

  // Корреляция со стрессом
  const stressCorr = analyzeStressCorrelation(input.sleepDiary);
  if (stressCorr) results.push(stressCorr);

  // Корреляция с динамикой веса
  if (input.weightData && input.weightData.length > 0) {
    const weightCorr = analyzeWeightCorrelation(input.sleepDiary, input.weightData);
    if (weightCorr) results.push(weightCorr);
  }

  return results;
}

/**
 * Генерирует рекомендации на основе корреляций
 */
export function generateCorrelationRecommendations(correlations: CorrelationResult[]): string[] {
  const recommendations: string[] = [];

  correlations.forEach(corr => {
    if (corr.strength === 'strong' || corr.strength === 'moderate') {
      if (corr.factor.includes('Кофеин') && corr.direction === 'negative') {
        recommendations.push('☕ Поздний кофеин значительно ухудшает засыпание. Сдвиньте приём кофеина на до 12:00');
      }
      if (corr.factor.includes('Алкоголь') && corr.direction === 'negative') {
        recommendations.push('🍷 алкоголь снижает качество сна. Ограничьте до 1-2 раз в неделю');
      }
      if (corr.factor.includes('Экран') && corr.direction === 'negative') {
        recommendations.push('📱 Длительный экран перед сном мешает засыпанию. Используйте режим "Ночь" или читайте бумажные книги');
      }
      if (corr.factor.includes('Стресс') && corr.direction === 'negative') {
        recommendations.push('🧘 Высокий стресс ухудшает сон. Добавьте вечерние практики: дыхание 4-7-8, магний, прогулка');
      }
      if (corr.factor.includes('Сон и вес') && corr.direction === 'negative') {
        recommendations.push('⚖️ Плохой сон связан с набором веса — приоритизируйте сон для контроля веса');
      }
      if (corr.factor.includes('Тренировки') && corr.direction === 'positive') {
        recommendations.push('💪 Тренировки положительно влияют на сон. Продолжайте в том же духе!');
      }
    }
  });

  return recommendations;
}
