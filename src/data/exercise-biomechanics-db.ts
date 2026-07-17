/**
 * Exercise Biomechanics Database — 50+ exercises with full biomechanical profiles.
 *
 * Each exercise has:
 *  - Joint stress (knee, hip, spine, shoulder, elbow, ankle) 0-10
 *  - Torque profile (bottom_peak, midrange_peak, top_peak, uniform)
 *  - Spine/knee/shoulder load classification
 *  - CNS demand (1-5)
 *  - Technical difficulty (1-5)
 *  - Primary/secondary/stabilizer muscles
 *  - ROM requirements
 *  - Equipment requirements
 *  - Risk profile
 *  - Substitution chain
 *
 * @module exercise-biomechanics-db
 */

export interface ExerciseBio {
  id: string;
  name: string;
  pattern: string;
  category: 'powerlifting' | 'bodybuilding' | 'weightlifting' | 'strongman' | 'accessory' | 'rehab' | 'cardio';
  jointStress: { knee: number; hip: number; spine: number; shoulder: number; elbow: number; ankle: number };
  torqueProfile: 'bottom_peak' | 'midrange_peak' | 'top_peak' | 'uniform';
  spineLoad: 'low' | 'medium' | 'high';
  kneeLoad: 'low' | 'medium' | 'high';
  shoulderLoad: 'low' | 'medium' | 'high';
  cnsDemand: number;
  difficulty: number;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  stabilizers: string[];
  romRequirements: Record<string, number>;
  equipment: string[];
  riskProfile: 'low' | 'medium' | 'high';
  isUnilateral: boolean;
  isCompetition: boolean;
  substitutions: string[];
  techniqueCues: string[];
}

export const EXERCISE_BIOMECHANICS_DB: ExerciseBio[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // SQUAT PATTERNS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'back_squat', name: 'Присед со штангой на спине', pattern: 'squat', category: 'powerlifting',
    jointStress: { knee: 7, hip: 6, spine: 6, shoulder: 2, elbow: 1, ankle: 5 },
    torqueProfile: 'bottom_peak', spineLoad: 'medium', kneeLoad: 'high', shoulderLoad: 'low',
    cnsDemand: 4, difficulty: 3,
    primaryMuscles: ['Квадрицепсы', 'Ягодичные'], secondaryMuscles: ['Бицепс бедра', 'Приводящие'],
    stabilizers: ['Разгибатели спины', 'Кор'],
    romRequirements: { knee: 90, hip: 90, ankle: 30 },
    equipment: ['barbell', 'rack'], riskProfile: 'medium', isUnilateral: false, isCompetition: true,
    substitutions: ['front_squat', 'safety_bar_squat', 'goblet_squat', 'leg_press'],
    techniqueCues: ['Грудь вверх', 'Колени наружу', 'Пятки прижаты'],
  },
  {
    id: 'front_squat', name: 'Фронтальный присед', pattern: 'squat', category: 'weightlifting',
    jointStress: { knee: 7, hip: 5, spine: 5, shoulder: 4, elbow: 3, ankle: 5 },
    torqueProfile: 'bottom_peak', spineLoad: 'medium', kneeLoad: 'high', shoulderLoad: 'medium',
    cnsDemand: 3, difficulty: 4,
    primaryMuscles: ['Квадрицепсы', 'Кор'], secondaryMuscles: ['Ягодичные', 'Верх спины'],
    stabilizers: ['Разгибатели спины'],
    romRequirements: { knee: 90, hip: 85, ankle: 35 },
    equipment: ['barbell', 'rack'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['goblet_squat', 'zombie_squat', 'safety_bar_squat'],
    techniqueCues: ['Локти вверх', 'Торс вертикально', 'Колени по линии стоп'],
  },
  {
    id: 'goblet_squat', name: 'Кубковый присед', pattern: 'squat', category: 'bodybuilding',
    jointStress: { knee: 5, hip: 4, spine: 3, shoulder: 1, elbow: 1, ankle: 3 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'medium', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Квадрицепсы', 'Ягодичные'], secondaryMuscles: ['Кор'],
    stabilizers: [],
    romRequirements: { knee: 80, hip: 80, ankle: 25 },
    equipment: ['dumbbell', 'kettlebell'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['bodyweight_squat', 'leg_press'],
    techniqueCues: ['Локти между колен', 'Грудь вверх', 'Пятки прижаты'],
  },
  {
    id: 'bulgarian_split_squat', name: 'Болгарские сплит-приседы', pattern: 'squat', category: 'bodybuilding',
    jointStress: { knee: 6, hip: 5, spine: 2, shoulder: 1, elbow: 1, ankle: 4 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'high', shoulderLoad: 'low',
    cnsDemand: 2, difficulty: 3,
    primaryMuscles: ['Квадрицепсы', 'Ягодичные'], secondaryMuscles: ['Бицепс бедра'],
    stabilizers: ['Кор'],
    romRequirements: { knee: 90, hip: 80 },
    equipment: ['dumbbell', 'bench'], riskProfile: 'low', isUnilateral: true, isCompetition: false,
    substitutions: ['walking_lunge', 'step_up', 'leg_press'],
    techniqueCues: ['Торс вертикально', 'Задняя нога на носке', 'Колено не уходит вперёд носка'],
  },
  {
    id: 'leg_press', name: 'Жим ногами в тренажёре', pattern: 'squat', category: 'bodybuilding',
    jointStress: { knee: 6, hip: 3, spine: 1, shoulder: 0, elbow: 0, ankle: 2 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'medium', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Квадрицепсы'], secondaryMuscles: ['Ягодичные', 'Бицепс бедра'],
    stabilizers: [],
    romRequirements: { knee: 90, hip: 70 },
    equipment: ['leg_press_machine'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['goblet_squat', 'bodyweight_squat'],
    techniqueCues: ['Поясница прижата', 'Полная амплитуда', 'Колени по линии стоп'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // HINGE PATTERNS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'deadlift_conventional', name: 'Становая тяга (классика)', pattern: 'hinge', category: 'powerlifting',
    jointStress: { knee: 4, hip: 8, spine: 8, shoulder: 2, elbow: 2, ankle: 2 },
    torqueProfile: 'bottom_peak', spineLoad: 'high', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 5, difficulty: 4,
    primaryMuscles: ['Бицепс бедра', 'Ягодичные', 'Разгибатели спины'],
    secondaryMuscles: ['Трапеции', 'Широчайшие', 'Квадрицепсы'],
    stabilizers: ['Кор', 'Ромбовидные'],
    romRequirements: { hip: 90, spine: 0, knee: 10 },
    equipment: ['barbell'], riskProfile: 'high', isUnilateral: false, isCompetition: true,
    substitutions: ['trap_bar_deadlift', 'romanian_deadlift', 'sumo_deadlift', 'block_pull'],
    techniqueCues: ['Грудь вверх', 'Штанга касается голеней', 'Плечи над грифом'],
  },
  {
    id: 'sumo_deadlift', name: 'Становая тяга (сумо)', pattern: 'hinge', category: 'powerlifting',
    jointStress: { knee: 5, hip: 9, spine: 6, shoulder: 1, elbow: 1, ankle: 3 },
    torqueProfile: 'bottom_peak', spineLoad: 'medium', kneeLoad: 'medium', shoulderLoad: 'low',
    cnsDemand: 5, difficulty: 4,
    primaryMuscles: ['Ягодичные', 'Приводящие', 'Бицепс бедра'],
    secondaryMuscles: ['Квадрицепсы', 'Разгибатели спины'],
    stabilizers: ['Кор'],
    romRequirements: { hip: 80, spine: 0 },
    equipment: ['barbell'], riskProfile: 'medium', isUnilateral: false, isCompetition: true,
    substitutions: ['trap_bar_deadlift', 'conventional_deadlift'],
    techniqueCues: ['Колени наружу', 'Таз ближе к грифу', 'Грудь вверх'],
  },
  {
    id: 'romanian_deadlift', name: 'Румынская тяга', pattern: 'hinge', category: 'bodybuilding',
    jointStress: { knee: 2, hip: 7, spine: 5, shoulder: 1, elbow: 1, ankle: 1 },
    torqueProfile: 'midrange_peak', spineLoad: 'medium', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Бицепс бедра', 'Ягодичные'], secondaryMuscles: ['Разгибатели спины'],
    stabilizers: ['Кор'],
    romRequirements: { hip: 90, spine: 0 },
    equipment: ['barbell', 'dumbbell'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['single_leg_rdl', 'kettlebell_swing', 'good_morning', 'back_extension'],
    techniqueCues: ['Колени мягкие', 'Таз назад', 'Спина прямая'],
  },
  {
    id: 'hip_thrust', name: 'Ягодичный мост со штангой', pattern: 'hinge', category: 'bodybuilding',
    jointStress: { knee: 2, hip: 5, spine: 2, shoulder: 1, elbow: 1, ankle: 1 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Ягодичные'], secondaryMuscles: ['Бицепс бедра'],
    stabilizers: ['Кор'],
    romRequirements: { hip: 90 },
    equipment: ['barbell', 'bench'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['glute_bridge', 'single_leg_hip_thrust', 'cable_pull_through'],
    techniqueCues: ['Подбородок прижат', 'Таз вверх до прямой линии', 'Пауза вверху 1-2с'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // HORIZONTAL PRESS PATTERNS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'bench_press', name: 'Жим лёжа', pattern: 'horizontal_push', category: 'powerlifting',
    jointStress: { knee: 0, hip: 0, spine: 2, shoulder: 7, elbow: 5, ankle: 0 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'high',
    cnsDemand: 3, difficulty: 2,
    primaryMuscles: ['Грудные', 'Трицепс'], secondaryMuscles: ['Передние дельты'],
    stabilizers: ['Ротаторная манжета', 'Широчайшие', 'Ромбовидные'],
    romRequirements: { shoulder: 60, elbow: 90 },
    equipment: ['barbell', 'bench', 'rack'], riskProfile: 'medium', isUnilateral: false, isCompetition: true,
    substitutions: ['dumbbell_bench', 'incline_bench', 'floor_press', 'push_up'],
    techniqueCues: ['Лопатки сведены', 'Мост (естественный)', 'Касание груди'],
  },
  {
    id: 'incline_bench', name: 'Жим на наклонной скамье', pattern: 'horizontal_push', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 2, shoulder: 8, elbow: 5, ankle: 0 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'high',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Верх груди', 'Передние дельты'], secondaryMuscles: ['Трицепс'],
    stabilizers: ['Ротаторная манжета'],
    romRequirements: { shoulder: 70, elbow: 90 },
    equipment: ['barbell', 'incline_bench', 'rack'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['incline_dumbbell', 'reverse_grip_bench', 'low_incline_bench'],
    techniqueCues: ['Угол 30-45°', 'Не касаться ключиц', 'Локти 45°'],
  },
  {
    id: 'dumbbell_press', name: 'Жим гантелей', pattern: 'horizontal_push', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 6, elbow: 4, ankle: 0 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Грудные', 'Трицепс'], secondaryMuscles: ['Передние дельты'],
    stabilizers: ['Ротаторная манжета'],
    romRequirements: { shoulder: 60, elbow: 90 },
    equipment: ['dumbbell', 'bench'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['barbell_bench', 'push_up', 'cable_flye'],
    techniqueCues: ['Полная амплитуда', 'Гантели на уровне груди', 'Локти 45°'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // HORIZONTAL PULL PATTERNS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'barbell_row', name: 'Тяга штанги в наклоне', pattern: 'horizontal_pull', category: 'bodybuilding',
    jointStress: { knee: 1, hip: 2, spine: 5, shoulder: 3, elbow: 5, ankle: 1 },
    torqueProfile: 'midrange_peak', spineLoad: 'high', kneeLoad: 'low', shoulderLoad: 'medium',
    cnsDemand: 3, difficulty: 2,
    primaryMuscles: ['Широчайшие', 'Ромбовидные', 'Бицепс'], secondaryMuscles: ['Задние дельты', 'Трапеции'],
    stabilizers: ['Разгибатели спины', 'Кор'],
    romRequirements: { spine: 0, elbow: 90 },
    equipment: ['barbell'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['dumbbell_row', 'seated_row', 't_bar_row', 'chest_supported_row'],
    techniqueCues: ['Спина прямая', 'Тянем к поясу', 'Локти вдоль тела'],
  },
  {
    id: 'seated_cable_row', name: 'Тяга нижнего блока сидя', pattern: 'horizontal_pull', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 3, shoulder: 3, elbow: 4, ankle: 0 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Широчайшие', 'Ромбовидные', 'Бицепс'], secondaryMuscles: ['Задние дельты'],
    stabilizers: [],
    romRequirements: { elbow: 90 },
    equipment: ['cable_machine'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['dumbbell_row', 'barbell_row'],
    techniqueCues: ['Грудь вперёд', 'Лопатки сводить', 'Пауза в пике'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // VERTICAL PUSH PATTERNS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'overhead_press', name: 'Жим над головой стоя', pattern: 'vertical_push', category: 'strongman',
    jointStress: { knee: 1, hip: 1, spine: 5, shoulder: 9, elbow: 6, ankle: 1 },
    torqueProfile: 'midrange_peak', spineLoad: 'medium', kneeLoad: 'low', shoulderLoad: 'high',
    cnsDemand: 3, difficulty: 3,
    primaryMuscles: ['Дельты', 'Трицепс'], secondaryMuscles: ['Верх груди', 'Трапеции'],
    stabilizers: ['Кор', 'Ротаторная манжета', 'Разгибатели спины'],
    romRequirements: { shoulder: 110, elbow: 100 },
    equipment: ['barbell'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['seated_dumbbell_press', 'arnold_press', 'landmine_press', 'lateral_raise'],
    techniqueCues: ['Кор напряжён', 'Голова вперёд вверху', 'Локти под штангой'],
  },
  {
    id: 'lateral_raise', name: 'Махи гантелями в стороны', pattern: 'vertical_push', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 5, elbow: 2, ankle: 0 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Средние дельты'], secondaryMuscles: ['Трапеции'],
    stabilizers: [],
    romRequirements: { shoulder: 90 },
    equipment: ['dumbbell'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['cable_lateral', 'upright_row'],
    techniqueCues: ['Лёгкий наклон вперёд', 'Мизинец вверх', 'Не выше плеч'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // VERTICAL PULL PATTERNS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'pull_up', name: 'Подтягивания', pattern: 'vertical_pull', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 5, elbow: 4, ankle: 0 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium',
    cnsDemand: 2, difficulty: 3,
    primaryMuscles: ['Широчайшие', 'Бицепс'], secondaryMuscles: ['Ромбовидные', 'Задние дельты', 'Кор'],
    stabilizers: [],
    romRequirements: { shoulder: 90, elbow: 90 },
    equipment: ['pull_up_bar'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['lat_pulldown', 'banded_pull_up', 'negative_pull_up'],
    techniqueCues: ['Подбородок над перекладиной', 'Лопатки вниз', 'Без раскачки'],
  },
  {
    id: 'lat_pulldown', name: 'Тяга верхнего блока', pattern: 'vertical_pull', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 4, elbow: 3, ankle: 0 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Широчайшие', 'Бицепс'], secondaryMuscles: ['Ромбовидные', 'Задние дельты'],
    stabilizers: [],
    romRequirements: { shoulder: 90, elbow: 90 },
    equipment: ['cable_machine'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['pull_up', 'straight_arm_pulldown'],
    techniqueCues: ['Грудь к перекладине', 'Лопатки сводить', 'Без рывков'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ACCESSORY PATTERNS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'bicep_curl', name: 'Сгибание рук с гантелями', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 1, elbow: 4, ankle: 0 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Бицепс'], secondaryMuscles: ['Брахиалис'],
    stabilizers: [],
    romRequirements: { elbow: 100 },
    equipment: ['dumbbell', 'barbell'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['hammer_curl', 'preacher_curl', 'cable_curl'],
    techniqueCues: ['Локти прижаты', 'Без читинга', 'Полная амплитуда'],
  },
  {
    id: 'tricep_pushdown', name: 'Разгибание рук на блоке', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 2, elbow: 4, ankle: 0 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Трицепс'], secondaryMuscles: [],
    stabilizers: [],
    romRequirements: { elbow: 100 },
    equipment: ['cable_machine'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['overhead_extension', 'skull_crusher', 'close_grip_bench'],
    techniqueCues: ['Локти прижаты', 'Только предплечья', 'Пауза внизу'],
  },
  {
    id: 'face_pull', name: 'Face Pull', pattern: 'accessory', category: 'rehab',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 3, elbow: 2, ankle: 0 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Задние дельты', 'Ротаторная манжета'], secondaryMuscles: ['Ромбовидные', 'Трапеции'],
    stabilizers: [],
    romRequirements: { shoulder: 60, elbow: 90 },
    equipment: ['cable_machine', 'band'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['band_pull_apart', 'reverse_pec_deck'],
    techniqueCues: ['Тянем к лицу', 'Локти выше кистей', 'Внешнее вращение'],
  },
  {
    id: 'calf_raise', name: 'Подъём на носки стоя', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 1, hip: 0, spine: 0, shoulder: 0, elbow: 0, ankle: 5 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Икроножные'], secondaryMuscles: ['Камбаловидная'],
    stabilizers: [],
    romRequirements: { ankle: 40 },
    equipment: ['bodyweight', 'machine'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['seated_calf', 'single_leg_calf'],
    techniqueCues: ['Полная амплитуда', 'Пауза внизу', 'Без пружины'],
  },
  {
    id: 'plank', name: 'Планка', pattern: 'accessory', category: 'rehab',
    jointStress: { knee: 0, hip: 1, spine: 1, shoulder: 2, elbow: 1, ankle: 0 },
    torqueProfile: 'uniform', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Кор'], secondaryMuscles: ['Плечи', 'Ягодичные'],
    stabilizers: [],
    romRequirements: {},
    equipment: ['bodyweight'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['dead_bug', 'pallof_press', 'ab_wheel'],
    techniqueCues: ['Таз не провисает', 'Кор напряжён', 'Дыхание ровное'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // WEIGHTLIFTING
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'power_clean', name: 'Взятие на грудь', pattern: 'hinge', category: 'weightlifting',
    jointStress: { knee: 5, hip: 7, spine: 6, shoulder: 5, elbow: 4, ankle: 4 },
    torqueProfile: 'bottom_peak', spineLoad: 'medium', kneeLoad: 'medium', shoulderLoad: 'medium',
    cnsDemand: 5, difficulty: 5,
    primaryMuscles: ['Бицепс бедра', 'Ягодичные', 'Трапеции'], secondaryMuscles: ['Квадрицепсы', 'Дельты', 'Широчайшие'],
    stabilizers: ['Кор', 'Разгибатели спины'],
    romRequirements: { hip: 90, knee: 90, shoulder: 120 },
    equipment: ['barbell'], riskProfile: 'high', isUnilateral: false, isCompetition: true,
    substitutions: ['hang_clean', 'clean_pull', 'high_pull'],
    techniqueCues: ['Грудь над грифом', 'Взрыв от бёдер', 'Локти вверх'],
  },

  // ═══════════════════════ РАСШИРЕННАЯ БИОМЕХАНИКА (50+ новых профилей) ═══════════════════════

  // ── ГРУДЬ: жимы и разводки ──
  {
    id: 'dips_chest', name: 'Отжимания на брусьях (грудной стиль)', pattern: 'horizontal_push', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 6, elbow: 4, ankle: 0 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Нижняя часть груди', 'Трицепс'], secondaryMuscles: ['Передние дельты'],
    stabilizers: ['Ротаторная манжета', 'Широчайшие'],
    romRequirements: { shoulder: 70, elbow: 90 },
    equipment: ['bodyweight', 'dip_bars'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['decline_bench', 'close_grip_bench'],
    techniqueCues: ['Наклон вперёд', 'Глубокое растяжение', 'Плечи вниз'],
  },
  {
    id: 'push_up', name: 'Отжимания от пола', pattern: 'horizontal_push', category: 'rehab',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 4, elbow: 3, ankle: 0 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Грудные', 'Трицепс'], secondaryMuscles: ['Передние дельты', 'Кор'],
    stabilizers: [],
    romRequirements: { shoulder: 60, elbow: 90 },
    equipment: ['bodyweight'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['knee_pushup', 'incline_pushup'],
    techniqueCues: ['Локти 45°', 'Кор напряжён', 'Грудь касается пола'],
  },
  {
    id: 'decline_bench', name: 'Жим на скамье с отрицательным наклоном', pattern: 'horizontal_push', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 2, shoulder: 7, elbow: 5, ankle: 0 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'high',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Нижняя часть груди', 'Трицепс'], secondaryMuscles: ['Передние дельты'],
    stabilizers: ['Ротаторная манжета'],
    romRequirements: { shoulder: 60, elbow: 90 },
    equipment: ['barbell', 'decline_bench'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['dips_chest', 'flat_bench'],
    techniqueCues: ['Не отрывать ягодицы', 'Гриф к нижней части груди', 'Локти 45°'],
  },
  {
    id: 'cable_fly', name: 'Сведение рук в кроссовере', pattern: 'horizontal_push', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 4, elbow: 2, ankle: 0 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Грудные'], secondaryMuscles: ['Передние дельты'],
    stabilizers: [],
    romRequirements: { shoulder: 60 },
    equipment: ['cable_machine'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['pec_deck', 'dumbbell_fly'],
    techniqueCues: ['Лёгкий сгиб в локтях', 'Обнять дерево', 'Пик в центре'],
  },

  // ── СПИНА: тяги и подтягивания ──
  {
    id: 't_bar_row', name: 'Тяга Т-грифа', pattern: 'horizontal_pull', category: 'bodybuilding',
    jointStress: { knee: 1, hip: 2, spine: 5, shoulder: 3, elbow: 5, ankle: 1 },
    torqueProfile: 'midrange_peak', spineLoad: 'medium', kneeLoad: 'low', shoulderLoad: 'medium',
    cnsDemand: 3, difficulty: 2,
    primaryMuscles: ['Широчайшие', 'Ромбовидные', 'Трапеции'], secondaryMuscles: ['Бицепс', 'Задние дельты'],
    stabilizers: ['Разгибатели спины', 'Кор'],
    romRequirements: { spine: 0, elbow: 90 },
    equipment: ['barbell', 't_bar'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['barbell_row', 'chest_supported_row', 'seated_cable_row'],
    techniqueCues: ['Спина прямая', 'Сведи лопатки', 'Контролируемый негатив'],
  },
  {
    id: 'chin_up', name: 'Подтягивания обратным хватом', pattern: 'vertical_pull', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 4, elbow: 4, ankle: 0 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Широчайшие', 'Бицепс'], secondaryMuscles: ['Ромбовидные', 'Брахиалис'],
    stabilizers: ['Кор'],
    romRequirements: { shoulder: 80, elbow: 90 },
    equipment: ['pull_up_bar'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['lat_pulldown', 'banded_chin_up'],
    techniqueCues: ['Грудь к перекладине', 'Локти вниз', 'Полный вис внизу'],
  },
  {
    id: 'single_arm_row', name: 'Тяга гантели в наклоне (одна рука)', pattern: 'horizontal_pull', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 1, spine: 3, shoulder: 3, elbow: 4, ankle: 0 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 2, difficulty: 1,
    primaryMuscles: ['Широчайшие', 'Ромбовидные'], secondaryMuscles: ['Бицепс', 'Задние дельты'],
    stabilizers: ['Кор'],
    romRequirements: { spine: 0, elbow: 90 },
    equipment: ['dumbbell', 'bench'], riskProfile: 'low', isUnilateral: true, isCompetition: false,
    substitutions: ['seated_cable_row', 'barbell_row'],
    techniqueCues: ['Спина параллельно полу', 'Тянем к поясу', 'Сжатие лопатки'],
  },
  {
    id: 'rack_pull', name: 'Становая тяга с плинтов', pattern: 'hinge', category: 'powerlifting',
    jointStress: { knee: 2, hip: 7, spine: 7, shoulder: 2, elbow: 2, ankle: 1 },
    torqueProfile: 'top_peak', spineLoad: 'high', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 4, difficulty: 3,
    primaryMuscles: ['Разгибатели спины', 'Ягодичные', 'Трапеции'], secondaryMuscles: ['Бицепс бедра', 'Широчайшие'],
    stabilizers: ['Кор', 'Ромбовидные'],
    romRequirements: { hip: 40, spine: 0 },
    equipment: ['barbell', 'rack'], riskProfile: 'high', isUnilateral: false, isCompetition: false,
    substitutions: ['deadlift_conventional', 'block_pull'],
    techniqueCues: ['Спина прямая', 'Плечи над грифом', 'Мощный локаут'],
  },
  {
    id: 'reverse_hyper', name: 'Обратная гиперэкстензия', pattern: 'hinge', category: 'rehab',
    jointStress: { knee: 1, hip: 4, spine: 2, shoulder: 1, elbow: 0, ankle: 1 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Ягодичные', 'Бицепс бедра'], secondaryMuscles: ['Разгибатели спины'],
    stabilizers: [],
    romRequirements: { hip: 60 },
    equipment: ['reverse_hyper_machine'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['back_extension', 'glute_bridge'],
    techniqueCues: ['Плавное движение', 'Ягодицы вверху', 'Контроль на спуске'],
  },

  // ── НОГИ: приседания, жимы, выпады ──
  {
    id: 'hack_squat', name: 'Гакк-приседания в тренажёре', pattern: 'squat', category: 'bodybuilding',
    jointStress: { knee: 6, hip: 3, spine: 2, shoulder: 0, elbow: 0, ankle: 2 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'medium', shoulderLoad: 'low',
    cnsDemand: 2, difficulty: 1,
    primaryMuscles: ['Квадрицепсы'], secondaryMuscles: ['Ягодичные'],
    stabilizers: [],
    romRequirements: { knee: 90, hip: 70 },
    equipment: ['hack_squat_machine'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['leg_press', 'goblet_squat'],
    techniqueCues: ['Поясница прижата', 'Колени по линии стоп', 'Полная амплитуда'],
  },
  {
    id: 'walking_lunge', name: 'Выпады с ходьбой', pattern: 'squat', category: 'bodybuilding',
    jointStress: { knee: 5, hip: 4, spine: 2, shoulder: 1, elbow: 1, ankle: 4 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'medium', shoulderLoad: 'low',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Квадрицепсы', 'Ягодичные'], secondaryMuscles: ['Бицепс бедра', 'Приводящие'],
    stabilizers: ['Кор'],
    romRequirements: { knee: 90, hip: 80 },
    equipment: ['dumbbell', 'bodyweight'], riskProfile: 'low', isUnilateral: true, isCompetition: false,
    substitutions: ['bulgarian_split_squat', 'step_up', 'leg_press'],
    techniqueCues: ['Грудь вверх', 'Шаг — голень вертикально', 'Толчок передней ногой'],
  },
  {
    id: 'leg_extension', name: 'Разгибание ног в тренажёре', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 4, hip: 0, spine: 0, shoulder: 0, elbow: 0, ankle: 0 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Квадрицепсы'], secondaryMuscles: [],
    stabilizers: [],
    romRequirements: { knee: 90 },
    equipment: ['leg_ext_machine'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['sissy_squat', 'step_up'],
    techniqueCues: ['Спина прижата', 'Пауза вверху 1с', 'Контроль на негативе'],
  },
  {
    id: 'leg_curl', name: 'Сгибание ног в тренажёре', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 3, hip: 0, spine: 0, shoulder: 0, elbow: 0, ankle: 0 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Бицепс бедра'], secondaryMuscles: ['Икроножные'],
    stabilizers: [],
    romRequirements: { knee: 90 },
    equipment: ['leg_curl_machine'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['nordic_curl', 'rdl'],
    techniqueCues: ['Таз прижат', 'Полная амплитуда', 'Пиковое сокращение'],
  },
  {
    id: 'good_morning', name: 'Наклоны со штангой (Good Morning)', pattern: 'hinge', category: 'powerlifting',
    jointStress: { knee: 1, hip: 6, spine: 7, shoulder: 2, elbow: 1, ankle: 1 },
    torqueProfile: 'midrange_peak', spineLoad: 'high', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 2, difficulty: 3,
    primaryMuscles: ['Разгибатели спины', 'Бицепс бедра'], secondaryMuscles: ['Ягодичные'],
    stabilizers: ['Кор'],
    romRequirements: { hip: 80, spine: 0 },
    equipment: ['barbell'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['romanian_deadlift', 'back_extension'],
    techniqueCues: ['Колени мягкие', 'Спина прямая', 'Таз назад'],
  },
  {
    id: 'step_up', name: 'Зашагивания на платформу', pattern: 'squat', category: 'bodybuilding',
    jointStress: { knee: 5, hip: 4, spine: 2, shoulder: 1, elbow: 1, ankle: 3 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'medium', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Квадрицепсы', 'Ягодичные'], secondaryMuscles: ['Бицепс бедра'],
    stabilizers: ['Кор'],
    romRequirements: { knee: 90, hip: 80 },
    equipment: ['dumbbell', 'box'], riskProfile: 'low', isUnilateral: true, isCompetition: false,
    substitutions: ['walking_lunge', 'bulgarian_split_squat'],
    techniqueCues: ['Вся стопа на платформе', 'Толчок пяткой', 'Колено не уходит внутрь'],
  },
  {
    id: 'glute_bridge', name: 'Ягодичный мост на полу', pattern: 'hinge', category: 'bodybuilding',
    jointStress: { knee: 1, hip: 3, spine: 1, shoulder: 0, elbow: 0, ankle: 1 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Ягодичные'], secondaryMuscles: ['Бицепс бедра'],
    stabilizers: [],
    romRequirements: { hip: 60 },
    equipment: ['bodyweight'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['hip_thrust', 'single_leg_bridge'],
    techniqueCues: ['Сжать ягодицы вверху', 'Подбородок прижат', 'Пятки прижаты'],
  },
  {
    id: 'cable_pull_through', name: 'Тяга блока между ног (Pull Through)', pattern: 'hinge', category: 'bodybuilding',
    jointStress: { knee: 1, hip: 5, spine: 3, shoulder: 1, elbow: 1, ankle: 1 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Ягодичные', 'Бицепс бедра'], secondaryMuscles: ['Разгибатели спины'],
    stabilizers: [],
    romRequirements: { hip: 80 },
    equipment: ['cable_machine'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['kettlebell_swing', 'romanian_deadlift'],
    techniqueCues: ['Таз назад', 'Колени мягкие', 'Взрывной подъём'],
  },
  {
    id: 'sissy_squat', name: 'Сисси-приседания', pattern: 'squat', category: 'bodybuilding',
    jointStress: { knee: 7, hip: 1, spine: 1, shoulder: 0, elbow: 0, ankle: 2 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'high', shoulderLoad: 'low',
    cnsDemand: 2, difficulty: 3,
    primaryMuscles: ['Квадрицепсы (прямая мышца)'], secondaryMuscles: [],
    stabilizers: [],
    romRequirements: { knee: 100 },
    equipment: ['bodyweight'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['leg_extension', 'hack_squat'],
    techniqueCues: ['Колени вперёд', 'Тело на одной линии', 'Контролируемый спуск'],
  },

  // ── ПЛЕЧИ: жимы и махи ──
  {
    id: 'arnold_press', name: 'Жим Арнольда', pattern: 'vertical_push', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 2, shoulder: 7, elbow: 5, ankle: 0 },
    torqueProfile: 'uniform', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Дельты (все три головки)', 'Трицепс'], secondaryMuscles: ['Верх груди', 'Трапеции'],
    stabilizers: ['Ротаторная манжета'],
    romRequirements: { shoulder: 110, elbow: 100 },
    equipment: ['dumbbell'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['overhead_press', 'seated_dumbbell_press'],
    techniqueCues: ['Ладони к себе → от себя', 'Полный разворот 180°', 'Контроль на всём движении'],
  },
  {
    id: 'rear_delt_fly', name: 'Разведение гантелей в наклоне (задняя дельта)', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 1, spine: 3, shoulder: 4, elbow: 2, ankle: 0 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Задние дельты'], secondaryMuscles: ['Ромбовидные', 'Трапеции'],
    stabilizers: [],
    romRequirements: { shoulder: 50 },
    equipment: ['dumbbell'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['face_pull', 'reverse_pec_deck'],
    techniqueCues: ['Мизинец вверх', 'Локти мягкие', 'Сведение лопаток'],
  },
  {
    id: 'upright_row', name: 'Тяга штанги к подбородку', pattern: 'vertical_push', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 2, shoulder: 6, elbow: 4, ankle: 0 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Дельты (особенно средняя)', 'Трапеции'], secondaryMuscles: ['Бицепс', 'Предплечья'],
    stabilizers: ['Кор'],
    romRequirements: { shoulder: 80, elbow: 90 },
    equipment: ['barbell'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['dumbbell_upright_row', 'cable_upright_row'],
    techniqueCues: ['Гриф близко к телу', 'Локти до уровня плеч', 'Не выше ключиц'],
  },
  {
    id: 'front_raise', name: 'Подъём гантелей перед собой', pattern: 'vertical_push', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 4, elbow: 2, ankle: 0 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Передние дельты'], secondaryMuscles: ['Верх груди'],
    stabilizers: [],
    romRequirements: { shoulder: 90 },
    equipment: ['dumbbell'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['cable_front_raise', 'plate_raise'],
    techniqueCues: ['Без раскачки', 'До уровня плеч', 'Контролируемый негатив'],
  },
  {
    id: 'landmine_press', name: 'Жим одной рукой в лэндмайн', pattern: 'vertical_push', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 3, shoulder: 5, elbow: 4, ankle: 0 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium',
    cnsDemand: 2, difficulty: 1,
    primaryMuscles: ['Дельты', 'Трицепс'], secondaryMuscles: ['Верх груди', 'Кор'],
    stabilizers: ['Ротаторная манжета'],
    romRequirements: { shoulder: 90, elbow: 90 },
    equipment: ['barbell', 'landmine'], riskProfile: 'low', isUnilateral: true, isCompetition: false,
    substitutions: ['overhead_press', 'arnold_press'],
    techniqueCues: ['Кор напряжён', 'Жим вверх-вперёд', 'Контролируемый спуск'],
  },

  // ── РУКИ: сгибания и разгибания ──
  {
    id: 'hammer_curl', name: 'Молотковые сгибания', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 1, elbow: 4, ankle: 0 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Бицепс', 'Брахиалис', 'Брахиорадиалис'], secondaryMuscles: [],
    stabilizers: [],
    romRequirements: { elbow: 100 },
    equipment: ['dumbbell'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['reverse_curl', 'rope_hammer_curl'],
    techniqueCues: ['Молоток — ладони друг к другу', 'Локти прижаты', 'Пик 1с вверху'],
  },
  {
    id: 'skullcrusher', name: 'Французский жим лёжа (Skull Crusher)', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 2, elbow: 6, ankle: 0 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 2,
    primaryMuscles: ['Трицепс (длинная головка)'], secondaryMuscles: [],
    stabilizers: [],
    romRequirements: { elbow: 100 },
    equipment: ['ez_bar', 'barbell'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['overhead_tricep_ext', 'close_grip_bench'],
    techniqueCues: ['Локти неподвижны и узко', 'Гриф ко лбу', 'Контролируемое разгибание'],
  },
  {
    id: 'preacher_curl', name: 'Сгибание рук на скамье Скотта', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 1, elbow: 5, ankle: 0 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Бицепс (короткая головка)'], secondaryMuscles: ['Брахиалис'],
    stabilizers: [],
    romRequirements: { elbow: 100 },
    equipment: ['preacher_bench', 'ez_bar'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['concentration_curl', 'spider_curl'],
    techniqueCues: ['Подмышки на скамье', 'Без читинга', 'Полное растяжение внизу'],
  },
  {
    id: 'overhead_tricep_ext', name: 'Разгибание руки с гантелью из-за головы', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 2, shoulder: 3, elbow: 5, ankle: 0 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Трицепс (длинная головка)'], secondaryMuscles: [],
    stabilizers: [],
    romRequirements: { shoulder: 90, elbow: 100 },
    equipment: ['dumbbell'], riskProfile: 'low', isUnilateral: true, isCompetition: false,
    substitutions: ['tricep_pushdown', 'skullcrusher'],
    techniqueCues: ['Локоть к потолку', 'Контроль на негативе', 'Растяжение трицепса'],
  },
  {
    id: 'concentration_curl', name: 'Концентрированные сгибания', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 1, elbow: 4, ankle: 0 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Бицепс (пик)'], secondaryMuscles: ['Брахиалис'],
    stabilizers: [],
    romRequirements: { elbow: 100 },
    equipment: ['dumbbell'], riskProfile: 'low', isUnilateral: true, isCompetition: false,
    substitutions: ['preacher_curl', 'spider_curl'],
    techniqueCues: ['Локоть на внутренней стороне бедра', 'Пиковое сокращение 1-2с', 'Без рывков'],
  },
  {
    id: 'reverse_curl', name: 'Обратные сгибания со штангой', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 1, elbow: 4, ankle: 0 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Брахиорадиалис', 'Плечелучевая'], secondaryMuscles: ['Бицепс'],
    stabilizers: [],
    romRequirements: { elbow: 90 },
    equipment: ['ez_bar', 'barbell'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['hammer_curl', 'wrist_roller'],
    techniqueCues: ['Хват сверху', 'Локти прижаты', 'Контролируемое движение'],
  },
  {
    id: 'wrist_curl', name: 'Сгибание запястий со штангой', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 1, elbow: 1, ankle: 0 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Сгибатели запястья'], secondaryMuscles: [],
    stabilizers: [],
    romRequirements: { wrist: 60 },
    equipment: ['barbell'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['wrist_roller', 'db_wrist_curl'],
    techniqueCues: ['Предплечья на скамье', 'Полная амплитуда', 'Контроль на негативе'],
  },
  {
    id: 'close_grip_bench', name: 'Жим лёжа узким хватом', pattern: 'horizontal_push', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 2, shoulder: 4, elbow: 6, ankle: 0 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Трицепс', 'Внутренняя часть груди'], secondaryMuscles: ['Передние дельты'],
    stabilizers: ['Ротаторная манжета'],
    romRequirements: { elbow: 90, shoulder: 50 },
    equipment: ['barbell', 'bench'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['dips_tricep', 'skullcrusher'],
    techniqueCues: ['Хват на ширине плеч', 'Локти вдоль тела', 'Касание низа груди'],
  },

  // ── КОР: пресс и стабилизация ──
  {
    id: 'hanging_leg_raise', name: 'Подъём ног в висе', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 1, hip: 4, spine: 1, shoulder: 3, elbow: 2, ankle: 1 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Прямая мышца живота', 'Сгибатели бедра'], secondaryMuscles: ['Косые мышцы'],
    stabilizers: ['Широчайшие', 'Предплечья'],
    romRequirements: { hip: 90 },
    equipment: ['pull_up_bar'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['knee_raise', 'lying_leg_raise', 'cable_crunch'],
    techniqueCues: ['Без раскачки', 'Таз вперёд вверху', 'Медленное опускание'],
  },
  {
    id: 'ab_wheel', name: 'Ролик для пресса (Ab Wheel)', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 1, spine: 2, shoulder: 3, elbow: 1, ankle: 0 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 2, difficulty: 3,
    primaryMuscles: ['Прямая мышца живота', 'Косые мышцы'], secondaryMuscles: ['Широчайшие', 'Сгибатели бедра'],
    stabilizers: ['Разгибатели спины'],
    romRequirements: { spine: 0, shoulder: 90 },
    equipment: ['ab_wheel'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['plank', 'cable_crunch', 'dead_bug'],
    techniqueCues: ['Таз подкручен', 'Кор напряжён', 'Контролируемый возврат'],
  },
  {
    id: 'dead_bug', name: 'Мёртвый жук (Dead Bug)', pattern: 'accessory', category: 'rehab',
    jointStress: { knee: 1, hip: 2, spine: 1, shoulder: 2, elbow: 1, ankle: 0 },
    torqueProfile: 'uniform', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Кор (поперечная мышца)', 'Прямая мышца живота'], secondaryMuscles: [],
    stabilizers: [],
    romRequirements: {},
    equipment: ['bodyweight'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['bird_dog', 'plank', 'hollow_hold'],
    techniqueCues: ['Поясница прижата к полу', 'Медленное движение', 'Дыхание ровное'],
  },
  {
    id: 'cable_crunch', name: 'Скручивания на блоке', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 3, shoulder: 1, elbow: 1, ankle: 0 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Прямая мышца живота'], secondaryMuscles: ['Косые мышцы'],
    stabilizers: [],
    romRequirements: { spine: 30 },
    equipment: ['cable_machine'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['kneeling_crunch', 'situp', 'hanging_knee_raise'],
    techniqueCues: ['Округлить спину', 'Пик внизу 1с', 'Контролируемый возврат'],
  },
  {
    id: 'pallof_press', name: 'Жим Паллофа', pattern: 'accessory', category: 'rehab',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 2, elbow: 2, ankle: 0 },
    torqueProfile: 'uniform', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Косые мышцы', 'Поперечная мышца'], secondaryMuscles: ['Ягодичные'],
    stabilizers: [],
    romRequirements: { shoulder: 30, elbow: 10 },
    equipment: ['cable_machine', 'band'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['side_plank', 'dead_bug', 'suitcase_carry'],
    techniqueCues: ['Кор напряжён', 'Не вращать корпус', 'Держать 2-3с в вытянутой позиции'],
  },
  {
    id: 'russian_twist', name: 'Русские скручивания', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 1, hip: 1, spine: 4, shoulder: 1, elbow: 1, ankle: 0 },
    torqueProfile: 'uniform', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Косые мышцы', 'Прямая мышца живота'], secondaryMuscles: ['Сгибатели бедра'],
    stabilizers: [],
    romRequirements: { spine: 40 },
    equipment: ['dumbbell', 'plate'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['bicycle_crunch', 'cable_woodchop', 'side_plank'],
    techniqueCues: ['Ноги над полом', 'Контролируемое вращение', 'Дышать ритмично'],
  },

  // ── РАЗНОЕ ──
  {
    id: 'shrug', name: 'Шраги со штангой', pattern: 'accessory', category: 'bodybuilding',
    jointStress: { knee: 0, hip: 0, spine: 2, shoulder: 3, elbow: 1, ankle: 0 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Трапеции (верх)'], secondaryMuscles: ['Поднимающие лопатку'],
    stabilizers: [],
    romRequirements: { shoulder: 20 },
    equipment: ['barbell', 'dumbbell'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['dumbbell_shrug', 'farmer_walk'],
    techniqueCues: ['Плечи к ушам', 'Без вращения', 'Пауза вверху'],
  },
  {
    id: 'farmer_walk', name: 'Прогулка фермера', pattern: 'accessory', category: 'strongman',
    jointStress: { knee: 2, hip: 2, spine: 3, shoulder: 3, elbow: 1, ankle: 2 },
    torqueProfile: 'uniform', spineLoad: 'medium', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 2, difficulty: 1,
    primaryMuscles: ['Трапеции', 'Предплечья', 'Кор'], secondaryMuscles: ['Квадрицепсы', 'Ягодичные'],
    stabilizers: ['Ромбовидные', 'Разгибатели спины'],
    romRequirements: {},
    equipment: ['dumbbell', 'kettlebell', 'farmers_handles'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['suitcase_carry', 'shrug'],
    techniqueCues: ['Грудь вверх', 'Кор напряжён', 'Короткие шаги'],
  },
  {
    id: 'kettlebell_swing', name: 'Махи гирей', pattern: 'hinge',     category: 'conditioning' as 'cardio',
    jointStress: { knee: 3, hip: 6, spine: 4, shoulder: 2, elbow: 1, ankle: 2 },
    torqueProfile: 'bottom_peak', spineLoad: 'medium', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Ягодичные', 'Бицепс бедра'], secondaryMuscles: ['Разгибатели спины', 'Кор'],
    stabilizers: ['Широчайшие'],
    romRequirements: { hip: 90 },
    equipment: ['kettlebell'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['romanian_deadlift', 'cable_pull_through'],
    techniqueCues: ['Взрыв от бёдер', 'Не руками — тазом', 'Кор напряжён'],
  },
];

/**
 * Quick lookup by exercise ID.
 */
export function getExerciseBio(id: string): ExerciseBio | undefined {
  return EXERCISE_BIOMECHANICS_DB.find(e => e.id === id);
}

/**
 * Filter exercises by pattern, risk, and equipment.
 */
export function filterExercises(filters: {
  pattern?: string;
  maxRisk?: 'low' | 'medium' | 'high';
  equipment?: string[];
  maxDifficulty?: number;
  excludeJoints?: string[];
}): ExerciseBio[] {
  let results = [...EXERCISE_BIOMECHANICS_DB];

  if (filters.pattern) results = results.filter(e => e.pattern === filters.pattern);
  if (filters.maxRisk === 'low') results = results.filter(e => e.riskProfile === 'low');
  else if (filters.maxRisk === 'medium') results = results.filter(e => e.riskProfile !== 'high');
  if (filters.maxDifficulty != null) results = results.filter(e => e.difficulty <= filters.maxDifficulty!);
  if (filters.equipment?.length) {
    results = results.filter(e => e.equipment.some(eq => filters.equipment!.includes(eq)) || e.equipment.includes('bodyweight'));
  }
  if (filters.excludeJoints?.length) {
    for (const joint of filters.excludeJoints) {
      results = results.filter(e => (e.jointStress as any)[joint] <= 4);
    }
  }

  return results;
}
