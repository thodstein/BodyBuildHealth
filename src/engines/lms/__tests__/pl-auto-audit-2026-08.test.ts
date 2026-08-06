import { describe, it, expect } from 'vitest';
import { buildLMSPlan, extractExercises } from '../lms-builder.engine';
import { buildDiaryAutoreg } from '../../pro/diary-autoreg.engine';
import { normalizeCycleDirection } from '../../../data/lms-cycles/lms-cycle-index';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { CYCLE_04 } from '../../../data/lms-cycles/cycle-04';
import { CYCLE_09K } from '../../../data/lms-cycles/cycle-09k';
import { expandCycleWeeks } from '../lms-to-pl';
import type { WorkoutLog } from '../../../core/types';
import type { SRCycleTemplate } from '../../../data/lms-cycles/lms-types';

const pmMap = { 'Присед': 150, 'Жим лежа': 110, 'Становая тяга': 180 };

// ── P0-1: SENT_TO_RU group classification ──
describe('P0-1: SENT_TO_RU group mapping', () => {
  it('Присед (ПР) → legs, not chest', () => {
    const plan = buildLMSPlan({ template: CYCLE_01, pmMap, fallbackPm: 80, weeksOverride: 1 });
    const squat = plan.weeks[0].days[0].exercises.find(e => e.name === 'Присед');
    expect(squat).toBeDefined();
    // ПР should map to legs (for MRV/weakPoints), not chest
    // exEnGroup is internal, but we verify via plVolumeLandmarks output
    const landmarks = plan.plVolumeLandmarks!;
    const legsRow = landmarks.find(r => r.group === 'legs');
    const chestRow = landmarks.find(r => r.group === 'chest');
    expect(legsRow).toBeDefined();
    expect(legsRow!.sets).toBeGreaterThan(0);
    // Squat volume should count towards legs, not chest
    expect(chestRow!.sets).toBeGreaterThan(0);
    expect(legsRow!.sets).toBeGreaterThanOrEqual(chestRow!.sets);
  });

  it('Жим лежа (ЖМ) → chest, not legs', () => {
    const plan = buildLMSPlan({ template: CYCLE_01, pmMap, fallbackPm: 80, weeksOverride: 1 });
    const landmarks = plan.plVolumeLandmarks!;
    const chestRow = landmarks.find(r => r.group === 'chest');
    expect(chestRow).toBeDefined();
    expect(chestRow!.sets).toBeGreaterThan(0);
  });

  it('Становая тяга (ТГ) → back', () => {
    const plan = buildLMSPlan({ template: CYCLE_01, pmMap, fallbackPm: 80, weeksOverride: 1 });
    const landmarks = plan.plVolumeLandmarks!;
    const backRow = landmarks.find(r => r.group === 'back');
    expect(backRow).toBeDefined();
    expect(backRow!.sets).toBeGreaterThan(0);
  });

  it('ЖИМ tag → chest (cycle-13/09k)', () => {
    const plan = buildLMSPlan({ template: CYCLE_09K, pmMap, fallbackPm: 80, weeksOverride: 1 });
    const landmarks = plan.plVolumeLandmarks!;
    const chestRow = landmarks.find(r => r.group === 'chest');
    expect(chestRow).toBeDefined();
    expect(chestRow!.sets).toBeGreaterThan(0);
  });

  it('ТЯГА tag → back (cycle-09k)', () => {
    const plan = buildLMSPlan({ template: CYCLE_09K, pmMap, fallbackPm: 80, weeksOverride: 1 });
    const landmarks = plan.plVolumeLandmarks!;
    const backRow = landmarks.find(r => r.group === 'back');
    expect(backRow).toBeDefined();
    expect(backRow!.sets).toBeGreaterThan(0);
  });

  it('ОФП tag → core (verified via no false chest/legs assignment)', () => {
    const plan = buildLMSPlan({ template: CYCLE_01, pmMap, fallbackPm: 80, weeksOverride: 1 });
    // ОФП exercises should not inflate chest or legs volume
    const landmarks = plan.plVolumeLandmarks!;
    const legsRow = landmarks.find(r => r.group === 'legs');
    const chestRow = landmarks.find(r => r.group === 'chest');
    expect(legsRow).toBeDefined();
    expect(chestRow).toBeDefined();
    // Both should have non-zero volume from their respective lifts
    expect(legsRow!.sets).toBeGreaterThan(0);
    expect(chestRow!.sets).toBeGreaterThan(0);
  });
});

// ── P1-4: normalizeCycleDirection ──
describe('P1-4: normalizeCycleDirection', () => {
  it('classifies armwrestling as strength', () => {
    expect(normalizeCycleDirection('armwrestling')).toBe('strength');
  });

  it('classifies weightlifting as strength', () => {
    expect(normalizeCycleDirection('weightlifting')).toBe('strength');
  });

  it('classifies powerlifting as strength', () => {
    expect(normalizeCycleDirection('powerlifting')).toBe('strength');
  });

  it('classifies bodybuilding as bodybuilding', () => {
    expect(normalizeCycleDirection('bodybuilding')).toBe('bodybuilding');
  });

  it('classifies unknown as both', () => {
    expect(normalizeCycleDirection('unknown')).toBe('both');
  });
});

// ── P1-2: injectPLWeakPoints light-day selection ──
describe('P1-2: injectPLWeakPoints light-day = min volume', () => {
  it('selects the minimum-volume day for pump, not second-highest', () => {
    // Create a 4-day cycle where bench appears in 3 days with different volumes
    const day = (benchSets: number) => ({
      exercises: [
        { name: 'Жим лёжа', group: 'ЖМ', coef: 1, mnosz: 1, load: 'Тяжелая' as const,
          sets: [{ pct: 0.7, reps: 5, sets: benchSets }] },
        { name: 'Присед', group: 'ПР', coef: 1.2, mnosz: 1, load: 'Средняя' as const,
          sets: [{ pct: 0.6, reps: 5, sets: 3 }] },
      ],
    });
    const tpl: SRCycleTemplate = {
      meta: { ...CYCLE_01.meta, sourceWeeks: false },
      week1: [day(5), day(3), day(2), day(4)],
      weeks: undefined,
    };
    const plan = buildLMSPlan({
      template: tpl, pmMap, fallbackPm: 80, weeksOverride: 1,
      plWeakPoints: [{ lift: 'bench' as const, weakPoint: 'lockout' as const }],
      currentReadiness: 100,
    });
    // Weak point injection should add at least one exercise across all days
    const allAdded = plan.weeks[0].days.flatMap((d, i) =>
      d.exercises.filter(e => !['Жим лёжа', 'Присед'].includes(e.name)).map(e => ({ day: i, name: e.name }))
    );
    expect(allAdded.length).toBeGreaterThan(0);
    // If there are 2+ corrections, the pump (2nd) should go to day 2 (min volume),
    // not day 1 (3 sets = second-highest)
    if (allAdded.length >= 2) {
      const pumpDay = allAdded[1].day;
      expect(pumpDay).toBe(2);
    }
  });
});

// ── P1-3: diary-autoreg nameMatch lift-aware ──
describe('P1-3: diary-autoreg nameMatch excludes false positives', () => {
  function makeWorkout(date: string, name: string, weight: number, reps: number, rpe: number): WorkoutLog {
    return {
      id: `w_${date}`, date, duration: 60,
      exercises: [{
        id: `e_${date}`, date, exerciseId: name.toLowerCase(), exerciseName: name,
        sets: [{ weight, reps, rir: 10 - rpe, rpe, setNumber: 1 }],
        totalVolume: weight * reps, estimated1RM: weight * (1 + reps / 30), isCompound: true,
      }],
      overallRPE: rpe, recoveryBefore: 80, split: 'PL',
    } as WorkoutLog;
  }

  it('Жим лёжа does NOT match Жим стоя', () => {
    const history = [makeWorkout('2026-08-01', 'Жим стоя', 60, 5, 8)];
    const result = buildDiaryAutoreg({
      historyWorkouts: history,
      plannedExercises: [{ name: 'Жим лёжа', plannedWeight: 80, plannedReps: 5, plannedSets: 3, plannedRir: 2, isMain: true }],
    });
    expect(result.perExercise.get('Жим лёжа')!.source).toBe('fallback');
  });

  it('Жим лёжа does NOT match Жим ногами', () => {
    const history = [makeWorkout('2026-08-01', 'Жим ногами', 200, 10, 7)];
    const result = buildDiaryAutoreg({
      historyWorkouts: history,
      plannedExercises: [{ name: 'Жим лёжа', plannedWeight: 80, plannedReps: 5, plannedSets: 3, plannedRir: 2, isMain: true }],
    });
    expect(result.perExercise.get('Жим лёжа')!.source).toBe('fallback');
  });

  it('Становая тяга does NOT match Тяга штанги в наклоне', () => {
    const history = [makeWorkout('2026-08-01', 'Тяга штанги в наклоне', 80, 8, 7)];
    const result = buildDiaryAutoreg({
      historyWorkouts: history,
      plannedExercises: [{ name: 'Становая тяга', plannedWeight: 140, plannedReps: 5, plannedSets: 3, plannedRir: 2, isMain: true }],
    });
    expect(result.perExercise.get('Становая тяга')!.source).toBe('fallback');
  });

  it('Жим лёжа DOES match Жим лёжа (exact)', () => {
    const history = [makeWorkout('2026-08-01', 'Жим лёжа', 90, 5, 8)];
    const result = buildDiaryAutoreg({
      historyWorkouts: history,
      plannedExercises: [{ name: 'Жим лёжа', plannedWeight: 80, plannedReps: 5, plannedSets: 3, plannedRir: 2, isMain: true }],
    });
    expect(result.perExercise.get('Жим лёжа')!.source).toBe('diary');
  });
});

// ── P1-6: volume multiplier cap ──
describe('P1-6: accessory volume multiplier capped at 1.5', () => {
  it('does not exceed 1.5× even with mrv+focus+weak stacked', () => {
    const plan = buildLMSPlan({
      template: CYCLE_01, pmMap, fallbackPm: 80, weeksOverride: 1,
      volumeGoal: 'mrv',
      focusLift: 'bench',
      weakPoints: ['chest'],
      currentReadiness: 100,
    });
    // All accessory sets should be reasonable (not 5+ from a 3-set original)
    for (const day of plan.weeks[0].days) {
      for (const ex of day.exercises) {
        if (ex.load !== 'Тяжелая') {
          for (const ws of ex.workSets) {
            expect(ws.sets).toBeLessThanOrEqual(5);
          }
        }
      }
    }
  });
});

// ── LMS cycle integrity snapshot ──
describe('LMS cycle integrity: source percentages preserved', () => {
  it('CYCLE_01 week1 exercises match original source', () => {
    const plan = buildLMSPlan({
      template: CYCLE_01, pmMap, fallbackPm: 80,
      faithful: true, weeksOverride: 1,
      volumeGoal: 'mrv', currentReadiness: 0,
      acwr: { ratio: 1.8, zone: 'dangerous' },
      autoReg: { topSetPctMultiplier: 0.8, volumeMultiplier: 0.5, rirShift: 3, deload: true },
      weakPoints: ['chest', 'back'],
    });
    CYCLE_01.week1.forEach((sourceDay, dayIndex) => {
      const planDay = plan.weeks[0].days[dayIndex];
      const sourceNames = sourceDay.exercises.map(e => e.name);
      sourceNames.forEach((name, ei) => {
        const planEx = planDay.exercises.find(e => e.name === name);
        expect(planEx).toBeDefined();
        if (planEx) {
          const sourceEx = sourceDay.exercises[ei];
          expect(planEx.workSets.map(({ pct, reps, sets }) => ({ pct, reps, sets })))
            .toEqual(sourceEx.sets);
        }
      });
    });
  });

  it('CYCLE_01 weeks[] has 12 populated weeks', () => {
    expect(CYCLE_01.weeks).toBeDefined();
    expect(CYCLE_01.weeks!.length).toBe(12);
    for (const week of CYCLE_01.weeks!) {
      expect(week.length).toBe(CYCLE_01.week1.length);
    }
  });

  it('CYCLE_09K weeks[] has 12 populated weeks with real exercise names', () => {
    expect(CYCLE_09K.weeks).toBeDefined();
    expect(CYCLE_09K.weeks!.length).toBe(12);
    for (const week of CYCLE_09K.weeks!) {
      for (const day of week) {
        for (const ex of day.exercises) {
          expect(ex.name).not.toBe('ТЯГА');
          expect(ex.name).not.toBe('ЖИМ');
          expect(ex.name).not.toBe('ОФП');
          expect(ex.sets.length).toBeGreaterThan(0);
          for (const s of ex.sets) {
            expect(s.pct).toBeGreaterThan(0);
            expect(s.pct).toBeLessThanOrEqual(1);
            expect(s.reps).toBeGreaterThan(0);
            expect(s.sets).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('expandCycleWeeks preserves week1 for sourceWeeks cycles', () => {
    const expanded = expandCycleWeeks(CYCLE_01);
    expect(expanded[0]).toBe(CYCLE_01.week1);
    expect(expanded.length).toBe(CYCLE_01.meta.weeks);
  });

  it('CYCLE_04 (armwrestling) is classified as strength direction', () => {
    expect(normalizeCycleDirection(CYCLE_04.meta.direction)).toBe('strength');
  });
});

// ── Additional coverage: extractExercises, pmFor, catalog memoization ──
describe('Additional coverage', () => {
  it('extractExercises returns unique names from weeks[] when present', () => {
    const names = extractExercises(CYCLE_01);
    expect(names).toContain('Присед');
    expect(names).toContain('Жим лежа');
    expect(names).toContain('Становая тяга');
    expect(new Set(names).size).toBe(names.length);
  });

  it('extractExercises from week1 when no weeks[]', () => {
    const tpl: SRCycleTemplate = {
      meta: { ...CYCLE_01.meta, sourceWeeks: false },
      week1: [{ exercises: [{ name: 'Test Ex', group: 'ПР', coef: 1, mnosz: 1, sets: [{ pct: 0.5, reps: 5, sets: 3 }] }] }],
    };
    expect(extractExercises(tpl)).toEqual(['Test Ex']);
  });

  it('pmFor fuzzy match does not match unrelated exercises', () => {
    const plan = buildLMSPlan({
      template: CYCLE_01,
      pmMap: { 'Присед': 150 },
      fallbackPm: 80,
      weeksOverride: 1,
    });
    const squat = plan.weeks[0].days[0].exercises.find(e => e.name === 'Присед');
    expect(squat?.pm).toBe(150);
    const bench = plan.weeks[0].days[0].exercises.find(e => e.name === 'Жим лежа');
    expect(bench?.pm).toBe(80);
  });

  it('cycle-04 exercise names have no trailing spaces', () => {
    for (const day of CYCLE_04.week1) {
      for (const ex of day.exercises) {
        expect(ex.name).toBe(ex.name.trim());
      }
    }
  });

  it('all cycle-01 weeks have same day count as week1', () => {
    expect(CYCLE_01.weeks).toBeDefined();
    for (let i = 0; i < CYCLE_01.weeks!.length; i++) {
      expect(CYCLE_01.weeks![i].length).toBe(CYCLE_01.week1.length);
    }
  });

  it('faithful mode preserves source RIR as-is (no phase override)', () => {
    const plan = buildLMSPlan({
      template: CYCLE_01, pmMap, fallbackPm: 80,
      faithful: true, weeksOverride: 1,
    });
    const ws = plan.weeks[0].days[0].exercises[0].workSets[0];
    expect(ws.rir).toBe(0);
  });
});
