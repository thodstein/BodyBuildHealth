/**
 * arm-plan-feedback.engine.ts — контур «план ↔ факт» арм-планировщика.
 *
 * Закрывает P0-1 профессионального аудита: факт дневника раньше жил только в хабе
 * (e1RM-тренд/ACWR), а следующая меза накручивала +2.5% всем мышцам одинаково.
 * Здесь:
 *  - `armFactFeedback` — по каждой мышце фактический e1RM (живой дневник) против
 *    последнего плана → beat / on_track / stalled / no_data + действие;
 *  - `applyFactProgression` — per-muscle ставка следующей мезы: beat → ставка цикла,
 *    on_track → 1.0 (не накручиваем выше факта), stalled → −2% (сброс), нет данных →
 *    исходная кросс-мезо ставка (обратная совместимость);
 *  - `armPlanCompliance` — выполнение плана по дневнику (сеты факт/план по неделям,
 *    статусы done/partial/missed/upcoming).
 *
 * Чистый модуль (без localStorage/UI): вход — план + сессии дневника.
 */
import type { ArmPlan, ArmDiarySessionFact } from './arm-types';

export type ArmFactStatus = 'beat' | 'on_track' | 'stalled' | 'no_data';
export type ArmFactAction = 'increase' | 'hold' | 'back_off' | 'none';

export interface ArmFactMuscle {
  muscle: string;
  plannedTopKg: number;
  plannedE1rmKg: number;
  factTopKg: number;
  factE1rmKg: number;
  deltaPct: number;
  status: ArmFactStatus;
  action: ArmFactAction;
  note: string;
}

export interface ArmFactFeedbackResult {
  muscles: ArmFactMuscle[];
  summary: string;
  stalled: string[];
  beats: string[];
}

export interface ArmComplianceWeek {
  week: number;
  plannedSets: number;
  factSets: number;
  pct: number;
  status: 'done' | 'partial' | 'missed' | 'upcoming';
}

export interface ArmComplianceResult {
  weeks: ArmComplianceWeek[];
  overallPct: number;
  doneWeeks: number;
  countedWeeks: number;
  note: string;
}

function normName(s: unknown): string {
  return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
}

/** Сырой Epley для контура «план ↔ факт» (без гейта reps ≤12 — арм-повторы до 20). */
export function armFactE1RM(weight: number, reps: number): number {
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  if (!w) return 0;
  if (!r) return w;
  return w * (1 + r / 30);
}

/** Плановая «якорная» точка мышцы: последняя рабочая неделя, топ-сет по весу. */
function plannedAnchor(plan: ArmPlan, muscle: string): { topKg: number; e1rmKg: number; reps: number } {
  const m = String(muscle).toLowerCase();
  let best: { topKg: number; e1rmKg: number; reps: number } | null = null;
  const weeks = [...(plan.weeks || [])].filter((w) => !(w as any).deload && w.phase !== 'deload');
  const ordered = weeks.length ? weeks : [...(plan.weeks || [])];
  // Идём с конца к началу: первая найденная неделя и есть «последняя рабочая».
  for (let i = ordered.length - 1; i >= 0 && !best; i--) {
    const wk = ordered[i];
    let top = { topKg: 0, e1rmKg: 0, reps: 0 };
    for (const sess of wk.sessions || []) {
      for (const ex of sess.exercises || []) {
        if (String(ex.muscle).toLowerCase() !== m) continue;
        for (const ws of ex.workSets || []) {
          const kg = Number((ws as any).weight) || 0;
          const reps = Number(ws.reps) || 0;
          const e1 = armFactE1RM(kg, reps);
          if (e1 > top.e1rmKg) top = { topKg: Math.max(top.topKg, kg), e1rmKg: e1, reps };
          else if (kg > top.topKg) top.topKg = kg;
        }
      }
    }
    if (top.e1rmKg > 0) best = top;
  }
  return best || { topKg: 0, e1rmKg: 0, reps: 0 };
}

/** Факт e1RM по мышце из дневника (окно от последней записи, warmup-сеты исключены). */
function factAnchor(sessions: ArmDiarySessionFact[], muscle: string, nameToMuscle: Map<string, string>, windowDays: number): { topKg: number; e1rmKg: number } {
  const m = String(muscle).toLowerCase();
  const valid = (sessions || []).filter((s) => s && typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date));
  if (!valid.length) return { topKg: 0, e1rmKg: 0 };
  const latest = valid.reduce((a, b) => (a.date >= b.date ? a : b)).date;
  const fromMs = Date.parse(`${latest}T00:00:00Z`) - Math.max(1, windowDays) * 86400000;
  let topKg = 0;
  let e1rm = 0;
  for (const s of valid) {
    const t = Date.parse(`${s.date}T00:00:00Z`);
    if (!Number.isFinite(t) || t < fromMs) continue;
    for (const ex of s.exercises || []) {
      const exMuscle = String(ex.muscle || ex.muscleGroup || nameToMuscle.get(normName(ex.exerciseName || ex.name)) || '').toLowerCase();
      if (exMuscle !== m) continue;
      for (const set of ex.sets || []) {
        if ((set as any).isWarmup === true) continue;
        const kg = Number((set as any).weightKg ?? (set as any).weight) || 0;
        const reps = Number((set as any).reps) || 0;
        if (kg <= 0 || reps <= 0) continue;
        topKg = Math.max(topKg, kg);
        e1rm = Math.max(e1rm, armFactE1RM(kg, reps));
      }
    }
  }
  return { topKg, e1rmKg: Math.round(e1rm * 10) / 10 };
}

/**
 * Обратная связь по мышцам плана: факт последних сессий против планового якоря.
 * Без якоря или факта — `no_data` (никаких выдуманных выводов).
 */
export function armFactFeedback(plan: ArmPlan | null | undefined, sessions: ArmDiarySessionFact[] | undefined, opts?: { windowDays?: number }): ArmFactFeedbackResult {
  const empty: ArmFactFeedbackResult = { muscles: [], summary: 'Нет данных дневника — кросс-мезо по плановой ставке.', stalled: [], beats: [] };
  if (!plan || !Array.isArray(sessions) || sessions.length === 0) return empty;
  const nameToMuscle = new Map<string, string>();
  for (const wk of plan.weeks || []) {
    for (const sess of wk.sessions || []) {
      for (const ex of sess.exercises || []) {
        const key = normName(ex.name);
        if (key && !nameToMuscle.has(key)) nameToMuscle.set(key, String(ex.muscle).toLowerCase());
      }
    }
  }
  const muscles = Array.from(new Set((plan.weeks || []).flatMap((wk) => (wk.sessions || []).flatMap((s) => (s.exercises || []).map((e) => String(e.muscle).toLowerCase())))));
  const out: ArmFactMuscle[] = [];
  for (const muscle of muscles) {
    const planned = plannedAnchor(plan, muscle);
    if (planned.e1rmKg <= 0) continue;
    const fact = factAnchor(sessions, muscle, nameToMuscle, opts?.windowDays ?? 28);
    let status: ArmFactStatus;
    let action: ArmFactAction;
    let deltaPct: number;
    if (fact.e1rmKg <= 0) {
      status = 'no_data'; action = 'none'; deltaPct = 0;
    } else {
      const ratio = fact.e1rmKg / planned.e1rmKg;
      deltaPct = Math.round((ratio - 1) * 1000) / 10;
      if (ratio >= 1.02) { status = 'beat'; action = 'increase'; }
      else if (ratio < 0.95) { status = 'stalled'; action = 'back_off'; }
      else { status = 'on_track'; action = 'hold'; }
    }
    const note =
      status === 'beat' ? `${muscle}: факт ${fact.e1rmKg} кг e1RM (+${deltaPct}%) — наращиваем ставку мезоцикла.`
      : status === 'on_track' ? `${muscle}: факт ${fact.e1rmKg} кг e1RM (${deltaPct >= 0 ? '+' : ''}${deltaPct}%) — держим веса без накрутки.`
      : status === 'stalled' ? `${muscle}: факт ${fact.e1rmKg} кг e1RM (${deltaPct}%) ниже плана на ≥5% — сброс −2% и проверка восстановления.`
      : `${muscle}: нет записей за окно — ставка по умолчанию.`;
    out.push({ muscle, plannedTopKg: planned.topKg, plannedE1rmKg: Math.round(planned.e1rmKg * 10) / 10, factTopKg: fact.topKg, factE1rmKg: fact.e1rmKg, deltaPct, status, action, note });
  }
  out.sort((a, b) => a.deltaPct - b.deltaPct);
  const beats = out.filter((x) => x.status === 'beat').map((x) => x.muscle);
  const stalled = out.filter((x) => x.status === 'stalled').map((x) => x.muscle);
  const summary = out.length === 0
    ? empty.summary
    : `📈 План vs факт: beat ${beats.length} · on_track ${out.filter((x) => x.status === 'on_track').length} · stalled ${stalled.length} · нет данных ${out.filter((x) => x.status === 'no_data').length} (окно ${opts?.windowDays ?? 28} дн).`;
  return { muscles: out, summary, stalled, beats };
}

/** Ставка следующей мезы по мышце: факт важнее общей ставки. */
export function factRateFor(muscle: string, facts: ArmFactMuscle[], mesoRate: number): number {
  const f = facts.find((x) => x.muscle === String(muscle).toLowerCase());
  if (!f) return mesoRate;
  if (f.status === 'beat') return mesoRate;
  if (f.status === 'on_track') return 1;
  if (f.status === 'stalled') return 0.98;
  return mesoRate;
}

/**
 * Прогрессированные веса следующей мезы по факту: база предыдущего плана ×
 * per-muscle ставка. Возвращает и факторы (для отчёта/тестов).
 */
export function applyFactProgression(prevBase: Record<string, number>, facts: ArmFactMuscle[], mesoRate: number): { workMax: Record<string, number>; factors: Record<string, number>; notes: string[] } {
  const workMax: Record<string, number> = {};
  const factors: Record<string, number> = {};
  for (const [m, base] of Object.entries(prevBase || {})) {
    if (!Number.isFinite(Number(base)) || Number(base) <= 0) continue;
    const rate = factRateFor(m, facts, mesoRate);
    factors[m] = rate;
    workMax[m] = Math.round(Number(base) * rate * 2) / 2;
  }
  const notes: string[] = [];
  if (facts.length) {
    const beats = facts.filter((f) => f.status === 'beat');
    const stalled = facts.filter((f) => f.status === 'stalled');
    if (beats.length) notes.push(`Факт превысил план: ${beats.slice(0, 4).map((f) => f.muscle).join(', ')} — ставка ${Math.round((mesoRate - 1) * 1000) / 10}%/мезо.`);
    if (stalled.length) notes.push(`⛔ Плато по факту: ${stalled.slice(0, 4).map((f) => f.muscle).join(', ')} — вес −2% и проверка сна/питания.`);
  }
  return { workMax, factors, notes };
}

/* ── Выполнение плана по дневнику ────────────────────────────────────────── */

function addDaysIso(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t)) return iso;
  const d = new Date(t + days * 86400000);
  return d.toISOString().slice(0, 10);
}

/**
 * Compliance: сеты факта (только упражнения плана, без warmup) против плана по неделям.
 * `week1Iso` — дата первой недели плана (дата сборки/старта).
 */
export function armPlanCompliance(plan: ArmPlan | null | undefined, sessions: ArmDiarySessionFact[] | undefined, week1Iso: string, todayIso?: string): ArmComplianceResult | null {
  if (!plan || !Array.isArray(plan.weeks) || !/^\d{4}-\d{2}-\d{2}$/.test(String(week1Iso || ''))) return null;
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(todayIso || '')) ? String(todayIso) : new Date().toISOString().slice(0, 10);
  const planNames = new Set<string>();
  for (const wk of plan.weeks || []) for (const s of wk.sessions || []) for (const e of s.exercises || []) {
    const k = normName(e.name);
    if (k) planNames.add(k);
  }
  const rows: ArmComplianceWeek[] = [];
  for (const wk of plan.weeks || []) {
    const start = addDaysIso(week1Iso, (wk.week - 1) * 7);
    const end = addDaysIso(start, 6);
    const plannedSets = (wk.sessions || []).reduce((a, s) => a + (s.exercises || []).reduce((x, e) => x + (e.sets || 0), 0), 0);
    let factSets = 0;
    for (const s of sessions || []) {
      if (!s || typeof s.date !== 'string' || s.date < start || s.date > end) continue;
      for (const ex of s.exercises || []) {
        if (!planNames.has(normName(ex.exerciseName || ex.name))) continue;
        factSets += (ex.sets || []).filter((x) => (x as any).isWarmup !== true).length;
      }
    }
    const future = end > today; // неделя не завершена — не судим (честно)
    const pct = plannedSets > 0 ? Math.min(150, Math.round((factSets / plannedSets) * 100)) : 0;
    const status: ArmComplianceWeek['status'] = future ? 'upcoming' : pct >= 80 ? 'done' : pct >= 40 ? 'partial' : 'missed';
    rows.push({ week: wk.week, plannedSets, factSets, pct, status });
  }
  const counted = rows.filter((r) => r.status !== 'upcoming');
  const done = counted.filter((r) => r.status === 'done').length;
  const overallPct = counted.length ? Math.round(counted.reduce((a, r) => a + Math.min(100, r.pct), 0) / counted.length) : 0;
  const note = counted.length === 0
    ? 'План ещё не начался — выполнение появится после первой недели.'
    : `Выполнение: ${overallPct}% (${done} нед закрыто из ${counted.length}).`;
  return { weeks: rows, overallPct, doneWeeks: done, countedWeeks: counted.length, note };
}
