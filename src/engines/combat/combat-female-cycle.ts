/**
 * combat-female-cycle.ts — Э5.7: женская модуляция по фазе менструального цикла.
 *
 * ПАРИТЕТ С ПЛАНИРОВЩИКОМ ПИТАНИЯ (`IndividualPlan/planner-cycle-calendar.ts`):
 * те же границы фаз и та же схема определения (дни 1-5 менструальная, 6-13
 * фолликулярная, 14-16 овуляция, 17+ лютеиновая, длина — медиана интервалов
 * лога 21-35, дефолт 28). Источник лога — тот же ключ `he_cycle_log`, так что
 * женщина ведёт календарь один раз для питания и для зала.
 *
 * ЧЕСТНОСТЬ: модуляция применяется ТОЛЬКО при `sex==='female'` И наличии фазы
 * из лога. Нет лога — ноль изменений (байт-в-байт). Числа модуляции — не
 * «наука из воздуха»: лютеиновая фаза — плановое снижение объёма и запас до
 * отказа (PMS/терморегуляция/задержка воды), менструальная — лёгкая неделя без
 * отказа. Это приложение к тренировке осторожной стороны, а не догма: строка с
 * фактическими процентами уходит в rationale плана.
 */

/** Фаза цикла (без 'none' — отсутствие данных моделируется null). */
export type CombatCyclePhase = 'follicular' | 'ovulation' | 'luteal' | 'menstrual';

export const COMBAT_CYCLE_LOG_KEY = 'he_cycle_log';
export const COMBAT_MIN_CYCLE_LEN = 21;
export const COMBAT_MAX_CYCLE_LEN = 35;
export const COMBAT_DEFAULT_CYCLE_LEN = 28;

export interface CombatCycleModulation {
  /** Множитель рабочих сетов (1 = без изменений). */
  volumeMult: number;
  /** Добавка к RIR (осторожность). */
  rirAdd: number;
  /** Пол RIR — «без отказа» (менструальная). */
  rirMin: number | null;
  /** Лёгкая неделя (менструальная) — для подписи. */
  lightWeek: boolean;
  /** Честная строка для rationale. */
  note: string;
}

/** Модуляция по фазе. Фолликулярная/овуляция — норма (1.0, без строки). */
export function cycleModulationFor(phase: CombatCyclePhase | 'none' | null | undefined): CombatCycleModulation | null {
  if (phase === 'luteal') {
    return {
      volumeMult: 0.93,
      rirAdd: 1,
      rirMin: null,
      lightWeek: false,
      note: '🌙 Лютеиновая фаза: объём −7%, RIR +1 — плановое снижение (PMS/задержка воды/терморегуляция); не отказ',
    };
  }
  if (phase === 'menstrual') {
    return {
      volumeMult: 0.90,
      rirAdd: 1,
      rirMin: 3,
      lightWeek: true,
      note: '🩸 Менструальная фаза: лёгкая неделя — объём −10%, RIR ≥3 (без отказа)',
    };
  }
  return null;
}

/** Сортированный список дат начала периодов (ASC). Битый стор — пусто. */
export function getCombatCycleLog(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(COMBAT_CYCLE_LOG_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .map((e: any) => (typeof e === 'string' ? e : (e && typeof e.date === 'string' ? e.date : null)))
      .filter((d: string | null): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
  } catch { return []; }
}

/** Средняя длина цикла по интервалам (медиана, 21-35, дефолт 28). */
export function inferCombatCycleLength(log?: string[]): number {
  const dates = log ?? getCombatCycleLog();
  if (dates.length < 2) return COMBAT_DEFAULT_CYCLE_LEN;
  const intervals: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const days = Math.round((new Date(dates[i] + 'T00:00:00Z').getTime() - new Date(dates[i - 1] + 'T00:00:00Z').getTime()) / 86400000);
    if (days >= COMBAT_MIN_CYCLE_LEN && days <= COMBAT_MAX_CYCLE_LEN) intervals.push(days);
  }
  if (!intervals.length) return COMBAT_DEFAULT_CYCLE_LEN;
  const sorted = [...intervals].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

/** Фаза на дату относительно последнего начала периода (паритет с planner-cycle-calendar). */
export function combatCyclePhaseForDate(
  lastPeriodStartISO: string,
  cycleLength: number,
  dateISO: string,
): CombatCyclePhase | 'none' {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastPeriodStartISO) || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return 'none';
  const len = Math.max(COMBAT_MIN_CYCLE_LEN, Math.min(COMBAT_MAX_CYCLE_LEN, cycleLength || COMBAT_DEFAULT_CYCLE_LEN));
  const startMs = new Date(lastPeriodStartISO + 'T00:00:00Z').getTime();
  const dateMs = new Date(dateISO + 'T00:00:00Z').getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(dateMs)) return 'none';
  const dayOfCycle = ((Math.floor((dateMs - startMs) / 86400000) % len) + len) % len + 1; // 1..len
  if (dayOfCycle <= 5) return 'menstrual';
  if (dayOfCycle <= 13) return 'follicular';
  if (dayOfCycle <= 16) return 'ovulation';
  return 'luteal';
}

/** Локальная ISO-дата (без UTC-сдвига). */
function localIsoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface CombatAutoCyclePhase {
  phase: CombatCyclePhase | 'none';
  length: number;
  lastStart: string | null;
  source: 'calendar' | 'none';
}

/**
 * Авто-фаза из лога `he_cycle_log` на дату (по умолчанию — сегодня).
 * Без лога — 'none' (модуляция не применяется вовсе).
 */
export function autoCombatCyclePhase(log?: string[], dateISO?: string): CombatAutoCyclePhase {
  const dates = log ?? getCombatCycleLog();
  const ref = dateISO ?? localIsoToday();
  if (dates.length === 0) return { phase: 'none', length: COMBAT_DEFAULT_CYCLE_LEN, lastStart: null, source: 'none' };
  const lastStart = dates[dates.length - 1];
  const length = inferCombatCycleLength(dates);
  const phase = combatCyclePhaseForDate(lastStart, length, ref);
  return { phase, length, lastStart, source: phase === 'none' ? 'none' : 'calendar' };
}

export const COMBAT_CYCLE_PHASE_RU: Record<CombatCyclePhase | 'none', string> = {
  none: 'Не указана',
  follicular: 'Фолликулярная',
  ovulation: 'Овуляция',
  luteal: 'Лютеиновая',
  menstrual: 'Менструация',
};
