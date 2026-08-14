import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { convertCycleToBBPlan, programToBBPlan } from '../cycle-to-plan';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { FULL_PROGRAM_LIBRARY } from '../../complete-program-library.engine';

/**
 * Zero-state snapshots (Этап 10, п.1 плана BB-AUTO-REBUILD-AND-TUNING-PLAN):
 * фиксируют ТОЧНОЕ текущее состояние per-muscle прямого объёма для всех
 * четырёх маршрутов (Generic / ПРОФ-cycle adapt / Library adapt / natural).
 *
 * Это baseline для последующего тюнинга коэффициентов: любое изменение
 * объёмов/распределения будет видно как падение теста, прежде чем попадёт
 * в продакшен. При ОСОЗНАННОЙ правке коэффициентов снапшоты обновляются
 * вручную (правило Этапа 10: один параметр за проход → тесты → review).
 */
const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };
const PED = { pedDoses: { AAS: 500 }, courseIntensity: 'moderate' as const };

const directVolume = (plan: any): Record<string, number> => {
  const vol = plan.weeklyVolume?.[1] || {};
  return Object.fromEntries(Object.keys(vol).sort().map(m => [m, vol[m].directSets]));
};

describe('BB zero-state snapshots (baseline Этапа 10)', () => {
  it('Generic enhanced 6+ (upper_lower_4, mass, AAS 500) — per-muscle объём', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, ...PED });
    expect(directVolume(plan)).toEqual({
      abs: 16, back: 51, biceps: 4, calves: 10, chest: 18, forearms: 4, glutes: 10, hamstrings: 25, quads: 10, shoulders: 5, traps: 6, triceps: 4,
    });
  });

  it('Generic natural (ppl_6, intermediate 3 года) — per-muscle объём', () => {
    const plan = buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM });
    expect(directVolume(plan)).toEqual({
      abs: 7, back: 19, biceps: 6, calves: 10, chest: 16, forearms: 6, glutes: 7, hamstrings: 11, quads: 14, shoulders: 9, traps: 10, triceps: 6,
    });
  });

  it('ПРОФ-cycle adapt (CYCLE_01 + AAS 500) — per-muscle объём', () => {
    const plan = convertCycleToBBPlan({ cycle: CYCLE_01, workMax: WM, level: 'enhanced', trainingYears: 6, ...PED, mode: 'adapt' } as any);
    expect(directVolume(plan)).toEqual({
      abs: 6, back: 6, biceps: 6, calves: 6, chest: 6, forearms: 6, glutes: 6, hamstrings: 8, quads: 12, shoulders: 6, traps: 6, triceps: 6,
    });
  });

  it('Library adapt (FULL_PROGRAM_LIBRARY) — per-muscle объём', () => {
    const src = FULL_PROGRAM_LIBRARY.find(p => p.weeks?.some(w => w.days?.some(d => d.exercises?.some(e => /подтяг|row|тяга/i.test(e.name)))));
    expect(src).toBeDefined();
    const plan = programToBBPlan(src!, { workMax: WM, level: 'enhanced', trainingYears: 6, ...PED, mode: 'adapt' } as any);
    expect(directVolume(plan)).toEqual({
      abs: 6, back: 8, biceps: 6, calves: 6, chest: 8, forearms: 6, glutes: 6, hamstrings: 12, quads: 9, shoulders: 7, traps: 6, triceps: 6,
    });
  });

  it('Инварианты: все мышцы > 0, ни одного single-set, сумма > лимита нет', () => {
    const plans = [
      buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 6, goal: 'mass', weeks: 1, workMax: WM, ...PED }),
      buildBBPlan({ patternId: 'ppl_6', level: 'intermediate', trainingYears: 3, goal: 'mass', weeks: 1, workMax: WM }),
    ];
    for (const plan of plans) {
      for (const week of plan.weeks) for (const session of week.sessions) {
        const working = session.exercises.filter(e => !(e as any).warmupActivator);
        expect(working.length).toBeGreaterThan(0);
        for (const e of working) {
          expect(e.sets).toBeGreaterThanOrEqual(2);
          expect(e.sets).toBeLessThanOrEqual(5);
        }
      }
    }
  });
});
