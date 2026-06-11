// ============================================================
// Health Engine v7.0 — Core Mathematical Engine
// PK → Hill Receptors → Signaling → 7 Mechanisms → Damage/Recovery → Stochastic → Monte Carlo → Global Risk
// ============================================================

// --- 0. Types ---

export interface PKParams {
  ka: number;        // absorption rate
  k10: number;       // elimination rate
  k12: number;       // central→peripheral
  k21: number;       // peripheral→central
  Vd: number;        // volume of distribution
  bioavailability: number;
  halfLifeHours: number;
}

export interface ReceptorParams {
  Emax: number;
  EC50: number;
  n: number;         // Hill coefficient
  kDown: number;     // desensitization rate
  kUp: number;        // resensitization rate
}

export interface SignalingParams {
  kOn: number;
  kOff: number;
}

export interface HillToxParams {
  Emax: number;
  EC50: number;
  n: number;
  threshold: number;  // Thr_Tox
}

export interface OrganParams {
  rBase: number;       // base recovery rate
  sigma: number;       // noise std
  wAcute: number;      // weight of acute state
  wChronic: number;    // weight of chronic state
  wFibrosis: number;   // weight of fibrosis
  hMax: number;        // Hill-hazard max
  EC50h: number;        // Hill-hazard EC50
  nH: number;          // Hill-hazard n
}

export interface OrganState {
  acute: number;        // [0,1]
  chronic: number;      // [0,1]
  fibrosis: number;     // [0,1]
  composite: number;    // weighted S_org
  cumRisk: number;      // cumulative risk
  hazard: number;       // h_org(t)
  pEvent: number;       // P_event,org
}

export interface MechanismDamage {
  index: number;       // mechanism input index (Z-score based)
  effect: number;     // Hill-Effect
  damage: number;     // D_Org,j
  lambdaAcute: number; // acute fraction
  lambdaChronic: number; // chronic fraction
}

export interface ScenarioResult {
  organStates: Record<string, OrganState>;
  globalRisk: number;
  pGlobal: number;
  concentrations: Record<string, number[]>;
  receptorActivation: Record<string, number[]>;
}

export interface V7SimulationResult {
  meanGlobalRisk: number;
  p5GlobalRisk: number;
  p95GlobalRisk: number;
  meanPEvent: number;
  organSummary: Record<string, {
    meanS: number;
    p5S: number;
    p95S: number;
    meanCumRisk: number;
    meanPEvent: number;
    acute: number;
    chronic: number;
    fibrosis: number;
  }>;
  scenarios: ScenarioResult[];
}

// --- 1. PK Module ---

export function computeEliminationRate(halfLifeHours: number): number {
  return Math.log(2) / Math.max(0.01, halfLifeHours);
}

export function stepPK(
  C_prev: number,
  doseMg: number,
  pk: PKParams,
  noise: number = 0
): number {
  const kel = computeEliminationRate(pk.halfLifeHours);
  const doseConc = (doseMg * pk.bioavailability) / Math.max(1, pk.Vd);
  const C_next = C_prev * Math.exp(-kel * 24) + doseConc + noise;
  return Math.max(0, C_next);
}

export function stepAUC(aucPrev: number, concentration: number): number {
  return aucPrev + concentration * 24; // daily integration
}

// --- 2. Receptors (Hill + Desensitization) ---

export function hillActivation(
  concentration: number,
  params: ReceptorParams,
  noise: number = 0
): number {
  const Cn = Math.pow(Math.max(0, concentration), params.n);
  const EC50n = Math.pow(Math.max(0.001, params.EC50), params.n);
  const activation = (params.Emax * Cn) / (EC50n + Cn);
  return Math.max(0, Math.min(1, activation + noise));
}

export function stepSensitivity(
  sensPrev: number,
  rAct: number,
  params: ReceptorParams,
  noise: number = 0
): number {
  const down = params.kDown * rAct;
  const up = params.kUp * (1 - sensPrev);
  return Math.max(0, Math.min(1, sensPrev + (-down + up) + noise));
}

export function effectiveActivation(rAct: number, sensitivity: number): number {
  return rAct * sensitivity;
}

// --- 3. Signaling Pathways ---

export function stepSignaling(
  prev: number,
  input: number,
  params: SignalingParams,
  noise: number = 0
): number {
  const on = params.kOn * input;
  const off = params.kOff * prev;
  return Math.max(0, prev + (on - off) + noise);
}

export function computeMTOR(arEff: number, igf1rEff: number, gh: number, a1: number, a2: number, a3: number): number {
  return Math.max(0, a1 * arEff + a2 * igf1rEff + a3 * gh);
}

export function computeSTAT(gh: number, b1: number): number {
  return Math.max(0, b1 * gh);
}

// --- 4. Normalization ---

export function zScore(value: number, refMean: number, refSD: number): number {
  if (refSD <= 0) return 0;
  return (value - refMean) / refSD;
}

export function hillTox(
  value: number,
  params: HillToxParams
): number {
  const excess = Math.max(0, value - params.threshold);
  const excessN = Math.pow(excess, params.n);
  const ec50N = Math.pow(Math.max(0.001, params.EC50), params.n);
  return (params.Emax * excessN) / (ec50N + excessN);
}

export function hillEffect(
  index: number,
  Emax: number,
  EC50: number,
  n: number
): number {
  const idx = Math.max(0, index);
  const idxN = Math.pow(idx, n);
  const ec50N = Math.pow(Math.max(0.001, EC50), n);
  return Emax * idxN / (ec50N + idxN);
}

// --- 5. Organ State Dynamics ---

export function stepOrganAcute(
  stateAcute: number,
  damageAcute: number,
  rAcute: number,
  sigma: number,
  z: number
): number {
  const recovery = rAcute * stateAcute;
  const noise = sigma * z;
  return Math.max(0, Math.min(1, stateAcute + (damageAcute - recovery) + noise));
}

export function stepOrganChronic(
  stateChronic: number,
  damageChronic: number,
  rChronic: number,
  sigma: number,
  z: number
): number {
  const recovery = rChronic * (1 - stateChronic);
  const noise = sigma * z;
  return Math.max(0, Math.min(1, stateChronic + (damageChronic - recovery) + noise));
}

export function stepFibrosis(
  fibrosis: number,
  damageChronic: number,
  lambdaFib: number
): number {
  return Math.max(0, fibrosis + lambdaFib * damageChronic);
}

export function compositeOrganState(
  acute: number,
  chronic: number,
  fibrosis: number,
  params: OrganParams
): number {
  return Math.max(0, Math.min(1,
    params.wAcute * acute +
    params.wChronic * chronic +
    params.wFibrosis * fibrosis
  ));
}

// --- 6. Hill-Risk and Hazard ---

export function hillRisk(S_org: number, Rmax: number, EC50R: number, nR: number): number {
  const s = Math.max(0, S_org);
  const sN = Math.pow(s, nR);
  const ec50N = Math.pow(Math.max(0.001, EC50R), nR);
  return Rmax * sN / (ec50N + sN);
}

export function hillHazard(S_org: number, hMax: number, EC50h: number, nh: number): number {
  const s = Math.max(0, S_org);
  const sN = Math.pow(s, nh);
  const ec50N = Math.pow(Math.max(0.001, EC50h), nh);
  return hMax * sN / (ec50N + sN);
}

export function pEventFromHazard(hazard: number, dt: number = 1): number {
  return 1 - Math.exp(-hazard * dt);
}

export function cumulativePEvent(hazards: number[]): number {
  const totalH = hazards.reduce((s, h) => s + h, 0);
  return 1 - Math.exp(-totalH);
}

// --- 7. Monte Carlo ---

export function sampleNormal(): number {
  // Box-Muller
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(Math.max(1e-10, u1))) * Math.cos(2 * Math.PI * u2);
}

export function sampleParam(base: number, cv: number): number {
  return base * (1 + cv * sampleNormal());
}

export interface MCRunConfig {
  nScenarios: number;
  nDays: number;
  dt: number;           // time step in days
  noiseCV: number;       // coefficient of variation for parameter sampling
}

export const DEFAULT_MC_CONFIG: MCRunConfig = {
  nScenarios: 50,
  nDays: 84,            // 12 weeks
  dt: 1,
  noiseCV: 0.10,
};

// --- 8. Lab Factor with trends ---

export function labFactor(
  latestValue: number,
  uln: number,
  trendPerMonth: number = 0,
  beta: number = 1.5,
  alpha: number = 0.5
): number {
  const ratio = latestValue / Math.max(0.01, uln);
  let factor = Math.pow(ratio, beta);
  if (trendPerMonth > 0) {
    factor *= (1 + alpha * trendPerMonth / 0.1);
  } else {
    factor = Math.max(0.7, factor);
  }
  return factor;
}

// --- 9. Nutrition multipliers ---

export interface NutritionInput {
  proteinGPerKg: number;
  fiberG: number;
  omega3G: number;
  sodiumG: number;
  potassiumG: number;
}

export function nutritionMultipliers(nut: NutritionInput): Record<string, number> {
  return {
    // Renal: high protein increases load
    renal_protein: nut.proteinGPerKg > 2.2 ? 1.2 : 1.0,
    // Cardio: low fiber increases dyslipidemia
    cardio_fiber: nut.fiberG < 20 ? 1.15 : 1.0,
    // Cardio + Neuro: omega-3 reduces inflammation
    cardio_omega3: nut.omega3G >= 2 ? 0.75 : 1.0,
    neuro_omega3: nut.omega3G >= 2 ? 0.8 : 1.0,
    // Cardio: sodium increases BP
    cardio_sodium: nut.sodiumG > 5 ? 1.1 : 1.0,
    // Cardio: low potassium increases arrhythmia
    cardio_potassium: nut.potassiumG < 2 ? 1.15 : 1.0,
  };
}

// --- 10. Training multipliers ---

export interface TrainingInput {
  hiitMinutesPerWeek: number;
  tonnageKgPerWeek: number;
  lissMinutesPerWeek: number;
}

export function trainingMultipliers(train: TrainingInput): Record<string, number> {
  return {
    // Intense training → LVH risk
    cardio_hypertrophy: train.hiitMinutesPerWeek > 120 ? 1.3 : 1.0,
    // Oxidative stress from intense training
    cardio_oxidative: train.hiitMinutesPerWeek > 120 ? 1.2 : 1.0,
    // Microtrauma
    musculoskeletal_microtrauma: train.tonnageKgPerWeek > 15000 ? 1.4 : 1.0,
    // LISS reduces cardio risk
    cardio_liss: train.lissMinutesPerWeek > 150 ? 0.9 : 1.0,
  };
}

// --- 11. Stazh (life/continuous exposure) ---

export function stazhFactors(
  totalLifeDays: number,
  continuousOnDays: number,
  refLifeDays: number = 365 * 5,
  refOnDays: number = 365 * 2
): { stazhLife: number; stazhCont: number; toxLife: number; toxCont: number } {
  const stazhLife = totalLifeDays / refLifeDays;
  const stazhCont = continuousOnDays / refOnDays;
  // Hill-Tox for stazh (threshold = 1.0 meaning "at reference level")
  const toxLife = hillTox(stazhLife, { Emax: 0.3, EC50: 2.0, n: 1.5, threshold: 1.0 });
  const toxCont = hillTox(stazhCont, { Emax: 0.4, EC50: 1.5, n: 1.5, threshold: 1.0 });
  return { stazhLife, stazhCont, toxLife, toxCont };
}

// --- 12. Adaptive Recovery ---

export function adaptiveRecovery(
  rBase: number,
  sleepZ: number,
  stressZ: number,
  activityZ: number,
  alphaSleep: number = 0.08,
  alphaStress: number = 0.06,
  alphaActivity: number = 0.04
): number {
  return Math.max(0.01, rBase * (1 + alphaSleep * sleepZ - alphaStress * stressZ + alphaActivity * activityZ));
}

// --- 13. Global Risk Aggregation ---

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function globalRiskSoft(
  organCumRisks: Record<string, number>,
  weights: Record<string, number>
): number {
  let sum = 0;
  for (const [org, risk] of Object.entries(organCumRisks)) {
    sum += (weights[org] ?? 0.1) * risk;
  }
  return sigmoid(sum);
}

export function globalPEventHard(organPEvents: Record<string, number>): number {
  let product = 1;
  for (const p of Object.values(organPEvents)) {
    product *= (1 - p);
  }
  return 1 - product;
}

// --- 14. Data Quality ---

export function dataQualityFactor(nLabs: number, nRequired: number): number {
  if (nRequired <= 0) return 1;
  return Math.min(1, nLabs / nRequired);
}

export function confidenceIntervalWidth(baseCI: number, dq: number, gamma: number = 0.5): number {
  return baseCI * (1 + gamma * (1 - dq));
}

// --- 14.5 Sensitivity Analysis ---
export interface SensitivityResult {
  parameter: string;
  baseValue: number;
  perturbedResults: { delta: number; globalRisk: number }[];
  elasticity: number; // (delta_risk / risk) / (delta_param / param)
  rank: number;
}

export function sensitivityAnalysis(
  baseComputeFn: (params: Record<string, number>) => number, // returns globalRisk
  baseParams: Record<string, number>,
  perturbations: number[] = [-0.2, -0.1, 0.1, 0.2] // ±10%, ±20%
): SensitivityResult[] {
  const baseRisk = baseComputeFn(baseParams);
  const results: SensitivityResult[] = [];

  for (const [paramName, baseVal] of Object.entries(baseParams)) {
    if (baseVal === 0) continue; // skip zero params
    const perturbedResults: { delta: number; globalRisk: number }[] = [];

    for (const delta of perturbations) {
      const perturbed = { ...baseParams };
      perturbed[paramName] = baseVal * (1 + delta);
      const risk = baseComputeFn(perturbed);
      perturbedResults.push({ delta, globalRisk: risk });
    }

    // Elasticity: average absolute % change in risk / % change in parameter
    let totalElasticity = 0;
    let count = 0;
    for (const pr of perturbedResults) {
      if (Math.abs(pr.delta) > 0 && baseRisk > 0) {
        const riskChange = (pr.globalRisk - baseRisk) / baseRisk;
        totalElasticity += Math.abs(riskChange / pr.delta);
        count++;
      }
    }
    const elasticity = count > 0 ? totalElasticity / count : 0;

    results.push({
      parameter: paramName,
      baseValue: baseVal,
      perturbedResults,
      elasticity,
      rank: 0,
    });
  }

  // Rank by elasticity (highest first)
  results.sort((a, b) => b.elasticity - a.elasticity);
  results.forEach((r, i) => r.rank = i + 1);
  return results;
}

// --- 15. Mode multipliers ---

export type ProtocolMode = 'bulk' | 'cut' | 'recomp' | 'cruise' | 'blast';

export const MODE_MULTIPLIERS: Record<ProtocolMode, Record<string, Record<number, number>>> = {
  bulk: {
    heart: { 1: 1.1, 2: 1.0, 3: 1.2, 4: 1.0, 5: 1.1, 6: 1.0, 7: 1.0 },
    liver: { 1: 1.2, 2: 1.1, 3: 1.0, 4: 1.0, 5: 0.9, 6: 1.1, 7: 1.2 },
    kidney: { 1: 1.1, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.0 },
    neuro: { 1: 1.1, 2: 1.0, 3: 1.1, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.1 },
    endocrine: { 1: 1.2, 2: 1.3, 3: 1.2, 4: 1.1, 5: 1.0, 6: 1.1, 7: 1.1 },
    hematologic: { 1: 1.2, 2: 1.1, 3: 1.0, 4: 1.2, 5: 1.0, 6: 1.1, 7: 1.0 },
    reproductive: { 1: 1.3, 2: 1.1, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.2 },
    metabolic: { 1: 1.1, 2: 1.2, 3: 1.0 },
    vessels: { 1: 1.1, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0 },
    ghigf: { 1: 1.0, 2: 1.2 },
    ins_axis: { 1: 1.2, 2: 1.0 },
    neuro_toxicity: { 1: 1.1, 2: 1.1, 3: 1.1, 4: 1.1, 5: 1.1, 6: 1.1, 7: 1.1 },
  },
  cut: {
    heart: { 1: 0.9, 2: 1.1, 3: 1.0, 4: 1.1, 5: 1.1, 6: 1.0, 7: 1.2 },
    liver: { 1: 1.0, 2: 0.9, 3: 1.1, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.0 },
    kidney: { 1: 1.0, 2: 1.0, 3: 1.1, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.0 },
    neuro: { 1: 1.2, 2: 1.0, 3: 1.3, 4: 1.1, 5: 1.0, 6: 1.1, 7: 1.2 },
    endocrine: { 1: 1.1, 2: 1.0, 3: 1.0, 4: 1.2, 5: 1.0, 6: 1.1, 7: 1.0 },
    hematologic: { 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.1, 5: 1.2, 6: 1.0, 7: 1.0 },
    reproductive: { 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.0 },
    metabolic: { 1: 1.2, 2: 1.1, 3: 1.0 },
    vessels: { 1: 1.0, 2: 1.1, 3: 1.1, 4: 1.0, 5: 1.0 },
    ghigf: { 1: 0.9, 2: 1.0 },
    ins_axis: { 1: 1.1, 2: 1.2 },
    neuro_toxicity: { 1: 1.2, 2: 1.0, 3: 1.3, 4: 1.1, 5: 1.0, 6: 1.1, 7: 1.2 },
  },
  recomp: {
    heart: { 1: 1.0, 2: 1.0, 3: 1.1, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.0 },
    liver: { 1: 1.1, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.1 },
    kidney: { 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.0 },
    neuro: { 1: 1.0, 2: 1.0, 3: 1.1, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.0 },
    endocrine: { 1: 1.1, 2: 1.1, 3: 1.0, 4: 1.1, 5: 1.0, 6: 1.0, 7: 1.0 },
    hematologic: { 1: 1.1, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.0 },
    reproductive: { 1: 1.1, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.0 },
    metabolic: { 1: 1.1, 2: 1.0, 3: 1.0 },
    vessels: { 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0 },
    ghigf: { 1: 1.0, 2: 1.0 },
    ins_axis: { 1: 1.0, 2: 1.0 },
    neuro_toxicity: { 1: 1.0, 2: 1.0, 3: 1.1, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.0 },
  },
  cruise: {
    heart: { 1: 0.8, 2: 0.8, 3: 0.9, 4: 0.8, 5: 0.8, 6: 0.8, 7: 0.8 },
    liver: { 1: 0.8, 2: 0.8, 3: 0.8, 4: 0.8, 5: 0.8, 6: 0.8, 7: 0.8 },
    kidney: { 1: 0.8, 2: 0.8, 3: 0.8, 4: 0.8, 5: 0.8, 6: 0.8, 7: 0.8 },
    neuro: { 1: 0.8, 2: 0.8, 3: 0.8, 4: 0.8, 5: 0.8, 6: 0.8, 7: 0.8 },
    endocrine: { 1: 0.8, 2: 0.8, 3: 0.8, 4: 0.8, 5: 0.8, 6: 0.8, 7: 0.8 },
    hematologic: { 1: 0.8, 2: 0.8, 3: 0.8, 4: 0.8, 5: 0.8, 6: 0.8, 7: 0.8 },
    reproductive: { 1: 0.8, 2: 0.8, 3: 0.8, 4: 0.8, 5: 0.8, 6: 0.8, 7: 0.8 },
    metabolic: { 1: 0.9, 2: 0.9, 3: 0.9 },
    vessels: { 1: 0.8, 2: 0.8, 3: 0.8, 4: 0.8, 5: 0.8 },
    ghigf: { 1: 0.8, 2: 0.8 },
    ins_axis: { 1: 0.9, 2: 0.9 },
    neuro_toxicity: { 1: 0.8, 2: 0.8, 3: 0.8, 4: 0.8, 5: 0.8, 6: 0.8, 7: 0.8 },
  },
  blast: {
    heart: { 1: 1.3, 2: 1.3, 3: 1.4, 4: 1.2, 5: 1.3, 6: 1.3, 7: 1.3 },
    liver: { 1: 1.4, 2: 1.3, 3: 1.2, 4: 1.1, 5: 1.2, 6: 1.3, 7: 1.4 },
    kidney: { 1: 1.2, 2: 1.1, 3: 1.1, 4: 1.1, 5: 1.1, 6: 1.1, 7: 1.1 },
    neuro: { 1: 1.3, 2: 1.2, 3: 1.3, 4: 1.2, 5: 1.1, 6: 1.2, 7: 1.3 },
    endocrine: { 1: 1.4, 2: 1.4, 3: 1.3, 4: 1.3, 5: 1.1, 6: 1.3, 7: 1.3 },
    hematologic: { 1: 1.3, 2: 1.2, 3: 1.1, 4: 1.3, 5: 1.1, 6: 1.2, 7: 1.1 },
    reproductive: { 1: 1.4, 2: 1.2, 3: 1.1, 4: 1.1, 5: 1.1, 6: 1.1, 7: 1.3 },
    metabolic: { 1: 1.3, 2: 1.2, 3: 1.1 },
    vessels: { 1: 1.2, 2: 1.2, 3: 1.1, 4: 1.2, 5: 1.2 },
    ghigf: { 1: 1.1, 2: 1.3 },
    ins_axis: { 1: 1.3, 2: 1.1 },
    neuro_toxicity: { 1: 1.3, 2: 1.2, 3: 1.3, 4: 1.2, 5: 1.1, 6: 1.2, 7: 1.3 },
  },
};

export function getModeMultiplier(mode: ProtocolMode, organ: string, mechIdx: number): number {
  return MODE_MULTIPLIERS[mode]?.[organ]?.[mechIdx] ?? 1.0;
}
