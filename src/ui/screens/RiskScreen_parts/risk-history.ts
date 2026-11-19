/**
 * История нетто-риска по дням (localStorage) — страница «Динамика» экрана «Риск».
 *
 * Проход 159: ключ точки — календарный день человека, а не UTC-срез момента
 * (`toISOString().split('T')[0]`). В UTC+3…+12 утром UTC-дата ещё вчерашняя,
 * поэтому эффект записи видел «сегодня» уже занятым и новый день в историю не
 * попадал вовсе — до вечернего открытия экрана.
 *
 * Одна точка на день: `saveRiskHistory` заменяет точку той же даты. История —
 * это «состояние дня», а не журнал перерисовок экрана (второй снимок дня с
 * другими числами раньше дописывался рядом и уезжал в график отдельной точкой).
 */

import { localIsoDate } from '../../../core/local-date';

export const RISK_HISTORY_KEY = 'risk_history';
export const MAX_RISK_HISTORY = 12;

export interface RiskHistoryEntry {
  date: string;
  overallRaw: number;
  overallNet: number;
}

/** Дата, под которой сохраняется сегодняшний снимок, — местный календарь. */
export function riskHistoryDate(now: Date = new Date()): string {
  return localIsoDate(now);
}

const isEntry = (v: any): v is RiskHistoryEntry =>
  !!v
  && typeof v.date === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(v.date)
  && typeof v.overallRaw === 'number' && Number.isFinite(v.overallRaw)
  && typeof v.overallNet === 'number' && Number.isFinite(v.overallNet);

export function loadRiskHistory(): RiskHistoryEntry[] {
  try {
    const raw = localStorage.getItem(RISK_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Повреждённая запись не становится точкой «0 %»: считаем только полные дни.
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch { return []; }
}

export function saveRiskHistory(entry: RiskHistoryEntry): void {
  try {
    const history = loadRiskHistory().filter(h => h.date !== entry.date);
    history.push(entry);
    history.sort((a, b) => a.date.localeCompare(b.date));
    localStorage.setItem(RISK_HISTORY_KEY, JSON.stringify(history.slice(-MAX_RISK_HISTORY)));
  } catch {}
}
