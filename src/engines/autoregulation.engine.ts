import type { ReadinessScores } from '../core/types';
import type { CycleWeekPlan } from './cycle-types.engine';

export interface AutoregulationInput {
  readiness: ReadinessScores;
  trainingLoadRatio: number;
  plannedWeek: CycleWeekPlan;
  plannedExercises: ExercisePlan[];
  goal: string;
  level: string;
  weakPoints: string[];
  injuries?: { joint?: string; severity?: string }[];
  techniqueIssues?: string[];
  lastSessionRPE?: number;
  recentVolumeTrend?: 'up' | 'stable' | 'down';
  strengthTrend?: 'up' | 'stable' | 'down';
  doms: number;
  sleepQuality: number;
  stress: number;
}

export interface ExercisePlan {
  exerciseId: string;
  name: string;
  group: string;
  type: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  rir: number;
  isCompound: boolean;
  isWeakGroup: boolean;
  techniqueScore?: number;
}

export interface ExerciseAdjustment {
  exerciseId: string;
  originalSets: number;
  adjustedSets: number;
  originalRir: number;
  adjustedRir: number;
  repRangeMod: number;
  substituted: boolean;
  substituteId?: string;
  rationale: string;
}

export interface AutoregulationAdjustment {
  pri: number;
  priLabel: string;
  adjustmentFactor: number;
  exerciseAdjustments: ExerciseAdjustment[];
  sessionModifications: {
    skipTraining: boolean;
    reduceDuration: boolean;
    changeFocus: string | null;
  };
  recommendations: string[];
  breakdown: { factor: string; impact: number; rationale: string }[];
}

// PRI thresholds
const PRI_THRESHOLDS = [
  { min: 0, max: 30, label: 'Критическое', volumeMod: 0.40, rirAdd: 3, skipTraining: true, desc: 'Рекомендуется пропуск тренировки' },
  { min: 30, max: 50, label: 'Низкое', volumeMod: 0.60, rirAdd: 2, skipTraining: false, desc: 'Восстановительный режим' },
  { min: 50, max: 70, label: 'Среднее', volumeMod: 0.80, rirAdd: 1, skipTraining: false, desc: 'Консервативный режим' },
  { min: 70, max: 85, label: 'Хорошее', volumeMod: 0.95, rirAdd: 0, skipTraining: false, desc: 'Нормальный режим' },
  { min: 85, max: 101, label: 'Отличное', volumeMod: 1.00, rirAdd: -0.5, skipTraining: false, desc: 'Полная интенсивность' },
];

export function calculatePRI(readiness: ReadinessScores, doms: number, sleepQuality: number, stress: number): number {
  const rec = readiness.recovery / 100;
  const fat = (100 - readiness.fatigue) / 100;
  const dom = Math.max(0, 1 - doms / 10);
  const slp = sleepQuality / 10;
  const str = Math.max(0, 1 - stress / 10);

  const pri = (rec * 0.30 + fat * 0.25 + dom * 0.20 + slp * 0.15 + str * 0.10) * 100;
  return Math.max(0, Math.min(100, Math.round(pri)));
}

export function getPRIThreshold(pri: number) {
  for (const t of PRI_THRESHOLDS) {
    if (pri >= t.min && pri < t.max) return t;
  }
  return PRI_THRESHOLDS[3];
}

export function autoregulate(input: AutoregulationInput): AutoregulationAdjustment {
  const pri = calculatePRI(input.readiness, input.doms, input.sleepQuality, input.stress);
  const threshold = getPRIThreshold(pri);
  const breakdown: { factor: string; impact: number; rationale: string }[] = [];

  // Recovery impact
  const recImpact = threshold.volumeMod;
  breakdown.push({
    factor: 'Восстановление',
    impact: Math.round((1 - recImpact) * -100),
    rationale: `PRI ${pri} (${threshold.label}): ${threshold.desc}`,
  });

  // Fatigue from training load
  let loadMod = 1.0;
  if (input.trainingLoadRatio > 1.2) {
    loadMod = 0.85;
    breakdown.push({ factor: 'Перегрузка', impact: -15, rationale: `TrainingLoadRatio ${input.trainingLoadRatio.toFixed(2)} > 1.2 → -15%` });
  } else if (input.trainingLoadRatio < 0.5) {
    breakdown.push({ factor: 'Недогрузка', impact: 5, rationale: `TrainingLoadRatio ${input.trainingLoadRatio.toFixed(2)} < 0.5 → можно увеличить` });
  }

  // Recent performance trends
  let perfMod = 1.0;
  if (input.lastSessionRPE !== undefined) {
    if (input.lastSessionRPE >= 9) {
      perfMod = 0.90;
      breakdown.push({ factor: 'Высокий RPE', impact: -10, rationale: `Последняя сессия RPE ${input.lastSessionRPE} ≥ 9 → -10%` });
    } else if (input.lastSessionRPE <= 4) {
      perfMod = 1.10;
      breakdown.push({ factor: 'Низкий RPE', impact: 10, rationale: `Последняя сессия RPE ${input.lastSessionRPE} ≤ 4 → можно повысить` });
    }
  }

  if (input.strengthTrend === 'down') {
    perfMod *= 0.90;
    breakdown.push({ factor: 'Спад силы', impact: -10, rationale: 'Тренд силы вниз → -10%' });
  }

  // Technique issues
  let techniqueMod = 1.0;
  if (input.techniqueIssues && input.techniqueIssues.length > 0) {
    techniqueMod = Math.max(0.75, 1.0 - input.techniqueIssues.length * 0.05);
    breakdown.push({
      factor: 'Техника',
      impact: Math.round((techniqueMod - 1) * 100),
      rationale: `${input.techniqueIssues.length} проблем с техникой → ${Math.round((1 - techniqueMod) * 100)}% снижение`,
    });
  }

  // Injury adjustments
  if (input.injuries && input.injuries.length > 0) {
    const sevMap: Record<string, number> = { mild: 0.05, moderate: 0.15, severe: 0.25 };
    let injuryPenalty = 0;
    for (const inj of input.injuries) {
      injuryPenalty += sevMap[inj.severity || 'mild'] || 0.05;
    }
    injuryPenalty = Math.min(0.4, injuryPenalty);
    breakdown.push({
      factor: 'Травмы',
      impact: Math.round(-injuryPenalty * 100),
      rationale: `${input.injuries.length} травм → -${Math.round(injuryPenalty * 100)}%`,
    });
  }

  const adjustmentFactor = Math.max(0.3, Math.min(1.0, recImpact * loadMod * perfMod * techniqueMod));

  const exerciseAdjustments: ExerciseAdjustment[] = [];
  for (const ex of input.plannedExercises) {
    let adjustedSets = Math.max(1, Math.round(ex.sets * adjustmentFactor));
    let adjustedRir = Math.max(0, Math.round(ex.rir + threshold.rirAdd));
    let repRangeMod = 0;

    // Weak groups get volume priority
    if (ex.isWeakGroup) {
      adjustedSets = Math.max(2, adjustedSets + 1);
    }

    // Fatigue cost adjustment
    if (ex.type === 'compound' && adjustmentFactor < 0.7) {
      adjustedSets = Math.max(1, adjustedSets - 1);
    }

    // Technique-based substitution recommendation
    let substituted = false;
    let substituteId: string | undefined;
    let rationale = `${ex.name}: сеты ${ex.sets}→${adjustedSets}, RIR ${ex.rir}→${adjustedRir}`;
    if (ex.techniqueScore !== undefined && ex.techniqueScore < 5 && input.level !== 'beginner') {
      substituted = true;
      substituteId = ex.exerciseId + '_variant';
      rationale += `. Техника ${ex.techniqueScore}/10 → рекомендована замена`;
    }

    exerciseAdjustments.push({
      exerciseId: ex.exerciseId,
      originalSets: ex.sets,
      adjustedSets,
      originalRir: ex.rir,
      adjustedRir,
      repRangeMod,
      substituted,
      substituteId,
      rationale,
    });
  }

  // Session-level modifications
  const sessionModifications = {
    skipTraining: threshold.skipTraining || adjustmentFactor < 0.35,
    reduceDuration: adjustmentFactor < 0.7 && !threshold.skipTraining,
    changeFocus: null as string | null,
  };

  // Focus change recommendation based on weak points and readiness
  if (input.weakPoints.length > 0 && pri >= 70) {
    sessionModifications.changeFocus = input.weakPoints[0];
  }

  const recommendations: string[] = [];
  if (sessionModifications.skipTraining) {
    recommendations.push(`PRI ${pri} — рекомендуется пропуск тренировки или замена на лёгкую активность`);
  } else if (adjustmentFactor < 0.6) {
    recommendations.push(`Объём снижен на ${Math.round((1 - adjustmentFactor) * 100)}%. Фокус на технику, без отказов`);
  }
  if (input.strengthTrend === 'down' && pri > 60) {
    recommendations.push('Тренд силы вниз при хорошем PRI — проверьте восстановление и питание');
  }
  if (input.techniqueIssues && input.techniqueIssues.length > 0) {
    recommendations.push(`${input.techniqueIssues.length} проблем${input.techniqueIssues.length === 1 ? 'а' : ''} с техникой: ${input.techniqueIssues.join(', ')}`);
  }

  return {
    pri,
    priLabel: threshold.label,
    adjustmentFactor,
    exerciseAdjustments,
    sessionModifications,
    recommendations,
    breakdown,
  };
}

export function getAutoregulationRecommendation(adjustment: AutoregulationAdjustment): string {
  const parts: string[] = [];
  if (adjustment.sessionModifications.skipTraining) {
    parts.push('❌ Пропустить тренировку');
  } else {
    parts.push(`PRI ${adjustment.pri} (${adjustment.priLabel})`);
    parts.push(`Фактор: ${(adjustment.adjustmentFactor * 100).toFixed(0)}%`);
    if (adjustment.adjustmentFactor < 0.7) {
      parts.push('Консервативный режим');
    } else if (adjustment.adjustmentFactor > 0.95) {
      parts.push('Полная интенсивность');
    }
  }
  return parts.join(' · ');
}
