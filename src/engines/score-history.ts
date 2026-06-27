// ── Score History — сохранение и отслеживание метрик Score Engine ──

export interface ScoreSnapshot {
  date: string;
  modules: Record<string, { overallRaw: number; systemCount: number }>;
}

const STORAGE_KEY = 'he_score_history';

export function getScoreHistory(): ScoreSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveScoreSnapshot(snapshot: ScoreSnapshot): void {
  const history = getScoreHistory();
  // Replace existing entry for today, or add new
  const existingIdx = history.findIndex(h => h.date === snapshot.date);
  if (existingIdx >= 0) {
    history[existingIdx] = snapshot;
  } else {
    history.unshift(snapshot);
  }
  // Keep last 90 days
  const trimmed = history.slice(0, 90);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function getScoreTrend(moduleKey: string, days: number = 14): Array<{ date: string; value: number }> {
  const history = getScoreHistory().slice(0, days);
  return history
    .filter(h => h.modules[moduleKey])
    .map(h => ({ date: h.date, value: h.modules[moduleKey].overallRaw }))
    .reverse();
}

export function clearScoreHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
