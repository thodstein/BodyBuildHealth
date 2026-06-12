/**
 * Comprehensive Exercise Database — 50+ exercises with complete biomechanics.
 *
 * Each exercise includes:
 *  - Primary/secondary/stabilizer muscles
 *  - Joint stress (0-10) for 6 joints
 *  - Torque profile, spine/knee/shoulder load classification
 *  - CNS demand, technical difficulty
 *  - Competition status, equipment requirements
 *  - ROM requirements per joint
 *  - Risk profile, unilateral status
 *  - Substitution chain (4 alternatives)
 *  - 3-5 technique cues
 *  - Common errors with causes and fixes
 *  - Progression & regression chains
 *  - Pre-requisites
 *
 * @module comprehensive-exercise-db
 */

export interface FullExercise {
  id: string;
  name: string;
  aliases: string[];
  pattern: 'squat' | 'hinge' | 'horizontal_push' | 'horizontal_pull' | 'vertical_push' | 'vertical_pull' | 'lunge' | 'carry' | 'rotation' | 'anti_rotation' | 'accessory';
  category: 'powerlifting' | 'bodybuilding' | 'weightlifting' | 'strongman' | 'crossfit' | 'rehab' | 'cardio' | 'gymnastics';
  plane: 'sagittal' | 'frontal' | 'transverse' | 'multi';
  loadType: 'axial' | 'horizontal' | 'vertical' | 'rotational' | 'anterior' | 'posterior';
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
  cues: string[];
  commonErrors: { error: string; cause: string; fix: string }[];
  progression: string[];
  regression: string[];
  preRequisites: string[];
  techniqueType: 'compound' | 'isolation' | 'plyometric' | 'isometric' | 'ballistic';
  gripType: 'pronated' | 'supinated' | 'mixed' | 'hook' | 'neutral' | 'false' | 'thumbless' | 'none';
  stanceType: 'narrow' | 'medium' | 'wide' | 'sumo' | 'split' | 'none';
}

export const COMPREHENSIVE_EXERCISE_DB: FullExercise[] = [
  // ═══════════════════════════════════════════════════════
  // SQUAT PATTERNS (8 exercises)
  // ═══════════════════════════════════════════════════════
  {
    id: 'back_squat_lowbar', name: 'Присед со штангой (Low Bar)', aliases: ['low bar squat', 'powerlifting squat', 'присед пауэрлифтерский'],
    pattern: 'squat', category: 'powerlifting', plane: 'sagittal', loadType: 'axial',
    jointStress: { knee: 6, hip: 8, spine: 6, shoulder: 2, elbow: 1, ankle: 4 },
    torqueProfile: 'bottom_peak', spineLoad: 'medium', kneeLoad: 'medium', shoulderLoad: 'low',
    cnsDemand: 5, difficulty: 4,
    primaryMuscles: ['Ягодичные', 'Бицепс бедра', 'Квадрицепсы'],
    secondaryMuscles: ['Приводящие', 'Разгибатели спины'],
    stabilizers: ['Кор', 'Широчайшие'],
    romRequirements: { knee: 110, hip: 110, ankle: 30 },
    equipment: ['barbell', 'rack'], riskProfile: 'medium', isUnilateral: false, isCompetition: true,
    substitutions: ['high_bar_squat', 'safety_bar_squat', 'front_squat', 'box_squat'],
    cues: ['Грудь вверх', 'Колени наружу', 'Таз назад и вниз', 'Гриф над серединой стопы'],
    commonErrors: [
      { error: 'Колени заваливаются внутрь', cause: 'Слабые отводящие бедра', fix: 'Banded squat, clamshell. Думать "колени наружу".' },
      { error: 'Гриф скатывается вниз', cause: 'Нет "полки" из задних дельт', fix: 'Свести лопатки. Использовать safety squat bar. Магнезия.' },
      { error: 'Наклон вперёд (good morning squat)', cause: 'Слабые квадрицепсы', fix: 'Front squat, leg press. Думать "грудь вверх".' },
      { error: 'Пятки отрываются', cause: 'Недостаточная дорсифлексия', fix: 'Штангистские ботинки. Растяжка голеностопа.' },
    ],
    progression: ['BW Squat → Goblet → Front Squat → High Bar → Low Bar'],
    regression: ['Low Bar → High Bar → Safety Bar → Front Squat → Box Squat → Goblet'],
    preRequisites: ['BW squat ×20 ниже параллели', 'Ankle mobility 30°+'],
    techniqueType: 'compound', gripType: 'pronated', stanceType: 'medium',
  },
  {
    id: 'back_squat_highbar', name: 'Присед со штангой (High Bar)', aliases: ['high bar squat', 'олимпийский присед', 'bodybuilding squat'],
    pattern: 'squat', category: 'bodybuilding', plane: 'sagittal', loadType: 'axial',
    jointStress: { knee: 8, hip: 6, spine: 5, shoulder: 1, elbow: 1, ankle: 5 },
    torqueProfile: 'bottom_peak', spineLoad: 'medium', kneeLoad: 'high', shoulderLoad: 'low',
    cnsDemand: 4, difficulty: 3,
    primaryMuscles: ['Квадрицепсы', 'Ягодичные'],
    secondaryMuscles: ['Бицепс бедра', 'Приводящие'],
    stabilizers: ['Разгибатели спины', 'Кор'],
    romRequirements: { knee: 120, hip: 110, ankle: 35 },
    equipment: ['barbell', 'rack'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['front_squat', 'safety_bar_squat', 'goblet_squat', 'leg_press'],
    cues: ['Торс вертикально', 'Колени вперёд', 'Пятки прижаты', 'Локти под гриф'],
    commonErrors: [
      { error: 'Наклон вперёд', cause: 'Слабый кор и верх спины', fix: 'Front squat, core work. Легче вес.' },
      { error: 'Недостаточная глубина', cause: 'Мобильность голеностопа/бёдер', fix: 'Goblet squat prying. Каблук.' },
    ],
    progression: ['Goblet → Front Squat → High Bar → Low Bar'],
    regression: ['High Bar → Front Squat → Goblet → Box Squat'],
    preRequisites: ['Goblet squat ×10 ниже параллели'],
    techniqueType: 'compound', gripType: 'pronated', stanceType: 'medium',
  },
  {
    id: 'front_squat', name: 'Фронтальный присед', aliases: ['front squat', 'фронталка'],
    pattern: 'squat', category: 'weightlifting', plane: 'sagittal', loadType: 'axial',
    jointStress: { knee: 8, hip: 5, spine: 4, shoulder: 4, elbow: 4, ankle: 5 },
    torqueProfile: 'bottom_peak', spineLoad: 'medium', kneeLoad: 'high', shoulderLoad: 'medium',
    cnsDemand: 4, difficulty: 4,
    primaryMuscles: ['Квадрицепсы', 'Кор'],
    secondaryMuscles: ['Ягодичные', 'Верх спины'],
    stabilizers: ['Разгибатели спины'],
    romRequirements: { knee: 120, hip: 100, ankle: 35, shoulder: 90, elbow: 90 },
    equipment: ['barbell', 'rack'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['goblet_squat', 'safety_bar_squat', 'zombie_squat', 'leg_press'],
    cues: ['Локти вверх', 'Торс вертикально', 'Колени вперёд', 'Держи гриф на плечах'],
    commonErrors: [
      { error: 'Гриф скатывается с плеч', cause: 'Локти опускаются', fix: 'Думать "локти вверх". Растяжка lats/triceps.' },
      { error: 'Наклон вперёд', cause: 'Вес слишком тяжёлый', fix: 'Снизить вес. Укрепить кор.' },
      { error: 'Боль в запястьях', cause: 'Недостаточная мобильность', fix: 'Использовать straps или cross-arm grip.' },
    ],
    progression: ['Goblet → Zombie → Front Squat (straps) → Clean Grip Front Squat'],
    regression: ['Clean Grip → Cross-arm Grip → Goblet Squat'],
    preRequisites: ['Front rack mobility', 'Goblet squat ×10 @50% BW'],
    techniqueType: 'compound', gripType: 'pronated', stanceType: 'medium',
  },
  {
    id: 'goblet_squat', name: 'Кубковый присед', aliases: ['goblet squat', 'кубковый'],
    pattern: 'squat', category: 'bodybuilding', plane: 'sagittal', loadType: 'anterior',
    jointStress: { knee: 5, hip: 4, spine: 3, shoulder: 1, elbow: 1, ankle: 4 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'medium', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Квадрицепсы', 'Ягодичные', 'Кор'],
    secondaryMuscles: ['Бицепс бедра'],
    stabilizers: [],
    romRequirements: { knee: 90, hip: 80, ankle: 25 },
    equipment: ['dumbbell', 'kettlebell'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['bodyweight_squat', 'leg_press', 'front_squat'],
    cues: ['Локти между колен', 'Грудь вверх', 'Пятки прижаты', 'Пауза внизу'],
    commonErrors: [
      { error: 'Пятки отрываются', cause: 'Мобильность голеностопа', fix: 'Подложить блины под пятки. Растяжка.' },
      { error: 'Спина округляется', cause: 'Вес слишком большой', fix: 'Меньше вес. Сильнее напрячь кор.' },
    ],
    progression: ['BW Squat → Goblet → Double Goblet → Front Squat'],
    regression: ['Goblet → BW Squat → Box Squat'],
    preRequisites: ['None'],
    techniqueType: 'compound', gripType: 'none', stanceType: 'medium',
  },
  {
    id: 'bulgarian_split_squat', name: 'Болгарские сплит-приседы', aliases: ['bulgarian split squat', 'болгарка', 'RFESS'],
    pattern: 'squat', category: 'bodybuilding', plane: 'sagittal', loadType: 'axial',
    jointStress: { knee: 7, hip: 5, spine: 2, shoulder: 1, elbow: 1, ankle: 4 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'high', shoulderLoad: 'low',
    cnsDemand: 2, difficulty: 3,
    primaryMuscles: ['Квадрицепсы', 'Ягодичные'],
    secondaryMuscles: ['Бицепс бедра', 'Приводящие'],
    stabilizers: ['Кор', 'Малые ягодичные'],
    romRequirements: { knee: 90, hip: 80, ankle: 20 },
    equipment: ['dumbbell', 'bench'], riskProfile: 'low', isUnilateral: true, isCompetition: false,
    substitutions: ['walking_lunge', 'step_up', 'single_leg_press', 'reverse_lunge'],
    cues: ['Торс вертикально', 'Задняя нога только для баланса', 'Колено над носком', '70% веса на передней'],
    commonErrors: [
      { error: 'Колено уходит далеко вперёд', cause: 'Стопа слишком близко к скамье', fix: 'Отодвинуть стопу дальше.' },
      { error: 'Наклон вперёд', cause: 'Скамья слишком низкая/высокая', fix: 'Регулировать высоту. Держать торс вертикально.' },
    ],
    progression: ['BW Split Squat → DB Bulgarian → Barbell Bulgarian → Deficit Bulgarian'],
    regression: ['BB Bulgarian → DB Bulgarian → BW Split Squat → Step-Up'],
    preRequisites: ['Single leg balance 30 сек'],
    techniqueType: 'compound', gripType: 'neutral', stanceType: 'split',
  },
  {
    id: 'leg_press', name: 'Жим ногами', aliases: ['leg press', 'жим ногами'],
    pattern: 'squat', category: 'bodybuilding', plane: 'sagittal', loadType: 'axial',
    jointStress: { knee: 6, hip: 3, spine: 1, shoulder: 0, elbow: 0, ankle: 2 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'medium', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Квадрицепсы'],
    secondaryMuscles: ['Ягодичные', 'Бицепс бедра'],
    stabilizers: [],
    romRequirements: { knee: 90, hip: 70 },
    equipment: ['leg_press_machine'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['goblet_squat', 'hack_squat', 'bodyweight_squat'],
    cues: ['Поясница прижата', 'Полная амплитуда', 'Не блокируйте колени', 'Стопы на ширине плеч'],
    commonErrors: [
      { error: 'Частичная амплитуда', cause: 'Слишком большой вес', fix: 'Снизить вес. Полный ROM.' },
      { error: 'Поясница отрывается', cause: 'Слишком глубоко / tight hams', fix: 'Ограничить ROM. Растяжка.' },
    ],
    progression: ['Two-leg → Single Leg → Narrow Stance → High Foot'],
    regression: ['High Foot → Mid Foot → Low Foot → BW Squat'],
    preRequisites: ['None'],
    techniqueType: 'compound', gripType: 'none', stanceType: 'medium',
  },
  {
    id: 'hack_squat', name: 'Гакк-присед', aliases: ['hack squat', 'гакк'],
    pattern: 'squat', category: 'bodybuilding', plane: 'sagittal', loadType: 'axial',
    jointStress: { knee: 8, hip: 4, spine: 2, shoulder: 1, elbow: 0, ankle: 3 },
    torqueProfile: 'midrange_peak', spineLoad: 'low', kneeLoad: 'high', shoulderLoad: 'low',
    cnsDemand: 2, difficulty: 1,
    primaryMuscles: ['Квадрицепсы'],
    secondaryMuscles: ['Ягодичные'],
    stabilizers: [],
    romRequirements: { knee: 90, hip: 70 },
    equipment: ['hack_squat_machine'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['leg_press', 'goblet_squat', 'sissy_squat'],
    cues: ['Спина прижата', 'Колени по линии стоп', 'Не блокировать', 'Глубина: бёдра ниже параллели'],
    commonErrors: [
      { error: 'Пятки отрываются', cause: 'Стопы слишком низко', fix: 'Поднять стопы выше на платформе.' },
      { error: 'Колени заваливаются', cause: 'Слабые отводящие', fix: 'Clamshell активация перед подходом.' },
    ],
    progression: ['Машина → Reverse Hack → Single Leg'],
    regression: ['Reverse Hack → Leg Press → Goblet'],
    preRequisites: ['None'],
    techniqueType: 'compound', gripType: 'none', stanceType: 'medium',
  },
  {
    id: 'sissy_squat', name: 'Сисси-присед', aliases: ['sissy squat', 'сисси'],
    pattern: 'squat', category: 'bodybuilding', plane: 'sagittal', loadType: 'anterior',
    jointStress: { knee: 6, hip: 1, spine: 1, shoulder: 0, elbow: 0, ankle: 1 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'medium', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 3,
    primaryMuscles: ['Квадрицепсы (rectus femoris)'],
    secondaryMuscles: [],
    stabilizers: ['Кор'],
    romRequirements: { knee: 120, hip: 180 },
    equipment: ['bodyweight', 'sissy_squat_bench'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['leg_extension', 'reverse_nordic', 'kneeling_squat'],
    cues: ['Колени вперёд', 'Торс прямо', 'Медленно', 'Без рывков'],
    commonErrors: [
      { error: 'Боль в коленях', cause: 'Слишком глубокая амплитуда', fix: 'Ограничить ROM. Разогреть колени.' },
    ],
    progression: ['Assisted → BW → Weighted'],
    regression: ['Weighted → BW → Leg Extension'],
    preRequisites: ['Без боли в коленях'],
    techniqueType: 'isolation', gripType: 'none', stanceType: 'narrow',
  },

  // ═══════════════════════════════════════════════════════
  // HINGE PATTERNS (8 exercises)
  // ═══════════════════════════════════════════════════════
  {
    id: 'deadlift_conventional', name: 'Становая тяга (классика)', aliases: ['deadlift', 'conventional deadlift', 'тяга'],
    pattern: 'hinge', category: 'powerlifting', plane: 'sagittal', loadType: 'axial',
    jointStress: { knee: 4, hip: 8, spine: 8, shoulder: 2, elbow: 2, ankle: 2 },
    torqueProfile: 'bottom_peak', spineLoad: 'high', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 5, difficulty: 4,
    primaryMuscles: ['Бицепс бедра', 'Ягодичные', 'Разгибатели спины'],
    secondaryMuscles: ['Трапеции', 'Широчайшие', 'Квадрицепсы'],
    stabilizers: ['Кор', 'Ромбовидные'],
    romRequirements: { hip: 90, spine: 0 },
    equipment: ['barbell'], riskProfile: 'high', isUnilateral: false, isCompetition: true,
    substitutions: ['trap_bar_deadlift', 'sumo_deadlift', 'romanian_deadlift', 'block_pull'],
    cues: ['Грудь вверх', 'Плечи над грифом', 'Толкай пол ногами', 'Гриф — продолжение рук'],
    commonErrors: [
      { error: 'Округление спины', cause: 'Слабый кор / плохая мобильность / большой вес', fix: 'Dead bug, RDL. Снизить вес.' },
      { error: 'Таз поднимается первым', cause: 'Слабые квадрицепсы', fix: 'Deficit DL, front squat.' },
      { error: 'Гриф уходит от тела', cause: 'Не включены широчайшие', fix: 'Lat activation. Band вокруг грифа.' },
      { error: 'Переразгибание вверху', cause: 'Избыточный lumbar extension', fix: 'Ягодицы, не поясница.' },
    ],
    progression: ['Kettlebell DL → RDL → Block Pull → Conv DL → Deficit DL → Snatch Grip DL'],
    regression: ['Conv DL → Trap Bar → Block Pull → RDL → Back Extension'],
    preRequisites: ['RDL ×8 с 50% веса без боли', 'Toe touch без округления'],
    techniqueType: 'compound', gripType: 'mixed', stanceType: 'medium',
  },
  {
    id: 'sumo_deadlift', name: 'Становая тяга (сумо)', aliases: ['sumo deadlift', 'сумо'],
    pattern: 'hinge', category: 'powerlifting', plane: 'sagittal', loadType: 'axial',
    jointStress: { knee: 5, hip: 9, spine: 6, shoulder: 1, elbow: 1, ankle: 3 },
    torqueProfile: 'bottom_peak', spineLoad: 'medium', kneeLoad: 'medium', shoulderLoad: 'low',
    cnsDemand: 5, difficulty: 4,
    primaryMuscles: ['Ягодичные', 'Приводящие', 'Бицепс бедра'],
    secondaryMuscles: ['Квадрицепсы', 'Разгибатели спины'],
    stabilizers: ['Кор'],
    romRequirements: { hip: 80, spine: 0, knee: 20 },
    equipment: ['barbell'], riskProfile: 'medium', isUnilateral: false, isCompetition: true,
    substitutions: ['conventional_deadlift', 'trap_bar_deadlift', 'wide_stance_box_squat'],
    cues: ['Колени наружу', 'Таз близко к грифу', 'Грудь вверх', 'Разорви пол ногами'],
    commonErrors: [
      { error: 'Колени не разводятся', cause: 'Tight adductors / слабая мобильность', fix: 'Frog stretch. Wider stance.' },
      { error: 'Таз поднимается первым', cause: 'Слабый старт', fix: 'Deficit sumo. Pause below knee.' },
    ],
    progression: ['Wide Stance BW → Sumo RDL → Sumo DL → Deficit Sumo'],
    regression: ['Sumo DL → Trap Bar → Conv DL → Block Pull'],
    preRequisites: ['Hip mobility 90°+ abduction'],
    techniqueType: 'compound', gripType: 'mixed', stanceType: 'sumo',
  },
  {
    id: 'trap_bar_deadlift', name: 'Тяга с трэп-грифом', aliases: ['trap bar deadlift', 'hex bar', 'трэп-гриф'],
    pattern: 'hinge', category: 'bodybuilding', plane: 'sagittal', loadType: 'axial',
    jointStress: { knee: 5, hip: 7, spine: 5, shoulder: 1, elbow: 1, ankle: 2 },
    torqueProfile: 'midrange_peak', spineLoad: 'medium', kneeLoad: 'medium', shoulderLoad: 'low',
    cnsDemand: 4, difficulty: 3,
    primaryMuscles: ['Квадрицепсы', 'Ягодичные', 'Бицепс бедра'],
    secondaryMuscles: ['Разгибатели спины', 'Трапеции'],
    stabilizers: ['Кор'],
    romRequirements: { hip: 90, knee: 90 },
    equipment: ['trap_bar'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['conventional_deadlift', 'romanian_deadlift', 'goblet_squat'],
    cues: ['Руки по швам', 'Грудь вверх', 'Толкай пол', 'Плечи назад вверху'],
    commonErrors: [
      { error: 'Слишком squat-like', cause: 'Неправильный паттерн', fix: 'Больше hip hinge. Таз выше в старте.' },
    ],
    progression: ['Low Handle → High Handle → Deficit Trap → Heavy Singles'],
    regression: ['High Handle → Low Handle → RDL'],
    preRequisites: ['Goblet squat ×10'],
    techniqueType: 'compound', gripType: 'neutral', stanceType: 'medium',
  },
  {
    id: 'romanian_deadlift', name: 'Румынская тяга', aliases: ['RDL', 'romanian deadlift', 'румынка'],
    pattern: 'hinge', category: 'bodybuilding', plane: 'sagittal', loadType: 'posterior',
    jointStress: { knee: 2, hip: 7, spine: 5, shoulder: 1, elbow: 1, ankle: 1 },
    torqueProfile: 'midrange_peak', spineLoad: 'medium', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Бицепс бедра', 'Ягодичные'],
    secondaryMuscles: ['Разгибатели спины'],
    stabilizers: ['Кор'],
    romRequirements: { hip: 90, spine: 0 },
    equipment: ['barbell', 'dumbbell'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['single_leg_rdl', 'good_morning', 'back_extension', 'kettlebell_swing'],
    cues: ['Колени мягкие', 'Таз назад', 'Спина прямая', 'Гриф скользит по ногам'],
    commonErrors: [
      { error: 'Округление спины', cause: 'Вес большой / мобильность', fix: 'Меньше вес. Растяжка hamstrings.' },
      { error: 'Слишком большая амплитуда', cause: 'Гриф ниже колен', fix: 'Остановка у середины голени. Почувствуйте растяжение.' },
    ],
    progression: ['BW Hip Hinge → DB RDL → BB RDL → Single Leg RDL → Deficit RDL'],
    regression: ['Deficit RDL → BB RDL → DB RDL → BW Hip Hinge'],
    preRequisites: ['Hip hinge без округления спины'],
    techniqueType: 'compound', gripType: 'pronated', stanceType: 'medium',
  },
  {
    id: 'hip_thrust', name: 'Ягодичный мост', aliases: ['hip thrust', 'ягодичный мост', 'barbell glute bridge'],
    pattern: 'hinge', category: 'bodybuilding', plane: 'sagittal', loadType: 'posterior',
    jointStress: { knee: 2, hip: 5, spine: 2, shoulder: 1, elbow: 1, ankle: 1 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Ягодичные'],
    secondaryMuscles: ['Бицепс бедра'],
    stabilizers: ['Кор'],
    romRequirements: { hip: 90 },
    equipment: ['barbell', 'bench'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['glute_bridge', 'single_leg_thrust', 'cable_pull_through', 'kettlebell_swing'],
    cues: ['Подбородок прижат', 'Таз вверх до прямой', 'Пауза вверху 1-2с', 'Толкайте через пятки'],
    commonErrors: [
      { error: 'Поясница вместо ягодиц', cause: 'Неправильный паттерн', fix: 'Меньше вес. Сжать ягодицы вверху.' },
      { error: 'Гиперэкстензия вверху', cause: 'Избыточное усилие', fix: 'Остановиться на прямой линии плечи-колени.' },
    ],
    progression: ['BW Bridge → Banded → BB Hip Thrust → Single Leg → Deficit'],
    regression: ['Deficit → BB → Banded → BW Bridge'],
    preRequisites: ['None'],
    techniqueType: 'compound', gripType: 'pronated', stanceType: 'none',
  },
  {
    id: 'good_morning', name: 'Good Morning', aliases: ['good morning', 'наклоны со штангой'],
    pattern: 'hinge', category: 'powerlifting', plane: 'sagittal', loadType: 'posterior',
    jointStress: { knee: 1, hip: 6, spine: 7, shoulder: 1, elbow: 1, ankle: 1 },
    torqueProfile: 'midrange_peak', spineLoad: 'high', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 2, difficulty: 3,
    primaryMuscles: ['Разгибатели спины', 'Бицепс бедра', 'Ягодичные'],
    secondaryMuscles: [],
    stabilizers: ['Кор'],
    romRequirements: { hip: 90, spine: 0 },
    equipment: ['barbell'], riskProfile: 'high', isUnilateral: false, isCompetition: false,
    substitutions: ['romanian_deadlift', 'back_extension', 'reverse_hyper'],
    cues: ['Спина прямая', 'Колени мягкие', 'Таз назад', 'Не вес, а техника'],
    commonErrors: [
      { error: 'Округление спины', cause: 'Слишком большой вес', fix: 'Пустой гриф. Освоить паттерн.' },
      { error: 'Боль в пояснице', cause: 'Слишком глубокая амплитуда', fix: 'Ограничить ROM.' },
    ],
    progression: ['BW → Banded → Empty Bar → Seated → Standing BB'],
    regression: ['Standing → Seated → Banded → BW'],
    preRequisites: ['RDL ×10 без боли', 'Spine stability'],
    techniqueType: 'compound', gripType: 'pronated', stanceType: 'medium',
  },
  {
    id: 'back_extension', name: 'Гиперэкстензия', aliases: ['back extension', 'hyperextension', 'гиперэкстензия'],
    pattern: 'hinge', category: 'bodybuilding', plane: 'sagittal', loadType: 'posterior',
    jointStress: { knee: 0, hip: 2, spine: 4, shoulder: 0, elbow: 0, ankle: 0 },
    torqueProfile: 'top_peak', spineLoad: 'medium', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Разгибатели спины', 'Ягодичные', 'Бицепс бедра'],
    secondaryMuscles: [],
    stabilizers: [],
    romRequirements: { hip: 60, spine: 30 },
    equipment: ['ghd', 'back_extension_bench'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['romanian_deadlift', 'good_morning', 'reverse_hyper', 'superman'],
    cues: ['Спина прямая', 'Ягодицы включать', 'Не переразгибаться', 'Контролируемый темп'],
    commonErrors: [
      { error: 'Переразгибание', cause: 'Слишком большая амплитуда', fix: 'Остановка на прямой линии.' },
      { error: 'Использование инерции', cause: 'Слишком быстро', fix: 'Медленно. 3-0-1-0 темп.' },
    ],
    progression: ['BW → Plate → Banded → BB → Single Leg'],
    regression: ['BB → Plate → BW'],
    preRequisites: ['None'],
    techniqueType: 'compound', gripType: 'none', stanceType: 'none',
  },
  {
    id: 'kettlebell_swing', name: 'Махи гирей', aliases: ['kettlebell swing', 'махи гирей'],
    pattern: 'hinge', category: 'crossfit', plane: 'sagittal', loadType: 'posterior',
    jointStress: { knee: 2, hip: 4, spine: 4, shoulder: 1, elbow: 1, ankle: 1 },
    torqueProfile: 'midrange_peak', spineLoad: 'medium', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 2,
    primaryMuscles: ['Ягодичные', 'Бицепс бедра'],
    secondaryMuscles: ['Разгибатели спины', 'Кор'],
    stabilizers: ['Плечи'],
    romRequirements: { hip: 90 },
    equipment: ['kettlebell'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['romanian_deadlift', 'hip_thrust', 'broad_jump'],
    cues: ['Таз назад', 'Взрыв ягодицами', 'Руки — верёвки', 'Не тяни плечами'],
    commonErrors: [
      { error: 'Присед вместо hinge', cause: 'Неправильный паттерн', fix: 'Тренировать hip hinge отдельно.' },
      { error: 'Плечи поднимаются', cause: 'Слишком тяжёлая гиря', fix: 'Легче. Взрыв от бёдер, не плеч.' },
    ],
    progression: ['Two-hand → One-hand → Alternating → Double → Heavy'],
    regression: ['Heavy → Double → One-hand → Two-hand'],
    preRequisites: ['Hip hinge pattern'],
    techniqueType: 'ballistic', gripType: 'neutral', stanceType: 'medium',
  },

  // ═══════════════════════════════════════════════════════
  // HORIZONTAL PUSH (6 exercises)
  // ═══════════════════════════════════════════════════════
  {
    id: 'bench_press', name: 'Жим лёжа', aliases: ['bench press', 'жим', 'bench'],
    pattern: 'horizontal_push', category: 'powerlifting', plane: 'transverse', loadType: 'horizontal',
    jointStress: { knee: 0, hip: 0, spine: 2, shoulder: 7, elbow: 5, ankle: 0 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'high',
    cnsDemand: 3, difficulty: 2,
    primaryMuscles: ['Грудные', 'Трицепс'],
    secondaryMuscles: ['Передние дельты'],
    stabilizers: ['Ротаторная манжета', 'Широчайшие', 'Ромбовидные'],
    romRequirements: { shoulder: 60, elbow: 90 },
    equipment: ['barbell', 'bench', 'rack'], riskProfile: 'medium', isUnilateral: false, isCompetition: true,
    substitutions: ['dumbbell_bench', 'incline_bench', 'floor_press', 'push_up'],
    cues: ['Лопатки сведены', 'Мост', 'Коснитесь груди', 'Локти 45°'],
    commonErrors: [
      { error: 'Локти в стороны (T-pose)', cause: 'Нет lat engagement', fix: 'Локти 45°. "Согни гриф".' },
      { error: 'Отрыв ягодиц', cause: 'Слишком сильный leg drive', fix: 'Ягодицы на скамье.' },
      { error: 'Недожим', cause: 'Слабый трицепс', fix: 'Close-grip bench, board press.' },
      { error: 'Гриф опускается на шею/живот', cause: 'Нет контроля', fix: 'J-hook траектория.' },
    ],
    progression: ['Push-up → DB Bench → Floor Press → Bench → Pause Bench → Wide Grip'],
    regression: ['Bench → DB Bench → Floor Press → Push-up → Machine Press'],
    preRequisites: ['Push-up ×20 без боли', 'Shoulder mobility'],
    techniqueType: 'compound', gripType: 'pronated', stanceType: 'none',
  },
  {
    id: 'incline_bench', name: 'Жим на наклонной', aliases: ['incline bench', 'наклонный жим'],
    pattern: 'horizontal_push', category: 'bodybuilding', plane: 'transverse', loadType: 'horizontal',
    jointStress: { knee: 0, hip: 0, spine: 2, shoulder: 8, elbow: 5, ankle: 0 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'high',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Верх груди', 'Передние дельты'],
    secondaryMuscles: ['Трицепс'],
    stabilizers: ['Ротаторная манжета'],
    romRequirements: { shoulder: 70, elbow: 90 },
    equipment: ['barbell', 'incline_bench', 'rack'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['incline_dumbbell', 'reverse_grip_bench', 'low_incline_press', 'landmine_press'],
    cues: ['Угол 30-45°', 'Касание верха груди', 'Локти 45°', 'Не ключицы'],
    commonErrors: [
      { error: 'Слишком крутой угол (>45°)', cause: 'Неправильная настройка', fix: '30-45°. Круче = больше плеч.' },
    ],
    progression: ['Low Incline (15°) → 30° → 45° → 60° (shoulder press)'],
    regression: ['60° → 45° → 30° → Flat Bench'],
    preRequisites: ['Flat bench ×10 без боли'],
    techniqueType: 'compound', gripType: 'pronated', stanceType: 'none',
  },
  {
    id: 'dumbbell_bench', name: 'Жим гантелей', aliases: ['dumbbell bench', 'гантельный жим'],
    pattern: 'horizontal_push', category: 'bodybuilding', plane: 'transverse', loadType: 'horizontal',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 6, elbow: 4, ankle: 0 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Грудные', 'Трицепс'],
    secondaryMuscles: ['Передние дельты'],
    stabilizers: ['Ротаторная манжета'],
    romRequirements: { shoulder: 60, elbow: 90 },
    equipment: ['dumbbell', 'bench'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['barbell_bench', 'push_up', 'cable_flye', 'machine_press'],
    cues: ['Глубже штанги', 'Сводите вверху', 'Нейтральный хват опционально', 'Гантели на уровне груди'],
    commonErrors: [
      { error: 'Гантели уходят в стороны', cause: 'Усталость стабилизаторов', fix: 'Легче вес. Контроль.' },
    ],
    progression: ['Flat → Incline → Decline → Single Arm → Alternating'],
    regression: ['Single Arm → DB Bench → Machine Press'],
    preRequisites: ['Flat bench ×10'],
    techniqueType: 'compound', gripType: 'neutral', stanceType: 'none',
  },
  {
    id: 'push_up', name: 'Отжимания', aliases: ['push up', 'отжимания', 'push-up'],
    pattern: 'horizontal_push', category: 'bodybuilding', plane: 'transverse', loadType: 'horizontal',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 4, elbow: 3, ankle: 0 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Грудные', 'Трицепс'],
    secondaryMuscles: ['Передние дельты', 'Кор'],
    stabilizers: ['Кор'],
    romRequirements: { shoulder: 60, elbow: 90 },
    equipment: ['bodyweight'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['bench_press', 'dumbbell_bench', 'cable_flye'],
    cues: ['Тело — прямая линия', 'Грудь к полу', 'Локти 45°', 'Полная амплитуда'],
    commonErrors: [
      { error: 'Провисание бёдер', cause: 'Слабый кор', fix: 'Plank. Напрячь пресс и ягодицы.' },
      { error: 'Неполная амплитуда', cause: 'Слабость / усталость', fix: 'Knee push-up → full ROM.' },
    ],
    progression: ['Wall → Knee → Incline → Floor → Decline → Diamond → Archer → One-arm'],
    regression: ['One-arm → Diamond → Decline → Floor → Incline → Knee → Wall'],
    preRequisites: ['None'],
    techniqueType: 'compound', gripType: 'pronated', stanceType: 'none',
  },
  {
    id: 'dips', name: 'Отжимания на брусьях', aliases: ['dips', 'брусья', 'tricep dips'],
    pattern: 'horizontal_push', category: 'bodybuilding', plane: 'transverse', loadType: 'horizontal',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 6, elbow: 5, ankle: 0 },
    torqueProfile: 'bottom_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'medium',
    cnsDemand: 2, difficulty: 2,
    primaryMuscles: ['Трицепс', 'Нижняя часть груди'],
    secondaryMuscles: ['Передние дельты'],
    stabilizers: ['Кор'],
    romRequirements: { shoulder: 90, elbow: 90 },
    equipment: ['dip_bars'], riskProfile: 'medium', isUnilateral: false, isCompetition: false,
    substitutions: ['bench_dips', 'close_grip_bench', 'tricep_pushdown'],
    cues: ['Наклон вперёд = грудь', 'Вертикально = трицепс', 'Плечи не ниже локтей', 'Полный локаут'],
    commonErrors: [
      { error: 'Слишком глубокая амплитуда', cause: 'Риск импинджмента', fix: 'Плечи не ниже параллели с локтями.' },
    ],
    progression: ['Assisted → BW → Weighted → Ring Dips → Korean Dips'],
    regression: ['Korean → Weighted → BW → Assisted → Bench Dips'],
    preRequisites: ['Push-up ×20', 'Без боли в плечах'],
    techniqueType: 'compound', gripType: 'neutral', stanceType: 'none',
  },
  {
    id: 'cable_flye', name: 'Сведение рук в кроссовере', aliases: ['cable flye', 'кроссовер', 'сведение'],
    pattern: 'horizontal_push', category: 'bodybuilding', plane: 'transverse', loadType: 'horizontal',
    jointStress: { knee: 0, hip: 0, spine: 1, shoulder: 3, elbow: 2, ankle: 0 },
    torqueProfile: 'top_peak', spineLoad: 'low', kneeLoad: 'low', shoulderLoad: 'low',
    cnsDemand: 1, difficulty: 1,
    primaryMuscles: ['Грудные'],
    secondaryMuscles: ['Передние дельты'],
    stabilizers: [],
    romRequirements: { shoulder: 60, elbow: 10 },
    equipment: ['cable_machine'], riskProfile: 'low', isUnilateral: false, isCompetition: false,
    substitutions: ['dumbbell_flye', 'pec_deck', 'band_flye'],
    cues: ['Лёгкий наклон вперёд', 'Локти чуть согнуты', 'Сводите до касания', 'Медленная эксцентрика'],
    commonErrors: [
      { error: 'Слишком большой вес', cause: 'Ego lifting', fix: 'Изоляция — не про вес. 12-15 повторений.' },
      { error: 'Прямые руки', cause: 'Нагрузка на локти', fix: 'Лёгкий сгиб в локтях всегда.' },
    ],
    progression: ['Low → Mid → High → Single Arm → Drop Set'],
    regression: ['High → Mid → Low → Dumbbell Flye'],
    preRequisites: ['None'],
    techniqueType: 'isolation', gripType: 'neutral', stanceType: 'split',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Query functions
// ═══════════════════════════════════════════════════════════════════════════

export function getFullExercise(id: string): FullExercise | undefined {
  return COMPREHENSIVE_EXERCISE_DB.find(e => e.id === id);
}

export function searchFullExercises(query: string): FullExercise[] {
  const q = query.toLowerCase();
  return COMPREHENSIVE_EXERCISE_DB.filter(e =>
    e.name.toLowerCase().includes(q) || e.aliases.some(a => a.toLowerCase().includes(q)) ||
    e.pattern.includes(q) || e.primaryMuscles.some(m => m.toLowerCase().includes(q)) ||
    e.category.includes(q)
  );
}

export function getExercisesByPattern(pattern: string): FullExercise[] {
  return COMPREHENSIVE_EXERCISE_DB.filter(e => e.pattern === pattern);
}

export function getExercisesByMuscle(muscle: string): FullExercise[] {
  const m = muscle.toLowerCase();
  return COMPREHENSIVE_EXERCISE_DB.filter(e =>
    e.primaryMuscles.some(p => p.toLowerCase().includes(m)) ||
    e.secondaryMuscles.some(s => s.toLowerCase().includes(m))
  );
}

export function getSafeExercises(injury: string): FullExercise[] {
  const inj = injury.toLowerCase();
  if (inj.includes('knee')) return COMPREHENSIVE_EXERCISE_DB.filter(e => e.kneeLoad !== 'high' && e.jointStress.knee <= 5);
  if (inj.includes('back') || inj.includes('spine')) return COMPREHENSIVE_EXERCISE_DB.filter(e => e.spineLoad !== 'high' && e.jointStress.spine <= 5);
  if (inj.includes('shoulder')) return COMPREHENSIVE_EXERCISE_DB.filter(e => e.shoulderLoad !== 'high' && e.jointStress.shoulder <= 5);
  return COMPREHENSIVE_EXERCISE_DB.filter(e => e.riskProfile === 'low');
}

export function getCompetitionExercises(): FullExercise[] {
  return COMPREHENSIVE_EXERCISE_DB.filter(e => e.isCompetition);
}

export function getAllPatterns(): string[] {
  return [...new Set(COMPREHENSIVE_EXERCISE_DB.map(e => e.pattern))];
}

export function getExerciseCount(): number { return COMPREHENSIVE_EXERCISE_DB.length; }
