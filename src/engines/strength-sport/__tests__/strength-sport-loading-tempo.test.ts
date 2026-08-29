import { describe, it, expect } from 'vitest';
import { tempoForSS, restForSS, repsForSS, pctForSS } from '../strength-sport-loading';

describe('strength-sport-loading tempo overrides', () => {
  it('snatch = explosive X-0-X-0', () => {
    expect(tempoForSS('snatch', 'тяж', 'accumulation')).toBe('X-0-X-0');
    expect(tempoForSS('hang_clean', 'тяж', 'peaking')).toBe('X-0-X-0');
    expect(tempoForSS('push_jerk', 'тяж', 'intensification')).toBe('X-0-X-0');
  });
  it('rdl = lengthened 3-1-1-0', () => {
    expect(tempoForSS('rdl', 'тяж', 'accumulation')).toBe('3-1-1-0');
  });
  it('bulgarian = 3-0-1-0', () => {
    expect(tempoForSS('bulgarian_split', 'тяж', 'intensification')).toBe('3-0-1-0');
  });
  it('yoke = carry 1-0-1-0', () => {
    expect(tempoForSS('yoke_walk', 'тяж', 'accumulation')).toBe('1-0-1-0');
    expect(tempoForSS('farmers_walk_heavy', 'тяж', 'accumulation')).toBe('1-0-1-0');
  });
  it('deload overrides to 3-1-1-0', () => {
    expect(tempoForSS('bench_bar', 'тяж', 'deload')).toBe('3-1-1-0');
  });
  it('pump character = 2-0-1-1', () => {
    expect(tempoForSS('unknown', 'памп', 'accumulation')).toBe('2-0-1-1');
  });
  it('rest for heavy primary = 180', () => {
    expect(restForSS('тяж', true)).toBe(180);
  });
  it('rest for pump = 75', () => {
    expect(restForSS('памп', false)).toBe(75);
  });
  it('reps for technique', () => {
    expect(repsForSS('snatch_day', 'accumulation', 'technique', true)).toEqual([1,2]);
  });
  it('pct for peaking', () => {
    expect(pctForSS('peaking', 'strength')).toBeCloseTo(0.92);
  });
});
