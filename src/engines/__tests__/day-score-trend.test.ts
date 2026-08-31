/**
 * day-score-trend.test.ts — тесты тренда скора дня (доп. 1).
 *
 * - пустая история → 0, flat, без NaN;
 * - растущий тренд → up;
 * - падающий тренд → down;
 * - addDayScore/loadDayScores roundtrip (localStorage mock из setup).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { computeDayScoreTrend, addDayScore, loadDayScores, clearDayScores } from '../day-score-trend';

describe('computeDayScoreTrend (доп. 1)', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });

  it('пустая история → 0, flat, без NaN', () => {
    const t = computeDayScoreTrend([]);
    expect(t.avg7).toBe(0);
    expect(t.direction).toBe('flat');
    expect(Number.isFinite(t.delta)).toBe(true);
  });

  it('растущий тренд → up', () => {
    const scores = [
      '2026-08-01', '2026-08-03', '2026-08-05', '2026-08-07', '2026-08-09',
      '2026-08-11', '2026-08-13', '2026-08-15', '2026-08-17', '2026-08-19',
    ].map((date, i) => ({ date, score: 4 + i * 0.4 }));
    const t = computeDayScoreTrend(scores);
    expect(t.direction).toBe('up');
    expect(t.delta).toBeGreaterThan(0);
  });

  it('падающий тренд → down', () => {
    const scores = [
      '2026-08-01', '2026-08-03', '2026-08-05', '2026-08-07', '2026-08-09',
      '2026-08-11', '2026-08-13', '2026-08-15', '2026-08-17', '2026-08-19',
    ].map((date, i) => ({ date, score: 8 - i * 0.4 }));
    const t = computeDayScoreTrend(scores);
    expect(t.direction).toBe('down');
  });

  it('addDayScore/loadDayScores roundtrip и дедуп по дате', () => {
    addDayScore('2026-08-10', 7.2);
    addDayScore('2026-08-11', 8);
    addDayScore('2026-08-11', 9); // перезапись той же даты
    const list = loadDayScores();
    expect(list.filter(r => r.date === '2026-08-11')).toHaveLength(1);
    expect(list.find(r => r.date === '2026-08-11')?.score).toBe(9);
  });

  it('clearDayScores очищает всю историю', () => {
    addDayScore('2026-08-10', 7.2);
    addDayScore('2026-08-11', 8);
    expect(loadDayScores().length).toBeGreaterThan(0);
    clearDayScores();
    expect(loadDayScores()).toEqual([]);
  });
});
