/**
 * combat-core.engine.ts — Core 4 функции (Boxing Science).
 * anti-extension / anti-rotation / anti-lateral / hip flexion neutral + ротационный взрыв.
 * Прогрессия 3-4 уровня.
 */
export type CoreFunction = 'anti_extension' | 'anti_rotation' | 'anti_lateral' | 'hip_flexion' | 'rotation_power';

export interface CoreProgession {
  level: number; // 1-4
  function: CoreFunction;
  exercises: string[];
  sets: number;
  reps: string;
  rest: number;
  cue: string;
}

const CORE_LEVELS: Record<CoreFunction, CoreProgession[]> = {
  anti_extension: [
    { level: 1, function: 'anti_extension', exercises: ['deadbug'], sets: 3, reps: '8-10/сторону', rest: 60, cue: 'Поясница прижата, медленно' },
    { level: 2, function: 'anti_extension', exercises: ['hollow_hold'], sets: 3, reps: '30с', rest: 60, cue: 'Плоская поясница, подбородок втянут' },
    { level: 3, function: 'anti_extension', exercises: ['ab_wheel'], sets: 3, reps: '6-10', rest: 75, cue: 'Без прогиба, контроль' },
    { level: 4, function: 'anti_extension', exercises: ['ab_wheel', 'hollow_hold'], sets: 4, reps: '8-12', rest: 75, cue: 'Суперсет anti-ext' },
  ],
  anti_rotation: [
    { level: 1, function: 'anti_rotation', exercises: ['pallof_rotation_press'], sets: 3, reps: '8-12/сторону', rest: 60, cue: 'Трос в центр, не ротируем' },
    { level: 2, function: 'anti_rotation', exercises: ['pallof_rotation_press'], sets: 3, reps: '12-15/сторону', rest: 60, cue: 'Пауза 1с в вытянутой' },
    { level: 3, function: 'anti_rotation', exercises: ['landmine_rotation'], sets: 3, reps: '6-8/сторону', rest: 75, cue: 'Взрыв от кора, без рывка поясницы' },
    { level: 4, function: 'anti_rotation', exercises: ['pallof_rotation_press', 'landmine_rotation'], sets: 3, reps: '8/сторону each', rest: 75, cue: 'Anti + rotation power' },
  ],
  anti_lateral: [
    { level: 1, function: 'anti_lateral', exercises: ['side_plank'], sets: 3, reps: '30с/сторону', rest: 60, cue: 'Линия прямая' },
    { level: 2, function: 'anti_lateral', exercises: ['side_plank', 'suitcase_carry'], sets: 3, reps: '30с + 30м', rest: 60, cue: 'Без наклона' },
    { level: 3, function: 'anti_lateral', exercises: ['copenhagen_plank'], sets: 3, reps: '20-30с/сторону', rest: 75, cue: 'Аддукция, таз стабилен' },
    { level: 4, function: 'anti_lateral', exercises: ['copenhagen_plank', 'farmer_carry'], sets: 3, reps: '30с + 40м', rest: 75, cue: 'Комбо anti-lat' },
  ],
  hip_flexion: [
    { level: 1, function: 'hip_flexion', exercises: ['deadbug'], sets: 3, reps: '8-10', rest: 60, cue: 'Нейтральная спина, сгибание бедра 90°' },
    { level: 2, function: 'hip_flexion', exercises: ['hollow_hold'], sets: 3, reps: '20-30с', rest: 60, cue: 'Ноги 45°, руки над головой' },
    { level: 3, function: 'hip_flexion', exercises: ['ab_wheel'], sets: 3, reps: '6-8', rest: 75, cue: 'Контролируемое вытяжение' },
    { level: 4, function: 'hip_flexion', exercises: ['ab_wheel', 'copenhagen_plank'], sets: 4, reps: '8-10', rest: 75, cue: 'Hip flex + anti-lat' },
  ],
  rotation_power: [
    { level: 1, function: 'rotation_power', exercises: ['landmine_rotation'], sets: 3, reps: '8/сторону', rest: 60, cue: 'Медленно, техника' },
    { level: 2, function: 'rotation_power', exercises: ['med_ball_rot_throw'], sets: 3, reps: '5/сторону', rest: 75, cue: 'Бросок от бедра, как удар' },
    { level: 3, function: 'rotation_power', exercises: ['med_ball_slam', 'sledge_hammer'], sets: 3, reps: '5/сторону', rest: 90, cue: 'Взрыв X-0-X-0' },
    { level: 4, function: 'rotation_power', exercises: ['med_ball_rot_throw', 'sledge_hammer', 'landmine_180'], sets: 3, reps: '5/сторону each', rest: 90, cue: 'Комбо ротации' },
  ],
};

export function coreProgressionFor(level: number, fn: CoreFunction): CoreProgession {
  const arr = CORE_LEVELS[fn];
  const l = Math.max(1, Math.min(4, Math.round(level)));
  return arr[l - 1] || arr[0];
}

export function coreWeeklyPlan(trainingLevel: string, week: number, phase: string): CoreProgession[] {
  const lvl = trainingLevel === 'beginner' ? 1 : trainingLevel === 'intermediate' ? 2 : trainingLevel === 'advanced' ? 3 : 4;
  const phaseLevel = phase === 'accumulation' || phase === 'gpp' ? lvl : phase === 'transmutation' || phase === 'power' ? Math.min(4, lvl + 1) : lvl;
  return [
    coreProgressionFor(phaseLevel, 'anti_extension'),
    coreProgressionFor(phaseLevel, 'anti_rotation'),
    coreProgressionFor(phaseLevel, 'anti_lateral'),
    coreProgressionFor(Math.min(4, phaseLevel), 'rotation_power'),
  ];
}

export function coreVolumeCheck(weekExercises: string[]): { antiExt: number; antiRot: number; antiLat: number; rotPower: number; ok: boolean } {
  const antiExt = weekExercises.filter(id => ['deadbug','hollow_hold','ab_wheel'].includes(id)).length;
  const antiRot = weekExercises.filter(id => ['pallof_rotation_press','landmine_rotation','landmine_180'].includes(id)).length;
  const antiLat = weekExercises.filter(id => ['side_plank','copenhagen_plank','suitcase_carry','farmer_carry'].includes(id)).length;
  const rotPower = weekExercises.filter(id => ['med_ball_rot_throw','med_ball_slam','sledge_hammer','battle_rope'].includes(id)).length;
  const ok = antiExt >= 1 && antiRot >= 1 && antiLat >= 1 && rotPower >= 1;
  return { antiExt, antiRot, antiLat, rotPower, ok };
}
