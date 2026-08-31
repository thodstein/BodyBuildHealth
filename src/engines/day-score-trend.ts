/**
 * day-score-trend.ts — тренд скора качества дня (доп. функция 1).
 *
 * Хранение дневных скоров (localStorage `he_day_score_history`, кап 90 записей)
 * и чистый расчёт тренда: средние за 7 и 30 дней, дельта и направление.
 */
export interface DayScoreRecord {
  date: string;
  score: number;
}

export interface DayScoreTrend {
  avg7: number;
  avg30: number;
  delta: number;
  direction: 'up' | 'down' | 'flat';
  has30: boolean;
}

const KEY = 'he_day_score_history';
const CAP = 90;

export function loadDayScores(): DayScoreRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((r: any) => r && typeof r.date === 'string' && Number.isFinite(r.score));
  } catch { return []; }
}

export function clearDayScores(): void {
  try { localStorage.removeItem(KEY); } catch {}
}

export function addDayScore(date: string, score: number): void {
  if (!Number.isFinite(score)) return;
  try {
    const list = loadDayScores();
    const next = [...list.filter(r => r.date !== date), { date, score: Math.max(0, Math.min(10, Math.round(score * 10) / 10)) }]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .slice(-CAP);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

const mean = (xs: number[]) => xs.length > 0 ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;

export function computeDayScoreTrend(scores: DayScoreRecord[]): DayScoreTrend {
  const sorted = [...scores].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const last7 = sorted.slice(-7).map(r => r.score);
  const last30 = sorted.slice(-30).map(r => r.score);
  const avg7 = Math.round(mean(last7) * 10) / 10;
  const avg30 = Math.round(mean(last30) * 10) / 10;
  const delta = Math.round((avg7 - avg30) * 10) / 10;
  const has30 = last30.length >= 7;
  const direction: DayScoreTrend['direction'] = delta > 0.3 ? 'up' : delta < -0.3 ? 'down' : 'flat';
  return { avg7, avg30, delta, direction, has30 };
}
