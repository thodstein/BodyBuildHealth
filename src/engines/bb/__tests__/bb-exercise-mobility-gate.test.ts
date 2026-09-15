import { describe, it, expect } from 'vitest';
import { diagnoseExercise } from '../bb-exercise-diagnosis.engine';

/** Lock: OHS-провалы двигают jointRisk в диагнозе (провод скрининг → разбор, D3). */
describe('bb-exercise-mobility-gate', () => {
  const ex = { id: 'upright_row', name: 'Тяга к подбородку', muscle: 'shoulders', sets: 4, rir: 2, jointStress: 'high' } as any;
  it('high jointStress + mobilityFails≥1 → jointRisk', () => {
    const d = diagnoseExercise({ ...ex, muscle: 'shoulders' }, { muscle: 'shoulders', mobilityFails: 2 } as any);
    expect(d.flags).toContain('jointRisk');
  });
  it('тот же кейс без провалов OHS — jointRisk только по профилю, не по скринингу', () => {
    const d = diagnoseExercise({ ...ex, muscle: 'shoulders' }, { muscle: 'shoulders', mobilityFails: 0 } as any);
    // без mobilityFails флаг может быть только через isMobilityRestricted, не через OHS-число
    expect(d.issues.join(' ')).not.toMatch(/OHS fail/);
  });
});
