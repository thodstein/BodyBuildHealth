import { describe, expect, it } from 'vitest';
import { programToBBPlan } from '../cycle-to-plan';
import type { FullProgram } from '../../complete-program-library.engine';

const program: FullProgram = {
  id: 'fatigue-faithful', name: 'Fatigue faithful', author: 'test', type: 'bodybuilding', goal: 'bodybuilding', direction: 'bodybuilding', level: 'intermediate', durationWeeks: 1, daysPerWeek: 1, sessionTimeMin: '60', description: '', targetAudience: '', equipmentNeeded: [],
  weeks: [{ week: 1, phase: 'accumulation', volumeMultiplier: 1, intensityMultiplier: 1, deload: false, days: [{ day: 1, name: 'Chest', focus: 'chest', warmup: '', exercises: [
    { name: 'Жим штанги лёжа', sets: 4, reps: '8', rir: 2 },
    { name: 'Разводка гантелей', sets: 5, reps: '15', rir: 2 },
    { name: 'Кроссовер', sets: 5, reps: '15', rir: 2 },
  ] }] }],
  progressionModel: '', deloadProtocol: '', customization: [], warnings: [], expectedResults: '',
};

describe('BB all modes safety pipeline', () => {
  it('applies fatigue budget to faithful FullProgram output', () => {
    const plan = programToBBPlan(program, { workMax: { chest: 100 }, level: 'intermediate', mode: 'faithful' });
    const session = plan.weeks[0].sessions[0];
    expect(session.exercises.some(exercise => exercise.role === 'primary')).toBe(true);
    expect(session.exercises.reduce((sum, exercise) => sum + exercise.sets, 0)).toBeLessThanOrEqual(14);
    expect(plan.validation).toBeTruthy();
    expect(plan.fatigueReport?.[0].sessions[0].timeSeconds).toBeLessThanOrEqual(100 * 60);
  });
});
