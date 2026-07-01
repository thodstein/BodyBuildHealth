import { describe, it, expect } from 'vitest';
import { generateTrainingRecommendations, weeklySetsByGroup } from '../training-recommendations.engine';
import type { WorkoutLog } from '../../core/types';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const mkWorkout = (date: string, exerciseId: string, nSets: number): WorkoutLog => ({
  id: 'w' + date + exerciseId, date, duration: 60,
  exercises: [{ id: 'e1', date, exerciseId, exerciseName: exerciseId, sets: Array.from({ length: nSets }, () => ({ weight: 80, reps: 5, rir: 2 })), totalVolume: 80 * 5 * nSets, estimated1RM: 100, isCompound: true }],
  overallRPE: 7, recoveryBefore: 80, split: 'upper',
});

describe('generateTrainingRecommendations', () => {
  it('недотрен группы 2 недели → warn-рекомендация', () => {
    const t = new Date();
    const cur = iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 2));
    const prev = iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 9));
    const ws: WorkoutLog[] = [mkWorkout(cur, 'bench_bar', 3), mkWorkout(prev, 'bench_bar', 3)];
    const recs = generateTrainingRecommendations({ historyWorkouts: ws, level: 'intermediate', weakPoints: [] });
    expect(recs.some(r => r.text.includes('Грудь') && r.text.includes('недотрен'))).toBe(true);
  });

  it('слабая группа без объёма → рекомендация', () => {
    const t = new Date();
    const cur = iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 2));
    const ws: WorkoutLog[] = [mkWorkout(cur, 'bench_bar', 4)]; // только грудь
    const recs = generateTrainingRecommendations({ historyWorkouts: ws, level: 'intermediate', weakPoints: ['legs'] });
    expect(recs.some(r => r.text.includes('Ноги') && r.text.includes('без объёма'))).toBe(true);
  });

  it('низкая готовность → рекомендация', () => {
    const recs = generateTrainingRecommendations({ historyWorkouts: [], level: 'intermediate', weakPoints: [], readinessHistory: [{ date: '2024-01-01', recovery: 45 }] });
    expect(recs.some(r => r.text.includes('Готовность') && r.text.includes('45'))).toBe(true);
  });

  it('ACWR > 1.5 → critical', () => {
    const recs = generateTrainingRecommendations({ historyWorkouts: [], level: 'intermediate', weakPoints: [], acwr: 1.8 });
    expect(recs.some(r => r.severity === 'critical' && r.text.includes('ACWR'))).toBe(true);
  });

  it('без данных — «сбалансировано»', () => {
    const recs = generateTrainingRecommendations({ historyWorkouts: [], level: 'intermediate', weakPoints: [] });
    expect(recs.some(r => r.text.includes('Сбалансировано'))).toBe(true);
  });

  it('weeklySetsByGroup: массив по неделям', () => {
    const t = new Date();
    const cur = iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 2));
    const ws = [mkWorkout(cur, 'bench_bar', 5)];
    const wsg = weeklySetsByGroup(ws, 3);
    expect(wsg.chest).toBeDefined();
    expect(wsg.chest.length).toBe(3);
    expect(wsg.chest[2]).toBe(5); // последняя неделя
  });

  it('усталость от однообразия (6+ нед одного упражнения)', () => {
    const t = new Date();
    const ws: WorkoutLog[] = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 2 - i * 7);
      ws.push(mkWorkout(d.toISOString().slice(0, 10), 'bench_bar', 3));
    }
    const recs = generateTrainingRecommendations({ historyWorkouts: ws, level: 'intermediate', weakPoints: [] });
    expect(recs.some(r => r.text.includes('повторяется') && r.text.includes('анти-стейл'))).toBe(true);
  });

  it('высокая суставная нагрузка за неделю', () => {
    const t = new Date();
    const cur = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 2).toISOString().slice(0, 10);
    const ws: WorkoutLog[] = [mkWorkout(cur, 'dips_chest', 10)];
    const recs = generateTrainingRecommendations({ historyWorkouts: ws, level: 'intermediate', weakPoints: [] });
    expect(recs.some(r => r.text.includes('суставная нагрузка'))).toBe(true);
  });

});