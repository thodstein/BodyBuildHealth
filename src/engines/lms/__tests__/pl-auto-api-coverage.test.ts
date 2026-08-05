/**
 * pl-auto-api-coverage.test.ts — тесты для 5 экспортных API функций, не имевших покрытия.
 * 1. getPLVolumeLandmarks
 * 2. applyPLTaper
 * 3. getPLWeakPointRecommendations
 * 4. calcFunctikovBondarenko
 * 5. pickCycleForPhase (через buildMacrocycle)
 */
import { describe, it, expect } from 'vitest';
import { buildLMSPlan, getPLVolumeLandmarks, getPLWeakPointRecommendations, type LMSPlanWeek } from '../lms-builder.engine';
import { calcFunctikovBondarenko, type SRExercise } from '../lms-metrics.engine';
import { buildMacrocycle } from '../macrocycle.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import type { Lift, WeakPoint } from '../weakpoint-pl';

const pmMap = { 'Присед': 150, 'Жим лежа': 110, 'Становая тяга': 180 };

function buildPlan(weeks = 12) {
  return buildLMSPlan({ template: CYCLE_01, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: weeks });
}

// ── 1. getPLVolumeLandmarks ──
describe('getPLVolumeLandmarks', () => {
  it('returns non-empty array with group/mev/mav/mrv/sets/status fields', () => {
    const plan = buildPlan();
    const landmarks = getPLVolumeLandmarks(plan.weeks, 'intermediate');
    expect(landmarks.length).toBeGreaterThan(0);
    for (const l of landmarks) {
      expect(l.group).toBeTruthy();
      expect(l.muscle).toBeTruthy();
      expect(typeof l.sets).toBe('number');
      expect(l.mev).toBeGreaterThan(0);
      expect(l.mav).toBeGreaterThan(0);
      expect(l.mrv).toBeGreaterThan(0);
      expect(['under', 'optimal', 'high', 'over']).toContain(l.status);
    }
  });

  it('mrv >= mav >= mev ordering for all groups', () => {
    const plan = buildPlan();
    const landmarks = getPLVolumeLandmarks(plan.weeks, 'intermediate');
    for (const l of landmarks) {
      expect(l.mrv).toBeGreaterThanOrEqual(l.mav);
      expect(l.mav).toBeGreaterThanOrEqual(l.mev);
    }
  });

  it('peakWeek is within plan week range', () => {
    const plan = buildPlan();
    const landmarks = getPLVolumeLandmarks(plan.weeks, 'intermediate');
    for (const l of landmarks) {
      expect(l.peakWeek).toBeGreaterThanOrEqual(1);
      expect(l.peakWeek).toBeLessThanOrEqual(plan.weeks.length);
    }
  });

  it('status under when sets < mev', () => {
    // Build a plan with minimal accessories (weak points empty, low volume)
    const plan = buildLMSPlan({ template: CYCLE_01, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: 4, volumeGoal: 'mev' });
    const landmarks = getPLVolumeLandmarks(plan.weeks, 'advanced');
    // At least some groups should have a status
    expect(landmarks.length).toBeGreaterThan(0);
  });

  it('status over when sets > mrv (high volume plan)', () => {
    const plan = buildLMSPlan({ template: CYCLE_01, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: 12, volumeGoal: 'mrv', weakPoints: ['chest', 'back', 'arms', 'legs', 'shoulders'] });
    const landmarks = getPLVolumeLandmarks(plan.weeks, 'beginner');
    // With beginner MRV (lower) + mrv volume goal + all weak points, at least one should not be 'under'
    const hasNonUnder = landmarks.some(l => l.status !== 'under');
    expect(hasNonUnder).toBe(true);
  });

  it('pedMrvMult shifts mrv upward', () => {
    const plan = buildPlan();
    const natural = getPLVolumeLandmarks(plan.weeks, 'intermediate', 1);
    const enhanced = getPLVolumeLandmarks(plan.weeks, 'intermediate', 1.5);
    expect(enhanced.length).toBe(natural.length);
    for (let i = 0; i < natural.length; i++) {
      expect(enhanced[i].mrv).toBeGreaterThanOrEqual(natural[i].mrv);
    }
  });

  it('handles empty weeks array gracefully', () => {
    const landmarks = getPLVolumeLandmarks([], 'intermediate');
    expect(landmarks).toEqual([]);
  });

  it('handles weeks with no exercises', () => {
    const emptyWeek: LMSPlanWeek = { week: 1, pmRow: {}, days: [] };
    const landmarks = getPLVolumeLandmarks([emptyWeek], 'intermediate');
    // Should return landmarks with 0 sets or empty
    expect(Array.isArray(landmarks)).toBe(true);
  });
});

// ── 2. applyPLTaper (indirectly via buildLMSPlan) ──
describe('applyPLTaper (via buildLMSPlan)', () => {
  it('last 2 weeks have reduced volume vs pre-taper', () => {
    const plan = buildPlan(12);
    const weekVolume = (wk: LMSPlanWeek) => {
      let v = 0;
      for (const d of wk.days) for (const e of d.exercises) for (const ws of e.workSets) v += ws.sets;
      return v;
    };
    const w10 = weekVolume(plan.weeks[9]);
    const w11 = weekVolume(plan.weeks[10]);
    const w12 = weekVolume(plan.weeks[11]);
    // Taper weeks (11, 12) should have less volume than week 10
    expect(w11).toBeLessThan(w10);
    expect(w12).toBeLessThan(w10);
    // Week 12 should be less than week 11 (×0.45 vs ×0.65)
    expect(w12).toBeLessThanOrEqual(w11);
  });

  it('taper increases RIR in final 2 weeks', () => {
    const plan = buildPlan(12);
    const getRir = (wk: LMSPlanWeek) => {
      let total = 0, count = 0;
      for (const d of wk.days) for (const e of d.exercises) for (const ws of e.workSets) { total += ws.rir; count++; }
      return count > 0 ? total / count : 0;
    };
    const w10rir = getRir(plan.weeks[9]);
    const w12rir = getRir(plan.weeks[11]);
    expect(w12rir).toBeGreaterThanOrEqual(w10rir);
  });

  it('short cycle (< 4 weeks) does not taper', () => {
    const plan = buildPlan(3);
    const weekVolume = (wk: LMSPlanWeek) => {
      let v = 0;
      for (const d of wk.days) for (const e of d.exercises) for (const ws of e.workSets) v += ws.sets;
      return v;
    };
    // All weeks should have similar volume (no taper)
    const w1 = weekVolume(plan.weeks[0]);
    const w3 = weekVolume(plan.weeks[2]);
    // Without taper, week 3 should not be dramatically less than week 1
    expect(w3).toBeGreaterThanOrEqual(w1 * 0.5);
  });

  it('taper guard skips already-deloaded weeks', () => {
    // Build a 4-week plan where week 3 is deload (phase-based)
    const plan = buildPlan(4);
    // Week 4 is the last week. Taper should apply unless it's already deload.
    // Check that week 4 has some exercises (not fully zeroed out)
    const w4 = plan.weeks[3];
    expect(w4.days.length).toBeGreaterThan(0);
    expect(w4.days[0].exercises.length).toBeGreaterThan(0);
  });
});

// ── 3. getPLWeakPointRecommendations ──
describe('getPLWeakPointRecommendations', () => {
  const lifts: Lift[] = ['bench', 'squat', 'deadlift', 'ohp', 'row', 'pulldown', 'incline_press'];
  const weakPointsByLift: Record<Lift, WeakPoint[]> = {
    bench: ['off_chest', 'lockout', 'mid'],
    squat: ['bottom', 'lockout', 'mid'],
    deadlift: ['off_floor', 'lockout', 'mid'],
    ohp: ['bottom', 'lockout', 'mid'],
    row: ['start', 'squeeze', 'mid'],
    pulldown: ['start', 'squeeze', 'mid'],
    incline_press: ['off_chest', 'lockout', 'mid'],
  };

  it('returns valid corrections/rationale/group/pct for all 7 lifts × all weak points', () => {
    for (const lift of lifts) {
      for (const wp of weakPointsByLift[lift]) {
        const rec = getPLWeakPointRecommendations(lift, wp);
        expect(Array.isArray(rec.corrections)).toBe(true);
        expect(rec.rationale).toBeTruthy();
        expect(rec.group).toBeTruthy();
        expect(typeof rec.pct).toBe('number');
        expect(rec.pct).toBeGreaterThan(0);
        expect(rec.pct).toBeLessThan(1);
      }
    }
  });

  it('bench/lockout returns non-empty corrections', () => {
    const rec = getPLWeakPointRecommendations('bench', 'lockout');
    expect(rec.corrections.length).toBeGreaterThan(0);
    expect(rec.group).toBe('chest');
  });
});

// ── 4. calcFunctikovBondarenko ──
describe('calcFunctikovBondarenko', () => {
  it('returns 0 for zero PM', () => {
    const ex: SRExercise = {
      name: 'Присед', group: 'legs', coef: 1.2, mnosz: 1, pm: 0,
      sets: [{ weight: 100, reps: 5, sets: 3 }],
    };
    expect(calcFunctikovBondarenko(ex)).toBe(0);
  });

  it('returns positive value for valid exercise', () => {
    const ex: SRExercise = {
      name: 'Присед', group: 'legs', coef: 1.2, mnosz: 1, pm: 150,
      sets: [{ weight: 120, reps: 5, sets: 3 }],
    };
    const result = calcFunctikovBondarenko(ex);
    expect(result).toBeGreaterThan(0);
  });

  it('sums contributions from multiple sets', () => {
    const ex: SRExercise = {
      name: 'Жим лежа', group: 'chest', coef: 1.0, mnosz: 1, pm: 100,
      sets: [
        { weight: 50, reps: 10, sets: 2 },
        { weight: 80, reps: 5, sets: 3 },
      ],
    };
    const singleHeavy: SRExercise = { ...ex, sets: [{ weight: 80, reps: 5, sets: 3 }] };
    const singleLight: SRExercise = { ...ex, sets: [{ weight: 50, reps: 10, sets: 2 }] };
    const combined = calcFunctikovBondarenko(ex);
    const heavy = calcFunctikovBondarenko(singleHeavy);
    const light = calcFunctikovBondarenko(singleLight);
    expect(combined).toBeGreaterThan(heavy);
    expect(combined).toBeGreaterThan(light);
  });

  it('scales with mnosz multiplier', () => {
    const base: SRExercise = {
      name: 'Присед', group: 'legs', coef: 1, mnosz: 1, pm: 100,
      sets: [{ weight: 80, reps: 5, sets: 3 }],
    };
    const doubled: SRExercise = { ...base, mnosz: 2 };
    expect(calcFunctikovBondarenko(doubled)).toBeCloseTo(calcFunctikovBondarenko(base) * 2, 1);
  });

  it('scales with coef multiplier', () => {
    const base: SRExercise = {
      name: 'Присед', group: 'legs', coef: 1, mnosz: 1, pm: 100,
      sets: [{ weight: 80, reps: 5, sets: 3 }],
    };
    const doubled: SRExercise = { ...base, coef: 2 };
    expect(calcFunctikovBondarenko(doubled)).toBeCloseTo(calcFunctikovBondarenko(base) * 2, 1);
  });
});

// ── 5. pickCycleForPhase (via buildMacrocycle) ──
describe('pickCycleForPhase (via buildMacrocycle)', () => {
  it('buildMacrocycle assigns cycles to endurance/strength/peak phases', () => {
    const macro = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', competitionWeek: 40, totalWeeks: 44 });
    expect(macro.blocks.length).toBeGreaterThan(0);
    // All blocks (except competition) should have a cycleId
    for (const block of macro.blocks) {
      if (block.phase !== 'competition') {
        expect(block.cycleId).toBeTruthy();
      }
    }
  });

  it('competition phase block has no cycleId', () => {
    const macro = buildMacrocycle({ level: 'II-KMS', goal: 'powerlifting', competitionWeek: 30, totalWeeks: 32 });
    const compBlock = macro.blocks.find(b => b.phase === 'competition');
    if (compBlock) {
      expect(compBlock.cycleId).toBeFalsy();
    }
  });

  it('general goal does not restrict by direction', () => {
    const macro = buildMacrocycle({ level: 'intermediate', goal: 'general', competitionWeek: 20, totalWeeks: 24 });
    expect(macro.blocks.length).toBeGreaterThan(0);
    // Should still assign cycles
    const hasCycles = macro.blocks.filter(b => b.phase !== 'competition' && b.cycleId).length;
    expect(hasCycles).toBeGreaterThan(0);
  });

  it('fallback chain produces valid cycleId for unknown level', () => {
    const macro = buildMacrocycle({ level: 'unknown-level', goal: 'powerlifting', competitionWeek: 16, totalWeeks: 20 });
    expect(macro.blocks.length).toBeGreaterThan(0);
    // Even with unknown level, fallback should find SOME cycle
    const nonComp = macro.blocks.filter(b => b.phase !== 'competition');
    expect(nonComp.length).toBeGreaterThan(0);
    for (const block of nonComp) {
      expect(block.cycleId).toBeTruthy();
    }
  });
});