import { describe, expect, it } from 'vitest';
import {
  FUNCTIKOV_TABLE,
  calcAvgWeight,
  calcCycleMetrics,
  calcExerciseMetrics,
  calcFunctikovBondarenko,
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

describe('LMS metrics — краевые случаи (аудит)', () => {
  it('mnosz масштабирует тоннаж и Средний вес, но НЕ КПШ и Инт.отн (канон: mnosz сокращается)', () => {
    const base: SRExercise = { name: 'X', group: 'Ср', coef: 1, mnosz: 1, pm: 100, sets: [{ weight: 70, reps: 4, sets: 3 }] };
    const scaled = { ...base, mnosz: 2 };
    // Тоннаж = raw × mnosz.
    expect(calcTonnage(scaled)).toBe(calcTonnage(base) * 2);
    // КПШ — без mnosz.
    expect(calcKPSH(scaled)).toBe(calcKPSH(base));
    // Инт.отн = Средний вес / (PM × mnosz) — mnosz сокращается.
    expect(calcRelIntensity(scaled)).toBeCloseTo(calcRelIntensity(base), 10);
  });

  it('Инт.Ф+Б масштабируется coef и mnosz; pm=0 → 0', () => {
    const base: SRExercise = { name: 'X', group: 'Ср', coef: 1, mnosz: 1, pm: 100, sets: [{ weight: 80, reps: 5, sets: 3 }] };
    const coef2 = { ...base, coef: 2 };
    const mnosz2 = { ...base, mnosz: 2 };
    expect(calcFunctikovBondarenko(coef2)).toBeCloseTo(calcFunctikovBondarenko(base) * 2, 5);
    expect(calcFunctikovBondarenko(mnosz2)).toBeCloseTo(calcFunctikovBondarenko(base) * 2, 5);
    expect(calcFunctikovBondarenko({ ...base, pm: 0 })).toBe(0);
  });

  it('известные значения коэффициента Фунтикова (таблица точная)', () => {
    expect(functikovCoefficient(0.5)).toBeCloseTo(0.5, 5);
    expect(functikovCoefficient(0.8)).toBeCloseTo(1.53, 5);
    expect(functikovCoefficient(0.9)).toBeCloseTo(2.8, 5);
    expect(functikovCoefficient(1)).toBeCloseTo(25, 5);
  });

  it('calcSessionTimeMinutes: зоны по Инт.отн (0.13/0.32/0.75 мин на подъём)', () => {
    const ex = (weight: number): SRExercise => ({ name: 'X', group: 'Ср', coef: 1, mnosz: 1, pm: 100, sets: [{ weight, reps: 5, sets: 1 }] });
    // ri = 0.9 ≥ 0.8 → 0.13 × 5 = 0.65 → 1
    expect(calcSessionTimeMinutes(calcSessionMetrics([ex(90)]))).toBe(1);
    // ri = 0.7 (0.6–0.8) → 0.32 × 5 = 1.6 → 2
    expect(calcSessionTimeMinutes(calcSessionMetrics([ex(70)]))).toBe(2);
    // ri = 0.5 (<0.6) → 0.75 × 5 = 3.75 → 4
    expect(calcSessionTimeMinutes(calcSessionMetrics([ex(50)]))).toBe(4);
  });

  it('calcCycleMetrics: средняя Инт.отн и УОИ взвешены по КПШ сессий', () => {
    const heavy: SRExercise = { name: 'A', group: 'Ср', coef: 1, mnosz: 1, pm: 100, sets: [{ weight: 90, reps: 2, sets: 1 }] }; // КПШ 2, ri 0.9
    const light: SRExercise = { name: 'B', group: 'Ср', coef: 1, mnosz: 1, pm: 100, sets: [{ weight: 50, reps: 8, sets: 1 }] }; // КПШ 8, ri 0.5
    const cycle = calcCycleMetrics([[heavy], [light]]);
    // relIntensity = Σ(ri×КПШ)/ΣКПШ = (0.9×2 + 0.5×8)/10 = 5.8/10 = 0.58
    expect(cycle.relIntensity).toBeCloseTo(0.58, 5);
    expect(cycle.kpsh).toBe(10);
    expect(cycle.sessions).toBe(2);
  });
});
