import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';
import { EXERCISE_CATALOG } from '../../../core/exercise-catalog';

const exercise = (name: string) => ({
  muscle: 'chest', name, exerciseName: name, role: 'accessory' as const, character: 'памп' as const,
  sets: 2, repsRange: [12, 15] as [number, number], rir: 3,
  workSets: [{ reps: 12, rir: 3, weight: 20 }, { reps: 12, rir: 3, weight: 20 }],
});

describe('BB controlled accessory rotation', () => {
  it('changes repeated adaptive accessories while preserving structure', () => {
    const plan: any = {
      pattern: {}, weeks: [
        { week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'памп', sessionTag: 'Chest', exercises: [exercise('Разводка гантелей лёжа')] }] },
        { week: 2, sessions: [{ day: 1, weekOffset: 2, character: 'памп', sessionTag: 'Chest', exercises: [exercise('Разводка гантелей лёжа')] }] },
      ], rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: true, controlledRotation: true, level: 'intermediate' });
    expect(result.weeks[0].sessions[0].exercises[0].name).not.toBe(result.weeks[1].sessions[0].exercises[0].name);
    expect(result.weeks[1].sessions[0].exercises[0].workSets).toHaveLength(2);
  });

  it('does not rotate when controlled rotation is disabled', () => {
    const plan: any = {
      pattern: {}, weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'памп', sessionTag: 'Chest', exercises: [exercise('Разводка гантелей лёжа')] }] }], rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: true, controlledRotation: false, level: 'intermediate' });
    expect(result.weeks[0].sessions[0].exercises[0].name).toBe('Разводка гантелей лёжа');
  });

  it('prefers phase-appropriate equipment for adaptive replacement', () => {
    const plan: any = {
      pattern: {}, weeks: [
        { week: 1, phase: 'accumulation', sessions: [{ day: 1, weekOffset: 1, character: 'памп', sessionTag: 'Chest', exercises: [exercise('Разводка гантелей лёжа')] }] },
        { week: 2, phase: 'accumulation', sessions: [{ day: 1, weekOffset: 2, character: 'памп', sessionTag: 'Chest', exercises: [exercise('Разводка гантелей лёжа')] }] },
      ], rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: true, controlledRotation: true, level: 'intermediate' });
    expect(/кроссовер|тренажёр|тренажер|машин/i.test(result.weeks[1].sessions[0].exercises[0].name)).toBe(true);
  });

  it('does not select unavailable equipment during rotation', () => {
    const plan: any = {
      pattern: {}, weeks: [
        { week: 1, phase: 'accumulation', sessions: [{ day: 1, weekOffset: 1, character: 'памп', sessionTag: 'Chest', exercises: [exercise('Разводка гантелей лёжа')] }] },
        { week: 2, phase: 'accumulation', sessions: [{ day: 1, weekOffset: 2, character: 'памп', sessionTag: 'Chest', exercises: [exercise('Разводка гантелей лёжа')] }] },
      ], rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: true, controlledRotation: true, equipment: ['dumbbell'], level: 'intermediate' });
    const selected = EXERCISE_CATALOG.find(item => item.name === result.weeks[1].sessions[0].exercises[0].name);
    expect(selected?.equipment).toBe('dumbbell');
  });

  it('adjusts working weight when replacement equipment changes', () => {
    const plan: any = {
      pattern: {}, weeks: [
        { week: 1, phase: 'accumulation', sessions: [{ day: 1, weekOffset: 1, character: 'памп', sessionTag: 'Chest', exercises: [exercise('Разводка гантелей лёжа')] }] },
        { week: 2, phase: 'accumulation', sessions: [{ day: 1, weekOffset: 2, character: 'памп', sessionTag: 'Chest', exercises: [exercise('Разводка гантелей лёжа')] }] },
      ], rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: true, controlledRotation: true, equipment: ['machine'], level: 'intermediate' });
    const rotated = result.weeks[1].sessions[0].exercises[0];
    expect(rotated.workSets[0].weight).toBeGreaterThan(20);
    expect(rotated.comment).toMatch(/вес скорректирован/);
  });

  it('respects excluded exercises and axial-load restriction', () => {
    const plan: any = {
      pattern: {}, weeks: [
        { week: 1, phase: 'intensification', sessions: [{ day: 1, weekOffset: 1, character: 'тяж', sessionTag: 'Chest', exercises: [exercise('Разводка гантелей лёжа')] }] },
        { week: 2, phase: 'intensification', sessions: [{ day: 1, weekOffset: 2, character: 'тяж', sessionTag: 'Chest', exercises: [exercise('Разводка гантелей лёжа')] }] },
      ], rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, {
      reorder: true, controlledRotation: true, level: 'intermediate',
      excludedExercises: ['fly_db'], avoidAxialLoad: true,
    });
    expect(result.weeks[1].sessions[0].exercises[0].name).not.toBe('Разводка гантелей лёжа');
    expect(result.weeks[1].sessions[0].exercises[0].name).not.toMatch(/присед|станов|румын|наклон.*штанг/i);
  });

  it('does not rotate into an excluded injury muscle', () => {
    const plan: any = {
      pattern: {}, weeks: [
        { week: 1, phase: 'accumulation', sessions: [{ day: 1, weekOffset: 1, character: 'памп', sessionTag: 'Chest', exercises: [exercise('Разводка гантелей лёжа')] }] },
        { week: 2, phase: 'accumulation', sessions: [{ day: 1, weekOffset: 2, character: 'памп', sessionTag: 'Chest', exercises: [exercise('Разводка гантелей лёжа')] }] },
      ], rotationMuscleVolume: {}, rationale: [],
    };
    const result = finalizeBBPlan(plan, { reorder: true, controlledRotation: true, level: 'intermediate', excludedMuscles: ['chest'] });
    expect(result.weeks[1].sessions[0].exercises[0].name).toBe('Разводка гантелей лёжа');
  });
});
