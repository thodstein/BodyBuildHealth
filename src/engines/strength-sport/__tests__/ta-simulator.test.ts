import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { simulateTACorrection, estimateCorrBasePm } from '../strength-sport-ta-simulator.engine';

describe('TA simulator E4', () => {
  function plan() {
    return buildStrengthSportPlan({ mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 4, daysPerWeek: 3, workMax: { snatch: 80, backSquat: 120, deadlift: 160 } } as any);
  }
  it('мусор → null', () => {
    expect(simulateTACorrection(null, null as any)).toBeNull();
    expect(simulateTACorrection(null, { weakPoint: 'snatch_mid', corrId: 'x' } as any)).toBeNull();
    expect(simulateTACorrection({ weeksData: [] } as any, { weakPoint: 'snatch_mid', corrId: 'x' } as any)).toBeNull();
  });
  it('Δ математика: сеты × рабочие недели', () => {
    const p = plan();
    const d = simulateTACorrection(p, { weakPoint: 'snatch_mid', corrId: 'pause_snatch' });
    expect(d).not.toBeNull();
    expect(d!.setsTotal).toBe(d!.setsPerWeek * d!.weeks);
    expect(d!.tonnageEst).toBe(d!.setsTotal * 5 * d!.weightEst);
    expect(d!.summary).toContain('+');
    expect(d!.summary).toContain('/11');
  });
  it('покрытие растёт при нулевой фазе', () => {
    const p = plan();
    const d = simulateTACorrection(p, { weakPoint: 'snatch_pull_under', corrId: 'muscle_snatch' });
    expect(d!.coverageAfter).toBeGreaterThanOrEqual(d!.coverageBefore);
    if (d!.coveredFlip) expect(d!.coverageAfter).toBe(d!.coverageBefore + 1);
  });
  it('оценка веса: рывок 80 × 0.7 → 55', () => {
    expect(estimateCorrBasePm('pause_snatch', { snatch: 80 })).toBe(80);
    const d = simulateTACorrection(plan(), { weakPoint: 'snatch_off_floor', corrId: 'deficit_snatch' });
    expect(d!.weightEst).toBe(55);
  });
});
