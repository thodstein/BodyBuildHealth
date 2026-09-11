import { describe, expect, it } from 'vitest';
import { autoRegulate, type AutoRegInput } from '../autoregulation-pro.engine';

function base(overrides: Partial<AutoRegInput> = {}): AutoRegInput {
  return { readiness: 80, acwr: { ratio: 1.0, zone: 'optimal' }, ...overrides };
}

describe('P4 VL-зоны по цели + совместимость', () => {
  it('дефолт без цели — как раньше (VL 28 → ×0.8)', () => {
    const out = autoRegulate(base({ lastVelocityLossPct: 28 }));
    expect(out.volumeMultiplier).toBe(0.8);
  });

  it('силовая цель строже: VL 28 → ×0.75', () => {
    const out = autoRegulate(base({ lastVelocityLossPct: 28, goal: 'strength' }));
    expect(out.volumeMultiplier).toBe(0.75);
    expect(out.decisions.join(' ')).toContain('силовой');
  });

  it('гипертрофия терпит: VL 35 → ×0.85 (было бы ×0.8)', () => {
    const out = autoRegulate(base({ lastVelocityLossPct: 35, goal: 'hypertrophy' }));
    expect(out.volumeMultiplier).toBe(0.85);
  });

  it('делюд-гейт 40 общий для всех целей', () => {
    for (const goal of ['strength', 'hypertrophy', 'general'] as const) {
      const out = autoRegulate(base({ lastVelocityLossPct: 41, goal }));
      expect(out.deload).toBe(true);
      expect(out.volumeMultiplier).toBe(0.5);
    }
  });

  it('свежесть VL<10 живёт при любой цели', () => {
    const out = autoRegulate(base({ lastVelocityLossPct: 5, goal: 'strength' }));
    expect(out.volumeMultiplier).toBe(1.05);
  });
});
