/**
 * strength-sport-ta-pullpower-history.engine.ts — V5-П3: история мощности
 * второй тяги (снимки Вт + тренд), как у фаз/OHS/ножниц/двоеборья.
 * До этого мощность жила одним полем без динамики «было/стало».
 * Чистый движок + storage-хелперы.
 */

export interface TAPullPowerSnapshot {
  date: string; // yyyy-mm-dd
  watts: number;
}

export const TA_PULLPOWER_HIST_KEY = 'he_ta_pullpower_hist_v1';
const CAP = 60;

/** Добавить/заменить снимок дня (кап 60 новейших). Мусор → как есть, без гаданий. */
export function appendTAPullPower(hist: TAPullPowerSnapshot[], entry: TAPullPowerSnapshot): TAPullPowerSnapshot[] {
  const clean = (Array.isArray(hist) ? hist : []).filter(s => s && typeof s.date === 'string' && Number.isFinite(s.watts) && s.watts > 0);
  const w = Math.round(entry.watts);
  const next = [...clean.filter(s => s.date !== entry.date), { date: entry.date, watts: w }]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-CAP);
  return next;
}

export interface TAPullPowerTrend {
  n: number;
  deltaW: number;
  bestW: number;
  bestDate: string;
  text: string;
}

/** Тренд: последний vs первый + лучший (нужно ≥2; иначе null — не гадаем). */
export function taPullPowerTrend(hist: TAPullPowerSnapshot[]): TAPullPowerTrend | null {
  const clean = (Array.isArray(hist) ? hist : []).filter(s => s && typeof s.date === 'string' && Number.isFinite(s.watts) && s.watts > 0);
  if (clean.length < 2) return null;
  const sorted = [...clean].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = sorted[0], last = sorted[sorted.length - 1];
  const deltaW = last.watts - first.watts;
  let bestW = -Infinity, bestDate = '';
  for (const s of sorted) {
    if (s.watts > bestW) { bestW = s.watts; bestDate = s.date; }
  }
  return {
    n: sorted.length,
    deltaW,
    bestW,
    bestDate,
    text: `Мощность 2-й тяги (${sorted.length} зам.): ${deltaW >= 0 ? '+' : ''}${deltaW}Вт · лучшая ${bestW}Вт (${bestDate})`,
  };
}

export function loadTAPullPower(): TAPullPowerSnapshot[] {
  try {
    const raw = localStorage.getItem(TA_PULLPOWER_HIST_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(s => s && typeof s.date === 'string') : [];
  } catch { return []; }
}

export function saveTAPullPower(hist: TAPullPowerSnapshot[]): boolean {
  try {
    localStorage.setItem(TA_PULLPOWER_HIST_KEY, JSON.stringify(Array.isArray(hist) ? hist.slice(-CAP) : []));
    return true;
  } catch { return false; }
}
