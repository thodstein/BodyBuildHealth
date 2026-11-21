import { describe, expect, it } from 'vitest';
import {
  buildWorkoutSummary,
  buildWorkoutInsights,
  buildWorkoutReportText,
  buildSetDetails,
  compareWorkoutSummaries,
  comparePlanVsActual,
  compareWeekPlanVsActual,
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
    // Доля подходов складывается в 100% и не путается с долей тоннажа.
    expect(s.patterns.map(p => p.setsSharePct)).toEqual([60, 40]);
    expect(s.patterns[0].sharePct).not.toBe(s.patterns[0].setsSharePct);
  });

  it('считает недельный тренд движений', () => {
    const s = buildWorkoutSummary([
      mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 2 }]),
      mkWorkout('2026-11-09', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 4 }]),
    ]);
    const bench = s.patterns.find(p => p.pattern === resolveExerciseMeta({ name: 'Жим штанги лёжа' }).pattern)!;
    expect(bench.weeklySets).toEqual([2, 4]);
    expect(bench.weeklyTrendPct).toBe(100);
    // Одна неделя — базы для тренда нет, нули не выдумываем.
    expect(
      buildWorkoutSummary([mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 2 }])])
        .patterns.every(p => p.weeklyTrendPct === null),
    ).toBe(true);
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
    expect(ALL_REPORT_BLOCKS).toContain('plan');
    expect(ALL_REPORT_BLOCKS).toContain('weekplan');
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
    // Плотность недели: 1920 кг / 60 мин и 3200 кг / 60 мин.
    expect(s.weeks.map(w => w.durationMin)).toEqual([60, 60]);
    expect(s.weeks.map(w => w.densityKgPerMin)).toEqual([32, 53.3]);
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

  it('у движения есть сила: лучший e1RM и его тренд по неделям', () => {
    const heavy = mkWorkout('2026-11-09', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 90, reps: 8, sets: 3 }]);
    const s = buildWorkoutSummary([w1, heavy]);
    const press = s.patterns.find(p => p.pattern === 'horizontal_push')!;
    expect(press.bestE1RM).toBe(114);
    // Сила движения принадлежит конкретному упражнению, а не «паттерну».
    expect(press.bestExercise).toBe('Жим штанги лёжа');
    expect(press.e1rmTrendPct).toBe(12.9);
    const txt = buildWorkoutReportText(s);
    expect(txt).toContain('e1RM 114 (+12.9% к первой неделе)');
  });

  it('одна неделя даёт силу, но не её тренд', () => {
    const press = buildWorkoutSummary([w1]).patterns.find(p => p.pattern === 'horizontal_push')!;
    expect(press.bestE1RM).toBe(101);
    expect(press.e1rmTrendPct).toBeNull();
    // Рост объёма без роста веса — это не рост силы: 0, а не «выросло».
    const press2 = buildWorkoutSummary([w1, w2]).patterns.find(p => p.pattern === 'horizontal_push')!;
    expect(press2.bestE1RM).toBe(101);
    expect(press2.e1rmTrendPct).toBe(0);
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

  it('считает подходы по неделям для упражнения', () => {
    const s = buildWorkoutSummary([w1, w2]);
    const bench = s.exercises[0];
    expect(bench.weeklySets).toEqual([3, 5]);
    expect(bench.weeklyTrendPct).toBe(66.7);
    // В копируемом тексте недельная строка упражнения рядом с e1RM.
    const txt = buildWorkoutReportText(s);
    expect(txt).toContain('подх по неделям 3·5 (+66.7% к первой неделе)');
  });

  it('называет движение, которое выпало из программы', () => {
    const s = buildWorkoutSummary([
      mkWorkout('2026-11-02', [
        { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 6 },
        { name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5, sets: 4 },
      ]),
      mkWorkout('2026-11-09', [
        { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 2 },
        { name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5, sets: 8 },
      ]),
    ]);
    const ins = buildWorkoutInsights(s);
    const drop = ins.find(i => i.id === 'pattern-drop');
    expect(drop?.title).toContain('Горизонтальный жим');
    expect(drop?.title).toContain('-66.7%');
    expect(drop?.detail).toContain('Было 6 подх/нед, стало 2');
    // Рост приседаний не подменяет просадку жима.
    expect(ins.some(i => i.id === 'muscle-trend')).toBe(false);
  });

  it('пропорциональное снижение — это разгрузка, а не выпавшее движение', () => {
    const s = buildWorkoutSummary([
      mkWorkout('2026-11-02', [
        { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 6 },
        { name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5, sets: 4 },
      ]),
      mkWorkout('2026-11-09', [
        { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 },
        { name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5, sets: 2 },
      ]),
    ]);
    expect(buildWorkoutInsights(s).some(i => i.id === 'pattern-drop')).toBe(false);
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

  it('сравнивает средний RIR, а без записи молчит', () => {
    const prev = buildWorkoutSummary([
      mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3, rir: 3 }]),
    ]);
    const cur = buildWorkoutSummary([
      mkWorkout('2026-11-09', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3, rir: 1 }]),
    ]);
    const c = compareWorkoutSummaries(cur, prev);
    expect(c.metrics.rir).toEqual({ current: 1, previous: 3, delta: -2, pct: -66.7 });
    expect(compareWorkoutSummaries(cur, null).metrics.rir).toBeNull();
    expect(compareWorkoutSummaries(prev, prev).metrics.rir).toEqual({ current: 3, previous: 3, delta: 0, pct: 0 });
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

  it('вывод о рекордах называет упражнение и новый e1RM', () => {
    const s = buildWorkoutSummary([
      wrap('2026-11-02', [mkEx('2026-11-02', 'Жим штанги лёжа', 'bench_bar', [{ weight: 90, reps: 5 }])]),
      wrap('2026-11-09', [mkEx('2026-11-09', 'Жим штанги лёжа', 'bench_bar', [{ weight: 100, reps: 3 }])]),
    ]);
    const prs = buildWorkoutInsights(s).find(i => i.id === 'prs');
    expect(prs?.title).toBe('Рекордов: 1');
    expect(prs?.detail).toContain('Жим штанги лёжа 110 кг');
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

  it('по одной тренировке не обещает «/нед»', () => {
    const below = volumeAdvice(lm(4, 8, 14, 20, 'below_mev'), false);
    expect(below).toEqual(expect.objectContaining({ delta: 4, chip: '+4 до MEV' }));
    expect(below!.hint).toContain('Показана одна тренировка');
    expect(volumeAdvice(lm(24, 8, 14, 20, 'exceeding_mrv'), false)?.chip).toBe('−4');
    expect(volumeAdvice(lm(12, 8, 14, 20, 'optimal'), false)?.chip).toBe('запас +8 до MRV');
  });
});

describe('workout-summary: план против факта', () => {
  const actual = () => buildWorkoutSummary([
    mkWorkout('2026-11-03', [
      { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 2 },
      { name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5, sets: 1 },
    ]),
  ]);

  it('совпадение с планом — всё «по плану»', () => {
    const pva = comparePlanVsActual([
      { name: 'Жим штанги лёжа', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }] },
      { name: 'Приседания со штангой', sets: [{ weight: 100, reps: 5 }] },
    ], actual());
    expect(pva.rows.every(r => r.status === 'done')).toBe(true);
    expect(pva.setsPct).toBe(100);
    expect(pva.tonnagePct).toBe(100);
    expect(pva.plannedSets).toBe(3);
    expect(pva.actualSets).toBe(3);
    expect(pva.empty).toBe(false);
  });

  it('недобор подходов — «не добито» и минус в дельте', () => {
    const pva = comparePlanVsActual([
      { name: 'Жим штанги лёжа', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }, { weight: 80, reps: 8 }] },
    ], actual());
    const row = pva.rows.find(r => r.name === 'Жим штанги лёжа')!;
    expect(row.status).toBe('under');
    expect(row.setsDelta).toBe(-1);
    expect(row.setsPct).toBe(66.7);
  });

  it('упражнение из плана не сделано — «пропущено» и в списке', () => {
    const pva = comparePlanVsActual([
      { name: 'Тяга штанги в наклоне', sets: [{ weight: 60, reps: 10 }, { weight: 60, reps: 10 }] },
    ], actual());
    expect(pva.skipped).toEqual(['Тяга штанги в наклоне']);
    const row = pva.rows[0];
    expect(row.status).toBe('skipped');
    expect(row.actualSets).toBe(0);
    expect(row.setsPct).toBe(0);
    expect(row.actualTonnageKg).toBe(0);
  });

  it('лишнее упражнение — «не по плану», выполнение выше 100%', () => {
    const pva = comparePlanVsActual([
      { name: 'Жим штанги лёжа', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }] },
    ], actual());
    expect(pva.unplanned).toEqual(['Приседания со штангой']);
    expect(pva.rows.find(r => r.name === 'Приседания со штангой')?.setsPct).toBeNull();
    expect(pva.plannedSets).toBe(2);
    expect(pva.actualSets).toBe(3);
    expect(pva.setsPct).toBe(150);
  });

  it('склеивает названия по регистру и ё/е', () => {
    const pva = comparePlanVsActual([
      { name: 'жим штанги лежа', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }] },
      { name: 'приседания со штангой', sets: [{ weight: 100, reps: 5 }] },
    ], actual());
    expect(pva.unplanned).toEqual([]);
    const row = pva.rows[0];
    expect(row.status).toBe('done');
    expect(row.name).toBe('жим штанги лежа');
    expect(row.actualSets).toBe(2);
    expect(pva.skipped).toEqual([]);
  });

  it('без плана молчит и не выдумывает проценты', () => {
    const pva = comparePlanVsActual(null, actual());
    expect(pva.empty).toBe(true);
    expect(pva.rows.every(r => r.status === 'unplanned')).toBe(true);
    expect(pva.setsPct).toBeNull();
    expect(pva.tonnagePct).toBeNull();
    expect(comparePlanVsActual([], actual()).plannedSets).toBe(0);
  });

  it('недобор плана попадает в выводы', () => {
    const summary = actual();
    const pva = comparePlanVsActual([
      { name: 'Жим штанги лёжа', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }, { weight: 80, reps: 8 }] },
      { name: 'Тяга штанги в наклоне', sets: [{ weight: 60, reps: 10 }] },
    ], summary);
    const gap = buildWorkoutInsights(summary, 'intermediate', null, pva).find(i => i.id === 'plan-gap');
    expect(gap).toBeTruthy();
    expect(gap!.title).toContain('75%');
    expect(gap!.detail).toContain('не добито: Жим штанги лёжа 2/3');
    expect(gap!.detail).toContain('пропущено: Тяга штанги в наклоне');
    expect(gap!.detail).toContain(`слабее всего — ${resolveExerciseMeta({ name: 'Тяга штанги в наклоне' }).patternLabel} 0/1`);
  });

  it('план и рекорды не вытесняются балансовыми выводами', () => {
    // Три недели, рост веса — рекорды; план недобран; «жимы/тяги» и MEV
    // дают ещё 5 выводов. Раньше план и PR обрезались седьмым слотом.
    const summary = buildWorkoutSummary([
      mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 }]),
      mkWorkout('2026-11-09', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 85, reps: 8, sets: 4 }]),
      mkWorkout('2026-11-16', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 90, reps: 8, sets: 6 }]),
    ]);
    const pva = comparePlanVsActual([
      { name: 'Жим штанги лёжа', sets: Array.from({ length: 20 }, () => ({ weight: 90, reps: 8 })) },
    ], summary);
    const ins = buildWorkoutInsights(summary, 'intermediate', null, pva);
    expect(ins).toHaveLength(7);
    expect(ins.some(i => i.id === 'plan-gap')).toBe(true);
    expect(ins.some(i => i.id === 'prs')).toBe(true);
    // Важное — первым, общий баланс жимов и тяг уступает место новостям.
    expect(ins[0].id).toBe('plan-gap');
  });

  it('сворачивает план по движениям', () => {
    const pva = comparePlanVsActual([
      { name: 'Жим штанги лёжа', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }, { weight: 80, reps: 8 }] },
      { name: 'Приседания со штангой', sets: [{ weight: 100, reps: 5 }, { weight: 100, reps: 5 }] },
      { name: 'Тяга штанги в наклоне', sets: [{ weight: 60, reps: 10 }, { weight: 60, reps: 10 }] },
    ], actual());
    // Факт: жим 2 подх, присед 1 подх, тяги не было.
    const bench = resolveExerciseMeta({ name: 'Жим штанги лёжа' }).pattern;
    const squat = resolveExerciseMeta({ name: 'Приседания со штангой' }).pattern;
    const row = resolveExerciseMeta({ name: 'Тяга штанги в наклоне' }).pattern;
    expect(pva.patterns.find(p => p.pattern === bench)).toMatchObject({ plannedSets: 3, actualSets: 2, setsDelta: -1, setsPct: 66.7 });
    expect(pva.patterns.find(p => p.pattern === squat)).toMatchObject({ plannedSets: 2, actualSets: 1, setsDelta: -1, setsPct: 50 });
    // Движение в плане без факта: доля 0%, а не null — план был.
    expect(pva.patterns.find(p => p.pattern === row)).toMatchObject({ plannedSets: 2, actualSets: 0, setsPct: 0 });
    // Сортировка: сначала то, что планировали больше.
    expect(pva.patterns[0].pattern).toBe(bench);
  });

  it('лишнее упражнение даёт движение «не по плану» с null-долей', () => {
    const squat = resolveExerciseMeta({ name: 'Приседания со штангой' }).pattern;
    const pva = comparePlanVsActual([
      { name: 'Жим штанги лёжа', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }] },
    ], actual());
    const row = pva.patterns.find(p => p.pattern === squat)!;
    expect(row).toMatchObject({ plannedSets: 0, actualSets: 1, setsDelta: 1, setsPct: null });
    // Сортировка: сначала то, что планировали больше.
    expect(pva.patterns[0].pattern).toBe(resolveExerciseMeta({ name: 'Жим штанги лёжа' }).pattern);
  });

  it('выполненный план вывод не создаёт', () => {
    const summary = actual();
    const pva = comparePlanVsActual([
      { name: 'Жим штанги лёжа', sets: [{ weight: 80, reps: 8 }, { weight: 80, reps: 8 }] },
      { name: 'Приседания со штангой', sets: [{ weight: 100, reps: 5 }] },
    ], summary);
    expect(pva.setsPct).toBe(100);
    expect(buildWorkoutInsights(summary, 'intermediate', null, pva).some(i => i.id === 'plan-gap')).toBe(false);
    expect(buildWorkoutInsights(summary).some(i => i.id === 'plan-gap')).toBe(false);
  });
});

describe('workout-summary: план недели (микроцикл) против журнала', () => {
  const plan = [
    {
      label: 'Верх',
      exercises: [
        { name: 'Жим штанги лёжа', targetSets: 4 },
        { name: 'Тяга верхнего блока', targetSets: [{}, {}, {}] },
      ],
    },
    {
      label: 'Низ',
      exercises: [{ name: 'Приседания со штангой', targetSets: 4 }],
    },
  ];

  it('складывает подходы плана по мышцам и сравнивает с фактом', () => {
    const week = [
      mkWorkout('2026-11-03', [
        { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 },
        { name: 'Тяга верхнего блока', id: 'pulldown', weight: 60, reps: 10, sets: 2 },
      ]),
    ];
    const wp = compareWeekPlanVsActual(plan, week);
    expect(wp.plannedSets).toBe(11);
    expect(wp.actualSets).toBe(5);
    expect(wp.setsPct).toBe(45.5);
    expect(wp.plannedDays).toBe(2);
    expect(wp.actualSessions).toBe(1);
    expect(wp.empty).toBe(false);
    // Числом плана тоже можно: массив подходов и их количество — одно и то же.
    const chest = wp.rows.find(r => r.muscle === 'chest')!;
    expect(chest).toMatchObject({ plannedSets: 4, actualSets: 3, setsDelta: -1, setsPct: 75 });
    const back = wp.rows.find(r => r.muscle === 'back')!;
    expect(back).toMatchObject({ plannedSets: 3, actualSets: 2, setsPct: 66.7 });
  });

  it('запланированное без факта — ноль, а не «нет данных»', () => {
    const wp = compareWeekPlanVsActual(plan, []);
    const squat = wp.rows.find(r => r.muscle === 'quads')!;
    expect(squat.plannedSets).toBe(4);
    expect(squat.actualSets).toBe(0);
    expect(squat.setsPct).toBe(0);
    expect(wp.actualSessions).toBe(0);
    expect(wp.rows.every(r => r.actualSets === 0)).toBe(true);
  });

  it('без плана блок пуст, а сделанное сверх плана даёт null-долю', () => {
    const week = [
      mkWorkout('2026-11-03', [
        { name: 'Подъём штанги на бицепс', id: 'curl_bar', weight: 30, reps: 12, sets: 2 },
      ]),
    ];
    expect(compareWeekPlanVsActual(null, week).empty).toBe(true);
    expect(compareWeekPlanVsActual([], week).setsPct).toBeNull();
    const wp = compareWeekPlanVsActual(plan, week);
    const extra = wp.rows.find(r => r.muscle === 'biceps')!;
    expect(extra).toMatchObject({ plannedSets: 0, actualSets: 2, setsDelta: 2, setsPct: null });
  });

  it('говорит, сколько осталось, не называя это провалом', () => {
    const week = [
      mkWorkout('2026-11-03', [
        { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 },
        { name: 'Тяга верхнего блока', id: 'pulldown', weight: 60, reps: 10, sets: 2 },
      ]),
    ];
    const summary = buildWorkoutSummary(week);
    const wp = compareWeekPlanVsActual(plan, week);
    const ins = buildWorkoutInsights(summary, 'intermediate', null, null, wp)
      .find(i => i.id === 'week-plan')!;
    expect(ins.title).toContain('5 из 11 подходов (45.5%)');
    expect(ins.detail).toContain('Осталось 6 подх');
    expect(ins.tone).toBe('info');
    // В копируемом отчёте — та же сверка по мышцам.
    const txt = buildWorkoutReportText(summary, { weekPlan: wp });
    expect(txt).toContain('План недели: 5 из 11 подх (45.5%)');
    expect(txt).toContain('план 4 → факт 3');
  });
});

describe('workout-summary: текст отчёта для копирования', () => {
  const wk = () => mkWorkout('2026-11-03', [
    { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 },
    { name: 'Тяга верхнего блока', id: 'pulldown', weight: 60, reps: 10, sets: 3 },
  ]);

  it('собирает тот же отчёт, что на экране', () => {
    const txt = buildWorkoutReportText(buildWorkoutSummary([wk()]));
    expect(txt.startsWith('📊 Отчёт: ')).toBe(true);
    expect(txt).toContain('По мышцам:');
    expect(txt).toContain('Грудь');
    expect(txt).toMatch(/Грудь: 3 подх · .*· доля [\d.]+% тоннажа · 50% подходов/);
    expect(txt).toContain('По упражнениям:');
    expect(txt).toContain('Жим штанги лёжа: 3×8');
    expect(txt).toContain('Движения:');
  });

  it('пишет тренд движения по неделям', () => {
    const s = buildWorkoutSummary([
      mkWorkout('2026-11-02', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 2 }]),
      mkWorkout('2026-11-09', [{ name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 4 }]),
    ]);
    const txt = buildWorkoutReportText(s);
    expect(txt).toContain('Движения:');
    expect(txt).toContain('100% подходов · e1RM 101');
    expect(txt).toContain('(+100% к первой неделе)');
    // Недельная динамика в тексте: КПШ и тоннаж по неделям.
    expect(txt).toContain('По неделям:');
    expect(txt).toContain('КПШ 16');
    expect(txt).toContain('КПШ 32');
    // Плотность недели: 1280 кг / 60 мин = 21, 2560 кг / 60 мин = 43.
    expect(txt).toContain('60 мин');
    expect(txt).toContain('21 кг/мин');
    expect(txt).toContain('43 кг/мин');
  });

  it('своя шапка и хвост обрамляют отчёт', () => {
    const txt = buildWorkoutReportText(buildWorkoutSummary([wk()]), {
      header: '🏋️ Тренировка: FullBody — 2026-11-03',
      footer: ['📈 Следующая сессия:', '  Жим штанги лёжа → 82.5кг×8'],
    });
    expect(txt.split('\n')[0]).toBe('🏋️ Тренировка: FullBody — 2026-11-03');
    expect(txt).toContain('📈 Следующая сессия:');
    expect(txt.trimEnd().endsWith('Жим штанги лёжа → 82.5кг×8')).toBe(true);
  });

  it('план и подходы попадают в текст', () => {
    const s = buildWorkoutSummary([wk()]);
    const pva = comparePlanVsActual([
      { name: 'Жим штанги лёжа', sets: Array.from({ length: 4 }, () => ({ weight: 80, reps: 8 })) },
    ], s);
    const txt = buildWorkoutReportText(s, { plan: pva, details: buildSetDetails([wk()]) });
    expect(txt).toContain('План: 4 подх · факт: 6 подх (150%)');
    expect(txt).toContain('Жим штанги лёжа: план 4 → факт 3 (не добито)');
    expect(txt).toContain('Тяга верхнего блока: план 0 → факт 3 (не по плану)');
    expect(txt).toContain('  По движениям:');
    expect(txt).toContain(': 0 → 3 подх (не по плану)');
    expect(txt).toContain('Подходы:');
    expect(txt).toContain('80×8@2');
  });

  it('сравнение называет период и показывает движения и e1RM', () => {
    const prev = mkWorkout('2026-10-27', [
      { name: 'Приседания со штангой', id: 'squat', weight: 100, reps: 5, sets: 2 },
    ]);
    const cur = mkWorkout('2026-11-03', [
      { name: 'Жим штанги лёжа', id: 'bench_bar', weight: 80, reps: 8, sets: 3 },
    ]);
    const s = buildWorkoutSummary([cur]);
    const cmp = compareWorkoutSummaries(s, buildWorkoutSummary([prev]));
    const txt = buildWorkoutReportText(s, { comparison: cmp, comparisonLabel: 'прошлой тренировкой' });
    expect(txt).toContain('Сравнение с прошлой тренировкой:');
    // Сводка изменений: выросло / просело / без изменений.
    expect(txt).toContain('Подходы по мышцам: выросло 1, просело 1, без изменений 0');
    expect(txt).toContain('  Мышцы:');
    expect(txt).toContain('  Движения:');
    expect(txt).toContain('  e1RM по упражнениям:');
    expect(txt).toContain('Жим штанги лёжа: новое · ');
  });
});
