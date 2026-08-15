import type { WarmupBlock } from '../core/types';
export type { WarmupBlock };

export interface WarmupInput {
  sessionFocus: string;
  primaryExercises: string[];
  riskFlags: Record<string, string>;
  techniqueIssues: string[];
  fatigueLevel: number;
  equipmentAvailable: string[];
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

  const mobilityExs = getMobilityExercises(input.sessionFocus, input.riskFlags);
  if (mobilityExs.length > 0) {
    blocks.push({
      type: 'mobility',
      durationSec: 180,
      exercises: mobilityExs,
      notes: 'Суставная подготовка',
    });
  }

  const activationExs = getActivationExercises(input.riskFlags, input.techniqueIssues, hasBand);
  if (activationExs.length > 0) {
    blocks.push({
      type: 'activation',
      durationSec: 180,
      exercises: activationExs,
      notes: 'Активация мышц',
    });
  }

  // Специальная: разминочные подходы по КАЖДОМУ основному упражнению (не только первому).
  // Рампа: первое упражнение 50/70/90%, второе 50/70%, остальные 50% (50%×5 → 70%×3 → 90%×1).
  const primaries = (input.primaryExercises || []).filter(Boolean).slice(0, 3);
  const specificExs: { exerciseId: string; sets: number; reps: number; intensityPct: number }[] = [];
  if (primaries.length === 0) {
    specificExs.push({ exerciseId: 'squat', sets: 3, reps: 5, intensityPct: 50 });
  } else {
    primaries.forEach((ex, i) => {
      const ramp = i === 0 ? [50, 70, 90] : i === 1 ? [50, 70] : [50];
      ramp.forEach(pct => {
        specificExs.push({ exerciseId: ex, sets: 1, reps: pct >= 90 ? 1 : pct >= 70 ? 3 : 5, intensityPct: pct });
      });
    });
  }
  blocks.push({
    type: 'specific',
    durationSec: 300,
    exercises: specificExs,
    notes: 'Разминочные подходы к рабочим весам',
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
  if (riskFlags['knee'] === 'high' || techniqueIssues.includes('knee_valgus')) {
    exs.push(hasBand
      ? { exerciseId: 'banded_clam', sets: 2, reps: 15 }
      : { exerciseId: 'side_lying_abduction', sets: 2, reps: 15 });
  }
  if (riskFlags['shoulder'] === 'high') {
    exs.push(hasBand
      ? { exerciseId: 'external_rotation', sets: 2, reps: 12 }
      : { exerciseId: 'wall_slide', sets: 2, reps: 10 });
  }
  if (techniqueIssues.includes('rounding_back')) {
    exs.push({ exerciseId: 'bird_dog', sets: 2, reps: 10 }, { exerciseId: 'dead_bug', sets: 1, reps: 10 });
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

export const WARMUP_SKIP_REASONS = ['не было времени', 'устал', 'забыл', 'зал был занят', 'другое'];

export function buildWarmupInsights(): string[] {
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
