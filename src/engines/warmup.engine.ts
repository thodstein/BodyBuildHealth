import type { WarmupBlock } from '../core/types';
import { collectGroupPrep, prepGroupLabels } from './warmup-day.engine';
import { collectJointPrep, jointPrepLabels } from './warmup-joints.engine';
import { getISOWeekNumber } from './workout-logger.engine';
export type { WarmupBlock };

export interface WarmupInput {
  sessionFocus: string;
  primaryExercises: string[];
  riskFlags: Record<string, string>;
  techniqueIssues: string[];
  fatigueLevel: number;
  equipmentAvailable: string[];
  /** Целевые группы тренировочного дня (muscleGroup упражнений плана) — упор разминки. */
  targetGroups?: string[];
  /** Рабочие веса основных упражнений (параллельно primaryExercises) — для расчёта кг в специфике. */
  primaryWeights?: (number | null)[];
}

/** Канонические русские названия разминочных упражнений (единый словарь). */
export const WARMUP_LABELS: Record<string, string> = {
  light_cardio: 'Лёгкое кардио (ходьба/велотренажёр)',
  jumping_jack: 'Джампинг-джек',
  arm_circles: 'Круги руками',
  leg_swings: 'Махи ногами',
  hip_circle: 'Круги тазом',
  ankle_mobility: 'Мобилизация голеностопа',
  shoulder_circle: 'Круги плечами',
  thoracic_rotation: 'Ротация грудного отдела',
  cat_camel: 'Кошка-корова',
  worlds_greatest: 'Растяжка «Величайшая в мире»',
  banded_clam: 'Ракушка с резинкой',
  external_rotation: 'Наружная ротация плеч (лента)',
  bird_dog: 'Птица-собака (Bird dog)',
  dead_bug: 'Мёртвый жук (Dead bug)',
  side_lying_abduction: 'Отведение ноги лёжа на боку',
  wall_slide: 'Скольжение по стене (Wall slide)',
  wall_pec_stretch: 'Растяжка груди у стены',
  pushup_light: 'Лёгкие отжимания',
  scapular_pull: 'Подтягивание лопаток',
  band_pull_apart: 'Разведение ленты перед собой',
  air_squat: 'Приседания без веса',
  lateral_band_walk: 'Боковые шаги с лентой',
  hip_hinge_prep: 'Разминочный наклон таза',
  glute_bridge: 'Ягодичный мост',
  rdl_light: 'Лёгкая румынская тяга',
  '90_90_switch': 'Переход бёдер 90/90',
  ytw: 'Y-T-W разведения',
  band_curl_light: 'Сгибания с резинкой (лёгкие)',
  band_pushdown_light: 'Разгибания с резинкой (лёгкие)',
  calf_raise: 'Подъёмы на носки',
  calf_stretch: 'Растяжка икр у стены',
  wrist_circles: 'Круги запястьями',
  wrist_rocks: 'Раскачивание кисти',
  elbow_circles: 'Круги локтями',
  knee_circles: 'Круги коленями',
  neck_cars: 'CARs шеи',
  wrist_flex_ext: 'Сгибание-разгибание кисти',
  squat: 'Разминочные подходы — присед',
  bench: 'Разминочные подходы — жим',
  bench_press: 'Разминочные подходы — жим',
  deadlift: 'Разминочные подходы — тяга',
};

/** Русское название упражнения с fallback на id. */
export function warmupLabel(exerciseId: string): string {
  return WARMUP_LABELS[exerciseId] || exerciseId;
}

/** Подпись разминочного подхода конкретного упражнения (специальная часть). */
export function warmupSpecificLabel(exerciseId: string): string {
  return WARMUP_LABELS[exerciseId] || `Разминочные подходы — ${exerciseId}`;
}

export function generateWarmup(input: WarmupInput): WarmupBlock[] {
  const blocks: WarmupBlock[] = [];
  const hasBand = (input.equipmentAvailable || []).some(e => /band|резин|лент|cable|канат/i.test(e));

  if (input.fatigueLevel > 0.7) {
    blocks.push({
      type: 'general',
      durationSec: 300,
      exercises: [{ exerciseId: 'light_cardio', sets: 1, reps: 1 }],
      notes: 'Сниженный объём разминки — высокая усталость',
    });
  } else {
    blocks.push({
      type: 'general',
      durationSec: 300,
      exercises: [
        { exerciseId: 'jumping_jack', sets: 1, reps: 30 },
        { exerciseId: 'arm_circles', sets: 1, reps: 10 },
        { exerciseId: 'leg_swings', sets: 1, reps: 10 },
      ],
    });
  }

  // Упор на целевые группы дня (если переданы) — сбалансированный микс суставов и зон
  const targetGroups = (input.targetGroups || []).filter(Boolean);
  const groupPrep = targetGroups.length > 0 ? collectGroupPrep(targetGroups, hasBand) : null;
  const jointPrep = targetGroups.length > 0 ? collectJointPrep(targetGroups) : null;
  const toBlockEx = (e: { id: string; sets: number; reps: number; note?: string }) => ({ exerciseId: e.id, sets: e.sets, reps: e.reps, ...(e.note ? { note: e.note } : {}) });

  const mobilityExs: { exerciseId: string; sets: number; reps: number; note?: string }[] = (() => {
    if (!groupPrep) return getMobilityExercises(input.sessionFocus, input.riskFlags);
    const joint = (jointPrep || []).map(toBlockEx);
    const zone = groupPrep.mobility.map(toBlockEx);
    const merged: { exerciseId: string; sets: number; reps: number; note?: string }[] = [];
    const seen = new Set<string>();
    let idxJ = 0, idxZ = 0;
    while (merged.length < 9 && (idxJ < joint.length || idxZ < zone.length)) {
      if (idxJ < joint.length) {
        const cand = joint[idxJ++];
        if (!seen.has(cand.exerciseId)) { seen.add(cand.exerciseId); merged.push(cand); }
        if (merged.length >= 9) break;
      }
      if (idxZ < zone.length) {
        const cand = zone[idxZ++];
        if (!seen.has(cand.exerciseId)) { seen.add(cand.exerciseId); merged.push(cand); }
      }
    }
    return merged.slice(0, 9);
  })();
  if (Object.values(input.riskFlags).includes('high') && !mobilityExs.some(e => e.exerciseId === 'cat_camel')) {
    mobilityExs.push({ exerciseId: 'cat_camel', sets: 1, reps: 8 });
  }
  if (Object.values(input.riskFlags).includes('high') && !mobilityExs.some(e => e.exerciseId === 'worlds_greatest')) {
    mobilityExs.push({ exerciseId: 'worlds_greatest', sets: 1, reps: 6 });
  }
  if (mobilityExs.length > 0) {
    blocks.push({
      type: 'mobility',
      // Длительность по факту: ~30с на упражнение, 90-270с (до 9 упр)
      durationSec: Math.max(90, Math.min(270, mobilityExs.length * 30)),
      exercises: mobilityExs,
      notes: groupPrep ? `Суставная подготовка: ${jointPrepLabels(targetGroups)} · зоны: ${prepGroupLabels(targetGroups)}` : 'Суставная подготовка',
    });
  }

  const activationExs: { exerciseId: string; sets: number; reps: number }[] = groupPrep
    ? groupPrep.activation.map(toBlockEx)
    : getActivationExercises(input.riskFlags, input.techniqueIssues, hasBand);
  if (input.techniqueIssues.includes('knee_valgus') && !activationExs.some(e => e.exerciseId === 'banded_clam' || e.exerciseId === 'side_lying_abduction')) {
    activationExs.push(hasBand
      ? { exerciseId: 'banded_clam', sets: 2, reps: 15 }
      : { exerciseId: 'side_lying_abduction', sets: 2, reps: 15 });
  }
  if (input.techniqueIssues.includes('rounding_back') && !activationExs.some(e => e.exerciseId === 'bird_dog')) {
    activationExs.push({ exerciseId: 'bird_dog', sets: 2, reps: 10 });
  }
  if (activationExs.length > 0) {
    blocks.push({
      type: 'activation',
      // Длительность по факту: ~35с на упражнение, 90-280с (до 8 упр)
      durationSec: Math.max(90, Math.min(280, activationExs.length * 35)),
      exercises: activationExs,
      notes: groupPrep ? `Активация: ${prepGroupLabels(targetGroups)} — каждое рабочее движение «включается» до подходов` : 'Активация мышц',
    });
  }

  // Специальная: разминочные подходы по КАЖДОМУ основному упражнению (не только первому).
  // Рампа по канону warmup-ramp: 50%×10 → 70%×5 → 80%×3 → 90%×1 (первое),
  // второе 50%×10 → 70%×5, остальные 50%×10. Если переданы веса — считаем кг и пишем в note.
  const primaries = (input.primaryExercises || []).filter(Boolean).slice(0, 3);
  const primWeights = (input.primaryWeights || []) as (number | null)[];
  const specificExs: { exerciseId: string; sets: number; reps: number; intensityPct: number; note?: string }[] = [];
  const RAMP_REPS: Record<number, number> = { 50: 10, 70: 5, 80: 3, 90: 1 };
  if (primaries.length === 0) {
    specificExs.push({ exerciseId: 'squat', sets: 1, reps: 10, intensityPct: 50 });
  } else {
    primaries.forEach((ex, i) => {
      const w = primWeights[i];
      const hasW = typeof w === 'number' && Number.isFinite(w) && (w as number) > 0;
      const ramp = i === 0 ? [50, 70, 80, 90] : i === 1 ? [50, 70] : [50];
      ramp.forEach(pct => {
        const note = hasW ? `~${Math.round((w as number) * pct / 100)} кг` : undefined;
        specificExs.push({ exerciseId: ex, sets: 1, reps: RAMP_REPS[pct], intensityPct: pct, ...(note ? { note } : {}) });
      });
    });
  }
  blocks.push({
    type: 'specific',
    durationSec: 300,
    exercises: specificExs,
    notes: 'Разминочные подходы к рабочим весам — считайте по % от рабочего, техника как на рабочих',
  });

  return blocks;
}

function getMobilityExercises(sessionFocus: string, riskFlags: Record<string, string>): { exerciseId: string; sets: number; reps: number }[] {
  const exs: { exerciseId: string; sets: number; reps: number }[] = [];
  if (['squat', 'legs', 'lower', 'fullbody'].includes(sessionFocus)) {
    exs.push({ exerciseId: 'hip_circle', sets: 1, reps: 10 }, { exerciseId: 'ankle_mobility', sets: 1, reps: 10 });
  }
  if (['bench', 'upper', 'push', 'fullbody'].includes(sessionFocus)) {
    exs.push({ exerciseId: 'shoulder_circle', sets: 1, reps: 10 }, { exerciseId: 'thoracic_rotation', sets: 1, reps: 8 });
  }
  if (Object.values(riskFlags).includes('high')) {
    exs.push({ exerciseId: 'cat_camel', sets: 1, reps: 8 }, { exerciseId: 'worlds_greatest', sets: 1, reps: 6 });
  }
  return exs;
}

/** Активация: с лентой — ленточные упражнения, без ленты — bodyweight-замена. */
function getActivationExercises(
  riskFlags: Record<string, string>,
  techniqueIssues: string[],
  hasBand: boolean,
): { exerciseId: string; sets: number; reps: number }[] {
  const exs: { exerciseId: string; sets: number; reps: number }[] = [];
  const add = (id: string, sets: number, reps: number) => {
    if (!exs.some(e => e.exerciseId === id)) exs.push({ exerciseId: id, sets, reps });
  };
  if (riskFlags['knee'] === 'high' || techniqueIssues.includes('knee_valgus')) {
    add(hasBand ? 'banded_clam' : 'side_lying_abduction', 2, 15);
  }
  if (riskFlags['shoulder'] === 'high' || techniqueIssues.includes('tight_shoulders')) {
    add(hasBand ? 'external_rotation' : 'wall_slide', 2, 12);
  }
  if (techniqueIssues.includes('rounding_back')) {
    add('bird_dog', 2, 10);
    add('dead_bug', 1, 10);
  }
  if (techniqueIssues.includes('tight_hips')) {
    add('glute_bridge', 2, 12);
  }
  if (techniqueIssues.includes('tight_ankles')) {
    add('air_squat', 2, 8);
  }
  if (techniqueIssues.includes('tight_chest')) {
    add('pushup_light', 1, 8);
  }
  return exs;
}

// ═══════════════════════════════════════════════════════════════════════════
// Дневник разминки (факт: выполнена/качество/причины пропуска)
// ═══════════════════════════════════════════════════════════════════════════

export const WARMUP_DIARY_KEY = 'he_warmup_diary';
export const WARMUP_DIARY_CAP = 365;

export interface WarmupLogEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** id сессии (опционально, для привязки). Замена записи — по дате. */
  sessionId?: string;
  /** Разминка выполнена (полностью или частично). */
  done: boolean;
  /** Качество разминки 1-5 (null = не оценено). */
  quality: number | null;
  /** Всего пунктов в разминке сессии. */
  totalItems?: number;
  /** Сколько пунктов отмечено. */
  doneItems?: number;
  skippedReason?: string;
  note?: string;
}

export interface WarmupAdherence {
  done: number;
  total: number;
  pct: number;
}

export interface WarmupQualityTrend {
  series: { date: string; quality: number }[];
  avg: number;
  count: number;
}

export function sanitizeWarmupLog(raw: any): WarmupLogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(raw.date)) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `wu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date: raw.date.slice(0, 10),
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : undefined,
    done: !!raw.done,
    quality: typeof raw.quality === 'number' && Number.isFinite(raw.quality) && raw.quality >= 1 && raw.quality <= 5 ? Math.round(raw.quality) : null,
    totalItems: typeof raw.totalItems === 'number' && Number.isFinite(raw.totalItems) ? Math.max(0, Math.round(raw.totalItems)) : undefined,
    doneItems: typeof raw.doneItems === 'number' && Number.isFinite(raw.doneItems) ? Math.max(0, Math.round(raw.doneItems)) : undefined,
    skippedReason: typeof raw.skippedReason === 'string' ? raw.skippedReason : undefined,
    note: typeof raw.note === 'string' ? raw.note : undefined,
  };
}

function readJSON(key: string): any[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function writeJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota — игнор */ }
}

/** Лог разминки, ASC по дате, кап новейших 365. */
export function loadWarmupLog(): WarmupLogEntry[] {
  const list = readJSON(WARMUP_DIARY_KEY)
    .map(sanitizeWarmupLog)
    .filter((e): e is WarmupLogEntry => !!e)
    .sort((a, b) => a.date.localeCompare(b.date));
  return list.slice(-WARMUP_DIARY_CAP);
}

/** Upsert по дате (одна запись на день). Возвращает полный лог. */
export function upsertWarmupLog(input: Omit<WarmupLogEntry, 'id'>): WarmupLogEntry[] {
  const list = loadWarmupLog();
  const date = input.date.slice(0, 10);
  const idx = list.findIndex(e => e.date === date);
  const entry: WarmupLogEntry = {
    id: idx >= 0 ? list[idx].id : `wu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date,
    sessionId: typeof input.sessionId === 'string' ? input.sessionId : undefined,
    done: !!input.done,
    quality: typeof input.quality === 'number' && input.quality >= 1 && input.quality <= 5 ? Math.round(input.quality) : null,
    totalItems: input.totalItems !== undefined ? Math.max(0, Math.round(input.totalItems)) : undefined,
    doneItems: input.doneItems !== undefined ? Math.max(0, Math.round(input.doneItems)) : undefined,
    skippedReason: typeof input.skippedReason === 'string' && input.skippedReason.trim() ? input.skippedReason.trim() : undefined,
    note: typeof input.note === 'string' && input.note.trim() ? input.note.trim() : undefined,
  };
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  writeJSON(WARMUP_DIARY_KEY, list);
  return loadWarmupLog();
}

export function latestWarmupLog(): WarmupLogEntry | null {
  const list = loadWarmupLog();
  return list.length > 0 ? list[list.length - 1] : null;
}

/** Приверженность: доля дней с выполненной разминкой за N дней. */
export function warmupAdherence(days = 30): WarmupAdherence {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const floor = since.toISOString().slice(0, 10);
  const recent = loadWarmupLog().filter(e => e.date >= floor);
  const done = recent.filter(e => e.done).length;
  return {
    done,
    total: recent.length,
    pct: recent.length > 0 ? Math.round(done / recent.length * 100) : 0,
  };
}

export function warmupQualityTrend(days = 30): WarmupQualityTrend {
  const list = loadWarmupLog()
    .slice(-days)
    .filter(e => e.quality !== null);
  const avg = list.length > 0
    ? Math.round(list.reduce((s, e) => s + (e.quality || 0), 0) / list.length * 10) / 10
    : 0;
  return {
    series: list.map(e => ({ date: e.date, quality: e.quality as number })),
    avg,
    count: list.length,
  };
}

/** Запись разминки для даты (для бейджей). */
export function warmupLogForDate(date: string): WarmupLogEntry | null {
  return loadWarmupLog().find(e => e.date === date.slice(0, 10)) || null;
}

export interface WeeklyAdherencePoint {
  /** Подпись недели (W-номер ISO). */
  label: string;
  pct: number;
  done: number;
  total: number;
}

function localIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Приверженность по календарным неделям (Пн-начало): доля выполненных дней. */
export function warmupWeeklyAdherence(weeks = 8): WeeklyAdherencePoint[] {
  const log = loadWarmupLog();
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // 0 = Пн
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);
  const out: WeeklyAdherencePoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - w * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const s = localIso(start);
    const e = localIso(end);
    const weekLog = log.filter(x => x.date >= s && x.date < e);
    const done = weekLog.filter(x => x.done).length;
    out.push({
      label: `W${getISOWeekNumber(s)}`,
      pct: weekLog.length > 0 ? Math.round(done / weekLog.length * 100) : 0,
      done,
      total: weekLog.length,
    });
  }
  return out;
}

/** Инсайт тренда приверженности неделя-к-неделе (текущая vs предыдущая с данными). */
export function warmupWeeklyTrendInsight(): string | null {
  const wk = warmupWeeklyAdherence(8).filter(p => p.total > 0);
  if (wk.length < 2) return null;
  const last = wk[wk.length - 1];
  const prev = wk[wk.length - 2];
  if (prev.total === 0) return null;
  if (last.pct < prev.pct - 20) {
    return `Приверженность разминки на этой неделе ниже прошлой (${last.pct}% vs ${prev.pct}%). Верните ритуал: минимум 3 минуты перед тренировкой.`;
  }
  if (last.pct > prev.pct + 20 && last.pct > 0) {
    return `Приверженность разминки выросла (${last.pct}% vs ${prev.pct}%) — отличный импульс, держите ритм.`;
  }
  return null;
}

export const WARMUP_SKIP_REASONS = ['не было времени', 'устал', 'забыл', 'зал был занят', 'другое'];

function isoOf(d: Date): string { return d.toISOString().slice(0, 10); }

/** Серия: сколько дней подряд разминка выполнялась (с сегодня или вчера, если сегодня ещё не отмечено). */
export function warmupStreak(): number {
  const log = loadWarmupLog();
  if (log.length === 0) return 0;
  const doneByDate = new Map(log.map(e => [e.date, e.done]));
  const today = new Date();
  let cursor = today;
  if (doneByDate.get(isoOf(cursor)) !== true) {
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    cursor = yesterday;
  }
  let streak = 0;
  while (doneByDate.get(isoOf(cursor)) === true) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface WarmupPerformanceLink {
  /** Корреляция Пирсона качества разминки ↔ e1RM сессии того же дня. */
  pearson: number | null;
  /** Средний e1RM по корзинам качества. */
  buckets: { level: 'low' | 'mid' | 'high'; range: string; avgE1RM: number; n: number }[];
  n: number;
}

function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length < 3 || xs.length !== ys.length) return null;
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return Math.round(num / Math.sqrt(dx * dy) * 100) / 100;
}

/** Связь качества разминки дня с лучшим e1RM сессии того же дня. */
export function correlateWarmupWithPerformance(sessions: { date: string; e1rm: number }[]): WarmupPerformanceLink {
  const byDate = new Map((sessions || []).map(s => [s.date, s.e1rm]));
  const pairs: { q: number; e1rm: number }[] = [];
  for (const e of loadWarmupLog()) {
    if (e.quality === null) continue;
    const perf = byDate.get(e.date);
    if (perf !== undefined && perf > 0) pairs.push({ q: e.quality, e1rm: perf });
  }
  const r = pearson(pairs.map(p => p.q), pairs.map(p => p.e1rm));
  const bucket = (level: 'low' | 'mid' | 'high', filter: (q: number) => boolean, range: string) => {
    const items = pairs.filter(p => filter(p.q));
    const avg = items.length > 0 ? Math.round(items.reduce((s, p) => s + p.e1rm, 0) / items.length) : 0;
    return { level, range, avgE1RM: avg, n: items.length };
  };
  return {
    pearson: r,
    buckets: [
      bucket('low', q => q <= 2, 'качество 1-2'),
      bucket('mid', q => q === 3, 'качество 3'),
      bucket('high', q => q >= 4, 'качество 4-5'),
    ],
    n: pairs.length,
  };
}

export function buildWarmupInsights(sessions?: { date: string; e1rm: number }[]): string[] {
  const out: string[] = [];
  const adh = warmupAdherence(30);
  if (adh.total >= 3) {
    if (adh.pct >= 80) out.push(`Разминка выполнена в ${adh.pct}% дней — отличная последовательность. Разминка снижает риск травм и повышает выходную силу.`);
    else if (adh.pct >= 50) out.push(`Разминка выполнена в ${adh.pct}% дней. Сократите её до 5-7 минут (общая + подходы 50%×10 → 70%×5) — короткая разминка выполняется чаще.`);
    else out.push(`Разминка выполнена только в ${adh.pct}% дней. Начните с минимума: 3 минуты джампинг-джек + разминочные подходы к первому упражнению.`);
  }
  const q = warmupQualityTrend(30);
  if (q.count >= 3) {
    if (q.avg <= 2.5) out.push(`Качество разминки ${q.avg}/5 — «по-быстрому». Добавьте мобильность целевых зон (бёдра/плечи/грудной) и суставную гимнастику.`);
    else if (q.avg >= 4) out.push(`Качество разминки ${q.avg}/5 — отлично. Поддерживайте ритм и следите за ощущениями в суставах.`);
  }
  const skipCounts: Record<string, number> = {};
  loadWarmupLog().slice(-30).forEach(e => { if (e.skippedReason) skipCounts[e.skippedReason] = (skipCounts[e.skippedReason] || 0) + 1; });
  const topSkip = Object.entries(skipCounts).sort((a, b) => b[1] - a[1])[0];
  if (topSkip && topSkip[1] >= 3) {
    out.push(`Частая причина пропуска разминки: «${topSkip[0]}» (${topSkip[1]} раз за 30 дней). Решение: делайте разминку первой в тренировке или сократите её до минимума.`);
  }
  const streak = warmupStreak();
  if (streak >= 3) out.push(`Серия: разминка выполнена ${streak} дней подряд — отличный ритм. Неделя без пропусков заметно снижает риск травм.`);
  const weeklyTrend = warmupWeeklyTrendInsight();
  if (weeklyTrend) out.push(weeklyTrend);
  if (Array.isArray(sessions) && sessions.length >= 3) {
    const link = correlateWarmupWithPerformance(sessions);
    if (link.n >= 3 && link.pearson !== null && Math.abs(link.pearson) >= 0.3) {
      out.push(`Связь качества разминки с e1RM сессии: r = ${link.pearson} (n=${link.n}). ${link.pearson > 0 ? 'Качественная разминка заметно влияет на рабочие веса — не сокращайте её.' : 'Обратная связь — проверьте сон/стресс и усталость в эти дни.'}`);
    }
  }
  if (out.length === 0) out.push('Пока мало данных: отмечайте разминку после тренировок — появятся приверженность и тренд качества.');
  return out;
}

export function exportWarmupCheckinsCSV(): string {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const rows: string[] = ['date,session_id,done,quality,done_items,total_items,skipped_reason,note'];
  for (const e of loadWarmupLog()) {
    rows.push([
      e.date,
      e.sessionId ? esc(e.sessionId) : '',
      e.done ? 1 : 0,
      e.quality === null ? '' : e.quality,
      e.doneItems === undefined ? '' : e.doneItems,
      e.totalItems === undefined ? '' : e.totalItems,
      e.skippedReason ? esc(e.skippedReason) : '',
      e.note ? esc(e.note) : '',
    ].join(','));
  }
  return rows.join('\n');
}
