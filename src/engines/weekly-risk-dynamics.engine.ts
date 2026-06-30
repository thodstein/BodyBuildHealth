// ============================================================
// Health Engine v9 — Weekly Risk Dynamics Engine
// Calculates risk per week considering PK accumulation/washout
// ============================================================

import { ALL_RISK_SYSTEMS } from '../core/constants';
import { PHARMA_DB } from '../core/pharma-database';
import type { RiskResult, CourseEntry } from '../core/types';
import { eliminationConstant } from './pk-pd.engine';
import { DRUG_THRESHOLDS_V7, getGeneticMultiplier, CORE_SYSTEMS_V7 } from './risk-engine-v7-matrix';

// TZ-compatible base risk values (mirrors risk-engine-tz.ts BASE_RISK)
const BASE_RISK_V7: Record<string, Record<number, number>> = {
  cardio: { 1: 0.35, 2: 0.35, 3: 0.25, 4: 0.30, 5: 0.20, 6: 0.18, 7: 0.28 },
  hepatic: { 1: 0.30, 2: 0.35, 3: 0.25, 4: 0.22, 5: 0.18, 6: 0.25, 7: 0.30 },
  renal: { 1: 0.25, 2: 0.22, 3: 0.22, 4: 0.18, 5: 0.15, 6: 0.12, 7: 0.22 },
  neuro: { 1: 0.28, 2: 0.22, 3: 0.22, 4: 0.20, 5: 0.20, 6: 0.15, 7: 0.22 },
  endocrine: { 1: 0.45, 2: 0.35, 3: 0.22, 4: 0.20, 5: 0.15, 6: 0.20, 7: 0.22 },
  hematologic: { 1: 0.35, 2: 0.22, 3: 0.15, 4: 0.25, 5: 0.15, 6: 0.22, 7: 0.15 },
  reproductive: { 1: 0.40, 2: 0.35, 3: 0.22, 4: 0.20, 5: 0.22, 6: 0.15, 7: 0.22 },
};

function geom(arr: number[]): number {
  if (!arr.length) return 0;
  const l = arr.reduce((a, v) => a + Math.log(Math.max(0.0001, v)), 0);
  return Math.exp(l / arr.length) * 100;
}

export interface WeeklyRiskPoint {
  week: number;
  overallRaw: number;
  overallNet: number;
  systemBreakdown: Record<string, { raw: number; net: number }>;
  activeDrugs: string[];
  peakConcentration: number;
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

function getConcentrationFactor(
  drugId: string,
  week: number,
  course: CourseEntry[]
): { factor: number; isActive: boolean } {
  const entry = course.find(c => {
    const normId = c.substanceId.replace(/[-\s]/g, '_').toLowerCase();
    const normDrugId = drugId.replace(/[-\s]/g, '_').toLowerCase();
    return normId === normDrugId || normId.startsWith(normDrugId) || normDrugId.startsWith(normId);
  });

  if (!entry) return { factor: 0, isActive: false };

  const pharmaEntry = Object.values(PHARMA_DB).find((p: any) => {
    const normId = (p as any).id?.replace(/[-\s]/g, '_').toLowerCase();
    const normDrugId = drugId.replace(/[-\s]/g, '_').toLowerCase();
    return normId === normDrugId || normId.startsWith(normDrugId);
  });

  const halfLifeHours = (pharmaEntry as any)?.pk?.halfLifeHours ?? (pharmaEntry as any)?.tHalfHours ?? 168;
  const k = eliminationConstant(halfLifeHours);

  const startWeek = entry.startWeek;
  const endWeek = entry.endWeek;
  const hoursPerWeek = 168;

  if (week < startWeek) return { factor: 0, isActive: false };

  if (week >= startWeek && week <= endWeek) {
    const accumulationHours = (week - startWeek) * hoursPerWeek;
    const factor = 1 - Math.exp(-k * accumulationHours);
    return { factor: Math.min(1, factor), isActive: true };
  }

  const washoutWeeks = week - endWeek;
  const peakFactor = 1 - Math.exp(-k * (endWeek - startWeek) * hoursPerWeek);
  const washoutFactor = peakFactor * Math.exp(-k * washoutWeeks * hoursPerWeek);
  return { factor: Math.max(0, washoutFactor), isActive: false };
}

export function calculateWeeklyRiskDynamics(
  baseInput: {
    genetics?: Record<string, string>;
    nutritionFactor?: number;
    trainingFactor?: number;
    activeDrugs?: Record<string, { dosePerWeek: number }>;
    supportCoverage?: Record<string, number>;
  },
  course: CourseEntry[]
): WeeklyRiskDynamics {
  if (!course || course.length === 0) {
    const emptyRisk: RiskResult = {
      overallRaw: 7,
      overallNet: 5,
      systemBreakdown: Object.fromEntries(ALL_RISK_SYSTEMS.map(s => [s, { raw: 7, net: 5 }])),
    };
    return {
      weeks: [],
      courseDuration: 0,
      averageRisk: emptyRisk,
      peakRiskWeek: 0,
      peakRiskValue: 5,
      minRiskWeek: 0,
      minRiskValue: 5,
      currentWeekRisk: null,
    };
  }

  const maxWeek = Math.max(...course.map(c => c.endWeek));
  const washoutWeeks = 6;
  const totalWeeks = maxWeek + washoutWeeks;
  const duration = maxWeek;

  const weeklyPoints: WeeklyRiskPoint[] = [];
  let peakRiskValue = 0;
  let peakRiskWeek = 0;
  let minRiskValue = 100;
  let minRiskWeek = 0;
  let sumRaw = 0;
  let sumNet = 0;
  let courseWeeks = 0;

  for (let w = 1; w <= totalWeeks; w++) {
    const drugFactors: Record<string, number> = {};
    const activeAtWeek: string[] = [];

    for (const drugId of Object.keys(baseInput.activeDrugs || {})) {
      const { factor, isActive } = getConcentrationFactor(drugId, w, course);
      drugFactors[drugId] = factor;
      if (isActive) activeAtWeek.push(drugId);
    }

    let phase: WeeklyRiskPoint['accumulationPhase'] = 'none';
    if (activeAtWeek.length > 0) {
      const maxFactor = Math.max(...Object.values(drugFactors));
      if (maxFactor < 0.85) phase = 'ramp-up';
      else phase = 'steady';
    } else {
      const anyResidual = Object.values(drugFactors).some(f => f > 0.05);
      if (anyResidual) phase = 'washout';
    }

    const scaledDrugs: Record<string, { dosePerWeek: number }> = {};
    for (const [drugId, dose] of Object.entries(baseInput.activeDrugs || {})) {
      const factor = drugFactors[drugId] || 0;
      scaledDrugs[drugId] = { dosePerWeek: dose.dosePerWeek * Math.max(factor, 0.05) };
    }

    const brk: Record<string, { raw: number; net: number }> = {};
    const oR: number[] = [];
    const oN: number[] = [];

    const genetics = baseInput.genetics || {};
    const N = Math.max(0.5, Math.min(1.5, baseInput.nutritionFactor ?? 0.8));
    const T = Math.max(1, Math.min(1.5, baseInput.trainingFactor ?? 0.7));
    const cov = baseInput.supportCoverage || {};

    for (const s of ALL_RISK_SYSTEMS) {
      // Skip non-core systems for dynamics (only CORE_SYSTEMS_V7 have full 7-mechanism baseRisk)
      if (!CORE_SYSTEMS_V7.includes(s as any)) continue;
      const rM: number[] = [];
      const nM: number[] = [];

      for (let m = 1; m <= 7; m++) {
        let prod = 1;
        const baseRisk = BASE_RISK_V7[s]?.[m] ?? 0.02;

        // Genetic multiplier (same as TZ engine)
        const G = getGeneticMultiplier(genetics as any, s, m);

        // Cumulative product over drugs that affect this (system, mechanism)
        let hasDrugContrib = false;
        for (const [drug, d] of Object.entries(scaledDrugs)) {
          const threshold = DRUG_THRESHOLDS_V7[drug];
          let contr = 0;
          if (threshold?.systems?.[s]?.[m] !== undefined) {
            contr = threshold.systems[s][m];
          } else if (threshold?.systems?.[s]) {
            // Drug targets this system → distribute residual
            const sysBase = BASE_RISK_V7[s] || {};
            const totalBase = Object.values(sysBase).reduce((a: number, b: number) => a + b, 0) || 1;
            const thisBase = sysBase[m] ?? 0.02;
            contr = (thisBase / totalBase) * 0.15;
          }
          if (contr > 0) {
            hasDrugContrib = true;
            const doseF = Math.min(2.0, Math.pow((d.dosePerWeek || 0) / Math.max(1, threshold?.dosePerWeek || 300), 1.2));
            const cellRisk = baseRisk * contr * doseF * G * N * T;
            if (cellRisk > 0.001) {
              prod *= (1 - Math.min(0.99, cellRisk));
            }
          }
        }

        const raw = hasDrugContrib
          ? Math.max(5, Math.min(100, (1 - prod) * 100))
          : baseRisk * G * N * T * 30; // No-drug baseline (×30 to scale 0.02→~1.8%)

        // Apply support coverage as direct reduction
        const id = `${s}_${m}`;
        const cellCov = cov[id] || 0;
        const net = Math.max(0, raw * (1 - Math.min(0.8, cellCov)));

        rM.push(raw / 100);
        nM.push(net / 100);
      }

      if (rM.length > 0) {
        brk[s] = { raw: geom(rM), net: geom(nM) };
        oR.push(brk[s].raw / 100);
        oN.push(brk[s].net / 100);
      }
    }

    const overallRaw = oR.length > 0 ? Math.min(100, Math.max(0, geom(oR))) : 7;
    const overallNet = oN.length > 0 ? Math.min(100, Math.max(0, geom(oN))) : 5;

    weeklyPoints.push({
      week: w,
      overallRaw,
      overallNet,
      systemBreakdown: brk,
      activeDrugs: activeAtWeek,
      peakConcentration: Object.values(drugFactors).length > 0 ? Math.max(...Object.values(drugFactors)) : 0,
      accumulationPhase: phase,
    });

    if (phase === 'ramp-up' || phase === 'steady') {
      sumRaw += overallRaw;
      sumNet += overallNet;
      courseWeeks++;
    }
    if (overallNet > peakRiskValue) { peakRiskValue = overallNet; peakRiskWeek = w; }
    if (overallNet < minRiskValue) { minRiskValue = overallNet; minRiskWeek = w; }
  }

  const avgRaw = courseWeeks > 0 ? sumRaw / courseWeeks : 7;
  const avgNet = courseWeeks > 0 ? sumNet / courseWeeks : 5;
  const averageRisk: RiskResult = {
    overallRaw: avgRaw,
    overallNet: avgNet,
    systemBreakdown: Object.fromEntries(
      ALL_RISK_SYSTEMS.map(s => {
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
    currentWeekRisk: null,
  };
}
