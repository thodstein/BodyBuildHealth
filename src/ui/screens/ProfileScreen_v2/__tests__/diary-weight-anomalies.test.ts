/**
 * diary-weight-anomalies.test.ts — аномалии веса (detectAnomalies 'weight'),
 * preferMorning (тренд по утренним), csvEscape (RFC 4180).
 */
import { describe, it, expect } from 'vitest';
import { detectAnomalies, type DiaryEntryLike } from '../diary-helpers';
import { preferMorning, csvEscape } from '../diaries/WeightDiary/weight-insights';

const w = (date: string, weight: number): DiaryEntryLike => ({
  date,
  fields: [{ label: 'Вес', value: String(weight), unit: 'кг' }],
});

describe('detectAnomalies — ветка weight', () => {
  it('пустой список → нет аномалий', () => {
    expect(detectAnomalies('weight', [])).toEqual([]);
  });

  it('скачок +3 кг за день → warn', () => {
    const issues = detectAnomalies('weight', [w('2026-01-01', 80), w('2026-01-02', 83)]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warn');
    expect(issues[0].date).toBe('2026-01-02');
    expect(issues[0].message).toContain('+3.0');
  });

  it('скачок −6 кг за день → danger', () => {
    const issues = detectAnomalies('weight', [w('2026-01-01', 90), w('2026-01-02', 84)]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('danger');
    expect(issues[0].message).toContain('-6.0');
  });

  it('нормальные колебания ±0.5 кг → нет аномалий', () => {
    const issues = detectAnomalies('weight', [w('2026-01-01', 80), w('2026-01-02', 80.5), w('2026-01-03', 80.1)]);
    expect(issues).toEqual([]);
  });

  it('скачок через пропуск в 3 дня не считается аномалией', () => {
    const issues = detectAnomalies('weight', [w('2026-01-01', 80), w('2026-01-04', 86)]);
    expect(issues).toEqual([]);
  });

  it('входной порядок (desc) не влияет — сортируется внутри', () => {
    const issues = detectAnomalies('weight', [w('2026-01-02', 83), w('2026-01-01', 80)]);
    expect(issues).toHaveLength(1);
    expect(issues[0].date).toBe('2026-01-02');
  });

  it('нереалистичный вес вне 25–350 → warn', () => {
    const issues = detectAnomalies('weight', [w('2026-01-01', 82), w('2026-01-02', 10)]);
    expect(issues.some((i) => i.message.includes('вне правдоподобного'))).toBe(true);
  });

  it('процентный порог: +5% веса (80→84 = 4 кг) → danger через %', () => {
    const issues = detectAnomalies('weight', [w('2026-01-01', 80), w('2026-01-02', 84)]);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('danger');
  });

  it('1.5% рост (100→101.5) ниже обоих порогов → без аномалий', () => {
    expect(detectAnomalies('weight', [w('2026-01-01', 100), w('2026-01-02', 101.5)])).toEqual([]);
  });
});

describe('preferMorning — утренний тренд', () => {
  it('достаточно утренних (≥60%, ≥3) → берёт только утренние', () => {
    const rows = [
      { date: '2026-01-01', weight: 80, timeOfDay: 'morning' as const },
      { date: '2026-01-02', weight: 81, timeOfDay: 'morning' as const },
      { date: '2026-01-03', weight: 80.8, timeOfDay: 'morning' as const },
      { date: '2026-01-04', weight: 81.5, timeOfDay: 'evening' as const },
    ];
    const out = preferMorning(rows);
    expect(out).toHaveLength(3);
    expect(out.every((r) => r.timeOfDay === 'morning')).toBe(true);
  });

  it('мало утренних → все записи', () => {
    const rows = [
      { date: '2026-01-01', weight: 80, timeOfDay: 'morning' as const },
      { date: '2026-01-02', weight: 81, timeOfDay: 'evening' as const },
      { date: '2026-01-03', weight: 80.8, timeOfDay: 'evening' as const },
    ];
    expect(preferMorning(rows)).toHaveLength(3);
  });

  it('без timeOfDay (записи из модалки) → все записи', () => {
    const rows = [
      { date: '2026-01-01', weight: 80 },
      { date: '2026-01-02', weight: 81 },
      { date: '2026-01-03', weight: 80.8 },
    ];
    expect(preferMorning(rows)).toHaveLength(3);
  });

  it('пустой список → пустой список', () => {
    expect(preferMorning([])).toEqual([]);
  });
});

describe('csvEscape — RFC 4180', () => {
  it('простые значения без кавычек', () => {
    expect(csvEscape('82.5')).toBe('82.5');
    expect(csvEscape(82)).toBe('82');
    expect(csvEscape(undefined)).toBe('');
    expect(csvEscape(null)).toBe('');
  });

  it('значения с запятыми/кавычками/переносами оборачиваются в кавычки', () => {
    expect(csvEscape('хорошо, но')).toBe('"хорошо, но"');
    expect(csvEscape('сказал "привет"')).toBe('"сказал ""привет"""');
    expect(csvEscape('строка\nперенос')).toBe('"строка\nперенос"');
  });
});
