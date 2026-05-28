import { PHARMA_DB } from '../core/constants';
import type { CourseEntry } from '../core/types';

export interface PharmaAnalysis {
  aromatization: number;
  progestogenic: number;
  hepatotoxicity: number;
  lipidImpact: number;
  hctImpact: number;
  neuroToxicity: number;
}

export function analyzeCourse(entries: CourseEntry[]): PharmaAnalysis {
  let result: PharmaAnalysis = {
    aromatization: 0,
    progestogenic: 0,
    hepatotoxicity: 0,
    lipidImpact: 0,
    hctImpact: 0,
    neuroToxicity: 0
  };

  for (const entry of entries) {
    const substance = PHARMA_DB[entry.substanceId];
    if (substance?.pd) {
      const pd = substance.pd;
      result.aromatization += pd.aromatization * entry.doseValue;
      result.progestogenic += pd.progestogenic * entry.doseValue;
      result.hepatotoxicity += pd.hepatotoxicity * entry.doseValue;
      result.lipidImpact += pd.lipid_impact * entry.doseValue;
      result.hctImpact += pd.hct_impact * entry.doseValue;
      result.neuroToxicity += pd.neuro_toxicity * entry.doseValue;
    }
  }

  return result;
}
