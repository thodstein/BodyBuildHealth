/**
 * combat-annual-bridge.engine.ts — P9 annual-мост диагностики (overlay, не сборка).
 * Паттерн 1-в-1 с TA/SM-мостами: annual-training знает только PL/BB/ARM/MANUAL,
 * поэтому overlay живёт в отдельном ключе и никуда не встраивается без владельца.
 * Вход — CombatSpecBlock из combat-correction; выход — недели с нотами фокуса/дней.
 */
import type { CombatSpecBlock } from './combat-correction.engine';

export const CB_ANNUAL_SYNC_KEY = 'he_cb_annual_sync_v1';

export interface CBAnnualWeek {
  week: number;
  focus: string[];
  note: string;
}

export interface CBAnnualSync {
  updatedAt: number;
  startWeek: number;
  weeks: CBAnnualWeek[];
}

/** Overlay спец-блока на год: недели старта..+weeks несут фокус/дни, хвост — поддержание. */
export function buildCBAnnualOverlay(
  spec: CombatSpecBlock | null,
  opts?: { startWeek?: number; totalYearWeeks?: number },
): CBAnnualWeek[] | null {
  if (!spec || !spec.focus.length) return null;
  const start = Math.max(1, opts?.startWeek ?? 1);
  const total = Math.min(52, Math.max(spec.weeks, opts?.totalYearWeeks ?? 52));
  const weeks: CBAnnualWeek[] = [];
  for (let w = start; w <= total; w++) {
    const idx = w - start;
    if (idx < spec.weeks) {
      const days = Object.entries(spec.dayMap)
        .filter(([k]) => spec.focus.includes(k))
        .map(([k, v]) => `${k}: дни ${(v as number[]).join('+')}`)
        .join('; ');
      weeks.push({
        week: w,
        focus: [...spec.focus],
        note: `Combat спец: ${spec.focus.join(', ')}${days ? ` (${days})` : ''}`,
      });
    } else {
      weeks.push({ week: w, focus: [], note: 'Combat: поддержание фаз' });
    }
  }
  return weeks;
}

export function saveCBAnnualOverlay(weeks: CBAnnualWeek[], startWeek: number): void {
  try {
    const payload: CBAnnualSync = { updatedAt: Date.now(), startWeek, weeks };
    localStorage.setItem(CB_ANNUAL_SYNC_KEY, JSON.stringify(payload));
  } catch { /* ignore */ }
}

export function loadCBAnnualOverlay(): CBAnnualSync | null {
  try {
    const raw = localStorage.getItem(CB_ANNUAL_SYNC_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<CBAnnualSync>;
    if (!Array.isArray(j.weeks)) return null;
    return { updatedAt: typeof j.updatedAt === 'number' ? j.updatedAt : 0, startWeek: j.startWeek ?? 1, weeks: j.weeks };
  } catch {
    return null;
  }
}
