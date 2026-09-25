/**
 * manual-arm-quality.test.ts — ARM-программы в движках качества/объёма ручного конструктора.
 *
 * Контекст: ручной конструктор получил направление ARM (создание, редактор, экспорт).
 * computePlanQualityFor/analyzeManualVolume читали только program.bb и hybrid.bbWeeks,
 * поэтому у ARM-программы качество и недельный бюджет считались по ПУСТЫМ данным —
 * бейдж в списке программ показывал.score не по факту.
 */
import { describe, it, expect } from 'vitest';
import { computePlanQualityFor } from '../manual-quality.engine';
import { analyzeManualVolume } from '../manual-volume.engine';
import type { UserProgram, UserWeek, UserSession, UserBlock } from '../../user-program/user-program.types';

function makeBlock(muscle: string, setsCount = 4): UserBlock {
  return {
    id: `b_${muscle}_${Math.random().toString(36).slice(2, 7)}`,
    type: 'compound',
    exerciseName: `Test ${muscle}`,
    muscle,
    role: 'primary',
    sets: Array.from({ length: setsCount }, () => ({ reps: 10, rir: 2, weight: 50, restSec: 120 })),
  } as unknown as UserBlock;
}

function makeSession(muscles: string[], setsPerMuscle: number): UserSession {
  return {
    id: `ses_${Math.random().toString(36).slice(2, 7)}`,
    name: 'Арм день',
    focus: muscles.join(' / '),
    dayOfWeek: 0,
    blocks: muscles.map(m => makeBlock(m, setsPerMuscle)),
  } as unknown as UserSession;
}

function makeWeeks(count: number, muscles: string[], setsPerMuscle: number): UserWeek[] {
  return Array.from({ length: count }, (_, i) => ({
    week: i + 1,
    phase: 'accumulation',
    deload: false,
    sessions: [makeSession(muscles, setsPerMuscle)],
  }));
}

const MUSCLES = ['chest', 'back', 'biceps', 'triceps'];

function armProgram(weeks: UserWeek[]): UserProgram {
  return { meta: { title: 'ARM', direction: 'arm', createdAt: '', updatedAt: '' }, arm: { weeks } } as any;
}

function bbProgram(weeks: UserWeek[]): UserProgram {
  return { meta: { title: 'BB', direction: 'bb', createdAt: '', updatedAt: '' }, bb: { weeks } } as any;
}

function totalPeakSets(r: ReturnType<typeof computePlanQualityFor>): number {
  return r.perMuscle.reduce((sum, m) => sum + m.peakSets, 0);
}

describe('computePlanQualityFor — ARM программы', () => {
  it('считает качество по неделям ARM, а не по пустым данным', () => {
    const weeks = makeWeeks(8, MUSCLES, 4);
    const result = computePlanQualityFor(armProgram(weeks), 'intermediate');

    // До правки: program.bb отсутствует → weeksSrc = [] → peakSets = 0 у всех мышц.
    expect(totalPeakSets(result)).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(0);
  });

  it('даёт тот же результат, что и ББ-программа с теми же неделями', () => {
    const weeks = makeWeeks(8, MUSCLES, 4);
    const arm = computePlanQualityFor(armProgram(weeks), 'intermediate');
    const bb = computePlanQualityFor(bbProgram(weeks), 'intermediate');

    // Структура UserWeek одна и та же — паритет защищает от «своей» математики для ARM.
    expect(arm.score).toBe(bb.score);
    expect(totalPeakSets(arm)).toBe(totalPeakSets(bb));
  });

  it('не ломает ББ и PL пути', () => {
    const weeks = makeWeeks(8, MUSCLES, 4);
    const bb = computePlanQualityFor(bbProgram(weeks), 'intermediate');
    expect(bb.score).toBeGreaterThan(0);

    const pl: UserProgram = {
      meta: { title: 'PL', direction: 'pl', createdAt: '', updatedAt: '' },
      pl: {
        direction: 'pl',
        sourceCycleId: null,
        schedule: [],
        weakPoints: [],
        notes: '',
        workMax: {},
        customWeeks: [{ week: 1, phase: 'accumulation', deload: false, days: [] }],
      },
    } as any;
    const plResult = computePlanQualityFor(pl, 'intermediate');
    expect(Number.isFinite(plResult.score)).toBe(true);
  });
});

describe('analyzeManualVolume — ARM программы', () => {
  it('видит недели ARM и считает недельный бюджет по факту', () => {
    const weeks = makeWeeks(8, MUSCLES, 4);
    const arm = analyzeManualVolume(armProgram(weeks), 'intermediate');
    const bb = analyzeManualVolume(bbProgram(weeks), 'intermediate');

    expect(arm.weeklyBudget).toBe(bb.weeklyBudget);
    expect(arm.weeklyBudget).toBeGreaterThan(0);
    expect(Object.keys(arm.peakEffective).length).toBe(Object.keys(bb.peakEffective).length);
  });
});
