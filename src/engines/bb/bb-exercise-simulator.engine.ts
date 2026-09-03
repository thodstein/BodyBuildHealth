/**
 * bb-exercise-simulator.engine.ts — Δ-превью коррекции (pure, без мутации плана).
 * clone plan → применить action → audit до/после → delta
 */
import { auditPlanExercises, type PlanExerciseAudit } from './bb-plan-exercise-audit.engine';
import type { CorrectionAction } from './bb-exercise-correction.engine';

export interface SimulatorDelta {
  sfrDelta: number | null;
  fatigueDelta: number | null;
  lengthenedDelta: number | null;
  unilateralDelta: number | null;
  angleDelta: number | null;
  issuesResolved: string[];
  summary: string;
}

function clonePlan(plan: any): any {
  try { return JSON.parse(JSON.stringify(plan)); } catch { return plan; }
}

function applyActionToPlan(plan: any, action: CorrectionAction, targetExId?: string | null): any {
  const cp = clonePlan(plan);
  if (!cp.weeks || !cp.weeks.length) return cp;
  const week = cp.weeks[0];
  if (!week.sessions) return cp;

  if (action.type === 'substitute' || action.type === 'mobilitySwap') {
    // замена первого вхождения targetExId (или любого с SFR low)
    const oldId = targetExId || '';
    let replaced = false;
    for (const s of week.sessions) {
      for (const ex of (s.exercises || [])) {
        const curId = String(ex.exerciseName || ex.id || ex.name || '').toLowerCase();
        const need = String(oldId).toLowerCase();
        if (need && curId === need && action.targetId) {
          ex.exerciseName = action.targetId;
          ex.name = action.targetName || action.targetId;
          // сбросим tempo/pause к новому если modify
          if (action.tempo) ex.tempo = action.tempo;
          replaced = true;
          break;
        }
      }
      if (replaced) break;
    }
    if (!replaced && action.targetId) {
      // fallback: заменим первый low SFR
      outer: for (const s of week.sessions) for (const ex of (s.exercises || [])) { if (action.targetId) { ex.exerciseName = action.targetId; ex.name = action.targetName || action.targetId; break outer; } }
    }
  } else if (action.type === 'add' && action.targetId) {
    // добавим в первую сессию где мышца совпадает или в первую
    const sess = week.sessions[0];
    if (sess && Array.isArray(sess.exercises)) {
      sess.exercises.push({
        exerciseName: action.targetId, name: action.targetName || action.targetId,
        muscle: (action as any).muscle || sess.exercises[0]?.muscle || 'chest',
        sets: 3, repsRange: [10, 12] as any, rir: 2, tempo: action.tempo || '3-1-1-0', comment: `Коррекция: ${action.reason}`,
      } as any);
    }
  } else if (action.type === 'modifyTempo' && action.tempo) {
    for (const s of week.sessions) for (const ex of (s.exercises || [])) if (String(ex.exerciseName || ex.id) === String(targetExId || '')) ex.tempo = action.tempo;
    if (!targetExId) for (const s of week.sessions) for (const ex of (s.exercises || [])) ex.tempo = action.tempo;
  } else if (action.type === 'modifyROM') {
    for (const s of week.sessions) for (const ex of (s.exercises || [])) {
      if (!targetExId || String(ex.exerciseName || ex.id) === String(targetExId)) { ex.pauseSeconds = 1; (ex as any).stretchPhase = true; }
    }
  } else if (action.type === 'modifyExecution' && action.execCues) {
    for (const s of week.sessions) for (const ex of (s.exercises || [])) {
      if (!targetExId || String(ex.exerciseName || ex.id) === String(targetExId)) ex.comment = (ex.comment ? ex.comment + ' · ' : '') + action.execCues.slice(0, 2).join(' · ');
    }
  } else if (action.type === 'unilateral' && action.targetId) {
    // добавим unilateral
    const sess = week.sessions[0];
    if (sess && Array.isArray(sess.exercises)) sess.exercises.push({ exerciseName: action.targetId, name: action.targetName || action.targetId, muscle: 'back', sets: 3, rir: 2 } as any);
  }
  return cp;
}

function deltaNum(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return Math.round((b - a) * 100) / 100;
}

export function simulateCorrection(plan: any, action: CorrectionAction, targetExId?: string | null): SimulatorDelta | null {
  if (!plan || !action) return null;
  const before = auditPlanExercises(plan);
  if (!before) return null;
  const afterPlan = applyActionToPlan(plan, action, targetExId);
  const after = auditPlanExercises(afterPlan);
  if (!after) return null;

  const sfrDelta = deltaNum(before.avgSfr, after.avgSfr);
  const fatigueDelta = deltaNum(before.fatigueDensity, after.fatigueDensity);
  const lengthenedDelta = deltaNum(before.lengthenedRatio, after.lengthenedRatio);
  const unilateralDelta = deltaNum(before.unilateralRatio, after.unilateralRatio);
  // angleDelta: средний прирост covered углов
  let angleBefore = 0, angleAfter = 0, cnt = 0;
  for (const m of Object.keys(before.byMuscle)) {
    const b = before.byMuscle[m].angleCoverage;
    const a = after.byMuscle[m].angleCoverage;
    if (b.total) { angleBefore += b.covered / b.total; angleAfter += a.covered / (a.total || b.total); cnt++; }
  }
  const angleDelta = cnt ? Math.round(((angleAfter / cnt) - (angleBefore / cnt)) * 100) / 100 : null;

  const issuesResolved: string[] = [];
  if (before.flags.includes('lowSFR') && !after.flags.includes('lowSFR')) issuesResolved.push('lowSFR');
  if (before.flags.includes('missingLengthened') && !after.flags.includes('missingLengthened')) issuesResolved.push('lengthened');
  if (before.flags.includes('highFatigue') && !after.flags.includes('highFatigue')) issuesResolved.push('fatigue');
  if (before.flags.includes('lowUnilateral') && !after.flags.includes('lowUnilateral')) issuesResolved.push('unilateral');

  const parts: string[] = [];
  if (sfrDelta != null && Math.abs(sfrDelta) >= 0.05) parts.push(`SFR ${sfrDelta > 0 ? '+' : ''}${sfrDelta}`);
  if (fatigueDelta != null && Math.abs(fatigueDelta) >= 0.05) parts.push(`усталость ${fatigueDelta > 0 ? '+' : ''}${fatigueDelta}`);
  if (lengthenedDelta != null && Math.abs(lengthenedDelta) >= 0.02) parts.push(`lengthened ${lengthenedDelta > 0 ? '+' : ''}${Math.round(lengthenedDelta * 100)}%`);
  if (angleDelta != null && Math.abs(angleDelta) >= 0.02) parts.push(`углы ${angleDelta > 0 ? '+' : ''}${Math.round(angleDelta * 100)}%`);
  if (issuesResolved.length) parts.push(`исправит: ${issuesResolved.join(', ')}`);
  const summary = parts.length ? parts.join(' · ') : 'эффект нейтральный — техника/темп';

  return { sfrDelta, fatigueDelta, lengthenedDelta, unilateralDelta, angleDelta, issuesResolved, summary };
}
