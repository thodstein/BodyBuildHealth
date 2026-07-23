import { describe, it, expect } from 'vitest';
import { generateTrainingRecommendations } from '../training-recommendations.engine';
import { calcAllPoints, calcIPFGL, calcDOTS, calcWilks } from '../pl-points.engine';
import { computePeriWorkoutNutrition } from '../nutrition-periworkout.engine';
import type { WorkoutLog } from '../../core/types';

const mkWorkout = (date: string, exerciseId: string, nSets: number): WorkoutLog => ({
  id: 'w' + date + exerciseId, date, duration: 60,
  exercises: [{ id: 'e1', date, exerciseId, exerciseName: exerciseId, sets: Array.from({ length: nSets }, () => ({ weight: 80, reps: 5, rir: 2 })), totalVolume: 80 * 5 * nSets, estimated1RM: 100, isCompound: true }],
  overallRPE: 7, recoveryBefore: 80, split: 'upper',
});

describe('интеграционный тест: recommendation engine со всеми входами', () => {
  it('все входы одновременно — множественные правила срабатывают', () => {
    const t = new Date();
    const cur = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 2).toISOString().slice(0, 10);
    const ws: WorkoutLog[] = [mkWorkout(cur, 'bench_bar', 3)];
    const recs = generateTrainingRecommendations({
      historyWorkouts: ws,
      level: 'intermediate',
      weakPoints: ['legs'],
      readinessHistory: [{ date: cur, recovery: 45 }],
      acwr: 1.8,
      nutrition: { kcal: 1800, protein: 100, fat: 60, carbs: 120 },
      bodyWeight: 80,
      labAnalysis: { liverStress: 8, cardioRisk: 7, inflammation: 7, kidneyStress: 3, hormoneScore: 2, homaIR: 3.0 },
      onCourse: true,
      courseIntensity: 'heavy',
      supportCoverage: { hepatic: 0.1, cardio: 0.1, neuro: 0.1, renal: 0.1 },
    });
    // должно быть много warn/critical
    const warns = recs.filter(r => r.severity === 'warn' || r.severity === 'critical');
    expect(warns.length).toBeGreaterThanOrEqual(6);
    expect(recs.some(r => r.id === 'readiness-low')).toBe(true);
    expect(recs.some(r => r.id === 'acwr-high')).toBe(true);
    expect(recs.some(r => r.id === 'nutr-carbs-low')).toBe(true);
    expect(recs.some(r => r.id === 'lab-liver')).toBe(true);
    expect(recs.some(r => r.id === 'supp-hepatic')).toBe(true);
    expect(recs.some(r => r.id === 'pharma-heavy')).toBe(true);
    expect(recs.some(r => r.id === 'weak-legs')).toBe(true);
  });

  it('все нормально — только «Сбалансировано»', () => {
    const recs = generateTrainingRecommendations({
      historyWorkouts: [],
      level: 'intermediate',
      weakPoints: [],
      readinessHistory: [{ date: '2026-01-01', recovery: 80 }],
      acwr: 1.0,
      nutrition: { kcal: 2800, protein: 160, fat: 80, carbs: 400 },
      bodyWeight: 80,
      labAnalysis: { liverStress: 2, cardioRisk: 2, inflammation: 2, kidneyStress: 2, hormoneScore: 7, homaIR: 1.0 },
      onCourse: false,
      supportCoverage: { hepatic: 0.9, cardio: 0.9, neuro: 0.9, renal: 0.9 },
    });
    expect(recs.length).toBe(1);
    expect(recs[0].id).toBe('ok');
  });
});

describe('интеграционный тест: очковые формулы по диапазону весов', () => {
  it('лёгкий (59кг) vs тяжёлый (120кг) — лёгкий имеет более высокие очки', () => {
    const light = calcAllPoints(59, 500);
    const heavy = calcAllPoints(120, 500);
    // Wilks/DOTS: lighter = more points for same total
    expect(calcWilks(59, 500)).toBeGreaterThan(calcWilks(120, 500));
    expect(calcDOTS(59, 500)).toBeGreaterThan(calcDOTS(120, 500));
  });

  it('IPF GL жим (bench) отличается от троеборья (total) при той же сумме', () => {
    expect(calcIPFGL(80, 200, 'bench', 'raw')).not.toEqual(calcIPFGL(80, 200, 'total', 'raw'));
  });

  it('нулевая сумма → 0 очков (защита)', () => {
    expect(calcAllPoints(80, 0).every(p => p.points === 0)).toBe(true);
  });

  it('нулевой вес → clampBw(30), не крэшит', () => {
    const pts = calcAllPoints(0, 500);
    expect(pts.every(p => p.points > 0)).toBe(true); // вес зажат до 30кг
  });
});

describe('интеграционный тест: пери-воркаут (крайние случаи)', () => {
  it('очень тяжёлая сессия (2ч, 30000 тоннаж) — много углеводов', () => {
    const p = computePeriWorkoutNutrition({ sessionVolume: 30000, durationMin: 120, bodyWeight: 100, goal: 'bulk' });
    expect(p.intra.carbsGPerH).toBeGreaterThanOrEqual(30);
    expect(p.post.carbsG).toBeGreaterThan(80);
    expect(p.fluidTotalMl).toBeGreaterThan(1000);
  });

  it('очень лёгкая (20мин, 500 тоннаж) — минимум', () => {
    const p = computePeriWorkoutNutrition({ sessionVolume: 500, durationMin: 20, bodyWeight: 60 });
    expect(p.intra.carbsGPerH).toBe(0);
    expect(p.pre.carbsG).toBeLessThan(100);
  });
});
