// ============================================================
// Health Engine v7.0 — Extensions: PK Simulation, Receptors, Monte Carlo
// From spec files: Full PK loop, AKT/MAPK signaling, MC scenarios
// ============================================================

import {
  stepPK, stepAUC, hillActivation, stepSensitivity, effectiveActivation,
  stepSignaling, computeMTOR, computeSTAT, zScore, hillTox, hillEffect,
  stepOrganAcute, stepOrganChronic, stepFibrosis, compositeOrganState,
  hillHazard, pEventFromHazard, cumulativePEvent, sampleNormal, sampleParam,
  adaptiveRecovery, stazhFactors, globalRiskSoft, globalPEventHard,
  dataQualityFactor, getModeMultiplier,
  type PKParams, type ReceptorParams, type SignalingParams, type HillToxParams,
  type OrganParams, type OrganState, type MechanismDamage, type ProtocolMode,
  type MCRunConfig, DEFAULT_MC_CONFIG,
} from './risk-engine-v7-core';
import { computeAllOrgans, type OrganInput, type AllOrgansResult, ORGAN_PARAMS } from './risk-engine-v7-organs';
import { computeV7Matrix, type MatrixInput, type MatrixResult, LAB_REFERENCES } from './risk-engine-v7-matrix';
import { stazhChronicMultiplier, computeInterOrganDamage } from './risk-engine-v7-extensions';

// ============================================================
// Default Receptor Parameters (from spec)
// ============================================================

export const RECEPTOR_DEFAULTS: Record<string, ReceptorParams> = {
  AR:      { Emax: 1.0, EC50: 15, n: 2.5, kDown: 0.02, kUp: 0.01 },
  ER:      { Emax: 1.0, EC50: 25, n: 2.0, kDown: 0.015, kUp: 0.008 },
  IR:      { Emax: 1.0, EC50: 10, n: 2.0, kDown: 0.01, kUp: 0.012 },
  IGF1R:  { Emax: 1.0, EC50: 20, n: 2.0, kDown: 0.012, kUp: 0.01 },
  GHSR:   { Emax: 1.0, EC50: 30, n: 1.8, kDown: 0.008, kUp: 0.015 },
  PR:      { Emax: 1.0, EC50: 18, n: 2.0, kDown: 0.01, kUp: 0.01 },
  GR:      { Emax: 1.0, EC50: 50, n: 1.8, kDown: 0.025, kUp: 0.005 },
};

// Signaling pathway default parameters
export const SIGNALING_DEFAULTS: Record<string, SignalingParams> = {
  AKT:  { kOn: 0.15, kOff: 0.08 },
  MAPK: { kOn: 0.12, kOff: 0.06 },
  mTOR: { kOn: 0.10, kOff: 0.05 },  // composite
  STAT: { kOn: 0.08, kOff: 0.04 },
};

// ============================================================
// PK Simulation for a single substance over T days
// ============================================================

export interface PKSimulationResult {
  concentrations: number[];
  auc: number[];
  finalConcentration: number;
  totalAUC: number;
  cMax: number;
  tMax: number;
}

export function simulatePK(
  pk: PKParams,
  dailyDoseMg: number,
  days: number,
  noiseCV: number = 0.1,
  seed?: () => number
): PKSimulationResult {
  const concentrations: number[] = [];
  const auc: number[] = [];
  let C_prev = 0;
  let aucPrev = 0;
  let cMax = 0;
  let tMax = 0;

  const rng = seed ?? Math.random;

  for (let t = 0; t < days; t++) {
    const noise = noiseCV > 0 ? sampleParam(0, noiseCV) * rng() : 0;
    C_prev = stepPK(C_prev, dailyDoseMg, pk, noise);
    aucPrev = stepAUC(aucPrev, C_prev);
    concentrations.push(C_prev);
    auc.push(aucPrev);
    if (C_prev > cMax) {
      cMax = C_prev;
      tMax = t;
    }
  }

  return {
    concentrations,
    auc,
    finalConcentration: concentrations[concentrations.length - 1] ?? 0,
    totalAUC: auc[auc.length - 1] ?? 0,
    cMax,
    tMax,
  };
}

// ============================================================
// Receptor + Signaling Simulation over T days
// ============================================================

export interface ReceptorSimulationResult {
  AR_eff: number[];
  ER_eff: number[];
  IR_eff: number[];
  IGF1R_eff: number[];
  GHSR_eff: number[];
  AKT: number[];
  MAPK: number[];
  mTOR: number[];
  STAT: number[];
}

export function simulateReceptorsAndSignaling(
  concentrations: number[],
  receptorParams: Record<string, ReceptorParams> = RECEPTOR_DEFAULTS,
  signalingParams: Record<string, SignalingParams> = SIGNALING_DEFAULTS
): ReceptorSimulationResult {
  const T = concentrations.length;
  const AR_eff: number[] = [], ER_eff: number[] = [], IR_eff: number[] = [];
  const IGF1R_eff: number[] = [], GHSR_eff: number[] = [];
  const AKT: number[] = [], MAPK: number[] = [];
  const mTOR: number[] = [], STAT: number[] = [];

  let AR_sens = 1, ER_sens = 1, IR_sens = 1, IGF1R_sens = 1, GHSR_sens = 1;
  let aktVal = 0, mapkVal = 0, mtorVal = 0, statVal = 0;

  for (let t = 0; t < T; t++) {
    const C = concentrations[t] ?? 0;

    // Receptor activations (using same concentration for androgenic substances)
    const AR_act = hillActivation(C, receptorParams.AR);
    const ER_act = hillActivation(C * 0.3, receptorParams.ER);  // 30% aromatization
    const IR_act = hillActivation(C * 0.05, receptorParams.IR);  // 5% IR impact
    const IGF1R_act = hillActivation(C * 0.1, receptorParams.IGF1R);
    const GHSR_act = hillActivation(C * 0.02, receptorParams.GHSR);

    // Sensitivity dynamics
    AR_sens = stepSensitivity(AR_sens, AR_act, receptorParams.AR);
    ER_sens = stepSensitivity(ER_sens, ER_act, receptorParams.ER);
    IR_sens = stepSensitivity(IR_sens, IR_act, receptorParams.IR);
    IGF1R_sens = stepSensitivity(IGF1R_sens, IGF1R_act, receptorParams.IGF1R);
    GHSR_sens = stepSensitivity(GHSR_sens, GHSR_act, receptorParams.GHSR);

    // Effective activations
    const arEff = effectiveActivation(AR_act, AR_sens);
    const erEff = effectiveActivation(ER_act, ER_sens);
    const irEff = effectiveActivation(IR_act, IR_sens);
    const igf1rEff = effectiveActivation(IGF1R_act, IGF1R_sens);
    const ghsrEff = effectiveActivation(GHSR_act, GHSR_sens);

    // Signaling pathways
    aktVal = stepSignaling(aktVal, irEff, signalingParams.AKT);
    mapkVal = stepSignaling(mapkVal, arEff + erEff + igf1rEff, signalingParams.MAPK);
    mtorVal = computeMTOR(arEff, igf1rEff, ghsrEff, 0.4, 0.4, 0.2);
    statVal = computeSTAT(ghsrEff, 0.5);

    AR_eff.push(arEff);
    ER_eff.push(erEff);
    IR_eff.push(irEff);
    IGF1R_eff.push(igf1rEff);
    GHSR_eff.push(ghsrEff);
    AKT.push(aktVal);
    MAPK.push(mapkVal);
    mTOR.push(mtorVal);
    STAT.push(statVal);
  }

  return { AR_eff, ER_eff, IR_eff, IGF1R_eff, GHSR_eff, AKT, MAPK, mTOR, STAT };
}

// ============================================================
// Monte Carlo Simulation Runner
// ============================================================

export interface MCScenarioInput {
  organInput: OrganInput;
  matrixInput: MatrixInput;
  pkParams?: Record<string, PKParams>;
  dailyDoses?: Record<string, number>;
  days: number;
  mcConfig: MCRunConfig;
}

export interface MCScenarioResult {
  scenarioId: number;
  organStates: Record<string, OrganState>;
  globalRisk: number;
  pGlobal: number;
  concentrations: Record<string, number[]>;
  receptorActivation: Record<string, number[]>;
}

export function runMonteCarlo(input: MCScenarioInput): MCScenarioResult[] {
  const { organInput, matrixInput, pkParams, dailyDoses, days, mcConfig } = input;
  const scenarios: MCScenarioResult[] = [];
  const N = mcConfig.nScenarios;

  for (let s = 0; s < N; s++) {
    // Perturb organ input with MC noise
    const perturbedInput: OrganInput = { ...organInput };
    const noiseScale = mcConfig.noiseCV ?? 0.15;

    // Add noise to key indices
    perturbedInput.BPz = organInput.BPz + sampleNormal() * noiseScale;
    perturbedInput.Hctz = organInput.Hctz + sampleNormal() * noiseScale;
    perturbedInput.Inflamm_core = Math.max(0, organInput.Inflamm_core + sampleNormal() * noiseScale * 0.5);
    perturbedInput.Oxid_core = Math.max(0, organInput.Oxid_core + sampleNormal() * noiseScale * 0.5);
    perturbedInput.IRz = organInput.IRz + sampleNormal() * noiseScale;
    perturbedInput.AR_eff = Math.max(0, organInput.AR_eff + sampleNormal() * noiseScale);

    // Run organ simulation with perturbed input
    const organs = computeAllOrgans(perturbedInput);

    // Apply stazh multiplier
    const stazhMult = stazhChronicMultiplier(organInput.Stazh_life, organInput.Stazh_cont, organInput.Inflamm_core);

    // Compute inter-organ influence
    const organStates: Record<string, number> = {};
    const organKeys = Object.keys(organs) as (keyof AllOrgansResult)[];
    for (const key of organKeys) {
      organStates[key] = organs[key].state.composite;
    }
    const interOrgan = computeInterOrganDamage(organStates);

    // Aggregate global risk
    const organWeights: Record<string, number> = {
      heart: 0.15, vessels: 0.10, liver: 0.15, kidney: 0.10,
      metabolic: 0.08, ghigf: 0.05, ins_axis: 0.07, neuro_toxicity: 0.12,
      endocrine: 0.08, hematologic: 0.05, reproductive: 0.05,
    };
    const organCumRisks: Record<string, number> = {};
    const organPEvents: Record<string, number> = {};
    for (const key of organKeys) {
      organCumRisks[key] = organs[key].state.cumRisk * stazhMult + (interOrgan[key] ?? 0);
      organPEvents[key] = organs[key].state.pEvent;
    }

    const globalRisk = globalRiskSoft(organCumRisks, organWeights);
    const pGlobal = globalPEventHard(organPEvents);

    // PK simulation for each substance (simplified)
    const concentrations: Record<string, number[]> = {};
    const receptorActivation: Record<string, number[]> = {};
    if (pkParams && dailyDoses) {
      for (const [subId, params] of Object.entries(pkParams)) {
        const dose = dailyDoses[subId] ?? 0;
        const pkResult = simulatePK(params, dose, days, noiseScale * 0.5);
        concentrations[subId] = pkResult.concentrations;
      }
    }

    // Collect organ states
    const scenarioOrgans: Record<string, OrganState> = {};
    for (const key of organKeys) {
      scenarioOrgans[key] = organs[key].state;
    }

    scenarios.push({
      scenarioId: s,
      organStates: scenarioOrgans,
      globalRisk,
      pGlobal,
      concentrations,
      receptorActivation,
    });
  }

  return scenarios;
}

// ============================================================
// Aggregate MC Results
// ============================================================

export interface MCAggregateResult {
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
}

export function aggregateMCResults(scenarios: MCScenarioResult[]): MCAggregateResult {
  if (scenarios.length === 0) {
    return {
      meanGlobalRisk: 0, p5GlobalRisk: 0, p95GlobalRisk: 0, meanPEvent: 0,
      organSummary: {},
    };
  }

  const risks = scenarios.map(s => s.globalRisk).sort((a, b) => a - b);
  const pEvents = scenarios.map(s => s.pGlobal);

  const meanGlobalRisk = risks.reduce((a, b) => a + b, 0) / risks.length;
  const p5GlobalRisk = risks[Math.floor(risks.length * 0.05)] ?? risks[0];
  const p95GlobalRisk = risks[Math.floor(risks.length * 0.95)] ?? risks[risks.length - 1];
  const meanPEvent = pEvents.reduce((a, b) => a + b, 0) / pEvents.length;

  const organKeys = Object.keys(scenarios[0].organStates);
  const organSummary: MCAggregateResult['organSummary'] = {};

  for (const key of organKeys) {
    const composities = scenarios.map(s => s.organStates[key]?.composite ?? 0).sort((a, b) => a - b);
    const acuteValues = scenarios.map(s => s.organStates[key]?.acute ?? 0);
    const chronicValues = scenarios.map(s => s.organStates[key]?.chronic ?? 0);
    const fibrosisValues = scenarios.map(s => s.organStates[key]?.fibrosis ?? 0);
    const cumRisks = scenarios.map(s => s.organStates[key]?.cumRisk ?? 0);
    const pEventsOrg = scenarios.map(s => s.organStates[key]?.pEvent ?? 0);

    organSummary[key] = {
      meanS: composities.reduce((a, b) => a + b, 0) / composities.length,
      p5S: composities[Math.floor(composities.length * 0.05)] ?? composities[0],
      p95S: composities[Math.floor(composities.length * 0.95)] ?? composities[composities.length - 1],
      meanCumRisk: cumRisks.reduce((a, b) => a + b, 0) / cumRisks.length,
      meanPEvent: pEventsOrg.reduce((a, b) => a + b, 0) / pEventsOrg.length,
      acute: acuteValues.reduce((a, b) => a + b, 0) / acuteValues.length,
      chronic: chronicValues.reduce((a, b) => a + b, 0) / chronicValues.length,
      fibrosis: fibrosisValues.reduce((a, b) => a + b, 0) / fibrosisValues.length,
    };
  }

  return { meanGlobalRisk, p5GlobalRisk, p95GlobalRisk, meanPEvent, organSummary };
}

