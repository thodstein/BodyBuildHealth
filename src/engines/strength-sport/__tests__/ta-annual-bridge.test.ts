import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildTAAnnualOverlay, saveTAAnnualOverlay, loadTAAnnualOverlay, TA_ANNUAL_SYNC_KEY } from '../strength-sport-ta-annual-bridge.engine';
import { buildTASpecBlock } from '../strength-sport-ta-spec-block.engine';

describe('TA annual bridge E16', () => {
  let store: any = {};
  let orig: any;
  beforeEach(() => {
    orig = (global as any).localStorage;
    store = {};
    (global as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    } as any;
  });
  afterEach(() => { (global as any).localStorage = orig; });

  it('пустой спец → null', () => {
    expect(buildTAAnnualOverlay(null)).toBeNull();
    expect(buildTAAnnualOverlay({ weeks: [] } as any)).toBeNull();
  });
  it('раскладка 6 нед с фокусом + поддержание', () => {
    const spec = buildTASpecBlock({ weakPoints: ['snatch_mid'], weeks: 6 });
    const weeks = buildTAAnnualOverlay(spec, { startWeek: 3, totalYearWeeks: 8 })!;
    expect(weeks.length).toBe(6); // нед 3..8
    expect(weeks[0]).toMatchObject({ week: 3, focus: ['snatch_mid'] });
    expect(weeks[5].note).toContain('спец');
  });
  it('save/load round-trip своим ключом', () => {
    const spec = buildTASpecBlock({ weakPoints: ['jerk_dip'], weeks: 4 });
    const weeks = buildTAAnnualOverlay(spec)!;
    expect(saveTAAnnualOverlay(weeks, 1)).toBe(true);
    expect(store[TA_ANNUAL_SYNC_KEY]).toBeTruthy();
    expect(store['he_strength_annual_sync_v1']).toBeUndefined(); // чужой ключ не тронут
    const loaded = loadTAAnnualOverlay();
    expect(loaded?.weeks.length).toBe(4);
    expect(saveTAAnnualOverlay([])).toBe(false);
  });
});
