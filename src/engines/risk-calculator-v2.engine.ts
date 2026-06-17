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
  // inverse: when true, LOW value → positive risk, HIGH value → 0
  const CODE_TO_SYSTEM_MAP: { [key: string]: { [system: string]: any; inverse?: boolean } } = {
    // Cardiovascular system
    'LDL': { 'cardio': 1.0 },
    'HDL': { 'cardio': 1.0, inverse: true }, // low HDL = bad
    'TG': { 'cardio': 1.0 },
    'APOB': { 'cardio': 1.0 },
    'LP(a)': { 'cardio': 1.0 },
    'hsCRP': { 'cardio': 1.0, 'hematologic': 1.0 },

    // Hepatic system (+ short-code aliases)
    'ALT': { 'hepatic': 1.0 },
    'AST': { 'hepatic': 1.0 },
    'GGT': { 'hepatic': 1.0 },
    'ALP': { 'hepatic': 1.0 },
    'BILIRUBIN_TOTAL': { 'hepatic': 1.0 },
    'BIL': { 'hepatic': 1.0 },
    'BILIRUBIN_DIRECT': { 'hepatic': 1.0 },
    'ALBUMIN': { 'hepatic': 1.0, inverse: true },
    'ALB': { 'hepatic': 1.0, inverse: true },
    'PT': { 'hepatic': 1.0 },
    'INR': { 'hepatic': 1.0 },

    // Renal system
    'CREATININE': { 'renal': 1.0 },
    'CYSATIN_C': { 'renal': 1.0 },
    'BUN': { 'renal': 1.0 },
    'GFR': { 'renal': 1.0, inverse: true },
    'UACR': { 'renal': 1.0 },

    // Neurological system (+ short-code aliases)
    'HOMOCYSTEINE': { 'cardio': 1.0, 'neuro': 1.0 },
    'VITAMIN_B12': { 'neuro': 1.0, inverse: true },
    'B12': { 'neuro': 1.0, inverse: true },
    'VITAMIN_D': { 'neuro': 1.0, inverse: true },
    'VITD': { 'neuro': 1.0, inverse: true },
    'FOLATE': { 'neuro': 1.0, inverse: true },
    'BDNF': { 'neuro': 1.0, inverse: true },

    // Endocrine system (+ short-code aliases)
    'TSH': { 'endocrine': 1.0 },
    'FREE_T3': { 'endocrine': 1.0, inverse: true },
    'FT3': { 'endocrine': 1.0, inverse: true },
    'FREE_T4': { 'endocrine': 1.0, inverse: true },
    'FT4': { 'endocrine': 1.0, inverse: true },
    'CORTISOL': { 'endocrine': 1.0 },
    'PROLACTIN': { 'endocrine': 1.0 },
    'PRL': { 'endocrine': 1.0 },

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

    // Reproductive system (+ short-code aliases)
    'PROGESTERONE': { 'reproductive': 1.0 },
    'PROG': { 'reproductive': 1.0 },
    'DHEA_S': { 'reproductive': 1.0, inverse: true },
    'AMH': { 'reproductive': 1.0, inverse: true },
    'INHIBIN_B': { 'reproductive': 1.0, inverse: true },
    'INHB': { 'reproductive': 1.0, inverse: true },
    'PSA': { 'reproductive': 1.0 },

    // Multi-system hormones (+ short-code aliases for manual entry)
    'TESTOSTERONE': { 'endocrine': 1.0, 'reproductive': 1.0 },
    'TT': { 'endocrine': 1.0, 'reproductive': 1.0 },
    'ESTRADIOL': { 'endocrine': 1.0, 'reproductive': 1.0 },
    'E2': { 'endocrine': 1.0, 'reproductive': 1.0 },
    'LH': { 'endocrine': 1.0, 'reproductive': 1.0 },
    'FSH': { 'endocrine': 1.0, 'reproductive': 1.0 },
    'SHBG': { 'endocrine': 1.0, 'reproductive': 1.0 },
    'IGF1': { 'endocrine': 1.0 },

    // Glucose / metabolic
    'GLUCOSE': { 'metabolic': 1.0, 'endocrine': 1.0 },
    'GLU': { 'metabolic': 1.0, 'endocrine': 1.0 },
    'HBA1C': { 'metabolic': 1.0, 'endocrine': 1.0 },
    'HbA1c': { 'metabolic': 1.0, 'endocrine': 1.0 },
    'INSULIN': { 'metabolic': 1.0, 'endocrine': 1.0 },
    'INS': { 'metabolic': 1.0, 'endocrine': 1.0 },
    'HOMA_IR': { 'metabolic': 1.0, 'endocrine': 1.0 },
    'HOMA': { 'metabolic': 1.0, 'endocrine': 1.0 },

    // Inflammation
    'CRP': { 'cardio': 1.0, 'hematologic': 1.0 },
    'FERRITIN': { 'hepatic': 0.5, 'hematologic': 1.0 },

    // Lipid / cardiac extended
    'APOA1': { 'cardio': 1.0, inverse: true },
    'NON_HDL': { 'cardio': 1.0 },

    // Thyroid extended
    'TOTAL_T3': { 'endocrine': 1.0 },
    'TOTAL_T4': { 'endocrine': 1.0 },
    'TG_AB': { 'endocrine': 1.0 },
    'TPO_AB': { 'endocrine': 1.0 },
    'THYROGLOBULIN': { 'endocrine': 1.0 },

    // Iron panel
    'IRON': { 'hematologic': 1.0, 'hepatic': 0.5 },
    'TRANSFERRIN': { 'hematologic': 1.0 },
    'TIBC': { 'hematologic': 1.0 },
    'IRON_SAT': { 'hematologic': 1.0 },

    // Coagulation
    'FIBRINOGEN': { 'cardio': 1.0, 'hepatic': 1.0 },
    'D_DIMER': { 'cardio': 1.0, 'hematologic': 1.0 },

    // Renal extended
    'PROTEIN_TOTAL': { 'renal': 1.0, 'hepatic': 1.0 },
    'TP': { 'renal': 1.0, 'hepatic': 1.0 },
    'UA': { 'renal': 1.0, 'metabolic': 1.0 },
    'K': { 'renal': 1.0, 'cardio': 1.0 },
    'NA': { 'renal': 1.0, 'neuro': 1.0 },
    'CA': { 'renal': 1.0, 'endocrine': 1.0 },
    'P': { 'renal': 1.0 },
    'MG': { 'renal': 1.0, 'neuro': 1.0 },

    // Liver extended
    'LDH': { 'hepatic': 1.0, 'cardio': 1.0 },
    'BILIRUBIN_INDIRECT': { 'hepatic': 1.0 },

    // Kidney / cardiovascular
    'BNP': { 'cardio': 1.0, 'renal': 1.0 },
    'NT_PROBNP': { 'cardio': 1.0, 'renal': 1.0 },

    // Neuro extended
    'SEROTONIN': { 'neuro': 1.0 },
    'DOPAMINE': { 'neuro': 1.0 },
    'GABA': { 'neuro': 1.0, inverse: true },
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

    const uln = reference.uln; // Upper limit of normal (in prefUnit)
    const lln = reference.lln; // Lower limit of normal (in prefUnit)
    const coeff = reference.coeff || 1; // Unit conversion coefficient

    // Normalize value to the same units as ULN/LLN
    const norm = value * coeff;

    // Get the system mappings for this lab code
    const systemMapEntry = CODE_TO_SYSTEM_MAP[code];
    if (!systemMapEntry) {
      // If no specific mapping, skip
      return;
    }
    const isInverse = systemMapEntry.inverse === true;

    // Calculate deviation from normal range
    // For normal markers: high → risk, low → risk
    // For inverse markers: low → risk, high → risk (but ULN-side ignored if protective)
    let deviation = 0;
    if (!isInverse) {
      // Normal direction: above ULN = risk
      if (norm > uln) {
        deviation = (norm - uln) / uln;
      }
    } else {
      // Inverse direction: below LLN = risk (above ULN = protective → 0)
      if (norm < lln) {
        deviation = (lln - norm) / lln;
      }
    }
    // If within normal range (or protective side for inverse), deviation = 0

    // If no deviation, skip contribution
    if (deviation === 0) {
      return;
    }

    // Apply deviation to each mapped system (skip 'inverse' meta-key)
    Object.entries(systemMapEntry).forEach(([system, weight]) => {
      if (system === 'inverse') return;
      if (ALL_RISK_SYSTEMS.includes(system as any)) {
        const w = Number(weight) || 0;
        // Contribution is deviation * weight * 25
        // Allows 2×ULN → 25%, 3×ULN → 50%, 5×ULN → 100%
        const contribution = Math.min(100, Math.max(0, deviation * w * 25));
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
