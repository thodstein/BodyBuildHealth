/**
 * bb-loading-layer.engine.ts — D3: loading layer для BB-auto.
 *
 * Разделяет ответственность:
 *  - Selection layer (bb-exercise-selection.engine.ts): КАКИЕ упражнения выбрать
 *  - Loading layer (этот файл): КАК их нагрузить (sets/reps/RIR/tempo/rest/weight)
 *
 * Раньше buildSession (1700+ строк) делал обе задачи одновременно.
 * Теперь loading можно тестировать независимо.
 *
 * Evidence base:
 *  - Schoenfeld 2021: RIR 0-3 optimal for hypertrophy
 *  - Roberts 2022: RIR 2-3 for hypertrophy, 1-2 for strength
 *  - ACSM 2023: eccentric 2-4s per phase
 *  - Bosquet 2005: taper volume -30-50%, intensity preserved
 *  - Helms 2022: RIR +2-3 for deload/taper
 */
import type { BBExercise, BBSet } from './bb-builder.engine';
import { weightForRepMax, defaultWorkMax, bbRir } from './bb-builder.engine';
import type { DayCharacter } from './bb-day-types';
import { tempoFor } from './bb-tempo-rest';
import { PHASE_CONFIGS, type BBPhase } from '../periodization';
import { PCT_FOR_RIR } from '../rir-table';
import type { BBTrainingFocus } from './bb-goal-types';

export interface LoadingInput {
  muscle: string;
  exerciseName: string;
  exerciseId?: string;
  role: 'primary' | 'accessory';
  character: DayCharacter;
  sets: number;
  phase: BBPhase;
  phaseWeek: number;
  week: number;
  workMax: number;
  trainingFocus?: BBTrainingFocus;
  eccentricMult?: number;
  isSubstituted?: boolean;
  isFemale?: boolean;
}

export interface LoadingOutput {
  sets: number;
  repsRange: [number, number];
  reps: number;
  rir: number;
  weight: number;
  tempoSpec: string;
  restSeconds: number;
  workSets: BBSet[];
  warmupSets?: { load: number; reps: number }[];
}

/**
 * Loading layer: назначает sets/reps/RIR/tempo/rest/weight для одного упражнения.
 *
 * Логика:
 *  1. RIR = bbRir(character, phase, phaseWeek, focus)
 *  2. Reps = PHASE_CONFIGS[phase].repRange - phaseRepShift
 *  3. Weight = weightForRepMax(reps, workMax, rir, intensityMult)
 *  4. Tempo = tempoFor(character, undefined, phase, exerciseName) — per-exercise override
 *  5. Rest = phaseCfg.restBase + restProgression (deload +30s, accumulation -15s/week)
 *  6. Warmup = buildWarmup(weight, isCompound) — graded pyramid
 */
export function computeLoading(input: LoadingInput): LoadingOutput {
  const phaseCfg = PHASE_CONFIGS[input.phase];
  const isAccessory = input.role === 'accessory';
  const [baseMin, baseMax] = phaseCfg.repRange;

  // Reps: accessory = +2/+5 (пампинг), primary = cfg.repRange
  const repMin = isAccessory ? baseMin + 2 : baseMin;
  const repMax = isAccessory ? baseMax + 5 : baseMax;

  // phaseRepShift: reps снижаются на 1 каждые 2 недели внутри фазы (B1)
  const repShift = input.phase === 'deload' ? 0 : Math.floor(input.phaseWeek / 2);
  const shiftedMin = Math.max(3, repMin - repShift);
  const shiftedMax = Math.max(shiftedMin + 2, repMax - repShift);
  const reps = Math.round((shiftedMin + shiftedMax) / 2);

  // RIR: bbRir (учитывает phase + phaseWeek + характер + focus)
  const rir = bbRir(input.character, input.phase, input.phaseWeek, input.trainingFocus);

  // Weight: Brzycki inverse %1RM formula (P1-4 audit)
  let weight = weightForRepMax(reps, input.workMax, rir, phaseCfg.intensityMultiplier);

  // Eccentric overload (Schoenfeld 2021)
  if (input.eccentricMult && input.eccentricMult > 1.0 && input.role === 'primary') {
    weight = Math.round(weight * input.eccentricMult * 10) / 10;
  }

  // Tempo: per-exercise override (B2) + phase default
  const tempoSpec = tempoFor(input.character, undefined, input.phase, input.exerciseName);
  const tempoStr = tempoSpec.notation;

  // Rest: phase base + progression (B1)
  // FIX: используем phaseWeek (не absolute week) — parity с bb-builder.
  const baseRest = phaseCfg.restBase;
  const restProgression = input.phase === 'deload' ? -30 : Math.max(0, (input.phaseWeek - 1) * 15);
  const restSeconds = input.phase === 'deload'
    ? Math.min(180, (isAccessory ? baseRest : baseRest + 30) - restProgression)
    : Math.max(60, (isAccessory ? Math.max(45, baseRest - 30) : baseRest) - restProgression);

  // Work sets: all same weight/reps/rir (DUP wave applied later in prescribeLoad)
  const workSets: BBSet[] = Array.from({ length: input.sets }, () => ({
    reps,
    rir,
    weight,
    tempo: tempoStr,
    restSeconds,
  }));

  // Warmup: graded pyramid for compounds (B5)
  let warmupSets: { load: number; reps: number }[] | undefined;
  if (input.role === 'primary') {
    warmupSets = buildGradedWarmup(weight);
  }

  return {
    sets: input.sets,
    repsRange: [shiftedMin, shiftedMax],
    reps,
    rir,
    weight,
    tempoSpec: tempoStr,
    restSeconds,
    workSets,
    warmupSets,
  };
}

/**
 * Graded warmup pyramid (B5):
 * bar×15 → 50%×10 → 70%×5 → 80%×3 → 90%×1 (for heavy weights)
 */
function buildGradedWarmup(workWeight: number): { load: number; reps: number }[] {
  if (workWeight <= 0) return [];
  const barWeight = 20;
  const warmups: { load: number; reps: number }[] = [];
  // Set 1: empty bar × 15
  if (workWeight > barWeight * 2) {
    warmups.push({ load: barWeight, reps: 15 });
  }
  // Set 2: 50% × 10
  warmups.push({ load: Math.round(workWeight * 0.5), reps: 10 });
  // Set 3: 70% × 5
  warmups.push({ load: Math.round(workWeight * 0.7), reps: 5 });
  // Set 4: 80% × 3 (only if workWeight > 60кг)
  if (workWeight > 60) {
    warmups.push({ load: Math.round(workWeight * 0.8), reps: 3 });
  }
  // Set 5: 90% × 1 (only for heavy > 100кг)
  if (workWeight > 100) {
    warmups.push({ load: Math.round(workWeight * 0.9), reps: 1 });
  }
  return warmups;
}
