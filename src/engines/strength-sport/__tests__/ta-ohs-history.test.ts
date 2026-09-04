import { describe, it, expect } from 'vitest';
import { appendOHSSnapshot, ohsScoreTrend } from '../strength-sport-ohs.engine';

describe('TA OHS history V4-C', () => {
  it('замена по дате + кап 30', () => {
    let h = appendOHSSnapshot([], { date: '2026-01-01', score: 4, failed: 2, level: 'warn' });
    h = appendOHSSnapshot(h, { date: '2026-01-01', score: 5, failed: 1, level: 'warn' });
    expect(h.length).toBe(1);
    expect(h[0].score).toBe(5);
    for (let i = 2; i <= 35; i++) h = appendOHSSnapshot(h, { date: `2026-02-${String(i > 28 ? 28 : i).padStart(2, '0')}`, score: 5, failed: 1, level: 'warn' });
    expect(h.length).toBeLessThanOrEqual(30);
  });
  it('тренд: улучшение положительное', () => {
    const t = ohsScoreTrend([
      { date: '2026-01-01', score: 3, failed: 3, level: 'critical' },
      { date: '2026-03-01', score: 5, failed: 1, level: 'warn' },
    ]);
    expect(t?.delta).toBe(2);
    expect(t?.n).toBe(2);
    expect(ohsScoreTrend([{ date: '2026-01-01', score: 4, failed: 2, level: 'warn' }])).toBeNull();
  });
  it('мусор без throw', () => {
    expect(appendOHSSnapshot(null as any, { date: '2026-01-01', score: 4, failed: 2, level: 'warn' }).length).toBe(1);
    expect(ohsScoreTrend([])).toBeNull();
  });
});
