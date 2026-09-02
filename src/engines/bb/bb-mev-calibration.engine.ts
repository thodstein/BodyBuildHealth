/**
 * bb-mev-calibration.engine.ts — Personal MEV Finder (Epic A, план BB-AUTO-PROFESSIONAL-AUDIT).
 *
 * Протокол калибровки личного Minimum Effective Volume (RP-парадигма Israetel):
 *  - старт с популяционного MEV−2 на каждую мышцу;
 *  - каждую неделю +1 рабочий сет на мышцу, ПОКА сигнал восстановления не деградирует;
 *  - сигнал деградации: soreness ≥3/5 ИЛИ performance <3/5 (pump ≥3 считается нормой для роста);
 *  - при 2 подряд неделях деградации (или завершении всего мезо) — фиксируем MEV =
 *    сеты последней недели БЕЗ деградации;
 *  - результат переживает пересборку и используется buildBBVolumeTarget как оверрайд
 *    популяционной таблицы (внутри существующих капов, потолок MRV не растёт выше +30%).
 *
 * Капы НЕ меняются (см. план §3): калибровка — персонализация нижней границы
 * внутри sessionLimitsFor, не сдвиг потолка.
 */

import { getVolumeLandmarks, normMuscle, type MuscleVolumeLandmarks } from '../volume-landmarks.engine';

/** Сигнал недели калибровки (0-5 шкалы, как в RP-вопросах). */
export interface MEVSignal {
  /** Качество накачки/стимула: 0-5. 3+ = достаточный стимул (норма). */
  pump: number;
  /** Крепатура: 0-5. 2 = норма, 3+ = повышенная (сигнал деградации). */
  soreness: number;
  /** Относительная производительность к ожидаемой: 0-5. 3 = на уровне. <3 = падение. */
  performance: number;
}

/** Заполненная неделя калибровки. */
export interface MEVCalibrationWeek {
  weekNumber: number;
  signal: MEVSignal;
  completed: boolean;
}

export interface MEVCalibration {
  id: string;
  /** Уровень на момент старта (beginner/intermediate/advanced/enhanced). */
  level: string;
  startedAt: string;
  /** Стартовые сеты на мышцу = популяционный MEV − 2 (флор 2). */
  startSetsByMuscle: Record<string, number>;
  /** Недели протокола (по одной на неделю калибровочного мезо). */
  weeks: MEVCalibrationWeek[];
  resolvedAt?: string;
  /** Зафиксированный личный MEV на мышцу (после resolveMEVAfterCalibration). */
  userMevByMuscle?: Record<string, number>;
}

const STORAGE_KEY = 'he_bb_mev_calibration';

function clamp01to5(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

/** Сигнал деградации (крепатура ≥3 ИЛИ производительность <3). */
export function mevSignalDegradation(sig: MEVSignal): boolean {
  const s = Number(sig?.soreness) >= 3 || Number(sig?.performance) < 3;
  return s;
}

/** Стартовые сеты = популяционный MEV − 2 (флор 2) на каждую каноническую мышцу уровня. */
export function startSetsForCalibration(level: string, muscles: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of muscles) {
    const canon = normMuscle(m);
    const lm = getVolumeLandmarks(level, canon);
    out[canon] = lm ? Math.max(2, lm.mev - 2) : 2;
  }
  return out;
}

/** Новый протокол калибровки. */
export function buildMEVCalibration(level: string, muscles: string[], startedAt = new Date().toISOString()): MEVCalibration {
  return {
    id: `mev-${Date.now()}`,
    level,
    startedAt,
    startSetsByMuscle: startSetsForCalibration(level, muscles),
    weeks: [],
  };
}

/** Добавить неделю протокола; при 2 подряд деградациях — авто-разрешение. */
export function recordMEVCalibrationWeek(cal: MEVCalibration, signal: MEVSignal, weekNumber?: number): MEVCalibration {
  const weekNo = weekNumber || (cal.weeks.length + 1);
  const completed = !!signal && (Number.isFinite(signal.pump) || Number.isFinite(signal.soreness) || Number.isFinite(signal.performance));
  const next: MEVCalibration = {
    ...cal,
    weeks: [
      ...cal.weeks,
      { weekNumber: weekNo, signal: completed ? {
        pump: clamp01to5(signal?.pump),
        soreness: clamp01to5(signal?.soreness),
        performance: clamp01to5(signal?.performance),
      } : { pump: 0, soreness: 0, performance: 0 }, completed },
    ],
  };
  // Две подряд недели деградации → авто-фиксация MEV.
  const w = next.weeks;
  if (w.length >= 2 && mevSignalDegradation(w[w.length - 1].signal) && mevSignalDegradation(w[w.length - 2].signal)) {
    return resolveMEVAfterCalibration(next);
  }
  return next;
}

/**
 * Разрешить протокол → userMevByMuscle.
 * MEV = сеты последней недели БЕЗ деградации (start + (k-1), где k — первая деградировавшая).
 * Если деградаций не было — MEV = start + число заполненных недель (каждая неделя = +1 сет).
 */
export function resolveMEVAfterCalibration(cal: MEVCalibration): MEVCalibration {
  const resolved: MEVCalibration = { ...cal, resolvedAt: new Date().toISOString(), userMevByMuscle: {} };
  const out: Record<string, number> = {};
  for (const [muscle, start] of Object.entries(cal.startSetsByMuscle)) {
    let mev = start;
    for (const wk of cal.weeks) {
      if (!wk.completed) break;
      if (mevSignalDegradation(wk.signal)) break; // MEV зафиксирован на прошлой неделе
      mev = mev + 1;
    }
    out[muscle] = mev;
  }
  resolved.userMevByMuscle = out;
  return resolved;
}

/** Флаг завершения калибровки. */
export function isMEVCalibrationComplete(cal: MEVCalibration | null | undefined): boolean {
  return !!cal && !!cal.resolvedAt && !!cal.userMevByMuscle;
}

/** Текущее состояние протокола (сколько недель заполнено / заполнено ли мезо). */
export function mevCalibrationProgress(cal: MEVCalibration | null | undefined): { weeksDone: number; resolved: boolean } {
  if (!cal) return { weeksDone: 0, resolved: false };
  return { weeksDone: cal.weeks.length, resolved: !!cal.resolvedAt };
}

/**
 * Персональные landmarks для мышцы из калибровки.
 * MEV — зафиксированный личный; MAV/MRV масштабируются сохранённым отношением таблицы,
 * но потолок MRV не растёт выше +30% популяционного (внутри капов, план §3).
 */
export function personalLandmarksFor(
  level: string,
  muscle: string,
  rotationDays: number,
  cal: MEVCalibration | null | undefined,
): MuscleVolumeLandmarks | null {
  if (!isMEVCalibrationComplete(cal)) return null;
  const canon = normMuscle(muscle);
  const userMev = cal?.userMevByMuscle?.[canon];
  if (!Number.isFinite(userMev) || !(userMev as number)) return null;
  const table = getVolumeLandmarks(level, canon);
  if (!table || table.mev <= 0) return null;
  const ratio = (userMev as number) / table.mev;
  const mev = Math.max(2, Math.round(userMev as number));
  const mav = Math.max(mev + 1, Math.round(table.mav * ratio));
  const mrv = Math.max(mav + 1, Math.round(table.mrv * ratio));
  // Потолок: не выше +30% популяционного MRV (защита капов).
  const cap = Math.round(table.mrv * 1.3);
  const mrvFinal = Math.min(cap, mrv);
  const out: MuscleVolumeLandmarks = { mev, mav, mrv: mrvFinal };
  if (!rotationDays || rotationDays === 7) return out;
  const f = rotationDays / 7;
  return { mev: Math.round(mev * f), mav: Math.round(mav * f), mrv: Math.round(mrvFinal * f) };
}

/** Один калиброванный landmark: personal если есть, иначе популяционный. */
export function calibratedLandmarksFor(
  level: string,
  muscle: string,
  rotationDays: number,
  cal: MEVCalibration | null | undefined,
): MuscleVolumeLandmarks | null {
  const personal = personalLandmarksFor(level, muscle, rotationDays, cal);
  if (personal) return personal;
  const table = getVolumeLandmarks(level, muscle);
  if (!table) return null;
  if (!rotationDays || rotationDays === 7) return { ...table };
  const f = rotationDays / 7;
  return { mev: Math.round(table.mev * f), mav: Math.round(table.mav * f), mrv: Math.round(table.mrv * f) };
}

// ── Хранение ──────────────────────────────────────────────────────────────

function readJSONSafe<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

/** Сохранить протокол. */
export function saveMEVCalibration(cal: MEVCalibration): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cal));
  } catch {
    /* quota — молча, не критично */
  }
}

/** Загрузить протокол (null — нет). */
export function loadMEVCalibration(): MEVCalibration | null {
  const raw = readJSONSafe<MEVCalibration | null>(STORAGE_KEY, null);
  if (!raw || typeof raw.startSetsByMuscle !== 'object') return null;
  return raw;
}

/** Сбросить протокол. */
export function clearMEVCalibration(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/** Получить все мышцы уровня (для визарда старта калибровки). */
export function allCalibrationMuscles(_level: string): string[] {
  return ['chest', 'back', 'quads', 'hamstrings', 'shoulders', 'biceps', 'triceps', 'glutes', 'calves', 'abs'];
}
