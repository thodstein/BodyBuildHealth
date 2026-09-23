import { describe, expect, it } from 'vitest';
import {
  taperWeeksForFatigue,
  peakWeekAttempts,
  warmupSequence,
  taperPlan,
  LAST_HEAVY_DAYS,
} from '../taper.engine';
import { taperCurve } from '../mesocycle-progression.engine';

const default1RM = { squat: 200, bench: 140, deadlift: 240 };

describe('taperWeeksForFatigue', () => {
  it('high fatigue → 3 weeks', () => expect(taperWeeksForFatigue(75)).toBe(3));
  it('medium fatigue → 2 weeks', () => expect(taperWeeksForFatigue(50)).toBe(2));
  it('low fatigue → 1 week', () => expect(taperWeeksForFatigue(30)).toBe(1));
  it('boundary 70 → 3 weeks', () => expect(taperWeeksForFatigue(70)).toBe(3));
  it('boundary 45 → 2 weeks', () => expect(taperWeeksForFatigue(45)).toBe(2));
});

describe('peakWeekAttempts', () => {
  it('balanced strategy: opener < second < third', () => {
    const a = peakWeekAttempts(default1RM, 'balanced');
    expect(a.squat.opener).toBeLessThan(a.squat.second);
    expect(a.squat.second).toBeLessThan(a.squat.third);
    expect(a.bench.opener).toBeLessThan(a.bench.third);
    expect(a.deadlift.opener).toBeLessThan(a.deadlift.third);
    expect(a.strategy).toBe('balanced');
  });

  it('conservative: third = 100% of 1RM', () => {
    const a = peakWeekAttempts(default1RM, 'conservative');
    expect(a.squat.third).toBe(200);
  });

  it('aggressive: third > 100% of 1RM', () => {
    const a = peakWeekAttempts(default1RM, 'aggressive');
    expect(a.squat.third).toBeGreaterThan(200);
  });
});

describe('warmupSequence', () => {
  it('returns 5 steps with increasing % and decreasing reps', () => {
    const seq = warmupSequence(200);
    expect(seq).toHaveLength(5);
    expect(seq[0].percent).toBeLessThan(seq[4].percent);
    expect(seq[0].reps).toBeGreaterThanOrEqual(seq[4].reps);
    expect(seq[4].reps).toBe(1);
  });

  it('weights are rounded to 0.5', () => {
    const seq = warmupSequence(185);
    for (const s of seq) {
      expect(s.weight % 0.05).toBeCloseTo(0, 1);
    }
  });
});

describe('LAST_HEAVY_DAYS', () => {
  it('deadlift is earliest, bench is latest', () => {
    expect(LAST_HEAVY_DAYS.deadlift).toBeGreaterThan(LAST_HEAVY_DAYS.bench);
    expect(LAST_HEAVY_DAYS.squat).toBeGreaterThan(LAST_HEAVY_DAYS.bench);
  });
});

describe('taperPlan', () => {
  it('produces valid structure with sessions per week', () => {
    const plan = taperPlan('2026-08-15', default1RM, 60, 'balanced');
    expect(plan.taperWeeks).toBe(2);
    expect(plan.weeks).toHaveLength(2);
    expect(plan.attempts.squat.opener).toBeGreaterThan(0);
    expect(plan.meetDayInstructions.length).toBeGreaterThan(0);
    expect(plan.taperCurve.length).toBe(2);
  });

  it('3-week taper has 3 week entries', () => {
    const plan = taperPlan('2026-08-15', default1RM, 80, 'aggressive');
    expect(plan.taperWeeks).toBe(3);
    expect(plan.weeks).toHaveLength(3);
  });

  it('last week has priming sessions (low reps, low percent)', () => {
    const plan = taperPlan('2026-08-15', default1RM, 50, 'balanced');
    const lastWeek = plan.weeks[plan.weeks.length - 1];
    const lastSession = lastWeek.sessions[lastWeek.sessions.length - 1];
    expect(lastSession.exercises.every(e => e.reps <= 2)).toBe(true);
  });

  // §3 ПЛ-плана: кривая тапера идёт через канон buildPLTaperCurve (mode 'pro');
  // числа 1-в-1 с P7 taperCurve (сведение не сдвинуло отображение TaperPlannerTab).
  it('taperCurve — паритет с каноном (mode pro = P7-кривая, числа 1-в-1)', () => {
    for (const fatigue of [30, 60, 80]) {
      const plan = taperPlan('2026-08-15', default1RM, fatigue, 'balanced');
      const direct = taperCurve(plan.taperWeeks, 0.90);
      expect(plan.taperCurve).toHaveLength(direct.length);
      plan.taperCurve.forEach((tw, i) => {
        expect(tw.week, `w${i}`).toBe(direct[i].week);
        expect(tw.volumePctOfPeak, `w${i} vol`).toBeCloseTo(direct[i].volumePctOfPeak, 10);
        expect(tw.intensityPct, `w${i} int`).toBeCloseTo(direct[i].intensityPct, 10);
        expect(tw.rir, `w${i} rir`).toBe(direct[i].rir);
      });
    }
  });

  it('якоря 2-недельной кривой: 0.65/0.89/RIR2 → 0.45/0.90/RIR1 (r2-округление)', () => {
    const plan = taperPlan('2026-08-15', default1RM, 60, 'balanced');
    expect(plan.taperCurve[0].volumePctOfPeak).toBeCloseTo(0.65, 10);
    expect(plan.taperCurve[0].intensityPct).toBeCloseTo(0.89, 10);
    expect(plan.taperCurve[0].rir).toBe(2);
    expect(plan.taperCurve[1].volumePctOfPeak).toBeCloseTo(0.45, 10);
    expect(plan.taperCurve[1].intensityPct).toBeCloseTo(0.90, 10);
    expect(plan.taperCurve[1].rir).toBe(1);
  });
});
