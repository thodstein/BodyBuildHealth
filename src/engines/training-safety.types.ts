export type SafetyLevel = 'safe' | 'caution' | 'dangerous' | 'blocked';
export type SafetySource = 'pl_auto' | 'bb_auto' | 'cardio' | 'manual_program';

export type SafetySeverity = 'info' | 'warning' | 'critical';

export interface TrainingSafetyProfile {
  injuries?: Array<{ muscle?: string; type?: string; exclude?: boolean; from?: string; to?: string }>;
  currentPain?: string[];
  jointLimitations?: Record<string, 'none' | 'mild' | 'moderate' | 'severe'>;
  techniqueIssues?: string[];
  avoidAxialLoad?: boolean;
  level?: string;
  trainingYears?: number;
  sleepHours?: number;
  stressLevel?: number;
  hrvMs?: number;
  recovery?: number;
}

export interface TrainingSafetyExercise {
  id?: string;
  name?: string;
  sets?: number;
  reps?: number;
  weight?: number;
  rir?: number;
  techniqueScore?: number;
}

export interface TrainingSafetyWorkload {
  acwrRatio?: number;
  acuteLoad?: number;
  chronicLoad?: number;
  monotony?: number;
  strain?: number;
}

export interface TrainingSafetyCardio {
  type: 'zone2' | 'hiit' | 'miss' | 'recovery';
  daysPerWeek: number;
  durationMin: number;
  intensity?: number;
  goal?: string;
}

export interface TrainingSafetyPlan {
  exercises?: TrainingSafetyExercise[];
  weeks?: Array<{ sessions?: Array<{ exercises?: TrainingSafetyExercise[] }> }>;
  volumeViolations?: number;
  frequencyIssues?: string[];
}

export interface TrainingSafetyInput {
  source: SafetySource;
  profile?: TrainingSafetyProfile;
  exercises?: TrainingSafetyExercise[];
  plan?: TrainingSafetyPlan;
  workload?: TrainingSafetyWorkload;
  cardio?: TrainingSafetyCardio;
}

export interface SafetyIssue {
  code: string;
  severity: SafetySeverity;
  source: string;
  message: string;
  recommendation?: string;
  exerciseId?: string;
}

export interface SafetyAdjustment {
  kind: 'exclude_exercise' | 'replace_exercise' | 'volume_multiplier' | 'rir_shift' | 'cardio_limit';
  value: string | number;
  reason: string;
  exerciseId?: string;
}

export interface ExerciseSafetyResult {
  exerciseId: string;
  name: string;
  score: number;
  blocked: boolean;
  issues: SafetyIssue[];
}

export interface TrainingSafetyReport {
  score: number;
  level: SafetyLevel;
  factors: Record<string, number>;
  issues: SafetyIssue[];
  recommendations: string[];
  adjustments: SafetyAdjustment[];
  exercises: ExerciseSafetyResult[];
  generatedAt: string;
}
