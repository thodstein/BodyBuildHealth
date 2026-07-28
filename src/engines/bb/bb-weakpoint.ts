/**
 * bb-weakpoint.ts — слабые места и специализация (Этап BB9, REUSE+EXTEND training-methodology.getVolumeByMuscle).
 * Метка отстающих групп → MAV↑/частота↑; блоки специализации (1-2 группы в MAV, остальные на MEV).
 */
import { getVolumeLandmarks, normLevel } from '../volume-landmarks.engine';

export interface WeakPointPlan {
  weakPoints: string[];
  specialization: boolean;     // true = блок специализации
  emphasisMuscles: string[];   // группы на MAV (↑)
  maintenanceMuscles: string[];// группы на MEV
  volumeMap: Record<string, { sets: number; source: 'MAV' | 'MEV' | 'MAV+10%' }>;
  rationale: string[];
}

/**
 * @param weakPoints отстающие мышцы
 * @param allMuscles все тренируемые мышцы
 * @param level
 * @param specialization если true — 1-2 слабые на MAV+10%, остальные на MEV; иначе слабые +10%, остальные MAV
 */
export function planWeakPoints(weakPoints: string[], allMuscles: string[], level: string, specialization: boolean = false): WeakPointPlan {
  const lvl = normLevel(level);
  const rationale: string[] = [];
  const volumeMap: Record<string, { sets: number; source: 'MAV' | 'MEV' | 'MAV+10%' }> = {};
  const emphasis: string[] = [];
  const maintenance: string[] = [];

  // при специализации — берём топ-2 слабые как emphasis
  const emphasisList = specialization ? weakPoints.slice(0, 2) : weakPoints;

  for (const m of allMuscles) {
    const lm = getVolumeLandmarks(lvl, m);
    if (!lm) continue;
    const isWeak = weakPoints.includes(m);
    const isEmphasis = emphasisList.includes(m);
    if (specialization) {
      if (isEmphasis) {
        volumeMap[m] = { sets: Math.round(lm.mav * 1.1), source: 'MAV+10%' };
        emphasis.push(m);
        rationale.push(`${m}: специализация — MAV+10% (${volumeMap[m].sets} сетов)`);
      } else {
        // P1-6 (audit 2026-07): не-слабые на MEV×1.5 (maintenance-higher MEV), не на MEV.
        // MEV = minimum effective volume — ниже этого порога мышца атрофируется.
        // Постановка ВСЕХ не-слабых на MEV в 8-12 нед мезо → спад массы в них.
        // MEV×1.5 = maintenance volume (достаточно для сохранения, не атрофия).
        volumeMap[m] = { sets: Math.round(lm.mev * 1.5), source: 'MEV' };
        maintenance.push(m);
        rationale.push(`${m}: поддержание — MEV×1.5 (${volumeMap[m].sets} сетов, не чистый MEV — антиатрофия)`);
      }
    } else {
      if (isWeak) {
        volumeMap[m] = { sets: Math.round(lm.mav * 1.1), source: 'MAV+10%' };
        emphasis.push(m);
        rationale.push(`${m}: отстающая — MAV+10% (${volumeMap[m].sets} сетов)`);
      } else {
        volumeMap[m] = { sets: lm.mav, source: 'MAV' };
      }
    }
  }
  return { weakPoints, specialization, emphasisMuscles: emphasis, maintenanceMuscles: maintenance, volumeMap, rationale };
}