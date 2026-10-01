/**
 * planner-weekly-review.test.ts — недельный разбор (план → факт → коррекция).
 */
import { describe, it, expect } from 'vitest';
import { buildWeeklyReview, targetRatePctPerWeek, type WeeklyReviewInput } from '../planner-weekly-review.engine';

const daysOn = (kcal: number, p = 180, n = 7) =>
  Array.from({ length: n }, (_, i) => ({ date: `2026-03-${String(2 + i).padStart(2, '0')}`, kcal, proteinG: p }));

const inp = (over: Partial<WeeklyReviewInput> = {}): WeeklyReviewInput => ({
  days: daysOn(3000),
  targetKcal: 3000,
  targetProteinG: 180,
  weightLog: [
    { date: '2026-03-02', weightKg: 80 },
    { date: '2026-03-08', weightKg: 79.66 },
  ],
  goal: 'cutting',
  ...over,
});

describe('Недельный разбор', () => {
  it('целевой темп по целям', () => {
    expect(targetRatePctPerWeek('cutting')).toBe(-0.5);
    expect(targetRatePctPerWeek('mass')).toBe(0.25);
    expect(targetRatePctPerWeek('recomposition')).toBe(0);
  });

  it('сушка в цели: −0.5%/нед → on_track, без правки', () => {
    const r = buildWeeklyReview(inp());
    expect(r.weightRatePctPerWeek).toBeCloseTo(-0.5, 1);
    expect(r.verdict).toBe('on_track');
    expect(r.kcalAdjust).toBe(0);
    expect(r.adherencePct).toBe(100);
  });

  it('сушка слишком медленно: вес стоит → too_slow, −150', () => {
    const r = buildWeeklyReview(inp({ weightLog: [{ date: '2026-03-02', weightKg: 80 }, { date: '2026-03-08', weightKg: 80 }] }));
    expect(r.verdict).toBe('too_slow');
    expect(r.kcalAdjust).toBe(-150);
  });

  it('сушка слишком быстро → too_fast, +150', () => {
    const r = buildWeeklyReview(inp({ weightLog: [{ date: '2026-03-02', weightKg: 80 }, { date: '2026-03-08', weightKg: 78.5 }] }));
    expect(r.verdict).toBe('too_fast');
    expect(r.kcalAdjust).toBe(150);
  });

  it('набор медленный → too_slow, +150', () => {
    const r = buildWeeklyReview(inp({ goal: 'mass', weightLog: [{ date: '2026-03-02', weightKg: 80 }, { date: '2026-03-08', weightKg: 80 }] }));
    expect(r.verdict).toBe('too_slow');
    expect(r.kcalAdjust).toBe(150);
  });

  it('рекомпозиция: стабильный вес → on_track', () => {
    const r = buildWeeklyReview(inp({ goal: 'recomposition', weightLog: [{ date: '2026-03-02', weightKg: 80 }, { date: '2026-03-08', weightKg: 80.1 }] }));
    expect(r.verdict).toBe('on_track');
  });

  it('приверженность считается по ±5% и <70% добавляет предупреждение', () => {
    const days = [...daysOn(3000, 180, 3), ...daysOn(2500, 180, 4)];
    const r = buildWeeklyReview(inp({ days }));
    expect(r.loggedDays).toBe(7);
    expect(r.adherencePct).toBe(43);
    expect(r.recommendation).toMatch(/Приверженность/);
  });

  it('<4 дней логов → no_data', () => {
    const r = buildWeeklyReview(inp({ days: daysOn(3000, 180, 3) }));
    expect(r.verdict).toBe('no_data');
    expect(r.kcalAdjust).toBe(0);
  });

  it('детерминизм', () => {
    expect(buildWeeklyReview(inp())).toEqual(buildWeeklyReview(inp()));
  });
});
