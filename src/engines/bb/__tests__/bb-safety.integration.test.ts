import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { validateBBPlan } from '../bb-validator.engine';
import { convertCycleToBBPlan } from '../cycle-to-plan';
import { SPLIT_PATTERNS } from '../bb-split-patterns';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';

const workMax = { chest: 100, back: 120, shoulders: 60, arms: 50, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

const constraints = { equipment: ['machine'], avoidAxialLoad: true };

function expectSafe(plan: any) {
  const result = validateBBPlan(plan, constraints);
  const blocking = result.issues.filter((issue: any) => issue.level === 'error');
  expect(blocking, blocking.map((issue: any) => issue.message).join('\n')).toHaveLength(0);
}

describe('BB safety integration', () => {
  it('generic machine-only plan respects safety constraints', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4,
      workMax, equipment: constraints.equipment, avoidAxialLoad: constraints.avoidAxialLoad,
    });
    expectSafe(plan);
  }, 30000);

  it.each(SPLIT_PATTERNS.map(pattern => pattern.id))('all generic splits respect safety: %s', (patternId) => {
    const plan = buildBBPlan({
      patternId, level: 'intermediate', goal: 'mass', weeks: 2,
      workMax, equipment: constraints.equipment, avoidAxialLoad: constraints.avoidAxialLoad,
    });
    expectSafe(plan);
  }, 30000);

  it('professional cycle adapt path respects safety constraints', () => {
    const cycle: SRCycleTemplate = {
      meta: { id: 'safety-cycle', title: 'Safety cycle', direction: 'bodybuilding', level: 'intermediate', period: 'mass', sessionsPerWeek: 2, weeks: 2, correctionPct: 0.005 },
      week1: [
        { exercises: [{ name: 'Жим штанги лёжа', group: 'Грудь', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.7, reps: 8, sets: 3, rir: 2 }] }] },
        { exercises: [{ name: 'Присед со штангой', group: 'Ноги', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.7, reps: 8, sets: 3, rir: 2 }] }] },
      ],
    };
    const plan = convertCycleToBBPlan({ cycle, workMax, level: 'intermediate', mode: 'adapt', equipment: constraints.equipment, avoidAxialLoad: constraints.avoidAxialLoad });
    expectSafe(plan);
  });

  it('adapt repairs an unknown exercise when equipment is restricted', () => {
    const plan: any = buildBBPlan({
      patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 2,
      workMax, equipment: constraints.equipment, avoidAxialLoad: constraints.avoidAxialLoad,
    });
    plan.weeks[0].sessions[0].exercises[0].name = 'Неизвестное упражнение';
    plan.weeks[0].sessions[0].exercises[0].exerciseName = 'Неизвестное упражнение';
    const result = validateBBPlan(plan, constraints);
    expect(result.valid).toBe(false);
  });
});
