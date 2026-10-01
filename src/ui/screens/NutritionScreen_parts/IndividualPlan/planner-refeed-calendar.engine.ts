/**
 * planner-refeed-calendar.engine.ts — календарь рефидов и диет-брейков на несколько недель вперёд
 * (общий, вне контест-препа). Для сушки/рекомпа: рефид-дни (калории до поддержания, углеводы
 * вверх) каждые N дней и диет-брейки (1 неделя на поддержании) каждые M недель — по науке
 * (Campbell 2021, Byrne 2018 MATADOR, Trexler 2014, Peos 2021 — приверженность/лептин/гормоны).
 * Чистая функция.
 */

import { shiftIsoDate } from '../../../../core/local-date';

export interface RefeedCalendarInput {
  goal: string;
  /** Стартовая дата (локальный ISO yyyy-mm-dd), обычно сегодня. */
  startDate: string;
  horizonWeeks: number;
  bodyFatPct?: number | null;
}

export interface RefeedWeek {
  weekIndex: number;
  dateStart: string;
  dateEnd: string;
  isDietBreak: boolean;
  /** Даты рефид-дней в этой неделе (локальный ISO). */
  refeedDates: string[];
  note: string;
}

export interface RefeedCalendar {
  mode: 'cut' | 'recomp' | 'none';
  weeks: RefeedWeek[];
  refeedCount: number;
  dietBreakWeeks: number;
  notes: string[];
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Календарь рефидов/диет-брейков. Только для целей с дефицитом (cutting/fat_loss/recomposition);
 * для массы/поддержания — пусто (mode 'none').
 */
export function buildRefeedCalendar(input: RefeedCalendarInput): RefeedCalendar {
  const goal = String(input.goal || '').toLowerCase();
  const mode: RefeedCalendar['mode'] = (goal === 'cutting' || goal === 'fat_loss') ? 'cut'
    : goal === 'recomposition' ? 'recomp' : 'none';
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(input.startDate)) ? input.startDate : '';
  const horizon = clamp(Math.round(input.horizonWeeks || 8), 1, 26);
  const empty: RefeedCalendar = { mode, weeks: [], refeedCount: 0, dietBreakWeeks: 0, notes: [] };
  if (mode === 'none' || !start) {
    if (mode === 'none') empty.notes.push('Рефиды/диет-брейки применяются только в дефиците (сушка/рекомпозиция).');
    return empty;
  }

  const bf = Number.isFinite(input.bodyFatPct as number) ? (input.bodyFatPct as number) : null;
  // Частота рефидов: суше атлет — чаще (риск лептиновой адаптации); больше жира — реже.
  const refeedEveryDays = bf == null ? 10 : bf < 10 ? 7 : bf < 15 ? 9 : bf < 20 ? 11 : 14;
  // Диет-брейк: 1 неделя на поддержании каждые M недель (MATADOR-стиль); суше — чаще.
  const breakEveryWeeks = bf != null && bf < 12 ? 8 : 10;

  const weeks: RefeedWeek[] = [];
  let refeedCount = 0;
  let dietBreakWeeks = 0;
  for (let w = 0; w < horizon; w++) {
    const dateStart = shiftIsoDate(start, w * 7);
    const dateEnd = shiftIsoDate(start, w * 7 + 6);
    const isDietBreak = (w + 1) % breakEveryWeeks === 0; // каждая M-я неделя — на поддержании
    const refeedDates: string[] = [];
    if (!isDietBreak) {
      for (let d = 0; d < 7; d++) {
        const offset = w * 7 + d;
        if (offset > 0 && offset % refeedEveryDays === 0) refeedDates.push(shiftIsoDate(start, offset));
      }
    }
    if (isDietBreak) dietBreakWeeks++;
    refeedCount += refeedDates.length;
    const note = isDietBreak
      ? '🏖 Диет-брейк: 1 неделя на поддержании (калории = поддержание) — восстановление лептина/гормонов/приверженности, затем дефицит продолжаем.'
      : refeedDates.length > 0
        ? `🔄 Рефид ${refeedDates.length} дн: калории до поддержания, углеводы ×2, жиры на полу — гликоген/лептин.`
        : '';
    weeks.push({ weekIndex: w + 1, dateStart, dateEnd, isDietBreak, refeedDates, note });
  }

  const notes: string[] = [
    `🔄 Рефид каждые ~${refeedEveryDays} дн, диет-брейк — 1 неделя каждые ${breakEveryWeeks} нед (Campbell 2021 / MATADOR 2018).`,
    'Рефид-день: калории к поддержанию, углеводы ×2, жиры ниже (мод «Рефид» в периодизации). Диет-брейк — ровно поддержание без читмила.',
  ];
  if (bf != null && bf < 10) notes.push('⚠ Низкий % жира — рефиды чаще, но без «откатов»: следите за средним весом за 7 дней.');
  return { mode, weeks, refeedCount, dietBreakWeeks, notes };
}
