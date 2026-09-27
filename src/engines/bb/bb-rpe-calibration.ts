/**
 * bb-rpe-calibration.ts — индивидуальная калибровка RPE→%1RM.
 *
 * Исследования показывают, что зависимость RPE от %1RM варьируется между людьми
 * и упражнениями (Helms 2017, Graham 2021). Этот модуль позволяет:
 * 1. Хранить индивидуальные калибровки для каждого упражнения
 * 2. Обновлять калибровку на основе данных из дневника
 * 3. Использовать калибровку при расчёте весов
 *
 * Источники:
 * - Helms E., "RIR vs %1RM for Hypertrophy", 2017
 * - Graham T., "Autoregulation by repetitions in reserve", 2021
 * - Zourdos M., "RIR Accuracy in Powerlifters", 2019
 */

import { pctForRir } from '../rir-table';

/** Калибровка RPE→%1RM для одного упражнения */
export interface RpeCalibration {
  exerciseName: string;
  /** Наблюдаемые пары (RPE, %1RM) */
  observations: Array<{ rpe: number; pct: number }>;
  /** Калиброванная функция: RPE → %1RM */
  calibratedPct: (rpe: number) => number;
  /** Достоверность калибровки (0-1) */
  confidence: number;
}

/** Хранилище калибровок */
const calibrations = new Map<string, RpeCalibration>();

/** Дефолтная калибровка (линейная, как в rir-table.ts) */
function defaultCalibration(exerciseName: string): RpeCalibration {
  return {
    exerciseName,
    observations: [],
    calibratedPct: (rpe: number) => pctForRir(rpe),
    confidence: 0,
  };
}

/**
 * Получить калибровку для упражнения.
 * Если калибровка не найдена — возвращает дефолтную.
 */
export function getRpeCalibration(exerciseName: string): RpeCalibration {
  return calibrations.get(exerciseName) ?? defaultCalibration(exerciseName);
}

/**
 * Обновить калибровку на основе наблюдения.
 * Использует линейную регрессию для уточнения зависимости RPE→%1RM.
 */
export function updateRpeCalibration(
  exerciseName: string,
  rpe: number,
  actualPct: number,
): RpeCalibration {
  const existing = calibrations.get(exerciseName) ?? defaultCalibration(exerciseName);
  
  // Добавляем наблюдение
  const observations = [...existing.observations, { rpe, pct: actualPct }];
  
  // Если наблюдений достаточно — строим линейную регрессию
  let calibratedPct: (rpe: number) => number;
  let confidence: number;
  
  if (observations.length >= 3) {
    // Линейная регрессия: pct = a + b * rpe
    const n = observations.length;
    const sumX = observations.reduce((s, o) => s + o.rpe, 0);
    const sumY = observations.reduce((s, o) => s + o.pct, 0);
    const sumXY = observations.reduce((s, o) => s + o.rpe * o.pct, 0);
    const sumXX = observations.reduce((s, o) => s + o.rpe * o.rpe, 0);
    
    const denominator = n * sumXX - sumX * sumX;
    if (denominator !== 0) {
      const b = (n * sumXY - sumX * sumY) / denominator;
      const a = (sumY - b * sumX) / n;
      
      calibratedPct = (rpe: number) => Math.max(0.5, Math.min(1.0, a + b * rpe));
      confidence = Math.min(1, observations.length / 10);
    } else {
      calibratedPct = (rpe: number) => pctForRir(rpe);
      confidence = 0;
    }
  } else {
    // Недостаточно данных — используем дефолтную калибровку
    calibratedPct = (rpe: number) => pctForRir(rpe);
    confidence = 0;
  }
  
  const updated: RpeCalibration = {
    exerciseName,
    observations,
    calibratedPct,
    confidence,
  };
  
  calibrations.set(exerciseName, updated);
  return updated;
}

/**
 * Рассчитать %1RM по RPE с учётом индивидуальной калибровки.
 * Если калибровка недостоверна — использует дефолтную таблицу.
 */
export function rpeToPct(exerciseName: string, rpe: number): number {
  const cal = getRpeCalibration(exerciseName);
  if (cal.confidence > 0.5) {
    return cal.calibratedPct(rpe);
  }
  return pctForRir(rpe);
}

/**
 * Рассчитать вес по RPE с учётом индивидуальной калибровки.
 */
export function weightForRpe(
  exerciseName: string,
  rpe: number,
  workMax: number,
  intensityMult: number = 1.0,
): number {
  const pct = rpeToPct(exerciseName, rpe);
  return Math.round(workMax * pct * intensityMult * 10) / 10;
}

/**
 * Получить все калибровки (для отладки/экспорта).
 */
export function getAllCalibrations(): RpeCalibration[] {
  return Array.from(calibrations.values());
}

/**
 * Очистить все калибровки (для тестов).
 */
export function clearCalibrations(): void {
  calibrations.clear();
}
