import type { BBExercise, BBSession, BBWeek } from './bb-types';

export type BackPattern = 'vertical_pull' | 'heavy_row' | 'supported_row' | 'unilateral_row' | 'lat_isolation' | 'upper_back' | 'rear_delt' | 'shrug' | 'erector' | 'other';
export type LegPattern = 'compound_squat' | 'lunge' | 'sissy_lengthened' | 'leg_extension' | 'belt_stepup' | 'leg_curl' | 'rdl_hinge' | 'hip_thrust' | 'glute_accessory' | 'calf' | 'other';
export type ArmPattern = 'biceps_lengthened' | 'biceps_shortened' | 'biceps_hammer' | 'triceps_overhead' | 'triceps_pushdown' | 'triceps_compound' | 'forearm' | 'other';

/** Разные вертикальные профили нельзя сводить в один дубль: wide-grip,
 * neutral/hammer, underhand и pull-up дают разные линии локтя/профили нагрузки.
 * Возвращает null для НЕ-вертикальных упражнений — вызывать только после
 * classifyBackExercise подтвердил pattern === 'vertical_pull'. */
export function verticalPullProfile(name: string): string | null {
  const n = String(name || '').toLowerCase();
  if (!/подтяг|pull.?up|chin|верхн.*блок|lat.?pull|пуллдаун/i.test(n)) return null;
  if (/широк|wide|широким|за голов/i.test(n)) return 'wide';
  if (/хаммер|hammer|нейтрал|neutral|parallel|параллел|узк.*нейтр|v.?рукоят/i.test(n)) return 'neutral_hammer';
  if (/обратн|underhand|supinat|нижн.*хват/i.test(n)) return 'underhand';
  if (/подтяг|pull.?up|chin.?up/i.test(n)) return 'pullup';
  if (/тренаж|machine/i.test(n) && /верхн/i.test(n)) return 'machine_vertical';
  return 'cable_vertical';
}

export function classifyBackExercise(name: string): { pattern: BackPattern; subgroup: BBExercise['backSubgroup'] } {
  const n = String(name || '').toLowerCase();
  if (/подтяг|pull.?up|chin|верхн.*блок|lat.?pull|пуллдаун|vertical/i.test(n)) return { pattern: 'vertical_pull', subgroup: 'back_width' };
  if (/пуловер|прям.*рук|straight.?arm/i.test(n)) return { pattern: 'lat_isolation', subgroup: 'back_width' };
  if (/тяга.*одной|one.?arm|single.?arm|одноруч|гантел.*наклон/i.test(n)) return { pattern: 'unilateral_row', subgroup: 'back_thickness' };
  if (/тяга.*груд.*упор|chest.?supported|seal|тяга.*тренаж|machine.*row|гребн/i.test(n)) return { pattern: 'supported_row', subgroup: 'back_thickness' };
  if (/тяга.*лиц|face.?pull|задн.*дельт|rear.?delt|обратн.*бабоч/i.test(n)) return { pattern: 'rear_delt', subgroup: 'rear_delts' };
  if (/шраг|shrug/i.test(n)) return { pattern: 'shrug', subgroup: 'traps' };
  if (/гиперэкстенз|back.?extension|good.?morning|гудморнинг|станов|deadlift|румын|rdl/i.test(n)) return { pattern: 'erector', subgroup: 'erectors' };
  if (/тяга|row|мэдоус|pendlay|yates|т.?гриф/i.test(n)) return { pattern: 'heavy_row', subgroup: 'back_thickness' };
  return { pattern: 'other', subgroup: 'upper_back' };
}

export function annotateBackExercise(exercise: BBExercise): BBExercise {
  if (exercise.muscle !== 'back') return exercise;
  const c = classifyBackExercise(exercise.name);
  return { ...exercise, movementPattern: c.pattern, backSubgroup: c.subgroup };
}

export function backQualityIssues(weeks: BBWeek[]): string[] {
  const issues: string[] = [];
  const counts = new Map<string, number>();
  for (const week of weeks) for (const session of week.sessions) {
    const pulls = session.exercises.filter(e => e.muscle === 'back').map(e => annotateBackExercise(e));
    const vertical = pulls.filter(e => e.movementPattern === 'vertical_pull').length;
    if (vertical > 1) issues.push(`Неделя ${week.week}, день ${session.day}: ${vertical} вертикальных тяг в одной сессии`);
    for (const e of pulls) counts.set(e.movementPattern || 'other', (counts.get(e.movementPattern || 'other') || 0) + e.sets);
  }
  if ((counts.get('vertical_pull') || 0) > 0 && (counts.get('heavy_row') || 0) + (counts.get('supported_row') || 0) + (counts.get('unilateral_row') || 0) === 0) issues.push('Спина содержит вертикальную тягу без горизонтальной тяги');
  return issues;
}

/** Классификация упражнений на ноги по функциональным паттернам. */
export function classifyLegExercise(name: string): { pattern: LegPattern; subgroup: string } {
  const n = String(name || '').toLowerCase();
  if (/ягодичн.*мост|hip.?thrust|glute.?bridge/i.test(n)) return { pattern: 'hip_thrust', subgroup: 'glutes' };
  if (/отведен.*бедр|abduction|разведен.*ног|отведен.*ног|kick.?back|мах.*ног/i.test(n)) return { pattern: 'glute_accessory', subgroup: 'glutes' };
  if (/сгибан.*ног|leg.?curl|сгибания ног/i.test(n)) return { pattern: 'leg_curl', subgroup: 'hamstrings' };
  if (/румын|rdl|мёртв|stiff|на прямых ногах/i.test(n)) return { pattern: 'rdl_hinge', subgroup: 'hamstrings' };
  if (/гудморнинг|good.?morning|гиперэкстенз|back.?extension|наклон.*штанг/i.test(n)) return { pattern: 'rdl_hinge', subgroup: 'hamstrings' };
  if (/присед|squat|жим.*ног|leg.?press|хак|hack/i.test(n) && !/над голов|overhead|пистол|pistol|split|выпад|lunge|болгар|bulgarian|гоблет|goblet|сисси|sissy|поясн|belt/i.test(n)) return { pattern: 'compound_squat', subgroup: 'quads' };
  if (/выпад|lunge|болгар|bulgarian|гоблет|goblet|фронт.*присед|front.*squat|split.*squat|ножниц/i.test(n) && !/сисси|sissy/i.test(n)) return { pattern: 'lunge', subgroup: 'quads' };
  if (/сисси|sissy|наклон.*назад|reverse.*nordic|обратн.*скандинав/i.test(n)) return { pattern: 'sissy_lengthened', subgroup: 'quads' };
  if (/разгибан.*ног|leg.?extension/i.test(n)) return { pattern: 'leg_extension', subgroup: 'quads' };
  if (/поясн.*присед|belt.?squat|step.?up|вставан.*скам|зашагиван/i.test(n)) return { pattern: 'belt_stepup', subgroup: 'quads' };
  if (/подъём.*носк|подъем.*носк|calf|степень/i.test(n)) return { pattern: 'calf', subgroup: 'calves' };
  return { pattern: 'other', subgroup: 'quads' };
}

/** Классификация упражнений на руки по функциональным паттернам. */
export function classifyArmExercise(name: string): { pattern: ArmPattern; subgroup: string } {
  const n = String(name || '').toLowerCase();
  if (/сгибан.*запяст|разгибан.*кист|сгибан.*предплеч|forearm|wrist|зоттман/i.test(n)) return { pattern: 'forearm', subgroup: 'forearms' };
  if (/молот|hammer/i.test(n)) return { pattern: 'biceps_hammer', subgroup: 'biceps' };
  if (/наклон.*скам|incline.*curl|сгибан.*наклон/i.test(n)) return { pattern: 'biceps_lengthened', subgroup: 'biceps' };
  if (/проповед|preacher|концентр|concentration|спайдер|spider/i.test(n)) return { pattern: 'biceps_shortened', subgroup: 'biceps' };
  if (/сгибан|curl|подъём.*бицепс|подъем.*бицепс|сгибан.*рук/i.test(n)) return { pattern: 'biceps_shortened', subgroup: 'biceps' };
  if (/разгибан.*из.?за|overhead.*tricep|француз|french/i.test(n)) return { pattern: 'triceps_overhead', subgroup: 'triceps' };
  if (/жим.*узк|close.?grip|жим.*узким/i.test(n)) return { pattern: 'triceps_compound', subgroup: 'triceps' };
  if (/отжим.*брус|dip|брусь/i.test(n) && /трицепс|triceps/i.test(n)) return { pattern: 'triceps_compound', subgroup: 'triceps' };
  if (/разгибан.*блок|pushdown|трицепс.*блок|канат.*рукоят/i.test(n)) return { pattern: 'triceps_pushdown', subgroup: 'triceps' };
  if (/разгибан.*рук|разгибан.*трицепс|tricep/i.test(n)) return { pattern: 'triceps_pushdown', subgroup: 'triceps' };
  return { pattern: 'other', subgroup: 'arms' };
}

/** Косвенный объём рук от compound-упражнений (жимы → трицепс, тяги → бицепс). */
export function indirectArmVolume(session: BBSession): { biceps: number; triceps: number } {
  let biceps = 0, triceps = 0;
  for (const ex of session.exercises) {
    if (['biceps', 'triceps', 'forearms'].includes(ex.muscle)) continue;
    const sets = ex.sets || 0;
    const n = (ex.name || '').toLowerCase();
    if (/жим|bench|press|dip|отжим.*брус|жим.*узк|close.?grip/i.test(n) && !/ног|leg|сгибан|curl|разгибан.*ног/i.test(n)) {
      triceps += sets * 0.5;
    }
    if (/подтяг|pull.?up|chin|тяга|row|пуллдаун|верхн.*блок|lat.?pull/i.test(n) && !/лиц|face/i.test(n)) {
      biceps += sets * 0.5;
    }
  }
  return { biceps, triceps };
}
