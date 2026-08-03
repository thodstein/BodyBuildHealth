import { describe, expect, it } from 'vitest';
import { convertCycleToBBPlan, programToBBPlan } from '../cycle-to-plan';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';
import type { FullProgram } from '../../complete-program-library.engine';

const workMax = { chest: 100, back: 120, shoulders: 60, arms: 50, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

const cycle: SRCycleTemplate = {
  meta: {
    id: 'det-bb-cycle', title: 'Deterministic BB cycle', direction: 'bodybuilding', level: 'intermediate', period: 'mass',
    sessionsPerWeek: 2, weeks: 4, correctionPct: 0.005,
  },
  week1: [
    { exercises: [{ name: 'Жим штанги лёжа', group: 'Грудь', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.7, reps: 8, sets: 3, rir: 2 }] }] },
    { exercises: [{ name: 'Присед со штангой', group: 'Ноги', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.7, reps: 8, sets: 3, rir: 2 }] }] },
  ],
};

const program: FullProgram = {
  id: 'det-bb-program', name: 'Deterministic BB program', author: 'test', type: 'bodybuilding', goal: 'bodybuilding', direction: 'bodybuilding', level: 'intermediate', durationWeeks: 4, daysPerWeek: 2, sessionTimeMin: '60', description: '', targetAudience: '', equipmentNeeded: [],
  weeks: [
    { week: 1, phase: 'accumulation', volumeMultiplier: 1, intensityMultiplier: 1, deload: false, days: [
      { day: 1, name: 'Chest', focus: 'chest', warmup: '', exercises: [{ name: 'Жим штанги лёжа', sets: 3, reps: '8', rir: 2 }] },
      { day: 2, name: 'Legs', focus: 'legs', warmup: '', exercises: [{ name: 'Гакк-присед', sets: 3, reps: '10', rir: 2 }] },
    ] },
  ],
  progressionModel: '', deloadProtocol: '', customization: [], warnings: [], expectedResults: '',
};

type AnyPlan = ReturnType<typeof convertCycleToBBPlan>;

function snapshot(plan: AnyPlan) {
  return plan.weeks.map(week => week.sessions.map(session => session.exercises.map(exercise => ({
    name: exercise.name,
    muscle: exercise.muscle,
    role: exercise.role,
    sets: exercise.sets,
    workSets: exercise.workSets.map(set => ({ reps: set.reps, rir: set.rir, weight: set.weight })),
  }))));
}

function structuralInvariants(plan: AnyPlan) {
  for (const week of plan.weeks) for (const session of week.sessions) {
    expect(session.exercises.length).toBeLessThanOrEqual(10);
    for (const exercise of session.exercises) {
      expect(exercise.sets).toBeGreaterThanOrEqual(1);
      expect(exercise.workSets).toHaveLength(exercise.sets);
      expect(exercise.workSets.every(set => set.reps > 0 && set.weight >= 0 && set.rir >= 0 && set.rir <= 5)).toBe(true);
    }
  }
}

describe('BB cycle/program deterministic properties', () => {
  it('cycle adapt: identical structural output for identical inputs', () => {
    const opts = { cycle, workMax, level: 'intermediate', mode: 'adapt' as const, weakPoints: ['chest'] };
    expect(snapshot(convertCycleToBBPlan(opts))).toEqual(snapshot(convertCycleToBBPlan(opts)));
  });

  it('cycle faithful: identical structural output for identical inputs', () => {
    const opts = { cycle, workMax, level: 'intermediate', mode: 'faithful' as const };
    expect(snapshot(convertCycleToBBPlan(opts))).toEqual(snapshot(convertCycleToBBPlan(opts)));
  });

  it('program adapt: identical structural output for identical inputs', () => {
    const opts = { workMax, level: 'intermediate', mode: 'adapt' as const };
    expect(snapshot(programToBBPlan(program, opts))).toEqual(snapshot(programToBBPlan(program, opts)));
  });

  it('program faithful: identical structural output for identical inputs', () => {
    const opts = { workMax, level: 'intermediate', mode: 'faithful' as const };
    expect(snapshot(programToBBPlan(program, opts))).toEqual(snapshot(programToBBPlan(program, opts)));
  });

  it('cycle adapt: structural invariants hold', () => {
    structuralInvariants(convertCycleToBBPlan({ cycle, workMax, level: 'intermediate', mode: 'adapt' }));
  });

  it('cycle faithful: structural invariants hold', () => {
    structuralInvariants(convertCycleToBBPlan({ cycle, workMax, level: 'intermediate', mode: 'faithful' }));
  });

  it('program adapt: structural invariants hold', () => {
    structuralInvariants(programToBBPlan(program, { workMax, level: 'intermediate', mode: 'adapt' }));
  });

  it('program faithful: structural invariants hold', () => {
    structuralInvariants(programToBBPlan(program, { workMax, level: 'intermediate', mode: 'faithful' }));
  });

  it('cycle adapt: primary exercise name is deterministic across first 3 weeks', () => {
    const plan = convertCycleToBBPlan({ cycle, workMax, level: 'intermediate', mode: 'adapt' });
    const primaryBySlot = new Map<string, string>();
    for (const week of plan.weeks.slice(0, 3)) {
      for (const session of week.sessions) for (const exercise of session.exercises) {
        if (exercise.role !== 'primary') continue;
        const key = `${week.phase || 'accumulation'}|${session.sessionTag || session.day}|${exercise.muscle}`;
        const previous = primaryBySlot.get(key);
        if (previous) expect(exercise.name).toBe(previous);
        else primaryBySlot.set(key, exercise.name);
      }
    }
  });

  it('program faithful: preserves source exercise names', () => {
    const plan = programToBBPlan(program, { workMax, level: 'intermediate', mode: 'faithful' });
    const names = plan.weeks[0].sessions.flatMap(s => s.exercises.map(e => e.name));
    expect(names).toContain('Жим штанги лёжа');
    expect(names).toContain('Гакк-присед');
  });
});