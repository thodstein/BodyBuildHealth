import type { BBExercise, BBSession, BBWeek } from './bb-types';

export type BackPattern = 'vertical_pull' | 'heavy_row' | 'supported_row' | 'unilateral_row' | 'lat_isolation' | 'upper_back' | 'rear_delt' | 'shrug' | 'erector' | 'other';

export function classifyBackExercise(name: string): { pattern: BackPattern; subgroup: BBExercise['backSubgroup'] } {
  const n = String(name || '').toLowerCase();
  if (/подтяг|pull.?up|chin|верхн.*блок|lat.?pull|пуллдаун|vertical/i.test(n)) return { pattern: 'vertical_pull', subgroup: 'back_width' };
  if (/пуловер|прям.*рук|straight.?arm/i.test(n)) return { pattern: 'lat_isolation', subgroup: 'back_width' };
  if (/тяга.*одной|one.?arm|single.?arm|одноруч|гантел.*наклон/i.test(n)) return { pattern: 'unilateral_row', subgroup: 'back_thickness' };
  if (/тяга.*груд.*упор|chest.?supported|seal|тяга.*тренаж|machine.*row/i.test(n)) return { pattern: 'supported_row', subgroup: 'back_thickness' };
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
