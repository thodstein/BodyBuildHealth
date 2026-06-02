import { TrainingInput, TrainingOutput, Exercise } from '../core/types';

// ТЗ §5.1: Матрица MV-MRV по уровням
const MV_MR_V: Record<string, { mv: number; mev: number; mav: number; mrv: number }> = {
  beginner:    { mv: 4,  mev: 8,  mav: 12, mrv: 16 },
  intermediate:{ mv: 6,  mev: 10, mav: 16, mrv: 20 },
  advanced:    { mv: 8,  mev: 12, mav: 18, mrv: 24 },
  enhanced:    { mv: 10, mev: 14, mav: 22, mrv: 28 }
} as const;

// ТЗ §6.1: Дерево выбора сплита (15 вариантов)
const SPLITS: Record<string, { name: string; days: number; desc: string; condition: (i: TrainingInput) => boolean; volumeModifier?: Record<string, number> }> = {
  recovery_3:   { name: 'Восстановительный 3x', days: 3, desc: '50% объёма, RIR 4, безопасные движения', condition: i => i.recovery < 50 || i.fatigue > 70 || i.nutrition < 50, volumeModifier: { chest: 0.5, back: 0.5, legs: 0.5, shoulders: 0.5, arms: 0.5, core: 0.5 } },
  fullbody_3:   { name: 'Фулбоди 3x', days: 3, desc: 'Все группы на каждой тренировке', condition: i => i.daysPerWeek === 3 && i.recovery >= 50 },
  upperlower_4: { name: 'Верх/Низ 4x', days: 4, desc: 'Верх/низ чередуются', condition: i => i.daysPerWeek === 4 && i.recovery >= 55 },
  upperlower_5: { name: 'Верх/Низ 5x', days: 5, desc: '3 верх / 2 низ', condition: i => i.daysPerWeek === 5 && i.level === 'advanced' && i.recovery >= 65 },
  ppl_accent_5: { name: 'PPL + Акцент 5x', days: 5, desc: 'Push/Pull/Legs + 2 акцентных', condition: i => i.daysPerWeek === 5 && i.weakPoints.length > 0 },
  ppl_2x_6:     { name: 'PPL 2x 6x', days: 6, desc: 'PPL дважды в неделю', condition: i => i.daysPerWeek >= 6 && i.recovery >= 70 && i.fatigue < 60 },
  ppl_hybrid_4: { name: 'PPL Гибрид 4x', days: 4, desc: 'Push, Pull, Legs, Upper', condition: i => i.daysPerWeek === 4 && i.level === 'intermediate' },
  arnold_6:     { name: 'Сплит Арнольда 6x', days: 6, desc: 'Грудь+спина, плечи+руки, ноги', condition: i => i.daysPerWeek === 6 && i.goal !== 'strength' && i.recovery >= 65 },
  bro_5:        { name: 'Бро-сплит 5x', days: 5, desc: 'Одна группа в день', condition: i => i.daysPerWeek === 5 && i.level !== 'beginner' && i.goal === 'hypertrophy' },
  strength_4:   { name: 'Силовой 4x', days: 4, desc: 'Compound фокус, RIR 2-3', condition: i => i.goal === 'strength' },
  hypertrophy_6:{ name: 'Гипертрофийный 6x', days: 6, desc: 'Высокий объём, акцент ROM', condition: i => i.daysPerWeek === 6 && i.goal === 'hypertrophy' && i.recovery >= 60 },
  torso_limbs_4:{ name: 'Торс/Конечности 4x', days: 4, desc: 'Торс отдельно, конечности отдельно', condition: i => i.daysPerWeek === 4 && !!(i.injuries?.includes('lower') || i.injuries?.includes('back')) },
  pushpull_la_5:{ name: 'Push/Pull + Ноги/Руки 5x', days: 5, desc: 'Компромисс PPL/Bro', condition: i => i.daysPerWeek === 5 && i.weakPoints.length === 0 },
  cbs_da_5:     { name: 'Грудь/Спина/Ноги/Дельты/Руки 5x', days: 5, desc: 'Классический раздельный', condition: i => i.daysPerWeek === 5 && i.recovery >= 65 && i.level !== 'beginner' },
  spec_5:       { name: 'Специализация 5x', days: 5, desc: 'Частота на 1-2 отстающих', condition: i => i.daysPerWeek === 5 && i.weakPoints.length === 1 }
} as const;

// ТЗ §5.5: RIR по целям
const RIR_MAP: Record<string, string> = {
  strength: '2-3', hypertrophy: '1-2', endurance: '3-4', recovery: '4',
  maintenance: '2-3', bulk: '2-3', cut: '1-2', rehab: '3-4'
} as const;

export function calcTraining(i: TrainingInput): TrainingOutput {
  const base = MV_MR_V[i.level];
  let volume = base.mav;

  // ТЗ §5.1: Коррекция по состоянию
  if (i.recovery < 50) volume *= 0.8;
  if (i.fatigue > 60) volume *= 0.9;
  if (i.nutrition < 60) volume *= 0.85;

  // ТЗ §5.1 п.4: Слабые точки
  const groups = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];
  const volMap: Record<string, number> = {};
  const wpFactor = 1.2;
  const nonWpFactor = Math.max(0.7, 1.0 - (0.1 * i.weakPoints.length));

  groups.forEach(g => { volMap[g] = i.weakPoints.includes(g) ? volume * wpFactor : volume * nonWpFactor; });

  // ТЗ §6.1: Выбор сплита
  let selected = Object.values(SPLITS).find(s => s.condition(i)) || SPLITS['upperlower_4'];
  let splitName = selected.name;
  let splitDesc = selected.desc;

  if (selected.volumeModifier) {
    Object.entries(selected.volumeModifier).forEach(([g, mod]) => { if (volMap[g] !== undefined) volMap[g] *= mod; });
  }

  let rir = RIR_MAP[i.goal] || '2-3';
  let isDeload = false;
  let deloadReason = '';

  if (i.recovery < 55) { isDeload = true; deloadReason = 'Recovery < 55'; rir = '4'; Object.keys(volMap).forEach(k => { volMap[k] *= 0.5; }); }
  else if (i.fatigue > 70) { isDeload = true; deloadReason = 'Fatigue > 70'; rir = '4'; Object.keys(volMap).forEach(k => { volMap[k] *= 0.6; }); }
  else if (i.nutrition < 55) { isDeload = true; deloadReason = 'Nutrition < 55'; Object.keys(volMap).forEach(k => { volMap[k] *= 0.7; }); }

  const roundedVol: Record<string, number> = {};
  Object.entries(volMap).forEach(([k, v]) => { roundedVol[k] = Math.round(v); });

  const weekPlan = isDeload
    ? 'НЕДЕЛЯ 1 (ДЕЛОД): 50% объёма, RIR 4, без отказов, акцент на технику и мобильность'
    : 'НЕДЕЛЯ 1 (ВХОД): 70% MAV, RIR 3, фокус на технику, прогрессия весов со 2-й недели';

  const progressionNote = !isDeload ? ' | Нед 2-4: +2.5-5% весов или +1 сет на группу' : '';

  return {
    splitName,
    splitDesc: splitDesc + progressionNote,
    volumePerGroup: roundedVol,
    rir,
    isDeload,
    deloadReason,
    weekPlan
  };
}

export function getAvailableSplits(days: number, recovery: number): Array<{ id: string; name: string; desc: string }> {
  return Object.entries(SPLITS)
    .filter(([, s]) => s.days === days && s.condition({ daysPerWeek: days, recovery, fatigue: 50, nutrition: 70, level: 'intermediate', goal: 'hypertrophy', weakPoints: [] } as TrainingInput))
    .map(([id, s]) => ({ id, name: s.name, desc: s.desc }));
}

// ТЗ §5.4: Полная библиотека упражнений (48 элементов)
export const EXERCISE_DB: Exercise[] = [
  // === ГРУДЬ ===
  { id: 'bench_bar', name: 'Жим штанги лёжа', group: 'chest', type: 'compound', equipment: 'barbell', difficulty: 'intermediate', jointStress: 'med', fatigueCost: 7 },
  { id: 'bench_db', name: 'Жим гантелей лёжа', group: 'chest', type: 'compound', equipment: 'dumbbell', difficulty: 'intermediate', jointStress: 'low', fatigueCost: 6 },
  { id: 'incline_bar', name: 'Жим штанги на наклонной', group: 'chest', type: 'compound', equipment: 'barbell', difficulty: 'intermediate', jointStress: 'med', fatigueCost: 7 },
  { id: 'incline_db', name: 'Жим гантелей на наклонной', group: 'chest', type: 'compound', equipment: 'dumbbell', difficulty: 'intermediate', jointStress: 'low', fatigueCost: 6 },
  { id: 'dips', name: 'Отжимания на брусьях', group: 'chest', type: 'compound', equipment: 'bodyweight', difficulty: 'advanced', jointStress: 'high', fatigueCost: 8 },
  { id: 'fly_db', name: 'Разводка гантелей', group: 'chest', type: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', jointStress: 'low', fatigueCost: 4 },
  { id: 'cable_fly', name: 'Сведение в кроссовере', group: 'chest', type: 'isolation', equipment: 'cable', difficulty: 'beginner', jointStress: 'low', fatigueCost: 3 },
  { id: 'pec_deck', name: 'Сведение в тренажёре', group: 'chest', type: 'isolation', equipment: 'machine', difficulty: 'beginner', jointStress: 'low', fatigueCost: 3 },

  // === СПИНА ===
  { id: 'deadlift', name: 'Становая тяга', group: 'back', type: 'compound', equipment: 'barbell', difficulty: 'advanced', jointStress: 'high', fatigueCost: 10 },
  { id: 'pullup', name: 'Подтягивания', group: 'back', type: 'compound', equipment: 'bodyweight', difficulty: 'intermediate', jointStress: 'med', fatigueCost: 7 },
  { id: 'row_bar', name: 'Тяга штанги в наклоне', group: 'back', type: 'compound', equipment: 'barbell', difficulty: 'intermediate', jointStress: 'med', fatigueCost: 7 },
  { id: 'row_db', name: 'Тяга гантели в наклоне', group: 'back', type: 'compound', equipment: 'dumbbell', difficulty: 'beginner', jointStress: 'low', fatigueCost: 5 },
  { id: 'pulldown', name: 'Тяга верхнего блока', group: 'back', type: 'compound', equipment: 'cable', difficulty: 'beginner', jointStress: 'low', fatigueCost: 5 },
  { id: 'seated_row', name: 'Тяга горизонтального блока', group: 'back', type: 'compound', equipment: 'cable', difficulty: 'beginner', jointStress: 'low', fatigueCost: 5 },
  { id: 'face_pull', name: 'Тяга к лицу', group: 'back', type: 'isolation', equipment: 'cable', difficulty: 'beginner', jointStress: 'low', fatigueCost: 3 },
  { id: 'straight_pull', name: 'Пуловер в блоке', group: 'back', type: 'isolation', equipment: 'cable', difficulty: 'beginner', jointStress: 'low', fatigueCost: 4 },

  // === НОГИ ===
  { id: 'squat', name: 'Приседания со штангой', group: 'legs', type: 'compound', equipment: 'barbell', difficulty: 'advanced', jointStress: 'high', fatigueCost: 10 },
  { id: 'front_squat', name: 'Фронтальные приседания', group: 'legs', type: 'compound', equipment: 'barbell', difficulty: 'advanced', jointStress: 'med', fatigueCost: 9 },
  { id: 'rdl', name: 'Румынская тяга', group: 'legs', type: 'compound', equipment: 'barbell', difficulty: 'intermediate', jointStress: 'med', fatigueCost: 8 },
  { id: 'leg_press', name: 'Жим ногами', group: 'legs', type: 'compound', equipment: 'machine', difficulty: 'beginner', jointStress: 'low', fatigueCost: 6 },
  { id: 'hack_squat', name: 'Гакк-приседания', group: 'legs', type: 'compound', equipment: 'machine', difficulty: 'intermediate', jointStress: 'med', fatigueCost: 7 },
  { id: 'lunge', name: 'Выпады', group: 'legs', type: 'compound', equipment: 'bodyweight', difficulty: 'intermediate', jointStress: 'med', fatigueCost: 7 },
  { id: 'leg_ext', name: 'Разгибания ног', group: 'legs', type: 'isolation', equipment: 'machine', difficulty: 'beginner', jointStress: 'low', fatigueCost: 4 },
  { id: 'leg_curl', name: 'Сгибания ног', group: 'legs', type: 'isolation', equipment: 'machine', difficulty: 'beginner', jointStress: 'low', fatigueCost: 4 },
  { id: 'calf_raise', name: 'Подъёмы на носки', group: 'legs', type: 'isolation', equipment: 'machine', difficulty: 'beginner', jointStress: 'low', fatigueCost: 3 },
  { id: 'hip_abduction', name: 'Отведение ноги в тренажёре', group: 'legs', type: 'isolation', equipment: 'machine', difficulty: 'beginner', jointStress: 'low', fatigueCost: 3 },

  // === ПЛЕЧИ ===
  { id: 'ohp', name: 'Армейский жим', group: 'shoulders', type: 'compound', equipment: 'barbell', difficulty: 'intermediate', jointStress: 'med', fatigueCost: 7 },
  { id: 'db_press', name: 'Жим гантелей сидя', group: 'shoulders', type: 'compound', equipment: 'dumbbell', difficulty: 'intermediate', jointStress: 'med', fatigueCost: 6 },
  { id: 'lateral_raise', name: 'Махи в стороны', group: 'shoulders', type: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', jointStress: 'low', fatigueCost: 4 },
  { id: 'rear_delt_fly', name: 'Махи в наклоне на заднюю дельту', group: 'shoulders', type: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', jointStress: 'low', fatigueCost: 3 },
  { id: 'upright_row', name: 'Тяга к подбородку', group: 'shoulders', type: 'compound', equipment: 'barbell', difficulty: 'intermediate', jointStress: 'high', fatigueCost: 6 },
  { id: 'face_pull_sh', name: 'Тяга к лицу (задняя дельта)', group: 'shoulders', type: 'isolation', equipment: 'cable', difficulty: 'beginner', jointStress: 'low', fatigueCost: 3 },

  // === РУКИ ===
  { id: 'curl_bar', name: 'Подъём штанги на бицепс', group: 'arms', type: 'isolation', equipment: 'barbell', difficulty: 'beginner', jointStress: 'low', fatigueCost: 4 },
  { id: 'curl_db', name: 'Подъём гантелей на бицепс', group: 'arms', type: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', jointStress: 'low', fatigueCost: 4 },
  { id: 'hammer_curl', name: 'Молотки', group: 'arms', type: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', jointStress: 'low', fatigueCost: 4 },
  { id: 'preacher_curl', name: 'Подъём на скамье Скотта', group: 'arms', type: 'isolation', equipment: 'barbell', difficulty: 'intermediate', jointStress: 'med', fatigueCost: 5 },
  { id: 'cable_curl', name: 'Сгибания в блоке', group: 'arms', type: 'isolation', equipment: 'cable', difficulty: 'beginner', jointStress: 'low', fatigueCost: 3 },
  { id: 'tricep_push', name: 'Французский жим', group: 'arms', type: 'isolation', equipment: 'barbell', difficulty: 'intermediate', jointStress: 'med', fatigueCost: 5 },
  { id: 'tricep_cable', name: 'Разгибания на трицепс в блоке', group: 'arms', type: 'isolation', equipment: 'cable', difficulty: 'beginner', jointStress: 'low', fatigueCost: 3 },
  { id: 'dips_tricep', name: 'Отжимания на трицепс', group: 'arms', type: 'compound', equipment: 'bodyweight', difficulty: 'intermediate', jointStress: 'med', fatigueCost: 6 },
  { id: 'kickback', name: 'Разгибание гантели в наклоне', group: 'arms', type: 'isolation', equipment: 'dumbbell', difficulty: 'beginner', jointStress: 'low', fatigueCost: 3 },
  { id: 'wrist_curl', name: 'Сгибания запястий', group: 'arms', type: 'isolation', equipment: 'barbell', difficulty: 'beginner', jointStress: 'low', fatigueCost: 2 },

  // === КОР ===
  { id: 'plank', name: 'Планка', group: 'core', type: 'isolation', equipment: 'bodyweight', difficulty: 'beginner', jointStress: 'low', fatigueCost: 3 },
  { id: 'ab_wheel', name: 'Ролик для пресса', group: 'core', type: 'compound', equipment: 'bodyweight', difficulty: 'advanced', jointStress: 'med', fatigueCost: 6 },
  { id: 'hanging_leg', name: 'Подъём ног в висе', group: 'core', type: 'compound', equipment: 'bodyweight', difficulty: 'intermediate', jointStress: 'low', fatigueCost: 5 },
  { id: 'cable_crunch', name: 'Скручивания в блоке', group: 'core', type: 'isolation', equipment: 'cable', difficulty: 'beginner', jointStress: 'low', fatigueCost: 3 },
  { id: 'russian_twist', name: 'Русский твист', group: 'core', type: 'compound', equipment: 'bodyweight', difficulty: 'intermediate', jointStress: 'med', fatigueCost: 4 },
  { id: 'hyperextension', name: 'Гиперэкстензия', group: 'core', type: 'isolation', equipment: 'machine', difficulty: 'beginner', jointStress: 'low', fatigueCost: 3 }
] as const;

// ТЗ §5.4: Подбор упражнений под группу + ограничения
export function selectExercises(group: string, options: { avoidHighJointStress?: boolean; maxFatigueCost?: number; equipment?: string[]; difficulty?: string }): Exercise[] {
  return EXERCISE_DB.filter(ex => {
    if (ex.group !== group) return false;
    if (options.avoidHighJointStress && ex.jointStress === 'high') return false;
    if (options.maxFatigueCost && ex.fatigueCost > options.maxFatigueCost) return false;
    if (options.equipment?.length && !options.equipment.includes(ex.equipment)) return false;
    if (options.difficulty && ex.difficulty !== options.difficulty) return false;
    return true;
  });
}