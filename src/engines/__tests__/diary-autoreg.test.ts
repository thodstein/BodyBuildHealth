import { describe, it, expect } from 'vitest';
import { buildDiaryAutoreg } from '../pro/diary-autoreg.engine';
import type { WorkoutLog } from '../../core/types';

function makeWorkoutLog(exerciseName: string, date: string, sets: { weight: number; reps: number; rpe?: number; rir?: number }[], estimated1RM?: number): WorkoutLog {
  return {
    id: `log_${exerciseName}_${date}`,
    date,
    duration: 60,
    overallRPE: 8,
    recoveryBefore: 70,
    split: 'test',
    exercises: [{
      id: `ex_${exerciseName}_${date}`,
      date,
      exerciseId: exerciseName.toLowerCase(),
      exerciseName,
      sets: sets.map(s => ({ weight: s.weight, reps: s.reps, rir: s.rir ?? 2, rpe: s.rpe })),
      totalVolume: sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
      estimated1RM: estimated1RM ?? Math.round(sets[0].weight * (1 + sets[0].reps / 30)),
      isCompound: true,
    }],
  };
}

describe('buildDiaryAutoreg', () => {
  const plannedExercises = [
    { name: 'Жим лёжа', plannedWeight: 80, plannedReps: 5, plannedSets: 5, plannedRir: 2, isMain: true },
    { name: 'Присед', plannedWeight: 100, plannedReps: 5, plannedSets: 5, plannedRir: 2, isMain: true },
  ];

  it('факт RPE 9.5, план RIR 2 (RPE 8) → вес снижен', () => {
    const history = [makeWorkoutLog('Жим лёжа', '2026-07-01', [{ weight: 82, reps: 5, rpe: 9.5 }])];
    const r = buildDiaryAutoreg({ historyWorkouts: history, plannedExercises });
    const adj = r.perExercise.get('Жим лёжа');
    expect(adj).toBeDefined();
    expect(adj!.source).toBe('diary');
    expect(adj!.adjustedWeight).toBeLessThan(plannedExercises[0].plannedWeight);
    expect(adj!.note).toContain('снижен');
  });

  it('факт RPE 6, план RIR 2 (RPE 8) → вес повышен', () => {
    // e1RM из факта (90кг×(1+5/30)=105) выше планового (80кг @ RPE 8 ≈ 96)
    const history = [makeWorkoutLog('Жим лёжа', '2026-07-01', [{ weight: 90, reps: 5, rpe: 6 }], 105)];
    const r = buildDiaryAutoreg({ historyWorkouts: history, plannedExercises });
    const adj = r.perExercise.get('Жим лёжа');
    expect(adj).toBeDefined();
    expect(adj!.adjustedWeight).toBeGreaterThan(plannedExercises[0].plannedWeight);
    expect(adj!.note).toContain('повышен');
  });

  it('факт RPE 8, план RIR 2 (RPE 8) → без изменений', () => {
    const history = [makeWorkoutLog('Жим лёжа', '2026-07-01', [{ weight: 80, reps: 5, rpe: 8 }])];
    const r = buildDiaryAutoreg({ historyWorkouts: history, plannedExercises });
    const adj = r.perExercise.get('Жим лёжа');
    expect(adj).toBeDefined();
    expect(adj!.note).toContain('в норме');
  });

  it('нет данных по упражнению → fallback', () => {
    const history: WorkoutLog[] = [];
    const r = buildDiaryAutoreg({ historyWorkouts: history, plannedExercises });
    const adj = r.perExercise.get('Жим лёжа');
    expect(adj).toBeDefined();
    expect(adj!.source).toBe('fallback');
    expect(adj!.adjustedWeight).toBe(plannedExercises[0].plannedWeight);
    expect(adj!.note).toContain('нет данных');
    expect(r.summary.noData).toBe(2);
  });

  it('factRPE ≥ 9.5 → -1 подход', () => {
    const history = [makeWorkoutLog('Жим лёжа', '2026-07-01', [{ weight: 85, reps: 5, rpe: 9.5 }])];
    const r = buildDiaryAutoreg({ historyWorkouts: history, plannedExercises });
    const adj = r.perExercise.get('Жим лёжа');
    expect(adj!.adjustedSets).toBe(plannedExercises[0].plannedSets - 1);
    expect(adj!.note).toContain('усталость');
  });

  it('plateau: 3+ сессии без роста e1RM → plateauWarning', () => {
    const history = [
      makeWorkoutLog('Жим лёжа', '2026-06-01', [{ weight: 80, reps: 5 }], 93),
      makeWorkoutLog('Жим лёжа', '2026-06-15', [{ weight: 81, reps: 5 }], 94),
      makeWorkoutLog('Жим лёжа', '2026-07-01', [{ weight: 80, reps: 5 }], 93),
    ];
    const r = buildDiaryAutoreg({ historyWorkouts: history, plannedExercises });
    expect(r.plateauWarnings.length).toBeGreaterThan(0);
    expect(r.plateauWarnings[0]).toContain('Жим лёжа');
  });

  it('не считает плато, если средняя из трёх сессий была заметно сильнее', () => {
    const history = [
      makeWorkoutLog('Жим лёжа', '2026-06-01', [{ weight: 80, reps: 5 }], 93),
      makeWorkoutLog('Жим лёжа', '2026-06-15', [{ weight: 80, reps: 5 }], 100),
      makeWorkoutLog('Жим лёжа', '2026-07-01', [{ weight: 80, reps: 5 }], 93),
    ];
    const r = buildDiaryAutoreg({ historyWorkouts: history, plannedExercises });
    expect(r.plateauWarnings).toHaveLength(0);
  });

  it('fuzzy match: «Жим лёжа» в плане, «Жим штанги лёжа» в дневнике', () => {
    const history = [makeWorkoutLog('Жим штанги лёжа', '2026-07-01', [{ weight: 82, reps: 5, rpe: 9 }])];
    const r = buildDiaryAutoreg({ historyWorkouts: history, plannedExercises });
    const adj = r.perExercise.get('Жим лёжа');
    expect(adj).toBeDefined();
    expect(adj!.source).toBe('diary');
    expect(adj!.factWeight).toBe(82);
  });

  it('берёт последнюю сессию (по дате)', () => {
    const history = [
      makeWorkoutLog('Жим лёжа', '2026-06-01', [{ weight: 70, reps: 5, rpe: 7 }]),
      makeWorkoutLog('Жим лёжа', '2026-07-01', [{ weight: 82, reps: 5, rpe: 9.5 }]),
    ];
    const r = buildDiaryAutoreg({ historyWorkouts: history, plannedExercises });
    const adj = r.perExercise.get('Жим лёжа');
    expect(adj!.factWeight).toBe(82);
    expect(adj!.factRPE).toBeGreaterThanOrEqual(9);
  });

  it('summary считает adjusted/unchanged/noData', () => {
    const history = [
      makeWorkoutLog('Жим лёжа', '2026-07-01', [{ weight: 82, reps: 5, rpe: 9.5 }]),
      // Присед — нет данных
    ];
    const r = buildDiaryAutoreg({ historyWorkouts: history, plannedExercises });
    expect(r.summary.adjusted).toBeGreaterThanOrEqual(1); // Жим скорректирован
    expect(r.summary.noData).toBe(1); // Присед без данных
  });

  it('RPE не задан → вычисляется через rpeFromLoad', () => {
    const history = [makeWorkoutLog('Жим лёжа', '2026-07-01', [{ weight: 80, reps: 5 }], 100)]; // e1RM=100
    const r = buildDiaryAutoreg({ historyWorkouts: history, plannedExercises });
    const adj = r.perExercise.get('Жим лёжа');
    expect(adj).toBeDefined();
    expect(adj!.factRPE).toBeGreaterThan(0);
    expect(adj!.factRPE).toBeLessThanOrEqual(10);
  });
});
