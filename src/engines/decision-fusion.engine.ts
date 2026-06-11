/**
 * Decision Fusion Engine — Combines ML, heuristics, rules, and context.
 *
 * Merges decisions from:
 *  - Autoregulation Engine (intensity/volume/frequency/exercise)
 *  - Recommendation Engine (technique/load/variation)
 *  - Risk Engine (safety flags)
 *  - Prediction Engine (forecasts)
 *
 * Produces a single unified training action plan.
 *
 * @module decision-fusion-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface DecisionSource {
  type: 'autoreg' | 'recommendation' | 'risk' | 'prediction' | 'rule' | 'coach';
  priority: number; // 0-100
  confidence: number; // 0-1
}

export interface TrainingAction {
  actionType: 'modify_intensity' | 'modify_volume' | 'modify_frequency' |
    'replace_exercise' | 'add_exercise' | 'remove_exercise' |
    'add_deload' | 'stop_session' | 'downgrade_session' | 'add_recovery' |
    'continue_normal' | 'adjust_technique' | 'adjust_tempo';
  target?: string;
  value?: number;
  reason: string;
  source: string;
  priority: number;
}

export interface FusedDecision {
  actions: TrainingAction[];
  sessionPlan: {
    intensityModifier: number;
    volumeModifier: number;
    frequencyModifier: number;
    exerciseModifications: string[];
  };
  overallRecommendation: string;
  riskFlags: string[];
  readinessAssessment: string;
}

export interface FusionInput {
  priScore: number;
  riskLevel: string;
  riskFlags: string[];
  techniqueScore: number;
  techniqueErrors: string[];
  fatigueScore: number;
  recoveryScore: number;
  acwr: number;
  monotony: number;
  volumeCapacity: number;
  intensityCapacity: number;
  trainingAge: number; // years
  goal: string;
  upcomingCompetition: boolean;
  injuryHistory: string[];
  recentPR: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// Heuristic Rules Database
// ═══════════════════════════════════════════════════════════════════════════

interface HeuristicRule {
  condition: (input: FusionInput) => boolean;
  action: TrainingAction;
}

const HEURISTIC_RULES: HeuristicRule[] = [
  // Safety: always override
  {
    condition: (i) => i.riskLevel === 'high' && i.priScore < 0.25,
    action: { actionType: 'stop_session', reason: 'Критический риск + низкая готовность — тренировка отменена', source: 'risk+pri', priority: 100 },
  },
  {
    condition: (i) => i.riskLevel === 'high' && i.priScore >= 0.25,
    action: { actionType: 'downgrade_session', reason: 'Высокий риск — тренировка понижена', source: 'risk', priority: 95 },
  },
  // Deload triggers
  {
    condition: (i) => i.acwr > 1.5 || (i.monotony > 2.5 && i.fatigueScore > 0.7),
    action: { actionType: 'add_deload', reason: 'ACWR > 1.5 или монотонность > 2.5 + усталость — deload', source: 'analytics', priority: 85 },
  },
  // Technique priority
  {
    condition: (i) => i.techniqueScore < 0.4 && i.techniqueErrors.length > 2,
    action: { actionType: 'adjust_technique', reason: 'Критическая техника — focus на качестве, а не весе', source: 'technique', priority: 88 },
  },
  {
    condition: (i) => i.techniqueScore < 0.5,
    action: { actionType: 'adjust_tempo', reason: 'Техника < 0.5 — используйте медленный темп (4-2-2-1)', source: 'technique', priority: 75 },
  },
  // Intensity adjustments
  {
    condition: (i) => i.intensityCapacity < 0.5,
    action: { actionType: 'modify_intensity', value: -0.10, reason: 'Низкая ёмкость интенсивности — снижение на 10%', source: 'autoreg', priority: 65 },
  },
  {
    condition: (i) => i.intensityCapacity > 1.1 && i.priScore > 0.7 && i.fatigueScore < 0.3,
    action: { actionType: 'modify_intensity', value: 0.05, reason: 'Высокая ёмкость + готовность — можно увеличить на 5%', source: 'autoreg', priority: 50 },
  },
  // Volume adjustments
  {
    condition: (i) => i.volumeCapacity < 0.5,
    action: { actionType: 'modify_volume', value: -0.25, reason: 'Низкая ёмкость объёма — снижение на 25%', source: 'autoreg', priority: 65 },
  },
  {
    condition: (i) => i.fatigueScore > 0.8 && i.recoveryScore < 0.3,
    action: { actionType: 'modify_volume', value: -0.30, reason: 'Высокая усталость + низкое восстановление — объём -30%', source: 'fatigue', priority: 80 },
  },
  // Recovery
  {
    condition: (i) => i.recoveryScore < 0.2,
    action: { actionType: 'add_recovery', reason: 'Критически низкое восстановление — активный отдых, сон, питание', source: 'recovery', priority: 90 },
  },
  // Frequency
  {
    condition: (i) => i.fatigueScore > 0.75,
    action: { actionType: 'modify_frequency', value: -1, reason: 'Высокая усталость — уменьшить частоту', source: 'autoreg', priority: 60 },
  },
  // Competition mode
  {
    condition: (i) => i.upcomingCompetition,
    action: { actionType: 'continue_normal', reason: 'Соревнования скоро — taper mode, не меняем программу', source: 'coach', priority: 70 },
  },
  // Newbie protection
  {
    condition: (i) => i.trainingAge < 1,
    action: { actionType: 'modify_intensity', value: -0.05, reason: 'Стаж < 1 года — консервативная интенсивность', source: 'rule', priority: 50 },
  },
  // Recent PR → momentum
  {
    condition: (i) => i.recentPR,
    action: { actionType: 'continue_normal', reason: 'Недавний PR — продолжайте текущую программу', source: 'prediction', priority: 45 },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Conflict Resolution
// ═══════════════════════════════════════════════════════════════════════════

function resolveConflicts(actions: TrainingAction[]): TrainingAction[] {
  const resolved: TrainingAction[] = [];
  const usedTypes = new Set<string>();

  // Sort by priority descending
  const sorted = [...actions].sort((a, b) => b.priority - a.priority);

  for (const action of sorted) {
    // Conflict: multiple intensity adjustments — take highest priority
    if (action.actionType === 'modify_intensity') {
      if (usedTypes.has('modify_intensity')) continue;
      usedTypes.add('modify_intensity');
    }
    if (action.actionType === 'modify_volume') {
      if (usedTypes.has('modify_volume')) continue;
      usedTypes.add('modify_volume');
    }
    if (action.actionType === 'modify_frequency') {
      if (usedTypes.has('modify_frequency')) continue;
      usedTypes.add('modify_frequency');
    }
    // Stopping always wins
    if (action.actionType === 'stop_session') {
      resolved.length = 0;
      resolved.push(action);
      return resolved;
    }
    resolved.push(action);
  }

  return resolved;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Engine
// ═══════════════════════════════════════════════════════════════════════════

export function fuseDecisions(input: FusionInput): FusedDecision {
  const actions: TrainingAction[] = [];

  // Apply all matching heuristic rules
  for (const rule of HEURISTIC_RULES) {
    if (rule.condition(input)) {
      actions.push({ ...rule.action });
    }
  }

  // Resolve conflicts
  const resolved = resolveConflicts(actions);

  // Build session plan modifiers
  const intensityMod = resolved.filter(a => a.actionType === 'modify_intensity').reduce((s, a) => s + (a.value || 0), 0);
  const volumeMod = resolved.filter(a => a.actionType === 'modify_volume').reduce((s, a) => s + (a.value || 0), 0);
  const frequencyMod = resolved.filter(a => a.actionType === 'modify_frequency').reduce((s, a) => s + (a.value || 0), 0);
  const exerciseMods = resolved.filter(a => a.actionType === 'replace_exercise' || a.actionType === 'add_exercise' || a.actionType === 'remove_exercise');

  const hasStop = resolved.some(a => a.actionType === 'stop_session');
  const hasDowngrade = resolved.some(a => a.actionType === 'downgrade_session');

  let readiness = '';
  if (input.priScore > 0.7) readiness = '🟢 Высокая готовность — можно работать';
  else if (input.priScore > 0.4) readiness = '🟡 Умеренная готовность — стандартный режим';
  else readiness = '🔴 Низкая готовность — требуется снижение нагрузки';

  let recommendation = '';
  if (hasStop) recommendation = '🔴 ТРЕНИРОВКА ОТМЕНЕНА. Приоритет: восстановление и безопасность.';
  else if (hasDowngrade) recommendation = '🟡 ТРЕНИРОВКА ПОНИЖЕНА. Сниженный объём и интенсивность.';
  else if (resolved.length === 0) recommendation = '✅ Все системы в норме. Продолжайте по плану.';
  else recommendation = `Применено ${resolved.length} корректировок. ${resolved.map(a => a.reason).join('; ')}.`;

  return {
    actions: resolved,
    sessionPlan: {
      intensityModifier: Math.round(intensityMod * 100) / 100,
      volumeModifier: Math.round(volumeMod * 100) / 100,
      frequencyModifier: Math.round(frequencyMod),
      exerciseModifications: exerciseMods.map(a => a.reason),
    },
    overallRecommendation: recommendation,
    riskFlags: resolved.filter(a => a.actionType === 'stop_session' || a.actionType === 'downgrade_session').map(a => a.reason),
    readinessAssessment: readiness,
  };
}

/**
 * Quick check: should we train today?
 */
export function shouldTrainToday(
  priScore: number,
  riskLevel: string,
  fatigueScore: number,
  recoveryScore: number,
): { train: boolean; intensityMod: number; reason: string } {
  if (riskLevel === 'high' && priScore < 0.25) {
    return { train: false, intensityMod: 0, reason: 'Высокий риск + низкая готовность — пропустите тренировку' };
  }
  if (fatigueScore > 0.85) {
    return { train: false, intensityMod: 0, reason: 'Критическая усталость — день отдыха' };
  }
  if (priScore < 0.3 && recoveryScore < 0.2) {
    return { train: false, intensityMod: 0, reason: 'Низкая готовность и восстановление — активный отдых' };
  }
  if (priScore < 0.4) {
    return { train: true, intensityMod: -0.15, reason: 'Тренировка с пониженной интенсивностью (-15%)' };
  }
  if (priScore > 0.75 && fatigueScore < 0.3) {
    return { train: true, intensityMod: 0.05, reason: 'Отличная готовность — можно добавить 5% интенсивности' };
  }
  return { train: true, intensityMod: 0, reason: 'Стандартная тренировка' };
}
