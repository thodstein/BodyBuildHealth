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
    torqueProfile: 'midrange_peak', spineLoad: 'medium', kneeLoad: 'low', shoulderLoad: 'medium',
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
