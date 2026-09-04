import { describe, it, expect } from 'vitest';
import { diagnoseTAWeakCause } from '../strength-sport-ta-weak-cause.engine';

describe('TA weak cause E2', () => {
  it('fatigue high: ACWR danger + VBT', () => {
    const r = diagnoseTAWeakCause({ zone: 'snatch_mid', acwrZone: 'dangerous', vbtLossPct: 15 });
    expect(r.cause).toBe('fatigue');
    expect(r.confidence).toBe('high');
  });
  it('mobility: сед + OHS fail', () => {
    const r = diagnoseTAWeakCause({ zone: 'snatch_catch', ohsFailed: 3 });
    expect(r.cause).toBe('mobility');
    expect(r.confidence).toBe('med');
  });
  it('mobility high: OHS + нет объёма', () => {
    const r = diagnoseTAWeakCause({ zone: 'clean_catch', ohsFailed: 4, factSetsPerWeek: 0 });
    expect(r.cause).toBe('mobility');
    expect(r.confidence).toBe('high');
  });
  it('strength: отрыв + ISPP<85%', () => {
    const r = diagnoseTAWeakCause({ zone: 'clean_off_floor', isppRatio: 0.8 });
    expect(r.cause).toBe('strength');
  });
  it('strength: e1RM −6% при 3 сессиях', () => {
    const r = diagnoseTAWeakCause({ zone: 'snatch_pull_under', e1rmDeltaPct: -6, e1rmSessions: 3 });
    expect(r.cause).toBe('strength');
  });
  it('volume: 0 сетов фазы', () => {
    const r = diagnoseTAWeakCause({ zone: 'jerk_drive', factSetsPerWeek: 0 });
    expect(r.cause).toBe('volume');
    expect(r.confidence).toBe('high');
  });
  it('technique fallback без данных', () => {
    const r = diagnoseTAWeakCause({ zone: 'snatch_mid' });
    expect(r.cause).toBe('technique');
    expect(r.confidence).toBe('low');
    expect(r.text.length).toBeGreaterThan(10);
  });
  it('мусорный вход без throw', () => {
    const r = diagnoseTAWeakCause({ zone: 'snatch_mid', factSetsPerWeek: NaN, ohsFailed: -1 } as any);
    expect(['volume', 'technique', 'mobility', 'fatigue', 'strength']).toContain(r.cause);
  });
});
