/**
 * planner-work.ts — единый учёт рабочего графика.
 *
 * Ранее логика «рабочий ли день» была тремя разными копиями в IndividualPlanContext:
 *  - generatePlan: standard/sliding/custom по dow+offset, shift_day_night (offset%4<2),
 *    shift_N_M (цикл работа/отдых) — полная;
 *  - add/quick-add: только workDays[idx%7] — БЕЗ смен (дыра: на сменах «хлопья на работе»
 *    не включались).
 * Здесь один источник. Смены считаются от индекса (offset/dayIdx), календарные — от дня недели.
 */

export type WorkDayResolver = (index: number) => boolean;

/** Сменный график по индексу. null — если тип НЕ сменный (решает вызывающий). */
export function resolveShiftWorkDay(index: number, scheduleType?: string): boolean | null {
  const ws = String(scheduleType || '');
  const off = ((Math.trunc(index) % 100000) + 100000) % 100000;
  if (ws === 'shift_day_night') return (off % 4) < 2;
  const m = /^shift_(\d+)_(\d+)$/.exec(ws);
  if (m) {
    const workLen = Math.max(1, parseInt(m[1], 10) || 1);
    const offLen = Math.max(1, parseInt(m[2], 10) || workLen);
    const cycle = workLen + offLen;
    return (off % cycle) < workLen;
  }
  return null;
}

/**
 * Рабочий ли день на индексе (offset для generatePlan, dayIdx для add/quick-add).
 * `dowBase` — день недели индекса 0 (Пн=0), по умолчанию сегодня.
 */
export function isWorkDayForIndex(
  index: number,
  opts: { enabled: boolean; scheduleType?: string; workDays: boolean[]; dowBase?: number },
): boolean {
  if (!opts.enabled) return false;
  const shift = resolveShiftWorkDay(index, opts.scheduleType);
  if (shift !== null) return shift;
  const dowBase = typeof opts.dowBase === 'number' ? opts.dowBase : (new Date().getDay() + 6) % 7;
  const i = ((Math.trunc(index) % 7) + 7) % 7;
  return !!opts.workDays[(dowBase + i) % 7];
}
