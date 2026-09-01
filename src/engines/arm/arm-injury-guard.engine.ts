/**
 * arm-injury-guard.engine.ts — травмо-гейты для арм-плана (как bb-joint-guard).
 * Wrist / humerus / elbow / shoulder.
 */

export function isWristStressExercise(ex: { muscle?: string; substitutionGroup?: string; movementPattern?: string; name?: string }): boolean {
  const m = (ex.muscle || '').toLowerCase();
  const sg = (ex.substitutionGroup || '').toLowerCase();
  const mp = ((ex.movementPattern as any) || '').toString().toLowerCase();
  const n = (ex.name || '').toLowerCase();
  return m.includes('wrist') || m.includes('pronator') || m.includes('supinator') || sg.includes('pronation') || sg.includes('supination') || sg === 'cup_iso' || mp.includes('pronation') || n.includes('пронация') || n.includes('супинация');
}

export function isSidePressureExercise(ex: { muscle?: string; substitutionGroup?: string; name?: string }): boolean {
  const m = (ex.muscle || '').toLowerCase();
  const sg = (ex.substitutionGroup || '').toLowerCase();
  const n = (ex.name || '').toLowerCase();
  return m === 'side_pressure' || sg === 'side_press' || n.includes('боковое') || n.includes('side press');
}

export function isHumerusRiskExercise(ex: { muscle?: string; substitutionGroup?: string; name?: string }): boolean {
  return isSidePressureExercise(ex);
}

export function armInjuryVolumeFactor(injuries: Array<{ muscle: string; volumePct?: number; exclude?: boolean }>, muscle: string): number {
  const inj = injuries.find(i => i.muscle.toLowerCase() === muscle.toLowerCase());
  if (!inj) return 1;
  if (inj.exclude) return 0;
  if (inj.volumePct != null) return Math.max(0, Math.min(1, inj.volumePct / 100));
  return 0.5;
}

export function checkHumerusGuard(plan: { weeks: Array<{ week: number; sessions: Array<{ exercises: Array<{ muscle: string; sets: number }> }> }> }): string[] {
  const warnings: string[] = [];
  for (const wk of plan.weeks) {
    let sideSets = 0;
    for (const sess of wk.sessions) for (const ex of sess.exercises) if (ex.muscle === 'side_pressure') sideSets += ex.sets;
    if (wk.week <= 4 && sideSets > 6) warnings.push(`Н${wk.week}: side_pressure ${sideSets} сетов >6 первые 4 нед — humerus risk (≤3/нед рекомендовано)`);
    if (sideSets > 9) warnings.push(`Н${wk.week}: side_pressure ${sideSets} сетов — превышен cap 9`);
  }
  // прогрессия ≤10%/нед — проверка между неделями
  for (let i = 1; i < plan.weeks.length; i++) {
    const prev = plan.weeks[i-1].sessions.reduce((s, ss) => s + ss.exercises.filter(e => e.muscle === 'side_pressure').reduce((a,e)=>a+e.sets,0),0);
    const cur = plan.weeks[i].sessions.reduce((s, ss) => s + ss.exercises.filter(e => e.muscle === 'side_pressure').reduce((a,e)=>a+e.sets,0),0);
    if (prev > 0 && cur > prev * 1.11) warnings.push(`Н${plan.weeks[i].week}: side_pressure прогрессия ${(cur/prev*100-100).toFixed(0)}% >10%/нед`);
  }
  return warnings;
}

export function checkWristBalance(plan: { weeks: Array<{ sessions: Array<{ exercises: Array<{ muscle: string; sets: number }> }> }> }): string[] {
  const warnings: string[] = [];
  for (const wk of (plan as any).weeks) {
    let pron = 0, sup = 0, flex = 0, ext = 0;
    for (const sess of wk.sessions) for (const ex of sess.exercises) {
      if (ex.muscle === 'pronators') pron += ex.sets;
      if (ex.muscle === 'supinators') sup += ex.sets;
      if (ex.muscle === 'wrist_flexors') flex += ex.sets;
      if (ex.muscle === 'wrist_extensors') ext += ex.sets;
    }
    if (pron > 0 && sup > 0 && Math.max(pron, sup) / Math.max(1, Math.min(pron, sup)) > 1.5) warnings.push(`Н${wk.week}: pron/sup ${pron}/${sup} >1.5× — добавить антагонист`);
    if (flex > 0 && ext > 0 && Math.max(flex, ext) / Math.max(1, Math.min(flex, ext)) > 1.5) warnings.push(`Н${wk.week}: flex/ext ${flex}/${ext} >1.5×`);
  }
  return warnings;
}
