/**
 * readiness-history.ts — история готовности (localStorage, одна запись в день).
 * Используется для прогноза (generateReadinessForecast) и визуализации тренда.
 */
const KEY = 'he_readiness_history';

export interface ReadinessHistoryPoint { date: string; recovery: number; fatigue: number; }

export function loadReadinessHistory(): ReadinessHistoryPoint[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

/** Добавляет/обновляет запись за сегодня (не дублирует дни, хранит до 90 дней). */
export function appendReadinessToday(recovery: number, fatigue: number): ReadinessHistoryPoint[] {
  const today = new Date().toISOString().slice(0, 10);
  const arr = loadReadinessHistory();
  const idx = arr.findIndex(p => p.date === today);
  const point: ReadinessHistoryPoint = { date: today, recovery: Math.round(recovery), fatigue: Math.round(fatigue) };
  if (idx >= 0) arr[idx] = point; else arr.push(point);
  const trimmed = arr.slice(-90);
  try { localStorage.setItem(KEY, JSON.stringify(trimmed)); } catch {}
  return trimmed;
}