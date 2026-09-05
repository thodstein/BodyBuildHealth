import { describe, it, expect } from 'vitest';
import { planSparring, pickSparringPartner, sparringAllowed } from '../arm-sparring.engine';

describe('arm-sparring (эпик E)', () => {
  it('100% разрешён только в тяжёлых условиях', () => {
    expect(sparringAllowed({ intensityPct: 100 }).allowed).toBe(true);
    expect(sparringAllowed({ intensityPct: 100, isDeload: true }).allowed).toBe(false);
    expect(sparringAllowed({ intensityPct: 100, isPeakingLast: true }).allowed).toBe(false);
    expect(sparringAllowed({ intensityPct: 100, tendonSets: 20 }).allowed).toBe(false);
    expect(sparringAllowed({ intensityPct: 100, sessionsThisWeek: 1 }).allowed).toBe(false);
  });
  it('партнёр вне ±5 кг — запрет', () => {
    const s = planSparring({ intensityPct: 90, partnerDeltaKg: 12 });
    expect(s.allowed).toBe(false);
    expect(s.warnings.join(' ')).toMatch(/±5/);
  });
  it('подбор партнёра — ближайший в диапазоне', () => {
    expect(pickSparringPartner(80, [70, 82, 95])).toBe(82);
    expect(pickSparringPartner(80, [70, 95])).toBeNull();
  });
  it('70% — больше раундов, длиннее', () => {
    const t = planSparring({ intensityPct: 70 });
    const h = planSparring({ intensityPct: 100 });
    expect(t.rounds).toBeGreaterThan(h.rounds);
    expect(t.roundSec).toBeGreaterThan(h.roundSec);
  });
  it('новичок: 90/100 запрещены первые 3 месяца', () => {
    expect(sparringAllowed({ intensityPct: 100, level: 'beginner' }).allowed).toBe(false);
    expect(sparringAllowed({ intensityPct: 90, level: 'beginner' }).allowed).toBe(false);
    expect(sparringAllowed({ intensityPct: 70, level: 'beginner' }).allowed).toBe(true);
    expect(planSparring({ intensityPct: 100, level: 'beginner' }).allowed).toBe(false);
    expect(sparringAllowed({ intensityPct: 100, level: 'intermediate' }).allowed).toBe(true);
  });
});
