/**
 * strength-sport-ta-phase-history.engine.ts — V5-V6: re-screen слабых фаз ТА.
 *
 * OHS/jerk-ножницы уже имеют снимки+тренд; слабые фазы жили только текущим
 * выбором. Здесь та же механика: снимок дат + набор фаз → тренд
 * «ушло / висит / новое» + напоминание о пересъёмке через 4–6 нед.
 * Чистый движок + storage-хелперы (паттерн ta-progress/ohs-hist).
 */

export interface TAPhaseSnapshot {
  date: string; // yyyy-mm-dd
  weakPoints: string[];
}

export const TA_PHASE_HIST_KEY = 'he_ta_phase_hist_v1';
const CAP = 30;

/** Добавить/заменить снимок дня (кап 30 новейших). */
export function appendTAPhaseSnapshot(hist: TAPhaseSnapshot[], entry: TAPhaseSnapshot): TAPhaseSnapshot[] {
  const clean = (Array.isArray(hist) ? hist : []).filter(s => s && typeof s.date === 'string' && Array.isArray(s.weakPoints));
  const next = [...clean.filter(s => s.date !== entry.date), { date: entry.date, weakPoints: [...new Set(entry.weakPoints)].slice(0, 6) }]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-CAP);
  return next;
}

export interface TAPhaseTrend {
  n: number;
  resolved: string[];
  persistent: string[];
  fresh: string[];
  text: string;
}

/** Тренд: первый снимок vs последний (нужно ≥2; иначе null — не гадаем). */
export function taPhaseTrend(hist: TAPhaseSnapshot[]): TAPhaseTrend | null {
  const clean = (Array.isArray(hist) ? hist : []).filter(s => s && typeof s.date === 'string' && Array.isArray(s.weakPoints));
  if (clean.length < 2) return null;
  const sorted = [...clean].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = new Set(sorted[0].weakPoints);
  const last = new Set(sorted[sorted.length - 1].weakPoints);
  const resolved = [...first].filter(x => !last.has(x));
  const persistent = [...first].filter(x => last.has(x));
  const fresh = [...last].filter(x => !first.has(x));
  const parts: string[] = [];
  if (resolved.length) parts.push(`ушло: ${resolved.join(', ')}`);
  if (persistent.length) parts.push(`висит: ${persistent.join(', ')}`);
  if (fresh.length) parts.push(`новое: ${fresh.join(', ')}`);
  return {
    n: sorted.length,
    resolved,
    persistent,
    fresh,
    text: parts.length ? `Фазы re-screen (${sorted.length} сн.): ${parts.join(' · ')}` : 'Фазы re-screen: состав без изменений',
  };
}

export function loadTAPhaseHistory(): TAPhaseSnapshot[] {
  try {
    const raw = localStorage.getItem(TA_PHASE_HIST_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(s => s && typeof s.date === 'string') : [];
  } catch { return []; }
}

export function saveTAPhaseHistory(hist: TAPhaseSnapshot[]): boolean {
  try {
    localStorage.setItem(TA_PHASE_HIST_KEY, JSON.stringify(Array.isArray(hist) ? hist.slice(-CAP) : []));
    return true;
  } catch { return false; }
}
