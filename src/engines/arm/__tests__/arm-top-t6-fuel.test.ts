import { describe, it, expect } from 'vitest';
import { buildTendonFuel } from '../arm-tendon-fuel.engine';
import { buildArmWarmup } from '../arm-warmup.engine';
import { checkCnsGuard } from '../arm-cns-guard.engine';

describe('arm TOP T6 fuel + warmup + CNS', () => {
  it('топливо: коллаген 15г + белок 2.2г/кг', () => {
    const f = buildTendonFuel({ bodyWeightKg: 80, tableSession: true });
    expect(f.collagenG).toBe(15);
    expect(f.proteinTargetG).toBe(176);
    expect(f.timingMin).toMatch(/30–60/);
  });
  it('низкий белок — предупреждение', () => {
    const f = buildTendonFuel({ bodyWeightKg: 80, proteinPerKg: 1.2 });
    expect(f.checklist.join(' ')).toMatch(/<1.6/);
  });
  it('разминка стола: 12 мин + ready-go', () => {
    const w = buildArmWarmup('table');
    expect(w.minutes).toBe(12);
    expect(w.readyGoRehearsal).toBe(true);
    expect(w.steps.length).toBeGreaterThanOrEqual(7);
  });
  it('разминка хвата: rice-bucket', () => {
    expect(buildArmWarmup('grip').steps.map((s) => s.title).join(' ')).toMatch(/Rice-bucket/i);
  });
  it('CNS: третий тяжёлый запрещён', () => {
    const r = checkCnsGuard({ heavyGripThisWeek: 2, plannedHeavy: true });
    expect(r.allowed).toBe(false);
    expect(r.volumeMult).toBeLessThan(1);
  });
  it('CNS: тяги <24ч — перенос', () => {
    expect(checkCnsGuard({ heavyGripThisWeek: 0, plannedHeavy: true, hoursSinceHeavyPull: 10 }).allowed).toBe(false);
  });
  it('CNS: серия усталости → делоад', () => {
    const r = checkCnsGuard({ fatigueStreak: 3 });
    expect(r.volumeMult).toBe(0.6);
  });
  it('CNS: чисто — допуск', () => {
    expect(checkCnsGuard({ heavyGripThisWeek: 1, plannedHeavy: true, hoursSinceHeavyPull: 48 }).allowed).toBe(true);
  });
});
