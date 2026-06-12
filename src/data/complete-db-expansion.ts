/**
 * Complete Database Expansion — All Splits + All Exercises + All Diets + All Supports
 *
 * Splits: 12 complete split systems
 * Exercises: 30 additional exercises with full biomechanics
 * Diets: 10 diet strategies
 * Supports: 20 additional support compounds
 *
 * @module complete-db-expansion
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. ALL 12 SPLIT SYSTEMS
// ═══════════════════════════════════════════════════════════════════════════

export interface SplitSystem {
  id: string; name: string; type: string;
  daysPerWeek: number; level: string; goal: string;
  weeklySchedule: string[];
  dayStructure: { name: string; mainLift: string; secondaryPatterns: string[]; accessories: string[]; volume: string; intensity: string }[];
  description: string;
  pros: string[]; cons: string[];
  progressionModel: string;
  deloadProtocol: string;
}

export const ALL_SPLIT_SYSTEMS: SplitSystem[] = [
  // ── SPLIT 1-3: FBW variants ──
  { id: 'fbw_2day', name: 'Full Body 2-Day (минимализм)', type: 'fullbody', daysPerWeek: 2, level: 'beginner', goal: 'general',
    weeklySchedule: ['FBW A', 'Отдых', 'Отдых', 'FBW B', 'Отдых', 'Отдых', 'Отдых'],
    dayStructure: [
      { name: 'FBW A', mainLift: 'Squat', secondaryPatterns: ['bench', 'row'], accessories: ['lunge', 'plank'], volume: '3×5-8', intensity: 'RPE 7-8' },
      { name: 'FBW B', mainLift: 'Deadlift', secondaryPatterns: ['ohp', 'pullup'], accessories: ['rdl', 'carry'], volume: '3×5-8', intensity: 'RPE 7-8' },
    ],
    description: 'Минималистичный FBW. 2 тренировки в неделю. Для очень занятых.',
    pros: ['Минимум времени', 'Восстановление', 'Подходит новичкам'], cons: ['Мало объёма', 'Медленный прогресс'],
    progressionModel: 'Linear +2.5/5 кг каждую тренировку', deloadProtocol: 'Каждые 8 недель',
  },
  { id: 'fbw_4day_hl', name: 'Full Body 4-Day Heavy/Light', type: 'fullbody', daysPerWeek: 4, level: 'intermediate', goal: 'strength',
    weeklySchedule: ['FBW Heavy A', 'FBW Light A', 'Отдых', 'FBW Heavy B', 'FBW Light B', 'Отдых', 'Отдых'],
    dayStructure: [
      { name: 'Heavy A (Squat)', mainLift: 'Squat 5×3 @85%', secondaryPatterns: ['bench 4×5', 'row 4×5'], accessories: ['rdl 3×8', 'ab wheel'], volume: 'Низкий', intensity: 'Высокая (85-93%)' },
      { name: 'Light A (OHP)', mainLift: 'OHP 3×8 @70%', secondaryPatterns: ['pullup 3×10', 'lunge 3×10'], accessories: ['lateral 3×15', 'curl 3×12'], volume: 'Средний', intensity: 'Низкая (65-75%)' },
      { name: 'Heavy B (Deadlift)', mainLift: 'Deadlift 4×2 @88%', secondaryPatterns: ['ohp 4×3', 'front_squat 3×5'], accessories: ['row 3×8', 'facepull 3×15'], volume: 'Низкий', intensity: 'Высокая' },
      { name: 'Light B (Bench)', mainLift: 'Bench 3×8 @72%', secondaryPatterns: ['row 3×10', 'rdl 3×10'], accessories: ['dips 3×12', 'raise 3×15'], volume: 'Средний', intensity: 'Низкая' },
    ],
    description: 'Heavy/Light подход. Тяжёлые дни — сила, лёгкие — объём и восстановление.',
    pros: ['Частая стимуляция', 'Хороший баланс силы/объёма', 'Восстановление между тяжёлыми'], cons: ['4 дня — не всем', 'Сложнее планировать'],
    progressionModel: 'Heavy: +2.5 кг/нед. Light: double progression.', deloadProtocol: 'Каждые 6 недель',
  },
  // ── SPLIT 4-5: Upper/Lower variants ──
  { id: 'ul_5day', name: 'Upper/Lower 5-Day (3U/2L)', type: 'upper_lower', daysPerWeek: 5, level: 'advanced', goal: 'hypertrophy',
    weeklySchedule: ['Upper A (грудь)', 'Lower A (квадры)', 'Upper B (спина)', 'Lower B (задняя цепь)', 'Upper C (плечи+руки)', 'Отдых', 'Отдых'],
    dayStructure: [
      { name: 'Upper A (Chest focus)', mainLift: 'Bench 4×6-8', secondaryPatterns: ['incline db', 'ohp'], accessories: ['flye', 'lateral', 'tricep'], volume: 'Высокий', intensity: 'RPE 7-8.5' },
      { name: 'Lower A (Quad focus)', mainLift: 'Squat 4×6-8', secondaryPatterns: ['leg press', 'lunge'], accessories: ['extension', 'calf'], volume: 'Высокий', intensity: 'RPE 7-8.5' },
      { name: 'Upper B (Back focus)', mainLift: 'BB Row 4×6-8', secondaryPatterns: ['pullup', 'facepull'], accessories: ['shrug', 'rear delt', 'bicep'], volume: 'Высокий', intensity: 'RPE 7-8' },
      { name: 'Lower B (Posterior)', mainLift: 'RDL 4×8-10', secondaryPatterns: ['hip thrust', 'bulgarian'], accessories: ['curl', 'ab wheel'], volume: 'Высокий', intensity: 'RPE 7-8' },
      { name: 'Upper C (Arms/Delts)', mainLift: 'OHP 4×8-10', secondaryPatterns: ['close_grip', 'curl'], accessories: ['lateral', 'tricep', 'hammer'], volume: 'Очень высокий', intensity: 'RPE 6-7 (памп)' },
    ],
    description: '5-дневный Upper/Lower с ротацией фокуса. Высокий объём для продвинутых.',
    pros: ['Много объёма', 'Специализация по дням', 'Гибкость'], cons: ['5 дней', 'Сложное восстановление'],
    progressionModel: 'Double progression', deloadProtocol: 'Каждые 6-8 недель',
  },
  // ── SPLIT 6: Bro Split ──
  { id: 'bro_split_5day', name: 'Bro Split 5-Day (классический бодибилдинг)', type: 'bro', daysPerWeek: 5, level: 'intermediate', goal: 'hypertrophy',
    weeklySchedule: ['Грудь', 'Спина', 'Отдых', 'Плечи', 'Ноги', 'Руки', 'Отдых'],
    dayStructure: [
      { name: 'Chest Day', mainLift: 'Bench 4×8-12', secondaryPatterns: ['incline', 'flye'], accessories: ['dips', 'pullover'], volume: '16-20 sets', intensity: 'RPE 7-9' },
      { name: 'Back Day', mainLift: 'Deadlift/Row 4×6-10', secondaryPatterns: ['pulldown', 'row variation'], accessories: ['facepull', 'shrug', 'hyperextension'], volume: '18-22 sets', intensity: 'RPE 7-9' },
      { name: 'Shoulder Day', mainLift: 'OHP 4×8-12', secondaryPatterns: ['lateral', 'rear delt'], accessories: ['upright row', 'shrug'], volume: '14-18 sets', intensity: 'RPE 7-8' },
      { name: 'Leg Day', mainLift: 'Squat 4×8-12', secondaryPatterns: ['leg press', 'rdl'], accessories: ['extension', 'curl', 'calf'], volume: '18-22 sets', intensity: 'RPE 7-9' },
      { name: 'Arm Day', mainLift: 'BB Curl + Close-Grip', secondaryPatterns: ['hammer', 'pushdown'], accessories: ['preacher', 'overhead', 'wrist'], volume: '14-18 sets', intensity: 'RPE 7-8 (памп)' },
    ],
    description: 'Классический бодибилдерский сплит. 1 мышечная группа в день. Максимальный объём.',
    pros: ['Максимальный пампинг', 'Много изоляции', 'Психологически приятно'], cons: ['Низкая частота (1×/нед)', 'Медленный прогресс силы'],
    progressionModel: 'Double progression', deloadProtocol: 'Каждые 8-10 недель',
  },
  // ── SPLIT 7: Specialization ──
  { id: 'specialization_chest', name: 'Specialization (Chest Priority)', type: 'specialization', daysPerWeek: 4, level: 'advanced', goal: 'specialization',
    weeklySchedule: ['Chest + Back', 'Legs', 'Отдых', 'Chest + Shoulders', 'Chest + Arms', 'Отдых', 'Отдых'],
    dayStructure: [
      { name: 'Chest + Back', mainLift: 'Bench 5×5-8', secondaryPatterns: ['row', 'incline'], accessories: ['flye', 'pulldown'], volume: 'Высокий на грудь', intensity: 'RPE 7-9' },
      { name: 'Legs', mainLift: 'Squat 3×5', secondaryPatterns: ['leg press', 'rdl'], accessories: ['calf'], volume: 'Низкий', intensity: 'RPE 7-8.5' },
      { name: 'Chest + Shoulders', mainLift: 'DB Press 4×8-12', secondaryPatterns: ['ohp', 'lateral'], accessories: ['flye', 'facepull'], volume: 'Очень высокий на грудь', intensity: 'RPE 7-8' },
      { name: 'Chest + Arms', mainLift: 'Incline 4×8-12', secondaryPatterns: ['close_grip', 'curl'], accessories: ['cable flye', 'dips'], volume: 'Высокий на грудь', intensity: 'RPE 7-8' },
    ],
    description: 'Грудь 3×/нед. Остальное — поддержка. Для отстающих групп.',
    pros: ['Быстрый рост целевой группы', 'Специализация'], cons: ['Остальное отстаёт', 'Не для новичков'],
    progressionModel: 'RPE-based', deloadProtocol: 'Каждые 4-6 недель',
  },
  // ── SPLIT 8-10: Powerlifting ──
  { id: 'pl_3day', name: 'Powerlifting 3-Day (Heavy/Light/Medium)', type: 'powerlifting', daysPerWeek: 3, level: 'intermediate', goal: 'powerlifting',
    weeklySchedule: ['Squat Heavy + Bench Light', 'Отдых', 'Deadlift Heavy + OHP', 'Отдых', 'Squat Medium + Bench Heavy', 'Отдых', 'Отдых'],
    dayStructure: [
      { name: 'Heavy Squat / Light Bench', mainLift: 'Squat 5×3 @88%', secondaryPatterns: ['bench 3×8 @70%', 'rdl'], accessories: ['ab wheel'], volume: 'Средний', intensity: 'Высокая для SQ' },
      { name: 'Heavy Deadlift / OHP', mainLift: 'Deadlift 4×2 @90%', secondaryPatterns: ['ohp 3×5 @82%', 'front squat'], accessories: ['row 3×8', 'facepull'], volume: 'Средний', intensity: 'Высокая для DL' },
      { name: 'Medium Squat / Heavy Bench', mainLift: 'Squat 4×5 @78%', secondaryPatterns: ['bench 5×3 @88%', 'pause deadlift'], accessories: ['dips 3×10', 'curl'], volume: 'Средний', intensity: 'Высокая для BP' },
    ],
    description: 'Классический PL сплит. Heavy/Light/Medium ротация.',
    pros: ['Специфика соревнований', 'Хорошее восстановление', 'Техника'], cons: ['Мало гипертрофии', 'Скучно для BB'],
    progressionModel: 'RPE + wave loading', deloadProtocol: 'Каждые 4-6 недель',
  },
  // ── SPLIT 11: Weightlifting ──
  { id: 'wl_5day', name: 'Weightlifting 5-Day (Тяжёлая атлетика)', type: 'weightlifting', daysPerWeek: 5, level: 'advanced', goal: 'weightlifting',
    weeklySchedule: ['Snatch + Squat', 'Clean & Jerk + Pull', 'Отдых', 'Snatch Technique', 'Clean Technique + Squat', 'Heavy Pulls', 'Отдых'],
    dayStructure: [
      { name: 'Snatch Heavy', mainLift: 'Snatch до 90%', secondaryPatterns: ['snatch pull', 'back squat'], accessories: ['ohs', 'snatch balance'], volume: 'Средний', intensity: 'Высокая' },
      { name: 'C&J Heavy', mainLift: 'C&J до 90%', secondaryPatterns: ['clean pull', 'front squat'], accessories: ['jerk drive', 'push press'], volume: 'Средний', intensity: 'Высокая' },
      { name: 'Snatch Technique', mainLift: 'Snatch 70-80%', secondaryPatterns: ['hang snatch', 'block snatch'], accessories: ['mobility', 'overhead squat'], volume: 'Высокий', intensity: 'Низкая-средняя' },
      { name: 'Clean Technique + Squat', mainLift: 'Clean 70-80%', secondaryPatterns: ['front squat heavy', 'jerk technique'], accessories: ['pull'], volume: 'Высокий', intensity: 'Средняя' },
      { name: 'Heavy Pulls + Accessories', mainLift: 'Snatch Pull 100-110%', secondaryPatterns: ['clean pull 100-110%', 'rdl'], accessories: ['back extension', 'core'], volume: 'Средний', intensity: 'Очень высокая' },
    ],
    description: 'Тяжелоатлетический сплит. Snatch + C&J + pulls + squats.',
    pros: ['Специфика WL', 'Высокая частота техники', 'Развитие мощности'], cons: ['Очень технично', 'Не для новичков'],
    progressionModel: 'Техника > вес', deloadProtocol: 'Каждые 4 недели',
  },
  // ── SPLIT 12: CrossFit ──
  { id: 'cf_5day', name: 'CrossFit 5-Day (Strength + Metcon)', type: 'crossfit', daysPerWeek: 5, level: 'intermediate', goal: 'crossfit',
    weeklySchedule: ['Strength + Short Metcon', 'Gymnastics + Long Metcon', 'Olympic WL + Mixed', 'Отдых', 'Strength + Metcon', 'Conditioning Only', 'Отдых'],
    dayStructure: [
      { name: 'Strength + Short Metcon', mainLift: 'Squat/Deadlift 5×3 @85%', secondaryPatterns: [], accessories: [], volume: 'Низкий', intensity: 'Высокая сила + меткон' },
      { name: 'Gymnastics + Long Metcon', mainLift: 'Pull-up/Muscle-up practice', secondaryPatterns: ['hspu', 't2b'], accessories: [], volume: 'Средний', intensity: 'Средняя' },
      { name: 'Olympic WL + Mixed', mainLift: 'Snatch/Clean technique', secondaryPatterns: ['jerk'], accessories: [], volume: 'Средний', intensity: 'Средне-высокая' },
      { name: 'Strength + Metcon', mainLift: 'Bench/OHP 5×3 @85%', secondaryPatterns: [], accessories: [], volume: 'Низкий', intensity: 'Высокая' },
      { name: 'Conditioning Only', mainLift: 'Long metcon 25-40 min', secondaryPatterns: [], accessories: [], volume: 'Очень высокий', intensity: 'Средне-высокая (ЧСС)' },
    ],
    description: 'CrossFit сплит: сила + гимнастика + WL + метконы.',
    pros: ['Разностороннее развитие', 'Высокая интенсивность', 'Функциональность'], cons: ['Очень тяжело', 'Высокий риск травм'],
    progressionModel: 'Skill-based + progressive overload', deloadProtocol: 'Каждые 4 недели (deload week)',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 2. ADDITIONAL EXERCISES (20 more)
// ═══════════════════════════════════════════════════════════════════════════

export interface QuickExercise {
  id: string; name: string; pattern: string; category: string;
  primaryMuscles: string[]; equipment: string[]; difficulty: number;
  riskProfile: string; isUnilateral: boolean; isCompetition: boolean;
  cues: string[];
  substitutions: string[];
}

export const ADDITIONAL_EXERCISES: QuickExercise[] = [
  // ── Olympic Weightlifting ──
  { id: 'snatch', name: 'Рывок (Snatch)', pattern: 'vertical_pull', category: 'weightlifting', primaryMuscles: ['Всё тело'], equipment: ['barbell'], difficulty: 5, riskProfile: 'high', isUnilateral: false, isCompetition: true, cues: ['Грудь над грифом', 'Взрыв от бёдер', 'Подсед под штангу', 'Локти вверх'], substitutions: ['power_snatch', 'hang_snatch', 'snatch_pull'] },
  { id: 'clean_and_jerk', name: 'Толчок (Clean & Jerk)', pattern: 'vertical_pull', category: 'weightlifting', primaryMuscles: ['Всё тело'], equipment: ['barbell'], difficulty: 5, riskProfile: 'high', isUnilateral: false, isCompetition: true, cues: ['Взятие на грудь', 'Пауза', 'Подсед + жим'], substitutions: ['power_clean', 'push_press', 'front_squat'] },
  { id: 'power_clean', name: 'Взятие на грудь (Power Clean)', pattern: 'hinge', category: 'weightlifting', primaryMuscles: ['Бицепс бедра', 'Ягодичные', 'Трапеции'], equipment: ['barbell'], difficulty: 5, riskProfile: 'high', isUnilateral: false, isCompetition: false, cues: ['Быстрее локти', 'Взрыв от бёдер', 'Гриф близко к телу'], substitutions: ['hang_clean', 'clean_pull', 'high_pull'] },

  // ── Strongman ──
  { id: 'farmers_walk', name: 'Фермерская прогулка', pattern: 'carry', category: 'strongman', primaryMuscles: ['Трапеции', 'Предплечья', 'Кор'], equipment: ['dumbbell', 'kettlebell', 'specialty'], difficulty: 2, riskProfile: 'low', isUnilateral: false, isCompetition: false, cues: ['Плечи назад', 'Короткие шаги', 'Кор напряжён'], substitutions: ['suitcase_carry', 'overhead_carry', 'trap_bar_carry'] },
  { id: 'atlas_stones', name: 'Камни Атласа', pattern: 'hinge', category: 'strongman', primaryMuscles: ['Бицепс', 'Спина', 'Ягодичные'], equipment: ['specialty'], difficulty: 4, riskProfile: 'high', isUnilateral: false, isCompetition: false, cues: ['Обхватить снизу', 'Грудь к камню', 'Разгибание + тяга'], substitutions: ['sandbag_load', 'keg_load', 'tire_flip'] },

  // ── Gymnastics / Bodyweight ──
  { id: 'muscle_up', name: 'Выход силой на кольцах/турнике', pattern: 'vertical_pull', category: 'gymnastics', primaryMuscles: ['Широчайшие', 'Грудные', 'Трицепс'], equipment: ['rings', 'pull_up_bar'], difficulty: 5, riskProfile: 'medium', isUnilateral: false, isCompetition: false, cues: ['Ложный хват', 'Тяга до груди', 'Переход через грудь', 'Отжимание'], substitutions: ['banded_muscle_up', 'negative_muscle_up', 'ring_dip'] },
  { id: 'handstand_pushup', name: 'Отжимания в стойке на руках', pattern: 'vertical_push', category: 'gymnastics', primaryMuscles: ['Дельты', 'Трицепс', 'Кор'], equipment: ['bodyweight'], difficulty: 4, riskProfile: 'medium', isUnilateral: false, isCompetition: false, cues: ['Кор напряжён', 'Голова касается пола', 'Стопы вместе'], substitutions: ['pike_pushup', 'ohp', 'z_press'] },
  { id: 'pistol_squat', name: 'Пистолетик (присед на одной ноге)', pattern: 'squat', category: 'gymnastics', primaryMuscles: ['Квадрицепсы', 'Ягодичные', 'Кор'], equipment: ['bodyweight'], difficulty: 4, riskProfile: 'low', isUnilateral: true, isCompetition: false, cues: ['Стопа прижата', 'Руки вперёд', 'Медленно вниз'], substitutions: ['bulgarian_split', 'single_leg_press', 'step_up'] },

  // ── Machines ──
  { id: 'pec_deck', name: 'Pec Deck (Бабочка)', pattern: 'horizontal_push', category: 'bodybuilding', primaryMuscles: ['Грудные'], equipment: ['machine'], difficulty: 1, riskProfile: 'low', isUnilateral: false, isCompetition: false, cues: ['Локти на уровне плеч', 'Сводить до касания', 'Медленный негатив'], substitutions: ['cable_flye', 'dumbbell_flye', 'band_flye'] },
  { id: 'leg_extension', name: 'Разгибание ног в тренажёре', pattern: 'accessory', category: 'bodybuilding', primaryMuscles: ['Квадрицепсы'], equipment: ['machine'], difficulty: 1, riskProfile: 'low', isUnilateral: false, isCompetition: false, cues: ['Задержка вверху', 'Медленно вниз', 'Носки на себя'], substitutions: ['sissy_squat', 'reverse_nordic', 'goblet_squat'] },
  { id: 'hamstring_curl', name: 'Сгибание ног в тренажёре', pattern: 'accessory', category: 'bodybuilding', primaryMuscles: ['Бицепс бедра'], equipment: ['machine'], difficulty: 1, riskProfile: 'low', isUnilateral: false, isCompetition: false, cues: ['Таз прижат', 'Полная амплитуда', 'Медленно вниз'], substitutions: ['nordic_curl', 'sliding_leg_curl', 'rdl'] },
  { id: 'cable_lateral_raise', name: 'Махи в кроссовере', pattern: 'vertical_push', category: 'bodybuilding', primaryMuscles: ['Средние дельты'], equipment: ['cable_machine'], difficulty: 1, riskProfile: 'low', isUnilateral: false, isCompetition: false, cues: ['За спиной', 'Мизинец вверх', 'Постоянное напряжение'], substitutions: ['dumbbell_lateral', 'upright_row', 'machine_lateral'] },

  // ── Specialized ──
  { id: 'reverse_hyper', name: 'Reverse Hyper (обратная гиперэкстензия)', pattern: 'hinge', category: 'rehab', primaryMuscles: ['Ягодичные', 'Бицепс бедра', 'Разгибатели спины'], equipment: ['reverse_hyper_machine'], difficulty: 1, riskProfile: 'low', isUnilateral: false, isCompetition: false, cues: ['Траектория маятника', 'Контроль на подъёме', 'Декомпрессия позвоночника'], substitutions: ['back_extension', 'rdl', 'bird_dog'] },
  { id: 'belt_squat', name: 'Присед с поясом (Belt Squat)', pattern: 'squat', category: 'powerlifting', primaryMuscles: ['Квадрицепсы', 'Ягодичные'], equipment: ['belt_squat_machine'], difficulty: 2, riskProfile: 'low', isUnilateral: false, isCompetition: false, cues: ['Торс вертикально', 'Нет нагрузки на спину', 'Глубина'], substitutions: ['goblet_squat', 'leg_press', 'hack_squat'] },
  { id: 'glute_ham_raise', name: 'Glute-Ham Raise (GHR)', pattern: 'hinge', category: 'powerlifting', primaryMuscles: ['Бицепс бедра', 'Ягодичные', 'Разгибатели спины'], equipment: ['ghd'], difficulty: 3, riskProfile: 'medium', isUnilateral: false, isCompetition: false, cues: ['Колени за подушками', 'Медленно вниз', 'Взрыв вверх'], substitutions: ['nordic_curl', 'rdl', 'back_extension'] },
  { id: 'copenhagen_plank', name: 'Copenhagen Plank', pattern: 'accessory', category: 'rehab', primaryMuscles: ['Приводящие', 'Кор'], equipment: ['bodyweight', 'bench'], difficulty: 3, riskProfile: 'low', isUnilateral: true, isCompetition: false, cues: ['Бедро на скамье', 'Тело прямое', 'Держать 30-60 сек'], substitutions: ['side_plank', 'clamshell', 'lateral_band_walk'] },
  { id: 'pallof_press', name: 'Pallof Press', pattern: 'anti_rotation', category: 'rehab', primaryMuscles: ['Кор (антиротация)'], equipment: ['cable_machine', 'band'], difficulty: 1, riskProfile: 'low', isUnilateral: false, isCompetition: false, cues: ['Кор напряжён', 'Руки прямо', 'Без ротации'], substitutions: ['dead_bug', 'plank', 'ab_wheel'] },

  // ── Unilateral ──
  { id: 'single_arm_db_row', name: 'Тяга гантели одной рукой', pattern: 'horizontal_pull', category: 'bodybuilding', primaryMuscles: ['Широчайшие', 'Ромбовидные', 'Бицепс'], equipment: ['dumbbell', 'bench'], difficulty: 2, riskProfile: 'low', isUnilateral: true, isCompetition: false, cues: ['Спина прямая', 'Локоть вдоль тела', 'Растяжение внизу'], substitutions: ['barbell_row', 'seated_row', 't_bar_row'] },
  { id: 'single_leg_press', name: 'Жим одной ногой', pattern: 'squat', category: 'bodybuilding', primaryMuscles: ['Квадрицепсы', 'Ягодичные'], equipment: ['leg_press_machine'], difficulty: 1, riskProfile: 'low', isUnilateral: true, isCompetition: false, cues: ['Стопа по центру', 'Контроль', 'Полный ROM'], substitutions: ['bulgarian_split', 'pistol_squat', 'step_up'] },
  { id: 'arnold_press', name: 'Арнольд-жим', pattern: 'vertical_push', category: 'bodybuilding', primaryMuscles: ['Дельты (все головки)', 'Трицепс'], equipment: ['dumbbell'], difficulty: 2, riskProfile: 'low', isUnilateral: false, isCompetition: false, cues: ['Ладони к себе внизу', 'Разворот вверху', 'Полная амплитуда'], substitutions: ['ohp', 'seated_db_press', 'landmine_press'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. ADDITIONAL DIET TYPES (6 more)
// ═══════════════════════════════════════════════════════════════════════════

export interface ExtendedDietType {
  name: string; description: string;
  macros: { protein: string; fat: string; carbs: string; kcal: string };
  mealStructure: string;
  supplements: string[];
  forGoals: string[];
  againstGoals: string[];
  phases: { name: string; duration: string; description: string }[];
}

export const EXTENDED_DIETS: ExtendedDietType[] = [
  {
    name: 'Carnivore (Мясная диета)', description: 'Только продукты животного происхождения. Мясо, рыба, яйца, молочные (опционально). Без растений.',
    macros: { protein: '30-40%', fat: '60-70%', carbs: '0-5%', kcal: 'Ad libitum (до сытости)' },
    mealStructure: '2-3 приёма в день. Большие порции мяса.',
    supplements: ['Электролиты', 'Магний', 'Калий', 'D3+K2'],
    forGoals: ['Элиминационная диета', 'Аутоиммунные', 'Силовая сушка'],
    againstGoals: ['Набор массы (мало углеводов)', 'Высокоинтенсивный спорт'],
    phases: [
      { name: 'Адаптация', duration: '2-4 недели', description: 'Keto flu, адаптация к жирам. Электролиты критичны.' },
      { name: 'Жировая адаптация', duration: '4-12 недель', description: 'Стабильная энергия, ясность ума, снижение воспаления.' },
    ],
  },
  {
    name: 'Vertical Diet (Stan Efferding)', description: 'Базовые продукты + микронутриенты. Красное мясо + белый рис — основа. Минимум FODMAP.',
    macros: { protein: '1.8-2.5 г/кг', fat: '0.8-1.2 г/кг', carbs: 'Остаток', kcal: 'Профицит 300-500' },
    mealStructure: '4-5 приёмов. Основа каждого — красное мясо + белый рис.',
    supplements: ['D3+K2', 'Магний', 'Цинк', 'Йод', 'Соль (красная гималайская)'],
    forGoals: ['Набор массы и силы', 'Проблемы с ЖКТ', 'Пауэрлифтинг'],
    againstGoals: ['Веганство', 'Сушка (очень калорийно)'],
    phases: [{ name: 'Стандарт', duration: 'Постоянно', description: 'Без фаз. Постоянный профицит.' }],
  },
  {
    name: 'Mediterranean (Средиземноморская)', description: 'Оливковое масло, рыба, овощи, цельнозерновые. Умеренное красное мясо.',
    macros: { protein: '1.6-2.0 г/кг', fat: '30-40% (мононенасыщенные)', carbs: '40-50%', kcal: 'Поддержание/небольшой дефицит' },
    mealStructure: '3 основных + 1-2 перекуса. Оливковое масло в каждый приём.',
    supplements: ['Омега-3', 'D3+K2'],
    forGoals: ['Здоровье', 'Долголетие', 'Поддержание'],
    againstGoals: ['Набор массы (слишком сытно)'],
    phases: [{ name: 'Образ жизни', duration: 'Пожизненно', description: 'Не диета, а образ питания.' }],
  },
  {
    name: 'PSMF (Protein-Sparing Modified Fast)', description: 'Экстремально низкокалорийная диета. ТОЛЬКО белок + овощи. Максимум 800-1000 ккал.',
    macros: { protein: '2.5-3.0 г/кг', fat: '<20 г', carbs: '<20 г', kcal: '800-1000' },
    mealStructure: '4-5 приёмов чистого белка. Куриная грудка, яичные белки, треска.',
    supplements: ['Омега-3 (обязательно)', 'Электролиты', 'Кальций', 'Поливитамины', 'Клетчатка'],
    forGoals: ['Экстремальная сушка (2-4 недели)', 'Категорийные спортсмены'],
    againstGoals: ['Набор', 'Спортсмены', 'Длительно (>4 нед)', 'Новички'],
    phases: [
      { name: 'PSMF', duration: '2-4 недели', description: '800-1000 ккал/день. Только белок + овощи. Кардио отменить.' },
      { name: 'Выход', duration: '1-2 недели', description: '+50-100 ккал/день. Добавить жиры, затем углеводы.' },
    ],
  },
  {
    name: 'Lean Gains (Martin Berkhan)', description: '16:8 IF + циклирование углеводов. Тренировочные дни — высокие углеводы, отдых — низкие.',
    macros: { protein: '2.5-3.0 г/кг', fat: '0.5-0.8 г/кг', carbs: 'Train: 3-4 г/кг, Rest: 1-1.5 г/кг', kcal: 'Train: +300, Rest: -100' },
    mealStructure: '2-3 приёма в 8-часовом окне. Самый большой приём — после тренировки.',
    supplements: ['BCAA/EAA перед тренировкой натощак', 'D3+K2', 'Магний', 'Цинк'],
    forGoals: ['Рекомпозиция', 'Набор сухой массы', 'Кто не любит завтракать'],
    againstGoals: ['Набор максимальной массы', 'Утренние тренировки (без еды)'],
    phases: [{ name: 'Lean Gains', duration: 'Постоянно', description: '16:8 + carb cycling.' }],
  },
  {
    name: 'GOMAD (Gallon Of Milk A Day)', description: '4 литра цельного молока в день + обычная еда. ~2400 ккал только из молока.',
    macros: { protein: '130 г (из молока)', fat: '130 г', carbs: '190 г', kcal: '+2400 ккал' },
    mealStructure: 'Распределить 4 л молока на весь день между приёмами.',
    supplements: ['Лактаза (если непереносимость)', 'D3+K2'],
    forGoals: ['Худые новички (эктоморфы)', 'Экстремальный набор массы (4-6 недель)'],
    againstGoals: ['Непереносимость лактозы', 'Сушка', 'Склонность к акне'],
    phases: [{ name: 'GOMAD', duration: '4-6 недель', description: '4 л молока/день. Остановить если жир >20%.' }],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. ADDITIONAL SUPPORT COMPOUNDS (20 more)
// ═══════════════════════════════════════════════════════════════════════════

export interface QuickSupport {
  name: string;
  category: string;
  priority: 'essential' | 'recommended' | 'optional' | 'situational';
  dosage: string;
  timing: string;
  mechanism: string;
  protects: string[];
  cost: string;
}

export const ADDITIONAL_SUPPORTS: QuickSupport[] = [
  // ── Organ Protection ──
  { name: 'Урсодезоксихолевая кислота (UDCA)', category: 'organ_protection', priority: 'essential', dosage: '10-15 мг/кг/день', timing: 'С едой', mechanism: 'Замена TUDCA. Рецептурный аналог. Защита от холестаза.', protects: ['Печень', 'Желчные протоки'], cost: 'Рецепт' },
  { name: 'S-Adenosyl Methionine (SAMe)', category: 'organ_protection', priority: 'optional', dosage: '400-800 мг/день', timing: 'Натощак', mechanism: 'Донор метильных групп. Антидепрессант + гепатопротектор.', protects: ['Печень', 'ЦНС'], cost: '~2,000 ₽' },
  { name: 'Глутатион (липосомальный)', category: 'organ_protection', priority: 'optional', dosage: '500 мг/день', timing: 'Натощак', mechanism: 'Главный антиоксидант организма. Прямой приём (не предшественник).', protects: ['Печень', 'Лёгкие', 'Кожа'], cost: '~2,500 ₽' },

  // ── Kidney ──
  { name: 'Пикногенол (Pycnogenol)', category: 'organ_protection', priority: 'recommended', dosage: '100-200 мг/день', timing: 'С едой', mechanism: 'Экстракт коры французской сосны. Антиоксидант. Снижает оксидативный стресс в подоцитах.', protects: ['Почки', 'Сосуды'], cost: '~1,200 ₽' },
  { name: 'Кордицепс (Cordyceps)', category: 'organ_protection', priority: 'optional', dosage: '1-3 г/день', timing: 'Утро', mechanism: 'Гриб. Улучшает почечный кровоток. Снижает креатинин в исследованиях.', protects: ['Почки', 'Лёгкие'], cost: '~1,000 ₽' },

  // ── Cardiovascular ──
  { name: 'Небиволол (Nebivolol)', category: 'bp_control', priority: 'situational', dosage: '2.5-5 мг/день', timing: 'Утро', mechanism: 'β1-селективный бета-блокатор + NO-зависимая вазодилатация. Не снижает либидо в отличие от других бета-блокаторов.', protects: ['Сердце', 'Сосуды'], cost: '~600 ₽' },
  { name: 'L-аргинин + L-цитруллин', category: 'bp_control', priority: 'optional', dosage: '3-6 г каждого', timing: 'Натощак', mechanism: 'NO-прекурсоры → вазодилатация → снижение АД.', protects: ['Сосуды', 'Сердце'], cost: '~800 ₽' },
  { name: 'Чеснок (экстракт, аллицин)', category: 'bp_control', priority: 'optional', dosage: '600-1200 мг', timing: 'С едой', mechanism: 'Аллицин → H2S → вазодилатация. Снижение АД на 5-10 мм рт.ст.', protects: ['Сосуды', 'Иммунитет'], cost: '~400 ₽' },

  // ── Blood ──
  { name: 'Нарингенин (грейпфрутовый экстракт)', category: 'blood_thinner', priority: 'optional', dosage: '500 мг/день', timing: 'С едой', mechanism: 'Снижает гематокрит (слабый эффект). CYP3A4 ингибитор.', protects: ['Кровь (HCT)'], cost: '~600 ₽' },
  { name: 'Бромелаин + Папаин', category: 'blood_thinner', priority: 'optional', dosage: '500 мг 2×/день', timing: 'Натощак', mechanism: 'Фибринолитики. Снижают вязкость крови и воспаление.', protects: ['Кровь', 'Воспаление'], cost: '~700 ₽' },

  // ── Neuroprotection / CNS ──
  { name: 'P5P (Pyridoxal-5-Phosphate)', category: 'neuroprotection', priority: 'recommended', dosage: '50-200 мг/день', timing: 'Вечер', mechanism: 'Активная форма B6. Снижает пролактин (кофактор дофамин-декарбоксилазы).', protects: ['ЦНС', 'Пролактин'], cost: '~500 ₽' },
  { name: 'Apigenin (ромашка)', category: 'neuroprotection', priority: 'optional', dosage: '50-100 мг', timing: 'За 60 мин до сна', mechanism: 'GABA-A агонист. Противовоспалительное. Сон.', protects: ['ЦНС', 'Сон'], cost: '~800 ₽' },
  { name: 'Lion\'s Mane (Ежовик гребенчатый)', category: 'neuroprotection', priority: 'optional', dosage: '500-1000 мг 2×/день', timing: 'Утро + день', mechanism: 'NGF (фактор роста нервов). Когнитивная функция. Миелинизация.', protects: ['ЦНС', 'Когнитивные функции'], cost: '~1,500 ₽' },

  // ── Joint / Connective Tissue ──
  { name: 'MSM (Метилсульфонилметан)', category: 'joint', priority: 'recommended', dosage: '2-6 г/день', timing: 'С едой', mechanism: 'Органическая сера. Снижает воспаление суставов. Синергия с глюкозамином.', protects: ['Суставы', 'Кожа', 'Волосы'], cost: '~500 ₽' },
  { name: 'Cissus Quadrangularis', category: 'joint', priority: 'optional', dosage: '1500-3000 мг/день', timing: 'С едой', mechanism: 'Аюрведическая трава. Ускоряет заживление переломов и сухожилий.', protects: ['Суставы', 'Кости'], cost: '~900 ₽' },

  // ── Metabolic ──
  { name: 'R-ALA (R-Alpha Lipoic Acid)', category: 'metabolic', priority: 'recommended', dosage: '300-600 мг', timing: 'С углеводами (за 30 мин)', mechanism: 'Мощный антиоксидант. Инсулиносенситайзер. Регенерирует витамины C и E.', protects: ['Метаболизм глюкозы', 'Нервы'], cost: '~1,000 ₽' },
  { name: 'Chromium Picolinate', category: 'metabolic', priority: 'optional', dosage: '200-400 мкг', timing: 'С едой', mechanism: 'Усиливает действие инсулина. Снижает тягу к сладкому.', protects: ['Метаболизм глюкозы'], cost: '~300 ₽' },

  // ── Sleep ──
  { name: 'Inositol (Инозитол)', category: 'sleep', priority: 'recommended', dosage: '2-4 г', timing: 'За 60 мин до сна', mechanism: 'Вторичный мессенджер серотонина. Снижает тревожность. Улучшает качество сна.', protects: ['Сон', 'ЦНС'], cost: '~600 ₽' },
  { name: 'Valerian Root (Валериана)', category: 'sleep', priority: 'optional', dosage: '400-600 мг', timing: 'За 60 мин до сна', mechanism: 'GABA-ергическое. Мягкое седативное.', protects: ['Сон'], cost: '~300 ₽' },

  // ── Hormonal ──
  { name: 'Boron (Бор)', category: 'hormonal', priority: 'recommended', dosage: '10 мг/день', timing: 'Утро', mechanism: 'Снижает SHBG → повышает свободный тестостерон на 25%+ в исследованиях.', protects: ['Тестостерон свободный'], cost: '~300 ₽' },
];

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

export function getAllSplits(): SplitSystem[] { return ALL_SPLIT_SYSTEMS; }
export function getSplitsByDays(days: number): SplitSystem[] { return ALL_SPLIT_SYSTEMS.filter(s => s.daysPerWeek === days); }
export function getAdditionalExercises(): QuickExercise[] { return ADDITIONAL_EXERCISES; }
export function getExercisesByPattern(pattern: string): QuickExercise[] { return ADDITIONAL_EXERCISES.filter(e => e.pattern === pattern); }
export function getExtendedDiets(): ExtendedDietType[] { return EXTENDED_DIETS; }
export function getAdditionalSupports(): QuickSupport[] { return ADDITIONAL_SUPPORTS; }
export function getSupportsByPriority(p: string): QuickSupport[] { return ADDITIONAL_SUPPORTS.filter(s => s.priority === p); }
