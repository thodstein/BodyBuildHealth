import { describe, it, expect } from 'vitest';
import { buildStrengthSportPlan } from '../strength-sport-builder.engine';
import { auditTAPlan } from '../strength-sport-ta-plan-audit.engine';
import { diagnoseTAWeakCause } from '../strength-sport-ta-weak-cause.engine';
import { rankCorrectionsForTA } from '../strength-sport-ta-correction-rank.engine';
import { simulateTACorrection } from '../strength-sport-ta-simulator.engine';
import { buildTASpecBlock } from '../strength-sport-ta-spec-block.engine';
import { injectTAWeakPoints } from '../strength-sport-ta-injection.engine';
import type { WLWeakPoint } from '../strength-sport-weakpoint';

describe('TA PRO-v2 parity matrix E17 — полный пайплайн 192 без throw', () => {
  it('modes×levels×goals×days = 192', () => {
    const modes: any[] = ['weightlifting', 'strongman', 'hybrid'];
    const levels: any[] = ['beginner', 'intermediate', 'advanced', 'enhanced'];
    const goals: any[] = ['strength', 'hypertrophy', 'peaking', 'technique'];
    const days = [2, 3, 4, 5];
    const wps: WLWeakPoint[] = ['snatch_mid', 'clean_off_floor', 'jerk_dip'];
    let checked = 0;
    for (const mode of modes) for (const level of levels) for (const goal of goals) for (const d of days) {
      const p = buildStrengthSportPlan({ mode, goal, level, weeks: 6, daysPerWeek: d, workMax: { snatch: 70, backSquat: 120, deadlift: 150 } } as any);
      const a = auditTAPlan(p);
      expect(a.hasPlan).toBe(true);
      expect(Number.isFinite(a.totalSets)).toBe(true);
      const wp = a.worstPhase ?? 'snatch_mid';
      const c = diagnoseTAWeakCause({ zone: wp, factSetsPerWeek: 0 });
      expect(['volume', 'technique', 'mobility', 'fatigue', 'strength']).toContain(c.cause);
      const top = rankCorrectionsForTA(wp, {});
      expect(Array.isArray(top)).toBe(true);
      const s = simulateTACorrection(p, { weakPoint: wp, corrId: top[0]?.id || 'pause_snatch' });
      expect(s === null || Number.isFinite(s.setsTotal)).toBe(true);
      const spec = buildTASpecBlock({ weakPoints: wps, level, weeks: 6 });
      expect(spec.weeks.length).toBe(6);
      const idxs = p.weeksData.map((_: any, i: number) => i);
      const inj = injectTAWeakPoints(p, wps, { weekIdxs: idxs, targetSetsByWeek: spec.weeks.map(w => w.targetSets), dayMap: spec.dayMap });
      expect(Number.isInteger(inj.injected)).toBe(true);
      expect(JSON.stringify(p).length).toBeGreaterThan(0); // исходник жив
      checked++;
    }
    expect(checked).toBe(192);
  });
});
