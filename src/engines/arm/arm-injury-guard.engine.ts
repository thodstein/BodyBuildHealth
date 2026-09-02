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
    let pron = 0, sup = 0, flex = 0, ext = 0, ulnar = 0, radial = 0;
    for (const sess of wk.sessions) for (const ex of sess.exercises) {
      if (ex.muscle === 'pronators') pron += ex.sets;
      if (ex.muscle === 'supinators') sup += ex.sets;
      if (ex.muscle === 'wrist_flexors') flex += ex.sets;
      if (ex.muscle === 'wrist_extensors') ext += ex.sets;
      if (ex.muscle === 'ulnar_deviators') ulnar += ex.sets;
      if (ex.muscle === 'radial_deviators') radial += ex.sets;
    }
    if (pron > 0 && sup > 0 && Math.max(pron, sup) / Math.max(1, Math.min(pron, sup)) > 1.5) warnings.push(`Н${wk.week}: pron/sup ${pron}/${sup} >1.5× — добавить антагонист`);
    if (flex > 0 && ext > 0 && Math.max(flex, ext) / Math.max(1, Math.min(flex, ext)) > 1.5) warnings.push(`Н${wk.week}: flex/ext ${flex}/${ext} >1.5×`);
    if (ulnar > 0 && radial > 0 && Math.max(ulnar, radial) / Math.max(1, Math.min(ulnar, radial)) > 2) warnings.push(`Н${wk.week}: ulnar/radial ${ulnar}/${radial} >2×`);
    // новички: hook первые 3 недели запрещён (UCL)
    if (wk.week <= 3 && pron > 0 && sup > 6) warnings.push(`Н${wk.week}: sup ${sup} >6 первые 3н — hook UCL риск (новичкам только toproll)`);
  }
  return warnings;
}

export function checkUCLGuard(plan: { weeks: Array<{ week: number; sessions: Array<{ exercises: Array<{ muscle: string; sets: number; substitutionGroup?: string }> }> }>; level?: string }): string[] {
  const warnings: string[] = [];
  const isBeginner = (plan as any).level === 'beginner';
  for (const wk of plan.weeks) {
    let pron = 0, sup = 0, side = 0;
    for (const sess of wk.sessions) for (const ex of sess.exercises) {
      if (ex.muscle === 'pronators') pron += ex.sets;
      if (ex.muscle === 'supinators') sup += ex.sets;
      if (ex.muscle === 'side_pressure') side += ex.sets;
    }
    if (isBeginner && wk.week <= 3 && side > 2) warnings.push(`Н${wk.week}: UCL — новичкам side_pressure ≤2 первые 3н (hook запрещён, только toproll)`);
    if (pron > 0 && sup === 0 && pron >= 6) warnings.push(`Н${wk.week}: UCL pron ${pron} без sup — добавить супинацию (GripBoard каждый сессион)`);
    if (side > 0 && pron === 0 && sup === 0) warnings.push(`Н${wk.week}: side_pressure без ротации — добавить pron/sup баланс`);
  }
  return warnings;
}

export function checkShoulderGuard(plan: { weeks: Array<{ sessions: Array<{ exercises: Array<{ muscle: string; sets: number; repsRange?: [number, number]; rir?: number }> }> }> }): string[] {
  const warnings: string[] = [];
  for (const wk of (plan as any).weeks) {
    let shoulder = 0, badRir = 0;
    for (const sess of wk.sessions) for (const ex of sess.exercises) {
      if (ex.muscle === 'shoulder_stab') {
        shoulder += ex.sets;
        if ((ex.rir ?? 3) < 2) badRir++;
        if (ex.repsRange && ex.repsRange[1] < 12) warnings.push(`Н${wk.week}: shoulder_stab ${ex.repsRange[0]}-${ex.repsRange[1]} <12 — нужно high-rep 12-20 (защита плеча)`);
      }
    }
    if (shoulder > 0 && shoulder < 4) warnings.push(`Н${wk.week}: shoulder_stab ${shoulder} <4 — мало для защиты плеча (нужно ≥4)`);
    if (badRir > 0) warnings.push(`Н${wk.week}: shoulder_stab RIR<2 — не до отказа (high-rep, RIR≥2)`);
  }
  return warnings;
}

export function checkTendonGuard(plan: { weeks: Array<{ week: number; sessions: Array<{ exercises: Array<{ muscle: string; sets: number }> }> }>; level?: string }): string[] {
  const warnings: string[] = [];
  for (const wk of plan.weeks) {
    let tendon = 0;
    for (const sess of wk.sessions) for (const ex of sess.exercises) {
      if (['wrist_flexors','wrist_extensors','pronators','supinators','risers','thumb','ulnar_deviators','radial_deviators'].includes(ex.muscle)) tendon += ex.sets;
    }
    if (tendon > 22) warnings.push(`Н${wk.week}: tendon ${tendon} >22 — CRITICAL (кап 22, кап 18 warn)`);
    else if (tendon > 18) warnings.push(`Н${wk.week}: tendon ${tendon} >18 — warn (tendonCap 1.2×, beginner 12)`);
    else if ((plan as any).level === 'beginner' && tendon > 12) warnings.push(`Н${wk.week}: tendon ${tendon} >12 для beginner — много (F1)`);
  }
  return warnings;
}
