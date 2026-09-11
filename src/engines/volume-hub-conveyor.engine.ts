/**
 * volume-hub-conveyor.engine.ts — конвейер хаба объёма (P6).
 *
 * Реальная логика без заглушек:
 *  1. Импорт строк из дневника (`he_workout_log_v1`/`he_training_log` → VolumeHubRow).
 *  2. Снапшоты `he_volume_history` (кап 10) + сравнение A/B (Δ).
 *  3. Экспорт HTML (XSS-esc) + CSV (защита от формульных инъекций).
 */

import { getExerciseById, EXERCISE_CATALOG } from '../core/exercise-catalog';

export interface VolumeHubRow {
  exerciseId: string;
  day: number;   // 1-7
  week: number;  // 1-based
  weight: number;
  reps: number;
  sets: number;
  rpe?: number;
  oneRM?: number;
}

export interface DiaryImportResult {
  rows: VolumeHubRow[];
  sessions: number;
  skipped: number;
}

function resolveDiaryExerciseId(s: string): string | null {
  const q = (s || '').toLowerCase().trim();
  if (!q) return null;
  const byId = getExerciseById(q) as { id?: string } | undefined;
  if (byId?.id) return byId.id;
  const exact = EXERCISE_CATALOG.find(e => e.name.toLowerCase() === q || e.id.toLowerCase() === q);
  if (exact) return exact.id;
  const incl = EXERCISE_CATALOG.find(e => e.name.toLowerCase().includes(q) || q.includes(e.name.toLowerCase()));
  return incl ? incl.id : null;
}

/** День недели Пн=1..Вс=7 из ISO-даты (локально, без UTC-сдвига). */
export function weekdayMon1(isoDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return ((d.getDay() + 6) % 7) + 1;
}

/**
 * Импорт строк из сессий дневника за последние `days` дней.
 * Честно пропускает упражнения без маппинга в каталог (skipped), не выдумывает.
 */
export function importRowsFromDiary(
  sessions: unknown,
  opts?: { days?: number; now?: number },
): DiaryImportResult {
  const days = Math.max(1, opts?.days ?? 7);
  const now = opts?.now ?? Date.now();
  const arr = Array.isArray(sessions) ? sessions : [];
  const rows: VolumeHubRow[] = [];
  let skipped = 0;
  let used = 0;
  for (const s of arr) {
    const ses = s as { date?: string; exercises?: unknown };
    const day = ses?.date ? weekdayMon1(ses.date) : null;
    const t = ses?.date ? new Date(ses.date).getTime() : 0;
    if (!day || !t || now - t > days * 24 * 3600 * 1000 || now - t < -24 * 3600 * 1000) continue;
    used++;
    const exs = Array.isArray(ses.exercises) ? ses.exercises : [];
    for (const e of exs) {
      const ex = e as { exerciseId?: string; name?: string; muscleGroup?: string; muscle?: string; sets?: unknown };
      const id = resolveDiaryExerciseId(String(ex?.exerciseId || ex?.name || ''));
      const setsArr = Array.isArray(ex?.sets) ? (ex.sets as Array<{ weightKg?: number; weight?: number; reps?: number; rpe?: number }>) : [];
      if (!id || setsArr.length === 0) {
        skipped++;
        continue;
      }
      let best = setsArr[0];
      for (const st of setsArr) {
        if ((st.weightKg ?? st.weight ?? 0) > (best.weightKg ?? best.weight ?? 0)) best = st;
      }
      rows.push({
        exerciseId: id,
        day,
        week: 1,
        weight: Math.max(0, best.weightKg ?? best.weight ?? 0),
        reps: Math.max(0, best.reps ?? 0),
        sets: setsArr.length,
        rpe: typeof best.rpe === 'number' ? best.rpe : undefined,
      });
    }
  }
  return { rows, sessions: used, skipped };
}

// ═══════════════════════════════════════════════════════════════════════════
// Снапшоты he_volume_history (кап 10) + сравнение
// ═══════════════════════════════════════════════════════════════════════════

export const VOLUME_HISTORY_KEY = 'he_volume_history';
const VOLUME_HISTORY_CAP = 10;

export interface VolumeSnapshot {
  id: number;
  at: number;
  level: string;
  totalSets: number;
  totalTonnage: number;
  byGroup: Record<string, number>;
  rows: VolumeHubRow[];
}

function readSnapshots(): VolumeSnapshot[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(VOLUME_HISTORY_KEY) : null;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function loadVolumeSnapshots(): VolumeSnapshot[] {
  return readSnapshots();
}

let volumeSnapSeq = 0;

export function saveVolumeSnapshot(
  rows: VolumeHubRow[],
  level: string,
  summary: { totalSets: number; totalTonnage: number; byGroup: Record<string, number> },
): VolumeSnapshot[] {
  // id обязан быть уникальным даже при серии сохранений в одну мс (иначе remove сносит всё)
  const snap: VolumeSnapshot = {
    id: Date.now() * 1000 + ((volumeSnapSeq = (volumeSnapSeq + 1) % 1000)), at: Date.now(), level,
    totalSets: summary.totalSets, totalTonnage: Math.round(summary.totalTonnage),
    byGroup: summary.byGroup, rows: rows.map(r => ({ ...r })),
  };
  const arr = [snap, ...readSnapshots()].slice(0, VOLUME_HISTORY_CAP);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(VOLUME_HISTORY_KEY, JSON.stringify(arr));
  } catch { /* quota — молча, UI покажет тост через flash вызывателя */ }
  return arr;
}

export function removeVolumeSnapshot(id: number): VolumeSnapshot[] {
  const arr = readSnapshots().filter(s => s.id !== id);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(VOLUME_HISTORY_KEY, JSON.stringify(arr));
  } catch { /* ignore */ }
  return arr;
}

export interface SnapshotDelta {
  setsDelta: number;
  tonnageDelta: number;
  groupDelta: Array<{ group: string; before: number; after: number; delta: number }>;
}

/** Δ снапшот (before) → текущие строки (after). */
export function compareVolumeSnapshot(
  before: VolumeSnapshot,
  afterRows: VolumeHubRow[],
): SnapshotDelta {
  const afterByGroup: Record<string, number> = {};
  let afterSets = 0;
  let afterTon = 0;
  for (const r of afterRows) {
    const ex = getExerciseById(r.exerciseId) as { group?: string } | undefined;
    const g = ex?.group || 'other';
    afterByGroup[g] = (afterByGroup[g] || 0) + (r.sets || 0);
    afterSets += r.sets || 0;
    afterTon += (r.weight || 0) * (r.reps || 0) * (r.sets || 0);
  }
  const groups = new Set([...Object.keys(before.byGroup), ...Object.keys(afterByGroup)]);
  const groupDelta = [...groups].map(group => {
    const b = before.byGroup[group] || 0;
    const a = afterByGroup[group] || 0;
    return { group, before: b, after: a, delta: a - b };
  }).filter(x => x.delta !== 0).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  return { setsDelta: afterSets - before.totalSets, tonnageDelta: Math.round(afterTon - before.totalTonnage), groupDelta };
}

// ═══════════════════════════════════════════════════════════════════════════
// Экспорт: HTML (XSS-esc) + CSV (анти-формула)
// ═══════════════════════════════════════════════════════════════════════════

export function escapeHtmlVolume(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** CSV-ячейка с защитой от формульных инъекций Excel (= + - @ → префикс '). */
export function csvCellVolume(v: string | number): string {
  const s = String(v);
  const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function buildVolumeCsv(rows: VolumeHubRow[]): string {
  const head = ['exercise', 'day', 'week', 'weight', 'reps', 'sets', 'rpe', 'tonnage'].map(csvCellVolume).join(',');
  const lines = rows.map(r => {
    const ex = getExerciseById(r.exerciseId) as { name?: string } | undefined;
    const ton = (r.weight || 0) * (r.reps || 0) * (r.sets || 0);
    return [ex?.name || r.exerciseId, r.day, r.week, r.weight, r.reps, r.sets, r.rpe ?? '', ton].map(csvCellVolume).join(',');
  });
  return ['\uFEFF' + head, ...lines].join('\n');
}

export function buildVolumeHtml(
  rows: VolumeHubRow[],
  meta: { level: string; at?: number },
): string {
  const totSets = rows.reduce((a, r) => a + (r.sets || 0), 0);
  const totTon = rows.reduce((a, r) => a + (r.weight || 0) * (r.reps || 0) * (r.sets || 0), 0);
  const body = rows.map(r => {
    const ex = getExerciseById(r.exerciseId) as { name?: string; group?: string } | undefined;
    return `<tr><td>${escapeHtmlVolume(ex?.name || r.exerciseId)}</td><td>${escapeHtmlVolume(ex?.group || '')}</td><td>${r.day}</td><td>${r.weight}</td><td>${r.reps}</td><td>${r.sets}</td><td>${r.rpe ?? ''}</td></tr>`;
  }).join('');
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Объём-хаб — сводка</title></head><body>` +
    `<h1>Объём-хаб — сводка (${escapeHtmlVolume(meta.level)})</h1>` +
    `<p>Подходов: ${totSets} · Тоннаж: ${Math.round(totTon).toLocaleString('ru-RU')} кг·повт</p>` +
    `<table border="1" cellpadding="4"><thead><tr><th>Упражнение</th><th>Группа</th><th>День</th><th>Вес</th><th>Повт</th><th>Сеты</th><th>RPE</th></tr></thead><tbody>${body}</tbody></table>` +
    `</body></html>`;
}
