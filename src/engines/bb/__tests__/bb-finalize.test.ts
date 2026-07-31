import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';

function plan(workSets: number, sets: number) {
  return {
    pattern: {} as any,
    weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж' as const, sessionTag: 'Chest', exercises: [{
      muscle: 'chest', name: 'Жим лёжа', role: 'primary' as const, character: 'тяж' as const,
      sets, repsRange: [6, 8] as [number, number], rir: 2,
      workSets: Array.from({ length: workSets }, () => ({ reps: 8, rir: 2, weight: 80 })),
    }] }] }],
    rotationMuscleVolume: {}, rationale: [],
  };
}

describe('BB shared finalizer', () => {
  it('syncs sets and workSets for faithful converter output', () => {
    const result = finalizeBBPlan(plan(3, 2), { reorder: false, level: 'intermediate' });
    expect(result.weeks[0].sessions[0].exercises[0].workSets).toHaveLength(2);
    expect(result.volumeTargets).toBeTruthy();
  });

  it('applies the same order path when adapt mode requests reorder', () => {
    const result = finalizeBBPlan(plan(2, 2), { reorder: true });
    expect(result.weeks[0].sessions[0].exercises[0].name).toMatch(/жим/i);
  });

  it('reduces adaptive deload volume and raises RIR', () => {
    const source: any = plan(4, 4);
    source.weeks.push({
      week: 2,
      sessions: [{
        day: 1, weekOffset: 2, character: 'лёг', sessionTag: 'Chest',
        exercises: [{ ...source.weeks[0].sessions[0].exercises[0], character: 'лёг', sets: 4, comment: 'Разгрузка' }],
      }],
    });
    const result = finalizeBBPlan(source, { reorder: false, phaseSafety: true, level: 'intermediate' });
    const deload = result.weeks[1].sessions[0].exercises[0];
    expect(deload.sets).toBe(3);
    expect(deload.rir).toBeGreaterThanOrEqual(3);
  });

  it('stores rotation diagnostics in the final BBPlan contract', () => {
    const result = finalizeBBPlan(plan(2, 2), { reorder: true, level: 'intermediate' });
    expect(result.rotationReport).toBeTruthy();
    expect(result.rotationReport?.primaryByMuscle).toBeTruthy();
  });

  it('stores weekly fatigue diagnostics in the final BBPlan contract', () => {
    const result = finalizeBBPlan(plan(2, 2), { reorder: true, level: 'intermediate' });
    expect(result.fatigueReport?.[0].sessions[0].timeSeconds).toBeGreaterThan(0);
    expect(result.fatigueReport?.[0].sessions[0].exerciseCount).toBe(1);
  });

  it('stores final validation status and issues', () => {
    const result = finalizeBBPlan(plan(2, 2), { reorder: true, level: 'intermediate' });
    expect(result.validation?.valid).toBe(true);
    expect(result.validation?.issues).toBeDefined();
  });

  it('detects deload from week phase even when exercises have no deload comment', () => {
    const source: any = plan(4, 4);
    source.weeks.push({
      week: 2,
      phase: 'deload',
      deload: true,
      sessions: [{
        day: 1, weekOffset: 2, character: 'тяж', sessionTag: 'Chest',
        exercises: [{ ...source.weeks[0].sessions[0].exercises[0], sets: 4, character: 'тяж', comment: '' }],
      }],
    });
    const result = finalizeBBPlan(source, { reorder: false, phaseSafety: true, level: 'intermediate' });
    expect(result.weeks[1].sessions[0].exercises[0].sets).toBe(3);
    expect(result.weeks[1].sessions[0].exercises[0].rir).toBeGreaterThanOrEqual(3);
  });

  it('is idempotent for repeated adaptive finalization', () => {
    const source: any = plan(2, 2);
    source.weeks[0].phase = 'accumulation';
    const options = { reorder: true, ensureMinimumVolume: true, controlledRotation: true, phaseSafety: true, level: 'intermediate', workMax: { chest: 100 } } as const;
    const once = finalizeBBPlan(source, options);
    const twice = finalizeBBPlan(once, options);
    const firstNames = once.weeks.flatMap(week => week.sessions.flatMap(session => session.exercises.map(exercise => exercise.name)));
    const secondNames = twice.weeks.flatMap(week => week.sessions.flatMap(session => session.exercises.map(exercise => exercise.name)));
    expect(secondNames).toEqual(firstNames);
    expect(twice.weeks.flatMap(week => week.sessions).every(session => session.exercises.length <= 10)).toBe(true);
  });

  it('preserves persisted safety constraints when re-finalized without options', () => {
    const source: any = plan(2, 2);
    source.safetyConstraints = { equipment: ['machine'], avoidAxialLoad: true };
    const result = finalizeBBPlan(source, { reorder: false, level: 'intermediate' });
    expect(result.safetyConstraints).toEqual({ equipment: ['machine'], avoidAxialLoad: true });
  });
});
