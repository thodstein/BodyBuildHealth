/**
 * bb-date-canon.test.ts — проход 200: календарные даты в движках `src/engines/bb`.
 *
 * Витрина долга (`date-canon-census`) показывает, СКОЛЬКО мест осталось, но не
 * доказывает, что исправленное читает календарь. Здесь — поведение: дата отчёта
 * диагностики и опорный день «текущей недели» равны местному дню, а не UTC-дню.
 * Тест ставит время на местные 00:30 — в UTC+3…+12 это ещё «вчера» по UTC,
 * поэтому старая запись отличалась бы на сутки.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildBBDiagnosticsHtml } from '../bb-diagnostics-export.engine';
import { bbWeekDateRanges } from '../bb-visual.engine';
import { buildBBPlan } from '../bb-builder.engine';
import { localIsoDate } from '../../../core/local-date';
import { readFileSync } from 'node:fs';
import { isoToday } from '../bb-contest-prep.engine';

const report = () => ({
  weakCandidates: [],
  weakMusclesCanonical: [],
  weakZonesGranular: [],
  symmetry: { ratios: {}, issues: [], score: 80 },
  stimulus: { global: { lengthened: 1, midRange: 2, shortened: 0, compound: 3, isolation: 2, patterns: {} }, issues: [] },
  score: { score: 90, level: 'ok', floors: [], verification: 0.5, penalties: {}, raw: 5 },
  findings: [], priorities: [],
});

afterEach(() => vi.useRealTimers());

describe('проход 200: даты движков ББ — календарь, а не UTC-день', () => {
  it('отчёт диагностики без даты подписан местным днём', () => {
    // Местные 00:30: в UTC+3…+12 UTC-день ещё вчерашний.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 26, 0, 30));
    const местный = localIsoDate();
    const поUtc = new Date().toISOString().slice(0, 10);
    expect(местный).toBe('2026-09-26');

    const html = buildBBDiagnosticsHtml(report() as any, {} as any);
    expect(html).toContain(`отчёт ${местный}`);
    // На машине с отрицательным смещением даты совпадают — утверждение было бы
    // вакуумным, поэтому сравнение с UTC только при положительном смещении.
    if (new Date().getTimezoneOffset() < 0) expect(html).not.toContain(`отчёт ${поUtc}`);
  });

  it('«текущая неделя» в диапазонах плана считается по местному дню', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 26, 0, 30));
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass' as any, weeks: 2 } as any);
    // Старт ровно неделю назад: сегодня — вторая неделя.
    const ranges = bbWeekDateRanges(plan, { startDate: '2026-09-19' });
    expect(ranges[0].start).toBe('2026-09-19');
    expect(ranges[0].isCurrent).toBe(false);
    expect(ranges[1].start).toBe('2026-09-26');
    expect(ranges[1].isCurrent).toBe(true);
  });

  it('явная опорная дата по-прежнему главнее сегодняшнего дня', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass' as any, weeks: 2 } as any);
    const ranges = bbWeekDateRanges(plan, { startDate: '2026-09-19', referenceDate: '2026-09-21' });
    expect(ranges[0].isCurrent).toBe(true);
    expect(ranges[1].isCurrent).toBe(false);
  });
});
describe('isoToday в BB-движке — делегат канона local-date', () => {
  it('отдаёт местную календарную дату, а не UTC', () => {
    // 01:40 по местному времени: в положительных поясах UTC-дата ещё вчерашняя.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 25, 1, 40, 0));
    expect(isoToday()).toBe('2026-11-25');
    expect(isoToday()).toBe(localIsoDate());
    if (new Date().getTimezoneOffset() < 0) {
      expect(isoToday()).not.toBe(new Date().toISOString().slice(0, 10));
    }
  });

  it('второй независимой реализации форматтера в движке нет', () => {
    const src = readFileSync('src/engines/bb/bb-contest-prep.engine.ts', 'utf8');
    expect(src).toContain('export const isoToday: () => string = localIsoDate;');
    expect(src).not.toContain('export function isoToday');
  });
});
