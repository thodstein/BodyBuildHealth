/**
 * Cooldown Engine — Auto-generates post-workout cooldown protocol.
 *
 * Generates cooldown based on:
 *  - Session data (exercises performed, muscle groups used)
 *  - Fatigue score
 *  - Risk snapshot
 *  - Session difficulty
 *
 * Structure:
 *  1. Breathing: HR lowering (2-3 min)
 *  2. Static stretches: targeted muscle groups
 *  3. Mobility: ROM restoration
 *  4. Optional: foam rolling / myofascial release
 *
 * @module cooldown-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface CooldownExercise {
  name: string;
  durationSeconds: number;
  targetMuscle: string;
  notes: string;
}

export interface CooldownBlock {
  type: 'breathing' | 'stretch' | 'mobility' | 'foam_roll';
  durationSeconds: number;
  exercises: CooldownExercise[];
  description: string;
}

export interface CooldownInput {
  muscleGroupsUsed: string[];
  fatigueScore: number;
  sessionDifficulty: number;
  riskSnapshot: Record<string, string>;
  sessionDurationMin: number;
}

export interface CooldownOutput {
  totalDurationMin: number;
  blocks: CooldownBlock[];
  priorityMuscles: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Static stretches per muscle group
// ═══════════════════════════════════════════════════════════════════════════

const STRETCHES: Record<string, CooldownExercise[]> = {
  quads: [
    { name: 'Quad Stretch (standing)', durationSeconds: 30, targetMuscle: 'Квадрицепсы', notes: 'Колено к ягодице, таз вперёд' },
    { name: 'Couch Stretch', durationSeconds: 45, targetMuscle: 'Квадрицепсы + сгибатели бедра', notes: 'Заднее колено у стены' },
  ],
  hamstrings: [
    { name: 'Standing Hamstring Stretch', durationSeconds: 30, targetMuscle: 'Бицепс бедра', notes: 'Нога на возвышении, спина прямая' },
    { name: 'Jefferson Curl', durationSeconds: 30, targetMuscle: 'Задняя цепь', notes: 'Медленно, позвонок за позвонком' },
  ],
  glutes: [
    { name: 'Figure-4 Stretch (lying)', durationSeconds: 30, targetMuscle: 'Ягодичные', notes: 'Лодыжка на противоположное колено' },
    { name: 'Pigeon Pose', durationSeconds: 45, targetMuscle: 'Ягодичные + грушевидная', notes: 'Передняя нога под 90°' },
  ],
  chest: [
    { name: 'Doorway Chest Stretch', durationSeconds: 30, targetMuscle: 'Грудные', notes: 'Руки на уровне плеч' },
    { name: 'Floor Chest Stretch', durationSeconds: 30, targetMuscle: 'Грудные + передние дельты', notes: 'Рука в сторону, корпус разворачивается' },
  ],
  back: [
    { name: 'Child\'s Pose', durationSeconds: 45, targetMuscle: 'Широчайшие + поясница', notes: 'Руки вперёд, таз на пятки' },
    { name: 'Cat-Cow', durationSeconds: 30, targetMuscle: 'Позвоночник', notes: 'Медленная смена прогиба и округления' },
    { name: 'Lat Stretch (kneeling)', durationSeconds: 30, targetMuscle: 'Широчайшие', notes: 'Руки на возвышении, тянемся вниз' },
  ],
  shoulders: [
    { name: 'Cross-Body Shoulder Stretch', durationSeconds: 30, targetMuscle: 'Задние дельты', notes: 'Рука поперёк тела' },
    { name: 'Sleeper Stretch', durationSeconds: 30, targetMuscle: 'Ротаторная манжета', notes: 'Лёжа на боку, предплечье вниз' },
  ],
  triceps: [
    { name: 'Overhead Triceps Stretch', durationSeconds: 30, targetMuscle: 'Трицепс', notes: 'Локоть за голову' },
  ],
  biceps: [
    { name: 'Wall Biceps Stretch', durationSeconds: 30, targetMuscle: 'Бицепс', notes: 'Рука назад, ладонь на стену' },
  ],
  calves: [
    { name: 'Downward Dog', durationSeconds: 30, targetMuscle: 'Икроножные', notes: 'Пятки к полу' },
    { name: 'Wall Calf Stretch', durationSeconds: 30, targetMuscle: 'Икроножные + ахилл', notes: 'Носок на стену, пятка на полу' },
  ],
  core: [
    { name: 'Cobra Stretch', durationSeconds: 30, targetMuscle: 'Абдоминальные', notes: 'Лёжа на животе, выпрямляем руки' },
    { name: 'Side Bend Stretch', durationSeconds: 20, targetMuscle: 'Косые', notes: 'Рука над головой, наклон в сторону' },
  ],
  hips: [
    { name: '90/90 Stretch', durationSeconds: 45, targetMuscle: 'Тазобедренные', notes: 'Обе ноги под 90°' },
    { name: 'Butterfly Stretch', durationSeconds: 30, targetMuscle: 'Аддукторы', notes: 'Стопы вместе, колени в стороны' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Priority muscle mapping from session exercises
// ═══════════════════════════════════════════════════════════════════════════

const EXERCISE_MUSCLE_MAP: Record<string, string[]> = {
  squat: ['quads', 'glutes', 'hamstrings', 'core', 'calves'],
  bench_press: ['chest', 'shoulders', 'triceps'],
  deadlift: ['hamstrings', 'glutes', 'back', 'core', 'hips'],
  overhead_press: ['shoulders', 'triceps', 'core'],
  row: ['back', 'biceps', 'core'],
  pull_up: ['back', 'biceps', 'shoulders'],
  lunge: ['quads', 'glutes', 'hamstrings', 'calves'],
  curl: ['biceps'],
  extension: ['triceps'],
  calf_raise: ['calves'],
  lateral_raise: ['shoulders'],
  flye: ['chest', 'shoulders'],
  face_pull: ['shoulders', 'back'],
  leg_press: ['quads', 'glutes', 'hamstrings'],
  hamstring_curl: ['hamstrings'],
  leg_extension: ['quads'],
  hip_thrust: ['glutes', 'hamstrings'],
  plank: ['core'],
  crunch: ['core'],
  good_morning: ['hamstrings', 'back', 'glutes'],
  rdl: ['hamstrings', 'glutes', 'back'],
  front_squat: ['quads', 'glutes', 'core', 'hips'],
  dip: ['chest', 'triceps', 'shoulders'],
  snatch: ['shoulders', 'back', 'quads', 'glutes', 'hips'],
  clean: ['shoulders', 'back', 'quads', 'glutes', 'hips', 'calves'],
};

// ═══════════════════════════════════════════════════════════════════════════
// Breathing exercises
// ═══════════════════════════════════════════════════════════════════════════

const BREATHING_EXERCISES: CooldownExercise[] = [
  { name: 'Диафрагмальное дыхание', durationSeconds: 60, targetMuscle: 'Диафрагма', notes: 'Вдох 4с через нос, выдох 6с через рот' },
  { name: '4-7-8 дыхание', durationSeconds: 60, targetMuscle: 'ЦНС', notes: 'Вдох 4с, задержка 7с, выдох 8с' },
  { name: 'Box Breathing', durationSeconds: 60, targetMuscle: 'ЦНС', notes: '4с вдох, 4с задержка, 4с выдох, 4с задержка' },
];

// ═══════════════════════════════════════════════════════════════════════════
// Core Engine
// ═══════════════════════════════════════════════════════════════════════════

export function generateCooldown(input: CooldownInput): CooldownOutput {
  const blocks: CooldownBlock[] = [];

  // Determine priority muscles from session exercises
  const muscleSet = new Set<string>();
  for (const ex of input.muscleGroupsUsed) {
    const key = ex.toLowerCase().replace(/[^a-z_]/g, '');
    const muscles = EXERCISE_MUSCLE_MAP[key];
    if (muscles) {
      muscles.forEach(m => muscleSet.add(m));
    }
  }
  // If no specific muscles detected, add default full set
  if (muscleSet.size === 0) {
    ['quads', 'hamstrings', 'glutes', 'back', 'chest', 'shoulders', 'core'].forEach(m => muscleSet.add(m));
  }
  const priorityMuscles = [...muscleSet];

  // ── Block 1: Breathing ──
  const breathingDuration = input.fatigueScore > 0.6 ? 180 : 120;
  const breathingExercises = input.fatigueScore > 0.7
    ? [...BREATHING_EXERCISES]
    : BREATHING_EXERCISES.slice(0, 2);

  blocks.push({
    type: 'breathing',
    durationSeconds: breathingDuration,
    description: 'Снижение ЧСС и активация парасимпатики',
    exercises: breathingExercises,
  });

  // ── Block 2: Static stretches ──
  const stretchExercises: CooldownExercise[] = [];
  for (const muscle of priorityMuscles) {
    const stretches = STRETCHES[muscle];
    if (stretches) {
      stretchExercises.push(stretches[0]);
    }
  }

  const stretchDuration = stretchExercises.reduce((s, e) => s + e.durationSeconds, 0);

  blocks.push({
    type: 'stretch',
    durationSeconds: stretchDuration,
    description: 'Статическая растяжка нагруженных мышечных групп',
    exercises: stretchExercises,
  });

  // ── Block 3: Mobility (extra if high fatigue) ──
  if (input.fatigueScore > 0.5 || input.riskSnapshot.knee === 'high' || input.riskSnapshot.shoulder === 'high') {
    const mobilityExercises: CooldownExercise[] = [
      { name: 'Foam Roll — Квадрицепсы', durationSeconds: 45, targetMuscle: 'Квадрицепсы', notes: 'Медленно, 30с на болевую точку' },
      { name: 'Foam Roll — Грудной отдел', durationSeconds: 45, targetMuscle: 'T-позвоночник', notes: 'Руки за голову, прокатываем лопатки' },
      { name: 'Foam Roll — Задняя цепь', durationSeconds: 45, targetMuscle: 'Бицепс бедра + ягодицы', notes: 'Сидя на ролле, перекаты' },
    ];
    blocks.push({
      type: 'foam_roll',
      durationSeconds: 135,
      description: 'Миофасциальный релиз для снижения DOMS',
      exercises: mobilityExercises,
    });
  }

  // ── Total ──
  const totalSeconds = blocks.reduce((s, b) => s + b.durationSeconds, 0);

  return {
    totalDurationMin: Math.round(totalSeconds / 60),
    blocks,
    priorityMuscles,
  };
}
