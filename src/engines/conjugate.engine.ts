/**
 * conjugate.engine.ts — Конъюгат (Westside Barbell).
 *
 * ME-день (Max Effort): 1 соревновательное движение до тяжёлого сингла/тройки.
 * DE-день (Dynamic Effort): то же движение, speed work 55-70% × 8-12×1-3.
 * RE-день (Repetition/Supplemental): вспомогательные упражнения, гипертрофия.
 * Вариации: каждые 1-3 нед смена ME-упражнения.
 */
export type ConjugateDayType = 'me' | 'de' | 're';

export interface ConjugateExercise {
  id: string;
  name: string;
  type: 'main' | 'supplemental' | 'accessory' | 'abs' | 'rear';
  sets: number;
  reps: number;
  intensity: number;
  rir: number;
  focus: string;
}

export interface ConjugateDay {
  type: ConjugateDayType;
  name: string;
  mainLift: string;
  exercises: ConjugateExercise[];
  notes: string;
}

export interface ConjugateSchedule {
  days: ConjugateDay[];
  variationBlock: number;
}

/** Библиотека ME-вариаций для каждой группы */
const ME_VARIATIONS: Record<string, string[]> = {
  squat: ['Back Squat (high bar)', 'Back Squat (low bar)', 'Front Squat', 'Safety Bar Squat', 'Belt Squat', 'Box Squat', 'Paused Squat', 'Tempo Squat'],
  bench: ['Bench Press (comp)', 'Bench Press (wide)', 'Bench Press (close)', 'Incline Bench', 'Floor Press', 'Board Press (2-board)', 'Board Press (3-board)', 'Pin Press (mid)', 'Spoto Press', 'Slingshot Bench'],
  deadlift: ['Conventional Deadlift', 'Sumo Deadlift', 'Deficit Deadlift', 'Rack Pull (below knee)', 'Rack Pull (above knee)', 'Block Pull', 'Snatch Grip Deadlift', 'Romanian Deadlift', 'Trap Bar Deadlift'],
};

const SUPPLEMENTAL_POOL: Record<string, ConjugateExercise[]> = {
  squat: [
    { id:'leg_press', name:'Leg Press', type:'supplemental', sets:4, reps:10, intensity:0.7, rir:2, focus:'Объём квадрицепса' },
    { id:'lunge', name:'Walking Lunge', type:'supplemental', sets:3, reps:12, intensity:0.5, rir:2, focus:'Одноногая работа' },
    { id:'leg_curl', name:'Leg Curl', type:'accessory', sets:3, reps:12, intensity:0.6, rir:2, focus:'Бицепс бедра' },
    { id:'leg_ext', name:'Leg Extension', type:'accessory', sets:3, reps:15, intensity:0.5, rir:1, focus:'Изоляция квадрицепса' },
    { id:'hyper', name:'Hyperextension', type:'rear', sets:3, reps:10, intensity:0.5, rir:3, focus:'Задняя цепь' },
  ],
  bench: [
    { id:'dip', name:'Weighted Dip', type:'supplemental', sets:3, reps:8, intensity:0.7, rir:2, focus:'Грудь+трицепс' },
    { id:'ohp', name:'Standing OHP', type:'supplemental', sets:3, reps:8, intensity:0.7, rir:2, focus:'Плечевой пояс' },
    { id:'row', name:'Barbell Row', type:'supplemental', sets:4, reps:8, intensity:0.7, rir:2, focus:'Антагонист жима' },
    { id:'triceps_push', name:'Triceps Pushdown', type:'accessory', sets:3, reps:15, intensity:0.5, rir:1, focus:'Трицепс' },
    { id:'face_pull', name:'Face Pull', type:'rear', sets:3, reps:15, intensity:0.4, rir:3, focus:'Задняя дельта+ротаторы' },
  ],
  deadlift: [
    { id:'good_morning', name:'Good Morning', type:'supplemental', sets:3, reps:8, intensity:0.6, rir:2, focus:'Разгибатели спины' },
    { id:'pull_up', name:'Pull Up / Lat Pulldown', type:'supplemental', sets:3, reps:8, intensity:0.7, rir:2, focus:'Широчайшие' },
    { id:'shrug', name:'Barbell Shrug', type:'accessory', sets:3, reps:10, intensity:0.7, rir:2, focus:'Трапеция' },
    { id:'ham_curl', name:'Hamstring Curl', type:'accessory', sets:3, reps:12, intensity:0.6, rir:2, focus:'Бицепс бедра' },
    { id:'back_ext', name:'Back Extension', type:'rear', sets:3, reps:10, intensity:0.5, rir:3, focus:'Поясница' },
  ],
};

const ABS_CORE: ConjugateExercise[] = [
  { id:'ab_wheel', name:'Ab Wheel', type:'abs', sets:3, reps:10, intensity:0.5, rir:2, focus:'Прямые мышцы живота' },
  { id:'pallof', name:'Pallof Press', type:'abs', sets:3, reps:10, intensity:0.4, rir:3, focus:'Косые+глубокий кор' },
  { id:'leg_raise', name:'Hanging Leg Raise', type:'abs', sets:3, reps:12, intensity:0.4, rir:2, focus:'Нижняя часть пресса' },
];

export function generateConjugateWeek(
  mainLift: 'squat' | 'bench' | 'deadlift',
  variationBlock: number
): ConjugateSchedule {
  const variations = ME_VARIATIONS[mainLift] || ME_VARIATIONS.squat;
  const meExercise = variations[variationBlock % variations.length];

  const supplements = SUPPLEMENTAL_POOL[mainLift] || SUPPLEMENTAL_POOL.squat;

  const meDay: ConjugateDay = {
    type: 'me',
    name: `Max Effort — ${meExercise}`,
    mainLift: meExercise,
    exercises: [
      { id: 'me1', name: meExercise, type: 'main', sets: 5, reps: 1, intensity: 0.95, rir: 0, focus: 'Тяжёлый одиночный @9-9.5' },
      { id: 'me2', name: meExercise, type: 'main', sets: 2, reps: 3, intensity: 0.85, rir: 1, focus: 'Бэк-офф тройки' },
      ...supplements.filter(s => s.type === 'supplemental').slice(0, 2),
      ...supplements.filter(s => s.type === 'accessory').slice(0, 1),
    ],
    notes: 'ME-день: разминка → работа до тяжёлого сингла → бэк-офф → объём',
  };

  const deDay: ConjugateDay = {
    type: 'de',
    name: `Dynamic Effort — ${mainLift === 'bench' ? 'Bench Press' : mainLift === 'deadlift' ? 'Deadlift' : 'Squat'}`,
    mainLift: mainLift === 'bench' ? 'Bench Press' : mainLift === 'deadlift' ? 'Deadlift' : 'Squat',
    exercises: [
      ...(mainLift === 'bench'
        ? [{ id:'de_speed', name:'Speed Bench Press', type:'main' as const, sets:9, reps:3, intensity:0.55, rir:3, focus:'Взрывная работа, 60% с лентами' }]
        : [{ id:'de_speed', name:'Speed ' + (mainLift === 'deadlift' ? 'Deadlift' : 'Squat'), type:'main' as const, sets:8, reps:2, intensity:0.6, rir:3, focus:'Speed work с 55-65%' }]),
      ...supplements.filter(s => s.type === 'accessory').slice(0, 2),
    ],
    notes: 'DE-день: speed work с лентами/цепями, взрывные повторения, RIR 3+',
  };

  const reDay: ConjugateDay = {
    type: 're',
    name: 'Repetition/Supplemental',
    mainLift: mainLift,
    exercises: [
      ...supplements,
      ...ABS_CORE.slice(0, 2),
      ...supplements.filter(s => s.type === 'rear').slice(0, 1),
    ],
    notes: 'RE-день: гипертрофия и слабые места, объём 3-5×10-15',
  };

  return {
    days: mainLift === 'bench' ? [meDay, reDay, deDay, reDay] : [meDay, reDay, deDay, reDay],
    variationBlock,
  };
}

export function getAllVariations(lift: string): string[] {
  return ME_VARIATIONS[lift] || [];
}
