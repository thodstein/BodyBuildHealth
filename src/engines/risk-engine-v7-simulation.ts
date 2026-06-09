// ============================================================
// Health Engine v7.0 — PK Simulation, Receptors, Monte Carlo, Time-Series
// Full daily loop: PK → Receptors → Signaling → Organs → Risk
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
  type MCRunConfig, DEFAULT_MC_CONFIG, sensitivityAnalysis,
} from './risk-engine-v7-core';
import {
  computeAllOrgans, type OrganInput, type AllOrgansResult, ORGAN_PARAMS,
} from './risk-engine-v7-organs';
import {
  computeV7Matrix, type MatrixInput, type MatrixResult, LAB_REFERENCES,
} from './risk-engine-v7-matrix';
import { stazhChronicMultiplier, computeInterOrganDamage } from './risk-engine-v7-extensions';

// ============================================================
// Default Receptor Parameters
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

export const SIGNALING_DEFAULTS: Record<string, SignalingParams> = {
  AKT:  { kOn: 0.15, kOff: 0.08 },
  MAPK: { kOn: 0.12, kOff: 0.06 },
  mTOR: { kOn: 0.10, kOff: 0.05 },
  STAT: { kOn: 0.08, kOff: 0.04 },
};

// ============================================================
// PK Simulation for a single substance
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
    if (C_prev > cMax) { cMax = C_prev; tMax = t; }
  }

  return {
    concentrations, auc,
    finalConcentration: concentrations[concentrations.length - 1] ?? 0,
    totalAUC: auc[auc.length - 1] ?? 0, cMax, tMax,
  };
}

// ============================================================
// Receptor + Signaling Simulation
// ============================================================

export interface ReceptorSimulationResult {
  AR_eff: number[];  ER_eff: number[];  IR_eff: number[];
  IGF1R_eff: number[];  GHSR_eff: number[];
  AKT: number[];  MAPK: number[];  mTOR: number[];  STAT: number[];
}

export function simulateReceptorsAndSignaling(
  concentrations: number[],
  receptorParams: Record<string, ReceptorParams> = RECEPTOR_DEFAULTS,
  signalingParams: Record<string, SignalingParams> = SIGNALING_DEFAULTS
): ReceptorSimulationResult {
  const T = concentrations.length;
  const AR_eff: number[] = [], ER_eff: number[] = [], IR_eff: number[] = [];
  const IGF1R_eff: number[] = [], GHSR_eff: number[] = [];
  const AKT: number[] = [], MAPK: number[] = [], mTOR: number[] = [], STAT: number[] = [];

  let AR_sens = 1, ER_sens = 1, IR_sens = 1, IGF1R_sens = 1, GHSR_sens = 1;
  let aktVal = 0, mapkVal = 0, mtorVal = 0, statVal = 0;

  for (let t = 0; t < T; t++) {
    const C = concentrations[t] ?? 0;
    const AR_act = hillActivation(C, receptorParams.AR);
    const ER_act = hillActivation(C * 0.3, receptorParams.ER);
    const IR_act = hillActivation(C * 0.05, receptorParams.IR);
    const IGF1R_act = hillActivation(C * 0.1, receptorParams.IGF1R);
    const GHSR_act = hillActivation(C * 0.02, receptorParams.GHSR);

    AR_sens = stepSensitivity(AR_sens, AR_act, receptorParams.AR);
    ER_sens = stepSensitivity(ER_sens, ER_act, receptorParams.ER);
    IR_sens = stepSensitivity(IR_sens, IR_act, receptorParams.IR);
    IGF1R_sens = stepSensitivity(IGF1R_sens, IGF1R_act, receptorParams.IGF1R);
    GHSR_sens = stepSensitivity(GHSR_sens, GHSR_act, receptorParams.GHSR);

    const arEff = effectiveActivation(AR_act, AR_sens);
    const erEff = effectiveActivation(ER_act, ER_sens);
    const irEff = effectiveActivation(IR_act, IR_sens);
    const igf1rEff = effectiveActivation(IGF1R_act, IGF1R_sens);
    const ghsrEff = effectiveActivation(GHSR_act, GHSR_sens);

    aktVal = stepSignaling(aktVal, irEff, signalingParams.AKT);
    mapkVal = stepSignaling(mapkVal, arEff + erEff + igf1rEff, signalingParams.MAPK);
    mtorVal = computeMTOR(arEff, igf1rEff, ghsrEff, 0.4, 0.4, 0.2);
    statVal = computeSTAT(ghsrEff, 0.5);

    AR_eff.push(arEff); ER_eff.push(erEff); IR_eff.push(irEff);
    IGF1R_eff.push(igf1rEff); GHSR_eff.push(ghsrEff);
    AKT.push(aktVal); MAPK.push(mapkVal); mTOR.push(mtorVal); STAT.push(statVal);
  }

  return { AR_eff, ER_eff, IR_eff, IGF1R_eff, GHSR_eff, AKT, MAPK, mTOR, STAT };
}

// ============================================================
// Full Time-Series Simulation: PK → Receptors → Organs → Risk
// ============================================================

export interface TimeSeriesResult {
  days: number;
  organStates: Record<string, OrganState[]>;  // organ -> daily states
  globalRiskDaily: number[];
  cumulativeRisk: Record<string, number>;  // organ -> final cumulative risk
  pEventFinal: Record<string, number>;     // organ -> final P(event)
  receptorTimeSeries: ReceptorSimulationResult | null;
  pkTimeSeries: Record<string, number[]>;
}

export function runTimeSeriesSimulation(
  organInput: OrganInput,
  pkResults: Record<string, PKSimulationResult>,
  days: number,
  dt: number = 1,
  noiseCV: number = 0.05
): TimeSeriesResult {
  const organKeys = Object.keys(ORGAN_PARAMS);
  const organStates: Record<string, OrganState[]> = {};
  for (const key of organKeys) organStates[key] = [];

  const globalRiskDaily: number[] = [];
  const cumulativeRisk: Record<string, number> = {};
  const pEventFinal: Record<string, number> = {};

  // Initial organ states
  let prevStates: Record<string, OrganState> = {};
  for (const key of organKeys) {
    prevStates[key] = { acute: 0, chronic: 0, fibrosis: 0, composite: 0, cumRisk: 0, hazard: 0, pEvent: 0 };
  }

  // PK time series
  const pkTimeSeries: Record<string, number[]> = {};
  for (const [subId, result] of Object.entries(pkResults)) {
    pkTimeSeries[subId] = result.concentrations;
  }

  // Receptor simulation using combined PK concentrations
  let receptorTS: ReceptorSimulationResult | null = null;
  const combinedConc: number[] = [];
  for (let t = 0; t < days; t++) {
    let totalConc = 0;
    for (const result of Object.values(pkResults)) {
      totalConc += result.concentrations[t] ?? 0;
    }
    combinedConc.push(totalConc);
  }
  if (combinedConc.length > 0) {
    receptorTS = simulateReceptorsAndSignaling(combinedConc);
  }

  // Organ weights for global risk
  const organWeights: Record<string, number> = {
    heart: 0.15, vessels: 0.10, liver: 0.15, kidney: 0.10,
    blood: 0.05, endocrine: 0.08, metabolic: 0.08, ghigf: 0.05,
    ins_axis: 0.07, musculoskeletal: 0.05, neuro_toxicity: 0.12, reproductive: 0.05,
  };

  // Stazh multiplier
  const stazhMult = stazhChronicMultiplier(
    organInput.Stazh_life, organInput.Stazh_cont, organInput.Inflamm_core
  );

  // Daily loop
  for (let t = 0; t < days; t++) {
    // Update receptor activations for this day
    const arEff = receptorTS?.AR_eff[t] ?? organInput.AR_eff;
    const erEff = receptorTS?.ER_eff[t] ?? organInput.ER_eff;
    const irEff = receptorTS?.IR_eff[t] ?? organInput.IR_eff;
    const igf1rEff = receptorTS?.IGF1R_eff[t] ?? organInput.IGF1R_eff;
    const mTOR = receptorTS?.mTOR[t] ?? organInput.mTOR;
    const gh = organInput.C_GH;
    const stat = receptorTS?.STAT[t] ?? organInput.STAT;

    // Update drug concentrations
    const concsToday: Record<string, number> = {};
    for (const [subId, result] of Object.entries(pkResults)) {
      concsToday[subId] = result.concentrations[t] ?? 0;
    }

    // Build daily input
    const dailyInput: OrganInput = {
      ...organInput,
      AR_eff: arEff,
      ER_eff: erEff,
      IR_eff: irEff,
      IGF1R_eff: igf1rEff,
      mTOR: mTOR,
      C_GH: gh,
      STAT: stat,
      concentrations: concsToday,
    };

    // Compute organ damage
    const organs = computeAllOrgans(dailyInput);

    // Step organ states forward with damage/recovery dynamics
    for (const key of organKeys) {
      const organResult = organs[key as keyof AllOrgansResult];
      if (!organResult) continue;

      const params = ORGAN_PARAMS[key as keyof typeof ORGAN_PARAMS];
      if (!params) continue;

      const prev = prevStates[key] ?? { acute: 0, chronic: 0, fibrosis: 0, composite: 0, cumRisk: 0, hazard: 0, pEvent: 0 };
      const dmg = {
        total: organResult.totalDamage,
        acute: organResult.acuteDamage,
        chronic: organResult.chronicDamage,
        fibrosis: organResult.fibrosisDamage,
      };

      // Step organ state with damage/recovery
      const newState = {
        acute: Math.max(0, Math.min(1,
          prev.acute + (dmg.acute - params.rBase * prev.acute) * dt +
          (noiseCV > 0 ? sampleNormal() * params.sigma * Math.sqrt(dt) : 0)
        )),
        chronic: Math.max(0, Math.min(1,
          prev.chronic + (dmg.chronic - params.rBase * (1 - prev.chronic)) * dt +
          (noiseCV > 0 ? sampleNormal() * params.sigma * 0.5 * Math.sqrt(dt) : 0)
        )),
        fibrosis: Math.max(0, prev.fibrosis + 0.05 * dmg.chronic * dt),
        composite: 0, cumRisk: 0, hazard: 0, pEvent: 0,
      };

      newState.composite = params.wAcute * newState.acute +
        params.wChronic * newState.chronic + params.wFibrosis * newState.fibrosis;
      newState.composite = Math.max(0, Math.min(1, newState.composite));

      newState.hazard = hillHazard(newState.composite, params.hMax, params.EC50h, params.nH);
      newState.pEvent = pEventFromHazard(newState.hazard * stazhMult, dt);
      newState.cumRisk = prev.cumRisk + newState.hazard * dt;

      prevStates[key] = newState;
      organStates[key].push({ ...newState });
    }

    // Global risk for this day
    const cumRisks: Record<string, number> = {};
    const pEvents: Record<string, number> = {};
    for (const key of organKeys) {
      cumRisks[key] = prevStates[key]?.cumRisk ?? 0;
      pEvents[key] = prevStates[key]?.pEvent ?? 0;
    }
    globalRiskDaily.push(globalRiskSoft(cumRisks, organWeights));
  }

  // Final cumulative risk and P(event)
  for (const key of organKeys) {
    cumulativeRisk[key] = prevStates[key]?.cumRisk ?? 0;
    pEventFinal[key] = prevStates[key]?.pEvent ?? 0;
  }

  return { days, organStates, globalRiskDaily, cumulativeRisk, pEventFinal, receptorTimeSeries: receptorTS, pkTimeSeries };
}

// ============================================================
// Monte Carlo Simulation
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
    const perturbedInput: OrganInput = { ...organInput };
    const noiseScale = mcConfig.noiseCV ?? 0.15;

    perturbedInput.BPz = organInput.BPz + sampleNormal() * noiseScale;
    perturbedInput.Hctz = organInput.Hctz + sampleNormal() * noiseScale;
    perturbedInput.Inflamm_core = Math.max(0, organInput.Inflamm_core + sampleNormal() * noiseScale * 0.5);
    perturbedInput.Oxid_core = Math.max(0, organInput.Oxid_core + sampleNormal() * noiseScale * 0.5);
    perturbedInput.IRz = organInput.IRz + sampleNormal() * noiseScale;
    perturbedInput.AR_eff = Math.max(0, organInput.AR_eff + sampleNormal() * noiseScale);

    const organs = computeAllOrgans(perturbedInput);
    const stazhMult = stazhChronicMultiplier(organInput.Stazh_life, organInput.Stazh_cont, organInput.Inflamm_core);

    const organStates: Record<string, number> = {};
    const organKeys = Object.keys(organs) as (keyof AllOrgansResult)[];
    for (const key of organKeys) {
      organStates[key] = organs[key].state.composite;
    }
    const interOrgan = computeInterOrganDamage(organStates);

    const organWeights: Record<string, number> = {
      heart: 0.15, vessels: 0.10, liver: 0.15, kidney: 0.10,
      blood: 0.05, endocrine: 0.08, metabolic: 0.08, ghigf: 0.05,
      ins_axis: 0.07, musculoskeletal: 0.05, neuro_toxicity: 0.12, reproductive: 0.05,
    };
    const organCumRisks: Record<string, number> = {};
    const organPEvents: Record<string, number> = {};
    for (const key of organKeys) {
      organCumRisks[key] = organs[key].state.cumRisk * stazhMult + (interOrgan[key] ?? 0);
      organPEvents[key] = organs[key].state.pEvent;
    }

    const globalRisk = globalRiskSoft(organCumRisks, organWeights);
    const pGlobal = globalPEventHard(organPEvents);

    const concentrations: Record<string, number[]> = {};
    const receptorActivation: Record<string, number[]> = {};
    if (pkParams && dailyDoses) {
      for (const [subId, params] of Object.entries(pkParams)) {
        const dose = dailyDoses[subId] ?? 0;
        const pkResult = simulatePK(params, dose, days, noiseScale * 0.5);
        concentrations[subId] = pkResult.concentrations;
      }
    }

    const scenarioOrgans: Record<string, OrganState> = {};
    for (const key of organKeys) {
      scenarioOrgans[key] = organs[key].state;
    }

    scenarios.push({
      scenarioId: s, organStates: scenarioOrgans,
      globalRisk, pGlobal, concentrations, receptorActivation,
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
    meanS: number; p5S: number; p95S: number;
    meanCumRisk: number; meanPEvent: number;
    acute: number; chronic: number; fibrosis: number;
  }>;
}

export function aggregateMCResults(scenarios: MCScenarioResult[]): MCAggregateResult {
  if (scenarios.length === 0) {
    return { meanGlobalRisk: 0, p5GlobalRisk: 0, p95GlobalRisk: 0, meanPEvent: 0, organSummary: {} };
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