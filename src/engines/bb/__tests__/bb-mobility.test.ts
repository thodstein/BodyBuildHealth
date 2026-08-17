/**
 * bb-mobility.test.ts — ограничения мобильности (биомеханика) в BB-плане.
 *
 * Мобильность защищает ДВИЖЕНИЯ (не мышцы): упражнения с ограниченной
 * амплитудой заменяются на безопасные альтернативы. Проверяем:
 *  1. Фильтр пула в buildSession (generic-путь).
 *  2. Фильтр добавляемых упражнений в finalize (fill/feeders/малые группы).
 *  3. Замену в cycle-to-plan.
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { makeInput, expectValidPlan } from './bb-test-helpers';
import { isMobilityRestricted, MOBILITY_PATTERNS } from '../bb-mobility.engine';
import { convertCycleToBBPlan } from '../cycle-to-plan';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';

const workMax = { chest: 100, back: 120, shoulders: 60, arms: 50, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

const cycle: SRCycleTemplate = {
  meta: {
    id: 'test-mobility-cycle', title: 'Test mobility cycle', direction: 'bodybuilding', level: 'intermediate', period: 'mass',
    sessionsPerWeek: 2, weeks: 2, correctionPct: 0.005,
  },
  week1: [
    { exercises: [{ name: 'Жим штанги лёжа', group: 'Грудь', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.7, reps: 8, sets: 3, rir: 2 }] }] },
    { exercises: [{ name: 'Присед со штангой', group: 'Ноги', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.7, reps: 8, sets: 3, rir: 2 }] }] },
  ],
};

describe('isMobilityRestricted — паттерны', () => {
  it('shoulder: жим стоя/за голову/тяга к подбородку', () => {
    expect(isMobilityRestricted({ name: 'Армейский жим стоя' }, ['shoulder'])).toBe(true);
    expect(isMobilityRestricted({ name: 'Тяга штанги к подбородку' }, ['shoulder'])).toBe(true);
    expect(isMobilityRestricted({ name: 'Жим гантелей сидя' }, ['shoulder'])).toBe(false);
  });
  it('ankle: присед со штангой/выпады/болгарские', () => {
    expect(isMobilityRestricted({ name: 'Приседания со штангой' }, ['ankle'])).toBe(true);
    expect(isMobilityRestricted({ name: 'Болгарские сплит-приседания' }, ['ankle'])).toBe(true);
    expect(isMobilityRestricted({ name: 'Жим ногами (45°)' }, ['ankle'])).toBe(false);
  });
  it('lower_back: классическая становая/тяга в наклоне/гудморнинг', () => {
    expect(isMobilityRestricted({ name: 'Становая тяга (классика)' }, ['lower_back'])).toBe(true);
    expect(isMobilityRestricted({ name: 'Тяга штанги в наклоне (прямой хват)' }, ['lower_back'])).toBe(true);
    expect(isMobilityRestricted({ name: 'Тяга верхнего блока (прямой)' }, ['lower_back'])).toBe(false);
  });
  it('wrist: сгибания со штангой/французский жим', () => {
    expect(isMobilityRestricted({ name: 'Подъём штанги на бицепс стоя' }, ['wrist'])).toBe(true);
    expect(isMobilityRestricted({ name: 'Французский жим лёжа (EZ-гриф)' }, ['wrist'])).toBe(true);
    expect(isMobilityRestricted({ name: 'Разгибания на трицепс в верхнем блоке' }, ['wrist'])).toBe(false);
  });
  it('hip: глубокие приседы/sissy', () => {
    expect(isMobilityRestricted({ name: 'Приседания ATG' }, ['hip'])).toBe(true);
    expect(isMobilityRestricted({ name: 'Жим ногами (45°)' }, ['hip'])).toBe(false);
  });
  it('без ограничений — ничего не фильтруется', () => {
    expect(isMobilityRestricted({ name: 'Армейский жим стоя' }, [])).toBe(false);
    expect(isMobilityRestricted({ name: 'Армейский жим стоя' }, undefined)).toBe(false);
  });
});

describe('BB-план: ограничения мобильности', () => {
  it('ankle: в плане нет приседаний со штангой/выпадов/болгарских', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8, mobilityRestrictions: ['ankle'] }));
    expectValidPlan(plan);
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        for (const ex of s.exercises) {
          if ((ex as any).warmupActivator) continue;
          expect(isMobilityRestricted(ex, ['ankle'])).toBe(false);
        }
      }
    }
  });

  it('lower_back: нет классической становой/тяги в наклоне/гудморнинга', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8, mobilityRestrictions: ['lower_back'] }));
    expectValidPlan(plan);
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        for (const ex of s.exercises) {
          if ((ex as any).warmupActivator) continue;
          expect(isMobilityRestricted(ex, ['lower_back'])).toBe(false);
        }
      }
    }
  });

  it('shoulder: нет жимов стоя/за голову/тяги к подбородку', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8, mobilityRestrictions: ['shoulder'] }));
    expectValidPlan(plan);
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        for (const ex of s.exercises) {
          if ((ex as any).warmupActivator) continue;
          expect(isMobilityRestricted(ex, ['shoulder'])).toBe(false);
        }
      }
    }
  });

  it('несколько ограничений сразу — план валиден и без запрещённых движений', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8, mobilityRestrictions: ['ankle', 'lower_back', 'wrist'] }));
    expectValidPlan(plan);
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        for (const ex of s.exercises) {
          if ((ex as any).warmupActivator) continue;
          expect(isMobilityRestricted(ex, ['ankle', 'lower_back', 'wrist'])).toBe(false);
        }
      }
    }
  });

  it('без ограничений план не меняется (детерминизм)', () => {
    const a = buildBBPlan(makeInput({ weeks: 8 }));
    const b = buildBBPlan(makeInput({ weeks: 8, mobilityRestrictions: [] }));
    expect(JSON.stringify(a.weeks)).toBe(JSON.stringify(b.weeks));
  });
});

describe('cycle-to-plan: мобильность', () => {
  it('ankle: присед со штангой в цикле заменяется на безопасную альтернативу', () => {
    const plan = convertCycleToBBPlan({
      cycle,
      workMax,
      level: 'intermediate',
      mode: 'adapt',
      mobilityRestrictions: ['ankle'],
    });
    expect(plan).toBeDefined();
    for (const w of plan.weeks) {
      for (const s of w.sessions) {
        for (const ex of s.exercises) {
          if ((ex as any).warmupActivator) continue;
          expect(isMobilityRestricted(ex, ['ankle'])).toBe(false);
        }
      }
    }
  });
});
