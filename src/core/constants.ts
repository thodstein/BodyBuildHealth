export const GENETIC_MULTIPLIERS: Record<string, Record<string, number>> = {
  COMT_Val158Met: { 'Met/Met': 2.0, 'Val/Met': 1.5, 'Val/Val': 1.0 },
  MTHFR_C677T: { TT: 1.7, CT: 1.3, CC: 1.0 },
  AGTR1_A1166C: { CC: 1.4, AC: 1.2, AA: 1.0 },
  CYP3A4_22: { '*22/*22': 1.35, '*1/*22': 1.15, '*1/*1': 1.0 },
  NOS3_G894T: { TT: 1.3, GT: 1.15, GG: 1.0 }
};

export const DRUG_THRESHOLDS: Record<string, { dosePerWeek: number; androgenicity: number }> = {
  testosterone_enanthate: { dosePerWeek: 300, androgenicity: 1.0 },
  trenbolone_acetate: { dosePerWeek: 200, androgenicity: 1.5 },
  nandrolone_decanoate: { dosePerWeek: 400, androgenicity: 0.8 },
  oxandrolone: { dosePerWeek: 350, androgenicity: 0.6 },
  gh_peptide: { dosePerWeek: 35, androgenicity: 0 }
};

export const SYRINGE_SPECS: Record<number, { maxVolume: number; divisionsPerMl: number }> = {
  0.3: { maxVolume: 0.3, divisionsPerMl: 30 },
  0.5: { maxVolume: 0.5, divisionsPerMl: 50 },
  1.0: { maxVolume: 1.0, divisionsPerMl: 100 },
  2.0: { maxVolume: 2.0, divisionsPerMl: 50 },
  5.0: { maxVolume: 5.0, divisionsPerMl: 20 }
};

export type RiskSystem = 'cardio' | 'hepatic' | 'renal' | 'neuro' | 'endocrine' | 'hematologic' | 'reproductive';
export const RISK_SYSTEMS: RiskSystem[] = ['cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive'];