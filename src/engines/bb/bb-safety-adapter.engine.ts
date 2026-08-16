import type { BBPlan } from './bb-builder.engine';
import type { TrainingSafetyReport } from '../training-safety.types';

export interface BBSafetyApplyResult {
  plan: BBPlan;
  applied: boolean;
  skipped: string[];
}

function adjustmentKey(report: TrainingSafetyReport): string {
  return report.adjustments
    .filter(adjustment => adjustment.kind === 'volume_multiplier' || adjustment.kind === 'rir_shift')
    .map(adjustment => `${adjustment.kind}:${adjustment.value}`)
    .sort()
    .join('|');
}

/**
 * Applies only reversible load/RIR overlays to a cloned BB plan.
 * Exercise removal is deliberately not automatic: contraindications require
 * an explicit replacement decision rather than silently changing the program.
 */
export function applySafetyReportToBBPlan(plan: BBPlan, report: TrainingSafetyReport): BBSafetyApplyResult {
  const key = adjustmentKey(report);
  if (!key) return { plan, applied: false, skipped: ['Нет применимых корректировок'] };

  const source = plan as BBPlan & { safetyOverlaysApplied?: string[] };
  const appliedKeys = source.safetyOverlaysApplied || [];
  if (appliedKeys.includes(key)) return { plan, applied: false, skipped: ['Эта корректировка уже применена'] };

  const volume = report.adjustments.find(adjustment => adjustment.kind === 'volume_multiplier');
  const rir = report.adjustments.find(adjustment => adjustment.kind === 'rir_shift');
  const volumeMultiplier = volume ? Math.max(0.4, Math.min(1, Number(volume.value) || 1)) : 1;
  const rirShift = rir ? Math.max(0, Math.min(3, Number(rir.value) || 0)) : 0;

  const next: BBPlan & { safetyOverlaysApplied?: string[] } = {
    ...plan,
    weeks: plan.weeks.map(week => ({
      ...week,
      sessions: week.sessions.map(session => ({
        ...session,
        exercises: session.exercises.map(exercise => {
          const nextSets = volume ? Math.max(1, Math.round(exercise.sets * volumeMultiplier)) : exercise.sets;
          return {
            ...exercise,
            sets: nextSets,
            rir: rirShift ? Math.min(5, Math.max(0, exercise.rir + rirShift)) : exercise.rir,
            workSets: (volume ? exercise.workSets.slice(0, nextSets) : exercise.workSets).map(set => ({
              ...set,
              rir: rirShift ? Math.min(5, Math.max(0, set.rir + rirShift)) : set.rir,
            })),
          };
        }),
      })),
    })),
    rationale: [...plan.rationale, `🛡 Safety overlay: объём ×${volumeMultiplier.toFixed(2)}${rirShift ? `, RIR +${rirShift}` : ''}`],
    safetyOverlaysApplied: [...appliedKeys, key],
  };

  return { plan: next, applied: true, skipped: [] };
}
