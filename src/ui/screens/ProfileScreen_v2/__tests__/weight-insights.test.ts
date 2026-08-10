import { describe, it, expect } from 'vitest';
import {
  rowsInRange,
  deltaVsPrev,
  timeOfDayBreakdown,
  fmtSigned,
  goalProgressSafe,
  goalDirection,
} from '../diaries/WeightDiary/weight-insights';

describe('rowsInRange', () => {
  const now = Date.now();
  const iso = (daysAgo: number) => {
    const d = new Date(now - daysAgo * 86400000);
    return d.toISOString().slice(0, 10);
  };

  it('возвращает все записи для all', () => {
    const rows = [{ date: iso(400) }, { date: iso(2) }];
    expect(rowsInRange(rows, 'all')).toHaveLength(2);
  });

  it('фильтрует по 7 дням', () => {
    const rows = [{ date: iso(1) }, { date: iso(6) }, { date: iso(10) }];
    const out = rowsInRange(rows, '7');
    expect(out.map(r => r.date)).toEqual([iso(1), iso(6)]);
  });

  it('фильтрует по 90 дням', () => {
    const rows = [{ date: iso(89) }, { date: iso(91) }, { date: iso(200) }];
    expect(rowsInRange(rows, '90')).toHaveLength(1);
  });

  it('не парсимые даты сохраняет', () => {
    const rows = [{ date: 'не-дата' }, { date: iso(400) }];
    expect(rowsInRange(rows, '7')).toHaveLength(1);
  });

  it('пустой массив — пустой результат', () => {
    expect(rowsInRange([], '30')).toEqual([]);
  });
});

describe('deltaVsPrev', () => {
  it('дельта между соседними по дате записями', () => {
    const rows = [
      { date: '2026-08-10', weight: 80 },
      { date: '2026-08-03', weight: 79.5 },
      { date: '2026-07-27', weight: 81 },
    ];
    const m = deltaVsPrev(rows);
    expect(m.get('2026-08-10')).toBeCloseTo(0.5);
    expect(m.get('2026-08-03')).toBeCloseTo(-1.5);
    expect(m.get('2026-07-27')).toBeUndefined();
  });

  it('одна запись — пусто', () => {
    expect(deltaVsPrev([{ date: '2026-08-10', weight: 80 }]).size).toBe(0);
  });

  it('пусто для NaN весов', () => {
    const m = deltaVsPrev([
      { date: '2026-08-10', weight: NaN },
      { date: '2026-08-03', weight: 80 },
    ]);
    expect(m.size).toBe(0);
  });

  it('не зависит от порядка входного массива', () => {
    const a = deltaVsPrev([{ date: '2026-08-10', weight: 80 }, { date: '2026-08-03', weight: 79.5 }]);
    const b = deltaVsPrev([{ date: '2026-08-03', weight: 79.5 }, { date: '2026-08-10', weight: 80 }]);
    expect(a.get('2026-08-10')).toBeCloseTo(b.get('2026-08-10')!);
  });
});

describe('timeOfDayBreakdown', () => {
  it('средние утро/вечер и разброс', () => {
    const r = timeOfDayBreakdown([
      { timeOfDay: 'morning', weight: 80 },
      { timeOfDay: 'morning', weight: 81 },
      { timeOfDay: 'evening', weight: 82.5 },
    ]);
    expect(r.morning?.avg).toBeCloseTo(80.5);
    expect(r.morning?.count).toBe(2);
    expect(r.evening?.avg).toBeCloseTo(82.5);
    expect(r.evening?.count).toBe(1);
    expect(r.swing).toBeCloseTo(2);
  });

  it('только утро — evening null, swing null', () => {
    const r = timeOfDayBreakdown([{ timeOfDay: 'morning', weight: 80 }]);
    expect(r.evening).toBeNull();
    expect(r.swing).toBeNull();
  });

  it('без времени суток — оба null', () => {
    const r = timeOfDayBreakdown([{ weight: 80 }]);
    expect(r.morning).toBeNull();
    expect(r.evening).toBeNull();
    expect(r.swing).toBeNull();
  });

  it('пусто — оба null', () => {
    const r = timeOfDayBreakdown([]);
    expect(r.morning).toBeNull();
    expect(r.evening).toBeNull();
  });
});

describe('fmtSigned', () => {
  it('плюс/минус с юникод-минусом', () => {
    expect(fmtSigned(0.5)).toBe('+0.5');
    expect(fmtSigned(-0.5)).toBe('−0.5');
    expect(fmtSigned(0)).toBe('±0.0');
  });

  it('точность digits', () => {
    expect(fmtSigned(1.234, 2)).toBe('+1.23');
    expect(fmtSigned(-1.234, 0)).toBe('−1');
  });

  it('не-число — прочерк', () => {
    expect(fmtSigned(NaN)).toBe('—');
    expect(fmtSigned(Infinity)).toBe('—');
  });
});

describe('goalProgressSafe', () => {
  it('обычный прогресс', () => {
    const r = goalProgressSafe(80, 82, 85);
    expect(r?.pct).toBe(40);
    expect(r?.done).toBe(false);
  });

  it('goal === start — pct null без Infinity', () => {
    const r = goalProgressSafe(80, 82, 80);
    expect(r?.pct).toBeNull();
    expect(r?.done).toBe(false);
  });

  it('достигнута цель', () => {
    const r = goalProgressSafe(80, 84.6, 85);
    expect(r?.done).toBe(true);
  });

  it('перевыполнение обрезается на 200', () => {
    const r = goalProgressSafe(80, 100, 85);
    expect(r?.pct).toBe(200);
  });

  it('отрицательный прогресс обрезается на −200', () => {
    const r = goalProgressSafe(80, 60, 85);
    expect(r?.pct).toBe(-200);
  });

  it('goal <= 0 — null', () => {
    expect(goalProgressSafe(80, 82, 0)).toBeNull();
    expect(goalProgressSafe(80, 82, -5)).toBeNull();
  });
});

describe('goalDirection', () => {
  it('набираем — +1', () => {
    expect(goalDirection(80, 80, 85)).toBe(1);
  });
  it('сбрасываем — −1', () => {
    expect(goalDirection(90, 90, 85)).toBe(-1);
  });
  it('нет цели — 0', () => {
    expect(goalDirection(80, 82, 0)).toBe(0);
    expect(goalDirection(80, 80, 80)).toBe(0);
  });
});
