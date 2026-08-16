/**
 * Stretch Session Engine — самостоятельная сессия растяжки.
 *
 * По фокусу (всё тело / ноги / верх / спина / бёдра) и длительности собирает
 * план растяжки из cooldown-day.engine (статическая растяжка рабочих зон,
 * 2 подхода, пауза 20-40с). Подходит для дней отдыха и глубокой заминки.
 *
 * Лог сессий (he_stretch_sessions): дата, фокус, минуты, выполнено, качество.
 * Статистика: счётчик, суммарные минуты, минуты по неделям.
 *
 * @module stretch-session-engine
 */

import { collectGroupCooldown } from './cooldown-day.engine';
import { cooldownLabel } from './cooldown.engine';

export type StretchFocus = 'fullbody' | 'legs' | 'upper' | 'back' | 'hips';

export interface StretchFocusDef {
  id: StretchFocus;
  label: string;
  icon: string;
  groups: string[];
  hint: string;
}

export const STRETCH_FOCUSES: StretchFocusDef[] = [
  { id: 'fullbody', label: 'Всё тело', icon: '🧘', groups: ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders'], hint: 'Растяжка всех рабочих зон' },
  { id: 'legs', label: 'Ноги', icon: '🦵', groups: ['quads', 'hamstrings', 'glutes', 'calves'], hint: 'Квадрицепсы, задняя поверхность, ягодицы, икры' },
  { id: 'upper', label: 'Верх', icon: '💪', groups: ['chest', 'back', 'shoulders', 'biceps', 'triceps'], hint: 'Грудь, спина, плечи, руки' },
  { id: 'back', label: 'Спина и кор', icon: '🫀', groups: ['back', 'core'], hint: 'Широчайшие, поясница, кор' },
  { id: 'hips', label: 'Бёдра и ягодицы', icon: '🦿', groups: ['hamstrings', 'glutes', 'quads'], hint: 'Глубокая растяжка нижней зоны' },
];

export interface StretchExercise {
  id: string;
  durationSec: number;
  /** Подходов (статическая — 2×20-40с; PNF — контракт-релакс). */
  sets: number;
  type: 'static' | 'pnf';
  note?: string;
}

export interface StretchBlock {
  /** Подпись блока (мышечная зона). */
  label: string;
  exercises: StretchExercise[];
}

export interface StretchSessionPlan {
  focus: StretchFocus;
  focusLabel: string;
  durationMin: number;
  blocks: StretchBlock[];
  totalSec: number;
}

/** Статическая растяжка: 2 подхода по 20-40с. PNF-вариант для бицепса бедра/груди. */
const SETS_BY_ID: Record<string, { sets: number; type: 'static' | 'pnf' }> = {
  hamstring_stretch: { sets: 2, type: 'static' },
  nerve_flossing: { sets: 1, type: 'static' },
  chest_stretch: { sets: 2, type: 'static' },
  quad_stretch: { sets: 2, type: 'static' },
  glute_stretch: { sets: 2, type: 'static' },
  lat_stretch: { sets: 2, type: 'static' },
  shoulder_stretch: { sets: 2, type: 'static' },
  child_pose: { sets: 2, type: 'static' },
  cat_camel: { sets: 1, type: 'static' },
  side_bend: { sets: 2, type: 'static' },
  calf_stretch: { sets: 2, type: 'static' },
  bicep_stretch: { sets: 2, type: 'static' },
  triceps_stretch: { sets: 2, type: 'static' },
  wrist_stretch: { sets: 2, type: 'static' },
  neck_cars: { sets: 1, type: 'static' },
  trap_stretch: { sets: 2, type: 'static' },
  wrist_flex_ext: { sets: 2, type: 'static' },
};

export function stretchExerciseLabel(id: string): string {
  return cooldownLabel(id);
}

/** Собрать сессию растяжки: заполняем упражнениями до лимита времени. */
export function buildStretchSession(focusId: StretchFocus, durationMin = 15): StretchSessionPlan {
  const focus = STRETCH_FOCUSES.find(f => f.id === focusId) || STRETCH_FOCUSES[0];
  const targetSec = Math.max(5, Math.min(60, Math.round(durationMin) || 15)) * 60;
  const all = collectGroupCooldown(focus.groups);
  const blocks: StretchBlock[] = [];
  let totalSec = 0;
  for (const ex of all) {
    const meta = SETS_BY_ID[ex.id] || { sets: 2, type: 'static' as const };
    const itemSec = ex.durationSec * meta.sets;
    if (totalSec + itemSec > targetSec && blocks.length > 0) break;
    blocks.push({
      label: stretchExerciseLabel(ex.id),
      exercises: [{
        id: ex.id,
        durationSec: ex.durationSec,
        sets: meta.sets,
        type: meta.type,
        note: ex.note,
      }],
    });
    totalSec += itemSec;
  }
  if (blocks.length === 0) {
    const fallback = [
      { id: 'hamstring_stretch', durationSec: 40 },
      { id: 'chest_stretch', durationSec: 40 },
      { id: 'child_pose', durationSec: 45 },
    ];
    for (const ex of fallback) {
      blocks.push({ label: stretchExerciseLabel(ex.id), exercises: [{ id: ex.id, durationSec: ex.durationSec, sets: 2, type: 'static' }] });
      totalSec += ex.durationSec * 2;
    }
  }
  return {
    focus: focus.id,
    focusLabel: focus.label,
    durationMin: Math.round(targetSec / 60),
    blocks,
    totalSec,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Лог сессий растяжки
// ═══════════════════════════════════════════════════════════════════════════

export const STRETCH_LOG_KEY = 'he_stretch_sessions';

export interface StretchLogEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  focus: StretchFocus;
  durationMin: number;
  done: boolean;
  quality: number | null;
  note?: string;
}

export interface StretchStats {
  count: number;
  totalMin: number;
  weekMin: number;
  lastDate: string | null;
}

export function sanitizeStretchLog(raw: any): StretchLogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(raw.date)) return null;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date: raw.date.slice(0, 10),
    focus: STRETCH_FOCUSES.some(f => f.id === raw.focus) ? raw.focus : 'fullbody',
    durationMin: typeof raw.durationMin === 'number' && Number.isFinite(raw.durationMin) ? Math.max(1, Math.round(raw.durationMin)) : 10,
    done: !!raw.done,
    quality: typeof raw.quality === 'number' && raw.quality >= 1 && raw.quality <= 5 ? Math.round(raw.quality) : null,
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

export function loadStretchLog(): StretchLogEntry[] {
  const list = readJSON(STRETCH_LOG_KEY)
    .map(sanitizeStretchLog)
    .filter((e): e is StretchLogEntry => !!e)
    .sort((a, b) => a.date.localeCompare(b.date));
  return list.slice(-200);
}

/** Upsert по дате (одна сессия в день). Возвращает полный лог. */
export function upsertStretchLog(input: Omit<StretchLogEntry, 'id'>): StretchLogEntry[] {
  const list = loadStretchLog();
  const date = input.date.slice(0, 10);
  const idx = list.findIndex(e => e.date === date);
  const entry: StretchLogEntry = {
    id: idx >= 0 ? list[idx].id : `st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    date,
    focus: STRETCH_FOCUSES.some(f => f.id === input.focus) ? input.focus : 'fullbody',
    durationMin: Math.max(1, Math.round(input.durationMin) || 10),
    done: !!input.done,
    quality: typeof input.quality === 'number' && input.quality >= 1 && input.quality <= 5 ? Math.round(input.quality) : null,
    note: typeof input.note === 'string' && input.note.trim() ? input.note.trim() : undefined,
  };
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  writeJSON(STRETCH_LOG_KEY, list);
  return loadStretchLog();
}

export function stretchLogForDate(date: string): StretchLogEntry | null {
  return loadStretchLog().find(e => e.date === date.slice(0, 10)) || null;
}

/** Статистика: всего сессий/минут, минуты за текущую неделю (Пн-начало). */
export function stretchStats(): StretchStats {
  const log = loadStretchLog();
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  const floor = `${y}-${m}-${d}`;
  const done = log.filter(e => e.done);
  return {
    count: done.length,
    totalMin: done.reduce((s, e) => s + e.durationMin, 0),
    weekMin: done.filter(e => e.date >= floor).reduce((s, e) => s + e.durationMin, 0),
    lastDate: done.length > 0 ? done[done.length - 1].date : null,
  };
}
