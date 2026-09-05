/**
 * bb-quality-weekly.engine.ts — понедельная оценка качества ББ-плана.
 *
 * Принципы (фикс «0–13 из 100» и выдуманных норм):
 *  - НИКАКИХ своих порогов: факт недели сверяется с собственными целями плана
 *    (volumeTargets), фактическими капами (mrvByMuscle) и параметрами пользователя
 *    (inputSnapshot + план-поля). Нет данных — нет штрафа.
 *  - ДВЕ ОТДЕЛЬНЫЕ шкалы, не суммируются:
 *    A «Объём и соответствие» — факт объёма недели vs цели/капы/параметры;
 *    B «PRO-техника» — факт исполнения недели (паттерны/углы/растяжка/техники).
 *  - Понедельно + среднее: каждая неделя оценивается по правилам СВОЕЙ фазы
 *    (рабочая / делод / taper-peak / спец-блок / щадящий режим); среднее —
 *    среднее арифметическое понедельных скоров.
 *  - Допуски — как у родного валидатора (bb-validator): дефицит только при
 *    effective < 70% MEV, перебор только при effective > 115% капа.
 *  - Поддержание (MEV), щадящий режим, донорская нагрузка, делод/taper —
 *    режимы «по дизайну», а не нарушения.
 *
 * Чистый движок: без UI и storage.
 */
import type { BBPlan } from './bb-builder.engine';
import { BB_MRV_TOLERANCE } from './bb-validator.engine';
import { getVolumeLandmarks, MUSCLE_LABEL_RU } from '../volume-landmarks.engine';
import {
  normalizeBBMuscle,
  aggregateBBVolume,
  computeMuscleBalance,
  sessionLimitsFor,
} from './bb-volume.engine';
import {
  canonicalMuscle,
  specResForWeekSchedule,
  tradeoffForWeek,
  expandDonorMuscles,
  isSpecializationWeak,
  isSpecializationFocus,
} from './bb-specialization.engine';
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';
import { derivePattern } from '../movement-pattern';
import { resolveCatalogId } from '../../data/lms-cycles/exercise-alias-map';

// ─── Типы ───

export type BBQualityWeeklySeverity = 'error' | 'warning' | 'info';

export interface BBQualityWeeklyIssue {
  week: number;
  muscle?: string;
  severity: BBQualityWeeklySeverity;
  code: string;
  message: string;
  /** Откуда взялось ожидание: «цель плана 12», «кап плана 28», «параметр: щадящий режим», «делод»… */
  source: string;
  fact?: number;
  expected?: number;
}

export type BBWeeklyMuscleStatus = 'ok' | 'by_design' | 'low' | 'high' | 'over' | 'skipped';

export interface BBWeeklyMuscleRow {
  muscle: string;
  label: string;
  directSets: number;
  effectiveSets: number;
  targetSets: number;
  mev: number;
  mav: number;
  mrv: number;
  frequency: number;
  targetFrequency: number;
  status: BBWeeklyMuscleStatus;
  /** Человекочитаемая пометка режима: «цель блока», «поддержание», «щадящий», «донор», «делод»… */
  note: string;
}

export interface BBVolumeWeekScore {
  week: number;
  phase: string;
  isDeload: boolean;
  isTaper: boolean;
  score: number;
  grade: string;
  issues: BBQualityWeeklyIssue[];
  muscles: BBWeeklyMuscleRow[];
  balance: string[];
  recommendations: string[];
}

export interface BBProPatternRow {
  muscle: string;
  patterns: string[];
  expected: string[];
  distinct: number;
  ok: boolean;
  issue?: string;
}

export interface BBProAngleRow {
  muscle: string;
  angles: string[];
  expected: string[];
  coverage: number;
  ok: boolean;
  issue?: string;
}

export interface BBProStretchRow {
  muscle: string;
  hasStretch: boolean;
  stretchExercises: string[];
  ok: boolean;
}

export interface BBProWeekScore {
  /** 'week:N' или 'meso' (агрегат рабочих недель для вида «Среднее»). */
  scope: string;
  score: number;
  grade: string;
  patterns: BBProPatternRow[];
  angles: BBProAngleRow[];
  stretches: BBProStretchRow[];
  technique: { totalBlocks: number; withTechnique: number; pct: number; distinct: string[]; ok: boolean; issue?: string };
  goalAlignment: { goal: string; ok: boolean; issue?: string; recommendation?: string };
  totalIssues: string[];
  totalRecommendations: string[];
}

export interface BBWeekScorePair {
  week: number;
  phase: string;
  volume: number;
  pro: number;
}

export interface BBAverageQuality {
  weeks: number;
  workingWeeks: number;
  avgVolume: number;
  avgPro: number;
  perWeek: BBWeekScorePair[];
  /** Средние строки по рабочим неделям (для вида «Среднее» и экспорта). */
  avgMuscles: BBWeeklyMuscleRow[];
  /** Повторяющиеся проблемы объёма (код+мышца в ≥50% рабочих недель, error — всегда). */
  recurringVolumeIssues: BBQualityWeeklyIssue[];
}

// ─── Шкала ───

export function gradeFor(score: number): string {
  if (score >= 85) return '🟢 Отлично';
  if (score >= 65) return '🟡 Хорошо';
  if (score >= 45) return '🟠 Средне';
  return '🔴 Слабо';
}

export function muscleRu(m: string): string {
  return MUSCLE_LABEL_RU[m] || m;
}

// ─── Внутренние хелперы ───

type PlanLike = BBPlan & {
  goal?: string;
  trainingFocus?: string;
  methodology?: string;
  volumeGoal?: string;
  trainingVolumeMode?: 'standard' | 'high';
  trainingYears?: number;
  level?: string;
};

function snapOf(plan: PlanLike): Record<string, any> {
  const s = (plan as any).inputSnapshot || {};
  return {
    level: (plan as any).level || s.level,
    goal: (plan as any).goal ?? s.goal,
    trainingFocus: (plan as any).trainingFocus ?? s.trainingFocus,
    methodology: (plan as any).methodology ?? s.methodology,
    volumeGoal: (plan as any).volumeGoal ?? s.volumeGoal ?? 'mav',
    trainingVolumeMode: (plan as any).trainingVolumeMode ?? s.trainingVolumeMode ?? 'standard',
    trainingYears: (plan as any).trainingYears ?? s.trainingYears,
    courseIntensity: (plan as any).courseIntensity ?? s.courseIntensity,
    peds: (plan as any).pedAdaptation?.activePEDs ?? s.peds,
    pedDoses: (plan as any).pedAdaptation?.pedDoses ?? s.pedDoses,
    calorieSurplus: s.calorieSurplus,
    proteinPerKg: s.proteinPerKg,
    labMrvMultiplier: s.labMrvMultiplier,
    injuries: s.injuries ?? (plan as any).safetyConstraints?.excludedMuscles?.map((m: string) => ({ muscle: m, exclude: true })),
    equipment: s.equipment ?? (plan as any).safetyConstraints?.equipment,
    autoDeload: s.autoDeload,
    weakPoints: s.weakPoints,
    focusGroup: (plan as any).focusGroup ?? s.focusGroup ?? '',
  };
}

function levelOf(plan: PlanLike): string {
  return (plan as any).level || (plan as any).inputSnapshot?.level || 'intermediate';
}

function weekByNo(plan: PlanLike, weekNo: number): any | undefined {
  const weeks = (plan as any).weeks || [];
  return weeks.find((w: any) => w.week === weekNo) || weeks[weekNo - 1];
}

function weekVolumeOf(plan: PlanLike, week: any): Record<string, { directSets: number; effectiveSets: number; fatigueWeightedSets: number }> {
  const stored = (plan as any).weeklyVolume?.[week.week];
  if (stored) return stored;
  return aggregateBBVolume(week.sessions || []);
}

function isDeloadWeek(week: any): boolean {
  return !!week?.deload || String(week?.phase || '').toLowerCase() === 'deload';
}

function isTaperWeek(week: any): boolean {
  return !!week?.taper || String(week?.phase || '').toLowerCase() === 'peaking';
}

function weekTotalSets(week: any): number {
  return (week?.sessions || []).reduce((a: number, s: any) =>
    a + (s.exercises || []).reduce((b: number, e: any) => b + (Number(e.sets) || 0), 0), 0);
}

function weekMinRir(week: any): number | null {
  const rirs: number[] = [];
  for (const s of week?.sessions || []) for (const e of s.exercises || []) {
    if (Number.isFinite(e.rir)) rirs.push(e.rir);
  }
  return rirs.length ? Math.min(...rirs) : null;
}

/** Наборы исключённых и щадящих мышц (точное + каноническое совпадение). */
function injurySets(plan: PlanLike): { excluded: Set<string>; graded: Set<string> } {
  const excluded = new Set<string>();
  const graded = new Set<string>();
  const snap = snapOf(plan);
  const list = Array.isArray(snap.injuries) ? snap.injuries : [];
  for (const inj of list) {
    const m = inj?.muscle;
    if (!m) continue;
    if (inj.exclude) { excluded.add(m); excluded.add(canonicalMuscle(m)); }
    else { graded.add(m); graded.add(canonicalMuscle(m)); }
  }
  for (const m of ((plan as any).gradedMuscles || []) as string[]) { graded.add(m); graded.add(canonicalMuscle(m)); }
  for (const m of ((plan as any).safetyConstraints?.excludedMuscles || []) as string[]) { excluded.add(m); excluded.add(canonicalMuscle(m)); }
  // Исключение сильнее щадящего: чистим пересечения.
  for (const m of excluded) graded.delete(m);
  return { excluded, graded };
}

function isExcluded(m: string, sets: { excluded: Set<string> }): boolean {
  return sets.excluded.has(m) || sets.excluded.has(canonicalMuscle(m));
}

function isGraded(m: string, sets: { excluded: Set<string>; graded: Set<string> }): boolean {
  if (isExcluded(m, sets)) return false;
  return sets.graded.has(m) || sets.graded.has(canonicalMuscle(m));
}

/** Сколько сессий недели дают мышце ПРЯМЫЕ сеты — той же моделью, что и объём
 *  (aggregateBBVolume: 'shoulders' по имени reklассифицируется в пучки delt_*).
 *  Сырые ключи тегов врут: одна и та же работа в разных сессиях тегируется то
 *  'delt_rear', то 'shoulders' — подсчёт по ключам давал ложную частоту 1×.
 *  Плюс фолбэк: пучку засчитывается неклассифицированный остаток 'shoulders'. */
function sessionsWithMuscle(week: any, muscle: string): number {
  let n = 0;
  for (const s of week?.sessions || []) {
    try {
      const agg = aggregateBBVolume([s]);
      if ((agg[muscle]?.directSets || 0) > 0) { n++; continue; }
      if ((muscle === 'delt_front' || muscle === 'delt_mid' || muscle === 'delt_rear') && (agg['shoulders']?.directSets || 0) > 0) { n++; continue; }
    } catch { /* нет данных — сессия не считается */ }
    const keys = new Set<string>((s.exercises || []).map((e: any) => String(e.muscle || '')));
    if (keys.has(muscle)) { n++; continue; }
    const cm = canonicalMuscle(muscle);
    if (cm === muscle) {
      for (const k of keys) { if (canonicalMuscle(k) === cm) { n++; break; } }
    }
  }
  return n;
}

/** PPL-лифт лимита сессии — паритет с финализатором (bb-finalize: тяжёлый Pull
 *  41 сет задуман, кап 42/46). Без лифта карточка штрафовала то, что
 *  конструктор построил осознанно. isPPL — тот же предикат (id содержит 'ppl'). */
function isPPLPlan(plan: PlanLike): boolean {
  return String((plan as any).pattern?.id || '').toLowerCase().includes('ppl');
}

const SHOULDER_HEADS = ['delt_front', 'delt_mid', 'delt_rear', 'shoulders'];

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

// ─── Шкала A: объём и соответствие ───

const DEFICIT_FLOOR = 0.7; // паритет с bb-validator: дефицит только при effective < 70% MEV

export function scoreVolumeWeek(plan: PlanLike, weekNo: number): BBVolumeWeekScore {
  const week = weekByNo(plan, weekNo);
  const issues: BBQualityWeeklyIssue[] = [];
  const muscles: BBWeeklyMuscleRow[] = [];
  if (!week) {
    return {
      week: weekNo, phase: '—', isDeload: false, isTaper: false, score: 0, grade: gradeFor(0),
      issues: [{ week: weekNo, severity: 'info', code: 'week_missing', message: `Недели ${weekNo} нет в плане`, source: 'факт плана' }],
      muscles, balance: [], recommendations: [],
    };
  }
  const level = levelOf(plan);
  const snap = snapOf(plan);
  const vol = weekVolumeOf(plan, week);
  const targets = ((plan as any).volumeTargets || {}) as Record<string, { muscle: string; frequency: number; mev: number; mav: number; mrv: number; targetSets: number }>;
  const caps = ((plan as any).mrvByMuscle || {}) as Record<string, number>;
  const schedule = (plan as any).specializationSchedule;
  const weekSpec = schedule
    ? specResForWeekSchedule(schedule, week.week)
    : { targets: [] as string[], focus: snap.focusGroup || '', weak: snap.weakPoints || [], active: false };
  const tradeoff = schedule?.active ? tradeoffForWeek(schedule, week.week) : null;
  const donors = tradeoff ? expandDonorMuscles(tradeoff.donorMuscles || []) : [];
  const donorFloorMult = tradeoff && tradeoff.donorFloorMult != null ? tradeoff.donorFloorMult : 1;
  const inj = injurySets(plan);
  const deload = isDeloadWeek(week);
  const taper = !deload && isTaperWeek(week);
  let score = 100;
  const penalize = (sev: BBQualityWeeklySeverity, pts: number, issue: Omit<BBQualityWeeklyIssue, 'week' | 'severity'>) => {
    issues.push({ week: week.week, severity: sev, ...issue });
    if (sev !== 'info') score -= pts;
  };

  const keys = new Set([...Object.keys(vol), ...Object.keys(targets)]);
  for (const m of keys) {
    const fact = vol[m];
    const factDirect = round1(fact?.directSets || 0);
    const factEff = round1(fact?.effectiveSets || 0);
    const t = targets[m];
    const lm = t ? null : getVolumeLandmarks(level, m);
    if (!t && !lm && factDirect === 0 && factEff === 0) continue;
    const mev = t?.mev ?? lm?.mev ?? 0;
    const mav = t?.mav ?? lm?.mav ?? 0;
    const mrv = t?.mrv ?? lm?.mrv ?? 0;
    const cap = caps[m] ?? mrv;
    const targetSets = t?.targetSets ?? (snap.volumeGoal === 'mev' ? mev : snap.volumeGoal === 'mrv' ? mrv : mav);
    const targetFreq = t?.frequency ?? (plan as any).muscleFrequency?.[m] ?? 0;
    const factFreq = sessionsWithMuscle(week, m);
    const isTarget = weekSpec.active
      ? (isSpecializationWeak(m, weekSpec as any) || isSpecializationFocus(m, weekSpec as any))
      : (snap.weakPoints || []).some((w: string) => canonicalMuscle(w) === canonicalMuscle(m));
    const row: BBWeeklyMuscleRow = {
      muscle: m, label: muscleRu(m), directSets: factDirect, effectiveSets: factEff,
      targetSets, mev, mav, mrv: cap || mrv, frequency: factFreq, targetFrequency: targetFreq,
      status: 'ok', note: '',
    };

    // 1. Исключённая травмой мышца: объём > 0 — нарушение параметра пользователя.
    if (isExcluded(m, inj)) {
      if (factDirect > 0 || factEff > 0) {
        row.status = 'over';
        row.note = 'исключение нарушено';
        penalize('error', 12, {
          muscle: m, code: 'excluded_muscle_trained',
          message: `${muscleRu(m)}: исключена травмой (параметр), но в неделе ${factDirect} прямых сетов`,
          source: 'параметр: исключение травмы', fact: factDirect, expected: 0,
        });
      } else {
        row.status = 'skipped';
        row.note = 'исключена (параметр)';
      }
      muscles.push(row);
      continue;
    }

    const graded = isGraded(m, inj);
    const donor = donors.some(d => d === m || canonicalMuscle(d) === canonicalMuscle(m));
    const maintenance = !!(schedule?.active && !isTarget && t);

    // 2. Делод/taper: дефицит не проверяем (режим восстановления/подвода).
    if (deload || taper) {
      row.status = 'by_design';
      row.note = deload ? 'делод (восстановление)' : 'taper/пик (подвод)';
      if (cap > 0 && factEff > cap * BB_MRV_TOLERANCE) {
        row.status = 'over';
        penalize('warning', 6, {
          muscle: m, code: 'effective_mrv_overflow',
          message: `${muscleRu(m)}: effective ${factEff} > капа плана ${cap} даже в ${deload ? 'делод' : 'taper'}`,
          source: `кап плана ${cap} ×${BB_MRV_TOLERANCE}`, fact: factEff, expected: cap,
        });
      }
      muscles.push(row);
      continue;
    }

    // 3. Перебор — всегда нарушение безопасности (кап — собственный кап плана).
    if (cap > 0 && factEff > cap * BB_MRV_TOLERANCE) {
      row.status = 'over';
      row.note = `перебор капа ${cap}`;
      penalize('warning', 6, {
        muscle: m, code: 'effective_mrv_overflow',
        message: `${muscleRu(m)}: effective ${factEff} > кап плана ${cap} (×${BB_MRV_TOLERANCE})`,
        source: `кап плана ${cap}`, fact: factEff, expected: cap,
      });
      muscles.push(row);
      continue;
    }

    // 4. Щадящий режим: жёсткий минимум вдвое ниже, соответствие цели не требуем.
    if (graded) {
      const floor = mev * 0.5;
      if (factDirect === 0 && factEff === 0) {
        row.status = 'by_design';
        row.note = 'щадящий режим — без нагрузки';
        issues.push({ week: week.week, muscle: m, severity: 'info', code: 'graded_no_load', message: `${muscleRu(m)}: щадящий режим, нагрузка пропущена`, source: 'параметр: щадящая травма' });
      } else if (factEff < floor) {
        row.status = 'low';
        row.note = 'ниже щадящего минимума';
        penalize('warning', 4, {
          muscle: m, code: 'graded_below_floor',
          message: `${muscleRu(m)}: ${factEff} eff < щадящего минимума ${round1(floor)} (50% MEV ${mev})`,
          source: `параметр: щадящая травма → минимум ${round1(floor)}`, fact: factEff, expected: round1(floor),
        });
      } else {
        row.status = 'by_design';
        row.note = 'щадящий режим — объём снижен';
      }
      muscles.push(row);
      continue;
    }

    // 5. Поддержание / донор: ожидаем MEV-полку, а не MAV.
    if (maintenance || donor) {
      const floor = mev * (donor ? donorFloorMult : 1) * DEFICIT_FLOOR;
      const kind = donor ? `донор блока (пол ${round1(mev * donorFloorMult)})` : 'поддержание (цель блока — другие мышцы)';
      if (factEff < floor && mev > 0) {
        row.status = 'low';
        row.note = kind;
        penalize('warning', 4, {
          muscle: m, code: donor ? 'donor_below_floor' : 'maintenance_below_mev',
          message: `${muscleRu(m)}: ${factEff} eff < минимума ${round1(floor)} — ${kind}`,
          source: `${donor ? `донорская полка ${round1(mev * donorFloorMult)}` : `MEV ${mev}`} (план)`, fact: factEff, expected: round1(floor),
        });
      } else {
        row.status = 'by_design';
        row.note = kind;
      }
      muscles.push(row);
      continue;
    }

    // 6. Обычная/целевая мышца: минимум MEV и соответствие цели плана.
    if (mev > 0 && factEff < mev * DEFICIT_FLOOR) {
      row.status = 'low';
      row.note = `ниже минимума ${round1(mev * DEFICIT_FLOOR)}`;
      penalize('warning', 6, {
        muscle: m, code: 'below_mev_floor',
        message: `${muscleRu(m)}: ${factEff} eff < 70% MEV (${round1(mev * DEFICIT_FLOOR)} при MEV ${mev})${isTarget ? ' — цель недели недогружена' : ''}`,
        source: `MEV ${mev} (цель плана)`, fact: factEff, expected: round1(mev * DEFICIT_FLOOR),
      });
    } else if (targetSets > 0 && Math.abs(factDirect - targetSets) > Math.max(3, targetSets * 0.3)) {
      row.status = factDirect > targetSets ? 'high' : 'low';
      row.note = `цель плана ${targetSets}`;
      penalize('warning', 2, {
        muscle: m, code: 'off_target',
        message: `${muscleRu(m)}: ${factDirect} прямых vs цель плана ${targetSets}`,
        source: `цель плана ${targetSets}`, fact: factDirect, expected: targetSets,
      });
    } else {
      row.status = 'ok';
      row.note = isTarget ? 'цель недели' : 'в цели плана';
    }

    // 7. Частота — только если цель требует ≥2 и сплит физически позволяет.
    if (targetFreq >= 2 && factFreq < 2 && factDirect > 0) {
      const pattern = (plan as any).pattern;
      const sessionsPerRotation = pattern?.sessionsPerRotation ?? week.sessions.length;
      const allows = sessionsPerRotation >= 4 || week.sessions.length >= 4;
      if (allows) {
        penalize('warning', 3, {
          muscle: m, code: 'low_frequency',
          message: `${muscleRu(m)}: частота ${factFreq}×/нед при цели ${targetFreq}× — сплит позволяет чаще`,
          source: `частота цели ${targetFreq}× (план)`, fact: factFreq, expected: targetFreq,
        });
        row.note += row.note ? ' · частота 1×' : 'частота 1×';
      } else {
        issues.push({ week: week.week, muscle: m, severity: 'info', code: 'frequency_by_split', message: `${muscleRu(m)}: частота ${factFreq}× — предел сплита`, source: `сплит ${pattern?.name || 'текущий'}` });
      }
    }
    muscles.push(row);
  }

  // Плечи суммарно — информация без штрафа (пучки уже проверены по своим целям выше).
  const headFacts = SHOULDER_HEADS.map(h => ({ h, v: vol[h]?.directSets || 0 })).filter(x => x.v > 0);
  if (headFacts.length > 1) {
    const total = round1(headFacts.reduce((a, x) => a + x.v, 0));
    const shLm = getVolumeLandmarks(level, 'shoulders');
    muscles.push({
      muscle: 'shouldersΣ', label: 'Плечи Σ', directSets: total, effectiveSets: total,
      targetSets: 0, mev: shLm?.mev ?? 0, mav: shLm?.mav ?? 0, mrv: caps['shoulders'] ?? shLm?.mrv ?? 0,
      frequency: 0, targetFrequency: 0, status: 'by_design',
      note: `суммарно по пучкам: ${headFacts.map(x => `${x.h} ${x.v}`).join(' + ')}`,
    });
  }

  // Баланс недели — движковым калькулятором (effective).
  const effMap: Record<string, { effectiveSets: number }> = {};
  for (const [k, v] of Object.entries(vol)) effMap[k] = { effectiveSets: v.effectiveSets };
  const balance = computeMuscleBalance(effMap);
  for (const b of balance.issues.slice(0, 2)) {
    penalize('warning', 3, { code: 'muscle_balance', message: b, source: 'баланс недели (факт)' });
  }

  // Лимиты сессии — централизованные (уровень/стаж/курс/режим уже внутри)
  // + PPL-лифт финализатора (паритет: тяжёлый Pull задуман на 41 сет).
  try {
    const limits = sessionLimitsFor({
      level, trainingYears: snap.trainingYears,
      onCourse: !!((snap.peds || []).length > 0 || (plan as any).pedAdaptation),
      peds: snap.peds, courseIntensity: snap.courseIntensity,
      calorieSurplus: snap.calorieSurplus, proteinPerKg: snap.proteinPerKg,
      labMrvMultiplier: snap.labMrvMultiplier, trainingVolumeMode: snap.trainingVolumeMode,
      patternId: (plan as any).pattern?.id,
    } as any, (plan as any).pattern ? { id: (plan as any).pattern.id } as any : undefined);
    const ppl = isPPLPlan(plan);
    const maxSets = ppl ? Math.max(limits.maxWorkingSets, level === 'enhanced' ? 46 : 42) : limits.maxWorkingSets;
    let capped = 0;
    (week.sessions || []).forEach((s: any, idx: number) => {
      if (capped >= 2) return;
      const working = (s.exercises || []).filter((e: any) => !e.warmupActivator && !e.optional);
      const sets = working.reduce((a: number, e: any) => a + (Number(e.sets) || 0), 0);
      if (working.length > limits.maxExercises || sets > maxSets) {
        capped++;
        penalize('warning', 3, {
          code: 'session_cap',
          message: `Сессия ${idx + 1}: ${working.length} упр / ${sets} сетов при лимите ${limits.maxExercises}/${maxSets}`,
          source: `лимит сессии${ppl ? ' PPL (финализатор)' : ' (уровень/стаж/режим)'}`,
        });
      }
    });
  } catch { /* нет данных — нет штрафа */ }

  // Делод/taper-правила (паритет с bb-validator + факт предыдущей недели).
  const prev = weekByNo(plan, week.week - 1);
  const prevDeload = prev ? isDeloadWeek(prev) : false;
  if (deload && prev) {
    const tot = weekTotalSets(week);
    const prevTot = weekTotalSets(prev);
    if (tot > Math.ceil(prevTot * 0.75)) {
      penalize('warning', 4, { code: 'deload_volume_not_reduced', message: `Делод: объём ${tot} не снижен vs ${prevTot} (нужно ≤75%)`, source: 'делод (факт предыдущей недели)', fact: tot, expected: Math.ceil(prevTot * 0.75) });
    }
    const minRir = weekMinRir(week);
    if (minRir != null && minRir < 3) {
      penalize('warning', 3, { code: 'deload_rir_too_low', message: `Делод: минимальный RIR ${minRir} < 3`, source: 'делод (факт)', fact: minRir, expected: 3 });
    }
  }
  // Taper после делода: рост объёма vs разгрузочной недели — возврат к работе
  // по дизайну, а не нарушение (сравнивать не с чем — предыдущая неделя делод).
  if (taper && prev && !prevDeload) {
    const tot = weekTotalSets(week);
    const prevTot = weekTotalSets(prev);
    if (tot > prevTot) {
      penalize('warning', 4, { code: 'taper_volume_increased', message: `Taper/пик: объём ${tot} выше предыдущей недели ${prevTot}`, source: 'taper (факт)', fact: tot, expected: prevTot });
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const recommendations: string[] = [];
  for (const i of issues.filter(x => x.severity !== 'info').slice(0, 5)) {
    recommendations.push(`→ ${i.message} [${i.source}]`);
  }
  return {
    week: week.week, phase: String(week.phase || (week.deload ? 'deload' : 'accumulation')),
    isDeload: deload, isTaper: taper, score, grade: gradeFor(score),
    issues, muscles, balance: balance.issues, recommendations,
  };
}

// ─── Шкала B: PRO-техника по факту недели ───

function normName(s: string): string {
  return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function findCatalogMeta(name: string, id?: string): any | null {
  if (id) {
    const byId = (EXERCISE_CATALOG as any[]).find(e => e.id === id);
    if (byId) return byId;
  }
  try {
    const aliasId = resolveCatalogId(name);
    if (aliasId) {
      const byId = (EXERCISE_CATALOG as any[]).find(e => e.id === aliasId);
      if (byId) return byId;
    }
  } catch { /* без алиасов — дальше по имени */ }
  const n = normName(name);
  let ex = (EXERCISE_CATALOG as any[]).find(e => normName(e.name) === n);
  if (ex) return ex;
  ex = (EXERCISE_CATALOG as any[]).find(e => {
    const en = normName(e.name);
    return en.length > 3 && n.length > 3 && (en.includes(n) || n.includes(en));
  });
  return ex || null;
}

const BB_PATTERN_EXPECT: Record<string, string[]> = {
  chest: ['horizontal_push', 'incline_push', 'dip_push', 'decline_push', 'isolation_chest'],
  back: ['vertical_pull', 'horizontal_pull', 'isolation_back', 'hinge'],
  legs: ['squat', 'hinge', 'lunge', 'isolation_legs_quad', 'isolation_legs_ham', 'glute_squat'],
  shoulders: ['vertical_push', 'isolation_shoulders'],
  arms: ['isolation_arms'],
};

const BB_ANGLE_EXPECT: Record<string, string[]> = {
  chest: ['flat', 'upper', 'lower', 'isolation'],
  back: ['vertical', 'horizontal'],
  legs: ['quad-dominant', 'hip-dominant', 'unilateral'],
  shoulders: ['press', 'isolation'],
};

function patternToAngle(pattern: string, muscle: string): string | null {
  const p = String(pattern || '').toLowerCase();
  if (muscle === 'chest') {
    if (p === 'horizontal_push') return 'flat';
    if (p === 'incline_push') return 'upper';
    if (p === 'dip_push' || p === 'decline_push') return 'lower';
    if (p.includes('isolation')) return 'isolation';
  }
  if (muscle === 'back') {
    if (p === 'vertical_pull') return 'vertical';
    if (p === 'horizontal_pull') return 'horizontal';
  }
  if (muscle === 'legs') {
    if (p === 'squat' || p === 'isolation_legs_quad') return 'quad-dominant';
    if (p === 'hinge' || p === 'isolation_legs_ham' || p === 'glute_squat') return 'hip-dominant';
    if (p === 'lunge') return 'unilateral';
  }
  if (muscle === 'shoulders') {
    if (p === 'vertical_push') return 'press';
    if (p.includes('isolation')) return 'isolation';
  }
  return null;
}

interface ProEx {
  name: string;
  muscle: string;
  pattern: string;
  stretch: boolean;
  stretchNames: string[];
  technique: string;
}

function collectWeekPro(week: any): ProEx[] {
  const out: ProEx[] = [];
  for (const s of week?.sessions || []) {
    for (const e of s.exercises || []) {
      if (e.warmupActivator) continue;
      const meta = findCatalogMeta(e.name || e.exerciseName || '', e.exerciseName);
      let pattern = '';
      try {
        pattern = String(derivePattern({ name: e.name, group: e.muscle, type: (e as any).exerciseType } as any) || '').toLowerCase();
      } catch { pattern = ''; }
      if (!pattern) pattern = String(meta?.movementPattern || '').toLowerCase();
      const ws = Array.isArray(e.workSets) ? e.workSets : [];
      const tech = ws.map((x: any) => String(x?.technique || '').toLowerCase()).find((t: string) => t && t !== 'none') || '';
      const canon = canonicalMuscle(String(e.muscle || ''));
      const group = ['quads', 'hamstrings', 'glutes'].includes(canon) ? 'legs'
        : (canon === 'shoulders' || /^delt_/.test(String(e.muscle || ''))) ? 'shoulders'
        : canon;
      out.push({
        name: e.name || e.exerciseName || '',
        muscle: group,
        pattern,
        stretch: meta?.stretchPhase === true,
        stretchNames: meta?.stretchPhase === true ? [e.name || ''] : [],
        technique: tech,
      });
    }
  }
  return out;
}

export function scoreProWeek(plan: PlanLike, weekNo: number | 'meso'): BBProWeekScore {
  const weeks = (plan as any).weeks || [];
  const scope = weekNo === 'meso' ? 'meso' : `week:${weekNo}`;
  const targetWeeks = weekNo === 'meso'
    ? weeks.filter((w: any) => !isDeloadWeek(w))
    : [weekByNo(plan, weekNo as number)].filter(Boolean);
  const scopeWeeks = targetWeeks.length ? targetWeeks : weeks.slice(0, 1);
  const level = levelOf(plan);
  const snap = snapOf(plan);
  const issues: string[] = [];
  const recs: string[] = [];
  let score = 100;
  const minus = (pts: number, issue: string, rec?: string) => {
    score -= pts;
    issues.push(issue);
    if (rec) recs.push(rec);
  };

  // Фактический объём скоупа для гейта «существенный объём».
  const agg: Record<string, number> = {};
  for (const w of scopeWeeks) {
    const v = weekVolumeOf(plan, w);
    for (const [k, val] of Object.entries(v)) agg[k] = (agg[k] || 0) + (val.directSets || 0);
  }
  const nW = Math.max(1, scopeWeeks.length);
  const avgDirect = (m: string) => (agg[m] || 0) / nW;
  const mevOf = (m: string) => {
    const t = ((plan as any).volumeTargets || {})[m];
    if (t) return t.mev;
    return getVolumeLandmarks(level, m)?.mev ?? 0;
  };

  // Паттерны — только для существенно нагруженных групп скоупа.
  // 'arms' агрегирует бицепс+трицепс (паритет со старым PRO-анализом: per-muscle
  // детали карточки ищут p.muscle==='arms' для рук).
  const patterns: BBProPatternRow[] = [];
  for (const mu of ['chest', 'back', 'legs', 'shoulders', 'arms']) {
    const pool = collectWeekPro({ sessions: scopeWeeks.flatMap((w: any) => w.sessions || []) })
      .filter(e => (mu === 'arms' ? ['biceps', 'triceps', 'arms'].includes(e.muscle) : e.muscle === mu) && e.pattern);
    const distinct = Array.from(new Set(pool.map(e => e.pattern)));
    const expected = BB_PATTERN_EXPECT[mu] || [];
    const substantial = mu === 'legs'
      ? (avgDirect('quads') + avgDirect('hamstrings') + avgDirect('glutes')) >= mevOf('quads')
      : avgDirect(mu === 'shoulders' ? 'delt_mid' : mu) >= 0 || pool.length > 0;
    const need = mu === 'chest' || mu === 'back' || mu === 'legs' ? 2 : 1;
    const ok = !substantial || distinct.length >= need || (mu === 'shoulders' && distinct.length >= 1);
    let issue: string | undefined;
    if (!ok && distinct.length > 0) {
      issue = `${mu}: паттернов ${distinct.length} < ${need} (факт: ${distinct.join(', ')})`;
      minus(4, `🔀 Паттерн ${mu}: ${distinct.length} < ${need} — факт недели`, `➕ ${mu}: добавьте ${expected.find(p => !distinct.includes(p)) || 'вариацию'}`);
    }
    patterns.push({ muscle: mu, patterns: distinct, expected, distinct: distinct.length, ok, issue });
  }

  // Углы — покрытие ≥50% при существенном объёме.
  const angles: BBProAngleRow[] = [];
  for (const mu of ['chest', 'back', 'legs', 'shoulders']) {
    const pool = collectWeekPro({ sessions: scopeWeeks.flatMap((w: any) => w.sessions || []) }).filter(e => e.muscle === mu);
    const angs = pool.map(e => patternToAngle(e.pattern, mu)).filter(Boolean) as string[];
    const distinctAngles = Array.from(new Set(angs));
    const expected = BB_ANGLE_EXPECT[mu] || [];
    const coverage = expected.length ? distinctAngles.length / expected.length : 1;
    const substantial = pool.length >= 2;
    const ok = !substantial || coverage >= 0.5;
    let issue: string | undefined;
    if (!ok && distinctAngles.length > 0) {
      issue = `${mu}: углов ${distinctAngles.length}/${expected.length} (факт)`;
      minus(3, `📐 Углы ${mu}: ${distinctAngles.length}/${expected.length} — факт недели`, `➕ ${mu}: добавьте угол ${expected.find(a => !distinctAngles.includes(a))}`);
    }
    angles.push({ muscle: mu, angles: distinctAngles, expected, coverage, ok, issue });
  }

  // Растяжка — требуем только для целей недели/скоупа с высоким объёмом и доступным пулом.
  const stretches: BBProStretchRow[] = [];
  const schedule = (plan as any).specializationSchedule;
  const scopeTargets = new Set<string>();
  if (schedule?.active) {
    for (const w of scopeWeeks) {
      for (const t of specResForWeekSchedule(schedule, w.week).targets) scopeTargets.add(canonicalMuscle(t));
      const f = (schedule as any).focus;
      if (f) scopeTargets.add(canonicalMuscle(f));
    }
  }
  const eq = snap.equipment;
  const poolLimited = Array.isArray(eq) && eq.length > 0 && !eq.some((e: string) => /cable|machine|barbell/i.test(String(e)));
  const allEx = collectWeekPro({ sessions: scopeWeeks.flatMap((w: any) => w.sessions || []) });
  for (const mu of ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps']) {
    const canon = mu === 'shoulders' ? 'shoulders' : canonicalMuscle(mu);
    const groupEx = allEx.filter(e => e.muscle === (['quads', 'hamstrings', 'glutes'].includes(mu) ? 'legs' : mu === 'shoulders' ? 'shoulders' : canon));
    if (groupEx.length === 0) continue;
    const stretchEx = groupEx.filter(e => e.stretch).map(e => e.name);
    const hasStretch = stretchEx.length > 0;
    const isTarget = scopeTargets.size === 0 || scopeTargets.has(canon) || (mu === 'shoulders' && scopeTargets.has('shoulders'));
    const highVol = groupEx.length >= 2;
    const ok = hasStretch || !isTarget || !highVol || poolLimited;
    if (!ok) {
      minus(3, `🧘 Растяжка ${mu}: нет stretch-фазы при высоком объёме цели — факт недели`, `➕ ${mu}: добавьте движение с растяжением`);
    }
    stretches.push({ muscle: mu, hasStretch, stretchExercises: stretchEx, ok });
  }

  // Техники — по факту workSets, с учётом уровня.
  const withTech = allEx.filter(e => e.technique).length;
  const pct = allEx.length ? Math.round((withTech / allEx.length) * 100) : 0;
  const distinctTech = Array.from(new Set(allEx.map(e => e.technique).filter(Boolean)));
  const lvl = String(level).toLowerCase();
  const isAdvanced = lvl === 'advanced' || lvl === 'enhanced';
  let techOk = true;
  let techIssue: string | undefined;
  if (isAdvanced && pct === 0 && allEx.length >= 6) {
    techOk = false;
    techIssue = 'Нет техник интенсификации для продвинутого (факт недели)';
    minus(3, '⚡ Техника: 0% для продвинутого — факт', '➕ Добавьте myo/dropset/rest-pause на 10–20% блоков');
  } else if (pct > 40) {
    techOk = false;
    techIssue = `Перебор техник ${pct}% (>40%) — факт`;
    minus(4, `⚡ Техника: ${pct}% — перебор (факт)`, '➖ Снизьте долю техник до 15–30%');
  } else if (pct > 30) {
    techOk = false;
    techIssue = `Много техник ${pct}% — факт`;
    minus(2, `⚡ Техника: ${pct}% — много (факт)`, undefined);
  }

  // Цель ↔ фокус — единственная проверка цели (как у родного валидатора, без коридоров %MRV).
  const goal = snap.goal;
  const focus = snap.trainingFocus;
  const totalWeeks = weeks.length;
  let goalOk = true;
  let goalIssue: string | undefined;
  let goalRec: string | undefined;
  if (goal === 'strength_mass' && focus && focus !== 'strength') {
    goalOk = false;
    goalIssue = `Цель strength_mass + фокус ${focus} (факт параметров) — для силы нужны низкие повторы`;
    goalRec = 'Смените фокус на «сила» или цель на mass';
    minus(3, `🎯 ${goalIssue}`, `→ ${goalRec}`);
  } else if (goal === 'cut' && focus === 'strength' && totalWeeks > 6) {
    goalOk = false;
    goalIssue = `Сушка + силовой фокус на ${totalWeeks} нед (факт параметров) — риск потери мышц`;
    goalRec = 'Смените фокус на hypertrophy для дефицита';
    minus(3, `🎯 ${goalIssue}`, `→ ${goalRec}`);
  } else {
    goalRec = 'Цель и фокус согласованы (факт параметров)';
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    scope, score, grade: gradeFor(score), patterns, angles, stretches,
    technique: { totalBlocks: allEx.length, withTechnique: withTech, pct, distinct: distinctTech, ok: techOk, issue: techIssue },
    goalAlignment: { goal: String(goal || 'mass'), ok: goalOk, issue: goalIssue, recommendation: goalRec },
    totalIssues: issues, totalRecommendations: recs,
  };
}

// ─── Среднее ───

export function averageWeeklyScores(plan: PlanLike): BBAverageQuality {
  const weeks = (plan as any).weeks || [];
  const perWeek: BBWeekScorePair[] = weeks.map((w: any) => ({
    week: w.week,
    phase: String(w.phase || (w.deload ? 'deload' : 'accumulation')),
    volume: scoreVolumeWeek(plan, w.week).score,
    pro: scoreProWeek(plan, w.week).score,
  }));
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const working = weeks.filter((w: any) => !isDeloadWeek(w) && !isTaperWeek(w));
  const basis = working.length ? working : weeks;

  // Средние строки по рабочим неделям (вид «Среднее», экспорт).
  const targets = ((plan as any).volumeTargets || {}) as Record<string, { mev: number; mav: number; mrv: number; targetSets: number; frequency: number }>;
  const caps = ((plan as any).mrvByMuscle || {}) as Record<string, number>;
  const keys = new Set<string>();
  for (const w of basis) {
    const v = weekVolumeOf(plan, w);
    for (const k of Object.keys(v)) keys.add(k);
  }
  for (const k of Object.keys(targets)) keys.add(k);
  const avgMuscles: BBWeeklyMuscleRow[] = [];
  for (const m of keys) {
    let d = 0;
    let e = 0;
    let f = 0;
    for (const w of basis) {
      const v = weekVolumeOf(plan, w)[m];
      d += v?.directSets || 0;
      e += v?.effectiveSets || 0;
      f += sessionsWithMuscle(w, m);
    }
    const n = Math.max(1, basis.length);
    const t = targets[m];
    const lm = t ? null : getVolumeLandmarks(levelOf(plan), m);
    if (!t && !lm && d === 0 && e === 0) continue;
    const mev = t?.mev ?? lm?.mev ?? 0;
    const mav = t?.mav ?? lm?.mav ?? 0;
    const mrv = caps[m] ?? t?.mrv ?? lm?.mrv ?? 0;
    const targetSets = t?.targetSets ?? mav;
    const avgD = round1(d / n);
    const avgE = round1(e / n);
    let status: BBWeeklyMuscleRow['status'] = 'ok';
    let note = `среднее по ${basis.length} раб. нед`;
    if (mrv > 0 && avgE > mrv * BB_MRV_TOLERANCE) { status = 'over'; note += ' · перебор капа'; }
    else if (mev > 0 && avgE < mev * DEFICIT_FLOOR) { status = 'low'; note += ' · ниже 70% MEV'; }
    avgMuscles.push({
      muscle: m, label: muscleRu(m), directSets: avgD, effectiveSets: avgE,
      targetSets, mev, mav, mrv, frequency: round1(f / n), targetFrequency: t?.frequency ?? 0,
      status, note,
    });
  }
  avgMuscles.sort((a, b) => b.effectiveSets - a.effectiveSets);

  // Повторяющиеся проблемы: код+мышца в ≥50% рабочих недель (error — всегда).
  const counter = new Map<string, { issue: BBQualityWeeklyIssue; count: number; weeks: number[] }>();
  for (const w of basis) {
    for (const i of scoreVolumeWeek(plan, w.week).issues) {
      if (i.severity === 'info') continue;
      const key = `${i.code}|${i.muscle || ''}`;
      const rec = counter.get(key) || { issue: i, count: 0, weeks: [] };
      rec.count++;
      rec.weeks.push(w.week);
      counter.set(key, rec);
    }
  }
  const recurringVolumeIssues: BBQualityWeeklyIssue[] = [];
  for (const { issue, count } of counter.values()) {
    if (issue.severity === 'error' || count >= Math.max(1, Math.ceil(basis.length / 2))) {
      recurringVolumeIssues.push(count > 1 ? { ...issue, message: `${issue.message} (×${count} нед)` } : issue);
    }
  }

  return {
    weeks: weeks.length,
    workingWeeks: basis.length,
    avgVolume: avg(perWeek.map(p => p.volume)),
    avgPro: avg(perWeek.map(p => p.pro)),
    perWeek,
    avgMuscles,
    recurringVolumeIssues,
  };
}
