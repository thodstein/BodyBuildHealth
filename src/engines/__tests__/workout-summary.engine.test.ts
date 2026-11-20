import { describe, expect, it } from 'vitest';
import {
  buildWorkoutSummary,
  buildWorkoutInsights,
  buildSetDetails,
  compareWorkoutSummaries,
  filterWorkoutsByRange,
  formatSummaryPeriod,
  monthRange,
  muscleLandmarksFor,
  volumeAdvice,
  resolveExerciseMeta,
  sessionToWorkoutLog,
  summaryWeeksCount,
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
    expect(ALL_REPORT_BLOCKS).toContain('insights');
  });
});

describe('workout-summary: выводы', () => {
  it('ловит перекос жимы/тяги', () => {
    const push = mkWorkout('2026-11-10', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 4 }]);
    const pull = mkWorkout('2026-11-11', [{ name: 'Тяга штанги в наклоне', id: 'row_bar', weight: 70, reps: 10, sets: 2 }]);
    const ins = buildWorkoutInsights(buildWorkoutSummary([push, pull]));
    const balance = ins.find(x => x.id === 'pushpull');
    expect(balance?.tone).toBe('warn');
    expect(balance?.title).toMatch(/Жимы перевешивают/);
  });

  it('хвалит сбалансированные жимы и тяги', () => {
    const push = mkWorkout('2026-11-10', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 }]);
    const pull = mkWorkout('2026-11-11', [{ name: 'Тяга штанги в наклоне', id: 'row_bar', weight: 70, reps: 10, sets: 3 }]);
    const ins = buildWorkoutInsights(buildWorkoutSummary([push, pull]));
    expect(ins.find(x => x.id === 'pushpull')?.tone).toBe('good');
  });

  it('видит провал тоннажа между неделями', () => {
    const heavy = mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 100, reps: 8, sets: 3 }]);
    const light = mkWorkout('2026-11-09', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 50, reps: 5, sets: 1 }]);
    const ins = buildWorkoutInsights(buildWorkoutSummary([heavy, light]));
    const trend = ins.find(x => x.id === 'trend');
    expect(trend?.tone).toBe('warn');
    expect(trend?.title).toMatch(/Тоннаж недели -/);
  });

  it('предупреждает о работе в отказ (RIR 0)', () => {
    const hard = mkWorkout('2026-11-10', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3, rir: 0 }]);
    const summary = buildWorkoutSummary([hard]);
    expect(summary.totals.avgRIR).toBe(0);
    const ins = buildWorkoutInsights(summary);
    expect(ins.some(x => x.id === 'rir' && x.tone === 'warn')).toBe(true);
  });

  it('на пустой сводке молчит', () => {
    expect(buildWorkoutInsights(buildWorkoutSummary([]))).toEqual([]);
  });

  it('видит мышцы ниже MEV по недельному объёму', () => {
    const weeks = ['2026-11-02', '2026-11-09', '2026-11-16'].map(d =>
      mkWorkout(d, [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 }]),
    );
    const ins = buildWorkoutInsights(buildWorkoutSummary(weeks), 'intermediate');
    const under = ins.find(x => x.id === 'under-mev');
    expect(under?.title).toMatch(/Ниже MEV/);
    expect(under?.title).toMatch(/Грудь/);
  });

  it('видит мышцы выше MRV', () => {
    const weeks = ['2026-11-02', '2026-11-09', '2026-11-16'].map(d =>
      mkWorkout(d, [
        { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 12 },
        { name: 'Жим гантелей лёжа', id: 'bench_db', weight: 30, reps: 10, sets: 13 },
      ]),
    );
    const ins = buildWorkoutInsights(buildWorkoutSummary(weeks), 'intermediate');
    expect(ins.find(x => x.id === 'over-mrv')?.tone).toBe('warn');
  });
});

describe('workout-summary: ориентиры объёма', () => {
  it('MEV/MAV/MRV берутся из канонического движка по уровню', () => {
    const lm = muscleLandmarksFor('chest', 12, 'intermediate');
    expect(lm).toEqual({ weeklySets: 12, mev: 8, mav: 14, mrv: 20, status: 'optimal' });
    expect(muscleLandmarksFor('chest', 5, 'intermediate')?.status).toBe('below_mev');
    expect(muscleLandmarksFor('chest', 22, 'intermediate')?.status).toBe('exceeding_mrv');
  });

  it('нет ориентиров для неканонических мышц', () => {
    expect(muscleLandmarksFor('other', 10, 'intermediate')).toBeNull();
    expect(muscleLandmarksFor('fullbody', 10, 'beginner')).toBeNull();
  });

  it('summaryWeeksCount считает недели с тренировками', () => {
    const s = buildWorkoutSummary([
      mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8 }]),
      mkWorkout('2026-11-03', [{ name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5 }]),
      mkWorkout('2026-11-09', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8 }]),
    ]);
    expect(summaryWeeksCount(s)).toBe(2);
    expect(summaryWeeksCount(buildWorkoutSummary([]))).toBe(1);
  });
});

describe('workout-summary: детализация подходов', () => {
  it('отдаёт подходы как есть, свежие тренировки первыми', () => {
    const older = mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 2, rir: 2 }]);
    const newer = mkWorkout('2026-11-09', [{ name: 'Тяга верхнего блока', id: 'pulldown', weight: 60, reps: 10, sets: 3, rir: 1 }]);
    const details = buildSetDetails([older, newer]);
    expect(details.map(d => d.date)).toEqual(['2026-11-09', '2026-11-02']);
    expect(details[0].exercises[0].name).toBe('Тяга верхнего блока');
    expect(details[0].exercises[0].sets).toHaveLength(3);
    expect(details[0].exercises[0].sets[0]).toEqual({ weight: 60, reps: 10, rir: 1, rpe: 7 });
    expect(details[0].tonnageKg).toBe(60 * 10 * 3);
  });

  it('RIR 0 сохраняется как значение, а не как «нет данных»', () => {
    const w = mkWorkout('2026-11-10', [{ name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5, sets: 1, rir: 0 }]);
    expect(buildSetDetails([w])[0].exercises[0].sets[0].rir).toBe(0);
  });

  it('устойчив к legacy-записям и мусору', () => {
    const legacy = {
      id: 'legacy_1',
      date: '2026-11-05',
      duration: 45,
      split: 'FullBody',
      exercises: [
        { name: 'Жим гантелей лёжа', sets: [{ weightKg: 30, reps: 12 }, { reps: 10 }] },
        { exerciseName: 'Планка', sets: [] },
        null,
      ],
    } as any;
    const details = buildSetDetails([legacy, null as any, { id: 'broken', date: '2026-11-06', exercises: 'oops' } as any]);
    expect(details).toHaveLength(2);
    const day = details.find(d => d.date === '2026-11-05');
    expect(day?.exercises).toHaveLength(1);
    expect(day?.exercises[0].sets.map(s => s.weight)).toEqual([30, 0]);
    expect(day?.exercises[0].sets[1].rir).toBeNull();
    expect(details.find(d => d.date === '2026-11-06')?.exercises).toEqual([]);
  });

  it('блок «Подходы» есть в наборе блоков', () => {
    expect(ALL_REPORT_BLOCKS).toContain('sets');
  });
});

describe('workout-summary: недельная динамика и интенсивность', () => {
  const w1 = mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 }]);
  const w2 = mkWorkout('2026-11-09', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 5 }]);

  it('считает КПШ по неделям', () => {
    const s = buildWorkoutSummary([w1, w2]);
    expect(s.weeks.map(w => w.reps)).toEqual([24, 40]);
  });

  it('строит подходы по неделям и тренд по мышце', () => {
    const s = buildWorkoutSummary([w1, w2]);
    const chest = s.muscles.find(m => m.muscle === 'chest');
    expect(chest?.weeklySets).toEqual([3, 5]);
    expect(chest?.weeklyTrendPct).toBe(66.7);
  });

  it('одна неделя не даёт тренда', () => {
    const s = buildWorkoutSummary([w1]);
    expect(s.muscles[0].weeklySets).toEqual([3]);
    expect(s.muscles[0].weeklyTrendPct).toBeNull();
  });

  it('интенсивность — средний вес в % от лучшего e1RM', () => {
    const s = buildWorkoutSummary([w1]);
    // 80 кг при e1RM 101 → 79.2%
    expect(s.exercises[0].avgIntensityPct).toBe(79.2);
    expect(s.totals.avgIntensityPct).toBe(79.2);
  });

  it('выводит тренд объёма мышцы по неделям', () => {
    const ins = buildWorkoutInsights(buildWorkoutSummary([w1, w2]));
    expect(ins.find(i => i.id === 'muscle-trend')?.title).toContain('+66.7%');
  });

  it('замечает высокую интенсивность', () => {
    const hi = buildWorkoutSummary([
      mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 90, reps: 3, sets: 3 }]),
      mkWorkout('2026-11-09', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 90, reps: 3, sets: 3 }]),
    ]);
    expect(buildWorkoutInsights(hi).some(i => i.id === 'intensity')).toBe(true);
  });

  it('видит недобор объёма несколько недель подряд', () => {
    const s = buildWorkoutSummary([
      mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 }]),
      mkWorkout('2026-11-09', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 }]),
      mkWorkout('2026-11-16', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 }]),
    ]);
    expect(buildWorkoutInsights(s).find(i => i.id === 'mev-streak')?.title).toContain('3 нед. подряд');
  });

  it('видит перебор MRV несколько недель подряд', () => {
    const s = buildWorkoutSummary([
      mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 21 }]),
      mkWorkout('2026-11-09', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 21 }]),
    ]);
    expect(buildWorkoutInsights(s).find(i => i.id === 'mrv-streak')?.title).toContain('2 нед. подряд');
  });

  it('неделя отдыха сбрасывает серию', () => {
    const s = buildWorkoutSummary([
      mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 }]),
      mkWorkout('2026-11-16', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 }]),
    ]);
    expect(buildWorkoutInsights(s).some(i => i.id === 'mev-streak')).toBe(false);
  });

  it('узнаёт разгрузку по сравнению с прошлым периодом', () => {
    const previous = buildWorkoutSummary([
      mkWorkout('2026-11-02', [
        { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 6 },
        { name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5, sets: 6 },
      ]),
      mkWorkout('2026-11-04', [
        { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 6 },
        { name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5, sets: 6 },
      ]),
    ]);
    const current = buildWorkoutSummary([
      mkWorkout('2026-11-09', [
        { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 },
        { name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5, sets: 3 },
      ]),
      mkWorkout('2026-11-11', [
        { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 },
        { name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5, sets: 3 },
      ]),
    ]);
    const cmp = compareWorkoutSummaries(current, previous);
    const deload = buildWorkoutInsights(current, 'intermediate', cmp).find(i => i.id === 'deload');
    expect(deload).toBeTruthy();
    expect(deload!.title).toContain('-50%');
    expect(deload!.title).toContain('2 мышц');
    expect(deload!.detail).toContain('Грудь');
  });

  it('не называет разгрузкой падение объёма у одной мышцы', () => {
    const previous = buildWorkoutSummary([
      mkWorkout('2026-11-02', [
        { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 6 },
        { name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5, sets: 6 },
      ]),
    ]);
    const current = buildWorkoutSummary([
      mkWorkout('2026-11-09', [
        { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 2 },
        { name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5, sets: 6 },
      ]),
    ]);
    const cmp = compareWorkoutSummaries(current, previous);
    expect(buildWorkoutInsights(current, 'intermediate', cmp).some(i => i.id === 'deload')).toBe(false);
  });

  it('без сравнения разгрузку не выдумывает', () => {
    const s = buildWorkoutSummary([
      mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 }]),
    ]);
    expect(buildWorkoutInsights(s).some(i => i.id === 'deload')).toBe(false);
    expect(buildWorkoutInsights(s, 'intermediate', compareWorkoutSummaries(s, null)).some(i => i.id === 'deload')).toBe(false);
  });
});

describe('workout-summary: прогрессия упражнений', () => {
  it('собирает e1RM по тренировкам и считает прирост', () => {
    const w1 = mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 }]);
    const w2 = mkWorkout('2026-11-09', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 90, reps: 8, sets: 3 }]);
    const ex = buildWorkoutSummary([w1, w2]).exercises.find(e => e.name === 'Жим штанги лёжа');
    expect(ex?.e1rmSeries).toEqual([101, 114]);
    expect(ex?.progressPct).toBe(12.9);
  });

  it('одна тренировка не выдаёт прирост', () => {
    const w = mkWorkout('2026-11-02', [{ name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5 }]);
    const ex = buildWorkoutSummary([w]).exercises[0];
    expect(ex.e1rmSeries).toHaveLength(1);
    expect(ex.progressPct).toBeNull();
  });

  it('упражнения без веса не попадают в серию e1RM', () => {
    const w = mkWorkout('2026-11-02', [{ name: 'Планка', id: 'plank', weight: 0, reps: 60, sets: 2 }]);
    const ex = buildWorkoutSummary([w]).exercises[0];
    expect(ex.e1rmSeries).toEqual([]);
    expect(ex.progressPct).toBeNull();
  });
});

describe('workout-summary: сравнение периодов', () => {
  const previous = buildWorkoutSummary([
    mkWorkout('2026-11-02', [
      { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 },
      { name: 'Тяга верхнего блока', id: 'pulldown', weight: 60, reps: 10, sets: 3 },
    ]),
  ]);
  const current = buildWorkoutSummary([
    mkWorkout('2026-11-09', [
      { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 90, reps: 8, sets: 3 },
      { name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5, sets: 2 },
    ]),
  ]);

  it('считает дельты объёма и движений', () => {
    const c = compareWorkoutSummaries(current, previous);
    expect(c.empty).toBe(false);
    expect(c.metrics.sets).toEqual({ current: 5, previous: 6, delta: -1, pct: -16.7 });
    expect(c.metrics.reps).toEqual({ current: 34, previous: 54, delta: -20, pct: -37 });
    expect(c.metrics.tonnage).toEqual({ current: 3160, previous: 3720, delta: -560, pct: -15.1 });
    expect(c.metrics.sessions).toEqual({ current: 1, previous: 1, delta: 0, pct: 0 });
  });

  it('видит пропавшие и новые мышцы', () => {
    const c = compareWorkoutSummaries(current, previous);
    const byMuscle = new Map(c.muscles.map(m => [m.muscle, m]));
    expect(byMuscle.get('chest')?.sets.delta).toBe(0);
    expect(byMuscle.get('chest')?.tonnage).toEqual({ current: 2160, previous: 1920, delta: 240, pct: 12.5 });
    expect(byMuscle.get('back')?.sets).toEqual({ current: 0, previous: 3, delta: -3, pct: -100 });
    expect(byMuscle.get('quads')?.sets).toEqual({ current: 2, previous: 0, delta: 2, pct: null });
  });

  it('сравнивает лучший e1RM по упражнениям', () => {
    const c = compareWorkoutSummaries(current, previous);
    const bench = c.exercises.find(e => e.name === 'Жим штанги лёжа');
    expect(bench?.e1rm).toEqual({ current: 114, previous: 101, delta: 13, pct: 12.9 });
    const squat = c.exercises.find(e => e.name === 'Приседания со штангой');
    expect(squat?.e1rm).toEqual({ current: 117, previous: 0, delta: 117, pct: null });
  });

  it('без предыдущего периода помечает сравнение пустым', () => {
    const c = compareWorkoutSummaries(current, null);
    expect(c.empty).toBe(true);
    expect(c.metrics.tonnage).toEqual({ current: 3160, previous: 0, delta: 3160, pct: null });
    expect(c.muscles.every(m => m.sets.previous === 0)).toBe(true);
  });
});

describe('workout-summary: рекорды и подходы без веса', () => {
  const mkEx = (date: string, name: string, id: string, sets: Array<{ weight: number; reps: number }>): StrengthLogEntry => ({
    id: `${date}_${id}`,
    date,
    exerciseId: id,
    exerciseName: name,
    isCompound: true,
    weekNumber: 1,
    sets: sets.map(s => ({ weight: s.weight, reps: s.reps, rir: 2, rpe: 7 })),
    totalVolume: sets.reduce((a, s) => a + s.weight * s.reps, 0),
    estimated1RM: 0,
  });
  const wrap = (date: string, exercises: StrengthLogEntry[]): WorkoutLog => ({
    id: `w_${date}`,
    date,
    duration: 60,
    exercises,
    overallRPE: 7,
    recoveryBefore: 4,
    split: 'FullBody',
  });

  it('первая тренировка периода — база, а не рекорд', () => {
    const s = buildWorkoutSummary([
      wrap('2026-11-02', [mkEx('2026-11-02', 'Жим штанги лёжа', 'bench_bar', [{ weight: 80, reps: 8 }])]),
    ]);
    expect(s.prs).toHaveLength(0);
    expect(s.totals.prs).toBe(0);
  });

  it('один рекорд на упражнение за тренировку, вес и повторы из одного подхода', () => {
    const s = buildWorkoutSummary([
      wrap('2026-11-02', [mkEx('2026-11-02', 'Жим штанги лёжа', 'bench_bar', [{ weight: 90, reps: 5 }])]),
      wrap('2026-11-09', [mkEx('2026-11-09', 'Жим штанги лёжа', 'bench_bar', [
        { weight: 100, reps: 3 }, { weight: 70, reps: 12 }, { weight: 60, reps: 15 },
      ])]),
    ]);
    expect(s.prs).toHaveLength(1);
    expect(s.prs[0]).toMatchObject({ weight: 100, reps: 3, e1rm: 110, deltaPct: 4.8 });
  });

  it('с внешней базой рекорд виден и на первой тренировке периода', () => {
    const baseline = [wrap('2026-10-26', [mkEx('2026-10-26', 'Жим штанги лёжа', 'bench_bar', [{ weight: 90, reps: 5 }])])];
    const s = buildWorkoutSummary(
      [wrap('2026-11-02', [mkEx('2026-11-02', 'Жим штанги лёжа', 'bench_bar', [{ weight: 100, reps: 3 }])])],
      baseline,
    );
    expect(s.prs).toHaveLength(1);
    expect(s.prs[0]).toMatchObject({ weight: 100, reps: 3, e1rm: 110, deltaPct: 4.8 });
  });

  it('подходы без веса считаются, но не дают тоннажа', () => {
    const s = buildWorkoutSummary([
      wrap('2026-11-02', [
        mkEx('2026-11-02', 'Подтягивания', 'pullup', [{ weight: 0, reps: 10 }, { weight: 0, reps: 8 }]),
        mkEx('2026-11-02', 'Жим штанги лёжа', 'bench_bar', [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }]),
      ]),
    ]);
    expect(s.totals.weightlessSets).toBe(2);
    expect(s.totals.tonnageKg).toBe(1280);
    expect(s.totals.sets).toBe(4);
    expect(s.exercises.find(e => e.name === 'Подтягивания')?.weightlessSets).toBe(2);
    expect(s.exercises.find(e => e.name === 'Подтягивания')?.tonnageKg).toBe(0);
  });
});

describe('workout-summary: что делать с объёмом мышцы', () => {
  const lm = (weeklySets: number, mev: number, mav: number, mrv: number, status: any) =>
    ({ weeklySets, mev, mav, mrv, status });

  it('ниже MEV — говорит, сколько добавить', () => {
    const adv = volumeAdvice(lm(4, 8, 14, 20, 'below_mev'));
    expect(adv).toEqual(expect.objectContaining({ delta: 4, chip: '+4/нед до MEV' }));
    expect(adv!.hint).toContain('не хватает 4');
  });

  it('в норме — показывает запас до MRV', () => {
    const adv = volumeAdvice(lm(12, 8, 14, 20, 'optimal'));
    expect(adv).toEqual(expect.objectContaining({ delta: 8, chip: 'запас +8 до MRV' }));
  });

  it('близко к MRV — предупреждает, что дальше предел', () => {
    const adv = volumeAdvice(lm(19, 8, 14, 20, 'approaching_mrv'));
    expect(adv).toEqual(expect.objectContaining({ delta: 1, chip: '+1 до предела' }));
    expect(adv!.hint).toContain('близок к предельному');
  });

  it('выше MRV — говорит, сколько убрать', () => {
    const adv = volumeAdvice(lm(24, 8, 14, 20, 'exceeding_mrv'));
    expect(adv).toEqual(expect.objectContaining({ delta: -4, chip: '−4/нед' }));
    expect(adv!.hint).toContain('уберите');
  });

  it('ниже MEV не выдаёт нулевую правку', () => {
    // 7.6 округляется до 8 = MEV, но статус ещё below_mev — совет не должен стать «+0».
    expect(volumeAdvice(lm(7.6, 8, 14, 20, 'below_mev'))?.delta).toBe(1);
  });

  it('без ориентиров молчит', () => {
    expect(volumeAdvice(null)).toBeNull();
    expect(volumeAdvice(lm(NaN, 8, 14, 20, 'optimal'))).toBeNull();
  });
});
