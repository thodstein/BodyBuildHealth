import { describe, it, expect } from 'vitest';
import { analyzeCombatStrikePath } from '../combat-strike-path.engine';
import { parseCombatTrackerCsv, mergeTrackerWithManual, TRACKER_DISCLAIMER } from '../combat-tracker-import.engine';

/** P3+P4: parity bar-path на golden-CSV; трекеры 3 формата; ручное приоритетнее. */
describe('combat strike-path (P3 reuse)', () => {
  const straightCsv = ['t,x,y', '0,0,100', '0.033,0.5,105', '0.066,1.0,110', '0.1,0.8,108'].join('\n');
  const loopCsv = ['t,x,y', '0,-8,100', '0.033,0,108', '0.066,8,112', '0.1,-4,106', '0.133,6,104'].join('\n');

  it('прямая траектория — straight', () => {
    const r = analyzeCombatStrikePath(straightCsv);
    expect(r.verdict).toBe('straight');
    expect(r.xLoopCm).toBeCloseTo(1, 5);
    expect(r.classification).not.toBeNull();
  });

  it('петля — loop с коррекциями', () => {
    const r = analyzeCombatStrikePath(loopCsv);
    expect(r.verdict).toBe('loop');
    expect(r.corrections.length).toBeGreaterThan(0);
  });

  it('пусто — честный no_data, мусор — bad_data', () => {
    expect(analyzeCombatStrikePath('').verdict).toBe('no_data');
    expect(analyzeCombatStrikePath('мусор без цифр').verdict).toBe('bad_data');
  });
});

describe('combat tracker-import (P4)', () => {
  it('парсит 3 формата и считает среднюю', () => {
    const csv = ['punch_type,speed', 'jab,7.5', 'cross,8.5', 'hook,9.0'].join('\n');
    const r = parseCombatTrackerCsv(csv);
    expect(r.total).toBe(3);
    expect(r.avgSpeedMs).toBeCloseTo(8.33, 1);
    expect(r.disclaimer).toBe(TRACKER_DISCLAIMER);
  });

  it('трекер не даёт силу — только скорость и объём', () => {
    const r = parseCombatTrackerCsv(['type,speed', 'jab,7'].join('\n'));
    expect(r.punches[0]).not.toHaveProperty('forceN');
    expect(r.total).toBe(1);
  });

  it('ручное приоритетнее трекера', () => {
    const t = parseCombatTrackerCsv(['type,speed', 'jab,6', 'jab,8'].join('\n'));
    expect(mergeTrackerWithManual(t, 9)).toEqual({ speedMs: 9, source: 'manual', volume: 2 });
    expect(mergeTrackerWithManual(t).source).toBe('tracker');
    expect(mergeTrackerWithManual({ brand: 'unknown', punches: [], total: 0, avgSpeedMs: null, disclaimer: TRACKER_DISCLAIMER }).source).toBe('none');
  });
});
