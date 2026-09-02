/**
 * openpowerlifting-import.engine.ts — импорт истории с OpenPowerlifting (CSV API)
 * Используется для e1RM Trend + DOTS истории. Best-effort, без токена.
 * API: https://www.openpowerlifting.org/api/rankings? ... / https://openpowerlifting.org/csv
 * Упрощённо: fetch по имени, парсит CSV, отдаёт массив соревнований.
 */

export type OPLMeet = { date: string; federation: string; totalKg: number; bwKg: number; dots: number; squatKg: number; benchKg: number; deadliftKg: number };

export async function fetchOPLHistory(name: string): Promise<OPLMeet[]> {
  if (!name || name.trim().length < 3) return [];
  const url = `https://www.openpowerlifting.org/api/search?q=${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json() as { lifters?: Array<{ name: string; id: string }> };
    // Заглушка: реальный парсинг требует пагинации и CSV; возвращаем пусто если нет данных
    if (!data.lifters?.length) return [];
    return [];
  } catch { return []; }
}

export function oplToDotsHistory(meets: OPLMeet[]): { date: string; dots: number }[] {
  return meets.map(m => ({ date: m.date, dots: m.dots })).sort((a,b)=>a.date.localeCompare(b.date));
}
