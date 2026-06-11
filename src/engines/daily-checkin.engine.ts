/**
 * Daily Check-in Engine — Morning assessment + training readiness
 *
 * Combines sleep, HRV, subjective metrics, and training history
 * to produce a single readiness score and training recommendation.
 *
 * Also includes: water tracking, body weight trend, sleep debt calculation.
 *
 * @module daily-checkin-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface CheckinInput {
  sleepHours: number;
  sleepQuality: number;      // 1-5
  restingHR: number;         // bpm
  hrvMs: number;             // rmssd in ms
  bodyWeight: number;        // kg
  subjectiveEnergy: number;  // 1-5
  subjectiveSoreness: number; // 1-5 (higher = more sore)
  subjectiveStress: number;  // 1-5
  waterLiters: number;
  nutritionQuality: number;  // 1-5
  trainingYesterday: boolean;
  yesterdayRPE: number;      // 1-10
  sleepDebtHours: number;    // accumulated sleep deficit
  weightTrend: number;       // 7-day avg change in kg
}

export interface CheckinOutput {
  readinessScore: number;      // 0-100
  readinessLabel: 'Отлично' | 'Хорошо' | 'Средне' | 'Низко' | 'Критично';
  trainToday: boolean;
  intensityModifier: number;   // -0.25 to +0.10
  volumeModifier: number;      // -0.40 to +0.15
  recommendations: string[];
  metrics: {
    sleepScore: number;
    hrvScore: number;
    fatigueScore: number;
    recoveryScore: number;
    hydrationScore: number;
    nutritionScore: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Scoring functions
// ═══════════════════════════════════════════════════════════════════════════

function scoreSleep(hours: number, quality: number, debt: number): { score: number; msg: string } {
  let score = 50;
  const msgs: string[] = [];

  if (hours >= 8) score += 25;
  else if (hours >= 7) { score += 15; msgs.push('Сон <8ч'); }
  else if (hours >= 6) { score += 5; msgs.push('Недосып'); }
  else { score -= 15; msgs.push('Критический недосып'); }

  score += (quality - 3) * 6;

  if (debt > 5) { score -= 15; msgs.push(`Долг сна ${debt.toFixed(0)}ч`); }
  else if (debt > 2) score -= 5;

  return { score: Math.max(0, Math.min(100, score)), msg: msgs.join('; ') || '✅' };
}

function scoreHRV(rmssd: number, rhr: number): { score: number; msg: string } {
  let score = 50;
  const msgs: string[] = [];

  if (rmssd >= 60) score += 25;
  else if (rmssd >= 40) { score += 12; msgs.push('HRV снижен'); }
  else if (rmssd >= 25) score += 0;
  else { score -= 10; msgs.push('HRV критичен'); }

  if (rhr <= 55) score += 15;
  else if (rhr <= 65) score += 5;
  else if (rhr <= 75) score -= 5;
  else { score -= 15; msgs.push('Пульс повышен'); }

  return { score: Math.max(0, Math.min(100, score)), msg: msgs.join('; ') || '✅' };
}

function scoreSubjective(energy: number, soreness: number, stress: number): { score: number; msg: string } {
  let score = (energy - 1) * 15 + (5 - soreness) * 10 + (5 - stress) * 5;
  const msgs: string[] = [];
  if (energy <= 2) msgs.push('Низкая энергия');
  if (soreness >= 4) msgs.push('Сильная крепатура');
  if (stress >= 4) msgs.push('Высокий стресс');
  return { score: Math.max(0, Math.min(100, score)), msg: msgs.join('; ') || '✅' };
}

function scoreHydration(waterL: number, weight: number): { score: number; msg: string } {
  const target = weight * 0.033;
  const ratio = waterL / target;
  if (ratio >= 0.9) return { score: 85, msg: '✅' };
  if (ratio >= 0.7) return { score: 60, msg: 'Пейте больше воды' };
  return { score: 30, msg: 'Обезвоживание' };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Engine
// ═══════════════════════════════════════════════════════════════════════════

export function dailyCheckin(input: CheckinInput): CheckinOutput {
  const sleep = scoreSleep(input.sleepHours, input.sleepQuality, input.sleepDebtHours);
  const hrv = scoreHRV(input.hrvMs, input.restingHR);
  const subj = scoreSubjective(input.subjectiveEnergy, input.subjectiveSoreness, input.subjectiveStress);
  const hydr = scoreHydration(input.waterLiters, input.bodyWeight);
  const nutritionScore = Math.round((input.nutritionQuality - 1) * 20 + 20);

  // Fatigue: yesterday's training + subjective soreness
  const fatigueScore = Math.min(100, input.yesterdayRPE * 8 + (input.subjectiveSoreness - 1) * 15);

  // Recovery: sleep + HRV
  const recoveryScore = Math.round(sleep.score * 0.5 + hrv.score * 0.5);

  // Readiness = weighted sum
  const readiness = Math.round(
    sleep.score * 0.25 +
    hrv.score * 0.20 +
    subj.score * 0.20 +
    hydr.score * 0.10 +
    nutritionScore * 0.10 +
    (100 - fatigueScore) * 0.15
  );

  // Label
  let label: CheckinOutput['readinessLabel'] = 'Средне';
  if (readiness >= 80) label = 'Отлично';
  else if (readiness >= 65) label = 'Хорошо';
  else if (readiness >= 45) label = 'Средне';
  else if (readiness >= 25) label = 'Низко';
  else label = 'Критично';

  // Training decision
  let trainToday = true;
  let intensityMod = 0;
  let volumeMod = 0;
  const recs: string[] = [];

  if (readiness < 25) {
    trainToday = false;
    recs.push('Критически низкая готовность — день отдыха');
  } else if (readiness < 40 && input.subjectiveSoreness >= 4) {
    trainToday = true;
    intensityMod = -0.20;
    volumeMod = -0.30;
    recs.push('Низкая готовность + крепатура — лёгкая тренировка');
  } else if (readiness < 50) {
    intensityMod = -0.10;
    volumeMod = -0.15;
    recs.push('Пониженная готовность — снизьте нагрузку');
  } else if (readiness >= 80 && fatigueScore < 30) {
    intensityMod = 0.05;
    recs.push('Отличная готовность — можно увеличить интенсивность');
  }

  if (input.sleepHours < 6) recs.push('Приоритет: сон 7-9 часов');
  if (input.waterLiters < input.bodyWeight * 0.025) recs.push(`Пейте больше воды (цель: ${Math.round(input.bodyWeight * 0.033)}л)`);
  if (input.sleepDebtHours > 3) recs.push('Накоплен долг сна — ложитесь раньше на этой неделе');
  if (input.restingHR > 70) recs.push('Повышен пульс покоя — проверьте восстановление');
  if (sleep.msg !== '✅') recs.push(`Сон: ${sleep.msg}`);
  if (hrv.msg !== '✅') recs.push(`HRV: ${hrv.msg}`);

  return {
    readinessScore: readiness,
    readinessLabel: label,
    trainToday,
    intensityModifier: Math.round(intensityMod * 100) / 100,
    volumeModifier: Math.round(volumeMod * 100) / 100,
    recommendations: recs,
    metrics: {
      sleepScore: sleep.score,
      hrvScore: hrv.score,
      fatigueScore,
      recoveryScore,
      hydrationScore: hydr.score,
      nutritionScore,
    },
  };
}
