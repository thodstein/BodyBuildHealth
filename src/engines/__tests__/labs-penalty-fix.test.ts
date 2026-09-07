/**
 * labs-penalty-fix.test.ts — P0: штраф всегда ×1.35 + 8нед фильтр для baseline + кейс
 */
import { describe, it, expect } from 'vitest';
import { calculatePenaltyCoefficients } from '../labs-penalty.engine';

const now = new Date();
const oldDate = new Date(now.getTime() - 10 * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // 10 нед назад
const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe('labs-penalty P0 fixes', () => {
  it('баг: диагностика [] давала 0.35 всегда → теперь 0', () => {
    const labs = [{ code: 'ALT', date: recentDate } as any, { code: 'HCT', date: recentDate } as any];
    const res = calculatePenaltyCoefficients('baseline', labs, [], 1, [], false);
    expect(res.diagnosticPenalty).toBe(0);
    // labPenalty 0.5 из-за малого числа лаб, но диагностика 0
    expect(res.totalMultiplier).toBe(1.5);
  });

  it('baseline: старые лабы 10нед не считаются просроченными', () => {
    const labs = [{ code: 'ALT', date: oldDate } as any];
    const resBaseline = calculatePenaltyCoefficients('baseline', labs, ['echocg'], 1, [], false);
    const resOnCycle = calculatePenaltyCoefficients('on_cycle', labs, ['echocg'], 1, [], false);
    // baseline — window Infinity, ALT должен считаться сданным
    expect(resBaseline.missingLabsForPhase.includes('ALT')).toBe(false);
    // on_cycle — 8нед окно, 10нед старо → считается missing
    expect(resOnCycle.missingLabsForPhase.includes('ALT')).toBe(true);
  });

  it('кейс-инсенс: alt → ALT', () => {
    const labs = [{ code: 'alt', date: recentDate } as any];
    const res = calculatePenaltyCoefficients('baseline', labs, ['echocg'], 1, [], false);
    expect(res.missingLabsForPhase.includes('ALT')).toBe(false);
    expect(res.missingLabsForPhase.includes('alt')).toBe(false);
  });

  it('все лабы сданы → total 1.0 (без диагностики)', async () => {
    const { REQUIRED_LABS_PER_PHASE } = await import('../../core/constants');
    const required = (REQUIRED_LABS_PER_PHASE as any).baseline as string[];
    const labs = required.map((code) => ({ code, date: recentDate } as any));
    const res = calculatePenaltyCoefficients('baseline', labs, [], 1, [], false);
    expect(res.labPenalty).toBe(0);
    expect(res.diagnosticPenalty).toBe(0);
    expect(res.totalMultiplier).toBe(1.0);
    expect(res.missingLabsForPhase.length).toBe(0);
  });
});
