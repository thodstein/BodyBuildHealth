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
    const cur = iso(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
    const prev = iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 7));
    const ws: WorkoutLog[] = [mkWorkout(cur, 'bench_bar', 3), mkWorkout(prev, 'bench_bar', 3)];
    const recs = generateTrainingRecommendations({ historyWorkouts: ws, level: 'intermediate', weakPoints: [] });
    expect(recs.some(r => r.text.includes('Грудь') && r.text.includes('недотрен'))).toBe(true);
  });

  it('слабая группа без объёма → рекомендация', () => {
    const t = new Date();
    const cur = iso(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
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
    const cur = iso(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
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
      const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - i * 7);
      ws.push(mkWorkout(d.toISOString().slice(0, 10), 'bench_bar', 3));
    }
    const recs = generateTrainingRecommendations({ historyWorkouts: ws, level: 'intermediate', weakPoints: [] });
    expect(recs.some(r => r.text.includes('повторяется') && r.text.includes('анти-стейл'))).toBe(true);
  });

  it('высокая суставная нагрузка за неделю', () => {
    const t = new Date();
    const cur = new Date(t.getFullYear(), t.getMonth(), t.getDate()).toISOString().slice(0, 10);
    const ws: WorkoutLog[] = [mkWorkout(cur, 'dips_chest', 10)];
    const recs = generateTrainingRecommendations({ historyWorkouts: ws, level: 'intermediate', weakPoints: [] });
    expect(recs.some(r => r.text.includes('суставная нагрузка'))).toBe(true);
  });


  it('учёт питания в тренировках: низкие углеводы → warn', () => {
    const recs = generateTrainingRecommendations({ historyWorkouts: [], level: 'intermediate', weakPoints: [], bodyWeight: 80, nutrition: { kcal: 2000, protein: 160, fat: 70, carbs: 160 } });
    expect(recs.some(r => r.text.includes('углеводов') && r.severity === 'warn')).toBe(true);
  });

  it('недостаток белка → warn', () => {
    const recs = generateTrainingRecommendations({ historyWorkouts: [], level: 'intermediate', weakPoints: [], bodyWeight: 80, nutrition: { kcal: 2000, protein: 100, fat: 70, carbs: 400 } });
    expect(recs.some(r => r.text.includes('белка') && r.severity === 'warn')).toBe(true);
  });

  it('адекватное питание — нет nutrition-warn', () => {
    const recs = generateTrainingRecommendations({ historyWorkouts: [], level: 'intermediate', weakPoints: [], bodyWeight: 80, nutrition: { kcal: 2800, protein: 160, fat: 80, carbs: 400 } });
    expect(recs.some(r => r.id.startsWith('nutr-'))).toBe(false);
  });

  it('lab: high liver stress -> warn', () => {
    const recs = generateTrainingRecommendations({ historyWorkouts: [], level: 'intermediate', weakPoints: [], labAnalysis: { liverStress: 8, cardioRisk: 3, inflammation: 3, kidneyStress: 3, hormoneScore: 5, homaIR: null } });
    expect(recs.some(r => r.id === 'lab-liver' && r.severity === 'warn')).toBe(true);
  });

  it('pharma: heavy course -> info', () => {
    const recs = generateTrainingRecommendations({ historyWorkouts: [], level: 'intermediate', weakPoints: [], onCourse: true, courseIntensity: 'heavy' });
    expect(recs.some(r => r.id === 'pharma-heavy')).toBe(true);
  });

  it('pharma: no course -> no pharma rec', () => {
    const recs = generateTrainingRecommendations({ historyWorkouts: [], level: 'intermediate', weakPoints: [], onCourse: false });
    expect(recs.some(r => r.id.startsWith('pharma-'))).toBe(false);
  });


  it('support: low hepatic coverage + onCourse -> warn', () => {
    const recs = generateTrainingRecommendations({ historyWorkouts: [], level: 'intermediate', weakPoints: [], onCourse: true, supportCoverage: { hepatic: 0.1, cardio: 0.8, neuro: 0.8, renal: 0.8 } });
    expect(recs.some(r => r.id === 'supp-hepatic')).toBe(true);
  });

  it('support: adequate coverage -> no supp rec', () => {
    const recs = generateTrainingRecommendations({ historyWorkouts: [], level: 'intermediate', weakPoints: [], onCourse: true, supportCoverage: { hepatic: 0.8, cardio: 0.8, neuro: 0.8, renal: 0.8 } });
    expect(recs.some(r => r.id.startsWith('supp-'))).toBe(false);
  });

});