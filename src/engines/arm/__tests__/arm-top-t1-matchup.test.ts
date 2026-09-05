import { describe, it, expect } from 'vitest';
import { profileOpponent, matchupVolumeFor, matchupCoversThreat } from '../arm-matchup.engine';

describe('arm-matchup TOP T1', () => {
  it('hook vs toproll даёт pron/risers приоритет', () => {
    const p = profileOpponent({ myTechnique: 'hook', oppStyle: 'toproll' });
    expect(p.priorityMuscles).toContain('pronators');
    expect(p.priorityMuscles).toContain('risers');
    expect(matchupCoversThreat(p)).toBe(true);
  });
  it('toproll vs hook даёт sup/cup приоритет', () => {
    const p = profileOpponent({ myTechnique: 'toproll', oppStyle: 'hook' });
    expect(p.priorityMuscles).toContain('supinators');
    expect(p.drills.length).toBeGreaterThanOrEqual(3);
  });
  it('press-угроза требует back поверх side', () => {
    const p = profileOpponent({ myTechnique: 'balanced', oppStyle: 'press' });
    expect(p.priorityMuscles[0]).toBe('back_pressure');
    expect(p.gameplan.join(' ')).toMatch(/hand control|closed-arm/i);
  });
  it('high-hand добавляет rise, low-hand — sup', () => {
    const h = profileOpponent({ oppStyle: 'toproll', oppHand: 'high' });
    const l = profileOpponent({ oppStyle: 'hook', oppHand: 'low' });
    expect(h.volumePatch['risers']).toBeGreaterThanOrEqual(1.25);
    expect(l.volumePatch['supinators']).toBeGreaterThanOrEqual(1.25);
  });
  it('тяжёлый оппонент → drain, лёгкий → скорость', () => {
    const heavy = profileOpponent({ oppStyle: 'hook', weightDeltaKg: 12 });
    const light = profileOpponent({ oppStyle: 'hook', weightDeltaKg: -8 });
    expect(heavy.gameplan.join(' ')).toMatch(/drain/i);
    expect(light.gameplan.join(' ')).toMatch(/скорость|F100/i);
  });
  it('ремень добавляет containment', () => {
    const p = profileOpponent({ oppStyle: 'balanced', strapExpected: true });
    expect(p.gameplan.join(' ')).toMatch(/ремень|containment/i);
  });
  it('unknown — универсальная база без узкой спецы', () => {
    const p = profileOpponent({});
    expect(p.oppStyle).toBe('unknown');
    expect(p.avoid.join(' ')).toMatch(/развед/i);
  });
  it('volumePatch фолбэк 1.0', () => {
    const p = profileOpponent({ oppStyle: 'press' });
    expect(matchupVolumeFor('grip_crush', p)).toBe(1);
    expect(matchupVolumeFor('back_pressure', p)).toBeGreaterThan(1);
    expect(matchupVolumeFor('back_pressure', null)).toBe(1);
  });
});
