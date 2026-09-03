import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { injectArmCorrections } from '../arm-diagnostics-injection.engine';
import type { ArmWeakPoint } from '../arm-biomechanics.engine';

function basePlan(level='intermediate', pattern='arm_3_full') {
  const p = buildArmPlan({ discipline:'armwrestling', patternId: pattern, level, goal:'strength', technique:'toproll', weeks: 4, gripFocus:'support' } as any);
  return finalizeArmPlan(p, {level});
}

describe('arm-diagnostics-injection', () => {
  it('пусто → 0', () => {
    const plan = basePlan();
    const res = injectArmCorrections(plan, []);
    expect(res.injected).toBe(0);
  });
  it('1 точка → 3× в подходящий день (pron_open → TablePronation)', () => {
    const plan = basePlan();
    const beforeSets = plan.weeks[0].sessions.reduce((a,s)=> a+s.exercises.reduce((aa,e)=>aa+e.sets,0),0);
    const res = injectArmCorrections(plan, ['pron_open' as ArmWeakPoint]);
    expect(res.injected).toBe(1);
    expect(res.notes[0]).toContain('pron_open');
    const afterSets = res.plan.weeks[0].sessions.reduce((a,s)=> a+s.exercises.reduce((aa,e)=>aa+e.sets,0),0);
    expect(afterSets).toBe(beforeSets+3);
    // вставленный ex есть (pronation_cable или альтернатива pronation_sledge)
    const found = res.plan.weeks[0].sessions.some(s=> s.exercises.some(e=> ['pronation_cable','pronation_sledge','pronation_strap','indian_clubs'].includes(e.exerciseId||'')));
    expect(found).toBe(true);
  });
  it('dedup: второй раз тот же — skip или альтернатива', () => {
    const plan = basePlan();
    const r1 = injectArmCorrections(plan, ['pron_open' as ArmWeakPoint]);
    const r2 = injectArmCorrections(r1.plan, ['pron_open' as ArmWeakPoint]);
    expect(r1.injected).toBe(1);
    // второй раз — либо инъекция альтернативы, либо skip по dedup/бюджету/tendon
    expect(r2.injected + r2.skippedDup + r2.skippedBudget).toBeGreaterThanOrEqual(1);
    // per-session no duplicate ids (cross-session duplicates allowed)
    for (const sess of r2.plan.weeks[0].sessions) {
      const sids = sess.exercises.map(e=> e.exerciseId).filter(Boolean) as string[];
      expect(new Set(sids).size).toBe(sids.length);
    }
  });
  it('budget: превышение — skipBudget', () => {
    const plan = basePlan();
    const res = injectArmCorrections(plan, ['cup_start','cup_hold','rising_top'] as ArmWeakPoint[], { budget: 10 });
    expect(res.skippedBudget).toBeGreaterThan(0);
  });
  it('humerus guard: side_pin при side 6 — skipHumerus', () => {
    // соберём план где side уже 6
    const plan = basePlan();
    // искусственно накачаем side
    const wp = plan.weeks[0].sessions[0];
    wp.exercises.push({ muscle:'side_pressure', name:'Боковое давление на блоке', role:'primary', character:'тяж', sets:6, repsRange:[3,6], rir:2, workSets:[{reps:5, rir:2, weight:30} as any] } as any);
    const res = injectArmCorrections(plan, ['side_pin' as ArmWeakPoint]);
    expect(res.skippedHumerus).toBeGreaterThan(0);
  });
  it('3 точки max, per-day ≤8, budget ok', () => {
    const plan = basePlan('advanced');
    const res = injectArmCorrections(plan, ['cup_start','pron_lock','back_drag'] as ArmWeakPoint[]);
    expect(res.injected).toBeGreaterThanOrEqual(2);
    expect(res.injected).toBeLessThanOrEqual(3);
    for (const sess of res.plan.weeks[0].sessions) expect(sess.exercises.length).toBeLessThanOrEqual(8);
  });
  it('side inject идёт в SidePress dayTag', () => {
    const plan = basePlan();
    const res = injectArmCorrections(plan, ['side_mid' as ArmWeakPoint]);
    expect(res.injected).toBe(1);
    const target = res.plan.weeks[0].sessions.find(s=> s.exercises.some(e=> ['side_press_cable','side_belt_table','side_press_table','table_pushdown_iso'].includes(e.exerciseId||'')));
    expect(target).toBeTruthy();
  });
});
