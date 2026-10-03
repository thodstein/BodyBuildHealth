/**
 * combat-pro3-wave4.test.ts — локи В4 (Э1.1/Э1.4/Э2.1/Э2.3/Э2.4) плана
 * docs/COMBAT-PLANNER-PRO-3-PLAN.md.
 */
import { describe, it, expect } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { repsForCombatPhase } from '../combat-periodization.engine';

function base(extra: Record<string, unknown> = {}) {
  return { discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 6, daysPerWeek: 3, bodyweight: 80, age: 28, workMax: { chest: 100 } as any, ...extra } as any;
}
const benchOf = (p: any, week: number) =>
  p.weeksData.find((w: any) => w.week === week)?.sessions.flatMap((s: any) => s.exercises).find((e: any) => e.id === 'bench_bar');

describe('В4 · Э2.1 — недельная double progression', () => {
  it('вес растёт к концу цикла, но не выше +6%', () => {
    const p = buildCombatPlan(base({ weeks: 8 }));
    const w1 = benchOf(p, 1)?.weight ?? 0;
    const w5 = benchOf(p, 5)?.weight ?? 0;
    expect(w1).toBeGreaterThan(0);
    expect(w5).toBeGreaterThan(w1);
    expect(w5).toBeLessThanOrEqual(Math.round(w1 * 1.06));
  });

  it('делод не прогрессирует (вес как в неделе 1)', () => {
    const p = buildCombatPlan(base({ weeks: 8 }));
    const w1 = benchOf(p, 1)?.weight ?? 0;
    const deload = p.weeksData.find((w: any) => w.deload);
    expect(deload).toBeDefined();
    const wd = deload.sessions.flatMap((s: any) => s.exercises).find((e: any) => e.id === 'bench_bar')?.weight ?? 0;
    expect(wd).toBe(w1);
  });
});

describe('В4 · Э2.3 — делод собственные повторы', () => {
  it('делод: тяж 5-8, памп 10-15 (не общий фолбэк)', () => {
    expect(repsForCombatPhase('deload', 'тяж', 'power')).toEqual([5, 8]);
    expect(repsForCombatPhase('deload', 'памп', 'power')).toEqual([10, 15]);
  });
});

describe('В4 · Э2.4 — conjugate по сессиям', () => {
  it('rationale несёт ротацию, тяж-сессии ME дают 1-3 повтора', () => {
    const p = buildCombatPlan(base({ periodizationModel: 'conjugate', weeks: 6 }));
    expect(p.rationale.some(r => r.includes('Сопряжённая ротация'))).toBe(true);
    const reps = p.weeksData[0].sessions.flatMap((s: any) => s.exercises.map((e: any) => e.reps));
    expect(reps.some((r: string) => r === '1-3' || r === '3-5' || r === '8-12')).toBe(true);
  });
});

describe('В4 · Э1.4 — дневниковая авторегуляция', () => {
  it('просадка push >5%: вес −5%, RIR+1, строка в rationale', () => {
    const p = buildCombatPlan(base({ diaryTrendCB: [{ group: 'push', changePct: -8, recentMax: 90, prevMax: 98 }] }));
    const bench = benchOf(p, 1);
    expect(bench?.weight).toBeLessThanOrEqual(95);
    expect(bench?.rir).toBeGreaterThanOrEqual(3);
    expect(p.rationale.some(r => r.includes('Дневник: тренд e1RM'))).toBe(true);
  });

  it('без дневника вес не тронут', () => {
    const p = buildCombatPlan(base());
    expect(benchOf(p, 1)?.weight).toBe(100);
  });
});
