import { ReadinessInput, ReadinessScores } from '../core/types';

export function calcReadiness(input: ReadinessInput): ReadinessScores {
  // 1. Sleep Score
  const sleepHours = Math.min(input.sleepHours, 9);
  const awakenings = Math.min(input.nightAwakenings, 5);
  const sleepScore = Math.min(100, (sleepHours / 8 * 50) + (input.sleepQuality * 5) - (awakenings * 10));

  // 2. HRV Ratio (clamped 0.5–1.5)
  const hrvClamped = Math.max(0.5, Math.min(1.5, input.hrvRatio));

  // 3. DOMS penalty
  let recoveryBase = (sleepScore * 0.4) + (hrvClamped * 100 * 0.3) - (input.doms * 2) - (input.stress);
  if (input.doms > 8) recoveryBase *= 0.9;
  const recovery = Math.max(0, Math.min(100, recoveryBase));

  // 4. Nutrition Score
  const calR = Math.min(1, Math.max(0.5, input.calRatio));
  const proteinR = Math.min(1, input.proteinRatio);
  const waterR = Math.min(1, input.waterRatio);
  const fiberR = Math.min(1, input.fiberRatio);
  const omega = input.omega3Flag ? 0.1 : 0;
  const nutrition = (calR * 0.3 + proteinR * 0.25 + waterR * 0.2 + fiberR * 0.15 + omega) * 100;

  // 5. Support Score (ТЗ формула: 100 × (1 - ∏(1 - coverage_m)))
  let product = 1;
  Object.values(input.riskCoverageMap).forEach(c => {
    const coverage = Math.max(0, Math.min(1, c));
    product *= (1 - coverage);
  });
  const support = Math.max(0, Math.min(100, 100 * (1 - product)));

  // 6. Fatigue Score
  const tl = Math.min(1, Math.max(0, input.trainingLoadRatio));
  const sf = Math.min(1, Math.max(0, input.subjFatigue / 10));
  const hrInc = Math.min(1, Math.max(0, input.hrIncrease));
  const fatigue = Math.max(0, Math.min(100, (tl * 0.5 + sf * 0.3 + hrInc * 0.2) * 100));

  // 7. Консервативный режим (ТЗ §3.2)
  let isConservative = false;
  let reason = '';
  if (recovery < 40) { isConservative = true; reason = 'Recovery < 40'; }
  else if (fatigue > 70) { isConservative = true; reason = 'Fatigue > 70'; }
  else if (nutrition < 50) { isConservative = true; reason = 'Nutrition < 50'; }

  return {
    recovery: Math.round(recovery),
    nutrition: Math.round(nutrition),
    support: Math.round(support),
    fatigue: Math.round(fatigue),
    isConservative,
    conservativeReason: reason
  };
}