import type { CooldownBlock } from '../core/types';
import { collectGroupCooldown, prepGroupLabelsCooldown } from './cooldown-day.engine';
export type { CooldownBlock };
export interface CooldownInput {
  muscleGroupsUsed: string[];
  fatigueScore: number;
  riskFlags: Record<string, string>;
  sessionDuration: number;
  /** Целевые группы тренировочного дня (muscleGroup упражнений плана) — упор растяжки. */
  targetGroups?: string[];
}

/** Канонические русские названия упражнений заминки (единый словарь). */
export const COOLDOWN_LABELS: Record<string, string> = {
  deep_breathing: 'Глубокое дыхание (диафрагмальное)',
  box_breathing: 'Квадратное дыхание (4-4-4-4)',
  chest_stretch: 'Растяжка груди',
  shoulder_stretch: 'Растяжка плеч',
  lat_stretch: 'Растяжка широчайших',
  hamstring_stretch: 'Растяжка задней поверхности бедра',
  quad_stretch: 'Растяжка квадрицепса',
  glute_stretch: 'Растяжка ягодиц (поза голубя)',
  child_pose: 'Поза ребёнка',
  cat_camel: 'Кошка-корова',
  nerve_flossing: 'Нейро-мобилизация',
  bicep_stretch: 'Растяжка бицепса',
  triceps_stretch: 'Растяжка трицепса',
  wrist_stretch: 'Растяжка запястья (разгибатели)',
  calf_stretch: 'Растяжка икр',
  side_bend: 'Наклон в сторону',
  neck_cars: 'CARs шеи',
  trap_stretch: 'Растяжка трапеций',
  wrist_flex_ext: 'Сгибание-разгибание кисти',
};

/** Русское название упражнения заминки с fallback на id. */
export function cooldownLabel(exerciseId: string): string {
  return COOLDOWN_LABELS[exerciseId] || exerciseId;
}

export function generateCooldown(input: CooldownInput): CooldownBlock[] {
  const blocks: CooldownBlock[] = [];

  blocks.push({
    type: 'breathing',
    durationSec: 120,
    exercises: [
      { exerciseId: 'deep_breathing', durationSec: 60 },
      { exerciseId: 'box_breathing', durationSec: 60 },
    ],
  });

  // Лёгкое кардио-заминка после длинных сессий: плавное снижение пульса
  if (input.sessionDuration > 3600) {
    blocks.push({
      type: 'cardio',
      durationSec: 180,
      exercises: [{ exerciseId: 'light_cardio', durationSec: 180 }],
      notes: 'Медленный темп: пульс плавно к покою',
    });
  }

  // Упор на целевые группы дня (если переданы), иначе — фокус-эвристика
  const targetGroups = (input.targetGroups || []).filter(Boolean);
  const groupStretch = targetGroups.length > 0 ? collectGroupCooldown(targetGroups) : null;
  const stretchExs: { exerciseId: string; durationSec: number }[] = groupStretch
    ? groupStretch.map(e => ({ exerciseId: e.id, durationSec: e.durationSec }))
    : getStretchExercises(input.muscleGroupsUsed, input.riskFlags);
  if (Object.values(input.riskFlags).includes('high') && !stretchExs.some(e => e.exerciseId === 'nerve_flossing')) {
    stretchExs.push({ exerciseId: 'nerve_flossing', durationSec: 45 });
  }
  if (stretchExs.length > 0) {
    const totalStretch = stretchExs.reduce((s, e) => s + e.durationSec, 0);
    blocks.push({
      type: 'stretch',
      // Длительность по факту: сумма упражнений, но не меньше 120с и не больше 360с
      durationSec: Math.max(120, Math.min(360, totalStretch)),
      exercises: stretchExs,
      notes: groupStretch ? `Растяжка рабочих зон: ${prepGroupLabelsCooldown(targetGroups)}` : undefined,
    });
  }

  if (input.fatigueScore > 0.6 || input.sessionDuration > 5400) {
    blocks.push({
      type: 'mobility',
      durationSec: 180,
      exercises: [
        { exerciseId: 'child_pose', durationSec: 60 },
        { exerciseId: 'cat_camel', durationSec: 60 },
        { exerciseId: 'shoulder_stretch', durationSec: 60 },
      ],
    });
  }

  return blocks;
}

function getStretchExercises(muscleGroups: string[], riskFlags: Record<string, string>): { exerciseId: string; durationSec: number }[] {
  const exs: { exerciseId: string; durationSec: number }[] = [];
  if (muscleGroups.includes('chest') || muscleGroups.includes('shoulders')) {
    exs.push({ exerciseId: 'chest_stretch', durationSec: 30 }, { exerciseId: 'shoulder_stretch', durationSec: 30 });
  }
  if (muscleGroups.includes('back') || muscleGroups.includes('legs')) {
    exs.push({ exerciseId: 'lat_stretch', durationSec: 30 }, { exerciseId: 'hamstring_stretch', durationSec: 30 });
  }
  if (muscleGroups.includes('legs')) {
    exs.push({ exerciseId: 'quad_stretch', durationSec: 30 }, { exerciseId: 'glute_stretch', durationSec: 30 });
  }
  if (Object.values(riskFlags).includes('high')) {
    exs.push({ exerciseId: 'nerve_flossing', durationSec: 60 });
  }
  return exs;
}

// ═══════════════════════════════════════════════════════════════════════════
// Дневник заминки (факт: выполнена/качество/причины пропуска)
// ═══════════════════════════════════════════════════════════════════════════

export const COOLDOWN_DIARY_KEY = 'he_cooldown_diary';
export const COOLDOWN_DIARY_CAP = 365;

export interface CooldownLogEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  sessionId?: string;
  /** Заминка выполнена (полностью или частично). */
  done: boolean;
  /** Качество заминки 1-5 (null = не оценено). */
  quality: number | null;
  totalItems?: number;
  doneItems?: number;
  skippedReason?: string;
  note?: string;
}

export interface CooldownAdherence {
  done: number;
  total: number;
  pct: number;
}

export interface CooldownQualityTrend {
  series: { date: string; quality: number }[];
  avg: number;
  count: number;
}

export function sanitizeCooldownLog(raw: any): CooldownLogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(raw.date)) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `cd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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

export function loadCooldownLog(): CooldownLogEntry[] {
  const list = readJSON(COOLDOWN_DIARY_KEY)
    .map(sanitizeCooldownLog)
    .filter((e): e is CooldownLogEntry => !!e)
    .sort((a, b) => a.date.localeCompare(b.date));
  return list.slice(-COOLDOWN_DIARY_CAP);
}

/** Upsert по дате (одна запись на день). Возвращает полный лог. */
export function upsertCooldownLog(input: Omit<CooldownLogEntry, 'id'>): CooldownLogEntry[] {
  const list = loadCooldownLog();
  const date = input.date.slice(0, 10);
  const idx = list.findIndex(e => e.date === date);
  const entry: CooldownLogEntry = {
    id: idx >= 0 ? list[idx].id : `cd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
  writeJSON(COOLDOWN_DIARY_KEY, list);
  return loadCooldownLog();
}

export function latestCooldownLog(): CooldownLogEntry | null {
  const list = loadCooldownLog();
  return list.length > 0 ? list[list.length - 1] : null;
}

/** Приверженность: доля дней с выполненной заминкой за N дней. */
export function cooldownAdherence(days = 30): CooldownAdherence {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const floor = since.toISOString().slice(0, 10);
  const recent = loadCooldownLog().filter(e => e.date >= floor);
  const done = recent.filter(e => e.done).length;
  return {
    done,
    total: recent.length,
    pct: recent.length > 0 ? Math.round(done / recent.length * 100) : 0,
  };
}

export function cooldownQualityTrend(days = 30): CooldownQualityTrend {
  const list = loadCooldownLog()
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

/** Запись заминки для даты (для бейджей). */
export function cooldownLogForDate(date: string): CooldownLogEntry | null {
  return loadCooldownLog().find(e => e.date === date.slice(0, 10)) || null;
}

export const COOLDOWN_SKIP_REASONS = ['не было времени', 'устал', 'забыл', 'нужно уходить', 'другое'];

function isoOf(d: Date): string { return d.toISOString().slice(0, 10); }

function isoAddDays(date: string, days: number): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Серия: сколько дней подряд заминка выполнялась (с сегодня или вчера). */
export function cooldownStreak(): number {
  const log = loadCooldownLog();
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

export interface CooldownReadinessLink {
  /** Корреляция Пирсона качества заминки ↔ готовность (recovery) на следующий день. */
  pearson: number | null;
  /** Средняя готовность на следующий день по корзинам качества. */
  buckets: { level: 'low' | 'mid' | 'high'; range: string; avgRecovery: number; n: number }[];
  n: number;
}

function cooldownPearson(xs: number[], ys: number[]): number | null {
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

/** Связь качества заминки дня с готовностью (recovery 0-100) на следующий день. */
export function correlateCooldownWithReadiness(readiness: { date: string; recovery: number }[]): CooldownReadinessLink {
  const recoveryByDate = new Map((readiness || []).map(r => [r.date, r.recovery]));
  const pairs: { q: number; recovery: number }[] = [];
  for (const e of loadCooldownLog()) {
    if (e.quality === null) continue;
    const rec = recoveryByDate.get(isoAddDays(e.date, 1));
    if (rec !== undefined && rec > 0) pairs.push({ q: e.quality, recovery: rec });
  }
  const r = cooldownPearson(pairs.map(p => p.q), pairs.map(p => p.recovery));
  const bucket = (level: 'low' | 'mid' | 'high', filter: (q: number) => boolean, range: string) => {
    const items = pairs.filter(p => filter(p.q));
    const avg = items.length > 0 ? Math.round(items.reduce((s, p) => s + p.recovery, 0) / items.length) : 0;
    return { level, range, avgRecovery: avg, n: items.length };
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

export function buildCooldownInsights(readiness?: { date: string; recovery: number }[]): string[] {
  const out: string[] = [];
  const adh = cooldownAdherence(30);
  if (adh.total >= 3) {
    if (adh.pct >= 80) out.push(`Заминка выполнена в ${adh.pct}% дней — отличная последовательность. Растяжка рабочих зон снижает DOMS и ускоряет восстановление.`);
    else if (adh.pct >= 50) out.push(`Заминка выполнена в ${adh.pct}% дней. Сократите её до 5 минут (дыхание + растяжка рабочих зон) — короткая заминка выполняется чаще.`);
    else out.push(`Заминка выполнена только в ${adh.pct}% дней. Начните с минимума: 2 минуты дыхания + 3 растяжки рабочих групп.`);
  }
  const q = cooldownQualityTrend(30);
  if (q.count >= 3) {
    if (q.avg <= 2.5) out.push(`Качество заминки ${q.avg}/5 — «по-быстрому». Добавьте паузы 20-40 сек в крайней точке и дыхание в растяжение.`);
    else if (q.avg >= 4) out.push(`Качество заминки ${q.avg}/5 — отлично. Держите ритм: регулярная растяжка сохраняет ROM и снижает жёсткость.`);
  }
  const skipCounts: Record<string, number> = {};
  loadCooldownLog().slice(-30).forEach(e => { if (e.skippedReason) skipCounts[e.skippedReason] = (skipCounts[e.skippedReason] || 0) + 1; });
  const topSkip = Object.entries(skipCounts).sort((a, b) => b[1] - a[1])[0];
  if (topSkip && topSkip[1] >= 3) {
    out.push(`Частая причина пропуска заминки: «${topSkip[0]}» (${topSkip[1]} раз за 30 дней). Решение: делайте заминку прямо в зале до душа — 5 минут.`);
  }
  const streak = cooldownStreak();
  if (streak >= 3) out.push(`Серия: заминка выполнена ${streak} дней подряд — отличный ритм восстановления.`);
  if (Array.isArray(readiness) && readiness.length >= 3) {
    const link = correlateCooldownWithReadiness(readiness);
    if (link.n >= 3 && link.pearson !== null && Math.abs(link.pearson) >= 0.3) {
      out.push(`Связь качества заминки с готовностью на следующий день: r = ${link.pearson} (n=${link.n}). ${link.pearson > 0 ? 'Качественная заминка окупается — готовность завтра выше.' : 'Обратная связь — проверьте сон/питание.'}`);
    }
  }
  if (out.length === 0) out.push('Пока мало данных: отмечайте заминку после тренировок — появятся приверженность и тренд качества.');
  return out;
}

export function exportCooldownCheckinsCSV(): string {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const rows: string[] = ['date,session_id,done,quality,done_items,total_items,skipped_reason,note'];
  for (const e of loadCooldownLog()) {
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
