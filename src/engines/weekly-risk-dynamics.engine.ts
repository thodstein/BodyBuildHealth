// ============================================================
// Health Engine v9 — Weekly Risk Dynamics Engine
// Calculates risk per week considering PK accumulation/washout
// ============================================================

import { RISK_SYSTEMS, BASE_RISK, DRUG_THRESHOLDS, SUPPORT_BASE_COVERAGE, GENETIC_MULTIPLIERS, MRR_FACTORS } from '../core/constants';
import { PHARMA_DB } from '../core/pharma-database';
import type { RiskResult, MechanismCell, CourseEntry } from '../core/types';
import { eliminationConstant } from './pk-pd.engine';

// Drug mechanism weights per mechanism (1-7)
const DRUG_MECH_WEIGHTS: Record<string, Record<number, number>> = {
  testosterone_enanthate:    { 5: 0.6, 6: 0.4, 7: 0.2 },
  testosterone_cypionate:   { 5: 0.6, 6: 0.4, 7: 0.2 },
  testosterone_propionate:  { 5: 0.6, 6: 0.3, 7: 0.1 },
  test_enan:                { 5: 0.6, 6: 0.4, 7: 0.2 },
  test_cyp:                 { 5: 0.6, 6: 0.4, 7: 0.2 },
  test_undec:               { 5: 0.6, 6: 0.4, 7: 0.2 },
  test_prop:                { 5: 0.6, 6: 0.3, 7: 0.1 },
  trenbolone_acetate:       { 1: 0.3, 5: 0.5, 6: 0.4, 2: 0.3, 7: 0.2 },
  trenbolone_enanthate:     { 1: 0.3, 5: 0.5, 6: 0.4, 2: 0.3, 7: 0.2 },
  tren_acetate:             { 1: 0.3, 5: 0.5, 6: 0.4, 2: 0.3, 7: 0.2 },
  nandrolone_decanoate:     { 5: 0.4, 7: 0.3, 6: 0.2, 3: 0.2 },
  nandrolone_phenylprop:    { 5: 0.4, 7: 0.3, 6: 0.2, 3: 0.2 },
  boldenone_undecylenate:   { 5: 0.3, 2: 0.3, 7: 0.2, 6: 0.1 },
  methenolone_enanthate:    { 5: 0.3, 1: 0.1, 7: 0.1 },
  oxandrolone:              { 1: 0.7, 2: 0.3, 5: 0.1 },
  stanozolol:               { 1: 0.8, 2: 0.4, 6: 0.3, 4: 0.1 },
  methandienone:            { 1: 0.7, 2: 0.3, 5: 0.3, 6: 0.2 },
  oxymetholone:             { 1: 0.9, 2: 0.3, 6: 0.2, 4: 0.1 },
  halotestin:               { 1: 0.8, 6: 0.4, 3: 0.2, 5: 0.2 },
  anastrozole:              { 5: 0.2, 2: 0.1, 4: 0.2 },
  letrozole:                { 5: 0.3, 2: 0.1, 4: 0.3 },
  cabergoline:              { 5: 0.4, 1: 0.2, 4: 0.1 },
  clomid:                   { 5: 0.2, 4: 0.1 },
  hcg:                      { 5: 0.5 },
  tamoxifen:                { 5: 0.2, 7: 0.1 },
  mk677:                    { 2: 0.2, 5: 0.3, 7: 0.1 },
  ostarine:                 { 5: 0.2, 2: 0.1, 7: 0.1 },
  lgd4033:                  { 5: 0.3, 2: 0.1, 7: 0.1 },
  rad140:                   { 5: 0.3, 2: 0.1, 7: 0.15 },
  gw501516:                 { 2: 0.5, 7: 0.3 },
  sr9009:                   { 2: 0.3 },
  bpc157:                   {},
  semax:                    { 1: 0.1, 3: 0.15 },
  tb500:                    {},
  meloxicam:                { 1: 0.15, 4: 0.2, 6: 0.1 },
  diclofenac:               { 1: 0.2, 4: 0.15, 6: 0.15 },
};

// PD system map for risk calculation
const PD_SYSTEM_MAP: Record<string, { pdKey: string; weight: number }> = {
  cardio:     { pdKey: 'lipid_impact',    weight: 0.6 },
  hepatic:    { pdKey: 'hepatotoxicity', weight: 1.0 },
  renal:      { pdKey: 'hct_impact',      weight: 0.15 },
  neuro:      { pdKey: 'neuro_toxicity',  weight: 1.0 },
  endocrine:  { pdKey: 'aromatization',    weight: 0.5 },
  hematologic:{ pdKey: 'hct_impact',      weight: 0.5 },
  reproductive:{ pdKey: 'progestogenic',   weight: 0.4 },
  musculoskeletal: { pdKey: 'lipid_impact', weight: 0.1 },
  metabolic:    { pdKey: 'aromatization', weight: 0.4 },
  ghigf:        { pdKey: 'AR_affinity', weight: 0.3 },
  ins_axis:     { pdKey: 'lipid_impact', weight: 0.3 },
  neuro_toxicity: { pdKey: 'neuro_toxicity', weight: 1.0 },
  blood:        { pdKey: 'hct_impact', weight: 0.4 },
  vessels:      { pdKey: 'lipid_impact', weight: 0.5 },
};

function geom(arr: number[]): number {
  if (!arr.length) return 0;
  const l = arr.reduce((a, v) => a + Math.log(Math.max(0.0001, v)), 0);
  return Math.exp(l / arr.length) * 100;
}

function getDrugMechWeight(drugId: string, mech: number): number {
  const normalizedId = drugId.replace(/[-\s]/g, '_').toLowerCase();
  const weights = DRUG_MECH_WEIGHTS[normalizedId] || DRUG_MECH_WEIGHTS[drugId] || {};
  return weights[mech] || 0;
}

export interface WeeklyRiskPoint {
  week: number;
  overallRaw: number;
  overallNet: number;
  systemBreakdown: Record<string, { raw: number; net: number }>;
  activeDrugs: string[];
  peakConcentration: number; // relative to steady-state (0-1+)
  accumulationPhase: 'ramp-up' | 'steady' | 'washout' | 'none';
}

export interface WeeklyRiskDynamics {
  weeks: WeeklyRiskPoint[];
  courseDuration: number;
  averageRisk: RiskResult;
  peakRiskWeek: number;
  peakRiskValue: number;
  minRiskWeek: number;
  minRiskValue: number;
  currentWeekRisk: WeeklyRiskPoint | null;
}

/**
 * Calculate PK concentration factor for a drug at a given week,
 * accounting for accumulation and washout.
 * Uses simple exponential accumulation model.
 */
function getConcentrationFactor(
  drugId: string,
  week: number,
  course: CourseEntry[]
): { factor: number; isActive: boolean } {
  // Find all course entries for this drug
  const entries = course.filter(c => {
    const normalizedId = c.substanceId.replace(/[-\s]/g, '_').toLowerCase();
    return normalizedId === drugId.replace(/[-\s]/g, '_').toLowerCase() || c.substanceId === drugId;
  });

  if (entries.length === 0) return { factor: 0, isActive: false };

  const sub = PHARMA_DB[entries[0].substanceId] || PHARMA_DB[drugId];
  if (!sub) return { factor: entries.some(e => week >= e.startWeek && week <= e.endWeek) ? 0.5 : 0, isActive: entries.some(e => week >= e.startWeek && week <= e.endWeek) };

  const tHalf = sub.pk.halfLifeHours;
  const k = eliminationConstant(tHalf);
  const steadyStateWeeks = Math.ceil(5 * (tHalf / (24 * 7))); // 5 half-lives in weeks

  let totalFactor = 0;
  let anyActive = false;

  for (const entry of entries) {
    const startW = entry.startWeek || 0;
    const endW = entry.endWeek || 12;

    if (week < startW) {
      // Before start — no concentration from this entry
      continue;
    }

    if (week >= startW && week <= endW) {
      // During active use — accumulation curve
      const weeksInUse = week - startW;
      const accumulationFraction = 1 - Math.exp(-k * weeksInUse * 168); // 168 hours per week
      const factor = Math.min(1, accumulationFraction);
      totalFactor = Math.max(totalFactor, factor);
      anyActive = true;
    } else if (week > endW) {
      // After end — washout curve
      const weeksSinceEnd = week - endW;
      const weeksUsed = endW - startW;
      const peakConcentration = Math.min(1, 1 - Math.exp(-k * weeksUsed * 168));
      const washoutFraction = Math.exp(-k * weeksSinceEnd * 168);
      const factor = peakConcentration * washoutFraction;
      if (factor > 0.01) { // Only count if >1% remaining
        totalFactor = Math.max(totalFactor, factor);
        // Drug still has residual effect
        if (factor > 0.05) anyActive = true;
      }
    }
  }

  return { factor: totalFactor, isActive: anyActive };
}

/**
 * Calculate weekly risk dynamics across the entire course.
 * For each week, calculates risk considering PK accumulation/washout.
 */
export function calculateWeeklyRiskDynamics(
  baseInput: {
    genetics?: Record<string, string>;
    nutritionFactor?: number;
    trainingFactor?: number;
    activeDrugs: Record<string, { dosePerWeek: number }>;
    supportCoverage?: Record<string, number>;
  },
  course: CourseEntry[],
  totalWeeks?: number
): WeeklyRiskDynamics {
  // Determine course span
  if (course.length === 0) {
    const emptyResult: RiskResult = {
      overallRaw: 7, overallNet: 5,
      systemBreakdown: Object.fromEntries(RISK_SYSTEMS.map(s => [s, { raw: 7, net: 5 }])),
    };
    return {
      weeks: [{ week: 0, overallRaw: 7, overallNet: 5, systemBreakdown: emptyResult.systemBreakdown, activeDrugs: [], peakConcentration: 0, accumulationPhase: 'none' }],
      courseDuration: 0,
      averageRisk: emptyResult,
      peakRiskWeek: 0,
      peakRiskValue: 7,
      minRiskWeek: 0,
      minRiskValue: 5,
      currentWeekRisk: null,
    };
  }

  const maxEnd = Math.max(...course.map(c => c.endWeek || 12));
  const maxStart = Math.min(...course.map(c => c.startWeek || 0));
  const duration = totalWeeks || Math.max(maxEnd + 4, 16); // Add 4 weeks washout, min 16

  const weeklyPoints: WeeklyRiskPoint[] = [];
  let sumRaw = 0;
  let sumNet = 0;
  let courseWeeks = 0;
  let peakRiskWeek = 0;
  let peakRiskValue = 0;
  let minRiskWeek = 0;
  let minRiskValue = 100;

  for (let w = 0; w <= duration; w++) {
    // Calculate concentration factors for each active drug at this week
    const drugFactors: Record<string, number> = {};
    const activeAtWeek: string[] = [];

    for (const drugId of Object.keys(baseInput.activeDrugs)) {
      const { factor, isActive } = getConcentrationFactor(drugId, w, course);
      drugFactors[drugId] = factor;
      if (isActive) activeAtWeek.push(drugId);
    }

    // Determine accumulation phase
    let phase: WeeklyRiskPoint['accumulationPhase'] = 'none';
    if (activeAtWeek.length > 0) {
      const maxFactor = Math.max(...Object.values(drugFactors));
      if (maxFactor < 0.85) phase = 'ramp-up';
      else phase = 'steady';
    } else {
      const anyResidual = Object.values(drugFactors).some(f => f > 0.05);
      if (anyResidual) phase = 'washout';
    }

    // Scale activeDrugs by concentration factor
    const scaledDrugs: Record<string, { dosePerWeek: number }> = {};
    for (const [drugId, dose] of Object.entries(baseInput.activeDrugs)) {
      const factor = drugFactors[drugId] || 0;
      // Use effective dose considering PK
      scaledDrugs[drugId] = { dosePerWeek: dose.dosePerWeek * Math.max(factor, 0.05) };
    }

    // Calculate risk for this week using the base risk engine logic
    const brk: Record<string, { raw: number; net: number }> = {};
    const oR: number[] = [];
    const oN: number[] = [];

    const G = baseInput.genetics || {};
    const N = Math.max(0.5, Math.min(1.5, baseInput.nutritionFactor ?? 0.8));
    const T = Math.max(1, Math.min(1.5, baseInput.trainingFactor ?? 0.7));
    const cov = baseInput.supportCoverage || {};

    for (const s of RISK_SYSTEMS) {
      const rM: number[] = [];
      const nM: number[] = [];

      for (let m = 1; m <= 7; m++) {
        let prod = 1;
        let pdFactor = 0;
        const pdMapping = PD_SYSTEM_MAP[s];

        for (const [drug, d] of Object.entries(scaledDrugs)) {
          const cfg = DRUG_THRESHOLDS[drug];
          const pdEntry = Object.values(PHARMA_DB).find(p => p.id === drug || drug.startsWith(p.id.replace(/_/g, '_')));
          if (pdEntry && pdMapping) {
            const pdVal = (pdEntry.pd as any)[pdMapping.pdKey] ?? 0;
            pdFactor += Math.abs(pdVal) * pdMapping.weight * (d.dosePerWeek / (pdEntry.ec50 || 300));
          }
          const mechWeight = getDrugMechWeight(drug, m);
          const doseRatio = cfg ? Math.min(2, Math.pow((d.dosePerWeek || 0) / cfg.dosePerWeek, 1.2)) : mechWeight > 0 ? Math.min(1.5, (d.dosePerWeek || 0) / 300) : 0;
          const mechContribution = Math.max(0, BASE_RISK * doseRatio * 1 * N * T * (1 + mechWeight * 3));
          if (mechContribution > 0.005 || (cfg && doseRatio > 0.1)) {
            prod *= (1 - Math.min(0.99, BASE_RISK * (doseRatio || 0.01) * (G[s] ? 1 : 1) * N * T));
          }
        }

        const raw = Math.max(7, Math.min(100, (1 - prod) * 100 + pdFactor * 15));
        const id = `${s}_${m}`;
        const cellCov = cov[id] || 0;
        const net = Math.max(0, raw * (1 - cellCov));
        rM.push(raw / 100);
        nM.push(net / 100);
      }

      brk[s] = { raw: geom(rM), net: geom(nM) };
      oR.push(brk[s].raw / 100);
      oN.push(brk[s].net / 100);
    }

    const overallRaw = Math.min(100, Math.max(0, geom(oR)));
    const overallNet = Math.min(100, Math.max(0, geom(oN)));

    weeklyPoints.push({
      week: w,
      overallRaw,
      overallNet,
      systemBreakdown: brk,
      activeDrugs: activeAtWeek,
      peakConcentration: Object.values(drugFactors).length > 0 ? Math.max(...Object.values(drugFactors)) : 0,
      accumulationPhase: phase,
    });

    // Track stats for course weeks only (not washout)
    if (phase === 'ramp-up' || phase === 'steady') {
      sumRaw += overallRaw;
      sumNet += overallNet;
      courseWeeks++;
    }
    if (overallNet > peakRiskValue) { peakRiskValue = overallNet; peakRiskWeek = w; }
    if (overallNet < minRiskValue) { minRiskValue = overallNet; minRiskWeek = w; }
  }

  // Calculate average risk for course duration
  const avgRaw = courseWeeks > 0 ? sumRaw / courseWeeks : 7;
  const avgNet = courseWeeks > 0 ? sumNet / courseWeeks : 5;
  const averageRisk: RiskResult = {
    overallRaw: avgRaw,
    overallNet: avgNet,
    systemBreakdown: Object.fromEntries(
      RISK_SYSTEMS.map(s => {
        const raws = weeklyPoints.filter(p => p.accumulationPhase !== 'none' && p.accumulationPhase !== 'washout').map(p => p.systemBreakdown[s]?.raw || 0);
        const nets = weeklyPoints.filter(p => p.accumulationPhase !== 'none' && p.accumulationPhase !== 'washout').map(p => p.systemBreakdown[s]?.net || 0);
        return [s, { raw: raws.length > 0 ? raws.reduce((a, b) => a + b, 0) / raws.length : 7, net: nets.length > 0 ? nets.reduce((a, b) => a + b, 0) / nets.length : 5 }];
      })
    ),
  };

  return {
    weeks: weeklyPoints,
    courseDuration: duration,
    averageRisk,
    peakRiskWeek,
    peakRiskValue,
    minRiskWeek,
    minRiskValue,
    currentWeekRisk: null, // Can be set by UI based on profile.week
  };
}
