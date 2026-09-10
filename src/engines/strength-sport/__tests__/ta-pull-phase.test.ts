import { describe, it, expect } from 'vitest';
import { diagnosePullPhaseProfile } from '../strength-sport-ta-pull-phase.engine';

describe('ta-pull-phase (W9)', () => {
  it('слабая изометрия → first + линк отрыва', () => {
    const r = diagnosePullPhaseProfile({ lift: 'snatch', isppRatio: 0.8 });
    expect(r.weakestSubPhase).toBe('first');
    expect(r.linkWeak).toBe('snatch_off_floor');
    expect(r.confidence).toBe('high');
  });
  it('просадка скорости → second + линк середины', () => {
    const r = diagnosePullPhaseProfile({ lift: 'clean', vbtLossPct: 14 });
    expect(r.weakestSubPhase).toBe('second');
    expect(r.linkWeak).toBe('clean_mid');
  });
  it('оба конца → transition; пусто → unknown', () => {
    const b = diagnosePullPhaseProfile({ isppRatio: 0.8, vbtLossPct: 12 });
    expect(b.weakestSubPhase).toBe('transition');
    expect(b.linkWeak).toBe('snatch_mid');
    const n = diagnosePullPhaseProfile({});
    expect(n.weakestSubPhase).toBe('unknown');
    expect(n.linkWeak).toBeNull();
  });
  it('IMTP-дефициты работают как сигналы; clean-линки', () => {
    const s = diagnosePullPhaseProfile({ lift: 'clean', imtpStrengthDeficit: true });
    expect(s.linkWeak).toBe('clean_off_floor');
    const e = diagnosePullPhaseProfile({ imtpExplosiveDeficit: true });
    expect(e.weakestSubPhase).toBe('second');
  });
});
