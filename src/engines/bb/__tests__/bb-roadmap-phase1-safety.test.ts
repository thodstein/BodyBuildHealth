/**
 * bb-roadmap-phase1-safety.test.ts — регрессионные тесты Фазы 1 аудита BB-Auto:
 * T-1..T-6 (синдромы травм, поясница vs пресс, временные травмы + реинтеграция,
 *         сниженный стресс/пороги),
 * W-1..W-2 (реалистичные веса изоляции, bodyweight = 0, гантельные блины без штанги),
 * S-1..S-2 (SPEC >= BASE, перенос specializationSchedule при реплане, RIR/e1RM cap).
 */

import { describe, it, expect } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { replanBBMesoFromFact } from '../bb-replan.engine';
import { applyPlateRoundingToPlan } from '../bb-plates.engine';
import { isMobilityRestricted } from '../bb-mobility.engine';
import { calculateSessionStress, calculateWeeklyStress } from '../bb-injury-prevention.engine';
import { expandInjuryMuscle } from '../../manual-plan-builder';
import type { BBBuilderInput, BBSession } from '../bb-builder.engine';

const baseInput: BBBuilderInput = {
  patternId: 'ppl_6',
  level: 'intermediate',
  goal: 'mass',
  weeks: 4,
  workMax: {
    chest: 100,
    back: 100,
    quads: 120,
    hamstrings: 100,
    glutes: 110,
    shoulders: 60,
    biceps: 40,
    triceps: 45,
    calves: 90,
    abs: 20,
    forearms: 35,
    traps: 90,
    lower_back: 100,
  },
  planStartWeek: '2026-11-28',
  rotationMode: 'forbid',
};

describe('BB-Auto Phase 1 — Травмы, мобильность и габариты зала (T-1..T-6)', () => {
  it('T-1: lower_back injury expands only to lower_back (NOT abs) and activates lower_back mobility + avoidAxialLoad', () => {
    const exp = expandInjuryMuscle('lower_back');
    expect(exp).toContain('lower_back');
    expect(exp).not.toContain('abs');

    const plan = buildBBPlan({
      ...baseInput,
      patternId: 'upper_lower_4',
      injuries: [{ muscle: 'lower_back', from: '2026-11-28', jointSyndrome: 'lower_back', exclude: false }],
    });
    const allEx = plan.weeks.flatMap(w => w.sessions.flatMap(s => s.exercises));
    expect(allEx.some(e => e.muscle === 'abs')).toBe(true);
    expect(plan.safetyConstraints?.avoidAxialLoad).toBe(true);
  });

  it('T-1b: joint syndromes trigger targeted mobility checks without blocking safe lifts', () => {
    expect(isMobilityRestricted({ name: 'Армейский жим штанги стоя' }, ['shoulder'])).toBe(true);
    expect(isMobilityRestricted({ name: 'Жим гантелей сидя' }, ['shoulder'])).toBe(false);
    expect(isMobilityRestricted({ name: 'Румынская тяга штанги' }, ['lower_back'])).toBe(true);
    expect(isMobilityRestricted({ name: 'Разгибание ног сидя в тренажёре' }, ['lower_back'])).toBe(false);
    expect(isMobilityRestricted({ name: 'Приседания со штангой на плечах' }, ['hip'])).toBe(true);
    expect(isMobilityRestricted({ name: 'Французский жим лёжа (EZ-гриф)' }, ['wrist'])).toBe(true);
  });

  it('T-2: temporary chest exclusion ending in week 2 preserves chest volume from week 3 onward', () => {
    const plan = buildBBPlan({
      ...baseInput,
      patternId: 'upper_lower_4',
      weeks: 6,
      planStartWeek: '2026-11-28',
      injuries: [
        { muscle: 'chest', exclude: true, from: '2026-11-28', to: '2026-12-08' },
      ],
    });
    const w1Chest = plan.weeks[0].sessions.flatMap(s => s.exercises).filter(e => e.muscle === 'chest');
    const w4Chest = plan.weeks[3].sessions.flatMap(s => s.exercises).filter(e => e.muscle === 'chest');
    expect(w1Chest.length).toBe(0);
    expect(w4Chest.length).toBeGreaterThan(0);
  });

  it('T-4: calibrated joint stress thresholds avoid false positives on standard sessions', () => {
    const standardSession: BBSession = {
      dayOfWeek: 1,
      sessionTag: 'Push',
      exercises: [
        {
          muscle: 'chest',
          name: 'Жим штанги лёжа',
          role: 'primary',
          character: 'тяж',
          sets: 4,
          repsRange: [6, 8],
          rir: 2,
          workSets: Array.from({ length: 4 }, () => ({ reps: 7, rir: 2, weight: 80 })),
          exerciseType: 'compound',
          comment: '',
          executionProfile: {} as any,
          rationale: '',
        },
        {
          muscle: 'chest',
          name: 'Разведение гантелей лёжа',
          role: 'accessory',
          character: 'памп',
          sets: 3,
          repsRange: [12, 15],
          rir: 2,
          workSets: Array.from({ length: 3 }, () => ({ reps: 13, rir: 2, weight: 22 })),
          exerciseType: 'isolation',
          comment: '',
          executionProfile: {} as any,
          rationale: '',
        },
        {
          muscle: 'shoulders',
          name: 'Махи гантелями в стороны',
          role: 'accessory',
          character: 'памп',
          sets: 3,
          repsRange: [12, 16],
          rir: 2,
          workSets: Array.from({ length: 3 }, () => ({ reps: 14, rir: 2, weight: 12 })),
          exerciseType: 'isolation',
          comment: '',
          executionProfile: {} as any,
          rationale: '',
        },
      ],
    };
    const stress = calculateSessionStress(standardSession);
    expect(stress.byJoint.shoulder).toBeLessThan(65);
    const res = calculateWeeklyStress({ sessions: [standardSession] });
    expect(res.issues.filter(i => i.includes('⚠') || i.includes('Конфликт'))).toHaveLength(0);
  });
});

describe('BB-Auto Phase 1 — Веса и блины (W-1..W-2)', () => {
  it('W-1: isolation weights stay realistically proportional to base workMax across weeks', () => {
    const plan = buildBBPlan(baseInput);
    const allEx = plan.weeks.flatMap(w => w.sessions.flatMap(s => s.exercises));
    const flies = allEx.filter(e => /развод|кроссовер|butterfly|пек.?дек|сведен.*тренаж/i.test(e.name));
    for (const ex of flies) {
      const topW = ex.workSets?.[0]?.weight ?? 0;
      if (topW > 0) expect(topW).toBeLessThanOrEqual(55);
    }
    const laterals = allEx.filter(e => /мах.*сторон|отведен.*сторон|задн.*дельт|face.?pull/i.test(e.name));
    for (const ex of laterals) {
      const topW = ex.workSets?.[0]?.weight ?? 0;
      if (topW > 0) expect(topW).toBeLessThanOrEqual(33);
    }
  });

  it('W-2: dumbbell exercises do not snap to barbell bar+plates weight (22 kg stays near 22 kg)', () => {
    const dummyPlan: any = {
      weeks: [
        {
          week: 1,
          sessions: [
            {
              dayOfWeek: 1,
              sessionTag: 'Push',
              exercises: [
                {
                  muscle: 'chest',
                  name: 'Разведение гантелей лёжа',
                  workSets: [{ reps: 12, rir: 2, weight: 22 }],
                },
                {
                  muscle: 'shoulders',
                  name: 'Махи гантелями в стороны',
                  workSets: [{ reps: 15, rir: 2, weight: 12.5 }],
                },
              ],
            },
          ],
        },
      ],
    };
    applyPlateRoundingToPlan(dummyPlan, [25, 20, 15, 10, 5, 2.5, 1.25]);
    const wFly = dummyPlan.weeks[0].sessions[0].exercises[0].workSets[0].weight;
    const wLat = dummyPlan.weeks[0].sessions[0].exercises[1].workSets[0].weight;
    expect(wFly).toBeGreaterThanOrEqual(21);
    expect(wFly).toBeLessThanOrEqual(23);
    expect(wLat).toBe(12.5);
  });
});

describe('BB-Auto Phase 1 — Специализация и реплан (S-1..S-2)', () => {
  it('S-1: chest specialization target volume >= non-specialized chest target even with tradeoffMode none', () => {
    const basePlan = buildBBPlan({
      ...baseInput,
      patternId: 'ppl_6',
      weeks: 6,
      level: 'advanced',
    });
    const specPlan = buildBBPlan({
      ...baseInput,
      patternId: 'ppl_6',
      weeks: 6,
      level: 'advanced',
      weakPoints: ['chest'],
      specialization: { targets: ['chest'] },
    });
    const baseChest = basePlan.volumeTargets?.chest?.targetSets ?? 0;
    const specChest = specPlan.volumeTargets?.chest?.targetSets ?? 0;
    expect(specChest).toBeGreaterThanOrEqual(baseChest);
  });

  it('S-2: replanBBMesoFromFact shifts specializationSchedule week indices and clamps e1RM jump', () => {
    const plan = buildBBPlan({
      ...baseInput,
      patternId: 'upper_lower_4',
      weeks: 8,
      weakPoints: ['chest'],
      specializationSchedule: [
        { weekStart: 1, weekEnd: 4, targets: ['chest'] },
        { weekStart: 5, weekEnd: 8, targets: ['arms'] },
      ],
    });
    const fakeSessions: any[] = [
      {
        date: '2026-12-01',
        exercises: [
          {
            muscleGroup: 'chest',
            name: 'Жим штанги лёжа',
            sets: [{ weightKg: 130, reps: 5, rir: 1 }],
          },
          {
            muscleGroup: 'quads',
            name: 'Жим ногами в тренажёре',
            sets: [{ weightKg: 300, reps: 10, rir: 1 }],
          },
        ],
      },
    ];
    const replan = replanBBMesoFromFact(plan, fakeSessions, { currentWeek: 5, planStartWeek: '2026-11-28' });
    expect(replan).not.toBeNull();
    // Leg press must NOT inflate baseWorkMax.quads to 400kg!
    expect((replan!.plan as any).workMax.quads).toBeLessThanOrEqual(140);
    // Chest single-replan bounded by +15% of 100 = 115
    expect((replan!.plan as any).workMax.chest).toBeLessThanOrEqual(115);
    // Remaining weeks (5..8 → relative 1..4) preserve second specialization block ('arms')!
    const snapSpec = (replan!.plan as any).inputSnapshot?.specializationSchedule;
    expect(Array.isArray(snapSpec)).toBe(true);
    expect(snapSpec[0].targets).toEqual(['arms']);
    expect(snapSpec[0].weekStart).toBe(1);
  });
});
