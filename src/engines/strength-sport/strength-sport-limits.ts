/**
 * strength-sport-limits.ts — изолированные лимиты сессии (не зависит от bb).
 */
export function sessionLimitsFor(level: string, trainingYears?: number, onCourse?: boolean, highVolume?: boolean): { maxSets: number; maxExercises: number; perExerciseCap: number } {
  const years = trainingYears || 0;
  let maxSets: number; let maxExercises: number;
  if ((level === 'enhanced' && years >= 3) || (onCourse && years >= 3)) { maxSets = 55; maxExercises = 16; }
  else if (level === 'enhanced' || (onCourse && years >= 1)) { maxSets = 38; maxExercises = 13; }
  else { maxSets = 24; maxExercises = 10; }
  if (highVolume) { maxSets = Math.round(maxSets * 1.2); maxExercises = Math.min(20, maxExercises + 2); }
  const perExerciseCap = level === 'enhanced' && years >= 3 ? 6 : 5;
  return { maxSets, maxExercises, perExerciseCap };
}

export function validateSync(plan: any): string[] {
  const errs: string[] = [];
  for (const wk of plan.weeksData || []) for (const sess of wk.sessions || []) for (const ex of sess.exercises || []) {
    if ((ex.workSets?.length || 0) !== ex.sets) errs.push(`Нед ${wk.week} ${sess.sessionTag} ${ex.name}: sets ${ex.sets} != workSets ${ex.workSets?.length}`);
    if (ex.sets > 6) errs.push(`Нед ${wk.week} ${ex.name}: sets ${ex.sets} > cap 6`);
  }
  return errs;
}
