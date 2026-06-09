export type MesocyclePhase5 = 'accumulation' | 'intensification' | 'transmutation' | 'peak' | 'deload';

export interface CyclePhaseDef {
  phase: MesocyclePhase5;
  weeks: number;
  startVol?: number;
  endVol?: number;
}

export interface CycleTemplate {
  id: string;
  name: string;
  description: string;
  minWeeks: number;
  maxWeeks: number;
  goals: string[];
  levels: string[];
  phases: CyclePhaseDef[];
  progressionType: 'linear' | 'double' | 'undulating' | 'conjugate';
  intensityProfile: 'conservative' | 'moderate' | 'aggressive';
  recoveryThreshold: number;
}

export interface CycleWeekPlan {
  week: number;
  phase: MesocyclePhase5;
  phaseWeek: number;
  volumeMultiplier: number;
  intensityMultiplier: number;
  rirBase: number;
  rirPhase: 'base' | 'build' | 'peak' | 'deload';
  isDeload: boolean;
  progressionType: string;
}

export interface CycleSummary {
  totalWeeks: number;
  avgVolumeMultiplier: number;
  avgIntensityMultiplier: number;
  totalDeloadWeeks: number;
  phaseBreakdown: Record<string, number>;
  goal: string;
  level: string;
}

export interface CyclePlan {
  templateId: string;
  totalWeeks: number;
  goal: string;
  level: string;
  weekPlans: CycleWeekPlan[];
  summary: CycleSummary;
}

export interface CycleInput {
  goal: string;
  level: string;
  weeks: number;
  daysPerWeek: number;
  recovery?: number;
  fatigue?: number;
  weakPoints?: string[];
  injuries?: string[];
}
