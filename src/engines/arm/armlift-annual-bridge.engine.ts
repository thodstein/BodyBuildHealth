/**
 * armlift-annual-bridge.engine.ts — ROUND-10: годовой синк армлифтинга.
 * Parity с SM (`buildSMAnnualOverlay`) и ТА: недели спец-блока → фокусы фаз года
 * в отдельном ключе `he_armlift_annual_sync_v1` (годовой вид/дневник могут читать).
 * Чистый движок + storage-хелперы (try/catch).
 */
import type { ArmliftSpecWeek } from './armlift-correction.engine';

export const ARMLIFT_ANNUAL_SYNC_KEY = 'he_armlift_annual_sync_v1';

export interface ArmliftAnnualWeek {
  week: number; // 1-индекс года
  focus: string[];
  note: string;
}

export interface ArmliftAnnualSync {
  updatedAt: string;
  startWeek: number;
  weeks: ArmliftAnnualWeek[];
}

/** Раскладка спец-блока по неделям года: startWeek..+total — фокус, дальше — поддержание. */
export function buildArmliftAnnualOverlay(
  spec: ArmliftSpecWeek[] | null | undefined,
  opts: { startWeek?: number; totalYearWeeks?: number; focus?: string[] } = {},
): ArmliftAnnualWeek[] | null {
  if (!Array.isArray(spec) || spec.length === 0) return null;
  const start = Number.isInteger(opts.startWeek) && (opts.startWeek as number) > 0 ? (opts.startWeek as number) : 1;
  const totalYear =
    Number.isInteger(opts.totalYearWeeks) && (opts.totalYearWeeks as number) > 0
      ? Math.min(52, opts.totalYearWeeks as number)
      : Math.min(52, start - 1 + spec.length);
  const focus = (opts.focus || []).filter(Boolean);
  const out: ArmliftAnnualWeek[] = [];
  for (let w = start; w <= totalYear; w++) {
    const specWeek = spec[w - start];
    if (specWeek) {
      out.push({ week: w, focus: [...focus], note: `Армлифтинг спец: ${specWeek.target || specWeek.focus}` });
    } else {
      out.push({ week: w, focus: [], note: 'Армлифтинг: поддержание фаз' });
    }
  }
  return out;
}

export function saveArmliftAnnualOverlay(weeks: ArmliftAnnualWeek[], startWeek = 1): boolean {
  try {
    if (!Array.isArray(weeks) || weeks.length === 0) return false;
    const payload: ArmliftAnnualSync = { updatedAt: new Date().toISOString(), startWeek, weeks };
    localStorage.setItem(ARMLIFT_ANNUAL_SYNC_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadArmliftAnnualOverlay(): ArmliftAnnualSync | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(ARMLIFT_ANNUAL_SYNC_KEY) : null;
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.weeks)) return null;
    return obj as ArmliftAnnualSync;
  } catch {
    return null;
  }
}
