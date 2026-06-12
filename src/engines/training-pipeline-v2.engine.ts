/**
 * Training Pipeline — Full orchestrator connecting all Training Domain engines.
 *
 * Flow: Goals → Split → Cycle → Periodization → Exercise Selection →
 *       Set Schemes → Tempo → Warmup → Session → Cooldown → Log → Analytics
 *
 * Single entry point for generating a complete training plan.
 *
 * @module training-pipeline-v2
 */

import { generateSplit, type SplitInput, type SplitOutput, type SessionTemplate } from './split-engines';
import { generateCycle, getPhaseParams, generatePeriodization, type CycleInput, type CycleOutput, type PhaseParams } from './cycle-periodization.engine';
import { generateSetScheme, type SetSchemeInput, type SetSchemeOutput } from './set-scheme-engine';
import { generateRepTempo, type RepTempoInput, type RepTempoOutput } from './rep-tempo-engine';
import { generateWarmup, type WarmupInput, type WarmupOutput } from './warmup-engine';
import { generateCooldown, type CooldownInput, type CooldownOutput } from './cooldown-engine';
import { estimateSessionDifficulty, type SessionDifficulty } from './session-metrics-engine';
import { computeConstraints, type ConstraintsInput, type TrainingConstraints } from './training-constraints.engine';
import { applyProgression, recommendProgression, type ProgressionInput, type ProgressionOutput } from './progression-rules.engine';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PipelineInput {
  goal: string;
  level: string;
  daysPerWeek: number;
  weeks: number;
  recovery: number;       // 0-10
  fatigue: number;         // 0-10
  weakPoints: string[];
  bodyWeight: number;
  equipmentAvailable: string[];
  estimated1RMs: Record<string, number>;
  sleepHours: number;
  stressLevel: number;
  injuries: string[];
  genetics: string[];
  cycleStartWeek: number;
}

export interface PipelineExercise {
  name: string;
  pattern: string;
  role: 'main' | 'secondary' | 'accessory' | 'rehab';
  sets: number;
  reps: number;
  weight: number;
  rpe: number;
  rir: number;
  tempo: string;
  restSeconds: number;
  scheme: string;
  progressionType: string;
  notes: string;
}

export interface PipelineDay {
  dayIndex: number;
  focus: string;
  difficulty: string;
  exercises: PipelineExercise[];
  warmup?: WarmupOutput;
  cooldown?: CooldownOutput;
}

export interface PipelineWeek {
  weekIndex: number;
  phase: string;
  volumeMultiplier: number;
  intensityMultiplier: number;
  days: PipelineDay[];
  fatigueTarget: number;
}

export interface PipelineOutput {
  planName: string;
  description: string;
  totalWeeks: number;
  weeks: PipelineWeek[];
  constraints: TrainingConstraints;
  recommendations: string[];
  deloadWeeks: number[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Exercise name database (simple lookup)
// ═══════════════════════════════════════════════════════════════════════════

const PATTERN_EXERCISES: Record<string, { name: string; jointStress: Record<string, number>; cnsDemand: number; complexity: number }> = {
  squat: { name: 'Присед со штангой', jointStress: { knee: 7, hip: 5, spine: 5, shoulder: 1, elbow: 1, ankle: 4 }, cnsDemand: 4, complexity: 3 },
  hinge: { name: 'Становая тяга', jointStress: { knee: 3, hip: 7, spine: 8, shoulder: 2, elbow: 2, ankle: 2 }, cnsDemand: 5, complexity: 4 },
  horizontal_push: { name: 'Жим лёжа', jointStress: { knee: 0, hip: 0, spine: 2, shoulder: 6, elbow: 4, ankle: 0 }, cnsDemand: 3, complexity: 2 },
  horizontal_pull: { name: 'Тяга в наклоне', jointStress: { knee: 1, hip: 1, spine: 5, shoulder: 3, elbow: 4, ankle: 0 }, cnsDemand: 3, complexity: 2 },
  vertical_push: { name: 'Жим над головой', jointStress: { knee: 0, hip: 0, spine: 4, shoulder: 8, elbow: 5, ankle: 0 }, cnsDemand: 3, complexity: 3 },
  vertical_pull: { name: 'Подтягивания', jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 5, elbow: 4, ankle: 0 }, cnsDemand: 2, complexity: 2 },
  lunge: { name: 'Выпады', jointStress: { knee: 5, hip: 4, spine: 2, shoulder: 1, elbow: 1, ankle: 3 }, cnsDemand: 2, complexity: 2 },
  carry: { name: 'Фермерская прогулка', jointStress: { knee: 2, hip: 2, spine: 4, shoulder: 2, elbow: 2, ankle: 1 }, cnsDemand: 1, complexity: 1 },
  accessory: { name: 'Аксессуар', jointStress: { knee: 1, hip: 1, spine: 1, shoulder: 2, elbow: 3, ankle: 0 }, cnsDemand: 1, complexity: 1 },
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Pipeline
// ═══════════════════════════════════════════════════════════════════════════

export function generateTrainingPlan(input: PipelineInput): PipelineOutput {
  const recs: string[] = [];

  // Step 1: Split
  const split = generateSplit({
    daysPerWeek: input.daysPerWeek,
    goal: input.goal as SplitInput['goal'],
    weakPoints: input.weakPoints,
    equipmentAvailable: input.equipmentAvailable,
  });

  // Step 2: Periodization phases
  const periodization = generatePeriodization(input.weeks, input.goal as any);
  const deloadWeeks: number[] = [];

  // Step 3: Constraints
  const constraints = computeConstraints({
    riskSnapshot: {},
    fatigueLevel: input.fatigue / 10,
    recoveryLevel: input.recovery / 10,
    priScore: input.recovery / 10,
    jointFatigue: {},
    cumulativeLoad: { weekly: 0, patternLoad: {}, jointLoad: {}, overload: false },
    equipmentAvailable: input.equipmentAvailable,
    goal: input.goal,
  });
  if (constraints.recommendations.length > 0) {
    recs.push(...constraints.recommendations);
  }

  // Step 4: Generate weeks
  const weeks: PipelineWeek[] = [];
  let weekCounter = 1;

  for (const phase of periodization.phases) {
    const params = phase.params;

    for (let pw = 0; pw < phase.weeks; pw++) {
      const w = weekCounter++;
      const isDeload = phase.phase === 'deload';
      if (isDeload) deloadWeeks.push(w);

      const days: PipelineDay[] = [];

      for (let d = 0; d < Math.min(input.daysPerWeek, split.sessions.length); d++) {
        const template = split.sessions[d % split.sessions.length];
        const exercises: PipelineExercise[] = [];

        let posInDay = 0;
        for (const slot of template.slots) {
          const patternInfo = PATTERN_EXERCISES[slot.pattern];
          if (!patternInfo) continue;
          posInDay++;

          // Skip if pattern is blacklisted
          if (constraints.blacklistedPatterns.includes(slot.pattern)) continue;

          // Determine progression type
          const progType = recommendProgression(input.goal, input.level);
          const base1RM = input.estimated1RMs[slot.pattern] || 100;

          // Volume/intensity from phase params
          const intensityMult = isDeload ? 0.6 : params.intensityLevel === 'high' ? 0.85
            : params.intensityLevel === 'medium' ? 0.75 : 0.65;
          const volumeMult = isDeload ? 0.5 : params.volumeLevel === 'high' ? 1.3
            : params.volumeLevel === 'medium' ? 1.0 : 0.7;

          // Apply progression to get weight
          const progState: ProgressionInput = {
            type: progType,
            currentWeight: Math.round(base1RM * intensityMult * 0.5) * 2,
            currentReps: slot.role === 'main' ? 5 : 8,
            currentSets: Math.round((slot.role === 'main' ? 4 : 3) * volumeMult),
            weekInCycle: w,
            sessionCount: d,
            lastRPE: 7,
            targetReps: slot.role === 'main' ? 3 : 8,
            targetSets: Math.round((slot.role === 'main' ? 4 : 3) * volumeMult),
            targetRPE: isDeload ? 6 : 7.5,
            estimated1RM: base1RM,
            increment: input.level === 'beginner' ? 2.5 : 1.25,
            repsMin: 1,
            repsMax: slot.role === 'main' ? 6 : 15,
            rpeThreshold: 8.5,
            fatigueLevel: input.fatigue / 10,
            priScore: input.recovery / 10,
          };

          const prog = applyProgression(progState);

          // Cap sets
          const cappedSets = Math.max(1, Math.min(constraints.maxSetsPerExercise, prog.nextSets));

          // Scheme
          const schemeInput: SetSchemeInput = {
            goal: input.goal,
            difficultyLevel: patternInfo.complexity >= 3 ? 'high' : 'medium',
            riskLevel: constraints.blacklistedPatterns.length > 0 ? 'medium' : 'low',
            fatigueLevel: input.fatigue / 10,
            estimated1RM: base1RM,
            baseSets: cappedSets,
            baseReps: prog.nextReps,
            baseIntensity: intensityMult,
          };
          const scheme = generateSetScheme(schemeInput);

          // Tempo
          const tempoInput: RepTempoInput = {
            goal: input.goal,
            riskLevel: constraints.blacklistedPatterns.length > 0 ? 'medium' : 'low',
            difficultyLevel: patternInfo.complexity >= 3 ? 'high' : 'medium',
            techniqueIssues: [],
            isMainLift: slot.role === 'main',
          };
          const repTempo = generateRepTempo(tempoInput);

          exercises.push({
            name: patternInfo.name,
            pattern: slot.pattern,
            role: slot.role,
            sets: cappedSets,
            reps: prog.nextReps,
            weight: prog.nextWeight,
            rpe: repTempo.targetRPE,
            rir: repTempo.targetRIR,
            tempo: repTempo.tempo.toString,
            restSeconds: scheme.sets[0]?.restSeconds || 120,
            scheme: scheme.schemeType,
            progressionType: progType,
            notes: prog.explanation,
          });
        }

        // Session difficulty
        const sessionInput: any = {
          exercises: exercises.map(e => ({
            name: e.name,
            sets: e.sets,
            reps: e.reps,
            intensity: e.rpe / 10,
            technicalComplexity: PATTERN_EXERCISES[e.pattern]?.complexity || 1,
            cnsDemand: PATTERN_EXERCISES[e.pattern]?.cnsDemand || 1,
            jointStress: PATTERN_EXERCISES[e.pattern]?.jointStress || { knee: 0, hip: 0, spine: 0, shoulder: 0, elbow: 0, ankle: 0 } as any,
            pattern: e.pattern,
            primaryMuscles: [],
            secondaryMuscles: [],
          })),
          estimatedDurationMin: 60,
          previousFatigue: input.fatigue / 10,
          priScore: input.recovery / 10,
          riskLevel: 'low',
        };
        const difficulty = estimateSessionDifficulty(sessionInput as any);

        // Warmup
        const warmupInput: WarmupInput = {
          exerciseId: '',
          exerciseName: exercises[0]?.name || 'Squat',
          estimated1RM: exercises[0]?.weight ? exercises[0].weight * 1.2 : 100,
          sessionFocus: template.focus,
          riskSnapshot: {},
          techniqueIssues: [],
          fatigueLevel: input.fatigue / 10,
          equipmentAvailable: input.equipmentAvailable,
        };
        const warmup = exercises.length > 0 ? generateWarmup(warmupInput) : undefined;

        // Cooldown
        const cooldownInput: CooldownInput = {
          muscleGroupsUsed: exercises.map(e => e.pattern),
          fatigueScore: input.fatigue / 10,
          sessionDifficulty: difficulty.totalScore,
          riskSnapshot: {},
          sessionDurationMin: 60,
        };
        const cooldown = generateCooldown(cooldownInput);

        days.push({
          dayIndex: d + 1,
          focus: template.focus,
          difficulty: difficulty.level,
          exercises,
          warmup,
          cooldown,
        });
      }

      weeks.push({
        weekIndex: w,
        phase: phase.phase,
        volumeMultiplier: isDeload ? 0.5 : params.volumeLevel === 'high' ? 1.3 : params.volumeLevel === 'medium' ? 1.0 : 0.7,
        intensityMultiplier: isDeload ? 0.6 : params.intensityLevel === 'high' ? 0.85 : params.intensityLevel === 'medium' ? 0.75 : 0.65,
        days,
        fatigueTarget: params.fatigueCeiling,
      });
    }
  }

  return {
    planName: split.name,
    description: split.description,
    totalWeeks: weeks.length,
    weeks,
    constraints,
    recommendations: recs,
    deloadWeeks,
  };
}
