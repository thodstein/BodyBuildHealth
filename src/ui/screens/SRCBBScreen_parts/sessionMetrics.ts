/**
 * sessionMetrics.ts — D1: калькулятор LMS-показателей для фактической сессии (Этап D).
 * Преобразует записанную тренировку (WorkoutSession + PlayerDay) → SRExercise[] →
 * calcSessionMetrics (Тоннаж/КПШ/Инт.отн/УОИ/Инт.Ф+Б). REUSE lms-metrics.engine.
 *
 * Поля pm/coef/mnosz/group берутся из плана (PlayerExercise), если заданы; иначе —
 * эвристика (coef по имени, pm через estimate1RM тяжелейшего подхода, mnosz=1).
 */
import { estimate1RM } from '../../../engines/progression.engine';
import { calcSessionMetrics, calcSessionTimeMinutes, type SRExercise, type SRSessionMetrics } from '../../../engines/lms/lms-metrics.engine';
import type { WorkoutSession } from '../../../engines/workout-logger.engine';
import type { PlayerExercise } from './SessionPlayer';

const COMPOUND = /присед|тяга|жим|squat|deadlift|bench|press|row|pullup|подтяг|отжиман|выпад|lunge|squat|press/i;
const ISOLATION = /сгибан|разгибан|мах|curl|extension|fly|raise|икронож|calf|shrug|тяга к|wrist|предплеч/i;

function coefFor(name: string): number {
  if (COMPOUND.test(name)) return 1.2;
  if (ISOLATION.test(name)) return 0.3;
  return 1.0;
}

function groupFor(name: string, muscleGroup: string): string {
  const g = (muscleGroup || '').toUpperCase();
  if (g === 'ЖМ' || g === 'ПР' || g === 'ТГ' || g === 'СР') return g;
  const n = (name || '').toLowerCase();
  if (/присед|squat|ног|quad|квадр|выпад|lunge|икр|calf|ягодиц|glute/.test(n)) return 'ПР';
  if (/тяга|deadlift|подтяг|pullup|row|тяга|спин|back|бицепс|biceps|shrug/.test(n)) return 'ТГ';
  if (/пресс|core|abs|кор|планка|sit/.test(n)) return 'Ср';
  return 'ЖМ';
}

export function playerExerciseToSR(ex: PlayerExercise, sessionEx: { sets: { weightKg: number; reps: number }[] }): SRExercise | null {
  const sets = (sessionEx?.sets || []).filter(s => s.weightKg > 0 && s.reps > 0)
    .map(s => ({ weight: s.weightKg, reps: s.reps, sets: 1 }));
  if (sets.length === 0) return null;
  const name = ex.name || '';
  const heaviest = sets.reduce((m, s) => Math.max(m, s.weight), 0);
  const heaviestReps = sets.find(s => s.weight === heaviest)?.reps || 1;
  const pm = (ex as any).pm && (ex as any).pm > 0 ? (ex as any).pm : estimate1RM(heaviest, heaviestReps);
  const coef = (ex as any).coef != null ? (ex as any).coef : coefFor(name);
  const mnosz = (ex as any).mnosz != null ? (ex as any).mnosz : 1;
  const group = (ex as any).group || groupFor(name, ex.muscleGroup);
  return { name, group, coef, mnosz, pm, sets };
}

export interface SessionMetricsResult {
  metrics: SRSessionMetrics;
  minutes: number;
  exerciseCount: number;
}

export function computeSessionMetrics(session: WorkoutSession | null, day: { exercises: PlayerExercise[] } | null): SessionMetricsResult | null {
  if (!session || !day) return null;
  const sr: SRExercise[] = [];
  session.exercises.forEach((se, i) => {
    const pe = day.exercises[i] || day.exercises.find(e => e.name === se.exerciseName);
    if (!pe) return;
    const r = playerExerciseToSR(pe, se);
    if (r) sr.push(r);
  });
  if (sr.length === 0) return null;
  const metrics = calcSessionMetrics(sr);
  return { metrics, minutes: calcSessionTimeMinutes(metrics), exerciseCount: sr.length };
}
