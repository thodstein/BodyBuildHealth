/**
 * manual-pl.engine.ts — конвертация ПЛ-программы (LMS-цикл) → PlayerDay[].
 * F4.2: вынесено из manual-constructor.engine.ts. F4.4: использует lms-to-pl.ts.
 */
import type { UserProgram } from '../user-program/user-program.types';
import { getReferencedCycle } from '../user-program/program-store';
import { lmsCycleToSchedule, type PLScheduledDay } from '../lms/lms-to-pl';

export function plLmsScheduleDays(program: UserProgram): Array<{ label: string; exercises: any[] }> {
  if (!program.pl) return [];
  const cycle = getReferencedCycle(program);
  if (!cycle) return [];

  // F4.4: используем единый lms-to-pl.ts helper вместо собственной логики
  const dayOfWeekBySession: Record<number, number> = {};
  for (const s of program.pl.schedule ?? []) dayOfWeekBySession[s.sessionIdx] = s.dayOfWeek;

  const days: PLScheduledDay[] = lmsCycleToSchedule(
    cycle.meta.id,
    program.pl.workMax,
    dayOfWeekBySession,
    program.pl.activeWeek ?? 1,
  );

  return days.map((d: PLScheduledDay) => ({
    label: d.dowLabel ? `${d.label} (${d.dowLabel})` : d.label,
    exercises: d.exercises.map((e) => ({
      name: e.name,
      muscleGroup: e.muscleGroup,
      sets: e.sets.map((s) => ({
        pct: s.pct,
        reps: s.reps,
        sets: s.sets,
        rir: s.rir,
        weight: s.weight,
      })),
    })),
  }));
}
