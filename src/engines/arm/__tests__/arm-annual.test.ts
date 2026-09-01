import { describe, it, expect } from 'vitest';
import { buildArmBlock } from '../arm-annual';
import { directionFromKinds } from '../../annual-training/block-builders.engine';
import { armPlanToSessions } from '../../training-integration.engine';
import { buildArmPlan } from '../arm-builder.engine';

describe('arm-annual', () => {
  it('buildArmBlock: 4 недели', () => {
    const res = buildArmBlock({ blockKey: 'test', weeks: 4, phase: 'strength' }, { level: 'intermediate' } as any);
    expect(res.weeks.length).toBe(4);
    expect(res.kind).toBe('ARM');
    expect(res.weeks[0].sessions.length).toBeGreaterThan(0);
  });
  it('taperApplied', () => {
    const res = buildArmBlock({ blockKey: 'taper', weeks: 4, phase: 'peaking' }, { level: 'intermediate', taperEnabled: true, taperWeeks: 2 } as any);
    expect(res.taperApplied).toBe(true);
  });
  it('directionFromKinds ARM', () => {
    expect(directionFromKinds(['ARM'] as any)).toBe('arm');
    expect(directionFromKinds(['PL','ARM'] as any)).toBe('mixed');
    expect(directionFromKinds(['BB','ARM'] as any)).toBe('mixed');
  });
  it('armPlanToSessions', () => {
    const plan: any = buildArmPlan({ discipline:'armwrestling', patternId:'arm_3_full', level:'intermediate', goal:'strength', technique:'balanced', weeks:2 });
    const sessions = armPlanToSessions(plan);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0].source).toBe('ARM');
    expect(sessions[0].exercises.length).toBeGreaterThan(0);
  });
});
