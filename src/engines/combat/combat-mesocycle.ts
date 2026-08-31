/**
 * combat-mesocycle.ts — кросс-мезоцикл для единоборств (изолировано).
 * Прогрессия +2.5кг compound / +1кг изоляция при успехе, ACWR-aware, без агрессии.
 */
import type { CombatPlan } from './combat.types';
import type { CombatInput } from './combat.types';

function bumpWeight(v: number, isCompound: boolean): number {
  const inc = isCompound ? 2.5 : 1.0;
  return Math.round((v + inc) / 0.5) * 0.5;
}

export function applyCombatMesocycle(prev: CombatPlan | null, nextInput: CombatInput): CombatInput {
  if (!prev) return nextInput;
  const next: CombatInput = { ...nextInput, previousPlanId: prev.id } as any;
  const prevSnap: any = prev.inputSnapshot || {};
  // ACWR guard + diary plateau guard (как у strength-sport и BB)
  const acwrDanger = (nextInput as any).acwr?.zone === 'dangerous';
  const acwrCaution = (nextInput as any).acwr?.zone === 'caution';
  const trends: any[] = (nextInput as any).diaryTrendCB || [];
  const hasPlateau = Array.isArray(trends) && trends.some((t:any)=> typeof t.changePct==='number' && t.changePct < -5);
  const hasWarnings = Array.isArray((nextInput as any).warnings) && (nextInput as any).warnings.length > 4;
  const plateauHold = hasPlateau || hasWarnings;
  const factor = acwrDanger ? 0.97 : acwrCaution || plateauHold ? 1.0 : 1.0;
  const busted = acwrDanger || plateauHold;

  // workMaxByExercise прогрессия
  const prevWmEx: Record<string, number> = (prevSnap as any).workMaxByExercise || (prev as any).workMaxByExercise || {};
  const nextWmEx: Record<string, number> = { ...((nextInput as any).workMaxByExercise || {}) };
  const compoundIds = new Set(['bench_bar','row_bar','squat','front_squat','rdl','trap_bar_dead','zercher_squat','ohp','push_press','hang_clean','high_pull']);
  for (const [k, v] of Object.entries(prevWmEx)) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
    const base = nextWmEx[k] ?? v;
    const isComp = compoundIds.has(k);
    let bumped = busted ? Math.round(base * factor / 0.5) * 0.5 : bumpWeight(base, isComp);
    // для weight_cut — не бампаем вниз, только поддерживаем
    if ((nextInput as any).goal === 'weight_cut') bumped = base;
    nextWmEx[k] = bumped;
  }
  // групповой workMax — аналогично +2.5 для основных групп
  const prevWm: Record<string, number> = (prevSnap as any).workMax || {};
  const nextWm: Record<string, number> = { ...((nextInput as any).workMax || {}) };
  for (const [k, v] of Object.entries(prevWm)) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
    const base = nextWm[k] ?? v;
    const isComp = ['chest','back','quads','hamstrings','shoulders'].includes(k);
    let bumped = busted ? Math.round(base * factor / 0.5) * 0.5 : bumpWeight(base, isComp);
    if ((nextInput as any).goal === 'weight_cut') bumped = base;
    nextWm[k] = bumped;
  }
  if (Object.keys(nextWmEx).length) (next as any).workMaxByExercise = nextWmEx;
  if (Object.keys(nextWm).length) (next as any).workMax = nextWm;
  // лёгкая прогрессия объёма: если не опасный ACWR и не weight_cut — можно +1 сет к neck/grip при недогрузе, но оставляем builder'у
  return next;
}

export function combatMesocycleSummary(prev: CombatPlan | null, next: CombatInput): string[] {
  if (!prev) return ['Первый мезоцикл — база без прогрессии'];
  const lines: string[] = [`Пред. план ${prev.discipline} ${prev.weeks}нед ${prev.patternId} → прогрессия`];
  const pEx = (prev.inputSnapshot as any)?.workMaxByExercise || {};
  const nEx = (next as any).workMaxByExercise || {};
  for (const k of Object.keys(pEx)) if (pEx[k] !== nEx[k]) lines.push(`${k}: ${pEx[k]} → ${nEx[k]} кг`);
  if (lines.length === 1) lines.push('Веса сохранены (weight_cut/ACWR caution — без бампа)');
  return lines;
}
