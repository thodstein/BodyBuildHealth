import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { injectTAWeakPoints, snapshotTAPlanForInject, rollbackTAPlanInject, hasTAPlanPrev, TA_PLAN_KEY, TA_PLAN_PREV_KEY } from '../strength-sport-ta-injection.engine';
import type { WLWeakPoint } from '../strength-sport-weakpoint';

describe('TA injection PRO — MRV + dedup parity', () => {
  function basePlan() {
    return buildStrengthSportPlan({ mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 4, daysPerWeek: 3, workMax: { snatch: 80, backSquat: 120, deadlift: 160 } } as any);
  }
  it('инъецирует 1 коррекцию на weakPoint', () => {
    const p = basePlan();
    const r = injectTAWeakPoints(p, ['snatch_off_floor' as WLWeakPoint]);
    expect(r.injected).toBe(1);
    expect(r.plan.weeksData[0].sessions.some(s => s.exercises.some(e => e.id === 'deficit_snatch'))).toBe(true);
  });
  it('dedup: повторный вызов не дублирует', () => {
    const p = basePlan();
    const r1 = injectTAWeakPoints(p, ['snatch_off_floor' as WLWeakPoint]);
    const r2 = injectTAWeakPoints(r1.plan, ['snatch_off_floor' as WLWeakPoint]);
    expect(r2.injected).toBe(0);
    expect(r2.skippedDup).toBe(1);
  });
  it('budget cap: при переполнении пропускает', () => {
    const p = basePlan();
    // форсируем низкий budget 5 (невозможно)
    const r = injectTAWeakPoints(p, ['snatch_off_floor' as WLWeakPoint, 'clean_off_floor' as WLWeakPoint], { budget: 5 });
    expect(r.skippedBudget).toBeGreaterThan(0);
  });
  it('dayMap: инъекция в указанный день', () => {
    const p = basePlan();
    const r = injectTAWeakPoints(p, ['jerk_dip' as WLWeakPoint], { dayMap: { jerk_dip: [2] } });
    expect(r.injected).toBe(1);
    expect(r.plan.weeksData[0].sessions[1].exercises.some(e => e.id === 'jerk_dip')).toBe(true);
  });
  it('не мутирует исходный', () => {
    const p = basePlan();
    const before = JSON.stringify(p);
    injectTAWeakPoints(p, ['snatch_mid' as WLWeakPoint]);
    expect(JSON.stringify(p)).toBe(before);
  });
  it('property: 48 combos injection weeklySets ≤ Budget + no NaN', () => {
    const levels: any[] = ['beginner', 'intermediate', 'advanced', 'enhanced'];
    const goals: any[] = ['strength', 'hypertrophy', 'peaking', 'technique'];
    const days = [2, 3, 4];
    let checked = 0;
    for (const level of levels) for (const goal of goals) for (const d of days) {
      const p = buildStrengthSportPlan({ mode: 'weightlifting', goal, level, weeks: 4, daysPerWeek: d, workMax: { snatch: 70, backSquat: 120, deadlift: 150 } } as any);
      const budget = 85 + (level === 'advanced' ? 25 : level === 'enhanced' ? 50 : 0);
      const r = injectTAWeakPoints(p, ['snatch_off_floor' as WLWeakPoint, 'jerk_dip' as WLWeakPoint]);
      const weeklySets = r.plan.weeksData[0].sessions.reduce((a: number, s: any) => a + s.exercises.reduce((aa: number, e: any) => aa + (e.sets || 0), 0), 0);
      expect(weeklySets).toBeLessThanOrEqual(budget + 15); // + inject budget
      expect(Number.isFinite(weeklySets)).toBe(true);
      checked++;
    }
    expect(checked).toBe(48);
  });
  it('property: 192 combos injection (modes×levels×goals×days) without throw', () => {
    const modes: any[] = ['weightlifting', 'strongman', 'hybrid'];
    const levels: any[] = ['beginner', 'intermediate', 'advanced', 'enhanced'];
    const goals: any[] = ['strength', 'hypertrophy', 'peaking', 'technique'];
    const days = [2, 3, 4, 5];
    let checked = 0;
    for (const mode of modes) for (const level of levels) for (const goal of goals) for (const d of days) {
      const p = buildStrengthSportPlan({ mode, goal, level, weeks: 4, daysPerWeek: d, workMax: { snatch: 70, backSquat: 120, deadlift: 150 } } as any);
      const r = injectTAWeakPoints(p, mode === 'weightlifting' ? ['snatch_off_floor' as WLWeakPoint] : mode === 'strongman' ? ['pull_start' as WLWeakPoint] : ['squat_bottom' as WLWeakPoint]);
      expect(r.plan.weeksData.length).toBe(4);
      expect(Number.isFinite(r.plan.weeksData[0].totalSets || 0)).toBe(true);
      checked++;
    }
    expect(checked).toBe(192);
  });
});

describe('TA injection v2 E6 — все недели + preferred + spec + откат', () => {
  function basePlan() {
    return buildStrengthSportPlan({ mode: 'weightlifting', goal: 'strength', level: 'intermediate', weeks: 4, daysPerWeek: 3, workMax: { snatch: 80, backSquat: 120, deadlift: 160 } } as any);
  }
  it('weekIdxs все недели: инъецирует в каждую рабочую', () => {
    const p = basePlan();
    const workIdxs = p.weeksData.map((w: any, i: number) => (w.deload ? -1 : i)).filter((i: number) => i >= 0);
    const r = injectTAWeakPoints(p, ['snatch_off_floor' as WLWeakPoint], { weekIdxs: [0, 1, 2, 3] });
    expect(r.injected).toBe(workIdxs.length);
    for (const wi of workIdxs) {
      expect(r.plan.weeksData[wi].sessions.some((s: any) => s.exercises.some((e: any) => e.id === 'deficit_snatch'))).toBe(true);
    }
  });
  it('preferred идёт первым, повтор ставит fallback', () => {
    const p = basePlan();
    const r1 = injectTAWeakPoints(p, ['snatch_mid' as WLWeakPoint], { preferredCorr: { snatch_mid: 'snatch_pull' } });
    expect(r1.injected).toBe(1);
    expect(r1.plan.weeksData[0].sessions.some((s: any) => s.exercises.some((e: any) => e.id === 'snatch_pull'))).toBe(true);
    const r2 = injectTAWeakPoints(r1.plan, ['snatch_mid' as WLWeakPoint], { preferredCorr: { snatch_mid: 'snatch_pull' } });
    expect(r2.injected).toBe(1); // fallback pause_snatch
    expect(r2.skippedDup).toBe(1);
  });
  it('targetSetsByWeek: волна 3→4', () => {
    const p = basePlan();
    const r = injectTAWeakPoints(p, ['jerk_dip' as WLWeakPoint], {
      weekIdxs: [0, 2],
      targetSetsByWeek: [{}, {}, { jerk_dip: 4 }],
    });
    const w0 = r.plan.weeksData[0].sessions.flatMap((s: any) => s.exercises).find((e: any) => e.id === 'jerk_dip');
    const w2 = r.plan.weeksData[2].sessions.flatMap((s: any) => s.exercises).find((e: any) => e.id === 'jerk_dip');
    expect(w0.sets).toBe(3);
    expect(w2.sets).toBe(4);
  });
  it('snapshot/rollback round-trip', () => {
    let store: any = {};
    const orig = (global as any).localStorage;
    (global as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    } as any;
    try {
      expect(snapshotTAPlanForInject()).toBe(false);
      store[TA_PLAN_KEY] = JSON.stringify({ v: 1 });
      expect(snapshotTAPlanForInject()).toBe(true);
      expect(hasTAPlanPrev()).toBe(true);
      store[TA_PLAN_KEY] = JSON.stringify({ v: 2 });
      expect(rollbackTAPlanInject()).toBe(true);
      expect(JSON.parse(store[TA_PLAN_KEY]).v).toBe(1);
      expect(hasTAPlanPrev()).toBe(false);
      expect(store[TA_PLAN_PREV_KEY]).toBeUndefined();
    } finally {
      (global as any).localStorage = orig;
    }
  });
});
