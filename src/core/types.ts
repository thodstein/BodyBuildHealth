export type LabPhase = 'baseline' | 'on_cycle' | 'bridge' | 'pct' | 'post_pct' | 'course_bridge_course';
export type UserRole = 'athlete' | 'coach' | 'doctor' | 'author' | 'editor' | 'admin';
export type ArticleCategory = 'training' | 'nutrition' | 'pharma' | 'support' | 'labs' | 'risks' | 'pct' | 'fertility' | 'general';
export type ArticleStatus = 'draft' | 'review' | 'published' | 'archived';
export type DBStore = 'profile'|'readiness_log'|'risk_log'|'fertility_log'|'settings'|'labs_log'|'diagnostics_log'|'phase_schedule'|'diary'|'articles'|'gamification'|'marketplace_cart';

export interface ReadinessInput {
  sleepHours: number; sleepQuality: number; nightAwakenings: number; hrvRatio: number;
  doms: number; stress: number; subjFatigue: number; hrIncrease: number;
  trainingLoadRatio: number; calRatio: number; proteinRatio: number; waterRatio: number;
  fiberRatio: number; omega3Flag: boolean; riskCoverageMap: Record<string, number>;
}
export interface ReadinessScores { recovery: number; nutrition: number; support: number; fatigue: number; isConservative: boolean; conservativeReason?: string; }

export interface DoseRequest { concentrationMgPerMl: number; targetDoseMg: number; targetDosePerKg?: number; bodyWeightKg?: number; syringeVolumeMl: 0.3|0.5|1|2|5; divisionsPerMl: number; roundingStepMl: number; vialVolumeMl?: number; }
export interface DoseResponse { volumeMl: number; divisions: number; dosesPerVial: number; flags: string[]; }

export interface RiskInput { activeDrugs: Record<string, {dosePerWeek: number}>; genetics: Record<string, string>; labs: any[]; nutritionFactor: number; trainingFactor: number; supportCoverage: Record<string, number>; }
export interface RiskResult { systemBreakdown: Record<string, {raw: number; net: number}>; overallRaw: number; overallNet: number; }

export interface FertilityInput { volumeMl: number; concentrationMlMln: number; totalCountMln: number; prPercent: number; morphologyPercent: number; ph: number; viscosity: boolean; marPercent: number; leukocytesMlMln: number; agglutination: boolean; }
export interface FertilityResult { ifScore: number; interpretation: string; forecast6w: number; forecast12w: number; }

export interface PredictiveInput { history: Record<string, number[]>; current: Record<string, number>; }
export interface PredictiveResult { forecasts: Record<string, { values: number[]; ci95: [number, number] }>; warnings: string[]; }

export interface CorrelationInput { readiness: ReadinessScores; risks: RiskResult; labs: LabPoint[]; drugs: Record<string, {dosePerWeek: number}>; symptoms: string[]; }
export interface CorrelationOutput { actions: Array<{id:string; title:string; impact:'low'|'med'|'high'; effort:'low'|'med'|'high'; reason:string}>; flags: string[]; }

export interface ExportData { profile: any; readiness: ReadinessScores[]; labs: LabPoint[]; risks: RiskResult[]; notes?: string; }

export interface LabPoint { id: string; code: string; name: string; value: number; unit: string; date: string; phase: LabPhase; source?: string; custom?: boolean; }
export interface LabForecast { current: number; w4: number; w8: number; w12: number; alert?: string; }

export interface DiagnosticEntry {
  id: string; type: 'usg_obp' | 'echocg' | 'joint_usg' | 'joint_mri' | 'dexa' | 'other';
  date: string; phase: LabPhase; findings: string; keyMetrics: Record<string, number>; 
  images?: string[]; custom?: boolean;
}

export interface PhaseSchedule {
  phase: LabPhase; startDate: string; durationWeeks: number; mandatoryLabs: string[]; 
  mandatoryDiagnostics: string[]; nextCheckDate: string; isOverdue: boolean;
}

export interface PenaltyResult {
  score: number; // 0-100 (100 = критично пропущено)
  missingLabs: string[];
  missingDiagnostics: string[];
  action: string;
  affectsTrust: boolean;
}

export interface Article {
  id: string; title: string; slug: string; teaser: string; content: string;
  coverImageUrl: string; tags: string[]; category: ArticleCategory;
  authorId: string; authorName: string; status: ArticleStatus;
  createdAt: string; updatedAt: string; publishedAt?: string;
  version: number; likes: number; views: number; isPinned: boolean;
}