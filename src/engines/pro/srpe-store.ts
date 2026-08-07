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
