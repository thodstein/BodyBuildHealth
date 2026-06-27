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
  try { const arr = loadSRPESessions(); arr.push(s); localStorage.setItem(KEY, JSON.stringify(arr.slice(-200))); } catch { /* ignore */ }
}
export function clearSRPESessions(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
