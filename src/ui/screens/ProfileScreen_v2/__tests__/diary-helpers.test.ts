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

  it('считает положительный тренд для веса', () => {
    const entries = [
      weightEntry(dayOffset(-7), 80),
      weightEntry(dayOffset(-6), 80.5),
      weightEntry(dayOffset(-3), 81),
      weightEntry(dayOffset(-2), 81.5),
    ];
    const r = computePeriodDelta('weight', entries);
    expect(r).not.toBeNull();
    expect(r!.color).toBe('#22c55e');
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
