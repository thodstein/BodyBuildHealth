/**
 * lms-peak-week.engine.ts — протокол пик-недели на основе данных скорости.
 * Адаптивный тапер: снижение объёма 40–50%, поддержание интенсивности.
 * Источник: Travis 2020, Pritchard 2016, Sports Med 2026.
 */

export interface PeakWeekInput {
  /** Недель до старта. */
  weeksToMeet: number;
  /** Текущий объём (сетов/нед). */
  currentVolume: number;
  /** Текущая интенсивность (% 1RM). */
  currentIntensity: number;
  /** Тренд скорости (% изменения). Положительный = скорость растёт. */
  velocityTrend?: number;
  /** Усталость 0-100. */
  fatigue?: number;
}

export interface PeakWeek {
  week: number;
  volumePct: number;
  intensityPct: number;
  rirShift: number;
  focus: string;
}

export interface PeakWeekPlan {
  weeks: PeakWeek[];
  volumeReduction: number;
  intensityMaintenance: number;
  lastTrainingDay: number;
  rationale: string;
}

/**
 * Построить план пик-недели.
 * При velocityTrend > 2% — тапер короче (суперкомпенсация идёт).
 * При velocityTrend < -2% — тапер длиннее.
 */
export function buildPeakWeekPlan(input: PeakWeekInput): PeakWeekPlan {
  const { weeksToMeet, currentVolume, currentIntensity, velocityTrend = 0, fatigue = 50 } = input;

  // Адаптивная длина тапера
  let taperLength = 2;
  if (velocityTrend > 2) taperLength = 1;
  else if (velocityTrend < -2) taperLength = 3;
  if (fatigue > 70) taperLength = Math.min(3, taperLength + 1);

  const weeks: PeakWeek[] = [];
  const volumeReduction = 0.45; // 45% снижение объёма
  const intensityMaintenance = 0.95; // 95% интенсивности

  for (let i = 0; i < taperLength; i++) {
    const weekNum = i + 1;
    const progress = (i + 1) / taperLength;
    const volPct = 1 - (volumeReduction * progress);
    const intPct = 1 - ((1 - intensityMaintenance) * progress);
    const rirShift = i === taperLength - 1 ? 2 : 1;

    weeks.push({
      week: weekNum,
      volumePct: Math.round(volPct * 100) / 100,
      intensityPct: Math.round(intPct * 100) / 100,
      rirShift,
      focus: i === taperLength - 1 ? 'Практика открытия' : 'Поддержание интенсивности',
    });
  }

  const lastTrainingDay = Math.max(3, 7 - taperLength);

  const rationale = velocityTrend > 2
    ? `Скорость растёт (${velocityTrend.toFixed(1)}%) — суперкомпенсация идёт, тапер короче (${taperLength} нед).`
    : velocityTrend < -2
      ? `Скорость падает (${velocityTrend.toFixed(1)}%) — нужен более длинный тапер (${taperLength} нед).`
      : `Стандартный тапер ${taperLength} нед. Снижение объёма ${Math.round(volumeReduction * 100)}%, интенсивность поддерживается.`;

  return {
    weeks,
    volumeReduction,
    intensityMaintenance,
    lastTrainingDay,
    rationale,
  };
}

/**
 * Применить пик-неделю к плану (заглушка для интеграции).
 */
export function applyPeakWeek(plan: unknown, peakPlan: PeakWeekPlan): unknown {
  // Интеграция с LMSPlanWeek будет добавлена при подключении к buildLMSPlan
  return plan;
}
