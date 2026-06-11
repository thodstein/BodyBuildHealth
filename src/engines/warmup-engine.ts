/**
 * Warmup Engine — Auto-generates pre-workout warmup protocol.
 *
 * Generates warmup blocks based on:
 *  - Exercise of the day (1RM → %-based ramp sets)
 *  - Session focus (squat/bench/deadlift/upper/lower)
 *  - Risk snapshot (joint risk → activation exercises)
 *  - Technique issues (corrective drills)
 *  - Fatigue level (reduce volume if fatigued)
 *
 * Warmup structure:
 *  1. General: light cardio (5 min)
 *  2. Mobility: joint prep
 *  3. Activation: muscle activation
 *  4. Specific: ramp-up sets (20%→40%→60%→75% of 1RM)
 *
 * @module warmup-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface WarmupInput {
  exerciseId: string;
  exerciseName: string;
  estimated1RM: number;
  sessionFocus: 'squat' | 'bench' | 'deadlift' | 'upper' | 'lower' | 'fullbody' | string;
  riskSnapshot: {
    knee?: 'low' | 'medium' | 'high';
    shoulder?: 'low' | 'medium' | 'high';
    lower_back?: 'low' | 'medium' | 'high';
    hip?: 'low' | 'medium' | 'high';
    [key: string]: string | undefined;
  };
  techniqueIssues: string[];
  fatigueLevel: number; // 0-1
  equipmentAvailable: string[];
}

export interface WarmupExercise {
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
  weightPercent: number;
  restSeconds: number;
  notes: string;
}

export interface WarmupBlock {
  type: 'general' | 'mobility' | 'activation' | 'specific';
  durationSeconds: number;
  exercises: WarmupExercise[];
  description: string;
}

export interface WarmupOutput {
  totalDurationMin: number;
  blocks: WarmupBlock[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Activation exercises per focus
// ═══════════════════════════════════════════════════════════════════════════

const ACTIVATION_EXERCISES: Record<string, WarmupExercise[]> = {
  squat: [
    { name: 'Glute Bridge', sets: 1, reps: 15, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Активация ягодиц' },
    { name: 'Bodyweight Squat', sets: 1, reps: 10, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Полная амплитуда' },
    { name: 'Hip Airplane', sets: 1, reps: 8, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Стабильность бедра' },
  ],
  bench: [
    { name: 'Band Pull-Apart', sets: 1, reps: 15, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Активация задних дельт' },
    { name: 'Scapular Push-Up', sets: 1, reps: 10, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Стабильность лопаток' },
    { name: 'External Rotation (band)', sets: 1, reps: 12, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Ротаторная манжета' },
  ],
  deadlift: [
    { name: 'Cat-Cow', sets: 1, reps: 10, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Мобильность позвоночника' },
    { name: 'Bird Dog', sets: 1, reps: 8, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Стабильность кора' },
    { name: 'Romanian Deadlift (empty bar)', sets: 1, reps: 10, weightKg: 20, weightPercent: 0, restSeconds: 30, notes: 'Паттерн тяги' },
  ],
  upper: [
    { name: 'Arm Circles', sets: 1, reps: 10, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Разогрев плеч' },
    { name: 'Band Pull-Apart', sets: 1, reps: 15, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Верх спины' },
    { name: 'Push-Up (slow)', sets: 1, reps: 10, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Активация груди/трицепсов' },
  ],
  lower: [
    { name: 'Leg Swing (forward)', sets: 1, reps: 12, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Динамическая растяжка' },
    { name: 'Bodyweight Squat', sets: 1, reps: 10, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Полная амплитуда' },
    { name: 'Cossack Squat', sets: 1, reps: 8, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Мобильность бёдер' },
    { name: 'Single-Leg RDL', sets: 1, reps: 8, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Баланс + задняя цепь' },
  ],
  fullbody: [
    { name: 'Jumping Jacks', sets: 1, reps: 20, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Общий разогрев' },
    { name: 'Bodyweight Squat', sets: 1, reps: 12, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Нижняя часть' },
    { name: 'Push-Up', sets: 1, reps: 10, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Верхняя часть' },
    { name: 'Cat-Cow', sets: 1, reps: 10, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Мобильность' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Corrective exercises per technique issue
// ═══════════════════════════════════════════════════════════════════════════

const TECHNIQUE_CORRECTIONS: Record<string, WarmupExercise[]> = {
  knee_valgus: [
    { name: 'Banded Squat (light)', sets: 1, reps: 12, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Колени наружу' },
    { name: 'Copenhagen Plank', sets: 1, reps: 15, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Аддукторы' },
  ],
  butt_wink: [
    { name: 'Goblet Squat (pause)', sets: 1, reps: 8, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Контроль таза' },
    { name: 'Cat-Cow', sets: 1, reps: 12, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Мобильность поясницы' },
  ],
  rounding_back: [
    { name: 'Dead Bug', sets: 1, reps: 8, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Брейсинг кора' },
    { name: 'Banded Good Morning', sets: 1, reps: 12, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Позиция спины' },
  ],
  forward_lean: [
    { name: 'Front Squat (empty bar)', sets: 1, reps: 8, weightKg: 20, weightPercent: 0, restSeconds: 30, notes: 'Вертикальный торс' },
    { name: 'Ankle Mobility Drill', sets: 1, reps: 10, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Дорсифлексия' },
  ],
  soft_lockout: [
    { name: 'Triceps Pushdown (light)', sets: 1, reps: 15, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Локтевой финиш' },
    { name: 'Close-Grip Push-Up', sets: 1, reps: 8, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Трицепс-доминант' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Risk-specific activation
// ═══════════════════════════════════════════════════════════════════════════

const RISK_ACTIVATIONS: Record<string, WarmupExercise[]> = {
  knee_high: [
    { name: 'Terminal Knee Extension (band)', sets: 1, reps: 15, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'VMO активация' },
    { name: 'Glute Bridge (hold 3s)', sets: 1, reps: 10, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Ягодицы перед нагрузкой' },
  ],
  shoulder_high: [
    { name: 'External Rotation (light band)', sets: 1, reps: 15, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Защита ротаторов' },
    { name: 'Wall Slide', sets: 1, reps: 10, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Мобильность плеч' },
  ],
  lower_back_high: [
    { name: 'Dead Bug (slow)', sets: 1, reps: 10, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Брейсинг кора' },
    { name: 'McGill Curl-Up', sets: 1, reps: 8, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Стабильность поясницы' },
  ],
  hip_high: [
    { name: 'Hip Airplane (slow)', sets: 1, reps: 8, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Контроль бедра' },
    { name: '90/90 Stretch', sets: 1, reps: 5, weightKg: 0, weightPercent: 0, restSeconds: 45, notes: 'Мобильность тазобедренного' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Mobility exercises (always included)
// ═══════════════════════════════════════════════════════════════════════════

const MOBILITY_EXERCISES: WarmupExercise[] = [
  { name: 'World\'s Greatest Stretch', sets: 1, reps: 5, weightKg: 0, weightPercent: 0, restSeconds: 30, notes: 'Т-позвоночник + бедро' },
  { name: 'Hip Circles', sets: 1, reps: 8, weightKg: 0, weightPercent: 0, restSeconds: 20, notes: 'Мобильность бёдер' },
  { name: 'Shoulder Dislocates (band/pvc)', sets: 1, reps: 10, weightKg: 0, weightPercent: 0, restSeconds: 20, notes: 'Плечевой пояс' },
  { name: 'Ankle Rolls', sets: 1, reps: 10, weightKg: 0, weightPercent: 0, restSeconds: 15, notes: 'Голеностоп' },
];

// ═══════════════════════════════════════════════════════════════════════════
// Core Engine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a complete warmup protocol for the given exercise and context.
 *
 * @param input - Warmup parameters (exercise, 1RM, focus, risk, technique, fatigue).
 * @returns WarmupOutput with blocks, exercises, and total duration.
 */
export function generateWarmup(input: WarmupInput): WarmupOutput {
  const blocks: WarmupBlock[] = [];
  const fatigueMultiplier = Math.max(0.5, 1.0 - input.fatigueLevel * 0.5);

  // ── Block 1: General (light cardio) ──
  const generalDuration = Math.round(300 * fatigueMultiplier);
  blocks.push({
    type: 'general',
    durationSeconds: generalDuration,
    description: 'Общий разогрев: лёгкое кардио для повышения ЧСС и температуры тела',
    exercises: [
      {
        name: 'Велотренажёр / Беговая дорожка / Скакалка',
        sets: 1,
        reps: 0,
        weightKg: 0,
        weightPercent: 0,
        restSeconds: 0,
        notes: `Легкий темп, RPE 3-4, ${Math.round(generalDuration / 60)} мин`,
      },
    ],
  });

  // ── Block 2: Mobility ──
  const mobilityExercises = [...MOBILITY_EXERCISES];
  const mobilityDuration = Math.round(mobilityExercises.reduce((s, e) => s + e.restSeconds, 0));
  blocks.push({
    type: 'mobility',
    durationSeconds: mobilityDuration,
    description: 'Суставная разминка: мобильность позвоночника, бёдер, плеч',
    exercises: mobilityExercises,
  });

  // ── Block 3: Activation ──
  const activationExercises: WarmupExercise[] = [];

  // Focus-specific activation
  const focusKey = input.sessionFocus || 'fullbody';
  const focusActivation = ACTIVATION_EXERCISES[focusKey] || ACTIVATION_EXERCISES.fullbody;
  activationExercises.push(...focusActivation);

  // Risk-specific activation
  if (input.riskSnapshot.knee === 'high') {
    activationExercises.push(...(RISK_ACTIVATIONS.knee_high || []));
  }
  if (input.riskSnapshot.shoulder === 'high') {
    activationExercises.push(...(RISK_ACTIVATIONS.shoulder_high || []));
  }
  if (input.riskSnapshot.lower_back === 'high') {
    activationExercises.push(...(RISK_ACTIVATIONS.lower_back_high || []));
  }
  if (input.riskSnapshot.hip === 'high') {
    activationExercises.push(...(RISK_ACTIVATIONS.hip_high || []));
  }

  // Technique corrections
  for (const issue of input.techniqueIssues) {
    const corrections = TECHNIQUE_CORRECTIONS[issue];
    if (corrections) {
      activationExercises.push(...corrections);
    }
  }

  const activationDuration = Math.round(
    activationExercises.reduce((s, e) => s + e.restSeconds, 0) * fatigueMultiplier
  );

  blocks.push({
    type: 'activation',
    durationSeconds: activationDuration,
    description: 'Активация мышц и коррекция техники',
    exercises: activationExercises,
  });

  // ── Block 4: Specific (ramp-up sets) ──
  const specificExercises: WarmupExercise[] = [];
  const ramps = [
    { percent: 0.20, reps: 10, rest: 60 },
    { percent: 0.40, reps: 5, rest: 60 },
    { percent: 0.60, reps: 3, rest: 90 },
    { percent: 0.75, reps: 1, rest: 120 },
  ];

  for (const ramp of ramps) {
    const reps = Math.round(ramp.reps * fatigueMultiplier);
    if (reps < 1) continue;
    specificExercises.push({
      name: input.exerciseName,
      sets: 1,
      reps,
      weightKg: Math.round(input.estimated1RM * ramp.percent * 2.5) * 0.4,
      weightPercent: Math.round(ramp.percent * 100),
      restSeconds: Math.round(ramp.rest * fatigueMultiplier),
      notes: `Разминочный подход — ${Math.round(ramp.percent * 100)}% 1RM`,
    });
  }

  const specificDuration = Math.round(specificExercises.reduce((s, e) => s + e.restSeconds, 0));

  blocks.push({
    type: 'specific',
    durationSeconds: specificDuration,
    description: 'Специфическая разминка: ramp-up подходы к рабочему весу',
    exercises: specificExercises,
  });

  // ── Total ──
  const totalSeconds = blocks.reduce((s, b) => s + (b.type === 'general' ? b.durationSeconds : b.durationSeconds), 0);
  const totalMin = Math.round(totalSeconds / 60);

  return { totalDurationMin: totalMin, blocks };
}
