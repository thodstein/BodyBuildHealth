import { describe, expect, it } from 'vitest';
import {
  buildWorkoutSummary,
  filterWorkoutsByRange,
  formatSummaryPeriod,
  monthRange,
  resolveExerciseMeta,
  sessionToWorkoutLog,
  weekRangeFor,
  ALL_REPORT_BLOCKS,
} from '../workout-summary.engine';
import type { WorkoutLog, StrengthLogEntry } from '../../core/types';

function mkWorkout(date: string, rows: Array<{ name: string; id?: string; weight: number; reps: number; sets?: number; rir?: number }>, duration = 60): WorkoutLog {
  const exercises: StrengthLogEntry[] = rows.map((r, i) => ({
    id: `${date}_${i}`,
    date,
    exerciseId: r.id || r.name,
    exerciseName: r.name,
    isCompound: true,
    weekNumber: 1,
    sets: Array.from({ length: r.sets ?? 2 }, () => ({ weight: r.weight, reps: r.reps, rir: r.rir ?? 2, rpe: 7 })),
    totalVolume: r.weight * r.reps * (r.sets ?? 2),
    estimated1RM: Math.round(r.weight * (1 + r.reps / 30)),
  }));
  return {
    id: `w_${date}`,
    date,
    duration,
    exercises,
    overallRPE: 7,
    recoveryBefore: 4,
    split: 'FullBody',
  };
}

describe('workout-summary: сводка по одной тренировке', () => {
  const w = mkWorkout('2026-11-10', [
    { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 },
    { name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5, sets: 2 },
  ]);

  it('считает тоннаж, подходы и повторы', () => {
    const s = buildWorkoutSummary([w]);
    expect(s.workouts).toBe(1);
    expect(s.totals.sets).toBe(5);
    expect(s.totals.reps).toBe(34);
    expect(s.totals.tonnageKg).toBe(80 * 8 * 3 + 100 * 5 * 2);
    expect(s.totals.uniqueExercises).toBe(2);
  });

  it('группирует по мышцам и упражнениям', () => {
    const s = buildWorkoutSummary([w]);
    const muscles = s.muscles.map(m => m.muscle);
    expect(muscles).toContain('chest');
    expect(muscles).toContain('quads');
    expect(s.muscles.reduce((x, m) => x + m.sets, 0)).toBe(5);
    expect(s.exercises[0].tonnageKg).toBeGreaterThanOrEqual(s.exercises[1].tonnageKg);
    expect(Math.round(s.exercises.reduce((x, e) => x + e.sharePct, 0))).toBe(100);
  });

  it('показывает движения (паттерны)', () => {
    const s = buildWorkoutSummary([w]);
    const labels = s.patterns.map(p => p.label);
    expect(labels.some(l => /Горизонтальный жим/i.test(l))).toBe(true);
    expect(labels.some(l => /Приседание/i.test(l))).toBe(true);
  });
});

describe('workout-summary: период из нескольких тренировок', () => {
  const workouts = [
    mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8 }]),
    mkWorkout('2026-11-04', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 85, reps: 8 }]),
    mkWorkout('2026-11-09', [{ name: 'Тяга штанги в наклоне', id: 'row_bar', weight: 70, reps: 10 }]),
  ];

  it('агрегирует сессии, недели и рекорды', () => {
    const s = buildWorkoutSummary(workouts);
    expect(s.workouts).toBe(3);
    expect(s.sessions).toHaveLength(3);
    expect(s.weeks.length).toBe(2);
    expect(s.prs.length).toBeGreaterThan(0);
    expect(s.dateFrom).toBe('2026-11-02');
    expect(s.dateTo).toBe('2026-11-09');
    // e1RM вырос с 80×8 до 85×8 → это рекорд периода
    expect(s.prs.some(p => p.exercise.includes('Жим'))).toBe(true);
    expect(s.exercises.find(e => e.name.includes('Жим'))?.sessions).toBe(2);
  });

  it('не падает на пустом наборе и на битых записях', () => {
    expect(buildWorkoutSummary([]).totals.sessions).toBe(0);
    const broken = [{ id: 'x', date: '2026-11-10', duration: 0, exercises: [{} as any], overallRPE: 0, recoveryBefore: 0, split: '' }] as WorkoutLog[];
    expect(() => buildWorkoutSummary(broken)).not.toThrow();
    expect(buildWorkoutSummary(broken).totals.sets).toBe(0);
  });
});

describe('workout-summary: диапазоны и адаптер сессии', () => {
  it('weekRangeFor даёт пн–вс', () => {
    const r = weekRangeFor('2026-11-11'); // среда
    expect(r.from).toBe('2026-11-09');
    expect(r.to).toBe('2026-11-15');
  });

  it('monthRange даёт календарный месяц', () => {
    const r = monthRange('2026-02');
    expect(r.from).toBe('2026-02-01');
    expect(r.to).toBe('2026-02-28');
  });

  it('filterWorkoutsByRange фильтрует включительно', () => {
    const list = [
      mkWorkout('2026-10-31', [{ name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5 }]),
      mkWorkout('2026-11-03', [{ name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5 }]),
    ];
    expect(filterWorkoutsByRange(list, '2026-11-01', '2026-11-30')).toHaveLength(1);
  });

  it('sessionToWorkoutLog переносит weightKg и считает тоннаж', () => {
    const log = sessionToWorkoutLog({
      sessionId: 's1', date: '2026-11-10', focus: 'Ноги', durationMin: 55,
      exercises: [{ exerciseName: 'Приседания', sets: [{ weightKg: 100, reps: 5, rir: 2, rpe: 7 }] }],
    });
    expect(log.exercises[0].sets[0].weight).toBe(100);
    expect(log.exercises[0].totalVolume).toBe(500);
    const s = buildWorkoutSummary([log]);
    expect(s.totals.sets).toBe(1);
    expect(s.totals.tonnageKg).toBe(500);
  });

  it('resolveExerciseMeta распознаёт мышцу и паттерн', () => {
    expect(resolveExerciseMeta({ exerciseId: 'bench_bar', exerciseName: 'Жим штанги лёжа' }).muscle).toBe('chest');
    expect(resolveExerciseMeta({ exerciseName: 'Подъём на бицепс' }).muscle).toBe('biceps');
    expect(resolveExerciseMeta({ exerciseName: 'Сгибание ног лёжа' }).muscle).toBe('hamstrings');
  });

  it('resolveExerciseMeta работает без каталога (legacy-названия)', () => {
    const rows: Array<[string, string, string]> = [
      ['Жим гантелей лёжа', 'chest', 'horizontal_push'],
      ['Жим гантелей сидя', 'shoulders', 'vertical_push'],
      ['Тяга верхнего блока', 'back', 'vertical_pull'],
      ['Тяга штанги в наклоне', 'back', 'horizontal_pull'],
      ['Подъём на носки стоя', 'calves', 'isolation_calves'],
      ['Французский жим', 'triceps', 'isolation_arms'],
      ['Планка', 'core', 'core'],
    ];
    rows.forEach(([name, muscle, pattern]) => {
      const meta = resolveExerciseMeta({ exerciseName: name });
      expect(meta.muscle).toBe(muscle);
      expect(meta.pattern).toBe(pattern);
      expect(meta.patternLabel.length).toBeGreaterThan(0);
    });
  });

  it('formatSummaryPeriod и набор блоков по умолчанию', () => {
    const s = buildWorkoutSummary([mkWorkout('2026-11-10', [{ name: 'Тяга верхнего блока', id: 'pulldown', weight: 60, reps: 10 }])]);
    expect(formatSummaryPeriod(s)).toBe('10.11.2026');
    expect(ALL_REPORT_BLOCKS).toContain('muscles');
    expect(ALL_REPORT_BLOCKS).toContain('movement');
  });
});
