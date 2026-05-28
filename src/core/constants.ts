import { UserRole, LabPhaseType, DynamicRefRange } from './types';

export const MICRONUTRIENT_TARGETS = {
  vitaminD: { min: 30, max: 60, unit: 'ng/mL' },
  vitaminB12: { min: 400, max: 900, unit: 'pg/mL' },
  iron: { min: 60, max: 170, unit: 'µg/dL' },
  zinc: { min: 0.7, max: 1.2, unit: 'µg/mL' },
  magnesium: { min: 0.85, max: 1.1, unit: 'mmol/L' }
};

export const PHARMA_DB: Record<string, any> = {
  testosterone: { name: "Testosterone", pd: { aromatization: 0.7, progestogenic: 0, hepatotoxicity: 0, lipid_impact: 0.6, hct_impact: 0.5, neuro_toxicity: 0 } },
  trenbolone: { name: "Trenbolone", pd: { aromatization: 0, progestogenic: 1.0, hepatotoxicity: 0.4, lipid_impact: 0.9, hct_impact: 0.4, neuro_toxicity: 0.3 } }
};

export const UCUM_MAP: Record<string, DynamicRefRange> = {
  ALT: { lln: 7, uln: 40, phase: 'baseline' },
  AST: { lln: 8, uln: 40, phase: 'baseline' },
  HCT: { lln: 0.38, uln: 0.52, phase: 'baseline' }
};

export const LAB_PHASES: Record<LabPhaseType, { checkpoints: { type: string; week: number; markers: string[] }[] }> = {
  baseline: { checkpoints: [{ type: "baseline", week: 0, markers: ["ALT","AST","HCT","TT"] }] },
  course: { checkpoints: [
    { type: "baseline", week: 0, markers: ["ALT","AST"] },
    { type: "mid_course", week: 4, markers: ["TT","E2"] },
    { type: "end_course", week: 8, markers: ["ALT","HCT"] }
  ]},
  bridge: { checkpoints: [
    { type: "baseline", week: 0, markers: ["ALT","AST"] },
    { type: "end_course", week: 8, markers: ["TT","PRL"] },
    { type: "bridge", week: 10, markers: ["ALT"] }
  ]},
  pct: { checkpoints: [
    { type: "start_pct", week: 0, markers: ["TT","LH"] },
    { type: "mid_pct", week: 2, markers: ["E2"] },
    { type: "end_pct", week: 4, markers: ["TT"] }
  ]}
};
