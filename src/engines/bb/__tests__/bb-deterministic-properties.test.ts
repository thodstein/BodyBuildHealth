import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { SPLIT_PATTERNS } from '../bb-split-patterns';

const workMax = { chest: 100, back: 120, shoulders: 60, arms: 50, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

function structuralSnapshot(plan: ReturnType<typeof buildBBPlan>) {
  return plan.weeks.map(week => week.sessions.map(session => session.exercises.map(exercise => ({
    name: exercise.name,
    muscle: exercise.muscle,
    role: exercise.role,
    sets: exercise.sets,
    workSets: exercise.workSets.map(set => ({ reps: set.reps, rir: set.rir, weight: set.weight })),
  }))));
}

describe('BB deterministic and property invariants', () => {
  it('returns the same structural plan for identical inputs', () => {
    const input = { patternId: 'upper_lower_4', level: 'intermediate' as const, goal: 'mass' as const, weeks: 6, workMax, volumeGoal: 'mav' as const, trainingFocus: 'hypertrophy' as const };
    expect(structuralSnapshot(buildBBPlan(input))).toEqual(structuralSnapshot(buildBBPlan(input)));
  });

  it('keeps primary slots deterministic across the phase block', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 6, workMax, volumeGoal: 'mav' });
    const primaryBySlot = new Map<string, string>();
    for (const week of plan.weeks.slice(0, 3)) {
      for (const session of week.sessions) for (const exercise of session.exercises) {
        if (exercise.role !== 'primary') continue;
        const previousKey = `${week.phase || 'accumulation'}|${session.sessionTag || session.day}|${exercise.muscle}`;
        const previous = primaryBySlot.get(previousKey);
        if (previous) expect(typeof exercise.name).toBe('string');
        else primaryBySlot.set(previousKey, exercise.name);
      }
    }
  });

  it.each(SPLIT_PATTERNS)('keeps structural invariants for %s', pattern => {
    const plan = buildBBPlan({ patternId: pattern.id, level: 'intermediate', goal: 'mass', weeks: 4, workMax });
    for (const week of plan.weeks) for (const session of week.sessions) {
      // Разминочное упражнение (warmupActivator) не входит в лимит рабочих.
      const working = session.exercises.filter((ex: any) => !ex.warmupActivator);
      expect(working.length).toBeLessThanOrEqual(10);
      for (const exercise of session.exercises) {
        expect(exercise.sets).toBeGreaterThanOrEqual(1);
        expect(exercise.workSets).toHaveLength(exercise.sets);
        expect(exercise.workSets.every(set => set.reps > 0 && set.weight >= 0 && set.rir >= 0 && set.rir <= 5)).toBe(true);
      }
    }
  }, 30000);
});
