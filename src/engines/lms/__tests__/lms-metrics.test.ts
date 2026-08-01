import { describe, expect, it } from 'vitest';
import {
  FUNCTIKOV_TABLE,
  calcAvgWeight,
  calcCycleMetrics,
  calcExerciseMetrics,
  calcKPSH,
  calcRelIntensity,
  calcSessionMetrics,
  calcSessionTimeMinutes,
  calcTonnage,
  functikovCoefficient,
  type SRExercise,
} from '../lms-metrics.engine';

const exercise: SRExercise = {
  name: 'Жим', group: 'ЖМ', coef: 1, mnosz: 1, pm: 100,
  sets: [{ weight: 80, reps: 5, sets: 3 }],
};

describe('LMS metrics', () => {
  it('keeps the Functikov table ordered and clamps interpolation', () => {
    expect(FUNCTIKOV_TABLE[0][0]).toBe(0);
    expect(FUNCTIKOV_TABLE[FUNCTIKOV_TABLE.length - 1][0]).toBe(1);
    expect(functikovCoefficient(-1)).toBe(FUNCTIKOV_TABLE[0][1]);
    expect(functikovCoefficient(2)).toBe(FUNCTIKOV_TABLE[FUNCTIKOV_TABLE.length - 1][1]);
    expect(functikovCoefficient(0.805)).toBeGreaterThan(functikovCoefficient(0.8));
  });

  it('calculates exercise metrics and zero guards', () => {
    expect(calcTonnage(exercise)).toBe(1200);
    expect(calcKPSH(exercise)).toBe(15);
    expect(calcAvgWeight(exercise)).toBe(80);
    expect(calcRelIntensity(exercise)).toBe(0.8);
    expect(calcExerciseMetrics(exercise).tonnage).toBe(1200);
    const empty = { ...exercise, pm: 0, sets: [] };
    expect(calcAvgWeight(empty)).toBe(0);
    expect(calcRelIntensity(empty)).toBe(0);
  });

  it('aggregates sessions and cycle metrics', () => {
    const session = calcSessionMetrics([exercise]);
    expect(session.tonnage).toBe(1200);
    expect(session.kpsh).toBe(15);
    expect(session.exerciseCount).toBe(1);
    const cycle = calcCycleMetrics([[exercise], []]);
    expect(cycle.sessions).toBe(2);
    expect(cycle.tonnage).toBe(1200);
    expect(calcSessionTimeMinutes(session)).toBe(2);
  });
});
