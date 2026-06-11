/**
 * Recovery Optimization Engine — Sleep, HRV, Readiness, Periodization Sync
 *
 * Recovery metrics:
 *  - HRV-based readiness
 *  - Sleep quality & optimization
 *  - Training-readiness sync (periodization-aware)
 *  - Deload detection & scheduling
 *  - Overtraining risk assessment
 *  - Supercompensation window calculation
 *
 * @module recovery-optimization-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface SleepData {
  hours: number;
  quality: number;    // 1-5
  bedtime: string;    // "23:00"
  wakeTime: string;   // "07:00"
  latencyMin: number; // minutes to fall asleep
  awakenings: number; // times woke up
}

export interface HRVData {
  rmssd: number;      // ms
  sdnn: number;       // ms
  restingHR: number;  // bpm
  readinessScore: number; // 0-100
}

export interface RecoveryInput {
  sleep: SleepData;
  hrv: HRVData;
  fatigueScore: number;
  trainingDaysThisWeek: number;
  currentWeek: number;
  periodizationPhase: 'accumulation' | 'intensification' | 'peaking' | 'deload';
  recentPR: boolean;
  injuryHistory: string[];
}

export interface RecoveryOutput {
  overallRecoveryIndex: number; // 0-100
  sleepScore: number;
  hrvScore: number;
  readinessScore: number;
  deloadRecommended: boolean;
  deloadReason: string;
  overtrainingRisk: number; // 0-100
  supercompensationHours: number;
  recommendations: string[];
  readinessLabel: 'Отлично' | 'Хорошо' | 'Средне' | 'Низко' | 'Критично';
}

// ═══════════════════════════════════════════════════════════════════════════
// Sleep Scoring
// ═══════════════════════════════════════════════════════════════════════════

function scoreSleep(sleep: SleepData): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 50;

  // Duration
  if (sleep.hours >= 7.5 && sleep.hours <= 9) score += 25;
  else if (sleep.hours >= 6) { score += 10; issues.push('Недостаточно сна (< 7.5ч)'); }
  else { score -= 10; issues.push('Критический недосып (< 6ч)'); }

  // Quality
  score += (sleep.quality - 3) * 5;

  // Latency
  if (sleep.latencyMin <= 20) score += 10;
  else if (sleep.latencyMin <= 40) score += 3;
  else { score -= 5; issues.push('Долгое засыпание (> 40мин)'); }

  // Awakenings
  if (sleep.awakenings <= 1) score += 5;
  else { score -= sleep.awakenings * 3; issues.push(`${sleep.awakenings} пробуждений за ночь`); }

  // Consistency
  const bed = sleep.bedtime.split(':').map(Number);
  const wake = sleep.wakeTime.split(':').map(Number);
  if (bed[0] >= 0 && wake[0] >= 0) {
    const mid = (bed[0] + wake[0] + 24) / 2;
    if (mid >= 2 && mid <= 4) score += 5; // optimal midpoint 2-4am
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

// ═══════════════════════════════════════════════════════════════════════════
// HRV Scoring
// ═══════════════════════════════════════════════════════════════════════════

function scoreHRV(hrv: HRVData): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 50;

  // RMSSD
  if (hrv.rmssd >= 50) score += 25;
  else if (hrv.rmssd >= 35) score += 10;
  else { score -= 5; issues.push(`Низкий RMSSD: ${hrv.rmssd}мс`); }

  // Resting HR
  if (hrv.restingHR <= 60) score += 15;
  else if (hrv.restingHR <= 70) score += 5;
  else { score -= 10; issues.push(`Повышенный пульс покоя: ${hrv.restingHR} уд/мин`); }

  // Readiness
  score += (hrv.readinessScore - 50) * 0.2;

  return { score: Math.max(0, Math.min(100, score)), issues };
}

// ═══════════════════════════════════════════════════════════════════════════
// Overtraining Detection
// ═══════════════════════════════════════════════════════════════════════════

function detectOvertraining(
  sleepScore: number, hrvScore: number, fatigueScore: number,
  trainingDays: number, phase: string, recentPR: boolean,
): { risk: number; reason: string } {
  let signals = 0;
  const reasons: string[] = [];

  if (sleepScore < 40) { signals++; reasons.push('Сон < 40 баллов'); }
  if (hrvScore < 40) { signals++; reasons.push('HRV < 40 баллов'); }
  if (fatigueScore > 0.7) { signals++; reasons.push('Усталость > 0.7'); }
  if (trainingDays >= 6) { signals++; reasons.push('6+ тренировок/нед'); }
  if (phase === 'intensification' && fatigueScore > 0.6) { signals++; reasons.push('Интенсификация + усталость'); }
  if (recentPR && fatigueScore > 0.5) { signals++; reasons.push('Недавний PR + усталость'); }

  const risk = Math.min(100, signals * 20 + fatigueScore * 30);
  return { risk: Math.round(risk), reason: reasons.join('; ') || 'Нет признаков' };
}

// ═══════════════════════════════════════════════════════════════════════════
// Supercompensation Window
// ═══════════════════════════════════════════════════════════════════════════

function calcSupercompensation(fatigueScore: number, sleepScore: number, hrvScore: number): number {
  const base = 24 + fatigueScore * 48;
  const recoveryMod = (sleepScore + hrvScore) / 200;
  return Math.round(base * (1.5 - recoveryMod));
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Engine
// ═══════════════════════════════════════════════════════════════════════════

export function analyzeRecovery(input: RecoveryInput): RecoveryOutput {
  const sleep = scoreSleep(input.sleep);
  const hrv = scoreHRV(input.hrv);
  const recommendations: string[] = [];

  // Overall recovery index
  const recoveryIndex = Math.round(sleep.score * 0.3 + hrv.score * 0.3
    + (100 - input.fatigueScore * 100) * 0.3 + 10);

  // Readiness label
  let readinessLabel: RecoveryOutput['readinessLabel'] = 'Средне';
  if (recoveryIndex >= 80) readinessLabel = 'Отлично';
  else if (recoveryIndex >= 60) readinessLabel = 'Хорошо';
  else if (recoveryIndex >= 40) readinessLabel = 'Средне';
  else if (recoveryIndex >= 20) readinessLabel = 'Низко';
  else readinessLabel = 'Критично';

  // Overtraining
  const ot = detectOvertraining(sleep.score, hrv.score, input.fatigueScore, input.trainingDaysThisWeek, input.periodizationPhase, input.recentPR);

  // Supercompensation
  const supercomp = calcSupercompensation(input.fatigueScore, sleep.score, hrv.score);

  // Deload recommendation
  let deloadRecommended = false;
  let deloadReason = '';
  if (input.periodizationPhase !== 'deload' && input.currentWeek >= 4 && recoveryIndex < 35) {
    deloadRecommended = true;
    deloadReason = `Неделя ${input.currentWeek}, восстановление ${recoveryIndex}% — запланируйте deload`;
  }
  if (ot.risk >= 70) {
    deloadRecommended = true;
    deloadReason = `Риск перетренированности ${ot.risk}% — срочный deload`;
  }
  if (input.periodizationPhase === 'deload') {
    deloadRecommended = false;
    deloadReason = 'Уже в фазе deload';
  }

  // Recommendations
  if (sleep.score < 50) {
    recommendations.push('Приоритет: нормализация сна. Мелатонин 3-5мг, магний 400мг бисглицинат, экранный детокс за 1ч до сна.');
  }
  if (hrv.score < 50) {
    recommendations.push('HRV снижен — добавьте дыхательные практики (4-7-8), лёгкое кардио 20-30мин.');
  }
  if (input.fatigueScore > 0.7 && input.periodizationPhase !== 'deload') {
    recommendations.push('Высокая усталость — снизьте объём на 30% или добавьте день отдыха.');
  }
  if (deloadRecommended) {
    recommendations.push(deloadReason);
  }

  return {
    overallRecoveryIndex: recoveryIndex,
    sleepScore: sleep.score,
    hrvScore: hrv.score,
    readinessScore: input.hrv.readinessScore,
    deloadRecommended,
    deloadReason: deloadReason || 'Deload не требуется',
    overtrainingRisk: ot.risk,
    supercompensationHours: supercomp,
    recommendations,
    readinessLabel,
  };
}

/**
 * Quick check: should we train today based on recovery?
 */
export function shouldTrain(recoveryIndex: number, fatigueScore: number): { train: boolean; intensityMod: number; message: string } {
  if (recoveryIndex < 20) {
    return { train: false, intensityMod: 0, message: 'Критически низкое восстановление — день отдыха' };
  }
  if (recoveryIndex < 35 && fatigueScore > 0.7) {
    return { train: false, intensityMod: 0, message: 'Низкое восстановление + высокая усталость — активный отдых' };
  }
  if (recoveryIndex < 45) {
    return { train: true, intensityMod: -0.15, message: 'Пониженная интенсивность (-15%) — восстановление ниже нормы' };
  }
  if (recoveryIndex > 80 && fatigueScore < 0.3) {
    return { train: true, intensityMod: 0.05, message: 'Отличное восстановление — можно увеличить нагрузку' };
  }
  return { train: true, intensityMod: 0, message: 'Стандартная тренировка' };
}
