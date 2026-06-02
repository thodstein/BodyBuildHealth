export type InteractionType = 'synergy' | 'conflict' | 'danger';
export type Severity = 1 | 2 | 3;
export type Onset = 'fast' | 'medium' | 'slow';
export type Decay = 'fast' | 'medium' | 'slow' | 'very_slow';
export type DoseResponse = 'linear' | 'sigmoid';

export interface MechanismWeight { name: string; weight: number; }
export interface OrganWeight { name: string; weight: number; }
export interface RiskWeight { name: string; weight: number; }
export interface SynergyFactor { effect: string; factor: number; }
export interface AntagonistFactor { effect: string; factor: number; }
export interface Duration { onset: Onset; peak: string; half_life: string; decay: Decay; }
export interface PKPD {
  emax: number; ec50: number; dose_response: DoseResponse;
  tissue_distribution: Record<string, number>;
  receptor_affinity: Record<string, number>;
  metabolism: string[]; elimination: string[];
}
export interface Coverage {
  HPA: number; HPT: number; HPG: number; GH_IGF: number;
  MITO: number; GI: number; LIVER: number; CARDIO: number;
}

export interface EffectEntry {
  effect: string;
  class: string; group: string;
  strength_base: number; strength_max: number;
  mechanisms: MechanismWeight[];
  organs: OrganWeight[];
  risks: RiskWeight[];
  synergy: SynergyFactor[];
  antagonists: AntagonistFactor[];
  duration: Duration;
  pkpd: PKPD;
  coverage: Coverage;
  coverage_score: number; risk_score: number;
}

export interface InteractionEntry {
  substanceA: string; substanceB: string;
  type: InteractionType; severity: Severity;
  mechanisms: string[]; description: string;
}

export interface SubstanceEffect {
  effect: string; strength: number;
}

export interface SubstanceEntry {
  substance: string; effects: SubstanceEffect[];
}

export interface GoalProfile {
  effect_priority: Record<string, number>;
  preferred_groups: string[];
  avoid_groups: string[];
  intensity: number;
}

export interface StackRule {
  min_substances?: number; max_substances?: number;
  min_effects?: number; max_effects?: number;
  allow_conflicts?: boolean; synergy_min?: number;
  effect_priority_weight?: number; preferred_groups_boost?: number;
  avoid_groups_penalty?: number; group_focus?: boolean;
  group_boost?: number; required_groups?: string[];
  required_effects?: string[];
}

export interface StackTemplate {
  description: string; rules: StackRule;
}

export type RawData = Record<string, any>;

export function cleanKeys<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(v => cleanKeys(v)) as unknown as T;
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = k.trim();
    cleaned[key] = typeof v === 'object' ? cleanKeys(v) : v;
  }
  return cleaned as T;
}export type OrganId = string;
export type AnalysisId = string;
export type MechanismId = string;
export type EffectId = string;
export type SubstanceId = string;
