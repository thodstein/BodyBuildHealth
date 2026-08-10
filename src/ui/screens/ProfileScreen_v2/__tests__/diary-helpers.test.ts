/**
 * diary-helpers.test.ts — тесты чистых хелперов дневников.
 */
import { describe, it, expect } from 'vitest';
import {
  computeStreak,
  computePeriodDelta,
  computeExtremes,
  groupEntriesByPeriod,
  buildSparkline,
  targetHit,
  detectAnomalies,
  filterByRange,
  todayIso,
  defaultGoals,
  type DiaryEntryLike,
  type DiaryKey,
  movingAverage,
  fitLinearTrend,
  projectToDate,
  daysToTarget,
  weekStartOf,
  weeklySummaries,
  monthlySummaries,
  paceToTarget,
  weightHeatmap,
} from '../diary-helpers';

const makeEntry = (date: string, fields: { label: string; value: string; unit?: string }[]): DiaryEntryLike => ({
  date,
  fields: fields.map(f => ({ label: f.label, value: f.value, unit: f.unit || '' })),
});

const sleepEntry = (date: string, hours: number) => makeEntry(date, [{ label: 'Часы', value: String(hours), unit: 'ч' }]);
const weightEntry = (date: string, kg: number) => makeEntry(date, [{ label: 'Вес', value: String(kg), unit: 'кг' }]);
const bpEntry = (date: string, sys: number, dia: number, pulse = 70) => makeEntry(date, [
  { label: 'Систола', value: String(sys), unit: 'мм рт.ст.' },
  { label: 'Диастола', value: String(dia), unit: 'мм рт.ст.' },
  { label: 'Пульс', value: String(pulse), unit: 'уд/мин' },
]);
const painEntry = (date: string, total: number) => makeEntry(date, [{ label: 'Суммарно', value: String(total), unit: '/70' }]);
const neuroEntry = (date: string, score: number) => makeEntry(date, [{ label: 'Симптомов', value: String(score), unit: '/10' }]);

const dayOffset = (offset: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

describe('todayIso', () => {
  it('возвращает YYYY-MM-DD формат', () => {
    const t = todayIso();
    expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('defaultGoals', () => {
  it('возвращает нулевые цели', () => {
    expect(defaultGoals()).toEqual({ sleepHours: 0, weightKg: 0, systolicTarget: 0 });
  });
});

describe('computeStreak', () => {
  it('возвращает нули для пустого массива', () => {
    expect(computeStreak([])).toEqual({ current: 0, best: 0, totalDays: 0 });
  });

  it('считает текущую серию из 3 дней', () => {
    const entries = [dayOffset(-2), dayOffset(-1), dayOffset(0)].map(d => ({ date: d }));
    const r = computeStreak(entries);
    expect(r.current).toBe(3);
    expect(r.best).toBe(3);
    expect(r.totalDays).toBe(3);
  });

  it('сбрасывает серию при разрыве', () => {
    const entries = [{ date: dayOffset(-5) }, { date: dayOffset(-3) }];
    const r = computeStreak(entries);
    expect(r.current).toBe(0);
    expect(r.best).toBe(1);
    expect(r.totalDays).toBe(2);
  });

  it('best больше или равно current', () => {
    const entries = [dayOffset(-10), dayOffset(-9), dayOffset(-8), dayOffset(-7), dayOffset(-1), dayOffset(0)].map(d => ({ date: d }));
    const r = computeStreak(entries);
    expect(r.best).toBeGreaterThanOrEqual(r.current);
  });

  it('дедуплицирует дубликаты дат', () => {
    const entries = [{ date: dayOffset(0) }, { date: dayOffset(0) }, { date: dayOffset(-1) }];
    const r = computeStreak(entries);
    expect(r.totalDays).toBe(2);
  });
});

describe('computePeriodDelta', () => {
  it('возвращает null при <4 записей', () => {
    expect(computePeriodDelta('sleep', [sleepEntry(dayOffset(0), 7), sleepEntry(dayOffset(-1), 6)])).toBeNull();
  });

  it('считает положительный тренд для веса (нейтральный — динамика)', () => {
    const entries = [
      weightEntry(dayOffset(-7), 80),
      weightEntry(dayOffset(-6), 80.5),
      weightEntry(dayOffset(-3), 81),
      weightEntry(dayOffset(-2), 81.5),
    ];
    const r = computePeriodDelta('weight', entries);
    expect(r).not.toBeNull();
    expect(r!.color).toBe('#60a5fa');
    expect(r!.delta).toBeGreaterThan(0);
  });

  it('считает отрицательный тренд для боли', () => {
    const entries = [
      painEntry(dayOffset(-6), 50),
      painEntry(dayOffset(-5), 52),
      painEntry(dayOffset(-1), 20),
      painEntry(dayOffset(0), 18),
    ];
    const r = computePeriodDelta('pain', entries);
    expect(r).not.toBeNull();
    expect(r!.color).toBe('#22c55e');
    expect(r!.delta).toBeLessThan(0);
  });

  it('возвращает серый цвет при отсутствии изменений', () => {
    const entries = [
      painEntry(dayOffset(-3), 30),
      painEntry(dayOffset(-2), 30),
      painEntry(dayOffset(-1), 30),
      painEntry(dayOffset(0), 30),
    ];
    const r = computePeriodDelta('pain', entries);
    expect(r).not.toBeNull();
    expect(r!.color).toBe('#6b7280');
  });

  it('возвращает null если данные не числовые', () => {
    const entries = [
      makeEntry(dayOffset(-3), [{ label: 'Часы', value: 'нет' }]),
      makeEntry(dayOffset(-2), [{ label: 'Часы', value: 'нет' }]),
      makeEntry(dayOffset(-1), [{ label: 'Часы', value: 'нет' }]),
      makeEntry(dayOffset(0), [{ label: 'Часы', value: 'нет' }]),
    ];
    expect(computePeriodDelta('sleep', entries)).toBeNull();
  });
});

describe('computeExtremes', () => {
  it('возвращает null для пустого массива', () => {
    expect(computeExtremes('sleep', [])).toEqual({ min: null, max: null });
  });

  it('находит минимум и максимум', () => {
    const entries = [
      weightEntry('2025-01-01', 80),
      weightEntry('2025-01-05', 78),
      weightEntry('2025-01-10', 82),
    ];
    const r = computeExtremes('weight', entries);
    expect(r.min?.value).toBe(78);
    expect(r.max?.value).toBe(82);
  });

  it('вычисляет среднее АД как (sys+sys)/2', () => {
    const entries = [bpEntry('2025-01-01', 120, 80), bpEntry('2025-01-02', 140, 90)];
    const r = computeExtremes('bp', entries);
    expect(r.min?.value).toBe(100);
    expect(r.max?.value).toBe(115);
  });
});

describe('groupEntriesByPeriod', () => {
  it('возвращает пустой массив для пустого ввода', () => {
    expect(groupEntriesByPeriod([])).toEqual([]);
  });

  it('группирует по неделям в обратном порядке', () => {
    const entries = [
      sleepEntry('2025-01-06', 7),
      sleepEntry('2025-01-13', 8),
      sleepEntry('2025-01-20', 6),
    ];
    const groups = groupEntriesByPeriod(entries);
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups[0].entries[0].date).toBe('2025-01-20');
  });

  it('метки недель содержат «Неделя»', () => {
    const entries = [sleepEntry('2025-01-06', 7)];
    const groups = groupEntriesByPeriod(entries);
    expect(groups[0].label).toMatch(/Неделя/);
  });
});

describe('buildSparkline', () => {
  it('фильтрует только числовые значения', () => {
    const entries = [
      sleepEntry('2025-01-01', 7),
      makeEntry('2025-01-02', [{ label: 'Часы', value: 'нет' }]),
      sleepEntry('2025-01-03', 8),
    ];
    const points = buildSparkline('sleep', entries);
    expect(points).toHaveLength(2);
    expect(points[0].value).toBe(7);
  });
});

describe('targetHit', () => {
  it('возвращает null при пустых entries', () => {
    expect(targetHit('sleep', [], defaultGoals())).toBeNull();
  });

  it('возвращает null если цель не задана', () => {
    expect(targetHit('sleep', [sleepEntry(todayIso(), 7)], defaultGoals())).toBeNull();
  });

  it('считает сон на цели', () => {
    const r = targetHit('sleep', [sleepEntry(todayIso(), 7.5)], { sleepHours: 7, weightKg: 0, systolicTarget: 0 });
    expect(r).not.toBeNull();
    expect(r!.onTarget).toBe(true);
    expect(r!.details).toContain('7.5 ч');
  });

  it('считает сон вне цели', () => {
    const r = targetHit('sleep', [sleepEntry(todayIso(), 5.5)], { sleepHours: 7, weightKg: 0, systolicTarget: 0 });
    expect(r).not.toBeNull();
    expect(r!.onTarget).toBe(false);
  });

  it('считает вес на цели при допуске 0.5кг', () => {
    const r = targetHit('weight', [weightEntry(todayIso(), 80.3)], { sleepHours: 0, weightKg: 80, systolicTarget: 0 });
    expect(r!.onTarget).toBe(true);
  });

  it('считает вес вне цели', () => {
    const r = targetHit('weight', [weightEntry(todayIso(), 82)], { sleepHours: 0, weightKg: 80, systolicTarget: 0 });
    expect(r!.onTarget).toBe(false);
    expect(r!.details).toContain('+2');
  });

  it('считает АД на цели (≤)', () => {
    const r = targetHit('bp', [bpEntry(todayIso(), 130, 85)], { sleepHours: 0, weightKg: 0, systolicTarget: 140 });
    expect(r!.onTarget).toBe(true);
  });

  it('считает АД вне цели', () => {
    const r = targetHit('bp', [bpEntry(todayIso(), 150, 95)], { sleepHours: 0, weightKg: 0, systolicTarget: 140 });
    expect(r!.onTarget).toBe(false);
  });
});

describe('detectAnomalies', () => {
  it('возвращает пустой массив для пустых данных', () => {
    expect(detectAnomalies('bp', [])).toEqual([]);
  });

  it('детектирует высокую систолу', () => {
    const issues = detectAnomalies('bp', [bpEntry(todayIso(), 170, 100, 75)]);
    expect(issues.some(i => i.message.includes('170'))).toBe(true);
    expect(issues.find(i => i.message.includes('170'))?.severity).toBe('danger');
  });

  it('детектирует умеренно повышенную систолу как warn', () => {
    const issues = detectAnomalies('bp', [bpEntry(todayIso(), 145, 85, 75)]);
    expect(issues[0].severity).toBe('warn');
  });

  it('детектирует диастолу 90+ как warn', () => {
    const issues = detectAnomalies('bp', [bpEntry(todayIso(), 130, 92, 75)]);
    expect(issues.some(i => i.message.includes('Диастола'))).toBe(true);
  });

  it('детектирует тахикардию', () => {
    const issues = detectAnomalies('bp', [bpEntry(todayIso(), 120, 80, 110)]);
    expect(issues.some(i => i.message.includes('Пульс'))).toBe(true);
  });

  it('детектирует брадикардию', () => {
    const issues = detectAnomalies('bp', [bpEntry(todayIso(), 120, 80, 45)]);
    expect(issues.some(i => i.message.includes('брадикардия'))).toBe(true);
  });

  it('детектирует недостаток сна', () => {
    const issues = detectAnomalies('sleep', [sleepEntry(todayIso(), 4)]);
    expect(issues.some(i => i.severity === 'danger')).toBe(true);
  });

  it('детектирует критическую боль', () => {
    const issues = detectAnomalies('pain', [painEntry(todayIso(), 65)]);
    expect(issues.some(i => i.severity === 'danger')).toBe(true);
  });

  it('детектирует тяжёлое нейро', () => {
    const issues = detectAnomalies('neuro', [neuroEntry(todayIso(), 7)]);
    expect(issues.some(i => i.message.includes('тяжёл'))).toBe(true);
  });

  it('детектирует опасную гематологию', () => {
    const issues = detectAnomalies('hemato', [makeEntry(todayIso(), [{ label: 'Симптомов', value: '4', unit: '/8' }])]);
    expect(issues.some(i => i.severity === 'danger')).toBe(true);
  });
});

describe('filterByRange', () => {
  it('возвращает все записи при range=all', () => {
    const entries = [sleepEntry(dayOffset(-100), 7), sleepEntry(dayOffset(-1), 8)];
    expect(filterByRange(entries, 'all')).toHaveLength(2);
  });

  it('фильтрует за 7 дней', () => {
    const entries = [sleepEntry(dayOffset(-10), 7), sleepEntry(dayOffset(-2), 8), sleepEntry(dayOffset(0), 6)];
    const r = filterByRange(entries, '7');
    expect(r).toHaveLength(2);
  });

  it('включает записи с невалидной датой', () => {
    const entries = [makeEntry('не-дата', [{ label: 'Часы', value: '7', unit: 'ч' }])];
    expect(filterByRange(entries, '7')).toHaveLength(1);
  });
});

/* ── Тренды веса: movingAverage / fitLinearTrend / projectToDate / daysToTarget ── */

describe('movingAverage', () => {
  it('возвращает [] при пустом списке', () => {
    expect(movingAverage([], 7)).toEqual([]);
  });
  it('возвращает [] при точек меньше окна', () => {
    expect(movingAverage([{ date: '2026-08-01', value: 80 }], 7)).toEqual([]);
  });
  it('считает trailing-среднее по окну', () => {
    const pts = ['2026-08-01', '2026-08-02', '2026-08-03'].map((date, i) => ({ date, value: 80 + i }));
    expect(movingAverage(pts, 3)).toEqual([{ date: '2026-08-03', value: 81 }]);
  });
  it('окно 1 = исходные точки', () => {
    const pts = [{ date: '2026-08-01', value: 80 }, { date: '2026-08-02', value: 81 }];
    expect(movingAverage(pts, 1)).toEqual(pts);
  });
  it('сортирует по дате перед расчётом', () => {
    const pts = [
      { date: '2026-08-03', value: 83 },
      { date: '2026-08-01', value: 80 },
      { date: '2026-08-02', value: 82 },
    ];
    const out = movingAverage(pts, 2);
    expect(out[0].date).toBe('2026-08-02');
    expect(out[0].value).toBe(81);
    expect(out[1].value).toBe(82.5);
  });
});

describe('fitLinearTrend', () => {
  it('null при < 2 точек', () => {
    expect(fitLinearTrend([{ date: '2026-08-01', value: 80 }])).toBeNull();
  });
  it('плоский тренд: slope=0, r2=1', () => {
    const fit = fitLinearTrend([
      { date: '2026-08-01', value: 80 },
      { date: '2026-08-08', value: 80 },
    ]);
    expect(fit!.slopePerDay).toBe(0);
    expect(fit!.r2).toBe(1);
  });
  it('восходящий тренд: +0.1 кг/день за 10 дней', () => {
    const pts = [];
    for (let i = 0; i < 11; i++) {
      const d = new Date('2026-08-01');
      d.setDate(d.getDate() + i);
      pts.push({ date: d.toISOString().slice(0, 10), value: 80 + i * 0.1 });
    }
    const fit = fitLinearTrend(pts)!;
    expect(fit.slopePerDay).toBeCloseTo(0.1, 6);
    expect(fit.r2).toBeGreaterThan(0.99);
  });
  it('идеально линейный нисходящий тренд r2=1', () => {
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date('2026-08-01');
      d.setDate(d.getDate() + i);
      pts.push({ date: d.toISOString().slice(0, 10), value: 90 - i * 0.5 });
    }
    const fit = fitLinearTrend(pts)!;
    expect(fit.slopePerDay).toBeCloseTo(-0.5, 6);
    expect(fit.r2).toBe(1);
  });
});

describe('projectToDate', () => {
  it('прогноз на дату через 10 дней при slope 0.1', () => {
    const fit = { slopePerDay: 0.1, intercept: 80, startX: +new Date('2026-08-01') / 86400000, startY: 80 };
    const d = new Date('2026-08-01');
    d.setDate(d.getDate() + 10);
    expect(projectToDate(fit, d.toISOString().slice(0, 10))).toBeCloseTo(81, 5);
  });
});

describe('daysToTarget', () => {
  it('null при нулевом наклоне', () => {
    const fit = { slopePerDay: 0, intercept: 80, startX: 0, startY: 80 };
    expect(daysToTarget(fit, '2026-08-01', 85)).toBeNull();
  });
  it('null если тренд не в сторону цели (растём, цель ниже)', () => {
    const fit = { slopePerDay: 0.1, intercept: 80, startX: +new Date('2026-08-01') / 86400000, startY: 80 };
    expect(daysToTarget(fit, '2026-08-01', 75)).toBeNull();
  });
  it('достижение цели за 50 дней при 0.1 кг/день', () => {
    const fit = { slopePerDay: 0.1, intercept: 80, startX: +new Date('2026-08-01') / 86400000, startY: 80 };
    expect(daysToTarget(fit, '2026-08-01', 85)).toBe(50);
  });
  it('цель уже достигнута → null (дней <= 0)', () => {
    const fit = { slopePerDay: 0.1, intercept: 80, startX: +new Date('2026-08-01') / 86400000, startY: 80 };
    expect(daysToTarget(fit, '2027-01-01', 85)).toBeNull();
  });
});

describe('weeklySummaries', () => {
  it('группирует по неделям (Пн..Вс), последние первыми', () => {
    const out = weeklySummaries([
      { date: '2026-07-01', weight: 80 }, // среда
      { date: '2026-07-02', weight: 82 },
      { date: '2026-07-06', weight: 81 }, // пн следующей недели
      { date: '2026-07-12', weight: 83 }, // вс той же недели
    ]);
    expect(out.length).toBe(2);
    expect(out[0].weekStart).toBe('2026-07-06');
    expect(out[0].count).toBe(2);
    expect(out[0].mean).toBe(82);
    expect(out[1].weekStart).toBe('2026-06-29');
    expect(out[1].mean).toBe(81);
  });

  it('delta = средняя неделя − предыдущая (более ранняя)', () => {
    const out = weeklySummaries([
      { date: '2026-07-01', weight: 80 },
      { date: '2026-07-06', weight: 82 },
    ]);
    expect(out[0].delta).toBe(2);
    expect(out[1].delta).toBeNull();
  });

  it('невалидные записи пропускаются', () => {
    const out = weeklySummaries([
      { date: '', weight: 90 },
      { date: '2026-07-01', weight: 0 },
      { date: '2026-07-01', weight: NaN },
      { date: '2026-07-03', weight: 79 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].count).toBe(1);
  });

  it('пусто → []', () => {
    expect(weeklySummaries([])).toEqual([]);
  });

  it('cap по количеству недель', () => {
    const entries: { date: string; weight: number }[] = [];
    for (let i = 0; i < 60; i++) {
      const d = new Date('2026-07-01');
      d.setDate(d.getDate() - i * 7);
      entries.push({ date: d.toISOString().slice(0, 10), weight: 80 });
    }
    expect(weeklySummaries(entries, 4)).toHaveLength(4);
  });
});

describe('monthlySummaries', () => {
  it('группирует по месяцам, delta к предыдущему', () => {
    const out = monthlySummaries([
      { date: '2026-06-10', weight: 80 },
      { date: '2026-06-20', weight: 84 },
      { date: '2026-07-05', weight: 86 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].month).toBe('2026-07');
    expect(out[0].mean).toBe(86);
    expect(out[0].delta).toBe(4); // 86 − 82
    expect(out[1].month).toBe('2026-06');
    expect(out[1].count).toBe(2);
    expect(out[1].delta).toBeNull();
  });

  it('пусто → []', () => {
    expect(monthlySummaries([])).toEqual([]);
  });
});

describe('paceToTarget', () => {
  it('будущая дата → нужный темп кг/нед', () => {
    const now = new Date();
    const target = new Date(now);
    target.setDate(target.getDate() + 14);
    const iso = target.toISOString().slice(0, 10);
    const out = paceToTarget(90, 85, iso);
    expect(out).not.toBeNull();
    if (out) {
      expect(out.days).toBeGreaterThan(13);
      expect(out.days).toBeLessThanOrEqual(14);
      expect(out.kgTotal).toBe(-5);
      expect(Math.abs(out.kgPerWeek + 2.5)).toBeLessThan(0.3);
    }
  });

  it('прошедшая дата → null', () => {
    expect(paceToTarget(90, 85, '2020-01-01')).toBeNull();
  });

  it('невалидная дата → null', () => {
    expect(paceToTarget(90, 85, 'abc')).toBeNull();
  });

  it('набор веса → положительный темп', () => {
    const target = new Date(Date.now() + 7 * 86400000);
    const out = paceToTarget(80, 84, target.toISOString().slice(0, 10));
    expect(out).not.toBeNull();
    if (out) expect(out.kgPerWeek).toBeGreaterThan(0);
  });
});

describe('weightHeatmap', () => {
  it('сетка weeks×7, записи на своих днях, null на пропуски', () => {
    const today = new Date();
    const out = weightHeatmap([{ date: today.toISOString().slice(0, 10), weight: 80 }], 2);
    expect(out).not.toBeNull();
    if (out) {
      expect(out.cells).toHaveLength(2);
      expect(out.cells[0]).toHaveLength(7);
      expect(out.cells[1]).toHaveLength(7);
      expect(out.min).toBe(80);
      expect(out.max).toBe(80);
      const found = out.cells.flat().filter(Boolean) as { date: string; value: number; pct: number }[];
      expect(found).toHaveLength(1);
      expect(found[0].value).toBe(80);
      expect(found[0].pct).toBe(0.5); // min === max
    }
  });

  it('pct нормируется по диапазону', () => {
    const today = new Date();
    const y = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - n);
      return d.toISOString().slice(0, 10);
    };
    const out = weightHeatmap([
      { date: y(0), weight: 90 },
      { date: y(1), weight: 80 },
    ], 2);
    expect(out).not.toBeNull();
    if (out) {
      const vals = out.cells.flat().filter(Boolean) as { value: number; pct: number }[];
      expect(vals.map(v => v.pct).sort()).toEqual([0, 1]);
      expect(out.min).toBe(80);
      expect(out.max).toBe(90);
    }
  });

  it('пусто → null', () => {
    expect(weightHeatmap([], 4)).toBeNull();
  });
});
