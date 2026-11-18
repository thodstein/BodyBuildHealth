/**
 * Аудит 2026-11, P3-6: добивка «➕ Ёмкость сессии» (цикловый путь, `expandAllMuscles`).
 *
 * Функция добавляет упражнение мышцы, когда все её движения уже на пер-упражненческом
 * капе, а пер-сессионная цель не набрана. Было:
 *  1) кандидат искался только по «tier ≤ 2 + та же мышца», поэтому в день с жимом лёжа
 *     вторым упражнением ставился ещё один жим лёжа (тот же паттерн подряд);
 *  2) вес — жёсткие 50 % workMax, не связанные со схемой дня (82.5 кг в дне, где схема
 *     40/60 % → «ровный» вес на 12 повторов).
 *
 * Стало: сначала ищем кандидата с ДРУГИМ паттерном движения (прежний поиск — запасной,
 * цель сессии важнее), а вес считаем по фактической интенсивности мышцы в этой сессии.
 */
import { describe, expect, it } from 'vitest';
import { ensureMuscleSessionCapacity } from '../bb-finalize.engine';

const ex = (name: string, muscle: string, sets: number, weight: number, pattern: string) => ({
  muscle,
  name,
  exerciseName: name,
  role: 'primary',
  character: 'сила',
  sets,
  repsRange: [6, 8],
  rir: 2,
  restSeconds: 120,
  warmupSets: [],
  movementPattern: pattern,
  workSets: Array.from({ length: sets }, () => ({ weight, reps: 8, rir: 2, restSeconds: 120 })),
});

const pushWeek = (weight = 82.5) => ({
  week: 1,
  phase: 'accumulation',
  sessions: [
    { sessionTag: 'Push', exercises: [ex('Жим штанги лёжа', 'chest', 10, weight, 'horizontal_push')] },
  ],
});

const baseOptions = () => ({
  expandAllMuscles: true,
  level: 'intermediate',
  trainingYears: 4,
  onCourse: false,
  maxWorkingSets: 60,
  maxExercises: 16,
  workMax: { chest: 100 },
} as any);

const chestPlan = () => ({ weeks: [], volumeTargets: { chest: { targetSets: 12 } } } as any);

describe('P3-6: добивка ёмкости сессии', () => {
  it('добавляет движение ДРУГОГО паттерна, а не второй жим лёжа', () => {
    const week = pushWeek();
    ensureMuscleSessionCapacity(week, chestPlan(), baseOptions());
    expect(week.sessions[0].exercises).toHaveLength(2);
    const added: any = week.sessions[0].exercises[1];
    expect(added.muscle).toBe('chest');
    expect(String(added.movementPattern || '')).not.toBe('');
    expect(added.movementPattern).not.toBe('horizontal_push');
    // Комментарий фиксирует именно добивку, а не замену.
    expect(String(added.comment)).toContain('➕ Ёмкость сессии');
    expect(added.sets).toBe(3);
  });

  it('вес — по фактической интенсивности мышцы в сессии, а не «плоские 50 %»', () => {
    const week = pushWeek();
    ensureMuscleSessionCapacity(week, chestPlan(), baseOptions());
    const added: any = week.sessions[0].exercises[1];
    // 82.5 кг при workMax 100 → 82.5, а не 50.
    expect(added.workSets.map((ws: any) => ws.weight)).toEqual([82.5, 82.5, 82.5]);
  });

  it('без данных о рабочих весах — прежние 50 % workMax', () => {
    const week = pushWeek(0);
    ensureMuscleSessionCapacity(week, chestPlan(), baseOptions());
    const added: any = week.sessions[0].exercises[1];
    expect(added.workSets[0].weight).toBe(50);
  });

  it('без expandAllMuscles, при исключённой мышце и на потолке упражнений — не добавляет', () => {
    const noExpand = pushWeek();
    ensureMuscleSessionCapacity(noExpand, chestPlan(), { ...baseOptions(), expandAllMuscles: false });
    expect(noExpand.sessions[0].exercises).toHaveLength(1);

    const excluded = pushWeek();
    ensureMuscleSessionCapacity(excluded, chestPlan(), { ...baseOptions(), excludedMuscles: ['chest'] });
    expect(excluded.sessions[0].exercises).toHaveLength(1);

    const capped = pushWeek();
    ensureMuscleSessionCapacity(capped, chestPlan(), { ...baseOptions(), maxExercises: 1 });
    expect(capped.sessions[0].exercises).toHaveLength(1);
  });

  it('если упражнение мышцы ещё не на капе — растим его, а не добавляем движение', () => {
    const week = pushWeek();
    week.sessions[0].exercises[0].sets = 4; // perExerciseCap = 5
    ensureMuscleSessionCapacity(week, chestPlan(), baseOptions());
    expect(week.sessions[0].exercises).toHaveLength(1);
  });
});
