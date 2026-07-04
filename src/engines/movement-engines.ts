/**
 * Movement Classification + Difficulty + Muscle Synergy + Joint Stress Engines
 *
 * Movement Classification: categorize exercises by pattern, plane, load type, complexity
 * Movement Difficulty Engine: rate exercise technical/coordination/CNS/joint demands
 * Muscle Synergy Engine: primary, secondary, stabilizers, synergists, antagonists
 * Joint Stress Pattern: per-joint torque profiles, stress levels
 * Exercise Safety Engine: overall safety score with rationale
 *
 * @module movement-engines
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type PlaneType = 'sagittal' | 'frontal' | 'transverse' | 'multi';
export type LoadType = 'axial' | 'horizontal' | 'vertical' | 'rotational' | 'anterior' | 'posterior';
export type ComplexityLevel = 'low' | 'medium' | 'high';

export interface MovementClassification {
  pattern: string;
  plane: PlaneType;
  loadType: LoadType;
  complexity: ComplexityLevel;
  primaryJoints: string[];
  groundingPattern: 'bilateral' | 'unilateral' | 'seated' | 'prone' | 'supine' | 'standing';
}

export interface DifficultyProfile {
  technicalComplexity: number;   // 1-5
  coordinationDemand: number;    // 1-5
  cnsDemand: number;             // 1-5
  jointStressTotal: number;      // 0-100
  mobilityReq: number;           // 1-5
  stabilityReq: number;          // 1-5
  overallDifficulty: ComplexityLevel;
}

export interface MuscleSynergy {
  primary: string[];
  secondary: string[];
  stabilizers: string[];
  synergists: string[];
  antagonists: string[];
}

export interface JointStressProfile {
  knee: { torque: number; shear: number; compression: number; level: ComplexityLevel };
  hip: { torque: number; shear: number; compression: number; level: ComplexityLevel };
  spine: { torque: number; shear: number; compression: number; level: ComplexityLevel };
  shoulder: { torque: number; impingement: number; instability: number; level: ComplexityLevel };
  elbow: { torque: number; shear: number; level: ComplexityLevel };
  ankle: { torque: number; inversion: number; level: ComplexityLevel };
}

export interface SafetyAssessment {
  score: number;           // 0-100
  level: 'safe' | 'moderate' | 'risky';
  contraindications: string[];
  precautions: string[];
  requiresSpotter: boolean;
  highRiskPopulation: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Movement classification database
// ═══════════════════════════════════════════════════════════════════════════

const MOVEMENT_CLASS_DB: Record<string, MovementClassification> = {
  back_squat: { pattern: 'squat', plane: 'sagittal', loadType: 'axial', complexity: 'high', primaryJoints: ['knee','hip','ankle','spine'], groundingPattern: 'bilateral' },
  front_squat: { pattern: 'squat', plane: 'sagittal', loadType: 'axial', complexity: 'high', primaryJoints: ['knee','hip','ankle','spine','shoulder'], groundingPattern: 'bilateral' },
  goblet_squat: { pattern: 'squat', plane: 'sagittal', loadType: 'anterior', complexity: 'low', primaryJoints: ['knee','hip','ankle'], groundingPattern: 'bilateral' },
  leg_press: { pattern: 'squat', plane: 'sagittal', loadType: 'axial', complexity: 'low', primaryJoints: ['knee','hip'], groundingPattern: 'seated' },
  deadlift: { pattern: 'hinge', plane: 'sagittal', loadType: 'axial', complexity: 'high', primaryJoints: ['hip','spine','knee'], groundingPattern: 'bilateral' },
  romanian_deadlift: { pattern: 'hinge', plane: 'sagittal', loadType: 'posterior', complexity: 'medium', primaryJoints: ['hip','spine'], groundingPattern: 'bilateral' },
  hip_thrust: { pattern: 'hinge', plane: 'sagittal', loadType: 'posterior', complexity: 'low', primaryJoints: ['hip'], groundingPattern: 'supine' },
  bench_press: { pattern: 'horizontal_push', plane: 'transverse', loadType: 'horizontal', complexity: 'medium', primaryJoints: ['shoulder','elbow'], groundingPattern: 'supine' },
  dumbbell_bench: { pattern: 'horizontal_push', plane: 'transverse', loadType: 'horizontal', complexity: 'medium', primaryJoints: ['shoulder','elbow'], groundingPattern: 'supine' },
  push_up: { pattern: 'horizontal_push', plane: 'transverse', loadType: 'horizontal', complexity: 'low', primaryJoints: ['shoulder','elbow'], groundingPattern: 'prone' },
  barbell_row: { pattern: 'horizontal_pull', plane: 'sagittal', loadType: 'posterior', complexity: 'medium', primaryJoints: ['shoulder','elbow','spine'], groundingPattern: 'standing' },
  seated_row: { pattern: 'horizontal_pull', plane: 'sagittal', loadType: 'posterior', complexity: 'low', primaryJoints: ['shoulder','elbow'], groundingPattern: 'seated' },
  overhead_press: { pattern: 'vertical_push', plane: 'frontal', loadType: 'vertical', complexity: 'medium', primaryJoints: ['shoulder','elbow','spine'], groundingPattern: 'standing' },
  lateral_raise: { pattern: 'vertical_push', plane: 'frontal', loadType: 'vertical', complexity: 'low', primaryJoints: ['shoulder'], groundingPattern: 'standing' },
  pull_up: { pattern: 'vertical_pull', plane: 'frontal', loadType: 'vertical', complexity: 'medium', primaryJoints: ['shoulder','elbow'], groundingPattern: 'standing' },
  lat_pulldown: { pattern: 'vertical_pull', plane: 'frontal', loadType: 'vertical', complexity: 'low', primaryJoints: ['shoulder','elbow'], groundingPattern: 'seated' },
  walking_lunge: { pattern: 'lunge', plane: 'sagittal', loadType: 'axial', complexity: 'medium', primaryJoints: ['knee','hip','ankle'], groundingPattern: 'unilateral' },
  bicep_curl: { pattern: 'accessory', plane: 'sagittal', loadType: 'anterior', complexity: 'low', primaryJoints: ['elbow'], groundingPattern: 'standing' },
  tricep_extension: { pattern: 'accessory', plane: 'sagittal', loadType: 'anterior', complexity: 'low', primaryJoints: ['elbow'], groundingPattern: 'standing' },
  face_pull: { pattern: 'accessory', plane: 'frontal', loadType: 'posterior', complexity: 'low', primaryJoints: ['shoulder'], groundingPattern: 'standing' },

  // ── Раcширенная классификация (30+ новых записей) ──
  incline_bench: { pattern: 'horizontal_push', plane: 'transverse', loadType: 'horizontal', complexity: 'medium', primaryJoints: ['shoulder','elbow'], groundingPattern: 'supine' },
  decline_bench: { pattern: 'horizontal_push', plane: 'transverse', loadType: 'horizontal', complexity: 'medium', primaryJoints: ['shoulder','elbow'], groundingPattern: 'supine' },
  dips_chest: { pattern: 'horizontal_push', plane: 'sagittal', loadType: 'horizontal', complexity: 'medium', primaryJoints: ['shoulder','elbow'], groundingPattern: 'standing' },
  dips_tricep: { pattern: 'horizontal_push', plane: 'sagittal', loadType: 'horizontal', complexity: 'medium', primaryJoints: ['shoulder','elbow'], groundingPattern: 'standing' },
  cable_fly: { pattern: 'horizontal_push', plane: 'transverse', loadType: 'horizontal', complexity: 'low', primaryJoints: ['shoulder'], groundingPattern: 'standing' },
  t_bar_row: { pattern: 'horizontal_pull', plane: 'sagittal', loadType: 'posterior', complexity: 'medium', primaryJoints: ['shoulder','elbow','spine'], groundingPattern: 'standing' },
  single_arm_row: { pattern: 'horizontal_pull', plane: 'sagittal', loadType: 'posterior', complexity: 'low', primaryJoints: ['shoulder','elbow'], groundingPattern: 'standing' },
  chin_up: { pattern: 'vertical_pull', plane: 'frontal', loadType: 'vertical', complexity: 'medium', primaryJoints: ['shoulder','elbow'], groundingPattern: 'standing' },
  pulldown_rev: { pattern: 'vertical_pull', plane: 'frontal', loadType: 'vertical', complexity: 'low', primaryJoints: ['shoulder','elbow'], groundingPattern: 'seated' },
  rack_pull: { pattern: 'hinge', plane: 'sagittal', loadType: 'axial', complexity: 'medium', primaryJoints: ['hip','spine'], groundingPattern: 'bilateral' },
  good_morning: { pattern: 'hinge', plane: 'sagittal', loadType: 'axial', complexity: 'medium', primaryJoints: ['hip','spine'], groundingPattern: 'bilateral' },
  cable_pull_through: { pattern: 'hinge', plane: 'sagittal', loadType: 'posterior', complexity: 'low', primaryJoints: ['hip'], groundingPattern: 'bilateral' },
  glute_bridge: { pattern: 'hinge', plane: 'sagittal', loadType: 'posterior', complexity: 'low', primaryJoints: ['hip'], groundingPattern: 'supine' },
  hack_squat: { pattern: 'squat', plane: 'sagittal', loadType: 'axial', complexity: 'low', primaryJoints: ['knee','hip'], groundingPattern: 'standing' },
  step_up: { pattern: 'lunge', plane: 'sagittal', loadType: 'axial', complexity: 'low', primaryJoints: ['knee','hip','ankle'], groundingPattern: 'unilateral' },
  sissy_squat: { pattern: 'squat', plane: 'sagittal', loadType: 'axial', complexity: 'medium', primaryJoints: ['knee'], groundingPattern: 'standing' },
  leg_extension: { pattern: 'accessory', plane: 'sagittal', loadType: 'anterior', complexity: 'low', primaryJoints: ['knee'], groundingPattern: 'seated' },
  leg_curl: { pattern: 'accessory', plane: 'sagittal', loadType: 'posterior', complexity: 'low', primaryJoints: ['knee'], groundingPattern: 'prone' },
  calf_raise: { pattern: 'accessory', plane: 'sagittal', loadType: 'axial', complexity: 'low', primaryJoints: ['ankle'], groundingPattern: 'standing' },
  arnold_press: { pattern: 'vertical_push', plane: 'frontal', loadType: 'vertical', complexity: 'medium', primaryJoints: ['shoulder','elbow'], groundingPattern: 'seated' },
  rear_delt_fly: { pattern: 'accessory', plane: 'transverse', loadType: 'posterior', complexity: 'low', primaryJoints: ['shoulder'], groundingPattern: 'standing' },
  upright_row: { pattern: 'vertical_push', plane: 'frontal', loadType: 'vertical', complexity: 'low', primaryJoints: ['shoulder','elbow'], groundingPattern: 'standing' },
  front_raise: { pattern: 'vertical_push', plane: 'sagittal', loadType: 'anterior', complexity: 'low', primaryJoints: ['shoulder'], groundingPattern: 'standing' },
  landmine_press: { pattern: 'vertical_push', plane: 'sagittal', loadType: 'vertical', complexity: 'low', primaryJoints: ['shoulder','elbow'], groundingPattern: 'standing' },
  hammer_curl: { pattern: 'accessory', plane: 'sagittal', loadType: 'anterior', complexity: 'low', primaryJoints: ['elbow'], groundingPattern: 'standing' },
  skullcrusher: { pattern: 'accessory', plane: 'sagittal', loadType: 'anterior', complexity: 'low', primaryJoints: ['elbow'], groundingPattern: 'supine' },
  preacher_curl: { pattern: 'accessory', plane: 'sagittal', loadType: 'anterior', complexity: 'low', primaryJoints: ['elbow'], groundingPattern: 'seated' },
  overhead_tricep_ext: { pattern: 'accessory', plane: 'sagittal', loadType: 'vertical', complexity: 'low', primaryJoints: ['elbow','shoulder'], groundingPattern: 'standing' },
  concentration_curl: { pattern: 'accessory', plane: 'sagittal', loadType: 'anterior', complexity: 'low', primaryJoints: ['elbow'], groundingPattern: 'seated' },
  reverse_curl: { pattern: 'accessory', plane: 'sagittal', loadType: 'anterior', complexity: 'low', primaryJoints: ['elbow'], groundingPattern: 'standing' },
  close_grip_bench: { pattern: 'horizontal_push', plane: 'transverse', loadType: 'horizontal', complexity: 'medium', primaryJoints: ['shoulder','elbow'], groundingPattern: 'supine' },
  hanging_leg_raise: { pattern: 'accessory', plane: 'sagittal', loadType: 'anterior', complexity: 'low', primaryJoints: ['hip'], groundingPattern: 'standing' },
  ab_wheel: { pattern: 'accessory', plane: 'sagittal', loadType: 'anterior', complexity: 'medium', primaryJoints: ['spine','shoulder'], groundingPattern: 'prone' },
  dead_bug: { pattern: 'accessory', plane: 'sagittal', loadType: 'anterior', complexity: 'low', primaryJoints: ['spine','hip'], groundingPattern: 'supine' },
  cable_crunch: { pattern: 'accessory', plane: 'sagittal', loadType: 'anterior', complexity: 'low', primaryJoints: ['spine'], groundingPattern: 'seated' },
  pallof_press: { pattern: 'accessory', plane: 'transverse', loadType: 'rotational', complexity: 'low', primaryJoints: ['spine','shoulder'], groundingPattern: 'standing' },
  russian_twist: { pattern: 'accessory', plane: 'transverse', loadType: 'rotational', complexity: 'low', primaryJoints: ['spine'], groundingPattern: 'seated' },
  shrug: { pattern: 'accessory', plane: 'sagittal', loadType: 'vertical', complexity: 'low', primaryJoints: ['shoulder'], groundingPattern: 'standing' },
  farmer_walk: { pattern: 'accessory', plane: 'sagittal', loadType: 'axial', complexity: 'low', primaryJoints: ['shoulder','spine','hip'], groundingPattern: 'bilateral' },
  kettlebell_swing: { pattern: 'hinge', plane: 'sagittal', loadType: 'posterior', complexity: 'medium', primaryJoints: ['hip','knee'], groundingPattern: 'bilateral' },
  sumo_deadlift: { pattern: 'hinge', plane: 'sagittal', loadType: 'axial', complexity: 'high', primaryJoints: ['hip','knee','spine'], groundingPattern: 'bilateral' },
  trap_bar_dl: { pattern: 'hinge', plane: 'sagittal', loadType: 'axial', complexity: 'medium', primaryJoints: ['hip','knee','spine'], groundingPattern: 'bilateral' },
  defecit_dl: { pattern: 'hinge', plane: 'sagittal', loadType: 'axial', complexity: 'high', primaryJoints: ['hip','knee','spine'], groundingPattern: 'bilateral' },
  bulgarian_split_squat: { pattern: 'lunge', plane: 'sagittal', loadType: 'axial', complexity: 'medium', primaryJoints: ['knee','hip','ankle'], groundingPattern: 'unilateral' },
};

// ═══════════════════════════════════════════════════════════════════════════
// Muscle synergy database
// ═══════════════════════════════════════════════════════════════════════════

const MUSCLE_SYNERGY_DB: Record<string, MuscleSynergy> = {
  back_squat: {
    primary: ['quadriceps', 'gluteus_maximus'],
    secondary: ['hamstrings', 'adductors'],
    stabilizers: ['erector_spinae', 'rectus_abdominis', 'obliques'],
    synergists: ['soleus', 'gastrocnemius'],
    antagonists: ['iliopsoas', 'rectus_femoris'],
  },
  deadlift: {
    primary: ['hamstrings', 'gluteus_maximus', 'erector_spinae'],
    secondary: ['trapezius', 'latissimus', 'quadriceps'],
    stabilizers: ['rectus_abdominis', 'obliques', 'transversus_abdominis'],
    synergists: ['rhomboids', 'rear_deltoids', 'forearm_flexors'],
    antagonists: ['rectus_abdominis', 'iliopsoas'],
  },
  bench_press: {
    primary: ['pectoralis_major', 'triceps_brachii'],
    secondary: ['anterior_deltoid', 'serratus_anterior'],
    stabilizers: ['rotator_cuff', 'latissimus', 'rhomboids'],
    synergists: ['coracobrachialis', 'pectoralis_minor'],
    antagonists: ['posterior_deltoid', 'mid_trapezius', 'biceps_brachii'],
  },
  overhead_press: {
    primary: ['deltoids', 'triceps_brachii'],
    secondary: ['upper_trapezius', 'serratus_anterior', 'upper_pectoralis'],
    stabilizers: ['rotator_cuff', 'erector_spinae', 'rectus_abdominis'],
    synergists: ['supraspinatus', 'infraspinatus'],
    antagonists: ['latissimus', 'pectoralis_major', 'biceps_brachii'],
  },
  pull_up: {
    primary: ['latissimus_dorsi', 'biceps_brachii'],
    secondary: ['rhomboids', 'lower_trapezius', 'brachialis'],
    stabilizers: ['rectus_abdominis', 'obliques'],
    synergists: ['teres_major', 'posterior_deltoid', 'forearm_flexors'],
    antagonists: ['anterior_deltoid', 'pectoralis_major', 'triceps_brachii'],
  },
  barbell_row: {
    primary: ['latissimus_dorsi', 'rhomboids', 'mid_trapezius'],
    secondary: ['biceps_brachii', 'brachialis', 'posterior_deltoid'],
    stabilizers: ['erector_spinae', 'rectus_abdominis', 'hamstrings'],
    synergists: ['teres_major', 'infraspinatus'],
    antagonists: ['pectoralis_major', 'anterior_deltoid'],
  },
  // ── Расширенная мышечная синергия (15+ новых) ──
  incline_bench: {
    primary: ['upper_pectoralis', 'anterior_deltoid'],
    secondary: ['triceps_brachii', 'pectoralis_major'],
    stabilizers: ['rotator_cuff', 'serratus_anterior'],
    synergists: ['coracobrachialis'],
    antagonists: ['posterior_deltoid', 'latissimus_dorsi'],
  },
  dips_chest: {
    primary: ['lower_pectoralis', 'triceps_brachii'],
    secondary: ['anterior_deltoid'],
    stabilizers: ['rotator_cuff', 'rhomboids'],
    synergists: ['pectoralis_major', 'latissimus_dorsi'],
    antagonists: ['posterior_deltoid', 'biceps_brachii'],
  },
  chin_up: {
    primary: ['latissimus_dorsi', 'biceps_brachii'],
    secondary: ['rhomboids', 'lower_trapezius', 'brachialis'],
    stabilizers: ['rectus_abdominis', 'obliques'],
    synergists: ['teres_major', 'brachioradialis'],
    antagonists: ['anterior_deltoid', 'triceps_brachii'],
  },
  t_bar_row: {
    primary: ['latissimus_dorsi', 'mid_trapezius', 'rhomboids'],
    secondary: ['biceps_brachii', 'posterior_deltoid'],
    stabilizers: ['erector_spinae', 'rectus_abdominis', 'hamstrings'],
    synergists: ['teres_major'],
    antagonists: ['pectoralis_major'],
  },
  seated_row: {
    primary: ['latissimus_dorsi', 'rhomboids', 'mid_trapezius'],
    secondary: ['biceps_brachii', 'posterior_deltoid'],
    stabilizers: ['rectus_abdominis'],
    synergists: ['teres_major'],
    antagonists: ['anterior_deltoid', 'pectoralis_major'],
  },
  hack_squat: {
    primary: ['quadriceps', 'gluteus_maximus'],
    secondary: ['adductors'],
    stabilizers: [],
    synergists: ['soleus'],
    antagonists: ['hamstrings'],
  },
  leg_press: {
    primary: ['quadriceps'],
    secondary: ['gluteus_maximus', 'adductors'],
    stabilizers: [],
    synergists: ['soleus', 'gastrocnemius'],
    antagonists: ['hamstrings'],
  },
  romanian_deadlift: {
    primary: ['hamstrings', 'gluteus_maximus'],
    secondary: ['erector_spinae'],
    stabilizers: ['rectus_abdominis', 'obliques'],
    synergists: ['adductors'],
    antagonists: ['quadriceps', 'iliopsoas'],
  },
  hip_thrust: {
    primary: ['gluteus_maximus'],
    secondary: ['hamstrings'],
    stabilizers: ['rectus_abdominis'],
    synergists: ['adductors'],
    antagonists: ['iliopsoas', 'rectus_femoris'],
  },
  bulgarian_split_squat: {
    primary: ['quadriceps', 'gluteus_maximus'],
    secondary: ['hamstrings', 'adductors'],
    stabilizers: ['rectus_abdominis', 'obliques'],
    synergists: ['soleus', 'gastrocnemius'],
    antagonists: ['iliopsoas'],
  },
  arnold_press: {
    primary: ['deltoids', 'triceps_brachii'],
    secondary: ['upper_pectoralis', 'upper_trapezius'],
    stabilizers: ['rotator_cuff', 'rectus_abdominis'],
    synergists: ['serratus_anterior', 'supraspinatus'],
    antagonists: ['latissimus_dorsi', 'biceps_brachii'],
  },
  lateral_raise: {
    primary: ['middle_deltoid'],
    secondary: ['upper_trapezius', 'supraspinatus'],
    stabilizers: [],
    synergists: ['anterior_deltoid'],
    antagonists: ['latissimus_dorsi'],
  },
  hammer_curl: {
    primary: ['brachialis', 'brachioradialis'],
    secondary: ['biceps_brachii'],
    stabilizers: [],
    synergists: ['forearm_flexors'],
    antagonists: ['triceps_brachii'],
  },
  skullcrusher: {
    primary: ['triceps_brachii'],
    secondary: ['anconeus'],
    stabilizers: ['pectoralis_major', 'latissimus_dorsi'],
    synergists: [],
    antagonists: ['biceps_brachii'],
  },
  close_grip_bench: {
    primary: ['triceps_brachii', 'inner_pectoralis'],
    secondary: ['anterior_deltoid'],
    stabilizers: ['rotator_cuff', 'rhomboids'],
    synergists: ['pectoralis_major'],
    antagonists: ['posterior_deltoid', 'biceps_brachii'],
  },
  front_squat: {
    primary: ['quadriceps', 'rectus_abdominis'],
    secondary: ['gluteus_maximus', 'upper_back'],
    stabilizers: ['erector_spinae', 'obliques'],
    synergists: ['soleus'],
    antagonists: ['hamstrings', 'iliopsoas'],
  },
  goblet_squat: {
    primary: ['quadriceps', 'gluteus_maximus'],
    secondary: ['rectus_abdominis'],
    stabilizers: [],
    synergists: ['soleus'],
    antagonists: ['hamstrings'],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Joint stress profiles
// ═══════════════════════════════════════════════════════════════════════════

const JOINT_STRESS_DB: Record<string, JointStressProfile> = {
  back_squat: {
    knee: { torque: 7, shear: 6, compression: 8, level: 'high' },
    hip: { torque: 6, shear: 4, compression: 5, level: 'medium' },
    spine: { torque: 5, shear: 4, compression: 7, level: 'medium' },
    shoulder: { torque: 2, impingement: 1, instability: 1, level: 'low' },
    elbow: { torque: 1, shear: 1, level: 'low' },
    ankle: { torque: 6, inversion: 3, level: 'medium' },
  },
  deadlift: {
    knee: { torque: 4, shear: 2, compression: 3, level: 'low' },
    hip: { torque: 8, shear: 5, compression: 7, level: 'high' },
    spine: { torque: 7, shear: 7, compression: 9, level: 'high' },
    shoulder: { torque: 3, impingement: 1, instability: 2, level: 'low' },
    elbow: { torque: 3, shear: 2, level: 'low' },
    ankle: { torque: 3, inversion: 2, level: 'low' },
  },
  bench_press: {
    knee: { torque: 0, shear: 0, compression: 0, level: 'low' },
    hip: { torque: 0, shear: 0, compression: 0, level: 'low' },
    spine: { torque: 2, shear: 1, compression: 3, level: 'low' },
    shoulder: { torque: 8, impingement: 7, instability: 5, level: 'high' },
    elbow: { torque: 6, shear: 4, level: 'medium' },
    ankle: { torque: 0, inversion: 0, level: 'low' },
  },
  overhead_press: {
    knee: { torque: 0, shear: 0, compression: 0, level: 'low' },
    hip: { torque: 1, shear: 1, compression: 1, level: 'low' },
    spine: { torque: 4, shear: 3, compression: 6, level: 'medium' },
    shoulder: { torque: 9, impingement: 9, instability: 6, level: 'high' },
    elbow: { torque: 7, shear: 5, level: 'medium' },
    ankle: { torque: 0, inversion: 0, level: 'low' },
  },
  pull_up: {
    knee: { torque: 0, shear: 0, compression: 0, level: 'low' },
    hip: { torque: 0, shear: 0, compression: 0, level: 'low' },
    spine: { torque: 1, shear: 1, compression: 2, level: 'low' },
    shoulder: { torque: 6, impingement: 4, instability: 3, level: 'medium' },
    elbow: { torque: 5, shear: 4, level: 'medium' },
    ankle: { torque: 0, inversion: 0, level: 'low' },
  },
  // ── Расширенные суставные профили (15+ новых) ──
  incline_bench: {
    knee: { torque: 0, shear: 0, compression: 0, level: 'low' },
    hip: { torque: 0, shear: 0, compression: 0, level: 'low' },
    spine: { torque: 2, shear: 1, compression: 3, level: 'low' },
    shoulder: { torque: 8, impingement: 8, instability: 4, level: 'high' },
    elbow: { torque: 5, shear: 4, level: 'medium' },
    ankle: { torque: 0, inversion: 0, level: 'low' },
  },
  dips_chest: {
    knee: { torque: 0, shear: 0, compression: 0, level: 'low' },
    hip: { torque: 0, shear: 0, compression: 0, level: 'low' },
    spine: { torque: 1, shear: 1, compression: 2, level: 'low' },
    shoulder: { torque: 7, impingement: 6, instability: 4, level: 'high' },
    elbow: { torque: 5, shear: 3, level: 'medium' },
    ankle: { torque: 0, inversion: 0, level: 'low' },
  },
  chin_up: {
    knee: { torque: 0, shear: 0, compression: 0, level: 'low' },
    hip: { torque: 0, shear: 0, compression: 0, level: 'low' },
    spine: { torque: 1, shear: 1, compression: 1, level: 'low' },
    shoulder: { torque: 4, impingement: 2, instability: 2, level: 'low' },
    elbow: { torque: 4, shear: 4, level: 'medium' },
    ankle: { torque: 0, inversion: 0, level: 'low' },
  },
  t_bar_row: {
    knee: { torque: 1, shear: 1, compression: 1, level: 'low' },
    hip: { torque: 2, shear: 1, compression: 2, level: 'low' },
    spine: { torque: 5, shear: 4, compression: 6, level: 'medium' },
    shoulder: { torque: 3, impingement: 1, instability: 1, level: 'low' },
    elbow: { torque: 4, shear: 3, level: 'medium' },
    ankle: { torque: 1, inversion: 1, level: 'low' },
  },
  hack_squat: {
    knee: { torque: 7, shear: 6, compression: 7, level: 'high' },
    hip: { torque: 3, shear: 2, compression: 3, level: 'low' },
    spine: { torque: 2, shear: 1, compression: 3, level: 'low' },
    shoulder: { torque: 0, impingement: 0, instability: 0, level: 'low' },
    elbow: { torque: 0, shear: 0, level: 'low' },
    ankle: { torque: 2, inversion: 1, level: 'low' },
  },
  leg_press: {
    knee: { torque: 6, shear: 5, compression: 6, level: 'medium' },
    hip: { torque: 3, shear: 2, compression: 4, level: 'low' },
    spine: { torque: 1, shear: 1, compression: 2, level: 'low' },
    shoulder: { torque: 0, impingement: 0, instability: 0, level: 'low' },
    elbow: { torque: 0, shear: 0, level: 'low' },
    ankle: { torque: 2, inversion: 1, level: 'low' },
  },
  romanian_deadlift: {
    knee: { torque: 2, shear: 1, compression: 2, level: 'low' },
    hip: { torque: 7, shear: 4, compression: 6, level: 'high' },
    spine: { torque: 5, shear: 4, compression: 6, level: 'medium' },
    shoulder: { torque: 2, impingement: 1, instability: 1, level: 'low' },
    elbow: { torque: 2, shear: 2, level: 'low' },
    ankle: { torque: 1, inversion: 1, level: 'low' },
  },
  hip_thrust: {
    knee: { torque: 2, shear: 1, compression: 2, level: 'low' },
    hip: { torque: 5, shear: 3, compression: 4, level: 'medium' },
    spine: { torque: 2, shear: 1, compression: 3, level: 'low' },
    shoulder: { torque: 1, impingement: 0, instability: 0, level: 'low' },
    elbow: { torque: 0, shear: 0, level: 'low' },
    ankle: { torque: 1, inversion: 0, level: 'low' },
  },
  bulgarian_split_squat: {
    knee: { torque: 7, shear: 6, compression: 7, level: 'high' },
    hip: { torque: 5, shear: 3, compression: 4, level: 'medium' },
    spine: { torque: 2, shear: 1, compression: 3, level: 'low' },
    shoulder: { torque: 1, impingement: 0, instability: 0, level: 'low' },
    elbow: { torque: 0, shear: 0, level: 'low' },
    ankle: { torque: 5, inversion: 4, level: 'medium' },
  },
  arnold_press: {
    knee: { torque: 0, shear: 0, compression: 0, level: 'low' },
    hip: { torque: 0, shear: 0, compression: 0, level: 'low' },
    spine: { torque: 2, shear: 1, compression: 3, level: 'low' },
    shoulder: { torque: 7, impingement: 5, instability: 4, level: 'high' },
    elbow: { torque: 5, shear: 3, level: 'medium' },
    ankle: { torque: 0, inversion: 0, level: 'low' },
  },
  lateral_raise: {
    knee: { torque: 0, shear: 0, compression: 0, level: 'low' },
    hip: { torque: 0, shear: 0, compression: 0, level: 'low' },
    spine: { torque: 1, shear: 0, compression: 1, level: 'low' },
    shoulder: { torque: 5, impingement: 4, instability: 2, level: 'medium' },
    elbow: { torque: 2, shear: 1, level: 'low' },
    ankle: { torque: 0, inversion: 0, level: 'low' },
  },
  hammer_curl: {
    knee: { torque: 0, shear: 0, compression: 0, level: 'low' },
    hip: { torque: 0, shear: 0, compression: 0, level: 'low' },
    spine: { torque: 1, shear: 0, compression: 1, level: 'low' },
    shoulder: { torque: 1, impingement: 0, instability: 0, level: 'low' },
    elbow: { torque: 4, shear: 2, level: 'medium' },
    ankle: { torque: 0, inversion: 0, level: 'low' },
  },
  skullcrusher: {
    knee: { torque: 0, shear: 0, compression: 0, level: 'low' },
    hip: { torque: 0, shear: 0, compression: 0, level: 'low' },
    spine: { torque: 1, shear: 0, compression: 1, level: 'low' },
    shoulder: { torque: 2, impingement: 0, instability: 0, level: 'low' },
    elbow: { torque: 6, shear: 5, level: 'medium' },
    ankle: { torque: 0, inversion: 0, level: 'low' },
  },
  close_grip_bench: {
    knee: { torque: 0, shear: 0, compression: 0, level: 'low' },
    hip: { torque: 0, shear: 0, compression: 0, level: 'low' },
    spine: { torque: 2, shear: 1, compression: 2, level: 'low' },
    shoulder: { torque: 4, impingement: 3, instability: 3, level: 'medium' },
    elbow: { torque: 6, shear: 5, level: 'medium' },
    ankle: { torque: 0, inversion: 0, level: 'low' },
  },
  front_squat: {
    knee: { torque: 7, shear: 6, compression: 7, level: 'high' },
    hip: { torque: 5, shear: 3, compression: 4, level: 'medium' },
    spine: { torque: 5, shear: 4, compression: 6, level: 'medium' },
    shoulder: { torque: 4, impingement: 2, instability: 2, level: 'low' },
    elbow: { torque: 3, shear: 2, level: 'low' },
    ankle: { torque: 5, inversion: 4, level: 'medium' },
  },
  goblet_squat: {
    knee: { torque: 5, shear: 4, compression: 5, level: 'medium' },
    hip: { torque: 4, shear: 2, compression: 3, level: 'low' },
    spine: { torque: 3, shear: 2, compression: 4, level: 'low' },
    shoulder: { torque: 1, impingement: 0, instability: 0, level: 'low' },
    elbow: { torque: 1, shear: 1, level: 'low' },
    ankle: { torque: 3, inversion: 2, level: 'low' },
  },
  barbell_row: {
    knee: { torque: 1, shear: 1, compression: 1, level: 'low' },
    hip: { torque: 2, shear: 1, compression: 2, level: 'low' },
    spine: { torque: 5, shear: 4, compression: 6, level: 'medium' },
    shoulder: { torque: 3, impingement: 1, instability: 1, level: 'low' },
    elbow: { torque: 4, shear: 3, level: 'medium' },
    ankle: { torque: 1, inversion: 1, level: 'low' },
  },
  seated_row: {
    knee: { torque: 0, shear: 0, compression: 0, level: 'low' },
    hip: { torque: 0, shear: 0, compression: 0, level: 'low' },
    spine: { torque: 3, shear: 2, compression: 4, level: 'low' },
    shoulder: { torque: 3, impingement: 1, instability: 1, level: 'low' },
    elbow: { torque: 4, shear: 3, level: 'medium' },
    ankle: { torque: 0, inversion: 0, level: 'low' },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Engine functions
// ═══════════════════════════════════════════════════════════════════════════

export function classifyMovement(exerciseId: string): MovementClassification {
  return MOVEMENT_CLASS_DB[exerciseId] || {
    pattern: 'accessory',
    plane: 'sagittal',
    loadType: 'anterior',
    complexity: 'low',
    primaryJoints: [],
    groundingPattern: 'bilateral',
  };
}

export function estimateDifficulty(exerciseId: string): DifficultyProfile {
  const cls = classifyMovement(exerciseId);
  const stress = getJointStress(exerciseId);
  const synergy = getMuscleSynergy(exerciseId);

  const technicalComplexity = cls.complexity === 'high' ? 4 : cls.complexity === 'medium' ? 2.5 : 1.5;
  const coordinationDemand = cls.groundingPattern === 'unilateral' ? 4
    : cls.loadType === 'axial' && cls.complexity === 'high' ? 3.5 : 2;
  const cnsDemand = cls.loadType === 'axial' && cls.complexity === 'high' ? 4.5
    : synergy.primary.length >= 3 ? 3.5 : 2;
  const jointStressTotal = Object.values(stress).reduce((s, j) => s + (j.torque || 0), 0) * 5;
  const mobilityReq = cls.primaryJoints.length >= 3 ? 3.5 : 2;
  const stabilityReq = synergy.stabilizers.length >= 2 ? 3 : 2;
  const avg = (technicalComplexity + coordinationDemand + cnsDemand + mobilityReq + stabilityReq) / 5;

  return {
    technicalComplexity: Math.round(technicalComplexity * 10) / 10,
    coordinationDemand: Math.round(coordinationDemand * 10) / 10,
    cnsDemand: Math.round(cnsDemand * 10) / 10,
    jointStressTotal: Math.round(Math.min(100, jointStressTotal)),
    mobilityReq: Math.round(mobilityReq * 10) / 10,
    stabilityReq: Math.round(stabilityReq * 10) / 10,
    overallDifficulty: avg > 3.5 ? 'high' : avg > 2 ? 'medium' : 'low',
  };
}

export function getMuscleSynergy(exerciseId: string): MuscleSynergy {
  return MUSCLE_SYNERGY_DB[exerciseId] || {
    primary: [],
    secondary: [],
    stabilizers: [],
    synergists: [],
    antagonists: [],
  };
}

export function getJointStress(exerciseId: string): JointStressProfile {
  return JOINT_STRESS_DB[exerciseId] || {
    knee: { torque: 0, shear: 0, compression: 0, level: 'low' },
    hip: { torque: 0, shear: 0, compression: 0, level: 'low' },
    spine: { torque: 0, shear: 0, compression: 0, level: 'low' },
    shoulder: { torque: 0, impingement: 0, instability: 0, level: 'low' },
    elbow: { torque: 0, shear: 0, level: 'low' },
    ankle: { torque: 0, inversion: 0, level: 'low' },
  };
}

export function assessSafety(
  exerciseId: string,
  injuryHistory: string[],
  techniqueScore: number,
): SafetyAssessment {
  const stress = getJointStress(exerciseId);
  const difficulty = estimateDifficulty(exerciseId);
  const contraindications: string[] = [];
  const precautions: string[] = [];
  const highRiskPopulation: string[] = [];

  // Joint-specific contraindications
  if (stress.knee.level === 'high') {
    contraindications.push('Травма колена (ACL/MCL/мениск)');
    highRiskPopulation.push('Пост-операция колена (6-12 мес)');
  }
  if (stress.spine.level === 'high') {
    contraindications.push('Грыжа межпозвоночного диска');
    contraindications.push('Спондилолистез');
    highRiskPopulation.push('Хроническая боль в пояснице');
  }
  if (stress.shoulder.level === 'high') {
    contraindications.push('Импинджмент-синдром');
    contraindications.push('Разрыв ротаторной манжеты');
    contraindications.push('Нестабильность плеча');
    highRiskPopulation.push('Пловцы / метатели (overuse risk)');
  }

  // Technique-based warnings
  if (techniqueScore < 0.5) {
    precautions.push('Низкая техника — используйте облегчённые вариации');
  }
  if (difficulty.overallDifficulty === 'high' && techniqueScore < 0.6) {
    precautions.push('Высокая сложность при низкой технике — риск травмы');
  }

  // Injury history overlap
  for (const injury of injuryHistory) {
    if (contraindications.some(c => c.toLowerCase().includes(injury.toLowerCase()))) {
      precautions.unshift(`Травма в анамнезе: ${injury} — повышенный риск`);
    }
  }

  // Safety score
  let score = 80;
  score -= contraindications.length * 15;
  score -= precautions.length * 8;
  if (difficulty.overallDifficulty === 'high') score -= 10;
  score = Math.max(10, Math.min(100, Math.round(score)));

  return {
    score,
    level: score > 70 ? 'safe' : score > 40 ? 'moderate' : 'risky',
    contraindications,
    precautions,
    requiresSpotter: difficulty.overallDifficulty === 'high' || stress.spine.level === 'high',
    highRiskPopulation,
  };
}
