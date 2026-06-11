import type { ReadinessScores, InjuryRecord, WarmupBlock, CooldownBlock } from '../core/types';
import type { CyclePlan, CycleWeekPlan } from './cycle-types.engine';
import { selectCycleTemplate, generateCyclePlan } from './cycle.engine';
import { selectBestSplit } from './split-selector.engine';
import { autoregulate, calculatePRI, type AutoregulationAdjustment } from './autoregulation.engine';
import { generateWarmup } from './warmup.engine';
import { generateCooldown } from './cooldown.engine';
import { generateExercises } from './exercise-generator.engine';

export interface PipelineInput {
  goal: string;
  level: string;
  daysPerWeek: number;
  weeks: number;
  weakPoints: string[];
  injuries?: InjuryRecord[];
  equipmentAvailable?: string[];
  recovery: number;
  fatigue: number;
  nutrition: number;
  doms?: number;
  sleepQuality?: number;
  stress?: number;
  trainingLoadRatio?: number;
  techniqueIssues?: string[];
  riskFlags?: Record<string, string>;
  jointLimitations?: Record<string, string>;
}

export interface PipelineWeek {
  week: number;
  phase: string;
  phaseName: string;
  volumeMultiplier: number;
  intensityMultiplier: number;
  rir: number;
  isDeload: boolean;
  days: PipelineDay[];
  autoregulation: AutoregulationAdjustment | null;
}

export interface PipelineDay {
  day: number;
  name: string;
  isTraining: boolean;
  split: string;
  groups: string[];
  exercises: PipelineExercise[];
  warmup: WarmupBlock[];
  cooldown: CooldownBlock[];
  duration: number;
  intensity: string;
  rir: number;
}

export interface PipelineExercise {
  exerciseId: string;
  name: string;
  group: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  rir: number;
  rest: number;
  isCompound: boolean;
  technique?: string;
  setFormat?: any;
  comments?: string;
}

export interface PipelineSummary {
  totalWeeks: number;
  totalTrainingDays: number;
  avgVolumeMultiplier: number;
  avgIntensityMultiplier: number;
  totalDeloadWeeks: number;
  splitName: string;
  splitRationale: string[];
  cycleTemplateName: string;
  cycleDescription: string;
  phaseDistribution: Record<string, number>;
}

export interface PipelineOutput {
  split: { name: string; rationale: string[] };
  cycle: CyclePlan;
  weeks: PipelineWeek[];
  summary: PipelineSummary;
}

const DAY_NAMES_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const GROUP_LABELS: Record<string, string> = {
  chest: 'Грудь', back: 'Спина', legs: 'Ноги', shoulders: 'Плечи',
  arms: 'Руки', core: 'Кор', full_body_light: 'Лёгкое всё тело',
};

function injuryToSeverity(movementLimit: string): string {
  switch (movementLimit) {
    case 'severe': case 'full_restriction': return 'severe';
    case 'moderate': return 'moderate';
    default: return 'mild';
  }
}

function calcWarmupDuration(blocks: WarmupBlock[]): number {
  return blocks.reduce((s, b) => s + b.durationSec, 0);
}

function calcCooldownDuration(blocks: CooldownBlock[]): number {
  return blocks.reduce((s, b) => s + b.durationSec, 0);
}

export function generateTrainingPlan(input: PipelineInput): PipelineOutput {
  const { goal, level, daysPerWeek, weeks, weakPoints, injuries } = input;

  const splitInput = {
    goal,
    level,
    daysPerWeek,
    recovery: input.recovery,
    fatigue: input.fatigue,
    nutrition: input.nutrition,
    weakPoints,
    injuries: injuries || [],
    experience: level,
    sessionDuration: 60,
    rir: 2,
    exercises: [],
  };
  const bestSplit = selectBestSplit(splitInput);
  const cycle = generateCyclePlan(goal, level, weeks, input.recovery);
  const template = selectCycleTemplate(goal, level, weeks);

  const weeksOutput: PipelineWeek[] = [];

  for (const weekPlan of cycle.weekPlans) {
    const readiness: ReadinessScores = {
      recovery: input.recovery,
      nutrition: input.nutrition,
      support: 50,
      fatigue: input.fatigue,
    };

    const autoInput = {
      readiness,
      trainingLoadRatio: input.trainingLoadRatio || 1.0,
      plannedWeek: weekPlan,
      plannedExercises: [],
      goal,
      level,
      weakPoints,
      injuries: (injuries || []).map(i => ({ joint: i.location, severity: injuryToSeverity(i.movementLimit) })),
      techniqueIssues: input.techniqueIssues || [],
      doms: input.doms || 3,
      sleepQuality: input.sleepQuality || 7,
      stress: input.stress || 4,
      lastSessionRPE: undefined,
      recentVolumeTrend: undefined,
      strengthTrend: undefined,
    };
    const autoAdjustment = autoregulate(autoInput);

    const trainingPattern = getTrainingDayPattern(daysPerWeek);
    const days: PipelineDay[] = [];

    for (let d = 0; d < 7; d++) {
      const isTraining = trainingPattern[d];
      if (!isTraining) {
        days.push({
          day: d,
          name: DAY_NAMES_RU[d] || `Day ${d + 1}`,
          isTraining: false,
          split: 'Отдых',
          groups: [],
          exercises: [],
          warmup: [],
          cooldown: [],
          duration: 0,
          intensity: 'low',
          rir: 4,
        });
        continue;
      }

      const dayIdx = trainingPattern.slice(0, d + 1).filter(Boolean).length - 1;
      const groups = bestSplit.groupsPerDay[dayIdx % bestSplit.groupsPerDay.length] || [];

      const exerciseGenInput = {
        slots: groups.map((g: string, i: number) => ({
          pattern: (['horizontal_push','horizontal_pull','squat','hinge','vertical_push','vertical_pull','accessory'] as const)[i % 7],
          role: (i === 0 ? 'main' : i === 1 ? 'secondary' : 'accessory') as 'main' | 'secondary' | 'accessory',
          priority: i + 1,
        })),
        goal,
        equipmentAvailable: input.equipmentAvailable || ['barbell', 'dumbbell', 'bench', 'cable'],
        weakPoints,
        techniqueIssues: input.techniqueIssues || [],
        riskSnapshot: input.riskFlags || {},
        exerciseDB: [],
      };
      const genOutput = generateExercises(exerciseGenInput);

      const exercises: PipelineExercise[] = [];
      for (const entry of genOutput.selectedExercises) {
        const slot = entry.exercise;
        const sets = autoAdjustment.adjustmentFactor < 0.7 ? 3 : autoAdjustment.adjustmentFactor < 0.9 ? 4 : 5;
        exercises.push({
          exerciseId: slot.id,
          name: slot.name,
          group: groups[0] || 'chest',
          sets: Math.max(2, Math.round(sets * weekPlan.volumeMultiplier)),
          repsMin: goal === 'strength' ? 3 : goal === 'hypertrophy' || goal === 'bulk' ? 8 : 10,
          repsMax: goal === 'strength' ? 6 : goal === 'hypertrophy' || goal === 'bulk' ? 12 : 15,
          rir: weekPlan.rirBase,
          rest: goal === 'strength' ? 180 : 90,
          isCompound: true,
        });
      }

      const warmupBlocks = generateWarmup({
        sessionFocus: goal,
        primaryExercises: genOutput.selectedExercises.map(s => s.exercise.id),
        riskFlags: input.riskFlags || {},
        techniqueIssues: input.techniqueIssues || [],
        fatigueLevel: input.fatigue / 100,
        equipmentAvailable: input.equipmentAvailable || ['barbell', 'dumbbell', 'bench', 'cable'],
      });

      const cooldownBlocks = generateCooldown({
        muscleGroupsUsed: groups,
        fatigueScore: input.fatigue / 100,
        riskFlags: input.riskFlags || {},
        sessionDuration: 3600,
      });

      const totalSets = exercises.reduce((s, e) => s + e.sets, 0);
      const warmupMin = calcWarmupDuration(warmupBlocks) / 60;
      const cooldownMin = calcCooldownDuration(cooldownBlocks) / 60;
      const duration = Math.round(10 + totalSets * 4 + warmupMin + cooldownMin);
      const intensity: 'low' | 'medium' | 'high' = weekPlan.isDeload ? 'low' : weekPlan.intensityMultiplier > 0.85 ? 'high' : weekPlan.intensityMultiplier > 0.7 ? 'medium' : 'low';

      days.push({
        day: d,
        name: DAY_NAMES_RU[d] || `Day ${d + 1}`,
        isTraining: true,
        split: `${bestSplit.name} — ${groups.map(g => GROUP_LABELS[g] || g).join('+')}`,
        groups,
        exercises,
        warmup: warmupBlocks,
        cooldown: cooldownBlocks,
        duration,
        intensity,
        rir: weekPlan.rirBase,
      });
    }

    weeksOutput.push({
      week: weekPlan.week,
      phase: weekPlan.phase,
      phaseName: '',
      volumeMultiplier: weekPlan.volumeMultiplier,
      intensityMultiplier: weekPlan.intensityMultiplier,
      rir: weekPlan.rirBase,
      isDeload: weekPlan.isDeload,
      days,
      autoregulation: autoAdjustment,
    });
  }

  const phaseDistribution: Record<string, number> = {};
  for (const wp of cycle.weekPlans) {
    phaseDistribution[wp.phase] = (phaseDistribution[wp.phase] || 0) + 1;
  }

  const totalTrainingDays = weeksOutput.reduce(
    (sum, w) => sum + w.days.filter(d => d.isTraining).length, 0
  );

  return {
    split: {
      name: bestSplit.name,
      rationale: bestSplit.rationale,
    },
    cycle,
    weeks: weeksOutput,
    summary: {
      totalWeeks: cycle.totalWeeks,
      totalTrainingDays,
      avgVolumeMultiplier: cycle.summary.avgVolumeMultiplier,
      avgIntensityMultiplier: cycle.summary.avgIntensityMultiplier,
      totalDeloadWeeks: cycle.summary.totalDeloadWeeks,
      splitName: bestSplit.name,
      splitRationale: bestSplit.rationale,
      cycleTemplateName: template?.name || 'Авто-цикл',
      cycleDescription: template?.description || 'Автоматический цикл',
      phaseDistribution,
    },
  };
}

function getTrainingDayPattern(daysPerWeek: number): boolean[] {
  const patterns: Record<number, boolean[]> = {
    3: [true, false, true, false, true, false, false],
    4: [true, true, false, true, true, false, false],
    5: [true, true, false, true, true, false, true],
    6: [true, true, true, false, true, true, true],
  };
  return patterns[daysPerWeek] || patterns[3];
}
