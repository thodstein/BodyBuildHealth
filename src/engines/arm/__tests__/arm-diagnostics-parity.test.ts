import { describe, it, expect } from 'vitest';
import { ARM_WEAK_POINTS, type ArmWeakPoint } from '../arm-biomechanics.engine';
import { diagnoseArmWeakDetailed } from '../arm-weakpoint.engine';
import { rankCorrectionsForArm } from '../arm-correction-rank.engine';
import { simulateArmInjection } from '../arm-simulator.engine';
import { injectArmCorrections } from '../arm-diagnostics-injection.engine';
import { scoreArm } from '../arm-scoring.engine';
import { buildArmPlan } from '../arm-builder.engine';
import { finalizeArmPlan } from '../arm-finalize.engine';

const LEVELS = ['beginner', 'intermediate', 'advanced', 'enhanced'];
const TECHS = ['hook', 'toproll', 'press'];

const PLANS = (() => {
  const out: Record<string, any> = {};
  for (const lvl of LEVELS) {
    const p = buildArmPlan({ discipline: 'armwrestling', patternId: 'arm_3_full', level: lvl, goal: 'strength', technique: 'toproll', weeks: 2, gripFocus: 'support' } as any);
    out[lvl] = finalizeArmPlan(p, { level: lvl });
  }
  return out;
})();

describe('arm P3 E17: parity-матрица 12×3×4', () => {
  it('точек ровно 12', () => {
    expect(ARM_WEAK_POINTS.length).toBe(12);
  });

  for (const wp of ARM_WEAK_POINTS) {
    for (const tech of TECHS) {
      for (const lvl of LEVELS) {
        it(`${wp} × ${tech} × ${lvl}: карточка → топ-3 → Δ → инъекция/честный скип`, () => {
          const d = diagnoseArmWeakDetailed({ weakPoints: [wp as ArmWeakPoint], technique: tech });
          expect(d.weakPoints).toContain(wp as ArmWeakPoint);
          expect(d.biomechCards.length).toBeGreaterThanOrEqual(1);
          expect(d.biomechCards[0].corrections.length).toBeGreaterThanOrEqual(1);

          const top = rankCorrectionsForArm(wp as ArmWeakPoint, { level: lvl });
          expect(top.length).toBe(3);

          const sim = simulateArmInjection(PLANS[lvl], wp as ArmWeakPoint);
          expect(sim).not.toBeNull();
          expect(sim!.coverageAfter).toBeGreaterThanOrEqual(sim!.coverageBefore);

          const res = injectArmCorrections(PLANS[lvl], [wp as ArmWeakPoint], { budget: 500, level: lvl });
          // либо вставлено, либо честный скип с note
          expect(res.injected + res.skippedBudget + res.skippedDup + res.skippedHumerus).toBeGreaterThanOrEqual(1);
          expect(res.notes.length).toBeGreaterThan(0);
          // инвариант: ни одна сессия не переполнена
          for (const wk of res.plan.weeks) {
            for (const sess of wk.sessions) expect(sess.exercises.length).toBeLessThanOrEqual(8);
          }
        });
      }
    }
  }

  it('scoring floors: критика капает 49', () => {
    const s = scoreArm({ weakCount: 3, asymmetryPct: 13, sideSetsWeek1: 10, tendonSets: 23, tendonLimit: 18 });
    expect(s.floors.length).toBeGreaterThan(0);
    expect(s.score).toBeLessThanOrEqual(49);
  });

  it('scoring чисто: floors нет, score высокий', () => {
    const s = scoreArm({ weakCount: 0, asymmetryPct: 3, sideSetsWeek1: 3, tendonSets: 10, tendonLimit: 16 });
    expect(s.floors).toEqual([]);
    expect(s.score).toBeGreaterThanOrEqual(80);
  });
});
