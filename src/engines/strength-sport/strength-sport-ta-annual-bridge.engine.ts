/**
 * strength-sport-ta-annual-bridge.engine.ts — ГОДОВОЙ СИНК ТА (E16 PRO-v2)
 *
 * Annual-training знает kind PL/BB/ARM/MANUAL (чужой модуль — не трогаем),
 * поэтому мост — односторонний overlay: недели ТА спец-блока → фокусы фаз
 * в отдельном ключе `he_ta_annual_sync_v1` (дневник/годовой вид могут читать).
 * Полноценный kind 'TA' в annual-training — задача владельца модуля.
 * Чистый движок + storage-хелперы (try/catch).
 */

import type { TASpecBlock } from './strength-sport-ta-spec-block.engine';
import type { WLWeakPoint } from './strength-sport-weakpoint';

export const TA_ANNUAL_SYNC_KEY = 'he_ta_annual_sync_v1';

export interface TAAnnualWeek {
  week: number; // 1-индекс года
  focus: WLWeakPoint[];
  note: string;
}

export interface TAAnnualSync {
  updatedAt: string;
  startWeek: number;
  weeks: TAAnnualWeek[];
}

/**
 * Раскладка спец-блока по неделям года: недели startWeek..+total — фокус фаз,
 * дальше до totalYearWeeks — поддержание (пустой фокус).
 */
export function buildTAAnnualOverlay(
  spec: TASpecBlock | null | undefined,
  opts: { startWeek?: number; totalYearWeeks?: number } = {},
): TAAnnualWeek[] | null {
  if (!spec || !Array.isArray(spec.weeks) || spec.weeks.length === 0) return null;
  const start = Number.isInteger(opts.startWeek) && (opts.startWeek as number) > 0 ? (opts.startWeek as number) : 1;
  const totalYear = Number.isInteger(opts.totalYearWeeks) && (opts.totalYearWeeks as number) > 0
    ? Math.min(52, opts.totalYearWeeks as number)
    : Math.min(52, start - 1 + spec.totalWeeks);
  const out: TAAnnualWeek[] = [];
  for (let w = start; w <= totalYear; w++) {
    const si = w - start;
    const specWeek = spec.weeks[si];
    if (specWeek) {
      out.push({ week: w, focus: [...spec.weakPoints], note: `ТА спец: ${specWeek.note}` });
    } else {
      out.push({ week: w, focus: [], note: 'ТА: поддержание фаз' });
    }
  }
  return out;
}

export function saveTAAnnualOverlay(weeks: TAAnnualWeek[], startWeek = 1): boolean {
  try {
    if (!Array.isArray(weeks) || weeks.length === 0) return false;
    const payload: TAAnnualSync = { updatedAt: new Date().toISOString(), startWeek, weeks };
    localStorage.setItem(TA_ANNUAL_SYNC_KEY, JSON.stringify(payload));
    return true;
  } catch { return false; }
}

export function loadTAAnnualOverlay(): TAAnnualSync | null {
  try {
    const raw = localStorage.getItem(TA_ANNUAL_SYNC_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || !Array.isArray(j.weeks)) return null;
    return j as TAAnnualSync;
  } catch { return null; }
}
