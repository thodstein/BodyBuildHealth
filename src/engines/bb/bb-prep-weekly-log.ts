/**
 * bb-prep-weekly-log.engine.ts — недельный луп подготовки (Э4).
 *
 * Недельные чек-ины prep (вес-среднее/талия/сон/сессии/психика/заметка + статус
 * совета prepWeightAdvice на момент записи) + сила-тренд e1RM тяжёлых движений
 * в окне подготовки (предупреждение «сила падает на дефиците»).
 * Чистые функции + тонкий localStorage-слой (ключ на план, кап 52 недели).
 */
import { epley1RM } from '../e1rm';
import { isoAddDays, prepPhaseForDate, PREP_PHASE_LABELS, type BBContestPrepPlan } from './bb-contest-prep.engine';

export interface PrepWeekCheckin {
  week: number;            // 1-based неделя подготовки
  date: string;            // ISO дата записи
  weightAvg?: number;      // средний вес 7д, кг
  waistCm?: number;        // талия, см
  sleepAvg?: number;       // средний сон, ч
  sessionsDone?: number;   // выполнено сессий за неделю
  psyche?: number;         // 1..5 самочувствие/психика
  note?: string;
  /** Статус совета адаптации на момент записи (для детекта «2 недели подряд»). */
  advice?: 'on_track' | 'too_fast' | 'too_slow' | 'taper' | 'no_data';
}

const KEY = 'he_prep_week_checkins_v1';
const CAP = 52;

type Store = Record<string, PrepWeekCheckin[]>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return {};
    const out: Store = {};
    for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
      if (typeof k !== 'string' || !Array.isArray(v)) continue;
      out[k] = (v as unknown[])
        .filter(e => !!e && typeof e === 'object' && Number.isFinite((e as any).week))
        .map(e => ({ ...(e as object) } as PrepWeekCheckin))
        .slice(-CAP);
    }
    return out;
  } catch { return {}; }
}

function writeStore(s: Store): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota — молча */ }
}

export function loadPrepWeekCheckins(planId: string): PrepWeekCheckin[] {
  if (!planId) return [];
  return (readStore()[planId] ?? []).slice().sort((a, b) => a.week - b.week);
}

export function savePrepWeekCheckin(planId: string, entry: PrepWeekCheckin): PrepWeekCheckin[] {
  if (!planId || !Number.isFinite(entry.week)) return loadPrepWeekCheckins(planId);
  const s = readStore();
  const list = (s[planId] ?? []).filter(e => e.week !== entry.week);
  list.push({ ...entry });
  s[planId] = list.sort((a, b) => a.week - b.week).slice(-CAP);
  writeStore(s);
  return s[planId];
}

export interface PrepWeekRef {
  week: number;
  phaseKey: string;
  phaseLabel: string;
  dateStart: string;
  dateEnd: string;
}

/** Недели подготовки (preparation + final_preparation) с датами — лента для UI. */
export function prepWeekRefs(plan: BBContestPrepPlan): PrepWeekRef[] {
  const out: PrepWeekRef[] = [];
  try {
    const total = Math.max(1, Math.min(52, Math.round(plan.preparation.weeks)));
    for (let w = 1; w <= total; w++) {
      const dateStart = isoAddDays(plan.preparation.startDate, (w - 1) * 7);
      const dateEnd = isoAddDays(plan.preparation.startDate, w * 7 - 1);
      const ph = prepPhaseForDate(plan, dateStart);
      out.push({
        week: w,
        phaseKey: ph?.key ?? 'preparation',
        phaseLabel: ph ? PREP_PHASE_LABELS[ph.key] : 'Подготовка',
        dateStart,
        dateEnd,
      });
    }
  } catch { /* ignore */ }
  return out;
}

export interface PrepStrengthPoint {
  exercise: string;
  before: number;
  after: number;
  deltaPct: number;
  status: 'up' | 'down' | 'plateau';
}

export interface DiarySetLike { weightKg?: number; reps?: number }
export interface DiaryExerciseLike { exerciseName?: string; name?: string; sets?: DiarySetLike[] }
export interface DiarySessionLike { date: string; exercises?: DiaryExerciseLike[] }

/**
 * Сила-тренд в окне подготовки: per-упражнение лучший e1RM первой трети точек
 * vs последней трети. down при ≤ −5% (минимум 3 точки). Только подсказка.
 */
export function prepStrengthTrend(
  sessions: DiarySessionLike[] | null | undefined,
  plan: BBContestPrepPlan,
): PrepStrengthPoint[] {
  const out: PrepStrengthPoint[] = [];
  try {
    if (!sessions || sessions.length === 0) return out;
    const from = plan.preparation.startDate;
    const to = plan.showDate;
    const inWindow = sessions.filter(s =>
      typeof s?.date === 'string' && s.date >= from && s.date <= to && Array.isArray(s.exercises));
    if (inWindow.length === 0) return out;
    const map = new Map<string, { name: string; series: number[] }>();
    for (const s of [...inWindow].sort((a, b) => a.date.localeCompare(b.date))) {
      for (const ex of s.exercises!) {
        if (!ex?.sets?.length) continue;
        let best = 0;
        for (const st of ex.sets) {
          const w = Number(st?.weightKg) || 0;
          const r = Number(st?.reps) || 0;
          if (w > 0 && r > 0) {
            try { best = Math.max(best, epley1RM(w, r)); } catch { /* ignore */ }
          }
        }
        if (best <= 0) continue;
        const key = String(ex.exerciseName || ex.name || '').toLowerCase().trim();
        if (!key) continue;
        const cur = map.get(key);
        if (cur) cur.series.push(best);
        else map.set(key, { name: String(ex.exerciseName || ex.name), series: [best] });
      }
    }
    for (const [, v] of map) {
      if (v.series.length < 3) continue;
      const k = Math.max(1, Math.floor(v.series.length / 3));
      const head = v.series.slice(0, k);
      const tail = v.series.slice(-k);
      const before = head.reduce((a, b) => a + b, 0) / head.length;
      const after = tail.reduce((a, b) => a + b, 0) / tail.length;
      if (before <= 0) continue;
      const deltaPct = Math.round(((after - before) / before) * 1000) / 10;
      const status = deltaPct >= 5 ? 'up' : deltaPct <= -5 ? 'down' : 'plateau';
      if (status === 'down') {
        out.push({ exercise: v.name, before: Math.round(before), after: Math.round(after), deltaPct, status });
      }
    }
  } catch { /* ignore */ }
  return out.sort((a, b) => a.deltaPct - b.deltaPct).slice(0, 6);
}

/** Средний вес за 7 дней до даты (из weight-лога {date, weight}). */
export function avgWeight7d(log: Array<{ date: string; weight: number }>, beforeIso: string): number | undefined {
  try {
    const rows = (log || [])
      .filter(e => typeof e?.date === 'string' && e.date <= beforeIso && Number.isFinite(Number(e?.weight)) && Number(e.weight) > 30)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);
    if (rows.length === 0) return undefined;
    return Math.round((rows.reduce((a, b) => a + Number(b.weight), 0) / rows.length) * 10) / 10;
  } catch { return undefined; }
}
