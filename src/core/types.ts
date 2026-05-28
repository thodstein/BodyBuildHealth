export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InteractionType = 'synergy' | 'conflict' | 'danger' | 'caution';
export type Onset = 'fast' | 'medium' | 'slow';
export type Decay = 'fast' | 'medium' | 'slow' | 'very_slow';
export type DoseResponse = 'linear' | 'sigmoid';
export type Route = 'oral' | 'sc' | 'intranasal' | 'im' | 'iv' | 'topical';
export type LabPhaseType = 'baseline' | 'course' | 'bridge' | 'pct';
export type UserRole = 'user' | 'coach' | 'doctor' | 'admin' | 'editor';

export type OrganId = string;
export type AnalysisId = string;
export type MechanismId = string;
export type EffectId = string;
export type SubstanceId = string;

export interface UserProfile {
  id: string; name: string; email: string; role: UserRole; phase: LabPhaseType; courseStartDate: string;
  settings: { age: number; sex: 'male' | 'female'; weight: number; goal: string; };
}

export interface UserContext {
  role: UserRole; age: number; sex: 'male' | 'female'; weight: number; goal: string; phase: LabPhaseType; courseStartDate: string;
}

export interface FoodItem {
  id: string; name: string; category: string; macros: { kcal: number; p: number; f: number; c: number; fiber: number; water: number; steps: number; };
}
export interface Exercise { id: string; name: string; type: string; targetMuscles: string[]; }
export interface PCTSchedule { startWeek: number; drugs: Array<{ name: string; dose: string; durationWeeks: number }>; support: Array<{ name: string; dose: string; durationWeeks: number }>; }
export interface ParsedLabResult { marker: string; value: number; unit: string; }
export interface DynamicRefRange { lln: number; uln: number; phase: string; }

export interface Article {
  id: string; title: string; category: string; teaser: string; content: string; tags: string[];
  authorId: string; authorName: string; slug: string; coverImageUrl: string; status: string;
}

export interface LabPoint { id: string; code: string; name: string; value: number; unit: string; date: string; phase: LabPhaseType; }
export interface CourseEntry { id: string; substanceId: string; doseValue: number; doseUnit: string; frequency: number; startWeek: number; endWeek: number; }

export interface MechanismWeight { name: string; weight: number; }
export interface OrganWeight { name: string; weight: number; }
export interface RiskWeight { name: string; weight: number; }
export interface SynergyFactor { effect: string; factor: number; }
export interface AntagonistFactor { effect: string; factor: number; }
export interface Duration { onset: Onset; peak: string; halfLife: string; decay: Decay; }
export interface PKPD { emax: number; ec50: number; doseResponse: DoseResponse; tissueDistribution: Record<string, number>; receptorAffinity: Record<string, number>; metabolism: string[]; elimination: string[]; }

export interface EffectEntry { effect: string; class: string; group: string; strengthBase: number; strengthMax: number; mechanisms: MechanismWeight[]; organs: OrganWeight[]; risks: RiskWeight[]; synergy: SynergyFactor[]; antagonists: AntagonistFactor[]; duration: Duration; pkpd: PKPD; coverage: Record<string, number>; coverageScore: number; riskScore: number; }
export interface SubstanceEntry { id: string; name: string; category: string; route: Route[]; effects: { effect: string; strength: number }[]; tHalfHours?: number; bioavailability?: Record<string, { min: number; max: number; avg: number }>; mechanisms?: string[]; risks?: string[]; description?: string; }
export interface InteractionEntry { substanceA: string; substanceB: string; type: InteractionType; severity: number; mechanisms: string[]; description: string; }
export interface GoalProfile { id: string; effectPriority: Record<string, number>; preferredGroups: string[]; avoidGroups: string[]; intensity: number; }
export interface StackTemplate { id: string; description: string; rules: { minSubstances: number; maxSubstances: number; minEffects: number; maxEffects: number; allowConflicts: boolean; synergyMin: number; }; }
export interface StackEntry { id: string; effects: string[]; substances: string[]; synergyScore: number; }

export interface AnalysisEntry { id: string; name: string; units: string; normalRange: [number, number]; organTargets: string[]; systemTargets: string[]; mechanismsUp: string[]; mechanismsDown: string[]; riskIfHigh: string[]; riskIfLow: string[]; }
export interface OrganEntry { id: string; name: string; systems: string[]; description: string; keyBiomarkers: string[]; riskTags: string[]; }
export interface SystemEntry { id: string; name: string; organs: string[]; description: string; keyBiomarkers: string[]; riskTags: string[]; }
export interface MechanismEntry { id: string; name: string; level: number; category: string; description: string; organs: string[]; systems: string[]; biomarkers: string[]; effectsPositive: string[]; effectsNegative: string[]; riskWeight: number; }
export interface AxisEntry { id: string; name: string; organs: string[]; description: string; mechanismUp: string; mechanismDown: string; riskUp: string; riskDown: string; pathway?: string; tags?: string[]; type?: string; }
export interface RiskEntry { id: string; title: string; text: string; level: Severity; triggerType: string; recId?: string; }
export interface RecommendationEntry { recId: string; type: string; riskId: string; level: Severity; title: string; text: string; }
export interface TagEntry { id: string; type: string; name: string; }
export interface BrandEntry { id: string; name: string; country: string; description: string; tag: string; }
export interface AliasMap { [key: string]: string; }
export interface GroupMap { [key: string]: string[]; }

export interface MasterDB {
  effects: EffectEntry[]; substances: SubstanceEntry[]; interactions: InteractionEntry[];
  goals: GoalProfile[]; stackTemplates: StackTemplate[]; stacks: StackEntry[];
  analyses: AnalysisEntry[]; organs: OrganEntry[]; systems: SystemEntry[];
  mechanisms: MechanismEntry[]; axes: AxisEntry[]; risks: RiskEntry[];
  recommendations: RecommendationEntry[]; tags: TagEntry[]; brands: BrandEntry[];
  aliases: AliasMap; substanceGroups: GroupMap; effectGroups: GroupMap;
  synergyMatrix: Record<string, Record<string, number>>; conflictMatrix: Record<string, Record<string, number>>;
  goal_profiles?: any[];
}
