/**
 * diary-stats.test.ts — тесты новых статистических хелперов.
 */
import { describe, it, expect } from 'vitest';
import {
  computeDistribution,
  getNormalRange,
  classifyValue,
  buildWeeklyHistogram,
  buildHourDistribution,
  compareWithLastWeek,
  sortEntries,
  paginate,
  pearsonCorrelation,
  crossCorrelation,
  laggedCorrelation,
  dailyCompletion,
  defaultGoals,
  todayIso,
  computePace,
  currentStreak,
  PACE_TARGETS,
  type DiaryKey,
} from '../diary-helpers';

const sleepEntry = (date: string, hours: number) => ({ date, fields: [{ label: 'Часы', value: String(hours), unit: 'ч' }] });
const bpEntry = (date: string, sys: number, dia: number, pulse = 70) => ({ date, fields: [
  { label: 'Систола', value: String(sys), unit: 'мм рт.ст.' },
  { label: 'Диастола', value: String(dia), unit: 'мм рт.ст.' },
  { label: 'Пульс', value: String(pulse), unit: 'уд/мин' },
] });
const weightEntry = (date: string, kg: number) => ({ date, fields: [{ label: 'Вес', value: String(kg), unit: 'кг' }] });
const painEntry = (date: string, total: number) => ({ date, fields: [{ label: 'Суммарно', value: String(total), unit: '/70' }] });
const neuroEntry = (date: string, count: number) => ({ date, fields: [{ label: 'Симптомов', value: String(count), unit: '/10' }] });

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
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('defaultGoals', () => {
  it('возвращает нулевые цели', () => {
    expect(defaultGoals()).toEqual({ sleepHours: 0, weightKg: 0, systolicTarget: 0 });
  });
});

describe('computeDistribution', () => {
  it('возвращает null для пустого массива', () => {
    expect(computeDistribution([])).toBeNull();
  });

  it('считает mean, median, stdDev для нормального набора', () => {
    const r = computeDistribution([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r).not.toBeNull();
    expect(r!.mean).toBeCloseTo(5.5, 1);
    expect(r!.median).toBeCloseTo(5.5, 1);
    expect(r!.min).toBe(1);
    expect(r!.max).toBe(10);
    expect(r!.p25).toBeCloseTo(3.25, 1);
    expect(r!.p75).toBeCloseTo(7.75, 1);
    expect(r!.stdDev).toBeGreaterThan(0);
  });

  it('IQR = p75 - p25', () => {
    const r = computeDistribution([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r!.iqr).toBeCloseTo(r!.p75 - r!.p25, 5);
  });

  it('median для чётного количества — среднее двух центральных', () => {
    const r = computeDistribution([1, 2, 3, 4]);
    expect(r!.median).toBeCloseTo(2.5, 5);
  });

  it('фильтрует не-числовые', () => {
    const r = computeDistribution([1, NaN, 2, Infinity as any, 3]);
    expect(r!.count).toBe(3);
    expect(r!.mean).toBe(2);
  });
});

describe('getNormalRange / classifyValue', () => {
  it('возвращает зону для sleep', () => {
    const r = getNormalRange('sleep');
    expect(r).not.toBeNull();
    expect(r!.low).toBe(7);
    expect(r!.high).toBe(9);
  });

  it('возвращает null для неизвестного ключа', () => {
    expect(getNormalRange('injection' as DiaryKey)).toBeNull();
  });

  it('classifyValue: normal в диапазоне', () => {
    expect(classifyValue('sleep', 7.5)).toBe('normal');
    expect(classifyValue('sleep', 8)).toBe('normal');
  });

  it('classifyValue: warn вне нормы, но в warn-зоне', () => {
    expect(classifyValue('sleep', 6.5)).toBe('warn');
  });

  it('classifyValue: danger экстремальное значение', () => {
    expect(classifyValue('sleep', 4)).toBe('danger');
    expect(classifyValue('sleep', 12)).toBe('danger');
  });

  it('classifyValue: bp 130 — warn, 150 — danger', () => {
    expect(classifyValue('bp', 130)).toBe('warn');
    expect(classifyValue('bp', 150)).toBe('danger');
    expect(classifyValue('bp', 110)).toBe('normal');
  });

  it('classifyValue: pain 25 — warn, 60 — danger', () => {
    expect(classifyValue('pain', 25)).toBe('warn');
    expect(classifyValue('pain', 60)).toBe('danger');
  });

  it('classifyValue: неизвестный ключ — unknown', () => {
    expect(classifyValue('injection' as DiaryKey, 5)).toBe('unknown');
  });
});

describe('buildWeeklyHistogram', () => {
  it('возвращает пустой массив для пустого ввода', () => {
    expect(buildWeeklyHistogram([])).toEqual([]);
  });

  it('группирует значения по неделям', () => {
    const out = buildWeeklyHistogram([
      { date: '2025-01-06', value: 7 },
      { date: '2025-01-08', value: 8 },
      { date: '2025-01-13', value: 6 },
    ]);
    expect(out.length).toBe(2);
    expect(out[0].count).toBe(2);
    expect(out[0].mean).toBe(7.5);
    expect(out[1].count).toBe(1);
  });

  it('вычисляет min/max/mean для каждой недели', () => {
    const out = buildWeeklyHistogram([
      { date: '2025-01-06', value: 6 },
      { date: '2025-01-08', value: 8 },
    ]);
    expect(out[0].min).toBe(6);
    expect(out[0].max).toBe(8);
    expect(out[0].sum).toBe(14);
  });
});

describe('buildHourDistribution', () => {
  it('возвращает 24 часа', () => {
    const out = buildHourDistribution(['2025-01-06T10:00:00', '2025-01-07T10:00:00', '2025-01-08T22:00:00']);
    expect(out).toHaveLength(24);
    expect(out[10].count).toBe(2);
    expect(out[22].count).toBe(1);
    expect(out[0].count).toBe(0);
  });

  it('возвращает нули для пустого ввода', () => {
    const out = buildHourDistribution([]);
    expect(out).toHaveLength(24);
    expect(out.every(h => h.count === 0)).toBe(true);
  });
});

describe('compareWithLastWeek', () => {
  it('возвращает null для менее 2 записей', () => {
    const r = compareWithLastWeek([{ date: new Date().toISOString().slice(0, 10), value: 5 }]);
    expect(r.thisWeek).toBeNull();
  });

  it('сравнивает эту и прошлую неделю', () => {
    const today = new Date();
    const thisWeek = new Date(today.getTime() - 3 * 86400000);
    const lastWeek = new Date(today.getTime() - 10 * 86400000);
    const twoWeeks = new Date(today.getTime() - 17 * 86400000);
    const r = compareWithLastWeek([
      { date: today.toISOString().slice(0, 10), value: 8 },
      { date: thisWeek.toISOString().slice(0, 10), value: 7 },
      { date: lastWeek.toISOString().slice(0, 10), value: 6 },
      { date: twoWeeks.toISOString().slice(0, 10), value: 5 },
    ]);
    expect(r.thisWeek).not.toBeNull();
    expect(r.lastWeek).not.toBeNull();
    expect(r.thisWeek!.mean).toBe(7.5);
    expect(r.lastWeek!.mean).toBe(6);
    expect(r.delta).toBeCloseTo(1.5, 5);
    expect(r.better).toBe('up');
  });

  it('better=down при отрицательной дельте', () => {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 10 * 86400000);
    const r = compareWithLastWeek([
      { date: today.toISOString().slice(0, 10), value: 5 },
      { date: lastWeek.toISOString().slice(0, 10), value: 8 },
    ]);
    expect(r.better).toBe('down');
  });

  it('better=same при нулевой дельте', () => {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 10 * 86400000);
    const r = compareWithLastWeek([
      { date: today.toISOString().slice(0, 10), value: 7 },
      { date: lastWeek.toISOString().slice(0, 10), value: 7 },
    ]);
    expect(r.better).toBe('same');
  });
});

describe('sortEntries', () => {
  const sample = [
    { date: '2025-01-15', fields: [{ label: 'Часы', value: '6', unit: 'ч' }] },
    { date: '2025-01-10', fields: [{ label: 'Часы', value: '8', unit: 'ч' }] },
    { date: '2025-01-12', fields: [{ label: 'Часы', value: '7', unit: 'ч' }] },
  ];

  it('сортирует по дате asc', () => {
    const r = sortEntries(sample, { key: 'date', dir: 'asc' });
    expect(r.map(e => e.date)).toEqual(['2025-01-10', '2025-01-12', '2025-01-15']);
  });

  it('сортирует по полю asc/desc', () => {
    const asc = sortEntries(sample, { key: 'Часы', dir: 'asc' });
    const desc = sortEntries(sample, { key: 'Часы', dir: 'desc' });
    expect(asc.map(e => e.fields[0].value)).toEqual(['6', '7', '8']);
    expect(desc.map(e => e.fields[0].value)).toEqual(['8', '7', '6']);
  });
});

describe('paginate', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  it('первая страница', () => {
    const r = paginate(arr, 1, 3);
    expect(r.pageItems).toEqual([1, 2, 3]);
    expect(r.totalPages).toBe(4);
    expect(r.pageStart).toBe(0);
    expect(r.pageEnd).toBe(3);
  });
  it('последняя страница', () => {
    const r = paginate(arr, 4, 3);
    expect(r.pageItems).toEqual([10]);
  });
  it('за пределами — clamp к последней', () => {
    const r = paginate(arr, 99, 3);
    expect(r.pageItems).toEqual([10]);
  });
  it('меньше страницы — все', () => {
    const r = paginate([1, 2], 1, 10);
    expect(r.pageItems).toEqual([1, 2]);
    expect(r.totalPages).toBe(1);
  });
});

describe('pearsonCorrelation', () => {
  it('возвращает null для <3 точек', () => {
    expect(pearsonCorrelation([1, 2], [1, 2])).toBeNull();
  });
  it('идеальная прямая корреляция', () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
    expect(r).not.toBeNull();
    expect(r!.r).toBeCloseTo(1, 5);
    expect(r!.n).toBe(5);
  });
  it('идеальная обратная корреляция', () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]);
    expect(r).not.toBeNull();
    expect(r!.r).toBeCloseTo(-1, 5);
  });
  it('нулевая корреляция', () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [5, 5, 5, 5, 5]);
    expect(r).toBeNull();
  });
});

describe('crossCorrelation', () => {
  it('возвращает null для <3 совпадающих дат', () => {
    const r = crossCorrelation(
      [{ date: '2025-01-01', value: 7 }, { date: '2025-01-02', value: 8 }],
      [{ date: '2025-01-01', value: 120 }]
    );
    expect(r).toBeNull();
  });
  it('считает положительную корреляцию', () => {
    const a = [
      { date: '2025-01-01', value: 6 },
      { date: '2025-01-02', value: 7 },
      { date: '2025-01-03', value: 8 },
      { date: '2025-01-04', value: 7 },
    ];
    const b = [
      { date: '2025-01-01', value: 110 },
      { date: '2025-01-02', value: 120 },
      { date: '2025-01-03', value: 130 },
      { date: '2025-01-04', value: 120 },
    ];
    const r = crossCorrelation(a, b);
    expect(r).not.toBeNull();
    expect(r!.r).toBeGreaterThan(0.8);
    expect(r!.positive).toBe(true);
    expect(r!.strength).toBe('strong');
  });
});

describe('laggedCorrelation', () => {
  it('считает связь со сдвигом', () => {
    const a = [
      { date: '2025-01-01', value: 5 },
      { date: '2025-01-02', value: 6 },
      { date: '2025-01-03', value: 7 },
      { date: '2025-01-04', value: 8 },
      { date: '2025-01-05', value: 9 },
    ];
    const b = [
      { date: '2025-01-02', value: 110 },
      { date: '2025-01-03', value: 120 },
      { date: '2025-01-04', value: 130 },
      { date: '2025-01-05', value: 140 },
      { date: '2025-01-06', value: 150 },
    ];
    const r = laggedCorrelation(a, b, 1);
    expect(r).not.toBeNull();
    expect(r!.r).toBeGreaterThan(0.8);
  });
});

describe('dailyCompletion', () => {
  it('считает заполненность за сегодня', () => {
    const today = new Date().toISOString().slice(0, 10);
    const r = dailyCompletion([
      { key: 'sleep' as DiaryKey, hasEntry: true, lastDate: today },
      { key: 'bp' as DiaryKey, hasEntry: true, lastDate: today },
      { key: 'weight' as DiaryKey, hasEntry: true, lastDate: '2025-01-01' },
    ]);
    expect(r.filled).toBe(2);
    expect(r.total).toBe(3);
    expect(r.pct).toBe(67);
    expect(r.missing).toEqual(['weight']);
  });
  it('возвращает 0 при пустом массиве', () => {
    const r = dailyCompletion([]);
    expect(r.filled).toBe(0);
    expect(r.pct).toBe(0);
  });
});


describe('computePace', () => {
  it('возвращает null для дневника без темп-цели', () => {
    const r = computePace('injection' as DiaryKey, []);
    expect(r).toBeNull();
  });
  it('считает прогресс по окну (например, 5 из 7 дней)', () => {
    const today = new Date();
    const last7 = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      return { date: d.toISOString().slice(0, 10) };
    });
    const r = computePace('sleep' as DiaryKey, last7);
    expect(r).not.toBeNull();
    expect(r!.achieved).toBe(5);
    expect(r!.needed).toBe(5);
    expect(r!.ok).toBe(true);
    expect(r!.pct).toBe(100);
  });
  it('ok=false если недостаточно дней', () => {
    const r = computePace('sleep' as DiaryKey, [{ date: new Date().toISOString().slice(0, 10) }]);
    expect(r!.achieved).toBe(1);
    expect(r!.ok).toBe(false);
  });
  it('игнорирует записи вне окна', () => {
    const old = new Date();
    old.setDate(old.getDate() - 30);
    const r = computePace('sleep' as DiaryKey, [{ date: old.toISOString().slice(0, 10) }]);
    expect(r!.achieved).toBe(0);
  });
  it('PACE_TARGETS содержит ожидаемые ключи', () => {
    expect(PACE_TARGETS.sleep).toBeDefined();
    expect(PACE_TARGETS.bp).toBeDefined();
    expect(PACE_TARGETS.injection).toBeUndefined();
  });
});

describe('currentStreak', () => {
  it('возвращает 0 для пустого массива', () => {
    expect(currentStreak([])).toBe(0);
  });
  it('считает серию дней подряд', () => {
    const today = new Date();
    const dates = Array.from({ length: 4 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      return { date: d.toISOString().slice(0, 10) };
    });
    expect(currentStreak(dates)).toBe(4);
  });
  it('серия обрывается при разрыве', () => {
    const today = new Date();
    const d1 = new Date(today); d1.setDate(d1.getDate() - 0);
    const d2 = new Date(today); d2.setDate(d2.getDate() - 1);
    const d4 = new Date(today); d4.setDate(d4.getDate() - 3);
    const r = currentStreak([{ date: d1.toISOString().slice(0, 10) }, { date: d2.toISOString().slice(0, 10) }, { date: d4.toISOString().slice(0, 10) }]);
    expect(r).toBe(2);
  });
});
