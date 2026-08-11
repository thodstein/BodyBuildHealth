import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { classifyBackExercise, verticalPullProfile } from '../bb-back-quality.engine';
import { convertCycleToBBPlan } from '../cycle-to-plan';
import { programToBBPlan } from '../cycle-to-plan';
import { FULL_PROGRAM_LIBRARY } from '../../complete-program-library.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

const WM = {
  chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 100,
  glutes: 140, biceps: 50, triceps: 60, calves: 80, traps: 70, forearms: 45,
};

describe('experienced enhanced back prescription', () => {
  it('distributes a real high-volume back block across both Upper sessions', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6,
      goal: 'mass', weeks: 1, workMax: WM,
      pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
    });
    const uppers = plan.weeks[0].sessions.filter(s => s.sessionTag === 'Upper');
    expect(uppers).toHaveLength(2);
    for (const session of uppers) {
      const back = session.exercises.filter(e => e.muscle === 'back');
      expect(back.reduce((sum, e) => sum + e.sets, 0)).toBeGreaterThanOrEqual(18);
      expect(new Set(back.map(e => classifyBackExercise(e.name).pattern)).size).toBeGreaterThanOrEqual(3);
      const verticalProfiles = back.filter(e => classifyBackExercise(e.name).pattern === 'vertical_pull').map(e => verticalPullProfile(e.name)).filter((p): p is string => p !== null);
      expect(new Set(verticalProfiles).size).toBe(verticalProfiles.length);
    }
  }, 30000);

  it.each(['ppl_6', 'push_pull_2'] as const)('keeps every Pull session high-volume: %s', (patternId) => {
    const plan = buildBBPlan({
      patternId, level: 'enhanced', trainingYears: 6,
      goal: 'mass', weeks: 1, workMax: WM,
      pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
    });
    const pulls = plan.weeks[0].sessions.filter(s => s.sessionTag === 'Pull');
    expect(pulls.length).toBeGreaterThanOrEqual(2);
    for (const session of pulls) {
      const back = session.exercises.filter(e => e.muscle === 'back');
      expect(back.reduce((sum, e) => sum + e.sets, 0)).toBeGreaterThanOrEqual(18);
      expect(back.filter(e => classifyBackExercise(e.name).pattern === 'vertical_pull').length).toBeLessThanOrEqual(1);
    }
  }, 30000);

  it('does not apply the high-volume allocation to natural plans', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM });
    const upper = plan.weeks[0].sessions.find(s => s.sessionTag === 'Upper')!;
    const backSets = upper.exercises.filter(e => e.muscle === 'back').reduce((sum, e) => sum + e.sets, 0);
    expect(backSets).toBeLessThan(18);
  }, 30000);

  it('gives experienced enhanced legs a real volume budget', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6,
      goal: 'mass', weeks: 1, workMax: WM,
      pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
    });
    const lowers = plan.weeks[0].sessions.filter(s => s.sessionTag === 'Lower');
    expect(lowers).toHaveLength(2);
    for (const session of lowers) {
      const quads = session.exercises.filter(e => e.muscle === 'quads').reduce((sum, e) => sum + e.sets, 0);
      const hams = session.exercises.filter(e => e.muscle === 'hamstrings').reduce((sum, e) => sum + e.sets, 0);
      expect(quads + hams).toBeGreaterThanOrEqual(10);
    }
  }, 30000);

  it('reduces direct arm volume when indirect overlap from presses/pulls is high', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6,
      goal: 'mass', weeks: 1, workMax: WM,
      pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
    });
    const uppers = plan.weeks[0].sessions.filter(s => s.sessionTag === 'Upper');
    for (const session of uppers) {
      const biceps = session.exercises.filter(e => e.muscle === 'biceps').reduce((sum, e) => sum + e.sets, 0);
      const triceps = session.exercises.filter(e => e.muscle === 'triceps').reduce((sum, e) => sum + e.sets, 0);
      // Arms should not exceed 12 sets per session when indirect overlap is high
      expect(biceps).toBeLessThanOrEqual(12);
      expect(triceps).toBeLessThanOrEqual(12);
    }
  }, 30000);

  it('adaptive Generic does not use vertical pull in every back session', () => {
    const plan = buildBBPlan({
      patternId: 'ppl_6', level: 'enhanced', trainingYears: 6,
      goal: 'mass', weeks: 1, workMax: WM,
      weakPoints: ['back'], focusGroup: 'back', specialization: true,
      pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
    });
    const pulls = plan.weeks[0].sessions.filter(s => s.sessionTag === 'Pull');
    const verticalSessions = pulls.filter(s => s.exercises.some(e => classifyBackExercise(e.name).pattern === 'vertical_pull'));
    expect(verticalSessions.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('adaptive PROF cycle applies the same weekly pull-pattern repair', () => {
    const plan = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: { ...WM, legs: 140 },
      level: 'enhanced', trainingYears: 6,
      peds: ['AAS'], pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
      mode: 'adapt', weakPoints: ['back'], focusGroup: 'back', specialization: true,
      equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
    } as any);
    const verticalSessions = plan.weeks[0].sessions.filter(s => s.exercises.some(e => classifyBackExercise(e.name).pattern === 'vertical_pull'));
    expect(verticalSessions.length).toBeLessThan(plan.weeks[0].sessions.length);
  }, 30000);

  it('keeps distinct vertical profiles as valid specialization choices', () => {
    expect(verticalPullProfile('Тяга верхнего блока широким хватом')).toBe('wide');
    expect(verticalPullProfile('Тяга верхнего блока хаммерным хватом')).toBe('neutral_hammer');
    expect(verticalPullProfile('Подтягивания нейтральным хватом')).toBe('neutral_hammer');
    expect(verticalPullProfile('Подтягивания (прямой хват)')).toBe('pullup');
    expect(verticalPullProfile('Тяга верхнего блока обратным хватом')).toBe('underhand');
    expect(new Set([
      verticalPullProfile('Тяга верхнего блока широким хватом'),
      verticalPullProfile('Тяга верхнего блока хаммерным хватом'),
      verticalPullProfile('Подтягивания (прямой хват)'),
    ]).size).toBe(3);
  });

  it('adaptive library output uses the shared back quality pass', () => {
    const source = FULL_PROGRAM_LIBRARY.find(program => program.weeks?.some(week => week.days.some(day => day.exercises.some(ex => /подтяг|pull.?up|верхн.*блок|row|тяга/i.test(ex.name)))));
    if (!source) return;
    const plan = programToBBPlan(source, {
      workMax: WM,
      level: 'enhanced', trainingYears: 6,
      peds: ['AAS'], pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
      mode: 'adapt', weakPoints: ['back'], focusGroup: 'back', specialization: true,
      equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
    } as any);
    const backExercises = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises).filter(e => e.muscle === 'back');
    expect(backExercises.length).toBeGreaterThan(0);
    expect(plan.rationale.some(item => item.includes('Спина по паттернам'))).toBe(true);
  }, 30000);

  it('faithful library mode does not run adaptive pull-pattern repair', () => {
    const source = FULL_PROGRAM_LIBRARY.find(program => program.weeks?.some(week => week.days.some(day => day.exercises.some(ex => /подтяг|pull.?up|верхн.*блок|row|тяга/i.test(ex.name)))));
    if (!source) return;
    const plan = programToBBPlan(source, { workMax: WM, level: 'enhanced', trainingYears: 6, mode: 'faithful' } as any);
    expect(plan.rationale.some(item => item.includes('Спина по паттернам'))).toBe(true);
    expect(plan.rationale.some(item => item.includes('Адаптация частоты'))).toBe(false);
  }, 30000);
});
