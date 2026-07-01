// AAS/GH/Insulin main drugs — ТЗ mapping (60 entries)
export interface TzDrugEntry {
  name: string; class: 'aas'|'gh'|'insulin'|'glp1'|'pct'|'sarm'; form: 'inject'|'oral';
  targetOrgans: string[]; organMechanisms: Record<string, string[]>;
  mechanismWeights: Record<string, number>; doseModifier: number;
}
export const DRUG_DB: Record<string, TzDrugEntry> = {};
