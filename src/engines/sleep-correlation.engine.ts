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

  const qualityDiff = avgQualityWithTraining - avgQualityWithoutTraining;
  const hoursDiff = avgHoursWithTraining - avgHoursWithoutTraining;

  // Простая корреляция (разница средних)
  const correlation = (qualityDiff + hoursDiff) / 2; // нормализованное значение

  return {
    factor: 'Тренировки',
    correlation: Math.round(correlation * 10) / 10,
    strength: Math.abs(correlation) > 1 ? 'strong' : Math.abs(correlation) > 0.5 ? 'moderate' : 'weak',
    direction: correlation > 0 ? 'positive' : correlation < 0 ? 'negative' : 'neutral',
    description: `При тренировках: качество ${avgQualityWithTraining.toFixed(1)}/10, сон ${avgHoursWithTraining.toFixed(1)}ч. Без тренировок: ${avgQualityWithoutTraining.toFixed(1)}/10, ${avgHoursWithoutTraining.toFixed(1)}ч`,
    sampleSize: sleepWithTraining.length
  };
}

/**
 * Анализирует влияние кофеина на сон
 */
export function analyzeCaffeineCorrelation(sleepDiary: SleepEntry[]): CorrelationResult | null {
  const entriesWithCaffeine = sleepDiary.filter(e => e.caffeineCutoff && e.caffeineCutoff > '12:00');
  const entriesWithoutLateCaffeine = sleepDiary.filter(e => !e.caffeineCutoff || e.caffeineCutoff <= '12:00');

  if (entriesWithCaffeine.length < 2 || entriesWithoutLateCaffeine.length < 2) return null;

  const metric = (e: SleepEntry) => Number.isFinite(e.latency) ? e.latency! : e.quality;
  const avgLatencyWithCaffeine = entriesWithCaffeine.reduce((sum, e) => sum + metric(e), 0) / entriesWithCaffeine.length;
  const avgLatencyWithoutCaffeine = entriesWithoutLateCaffeine.reduce((sum, e) => sum + metric(e), 0) / entriesWithoutLateCaffeine.length;

  const latencyDiff = avgLatencyWithCaffeine - avgLatencyWithoutCaffeine;

  return {
    factor: 'Кофеин после 12:00',
    correlation: Math.round(latencyDiff * 10) / 10,
    strength: Math.abs(latencyDiff) > 15 ? 'strong' : Math.abs(latencyDiff) > 8 ? 'moderate' : 'weak',
    direction: latencyDiff > 0 ? 'negative' : 'positive',
    description: `При позднем кофеине латентность ${avgLatencyWithCaffeine.toFixed(0)} мин, при раннем ${avgLatencyWithoutCaffeine.toFixed(0)} мин`,
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
    description: `С алкоголем: качество ${avgQualityAlcohol.toFixed(1)}/10, пробуждений ${avgAwakeningsAlcohol.toFixed(1)}. Без алкоголя: ${avgQualityNoAlcohol.toFixed(1)}/10, ${avgAwakeningsNoAlcohol.toFixed(1)} пробуждений`,
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

  const metric = (e: SleepEntry) => Number.isFinite(e.latency) ? e.latency! : e.quality;
  const avgLatencyHighScreen = entriesWithScreenTime.reduce((sum, e) => sum + metric(e), 0) / entriesWithScreenTime.length;
  const avgLatencyLowScreen = entriesWithLowScreenTime.reduce((sum, e) => sum + metric(e), 0) / entriesWithLowScreenTime.length;

  const latencyDiff = avgLatencyHighScreen - avgLatencyLowScreen;

  return {
    factor: 'Экран > 60 мин перед сном',
    correlation: Math.round(latencyDiff * 10) / 10,
    strength: Math.abs(latencyDiff) > 10 ? 'strong' : Math.abs(latencyDiff) > 5 ? 'moderate' : 'weak',
    direction: latencyDiff > 0 ? 'negative' : 'positive',
    description: `При долгом экране латентность ${avgLatencyHighScreen.toFixed(0)} мин, при коротком ${avgLatencyLowScreen.toFixed(0)} мин`,
    sampleSize: entriesWithScreenTime.length
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
      if (corr.factor.includes('Тренировки') && corr.direction === 'positive') {
        recommendations.push('💪 Тренировки положительно влияют на сон. Продолжайте в том же духе!');
      }
    }
  });

  return recommendations;
}
