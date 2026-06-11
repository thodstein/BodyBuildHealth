/**
 * Exercise Generator + Pattern + Variation + Substitution Engines
 *
 * Combined module covering:
 *  - Exercise Pattern Engine: which movement patterns are needed
 *  - Exercise Generator Engine: pick exercises for session slots
 *  - Exercise Variation Engine: select optimal variation
 *  - Exercise Substitution Engine: find safe alternatives
 *  - Equipment Substitution Engine: barbell → dumbbell → bodyweight
 *
 * @module exercise-generator-engines
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type MovementPattern = 'squat' | 'hinge' | 'horizontal_push' | 'horizontal_pull' | 'vertical_push' | 'vertical_pull' | 'lunge' | 'carry' | 'rotation' | 'anti_rotation' | 'accessory';

export interface ExerciseDef {
  id: string;
  name: string;
  pattern: MovementPattern;
  plane: 'sagittal' | 'frontal' | 'transverse';
  equipment: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  stabilizers: string[];
  difficulty: number; // 1-5
  jointStress: Record<string, number>;
  riskProfile: 'low' | 'medium' | 'high';
  isUnilateral: boolean;
  isCompetition: boolean;
  variations: string[];
  requiresSpotter: boolean;
  requiresRack: boolean;
  spineLoad: 'low' | 'medium' | 'high';
  kneeLoad: 'low' | 'medium' | 'high';
  shoulderLoad: 'low' | 'medium' | 'high';
  romType: 'full' | 'partial' | 'constrained';
  techniqueRequirements: Record<string, number>; // joint → min ROM deg
}

export interface ExerciseSlot {
  pattern: MovementPattern;
  role: 'main' | 'secondary' | 'accessory' | 'rehab' | 'warmup';
  priority: number;
}

export interface GeneratorInput {
  slots: ExerciseSlot[];
  goal: string;
  equipmentAvailable: string[];
  riskSnapshot: Record<string, string>;
  weakPoints: string[];
  techniqueIssues: string[];
  exerciseDB: ExerciseDef[];
}

export interface GeneratorOutput {
  selectedExercises: {
    slot: ExerciseSlot;
    exercise: ExerciseDef;
    variation: string;
    reason: string;
    safetyScore: number;
  }[];
  alternatives: Record<string, string[]>;
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Minimal Exercise Database (expandable)
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_EXERCISE_DB: ExerciseDef[] = [
  // ── Squat patterns ──
  { id: 'back_squat', name: 'Присед со штангой', pattern: 'squat', plane: 'sagittal', equipment: ['barbell','rack'], primaryMuscles: ['quads','glutes'], secondaryMuscles: ['hamstrings','core'], stabilizers: ['erectors','abdominals'], difficulty: 3, jointStress: { knee:7, hip:5, spine:5, shoulder:2, elbow:1, ankle:4 }, riskProfile: 'medium', isUnilateral: false, isCompetition: true, variations: ['pause_squat','tempo_squat','front_squat'], requiresSpotter: false, requiresRack: true, spineLoad: 'medium', kneeLoad: 'high', shoulderLoad: 'low', romType: 'full', techniqueRequirements: { knee:90, hip:90, ankle:30 } },
  { id: 'front_squat', name: 'Фронтальный присед', pattern: 'squat', plane: 'sagittal', equipment: ['barbell','rack'], primaryMuscles: ['quads','core'], secondaryMuscles: ['glutes','hamstrings'], stabilizers: ['erectors','abdominals'], difficulty: 4, jointStress: { knee:7, hip:4, spine:4, shoulder:3, elbow:2, ankle:4 }, riskProfile: 'medium', isUnilateral: false, isCompetition: false, variations: ['zombie_squat','goblet_squat'], requiresSpotter: false, requiresRack: true, spineLoad: 'medium', kneeLoad: 'high', shoulderLoad: 'low', romType: 'full', techniqueRequirements: { knee:90, hip:85, ankle:35 } },
  { id: 'goblet_squat', name: 'Кубковый присед', pattern: 'squat', plane: 'sagittal', equipment: ['dumbbell','kettlebell'], primaryMuscles: ['quads','glutes'], secondaryMuscles: ['core'], stabilizers: ['abdominals'], difficulty: 1, jointStress: { knee:5, hip:4, spine:3, shoulder:1, elbow:1, ankle:3 }, riskProfile: 'low', isUnilateral: false, isCompetition: false, variations: [], requiresSpotter: false, requiresRack: false, spineLoad: 'low', kneeLoad: 'medium', shoulderLoad: 'low', romType: 'full', techniqueRequirements: { knee:80, hip:80, ankle:25 } },
  { id: 'leg_press', name: 'Жим ногами', pattern: 'squat', plane: 'sagittal', equipment: ['leg_press_machine'], primaryMuscles: ['quads'], secondaryMuscles: ['glutes','hamstrings'], stabilizers: [], difficulty: 1, jointStress: { knee:6, hip:3, spine:1, shoulder:0, elbow:0, ankle:2 }, riskProfile: 'low', isUnilateral: false, isCompetition: false, variations: ['single_leg_press'], requiresSpotter: false, requiresRack: false, spineLoad: 'low', kneeLoad: 'medium', shoulderLoad: 'low', romType: 'constrained', techniqueRequirements: { knee:90, hip:70 } },

  // ── Hinge patterns ──
  { id: 'deadlift', name: 'Становая тяга', pattern: 'hinge', plane: 'sagittal', equipment: ['barbell'], primaryMuscles: ['hamstrings','glutes','back'], secondaryMuscles: ['traps','core'], stabilizers: ['erectors','abdominals'], difficulty: 4, jointStress: { knee:3, hip:7, spine:8, shoulder:2, elbow:2, ankle:2 }, riskProfile: 'high', isUnilateral: false, isCompetition: true, variations: ['sumo_deadlift','trap_bar_deadlift','deficit_deadlift'], requiresSpotter: false, requiresRack: false, spineLoad: 'high', kneeLoad: 'low', shoulderLoad: 'low', romType: 'full', techniqueRequirements: { hip:90, spine:0 } },
  { id: 'romanian_deadlift', name: 'Румынская тяга', pattern: 'hinge', plane: 'sagittal', equipment: ['barbell','dumbbell'], primaryMuscles: ['hamstrings','glutes'], secondaryMuscles: ['back'], stabilizers: ['erectors','abdominals'], difficulty: 2, jointStress: { knee:2, hip:6, spine:5, shoulder:1, elbow:1, ankle:1 }, riskProfile: 'medium', isUnilateral: false, isCompetition: false, variations: ['single_leg_rdl','kettlebell_swing'], requiresSpotter: false, requiresRack: false, spineLoad: 'medium', kneeLoad: 'low', shoulderLoad: 'low', romType: 'full', techniqueRequirements: { hip:90, spine:0 } },
  { id: 'hip_thrust', name: 'Ягодичный мост', pattern: 'hinge', plane: 'sagittal', equipment: ['barbell','bench'], primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings'], stabilizers: ['core'], difficulty: 1, jointStress: { knee:2, hip:4, spine:2, shoulder:1, elbow:1, ankle:1 }, riskProfile: 'low', isUnilateral: false, isCompetition: false, variations: ['single_leg_hip_thrust','banded_hip_thrust'], requiresSpotter: false, requiresRack: false, spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low', romType: 'full', techniqueRequirements: { hip:90 } },

  // ── Horizontal Push ──
  { id: 'bench_press', name: 'Жим лёжа', pattern: 'horizontal_push', plane: 'transverse', equipment: ['barbell','bench','rack'], primaryMuscles: ['chest','triceps'], secondaryMuscles: ['front_delts'], stabilizers: ['rotator_cuff','lats'], difficulty: 2, jointStress: { knee:0, hip:0, spine:2, shoulder:6, elbow:4, ankle:0 }, riskProfile: 'medium', isUnilateral: false, isCompetition: true, variations: ['close_grip','wide_grip','pause_bench','board_press'], requiresSpotter: true, requiresRack: true, spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'high', romType: 'full', techniqueRequirements: { shoulder:60, elbow:90 } },
  { id: 'dumbbell_bench', name: 'Жим гантелей', pattern: 'horizontal_push', plane: 'transverse', equipment: ['dumbbell','bench'], primaryMuscles: ['chest','triceps'], secondaryMuscles: ['front_delts'], stabilizers: ['rotator_cuff'], difficulty: 2, jointStress: { knee:0, hip:0, spine:1, shoulder:5, elbow:4, ankle:0 }, riskProfile: 'low', isUnilateral: false, isCompetition: false, variations: ['incline_dumbbell','decline_dumbbell'], requiresSpotter: false, requiresRack: false, spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium', romType: 'full', techniqueRequirements: { shoulder:60, elbow:90 } },
  { id: 'push_up', name: 'Отжимания', pattern: 'horizontal_push', plane: 'transverse', equipment: ['bodyweight'], primaryMuscles: ['chest','triceps'], secondaryMuscles: ['front_delts','core'], stabilizers: ['abdominals'], difficulty: 1, jointStress: { knee:0, hip:0, spine:1, shoulder:4, elbow:3, ankle:0 }, riskProfile: 'low', isUnilateral: false, isCompetition: false, variations: ['deficit_pushup','diamond_pushup','archer_pushup'], requiresSpotter: false, requiresRack: false, spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low', romType: 'full', techniqueRequirements: { shoulder:60, elbow:90 } },

  // ── Horizontal Pull ──
  { id: 'barbell_row', name: 'Тяга штанги в наклоне', pattern: 'horizontal_pull', plane: 'sagittal', equipment: ['barbell'], primaryMuscles: ['back','biceps'], secondaryMuscles: ['rear_delts','traps'], stabilizers: ['erectors','abdominals'], difficulty: 2, jointStress: { knee:1, hip:1, spine:5, shoulder:3, elbow:4, ankle:0 }, riskProfile: 'medium', isUnilateral: false, isCompetition: false, variations: ['pendlay_row','yates_row','dumbbell_row'], requiresSpotter: false, requiresRack: false, spineLoad: 'medium', kneeLoad: 'low', shoulderLoad: 'low', romType: 'full', techniqueRequirements: { spine:0, elbow:90 } },
  { id: 'seated_row', name: 'Тяга сидя', pattern: 'horizontal_pull', plane: 'sagittal', equipment: ['cable_machine'], primaryMuscles: ['back','biceps'], secondaryMuscles: ['rear_delts'], stabilizers: [], difficulty: 1, jointStress: { knee:0, hip:0, spine:3, shoulder:3, elbow:3, ankle:0 }, riskProfile: 'low', isUnilateral: false, isCompetition: false, variations: ['single_arm_row','rope_row'], requiresSpotter: false, requiresRack: false, spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low', romType: 'full', techniqueRequirements: { elbow:90 } },

  // ── Vertical Push ──
  { id: 'overhead_press', name: 'Жим над головой', pattern: 'vertical_push', plane: 'frontal', equipment: ['barbell'], primaryMuscles: ['shoulders','triceps'], secondaryMuscles: ['upper_chest','traps'], stabilizers: ['core','rotator_cuff'], difficulty: 3, jointStress: { knee:0, hip:0, spine:4, shoulder:8, elbow:5, ankle:0 }, riskProfile: 'medium', isUnilateral: false, isCompetition: false, variations: ['push_press','seated_press','arnold_press'], requiresSpotter: false, requiresRack: true, spineLoad: 'medium', kneeLoad: 'low', shoulderLoad: 'high', romType: 'full', techniqueRequirements: { shoulder:110, elbow:100 } },
  { id: 'lateral_raise', name: 'Махи гантелями', pattern: 'vertical_push', plane: 'frontal', equipment: ['dumbbell'], primaryMuscles: ['shoulders'], secondaryMuscles: ['traps'], stabilizers: [], difficulty: 1, jointStress: { knee:0, hip:0, spine:1, shoulder:5, elbow:2, ankle:0 }, riskProfile: 'low', isUnilateral: false, isCompetition: false, variations: ['cable_lateral','bent_over_lateral'], requiresSpotter: false, requiresRack: false, spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium', romType: 'full', techniqueRequirements: { shoulder:90 } },

  // ── Vertical Pull ──
  { id: 'pull_up', name: 'Подтягивания', pattern: 'vertical_pull', plane: 'frontal', equipment: ['pull_up_bar'], primaryMuscles: ['back','biceps'], secondaryMuscles: ['rear_delts','core'], stabilizers: ['abdominals'], difficulty: 3, jointStress: { knee:0, hip:0, spine:1, shoulder:5, elbow:4, ankle:0 }, riskProfile: 'low', isUnilateral: false, isCompetition: false, variations: ['chin_up','neutral_grip','weighted_pullup'], requiresSpotter: false, requiresRack: false, spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium', romType: 'full', techniqueRequirements: { shoulder:90, elbow:90 } },
  { id: 'lat_pulldown', name: 'Тяга верхнего блока', pattern: 'vertical_pull', plane: 'frontal', equipment: ['cable_machine'], primaryMuscles: ['back','biceps'], secondaryMuscles: ['rear_delts'], stabilizers: [], difficulty: 1, jointStress: { knee:0, hip:0, spine:1, shoulder:4, elbow:3, ankle:0 }, riskProfile: 'low', isUnilateral: false, isCompetition: false, variations: ['close_grip_pulldown','wide_grip_pulldown','straight_arm'], requiresSpotter: false, requiresRack: false, spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium', romType: 'full', techniqueRequirements: { shoulder:90, elbow:90 } },

  // ── Lunge ──
  { id: 'walking_lunge', name: 'Выпады', pattern: 'lunge', plane: 'sagittal', equipment: ['dumbbell','bodyweight'], primaryMuscles: ['quads','glutes'], secondaryMuscles: ['hamstrings','calves'], stabilizers: ['core'], difficulty: 2, jointStress: { knee:5, hip:4, spine:2, shoulder:1, elbow:1, ankle:3 }, riskProfile: 'low', isUnilateral: true, isCompetition: false, variations: ['reverse_lunge','bulgarian_split','lateral_lunge'], requiresSpotter: false, requiresRack: false, spineLoad: 'low', kneeLoad: 'medium', shoulderLoad: 'low', romType: 'full', techniqueRequirements: { knee:90, hip:90 } },

  // ── Accessories ──
  { id: 'bicep_curl', name: 'Сгибание рук', pattern: 'accessory', plane: 'sagittal', equipment: ['dumbbell','barbell','cable_machine'], primaryMuscles: ['biceps'], secondaryMuscles: [], stabilizers: [], difficulty: 1, jointStress: { knee:0, hip:0, spine:1, shoulder:1, elbow:3, ankle:0 }, riskProfile: 'low', isUnilateral: false, isCompetition: false, variations: ['hammer_curl','preacher_curl','incline_curl'], requiresSpotter: false, requiresRack: false, spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low', romType: 'full', techniqueRequirements: { elbow:100 } },
  { id: 'tricep_extension', name: 'Разгибание рук', pattern: 'accessory', plane: 'sagittal', equipment: ['dumbbell','cable_machine'], primaryMuscles: ['triceps'], secondaryMuscles: [], stabilizers: [], difficulty: 1, jointStress: { knee:0, hip:0, spine:1, shoulder:2, elbow:4, ankle:0 }, riskProfile: 'low', isUnilateral: false, isCompetition: false, variations: ['overhead_extension','skull_crusher','pushdown'], requiresSpotter: false, requiresRack: false, spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low', romType: 'full', techniqueRequirements: { elbow:100 } },
  { id: 'calf_raise', name: 'Подъём на носки', pattern: 'accessory', plane: 'sagittal', equipment: ['bodyweight','machine'], primaryMuscles: ['calves'], secondaryMuscles: [], stabilizers: [], difficulty: 1, jointStress: { knee:1, hip:0, spine:0, shoulder:0, elbow:0, ankle:5 }, riskProfile: 'low', isUnilateral: false, isCompetition: false, variations: ['single_leg_calf','seated_calf'], requiresSpotter: false, requiresRack: false, spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low', romType: 'full', techniqueRequirements: { ankle:40 } },
  { id: 'face_pull', name: 'Face Pull', pattern: 'accessory', plane: 'frontal', equipment: ['cable_machine','band'], primaryMuscles: ['rear_delts','rotator_cuff'], secondaryMuscles: ['traps'], stabilizers: [], difficulty: 1, jointStress: { knee:0, hip:0, spine:1, shoulder:3, elbow:2, ankle:0 }, riskProfile: 'low', isUnilateral: false, isCompetition: false, variations: ['band_pull_apart'], requiresSpotter: false, requiresRack: false, spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low', romType: 'full', techniqueRequirements: { shoulder:60, elbow:90 } },
  { id: 'plank', name: 'Планка', pattern: 'accessory', plane: 'sagittal', equipment: ['bodyweight'], primaryMuscles: ['core'], secondaryMuscles: ['shoulders','glutes'], stabilizers: [], difficulty: 1, jointStress: { knee:0, hip:1, spine:1, shoulder:2, elbow:1, ankle:0 }, riskProfile: 'low', isUnilateral: false, isCompetition: false, variations: ['side_plank','plank_reach'], requiresSpotter: false, requiresRack: false, spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low', romType: 'constrained', techniqueRequirements: {} },
];

// ═══════════════════════════════════════════════════════════════════════════
// Pattern requirements per focus type
// ═══════════════════════════════════════════════════════════════════════════

const FOCUS_PATTERNS: Record<string, MovementPattern[]> = {
  squat: ['squat', 'lunge', 'accessory'],
  bench: ['horizontal_push', 'horizontal_pull', 'accessory'],
  deadlift: ['hinge', 'horizontal_pull', 'carry'],
  upper: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'accessory'],
  lower: ['squat', 'hinge', 'lunge', 'accessory'],
  fullbody: ['squat', 'hinge', 'horizontal_push', 'horizontal_pull', 'accessory'],
  push: ['horizontal_push', 'vertical_push', 'accessory'],
  pull: ['horizontal_pull', 'vertical_pull', 'hinge', 'accessory'],
  legs: ['squat', 'hinge', 'lunge', 'accessory'],
  overhead: ['vertical_push', 'vertical_pull', 'carry'],
};

// ═══════════════════════════════════════════════════════════════════════════
// Variation selection by weak point
// ═══════════════════════════════════════════════════════════════════════════

const WEAK_POINT_VARIATIONS: Record<string, string[]> = {
  off_the_bottom: ['pause_squat', 'pin_squat', 'deficit_deadlift'],
  lockout: ['board_press', 'block_pull', 'rack_pull', 'floor_press'],
  mid_range: ['banded_squat', 'chain_bench', 'tempo_deadlift'],
  stability: ['safety_bar_squat', 'tempo_bench', 'single_leg_rdl'],
  quad_dominant: ['front_squat', 'leg_press', 'bulgarian_split'],
  hip_dominant: ['romanian_deadlift', 'hip_thrust', 'sumo_deadlift'],
  grip: ['fat_grip_deadlift', 'farmer_carry', 'towel_pullup'],
  core: ['dead_bug', 'pallof_press', 'ab_wheel'],
  knee_health: ['goblet_squat', 'leg_press', 'terminal_knee_extension'],
  shoulder_health: ['face_pull', 'external_rotation', 'ytwl_complex'],
  back_health: ['trap_bar_deadlift', 'bird_dog', 'back_extension'],
};

// ═══════════════════════════════════════════════════════════════════════════
// Equipment substitution chain
// ═══════════════════════════════════════════════════════════════════════════

const EQUIPMENT_SUBSTITUTIONS: Record<string, string> = {
  // Barbell → Dumbbell
  'back_squat_no_barbell': 'goblet_squat',
  'bench_press_no_barbell': 'dumbbell_bench',
  'deadlift_no_barbell': 'kettlebell_swing',
  'overhead_press_no_barbell': 'dumbbell_press',
  'barbell_row_no_barbell': 'dumbbell_row',
  'bicep_curl_no_barbell': 'dumbbell_curl',
  // No rack
  'back_squat_no_rack': 'goblet_squat',
  'bench_press_no_rack': 'push_up',
  'front_squat_no_rack': 'goblet_squat',
  // No cable machine
  'seated_row_no_machine': 'dumbbell_row',
  'lat_pulldown_no_machine': 'pull_up',
  'face_pull_no_machine': 'band_pull_apart',
  'tricep_pushdown_no_machine': 'tricep_kickback',
  // No pull-up bar
  'pull_up_no_bar': 'lat_pulldown',
  'lat_pulldown_no_bar': 'dumbbell_row',
  // No bench
  'bench_press_no_bench': 'floor_press',
  'dumbbell_bench_no_bench': 'floor_press',
  'hip_thrust_no_bench': 'glute_bridge',
  // No leg press
  'leg_press_no_machine': 'goblet_squat',
};

// ═══════════════════════════════════════════════════════════════════════════
// Core Engine
// ═══════════════════════════════════════════════════════════════════════════

export function getRequiredPatterns(focus: string): MovementPattern[] {
  return FOCUS_PATTERNS[focus] || FOCUS_PATTERNS.fullbody;
}

export function findExercise(
  pattern: MovementPattern,
  role: string,
  db: ExerciseDef[],
  filters: { equipment: string[]; maxRisk: string; excludeJoints: string[] },
): ExerciseDef | null {
  let candidates = db.filter(e => e.pattern === pattern);

  // Role filter
  if (role === 'main') candidates = candidates.filter(e => e.difficulty >= 2 && e.isCompetition);
  else if (role === 'secondary') candidates = candidates.filter(e => e.difficulty >= 1);
  else candidates = candidates.filter(e => e.difficulty <= 3);

  // Equipment filter
  candidates = candidates.filter(e =>
    e.equipment.length === 0 || e.equipment.some(eq => filters.equipment.includes(eq))
  );
  if (candidates.length === 0) {
    candidates = db.filter(e => e.pattern === pattern && e.equipment.includes('bodyweight'));
  }

  // Risk filter
  if (filters.maxRisk === 'low') {
    candidates = candidates.filter(e => e.riskProfile === 'low');
  } else if (filters.maxRisk === 'medium') {
    candidates = candidates.filter(e => e.riskProfile !== 'high');
  }

  // Joint exclusion
  for (const joint of filters.excludeJoints) {
    candidates = candidates.filter(e => (e.jointStress[joint] || 0) <= 4);
  }

  return candidates.length > 0 ? candidates[0] : null;
}

export function selectVariation(exercise: ExerciseDef, weakPoints: string[]): string {
  if (!exercise.variations.length) return exercise.name;

  for (const wp of weakPoints) {
    const wpVars = WEAK_POINT_VARIATIONS[wp] || [];
    const match = exercise.variations.find(v => wpVars.includes(v));
    if (match) return match;
  }

  return exercise.variations[0];
}

export function findSubstitute(exercise: ExerciseDef, missingEquipment: string): string | null {
  const key = `${exercise.id}_no_${missingEquipment}`;
  return EQUIPMENT_SUBSTITUTIONS[key] || null;
}

export function generateExercises(input: GeneratorInput): GeneratorOutput {
  const output: GeneratorOutput = { selectedExercises: [], alternatives: {}, warnings: [] };
  const excludeJoints = Object.entries(input.riskSnapshot)
    .filter(([, v]) => v === 'high')
    .map(([k]) => k);

  const maxRisk = input.riskSnapshot['overall'] === 'high' ? 'low'
    : Object.values(input.riskSnapshot).some(v => v === 'high') ? 'medium'
    : 'high';

  const db = input.exerciseDB.length > 0 ? input.exerciseDB : DEFAULT_EXERCISE_DB;
  const usedIds = new Set<string>();

  for (const slot of input.slots) {
    const ex = findExercise(slot.pattern, slot.role, db, {
      equipment: input.equipmentAvailable,
      maxRisk,
      excludeJoints,
    });

    if (!ex) {
      output.warnings.push(`Не найдено упражнение для паттерна ${slot.pattern} (${slot.role})`);
      continue;
    }

    // Avoid duplicates for same pattern
    if (usedIds.has(ex.id)) continue;
    usedIds.add(ex.id);

    const variation = selectVariation(ex, input.weakPoints);
    const safetyScore = ex.riskProfile === 'low' ? 90 : ex.riskProfile === 'medium' ? 70 : 50;

    // Check equipment and find alternatives
    const missing = ex.equipment.filter(eq => !input.equipmentAvailable.includes(eq));
    if (missing.length > 0) {
      const sub = findSubstitute(ex, missing[0]);
      if (sub) {
        output.alternatives[ex.id] = [sub];
        output.warnings.push(`${ex.name}: нет ${missing[0]}, альтернатива — ${sub}`);
      }
    }

    let reason = `${slot.role === 'main' ? 'Основное' : slot.role === 'secondary' ? 'Второстепенное' : 'Аксессуар'} — ${ex.name}`;
    if (variation !== ex.name) reason += ` (вариация: ${variation})`;

    output.selectedExercises.push({ slot, exercise: ex, variation, reason: reason, safetyScore });
  }

  return output;
}
