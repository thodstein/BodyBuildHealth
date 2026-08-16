import { describe, expect, it } from 'vitest';
import { trainingSafetyGate } from '../training-safety-gate.engine';
import type { TrainingSafetyReport } from '../training-safety.types';

const report = (level: TrainingSafetyReport['level']): TrainingSafetyReport => ({
  score: 70, level, factors: {}, issues: [], recommendations: [], adjustments: [], exercises: [], generatedAt: 'test',
});

describe('training-safety-gate', () => {
  it('blocks critical reports', () => {
    expect(trainingSafetyGate(report('blocked'))).toEqual({ allowed: false, requiresConfirmation: false, message: expect.stringContaining('заблокировано') });
  });

  it('requires explicit confirmation for dangerous reports', () => {
    expect(trainingSafetyGate(report('dangerous')).requiresConfirmation).toBe(true);
    expect(trainingSafetyGate(report('dangerous')).allowed).toBe(false);
    expect(trainingSafetyGate(report('dangerous'), true).allowed).toBe(true);
  });

  it('allows safe and caution reports', () => {
    expect(trainingSafetyGate(report('safe')).allowed).toBe(true);
    expect(trainingSafetyGate(report('caution')).allowed).toBe(true);
  });
});
