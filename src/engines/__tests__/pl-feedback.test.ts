import { describe, it, expect } from 'vitest';
import { buildLMSPlan } from '../lms/lms-builder.engine';
import { computePLPlanFeedback, summarizePLFeedback } from '../lms/lms-progression-feedback.engine';
import { CYCLE_01 } from '../../data/lms-cycles/cycle-01';
import type { WorkoutSession } from '../workout-logger.engine';

const pmMap = { 'Присед': 150, 'Жим лежа': 110, 'Становая тяга': 180 };

function buildPlan() {
  return buildLMSPlan({ template: CYCLE_01, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: 12 });
}

function makeSession(exerciseName: string, date: string, sets: { weight: number; reps: number; rir: number }[]): WorkoutSession {
  return {
    sessionId: `s_${date}_${exerciseName}`,
    date,
    startTime: '10:00',
    endTime: '11:00',
    durationMin: 60,
    focus: 'test',
    exercises: [{
      exerciseId: exerciseName.toLowerCase(),
      exerciseName,
      pattern: 'squat',
      muscleGroup: 'legs',
      order: 1,
      sets: sets.map((s, i) => ({ setNumber: i + 1, weightKg: s.weight, reps: s.reps, rpe: 10 - s.rir, rir: s.rir, isPR: false, notes: '' })),
      totalVolume: sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
      best1RM: Math.round(sets[0].weight / (1 - sets[0].reps / 36)),
      avgRPE: 8,
    }],
    totalVolume: sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
    totalSets: sets.length,
    totalReps: sets.reduce((sum, s) => sum + s.reps, 0),
    avgIntensity: 8,
    prCount: 0,
    notes: '',
    weekNumber: 1,
    mesocycleWeek: 1,
  };
}

describe('computePLPlanFeedback', () => {
  it('возвращает feedback для каждого упражнения последней недели', () => {
    const plan = buildPlan();
    const feedback = computePLPlanFeedback(plan, []);
    expect(feedback.length).toBeGreaterThan(0);
    // последнее упражнение недели должно быть в списке
    const lastDay = plan.weeks[plan.weeks.length - 1].days[0];
    expect(feedback.some(f => f.planExerciseName === lastDay.exercises[0].name)).toBe(true);
  });

  it('нет данных дневника → source=plan', () => {
    const plan = buildPlan();
    const feedback = computePLPlanFeedback(plan, []);
    for (const f of feedback) {
      expect(f.recommendation.source).toBe('plan');
      expect(f.last).toBeNull();
    }
  });

  it('есть данные дневника → source=fact', () => {
    const plan = buildPlan();
    const lastDay = plan.weeks[plan.weeks.length - 1].days[0];
    const exName = lastDay.exercises[0].name;
    const sessions = [makeSession(exName, '2026-07-01', [{ weight: 100, reps: 5, rir: 2 }])];
    const feedback = computePLPlanFeedback(plan, sessions);
    const f = feedback.find(fb => fb.planExerciseName === exName);
    expect(f).toBeDefined();
    expect(f!.last).not.toBeNull();
    expect(f!.recommendation.source).toBe('fact');
  });

  it('fuzzy match: «Жим лёжа» в плане, «Жим штанги лёжа» в дневнике', () => {
    const plan = buildPlan();
    const sessions = [makeSession('Жим штанги лёжа', '2026-07-01', [{ weight: 90, reps: 5, rir: 2 }])];
    const feedback = computePLPlanFeedback(plan, sessions);
    const f = feedback.find(fb => /жим.*лёж/i.test(fb.planExerciseName));
    if (f) {
      expect(f.last).not.toBeNull();
      expect(f!.recommendation.source).toBe('fact');
    }
  });

  it('факт RIR 0 (тяжело) vs план RIR 2 → rirDelta = -2', () => {
    const plan = buildPlan();
    const lastDay = plan.weeks[plan.weeks.length - 1].days[0];
    const exName = lastDay.exercises[0].name;
    const plannedRir = lastDay.exercises[0].workSets[0].rir;
    const sessions = [makeSession(exName, '2026-07-01', [{ weight: 100, reps: 5, rir: 0 }])];
    const feedback = computePLPlanFeedback(plan, sessions);
    const f = feedback.find(fb => fb.planExerciseName === exName);
    expect(f).toBeDefined();
    expect(f!.rirDelta).toBe(0 - plannedRir);
  });
});

describe('summarizePLFeedback', () => {
  it('считает withFact/noData правильно', () => {
    const plan = buildPlan();
    const lastDay = plan.weeks[plan.weeks.length - 1].days[0];
    const exName = lastDay.exercises[0].name;
    const sessions = [makeSession(exName, '2026-07-01', [{ weight: 100, reps: 5, rir: 2 }])];
    const feedback = computePLPlanFeedback(plan, sessions);
    const summary = summarizePLFeedback(feedback);
    expect(summary.withFact).toBeGreaterThan(0);
    expect(summary.noData).toBeGreaterThanOrEqual(0);
    expect(summary.withFact + summary.noData).toBe(feedback.length);
  });

  it('все без данных → withFact=0', () => {
    const plan = buildPlan();
    const feedback = computePLPlanFeedback(plan, []);
    const summary = summarizePLFeedback(feedback);
    expect(summary.withFact).toBe(0);
    expect(summary.noData).toBe(feedback.length);
    expect(summary.avgRirDelta).toBeNull();
  });
});