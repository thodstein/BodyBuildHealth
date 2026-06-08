import { GENETIC_MULTIPLIERS, DRUG_THRESHOLDS, RISK_SYSTEMS, BASE_RISK, MRR_FACTORS, HGI_FACTORS, RIR_FACTORS, SUPPORT_BASE_COVERAGE } from '../core/constants';
import { RiskInput, RiskResult, MechanismCell } from '../core/types';
import { PHARMA_DB } from '../core/pharma-database';

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

const PD_SYSTEM_MAP: Record<string, { pdKey: string; weight: number }> = {
   cardio:     { pdKey: 'lipid_impact',    weight: 0.6 },
   hepatic:    { pdKey: 'hepatotoxicity', weight: 1.0 },
   renal:      { pdKey: 'hct_impact',      weight: 0.15 },
   neuro:      { pdKey: 'neuro_toxicity',  weight: 1.0 },
   endocrine:  { pdKey: 'aromatization',    weight: 0.5 },
   hematologic:{ pdKey: 'hct_impact',      weight: 0.5 },
   reproductive:{ pdKey: 'progestogenic',   weight: 0.4 },
   musculoskeletal: { pdKey: 'lipid_impact', weight: 0.1 },
};

const MECHANISM_NAMES: Record<number, string> = {
   1: 'direct_toxicity',
   2: 'metabolic',
   3: 'oxidative',
   4: 'immune',
   5: 'hormonal',
   6: 'hemodynamic',
   7: 'proliferative',
};

const DRUG_MECH_WEIGHTS: Record<string, Record<number, number>> = {
   testosterone_enanthate:    { 5: 0.6, 6: 0.4, 7: 0.2 },
   testosterone_cypionate:     { 5: 0.6, 6: 0.4, 7: 0.2 },
   trenbolone_acetate:         { 1: 0.3, 5: 0.5, 6: 0.4, 2: 0.3, 7: 0.2 },
   trenbolone_enanthate:       { 1: 0.3, 5: 0.5, 6: 0.4, 2: 0.3, 7: 0.2 },
   nandrolone_decanoate:       { 5: 0.4, 7: 0.3, 6: 0.2, 3: 0.2 },
   oxandrolone:                { 1: 0.7, 2: 0.3, 5: 0.1 },
   stanozolol:                 { 1: 0.8, 2: 0.4, 6: 0.3, 4: 0.1 },
   methandienone:              { 1: 0.7, 2: 0.3, 5: 0.3, 6: 0.2 },
   oxymetholone:               { 1: 0.9, 2: 0.3, 6: 0.2, 4: 0.1 },
   halotestin:                 { 1: 0.8, 6: 0.4, 3: 0.2, 5: 0.2 },
   anastrozole:                { 5: 0.2, 2: 0.1, 4: 0.2 },
   letrozole:                  { 5: 0.3, 2: 0.1, 4: 0.3 },
   cabergoline:                { 5: 0.4, 1: 0.2, 4: 0.1 },
   clomid:                     { 5: 0.2, 4: 0.1 },
   hcg:                        { 5: 0.5 },
   tamoxifen:                  { 5: 0.2, 7: 0.1 },
   mk677:                      { 2: 0.2, 5: 0.3, 7: 0.1 },
   ostarine:                   { 5: 0.2, 2: 0.1, 7: 0.1 },
   lgd4033:                    { 5: 0.3, 2: 0.1, 7: 0.1 },
   rad140:                     { 5: 0.3, 2: 0.1, 7: 0.15 },
   gw501516:                   { 2: 0.5, 7: 0.3 },
   sr9009:                     { 2: 0.3 },
   bpc157:                     {},
   semax:                      { 1: 0.1, 3: 0.15 },
   tb500:                      {},
   meloxicam:                  { 1: 0.15, 4: 0.2, 6: 0.1 },
   diclofenac:                 { 1: 0.2, 4: 0.15, 6: 0.15 },
};

function getDrugMechWeight(drugId: string, mech: number): number {
   const normalizedId = drugId.replace(/[-\s]/g, '_').toLowerCase();
   const weights = DRUG_MECH_WEIGHTS[normalizedId] || DRUG_MECH_WEIGHTS[drugId] || {};
   return weights[mech] || 0;
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
            const cfg = DRUG_THRESHOLDS[drug];
            const pdEntry = Object.values(PHARMA_DB).find(p => p.id === drug || drug.startsWith(p.id.replace(/_/g, '_')));
            if (pdEntry && pdMapping) {
               const pdVal = (pdEntry.pd as any)[pdMapping.pdKey] ?? 0;
               pdFactor += Math.abs(pdVal) * pdMapping.weight * ((d.dosePerWeek || 0) / (pdEntry.ec50 || 300));
            }
            const mechWeight = getDrugMechWeight(drug, m);
            const doseRatio = cfg ? Math.min(2, Math.pow((d.dosePerWeek || 0) / cfg.dosePerWeek, 1.2)) : mechWeight > 0 ? Math.min(1.5, (d.dosePerWeek || 0) / 300) : 0;
            const mechContribution = Math.max(0, BASE_RISK * doseRatio * G * N * T * mrrAdjustment * hgiAdjustment * rirAdjustment * (1 + mechWeight * 3));
            if (mechContribution > 0.005 || (cfg && doseRatio > 0.1)) {
               prod *= (1 - Math.min(0.99, BASE_RISK * (doseRatio || 0.01) * G * N * T * mrrAdjustment * hgiAdjustment * rirAdjustment));
               if (mechWeight > 0 || (cfg && doseRatio > 0.3)) {
                  contributors.push(drug);
               }
            }
         }

         const raw = Math.max(7, Math.min(100, (1 - prod) * 100 + pdFactor * 15));
         const cov = (i.supportCoverage || {})[id] || 0;
         const net = Math.max(0, raw * (1 - cov));
         mechBrk[id] = net;

         const mitigations: { substance: string; reduction: number }[] = [];
         for (const [subId, effects] of Object.entries(SUPPORT_BASE_COVERAGE)) {
            const cellCov = effects[id];
            if (cellCov && cellCov > 0) {
               mitigations.push({ substance: subId, reduction: Math.round(cellCov * 100) });
            }
         }

         mechDetail[id] = { raw: Math.round(raw * 10) / 10, net: Math.round(net * 10) / 10, coverage: Math.round(cov * 1000) / 10, contributors, mitigations };
         rM.push(raw / 100);
         nM.push(net / 100);
      }
      brk[s] = { raw: geom(rM), net: geom(nM) };
      oR.push(brk[s].raw / 100);
      oN.push(brk[s].net / 100);
   }

   const overallMrr = calculateMrrAdjustment(
      i.overallBiomarkerValue ?? 1.0,
      MRR_FACTORS.overall?.optimalMin || 0.8,
      MRR_FACTORS.overall?.optimalMax || 1.2
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

// Aggregated risk from all sources (pharma, labs, training, nutrition, diagnostics) - UPDATED with weighted aggregation
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
    pharma: 0.35,     // Препараты - основной источник риска
    labs: 0.25,       // Анализы - важная проверка состояния
    training: 0.20,   // Тренировки - значительная физическая нагрузка
    nutrition: 0.15,  // Питание - базовая поддержка организма
    diagnostics: 0.05 // Исследования - дополнительная информация
  };
  
  const TOTAL_WEIGHT = WEIGHTS.pharma + WEIGHTS.labs + WEIGHTS.training + WEIGHTS.nutrition + WEIGHTS.diagnostics;
  
  const aggregateSystem = (system: string): { raw: number; net: number; sources?: Record<string, { raw: number; net: number }> } => {
    const pharmaSys = pharmaResult.systemBreakdown?.[system];
    const labSys = labResult.systemContributions[system] ?? 0;
    const trainSys = trainingResult.systemBreakdown?.[system]?.net ?? trainingResult.systemBreakdown?.[system]?.raw ?? 0;
    const nutriSys = nutritionResult.systemBreakdown?.[system]?.net ?? nutritionResult.systemBreakdown?.[system]?.raw ?? 0;
    const diagSys = diagnosticsResult.systemBreakdown?.[system]?.net ?? diagnosticsResult.systemBreakdown?.[system]?.raw ?? 0;
    
    // Для сырых значений используем максимум (консервативный подход)
    const raw = Math.max(pharmaSys?.raw ?? 0, labSys, trainSys, nutriSys, diagSys);
    
    // Для нетто значений используем взвешенную сумму
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