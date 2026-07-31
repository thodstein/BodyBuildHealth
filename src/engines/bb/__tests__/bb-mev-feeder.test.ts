import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';

const exercise = (name: string) => ({
  muscle: 'chest', name, exerciseName: name, role: 'primary' as const, character: 'тяж' as const,
  sets: 2, repsRange: [8, 10] as [number, number], rir: 2,
  workSets: [{ reps: 8, rir: 2, weight: 60 }, { reps: 8, rir: 2, weight: 60 }],
});

describe('BB adaptive MEV coverage', () => {
  it('adds a feeder only to an existing muscle day', () => {
    const plan: any = {
      pattern: {}, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Chest', exercises: [exercise('Жим лёжа')] }] }],
      rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: true, ensureMinimumVolume: true, level: 'intermediate', workMax: { chest: 100 } });
    expect(result.weeks[0].sessions[0].exercises.some(ex => ex.rationale?.includes('Adaptive MEV coverage feeder'))).toBe(true);
  });

  it('does not add feeders in faithful mode when disabled', () => {
    const plan: any = {
      pattern: {}, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Chest', exercises: [exercise('Жим лёжа')] }] }],
      rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: false, ensureMinimumVolume: false, level: 'intermediate' });
    expect(result.weeks[0].sessions[0].exercises).toHaveLength(1);
  });

  it('covers each working week but skips deload', () => {
    const source = (week: number, phase: string) => ({
      week, phase, sessions: [{ day: 1, weekOffset: week, character: 'тяж' as const, sessionTag: 'Chest', exercises: [exercise('Жим лёжа')] }],
    });
    const plan: any = { pattern: {}, weeks: [source(1, 'accumulation'), source(2, 'accumulation'), source(3, 'deload')], rotationMuscleVolume: {}, rationale: [] };
    const result = finalizeBBPlan(plan, { reorder: true, ensureMinimumVolume: true, level: 'intermediate', workMax: { chest: 100 } });
    expect(result.weeks[0].sessions[0].exercises.some(ex => ex.rationale?.includes('Adaptive MEV coverage feeder'))).toBe(true);
    expect(result.weeks[1].sessions[0].exercises.some(ex => ex.rationale?.includes('Adaptive MEV coverage feeder'))).toBe(true);
    expect(result.weeks[1].sessions[0].exercises.find(ex => ex.rationale?.includes('Adaptive MEV coverage feeder'))?.workSets[0].weight).toBe(30);
    const feeder = result.weeks[1].sessions[0].exercises.find(ex => ex.rationale?.includes('Adaptive MEV coverage feeder'))!;
    expect(feeder.sets).toBe(feeder.workSets.length);
    expect(result.weeks[1].sessions[0].exercises.length).toBeLessThanOrEqual(10);
    expect(result.fatigueReport?.[1].sessions[0].timeSeconds).toBeGreaterThan(0);
    expect(result.weeks[2].sessions[0].exercises.some(ex => ex.rationale?.includes('Adaptive MEV coverage feeder'))).toBe(false);
  });

  it('does not add a feeder when indirect compound volume already reaches MEV', () => {
    const plan: any = {
      pattern: {}, weeks: [{ week: 1, phase: 'accumulation', sessions: [{
        day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Chest', exercises: Array.from({ length: 4 }, (_, index) => ({
          muscle: 'chest', name: index === 0 ? 'Жим лёжа' : `Жим лёжа ${index}`, role: 'primary', character: 'тяж', sets: 2,
          repsRange: [6, 8], rir: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }],
        })),
      }] }], rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: true, ensureMinimumVolume: true, level: 'intermediate', workMax: { chest: 100 } });
    expect(result.weeks[0].sessions[0].exercises.some(ex => ex.rationale?.includes('Adaptive MEV coverage feeder'))).toBe(false);
  });

  it('uses multiple safe feeders when a large deficit remains below MEV', () => {
    const plan: any = {
      pattern: {}, weeks: [{ week: 1, phase: 'accumulation', sessions: [{
        day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Chest', exercises: [exercise('Жим лёжа')],
      }] }], rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: true, ensureMinimumVolume: true, level: 'intermediate', workMax: { chest: 100 } });
    const feeders = result.weeks[0].sessions[0].exercises.filter(ex => ex.rationale?.includes('Adaptive MEV coverage feeder'));
    expect(feeders.length).toBeGreaterThan(0);
    expect(feeders.reduce((sum, feeder) => sum + feeder.sets, 0)).toBeGreaterThanOrEqual(2);
    expect(result.weeks[0].sessions[0].exercises.length).toBeLessThanOrEqual(10);
  });

  it('respects volume target max sets per session', () => {
    const plan: any = {
      pattern: {}, weeks: [{ week: 1, phase: 'accumulation', sessions: [{
        day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Chest', exercises: [exercise('Жим лёжа')],
      }] }],
      volumeTargets: { chest: { muscle: 'chest', frequency: 2, mev: 8, mav: 12, mrv: 16, targetSets: 10, minSetsPerSession: 2, maxSetsPerSession: 2, rationale: [] } },
      rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: true, ensureMinimumVolume: true, level: 'intermediate', workMax: { chest: 100 } });
    const feeders = result.weeks[0].sessions[0].exercises.filter(ex => ex.rationale?.includes('Adaptive MEV coverage feeder'));
    expect(feeders).toHaveLength(0);
  });
});
