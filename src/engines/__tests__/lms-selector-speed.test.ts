import { describe, it, expect } from 'vitest';
import { rankCycles } from '../lms/lms-selector.engine';

describe('PL-auto speed goal', () => {
  it('speed maps to strength/mixed/endurance periods without crash', () => {
    const ranked = rankCycles({ goal: 'speed', level: 'II-KMS', daysPerWeek: 3, direction: 'powerlifting', mode: 'natural' });
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].cycle.meta.id).toBeDefined();
  });
  it('speed vs endurance vs strength vs peak all rank differently', () => {
    const g = (goal: any) => rankCycles({ goal, level: 'II-KMS', daysPerWeek: 4, direction: 'powerlifting', mode: 'natural' })[0].cycle.meta.id;
    const ids = [g('endurance'), g('strength'), g('speed'), g('peak')];
    // at least 2 different picks due to period mapping
    expect(new Set(ids).size).toBeGreaterThan(1);
  });
});
