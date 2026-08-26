import { describe, expect, it } from 'vitest';
import { convertCycleToBBPlan, programToBBPlan } from '../cycle-to-plan';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import type { FullProgram } from '../../complete-program-library.engine';
import { validateBBPlan } from '../bb-validator.engine';

const workMax = { chest: 100, back: 120, shoulders: 60, arms: 50, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

const cycle: SRCycleTemplate = {
  meta: {
    id: 'test-bb-cycle', title: 'Test BB cycle', direction: 'bodybuilding', level: 'intermediate', period: 'mass',
    sessionsPerWeek: 2, weeks: 2, correctionPct: 0.005,
  },
  week1: [
    { exercises: [{ name: 'Жим штанги лёжа', group: 'Грудь', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.7, reps: 8, sets: 3, rir: 2 }] }] },
    { exercises: [{ name: 'Присед со штангой', group: 'Ноги', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.7, reps: 8, sets: 3, rir: 2 }] }] },
  ],
};

const program: FullProgram = {
  id: 'test-bb-program', name: 'Test BB program', author: 'test', type: 'bodybuilding', goal: 'bodybuilding', direction: 'bodybuilding', level: 'intermediate', durationWeeks: 2, daysPerWeek: 2, sessionTimeMin: '60', description: '', targetAudience: '', equipmentNeeded: [],
  weeks: [{ week: 1, phase: 'accumulation', volumeMultiplier: 1, intensityMultiplier: 1, deload: false, days: [{ day: 1, name: 'Chest', focus: 'chest', warmup: '', exercises: [{ name: 'Жим штанги лёжа', sets: 3, reps: '8', rir: 2 }] }, { day: 2, name: 'Legs', focus: 'legs', warmup: '', exercises: [{ name: 'Гакк-присед', sets: 3, reps: '10', rir: 2 }] }] }],
  progressionModel: '', deloadProtocol: '', customization: [], warnings: [], expectedResults: '',
};

function expectValid(plan: ReturnType<typeof convertCycleToBBPlan>) {
  const result = validateBBPlan(plan);
  expect(result.issues.filter(i => i.level === 'error')).toHaveLength(0);
  expect(plan.volumeTargets).toBeTruthy();
  expect(plan.balanceReport).toBeTruthy();
  for (const week of plan.weeks) for (const session of week.sessions) for (const exercise of session.exercises) {
    expect(exercise.workSets).toHaveLength(exercise.sets);
    // Разминочное упражнение не проходит enrich (добавляется последним) — skip.
    if (!(exercise as any).warmupActivator) expect(exercise.rationale).toContain('позиция в сессии:');
  }
}

describe('BB all generation paths', () => {
  it('finalizes professional cycle in adapt and faithful modes', () => {
    expectValid(convertCycleToBBPlan({ cycle, workMax, level: 'intermediate', mode: 'adapt', weakPoints: ['chest'] }));
    expectValid(convertCycleToBBPlan({ cycle, workMax, level: 'intermediate', mode: 'faithful' }));
  });

  it('finalizes FullProgram in adapt and faithful modes', () => {
    expectValid(programToBBPlan(program, { workMax, level: 'intermediate', mode: 'adapt' }));
    expectValid(programToBBPlan(program, { workMax, level: 'intermediate', mode: 'faithful' }));
  });
});
