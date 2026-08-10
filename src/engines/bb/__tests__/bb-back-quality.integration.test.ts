import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { classifyBackExercise } from '../bb-back-quality.engine';

const WM = {
  chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 100,
  glutes: 140, biceps: 50, triceps: 60, calves: 80, traps: 70, forearms: 45,
};

describe('experienced enhanced back prescription', () => {
  it('distributes a real high-volume back block across both Upper sessions', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6,
      goal: 'mass', weeks: 1, workMax: WM,
      pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
    });
    const uppers = plan.weeks[0].sessions.filter(s => s.sessionTag === 'Upper');
    expect(uppers).toHaveLength(2);
    for (const session of uppers) {
      const back = session.exercises.filter(e => e.muscle === 'back');
      expect(back.reduce((sum, e) => sum + e.sets, 0)).toBeGreaterThanOrEqual(18);
      expect(new Set(back.map(e => classifyBackExercise(e.name).pattern)).size).toBeGreaterThanOrEqual(3);
      expect(back.filter(e => classifyBackExercise(e.name).pattern === 'vertical_pull')).toHaveLength(1);
    }
  }, 30000);

  it.each(['ppl_6', 'push_pull_2'] as const)('keeps every Pull session high-volume: %s', (patternId) => {
    const plan = buildBBPlan({
      patternId, level: 'enhanced', trainingYears: 6,
      goal: 'mass', weeks: 1, workMax: WM,
      pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
    });
    const pulls = plan.weeks[0].sessions.filter(s => s.sessionTag === 'Pull');
    expect(pulls.length).toBeGreaterThanOrEqual(2);
    for (const session of pulls) {
      const back = session.exercises.filter(e => e.muscle === 'back');
      expect(back.reduce((sum, e) => sum + e.sets, 0)).toBeGreaterThanOrEqual(18);
      expect(back.filter(e => classifyBackExercise(e.name).pattern === 'vertical_pull').length).toBeLessThanOrEqual(1);
    }
  }, 30000);

  it('does not apply the high-volume allocation to natural plans', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM });
    const upper = plan.weeks[0].sessions.find(s => s.sessionTag === 'Upper')!;
    const backSets = upper.exercises.filter(e => e.muscle === 'back').reduce((sum, e) => sum + e.sets, 0);
    expect(backSets).toBeLessThan(18);
  }, 30000);
});
