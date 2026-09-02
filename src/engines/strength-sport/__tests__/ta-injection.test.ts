import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { injectTAWeakPoints } from '../strength-sport-ta-injection.engine';
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
});
