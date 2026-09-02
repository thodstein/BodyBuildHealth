/**
 * strength-sport-sm-injection.engine.ts — инъекция Стронг-коррекций в план (MRV + dedup parity с TA)
 *
 * Вставляет по 1 коррекционному упражнению на слабую фазу SMWeakPoint в overhead/event/carry день.
 * Parity с TA: per-day dedup, budget cap (weeklySets ≤ Budget), протокол из SM_BIOMECH intensityPct.
 * Не мутирует исходный plan — возвращает копию + отчёт.
 */
import type { StrengthSportPlan, StrengthSportSession, StrengthSportExercise } from './strength-sport.types';
import { SM_WEAKPOINT_CORRECTION, type SMWeakPoint } from './strength-sport-sm-biomechanics.engine';
import { SM_BIOMECH } from './strength-sport-sm-biomechanics.engine';
import '../../core/exercise-catalog-ta-supplement';

function basePmForSM(id: string, wm: any): number {
  const low = id.toLowerCase();
  if (low.includes('log') || low.includes('axle') || low.includes('viking') || low.includes('circus')) return wm.logPress || wm.axlePress || wm.overheadPress || 60;
  if (low.includes('yoke') || low.includes('farmers') || low.includes('frame') || low.includes('husafell') || low.includes('conan') || low.includes('shield') || low.includes('duck') || low.includes('zercher') || low.includes('carry')) return wm.farmersWalk || wm.yokeWalk || 140;
  if (low.includes('stone') || low.includes('sandbag') || low.includes('keg') || low.includes('tire')) return wm.atlasStone || wm.sandbagLoad || 100;
  if (low.includes('squat') || low.includes('overhead_squat') || low.includes('front_squat')) return wm.backSquat || 100;
  if (low.includes('pull') || low.includes('deadlift') || low.includes('rdl') || low.includes('deficit')) return wm.deadlift || 120;
  if (low.includes('press') || low.includes('ohp') || low.includes('bench') || low.includes('jerk')) return wm.overheadPress || 60;
  if (low.includes('hammer') || low.includes('pinch') || low.includes('grip') || low.includes('plank') || low.includes('suitcase')) return 20;
  return wm.backSquat || 80;
}

function sessionForSMInjection(week: any, weakPoint: SMWeakPoint): StrengthSportSession | null {
  const low = String(weakPoint).toLowerCase();
  if (low.startsWith('log_')) {
    const tagOrder = ['overhead_day', 'event_day', 'strength_day'];
    for (const tag of tagOrder) { const s = week.sessions.find((x: any) => x.sessionTag === tag); if (s) return s; }
  }
  if (low.startsWith('yoke_') || low.startsWith('farmers')) {
    const tagOrder = ['event_day', 'deadlift_day', 'squat_day', 'strength_day'];
    for (const tag of tagOrder) { const s = week.sessions.find((x: any) => x.sessionTag === tag); if (s) return s; }
  }
  if (low.startsWith('stone_')) {
    const tagOrder = ['event_day', 'deadlift_day', 'strength_day'];
    for (const tag of tagOrder) { const s = week.sessions.find((x: any) => x.sessionTag === tag); if (s) return s; }
  }
  if (low.includes('grip') || low.includes('core') || low.includes('conditioning')) {
    const tagOrder = ['event_day', 'strength_day', 'accessory_day'];
    for (const tag of tagOrder) { const s = week.sessions.find((x: any) => x.sessionTag === tag); if (s) return s; }
  }
  const fallbackOrder = ['event_day', 'overhead_day', 'deadlift_day', 'squat_day', 'strength_day', 'technique_day'];
  for (const tag of fallbackOrder) { const s = week.sessions.find((x: any) => x.sessionTag === tag); if (s) return s; }
  return week.sessions[0] ?? null;
}

export interface SMInjectionOpts {
  dayMap?: Record<string, number[]>;
  budget?: number;
  workMax?: any;
}

export interface SMInjectionResult {
  plan: StrengthSportPlan;
  injected: number;
  skippedBudget: number;
  skippedDup: number;
  notes: string[];
}

function computeBudgetSM(plan: StrengthSportPlan): number {
  const level = (plan as any).level ?? (plan as any).inputSnapshot?.level ?? 'intermediate';
  const map: Record<string, number> = { beginner: 60, intermediate: 85, advanced: 110, enhanced: 135 };
  return map[level] ?? 85;
}

export function injectSMWeakPoints(plan: StrengthSportPlan, weakPoints: SMWeakPoint[], opts: SMInjectionOpts = {}): SMInjectionResult {
  if (!weakPoints || weakPoints.length === 0) return { plan, injected: 0, skippedBudget: 0, skippedDup: 0, notes: [] };
  const copy: StrengthSportPlan = JSON.parse(JSON.stringify(plan));
  const budget = opts.budget ?? computeBudgetSM(plan as any);
  let injected = 0, skippedBudget = 0, skippedDup = 0;
  const notes: string[] = [];
  const uniq = [...new Set(weakPoints)].slice(0, 4) as SMWeakPoint[];
  for (const wp of uniq) {
    const corrList = (SM_WEAKPOINT_CORRECTION as any)[wp] as string[] | undefined;
    const bio = (SM_BIOMECH as any)[wp];
    // SM corrections are like "Толчковый дип (jerk_dip)" — need to extract id in parentheses or fallback to first word
    let corrId: string | null = null;
    if (corrList && corrList[0]) {
      const raw = corrList[0];
      const m = raw.match(/\(([^)]+)\)/);
      corrId = m ? m[1].trim() : raw.split(' ')[0].trim();
      // corrections contain cyrillic labels; map to real ids: if not found in catalog, fallback to known ids
      const knownMap: Record<string, string> = {
        'jerk_dip': 'jerk_dip',
        'pause': 'pause_squat',
        'Толчковый': 'push_press',
        'Жим': 'pin_press',
        'Пауза-присед': 'pause_squat',
        'Yoke': 'yoke_walk',
        'Чемоданная': 'sandbag_carry',
        'Планка': 'plank',
        'Щипковый': 'plate_pinch',
        'Вис': 'dead_hang',
        'Молоток': 'hammer_curl',
      };
      // try direct, else fallback to bio intensity based generic
      if (!corrId || corrId.length < 2 || /[А-Яа-я]/.test(corrId)) {
        // fallback per weakPoint
        const fallbackByWP: Record<string, string> = {
          log_dip: 'jerk_dip', log_drive: 'push_press', log_lockout: 'pin_press', log_clean: 'rdl',
          yoke_pickup: 'pause_squat', yoke_walk: 'sandbag_carry', yoke_turn: 'side_plank',
          farmers_pickup: 'deadlift', farmers_carry: 'farmers_walk_heavy', farmers_grip: 'plate_pinch',
          stone_off_floor: 'deficit_pull', stone_lap: 'front_squat', stone_load: 'push_press',
          grip_support: 'plate_pinch', core_brace: 'sandbag_carry', conditioning: 'sled_push_sprint',
        };
        corrId = (fallbackByWP as any)[wp] || corrId;
      }
      // if still cyrillic, fallback
      if (!corrId || /[А-Яа-я]/.test(corrId)) corrId = 'farmers_walk_heavy';
    }
    if (!corrId) { notes.push(`⚠ ${wp} — нет коррекции`); continue; }
    const intensityPct: number = bio?.intensityPct ?? 0.65;
    const week = copy.weeksData[0];
    if (!week || week.deload) { notes.push(`⚠ ${wp} — делод, пропуск`); continue; }
    const configuredDays = opts.dayMap?.[wp];
    let targetSession: StrengthSportSession | null = null;
    if (configuredDays && configuredDays.length) {
      const dayIdx = configuredDays[0] - 1;
      targetSession = week.sessions[dayIdx] ?? null;
    }
    if (!targetSession) targetSession = sessionForSMInjection(week, wp);
    if (!targetSession) { notes.push(`⚠ ${wp} — нет сессии`); continue; }
    if (targetSession.exercises.some(e => e.id === corrId || e.id.toLowerCase() === corrId.toLowerCase())) {
      skippedDup++; notes.push(`⊘ ${wp} → ${corrId} уже есть в ${targetSession.sessionTag}`); continue;
    }
    const weeklySets = copy.weeksData[0].sessions.reduce((a: number, s: any) => a + s.exercises.reduce((aa: number, e: any) => aa + (e.sets || 0), 0), 0);
    const addSets = 3;
    if (weeklySets + addSets > budget) {
      skippedBudget++; notes.push(`⊘ ${wp} → ${corrId} превысит Budget ${budget} (сейчас ${weeklySets}+${addSets})`); continue;
    }
    const wm = opts.workMax ?? (copy as any).workMax ?? (copy as any).inputSnapshot?.workMax ?? {};
    const basePm = basePmForSM(corrId, wm);
    const weight = Math.round(basePm * intensityPct / 2.5) * 2.5;
    const rir = 2;
    const tempo = corrId.includes('squat') ? '3-1-1-0' : corrId.includes('walk') || corrId.includes('carry') ? 'brace 2с — walk' : '2-0-1-0';
    const rest = corrId.includes('carry') || corrId.includes('walk') ? 180 : 120;
    const ex: StrengthSportExercise = {
      id: corrId,
      name: bio?.corrections?.[0] || corrId,
      group: corrId.includes('carry') || corrId.includes('walk') ? 'back' : corrId.includes('plank') ? 'core' : 'legs',
      pattern: corrId.includes('carry') || corrId.includes('walk') ? 'carry' : corrId.includes('squat') ? 'squat' : 'hinge',
      sets: addSets,
      reps: corrId.includes('carry') || corrId.includes('walk') ? '20м' : '5',
      rir,
      tempo,
      restSeconds: rest,
      weight,
      workSets: Array.from({ length: addSets }, () => ({ reps: corrId.includes('carry') ? 1 : 5, rir, weight, pct: Math.round(intensityPct * 100), tempo, restSeconds: rest, distanceM: corrId.includes('carry') ? 20 : undefined } as any)),
      warmupSets: [],
    } as any;
    targetSession.exercises.push(ex);
    if (typeof week.totalSets === 'number') week.totalSets += addSets;
    injected++;
    notes.push(`✓ ${wp} → ${corrId} в ${targetSession.sessionTag} 3×5 @${Math.round(intensityPct * 100)}%`);
  }
  if (injected > 0) {
    copy.rationale = [...(copy.rationale || []), `Стронг-диагностика: инъецировано ${injected} коррекций (${uniq.join(', ')})`];
  }
  return { plan: copy, injected, skippedBudget, skippedDup, notes };
}

export function computeBudgetSMFallback(level: string): number {
  const map: Record<string, number> = { beginner: 60, intermediate: 85, advanced: 110, enhanced: 135 };
  return map[level] ?? 85;
}
