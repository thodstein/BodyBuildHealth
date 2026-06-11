/**
 * Training Constraints Engine + Equipment Constraints + Day Balancer
 *
 * Constraints Engine: determines session limits based on risk, fatigue, recovery.
 * Equipment Constraints: filters exercises by available equipment.
 * Day Balancer: balances load within a session (main/secondary/accessory distribution).
 *
 * @module training-constraints-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ConstraintsInput {
  riskSnapshot: Record<string, 'low' | 'medium' | 'high'>;
  fatigueLevel: number; // 0-1
  recoveryLevel: number; // 0-1
  priScore: number; // 0-1
  jointFatigue: Record<string, number>;
  cumulativeLoad: {
    weekly: number;
    patternLoad: Record<string, number>;
    jointLoad: Record<string, number>;
    overload: boolean;
  };
  equipmentAvailable: string[];
  goal: string;
}

export interface TrainingConstraints {
  maxVolume: number;
  maxIntensity: number;
  maxSessionDurationMin: number;
  maxSetsPerExercise: number;
  maxExercisesPerSession: number;
  blacklistedPatterns: string[];
  blacklistedExercises: string[];
  recommendations: string[];
}

export interface EquipmentConstraintOutput {
  allowedExercises: string[];
  blockedExercises: string[];
  substitutions: Record<string, string>;
}

export interface DayBalanceInput {
  mainLifts: { name: string; jointStress: Record<string, number>; intensity: number }[];
  secondaryLifts: { name: string; jointStress: Record<string, number>; intensity: number }[];
  accessories: { name: string; muscleGroup: string }[];
  sessionFocus: string;
  constraints: TrainingConstraints;
}

export interface DayBalanceOutput {
  orderedSlots: { name: string; role: 'main' | 'secondary' | 'accessory'; position: number }[];
  loadDistribution: { main: number; secondary: number; accessory: number };
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Training Constraints Engine
// ═══════════════════════════════════════════════════════════════════════════

export function computeConstraints(input: ConstraintsInput): TrainingConstraints {
  const recs: string[] = [];
  const blacklistedPatterns: string[] = [];
  let maxVolume = 100;
  let maxIntensity = 0.95;
  let maxSessionDuration = 120;
  let maxSetsPerExercise = 8;
  let maxExercisesPerSession = 8;

  // Risk-based constraints
  if (input.riskSnapshot.knee === 'high') {
    blacklistedPatterns.push('squat', 'lunge');
    recs.push('Высокий риск колена — исключены squat/lunge паттерны');
  }
  if (input.riskSnapshot.shoulder === 'high') {
    blacklistedPatterns.push('vertical_push');
    recs.push('Высокий риск плеча — исключён overhead pressing');
  }
  if (input.riskSnapshot.lower_back === 'high' || input.riskSnapshot.spine === 'high') {
    blacklistedPatterns.push('hinge');
    maxIntensity = Math.min(maxIntensity, 0.75);
    recs.push('Высокий риск спины — исключены hinge, ограничена интенсивность ≤75%');
  }

  // Fatigue constraints
  if (input.fatigueLevel > 0.7) {
    maxVolume *= 0.7;
    maxSessionDuration *= 0.8;
    maxSetsPerExercise = 5;
    recs.push(`Высокая усталость (${(input.fatigueLevel * 100).toFixed(0)}%) — объём снижен на 30%`);
  }
  if (input.fatigueLevel > 0.85) {
    maxIntensity = Math.min(maxIntensity, 0.7);
    maxExercisesPerSession = 5;
    recs.push('Критическая усталость — интенсивность ≤70%, максимум 5 упражнений');
  }

  // Recovery constraints
  if (input.recoveryLevel < 0.3) {
    maxIntensity = Math.min(maxIntensity, 0.65);
    maxVolume *= 0.6;
    recs.push('Низкое восстановление — снижение нагрузки');
  }

  // PRI constraints
  if (input.priScore < 0.4) {
    maxIntensity = Math.min(maxIntensity, 0.8);
    recs.push(`Низкая готовность (PRI=${input.priScore.toFixed(1)}) — ограничение интенсивности`);
  }

  // Cumulative load constraints
  if (input.cumulativeLoad.overload) {
    maxVolume *= 0.6;
    recs.push('Обнаружен overload — принудительное снижение объёма на 40%');
  }

  // Joint fatigue
  if ((input.jointFatigue['knee'] || 0) > 0.6) {
    blacklistedPatterns.push('squat');
    recs.push('Усталость коленных суставов — исключён squat');
  }
  if ((input.jointFatigue['spine'] || 0) > 0.6) {
    blacklistedPatterns.push('hinge');
    recs.push('Усталость позвоночника — исключён hinge');
  }

  return {
    maxVolume: Math.round(maxVolume),
    maxIntensity: Math.round(maxIntensity * 100) / 100,
    maxSessionDurationMin: Math.round(maxSessionDuration),
    maxSetsPerExercise,
    maxExercisesPerSession,
    blacklistedPatterns,
    blacklistedExercises: [],
    recommendations: recs,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Equipment Constraints Engine
// ═══════════════════════════════════════════════════════════════════════════

const EQUIPMENT_EXERCISE_MAP: Record<string, { requires: string[]; substitutes: Record<string, string> }> = {
  back_squat: { requires: ['barbell', 'rack'], substitutes: { no_barbell: 'goblet_squat', no_rack: 'zercher_squat' } },
  bench_press: { requires: ['barbell', 'bench', 'rack'], substitutes: { no_barbell: 'dumbbell_bench_press', no_bench: 'floor_press' } },
  deadlift: { requires: ['barbell'], substitutes: { no_barbell: 'kettlebell_swing' } },
  overhead_press: { requires: ['barbell'], substitutes: { no_barbell: 'dumbbell_shoulder_press' } },
  barbell_row: { requires: ['barbell'], substitutes: { no_barbell: 'dumbbell_row' } },
  pull_up: { requires: ['pull_up_bar'], substitutes: { no_bar: 'lat_pulldown' } },
  lat_pulldown: { requires: ['cable_machine'], substitutes: { no_machine: 'pull_up' } },
  leg_press: { requires: ['leg_press_machine'], substitutes: { no_machine: 'goblet_squat' } },
  cable_flye: { requires: ['cable_machine'], substitutes: { no_machine: 'dumbbell_flye' } },
  leg_curl: { requires: ['leg_curl_machine'], substitutes: { no_machine: 'nordic_curl' } },
  leg_extension: { requires: ['leg_extension_machine'], substitutes: { no_machine: 'sissy_squat' } },
  triceps_pushdown: { requires: ['cable_machine'], substitutes: { no_machine: 'triceps_kickback' } },
  face_pull: { requires: ['cable_machine'], substitutes: { no_machine: 'band_pull_apart' } },
};

export function checkEquipment(exerciseId: string, available: string[]): { allowed: boolean; substitute?: string } {
  const req = EQUIPMENT_EXERCISE_MAP[exerciseId];
  if (!req) return { allowed: true }; // bodyweight or unknown — always allowed

  const hasAll = req.requires.every(r => available.includes(r));
  if (hasAll) return { allowed: true };

  // Find substitution
  if (!available.includes('barbell') && req.substitutes['no_barbell']) {
    return { allowed: false, substitute: req.substitutes['no_barbell'] };
  }
  for (const [key, sub] of Object.entries(req.substitutes)) {
    if (sub) return { allowed: false, substitute: sub };
  }
  return { allowed: false };
}

export function equipmentFilter(exercises: string[], available: string[]): EquipmentConstraintOutput {
  const allowed: string[] = [];
  const blocked: string[] = [];
  const substitutions: Record<string, string> = {};

  for (const ex of exercises) {
    const result = checkEquipment(ex, available);
    if (result.allowed) {
      allowed.push(ex);
    } else {
      blocked.push(ex);
      if (result.substitute) {
        substitutions[ex] = result.substitute;
        allowed.push(result.substitute);
      }
    }
  }

  return { allowedExercises: allowed, blockedExercises: blocked, substitutions };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Training Day Balancer
// ═══════════════════════════════════════════════════════════════════════════

export function balanceDay(input: DayBalanceInput): DayBalanceOutput {
  const warnings: string[] = [];
  const ordered: DayBalanceOutput['orderedSlots'] = [];
  let pos = 1;

  // Main lifts first (highest CNS demand)
  for (const lift of input.mainLifts) {
    // Check constraints
    const spinalStress = lift.jointStress['spine'] || 0;
    if (spinalStress > 6 && input.constraints.blacklistedPatterns.includes('hinge')) {
      warnings.push(`${lift.name} исключён: заблокированный паттерн`);
      continue;
    }
    ordered.push({ name: lift.name, role: 'main', position: pos++ });
  }

  // Secondary lifts
  for (const lift of input.secondaryLifts) {
    if (pos > input.constraints.maxExercisesPerSession) {
      warnings.push(`${lift.name} пропущен: превышен лимит упражнений`);
      continue;
    }
    ordered.push({ name: lift.name, role: 'secondary', position: pos++ });
  }

  // Accessories (capped)
  let accCount = 0;
  for (const acc of input.accessories) {
    if (pos > input.constraints.maxExercisesPerSession) break;
    if (accCount >= 6) {
      warnings.push('Аксессуары ограничены до 6');
      break;
    }
    ordered.push({ name: acc.name, role: 'accessory', position: pos++ });
    accCount++;
  }

  // Load distribution
  const total = ordered.length || 1;
  const mainCount = ordered.filter(s => s.role === 'main').length;
  const secCount = ordered.filter(s => s.role === 'secondary').length;
  const accCount2 = ordered.filter(s => s.role === 'accessory').length;

  return {
    orderedSlots: ordered,
    loadDistribution: {
      main: Math.round((mainCount / total) * 100),
      secondary: Math.round((secCount / total) * 100),
      accessory: Math.round((accCount2 / total) * 100),
    },
    warnings,
  };
}
