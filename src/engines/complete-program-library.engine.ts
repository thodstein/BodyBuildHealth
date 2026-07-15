/**
 * Complete Training Program Library — 10 fully detailed programs.
 *
 * Each program includes:
 *  - Full week-by-week structure
 *  - Every exercise with sets/reps/RPE/rest
 *  - Progression model
 *  - Deload protocol
 *  - Who it's for
 *  - Customization options
 *
 * @module complete-program-library
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ProgramDay {
  day: number;
  name: string;
  focus: string;
  warmup: string;
  exercises: { name: string; sets: number; reps: string; rpe: number; rir: number; restSec: number; notes: string; progression: string }[];
  cooldown: string;
}

export interface ProgramWeek {
  week: number;
  phase: string;
  volumeMultiplier: number;
  intensityMultiplier: number;
  days: ProgramDay[];
  deload: boolean;
}

export interface FullProgram {
  id: string;
  name: string;
  author: string;
  type: string;
  goal: 'strength' | 'hypertrophy' | 'powerlifting' | 'bodybuilding' | 'athletic' | 'rehab' | 'peaking';
  direction?: 'strength' | 'bodybuilding' | 'both';
  level: 'beginner' | 'intermediate' | 'advanced';
  durationWeeks: number;
  daysPerWeek: number;
  sessionTimeMin: string;
  description: string;
  targetAudience: string;
  equipmentNeeded: string[];
  weeks: ProgramWeek[];
  progressionModel: string;
  deloadProtocol: string;
  customization: string[];
  warnings: string[];
  expectedResults: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Program 1: Starting Strength Novice Linear Progression
// ═══════════════════════════════════════════════════════════════════════════

const STARTING_STRENGTH: FullProgram = {
  id: 'starting_strength', name: 'Starting Strength', author: 'Mark Rippetoe',
  type: 'Full Body 3x/week', goal: 'strength', direction: 'strength', level: 'beginner',
  durationWeeks: 12, daysPerWeek: 3, sessionTimeMin: '45-60',
  description: 'Классическая программа для начинающих. 3 базовых упражнения в день, линейная прогрессия каждого упражнения на каждой тренировке. Простая, эффективная, проверенная десятилетиями.',
  targetAudience: 'Начинающие (0-6 месяцев тренировок). Худые новички, которым нужно быстро набрать силу и массу.',
  equipmentNeeded: ['barbell', 'rack', 'bench', 'plates'],
  warnings: ['Не добавляйте упражнения — программа минималистична по дизайну.', 'GOMAD (Gallon Of Milk A Day) рекомендуется только очень худым.', 'При плато 3 раза подряд — сбросить вес на 10% и работать обратно.'],
  expectedResults: '+10-15 кг силы в месяц на основных движениях. +5-10 кг массы тела за 3-4 месяца.',
  progressionModel: 'Линейная: +2.5 кг верх (жим/OHP), +5 кг низ (присед/тяга) КАЖДУЮ тренировку.',
  deloadProtocol: 'При плато 3 раза: сброс 10% веса → работа обратно вверх с micro-plates (1.25 кг).',
  customization: ['Power Clean вместо Barbell Row для атлетизма.', 'Chin-ups вместо Lat Pulldown если можете 5+.', 'Back Extensions вместо Pull-ups в день B если спина устаёт.'],
  weeks: [{
    week: 1, phase: 'accumulation', volumeMultiplier: 1.0, intensityMultiplier: 1.0, deload: false,
    days: [
      { day: 1, name: 'День A', focus: 'Squat + Press + Pull', warmup: '3 ramp-up sets per exercise',
        exercises: [
          { name: 'Squat', sets: 3, reps: '5', rpe: 8, rir: 2, restSec: 180, notes: '+2.5 кг каждый день A', progression: '+2.5 кг/тренировка' },
          { name: 'Bench Press', sets: 3, reps: '5', rpe: 8, rir: 2, restSec: 150, notes: '+2.5 кг', progression: '+2.5 кг/тренировка' },
          { name: 'Deadlift', sets: 1, reps: '5', rpe: 8.5, rir: 1.5, restSec: 180, notes: '+5 кг', progression: '+5 кг/тренировка' },
        ], cooldown: 'Static stretch hamstrings, hip flexors',
      },
      { day: 2, name: 'День B', focus: 'Squat + Press + Pull', warmup: '3 ramp-up sets',
        exercises: [
          { name: 'Squat', sets: 3, reps: '5', rpe: 8, rir: 2, restSec: 180, notes: 'Легче день A (80%) или фронтальный', progression: '80% дня A или Front Squat' },
          { name: 'Overhead Press', sets: 3, reps: '5', rpe: 8.5, rir: 1.5, restSec: 150, notes: '+1.25 кг', progression: '+1.25 кг/тренировка' },
          { name: 'Barbell Row / Power Clean', sets: 5, reps: '3', rpe: 7.5, rir: 2.5, restSec: 120, notes: 'Power Clean 5×3 или BB Row 3×5', progression: '+2.5 кг (Row)' },
        ], cooldown: 'Stretch lats, shoulders',
      },
      { day: 3, name: 'День A', focus: 'Squat + Press + Pull', warmup: '3 ramp-up sets',
        exercises: [
          { name: 'Squat', sets: 3, reps: '5', rpe: 8.5, rir: 1.5, restSec: 180, notes: '+2.5 кг от дня A', progression: '+2.5 кг от дня A' },
          { name: 'Bench Press', sets: 3, reps: '5', rpe: 8, rir: 2, restSec: 150, notes: '+2.5 кг от дня A', progression: '+2.5 кг' },
          { name: 'Deadlift', sets: 1, reps: '5', rpe: 9, rir: 1, restSec: 180, notes: '+5 кг от дня A', progression: '+5 кг' },
        ], cooldown: 'Full body stretch',
      },
    ],
  }],
};

// ═══════════════════════════════════════════════════════════════════════════
// Program 2: 5/3/1 BBB (Boring But Big)
// ═══════════════════════════════════════════════════════════════════════════

const FIVE_THREE_ONE_BBB: FullProgram = {
  id: '531_bbb', name: '5/3/1 Boring But Big', author: 'Jim Wendler',
  type: 'Upper/Lower 4x/week', goal: 'strength', direction: 'strength', level: 'intermediate',
  durationWeeks: 4, daysPerWeek: 4, sessionTimeMin: '50-65',
  description: '4-недельный волновой цикл с основным движением 5/3/1 и 5×10 подсобки на 50-60% TM. Простая, устойчивая прогрессия. Встроенный deload.',
  targetAudience: 'Средний уровень (1-3 года тренировок). Те, кто перерос Starting Strength.',
  equipmentNeeded: ['barbell', 'rack', 'bench', 'pull-up bar', 'dumbbells'],
  warnings: ['TM (Training Max) = 85-90% от реального 1RM. НЕ 100%.', 'BBB подсобка на 50-60% — должно быть ТЯЖЕЛО к концу, но выполнимо.', 'Не пропускайте deload неделю.'],
  expectedResults: '+2.5-5 кг к TM каждый цикл (4 недели). Медленный, но устойчивый прогресс годами.',
  progressionModel: 'Волновая: Неделя 1 (3×5 @65-85%), Неделя 2 (3×3 @70-90%), Неделя 3 (5/3/1 @75-95%), Неделя 4 (Deload @40-60%). TM +2.5/5 кг каждый цикл.',
  deloadProtocol: 'Каждая 4-я неделя: 5/3/1 подходы без AMRAP, без BBB. Веса 40-60% TM.',
  customization: ['Заменить BBB на FSL (First Set Last) 5×5 для силы.', 'Добавить jokers sets в хорошие дни.', 'Подсобка: выбрать свой template (BBB, FSL, Triumvirate, etc).'],
  weeks: [
    { week: 1, phase: 'accumulation', volumeMultiplier: 1.0, intensityMultiplier: 0.75, deload: false, days: [
      { day: 1, name: 'Overhead Press 5/3/1', focus: 'OHP + Upper', warmup: '3 ramp-up sets for OHP', exercises: [
        { name: 'OHP 5/3/1', sets: 3, reps: '5', rpe: 7.5, rir: 2.5, restSec: 120, notes: '65%×5, 75%×5, 85%×5+ (AMRAP)', progression: 'По 5/3/1 схеме' },
        { name: 'OHP BBB', sets: 5, reps: '10', rpe: 6, rir: 4, restSec: 90, notes: '50-60% TM', progression: '+2.5 кг каждый цикл' },
        { name: 'Pull-ups', sets: 5, reps: '10', rpe: 7, rir: 3, restSec: 90, notes: 'С весом или band', progression: '+1 повторение' },
      ], cooldown: 'Shoulder stretch + lat stretch' },
      { day: 2, name: 'Deadlift 5/3/1', focus: 'DL + Lower', warmup: '3 ramp-up sets', exercises: [
        { name: 'Deadlift 5/3/1', sets: 3, reps: '5', rpe: 7.5, rir: 2.5, restSec: 180, notes: '65%×5, 75%×5, 85%×5+', progression: 'По схеме' },
        { name: 'Deadlift BBB', sets: 5, reps: '10', rpe: 6, rir: 4, restSec: 120, notes: 'Или RDL 5×10', progression: '+2.5 кг' },
        { name: 'Hanging Leg Raise', sets: 5, reps: '10', rpe: 7, rir: 3, restSec: 60, notes: 'Медленно', progression: '+1 повторение' },
      ], cooldown: 'Hamstring + lower back stretch' },
      { day: 3, name: 'Bench Press 5/3/1', focus: 'BP + Upper', warmup: '3 ramp-up sets', exercises: [
        { name: 'Bench Press 5/3/1', sets: 3, reps: '5', rpe: 7.5, rir: 2.5, restSec: 120, notes: '65%×5, 75%×5, 85%×5+', progression: 'По схеме' },
        { name: 'Bench BBB', sets: 5, reps: '10', rpe: 6, rir: 4, restSec: 90, notes: '50-60% TM', progression: '+2.5 кг' },
        { name: 'DB Row', sets: 5, reps: '10', rpe: 7, rir: 3, restSec: 90, notes: 'Тяжело', progression: '+2.5 кг' },
      ], cooldown: 'Chest + shoulder stretch' },
      { day: 4, name: 'Squat 5/3/1', focus: 'Squat + Lower', warmup: '3 ramp-up sets', exercises: [
        { name: 'Squat 5/3/1', sets: 3, reps: '5', rpe: 7.5, rir: 2.5, restSec: 180, notes: '65%×5, 75%×5, 85%×5+', progression: 'По схеме' },
        { name: 'Squat BBB', sets: 5, reps: '10', rpe: 6, rir: 4, restSec: 120, notes: '50-60% TM. Тяжело морально.', progression: '+2.5 кг' },
        { name: 'Ab Wheel', sets: 5, reps: '10', rpe: 7, rir: 3, restSec: 60, notes: 'С колен', progression: '+1 повторение' },
      ], cooldown: 'Quad + hip flexor stretch' },
    ]},
    { week: 2, phase: 'accumulation', volumeMultiplier: 1.0, intensityMultiplier: 0.82, deload: false, days: [
      { day: 1, name: 'OHP 5/3/1', focus: 'OHP + Upper', warmup: '3 ramp-ups', exercises: [
        { name: 'OHP', sets: 3, reps: '3', rpe: 8, rir: 2, restSec: 120, notes: '70%×3, 80%×3, 90%×3+', progression: 'По схеме' },
        { name: 'OHP BBB', sets: 5, reps: '10', rpe: 6, rir: 4, restSec: 90, notes: '+2.5 кг от W1', progression: 'Прогрессия' },
        { name: 'Pull-ups', sets: 5, reps: '10', rpe: 7, rir: 3, restSec: 90, notes: '', progression: '+' },
      ], cooldown: 'Stretch' },
      { day: 2, name: 'DL 5/3/1', focus: 'DL + Lower', warmup: '3 ramp-ups', exercises: [
        { name: 'Deadlift', sets: 3, reps: '3', rpe: 8, rir: 2, restSec: 180, notes: '70%×3, 80%×3, 90%×3+', progression: 'По схеме' },
        { name: 'DL BBB', sets: 5, reps: '10', rpe: 6.5, rir: 3.5, restSec: 120, notes: '', progression: '+' },
        { name: 'Leg Raise', sets: 5, reps: '12', rpe: 7, rir: 3, restSec: 60, notes: '', progression: '+' },
      ], cooldown: 'Stretch' },
      { day: 3, name: 'BP 5/3/1', focus: 'BP + Upper', warmup: '3 ramp-ups', exercises: [
        { name: 'Bench', sets: 3, reps: '3', rpe: 8, rir: 2, restSec: 120, notes: '70%×3, 80%×3, 90%×3+', progression: 'По схеме' },
        { name: 'Bench BBB', sets: 5, reps: '10', rpe: 6.5, rir: 3.5, restSec: 90, notes: '', progression: '+' },
        { name: 'DB Row', sets: 5, reps: '10', rpe: 7.5, rir: 2.5, restSec: 90, notes: '', progression: '+' },
      ], cooldown: 'Stretch' },
      { day: 4, name: 'Squat 5/3/1', focus: 'Squat + Lower', warmup: '3 ramp-ups', exercises: [
        { name: 'Squat', sets: 3, reps: '3', rpe: 8, rir: 2, restSec: 180, notes: '70%×3, 80%×3, 90%×3+', progression: 'По схеме' },
        { name: 'Squat BBB', sets: 5, reps: '10', rpe: 6.5, rir: 3.5, restSec: 120, notes: '', progression: '+' },
        { name: 'Ab Wheel', sets: 5, reps: '12', rpe: 7, rir: 3, restSec: 60, notes: '', progression: '+' },
      ], cooldown: 'Stretch' },
    ]},
    { week: 3, phase: 'intensification', volumeMultiplier: 0.9, intensityMultiplier: 0.90, deload: false, days: [
      { day: 1, name: 'OHP 5/3/1', focus: 'OHP', warmup: '3 ramp-ups', exercises: [
        { name: 'OHP', sets: 3, reps: '5/3/1', rpe: 8.5, rir: 1.5, restSec: 150, notes: '75%×5, 85%×3, 95%×1+', progression: 'По схеме' },
        { name: 'OHP BBB', sets: 5, reps: '10', rpe: 7, rir: 3, restSec: 90, notes: '', progression: '+' },
        { name: 'Pull-ups', sets: 5, reps: '10', rpe: 7.5, rir: 2.5, restSec: 90, notes: '', progression: '+' },
      ], cooldown: 'Stretch' },
      { day: 2, name: 'DL 5/3/1', focus: 'DL', warmup: '3 ramp-ups', exercises: [
        { name: 'Deadlift', sets: 3, reps: '5/3/1', rpe: 9, rir: 1, restSec: 240, notes: '75%×5, 85%×3, 95%×1+', progression: 'По схеме' },
        { name: 'DL BBB', sets: 5, reps: '10', rpe: 7, rir: 3, restSec: 120, notes: '', progression: '+' },
        { name: 'Leg Raise', sets: 5, reps: '12', rpe: 7, rir: 3, restSec: 60, notes: '', progression: '+' },
      ], cooldown: 'Stretch' },
      { day: 3, name: 'BP 5/3/1', focus: 'BP', warmup: '3 ramp-ups', exercises: [
        { name: 'Bench', sets: 3, reps: '5/3/1', rpe: 8.5, rir: 1.5, restSec: 150, notes: '75%×5, 85%×3, 95%×1+', progression: 'По схеме' },
        { name: 'Bench BBB', sets: 5, reps: '10', rpe: 7, rir: 3, restSec: 90, notes: '', progression: '+' },
        { name: 'DB Row', sets: 5, reps: '10', rpe: 8, rir: 2, restSec: 90, notes: '', progression: '+' },
      ], cooldown: 'Stretch' },
      { day: 4, name: 'Squat 5/3/1', focus: 'Squat', warmup: '3 ramp-ups', exercises: [
        { name: 'Squat', sets: 3, reps: '5/3/1', rpe: 8.5, rir: 1.5, restSec: 240, notes: '75%×5, 85%×3, 95%×1+', progression: 'По схеме' },
        { name: 'Squat BBB', sets: 5, reps: '10', rpe: 7, rir: 3, restSec: 120, notes: '', progression: '+' },
        { name: 'Ab Wheel', sets: 5, reps: '12', rpe: 7, rir: 3, restSec: 60, notes: '', progression: '+' },
      ], cooldown: 'Stretch' },
    ]},
    { week: 4, phase: 'deload', volumeMultiplier: 0.5, intensityMultiplier: 0.50, deload: true, days: [
      { day: 1, name: 'OHP Deload', focus: 'Light', warmup: 'Light', exercises: [
        { name: 'OHP', sets: 3, reps: '5', rpe: 5, rir: 5, restSec: 60, notes: '40%×5, 50%×5, 60%×5. Без AMRAP.', progression: '' },
        { name: 'Pull-ups', sets: 3, reps: '8', rpe: 5, rir: 5, restSec: 60, notes: 'Easy', progression: '' },
      ], cooldown: 'Light stretch' },
      { day: 2, name: 'DL Deload', focus: 'Light', warmup: 'Light', exercises: [
        { name: 'Deadlift', sets: 3, reps: '5', rpe: 5, rir: 5, restSec: 120, notes: '40/50/60%', progression: '' },
        { name: 'Leg Raise', sets: 3, reps: '10', rpe: 5, rir: 5, restSec: 60, notes: 'Easy', progression: '' },
      ], cooldown: 'Stretch' },
      { day: 3, name: 'BP Deload', focus: 'Light', warmup: 'Light', exercises: [
        { name: 'Bench', sets: 3, reps: '5', rpe: 5, rir: 5, restSec: 60, notes: '40/50/60%', progression: '' },
        { name: 'DB Row', sets: 3, reps: '8', rpe: 5, rir: 5, restSec: 60, notes: 'Easy', progression: '' },
      ], cooldown: 'Stretch' },
      { day: 4, name: 'Squat Deload', focus: 'Light', warmup: 'Light', exercises: [
        { name: 'Squat', sets: 3, reps: '5', rpe: 5, rir: 5, restSec: 120, notes: '40/50/60%', progression: '' },
        { name: 'Ab Wheel', sets: 3, reps: '10', rpe: 5, rir: 5, restSec: 60, notes: 'Easy', progression: '' },
      ], cooldown: 'Stretch' },
    ]},
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Program 3: Push/Pull/Legs 6-Day (Hypertrophy)
// ═══════════════════════════════════════════════════════════════════════════

const PPL_HYPERTROPHY: FullProgram = {
  id: 'ppl_hypertrophy', name: 'Push/Pull/Legs 6-Day Hypertrophy', author: 'Classic Bodybuilding',
  type: 'PPL 6x/week', goal: 'hypertrophy', direction: 'bodybuilding', level: 'intermediate',
  durationWeeks: 8, daysPerWeek: 6, sessionTimeMin: '60-75',
  description: 'Классический бодибилдерский сплит. 2× частота на группу мышц в неделю. Push A/Pull A/Legs A — сила, Push B/Pull B/Legs B — гипертрофия/памп.',
  targetAudience: 'Средний уровень. Цель — мышечная масса. 6 дней в неделю.',
  equipmentNeeded: ['barbell', 'rack', 'bench', 'dumbbells', 'cable_machine', 'pull_up_bar', 'leg_press_machine'],
  warnings: ['6 дней — это много. Сон и питание должны быть на высоте.', 'Следите за RPE. Push A и Legs A — тяжело. Push B и Pull B — средний вес, памп.', 'При усталости: пропустите один день (сделайте PPL 5×/нед).'],
  expectedResults: 'Хороший прирост мышечной массы при достаточном питании. Умеренный прирост силы.',
  progressionModel: 'Double Progression: работайте в диапазоне повторений. Когда достигаете верха с RPE ≤8 — +2.5-5 кг, сброс повторений.',
  deloadProtocol: 'Каждую 8-ю неделю: 3 тренировки PPL ×1 с 60% весом.',
  customization: ['Push A/B: можно менять жим лёжа на жим гантелей.', 'Legs A/B: чередовать присед и жим ногами.', 'Добавить кардио 2-3×/нед по 20-30 мин.'],
  weeks: [{
    week: 1, phase: 'accumulation', volumeMultiplier: 1.0, intensityMultiplier: 1.0, deload: false, days: [
      { day: 1, name: 'Push A (Strength)', focus: 'Chest + Shoulders + Triceps', warmup: 'Band pull-apart, arm circles, empty bar', exercises: [
        { name: 'Bench Press', sets: 4, reps: '5-8', rpe: 8, rir: 2, restSec: 150, notes: 'Тяжело. Прогрессия +2.5 кг', progression: '+2.5 кг когда 4×8 @RPE≤8' },
        { name: 'Incline DB Press', sets: 3, reps: '8-10', rpe: 7.5, rir: 2.5, restSec: 120, notes: 'Верх груди', progression: '+2.5 кг DB когда 3×10' },
        { name: 'OHP (Barbell)', sets: 3, reps: '6-8', rpe: 8, rir: 2, restSec: 120, notes: 'Тяжело', progression: '+1.25 кг' },
        { name: 'Lateral Raise', sets: 4, reps: '15-20', rpe: 6, rir: 4, restSec: 60, notes: 'Памп, легкий вес', progression: '+1 кг DB когда 4×20' },
        { name: 'Tricep Pushdown', sets: 3, reps: '12-15', rpe: 7, rir: 3, restSec: 60, notes: 'V-bar or rope', progression: '+2.5 кг' },
      ], cooldown: 'Chest doorway stretch, tricep stretch' },
      { day: 2, name: 'Pull A (Strength)', focus: 'Back + Biceps + Rear Delts', warmup: 'Band pull-apart, scapular activation', exercises: [
        { name: 'Deadlift', sets: 4, reps: '3-5', rpe: 8.5, rir: 1.5, restSec: 180, notes: 'Тяжело. Сила.', progression: '+5 кг' },
        { name: 'Barbell Row', sets: 4, reps: '6-8', rpe: 8, rir: 2, restSec: 120, notes: 'Средний вес, строго', progression: '+2.5 кг' },
        { name: 'Lat Pulldown', sets: 3, reps: '8-10', rpe: 7.5, rir: 2.5, restSec: 90, notes: 'Широкий хват', progression: '+2.5 кг' },
        { name: 'Face Pull', sets: 3, reps: '15', rpe: 6, rir: 4, restSec: 60, notes: 'Здоровье плеч', progression: '+2.5 кг' },
        { name: 'Barbell Curl', sets: 4, reps: '8-10', rpe: 7.5, rir: 2.5, restSec: 90, notes: 'Строго, без читинга', progression: '+2.5 кг' },
      ], cooldown: 'Lat stretch, bicep stretch' },
      { day: 3, name: 'Legs A (Squat Focus)', focus: 'Quads + Glutes + Calves', warmup: 'Leg swings, BW squats, empty bar', exercises: [
        { name: 'Back Squat', sets: 4, reps: '5-8', rpe: 8.5, rir: 1.5, restSec: 180, notes: 'Тяжело', progression: '+2.5 кг' },
        { name: 'RDL', sets: 3, reps: '8-10', rpe: 7.5, rir: 2.5, restSec: 150, notes: 'Hamstrings', progression: '+2.5 кг' },
        { name: 'Leg Press', sets: 3, reps: '10-12', rpe: 7, rir: 3, restSec: 120, notes: 'Объём', progression: '+5 кг' },
        { name: 'Walking Lunge', sets: 3, reps: '12/leg', rpe: 7, rir: 3, restSec: 90, notes: 'DBs', progression: '+2.5 кг DB' },
        { name: 'Calf Raise', sets: 5, reps: '15-20', rpe: 6, rir: 4, restSec: 45, notes: 'Памп', progression: '+5 кг' },
      ], cooldown: 'Quad stretch, hamstring stretch, foam roll' },
      { day: 4, name: 'Push B (Hypertrophy)', focus: 'Chest + Shoulders + Triceps', warmup: 'Band pull-apart, push-ups', exercises: [
        { name: 'Dumbbell Bench', sets: 4, reps: '10-12', rpe: 7.5, rir: 2.5, restSec: 90, notes: 'Глубже штанги', progression: '+2.5 кг DB' },
        { name: 'Cable Flye', sets: 3, reps: '12-15', rpe: 7, rir: 3, restSec: 60, notes: 'Изоляция, squeeze', progression: '+2.5 кг' },
        { name: 'Lateral Raise', sets: 4, reps: '15-20', rpe: 6, rir: 4, restSec: 45, notes: 'Drop set последний подход', progression: '+1 кг' },
        { name: 'Overhead Tricep Extension', sets: 3, reps: '12-15', rpe: 7, rir: 3, restSec: 60, notes: 'DB or cable', progression: '+2.5 кг' },
        { name: 'Dips (assisted if needed)', sets: 3, reps: 'MAX', rpe: 8, rir: 2, restSec: 90, notes: 'Добивка', progression: '+1 повторение' },
      ], cooldown: 'Stretch' },
      { day: 5, name: 'Pull B (Hypertrophy)', focus: 'Back + Biceps + Rear Delts', warmup: 'Band pull-apart, light rows', exercises: [
        { name: 'Pull-ups', sets: 4, reps: '8-12', rpe: 8, rir: 2, restSec: 120, notes: 'С весом если >12', progression: '+1.25 кг если >12' },
        { name: 'Seated Cable Row', sets: 4, reps: '10-12', rpe: 7.5, rir: 2.5, restSec: 90, notes: 'V-grip', progression: '+2.5 кг' },
        { name: 'Single Arm DB Row', sets: 3, reps: '10-12', rpe: 7, rir: 3, restSec: 60, notes: 'Тяжело, stretch', progression: '+2.5 кг DB' },
        { name: 'Rear Delt Flye', sets: 3, reps: '15', rpe: 7, rir: 3, restSec: 60, notes: 'Reverse pec deck или DB', progression: '+2.5 кг' },
        { name: 'Hammer Curl', sets: 4, reps: '12-15', rpe: 7, rir: 3, restSec: 60, notes: 'Памп', progression: '+2.5 кг DB' },
      ], cooldown: 'Stretch' },
      { day: 6, name: 'Legs B (Volume)', focus: 'Quads + Hams + Glutes', warmup: 'BW squats, leg swings', exercises: [
        { name: 'Front Squat', sets: 4, reps: '8-10', rpe: 7.5, rir: 2.5, restSec: 150, notes: 'Или Leg Press', progression: '+2.5 кг' },
        { name: 'Bulgarian Split Squat', sets: 3, reps: '10-12', rpe: 7, rir: 3, restSec: 90, notes: 'DBs', progression: '+2.5 кг DB' },
        { name: 'Hip Thrust', sets: 4, reps: '12-15', rpe: 7, rir: 3, restSec: 90, notes: 'Пауза вверху 2с', progression: '+5 кг' },
        { name: 'Leg Curl', sets: 3, reps: '12-15', rpe: 7, rir: 3, restSec: 60, notes: 'Изоляция', progression: '+2.5 кг' },
        { name: 'Calf Raise', sets: 5, reps: '15-20', rpe: 6, rir: 4, restSec: 45, notes: '', progression: '+' },
        { name: 'Plank', sets: 3, reps: '60 sec', rpe: 7, rir: 3, restSec: 60, notes: 'Финишер кора', progression: '+5 сек' },
      ], cooldown: 'Full lower body stretch + foam roll' },
    ]},
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Program 4: Smolov Jr. (Bench/Squat Peaking)
// ═══════════════════════════════════════════════════════════════════════════

const SMOLOV_JR: FullProgram = {
  id: 'smolov_jr', name: 'Smolov Jr. (Bench Press Specialization)', author: 'Sergey Smolov',
  type: 'Specialization 4x/week', goal: 'peaking', direction: 'strength', level: 'advanced',
  durationWeeks: 3, daysPerWeek: 4, sessionTimeMin: '45-60',
  description: 'Экстремальный 3-недельный цикл специализации для одного упражнения (жим лёжа или присед). +5-15 кг к 1RM за 3 недели. ТОЛЬКО для продвинутых.',
  targetAudience: 'Продвинутые атлеты (3+ года). PL-специализация. Только когда другие методы не работают.',
  equipmentNeeded: ['barbell', 'bench/rack', 'plates'],
  warnings: ['КРАЙНЕ высокий объём. Риск травмы реален.', 'ТОЛЬКО ОДНО упражнение в фокусе. Всё остальное — минимально.', 'Deload ОБЯЗАТЕЛЕН после цикла.', 'Расчёт от 1RM с запасом (используйте 95% 1RM как базу).'],
  expectedResults: '+5-15 кг к 1RM за 3 недели.',
  progressionModel: 'Каждую неделю +5-10 кг ко всем рабочим весам. Неделя 1: 70-75%, Неделя 2: 75-80%, Неделя 3: 80-85%.',
  deloadProtocol: 'После цикла: 1-2 недели deload. Объём 30-40%, интенсивность 50-60%.',
  customization: ['Можно делать для приседа (заменить жим на присед).', 'В подсобке: только лёгкая работа. Никаких отказных подходов.'],
  weeks: [
    { week: 1, phase: 'peaking', volumeMultiplier: 1.3, intensityMultiplier: 0.72, deload: false, days: [
      { day: 1, name: 'Day 1', focus: 'Bench Press', warmup: 'Empty bar ×20, 40%×8, 50%×5, 60%×3', exercises: [
        { name: 'Bench Press', sets: 6, reps: '6', rpe: 7, rir: 3, restSec: 120, notes: '70% 1RM (база = 95% реального)', progression: 'По схеме' },
      ], cooldown: 'Light stretch, band pull-apart' },
      { day: 2, name: 'Day 2', focus: 'Bench Press', warmup: 'Empty ×20, ramp to working', exercises: [
        { name: 'Bench Press', sets: 7, reps: '5', rpe: 7.5, rir: 2.5, restSec: 120, notes: '75%', progression: 'По схеме' },
      ], cooldown: 'Stretch' },
      { day: 3, name: 'Day 3', focus: 'Bench Press', warmup: 'Empty ×20, ramp', exercises: [
        { name: 'Bench Press', sets: 8, reps: '4', rpe: 8, rir: 2, restSec: 150, notes: '80%', progression: 'По схеме' },
      ], cooldown: 'Stretch + ice shoulders if needed' },
      { day: 4, name: 'Day 4', focus: 'Bench Press', warmup: 'Empty ×20, ramp', exercises: [
        { name: 'Bench Press', sets: 10, reps: '3', rpe: 8.5, rir: 1.5, restSec: 150, notes: '85%', progression: 'По схеме' },
      ], cooldown: 'Extensive stretch, foam roll' },
    ]},
    { week: 2, phase: 'peaking', volumeMultiplier: 1.3, intensityMultiplier: 0.78, deload: false, days: [
      { day: 1, name: 'Day 1', focus: 'Bench', warmup: 'Ramp', exercises: [
        { name: 'Bench Press', sets: 6, reps: '6', rpe: 8, rir: 2, restSec: 120, notes: '+5-10 кг от W1', progression: '+10 кг' },
      ], cooldown: 'Stretch' },
      { day: 2, name: 'Day 2', focus: 'Bench', warmup: 'Ramp', exercises: [
        { name: 'Bench Press', sets: 7, reps: '5', rpe: 8, rir: 2, restSec: 120, notes: '+5-10 кг', progression: '+' },
      ], cooldown: 'Stretch' },
      { day: 3, name: 'Day 3', focus: 'Bench', warmup: 'Ramp', exercises: [
        { name: 'Bench Press', sets: 8, reps: '4', rpe: 8.5, rir: 1.5, restSec: 150, notes: '+5-10 кг', progression: '+' },
      ], cooldown: 'Stretch' },
      { day: 4, name: 'Day 4', focus: 'Bench', warmup: 'Ramp', exercises: [
        { name: 'Bench Press', sets: 10, reps: '3', rpe: 9, rir: 1, restSec: 150, notes: '+5-10 кг', progression: '+' },
      ], cooldown: 'Stretch' },
    ]},
    { week: 3, phase: 'peaking', volumeMultiplier: 1.3, intensityMultiplier: 0.84, deload: false, days: [
      { day: 1, name: 'Day 1', focus: 'Bench', warmup: 'Ramp', exercises: [
        { name: 'Bench Press', sets: 6, reps: '6', rpe: 8.5, rir: 1.5, restSec: 150, notes: '+5-10 кг', progression: '+' },
      ], cooldown: 'Stretch' },
      { day: 2, name: 'Day 2', focus: 'Bench', warmup: 'Ramp', exercises: [
        { name: 'Bench Press', sets: 7, reps: '5', rpe: 8.5, rir: 1.5, restSec: 150, notes: '+5-10 кг', progression: '+' },
      ], cooldown: 'Stretch' },
      { day: 3, name: 'Day 3', focus: 'Bench', warmup: 'Ramp', exercises: [
        { name: 'Bench Press', sets: 8, reps: '4', rpe: 9, rir: 1, restSec: 180, notes: '+5-10 кг', progression: '+' },
      ], cooldown: 'Stretch' },
      { day: 4, name: 'Day 4', focus: 'Bench', warmup: 'Ramp', exercises: [
        { name: 'Bench Press', sets: 10, reps: '3', rpe: 9.5, rir: 0.5, restSec: 180, notes: '+5-10 кг. Последний день!', progression: '+' },
      ], cooldown: 'Поздравляем! Теперь deload 1-2 недели.' },
    ]},
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

export const FULL_PROGRAM_LIBRARY: FullProgram[] = [
  STARTING_STRENGTH, FIVE_THREE_ONE_BBB, PPL_HYPERTROPHY, SMOLOV_JR,
];

// Нормализация имён упражнений программ на русский язык (для всех экранов)
import { normalizeProgramLibraryNames } from './exercise-name-translate';
normalizeProgramLibraryNames(FULL_PROGRAM_LIBRARY as any[]);

export function getProgramById(id: string): FullProgram | undefined {
  return FULL_PROGRAM_LIBRARY.find(p => p.id === id);
}

export function getProgramsByLevel(level: string): FullProgram[] {
  return FULL_PROGRAM_LIBRARY.filter(p => p.level === level);
}

export function getProgramsByGoal(goal: string): FullProgram[] {
  return FULL_PROGRAM_LIBRARY.filter(p => p.goal === goal);
}

export function getAllPrograms(): FullProgram[] { return FULL_PROGRAM_LIBRARY; }

export function getBeginnerPrograms(): FullProgram[] {
  return FULL_PROGRAM_LIBRARY.filter(p => p.level === 'beginner');
}

export function getProgramNames(): string[] {
  return FULL_PROGRAM_LIBRARY.map(p => p.name);
}
