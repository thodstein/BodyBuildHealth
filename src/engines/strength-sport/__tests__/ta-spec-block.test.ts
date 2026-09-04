import { describe, it, expect } from 'vitest';
import { buildTASpecBlock, specSetsForWeekIndex } from '../strength-sport-ta-spec-block.engine';

describe('TA spec block E5', () => {
  it('волна 3,3,4,4,4,4,3,3', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(specSetsForWeekIndex)).toEqual([3, 3, 4, 4, 4, 4, 3, 3]);
  });
  it('кламп недель 2→4, 12→8', () => {
    expect(buildTASpecBlock({ weakPoints: ['snatch_mid'], weeks: 2 }).totalWeeks).toBe(4);
    expect(buildTASpecBlock({ weakPoints: ['snatch_mid'], weeks: 12 }).totalWeeks).toBe(8);
  });
  it('targetSets и dayMap на все фазы', () => {
    const b = buildTASpecBlock({ weakPoints: ['snatch_mid', 'jerk_dip'], weeks: 6 });
    expect(b.weeks.length).toBe(6);
    expect(b.weeks[0].targetSets).toEqual({ snatch_mid: 3, jerk_dip: 3 });
    expect(b.weeks[2].targetSets).toEqual({ snatch_mid: 4, jerk_dip: 4 });
    expect(b.dayMap).toEqual({ snatch_mid: [1], jerk_dip: [1] });
    expect(b.rationale[0]).toContain('спец-блок');
  });
  it('пустые фазы → пустые недели', () => {
    const b = buildTASpecBlock({ weakPoints: [] });
    expect(b.weeks).toEqual([]);
    expect(b.dayMap).toEqual({});
  });
  it('детерминизм + кап 3 фаз', () => {
    const a = JSON.stringify(buildTASpecBlock({ weakPoints: ['a', 'b', 'c', 'd', 'a'] as any, weeks: 5 }));
    const b = JSON.stringify(buildTASpecBlock({ weakPoints: ['a', 'b', 'c', 'd', 'a'] as any, weeks: 5 }));
    expect(a).toBe(b);
    expect(JSON.parse(a).weakPoints.length).toBe(3);
  });
});
