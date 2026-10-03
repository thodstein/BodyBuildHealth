/**
 * combat-pro3-wave6.test.ts — локи Э2.2/Э5.3/Э6 (разминка/топ-сет, размещение
 * кондиции, гигиена: CB_RU_MODEL, чистый финализатор) плана
 * docs/COMBAT-PLANNER-PRO-3-PLAN.md.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { buildCombatPlan } from '../combat-builder.engine';
import { finalizeCombatPlan } from '../combat-finalize.engine';
import { conditioningSuggestedDays, conditioningSessionsForWeek, buildConditioningRationale } from '../combat-conditioning.engine';

function base(extra: Record<string, unknown> = {}) {
  return { discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 8, daysPerWeek: 3, bodyweight: 80, age: 28, workMax: { chest: 100 } as any, ...extra } as any;
}
const benchOf = (p: any, week: number) =>
  p.weeksData.find((w: any) => w.week === week)?.sessions.flatMap((s: any) => s.exercises).find((e: any) => e.id === 'bench_bar');

describe('Э2.2 — разминочная лестница и топ-сет/бэкоффы', () => {
  it('тяж-база 100 кг: разминка 40/60/75% (3 сета), веса возрастают', () => {
    const p = buildCombatPlan(base());
    const bench = benchOf(p, 1);
    const wu = bench.warmupSets || [];
    expect(wu.length).toBe(3);
    expect(wu[0].weight).toBeLessThan(wu[1].weight);
    expect(wu[1].weight).toBeLessThan(wu[2].weight);
    expect(wu[0].weight).toBe(40);
  });

  it('топ-сет + бэкоффы 90% на рабочей неделе; в делоде — ровные сеты', () => {
    const p = buildCombatPlan(base());
    const bench = benchOf(p, 1);
    expect(bench.workSets.length).toBeGreaterThanOrEqual(3);
    expect(bench.workSets[0].weight).toBe(bench.weight);
    expect(bench.workSets[1].weight).toBeLessThan(bench.workSets[0].weight);
    const deload = p.weeksData.find((w: any) => w.deload);
    const benchD = deload.sessions.flatMap((s: any) => s.exercises).find((e: any) => e.id === 'bench_bar');
    if (benchD && benchD.workSets.length >= 2) {
      expect(benchD.workSets.every((s: any) => s.weight === benchD.workSets[0].weight)).toBe(true);
    }
  });

  it('лёгкая шея (≤20 кг) — без разминочной лестницы', () => {
    const p = buildCombatPlan(base({ workMax: { chest: 100, neck: 10 } as any }));
    const neck = p.weeksData[0].sessions.flatMap((s: any) => s.exercises).find((e: any) => e.id === 'neck_harness_ext');
    if (neck) expect((neck.warmupSets || []).length).toBe(0);
  });
});

describe('Э5.3 — размещение кондиции по дням', () => {
  it('suggestedDays: 1→[2], 2→[1,4], 3→[0,2,4]; сессии несут дни', () => {
    expect(conditioningSuggestedDays(1)).toEqual([2]);
    expect(conditioningSuggestedDays(2)).toEqual([1, 4]);
    expect(conditioningSuggestedDays(3)).toEqual([0, 2, 4]);
    const out = conditioningSessionsForWeek(1, 'accumulation', 'power', 2);
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) expect(Array.isArray(s.suggestedDays) && s.suggestedDays.length === 1).toBe(true);
    expect(buildConditioningRationale('power', 2, 8).some(l => l.includes('Размещение'))).toBe(true);
  });
});

describe('Э6 — CB_RU_MODEL и чистый финализатор', () => {
  it('camp_8 в rationale — русской меткой, не сырым id', () => {
    const p = buildCombatPlan(base({ goal: 'camp', periodizationModel: 'camp_8' }));
    const line = p.rationale.find(r => r.includes('модель')) || '';
    expect(line).toContain('Camp 8');
    expect(line).not.toContain('camp_8');
  });

  it('финализатор не читает localStorage HRV: сид без снимка — без warning', () => {
    localStorage.setItem('he_hrv_log', JSON.stringify([40, 41, 40, 39, 42, 41, 40, 41]));
    const plan = buildCombatPlan(base());
    const fin = finalizeCombatPlan(plan);
    expect(fin.validation.warnings.some(w => w.includes('HRV'))).toBe(false);
  });

  it('hrvGrade из снимка плана даёт честный warning', () => {
    const plan = buildCombatPlan(base({ hrvGrade: 'dangerous' } as any));
    const fin = finalizeCombatPlan(plan);
    expect(fin.validation.warnings.some(w => w.includes('HRV'))).toBe(true);
  });
});

beforeEach(() => localStorage.clear());
