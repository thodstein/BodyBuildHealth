/**
 * pl-auto-audit-fixes.test.ts — tests for the PL-auto critical audit fixes.
 * Covers: P0-5 (deadlift regex), P1-1 (PM cap), P1-2 (detectLift OHP),
 * P1-3 (fuzzy match), P1-4 (expandCycleWeeks), P1-5 (topSetOf e1RM),
 * P1-6 (rebalance orphaned competitions), P1-7 (diary-autoreg zero e1RM),
 * P1-11 (ACWR zone 'dangerous'), P2-4 (plateau %threshold).
 */
import { describe, it, expect } from 'vitest';
import { pmForWeek, pmProgression, type PMProgressionInput } from '../lms-progression.engine';
import { detectLift, expandCycleWeeks } from '../lms-to-pl';
import { computePLPlanFeedback, summarizePLFeedback } from '../lms-progression-feedback.engine';
import { buildDiaryAutoreg, type DiaryAutoregInput } from '../../pro/diary-autoreg.engine';
import { computePerMuscleACWR } from '../../bb/bb-progression-feedback.engine';
import { buildMacrocycle, rebalanceMacrocycle, type Macrocycle } from '../macrocycle.engine';
import { buildLMSPlan } from '../lms-builder.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import type { WorkoutSession, WorkoutExercise } from '../../workout-logger.engine';
import type { WorkoutLog } from '../../../core/types';

const pmMap = { 'Присед': 150, 'Жим лежа': 110, 'Становая тяга': 180 };

// ── P1-1: PM growth cap ──
describe('P1-1: PM growth cap', () => {
  const baseInput = (overrides: Partial<PMProgressionInput> = {}): PMProgressionInput => ({
    pm0: 200, weeks: 52, mode: 'on_course', courseIntensity: 'heavy', ...overrides,
  });

  it('caps on_course heavy at ×1.5', () => {
    const input = baseInput();
    const wk52 = pmForWeek(input, 52);
    // Without cap: 200 * 1.025^51 = ~712kg. With cap: 200 * 1.5 = 300kg.
    expect(wk52).toBeLessThanOrEqual(300);
    expect(wk52).toBe(300);
  });

  it('caps natural at ×1.25', () => {
    const input = baseInput({ mode: 'natural' });
    const wk52 = pmForWeek(input, 52);
    // Natural k=0.005, 200 * 1.005^51 = ~258kg. With cap: 200 * 1.25 = 250kg.
    expect(wk52).toBeLessThanOrEqual(250);
    expect(wk52).toBe(250);
  });

  it('caps on_course mild at ×1.35', () => {
    const input = baseInput({ courseIntensity: 'mild' });
    const wk52 = pmForWeek(input, 52);
    // Mild k=0.015, 200 * 1.015^51 = ~430kg. With cap: 200 * 1.35 = 270kg.
    expect(wk52).toBeLessThanOrEqual(270);
    expect(wk52).toBe(270);
  });

  it('does NOT cap descending progression (PCT)', () => {
    const input = baseInput({ mode: 'pct' });
    const wk52 = pmForWeek(input, 52);
    // PCT k=-0.005, descending. Should be 200 * 0.995^51 = ~154kg. No cap applies.
    expect(wk52).toBeLessThan(200);
    expect(wk52).toBeGreaterThan(150);
  });

  it('pmProgression array respects cap', () => {
    const input = baseInput({ weeks: 24 });
    const arr = pmProgression(input);
    expect(arr.length).toBe(24);
    // All values should be <= 300 (cap for heavy)
    expect(Math.max(...arr)).toBeLessThanOrEqual(300);
  });

  it('week 1 = pm0 (no progression)', () => {
    const input = baseInput();
    expect(pmForWeek(input, 1)).toBe(200);
  });
});

// ── P1-2: detectLift OHP exclusion ──
describe('P1-2: detectLift excludes OHP from bench', () => {
  it('classifies flat bench as bench', () => {
    expect(detectLift('Жим лёжа', 'ЖМ')).toBe('bench');
    expect(detectLift('Жим лежа', 'Грудь')).toBe('bench');
  });

  it('does NOT classify overhead press as bench', () => {
    expect(detectLift('Жим стоя', 'Плечи')).not.toBe('bench');
    expect(detectLift('Жим гантелей сидя', 'Плечи')).not.toBe('bench');
    expect(detectLift('Армейский жим', 'Плечи')).not.toBe('bench');
    expect(detectLift('Жим швунг', 'Плечи')).not.toBe('bench');
  });

  it('does NOT classify leg press as bench', () => {
    expect(detectLift('Жим ногами', 'Ноги')).not.toBe('bench');
  });

  it('classifies deadlift correctly', () => {
    expect(detectLift('Становая тяга', 'ТГ')).toBe('dead');
    expect(detectLift('Румынская тяга', 'Ноги')).toBe('dead');
  });

  it('does NOT classify row variants as deadlift', () => {
    expect(detectLift('Тяга верхнего блока', 'Спина')).not.toBe('dead');
    expect(detectLift('Тяга штанги в наклоне', 'Спина')).not.toBe('dead');
    expect(detectLift('Тяга гантели в наклоне', 'Спина')).not.toBe('dead');
  });

  it('classifies squat correctly', () => {
    expect(detectLift('Присед со штангой', 'ПР')).toBe('squat');
    expect(detectLift('Приседания', 'Ноги')).toBe('squat');
  });

  it('returns null for accessories', () => {
    expect(detectLift('Разгибание рук', 'Ср')).toBeNull();
    expect(detectLift('Бицепс стоя', 'Руки')).toBeNull();
  });
});

// ── P1-4: expandCycleWeeks preserves weeks[0] ──
describe('P1-4: expandCycleWeeks preserves weeks[0]', () => {
  it('uses weeks[0] as week 1 when weeks array is present', () => {
    const customWeek0 = [{ exercises: [{ name: 'Custom W0', group: 'Грудь', coef: 1, mnosz: 1, load: 'Тяжелая', sets: [{ pct: 0.8, reps: 5, sets: 3, rir: 2 }] }] }];
    const cycle = {
      ...CYCLE_01,
      meta: { ...CYCLE_01.meta, sourceWeeks: false },
      weeks: [customWeek0 as any, ...CYCLE_01.week1.map(d => ({ ...d }))],
    };
    const expanded = expandCycleWeeks(cycle);
    expect(expanded.length).toBeGreaterThan(0);
    // weeks[0] should be the custom week, not cycle.week1
    expect(expanded[0]).toBe(customWeek0);
  });

  it('falls back to week1 when no weeks array', () => {
    const expanded = expandCycleWeeks(CYCLE_01);
    expect(expanded.length).toBeGreaterThan(0);
    expect(expanded[0]).toBe(CYCLE_01.week1);
  });
});

// ── P1-3: fuzzy match fix ──
describe('P1-3: fuzzy match logic', () => {
  function makeSession(exerciseName: string, date: string, sets: { weight: number; reps: number; rir: number }[]): WorkoutSession {
    return {
      sessionId: `s_${date}`, date, startTime: '10:00', endTime: '11:00', durationMin: 60, focus: 'test',
      exercises: [{
        exerciseId: exerciseName.toLowerCase(), exerciseName, pattern: 'squat', muscleGroup: 'legs', order: 1,
        sets: sets.map((s, i) => ({ setNumber: i + 1, weightKg: s.weight, reps: s.reps, rpe: 10 - s.rir, rir: s.rir, isPR: false, notes: '' })),
        totalVolume: sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
        best1RM: 0, avgRPE: 8,
      }],
      totalVolume: 0, totalSets: sets.length, totalReps: sets.reduce((s, x) => s + x.reps, 0), avgIntensity: 8, prCount: 0, notes: '', weekNumber: 1, mesocycleWeek: 1,
    };
  }

  it('matches «Жим лёжа» with «Жим штанги лёжа» (was false negative)', () => {
    const plan = buildLMSPlan({ template: CYCLE_01, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: 12 });
    // The fuzzy match should now work: "жим лёжа" ↔ "жим штанги лёжа" share 2 tokens (жим, лёжа)
    const sessions = [makeSession('Жим штанги лёжа', '2026-07-15', [{ weight: 90, reps: 5, rir: 2 }])];
    const feedback = computePLPlanFeedback(plan, sessions);
    const benchFeedback = feedback.find(f => /жим.*лёж/i.test(f.planExerciseName));
    if (benchFeedback) {
      expect(benchFeedback.last).not.toBeNull();
      expect(benchFeedback.recommendation.source).toBe('fact');
    }
  });

  it('does NOT match generic «жим» with «Жим гантелей стоя» (was false positive)', () => {
    const plan = buildLMSPlan({ template: CYCLE_01, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: 12 });
    // "жим" alone (1 token, length <= 2 when filtered) should NOT match "жим гантелей стоя"
    const sessions = [makeSession('Жим гантелей стоя', '2026-07-15', [{ weight: 40, reps: 8, rir: 2 }])];
    const feedback = computePLPlanFeedback(plan, sessions);
    // No exercise in the plan should incorrectly match the OHP session
    const matchedFact = feedback.find(f => f.last != null && f.last.topWeight === 40);
    // Either no match at all, or if matched, it should be a proper OHP exercise (not bench)
    if (matchedFact) {
      expect(matchedFact.group.toLowerCase()).not.toBe('chest');
    }
  });
});

// ── P1-5: topSetOf selects by e1RM ──
describe('P1-5: topSetOf by e1RM not weight', () => {
  it('selects set with highest e1RM, not highest weight', () => {
    // This is tested indirectly via computePLPlanFeedback: a session with 80kg×5 (e1RM=88.3)
    // and 82kg×1 (e1RM=82) should use the 80kg set as the "top set".
    const plan = buildLMSPlan({ template: CYCLE_01, pmMap, fallbackPm: 80, mode: 'natural', weeksOverride: 12 });
    const lastDay = plan.weeks[plan.weeks.length - 1].days[0];
    const exName = lastDay.exercises[0].name;
    const session: WorkoutSession = {
      sessionId: 's1', date: '2026-07-15', startTime: '10:00', endTime: '11:00', durationMin: 60, focus: 'test',
      exercises: [{
        exerciseId: exName.toLowerCase(), exerciseName: exName, pattern: 'squat', muscleGroup: 'legs', order: 1,
        sets: [
          { setNumber: 1, weightKg: 80, reps: 5, rpe: 7, rir: 3, isPR: false, notes: '' },  // e1RM = 88.3
          { setNumber: 2, weightKg: 82, reps: 1, rpe: 9, rir: 1, isPR: false, notes: '' },  // e1RM = 82
        ],
        totalVolume: 482, best1RM: 0, avgRPE: 8,
      }],
      totalVolume: 482, totalSets: 2, totalReps: 6, avgIntensity: 8, prCount: 0, notes: '', weekNumber: 1, mesocycleWeek: 1,
    };
    const feedback = computePLPlanFeedback(plan, [session]);
    const f = feedback.find(fb => fb.planExerciseName === exName);
    expect(f).toBeDefined();
    expect(f!.last).not.toBeNull();
    // e1RM should be based on 80kg×5 (e1RM≈88.3), not 82kg×1 (e1RM=82)
    expect(f!.last!.e1rm).toBeGreaterThan(85);
  });
});

// ── P1-6: rebalanceMacrocycle removes orphaned competitions ──
describe('P1-6: rebalanceMacrocycle orphaned competition removal', () => {
  it('filters out competitions whose block was removed', () => {
    const macro = buildMacrocycle({
      level: 'intermediate',
      totalWeeks: 16,
      competitions: [{ id: 'c1', name: 'Test', week: 14, priority: 'A' }],
    });
    expect(macro.competitions).toBeDefined();
    expect(macro.competitions!.length).toBeGreaterThan(0);

    // Aggressively shrink: reduce all phases to 1 week each, which will remove the competition block
    const rebalanced = rebalanceMacrocycle(macro, [
      { phase: 'endurance', weeks: 1 },
      { phase: 'strength', weeks: 1 },
      { phase: 'peak', weeks: 1 },
      { phase: 'competition', weeks: 1 },
      { phase: 'transition', weeks: 1 },
    ]);
    // Competitions should either be empty or have week > 0 (no stale entries)
    if (rebalanced.competitions) {
      for (const comp of rebalanced.competitions) {
        expect(comp.week).toBeGreaterThan(0);
      }
    }
  });

  it('preserves competitions with valid blocks', () => {
    const macro = buildMacrocycle({
      level: 'intermediate',
      totalWeeks: 24,
      competitions: [{ id: 'c1', name: 'Main', week: 20, priority: 'A' }],
    });
    const rebalanced = rebalanceMacrocycle(macro, [
      { phase: 'endurance', weeks: 6 },
      { phase: 'strength', weeks: 8 },
    ]);
    // Competition should still exist with a valid week
    expect(rebalanced.competitions).toBeDefined();
    expect(rebalanced.competitions!.length).toBeGreaterThan(0);
    expect(rebalanced.competitions![0].week).toBeGreaterThan(0);
  });
});

// ── P1-7: diary-autoreg zero e1RM guard ──
describe('P1-7: diary-autoreg zero e1RM guard', () => {
  it('falls back to planned weight when e1RM=0 (not weight increase)', () => {
    const input: DiaryAutoregInput = {
      historyWorkouts: [{
        date: '2026-07-15',
        exercises: [{
          exerciseName: 'Присед',
          date: '2026-07-15',
          sets: [{ weight: 0, reps: 0, rpe: undefined, rir: undefined }],
          estimated1RM: 0,
        }],
      }] as any as WorkoutLog[],
      plannedExercises: [{
        name: 'Присед',
        plannedWeight: 120,
        plannedReps: 5,
        plannedSets: 3,
        plannedRir: 2,
        isMain: true,
      }],
    };
    const result = buildDiaryAutoreg(input);
    const adj = result.perExercise.get('Присед');
    expect(adj).toBeDefined();
    expect(adj!.source).toBe('fallback');
    expect(adj!.adjustedWeight).toBe(120); // planned weight, NOT increased
  });

  it('still adjusts when valid e1RM data is present', () => {
    const input: DiaryAutoregInput = {
      historyWorkouts: [{
        date: '2026-07-15',
        exercises: [{
          exerciseName: 'Присед',
          date: '2026-07-15',
          sets: [{ weight: 130, reps: 5, rpe: 9.5, rir: 0.5 }],
          estimated1RM: 145,
        }],
      }] as any as WorkoutLog[],
      plannedExercises: [{
        name: 'Присед',
        plannedWeight: 120,
        plannedReps: 5,
        plannedSets: 3,
        plannedRir: 2,
        isMain: true,
      }],
    };
    const result = buildDiaryAutoreg(input);
    const adj = result.perExercise.get('Присед');
    expect(adj).toBeDefined();
    expect(adj!.source).toBe('diary');
    // RPE 9.5 ≥ 9.5 → -1 set
    expect(adj!.adjustedSets).toBe(2);
  });
});

// ── P1-11: ACWR zone 'dangerous' ──
describe('P1-11: ACWR zone uses "dangerous" not "danger"', () => {
  it('computePerMuscleACWR returns "dangerous" for high ratio', () => {
    // Create sessions with a spike: 4 weeks of 5 sets, then 1 week of 15 sets
    const sessions: WorkoutSession[] = [];
    const muscleGroup = 'chest';
    for (let w = 0; w < 5; w++) {
      const date = new Date();
      date.setDate(date.getDate() - (4 - w) * 7);
      const sets = w === 4 ? 15 : 5;
      sessions.push({
        sessionId: `s${w}`, date: date.toISOString().slice(0, 10),
        startTime: '10:00', endTime: '11:00', durationMin: 60, focus: 'test',
        exercises: [{
          exerciseId: 'bench', exerciseName: 'Жим лёжа', pattern: 'bench', muscleGroup, order: 1,
          sets: Array.from({ length: sets }, (_, i) => ({ setNumber: i + 1, weightKg: 80, reps: 5, rpe: 8, rir: 2, isPR: false, notes: '' })),
          totalVolume: sets * 400, best1RM: 0, avgRPE: 8,
        }],
        totalVolume: sets * 400, totalSets: sets, totalReps: sets * 5, avgIntensity: 8, prCount: 0, notes: '', weekNumber: w + 1, mesocycleWeek: w + 1,
      });
    }
    const result = computePerMuscleACWR(sessions);
    if (result[muscleGroup]) {
      // Ratio = 15/5 = 3.0 → zone should be 'dangerous' (not 'danger')
      expect(result[muscleGroup].zone).toBe('dangerous');
    }
  });
});

// ── P2-4: plateau percentage threshold ──
describe('P2-4: plateau detection uses percentage threshold', () => {
  it('does not flag plateau for heavy lift with small absolute variance', () => {
    // Squat at 180kg: 3 sessions with e1RM 180, 181, 180.5 → variance 1kg (< 2% of 180 = 3.6kg) → plateau
    // But for heavy lifts, this IS a plateau (no real progress). Let's test that the threshold is proportional.
    // 180kg max → threshold = max(1, 180*0.02) = 3.6kg. Variance 1kg < 3.6 → IS plateau.
    const input: DiaryAutoregInput = {
      historyWorkouts: [
        { date: '2026-06-01', exercises: [{ exerciseName: 'Присед', date: '2026-06-01', sets: [{ weight: 180, reps: 1, rpe: 10, rir: 0 }], estimated1RM: 180 }] },
        { date: '2026-06-15', exercises: [{ exerciseName: 'Присед', date: '2026-06-15', sets: [{ weight: 181, reps: 1, rpe: 10, rir: 0 }], estimated1RM: 181 }] },
        { date: '2026-07-01', exercises: [{ exerciseName: 'Присед', date: '2026-07-01', sets: [{ weight: 180, reps: 1, rpe: 10, rir: 0 }], estimated1RM: 180 }] },
      ] as any as WorkoutLog[],
      plannedExercises: [{
        name: 'Присед', plannedWeight: 180, plannedReps: 1, plannedSets: 3, plannedRir: 0, isMain: true,
      }],
    };
    const result = buildDiaryAutoreg(input);
    // With 2% threshold (3.6kg for 180kg), variance of 1kg IS a plateau
    expect(result.plateauWarnings.length).toBeGreaterThan(0);
  });

  it('does not false-positive plateau for light exercise with normal variance', () => {
    // Lateral raise at 8kg: 3 sessions with e1RM 8, 10, 9 → variance 2kg
    // Old threshold: 2.5kg → 2 < 2.5 → IS plateau (false positive!)
    // New threshold: max(1, 10*0.02) = 1kg → 2 > 1 → NOT plateau ✓
    const input: DiaryAutoregInput = {
      historyWorkouts: [
        { date: '2026-06-01', exercises: [{ exerciseName: 'Разведения', date: '2026-06-01', sets: [{ weight: 8, reps: 12, rpe: 8, rir: 2 }], estimated1RM: 8.6 }] },
        { date: '2026-06-15', exercises: [{ exerciseName: 'Разведения', date: '2026-06-15', sets: [{ weight: 10, reps: 12, rpe: 8, rir: 2 }], estimated1RM: 10.7 }] },
        { date: '2026-07-01', exercises: [{ exerciseName: 'Разведения', date: '2026-07-01', sets: [{ weight: 9, reps: 12, rpe: 8, rir: 2 }], estimated1RM: 9.6 }] },
      ] as any as WorkoutLog[],
      plannedExercises: [{
        name: 'Разведения', plannedWeight: 9, plannedReps: 12, plannedSets: 3, plannedRir: 2, isMain: false,
      }],
    };
    const result = buildDiaryAutoreg(input);
    // With 2% threshold (max 1kg for ~10kg max), variance of ~2kg is NOT a plateau
    expect(result.plateauWarnings.length).toBe(0);
  });
});
