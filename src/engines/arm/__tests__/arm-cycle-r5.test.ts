import { describe, it, expect } from 'vitest';
import { buildArmProSummary } from '../arm-pro-integration.engine';
import { annualBlockCycleSuggestion } from '../arm-annual';
import { getArmCycle } from '../arm-cycle-library.engine';

describe('arm-cycle-r5 (summary + annual suggestion)', () => {
  it('summary: пусто без цикловых входов (байт-в-байт)', () => {
    const s = buildArmProSummary({ discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'balanced', weeks: 8 });
    expect(s.cycle).toBeNull();
    expect(s.medley).toBeNull();
    expect(s.coc).toBeNull();
    expect(s.regimen).toBeNull();
    // старые поля на месте
    expect(s).toHaveProperty('waf');
    expect(s).toHaveProperty('attempts');
  });
  it('summary: цикл + медли + coc + режим заполняются теми же движками', () => {
    const s = buildArmProSummary({
      discipline: 'armlifting', patternId: 'grip_3_support', level: 'advanced', goal: 'strength', technique: 'balanced', weeks: 12,
      cycleId: 'coc_12', medleyId: 'rt_saxon_hub',
      medleyAttempts: [{ eventIdx: 0, weightKg: 100, success: true }],
      cocWorking: 'no2', brzenkMode: true,
    } as any);
    expect(s.cycle?.id).toBe('coc_12');
    expect(s.cycle?.taperPreset).toBe('coc_deload');
    expect(s.medley?.total).toBe(100);
    expect(s.coc?.working).toBe('no2');
    expect(s.coc?.challenge).toBe('no2_5');
    expect(s.regimen?.volumeMult).toBeLessThanOrEqual(0.9);
    expect(s.regimen?.lines.some((l) => /Brzenk/.test(l))).toBe(true);
  });
  it('annualBlockCycleSuggestion: 4 фазы + armlifting-пик', () => {
    const base = annualBlockCycleSuggestion('base');
    expect(getArmCycle(base.cycleId)).toBeTruthy();
    expect(base.note).toMatch('base');
    expect(annualBlockCycleSuggestion('strength').cycleId).toBe('src_toproll_12');
    expect(annualBlockCycleSuggestion('peaking').cycleId).toBe('toproll_6');
    expect(annualBlockCycleSuggestion('transition').cycleId).toBe('brzenk_1_1');
    expect(annualBlockCycleSuggestion('peaking', 'armlifting').cycleId).toBe('coc_12');
  });
});
