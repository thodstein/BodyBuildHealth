/**
 * strength-sport-ta-injection.engine.ts — инъекция ТА-коррекций в план (MRV + dedup parity с PL)
 *
 * Вставляет по 1 коррекционному упражнению на слабую фазу WLWeakPoint в technique/clean/snatch день.
 * Parity с lms-builder: per-day dedup, budget cap (weeklySets ≤ Budget), протокол из TA_BIOMECH intensityPct.
 * Не мутирует исходный plan — возвращает копию + отчёт.
 */
import type { StrengthSportPlan, StrengthSportSession, StrengthSportExercise } from './strength-sport.types';
import { WL_WEAKPOINT_CORRECTION, type WLWeakPoint } from './strength-sport-weakpoint';
import { TA_BIOMECH } from './strength-sport-biomechanics.engine';

function basePmForTA(id: string, wm: any): number {
  const low = id.toLowerCase();
  if (low.includes('snatch')) return wm.snatch || 60;
  if (low.includes('clean') || low.includes('jerk')) return wm.cleanJerk || wm.clean || 80;
  if (low.includes('squat') || low.includes('overhead')) return wm.backSquat || 100;
  if (low.includes('pull') || low.includes('deficit')) return wm.deadlift || 120;
  if (low.includes('press') || low.includes('jerk')) return wm.overheadPress || 60;
  return wm.backSquat || 80;
}

function sessionForInjection(week: any, weakPoint: WLWeakPoint): StrengthSportSession | null {
  const tagOrder = ['technique_day', 'clean_day', 'snatch_day', 'strength_day', 'pull_day'];
  for (const tag of tagOrder) {
    const s = week.sessions.find((x: any) => x.sessionTag === tag);
    if (s) return s;
  }
  return week.sessions[0] ?? null;
}

export interface TAInjectionOpts {
  dayMap?: Record<string, number[]>; // weakPoint → days 1-based
  budget?: number; // weeklySets cap, если не задан — вычисляем по уровню
  workMax?: any;
}

export interface TAInjectionResult {
  plan: StrengthSportPlan;
  injected: number;
  skippedBudget: number;
  skippedDup: number;
  notes: string[];
}

function computeBudgetTA(plan: StrengthSportPlan): number {
  const level = (plan as any).level ?? (plan as any).inputSnapshot?.level ?? 'intermediate';
  const map: Record<string, number> = { beginner: 60, intermediate: 85, advanced: 110, enhanced: 135 };
  return map[level] ?? 85;
}

export function injectTAWeakPoints(plan: StrengthSportPlan, weakPoints: WLWeakPoint[], opts: TAInjectionOpts = {}): TAInjectionResult {
  if (!weakPoints || weakPoints.length === 0) return { plan, injected: 0, skippedBudget: 0, skippedDup: 0, notes: [] };
  const copy: StrengthSportPlan = JSON.parse(JSON.stringify(plan));
  const budget = opts.budget ?? computeBudgetTA(plan as any);
  let injected = 0, skippedBudget = 0, skippedDup = 0;
  const notes: string[] = [];

  // dedup weakPoints
  const uniq = [...new Set(weakPoints)].slice(0, 3) as WLWeakPoint[];

  for (const wp of uniq) {
    const corrList = (WL_WEAKPOINT_CORRECTION as any)[wp] as string[] | undefined;
    const bio = (TA_BIOMECH as any)[wp];
    const corrId = corrList && corrList[0] ? corrList[0] : null;
    if (!corrId) { notes.push(`⚠ ${wp} — нет коррекции`); continue; }
    const intensityPct: number = bio?.intensityPct ?? 0.70;
    // target week 1 only (как PL)
    const week = copy.weeksData[0];
    if (!week || week.deload) { notes.push(`⚠ ${wp} — делод, пропуск`); continue; }
    // dayMap поддержка
    const configuredDays = opts.dayMap?.[wp];
    let targetSession: StrengthSportSession | null = null;
    if (configuredDays && configuredDays.length) {
      const dayIdx = configuredDays[0] - 1;
      targetSession = week.sessions[dayIdx] ?? null;
    }
    if (!targetSession) targetSession = sessionForInjection(week, wp);
    if (!targetSession) { notes.push(`⚠ ${wp} — нет сессии`); continue; }
    // dedup по id
    if (targetSession.exercises.some(e => e.id === corrId || e.id.toLowerCase() === corrId.toLowerCase())) {
      skippedDup++; notes.push(`⊘ ${wp} → ${corrId} уже есть в ${targetSession.sessionTag}`);
      continue;
    }
    // budget check weeklySets
    const weeklySets = copy.weeksData[0].sessions.reduce((a: number, s: any) => a + s.exercises.reduce((aa: number, e: any) => aa + (e.sets || 0), 0), 0);
    const addSets = 3;
    if (weeklySets + addSets > budget) {
      skippedBudget++; notes.push(`⊘ ${wp} → ${corrId} превысит Budget ${budget} (сейчас ${weeklySets}+${addSets})`);
      continue;
    }
    // build exercise
    const wm = opts.workMax ?? (copy as any).workMax ?? (copy as any).inputSnapshot?.workMax ?? {};
    const basePm = basePmForTA(corrId, wm);
    const weight = Math.round(basePm * intensityPct / 2.5) * 2.5;
    const repsAvg = 5; // средний для ТА техники
    const rir = 2;
    const tempo = 'X-0-X-0';
    const rest = 120;
    const ex: StrengthSportExercise = {
      id: corrId,
      name: bio?.corrections?.[0] || corrId,
      group: 'legs',
      pattern: 'hinge',
      sets: addSets,
      reps: `${repsAvg}-${repsAvg + 1}`,
      rir,
      tempo,
      restSeconds: rest,
      weight,
      workSets: Array.from({ length: addSets }, () => ({ reps: repsAvg, rir, weight, pct: Math.round(intensityPct * 100), tempo, restSeconds: rest } as any)),
      warmupSets: [],
    } as any;
    // вставляем в конец сессии (аксессуар)
    targetSession.exercises.push(ex);
    // обновим week totals если есть
    if (typeof week.totalSets === 'number') week.totalSets += addSets;
    injected++;
    notes.push(`✓ ${wp} → ${corrId} в ${targetSession.sessionTag} 3×5 @${Math.round(intensityPct * 100)}%`);
  }

  if (injected > 0) {
    copy.rationale = [...(copy.rationale || []), `ТА-диагностика: инъецировано ${injected} коррекций (${uniq.join(', ')})`];
  }

  return { plan: copy, injected, skippedBudget, skippedDup, notes };
}

// helper для тестов: чисто вычисление бюджета (упрощённо levelBase × etc)
// Если computeBudgetTA нет — fallback
export function computeBudgetTAFallback(level: string): number {
  const map: Record<string, number> = { beginner: 60, intermediate: 85, advanced: 110, enhanced: 135 };
  return map[level] ?? 85;
}
