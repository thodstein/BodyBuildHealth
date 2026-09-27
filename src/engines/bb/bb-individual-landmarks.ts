/**
 * bb-individual-landmarks.ts — индивидуальные MEV/MAV/MRV на основе дневника.
 *
 * Исследования (Silveira 2025, Israetel RP) показывают, что объёмные ориентиры
 * варьируются между людьми. Этот модуль вычисляет индивидуальные ориентиры
 * на основе данных из дневника тренировок.
 */

import { loadSessions } from '../workout-logger.engine';
import { acuteChronicRatio, toDailyLoads } from '../pro/training-load.engine';

/** Индивидуальные объёмные ориентиры */
export interface IndividualLandmarks {
  muscle: string;
  mev: number;
  mav: number;
  mrv: number;
  confidence: number;
}

/** Вычислить индивидуальные ориентиры для мышцы */
export function computeIndividualLandmarks(muscle: string): IndividualLandmarks | null {
  const sessions = loadSessions();
  if (!sessions || sessions.length < 5) return null;

  // Фильтруем сессии, содержащие данную мышцу
  const muscleSessions = sessions.filter(s =>
    s.exercises.some(e => e.muscle === muscle),
  );
  if (muscleSessions.length < 3) return null;

  // Вычисляем средний объём за последние 4 недели
  const recentVolumes: number[] = [];
  for (let i = 0; i < Math.min(4, muscleSessions.length); i++) {
    const session = muscleSessions[i];
    const sets = session.exercises
      .filter(e => e.muscle === muscle)
      .reduce((sum, e) => sum + (e.sets || 0), 0);
    recentVolumes.push(sets);
  }

  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const maxVolume = Math.max(...recentVolumes);

  // MEV = минимальный объём, при котором есть прогресс
  const mev = Math.max(4, Math.round(avgVolume * 0.6));
  // MAV = оптимальный объём
  const mav = Math.max(8, Math.round(avgVolume));
  // MRV = максимальный объём
  const mrv = Math.max(12, Math.round(maxVolume * 1.1));

  // Достоверность зависит от количества данных
  const confidence = Math.min(1, muscleSessions.length / 10);

  return { muscle, mev, mav, mrv, confidence };
}

/** Получить все индивидуальные ориентиры */
export function getAllIndividualLandmarks(): IndividualLandmarks[] {
  const sessions = loadSessions();
  if (!sessions || sessions.length < 5) return [];

  const muscles = new Set<string>();
  for (const s of sessions) {
    for (const e of s.exercises) {
      if (e.muscle) muscles.add(e.muscle);
    }
  }

  return Array.from(muscles)
    .map(m => computeIndividualLandmarks(m))
    .filter((l): l is IndividualLandmarks => l !== null);
}
