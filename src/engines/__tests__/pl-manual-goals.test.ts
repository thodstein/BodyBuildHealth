import { describe, it, expect } from 'vitest';
import { distributePhases, getDeloadOverride, normalizeManualGoal, isPLManualGoal, PL_GOAL_PHASE_OVERRIDES } from '../../ui/screens/TrainingScreen_parts/phase-periodization';

describe('PL manual 4 goals vs BB goals', () => {
  it('normalize legacy aliases', () => {
    expect(normalizeManualGoal('powerlifting')).toBe('pl_strength');
    expect(normalizeManualGoal('endurance')).toBe('pl_endurance');
    expect(normalizeManualGoal('speed')).toBe('pl_speed');
    expect(normalizeManualGoal('peaking')).toBe('pl_peaking');
    expect(normalizeManualGoal('hypertrophy')).toBe('hypertrophy');
    expect(normalizeManualGoal('cut')).toBe('cut');
  });

  it('isPLManualGoal vs BB', () => {
    expect(isPLManualGoal('pl_strength')).toBe(true);
    expect(isPLManualGoal('pl_endurance')).toBe(true);
    expect(isPLManualGoal('pl_speed')).toBe(true);
    expect(isPLManualGoal('pl_peaking')).toBe(true);
    expect(isPLManualGoal('hypertrophy')).toBe(false);
    expect(isPLManualGoal('mass')).toBe(false);
  });

  it('PL endurance: no peaking, higher accum ratio, deload every 3', () => {
    const dist8 = distributePhases(8, 4, 'pl_endurance');
    const peaking = dist8.filter(d => d.phase === 'peaking');
    expect(peaking.length).toBe(0); // выносливость — без пика (GPP блок)
    const deload = dist8.filter(d => d.phase === 'deload');
    // deload every 3 for endurance -> weeks 3,6
    expect(deload.map(d=>d.startWeek)).toContain(3);
  });

  it('PL strength: has peaking 1-2 weeks', () => {
    const dist8 = distributePhases(8, 4, 'pl_strength');
    const peaking = dist8.filter(d => d.phase === 'peaking');
    expect(peaking.length).toBeGreaterThan(0);
    expect(peaking.length).toBeLessThanOrEqual(2);
  });

  it('PL speed: no peaking, speed-specific repRange via override', () => {
    const dist8 = distributePhases(8, 4, 'pl_speed');
    const peaking = dist8.filter(d => d.phase === 'peaking');
    expect(peaking.length).toBe(0);
    const acc = dist8.find(d=>d.phase==='accumulation');
    expect(acc).toBeDefined();
    // speed accumulation repRange should be 5-8 (from override)
    expect(PL_GOAL_PHASE_OVERRIDES['pl_speed'].accumulation?.repRange).toEqual([5,8]);
  });

  it('PL peaking: 3 peaking weeks when >=8', () => {
    const dist12 = distributePhases(12, 4, 'pl_peaking');
    const peaking = dist12.filter(d=>d.phase==='peaking');
    expect(peaking.length).toBe(3);
    // intensity 0.97 per override
    expect(PL_GOAL_PHASE_OVERRIDES['pl_peaking'].peaking?.intensityMultiplier).toBe(0.97);
  });

  it('BB cut vs PL endurance differ in source and volume', () => {
    const bbCutDeload = getDeloadOverride('cut');
    const plEndDeload = getDeloadOverride('pl_endurance');
    expect(bbCutDeload.label).toContain('сушка');
    expect(plEndDeload.label).toContain('выносливость');
    expect(bbCutDeload.volumeMultiplier).not.toBe(plEndDeload.volumeMultiplier);
  });

  it('PL speed deload is technical (chains/pauses) vs strength intensive', () => {
    const speedDeload = getDeloadOverride('pl_speed');
    const strengthDeload = getDeloadOverride('pl_strength');
    expect(speedDeload.label).toContain('технический');
    expect(strengthDeload.label).toContain('сила');
  });

  it('PL peaking deload is taper ×0.25 (Bosquet)', () => {
    const peakingDeload = getDeloadOverride('pl_peaking');
    expect(peakingDeload.volumeMultiplier).toBe(0.25);
    expect(peakingDeload.repRange).toEqual([1,2]);
  });

  it('distributePhases covers 8 weeks fully', () => {
    for (const goal of ['pl_endurance','pl_strength','pl_speed','pl_peaking','hypertrophy','cut','recomp']) {
      const d = distributePhases(8, 4, goal);
      expect(d.length).toBe(8);
      const weeks = d.map(x=>x.startWeek);
      expect(new Set(weeks).size).toBe(8);
    }
  });
});
