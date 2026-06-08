import { GENETIC_MULTIPLIERS, DRUG_THRESHOLDS, RISK_SYSTEMS, BASE_RISK, MRR_FACTORS, HGI_FACTORS, RIR_FACTORS, SUPPORT_BASE_COVERAGE } from '../core/constants';
import { RiskInput, RiskResult, MechanismCell } from '../core/types';
import { PHARMA_DB } from '../core/pharma-database';
import { PD_SYSTEM_MAP, DRUG_MECH_WEIGHTS, getDrugMechWeight } from '../core/risk-shared';

function geom(arr: number[]) {
   if (!arr.length) return 0;
   const l = arr.reduce((a, v) => a + Math.log(Math.max(0.0001, v)), 0);
   return Math.exp(l / arr.length) * 100;
}

function calculateMrrAdjustment(value: number, optimalMin: number, optimalMax: number): number {
   if (value >= optimalMin && value <= optimalMax) return 1.0;
   let deviation = 0;
   if (value < optimalMin) deviation = (optimalMin - value) / optimalMin;
   else if (value > optimalMax) deviation = (value - optimalMax) / optimalMax;
   return 1 + (deviation * 2);
}

function calculateHgiAdjustment(hgiMarkers: Record<string, number>): number {
   const vals = Object.values(hgiMarkers);
   if (!vals.length) return 1.0;
   const hgiScore = vals.reduce((sum, val) => sum + val, 0) / vals.length;
   return Math.max(0.5, Math.min(1.5, hgiScore));
}

function calculateRirAdjustment(interventionResponse: number): number {
   return 0.5 + (interventionResponse * 0.5);
}

export function calculateRisks(i: RiskInput): RiskResult {
   const brk: Record<string, { raw: number; net: number }> = {};
   const mechBrk: Record<string, number> = {};
   const mechDetail: Record<string, MechanismCell> = {};
   const oR: number[] = [];
   const oN: number[] = [];

   for (const s of RISK_SYSTEMS) {
      const rM: number[] = [];
      const nM: number[] = [];
      for (let m = 1; m <= 7; m++) {
         const id = `${s}_${m}`;
         const G = GENETIC_MULTIPLIERS[s]?.[i.genetics?.[s] || 'Val/Val'] || 1.0;
         const N = Math.max(0.5, Math.min(1.5, i.nutritionFactor ?? 1));
         const T = Math.max(1, Math.min(1.5, i.trainingFactor ?? 1));

         const mrrAdjustment = calculateMrrAdjustment(
            i.biomarkerValues?.[s] ?? 1.0,
            MRR_FACTORS[s]?.optimalMin || 0.8,
            MRR_FACTORS[s]?.optimalMax || 1.2
         );

         const hgiAdjustment = calculateHgiAdjustment(i.hgiMarkers || {});
         const rirAdjustment = calculateRirAdjustment(i.interventionResponse ?? 0.5);

         const pdMapping = PD_SYSTEM_MAP[s];

         let prod = 1;
         let pdFactor = 0;
         const contributors: string[] = [];
         for (const [drug, d] of Object.entries(i.activeDrugs || {})) {
            const cfg = DRUG_THRESHOLDS[drug.replace(/[-\s]/g, '_').toLowerCase()] || DRUG_THRESHOLDS[drug];
            const mechWeight = getDrugMechWeight(drug, m);
            const doseRatio = cfg ? Math.min(2, Math.pow((d.dosePerWeek || 0) / cfg.dosePerWeek, 1.2)) : mechWeight > 0 ? Math.min(1.5, (d.dosePerWeek || 0) / 300) : 0;
            const drugPdFactor = pdMapping ? (Object.values(PHARMA_DB).find((p: any) => p.id === drug || drug.startsWith((p as any).id?.replace(/_/g, '_') ?? '')) as any) : null;
            if (drugPdFactor && pdMapping) {
               const pdVal = drugPdFactor.pd?.[pdMapping.pdKey] ?? 0;
               pdFactor += Math.abs(pdVal) * pdMapping.weight * ((d.dosePerWeek || 0) / (drugPdFactor.ec50 || 300));
            }
            if (cfg && doseRatio > 0.01 || mechWeight > 0) {
               const mechContribution = Math.max(0, BASE_RISK * doseRatio * G * N * T * (1 + mechWeight * 3));
               contributors.push(drug);
               prod *= (1 - Math.min(0.99, BASE_RISK * (doseRatio || 0.01) * G * N * T));
            }
         }

         const raw = Math.max(7, Math.min(100, (1 - prod) * 100 + pdFactor * 15));
         const cellCov = (i.supportCoverage || {})[id] || 0;
         const net = Math.max(0, raw * (1 - cellCov));

         mechBrk[id] = raw;
         mechDetail[id] = {
            raw,
            net,
            coverage: cellCov,
            contributors: [...new Set(contributors)],
            mitigations: Object.entries(i.supportCoverage || {})
               .filter(([k, v]) => k.startsWith(s) && v > 0)
               .map(([k, v]) => ({ substance: k.split('_').pop() || k, reduction: v })),
         };

         rM.push(raw / 100);
         nM.push(net / 100);
      }

      brk[s] = { raw: geom(rM), net: geom(nM) };
      oR.push(brk[s].raw / 100);
      oN.push(brk[s].net / 100);
   }

   const overallMrr = calculateMrrAdjustment(
      i.overallBiomarkerValue ?? 1.0,
      0.8, 1.2
   );
   const overallHgi = calculateHgiAdjustment(i.overallHgiMarkers || {});
   const overallRir = calculateRirAdjustment(i.overallInterventionResponse ?? 0.5);

   return {
      systemBreakdown: brk,
      mechanismBreakdown: mechBrk,
      mechanismDetail: mechDetail,
      overallRaw: Math.min(100, Math.max(0, geom(oR) * overallMrr * overallHgi * (2 - overallRir))),
      overallNet: Math.min(100, Math.max(0, geom(oN) * overallMrr * overallHgi * (2 - overallRir)))
   };
}

// Агрегированный риск из всех источников (фарма, анализы, тренировки, питание, диагностика)
export interface AggregatedRisk {
  pharma: RiskResult;
  labs: { overallRaw: number; overallNet: number; systemBreakdown: Record<string, number> };
  training: { overallRaw: number; overallNet: number; systemBreakdown?: Record<string, { raw: number; net: number }> };
  nutrition: { overallRaw: number; overallNet: number; systemBreakdown?: Record<string, { raw: number; net: number }> };
  diagnostics: { overallRaw: number; overallNet: number; systemBreakdown?: Record<string, { raw: number; net: number }> };
  overallRaw: number;
  overallNet: number;
  systemBreakdown: Record<string, { raw: number; net: number; sources?: Record<string, { raw: number; net: number }> }>;
}

export function calculateAggregatedRisks(
  pharmaResult: RiskResult,
  labResult: { systemContributions: Record<string, number> },
  trainingResult: { overallRaw: number; overallNet: number; systemBreakdown?: Record<string, { raw: number; net: number }> },
  nutritionResult: { overallRaw: number; overallNet: number; systemBreakdown?: Record<string, { raw: number; net: number }> },
  diagnosticsResult: { overallRaw: number; overallNet: number; systemBreakdown?: Record<string, { raw: number; net: number }> }
): AggregatedRisk {
  // Веса для каждого источника риска (сумма = 1.0)
  const WEIGHTS = {
    pharma: 0.35,     // Препараты — основной источник риска
    labs: 0.25,       // Анализы — важная проверка состояния
    training: 0.20,   // Тренировки — значительная физическая нагрузка
    nutrition: 0.15,  // Питание — базовая поддержка организма
    diagnostics: 0.05 // Исследования — дополнительная информация
  };
  
  const TOTAL_WEIGHT = WEIGHTS.pharma + WEIGHTS.labs + WEIGHTS.training + WEIGHTS.nutrition + WEIGHTS.diagnostics;
  
  const aggregateSystem = (system: string): { raw: number; net: number; sources?: Record<string, { raw: number; net: number }> } => {
    const pharmaSys = pharmaResult.systemBreakdown?.[system];
    const labSys = labResult.systemContributions[system] ?? 0;
    const trainSys = trainingResult.systemBreakdown?.[system]?.net ?? trainingResult.systemBreakdown?.[system]?.raw ?? 0;
    const nutriSys = nutritionResult.systemBreakdown?.[system]?.net ?? nutritionResult.systemBreakdown?.[system]?.raw ?? 0;
    const diagSys = diagnosticsResult.systemBreakdown?.[system]?.net ?? diagnosticsResult.systemBreakdown?.[system]?.raw ?? 0;
    
    // Для сырых значений — максимум (консервативный подход)
    const raw = Math.max(pharmaSys?.raw ?? 0, labSys, trainSys, nutriSys, diagSys);
    
    // Для нетто — взвешенная сумма
    let net = 0;
    net += (pharmaSys?.net ?? 0) * (WEIGHTS.pharma / TOTAL_WEIGHT);
    net += labSys * (WEIGHTS.labs / TOTAL_WEIGHT);
    net += trainSys * (WEIGHTS.training / TOTAL_WEIGHT);
    net += nutriSys * (WEIGHTS.nutrition / TOTAL_WEIGHT);
    net += diagSys * (WEIGHTS.diagnostics / TOTAL_WEIGHT);
    net = Math.min(100, net);
    
    return { 
      raw, 
      net, 
      sources: {
        pharma: { raw: pharmaSys?.raw ?? 0, net: pharmaSys?.net ?? 0 },
        labs: { raw: labSys, net: labSys },
        training: { raw: trainSys, net: trainSys },
        nutrition: { raw: nutriSys, net: nutriSys },
        diagnostics: { raw: diagSys, net: diagSys }
      }
    };
  };
  
  const systemBreakdown: Record<string, { raw: number; net: number; sources?: Record<string, { raw: number; net: number }> }> = {};
  for (const sys of RISK_SYSTEMS) {
    systemBreakdown[sys] = aggregateSystem(sys);
  }
  
  const allRaw = Object.values(systemBreakdown).map(s => s.raw);
  const allNet = Object.values(systemBreakdown).map(s => s.net);
  
  return {
    pharma: pharmaResult,
    labs: {
      overallRaw: labResult.systemContributions.overall ?? 0,
      overallNet: labResult.systemContributions.overall ?? 0,
      systemBreakdown: labResult.systemContributions
    },
    training: trainingResult,
    nutrition: nutritionResult,
    diagnostics: diagnosticsResult,
    overallRaw: Math.min(100, geom(allRaw)),
    overallNet: Math.min(100, geom(allNet)),
    systemBreakdown
  };
}
