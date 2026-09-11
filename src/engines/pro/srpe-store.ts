/**
 * srpe-store.ts — P12 wire: хранилище сессий с sRPE (session RPE × длительность) для
 * мониторинга тренировочной нагрузки (P3 training-load). localStorage, browser-only.
 */
export interface SRPESession { date: string; sRPE: number; durationMin: number; }
const KEY = 'he_srpe_sessions';

export function loadSRPESessions(): SRPESession[] {
  try { const raw = localStorage.getItem(KEY); if (!raw) return []; const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch { return []; }
}
export function saveSRPESession(s: SRPESession): void {
  try {
    const durationMin = Math.max(1, Math.round(s.durationMin || 1));
    const sRPE = Math.max(1, Math.min(10, Math.round(s.sRPE || 7)));
    const arr = loadSRPESessions();
    arr.push({ date: s.date, sRPE, durationMin });
    localStorage.setItem(KEY, JSON.stringify(arr.slice(-200)));
  } catch { /* ignore */ }
}
export function clearSRPESessions(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Точечная правка записи по индексу (валидация та же, что при сохранении). */
export function updateSRPESession(index: number, patch: Partial<SRPESession>): SRPESession[] {
  const arr = loadSRPESessions();
  if (index < 0 || index >= arr.length) return arr;
  const cur = arr[index];
  const next: SRPESession = {
    date: typeof patch.date === 'string' && patch.date ? patch.date : cur.date,
    sRPE: patch.sRPE !== undefined ? Math.max(1, Math.min(10, Math.round(patch.sRPE || 7))) : cur.sRPE,
    durationMin: patch.durationMin !== undefined ? Math.max(1, Math.round(patch.durationMin || 1)) : cur.durationMin,
  };
  arr[index] = next;
  try { localStorage.setItem(KEY, JSON.stringify(arr.slice(-200))); } catch { /* ignore */ }
  return arr.slice(-200);
}

/** Удаление одной записи по индексу. */
export function deleteSRPESession(index: number): SRPESession[] {
  const arr = loadSRPESessions();
  if (index < 0 || index >= arr.length) return arr;
  arr.splice(index, 1);
  try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch { /* ignore */ }
  return arr;
}

/** Импорт из дневника тренировок: [{date, overallRPE, duration}] → sRPE-записи (дедуп по дате+RPE+длительности). */
export function importSRPEFromDiary(entries: { date: string; overallRPE?: number; duration?: number; durationMin?: number }[]): { added: number; sessions: SRPESession[] } {
  const arr = loadSRPESessions();
  const has = new Set(arr.map(s => `${s.date}|${s.sRPE}|${s.durationMin}`));
  let added = 0;
  for (const e of entries) {
    if (!e || typeof e.date !== 'string' || !e.date) continue;
    const rawRpe = Math.round(e.overallRPE || 0);
    if (!rawRpe) continue; // без RPE (0/undefined) — не запись, а мусор
    const sRPE = Math.max(1, Math.min(10, rawRpe));
    const durationMin = Math.max(1, Math.round(e.durationMin ?? e.duration ?? 60));
    const key = `${e.date}|${sRPE}|${durationMin}`;
    if (has.has(key)) continue;
    has.add(key);
    arr.push({ date: e.date, sRPE, durationMin });
    added++;
  }
  try { localStorage.setItem(KEY, JSON.stringify(arr.slice(-200))); } catch { /* ignore */ }
  return { added, sessions: arr.slice(-200) };
}
