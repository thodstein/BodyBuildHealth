/**
 * openpowerlifting-import.engine.ts — импорт истории с OpenPowerlifting (CSV API)
 * Используется для e1RM Trend + DOTS истории. Best-effort, без токена.
 * API: https://www.openpowerlifting.org/api/rankings? ... / https://openpowerlifting.org/csv
 * Упрощённо: fetch по имени, парсит CSV, отдаёт массив соревнований.
 */

export type OPLMeet = { date: string; federation: string; totalKg: number; bwKg: number; dots: number; squatKg: number; benchKg: number; deadliftKg: number };

export async function fetchOPLHistory(name: string): Promise<OPLMeet[]> {
  if (!name || name.trim().length < 3) return [];
  // 1. Поиск атлета
  try {
    const searchUrl = `https://www.openpowerlifting.org/api/search?q=${encodeURIComponent(name)}`;
    const sRes = await fetch(searchUrl);
    if (sRes.ok) {
      const data = await sRes.json() as { lifters?: Array<{ name: string; id: string }> };
      if (data.lifters?.length) {
        const id = data.lifters[0].id;
        // 2. CSV история
        const csvUrl = `https://www.openpowerlifting.org/api/liftercsv/${encodeURIComponent(id)}`;
        const cRes = await fetch(csvUrl);
        if (cRes.ok) {
          const csv = await cRes.text();
          return parseOPLCsv(csv);
        }
      }
    }
  } catch { /* fallback */ }
  // Fallback: пробуем прямой CSV по имени (некоторые прокси)
  try {
    const csvUrl2 = `https://www.openpowerlifting.org/u/${encodeURIComponent(name)}/lifts.csv`;
    const r2 = await fetch(csvUrl2);
    if (r2.ok) return parseOPLCsv(await r2.text());
  } catch {}
  return [];
}

export function parseOPLCsv(csv: string): OPLMeet[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h=>h.trim().toLowerCase());
  const idx = (k: string) => header.indexOf(k);
  const iDate = idx('date'), iFed = idx('federation'), iTotal = idx('total'), iBw = idx('bodyweightkg'), iDots = idx('dots'), iSq = idx('bestsquatkg'), iBp = idx('bestbenchkg'), iDl = idx('bestdeadliftkg');
  const out: OPLMeet[] = [];
  for (let i=1;i<lines.length;i++) {
    const cols = lines[i].split(',');
    if (!cols[iDate]) continue;
    out.push({
      date: cols[iDate]?.trim(),
      federation: cols[iFed]?.trim() ?? '',
      totalKg: Number(cols[iTotal])||0,
      bwKg: Number(cols[iBw])||0,
      dots: Number(cols[iDots])||0,
      squatKg: Number(cols[iSq])||0,
      benchKg: Number(cols[iBp])||0,
      deadliftKg: Number(cols[iDl])||0,
    });
  }
  return out.filter(m=>m.date && m.totalKg>0);
}

export function oplToDotsHistory(meets: OPLMeet[]): { date: string; dots: number }[] {
  return meets.map(m => ({ date: m.date, dots: m.dots })).sort((a,b)=>a.date.localeCompare(b.date));
}
