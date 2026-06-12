/**
 * Overtraining Detection System — Multi-marker analysis.
 *
 * Analyzes 12 markers simultaneously to detect overtraining syndrome:
 *  1. Performance decline (1RM trend)
 *  2. HRV suppression (rmssd < 70% baseline)
 *  3. Resting HR elevation (>10% above baseline)
 *  4. Sleep degradation (quality < 3, hours < 6)
 *  5. Mood disturbance (irritability, apathy)
 *  6. Appetite loss
 *  7. Frequent illness (>2 colds/season)
 *  8. Joint pain increase
 *  9. Training motivation drop
 * 10. RPE inflation (same weight feels harder)
 * 11. Recovery time extension
 * 12. Libido decrease
 *
 * Each marker scored 0-3. Total > 15 = overtraining likely.
 *
 * @module overtraining-detection
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface OvertrainingInput {
  performanceDecline: number;     // % change in 1RM (negative = decline)
  hrvSuppression: number;         // % below baseline
  restingHRIncrease: number;      // bpm above baseline
  sleepHours: number;
  sleepQuality: number;           // 1-5
  moodDisturbance: boolean;
  appetiteLoss: boolean;
  frequentIllness: boolean;
  jointPainIncrease: boolean;
  trainingMotivation: number;     // 1-5
  rpeInflation: boolean;          // same weight feels harder
  recoveryTimeExtension: boolean; // need more rest between sets
  libidoDecrease: boolean;
}

export interface OvertrainingOutput {
  totalScore: number;
  maxScore: number;         // 36
  riskLevel: 'none' | 'mild' | 'moderate' | 'severe' | 'critical';
  riskPercent: number;
  markers: { name: string; score: number; maxScore: number; status: 'normal' | 'warning' | 'critical' }[];
  recommendation: string;
  deloadUrgency: 'none' | 'advisory' | 'recommended' | 'required' | 'urgent';
  estimatedRecoveryWeeks: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Periodization Auto-Scheduler
// ═══════════════════════════════════════════════════════════════════════════

export interface AutoScheduleInput {
  goal: 'strength' | 'hypertrophy' | 'peaking' | 'recomposition';
  level: 'beginner' | 'intermediate' | 'advanced';
  weeksUntilGoal: number;
  currentWeek: number;
  fatigueLevel: number;
  recoveryLevel: number;
  overtrainingRisk: number;
}

export interface ScheduledWeek {
  week: number;
  phase: 'accumulation' | 'intensification' | 'peaking' | 'deload' | 'active_rest';
  volumePercent: number;    // % of baseline
  intensityPercent: number; // % of 1RM target
  rpeTarget: number;
  rirTarget: number;
  sessionsPerWeek: number;
  notes: string;
}

export interface AutoScheduleOutput {
  weeks: ScheduledWeek[];
  deloadWeeks: number[];
  peakWeek: number | null;
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Overtraining Detection Engine
// ═══════════════════════════════════════════════════════════════════════════

export function detectOvertraining(input: OvertrainingInput): OvertrainingOutput {
  const markers: OvertrainingOutput['markers'] = [];

  // 1. Performance decline (0-3)
  let perfScore = 0;
  if (input.performanceDecline < -5) perfScore = 2;
  else if (input.performanceDecline < -2) perfScore = 1;
  if (input.performanceDecline < -10) perfScore = 3;
  markers.push({ name: 'Падение 1RM', score: perfScore, maxScore: 3, status: perfScore >= 2 ? 'critical' : perfScore >= 1 ? 'warning' : 'normal' });

  // 2. HRV suppression (0-3)
  let hrvScore = 0;
  if (input.hrvSuppression > 15) hrvScore = 1;
  if (input.hrvSuppression > 25) hrvScore = 2;
  if (input.hrvSuppression > 35) hrvScore = 3;
  markers.push({ name: 'Подавление HRV', score: hrvScore, maxScore: 3, status: hrvScore >= 2 ? 'critical' : hrvScore >= 1 ? 'warning' : 'normal' });

  // 3. Resting HR (0-3)
  let hrScore = 0;
  if (input.restingHRIncrease > 5) hrScore = 1;
  if (input.restingHRIncrease > 10) hrScore = 2;
  if (input.restingHRIncrease > 15) hrScore = 3;
  markers.push({ name: 'Пульс покоя ↑', score: hrScore, maxScore: 3, status: hrScore >= 2 ? 'critical' : hrScore >= 1 ? 'warning' : 'normal' });

  // 4. Sleep (0-3)
  let sleepScore = 0;
  if (input.sleepHours < 6.5) sleepScore += 1;
  if (input.sleepHours < 5) sleepScore += 1;
  if (input.sleepQuality <= 2) sleepScore += 1;
  markers.push({ name: 'Нарушение сна', score: sleepScore, maxScore: 3, status: sleepScore >= 2 ? 'critical' : sleepScore >= 1 ? 'warning' : 'normal' });

  // 5-12. Binary markers (0-3 weighted)
  const binaryScore = (v: boolean) => v ? 3 : 0;
  markers.push({ name: 'Настроение', score: binaryScore(input.moodDisturbance), maxScore: 3, status: input.moodDisturbance ? 'warning' : 'normal' });
  markers.push({ name: 'Аппетит', score: binaryScore(input.appetiteLoss), maxScore: 3, status: input.appetiteLoss ? 'warning' : 'normal' });
  markers.push({ name: 'Частые болезни', score: binaryScore(input.frequentIllness), maxScore: 3, status: input.frequentIllness ? 'critical' : 'normal' });
  markers.push({ name: 'Боль в суставах', score: binaryScore(input.jointPainIncrease), maxScore: 3, status: input.jointPainIncrease ? 'warning' : 'normal' });
  markers.push({ name: 'Мотивация', score: input.trainingMotivation <= 2 ? 3 : input.trainingMotivation <= 3 ? 1 : 0, maxScore: 3, status: input.trainingMotivation <= 2 ? 'warning' : 'normal' });
  markers.push({ name: 'RPE инфляция', score: binaryScore(input.rpeInflation), maxScore: 3, status: input.rpeInflation ? 'critical' : 'normal' });
  markers.push({ name: 'Восстановление', score: binaryScore(input.recoveryTimeExtension), maxScore: 3, status: input.recoveryTimeExtension ? 'critical' : 'normal' });
  markers.push({ name: 'Либидо', score: binaryScore(input.libidoDecrease), maxScore: 3, status: input.libidoDecrease ? 'warning' : 'normal' });

  const total = markers.reduce((s, m) => s + m.score, 0);
  const max = 36;

  let riskLevel: OvertrainingOutput['riskLevel'] = 'none';
  if (total >= 25) riskLevel = 'critical';
  else if (total >= 18) riskLevel = 'severe';
  else if (total >= 12) riskLevel = 'moderate';
  else if (total >= 6) riskLevel = 'mild';
  else riskLevel = 'none';

  let deloadUrgency: OvertrainingOutput['deloadUrgency'] = 'none';
  if (total >= 25) deloadUrgency = 'urgent';
  else if (total >= 18) deloadUrgency = 'required';
  else if (total >= 12) deloadUrgency = 'recommended';
  else if (total >= 6) deloadUrgency = 'advisory';

  const recoveryWeeks = total >= 25 ? 3 : total >= 18 ? 2 : total >= 12 ? 1 : 0;

  return {
    totalScore: total,
    maxScore: max,
    riskLevel,
    riskPercent: Math.round((total / max) * 100),
    markers,
    recommendation: total >= 18
      ? `Критические признаки перетренированности (${total}/${max}). Немедленный deload ${recoveryWeeks} нед. Приоритет: сон, питание, снижение объёма на 60-70%.`
      : total >= 12
        ? `Умеренные признаки (${total}/${max}). Deload ${recoveryWeeks} нед, снижение объёма на 40%`
        : total >= 6
          ? `Лёгкие признаки (${total}/${max}). Мониторинг, снижение интенсивности`
          : 'Признаков перетренированности нет. Продолжайте программу.',
    deloadUrgency,
    estimatedRecoveryWeeks: recoveryWeeks,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Periodization Auto-Scheduler
// ═══════════════════════════════════════════════════════════════════════════

export function autoSchedule(input: AutoScheduleInput): AutoScheduleOutput {
  const weeks: ScheduledWeek[] = [];
  const deloadWeeks: number[] = [];
  const warnings: string[] = [];
  let peakWeek: number | null = null;

  let w = input.currentWeek + 1;
  const totalWeeks = input.weeksUntilGoal;

  // Determine phase pattern by goal
  const pattern = input.goal === 'peaking'
    ? ['accumulation', 'accumulation', 'intensification', 'deload', 'intensification', 'peaking', 'peaking', 'deload']
    : input.goal === 'strength'
      ? ['accumulation', 'accumulation', 'accumulation', 'deload', 'intensification', 'intensification', 'intensification', 'deload']
      : ['accumulation', 'accumulation', 'accumulation', 'accumulation', 'deload', 'accumulation', 'accumulation', 'deload'];

  // Adjust for level
  const deloadFreq = input.level === 'beginner' ? 6 : input.level === 'intermediate' ? 5 : 4;

  for (let i = 0; i < totalWeeks; i++) {
    let phase = pattern[i % pattern.length] as ScheduledWeek['phase'];

    // Force deload if overtraining risk high
    if (input.overtrainingRisk > 50 && i === 0) {
      phase = 'deload';
      warnings.push(`Неделя ${w}: принудительный deload (риск перетрена ${input.overtrainingRisk}%)`);
    }

    // Scheduled deload
    if (w % deloadFreq === 0 && phase !== 'deload') {
      phase = 'deload';
    }

    const params: Record<string, { vol: number; int: number; rpe: number; rir: number; sesh: number; note: string }> = {
      accumulation: { vol: 100, int: 70, rpe: 6.5, rir: 3, sesh: input.level === 'beginner' ? 3 : 4, note: 'Накопление объёма. Субмаксимальные веса, много подсобки.' },
      intensification: { vol: 75, int: 83, rpe: 8, rir: 1.5, sesh: input.level === 'beginner' ? 3 : 4, note: 'Рост интенсивности. Снижение объёма, увеличение весов.' },
      peaking: { vol: 45, int: 90, rpe: 9, rir: 0.5, sesh: 3, note: 'Максимальная специфика. Минимум объёма, максимум веса.' },
      deload: { vol: 40, int: 55, rpe: 5.5, rir: 4, sesh: 2, note: 'Восстановление ЦНС и суставов. Лёгкие веса, мобильность.' },
      active_rest: { vol: 20, int: 40, rpe: 4, rir: 6, sesh: 2, note: 'Активный отдых. Только лёгкое кардио и мобильность.' },
    };

    const p = params[phase];

    // Fatigue/recovery modifiers
    let volMod = 1.0;
    if (input.fatigueLevel > 0.7) volMod = 0.8;
    if (input.recoveryLevel < 0.3) volMod = 0.7;

    weeks.push({
      week: w,
      phase,
      volumePercent: Math.round(p.vol * volMod),
      intensityPercent: p.int,
      rpeTarget: p.rpe,
      rirTarget: p.rir,
      sessionsPerWeek: p.sesh,
      notes: p.note,
    });

    if (phase === 'deload') deloadWeeks.push(w);
    if (phase === 'peaking' && !peakWeek) peakWeek = w;

    w++;
  }

  return { weeks, deloadWeeks, peakWeek, warnings };
}
