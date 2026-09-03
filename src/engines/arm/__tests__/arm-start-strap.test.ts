import { describe, it, expect } from 'vitest';
import {
  START_DRILLS,
  buildStrapSession,
  startReadiness,
  WAF_FOULS,
  WAF_FOULS_OUT_AFTER,
  wafFoulById,
  refereeProcedure,
  foulPreventionFor,
} from '../arm-start-strap.engine';

describe('arm-start-strap (эпик D)', () => {
  it('4 стартовых дрилла', () => {
    expect(START_DRILLS.map((d) => d.id)).toEqual(['reaction_go', 'referee_grip_drill', 'strap_start', 'foul_freeze']);
  });
  it('ремень-сессия: 10 удержаний, интенсивность ≤1', () => {
    const s = buildStrapSession('advanced');
    expect(s.totalHolds).toBe(10);
    for (const e of s.exercises) expect(e.intensityPct).toBeLessThanOrEqual(1);
    const beg = buildStrapSession('beginner');
    expect(beg.exercises[0].intensityPct).toBeLessThan(s.exercises[0].intensityPct);
  });
  it('готовность старта', () => {
    expect(startReadiness({ reactionMs: 280, falseStarts: 0 }).ready).toBe(true);
    expect(startReadiness({ reactionMs: 500, falseStarts: 0 }).ready).toBe(false);
    expect(startReadiness({ reactionMs: 250, falseStarts: 1 }).ready).toBe(false);
    expect(startReadiness({}).ready).toBe(false);
  });
  it('WAF-фолы: 6, вылет после 2, дриллы валидны', () => {
    expect(WAF_FOULS.length).toBe(6);
    expect(WAF_FOULS_OUT_AFTER).toBe(2);
    const drillIds = START_DRILLS.map((d) => d.id);
    for (const f of WAF_FOULS) {
      expect(f.what.length).toBeGreaterThan(0);
      expect(drillIds).toContain(f.drillId);
    }
    expect(wafFoulById('elbow_lift')?.name).toMatch(/локт/);
    expect(wafFoulById('nope')).toBeUndefined();
  });
  it('процедура рефери и профилактика', () => {
    expect(refereeProcedure().length).toBeGreaterThanOrEqual(5);
    expect(refereeProcedure().join(' ')).toMatch(/Go/);
    const prev = foulPreventionFor(['false_start', 'slip_grip', 'nope']);
    expect(prev.length).toBe(2);
    expect(prev[0].drillId).toBe('reaction_go');
    expect(prev[1].drillId).toBe('strap_start');
    expect(foulPreventionFor([])).toEqual([]);
  });
});
