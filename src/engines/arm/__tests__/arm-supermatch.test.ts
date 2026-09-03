import { describe, it, expect } from 'vitest';
import { buildSupermatchPlan, supermatchProgressionOk, supermatchRoundsFor } from '../arm-supermatch.engine';

describe('arm-supermatch (эпик C)', () => {
  it('раунды по уровню', () => {
    expect(supermatchRoundsFor('beginner', false).rounds).toBe(3);
    expect(supermatchRoundsFor('advanced', false).rounds).toBe(5);
    expect(supermatchRoundsFor('enhanced', false).rounds).toBe(6);
  });
  it('делоад −40% объёма и 3 раунда', () => {
    const base = buildSupermatchPlan({ level: 'advanced', baseSets: 10 });
    const del = buildSupermatchPlan({ level: 'advanced', baseSets: 10, isDeload: true });
    expect(del.rounds.length).toBe(3);
    expect(del.volumeSets).toBe(6);
    expect(del.volumeSets).toBeLessThan(base.volumeSets);
  });
  it('TUT считается, отдых у последнего 0', () => {
    const p = buildSupermatchPlan({ level: 'intermediate' });
    expect(p.totalTimeUnderTensionSec).toBe(p.rounds.length * 12);
    expect(p.rounds[p.rounds.length - 1].restSec).toBe(0);
  });
  it('прогрессия TUT к пику', () => {
    expect(supermatchProgressionOk([{ tutSec: 30 }, { tutSec: 48 }, { tutSec: 60 }, { tutSec: 36, isDeload: true }])).toBe(true);
    expect(supermatchProgressionOk([{ tutSec: 60 }, { tutSec: 40 }])).toBe(false);
  });
});
