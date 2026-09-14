/**
 * combat-tracker-import.engine.ts — P4 импорт панч-трекеров с дисклеймером.
 * Hykso / Corner / StrikeTec CSV → объём + скорость + тип. Трекер НЕ даёт силу —
 * только скорость/объём (JSCR 2023: r 0.28–0.43, test-retest none–excellent,
 * StrikeTec пропускает удары). Ручные замеры приоритетнее. Чистые функции.
 */

export type CombatTrackerBrand = 'hykso' | 'corner' | 'striketec' | 'unknown';

export interface CombatTrackerPunch {
  type: string;
  speedMs: number | null;
}

export interface CombatTrackerImport {
  brand: CombatTrackerBrand;
  punches: CombatTrackerPunch[];
  total: number;
  avgSpeedMs: number | null;
  disclaimer: string;
}

export const TRACKER_DISCLAIMER =
  'Трекер — ориентир, не истина (JSCR 2023: связь со силой r 0.28–0.43, пропуски ударов). Силу трекер не измеряет — только скорость и объём.';

function num(v: string): number | null {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function detectBrand(header: string): CombatTrackerBrand {
  const h = header.toLowerCase();
  if (h.includes('hykso')) return 'hykso';
  if (h.includes('corner')) return 'corner';
  if (h.includes('striketec') || h.includes('strike_tec') || h.includes('strike-tec')) return 'striketec';
  return 'unknown';
}

/** Парсит CSV трекера: ищет колонки типа удара и скорости. Мусор → пустой список, не throw. */
export function parseCombatTrackerCsv(csvText: string): CombatTrackerImport {
  const empty: CombatTrackerImport = { brand: 'unknown', punches: [], total: 0, avgSpeedMs: null, disclaimer: TRACKER_DISCLAIMER };
  if (!csvText || !csvText.trim()) return empty;
  const lines = csvText.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length < 2) return empty;
  const semi = (lines[0].match(/;/g) || []).length;
  const comm = (lines[0].match(/,/g) || []).length;
  const delim = semi > comm ? ';' : ',';
  const cols = lines[0].split(delim).map(s => s.trim().toLowerCase());
  const brand = detectBrand(lines[0]);
  const idxType = cols.findIndex(c => c.includes('type') || c.includes('punch') || c.includes('тип') || c.includes('удар'));
  const idxSpeed = cols.findIndex(c => c.includes('speed') || c.includes('velo') || c.includes('скор') || c.includes('м/с') || c === 'm/s');
  const punches: CombatTrackerPunch[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map(s => s.trim());
    if (cells.length < 2) continue;
    const type = idxType >= 0 ? (cells[idxType] || 'unknown') : 'unknown';
    const speedMs = idxSpeed >= 0 ? num(cells[idxSpeed] ?? '') : null;
    punches.push({ type, speedMs });
  }
  const speeds = punches.map(p => p.speedMs).filter((v): v is number => v != null && v > 0);
  return {
    brand,
    punches,
    total: punches.length,
    avgSpeedMs: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null,
    disclaimer: TRACKER_DISCLAIMER,
  };
}

/** Слияние: ручная скорость приоритетнее трекера; трекер даёт объём и среднюю. */
export function mergeTrackerWithManual(
  tracker: CombatTrackerImport, manualSpeedMs?: number | null,
): { speedMs: number | null; source: 'manual' | 'tracker' | 'none'; volume: number } {
  if (manualSpeedMs != null && Number.isFinite(manualSpeedMs) && manualSpeedMs > 0) {
    return { speedMs: manualSpeedMs, source: 'manual', volume: tracker.total };
  }
  if (tracker.avgSpeedMs != null) return { speedMs: tracker.avgSpeedMs, source: 'tracker', volume: tracker.total };
  return { speedMs: null, source: 'none', volume: tracker.total };
}
