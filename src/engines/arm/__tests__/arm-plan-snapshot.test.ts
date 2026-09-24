import { describe, expect, it } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { armPlanSnapshotId, refreshArmPlanSnapshot } from '../arm-plan-snapshot.engine';

describe('arm plan snapshot', () => {
  it('ставит стабильный id и пересчитывает derived validation', () => {
    const base = finalizeArmPlan(buildArmPlan({
      discipline: 'armwrestling',
      patternId: 'arm_4_upper_lower',
      level: 'intermediate',
      goal: 'strength',
      technique: 'balanced',
      weeks: 4,
    }), { level: 'intermediate' });
    const first = refreshArmPlanSnapshot(base, 'intermediate');
    const second = refreshArmPlanSnapshot({ ...first }, 'intermediate');
    expect(first.planSnapshotId).toBeTruthy();
    expect(first.planSnapshotId).toBe(second.planSnapshotId);
    expect(first.validation?.status).toBeDefined();
    expect(first.metrics?.tableSessionShare).toBeGreaterThanOrEqual(0);
  });

  it('новый набор упражнений получает новый snapshot id', () => {
    const base = finalizeArmPlan(buildArmPlan({
      discipline: 'armwrestling',
      patternId: 'arm_4_upper_lower',
      level: 'intermediate',
      goal: 'strength',
      technique: 'balanced',
      weeks: 4,
    }), { level: 'intermediate' });
    const changed = structuredClone(base) as any;
    changed.weeks[0].sessions[0].exercises[0].sets += 1;
    const changedSnapshot = refreshArmPlanSnapshot(changed, 'intermediate');
    expect(changedSnapshot.planSnapshotId).not.toBe(armPlanSnapshotId(base));
    expect(changedSnapshot.metrics?.totalSetsPerWeek[1]).toBeGreaterThan(0);
  });
});
