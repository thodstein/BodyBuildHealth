import { GENETIC_MULTIPLIERS, DRUG_THRESHOLDS, RISK_SYSTEMS, BASE_RISK, MRR_FACTORS, HGI_FACTORS, RIR_FACTORS } from '../core/constants';
import { RiskInput, RiskResult } from '../core/types';

function geom(arr: number[]) {
   if (!arr.length) return 0;
   const l = arr.reduce((a, v) => a + Math.log(Math.max(0.0001, v)), 0);
   return Math.exp(l / arr.length) * 100;
}

/**
 * Calculate MRR (Minimum Risk Range) adjustment factor
 * MRR represents the ideal range where risk is minimized
 * Values outside this range increase risk exponentially
 */
function calculateMrrAdjustment(value: number, optimalMin: number, optimalMax: number): number {
   if (value >= optimalMin && value <= optimalMax) {
      return 1.0; // Within optimal range - no additional risk
   }
   
   // Calculate deviation from optimal range
   let deviation = 0;
   if (value < optimalMin) {
      deviation = (optimalMin - value) / optimalMin;
   } else if (value > optimalMax) {
      deviation = (value - optimalMax) / optimalMax;
   }
   
   // Exponential risk increase outside MRR
   return 1 + (deviation * 2); // Can be adjusted based on clinical data
}

/**
 * Calculate HGI (Hemostasis/Immune Function) adjustment factor
 * Represents the body's ability to maintain homeostasis and immune function
 */
function calculateHgiAdjustment(hgiMarkers: Record<string, number>): number {
   // In a full implementation, this would analyze multiple markers
   // For now, we'll use a simplified approach based on key indicators
   const hgiScore = Object.values(hgiMarkers).reduce((sum, val) => sum + val, 0) / 
                   (Object.keys(hgiMarkers).length || 1);
   // Normalize to 0.5-1.5 range where 1.0 is optimal
   return Math.max(0.5, Math.min(1.5, hgiScore));
}

/**
 * Calculate RIR (Risk Intervention Response) adjustment factor
 * Represents how effectively interventions reduce risk over time
 */
function calculateRirAdjustment(interventionResponse: number): number {
   // interventionResponse: 0-1 scale where 1 is perfect response
   // Higher RIR means better risk reduction from interventions
   return 0.5 + (interventionResponse * 0.5); // Range: 0.5 to 1.0
}

export function calculateRisks(i: RiskInput): RiskResult {
   const brk: Record<string, { raw: number; net: number }> = {};
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
         
         // MRR Adjustment - based on optimal biomarker ranges
          const mrrAdjustment = calculateMrrAdjustment(
             i.biomarkerValues?.[s] ?? 1.0,
            MRR_FACTORS[s]?.optimalMin || 0.8, 
            MRR_FACTORS[s]?.optimalMax || 1.2
         );
         
         // HGI Adjustment - Hemostasis/Immune function
         const hgiAdjustment = calculateHgiAdjustment(i.hgiMarkers || {});
         
         // RIR Adjustment - Response to interventions
          const rirAdjustment = calculateRirAdjustment(i.interventionResponse ?? 0.5);
         
         let prod = 1;
         for (const [drug, d] of Object.entries(i.activeDrugs || {})) {
            const cfg = DRUG_THRESHOLDS[drug];
            if (!cfg) continue;
            const D = Math.min(2, Math.pow((d.dosePerWeek || 0) / cfg.dosePerWeek, 1.2));
            prod *= (1 - Math.min(0.99, BASE_RISK * D * G * N * T * mrrAdjustment * hgiAdjustment * rirAdjustment));
         }
          const raw = Math.max(7, Math.min(100, (1 - prod) * 100));
         const cov = (i.supportCoverage || {})[id] || 0;
         const net = Math.max(0, raw * (1 - cov));
         rM.push(raw / 100);
         nM.push(net / 100);
      }
      brk[s] = { raw: geom(rM), net: geom(nM) };
      oR.push(brk[s].raw / 100);
      oN.push(brk[s].net / 100);
   }
   
   // Calculate overall MRR/HGI/RIR adjustments for final risk score
   const overallMrr = calculateMrrAdjustment(
      i.overallBiomarkerValue ?? 1.0,
      MRR_FACTORS.overall?.optimalMin || 0.8,
      MRR_FACTORS.overall?.optimalMax || 1.2
   );
   
   const overallHgi = calculateHgiAdjustment(i.overallHgiMarkers || {});
   const overallRir = calculateRirAdjustment(i.overallInterventionResponse ?? 0.5);
   
   return { 
      systemBreakdown: brk, 
      overallRaw: Math.min(100, Math.max(0, geom(oR) * overallMrr * overallHgi * (2 - overallRir))),
      overallNet: Math.min(100, Math.max(0, geom(oN) * overallMrr * overallHgi * (2 - overallRir)))
   };
}