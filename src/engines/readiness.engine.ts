import { ReadinessInput, ReadinessScores } from '../core/types';

export function calcReadiness(i: ReadinessInput): ReadinessScores {
  const sleepH = Math.min(i.sleepHours, 9);
  const awak = Math.min(i.nightAwakenings, 5);
  const sleepScore = Math.min(100, (sleepH / 8 * 50) + (i.sleepQuality * 5) - (awak * 10));
  
  const hrv = Math.max(0.5, Math.min(1.5, i.hrvRatio));
  let rec = (sleepScore * 0.4) + (hrv * 100 * 0.3) - (i.doms * 2) - i.stress;
  if (i.doms > 8) rec *= 0.9;
  rec = Math.max(0, Math.min(100, rec));

  const cal = Math.min(1, Math.max(0.5, i.calRatio));
  const pro = Math.min(1, i.proteinRatio);
  const wat = Math.min(1, i.waterRatio);
  const fib = Math.min(1, i.fiberRatio);
  const nut = (cal * 0.3 + pro * 0.25 + wat * 0.2 + fib * 0.15 + (i.omega3Flag ? 0.1 : 0)) * 100;

  let prod = 1;
  (Object.values(i.riskCoverageMap || {}) as number[]).forEach(c => prod *= (1 - Math.max(0, Math.min(1, c))));
  const sup = Math.max(0, Math.min(100, 100 * (1 - prod)));

  const tl = Math.min(1, Math.max(0, i.trainingLoadRatio));
  const sf = Math.min(1, Math.max(0, i.subjFatigue / 10));
  const hr = Math.min(1, Math.max(0, i.hrIncrease));
  const fat = Math.max(0, Math.min(100, (tl * 0.5 + sf * 0.3 + hr * 0.2) * 100));

  let cons = false, reason = '';
  if (rec < 40) { cons = true; reason = 'Восстановление < 40'; }
  else if (fat > 70) { cons = true; reason = 'Усталость > 70'; }
  else if (nut < 50) { cons = true; reason = 'Питание < 50'; }

  return { recovery: Math.round(rec), nutrition: Math.round(nut), support: Math.round(sup), fatigue: Math.round(fat), isConservative: cons, conservativeReason: reason };
}