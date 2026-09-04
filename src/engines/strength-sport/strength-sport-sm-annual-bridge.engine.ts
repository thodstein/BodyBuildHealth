/**
 * strength-sport-sm-annual-bridge.engine.ts — ГОДОВОЙ СИНК СТРОНГМЕНА (SM PRO)
 *
 * Annual-training знает kind PL/BB/ARM/MANUAL (чужой модуль — не трогаем),
 * поэтому мост — односторонний overlay: недели SM спец-блока → фокусы фаз
 * в отдельном ключе `he_sm_annual_sync_v1` (дневник/годовой вид могут читать).
 * Parity с TA ta-annual-bridge. Чистый движок + storage-хелперы (try/catch).
 */

import type { SMSpecBlock } from './strength-sport-sm-spec-block.engine';
import type { SMWeakPoint } from './strength-sport-sm-biomechanics.engine';

export const SM_ANNUAL_SYNC_KEY = 'he_sm_annual_sync_v1';

export interface SMAnnualWeek {
  week: number; // 1-индекс года
  focus: SMWeakPoint[];
  note: string;
}

export interface SMAnnualSync {
  updatedAt: string;
  startWeek: number;
  weeks: SMAnnualWeek[];
}

/** Раскладка спец-блока по неделям года: startWeek..+total — фокус фаз, дальше — поддержание. */
export function buildSMAnnualOverlay(
  spec: SMSpecBlock | null | undefined,
  opts: { startWeek?: number; totalYearWeeks?: number } = {},
): SMAnnualWeek[] | null {
  if (!spec || !Array.isArray(spec.weeks) || spec.weeks.length === 0) return null;
  const start = Number.isInteger(opts.startWeek) && (opts.startWeek as number) > 0 ? (opts.startWeek as number) : 1;
  const totalYear =
    Number.isInteger(opts.totalYearWeeks) && (opts.totalYearWeeks as number) > 0
      ? Math.min(52, opts.totalYearWeeks as number)
      : Math.min(52, start - 1 + spec.totalWeeks);
  const out: SMAnnualWeek[] = [];
  for (let w = start; w <= totalYear; w++) {
    const si = w - start;
    const specWeek = spec.weeks[si];
    if (specWeek) {
      out.push({ week: w, focus: [...spec.weakPoints], note: `Стронг спец: ${specWeek.note}` });
    } else {
      out.push({ week: w, focus: [], note: 'Стронг: поддержание фаз' });
    }
  }
  return out;
}

export function saveSMAnnualOverlay(weeks: SMAnnualWeek[], startWeek = 1): boolean {
  try {
    if (!Array.isArray(weeks) || weeks.length === 0) return false;
    const payload: SMAnnualSync = { updatedAt: new Date().toISOString(), startWeek, weeks };
    localStorage.setItem(SM_ANNUAL_SYNC_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadSMAnnualOverlay(): SMAnnualSync | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SM_ANNUAL_SYNC_KEY) : null;
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.weeks)) return null;
    return obj as SMAnnualSync;
  } catch {
    return null;
  }
}
