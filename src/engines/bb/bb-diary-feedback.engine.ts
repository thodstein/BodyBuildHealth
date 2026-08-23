/**
 * bb-diary-feedback.engine.ts — сводка фидбека ББ-плана vs дневник.
 * Живёт в дневнике тренировок: показывает adherence, объём vs MRV, ACWR, e1RM-тренды.
 * Чистые функции — без localStorage, вызываются из UI с планом и сессиями.
 */
import type { BBPlan } from './bb-builder.engine';
import type { WorkoutSession } from '../workout-logger.engine';
import { epley1RM } from '../e1rm';
import { aggregateBBVolume } from './bb-volume.engine';
import { validateBBPlan } from './bb-validator.engine';
import { acuteChronicRatio, toDailyLoads } from '../pro/training-load.engine';
import { loadSRPESessions } from '../pro/srpe-store';
import { computePerMuscleACWR } from './bb-progression-feedback.engine';

export interface WeeklyFeedback {
  week: number;
  phase?: string;
  plannedSets: number;
  completedSets: number;
  plannedVolume: number;
  completedVolume: number;
  adherencePct: number | null;
}

export interface E1RMAlert {
  muscle: string;
  exercise: string;
  deltaPct: number;
  e1rmBefore: number;
  e1rmAfter: number;
  status: 'up' | 'down' | 'plateau';
}

export interface BBDiaryFeedback {
  hasPlan: boolean;
  hasSessions: boolean;
  adherencePct: number | null;
  totalPlannedSets: number;
  totalCompletedSets: number;
  completedSessions: number;
  plannedSessions: number;
  weekly: WeeklyFeedback[];
  warnings: string[];
  recommendations: string[];
  e1rmAlerts: E1RMAlert[];
  acwr: { ratio: number; zone: 'optimal' | 'caution' | 'dangerous' | 'undertrained' } | null;
  perMuscleACWR: Record<string, { ratio: number; zone: string }>;
}

function weekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return dateStr.slice(0, 10);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

function e1rmForSet(w: number, r: number): number {
  return epley1RM(w, r);
}

function computeE1RMAlerts(sessions: WorkoutSession[]): E1RMAlert[] {
  if (sessions.length < 4) return [];
  // muscle -> {exercise -> series of e1rm}
  const map = new Map<string, { muscle: string; series: number[]; name: string }>();
  const sorted = [...sessions].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  for (const s of sorted) {
    for (const ex of s.exercises || []) {
      if (!ex.sets?.length) continue;
      const best = Math.max(...ex.sets.map(st => e1rmForSet(st.weightKg, st.reps)));
      if (!best) continue;
      const key = (ex.exerciseName || '').toLowerCase().trim();
      if (!key) continue;
      const entry = map.get(key);
      const muscle = (ex as any).muscleGroup || 'unknown';
      if (!entry) map.set(key, { muscle, series: [best], name: ex.exerciseName || key });
      else entry.series.push(best);
    }
  }
  const out: E1RMAlert[] = [];
  for (const [, v] of map) {
    if (v.series.length < 4) continue;
    const first = v.series[0];
    const last = v.series[v.series.length - 1];
    if (first <= 0) continue;
    const delta = ((last - first) / first) * 100;
    let status: 'up' | 'down' | 'plateau' = 'plateau';
    if (delta >= 5) status = 'up';
    else if (delta <= -5) status = 'down';
    if (status !== 'plateau' || Math.abs(delta) < 2) {
      // keep only meaningful changes, but surface plateau as warning if flat
      if (status === 'plateau' && Math.abs(delta) < 2) {
        // plateau: report as plateau if series length >=6 and no growth
        if (v.series.length >= 6 && delta <= 0) out.push({ muscle: v.muscle, exercise: v.name, deltaPct: Math.round(delta * 10) / 10, e1rmBefore: Math.round(first), e1rmAfter: Math.round(last), status: 'plateau' });
      } else if (status !== 'plateau') {
        out.push({ muscle: v.muscle, exercise: v.name, deltaPct: Math.round(delta * 10) / 10, e1rmBefore: Math.round(first), e1rmAfter: Math.round(last), status });
      }
    }
  }
  return out.slice(0, 6);
}

export function computeBBDiaryFeedback(plan: BBPlan | null | undefined, sessions: WorkoutSession[]): BBDiaryFeedback {
  const hasPlan = !!(plan && plan.weeks && plan.weeks.length > 0);
  const hasSessions = sessions.length > 0;
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let adherencePct: number | null = null;
  let totalPlannedSets = 0;
  let totalCompletedSets = 0;
  const weekly: WeeklyFeedback[] = [];
  let acwr: BBDiaryFeedback['acwr'] = null;
  let perMuscleACWR: Record<string, { ratio: number; zone: string }> = {};

  // ACWR global from sRPE
  try {
    const srpe = loadSRPESessions();
    if (srpe.length >= 14) {
      const r = acuteChronicRatio(toDailyLoads(srpe as any));
      if (r && typeof r.ratio === 'number' && Number.isFinite(r.ratio)) {
        let zone: 'optimal' | 'caution' | 'dangerous' | 'undertrained' = 'optimal';
        if (r.ratio > 1.5) zone = 'dangerous';
        else if (r.ratio > 1.3) zone = 'caution';
        else if (r.ratio < 0.8) zone = 'undertrained';
        acwr = { ratio: Math.round(r.ratio * 100) / 100, zone };
      }
    }
  } catch {}

  try {
    perMuscleACWR = computePerMuscleACWR(sessions as any);
  } catch {}

  if (!hasPlan) {
    const e1rmAlerts = computeE1RMAlerts(sessions);
    return {
      hasPlan, hasSessions, adherencePct, totalPlannedSets, totalCompletedSets,
      completedSessions: sessions.length, plannedSessions: 0,
      weekly, warnings: hasSessions ? [] : ['Нет данных дневника — начните логировать тренировки'], recommendations: [],
      e1rmAlerts, acwr, perMuscleACWR,
    };
  }

  // planned totals
  const plannedSessions = (plan as BBPlan).weeks.reduce((s, w) => s + (w.sessions?.length || 0), 0);
  for (const w of (plan as BBPlan).weeks) {
    const plannedSets = w.sessions.reduce((s, sess) => s + sess.exercises.filter(e => !(e as any).warmupActivator).reduce((a, e) => a + (e.sets || 0), 0), 0);
    const plannedVolume = w.sessions.reduce((s, sess) => s + sess.exercises.reduce((a, e) => a + (e.sets || 0) * ((e.workSets?.[0]?.weight || 0) || 0), 0), 0);
    totalPlannedSets += plannedSets;
    // completed for this week: sessions whose date falls into week index
    // fallback: distribute completedSessions proportionally if no dates
    weekly.push({ week: w.week, phase: (w as any).phase, plannedSets, completedSets: 0, plannedVolume, completedVolume: 0, adherencePct: null });
  }

  // completed totals by weekKey
  const completedSessions = sessions.length;
  totalCompletedSets = sessions.reduce((s, sess) => s + (sess.exercises?.reduce((a, e) => a + (e.sets?.length || 0), 0) || 0), 0);

  if (plannedSessions > 0) {
    adherencePct = Math.round((completedSessions / plannedSessions) * 100);
  }

  // weekly adherence via date-bucket if plan has dates, else simple distribution
  // For BB rolling plans without calendar, distribute sessions round-robin by week index
  if (hasPlan && hasSessions) {
    const totalWeeks = (plan as BBPlan).weeks.length;
    const byWeek: Record<number, number> = {};
    // bucket by ISO week vs plan order: assume sessions chronological → week assignment
    const sorted = [...sessions].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    sorted.forEach((sess, idx) => {
      const wkIdx = Math.min(totalWeeks - 1, Math.floor((idx / Math.max(1, completedSessions)) * totalWeeks));
      const w = weekly[wkIdx];
      if (!w) return;
      const sets = sess.exercises?.reduce((a, e) => a + (e.sets?.length || 0), 0) || 0;
      const vol = sess.exercises?.reduce((a, e) => a + (e.sets?.reduce((s, st) => s + (st.weightKg || 0) * (st.reps || 0), 0) || 0), 0) || 0;
      w.completedSets += sets;
      w.completedVolume += vol;
      byWeek[wkIdx] = (byWeek[wkIdx] || 0) + 1;
    });
    for (const w of weekly) {
      if (w.plannedSets > 0) w.adherencePct = Math.round((w.completedSets / w.plannedSets) * 100);
    }
  }

  // validator warnings
  try {
    const val = validateBBPlan(plan as BBPlan, { level: (plan as any).level || 'intermediate' });
    for (const iss of val.issues) {
      if (iss.level === 'warning' && ['low_training_frequency', 'effective_mrv_overflow', 'target_volume_deficit'].includes(iss.code)) {
        warnings.push(iss.message);
      }
    }
  } catch {}

  if (acwr) {
    if (acwr.zone === 'dangerous') warnings.push(`ACWR ${acwr.ratio} — опасно: объём острой недели >1.5× хроники, риск перетрена`);
    else if (acwr.zone === 'caution') warnings.push(`ACWR ${acwr.ratio} — осторожно: 1.3-1.5×, снизьте объём`);
    else if (acwr.zone === 'undertrained') warnings.push(`ACWR ${acwr.ratio} — недотрен: <0.8×, можно добавить объём`);
  }

  for (const [m, v] of Object.entries(perMuscleACWR)) {
    if (v.zone === 'dangerous') warnings.push(`${m}: ACWR ${v.ratio} — перегруз мышцы`);
    else if (v.zone === 'undertrained') warnings.push(`${m}: ACWR ${v.ratio} — мышца недогружена`);
  }

  const e1rmAlerts = computeE1RMAlerts(sessions);
  for (const a of e1rmAlerts) {
    if (a.status === 'down') warnings.push(`${a.exercise}: e1RM ↓ ${a.deltaPct}% (${a.e1rmBefore}→${a.e1rmAfter}) — проверьте восстановление/технику`);
    else if (a.status === 'plateau') warnings.push(`${a.exercise}: плато e1RM ${a.deltaPct}% за ${sessions.length} сессий — рассмотрите ротацию упражнения`);
  }

  // recommendations
  if (adherencePct !== null && adherencePct < 80) recommendations.push(`Adherence ${adherencePct}% — ниже 80%. Сократите недельный объём или перейдите на сплит с меньшей частотой`);
  if (adherencePct !== null && adherencePct >= 100) recommendations.push(`Adherence ${adherencePct}% — план выполняется полностью, можно прогрессировать вес +2.5%`);
  if (e1rmAlerts.some(a => a.status === 'down')) recommendations.push('e1RM падает — проверьте сон/HRV/питание, возможен deload');
  if (e1rmAlerts.some(a => a.status === 'plateau')) recommendations.push('Плато по e1RM — замените primary-упражнение через ротацию (findSubstitutions)');
  if (acwr?.zone === 'dangerous') recommendations.push('Снизьте объём на 25-40% на неделю (deload) — ACWR danger');
  if (warnings.some(w => w.includes('1×/нед'))) recommendations.push('Частота 1×/нед — смените сплит на FullBody/Upper-Lower/PPL 4-6× для ≥2× стимула');
  if (warnings.length === 0 && hasPlan && hasSessions) recommendations.push('✅ План и факт в балансе — продолжайте прогрессию по double progression');

  return {
    hasPlan, hasSessions, adherencePct, totalPlannedSets, totalCompletedSets,
    completedSessions, plannedSessions, weekly, warnings, recommendations, e1rmAlerts, acwr, perMuscleACWR,
  };
}

/** Загрузить активный ББ-план из стораджа (he_bb_plan_saved / he_bb_plans). */
export function loadActiveBBPlan(): BBPlan | null {
  try {
    const raw = localStorage.getItem('he_bb_plan_saved');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.weeks) return parsed as BBPlan;
      if (parsed && parsed.plan && parsed.plan.weeks) return parsed.plan as BBPlan;
    }
    const raw2 = localStorage.getItem('he_bb_plans');
    if (raw2) {
      const arr = JSON.parse(raw2);
      if (Array.isArray(arr) && arr[0]?.plan?.weeks) return arr[0].plan as BBPlan;
      if (Array.isArray(arr) && arr[0]?.weeks) return arr[0] as BBPlan;
    }
  } catch {}
  return null;
}
