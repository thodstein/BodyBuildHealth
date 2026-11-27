import type { ArmPlan } from './arm-types';
import { validateArmPlan } from './arm-validator.engine';
import { calcArmMetrics } from './arm-metrics.engine';
import { buildArmReport } from './arm-report.engine';
import { armWeeklyVolumeFor } from './arm-volume.engine';

function snapshotKey(plan: any): string {
  const {
    planSnapshotId: _snapshotId,
    weeklyVolume: _weeklyVolume,
    validation: _validation,
    report: _report,
    metrics: _metrics,
    ...rest
  } = plan || {};
  try {
    return JSON.stringify(rest);
  } catch {
    return String(rest?.pattern?.id || 'arm');
  }
}

export function armPlanSnapshotId(plan: any): string {
  const value = snapshotKey(plan);
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `arm-${(hash >>> 0).toString(16)}`;
}

function recomputeWeeklyVolume(plan: ArmPlan): ArmPlan['weeklyVolume'] {
  const weeklyVolume: NonNullable<ArmPlan['weeklyVolume']> = {};
  for (const wk of plan.weeks) weeklyVolume[wk.week] = armWeeklyVolumeFor([wk as any]);
  return weeklyVolume;
}

export function refreshArmPlanSnapshot(plan: any, level?: string): any {
  const next = { ...(plan || {}), planSnapshotId: armPlanSnapshotId(plan) };
  next.weeklyVolume = recomputeWeeklyVolume(next);
  next.validation = validateArmPlan(next, level || next.level);
  next.metrics = calcArmMetrics(next);
  next.report = buildArmReport(next);
  return next;
}
