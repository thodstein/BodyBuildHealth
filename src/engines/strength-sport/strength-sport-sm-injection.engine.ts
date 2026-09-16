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
import { libraryEntryForSM, protocolForSMPreferred, type SMCorrective } from './strength-sport-sm-corrective.engine';
import { SM_FALLBACK_BY_WP } from './strength-sport-sm-correction-rank.engine';
import '../../core/exercise-catalog-ta-supplement';

const KNOWN_SM_CORR_IDS = new Set(Object.values(SM_FALLBACK_BY_WP));

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
  /** ⭐ из Коррекции хаба: фаза → библиотечный id (sm_*). Валидируется по фазе. */
  preferredCorr?: Record<string, string>;
  /** Дозы карточек: фаза → {sets, reps, pct} (buildSMSpecProtocols). */
  protocols?: Record<string, { sets: number; reps: number | string; pct: number }>;
  /** Недели вставки (индексы weeksData). Дефолт [0] — поведение 1-в-1 как раньше. */
  weekIdxs?: number[];
  /** L/R-добивка слабой стороны: фаза → 'left' | 'right' (+1 сет, честная пометка). */
  unilateralBoost?: Record<string, string>;
  /** Понедельные сеты волны: weekIdx → фаза → сеты (fallback — доза карточки). */
  targetSetsByWeek?: Record<number, Record<string, number>>;
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
      // fallback на фазу (канон): извлечённый id обязан быть известным,
      // иначе в план вшивался мусор ('Yoke'/'tacky'/'Prowler' — первое слово строки).
      if (!corrId || corrId.length < 2 || /[А-Яа-я]/.test(corrId) || !KNOWN_SM_CORR_IDS.has(corrId)) {
        corrId = SM_FALLBACK_BY_WP[wp] || corrId;
      }
      // if still cyrillic, fallback
      if (!corrId || /[А-Яа-я]/.test(corrId)) corrId = 'farmers_walk_heavy';
    }
    if (!corrId) { notes.push(`⚠ ${wp} — нет коррекции`); continue; }
    // ⭐ из Коррекции (библиотечный id): честная вставка — реальное id + доза карточки
    // (паритет TA-C8: имя из библиотеки, чужой id → legacy fallback, не молчаливая подмена).
    const prefRaw: string | undefined = opts.preferredCorr?.[wp];
    const libEntry: SMCorrective | null = prefRaw ? libraryEntryForSM(prefRaw) : null;
    const libValid: SMCorrective | null = libEntry && libEntry.phase === wp ? libEntry : null;
    const libProto = libValid ? protocolForSMPreferred(wp, prefRaw, null) : null;
    const cardProto = libValid ? opts.protocols?.[wp] ?? null : null;
    let intensityPct: number = bio?.intensityPct ?? 0.65;
    let addSets = 3;
    let exReps: number | string | null = null;
    let exName: string | null = null;
    let starMark = '';
    if (libValid && libProto) {
      corrId = libProto.exId;
      intensityPct = (cardProto?.pct ?? libProto.pct) / 100;
      addSets = cardProto?.sets ?? libProto.sets;
      exReps = cardProto?.reps ?? libProto.reps;
      exName = libValid.target;
      starMark = ` (⭐ ${libValid.id})`;
    }
    const weekIdxs = Array.isArray(opts.weekIdxs) && opts.weekIdxs.length
      ? opts.weekIdxs.filter((wi) => Number.isInteger(wi) && wi >= 0)
      : [0];
    const multiWeek = weekIdxs.length > 1;
    // L/R-добивка: +1 сет слабой стороне (хаб шлёт только grip-фазы при асимметрии ≥7%).
    const uniSide = opts.unilateralBoost?.[wp];
    const uni = uniSide === 'left' || uniSide === 'right' ? uniSide : null;
    const uniMark = uni ? ` +1 слаб. ${uni === 'left' ? 'слева' : 'справа'}` : '';
    const weekAddSets = addSets + (uni ? 1 : 0);
    for (const wi of weekIdxs) {
    // Волна: понедельные сеты перекрывают дозу карточки (fallback — доза карточки).
    const waveRaw = opts.targetSetsByWeek?.[wi]?.[wp];
    const waveSets = typeof waveRaw === 'number' && Number.isFinite(waveRaw) ? Math.max(1, Math.min(10, Math.round(waveRaw))) : null;
    const useSets = (waveSets ?? weekAddSets) + (waveSets != null && uni ? 1 : 0);
    const week = copy.weeksData[wi];
    if (!week || week.deload) { notes.push(`⚠ ${wp} — делод, пропуск${multiWeek ? ` (нед ${wi + 1})` : ''}`); continue; }
    const configuredDays = opts.dayMap?.[wp];
    let targetSession: StrengthSportSession | null = null;
    if (configuredDays && configuredDays.length) {
      const dayIdx = configuredDays[0] - 1;
      targetSession = week.sessions[dayIdx] ?? null;
    }
    if (!targetSession) targetSession = sessionForSMInjection(week, wp);
    if (!targetSession) { notes.push(`⚠ ${wp} — нет сессии${multiWeek ? ` (нед ${wi + 1})` : ''}`); continue; }
    if (targetSession.exercises.some(e => e.id === corrId || e.id.toLowerCase() === corrId.toLowerCase())) {
      skippedDup++; notes.push(`⊘ ${wp} → ${corrId} уже есть в ${targetSession.sessionTag}${multiWeek ? ` (нед ${wi + 1})` : ''}`); continue;
    }
    const weeklySets = week.sessions.reduce((a: number, s: any) => a + s.exercises.reduce((aa: number, e: any) => aa + (e.sets || 0), 0), 0);
    if (weeklySets + useSets > budget) {
      skippedBudget++; notes.push(`⊘ ${wp} → ${corrId} превысит Budget ${budget} (сейчас ${weeklySets}+${useSets})${multiWeek ? ` (нед ${wi + 1})` : ''}`); continue;
    }
    const wm = opts.workMax ?? (copy as any).workMax ?? (copy as any).inputSnapshot?.workMax ?? {};
    const basePm = basePmForSM(corrId, wm);
    const weight = Math.round(basePm * intensityPct / 2.5) * 2.5;
    const libTempo = libValid && libProto ? libValid.protocol.tempo : null;
    const libRest = libValid && libProto ? libValid.protocol.restSeconds : null;
    const libDist = libValid && libProto ? libValid.protocol.distanceM : null;
    const rir = libProto && starMark ? libProto.rir : 2;
    const tempo = libTempo ?? (corrId.includes('squat') ? '3-1-1-0' : corrId.includes('walk') || corrId.includes('carry') ? 'brace 2с — walk' : '2-0-1-0');
    const rest = libRest ?? (corrId.includes('carry') || corrId.includes('walk') ? 180 : 120);
    const distM = libDist ?? (corrId.includes('carry') ? 20 : undefined);
    const finalReps: number | string = exReps ?? (corrId.includes('carry') || corrId.includes('walk') ? '20м' : '5');
    const ex: StrengthSportExercise = {
      id: corrId,
      name: exName ?? bio?.corrections?.[0] ?? corrId,
      group: corrId.includes('carry') || corrId.includes('walk') ? 'back' : corrId.includes('plank') ? 'core' : 'legs',
      pattern: corrId.includes('carry') || corrId.includes('walk') ? 'carry' : corrId.includes('squat') ? 'squat' : 'hinge',
      sets: useSets,
      reps: finalReps,
      rir,
      tempo,
      restSeconds: rest,
      weight,
      workSets: Array.from({ length: useSets }, () => ({ reps: typeof finalReps === 'number' ? finalReps : (corrId.includes('carry') ? 1 : 5), rir, weight, pct: Math.round(intensityPct * 100), tempo, restSeconds: rest, distanceM: distM } as any)),
      warmupSets: [],
    } as any;
    targetSession.exercises.push(ex);
    if (typeof week.totalSets === 'number') week.totalSets += useSets;
    injected++;
    notes.push(`✓ ${wp} → ${corrId}${starMark} в ${targetSession.sessionTag} ${useSets}×${finalReps} @${Math.round(intensityPct * 100)}%${uniMark}${multiWeek ? ` (нед ${wi + 1})` : ''}`);
    }
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

/** Снапшот плана для undo инъекции (SM PRO: parity с TA snapshotTAPlanForInject). */
export function snapshotSMPlanForInject(plan: StrengthSportPlan): StrengthSportPlan {
  return JSON.parse(JSON.stringify(plan)) as StrengthSportPlan;
}

/** Откат инъекции к снапшоту (возвращает копию снапшота). */
export function rollbackSMPlanInject(snapshot: StrengthSportPlan): StrengthSportPlan {
  return JSON.parse(JSON.stringify(snapshot)) as StrengthSportPlan;
}

/** Есть ли сохранённый снапшот в sessionStorage (ключ хаба). */
export const SM_INJECT_PREV_KEY = 'he_sm_inject_prev_v1';

export function hasSMPlanPrev(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SM_INJECT_PREV_KEY) != null;
  } catch {
    return false;
  }
}

/**
 * Инъекция с предпочитаемой коррекцией на фазу (preferredCorr — библиотечные sm_* id
 * из Коррекции хаба; доза — из opts.protocols или канона записи).
 * Честная вставка (паритет TA-C8): было — заглушка с пометкой «выбери вручную».
 */
export function injectSMWeakPointsPreferred(
  plan: StrengthSportPlan,
  weakPoints: SMWeakPoint[],
  opts: SMInjectionOpts & { preferredCorr?: Record<string, string> } = {},
): SMInjectionResult {
  return injectSMWeakPoints(plan, weakPoints, opts);
}
