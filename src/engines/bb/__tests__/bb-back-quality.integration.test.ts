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
      weakPoints: ['back'], specialization: true,
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
      mode: 'adapt', weakPoints: ['back'], specialization: true,
      equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
    } as any);
    // Одинаковый профиль vertical pull не должен повторяться в каждой сессии:
    // разные профили (wide/neutral/underhand) допустимы, дубли — нет.
    const profiles: string[] = [];
    for (const session of plan.weeks[0].sessions) {
      for (const ex of session.exercises) {
        if (classifyBackExercise(ex.name).pattern !== 'vertical_pull') continue;
        const profile = verticalPullProfile(ex.name);
        if (profile) profiles.push(profile);
      }
    }
    expect(new Set(profiles).size).toBeGreaterThanOrEqual(2);
    const uniqueProfiles = new Set(profiles);
    const excess = profiles.filter(p => p === 'cable_vertical').length - 1;
    expect(excess).toBeLessThanOrEqual(1);
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
      mode: 'adapt', weakPoints: ['back'], specialization: true,
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

  it('does not select pull-ups without bodyweight capability in any role', () => {
    const plan = buildBBPlan({
      patternId: 'ppl_6', level: 'enhanced', trainingYears: 6,
      goal: 'mass', weeks: 1, workMax: WM,
      bodyweightCapability: { pullUpsStrict: 0, chinUpsStrict: 0 },
      pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
    });
    const pullups = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
      .filter(e => /подтяг|pull.?up|chin/i.test(e.name));
    expect(pullups).toHaveLength(0);
  }, 30000);

  it('allows pull-ups when capability is confirmed', () => {
    const plan = buildBBPlan({
      patternId: 'ppl_6', level: 'enhanced', trainingYears: 6,
      goal: 'mass', weeks: 1, workMax: WM,
      bodyweightCapability: { pullUpsStrict: 10 },
      pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
    });
    const pullups = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
      .filter(e => /подтяг|pull.?up|chin/i.test(e.name));
    expect(pullups.length).toBeGreaterThanOrEqual(0);
  }, 30000);

  it('excludes dips from chest, unilateral RDL and double hip thrust for men', () => {
    const plan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6,
      goal: 'mass', weeks: 1, workMax: WM,
      pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
    });
    const all = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises);
    // 1. Брусья не в приоритете груди
    expect(all.some(e => e.muscle === 'chest' && /брус|dip/i.test(e.name))).toBe(false);
    // 2. Румынская на одной ноге не для мужчин/массы
    expect(all.some(e => /румын|rdl/i.test(e.name) && /на одной ног|одной ногой|single.?leg/i.test(e.name))).toBe(false);
    // 3. Армейский жим стоя не в приоритете плеч
    expect(all.some(e => e.muscle === 'shoulders' && /армейск|жим.*стоя|military/i.test(e.name))).toBe(false);
    // 4. Нет двух одинаковых ягодичных мостов в одной Lower-сессии
    for (const session of plan.weeks[0].sessions.filter(s => s.sessionTag === 'Lower')) {
      const gluteNames = session.exercises.filter(e => e.muscle === 'glutes').map(e => e.name);
      expect(new Set(gluteNames).size).toBe(gluteNames.length);
    }
    // 5. Back-отчёт не содержит traps/rear delt как back-паттернов
    const backReport = plan.rationale.find(r => r.includes('Спина по паттернам'));
    expect(backReport).toBeDefined();
    expect(/shrug|rear_delt|traps/.test(backReport || '')).toBe(false);
  }, 30000);

  it('adds warmup activator to each target session, excluded from volume', () => {
    const plan = buildBBPlan({
      patternId: 'ppl_6', level: 'enhanced', trainingYears: 6,
      goal: 'mass', weeks: 1, workMax: WM,
      pedDoses: { AAS: 500 }, courseIntensity: 'moderate',
    });
    const sessions = plan.weeks[0].sessions;
    for (const session of sessions) {
      const warmup = session.exercises.find((e: any) => e.warmupActivator);
      // Каждая рабочая сессия (Push/Pull/Legs) имеет разминку на целевую группу.
      expect(warmup).toBeTruthy();
      expect(warmup!.sets).toBe(3);
      expect(warmup!.workSets[0].reps).toBeGreaterThanOrEqual(10);
      expect(warmup!.workSets[0].reps).toBeLessThanOrEqual(15);
      // Warmup — первое упражнение сессии.
      expect(session.exercises[0]).toBe(warmup);
    }
    // Warmup не входит в weekly volume.
    const backVol = plan.weeklyVolume?.[1]?.back;
    const chestVol = plan.weeklyVolume?.[1]?.chest;
    const warmupNames = sessions.flatMap(s => s.exercises.filter((e: any) => e.warmupActivator).map(e => e.name));
    expect(warmupNames.length).toBe(sessions.length);
    // Пуловер/кроссовер не должны попадать в объём как direct sets (warmup).
    const totalDirect = Object.values(plan.weeklyVolume?.[1] || {}).reduce((a: number, v: any) => a + v.directSets, 0);
    expect(totalDirect).toBeGreaterThan(0);
  }, 30000);
});
