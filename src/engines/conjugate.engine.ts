/**
 * conjugate.engine.ts — Конъюгат (Westside Barbell) — полноценный генератор.
 *
 * Режимы: пауэрлифтинг (классические ME/DE пропорции) и бодибилдинг (больше RE).
 * 4-дневный upper/lower split: ME Upper → DE Lower → DE Upper → ME Lower.
 * ME-вариации ротируются каждую неделю (3-нед волна).
 * DE c процентовками + резина/цепи.
 * Аксессуары под слабые места.
 */
export type ConjugateMode = 'powerlifting' | 'bodybuilding';
export type ConjugateDayType = 'me_upper' | 'de_lower' | 'de_upper' | 'me_lower';
export type BandType = 'none' | 'light' | 'monster_mini' | 'mini';

export interface ConjugateExercise {
  id: string;
  name: string;
  type: 'main' | 'supplemental' | 'accessory' | 'abs' | 'rear';
  sets: number;
  reps: number;
  intensity: number;
  rir: number;
  focus: string;
  notes?: string;
}

export interface ConjugateDay {
  type: ConjugateDayType;
  name: string;
  mainLift: string;
  exercises: ConjugateExercise[];
  notes: string;
}

export interface ConjugateWeek {
  days: ConjugateDay[];
  weekNumber: number;
  meVariation: { upper: string; lower: string };
}

export interface ConjugateProgram {
  weeks: ConjugateWeek[];
  mode: ConjugateMode;
  mainLifts: { upper: string; lower: string };
  weakPoints: string[];
  bandType: BandType;
}

// ── Библиотека ME-вариаций (ротация по волнам) ──
const ME_UPPER_VARIATIONS: string[][] = [
  ['Bench Press (comp)', 'Floor Press', 'Board Press (3-board)'],
  ['Incline Bench', 'Spoto Press', 'Slingshot Bench'],
  ['Bench Press (wide)', 'Pin Press (mid)', 'Close Grip Bench'],
];

const ME_LOWER_VARIATIONS: string[][] = [
  ['Box Squat', 'Deadlift (conv)', 'Good Morning'],
  ['Front Squat', 'Safety Bar Squat', 'Rack Pull (below knee)'],
  ['Paused Squat', 'Sumo Deadlift', 'Belt Squat'],
];

const DE_BAND_MAP: Record<BandType, { upperIntensity: number; lowerIntensity: number; note: string }> = {
  none:          { upperIntensity: 0.65, lowerIntensity: 0.70, note: 'Straight weight, классический DE' },
  light:         { upperIntensity: 0.55, lowerIntensity: 0.60, note: 'Light bands (∼50 lbs на конце)' },
  monster_mini:  { upperIntensity: 0.50, lowerIntensity: 0.55, note: 'Monster mini bands (∼80 lbs на конце)' },
  mini:          { upperIntensity: 0.45, lowerIntensity: 0.50, note: 'Mini bands (∼30 lbs на конце)' },
};

const UPPER_ME: ConjugateExercise[] = [
  { id:'me_upper_main', name:'', type:'main', sets:5, reps:1, intensity:0.95, rir:0, focus:'Тяжёлый сингл @9-9.5' },
  { id:'me_upper_backoff', name:'', type:'main', sets:3, reps:3, intensity:0.85, rir:1, focus:'Back-off тройки' },
  { id:'me_upper_row', name:'Barbell Row', type:'supplemental', sets:4, reps:8, intensity:0.70, rir:2, focus:'Широчайшие — антагонист жима' },
  { id:'me_upper_dip', name:'Weighted Dip', type:'supplemental', sets:3, reps:8, intensity:0.70, rir:2, focus:'Грудь+трицепс' },
  { id:'me_upper_lat', name:'Lat Pulldown', type:'accessory', sets:3, reps:10, intensity:0.65, rir:2, focus:'Ширина спины' },
  { id:'me_upper_triceps', name:'Triceps Pushdown', type:'accessory', sets:3, reps:15, intensity:0.50, rir:1, focus:'Трицепс' },
  { id:'me_upper_face', name:'Face Pull', type:'rear', sets:3, reps:15, intensity:0.40, rir:3, focus:'Задняя дельта + ротаторы' },
  { id:'me_upper_abs', name:'Ab Wheel', type:'abs', sets:3, reps:10, intensity:0.50, rir:2, focus:'Core' },
];

const LOWER_ME: ConjugateExercise[] = [
  { id:'me_lower_main', name:'', type:'main', sets:5, reps:1, intensity:0.95, rir:0, focus:'Тяжёлый сингл @9-9.5' },
  { id:'me_lower_backoff', name:'', type:'main', sets:3, reps:3, intensity:0.85, rir:1, focus:'Back-off тройки' },
  { id:'me_lower_gm', name:'Good Morning', type:'supplemental', sets:3, reps:8, intensity:0.60, rir:2, focus:'Разгибатели спины' },
  { id:'me_lower_legcurl', name:'Leg Curl', type:'accessory', sets:3, reps:12, intensity:0.60, rir:2, focus:'Бицепс бедра' },
  { id:'me_lower_hyper', name:'Hyperextension', type:'rear', sets:3, reps:10, intensity:0.50, rir:3, focus:'Задняя цепь' },
  { id:'me_lower_abs', name:'Hanging Leg Raise', type:'abs', sets:3, reps:12, intensity:0.40, rir:2, focus:'Нижняя часть пресса' },
];

function buildDEUpper(bandType: BandType, mode: ConjugateMode): ConjugateExercise[] {
  const b = DE_BAND_MAP[bandType];
  const sets = mode === 'powerlifting' ? 9 : 6;
  return [
    { id:'de_upper_speed', name:'Speed Bench Press', type:'main', sets, reps:3, intensity:b.upperIntensity, rir:3, focus:'Взрывная работа', notes: b.note },
    { id:'de_upper_ohp', name:'Standing OHP', type:'supplemental', sets:3, reps:8, intensity:0.70, rir:2, focus:'Плечевой пояс' },
    { id:'de_upper_row', name:'Chest Supported Row', type:'accessory', sets:3, reps:10, intensity:0.65, rir:2, focus:'Спина (толщина)' },
    { id:'de_upper_side', name:'Lateral Raise', type:'accessory', sets:3, reps:15, intensity:0.40, rir:1, focus:'Средняя дельта' },
    { id:'de_upper_face', name:'Face Pull', type:'rear', sets:3, reps:15, intensity:0.40, rir:3, focus:'Ротаторная манжета' },
  ];
}

function buildDELower(bandType: BandType, mode: ConjugateMode, mainLift: string): ConjugateExercise[] {
  const b = DE_BAND_MAP[bandType];
  const sets = mode === 'powerlifting' ? 10 : 6;
  const liftName = mainLift === 'squat' ? 'Squat' : 'Deadlift';
  return [
    { id:'de_lower_speed', name:`Speed ${liftName}`, type:'main', sets, reps:2, intensity:b.lowerIntensity, rir:3, focus:'Взрывная работа', notes: b.note },
    { id:'de_lower_rdl', name:'RDL', type:'supplemental', sets:3, reps:8, intensity:0.65, rir:2, focus:'Задняя цепь' },
    { id:'de_lower_shrug', name:'Barbell Shrug', type:'accessory', sets:3, reps:10, intensity:0.70, rir:2, focus:'Трапеция' },
    { id:'de_lower_rev_hyper', name:'Reverse Hyper', type:'rear', sets:3, reps:10, intensity:0.50, rir:3, focus:'Поясница + ягодицы' },
    { id:'de_lower_abs', name:'Pallof Press', type:'abs', sets:3, reps:10, intensity:0.40, rir:3, focus:'Косые + глубокий кор' },
  ];
}

/** BB-режим: больше RE (объём/гипертрофия), меньше DE, акцент на слабые места */
function buildRE(mainLift: string, weakPoints: string[], mode: ConjugateMode): ConjugateExercise[] {
  const base: ConjugateExercise[] = [
    { id:'re_main', name: mainLift === 'squat' ? 'Squat (техническая)' : mainLift === 'bench' ? 'Bench (техническая)' : 'Deadlift (техническая)', type:'main', sets:4, reps:8, intensity:0.70, rir:2, focus:'Техническая работа, объём' },
    { id:'re_pause', name: mainLift === 'squat' ? 'Paused Squat 3s' : mainLift === 'bench' ? 'Paused Bench 2s' : 'Deficit Deadlift', type:'supplemental', sets:3, reps:5, intensity:0.65, rir:2, focus:'Пауза, слабые места' },
    { id:'re_accessory1', name:'', type:'accessory', sets:3, reps:12, intensity:0.55, rir:2, focus:'Слабая группа' },
    { id:'re_accessory2', name:'', type:'accessory', sets:3, reps:15, intensity:0.45, rir:1, focus:'Изоляция' },
    { id:'re_rear', name:'', type:'rear', sets:3, reps:15, intensity:0.40, rir:3, focus:'Задняя цепь / ротаторы' },
  ];

  // Заполняем аксессуары под слабые места
  const wp = weakPoints.length > 0 ? weakPoints : ['general'];
  const wpAccessories: Record<string, { id: string; name: string }> = {
    chest:     { id:'re_chest', name:'Cable Fly' },
    back:      { id:'re_back', name:'Pull Up' },
    legs:      { id:'re_legs', name:'Walking Lunge' },
    shoulders: { id:'re_shoulders', name:'Lateral Raise' },
    arms:      { id:'re_arms', name:'EZ Bar Curl' },
    general:   { id:'re_general', name: mainLift === 'squat' ? 'Leg Extension' : mainLift === 'bench' ? 'Triceps Pushdown' : 'Leg Curl' },
  };
  const acc = wpAccessories[wp[0]] || wpAccessories.general;
  base[2] = { ...base[2], id: acc.id, name: acc.name, focus: `${wp[0]} — слабая группа` };

  const rearAcc: Record<string, { id: string; name: string }> = {
    chest:     { id:'re_rear_chest', name:'Face Pull' },
    back:      { id:'re_rear_back', name:'Reverse Fly' },
    legs:      { id:'re_rear_legs', name:'Hyperextension' },
    shoulders: { id:'re_rear_sh', name:'Band Pull Apart' },
    general:   { id:'re_rear_gen', name:'Face Pull' },
  };
  const r = rearAcc[wp[0]] || rearAcc.general;
  base[4] = { ...base[4], id: r.id, name: r.name, focus: `${wp[0]} — rear` };

  if (mode === 'bodybuilding') {
    base.push({ id:'re_iso', name:'Cable Crossover' + (mainLift === 'squat' ? '/Leg Curl' : mainLift === 'bench' ? '' : '/RDL'), type:'accessory', sets:4, reps:15, intensity:0.40, rir:1, focus:'Изоляция для пика' });
  }
  return base;
}

/** Собрать программу конъюгата */
export function generateConjugateProgram(
  mainLifts: { upper: string; lower: string },
  mode: ConjugateMode,
  weakPoints: string[],
  bandType: BandType,
  weeks: number
): ConjugateProgram {
  const waveCount = Math.max(1, Math.ceil(weeks / 3));
  const w: ConjugateWeek[] = [];

  for (let wi = 0; wi < weeks; wi++) {
    const waveIdx = wi % 3;
    const upperVar = ME_UPPER_VARIATIONS[waveIdx][wi % ME_UPPER_VARIATIONS[waveIdx].length];
    const lowerVar = ME_LOWER_VARIATIONS[waveIdx][wi % ME_LOWER_VARIATIONS[waveIdx].length];

    const meUpper = UPPER_ME.map(ex => ({ ...ex, name: ex.name || upperVar }));
    const meLower = LOWER_ME.map(ex => ({ ...ex, name: ex.name || lowerVar }));
    const deUpper = buildDEUpper(bandType, mode);
    const deLower = buildDELower(bandType, mode, mainLifts.lower);
    const reUpper = buildRE(mainLifts.upper, weakPoints, mode);
    const reLowerMainLift = mainLifts.lower === 'deadlift' ? 'deadlift' : 'squat';
    const reLower = buildRE(reLowerMainLift, weakPoints, mode);

    // BB-режим: больше RE-дней (замена одного DE на RE)
    const days: ConjugateDay[] = mode === 'bodybuilding'
      ? [
          { type:'me_upper', name:`ME Upper: ${upperVar}`, mainLift: upperVar, exercises: meUpper, notes:'ME Upper: 1RM + back-off 3×3 + объём/спина' },
          { type:'de_lower', name:'DE Lower (speed)', mainLift: mainLifts.lower, exercises: deLower, notes: DE_BAND_MAP[bandType].note + ' — speed work' },
          { type:'de_upper', name:'RE Upper (гипертрофия)', mainLift: mainLifts.upper, exercises: reUpper, notes:'Замена DE на RE в BB-режиме: объём, слабые места, изоляция' },
          { type:'me_lower', name:`ME Lower: ${lowerVar}`, mainLift: lowerVar, exercises: meLower, notes:'ME Lower: 1RM + back-off + задняя цепь' },
        ]
      : [
          { type:'me_upper', name:`ME Upper: ${upperVar}`, mainLift: upperVar, exercises: meUpper, notes:'ME Upper: 1RM + back-off 3×3 + объём/спина' },
          { type:'de_lower', name:'DE Lower (speed)', mainLift: mainLifts.lower, exercises: deLower, notes: DE_BAND_MAP[bandType].note + ' — speed work 10-12×2' },
          { type:'de_upper', name:'DE Upper (speed)', mainLift: mainLifts.upper, exercises: deUpper, notes: DE_BAND_MAP[bandType].note + ' — speed work 9×3' },
          { type:'me_lower', name:`ME Lower: ${lowerVar}`, mainLift: lowerVar, exercises: meLower, notes:'ME Lower: 1RM + back-off + задняя цепь' },
        ];

    w.push({ days, weekNumber: wi + 1, meVariation: { upper: upperVar, lower: lowerVar } });
  }

  return { weeks: w, mode, mainLifts, weakPoints, bandType };
}

/** Получить все ME-вариации для справки */
export function getAllMEVariations(): { upper: string[]; lower: string[] } {
  return {
    upper: ME_UPPER_VARIATIONS.flat(),
    lower: ME_LOWER_VARIATIONS.flat(),
  };
}

/** Длительность волны */
export function getConjugateWaveInfo(): { waveWeeks: number; note: string } {
  return { waveWeeks: 3, note: 'Каждые 3 недели — полная смена ME-вариаций (3 волны).' };
}
