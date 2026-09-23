import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildArmliftAnnualOverlay,
  saveArmliftAnnualOverlay,
  loadArmliftAnnualOverlay,
  ARMLIFT_ANNUAL_SYNC_KEY,
} from '../armlift-annual-bridge.engine';
import { buildArmliftSpecBlock } from '../armlift-correction.engine';

const spec = buildArmliftSpecBlock('thumb', 'saxon_bar', undefined, 4);

describe('armlift-annual-bridge ROUND-10', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* noop */ } });

  it('пустой/битый блок → null (честно)', () => {
    expect(buildArmliftAnnualOverlay(null)).toBeNull();
    expect(buildArmliftAnnualOverlay([])).toBeNull();
  });

  it('раскладка: недели блока — фокус, дальше поддержание; окно года', () => {
    const weeks = buildArmliftAnnualOverlay(spec, { startWeek: 10, totalYearWeeks: 14, focus: ['thumb'] })!;
    expect(weeks.length).toBe(5);
    expect(weeks[0].week).toBe(10);
    expect(weeks[0].focus).toEqual(['thumb']);
    expect(weeks[0].note).toContain('Армлифтинг спец');
    expect(weeks[4].focus).toEqual([]);
    expect(weeks[4].note).toContain('поддержание');
  });

  it('save/load roundtrip + битый стор → null', () => {
    const weeks = buildArmliftAnnualOverlay(spec, { startWeek: 1 })!;
    expect(saveArmliftAnnualOverlay(weeks, 1)).toBe(true);
    const sync = loadArmliftAnnualOverlay()!;
    expect(sync.startWeek).toBe(1);
    expect(sync.weeks.length).toBe(weeks.length);
    expect(localStorage.getItem(ARMLIFT_ANNUAL_SYNC_KEY)).toBeTruthy();
    localStorage.setItem(ARMLIFT_ANNUAL_SYNC_KEY, '{"weeks":42}');
    expect(loadArmliftAnnualOverlay()).toBeNull();
    expect(saveArmliftAnnualOverlay([], 1)).toBe(false);
  });
});
