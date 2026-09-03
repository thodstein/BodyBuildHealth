import { describe, it, expect } from 'vitest';
import { START_DRILLS, buildStrapSession, startReadiness } from '../arm-start-strap.engine';

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
});
