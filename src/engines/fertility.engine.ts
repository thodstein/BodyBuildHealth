import { FertilityInput, FertilityResult } from '../core/types';
import { FERTILITY_WEIGHTS, FERTILITY_PENALTIES, FERTILITY_TARGET, FERTILITY_TAU_WEEKS } from '../core/constants';

export function calcFertility(i: FertilityInput): FertilityResult {
  const W = FERTILITY_WEIGHTS;
  const V = Math.min(i.volumeMl, 1.5) / 1.5;
  const C = Math.min(i.concentrationMlMln, 16) / 16;
  const T = Math.min(i.totalCountMln, 39) / 39;
  const PR = Math.min(i.prPercent, 30) / 30;
  const M = Math.min(i.morphologyPercent, 4) / 4;
  const pH_norm = (i.ph >= 7.2 && i.ph <= 8.0) ? 1.0 : 0.8;

  let base = (V * W.volume) + (C * W.concentration) + (T * W.totalCount) + (PR * W.PR) + (M * W.morphology) + (pH_norm * W.pH);
  
  const P = FERTILITY_PENALTIES;
  if(i.viscosity) base *= P.viscosity;
  if((i.marPercent ?? 0) > 50) base *= P.mar_gt_50;
  if((i.leukocytesMlMln ?? 0) > 1) base *= P.leukocytes_gt_1;
  if(i.agglutination) base *= P.agglutination;

  const score = Math.max(0, Math.min(100, base * 100));
  const target = FERTILITY_TARGET;
  const tau = FERTILITY_TAU_WEEKS;
  
  const f6 = score + (target - score) * (1 - Math.exp(-6 / tau));
  const f12 = score + (target - score) * (1 - Math.exp(-12 / tau));
  
  let interp = score >= 60 ? 'Норма' : score >= 30 ? 'Умеренное снижение' : 'Критическое';
  return { ifScore: Math.round(score), interpretation: interp, forecast6w: Math.round(f6), forecast12w: Math.round(f12) };
}