import { UCUM_MAP } from '../core/constants';
import type { LabPoint, RiskResult } from '../core/types';
import { RISK_SYSTEMS, ALL_RISK_SYSTEMS } from '../core/constants';

interface RiskSystemContribution {
  [key: string]: number;
}

interface RiskCalculationResult {
  systemContributions: RiskSystemContribution;
  totalRisk: number;
}

/**
 * Calculate risk contributions from lab analyses
 * Maps each lab marker to one or more risk systems based on deviation from normal range
 * 
 * OVERLOAD 1: When called with labs only, return RiskCalculationResult
 * OVERLOAD 2: When called with RiskResult and labs, return RiskResult
 */
export function calculateRiskFromAnalyses(labs: LabPoint[]): RiskCalculationResult;
export function calculateRiskFromAnalyses(riskResult: RiskResult, labs: LabPoint[]): RiskResult;
export function calculateRiskFromAnalyses(arg1: RiskResult | LabPoint[], labs?: LabPoint[]): RiskResult | RiskCalculationResult {
  let labsArray: LabPoint[];
  let riskResult: RiskResult | null = null;

  if (Array.isArray(arg1)) {
    labsArray = arg1;
  } else {
    riskResult = arg1;
    labsArray = labs || [];
  }

  // Initialize contributions for all risk systems
  const systemContributions: RiskSystemContribution = {};
  ALL_RISK_SYSTEMS.forEach(system => {
    systemContributions[system] = 0;
  });

  // Map each lab code to its contribution to risk systems
  // Format: [labCode]: { [system]: weight }
  const CODE_TO_SYSTEM_MAP: { [key: string]: { [key: string]: number } } = {
    // Cardiovascular system
    'LDL': { 'cardio': 1.0 },
    'HDL': { 'cardio': 1.0 }, // inverse relationship handled separately
    'TG': { 'cardio': 1.0 },
    'APOB': { 'cardio': 1.0 },
    'LP(a)': { 'cardio': 1.0 },
    'hsCRP': { 'cardio': 1.0 },

    // Hepatic system
    'ALT': { 'hepatic': 1.0 },
    'AST': { 'hepatic': 1.0 },
    'GGT': { 'hepatic': 1.0 },
    'ALP': { 'hepatic': 1.0 },
    'BILIRUBIN_TOTAL': { 'hepatic': 1.0 },
    'BILIRUBIN_DIRECT': { 'hepatic': 1.0 },
    'ALBUMIN': { 'hepatic': 1.0 }, // inverse relationship
    'PT': { 'hepatic': 1.0 },
    'INR': { 'hepatic': 1.0 },

    // Renal system
    'CREATININE': { 'renal': 1.0 },
    'CYSATIN_C': { 'renal': 1.0 },
    'BUN': { 'renal': 1.0 },
    'GFR': { 'renal': 1.0 }, // inverse relationship
    'UACR': { 'renal': 1.0 },

    // Neurological system
    'HOMOCYSTEINE': { 'neuro': 1.0 },
    'VITAMIN_B12': { 'neuro': 1.0 }, // inverse relationship
    'VITAMIN_D': { 'neuro': 1.0 }, // inverse relationship
    'FOLATE': { 'neuro': 1.0 }, // inverse relationship
    'BDNF': { 'neuro': 1.0 }, // inverse relationship

    // Endocrine system
    'TSH': { 'endocrine': 1.0 },
    'FREE_T3': { 'endocrine': 1.0 }, // inverse relationship
    'FREE_T4': { 'endocrine': 1.0 }, // inverse relationship
    'INSULIN': { 'endocrine': 1.0 },
    'HOMA_IR': { 'endocrine': 1.0 },
    'CORTISOL': { 'endocrine': 1.0 },
    'PROLACTIN': { 'endocrine': 1.0 },

    // Hematological system
    'HGB': { 'hematologic': 1.0 },
    'HCT': { 'hematologic': 1.0 },
    'RBC': { 'hematologic': 1.0 },
    'WBC': { 'hematologic': 1.0 },
    'PLT': { 'hematologic': 1.0 },
    'MCV': { 'hematologic': 1.0 },
    'MCH': { 'hematologic': 1.0 },
    'MCHC': { 'hematologic': 1.0 },
    'RDW': { 'hematologic': 1.0 },

    // Reproductive system
    'PROGESTERONE': { 'reproductive': 1.0 },
    'DHEA_S': { 'reproductive': 1.0 }, // inverse relationship
    'AMH': { 'reproductive': 1.0 }, // inverse relationship
    'INHIBIN_B': { 'reproductive': 1.0 }, // inverse relationship

    // Multi-system hormones
    'TESTOSTERONE': { 'endocrine': 1.0, 'reproductive': 1.0 },
    'ESTRADIOL': { 'endocrine': 1.0, 'reproductive': 1.0 },
    'LH': { 'endocrine': 1.0, 'reproductive': 1.0 },
    'FSH': { 'endocrine': 1.0, 'reproductive': 1.0 },
  };

  // Process each lab result
  labsArray.forEach(lab => {
    const code = lab.code;
    const value = lab.value;
    const unit = lab.unit;

    // Get reference ranges from UCUM_MAP
    const reference = UCUM_MAP[code];
    if (!reference) {
      // Skip if we don't have reference data for this marker
      return;
    }

    const uln = reference.uln; // Upper limit of normal
    const lln = reference.lln; // Lower limit of normal

    // Calculate deviation from normal range
    // For values above normal: (value - uln) / uln
    // For values below normal: (lln - value) / lln
    // For values within normal: 0
    let deviation = 0;

    if (value > uln) {
      // Above normal range
      deviation = (value - uln) / uln;
    } else if (value < lln) {
      // Below normal range
      deviation = (lln - value) / lln;
    }
    // If within normal range, deviation remains 0

    // If no deviation, skip contribution
    if (deviation === 0) {
      return;
    }

    // Get the system mappings for this lab code
    const systemMap = CODE_TO_SYSTEM_MAP[code];
    if (!systemMap) {
      // If no specific mapping, skip
      return;
    }

    // Apply deviation to each mapped system
    Object.entries(systemMap).forEach(([system, weight]) => {
      if (ALL_RISK_SYSTEMS.includes(system as any)) {
        // Contribution is deviation * weight * 10 (as per spec)
        // Clamp to reasonable range
        const contribution = Math.min(100, Math.max(0, deviation * weight * 10));
        systemContributions[system] += contribution;
      }
    });
  });

  // Cap each system's contribution at 100
  ALL_RISK_SYSTEMS.forEach(system => {
    systemContributions[system] = Math.min(100, systemContributions[system]);
  });

  // Calculate total risk as average of all system contributions
  const totalRisk = Object.values(systemContributions).reduce((sum, val) => sum + val, 0) / ALL_RISK_SYSTEMS.length;

  // If riskResult is provided, return RiskResult format
  if (riskResult) {
    // Convert systemContributions to systemBreakdown format
    const systemBreakdown: Record<string, { raw: number; net: number }> = {};
    for (const sys of ALL_RISK_SYSTEMS) {
      const contribution = systemContributions[sys] || 0;
      // Combine with existing riskResult values
      const baseRaw = riskResult.systemBreakdown[sys]?.raw || 0;
      const baseNet = riskResult.systemBreakdown[sys]?.net || 0;
      // Add lab contribution to base risk
      systemBreakdown[sys] = {
        raw: Math.min(100, baseRaw + contribution),
        net: Math.min(100, Math.max(0, baseNet + contribution - (baseNet * contribution / 100)))
      };
    }

    // Calculate overall risk
    const rawValues = ALL_RISK_SYSTEMS.map(sys => systemBreakdown[sys].raw);
    const netValues = ALL_RISK_SYSTEMS.map(sys => systemBreakdown[sys].net);

    const geom = (arr: number[]) => {
      if (!arr.length) return 0;
      const l = arr.reduce((a, v) => a + Math.log(Math.max(0.0001, v)), 0);
      return Math.exp(l / arr.length);
    };

    return {
      overallRaw: Math.min(100, Math.max(0, geom(rawValues))),
      overallNet: Math.min(100, Math.max(0, geom(netValues))),
      systemBreakdown,
      mechanismBreakdown: riskResult.mechanismBreakdown,
      mechanismDetail: riskResult.mechanismDetail
    };
  }

  // Otherwise return RiskCalculationResult format
  return {
    systemContributions,
    totalRisk: Math.min(100, Math.max(0, totalRisk))
  };
}
