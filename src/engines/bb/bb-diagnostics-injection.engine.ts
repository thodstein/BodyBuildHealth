/**
 * bb-diagnostics-injection.engine.ts — инъекция ББ-коррекций в план (parity TA).
 * Вставляет по 1 упражнению на слабую зону (гранулярно) в подходящий день.
 * Parity: per-day dedup, weekly Budget cap (sessionLimitsFor), протокол по каталогу.
 */
import type { BBPlan, BBSession, BBExercise } from './bb-builder.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { canonicalMuscle } from './bb-specialization.engine';
import { sessionLimitsFor, computeBBWeeklyBudget, computeBBRecoveryScore } from './bb-volume.engine';
import { isBBJunk } from './bb-builder.engine';
import { isPoolAllowed } from './bb-exercise-levels.engine';
import { isMobilityRestricted } from './bb-mobility.engine';
import { isAxialLoadExercise } from '../exercise-selector.engine';
import { equipmentAllows } from './bb-correction-rank.engine';

const BB_WEAK_CORRECTION: Record<string, string[]> = {
  delt_mid: ['lateral_raise', 'cable_lateral', 'lateral_raise_machine'],
  delt_rear: ['rear_delt_fly', 'rear_delt_machine', 'face_pull_sh'],
  delt_front: ['ohp', 'db_press', 'ohp_seated'],
  chest_upper: ['incline_db', 'incline_bar', 'cable_fly_low'],
  chest_lower: ['dips_chest', 'decline_db', 'decline_bar'],
  chest: ['incline_db', 'bench_db', 'fly_db'],
  back_width: ['pullup', 'pulldown', 'pullup_neutral'],
  back_thickness: ['row_bar', 'row_db', 'seated_row'],
  back: ['pullup', 'row_bar', 'seated_row'],
  quads: ['hack_squat', 'leg_press', 'leg_ext'],
  hamstrings: ['rdl', 'leg_curl', 'leg_curl_seated'],
  glutes: ['hip_thrust', 'cable_kickback', 'hip_abduction_machine'],
  biceps: ['curl_bar', 'curl_db', 'hammer_curl'],
  triceps: ['tricep_pushdown_rope', 'lying_tricep_extension', 'tricep_pushdown_bar'],
  calves: ['calf_raise', 'calf_raise_seated', 'donkey_calf_raise'],
  traps: ['face_pull', 'upright_row'],
  forearms: ['hammer_curl', 'curl_bar'],
  shoulders: ['lateral_raise', 'ohp', 'rear_delt_fly'],
  abs: ['crunch', 'hanging_leg_raise', 'plank'],
};

function findCatalog(idOrName: string) {
  const low = idOrName.toLowerCase();
  return (EXERCISE_CATALOG as any[]).find(e => e.id === idOrName || e.id.toLowerCase() === low || e.name.toLowerCase() === low) || null;
}

/**
 * K3: вес коррекции по workMax профиля — единый источник для карточки хаба и инъекции
 * («показано = вставится»). Приоритет базы: точный максимум упражнения (workMaxByExercise)
 * → максимум мышцы/зоны. Нет базы → null (без выдуманных 32.5 кг — честная пометка в комментарии).
 * bodyweight/band-упражнения — всегда без кг.
 */
export function correctiveWeightHint(
  exerciseId: string,
  workMax: Record<string, number> | undefined | null,
  muscleKeyOrZone: string | null | undefined,
  opts: { loadFactor?: number; bodyweight?: boolean } = {},
): { kg: number | null; bodyweight: boolean; base: number | null; pct: number } {
  const cat = findCatalog(exerciseId);
  const eqRaw = cat ? (cat as any).equipment : null;
  const eq = (Array.isArray(eqRaw) ? eqRaw : [eqRaw]).map((e: unknown) => String(e || '').toLowerCase().trim()).filter(Boolean);
  const bw = opts.bodyweight === true || eq.some((e) => e === 'bodyweight' || e === 'band');
  const f = Number.isFinite(opts.loadFactor) ? Math.max(0.3, Math.min(0.85, opts.loadFactor as number)) : 0.65;
  const pct = Math.round(f * 100);
  if (bw) return { kg: null, bodyweight: true, base: null, pct };
  const wm = workMax || {};
  const idLow = String(exerciseId || '').toLowerCase().trim();
  let base: number | null = null;
  if (idLow) {
    const direct = wm[idLow] ?? wm[exerciseId];
    const v = Number(direct);
    if (Number.isFinite(v) && v > 0) base = v;
  }
  if (base == null && muscleKeyOrZone) {
    const v = Number(wm[muscleKeyOrZone]);
    if (Number.isFinite(v) && v > 0) base = v;
  }
  if (base == null) return { kg: null, bodyweight: false, base: null, pct };
  return { kg: Math.round((base * f) / 2.5) * 2.5, bodyweight: false, base, pct };
}

/** K4: гейты вставки коррекции — те же каноны, что у билдера (уровень/осевая/junk/оборудование/мобильность).
 *  При отказе инъекция берёт следующего кандидата (library top-2/3 → каталожный fallback). */
function gateAttemptCandidate(id: string, allowJunk: boolean, opts: BBInjectionOpts): { ok: boolean; why?: string } {
  const cat = findCatalog(id);
  if (!cat) return { ok: false, why: 'нет в каталоге' };
  if (!isPoolAllowed(opts.level, cat)) return { ok: false, why: 'уровень' };
  if (opts.avoidAxialLoad && isAxialLoadExercise(cat)) return { ok: false, why: 'осевая' };
  if (!allowJunk && isBBJunk(cat)) return { ok: false, why: 'junk-дрилл' };
  if (!equipmentAllows((cat as any).equipment, opts.equipment, { machineAlways: false })) return { ok: false, why: 'оборудование' };
  if (isMobilityRestricted(cat, opts.mobilityRestrictions)) return { ok: false, why: 'мобильность' };
  return { ok: true };
}

function sessionForInjection(week: any, muscle: string): BBSession | null {
  const can = canonicalMuscle(muscle);
  for (const s of week.sessions as BBSession[]) {
    if ((s.exercises || []).some(e => canonicalMuscle(e.muscle) === can)) return s;
  }
  return (week.sessions as BBSession[])[0] ?? null;
}

export interface BBInjectionOpts {
  dayMap?: Record<string, number[]>;
  budget?: number;
  workMax?: Record<string, number>;
  level?: string;
  /** MAX PRO: целевой объём сетов/нед на зону (из spec-block) */
  targetSets?: Record<string, number>;
  /** MAX PRO: PROF-темп на зону */
  profTempo?: Record<string, string>;
  /** MAX PRO: инъецировать во все недели (по умолчанию только weeks[0]) */
  allWeeks?: boolean;
  /** Инъецировать только в указанные недели (индексы); делод пропускается. Приоритетнее allWeeks. */
  weekIdxs?: number[];
  /** MAX PRO: предпочитаемые id упражнений (из correction-rank топ-1) */
  preferredIds?: Record<string, string>;
  /** PRO-CORR: точная доза/техника коррекций из библиотеки (хаб шлёт, без — legacy 3×10).
   *  K3: + реальная доза — restSec (45–150 из записи), repsMax (окно), loadFactor (вес = фактор × workMax),
   *  bodyweight (без кг, пометка в комментарии). */
  corrective?: Record<string, { sets?: number; reps?: number; repsMax?: number; rir?: number; tempo?: string; restSec?: number; bodyweight?: boolean; loadFactor?: number; label?: string }>;
  /** PRO-3 R2: унилатеральная добивка слабой стороны (из L/R-вердиктов): группа → сторона+сеты. */
  unilateralTopUp?: Record<string, { side: 'left' | 'right'; sets: number }>;
  /** PRO-3 R2: сдвиг RIR вставляемых коррекций (красная готовность → +1). */
  rirShift?: number;
  /** PRO-3 R2: множитель объёма вставляемых коррекций (красная готовность → 0.75). */
  volumeMult?: number;
  /** PRO-4 S3: активная ступень возврата (ступень 1 = только техника, объём 0). */
  returnAction?: { volumeMult: number; rirShift: number; bannedPatterns: string[] };
  /** K4: кандидаты на зону (библиотека top-2/3 → каталожный fallback) с дозой и allowlist дриллов. */
  correctiveCandidates?: Record<string, BBAttemptCandidate[]>;
  /** K4: каноны билдера — оборудование зала (machine строго), мобильность, осевая. */
  equipment?: string[];
  mobilityRestrictions?: string[];
  avoidAxialLoad?: boolean;
}

/** K4: кандидат вставки коррекции (доза — своя у каждого кандидата: замена не врёт дозой). */
export interface BBAttemptCandidate {
  exerciseId: string;
  sets?: number;
  reps?: number;
  repsMax?: number;
  rir?: number;
  tempo?: string;
  restSec?: number;
  loadFactor?: number;
  bodyweight?: boolean;
  label?: string;
  /** Библиотечные дриллы (кламшелл, паллоф, wall-slide…) — осознанный allowlist от isBBJunk. */
  allowJunk?: boolean;
}

export interface BBInjectionResult {
  plan: BBPlan;
  injected: number;
  skippedBudget: number;
  skippedDup: number;
  notes: string[];
}

function computeBudgetBB(plan: BBPlan, level?: string): number {
  const snap: any = (plan as any).inputSnapshot || {};
  const lvl = (level || (plan as any).level || snap.level || 'intermediate') as string;
  // Волна-2.11: бюджет инъекции = КАНОН computeBBWeeklyBudget (112 × режим ×
  // recovery × nutrition × lab). Раньше — хардкод 60/85/110/135, из-за которого
  // вставки отклонялись чаще, чем позволяет бюджет плана (хаб и билдер
  // расходились в два раза). Недельный бюджет — мягкий ориентир (не кап).
  const recoveryScore = computeBBRecoveryScore({
    bodyFat: snap.bodyFat,
    leanMass: snap.leanMass,
    hrvMs: snap.hrvMs,
    sleepHours: snap.sleepHours,
    stressLevel: snap.stressLevel,
  });
  const onCourse = snap.courseIntensity != null || lvl === 'enhanced';
  const weekly = computeBBWeeklyBudget({
    onCourse,
    courseIntensity: snap.courseIntensity,
    recoveryScore,
    calorieSurplus: snap.calorieSurplus,
    proteinPerKg: snap.proteinPerKg,
    labMrvMultiplier: snap.labMrvMultiplier,
  });
  if (weekly > 0) return weekly;
  const limits = sessionLimitsFor({ level: lvl } as any);
  return limits.weeklyWorkingSets || 85;
}

export function injectBBWeakPoints(plan: BBPlan, weakZones: string[], opts: BBInjectionOpts = {}): BBInjectionResult {
  if (!weakZones || weakZones.length === 0) return { plan, injected: 0, skippedBudget: 0, skippedDup: 0, notes: [] };
  const copy: BBPlan = JSON.parse(JSON.stringify(plan));
  const budget = opts.budget ?? computeBudgetBB(plan as any, opts.level);
  let injected = 0, skippedBudget = 0, skippedDup = 0;
  const notes: string[] = [];
  const doseLines: string[] = [];
  const uniq = [...new Set(weakZones.map(s => String(s).toLowerCase().trim()).filter(Boolean))].slice(0, 2);

  for (const wp of uniq) {
    const muscleKey = canonicalMuscle(wp);
    const preferred = opts.preferredIds?.[wp] || opts.preferredIds?.[muscleKey];
    const corrList = BB_WEAK_CORRECTION[wp] || BB_WEAK_CORRECTION[muscleKey] || [];
    // K4: сначала кандидаты (библиотека top-2/3 → каталожный fallback) с гейтами билдера;
    // legacy-путь (preferred/дэфолт-пул) — без кандидатов, как раньше.
    const cands = opts.correctiveCandidates?.[wp] || opts.correctiveCandidates?.[muscleKey];
    let corrId: string;
    let picked: BBAttemptCandidate | null = null;
    if (cands && cands.length) {
      const rejected: string[] = [];
      for (const cnd of cands) {
        if (!cnd || !cnd.exerciseId) continue;
        const g = gateAttemptCandidate(cnd.exerciseId, cnd.allowJunk === true, opts);
        if (!g.ok) { rejected.push(`${cnd.exerciseId} (${g.why})`); continue; }
        picked = cnd;
        break;
      }
      corrId = picked?.exerciseId || '';
      if (!corrId) { notes.push(`⊘ ${wp} — все кандидаты отсеяны гейтами: ${rejected.slice(0, 3).join(', ')}`); continue; }
      if (rejected.length) notes.push(`↩ ${wp}: заменено гейтами (${rejected.join(', ')}) → ${corrId}`);
    } else {
      // Legacy-путь (внешний API/preferred): гейты билдера применяются, junk — allowlist
      // (default-пул и preferred не дриллы; новые кандидаты хаба несут allowJunk явно).
      const legacyId = preferred || corrList[0] || '';
      if (legacyId) {
        const g = gateAttemptCandidate(legacyId, true, opts);
        if (g.ok) corrId = legacyId;
        else { notes.push(`⊘ ${wp}: ${legacyId} отсеян (${g.why}) — альтернатив нет`); continue; }
      } else {
        corrId = '';
      }
    }
    if (!corrId) { notes.push(`⚠ ${wp} — нет коррекции`); continue; }
    const cat = findCatalog(corrId);
    const catName = cat ? cat.name : corrId;
    const catId = cat ? cat.id : corrId;
    const catType = cat ? cat.type : 'isolation';
    // PRO-4 S3: ступень возврата — запрет снарядов (токен-матч, не подстрока "жим" в "отжимания")
    const ban = Array.isArray(opts.returnAction?.bannedPatterns) ? opts.returnAction!.bannedPatterns.map((b) => String(b).toLowerCase().trim()).filter(Boolean) : [];
    const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hitBan = ban.length > 0 && ban.some((b) => {
      const re = new RegExp(`\\b${escRe(b)}\\b`, 'i');
      return re.test(corrId) || re.test(catName);
    });
    if (hitBan) { notes.push(`↩ ${wp} → ${catName}: запрещён ступенью возврата — только техника`); continue; }
    const retVol = Number.isFinite(opts.returnAction?.volumeMult as number) ? Math.max(0, Math.min(1, opts.returnAction!.volumeMult)) : 1;
    if (retVol <= 0) { notes.push(`↩ ${wp}: ступень 1 возврата — только техника, без силовых вставок`); continue; }
    const retRir = Number.isFinite(opts.returnAction?.rirShift as number) ? Math.max(0, Math.min(3, Math.round(opts.returnAction!.rirShift))) : 0;
    // Недели: явные weekIdxs > все не-делоадные при allWeeks > только weeks[0]
    const all = (copy.weeks as any[]);
    const weekIdxs = Array.isArray(opts.weekIdxs) && opts.weekIdxs.length
      ? opts.weekIdxs.filter((i) => Number.isInteger(i) && all[i] && !all[i].deload)
      : opts.allWeeks
        ? all.map((w, i) => ({ w, i })).filter(({ w }) => w && !w.deload).map(({ i }) => i)
        : [0].filter((i) => all[i] && !all[i].deload);
    if (weekIdxs.length === 0) { notes.push(`⚠ ${wp} — делод`); continue; }
    // K4: доза — у выбранного кандидата (замена не врёт дозой первого); legacy — из opts.corrective.
    const corr = picked
      ? { sets: picked.sets, reps: picked.reps, repsMax: picked.repsMax, rir: picked.rir, tempo: picked.tempo, restSec: picked.restSec, loadFactor: picked.loadFactor, bodyweight: picked.bodyweight, label: picked.label }
      : (opts.corrective?.[wp] || opts.corrective?.[muscleKey]);
    const wm = opts.workMax ?? (copy as any).workMax ?? (copy as any).inputSnapshot?.workMax ?? {};
    // K3: вес от workMax профиля (точный id упражнения → мышца), bodyweight/band — без кг;
    // нет базы — без выдуманных кг + честная пометка (раньше всегда 32.5 кг).
    const hint = correctiveWeightHint(corrId, wm, muscleKey, { loadFactor: corr?.loadFactor, bodyweight: corr?.bodyweight });
    const weight = hint.kg ?? 0;
    const reps = Number.isFinite(corr?.reps) ? Math.max(3, Math.min(20, Math.round(corr!.reps as number))) : (muscleKey === 'calves' ? 15 : muscleKey === 'forearms' ? 12 : 10);
    const repsMax = Number.isFinite(corr?.repsMax) ? Math.max(reps, Math.min(25, Math.round(corr!.repsMax as number))) : reps + 2;
    // PRO-3 R2: готовность дня двигает вставку (острая, не мезоцикл): RIR+1 / объём −25%
    // PRO-4 S3: ступень возврата добавляется поверх (ступень 2: ×0.5 / RIR+3)
    // PRO-CORR: библиотека задаёт базу дозы; готовность/возврат — поверх неё.
    // K3: база записи 0–4 (RIR3-записи реагируют на сдвиг), общий кламп 0–4.
    const corrRir = Number.isFinite(corr?.rir) ? Math.max(0, Math.min(4, Math.round(corr!.rir as number))) : 2;
    const shiftRir = Number.isFinite(opts.rirShift as number) ? Math.max(0, Math.min(2, Math.round(opts.rirShift as number))) : 0;
    const rir = Math.max(0, Math.min(4, corrRir + shiftRir + retRir));
    const tempo = (corr?.tempo && String(corr.tempo).trim()) || opts.profTempo?.[wp] || opts.profTempo?.[muscleKey] || '3-1-1-0';
    const rest = Number.isFinite(corr?.restSec) ? Math.max(30, Math.min(300, Math.round(corr!.restSec as number))) : 90;
    const loadText = hint.kg != null ? `@${hint.pct}% ≈${hint.kg}кг` : hint.bodyweight ? 'без кг (вес тела)' : 'вес по факту (workMax не задан)';
    const wantBase = Number.isFinite(corr?.sets)
      ? Math.max(1, Math.min(6, Math.round(corr!.sets as number)))
      : Math.max(2, Math.min(6, Math.round(opts.targetSets?.[wp] ?? opts.targetSets?.[muscleKey] ?? 3)));
    const volMult = Number.isFinite(opts.volumeMult as number) ? Math.max(0.5, Math.min(1, opts.volumeMult as number)) : 1;
    let wantSets = Math.max(1, Math.round(wantBase * volMult * retVol));
    // PRO-3 R2: добивка слабой стороны — сверху в пределах бюджета (унилатерально, слабая первой)
    const topUp = opts.unilateralTopUp?.[wp] || opts.unilateralTopUp?.[muscleKey];
    const topUpSets = topUp && (topUp.side === 'left' || topUp.side === 'right') && Number.isFinite(topUp.sets)
      ? Math.max(0, Math.min(3, Math.round(topUp.sets)))
      : 0;
    if (topUpSets > 0) wantSets = Math.min(6, wantSets + topUpSets);
    for (const wi of weekIdxs) {
      const week = (copy.weeks as any[])[wi] as any;
      const configuredDays = opts.dayMap?.[wp] || opts.dayMap?.[muscleKey];
      let targetSession: BBSession | null = null;
      if (configuredDays && configuredDays.length) {
        const dayIdx = configuredDays[0] - 1;
        targetSession = (week.sessions as BBSession[])[dayIdx] ?? null;
      }
      if (!targetSession) targetSession = sessionForInjection(week, wp);
      if (!targetSession) { notes.push(`⚠ ${wp} — нед ${wi + 1}: нет сессии`); continue; }
      const already = (targetSession.exercises || []).some(e => {
        const n = String(e.exerciseName || e.name || '').toLowerCase();
        const id = String((e as any).exerciseName || '').toLowerCase();
        const low = corrId.toLowerCase();
        const catNameLow = String(catName || '').toLowerCase();
        return n === low || n === catNameLow || id === low || id === catId.toLowerCase();
      });
      if (already) { skippedDup++; continue; }

      const weeklySets = (week as any).sessions.reduce((a: number, s: any) => a + (s.exercises || []).reduce((aa: number, e: any) => aa + (e.sets || 0), 0), 0);
      const addSets = wantSets;
      if (weeklySets + addSets > budget) { skippedBudget++; notes.push(`⊘ ${wp} нед ${wi + 1} → ${catName} превысит Budget ${budget} (сейчас ${weeklySets}+${addSets})`); continue; }

      const ex: BBExercise = {
        muscle: muscleKey,
        name: catName,
        role: 'accessory' as const,
        character: 'pump' as any,
        sets: addSets,
        repsRange: [reps, repsMax] as [number, number],
        rir,
        workSets: Array.from({ length: addSets }, () => ({ reps, rir, weight, tempo, restSeconds: rest } as any)),
        exerciseName: catId,
        exerciseType: catType,
        tempoSpec: tempo,
        restSeconds: rest,
        comment: `🩺 ББ-диагностика: ${wp} → ${catName} ${addSets}×${reps}${repsMax > reps ? `–${repsMax}` : ''} ${loadText} RIR${rir} ${tempo} · отдых ${rest}с${corr?.label ? ` · ${corr.label}` : ''}${topUpSets > 0 && topUp ? ` · слабая ${topUp.side === 'left' ? 'левая' : 'правая'} первой +${topUpSets}` : ''}${volMult < 1 ? ' · объём срезан готовностью' : ''}${retVol < 1 ? ' · возврат: объём срезан' : ''}${retRir > 0 ? ` · возврат RIR+${retRir}` : ''}`,
        warmupSets: [],
      } as any;
      targetSession.exercises.push(ex);
      if (typeof week.totalSets === 'number') week.totalSets += addSets;
      injected++;
      doseLines.push(`${wp}: ${catName} ${addSets}×${reps}${repsMax > reps ? `–${repsMax}` : ''} ${loadText} RIR${rir} · отдых ${rest}с`);
      if (!opts.allWeeks) notes.push(`✓ ${wp} → ${catName} в день ${targetSession.day} ${addSets}×${reps} ${loadText} RIR${rir} · отдых ${rest}с`);
    }
    if (opts.allWeeks) notes.push(`✓ ${wp} → ${catName} в ${weekIdxs.length} нед по ${wantSets} сетов (${tempo})`);
  }

  if (injected > 0) {
    // K3: в rationale — фактическая доза (вес/отдых/повторы/RIR), а не только факт вставки.
    copy.rationale = [
      ...(copy.rationale || []),
      `ББ-диагностика: инъецировано ${injected} коррекций (${uniq.join(', ')})`,
      ...doseLines.slice(0, 4).map((l) => `🩺 ${l}`),
    ];
  }
  return { plan: copy, injected, skippedBudget, skippedDup, notes };
}

export function computeBudgetBBFallback(level: string): number {
  return computeBudgetBB({ weeks: [] } as any, level);
}

/** Снапшот плана для журнала откатов (план хранится целиком — неделя обычно ~2-5 КБ). */
export interface PlanSnapshot {
  date: string; // ISO
  label: string; // напр. «до инъекции chest_upper»
  plan: unknown;
}

export const MAX_PLAN_SNAPSHOTS = 5;

/** Добавить снапшот в журнал (новые в конец, кап N последних, битые записи чистятся). */
export function pushPlanSnapshot(
  history: PlanSnapshot[] | null | undefined,
  entry: PlanSnapshot,
  cap = MAX_PLAN_SNAPSHOTS,
): PlanSnapshot[] {
  const list = Array.isArray(history)
    ? history.filter((s) => s && typeof s.date === 'string' && s.plan && typeof s.plan === 'object')
    : [];
  if (!entry || !entry.plan || typeof entry.plan !== 'object') return list;
  const next = [...list, { date: String(entry.date || ''), label: String(entry.label || ''), plan: entry.plan }];
  return next.slice(-Math.max(1, Math.round(cap)));
}

/** Прочитать журнал из сырого значения хранилища (терпит битые данные). */
export function readPlanHistory(raw: unknown): PlanSnapshot[] {
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter((s) => s && typeof s.date === 'string' && s.plan && typeof s.plan === 'object')
    .map((s) => ({ date: String(s.date), label: String(s.label || ''), plan: s.plan }));
}
