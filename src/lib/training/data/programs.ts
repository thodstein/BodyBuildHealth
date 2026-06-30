export interface WeeklyWorkoutDay {
  id: string;
  name: string;
  exercises: Array<{
    id: string;
    name: string;
    sets: number;
    reps: string; // e.g., "5x5", "3x10"
    rir: number; // Reps in Reserve
    weight?: number; // in kg, optional for bodyweight
    notes?: string;
  }>;
}

export interface PresetProgram {
  id: string;
  name: string;
  description: string;
  daysPerWeek: number;
  level: 'beginner' | 'intermediate' | 'advanced' | 'enhanced';
  goal: 'strength' | 'hypertrophy' | 'powerlifting' | 'bodybuilding' | 'athletic' | 'rehab' | 'peaking';
  weeklyTemplate: WeeklyWorkoutDay[];
}

// Powerlifting Presets
export const POWERLIFTING_PROGRAMS: PresetProgram[] = [
  {
    id: 'pl_3day_hlm',
    name: 'PL 3-Day Heavy/Light/Medium',
    description: 'Традиционная пауэрлифтинговая программа с акцентом на присед, жим лежа и становую тягу. Вариации интенсивности на протяжении недели.',
    daysPerWeek: 3,
    level: 'intermediate',
    goal: 'powerlifting',
    weeklyTemplate: [
      {
        id: 'day1',
        name: 'День 1: Тяжелый (Присед)',
        exercises: [
          { id: 'back_squat', name: 'Присед со штангой на спине', sets: 5, reps: '5', rir: 2, weight: 0 }, // weight will be set from profile
          { id: 'bench_press', name: 'Жим лежа', sets: 5, reps: '5', rir: 2, weight: 0 },
          { id: 'deadlift', name: 'Становая тяга', sets: 1, reps: '5', rir: 2, weight: 0 },
          { id: 'plank', name: 'Планка', sets: 3, reps: '60 сек', rir: 0 }
        ]
      },
      {
        id: 'day2',
        name: 'День 2: Легкий (Жим)',
        exercises: [
          { id: 'back_squat', name: 'Присед со штангой на спине', sets: 3, reps: '8', rir: 3, weight: 0 },
          { id: 'bench_press', name: 'Жим лежа', sets: 5, reps: '5', rir: 2, weight: 0 },
          { id: 'deadlift', name: 'Становая тяга', sets: 3, reps: '5', rir: 3, weight: 0 },
          { id: 'overhead_press', name: 'Жим штанги стоя', sets: 3, reps: '8', rir: 3, weight: 0 }
        ]
      },
      {
        id: 'day3',
        name: 'День 3: Средний (Становая)',
        exercises: [
          { id: 'back_squat', name: 'Присед со штангой на спине', sets: 4, reps: '6', rir: 2, weight: 0 },
          { id: 'bench_press', name: 'Жим лежа', sets: 4, reps: '6', rir: 2, weight: 0 },
          { id: 'deadlift', name: 'Становая тяга', sets: 5, reps: '5', rir: 2, weight: 0 },
          { id: 'weighted_pullup', name: 'Подтягивания с весом', sets: 3, reps: '6', rir: 2, weight: 0 }
        ]
      }
    ]
  }
];

// Bodybuilding Presets
export const BODYBUILDING_PROGRAMS: PresetProgram[] = [
  {
    id: 'bb_ppl_5day',
    name: 'PPL 5-Day (Push/Pull/Legs)',
    description: 'Классический сплит для hypertrophy: толчка, тяги и ног с высоким объемом и умеренной интенсивностью.',
    daysPerWeek: 5,
    level: 'intermediate',
    goal: 'bodybuilding',
    weeklyTemplate: [
      {
        id: 'day1',
        name: 'День 1: Push (Грудь, Плечи, Трицепс)',
        exercises: [
          { id: 'bench_press', name: 'Жим лежа', sets: 4, reps: '8-12', rir: 2, weight: 0 },
          { id: 'incline_dumbbell_press', name: 'Жим гантелей на наклонной скамье', sets: 3, reps: '10-15', rir: 2, weight: 0 },
          { id: 'overhead_press', name: 'Жим штанги стоя', sets: 3, reps: '8-12', rir: 2, weight: 0 },
          { id: 'lateral_raise', name: 'Махи в стороны', sets: 3, reps: '12-15', rir: 2, weight: 0 },
          { id: 'triceps_pushdown', name: 'Тяга троса на трицепс', sets: 3, reps: '12-15', rir: 2, weight: 0 }
        ]
      },
      {
        id: 'day2',
        name: 'День 2: Pull (Спина, Бицепс)',
        exercises: [
          { id: 'pullup', name: 'Подтягивания', sets: 4, reps: '6-10', rir: 2, weight: 0 },
          { id: 'barbell_row', name: 'Тяга штанги в наклоне', sets: 4, reps: '8-12', rir: 2, weight: 0 },
          { id: 'face_pull', name: 'Лицевая тяга', sets: 3, reps: '15-20', rir: 2, weight: 0 },
          { id: 'bicep_curl', name: 'Подъем штанги на бицепс', sets: 3, reps: '10-15', rir: 2, weight: 0 },
          { id: 'hammer_curl', name: 'Молотковый подъем', sets: 3, reps: '10-15', rir: 2, weight: 0 }
        ]
      },
      {
        id: 'day3',
        name: 'День 3: Legs (Ноги)',
        exercises: [
          { id: 'back_squat', name: 'Присед со штангой на спине', sets: 4, reps: '8-12', rir: 2, weight: 0 },
          { id: 'leg_press', name: 'Жим ногами', sets: 3, reps: '10-15', rir: 2, weight: 0 },
          { id: 'leg_curl', name: 'Сгибание ног', sets: 3, reps: '10-15', rir: 2, weight: 0 },
          { id: 'standing_calf_raise', name: 'Подъем на носки стоя', sets: 4, reps: '15-20', rir: 2, weight: 0 },
          { id: 'plank', name: 'Планка', sets: 3, reps: '45 сек', rir: 0 }
        ]
      },
      {
        id: 'day4',
        name: 'День 4: Push (Вторичный)',
        exercises: [
          { id: 'incline_barbell_press', name: 'Жим штанги на наклонной скамье', sets: 3, reps: '10-15', rir: 2, weight: 0 },
          { id: 'dumbbell_press', name: 'Жим гантелей лежа', sets: 3, reps: '12-15', rir: 2, weight: 0 },
          { id: 'lateral_raise', name: 'Махи в стороны', sets: 2, reps: '15-20', rir: 2, weight: 0 },
          { id: 'triceps_extension', name: 'Разгибание рук над головой', sets: 3, reps: '12-15', rir: 2, weight: 0 }
        ]
      },
      {
        id: 'day5',
        name: 'День 5: Pull (Вторичный)',
        exercises: [
          { id: 'lat_pulldown', name: 'Тяга верхнего блока', sets: 4, reps: '8-12', rir: 2, weight: 0 },
          { id: 'seated_row', name: 'Тяга сидя', sets: 4, reps: '8-12', rir: 2, weight: 0 },
          { id: 'deadlift', name: 'Становая тяга (легкая)', sets: 3, reps: '10-15', rir: 3, weight: 0 },
          { id: 'bicep_curl', name: 'Подъем штанги на бицепс', sets: 2, reps: '15-20', rir: 2, weight: 0 }
        ]
      }
    ]
  }
];
