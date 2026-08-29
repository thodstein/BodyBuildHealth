/**
 * combat-limits.ts — изолированные лимиты для единоборств.
 */
export function sessionLimitsForCombat(level: string, onCourse?: boolean): { maxSets: number; maxExercises: number; perExerciseCap: number } {
  let maxSets: number; let maxExercises: number;
  const lvl = (level||'intermediate').toLowerCase();
  if (lvl === 'enhanced' || onCourse) { maxSets = 30; maxExercises = 10; }
  else if (lvl === 'advanced') { maxSets = 26; maxExercises = 9; }
  else if (lvl === 'intermediate') { maxSets = 22; maxExercises = 8; }
  else { maxSets = 18; maxExercises = 6; } // beginner
  const perExerciseCap = lvl === 'beginner' ? 4 : 5;
  return { maxSets, maxExercises, perExerciseCap };
}
export function validateSyncCombat(plan: any): string[] {
  const errs: string[] = [];
  for (const wk of plan.weeksData || []) for (const sess of wk.sessions || []) {
    let total = 0;
    for (const ex of sess.exercises || []) {
      if ((ex.workSets?.length || 0) !== ex.sets) errs.push(`Нед ${wk.week} ${sess.sessionTag} ${ex.name}: sets != workSets`);
      total += ex.sets;
    }
    const lim = sessionLimitsForCombat(plan.level, Array.isArray(plan.inputSnapshot?.peds) && plan.inputSnapshot.peds.length>0);
    if (total > lim.maxSets) errs.push(`Нед ${wk.week} ${sess.sessionTag}: ${total} сетов > лимита ${lim.maxSets}`);
    if (sess.exercises.length > lim.maxExercises) errs.push(`Нед ${wk.week} ${sess.sessionTag}: ${sess.exercises.length} упр > лимита ${lim.maxExercises}`);
  }
  return errs;
}
