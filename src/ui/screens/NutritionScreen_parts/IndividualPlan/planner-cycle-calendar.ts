/**
 * planner-cycle-calendar.ts — Эпик 7 (NUTRITION-PROFESSIONAL-PLAN):
 * календарный расчёт фазы менструального цикла. Лог дат начала периода
 * (localStorage 'he_cycle_log') → средняя длина цикла → фаза на любую дату.
 * Ручной ввод фазы (cyclePhase) остаётся оверрайдом (приоритетнее календаря).
 *
 * Схема фаз (дни от начала периода, классическая 28-дневная, масштабируется
 * на фактическую длину):
 *   menstrual  — дни 1..5   (начало периода)
 *   follicular — дни 6..13  (эстроген растёт)
 *   ovulation  — дни 14..16 (пик эстрогена)
 *   luteal     — дни 17..N  (прогестерон; задержка воды/аппетит)
 */

import { isoAddDays, isoToday } from '../../../../engines/bb/bb-contest-prep.engine';
import type { MenstrualPhase } from './planner-female-cycle';

export const CYCLE_LOG_KEY = 'he_cycle_log';
export const MIN_CYCLE_LEN = 21;
export const MAX_CYCLE_LEN = 35;
export const DEFAULT_CYCLE_LEN = 28;

export interface CycleLogEntry { date: string; }

/** Сортированный список дат начала периодов (ASC). */
export function getCycleLog(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CYCLE_LOG_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .map((e: any) => (typeof e === 'string' ? e : (e && typeof e.date === 'string' ? e.date : null)))
      .filter((d: string | null): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
  } catch { return []; }
}

/** Добавить начало периода (дедуп по дате). */
export function saveCyclePeriod(dateISO: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return getCycleLog();
  const next = [...new Set([...getCycleLog(), dateISO])].sort();
  try { localStorage.setItem(CYCLE_LOG_KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function clearCycleLog(): void {
  try { localStorage.removeItem(CYCLE_LOG_KEY); } catch {}
}

/** Средняя длина цикла по интервалам лога (медиана; 21-35; дефолт 28). */
export function inferCycleLength(log?: string[]): number {
  const dates = log ?? getCycleLog();
  if (dates.length < 2) return DEFAULT_CYCLE_LEN;
  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const days = Math.round((new Date(dates[i] + 'T00:00:00Z').getTime() - new Date(dates[i - 1] + 'T00:00:00Z').getTime()) / 86400000);
    if (days >= MIN_CYCLE_LEN && days <= MAX_CYCLE_LEN) intervals.push(days);
  }
  if (intervals.length === 0) return DEFAULT_CYCLE_LEN;
  const sorted = [...intervals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

/** Фаза на дату относительно последнего начала периода. */
export function cyclePhaseForDate(
  lastPeriodStartISO: string,
  cycleLength: number,
  dateISO: string,
): MenstrualPhase {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastPeriodStartISO) || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return 'none';
  const len = Math.max(MIN_CYCLE_LEN, Math.min(MAX_CYCLE_LEN, cycleLength || DEFAULT_CYCLE_LEN));
  const startMs = new Date(lastPeriodStartISO + 'T00:00:00Z').getTime();
  const dateMs = new Date(dateISO + 'T00:00:00Z').getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(dateMs)) return 'none';
  const dayOfCycle = Math.floor((dateMs - startMs) / 86400000) % len + 1; // 1..len
  if (dayOfCycle <= 5) return 'menstrual';
  if (dayOfCycle <= 13) return 'follicular';
  if (dayOfCycle <= 16) return 'ovulation';
  return 'luteal';
}

/**
 * Авто-фаза из лога на дату (по умолчанию — сегодня).
 * Без лога — 'none'. Возвращает { phase, length, lastStart, source }.
 */
export function autoCyclePhase(log?: string[], dateISO?: string): { phase: MenstrualPhase; length: number; lastStart: string | null; source: 'calendar' | 'none' } {
  const dates = log ?? getCycleLog();
  const ref = dateISO ?? isoToday();
  if (dates.length === 0) return { phase: 'none', length: DEFAULT_CYCLE_LEN, lastStart: null, source: 'none' };
  const lastStart = dates[dates.length - 1];
  const length = inferCycleLength(dates);
  const phase = cyclePhaseForDate(lastStart, length, ref);
  return { phase, length, lastStart, source: phase === 'none' ? 'none' : 'calendar' };
}

/** RU-лейблы фаз (для подсказки календаря). */
export const CYCLE_PHASE_RU: Record<MenstrualPhase, string> = {
  none: 'Не указана',
  follicular: 'Фолликулярная',
  ovulation: 'Овуляция',
  luteal: 'Лютеиновая',
  menstrual: 'Менструация',
};