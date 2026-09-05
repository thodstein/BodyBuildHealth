import { describe, it, expect } from 'vitest';
import { injectBBWeakPoints, computeBudgetBBFallback } from '../bb-diagnostics-injection.engine';
import { finalizeBBPlan } from '../bb-finalize.engine';
import type { BBPlan } from '../bb-builder.engine';

function mockPlan(setsPerWeek = 80, level = 'intermediate'): BBPlan {
  return {
    pattern: { id: 'test', name: 'Test', sessionsPerRotation: 4 } as any,
    weeks: [
      { week: 1, sessions: [
        { day: 1, weekOffset: 0, character: 'heavy' as any, exercises: [{ muscle: 'chest', name: 'Жим штанги лёжа', sets: 4, role: 'primary' as const, exerciseName: 'bench_bar', workSets: [{ reps: 8, rir: 2, weight: 80 } as any, { reps: 8, rir: 2, weight: 80 } as any, { reps: 8, rir: 2, weight: 80 } as any, { reps: 8, rir: 2, weight: 80 } as any] } as any] } as any,
        { day: 2, weekOffset: 1, character: 'pump' as any, exercises: [{ muscle: 'back', name: 'Тяга штанги', sets: 4, role: 'primary' as const, exerciseName: 'row_bar', workSets: [{ reps: 10, rir: 2, weight: 60 } as any, { reps: 10, rir: 2, weight: 60 } as any, { reps: 10, rir: 2, weight: 60 } as any, { reps: 10, rir: 2, weight: 60 } as any] } as any] } as any,
      ] } as any,
    ],
    rationale: [],
    level,
  } as any;
}

describe('bb-diagnostics-injection', () => {
  it('injects delt_mid correction 3×10', () => {
    const plan = mockPlan(40, 'intermediate');
    const res = injectBBWeakPoints(plan, ['delt_mid']);
    expect(res.injected).toBe(1);
    expect(res.plan.weeks[0].sessions.some(s => s.exercises.some(e => e.name.toLowerCase().includes('мах') || e.name.toLowerCase().includes('lateral')))).toBe(true);
  });
  it('dedup prevents duplicate', () => {
    const plan = mockPlan();
    // add lateral_raise already
    (plan.weeks[0].sessions[0] as any).exercises.push({ muscle: 'shoulders', name: 'Махи гантелями в стороны', sets: 3, exerciseName: 'lateral_raise', workSets: [] } as any);
    const res = injectBBWeakPoints(plan, ['delt_mid']);
    expect(res.skippedDup).toBe(1);
    expect(res.injected).toBe(0);
  });
  it('budget cap skips when over', () => {
    const plan = mockPlan(200, 'beginner'); // budget for beginner ~110, current 8 sets +3 > budget? Actually weeklySets is 8, not 200. Need to set high current sets.
    // fake large weeklySets by adding many exercises
    const bigPlan = mockPlan();
    // fill to near budget
    for (let i = 0; i < 10; i++) (bigPlan.weeks[0].sessions[0] as any).exercises.push({ muscle: 'chest', name: `Ex${i}`, sets: 5, exerciseName: `ex${i}`, workSets: [] } as any);
    const res = injectBBWeakPoints(bigPlan, ['chest_upper'], { budget: 10 });
    expect(res.skippedBudget).toBe(1);
  });
  it('handles 2 zones same muscle', () => {
    const plan = mockPlan();
    const res = injectBBWeakPoints(plan, ['delt_mid', 'delt_rear']);
    expect(res.injected).toBe(2);
  });
  it('budget fallback level', () => {
    expect(computeBudgetBBFallback('beginner')).toBeGreaterThan(0);
    expect(computeBudgetBBFallback('enhanced')).toBeGreaterThan(computeBudgetBBFallback('beginner'));
  });
  it('weekIdxs targets only listed weeks (deload skipped)', () => {
    const plan = mockPlan() as any;
    plan.weeks.push(JSON.parse(JSON.stringify(plan.weeks[0])));
    plan.weeks.push(JSON.parse(JSON.stringify(plan.weeks[0])));
    (plan.weeks[1] as any).deload = true;
    const res = injectBBWeakPoints(plan, ['delt_mid'], { weekIdxs: [0, 1, 2, 9] });
    expect(res.injected).toBe(2); // нед 0 и 2; делод и вне диапазона пропущены
    expect(res.plan.weeks[0].sessions.some((s: any) => s.exercises.some((e: any) => e.exerciseName === 'lateral_raise'))).toBe(true);
    expect(res.plan.weeks[2].sessions.some((s: any) => s.exercises.some((e: any) => e.exerciseName === 'lateral_raise'))).toBe(true);
  });
  it('weekIdxs all-deload → deload note, no crash', () => {
    const plan = mockPlan() as any;
    (plan.weeks[0] as any).deload = true;
    const res = injectBBWeakPoints(plan, ['delt_mid'], { weekIdxs: [0] });
    expect(res.injected).toBe(0);
    expect(res.notes.join(' ')).toMatch(/делод/);
  });
  // e2e пути приёма внешнего плана: инъекция → revalidate (те же опции, что в BbAutoConstructor) → упражнение живо
  it('injected exercise survives finalizeBBPlan revalidate path', () => {
    const plan = mockPlan() as any;
    const res = injectBBWeakPoints(plan, ['delt_mid'], { budget: 500 });
    expect(res.injected).toBe(1);
    const re = finalizeBBPlan(res.plan as any, {
      reorder: false,
      phaseSafety: true,
      level: 'intermediate',
      ensureMinimumVolume: true,
      controlledRotation: false,
    } as any);
    const found = (re.weeks[0].sessions as any[]).flatMap((s: any) => s.exercises || [])
      .filter((e: any) => String(e.exerciseName || '').toLowerCase() === 'lateral_raise');
    expect(found.length).toBe(1);
    expect(found[0].sets).toBeGreaterThanOrEqual(2);
  });
  it('injected exercise survives revalidate across all weeks', () => {
    const plan = mockPlan() as any;
    plan.weeks.push(JSON.parse(JSON.stringify(plan.weeks[0])));
    const res = injectBBWeakPoints(plan, ['chest_upper'], { budget: 500, allWeeks: true });
    expect(res.injected).toBe(2);
    const re = finalizeBBPlan(res.plan as any, {
      reorder: false,
      phaseSafety: true,
      level: 'intermediate',
      ensureMinimumVolume: true,
      controlledRotation: false,
    } as any);
    for (const w of re.weeks as any[]) {
      const has = (w.sessions as any[]).flatMap((s: any) => s.exercises || [])
        .some((e: any) => String(e.comment || '').includes('ББ-диагностика'));
      expect(has).toBe(true);
    }
  });
  // журнал снапшотов плана (откат на N шагов)
  it('pushPlanSnapshot: порядок, кап, чистка мусора', async () => {
    const mod = await import('../bb-diagnostics-injection.engine');
    let h: any[] = [];
    for (let i = 1; i <= 7; i++) {
      h = mod.pushPlanSnapshot(h, { date: `2026-08-0${i}`, label: `s${i}`, plan: { weeks: [] } });
    }
    expect(h.length).toBe(5);
    expect(h[0].label).toBe('s3');
    expect(h[4].label).toBe('s7');
    expect(mod.pushPlanSnapshot(h, { date: 'x', label: 'bad', plan: null } as any).length).toBe(5);
    expect(mod.pushPlanSnapshot(null, { date: '2026-08-01', label: 'a', plan: {} }).length).toBe(1);
  });
  it('readPlanHistory терпит битые данные', async () => {
    const mod = await import('../bb-diagnostics-injection.engine');
    expect(mod.readPlanHistory('not-json')).toEqual([]);
    expect(mod.readPlanHistory(null)).toEqual([]);
    expect(mod.readPlanHistory([{ date: '2026-08-01' }]).length).toBe(0);
    const ok = mod.readPlanHistory(JSON.stringify([{ date: '2026-08-01', label: 'a', plan: { weeks: [] } }]));
    expect(ok.length).toBe(1);
  });
});
