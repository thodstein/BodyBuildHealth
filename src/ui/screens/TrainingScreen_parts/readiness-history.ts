/**
 * readiness-history.ts — история готовности (localStorage, одна запись в день).
 * Используется для прогноза (generateReadinessForecast) и визуализации тренда.
 *
 * Контракт честности (E4): чужой/битый стор не должен ронять хаб (раньше `JSON.parse` отдавался
 * как есть — объект/число из старого или частично записанного хранилища ломали `.map` в хабе),
 * а дата записи считается ЛОКАЛЬНО (UTC-дата вечером/ночью уезжала на «завтра»).
 */
const KEY = 'he_readiness_history';

export interface ReadinessHistoryPoint { date: string; recovery: number; fatigue: number; }

/** Локальная календарная дата YYYY-MM-DD (не UTC — иначе вечером пишется «завтра»). */
function localIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const isIsoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Читает историю и отбрасывает всё, что не является записью (битый JSON/объект/мусорные поля). */
export function loadReadinessHistory(): ReadinessHistoryPoint[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const out: ReadinessHistoryPoint[] = [];
    for (const p of raw) {
      if (!p || typeof p !== 'object') continue;
      const rec = num((p as any).recovery);
      const fat = num((p as any).fatigue);
      if (!isIsoDate((p as any).date) || rec == null || fat == null) continue;
      out.push({ date: (p as any).date, recovery: Math.round(rec), fatigue: Math.round(fat) });
    }
    return out;
  } catch { return []; }
}

/** Добавляет/обновляет запись за сегодня (не дублирует дни, хранит до 90 дней). */
export function appendReadinessToday(recovery: number, fatigue: number): ReadinessHistoryPoint[] {
  const today = localIso();
  const arr = loadReadinessHistory();
  const idx = arr.findIndex(p => p.date === today);
  const rec = num(recovery) ?? 50;
  const fat = num(fatigue) ?? 30;
  const point: ReadinessHistoryPoint = { date: today, recovery: Math.round(rec), fatigue: Math.round(fat) };
  if (idx >= 0) arr[idx] = point; else arr.push(point);
  const trimmed = arr.slice(-90);
  try { localStorage.setItem(KEY, JSON.stringify(trimmed)); } catch { /* квота/приватный режим — не критично */ }
  return trimmed;
}
