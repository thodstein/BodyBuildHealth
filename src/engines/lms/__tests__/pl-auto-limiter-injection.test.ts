import { describe, expect, it } from 'vitest';
import { buildLMSPlan } from '../lms-builder.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';

const pmMap = { 'Присед': 150, 'Жим лежа': 110, 'Становая тяга': 180 };

function plan(overrides: Record<string, unknown> = {}) {
  return buildLMSPlan({ template: CYCLE_01, pmMap, weeksOverride: 12, mode: 'natural', ...overrides } as never);
}

function findExercise(output: any, name: string) {
  const names: string[] = [];
  for (const w of output.weeks) for (const d of w.days) for (const e of d.exercises) {
    if (e.name === name) return e;
    names.push(e.name);
  }
  throw new Error('не найдено: ' + name + '; есть: ' + names.join(' | '));
}

describe('injectLimiterExercises (категорийные протоколы)', () => {
  it('скоростная работа: 8×2 @55% впрыскивается с протоколом опции', () => {
    const out = plan({
      limiterExerciseMap: { 'squat|speed_strength|speed_squat_start': ['Приседание до параллели'] },
      limiterProtocolMap: { 'squat|speed_strength|speed_squat_start': { protocol: { sets: 8, reps: 2, pct: 0.55, rir: 3, tempo: '1-0-1-0', rest: '2 мин' }, category: 'speed_strength' } },
      limiterDayMap: { 'squat|speed_strength|speed_squat_start': [1] },
    });
    const ex = findExercise(out, 'Приседание до параллели');
    expect(ex.workSets[0].sets).toBe(8);
    expect(ex.workSets[0].reps).toBe(2);
    expect(ex.workSets[0].pct).toBe(0.55);
    expect(ex.workSets[0].rir).toBe(3);
  });

  it('дожим: 4×3 @80% (частичные повторы, тяжёлый load)', () => {
    const out = plan({
      limiterExerciseMap: { 'bench|partial_amplitude|partial_bench_lockout': ['Дожим с 3 см'] },
      limiterProtocolMap: { 'bench|partial_amplitude|partial_bench_lockout': { protocol: { sets: 4, reps: 3, pct: 0.8, rir: 1 }, category: 'partial_amplitude' } },
      limiterDayMap: { 'bench|partial_amplitude|partial_bench_lockout': [2] },
    });
    const ex = findExercise(out, 'Дожим с 3 см');
    expect(ex.workSets[0].sets).toBe(4);
    expect(ex.workSets[0].reps).toBe(3);
    expect(ex.workSets[0].pct).toBe(0.8);
    expect(ex.load).toBe('Тяжелая');
  });

  it('изометрия: reps=1 и удержание (holdSec) в протоколе', () => {
    const out = plan({
      limiterExerciseMap: { 'bench|contraction_mode|mode_bench_iso': ['Жим в раме (старт)'] },
      limiterProtocolMap: { 'bench|contraction_mode|mode_bench_iso': { protocol: { sets: 4, reps: 1, pct: 0.85, rir: 1, holdSec: 5 }, category: 'contraction_mode' } },
      limiterDayMap: { 'bench|contraction_mode|mode_bench_iso': [2] },
    });
    const ex = findExercise(out, 'Жим в раме (старт)');
    expect(ex.workSets[0].reps).toBe(1);
    expect(ex.workSets[0].pct).toBe(0.85);
  });

  it('гипертрофия лимитирующей группы: 3×10 @65%', () => {
    const out = plan({
      limiterExerciseMap: { 'squat|limiter_hypertrophy|hyp_quads': ['Жим ногами'] },
      limiterProtocolMap: { 'squat|limiter_hypertrophy|hyp_quads': { protocol: { sets: 3, reps: 10, pct: 0.65, rir: 2 }, category: 'limiter_hypertrophy' } },
      limiterDayMap: { 'squat|limiter_hypertrophy|hyp_quads': [1] },
    });
    const ex = findExercise(out, 'Жим ногами');
    expect(ex.workSets[0].sets).toBe(3);
    expect(ex.workSets[0].reps).toBe(10);
    expect(ex.workSets[0].pct).toBe(0.65);
  });

  it('дубль в одном дне не добавляется повторно (в неделе 1 день 1 — один экземпляр)', () => {
    const map = { 'squat|speed_strength|speed_squat_start': ['Приседание до параллели', 'Приседание до параллели'] };
    const out = plan({
      limiterExerciseMap: map,
      limiterProtocolMap: { 'squat|speed_strength|speed_squat_start': { protocol: { sets: 8, reps: 2, pct: 0.55, rir: 3 }, category: 'speed_strength' } },
      limiterDayMap: { 'squat|speed_strength|speed_squat_start': [1] },
    });
    const day0 = (out.weeks[0] as any).days[0];
    expect(day0.exercises.filter((e: any) => e.name === 'Приседание до параллели').length).toBeLessThanOrEqual(1);
  });

  it('без limiterMap — план не меняется (аддитивность)', () => {
    const base = plan({});
    const withEmpty = plan({ limiterExerciseMap: {}, limiterProtocolMap: {} });
    expect(withEmpty.weeks.length).toBe(base.weeks.length);
    const countBase = base.weeks.reduce((s: number, w: any) => s + w.days.reduce((x: number, d: any) => x + d.exercises.length, 0), 0);
    const countEmpty = withEmpty.weeks.reduce((s: number, w: any) => s + w.days.reduce((x: number, d: any) => x + d.exercises.length, 0), 0);
    expect(countEmpty).toBe(countBase);
  });
});
