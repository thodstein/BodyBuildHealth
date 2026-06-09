// ============================================================
// Health Engine v7.0 — Full Time-Series Simulation with PK Integration
// Calibration: V7 results are scaled to be comparable with regular engine output
// V7_CALIBRATION_FACTOR = 1.0 - no calibration, raw V7 values
export const V7_CALIBRATION_FACTOR = 1.0;
// Runs organ simulation over T days with actual drug concentrations
// ============================================================

import {
  stepPK, stepAUC, hillActivation, stepSensitivity, effectiveActivation,
  stepSignaling, computeMTOR, computeSTAT, zScore, hillTox, hillEffect,
  stepOrganAcute, stepOrganChronic, stepFibrosis, compositeOrganState,
  hillHazard, pEventFromHazard, adaptiveRecovery, globalRiskSoft, globalPEventHard,
  sampleNormal, sampleParam, dataQualityFactor, stazhFactors, getModeMultiplier,
  type PKParams, type ReceptorParams, type SignalingParams, type OrganState, type ProtocolMode,
  type MCRunConfig, DEFAULT_MC_CONFIG,
} from './risk-engine-v7-core';
import {
  type OrganInput,
} from './risk-engine-v7-organs';
import {
  computeV7Matrix, type MatrixInput, type MatrixResult, LAB_REFERENCES, RISK_SYSTEMS_V7,
} from './risk-engine-v7-matrix';
import {
  stazhChronicMultiplier, computeInterOrganDamage, lifestyleRecoveryFactors,
} from './risk-engine-v7-extensions';
import {
  simulatePK, simulateReceptorsAndSignaling, runMonteCarlo, aggregateMCResults,
  runTimeSeriesSimulation, type TimeSeriesResult,
  RECEPTOR_DEFAULTS, SIGNALING_DEFAULTS,
} from './risk-engine-v7-simulation';
import type { RiskResult, MechanismCell, LabPoint, CourseEntry } from '../core/types';
import { PHARMA_DB } from '../core/pharma-database';
import type { GeneticProfile } from './risk-engine-v7-matrix';

// ============================================================
// V7 Input
// ============================================================

export interface V7RiskInput {
  labs: LabPoint[];
  course: CourseEntry[];
  genetics: GeneticProfile;
  nutrition: {
    proteinPerKg: number;
    fiberG: number;
    omega3G: number;
    sodiumG: number;
    potassiumG: number;
  };
  training: {
    workoutsPerWeek: number;
    avgWorkoutMinutes: number;
    hasHIIT: boolean;
    volumeTonnes: number;
    lissMinutesPerWeek: number;
  };
  mode: ProtocolMode;
  stazhWeeks: number;
  continuousWeeks: number;
  sleepHours?: number;
  stressLevel?: number;
  activityLevel?: number;
  alcoholPerWeek?: number;
  smoke?: boolean;
  forceNoLabs?: boolean;
  noLabSystems?: string[];
  supportIds?: string[];
  mcRuns?: number;
  simulationDays?: number;  // T days for time-series simulation
}

export interface V7OrganSummary {
  meanS: number;
  p5S: number;
  p95S: number;
  meanCumRisk: number;
  meanPEvent: number;
  acute: number;
  chronic: number;
  fibrosis: number;
  mechanisms: any[];
}

export interface V7RiskResult {
  matrix: MatrixResult;
  organs: any;  // TimeSeriesResult (was AllOrgansResult)
  organSummary: Record<string, V7OrganSummary>;
  weeklyOrganData: Record<string, number[]>;  // week-indexed organ risk [0..11]
  weeklyGlobalData: { raw: number; net: number }[];  // per-week global risk
  dailyOrganStates?: Record<string, number[]>;
  globalRiskRaw: number;
  globalRiskNet: number;
  globalPEvent: number;
  legacyResult: RiskResult;
  dataQuality: number;
  mode: ProtocolMode;
  mcResult?: any;
  pkTimeSeries?: Record<string, number[]>;
  receptorTimeSeries?: Record<string, number[]>;
}

// ============================================================
// Build OrganInput from V7RiskInput
// ============================================================

function buildOrganInput(input: V7RiskInput): OrganInput {
  const labs = input.labs ?? [];
  const lastLab = (code: string): number => {
    const pts = labs.filter(l => l.code === code || l.name === code);
    return pts.length ? pts[pts.length - 1].value : 0;
  };
  const lastLabZ = (code: string): number => {
    const ref = LAB_REFERENCES[code];
    if (!ref) return 0;
    const val = lastLab(code);
    return (val - ref.mean) / Math.max(0.01, ref.sd);
  };

  const SBPz = lastLabZ('SBP');
  const DBPz = lastLabZ('DBP');
  const BPz = SBPz + DBPz;
  const Hctz = lastLabZ('Hct');
  const Fibz = lastLabZ('Fibrinogen');
  const Viscz = 0.6 * Hctz + 0.4 * Fibz;
  const LVHz = lastLabZ('LVmass') || BPz * 0.3;
  const NaH2O = lastLabZ('Na') + lastLabZ('Weight_acute');
  const Athero = lastLabZ('LDL') - lastLabZ('HDL') + lastLabZ('TG');
  const IRz = lastLabZ('HOMA_IR') || 0.5;
  const TGz = lastLabZ('TG');
  const Inflamm_core = lastLabZ('CRP') + lastLabZ('IL6') + lastLabZ('TNF');
  const Oxid_core = lastLabZ('Homocysteine') + lastLabZ('OxidativeMarkers');
  const Coag_core = Fibz + lastLabZ('D_dimer');

  // Compute receptor activations from drugs using PK simulation
  let AR_eff = 0, ER_eff = 0, IGF1R_eff = 0, IR_eff = 0, C_GH = 0;
  let C_AAS_oral = 0;
  for (const entry of input.course) {
    const sub = PHARMA_DB[entry.substanceId];
    if (!sub) continue;
    const pd = sub.pd as unknown as Record<string, number>;
    if (!pd) continue;
    const doseRatio = (entry.doseValue ?? 0) / (sub.ec50 ?? 400);
    AR_eff += (pd.AR_affinity ?? 0) * doseRatio;
    ER_eff += (pd.aromatization ?? 0) * doseRatio * 0.5;
    IGF1R_eff += (pd.lipid_impact ?? 0) * doseRatio * 0.1;
    IR_eff += (pd.hct_impact ?? 0) * doseRatio * 0.05;
    // Oral AAS contribution to hepatotoxicity
    const oralSubs = ['oxandrolone', 'stanozolol', 'oxymetholone', 'methandienone'];
    if (oralSubs.includes(sub.id) || (sub.route && sub.route.includes('oral'))) {
      C_AAS_oral += (entry.doseValue ?? 0) / 50;
    }
  }
  AR_eff = Math.min(3, AR_eff);
  ER_eff = Math.min(2, ER_eff);
  const mTOR = 0.4 * AR_eff + 0.4 * IGF1R_eff + 0.2 * C_GH;

  const PRLz = lastLabZ('Prolactin');
  const DA_z = PRLz;
  const Glu_z = lastLabZ('Homocysteine');
  const GABA_z = lastLabZ('Cortisol') * -0.3;
  const Serotonin_z = lastLabZ('Estradiol') * 0.2;
  const S100b_z = Inflamm_core * 0.3;

  const tOverT = input.continuousWeeks > 0 ? Math.min(1, input.continuousWeeks / 12) : 0.5;
  const StazhLife = input.stazhWeeks / 52;
  const StazhCont = input.continuousWeeks / 12;

  let Stim_core = 0, Dep_core = 0;
  if ((input.alcoholPerWeek ?? 0) > 7) Dep_core += ((input.alcoholPerWeek ?? 0) - 7) * 0.05;
  if (input.smoke) Stim_core += 0.2;

  const Psycho_core = (input.stressLevel ?? 5) / 5;

  const labValues: Record<string, number> = {};
  const labRefs: Record<string, { mean: number; sd: number }> = {};
  for (const l of labs) {
    labValues[l.code] = l.value;
    const ref = LAB_REFERENCES[l.code];
    if (ref) labRefs[l.code] = { mean: ref.mean, sd: ref.sd };
  }

  // Compute additional drug-derived indices
  let Neurotox_chem = 0;
  let Lipid_met = TGz - lastLabZ('HDL') + 0; // Waist_z computed below
  for (const entry of input.course) {
    const sub = PHARMA_DB[entry.substanceId];
    if (!sub) continue;
    const pd = sub.pd as unknown as Record<string, number>;
    if (!pd) continue;
    const doseRatio = (entry.doseValue ?? 0) / (sub.ec50 ?? 400);
    Neurotox_chem += (pd.neuro_toxicity ?? 0) * doseRatio;
  }
  Neurotox_chem = Math.min(3, Neurotox_chem);

  const STAT = 0.5 * C_GH;
  const Waist_z = lastLabZ('Waist');
  const HOMAIR_z = lastLabZ('HOMA_IR');
  const TSH_z = lastLabZ('TSH');
  const Cortisol_z = lastLabZ('Cortisol');
  const eGFRz_abs = lastLab('eGFR');
  const Creatz_abs = lastLab('Creatinine');
  const Proteinuria_z = lastLabZ('Proteinuria');
  const Lipid_met_val = TGz - lastLabZ('HDL') + Waist_z;

  return {
    BPz, Hctz, Viscz, LVHz, NaH2O, Athero, IRz, TGz,
    HDLz: lastLabZ('HDL'), Proteinz: 0,
    GHIGFcore: IGF1R_eff + C_GH, C_AAS_oral,
    Alcohol_core: (input.alcoholPerWeek ?? 0) * 0.05,
    ALTz: lastLabZ('ALT'), ASTz: lastLabZ('AST'),
    GGTz: lastLabZ('GGT'), ALPz: lastLabZ('ALP'), Bilirubinz: lastLabZ('Bilirubin'),
    eGFRz: lastLabZ('eGFR'), Creatininez: lastLabZ('Creatinine'),
    Proteinuria_z: Proteinuria_z,
    AR_eff, ER_eff, IGF1R_eff, GHSR_eff: 0, IR_eff, mTOR, C_GH, STAT,
    Inflamm_core: Inflamm_core || 0, Oxid_core: Oxid_core || 0,
    Stim_core, Dep_core, Psycho_core: Psycho_core || 0,
    Smoke_core: input.smoke ? 0.5 : 0, Coag_core: Coag_core || 0,
    Hypo_core: Math.max(0, -lastLabZ('Glucose')),
    tOverT, Stazh_life: StazhLife, Stazh_cont: StazhCont,
    Sleepz: ((input.sleepHours ?? 7) - 7.5) / 1.0,
    Stressz: ((input.stressLevel ?? 5) - 3) / 2.5,
    Activityz: ((input.activityLevel ?? 5) - 5) / 2.5,
    Alcoholz: (input.alcoholPerWeek ?? 0) / 7,
    DA_z: DA_z, Glu_z: Glu_z, GABA_z: GABA_z,
    Serotonin_z, S100b_z, PRL_z: PRLz,
    LH_z: lastLabZ('LH'), FSH_z: lastLabZ('FSH'),
    Waist_z: Waist_z, HOMAIR_z: HOMAIR_z, TSH_z: TSH_z, Cortisol_z: Cortisol_z,
    eGFRz_abs: eGFRz_abs, Creatz_abs: Creatz_abs,
    labValues, labRefs, mode: input.mode, concentrations: {},
    Neurotox_chem: Neurotox_chem, Lipid_met: Lipid_met_val,
  };
}

// ============================================================
// Run PK time-series for all drugs in course
// ============================================================

function runPKForCourse(course: CourseEntry[], days: number): {
  pkResults: Record<string, { concentrations: number[]; cMax: number; totalAUC: number }>;
  finalAR: number;
  finalER: number;
  finalIR: number;
} {
  const pkResults: Record<string, { concentrations: number[]; cMax: number; totalAUC: number }> = {};
  let finalAR = 0, finalER = 0, finalIR = 0;

  for (const entry of course) {
    const sub = PHARMA_DB[entry.substanceId];
    if (!sub || !sub.pk) continue;

    const pk: PKParams = {
      ka: sub.pk.ka,
      k10: sub.pk.k10,
      k12: sub.pk.k12,
      k21: sub.pk.k21,
      Vd: sub.pk.Vd,
      bioavailability: sub.pk.bioavailability,
      halfLifeHours: sub.pk.halfLifeHours,
    };

    const dosePerDay = ((entry.doseValue ?? 0) * (typeof entry.frequency === 'number' ? entry.frequency : 1)) / 7;
    const result = simulatePK(pk, dosePerDay, days, 0.1);
    pkResults[entry.substanceId] = {
      concentrations: result.concentrations,
      cMax: result.cMax,
      totalAUC: result.totalAUC,
    };

    // Use final concentration for receptor activation
    const pd = sub.pd as unknown as Record<string, number>;
    if (pd) {
      const doseRatio = (entry.doseValue ?? 0) / (sub.ec50 ?? 400);
      finalAR += (pd.AR_affinity ?? 0) * doseRatio;
      finalER += (pd.aromatization ?? 0) * doseRatio;
      finalIR += (pd.hct_impact ?? 0) * doseRatio * 0.05;
    }
  }

  return { pkResults, finalAR: Math.min(3, finalAR), finalER: Math.min(2, finalER), finalIR };
}

// ============================================================
// Main V7 Simulation with time-series
// ============================================================

export function runV7Simulation(input: V7RiskInput): V7RiskResult {
  const organInput = buildOrganInput(input);
  const days = input.simulationDays ?? 84; // 12 weeks default

  // 1. Run PK for all drugs
  const pkResult = runPKForCourse(input.course, days);

  // 2. Run receptor + signaling simulation
  // Use PK final concentrations for receptor inputs
  let arEff = pkResult.finalAR;
  let erEff = pkResult.finalER;
  let irEff = pkResult.finalIR;

  // 3. Run time-series simulation (daily organ stepping with PK)
  const timeSeries = runTimeSeriesSimulation(organInput, pkResult.pkResults as any, days, 1, 0.05);
  const organKeys = Object.keys(timeSeries.organStates);
  const w = 7; // days per week
  const numWeeks = Math.floor(days / w);

  // Compute weekly organ averages & daily organ risk
  const weeklyOrganData: Record<string, number[]> = {};
  const weeklyGlobalData: { raw: number; net: number }[] = [];
  const dailyOrgan: Record<string, number[]> = {};
  for (const key of organKeys) {
    weeklyOrganData[key] = [];
    dailyOrgan[key] = [];
  }
  for (let wk = 0; wk < numWeeks; wk++) {
    const startDay = wk * w;
    const endDay = Math.min(startDay + w, days);
    const weekAvg: Record<string, number> = {};
    for (const key of organKeys) weekAvg[key] = 0;
    let count = 0;
    for (let d = startDay; d < endDay; d++) {
      for (const key of organKeys) {
        if (timeSeries.organStates[key] && d < timeSeries.organStates[key].length) {
          const comp = timeSeries.organStates[key][d].composite;
          dailyOrgan[key].push(comp);
          weekAvg[key] += comp;
        }
      }
      count++;
    }
    for (const key of organKeys) {
      weeklyOrganData[key].push(count > 0 ? weekAvg[key] / count : 0);
    }
    // Weekly global risk from cumulative risk at end of week
    const wkEnd = Math.min(endDay, days) - 1;
    const wkCumRisks: Record<string, number> = {};
    const wkPEvents: Record<string, number> = {};
    const wkWeights: Record<string, number> = {
      heart: 0.14, vessels: 0.09, liver: 0.14, kidney: 0.09,
      blood: 0.05, endocrine: 0.08, metabolic: 0.07, ghigf: 0.04,
      ins_axis: 0.06, musculoskeletal: 0.05, neuro_toxicity: 0.12, reproductive: 0.05,
    };
    for (const key of organKeys) {
      const st = timeSeries.organStates[key]?.[wkEnd];
      wkCumRisks[key] = st?.cumRisk ?? 0;
      wkPEvents[key] = st?.pEvent ?? 0;
    }
    weeklyGlobalData.push({
      raw: globalRiskSoft(wkCumRisks, wkWeights),
      net: 0, // filled from matrix per-week below
    });
  }

  // 4. Compute matrix
  const matrixInput: MatrixInput = {
    labs: input.labs, course: input.course, genetics: input.genetics,
    nutrition: input.nutrition, training: input.training,
    mode: input.mode, stazhWeeks: input.stazhWeeks, continuousWeeks: input.continuousWeeks,
  };
  const matrix = computeV7Matrix(matrixInput, input.supportIds ?? []);

  // 5. Compute organ summary from LAST 4 WEEKS average (steady-state)
  const ORGAN_CALIBRATION = 3.0; // Scale factor for Hill-attenuated drug inputs (EC50=2 vs AR_eff~0.2)
  const organSummaryStartWeek = Math.max(0, numWeeks - 4);
  const stazhMult = stazhChronicMultiplier(
    organInput.Stazh_life,
    organInput.Stazh_cont,
    organInput.Inflamm_core
  );
  const organSummary: Record<string, V7OrganSummary> = {};
  for (const key of organKeys) {
    let sumS = 0, sumAcute = 0, sumChronic = 0, sumFibrosis = 0, sumCumRisk = 0, sumPEvent = 0;
    let nSteady = 0;
    // Use last 4 weeks per-organ from timeSeries
    const startDay = Math.max(0, days - 28);
    for (let d = startDay; d < days; d++) {
      const st = timeSeries.organStates[key]?.[d];
      if (st) {
        sumS += st.composite;
        sumAcute += st.acute;
        sumChronic += st.chronic;
        sumFibrosis += st.fibrosis;
        sumCumRisk += st.cumRisk;
        sumPEvent += st.pEvent;
        nSteady++;
      }
    }
    const meanS = nSteady > 0 ? sumS / nSteady : 0;
    const orgMean = Math.min(1, meanS * stazhMult * ORGAN_CALIBRATION);
    const orgAcute = nSteady > 0 ? Math.min(1, (sumAcute / nSteady) * ORGAN_CALIBRATION) : 0;
    const orgChronic = Math.min(1, (nSteady > 0 ? sumChronic / nSteady : 0) * stazhMult * ORGAN_CALIBRATION);
    const orgFibrosis = nSteady > 0 ? Math.min(1, (sumFibrosis / nSteady) * ORGAN_CALIBRATION) : 0;
    organSummary[key] = {
      meanS: orgMean,
      p5S: orgMean * 0.85,
      p95S: Math.min(1, orgMean * 1.15),
      meanCumRisk: nSteady > 0 ? sumCumRisk / nSteady : 0,
      meanPEvent: nSteady > 0 ? sumPEvent / nSteady : 0,
      acute: orgAcute,
      chronic: orgChronic,
      fibrosis: orgFibrosis,
      mechanisms: [],
    };
  }

  // Fill per-week global net from matrix (repeated for each week)
  const matrixWeekNet = matrix.overallNet / 100;
  for (let wk = 0; wk < numWeeks; wk++) {
    weeklyGlobalData[wk].net = Math.min(100, matrixWeekNet * 100);
  }

  // Add mechanism details from matrix
  const organSystemMap: Record<string, string> = {
    heart: 'cardio', vessels: 'vessels', liver: 'hepatic', kidney: 'renal',
    blood: 'blood', endocrine: 'endocrine', metabolic: 'metabolic', ghigf: 'ghigf',
    ins_axis: 'ins_axis', musculoskeletal: 'musculoskeletal', neuro_toxicity: 'neuro_toxicity',
    reproductive: 'reproductive',
  };
  for (const key of organKeys) {
    const sysName = organSystemMap[key];
    if (sysName && matrix.systems[sysName]) {
      organSummary[key].mechanisms = Object.values(matrix.systems[sysName].mechanisms);
    }
  }

  // 6. Global risk (from cumulative risk at end of simulation)
  const organCumRisks: Record<string, number> = {};
  const organPEvents: Record<string, number> = {};
  const organWeights: Record<string, number> = {
    heart: 0.14, vessels: 0.09, liver: 0.14, kidney: 0.09,
    blood: 0.05, endocrine: 0.08, metabolic: 0.07, ghigf: 0.04,
    ins_axis: 0.06, musculoskeletal: 0.05, neuro_toxicity: 0.12, reproductive: 0.05,
  };
  for (const key of organKeys) {
    const last = timeSeries.organStates[key]?.[days - 1];
    organCumRisks[key] = (last?.cumRisk ?? 0) * ORGAN_CALIBRATION;
    organPEvents[key] = Math.min(1, (last?.pEvent ?? 0) * ORGAN_CALIBRATION);
  }
  const globalRiskRaw = globalRiskSoft(organCumRisks, organWeights);
  const globalRiskNet = matrix.overallNet / 100;
  const globalPEvent = globalPEventHard(organPEvents);

  // 9. Penalty
  let penaltyMultiplier = 1.0;
  if (input.forceNoLabs) penaltyMultiplier = 1.5;
  else if (input.noLabSystems && input.noLabSystems.length > 0) penaltyMultiplier = 1.0 + 0.1 * input.noLabSystems.length;
  penaltyMultiplier = Math.min(2.0, penaltyMultiplier);

  // 10. Data quality
  const requiredLabs = Object.keys(LAB_REFERENCES).length;
  const availableLabs = input.labs.filter(l => LAB_REFERENCES[l.code] || LAB_REFERENCES[l.name]).length;
  const dataQuality = requiredLabs > 0 ? Math.min(1, availableLabs / requiredLabs) : 0;

  // 11. Build legacy RiskResult (use organSummary meanS as proxy for totalDamage)
  const systemBreakdown: Record<string, { raw: number; net: number }> = {};
  for (const sys of RISK_SYSTEMS_V7) {
    const matrixSys = matrix.systems[sys];
    systemBreakdown[sys] = { raw: matrixSys.raw, net: matrixSys.net };
  }
  const osHeart = organSummary.heart?.meanS ?? 0;
  const osMetabolic = organSummary.metabolic?.meanS ?? 0;
  const osGhigf = organSummary.ghigf?.meanS ?? 0;
  const osIns = organSummary.ins_axis?.meanS ?? 0;
  const osNeuro = organSummary.neuro_toxicity?.meanS ?? 0;
  const osBlood = organSummary.blood?.meanS ?? 0;
  const osMusculo = organSummary.musculoskeletal?.meanS ?? 0;
  systemBreakdown.metabolic = systemBreakdown.metabolic ?? { raw: osMetabolic * 100, net: osMetabolic * 80 };
  systemBreakdown.ghigf = systemBreakdown.ghigf ?? { raw: osGhigf * 100, net: osGhigf * 80 };
  systemBreakdown.ins_axis = systemBreakdown.ins_axis ?? { raw: osIns * 100, net: osIns * 80 };
  systemBreakdown.neuro_toxicity = { raw: osNeuro * 100, net: osNeuro * 80 };
  systemBreakdown.blood = { raw: osBlood * 100, net: osBlood * 80 };
  systemBreakdown.musculoskeletal = { raw: osMusculo * 100, net: osMusculo * 80 };

  for (const key of Object.keys(systemBreakdown)) {
    systemBreakdown[key].raw = Math.min(100, systemBreakdown[key].raw * penaltyMultiplier * V7_CALIBRATION_FACTOR);
    systemBreakdown[key].net = Math.min(100, systemBreakdown[key].net * penaltyMultiplier * V7_CALIBRATION_FACTOR);
  }

  const mechanismBreakdown: Record<string, number> = {};
  const mechanismDetail: Record<string, MechanismCell> = {};
  for (const sys of RISK_SYSTEMS_V7) {
    const matrixSys = matrix.systems[sys];
    for (const [mechIdx, mechData] of Object.entries(matrixSys.mechanisms)) {
      const key = sys + '_m' + mechIdx;
      mechanismBreakdown[key] = mechData.P_raw * 100;
      mechanismDetail[key] = {
        raw: mechData.P_raw * 100,
        net: mechData.P_net * 100,
        coverage: 1 - mechData.supportFactor,
        contributors: [],
        mitigations: [],
      };
    }
  }

  const legacyResult: RiskResult = {
    overallRaw: Math.min(100, globalRiskRaw * 100 * penaltyMultiplier),
    overallNet: Math.min(100, globalRiskNet * 100 * penaltyMultiplier),
    systemBreakdown,
    mechanismBreakdown,
    mechanismDetail,
  };

  // 12. Run Monte Carlo if requested
  let mcResult = undefined;
  if ((input.mcRuns ?? 0) > 1) {
    const mcScenarios = runMonteCarlo({
      organInput,
      matrixInput,
      days,
      mcConfig: { ...DEFAULT_MC_CONFIG, nScenarios: input.mcRuns ?? 50, nDays: days, dt: 1, noiseCV: 0.15 },
    });
    mcResult = aggregateMCResults(mcScenarios);
  }

  // 13. Build PK time-series for display
  const pkTimeSeries: Record<string, number[]> = {};
  for (const [subId, result] of Object.entries(pkResult.pkResults)) {
    pkTimeSeries[subId] = result.concentrations;
  }

  return {
    matrix, organs: timeSeries as any, organSummary,
    weeklyOrganData, weeklyGlobalData,
    dailyOrganStates: dailyOrgan,
    globalRiskRaw: Math.min(100, globalRiskRaw * 100 * penaltyMultiplier),
    globalRiskNet: Math.min(100, globalRiskNet * 100 * penaltyMultiplier),
    globalPEvent, legacyResult, dataQuality, mode: input.mode,
    mcResult,
    pkTimeSeries,
  };
}

export function calculateV7Risk(input: V7RiskInput): RiskResult {
  return runV7Simulation(input).legacyResult;
}
