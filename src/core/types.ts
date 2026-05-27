export type LabPhase = 'baseline' | 'on_cycle' | 'bridge' | 'pct' | 'post_pct' | 'course_bridge_course';
export type LabPhaseType = 'course' | 'course-bridge-course' | 'course-pct' | 'pct' | 'bridge' | 'maintenance';
export type DrugClass = 'testosterone' | 'trenbolone' | 'nandrolone' | 'boldenone' | 'primobolan' | 'oral_17aa' | 'sarm' | 'peptide_ghrh' | 'peptide_ghrp' | 'igf1' | 'insulin' | 'mgf' | 'pct_serm' | 'pct_aromatase' | 'pct_dopamine' | 'support';
export type DoseUnit = 'mg/wk' | 'mg/day' | 'IU/wk' | 'IU/day' | 'mcg/day' | 'mcg/wk';
export type DBStore = 'profile' | 'readiness_log' | 'risk_log' | 'fertility_log' | 'settings' | 'labs_log' | 'diagnostics_log' | 'phase_schedule' | 'diary' | 'articles' | 'gamification' | 'marketplace_cart' | 'food_diary';
export type UserRole = 'user' | 'coach' | 'doctor' | 'admin' | 'editor';
export type OrganId = string;
export type AnalysisId = string;
export type MechanismId = string;
export type EffectId = string;
export type SubstanceId = string;
export type PCTSchedule = any;
export type Exercise = any;
export type FoodItem = any;
export type ParsedLabResult = any;
export interface ParsedMeal {
  name: string;
  protein: number;
  fats: number;
  carbs: number;
  calories: number;
  confidence: number;
  raw: string;
}
export interface UserProfile {
  id: string;
  name: string;
  age: number;
  sex: 'male' | 'female';
  role: UserRole;
  email?: string;
}

export interface UserSettings {
  age: number;
  sex: 'male' | 'female';
  weight: number;
  goal: string;
}

export interface ReadinessInput {
  sleepHours: number; sleepQuality: number; nightAwakenings: number; hrvRatio: number;
  doms: number; stress: number; subjFatigue: number; hrIncrease: number;
  trainingLoadRatio: number; calRatio: number; proteinRatio: number; waterRatio: number;
  fiberRatio: number; omega3Flag: boolean; riskCoverageMap: Record<string, number>;
}
export interface ReadinessScores { recovery: number; nutrition: number; support: number; fatigue: number; isConservative: boolean; conservativeReason?: string; }

export interface DoseRequest { concentrationMgPerMl: number; targetDoseMg: number; targetDosePerKg?: number; bodyWeightKg?: number; syringeVolumeMl: 0.3 | 0.5 | 1 | 2 | 5; divisionsPerMl: number; roundingStepMl: number; vialVolumeMl?: number; }
export interface DoseResponse { volumeMl: number; divisions: number; dosesPerVial: number; flags: string[]; }

export interface RiskInput { activeDrugs: Record<string, { dosePerWeek: number }>; genetics: Record<string, string>; labs: any[]; nutritionFactor: number; trainingFactor: number; supportCoverage: Record<string, number>; }
export interface RiskResult { systemBreakdown: Record<string, { raw: number; net: number }>; overallRaw: number; overallNet: number; }

export interface FertilityInput { volumeMl: number; concentrationMlMln: number; totalCountMln: number; prPercent: number; morphologyPercent: number; ph: number; viscosity: boolean; marPercent: number; leukocytesMlMln: number; agglutination: boolean; }
export interface FertilityResult { ifScore: number; interpretation: string; forecast6w: number; forecast12w: number; }

export interface TrainingInput { level: 'beginner' | 'intermediate' | 'advanced' | 'enhanced'; goal: 'bulk' | 'cut' | 'maintenance' | 'strength' | 'hypertrophy' | 'rehab'; daysPerWeek: number; recovery: number; fatigue: number; nutrition: number; weakPoints: string[]; injuries?: string[]; }
export interface TrainingOutput { splitName: string; splitDesc: string; volumePerGroup: Record<string, number>; rir: string; isDeload: boolean; deloadReason?: string; weekPlan: string; }

export interface NutritionInput { weightKg: number; heightCm: number; age: number; sex: 'male' | 'female'; pal: number; goal: 'bulk' | 'cut' | 'maintenance' | 'recomp' | 'rehab' | 'strength'; bodyFatPercent?: number; drugs?: string[]; }
export interface NutritionTargets { bmr: number; tdee: number; kcal: number; protein: number; fats: number; carbs: number; water: number; fiber: number; micros: Record<string, number>; }

export interface LabPoint { id: string; code: string; name: string; value: number; unit: string; date: string; phase: LabPhase; source?: string; custom?: boolean; }
export interface LabForecast { current: number; w4: number; w8: number; w12: number; alert?: string; }

export interface DiagnosticEntry { id: string; type: 'usg_obp' | 'echocg' | 'joint_usg' | 'joint_mri' | 'dexa' | 'ecg' | 'bp_monitor' | 'usg_testes' | 'other'; date: string; phase: LabPhase; findings: string; keyMetrics: Record<string, number>; images?: string[]; custom?: boolean; }
export interface PenaltyResult { score: number; missingLabs: string[]; missingDiagnostics: string[]; action: string; affectsTrust: boolean; }

export interface PKParams { ka: number; k10: number; k12: number; k21: number; Vd: number; bioavailability: number; halfLifeHours: number; }
export interface PDParams { AR_affinity: number; aromatization: number; five_alpha_reduction: number; progestogenic: number; hepatotoxicity: number; lipid_impact: number; hct_impact: number; neuro_toxicity: number; }
export interface PharmaSubstance { id: string; name: string; class: DrugClass; esters?: string[]; pk: PKParams; pd: PDParams; ec50: number; n_hill: number; maxEffect: number; }

export interface CourseEntry { id: string; substanceId: string; ester?: string; doseValue: number; doseUnit: DoseUnit; frequency: 'daily' | 'eod' | '2x/wk' | '3x/wk' | '1x/wk'; startWeek: number; endWeek: number; }
export interface ConcentrationPoint { week: number; cp: number; tol: number; effect: number; }
export interface LabHysteresis { marker: string; tauDays: number; baseline: number; current: number; history: number[]; }
export interface BayesianState { clearanceK: number; ec50Shift: number; lastUpdateWeek: number; }

export interface PurchaseOption { platform: string; url: string; price: number; currency: string; offerId?: string; deliveryDays?: number; isPremium?: boolean; }
export interface MarketplaceItem { id: string; name: string; category: 'supplement' | 'pharma' | 'peptide'; dailyDose: string; mechanisms: string[]; synergy: string; purchaseOptions: PurchaseOption[]; }

export type ArticleCategory = 'training' | 'nutrition' | 'pharma' | 'support' | 'labs' | 'risks' | 'pct' | 'fertility' | 'general';
export type ArticleStatus = 'draft' | 'review' | 'published' | 'archived';
export interface Article { id: string; title: string; slug: string; teaser: string; content: string; coverImageUrl: string; tags: string[]; category: ArticleCategory; authorId: string; authorName: string; status: ArticleStatus; createdAt: string; updatedAt: string; publishedAt?: string; version: number; likes: number; views: number; isPinned: boolean; }

export interface GamificationState { diaryFillRate: number; nutritionAdherence: number; labMatchRate: number; trainerFeedback: number; achievements: string[]; xp: number; challenges: Record<string, boolean>; }
export interface TrustResult { score: number; level: 'conservative' | 'standard' | 'aggressive'; volumeMultiplier: number; }
export interface Achievement { id: string; name: string; icon: string; condition: (s: GamificationState) => boolean; xp: number; }

export interface PredictiveInput { history: Record<string, number[]>; current: Record<string, number>; }
export interface PredictiveResult { forecasts: Record<string, { values: number[]; ci95: [number, number] }>; warnings: string[]; }

export interface CorrelationInput { readiness: ReadinessScores; risks: RiskResult; labs: LabPoint[]; drugs: Record<string, { dosePerWeek: number }>; symptoms: string[]; }
export interface CorrelationOutput { actions: Array<{ id: string; title: string; impact: 'low' | 'med' | 'high'; effort: 'low' | 'med' | 'high'; reason: string }>; flags: string[]; }

export interface ExportData { profile: any; readiness: ReadinessScores[]; labs: LabPoint[]; risks: RiskResult[]; notes?: string; }
export type RiskSystem = 'cardio' | 'hepatic' | 'renal' | 'neuro' | 'endocrine' | 'hematologic' | 'reproductive';

export interface LabCheckpoint {
  id: string;
  weekOffset: number;
  type: 'baseline' | 'mid_course' | 'end_course' | 'bridge' | 'start_pct' | 'mid_pct' | 'end_pct' | 'custom';
  status: 'pending' | 'completed' | 'overdue';
  dueDate: string;
  requiredMarkers: string[];
}

export interface UserContext {
  age: number;
  sex: 'male' | 'female';
  phase: LabPhaseType;
  role: UserRole;
  courseStartDate: string;
}

export interface ParsedLabData {
  marker: string;
  value: number;
  unit: string;
  confidence: number;
  rawText: string;
}

export interface DynamicRefRange {
  baseULN: number; baseLLN: number;
  ageFactor: (age: number) => number;
  sexFactor: (sex: 'male'|'female') => number;
  phaseFactor: (phase: LabPhaseType) => number;
}