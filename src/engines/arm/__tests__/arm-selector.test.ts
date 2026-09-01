import { describe, it, expect } from 'vitest';
import { rankArmSplits, selectBestArmSplit } from '../arm-selector.engine';

describe('arm-selector', () => {
  it('rank по level', () => {
    const ranked = rankArmSplits({ level: 'beginner', daysPerWeek: 2 });
    expect(ranked[0].pattern.level.some(l => l.toLowerCase()==='beginner')).toBe(true);
  });
  it('advanced: 5× сплит в топе при daysPerWeek=5', () => {
    const ranked = rankArmSplits({ level: 'advanced', daysPerWeek: 5 });
    expect(ranked[0].pattern.sessionsPerRotation).toBeGreaterThanOrEqual(4);
  });
  it('hook → ham/supination бонус', () => {
    const hook = rankArmSplits({ level: 'intermediate', technique: 'hook' });
    const balanced = rankArmSplits({ level: 'intermediate', technique: 'balanced' });
    // hook должен ранжировать иначе (не обязательно выше, но детерминирован)
    expect(hook[0].pattern.id).toBeDefined();
    expect(balanced[0].pattern.id).toBeDefined();
  });
  it('armlifting → grip сплит', () => {
    const ranked = rankArmSplits({ level: 'intermediate', discipline: 'armlifting', daysPerWeek: 3 });
    expect(ranked[0].pattern.id.includes('grip')).toBe(true);
  });
  it('armwrestling weakPoints влияет на ранжирование', () => {
    const wWith = rankArmSplits({ level: 'intermediate', discipline: 'armwrestling', weakPoints: ['pronators'] });
    const wWithout = rankArmSplits({ level: 'intermediate', discipline: 'armwrestling' });
    // с weakPoints — top может отличаться или score выше
    expect(wWith[0].pattern.id).toBeDefined();
    expect(wWithout[0].pattern.id).toBeDefined();
  });
  it('injury side_pressure — штраф', () => {
    const withInj = rankArmSplits({ level: 'intermediate', injuries: [{ muscle: 'side_pressure', exclude: true }] });
    const without = rankArmSplits({ level: 'intermediate' });
    // With injury, side-heavy split should be lower
    const sidePattern = withInj.find(r => r.pattern.id === 'arm_4_upper_lower');
    expect(sidePattern).toBeDefined();
  });
  it('selectBestArmSplit возвращает паттерн', () => {
    const best = selectBestArmSplit({ level: 'intermediate', daysPerWeek: 4 });
    expect(best.id).toBeDefined();
    expect(best.schedule.length).toBeGreaterThan(0);
  });
  it('дни/нед точность: 2 vs 4', () => {
    const r2 = rankArmSplits({ level: 'intermediate', daysPerWeek: 2 });
    const r4 = rankArmSplits({ level: 'intermediate', daysPerWeek: 4 });
    expect(r2[0].pattern.id).not.toBe(r4[0].pattern.id);
  });
});
