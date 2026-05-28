import type { OrganId, AnalysisId, MechanismId, EffectId, SubstanceId } from './types';

export interface ClinicalDatabase {
  organs: Record<OrganId, any>;
  analyses: Record<AnalysisId, any>;
  mechanisms: Record<MechanismId, any>;
  effects: Record<EffectId, any>;
  substances: Record<SubstanceId, any>;
}

export function initClinicalDB(): ClinicalDatabase {
  return {
    organs: {},
    analyses: {},
    mechanisms: {},
    effects: {},
    substances: {}
  };
}
