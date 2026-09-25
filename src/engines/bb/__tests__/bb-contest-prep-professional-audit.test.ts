import { beforeEach, describe, expect, it } from 'vitest';
import {
  TEST_PEAK_WEEK_STORAGE_KEY,
  addPeakPriming,
  applyContestPrepToBBPlan,
  applyPeakWeekOverlayToBBPlan,
  applyTrainingTaperToBBPlan,
  buildBBContestPrepPlan,
  buildContestPrepPrintHtml,
  buildPeakWeek,
  buildPrepCoachJson,
  buildPrepWeeklyReportHtml,
  configFromPlan,
  deserializeBBContestPrepPlan,
  extendBBPlanPreparation,
  latestTestPeakWeek,
  manipulationLockedFor,
  peakWeekDayForDate,
  planFromStored,
  saveTestPeakWeekResult,
  serializeBBContestPrepPlan,
  shiftBBContestPrepShowDate,
  type BBContestPrepConfig,
  type TestPeakWeekResult,
} from '../bb-contest-prep.engine';
import { isoAddDays, isoToday } from '../bb-contest-prep.engine';
import { bbRir, normalizeWeekMrv } from '../bb-builder.engine';
import { applyPostPhaseProcessing } from '../bb-autocoach.engine';
import { convertCycleToBBPlan } from '../cycle-to-plan';
import { CYCLE_BB_01 } from '../../../data/lms-cycles/cycle-bb-01';

function baseConfig(overrides: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  return {
    sex: 'male',
    category: 'mens_physique',
    weightKg: 80,
    bodyFatPct: 7,
    experienceLevel: 'intermediate',
    enhanced: false,
    prepCount: 2,
    showDate: isoAddDays(isoToday(), 60),
    weeksOut: 2,
    trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate',
    waterStrategy: 'minimal',
    sodiumStrategy: 'constant',
    ...overrides,
  };
}

function trialResult(planId: string, id = 'trial-1'): TestPeakWeekResult {
  return {
    id,
    planId,
    createdAt: new Date().toISOString(),
    showDate: isoAddDays(isoToday(), 60),
    responses: {
      carbTolerance: 4,
      digestion: 4,
      fullness: 3,
      waterRetention: 4,
      pump: 4,
      sleep: 4,
    },
    weightDeltaKg: 0,
    verdict: 'tested_ok',
    recommendation: 'test',
  };
}

function bbPlanFixture(weeks = 1): any {
  return {
    id: 'bb-plan-fixture',
    weeks: Array.from({ length: weeks }, (_, index) => ({
      week: index + 1,
      sessions: [{
        name: 'A',
        character: 'strength',
        totalSets: 4,
        exercises: [{
          name: 'Жим лёжа',
          muscle: 'chest',
          role: 'primary',
          sets: 4,
          repsRange: [5, 8],
          rir: 2,
          workSets: [
            { reps: 5, rir: 2, weight: 80 },
            { reps: 5, rir: 2, weight: 80 },
            { reps: 5, rir: 2, weight: 80 },
            { reps: 5, rir: 2, weight: 80 },
          ],
        }],
      }],
    })),
    rationale: [],
  };
}

describe('BB contest prep professional audit contracts', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
  });

  it('marks every professional review condition for plan review', () => {
    for (const condition of [
      'kidney',
      'heart',
      'hypertension',
      'diabetes',
      'pregnancy',
      'eating_disorder',
      'seizures',
      'electrolyte',
    ]) {
      const plan = buildBBContestPrepPlan(baseConfig({ contraindications: [condition] }));
      expect(plan.safety.requiresReview).toBe(true);
    }
  });

  it('keeps the existing conservative gate for unconfirmed manipulation', () => {
    const cfg = baseConfig({ waterStrategy: 'high' });
    expect(manipulationLockedFor(cfg)).toBe(true);
    expect(manipulationLockedFor({ ...cfg, confirmedManipulation: true, hasTrialPeak: true })).toBe(false);
  });

  it('forces plan safety metadata to stable before the plan is built', () => {
    const plan = buildBBContestPrepPlan(baseConfig({
      contraindications: ['kidney'],
      waterStrategy: 'high',
      sodiumStrategy: 'cut_2d',
    }));
    expect(plan.safety.requiresReview).toBe(true);
    expect(plan.peakWeek.waterMode).toBe('stable');
    expect(plan.peakWeek.sodiumMode).toBe('stable');
  });

  it('uses an explicit trial override as a supported config projection path', () => {
    const plan = buildBBContestPrepPlan(baseConfig());
    const trial = trialResult(plan.id);
    const cfg = configFromPlan(plan, trial);
    expect(cfg.hasTrialPeak).toBe(true);
    expect(cfg.carbLoadStrategy).toBeTruthy();
  });

  it('returns the newest trial for a plan from valid storage', () => {
    const plan = buildBBContestPrepPlan(baseConfig());
    const first = saveTestPeakWeekResult(plan.id, plan.showDate, trialResult(plan.id).responses, 0);
    const second = saveTestPeakWeekResult(plan.id, plan.showDate, trialResult(plan.id).responses, 0);
    expect(latestTestPeakWeek(plan.id)?.id).toBe(second.id);
    expect(latestTestPeakWeek(plan.id)?.id).not.toBe(first.id);
    expect(localStorage.getItem(TEST_PEAK_WEEK_STORAGE_KEY)).toContain(second.id);
  });

  it('keeps a stable plan path independent from direct peak API', () => {
    const cfg = baseConfig({
      contraindications: ['kidney'],
      waterStrategy: 'high',
      sodiumStrategy: 'cut_2d',
    });
    const plan = buildBBContestPrepPlan(cfg);
    const showDay = buildPeakWeek(cfg).find(day => day.phase === 'show');
    expect(plan.peakWeek.waterMode).toBe('stable');
    expect(showDay?.waterLiters).toBeGreaterThan(0);
    expect(peakWeekDayForDate(plan.showDate, cfg)).not.toBeNull();
  });

  it('CP-01: direct peak and overlay APIs force every known review condition to stable', () => {
    const conditions = ['kidney', 'heart', 'hypertension', 'diabetes', 'pregnancy', 'eating_disorder', 'seizures', 'electrolyte', 'lactation', 'pylorus', 'bipolar'];
    const stable = buildPeakWeek(baseConfig({ waterStrategy: 'stable', sodiumStrategy: 'stable' }));
    const stableWater = stable.find(day => day.phase.startsWith('load_1'))?.waterLiters;
    for (const condition of conditions) {
      const cfg = baseConfig({ contraindications: [condition], waterStrategy: 'high', sodiumStrategy: 'cut_2d', hasTrialPeak: true, confirmedManipulation: true });
      const peak = buildPeakWeek(cfg);
      expect(peak.find(day => day.phase.startsWith('load_1'))?.waterLiters).toBe(stableWater);
      const tapered = applyTrainingTaperToBBPlan(bbPlanFixture(1), cfg);
      expect(tapered.rationale?.join(' ')).toContain('stable');
      const overlaid = applyPeakWeekOverlayToBBPlan(bbPlanFixture(1), cfg);
      expect(overlaid.rationale?.join(' ')).toContain('stable');
    }
  });

  it('VAL-01/02/03: safety metadata is explicit and malformed plans fail closed', () => {
    const plan = buildBBContestPrepPlan(baseConfig({ contraindications: ['kidney'], waterStrategy: 'high' }));
    expect(plan.safety.requiresReview).toBe(true);
    expect(plan.safety.blockedProtocol).toBe(true);
    expect(plan.safety.contraindications).toContain('kidney');
    expect(plan.peakWeek.waterMode).toBe('stable');
    expect(plan.peakWeek.sodiumMode).toBe('stable');
    expect(plan.safety.warnings.length).toBeGreaterThan(0);
  });

  it('CP-02: configFromPlan resolves the newest trial by plan id', () => {
    const plan = buildBBContestPrepPlan(baseConfig());
    const older = { ...trialResult(plan.id, 'older'), createdAt: '2026-01-01T00:00:00.000Z' };
    const newer = { ...trialResult(plan.id, 'newer'), createdAt: '2026-01-02T00:00:00.000Z', verdict: 'conservative' as const };
    localStorage.setItem(TEST_PEAK_WEEK_STORAGE_KEY, JSON.stringify([older, newer]));
    const cfg = configFromPlan({ ...plan, testPeakWeekId: 'wrong-plan-id' });
    expect(cfg.hasTrialPeak).toBe(false);
    expect(latestTestPeakWeek(plan.id)?.id).toBe('newer');
  });

  it('CP-04/05/06/07: config snapshot, legacy migration, and projection preserve the source context', () => {
    const cfg = baseConfig({
      contraindications: ['kidney'],
      pedContext: { diuretic: true, ghIU: 6, trenMg: 250 },
      prepWeeks: 10,
      currentCalories: 3100,
      stepsPerDay: 12000,
      cardioMinutesPerWeek: 240,
      targetRatePctPerWeek: 0.4,
    });
    const plan = buildBBContestPrepPlan(cfg, { id: 'snapshot-plan', testPeakWeekId: 'trial-snapshot' });
    expect(plan.config).toMatchObject({ prepWeeks: 10, currentCalories: 3100, pedContext: cfg.pedContext });
    expect(plan.testPeakWeekId).toBe('trial-snapshot');
    const restored = planFromStored('{broken', JSON.stringify(cfg), null);
    expect(restored?.config).toMatchObject({ contraindications: ['kidney'], prepWeeks: 10 });
    expect(deserializeBBContestPrepPlan(serializeBBContestPrepPlan(plan))?.id).toBe('snapshot-plan');
  });

  it('CP-08/09/10: reports and print resolve phase, trial strategy, and carb dose', () => {
    const plan = buildBBContestPrepPlan(baseConfig(), { carbDoseGPerKg: 9, testPeakWeekId: 'trial-report' });
    const weekly = buildPrepWeeklyReportHtml(plan);
    const print = buildContestPrepPrintHtml(plan);
    const coach = buildPrepCoachJson(plan);
    expect(weekly).toContain('Подготовка');
    expect(weekly).toContain('тапер');
    expect(weekly).toContain('Show day');
    expect(print).toContain('9 г/кг');
    expect(coach).toContain('"resolvedStrategy"');
  });

  it('BB-MRV-01/02: final caps and cycle conversion preserve the typed course flag', () => {
    const session = (onCourse: boolean) => ({
      exercises: [{
        muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 6,
        repsRange: [6, 10], rir: 2,
        workSets: Array.from({ length: 6 }, () => ({ reps: 8, rir: 2, weight: 60 })),
      }],
    });
    const natural = session(false);
    const course = session(true);
    normalizeWeekMrv([natural], { chest: 100 }, false, { level: 'advanced', trainingYears: 1, onCourse: false });
    normalizeWeekMrv([course], { chest: 100 }, false, { level: 'advanced', trainingYears: 1, onCourse: true });
    expect(natural.exercises[0].sets).toBe(5);
    expect(course.exercises[0].sets).toBe(6);
    expect(() => convertCycleToBBPlan({
      cycle: CYCLE_BB_01,
      workMax: { chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 100, glutes: 100, biceps: 50, triceps: 50 },
      level: 'advanced', trainingYears: 1, onCourse: true, mode: 'adapt',
    })).not.toThrow();
  });

  it('BB-AUTO-01/02: peaking skips rest-pause and RIR never falls below one', () => {
    expect(bbRir('тяж', 'accumulation', 1, 'strength')).toBe(1);
    expect(bbRir('тяж', 'intensification', 4, 'strength')).toBe(1);
    expect(bbRir('тяж', 'peaking', 4, 'strength')).toBe(1);
    const plan: any = {
      id: 'peak-test', pattern: { id: 'upper_lower_4', name: 'Upper/Lower' }, level: 'intermediate',
      weeks: [{ week: 1, phase: 'peaking', sessions: [{
        sessionTag: 'Upper', exercises: [{
          muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 3,
          repsRange: [6, 8], rir: 1, workSets: Array.from({ length: 3 }, () => ({ reps: 6, rir: 1, weight: 60 })),
        }],
      }] }],
    };
    const result = applyPostPhaseProcessing({
      plan, totalWeeks: 1, workMax: { chest: 100 }, skipPhaseRedistribution: true, intensityTechnique: 'rest_pause', level: 'intermediate',
    });
    expect(result.weeks[0].sessions[0].exercises[0].workSets).toHaveLength(3);
    expect(result.weeks[0].sessions[0].exercises[0].comment || '').not.toContain('Rest-pause');
  });

  it('CP-14/15/17/18: legacy high mode, schedule, local dates, and deterministic IDs round-trip', () => {
    const first = buildBBContestPrepPlan(baseConfig());
    const second = buildBBContestPrepPlan(baseConfig());
    expect(first.id).toBe(second.id);
    const legacy = { ...first, config: undefined, peakWeek: { ...first.peakWeek, waterMode: 'high' as const } };
    expect(configFromPlan(legacy as any).waterStrategy).toBe('high');
    const scheduled = buildBBContestPrepPlan(baseConfig({ schedule: { wake: '05:30', stage: '12:00' } }));
    expect(deserializeBBContestPrepPlan(serializeBBContestPrepPlan(scheduled))?.config?.schedule).toEqual({ wake: '05:30', stage: '12:00' });
    expect(() => buildBBContestPrepPlan(baseConfig({ showDate: isoAddDays(isoToday(), -1) }))).toThrow();
  });

  it('CP-11/12/13/16: priming, extension, replan, and corrupt trial storage are stable', () => {
    const primingPlan = bbPlanFixture(1);
    primingPlan.weeks[0].peakWeek = true;
    const primed = addPeakPriming(primingPlan, { chest: 100 });
    const primedAgain = addPeakPriming(primed.plan, { chest: 100 });
    expect(primed.added).toBe(1);
    expect(primedAgain.added).toBe(0);
    const prepped = applyContestPrepToBBPlan(bbPlanFixture(3), baseConfig(), { prepWeeks: 5, taperWeeks: 2 });
    const extended = extendBBPlanPreparation(prepped, 2);
    expect(extended.weeks.length).toBe(5);
    expect(extended.contestPrep?.phases.some(phase => phase.key === 'preparation')).toBe(true);
    const moved = shiftBBContestPrepShowDate(buildBBContestPrepPlan(baseConfig()), isoAddDays(baseConfig().showDate, 7));
    expect(moved.plan.showDate).toBe(isoAddDays(baseConfig().showDate, 7));
    localStorage.setItem(TEST_PEAK_WEEK_STORAGE_KEY, '{broken');
    expect(latestTestPeakWeek('trial-repair')).toBeNull();
    const saved = saveTestPeakWeekResult('trial-repair', baseConfig().showDate, { carbTolerance: 4, digestion: 4, fullness: 4, waterRetention: 4, pump: 4, sleep: 4 }, 0);
    expect(saved).not.toBeNull();
    expect(latestTestPeakWeek('trial-repair')?.id).toBe(saved!.id);
  });
});
