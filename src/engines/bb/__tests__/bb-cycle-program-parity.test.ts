/**
 * cycle-to-plan — паритет goal/sex с generic-путём.
 *
 * Регрессия: `finalizeBBPlan` получал `methodology`, но не `goal`/`sex`.
 * Из-за этого adapt-путь циклов и программ:
 *  - не поднимал ПЛ-специфику вперёд для strength_mass;
 *  - не включал женские минимумы/female-проходы финалайзера.
 */
import { describe, expect, it } from 'vitest';
import { getCyclesByDirection } from '../../../data/lms-cycles/lms-cycle-index';
import { cycleTemplateToFullProgram, convertCycleToBBPlan, programToBBPlan } from '../cycle-to-plan';

const WM = {
  chest: 102.7, back: 121.3, shoulders: 61.7, quads: 141.3, hamstrings: 101.7,
  glutes: 141.3, biceps: 51.7, triceps: 61.7, calves: 81.7, traps: 71.7, forearms: 41.7,
};

function workNames(plan: any): string[] {
  return plan.weeks[0].sessions[0].exercises
    .filter((e: any) => !e.warmupActivator)
    .map((e: any) => e.name);
}

function cycleWithBenchPause(): any {
  const source = getCyclesByDirection('bodybuilding').find(c => c.meta.id === 'cycle-bb-03');
  if (!source) throw new Error('cycle-bb-03 не найден');
  const cycle: any = JSON.parse(JSON.stringify(source));
  cycle.week1[0].exercises = [
    { name: 'Жим штанги лёжа', group: 'Грудь', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.7, reps: 6, sets: 4, rir: 2 }] },
    { name: 'Жим с паузой', group: 'Грудь', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.7, reps: 6, sets: 4, rir: 2 }] },
  ];
  return cycle;
}

function programWithBenchPause(): any {
  const source = getCyclesByDirection('bodybuilding').find(c => c.meta.id === 'cycle-bb-03');
  if (!source) throw new Error('cycle-bb-03 не найден');
  const base = cycleTemplateToFullProgram(source);
  const program: any = JSON.parse(JSON.stringify(base));
  const day = JSON.parse(JSON.stringify(program.weeks[0].days[0]));
  day.focus = 'Грудь';
  day.exercises = [
    { name: 'Жим штанги лёжа', sets: 4, reps: '6', rpe: 7, rir: 2, restSec: 180 },
    { name: 'Жим с паузой', sets: 4, reps: '6', rpe: 7, rir: 2, restSec: 180 },
  ];
  program.weeks = [{ ...program.weeks[0], week: 1, days: [day] }];
  program.durationWeeks = 1;
  program.daysPerWeek = 1;
  return program;
}

const ORDER_OPTS = {
  workMax: WM, level: 'intermediate', trainingYears: 3, mode: 'adapt',
  methodology: 'compound_first',
} as const;

describe('cycle-to-plan: goal/sex доезжают до finalize', () => {
  it('convert-путь: strength_mass ставит ПЛ-специфику раньше обычного жима', () => {
    const cycle = cycleWithBenchPause();
    const mass = convertCycleToBBPlan({ ...ORDER_OPTS, cycle, goal: 'mass' } as any);
    const strength = convertCycleToBBPlan({ ...ORDER_OPTS, cycle, goal: 'strength_mass' } as any);

    expect(workNames(mass)[0]).toBe('Жим штанги лёжа');
    expect(workNames(strength)[0]).toBe('Жим с паузой');
    expect(workNames(strength)).toContain('Жим штанги лёжа');
  });

  it('program-путь: strength_mass ставит ПЛ-специфику раньше обычного жима', () => {
    const program = programWithBenchPause();
    const mass = programToBBPlan(program, { ...ORDER_OPTS, goal: 'mass' } as any);
    const strength = programToBBPlan(program, { ...ORDER_OPTS, goal: 'strength_mass' } as any);

    expect(workNames(mass)[0]).toBe('Жим штанги лёжа');
    expect(workNames(strength)[0]).toBe('Жим с паузой');
    expect(workNames(strength)).toContain('Жим штанги лёжа');
  });

  it('convert-путь: sex=female сохраняется в buildContext (женские минимумы)', () => {
    const cycle = getCyclesByDirection('bodybuilding').find(c => c.meta.id === 'cycle-bb-f-glute-12');
    if (!cycle) throw new Error('cycle-bb-f-glute-12 не найден');
    const plan: any = convertCycleToBBPlan({
      ...ORDER_OPTS, cycle, goal: 'cut', sex: 'female',
    } as any);
    expect(plan.buildContext?.sex).toBe('female');
  });

  it('program-путь: sex=female сохраняется в buildContext (женские минимумы)', () => {
    const cycle = getCyclesByDirection('bodybuilding').find(c => c.meta.id === 'cycle-bb-f-glute-12');
    if (!cycle) throw new Error('cycle-bb-f-glute-12 не найден');
    const plan: any = programToBBPlan(cycleTemplateToFullProgram(cycle), {
      ...ORDER_OPTS, goal: 'cut', sex: 'female',
    } as any);
    expect(plan.buildContext?.sex).toBe('female');
  });
});
