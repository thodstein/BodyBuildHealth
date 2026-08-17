/**
 * bb-injury-gentle.test.ts — щадящий режим травм (exclude=false) в BB-плане.
 *
 * Жалоба: «щадящий режим не выбирается; травмированные группы не прорабатываются».
 * Фиксы:
 *  1. getGradedInjuries/getExcludedMuscles раскрывают зонные ключи (legs/arms/core)
 *     в PRO-мышцы (quads/biceps/abs) — травма «Колено» раньше вообще не влияла на план.
 *  2. Для градированной травмы мышца ОСТАЁТСЯ в плане (findGentleSubstitutions —
 *     замена той же группы), вес/объём/повторы снижаются (weightPct/volumePct/repsCap).
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { makeInput, expectValidPlan } from './bb-test-helpers';
import { expandInjuryMuscle, getExcludedMuscles, getGradedInjuries } from '../../manual-plan-builder';
import { findGentleSubstitutions } from '../../exercise-substitution.engine';

const today = () => new Date().toISOString().slice(0, 10);

describe('expandInjuryMuscle — зонные ключи травм раскрываются в PRO-мышцы', () => {
  it('legs → quads/hamstrings/glutes/calves', () => {
    expect(expandInjuryMuscle('legs')).toEqual(['quads', 'hamstrings', 'glutes', 'calves']);
  });
  it('arms → biceps/triceps/forearms', () => {
    expect(expandInjuryMuscle('arms')).toEqual(['biceps', 'triceps', 'forearms']);
  });
  it('core → abs/lower_back', () => {
    expect(expandInjuryMuscle('core')).toEqual(['abs', 'lower_back']);
  });
  it('канонический ключ не меняется', () => {
    expect(expandInjuryMuscle('shoulders')).toEqual(['shoulders']);
    expect(expandInjuryMuscle('chest')).toEqual(['chest']);
    expect(expandInjuryMuscle('quads')).toEqual(['quads']);
  });
});

describe('getExcludedMuscles — exclude травмы с зонными ключами', () => {
  it('legs exclude → все ноги-мышцы исключены', () => {
    const ex = getExcludedMuscles([{ muscle: 'legs', from: today(), exclude: true }], today());
    expect(ex.has('quads')).toBe(true);
    expect(ex.has('hamstrings')).toBe(true);
    expect(ex.has('glutes')).toBe(true);
    expect(ex.has('calves')).toBe(true);
  });
  it('неактивная травма не исключает', () => {
    const ex = getExcludedMuscles([{ muscle: 'legs', from: '2020-01-01', to: '2020-02-01', exclude: true }], today());
    expect(ex.size).toBe(0);
  });
});

describe('getGradedInjuries — градированные травмы раскрываются', () => {
  it('legs graded → записи для каждой ноги-мышцы с теми же параметрами', () => {
    const g = getGradedInjuries([{ muscle: 'legs', from: today(), exclude: false, weightPct: 0.5, volumePct: 0.6, repsCap: 12 }], today());
    expect(g).toHaveLength(4);
    expect(g.every(i => i.exclude === false && i.weightPct === 0.5 && i.volumePct === 0.6 && i.repsCap === 12)).toBe(true);
    expect(g.map(i => i.muscle).sort()).toEqual(['calves', 'glutes', 'hamstrings', 'quads']);
  });
});

describe('findGentleSubstitutions — щадящая замена ТОЙ ЖЕ мышцы', () => {
  it('никогда не возвращает упражнения другой группы', () => {
    const subs = findGentleSubstitutions('Жим штанги лёжа', 'chest');
    expect(subs.length).toBeGreaterThan(0);
    for (const s of subs) {
      expect(s.exercise.group === 'chest' || s.exercise.group === undefined).toBe(true);
    }
  });
  it('возвращает изоляцию с низким jointStress для плеч', () => {
    const subs = findGentleSubstitutions('Армейский жим стоя', 'shoulders');
    expect(subs.length).toBeGreaterThan(0);
    expect(subs[0].volumePct).toBeLessThanOrEqual(0.8);
    expect(subs[0].weightPct).toBeLessThanOrEqual(0.8);
  });
  it('если безопасной замены нет — исходное упражнение со снижением', () => {
    const subs = findGentleSubstitutions('Несуществующее упражнение X', 'quads');
    expect(subs.length).toBe(0);
  });
  it('quads: замены матчатся по trueMuscleOf (каталог-группа legs)', () => {
    const subs = findGentleSubstitutions('Приседания со штангой', 'quads');
    const anyQuads = subs.some(s => s.exercise.group === 'legs' || s.exercise.group === 'quads');
    expect(subs.length).toBeGreaterThan(0);
    expect(anyQuads).toBe(true);
  });
});

describe('BB-план: градированная травма (exclude=false)', () => {
  it('план генерируется; травмированная мышца ПРИСУТСТВУЕТ со сниженной нагрузкой', () => {
    const base = buildBBPlan(makeInput({ weeks: 8 }));
    const graded = buildBBPlan(makeInput({
      weeks: 8,
      injuries: [{ muscle: 'shoulders', from: today(), exclude: false, weightPct: 0.5, volumePct: 0.6, repsCap: 12 }],
    }));
    expectValidPlan(graded);

    const baseW = base.weeks[0];
    const gradedW = graded.weeks[0];
    const shoulderExBase = baseW.sessions.flatMap(s => s.exercises.filter(e => e.muscle === 'shoulders' && !(e as any).warmupActivator));
    const shoulderExGraded = gradedW.sessions.flatMap(s => s.exercises.filter(e => e.muscle === 'shoulders' && !(e as any).warmupActivator));
    // Мышца не исключена — упражнения есть
    expect(shoulderExGraded.length).toBeGreaterThan(0);
    // Объём снижен относительно базового плана
    const baseSets = shoulderExBase.reduce((a, e) => a + e.sets, 0);
    const gradedSets = shoulderExGraded.reduce((a, e) => a + e.sets, 0);
    expect(gradedSets).toBeLessThanOrEqual(baseSets);
    expect(gradedSets).toBeGreaterThan(0);
    // repsCap соблюдён
    for (const ex of shoulderExGraded) {
      for (const ws of ex.workSets || []) {
        if ((ws as any).reps) expect((ws as any).reps).toBeLessThanOrEqual(12);
      }
    }
  });

  it('зонная травма legs graded — ноги прорабатываются со снижением, план не пустой', () => {
    const graded = buildBBPlan(makeInput({
      weeks: 8,
      injuries: [{ muscle: 'legs', from: today(), exclude: false, weightPct: 0.5, volumePct: 0.5, repsCap: 10 }],
    }));
    expectValidPlan(graded);
    const week1 = graded.weeks[0];
    const legEx = week1.sessions.flatMap(s => s.exercises.filter(e => ['quads', 'hamstrings', 'glutes', 'calves'].includes(e.muscle) && !(e as any).warmupActivator));
    expect(legEx.length).toBeGreaterThan(0);
    for (const ex of legEx) {
      for (const ws of ex.workSets || []) {
        if ((ws as any).reps) expect((ws as any).reps).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe('BB-план: исключённая травма (exclude=true)', () => {
  it('зонная травма legs exclude — ноги полностью исключены из плана', () => {
    const plan = buildBBPlan(makeInput({
      weeks: 8,
      injuries: [{ muscle: 'legs', from: today(), exclude: true }],
    }));
    expectValidPlan(plan);
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        for (const ex of s.exercises) {
          expect(['quads', 'hamstrings', 'glutes', 'calves'].includes(ex.muscle)).toBe(false);
        }
      }
    }
  });

  it('травма shoulders exclude — плечи отсутствуют, план валиден', () => {
    const plan = buildBBPlan(makeInput({
      weeks: 8,
      injuries: [{ muscle: 'shoulders', from: today(), exclude: true }],
    }));
    expectValidPlan(plan);
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        for (const ex of s.exercises) {
          expect(ex.muscle === 'shoulders').toBe(false);
        }
      }
    }
  });
});
