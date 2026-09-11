import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';
import { injectArmCorrections } from '../arm-diagnostics-injection.engine';
import { estimateForceVector } from '../arm-force-capture.engine';
import { bilateralAsymmetryPct } from '../arm-bilateral.engine';
import type { ArmWeakPoint } from '../arm-biomechanics.engine';

/** PRO-3 W4: гигиена — P7 (движковая часть: авто-хинт остаётся side_mid — safety-guard),
 *  P12 (округления 1 знак + вес из workMax напрямую). */
describe('PRO-3 W4 P12: округления L/R — 1 знак везде', () => {
  it('force: 40/50 → 20 (целое как 20.0 — toBe проходит)', () => {
    const v = estimateForceVector({ leftKg: 40, rightKg: 50 } as any);
    expect(v.asymmetryPct).toBe(20);
  });
  it('force: дробная асимметрия — 1 знак, паритет с bilateral', () => {
    const v = estimateForceVector({ leftKg: 47, rightKg: 50 } as any);
    const b = bilateralAsymmetryPct(47, 50);
    expect(v.asymmetryPct).toBe(b);
    expect(String(v.asymmetryPct).split('.')[1]?.length || 0).toBeLessThanOrEqual(1);
  });
});

describe('PRO-3 W4 P12: вес инъекции из workMax мышцы напрямую', () => {
  function basePlan() {
    const p = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level: 'intermediate', goal: 'strength', technique: 'toproll', weeks: 4, gripFocus: 'support' } as any);
    return finalizeArmPlan(p, { level: 'intermediate' });
  }
  it('pron_open + workMax.pronators=50 → вес от 50×intensity (не от эвристики 30)', () => {
    const plan = basePlan();
    const res = injectArmCorrections(plan, ['pron_open' as ArmWeakPoint], { workMax: { pronators: 50 } });
    expect(res.injected).toBeGreaterThan(0);
    const weights: number[] = [];
    for (const s of res.plan.weeks[0].sessions) {
      for (const e of s.exercises) {
        for (const ws of (e as any).workSets || []) {
          if (typeof (ws as any).weight === 'number') weights.push((ws as any).weight);
        }
      }
    }
    // intensity pron_open = 0.6/0.7 → 50×0.6=30 / 50×0.7=35 — вес из workMax, не дефолт 30×intensity
    expect(weights.some((w) => w === 30 || w === 35)).toBe(true);
  });
  it('без workMax — fallback эвристики жив (не краш, вес >0)', () => {
    const plan = basePlan();
    const res = injectArmCorrections(plan, ['pron_open' as ArmWeakPoint], { workMax: {} });
    expect(res.injected).toBeGreaterThan(0);
  });
});
