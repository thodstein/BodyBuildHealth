import { FertilityInput, FertilityResult } from '../core/types';

export function calcFertility(i: FertilityInput): FertilityResult {
  const V = Math.min(i.volumeMl, 1.5) / 1.5;
  const C = Math.min(i.concentrationMlMln, 16) / 16;
  const T = Math.min(i.totalCountMln, 39) / 39;
  const PR = Math.min(i.prPercent, 30) / 30;
  const M = Math.min(i.morphologyPercent, 4) / 4;
  const pH_norm = (i.ph >= 7.2 && i.ph <= 8.0) ? 1.0 : 0.8;

  let base = (V * 0.15) + (C * 0.20) + (T * 0.10) + (PR * 0.25) + (M * 0.20) + (pH_norm * 0.10);
  if (i.viscosity) base *= 0.95;
  if (i.marPercent > 50) base *= 0.90;
  if (i.leukocytesMlMln > 1) base *= 0.85;
  if (i.agglutination) base *= 0.80;

  const score = Math.max(0, Math.min(100, base * 100));
  
  // Экспоненциальный прогноз (τ = 12 нед, сокращается при HCG на курсе)
  const tau = 12; 
  const target = 75;
  const f6 = score + (target - score) * (1 - Math.exp(-6 / tau));
  const f12 = score + (target - score) * (1 - Math.exp(-12 / tau));

  let interp = score >= 60 ? 'Норма' : score >= 30 ? 'Умеренное снижение' : 'Критическое';
  return { ifScore: Math.round(score), interpretation: interp, forecast6w: Math.round(f6), forecast12w: Math.round(f12) };
}