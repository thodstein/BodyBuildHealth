import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { classifyLegExercise } from '../bb-back-quality.engine';

const WM = { chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 100, glutes: 140, biceps: 50, triceps: 60, calves: 80, traps: 70, forearms: 45 };

/** Раунд 2: тяж/памп чередование, cap 5 сетов, специализация, малые группы. */
describe('BB round-2 rules', () => {
  it('legs 2x/нед: день 1 тяж quads + памп hams, день 2 тяж hams + памп quads (PPL)', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    const legs = plan.weeks[0].sessions.filter(s => s.sessionTag === 'Legs');
    expect(legs).toHaveLength(2);
    const [d1, d2] = legs;
    // День 1: quads compound тяж (6-10 reps), hams памп (12-20).
    const d1Quads = d1.exercises.filter((e: any) => e.muscle === 'quads' && classifyLegExercise(e.name).pattern === 'compound_squat');
    const d1Hams = d1.exercises.filter((e: any) => e.muscle === 'hamstrings');
    expect(d1Quads.length).toBeGreaterThan(0);
    expect(d1Quads[0].repsRange?.[0]).toBeLessThanOrEqual(10);
    expect(d1Hams.every((e: any) => (e.repsRange?.[0] ?? 0) >= 12)).toBe(true);
    // День 2: hams compound тяж (RDL), quads памп.
    const d2Hams = d2.exercises.filter((e: any) => e.muscle === 'hamstrings' && /румын|rdl|гудморнинг/i.test(e.name));
    const d2Quads = d2.exercises.filter((e: any) => e.muscle === 'quads' && !(e as any).warmupActivator);
    expect(d2Hams.length).toBeGreaterThan(0);
    expect(d2Hams[0].repsRange?.[0]).toBeLessThanOrEqual(10);
    expect(d2Quads.every((e: any) => (e.repsRange?.[0] ?? 0) >= 12)).toBe(true);
  });

  it('cap 5: ни одно рабочее упражнение не имеет >5 сетов', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    for (const w of plan.weeks) for (const s of w.sessions) {
      for (const e of s.exercises.filter((x: any) => !(x as any).warmupActivator)) {
        expect(e.sets, `${e.name}: ${e.sets}`).toBeLessThanOrEqual(5);
        expect(e.sets, `${e.name}: ${e.sets}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('специализация: chest_upper → наклонный жим в каждом Push/Upper дне', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, weakPoints: ['chest_upper'], pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    for (const s of plan.weeks[0].sessions) {
      const chest = s.exercises.filter((e: any) => e.muscle === 'chest' && !(e as any).warmupActivator);
      if (chest.length === 0) continue;
      expect(chest.some((e: any) => /наклонн|incline/i.test(e.name) && /жим|press/i.test(e.name)), `day ${s.day}: нет наклонного жима`).toBe(true);
    }
  });

  it('малые группы: calves/forearms/traps покрыты в ppl_6 enhanced', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    const vol = plan.weeklyVolume?.[1] || {};
    for (const m of ['calves', 'forearms', 'traps']) {
      expect((vol[m]?.directSets ?? 0) > 0, `${m} не покрыт`).toBe(true);
    }
  });

  it('тяж/памп чередование груди: тяж-день 6-10 reps, памп-день 10-15 + fly', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    const pushes = plan.weeks[0].sessions.filter(s => s.sessionTag === 'Push');
    expect(pushes).toHaveLength(2);
    const [p1, p2] = pushes;
    const c1 = p1.exercises.filter((e: any) => e.muscle === 'chest' && /жим|press/i.test(e.name));
    const c2 = p2.exercises.filter((e: any) => e.muscle === 'chest' && /жим|press/i.test(e.name));
    expect(c1.length).toBeGreaterThan(0);
    expect(c2.length).toBeGreaterThan(0);
    // Тяж-день (нечётный): жимы 6-10. Памп-день: 10-15 + fly/кроссовер.
    expect(c1[0].repsRange?.[0]).toBeLessThanOrEqual(10);
    expect(c2[0].repsRange?.[0]).toBeGreaterThanOrEqual(10);
    expect(p2.exercises.some((e: any) => e.muscle === 'chest' && /развод|fly|crossover|кроссовер|сведен/i.test(e.name))).toBe(true);
  });
});
