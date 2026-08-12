/**
 * support-plan/mapper-ctx.ts — построение MapperCtx для resolvePlan.
 *
 * ЕДИНЫЙ источник правды для перехода CalculatorState → MapperCtx.
 * Используется и в CalcMapper (UI), и в calculateSupportTZ (движок),
 * чтобы оба контура строили ОДИН и тот же план поддержки.
 */

import type { CalculatorState, LabSlice } from './types';
import type { SupportLevel } from '../tz-bridge-mechanism';
import type { MapperCtx } from '../tz-mapper-engine';
import type { PhaseContext, PhaseKey } from '../tz-bridge-phase';
import type { BoosterTriggerCtx } from '../tz-bridge-boosters';
import { classifyPed } from '../../data/ped-potency-table';
import { assessPedRisk } from '../ped-risk-matrix';

const PANEL_KEYS = [
  'panelBiochem', 'panelSex', 'panelHematology', 'panelThyroid',
  'panelLipid', 'panelIron', 'panelVitamin', 'panelCardiac',
  'panelCoagulation', 'panelInflammatory', 'panelAdrenal',
  'panelMineral', 'panelTumor', 'panelUrinalysis',
] as const;

const MARKER_RENAME: Record<string, string> = {
  'Total T': 'TESTOSTERONE', 'Free T': 'FREE_TESTOSTERONE', 'E2': 'ESTRADIOL',
  'Bilirubin': 'BILIRUBIN', 'Uric acid': 'URIC_ACID', 'HCT': 'HEMATOCRIT',
  'Hemoglobin': 'HEMOGLOBIN', 'Total Cholesterol': 'TOTAL_CHOLESTEROL',
  'Triglycerides': 'TRIGLYCERIDES', 'T3 free': 'T3_FREE', 'T4 free': 'T4_FREE',
  'Anti-TPO': 'ANTI_TPO', 'Anti-TG': 'ANTI_TG', 'Vitamin D (25-OH)': 'VITAMIN_D',
  'Transferrin Sat': 'TRANSFERRIN_SAT', 'CK-MB': 'CK_MB', 'D-dimer': 'D_DIMER',
  'IL-6': 'IL_6', 'TNF-alpha': 'TNF_ALPHA', 'DHEA-S': 'DHEA_S', '3a-ADG': '3A_ADG',
  'PSA total': 'PSA_TOTAL', 'PSA free': 'PSA_FREE', 'CA-125': 'CA_125', 'Lp(a)': 'LP_A',
};

export function labSliceToValues(fp: LabSlice | null): Record<string, number> {
  if (!fp) return {};
  const out: Record<string, number> = {};
  for (const pk of PANEL_KEYS) {
    const panel = (fp as any)[pk] as Record<string, string> | undefined;
    if (!panel) continue;
    for (const [marker, val] of Object.entries(panel)) {
      if (!val) continue;
      const num = parseFloat(val);
      if (isNaN(num)) continue;
      const rename = MARKER_RENAME[marker] || marker.toUpperCase().replace(/\s+/g, '_');
      out[rename] = num;
    }
  }
  return out;
}

export function buildMapperCtx(
  state: CalculatorState,
  level: SupportLevel,
  manualChoices?: { addSubs?: string[]; removeSubs?: string[]; explicitCategories?: any[] },
  stackTriggers?: string[],
): MapperCtx {
  const phaseKey = (state.pharma.phase === 'bridge' ? 'bridge'
    : state.pharma.phase === 'pct' ? 'pct'
    : state.pharma.phase === 'base' ? 'trt'
    : 'course') as PhaseKey;
  const phaseCtx: PhaseContext = {
    usingAAS: state.pharma.aas.length > 0,
    usingBridgeAAS: state.pharma.aas.length > 0 && state.pharma.phase === 'bridge',
    explicitPhase: phaseKey,
    onPCTDrug: state.pharma.phase === 'pct',
    inFertilityProgram: false,
  };
  const labs = labSliceToValues(state.labs.fullPanel);
  const pedDoses = (Array.isArray(state.pharma?.aas) ? state.pharma.aas : [])
    .filter((a: any) => a && a.id)
    .map((a: any) => ({
      id: (a.id as string).toLowerCase(),
      pClass: classifyPed(a.id),
       mgPerWeek: Number(a.mgPerWeek ?? a.dosePerWeek ?? a.doseMgWeek ?? (a.dose ? Number(String(a.dose).replace(/\D/g,''))*7 : 500)) || 0,
      form: (a.form === 'oral' || a.route === 'oral' ? 'oral' : 'inject') as 'oral' | 'inject',
    }));
  const ghIU = state.pharma.ghIU || 0;
  if (ghIU > 0) pedDoses.push({ id: 'somatropin', pClass: 'gh', iuPerDay: ghIU, form: 'subq' } as any);
  const insulinIU = state.pharma.insulinIU || 0;
  if (insulinIU > 0) pedDoses.push({ id: 'insulin_rapid', pClass: 'insulin', iuPerDay: insulinIU, form: 'subq' } as any);
  const igfMcg = state.pharma.igfMcg || 0;
  if (igfMcg > 0) pedDoses.push({ id: 'igf1_lr3', pClass: 'igf', mcgPerDay: igfMcg, form: 'subq' } as any);
  const clenMcg = state.pharma.clenMcg || 0;
  if (clenMcg > 0) pedDoses.push({ id: 'clenbuterol', pClass: 'clenbut', mcgPerDay: clenMcg, form: 'oral' } as any);
  const t3Mcg = state.pharma.t3Mcg || 0;
  if (t3Mcg > 0) pedDoses.push({ id: 't3', pClass: 't3', mcgPerDay: t3Mcg, form: 'oral' } as any);

  // ── PED-risk assessment (Фаза 1: нейро/суставы по стеку PED) ──
  const pedRisk = assessPedRisk(pedDoses, level);
  const symptomsList = state.symptoms || [];

  const boosterCtx: BoosterTriggerCtx = {
    anxietyScore: state.neuro.aggressionScore,
    sleepHours: state.profile.sleepHours,
    stressScore: state.profile.stressLevel,
    cortisolHigh: false,
    irritability: state.neuro.aggressionScore > 6,
    jointPainScore: state.oda.jointPain === 'severe' ? 8 : state.oda.jointPain === 'moderate' ? 5 : state.oda.jointPain === 'mild' ? 3 : 0,
    crpLevel: labs['CRP'] || labs['HSCRP'],
    // hemato labs (для computeHematoTier)
    hematocrit: labs['HEMATOCRIT'] || labs['HCT'],
    hemoglobin: labs['HEMOGLOBIN'] || labs['HGB'],
    plt: labs['PLT'],
    fibrinogen: labs['FIBRINOGEN'],
    dDimer: labs['D_DIMER'],
    triggeredStackIds: stackTriggers || [],
    // Фаза 1: symptom-кнопки + force на max + PED-risk tiers
    symptomJoints: symptomsList.includes('joint_pain'),
    symptomNeuro: symptomsList.some(s => ['insomnia','anxiety','mood_swings'].includes(s)),
    symptomHemato: symptomsList.some(s => ['hyperviscosity','headache','plethora','tinnitus'].includes(s)) || (labs['HEMATOCRIT'] != null && labs['HEMATOCRIT'] > 50),
    forceNeuro: level === 'max',
    forceJoints: level === 'max',
    forceHemato: level === 'max',
    pedNeuroTier: pedRisk.neuroBoosterTier,
    pedJointsTier: pedRisk.jointsBoosterTier,
    pedHematoTier: pedRisk.hematoBoosterTier,
    pedRiskReasons: pedRisk.triggeredBy,
  };
  return {
    labs, phaseCtx, boosterCtx, level, manualChoices,
     onCourse: (Array.isArray(state.pharma?.aas) ? state.pharma.aas.length : 0) > 0 || pedDoses.length > 0,
    e2Level: labs['ESTRADIOL'], hemoglobin: labs['HEMOGLOBIN'], hematocrit: labs['HEMATOCRIT'],
    hasHCG: state.pharma.hasHCG, hasAI: state.pharma.hasAI,
    hasCabergoline: state.pharma.hasCaber || false,
     aasIds: (Array.isArray(state.pharma?.aas) ? state.pharma.aas : []).map((a: any) => a.id || '').filter(Boolean),
    pedDoses, libidoLow: symptomsList.includes('low_libido'),
    bpSystolic: state.cardio.bpStage === 'high' ? 150 : state.cardio.bpStage === 'normal' ? 120 : 135,
    lipidLdl: labs['LDL'],
    symptoms: symptomsList,
    healthConditions: state.healthConditions || [],
    pedRisk,
  };
}
