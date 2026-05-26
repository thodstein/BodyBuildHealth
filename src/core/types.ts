// ТЗ §3.1, §3.2, §4.6, §5.2, §13.2
export interface UserProfile {
  id: string;
  telegramId: number;
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  bodyFatPercent?: number;
  goal: 'bulk' | 'cut' | 'maintenance' | 'strength' | 'recomp' | 'rehab';
  activityLevel: 1.2 | 1.375 | 1.55 | 1.725 | 1.9;
  trainingDaysPerWeek: number;
  snp?: Record<string, string>;
}

export interface ReadinessInput {
  sleepHours: number;
  sleepQuality: number;
  nightAwakenings: number;
  hrvRatio: number;
  doms: number;
  stress: number;
  subjFatigue: number;
  hrIncrease: number;
  trainingLoadRatio: number;
  calRatio: number;
  proteinRatio: number;
  waterRatio: number;
  fiberRatio: number;
  omega3Flag: boolean;
  riskCoverageMap: Record<string, number>;
}

export interface ReadinessScores {
  recovery: number;
  nutrition: number;
  support: number;
  fatigue: number;
  isConservative: boolean;
  conservativeReason?: string;
}

export interface DoseRequest {
  concentrationMgPerMl: number;
  targetDoseMg: number;
  targetDosePerKg?: number; // ТЗ §4.6.1
  bodyWeightKg?: number;
  syringeVolumeMl: 0.3 | 0.5 | 1 | 2 | 5;
  divisionsPerMl: number;
  roundingStepMl: number;
  vialVolumeMl?: number;
}

export interface DoseResponse {
  volumeMl: number;
  divisions: number;
  dosesPerVial: number;
  flags: string[];
}

export interface LabResult {
  id: string;
  markerCode: string;
  value: number;
  unit: string;
  normalizedValue: number;
  date: string;
  phase: 'baseline' | 'on_cycle' | 'bridge' | 'pct' | 'post_pct';
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  conservativeModeOverride: boolean;
  apiKeys: { fatSecret?: string; labOAuth?: string };
}

export type DBStoreName = 'profile' | 'food_diary' | 'lab_results' | 'training_log' | 'articles' | 'settings' | 'gamification' | 'calc_cache';