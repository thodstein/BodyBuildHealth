import { FertilityInput, FertilityResult } from '../core/types';
import { FERTILITY_PENALTIES, FERTILITY_TARGET, FERTILITY_TAU_WEEKS, FERTILITY_WEIGHTS_V2, SPERM_WEIGHTS, HORMONAL_WEIGHTS } from '../core/constants';

function normRange(v: number, lln: number, uln: number): number {
  if (v < lln) return Math.max(0, v / lln);
  if (v > uln) return Math.max(0, 1 - (v - uln) / uln);
  return 1;
}

export function calcFertility(i: FertilityInput): FertilityResult {
  const SW = SPERM_WEIGHTS;
  const P = FERTILITY_PENALTIES;

  const V = Math.min(i.volumeMl, 1.4) / 1.4;
  const C = Math.min(i.concentrationMlMln, 16) / 16;
  const T = Math.min(i.totalCountMln, 39) / 39;
  const PR = Math.min(i.prPercent, 30) / 30;
  const M = Math.min(i.morphologyPercent, 4) / 4;
  const pH_norm = (i.ph >= 7.2 && i.ph <= 8.0) ? 1.0 : 0.8;
  const NP = Math.min(i.npPercent ?? 0, 20) / 20;
  const VIAB = Math.min(i.viabilityPercent ?? 58, 58) / 58;
  const FRUC = (i.fructose ?? 13) >= 13 ? 1 : 0.6;
  const ZN = (i.zincMmol ?? 2) >= 2 ? 1 : 0.6;

  let spermRaw = V * SW.volume + C * SW.concentration + T * SW.totalCount
    + PR * SW.pr + M * SW.morphology + pH_norm * SW.pH
    + NP * SW.np + VIAB * SW.viability + FRUC * SW.fructose + ZN * SW.zinc;

  if (i.viscosity) spermRaw *= P.viscosity;
  if ((i.marPercent ?? 0) > 50) spermRaw *= P.mar_gt_50;
  if ((i.leukocytesMlMln ?? 0) > 1) spermRaw *= P.leukocytes_gt_1;
  if (i.agglutination) spermRaw *= P.agglutination;

  const spermIndex = Math.max(0, Math.min(100, spermRaw * 100));

  const HW = HORMONAL_WEIGHTS;
  const ttScore = normRange(i.tt ?? 500, 300, 1000);
  const ftScore = normRange(i.ft ?? 15, 8, 30);
  const e2Score = normRange(i.e2 ?? 25, 10, 40);
  const lhScore = normRange(i.lh ?? 5, 1.5, 9.3);
  const fshScore = normRange(i.fsh ?? 4, 1.4, 18.1);
  const shbgScore = normRange(i.shbg ?? 30, 15, 60);
  const prlScore = i.prl !== undefined ? (i.prl <= 15 ? 1 : Math.max(0, 1 - (i.prl - 15) / 15)) : 0.5;
  const inhbScore = normRange(i.inhb ?? 150, 80, 340);
  const amhScore = normRange(i.amh ?? 4, 1, 15);

  const hormonalIndex = Math.max(0, Math.min(100,
    (ttScore * HW.tt + ftScore * HW.ft + e2Score * HW.e2 + lhScore * HW.lh + fshScore * HW.fsh
      + shbgScore * HW.shbg + prlScore * HW.prl + inhbScore * HW.inhb + amhScore * HW.amh) * 100
  ));

  let structuralIndex = 50;
  const warnings: string[] = [];
  if (i.dfi !== undefined) {
    structuralIndex = i.dfi <= 15 ? 90 : i.dfi <= 25 ? 60 : i.dfi <= 35 ? 30 : 10;
    if (i.dfi > 30) warnings.push('DFI критический (>30%)');
  }
  if (i.varicocele && i.varicocele !== 'none') {
    structuralIndex *= (i.varicocele === 'grade1' ? 0.9 : i.varicocele === 'grade2' ? 0.75 : 0.55);
    warnings.push('Варикоцеле ' + i.varicocele);
  }

  const W = FERTILITY_WEIGHTS_V2;
  const ifScore = Math.max(0, Math.min(100,
    spermIndex * W.sperm + hormonalIndex * W.hormonal + structuralIndex * W.structural
  ));

  const target = FERTILITY_TARGET;
  const tau = FERTILITY_TAU_WEEKS;
  const f6 = ifScore + (target - ifScore) * (1 - Math.exp(-6 / tau));
  const f12 = ifScore + (target - ifScore) * (1 - Math.exp(-12 / tau));

  const interp = ifScore >= 60 ? 'Норма' : ifScore >= 30 ? 'Умеренное снижение' : 'Критическое';

  return {
    ifScore: Math.round(ifScore), interpretation: interp,
    forecast6w: Math.round(f6), forecast12w: Math.round(f12),
    spermIndex: Math.round(spermIndex),
    hormonalIndex: Math.round(hormonalIndex),
    structuralIndex: Math.round(structuralIndex),
    warnings: warnings.length > 0 ? warnings : undefined
  };
}