/**
 * sleep-diary-helpers.test.ts — тесты чистых хелперов дневника сна (v2).
 * Покрывает: computeSleepScore, computeWeekdayAverages, buildSleepCalendar,
 * sleepCellLevel, computeSleepTrends, detectAnomalies (sleep).
 */
import { describe, it, expect } from 'vitest';
import {
  buildSleepCalendar,
  computeSleepScore,
  computeSleepTrends,
  computeWeekdayAverages,
  detectAnomalies,
  sleepCellLevel,
  type DiaryEntryLike,
} from '../../../diary-helpers';

const makeEntry = (date: string, fields: { label: string; value: string; unit?: string }[]): DiaryEntryLike => ({
  date,
  fields: fields.map((f) => ({ label: f.label, value: f.value, unit: f.unit || '' })),
});

const sleepEntry = (
  date: string,
  hours: number,
  quality = 4,
  latency = 20,
  awakenings = 1,
  alcohol = false,
): DiaryEntryLike =>
  makeEntry(date, [
    { label: 'Часы', value: String(hours), unit: 'ч' },
    { label: 'Качество', value: String(quality), unit: '/5' },
    { label: 'Пробуждений', value: String(awakenings), unit: 'раз' },
    { label: 'Латентность', value: String(latency), unit: 'мин' },
    { label: 'Алкоголь', value: alcohol ? 'да' : 'нет', unit: '' },
  ]);

const dayOffset = (offset: number): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const GOALS = { targetHours: 8, targetQuality: 4, targetLatency: 20, targetAwakenings: 1 };

describe('computeSleepScore', () => {
  it('возвращает null для пустого массива', () => {
    expect(computeSleepScore([], GOALS)).toBeNull();
  });

  it('идеальная запись → 100 баллов, все метрики ok', () => {
    const score = computeSleepScore([sleepEntry(dayOffset(0), 8, 4, 20, 1)], GOALS);
    expect(score).not.toBeNull();
    expect(score!.score).toBe(100);
    expect(score!.breakdown.every((b) => b.ok)).toBe(true);
  });

  it('недостаток часов снижает балл и помечает метрику', () => {
    const score = computeSleepScore([sleepEntry(dayOffset(0), 6, 4, 20, 1)], GOALS);
    expect(score).not.toBeNull();
    expect(score!.score).toBeLessThan(100);
    const hours = score!.breakdown.find((b) => b.label === 'Часы')!;
    expect(hours.ok).toBe(false);
    expect(hours.pct).toBe(75);
  });

  it('долгая латентность снижает компонент "Засыпание"', () => {
    const score = computeSleepScore([sleepEntry(dayOffset(0), 8, 4, 40, 1)], GOALS);
    expect(score).not.toBeNull();
    const latency = score!.breakdown.find((b) => b.label === 'Засыпание')!;
    expect(latency.ok).toBe(false);
    expect(latency.pct).toBe(50);
  });

  it('отсутствие латентности использует целевую (не штрафует)', () => {
    const entry = makeEntry(dayOffset(0), [
      { label: 'Часы', value: '8', unit: 'ч' },
      { label: 'Качество', value: '4', unit: '/5' },
    ]);
    const score = computeSleepScore([entry], GOALS);
    expect(score).not.toBeNull();
    expect(score!.breakdown.find((b) => b.label === 'Засыпание')!.ok).toBe(true);
  });
});

describe('computeWeekdayAverages', () => {
  it('пустой массив → все дни без данных', () => {
    const avg = computeWeekdayAverages([]);
    expect(avg).toHaveLength(7);
    expect(avg.every((d) => d.count === 0 && d.avgHours === null)).toBe(true);
  });

  it('группирует записи по дню недели и считает средние', () => {
    const monday = dayOffset(-3); // гарантированный понедельник не нужен — берём любые дни
    const tuesday = dayOffset(-2);
    const avg = computeWeekdayAverages([sleepEntry(monday, 7), sleepEntry(tuesday, 9)]);
    const m = avg.find((d) => d.count > 0);
    expect(m).toBeDefined();
    expect(m!.avgHours).not.toBeNull();
  });

  it('среднее по дню считается корректно', () => {
    // Находим два дня недели с одинаковым getDay(): +0 и +7
    const d1 = dayOffset(0);
    const d2 = dayOffset(7);
    const sameDow = new Date(d1).getDay() === new Date(d2).getDay();
    expect(sameDow).toBe(true);
    const avg = computeWeekdayAverages([sleepEntry(d1, 6), sleepEntry(d2, 8)]);
    const day = avg.find((x) => x.count === 2)!;
    expect(day.avgHours).toBeCloseTo(7, 1);
    expect(day.avgQuality).toBeCloseTo(4, 1);
  });
});

describe('buildSleepCalendar', () => {
  it('возвращает ровно N ячеек, последняя — сегодня', () => {
    const cal = buildSleepCalendar([], 60);
    expect(cal).toHaveLength(60);
    expect(cal[59].date).toBe(dayOffset(0));
  });

  it('заполняет часы/качество для дат с записями', () => {
    const today = dayOffset(0);
    const cal = buildSleepCalendar([sleepEntry(today, 7.5, 3)], 60);
    const cell = cal[59];
    expect(cell.hours).toBe(7.5);
    expect(cell.quality).toBe(3);
  });

  it('пустые даты → hours null', () => {
    const cal = buildSleepCalendar([sleepEntry(dayOffset(-30), 7)], 60);
    const empty = cal.find((c) => c.date === dayOffset(-3))!;
    expect(empty.hours).toBeNull();
  });
});

describe('sleepCellLevel', () => {
  it('нет данных → none', () => {
    expect(sleepCellLevel(null, null)).toBe('none');
  });
  it('менее 6 часов → bad', () => {
    expect(sleepCellLevel(5.5, 4)).toBe('bad');
  });
  it('6–7 часов → low', () => {
    expect(sleepCellLevel(6.5, 4)).toBe('low');
  });
  it('7–9 часов с качеством ≥4 → great', () => {
    expect(sleepCellLevel(7.5, 4)).toBe('great');
  });
  it('7–9 часов с качеством <4 → good', () => {
    expect(sleepCellLevel(7.5, 2)).toBe('good');
  });
  it('более 9 часов → high', () => {
    expect(sleepCellLevel(10, 4)).toBe('high');
  });
});

describe('computeSleepTrends', () => {
  it('сравнивает эту неделю с прошлой по 4 метрикам', () => {
    // сегодня и вчера: 8 ч, качество 5; 9-12 дней назад: 6 ч, качество 2
    const entries = [
      sleepEntry(dayOffset(0), 8, 5),
      sleepEntry(dayOffset(-1), 8, 5),
      sleepEntry(dayOffset(-9), 6, 2),
      sleepEntry(dayOffset(-10), 6, 2),
    ];
    const trends = computeSleepTrends(entries);
    expect(trends).toHaveLength(4);
    const hours = trends.find((t) => t.label === 'Часы')!;
    const quality = trends.find((t) => t.label === 'Качество')!;
    const latency = trends.find((t) => t.label === 'Латентность')!;
    const awakenings = trends.find((t) => t.label === 'Пробуждений')!;
    expect(hours.delta).toBeCloseTo(2, 1);
    expect(quality.delta).toBeCloseTo(3, 1);
    expect(hours.betterWhenUp).toBe(true);
    expect(latency.betterWhenUp).toBe(false);
    expect(awakenings.betterWhenUp).toBe(false);
  });

  it('без данных прошлой недели delta = null', () => {
    const trends = computeSleepTrends([sleepEntry(dayOffset(0), 8)]);
    expect(trends.every((t) => t.delta === null)).toBe(true);
  });
});

describe('detectAnomalies (sleep)', () => {
  it('качество 1/5 → danger-аномалия', () => {
    const anomalies = detectAnomalies('sleep', [sleepEntry(dayOffset(0), 8, 1)]);
    expect(anomalies.some((a) => a.severity === 'danger' && a.message.includes('Качество'))).toBe(true);
  });

  it('латентность > 45 мин → warn-аномалия', () => {
    const anomalies = detectAnomalies('sleep', [sleepEntry(dayOffset(0), 8, 4, 50)]);
    expect(anomalies.some((a) => a.message.includes('Засыпание 50 мин'))).toBe(true);
  });

  it('алкоголь + качество ≤2 → warn-аномалия', () => {
    const anomalies = detectAnomalies('sleep', [sleepEntry(dayOffset(0), 8, 2, 20, 1, true)]);
    expect(anomalies.some((a) => a.message.includes('Алкоголь'))).toBe(true);
  });

  it('алкоголь без плохого качества не аномалия', () => {
    const anomalies = detectAnomalies('sleep', [sleepEntry(dayOffset(0), 8, 4, 20, 1, true)]);
    expect(anomalies.some((a) => a.message.includes('Алкоголь'))).toBe(false);
  });

  it('менее 5 часов → danger-аномалия (регрессия)', () => {
    const anomalies = detectAnomalies('sleep', [sleepEntry(dayOffset(0), 4.5)]);
    expect(anomalies.some((a) => a.severity === 'danger' && a.message.includes('4.5'))).toBe(true);
  });
});
