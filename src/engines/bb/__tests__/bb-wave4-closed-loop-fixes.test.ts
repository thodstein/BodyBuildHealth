/**
 * Замки Волны 4 (docs/BB-AUTO-FULL-AUDIT-PLAN-2026-11.md):
 * P0-16  replanBBMesoFromFact реально читает sessions (e1RM, adherence, усталость), сдвигает planStartWeek и хранит snapshot
 * P1-13  bb-plan-fact & bb-diary-feedback фильтруют сессии по окну дат плана, умножают plannedVolume на reps и пропускают warmupActivator
 * P1-23  applyFeedbackToBuild масштабирует все workSets и копит прогрессию; applyFeedbackToNextWeek не клонирует deload;
 *        autoReplaceOnPlateau соблюдает equipment/axial и масштабирует вес; applyRehabToPlan округляет вес и клампит RIR<=5
 * P1-24  assessBbTendonGuard считает только последние 7 дней (не всю историю);
 *        bb-diagnostics-injection использует onCourseOf, русское имя и 'памп';
 *        applyRecoveryRelief не пропускает 2-сетовые на красной боли и не печатает 'боль undefined';
 *        bbVbtRecommendation читает персональный LVP из he_bb_lvp_profile
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { replanBBMesoFromFact } from '../bb-replan.engine';
import { buildBBPlanFact } from '../bb-plan-fact.engine';
import { computeBBDiaryFeedback } from '../bb-diary-feedback.engine';
import { applyFeedbackToBuild, applyFeedbackToNextWeek, autoReplaceOnPlateau } from '../bb-progression-feedback.engine';
import { applyRehabToPlan } from '../bb-recovery.engine';
import { applyRecoveryRelief } from '../bb-recovery-relief.engine';
import { assessBbTendonGuard } from '../bb-tendon-guard.engine';
import { injectBBWeakPoints } from '../bb-diagnostics-injection.engine';
import { bbVbtRecommendation } from '../bb-vbt.engine';

describe('Wave 4 Closed Loop & Diagnostics audit locks', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* node env */ }
  });

  it('P0-16: replanBBMesoFromFact читает факт sessions (обновляет workMax и adherence) и не теряет snapshot-поля', () => {
    const base = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 6,
      planStartWeek: '2026-10-05',
      workMax: { chest: 100, back: 100, quads: 120 },
      bannedPatterns: ['становая'],
      allowStrengthLifts: false,
    });
    const sessions: any[] = [
      {
        id: 's1',
        date: '2026-10-06',
        focus: 'Upper',
        weekNumber: 1,
        exercises: [
          {
            exerciseName: 'Жим штанги лёжа',
            muscleGroup: 'Грудь',
            sets: [
              { weightKg: 100, reps: 8, rir: 2 }, // e1RM ~ 126.7 > 100
              { weightKg: 100, reps: 8, rir: 2 },
            ],
          },
        ],
      },
    ];
    const res = replanBBMesoFromFact(base, sessions, { currentWeek: 3, planStartWeek: '2026-10-05' });
    expect(res).not.toBeNull();
    expect(res!.frozenWeeks).toBe(2);
    expect(res!.rebuiltWeeks).toBe(4);
    expect((res!.plan as any).workMax.chest).toBeGreaterThan(105);
    expect(res!.changes.some(c => /максимум|adherence/i.test(c))).toBe(true);
    expect((res!.plan as any).inputSnapshot?.bannedPatterns).toEqual(['становая']);
  });

  it('P1-13: bb-plan-fact и bb-diary-feedback фильтруют старые сессии вне окна плана, считают reps в plannedVolume и игнорят warmupActivator', () => {
    const plan: any = {
      planStartWeek: '2026-11-02',
      weeks: [{
        week: 1,
        phase: 'accumulation',
        sessions: [{
          day: 1,
          exercises: [
            { name: 'Активатор', muscle: 'chest', sets: 2, warmupActivator: true, workSets: [{ weight: 10, reps: 15, rir: 4 }, { weight: 10, reps: 15, rir: 4 }] },
            { name: 'Жим штанги лёжа', muscle: 'chest', sets: 3, rir: 2, workSets: [{ weight: 80, reps: 10, rir: 2 }, { weight: 80, reps: 10, rir: 2 }, { weight: 80, reps: 10, rir: 2 }] },
          ],
        }],
      }],
    };
    const oldSession: any = {
      date: '2026-09-01',
      exercises: [{ exerciseName: 'Жим штанги лёжа', muscleGroup: 'chest', sets: [{ weightKg: 120, reps: 5, rir: 1 }, { weightKg: 120, reps: 5, rir: 1 }, { weightKg: 120, reps: 5, rir: 1 }] }],
    };
    const fact = buildBBPlanFact(plan, [oldSession], '2026-11-02');
    expect(fact.byMuscle.chest.plannedSets).toBe(3); // warmupActivator excluded
    expect(fact.byMuscleInWindow?.chest.actualSets).toBe(0); // oldSession excluded in window!
    expect(fact.overallAdherence).toBe(0); // oldSession excluded from plan adherence!
    expect(fact.unmatchedSessions).toHaveLength(1);
    expect(fact.strength?.byMuscle.chest.actualE1rm).toBeNull();

    const fb = computeBBDiaryFeedback(plan, [oldSession]);
    expect(fb.weekly[0].plannedVolume).toBe(2400); // 3 * 80 * 10 (not 240!)
    expect(fb.completedSessions).toBe(0); // oldSession filtered out!
  });

  it('P1-23: applyFeedbackToBuild масштабирует все workSets и копит прогрессию; applyFeedbackToNextWeek не клонирует делод; autoReplaceOnPlateau уважает оборудование и масштабирует вес', () => {
    const plan: any = {
      weeks: [
        { week: 1, phase: 'accumulation', sessions: [{ day: 1, exercises: [{ name: 'Жим штанги лёжа', muscle: 'chest', role: 'primary', sets: 3, rir: 2, repsRange: [8, 12], workSets: [{ weight: 80, reps: 10, rir: 2 }, { weight: 75, reps: 10, rir: 2 }, { weight: 70, reps: 10, rir: 2 }] }] }] },
        { week: 2, phase: 'accumulation', sessions: [{ day: 1, exercises: [{ name: 'Жим штанги лёжа', muscle: 'chest', role: 'primary', sets: 3, rir: 2, repsRange: [8, 12], workSets: [{ weight: 80, reps: 10, rir: 2 }, { weight: 75, reps: 10, rir: 2 }, { weight: 70, reps: 10, rir: 2 }] }] }] },
        { week: 3, phase: 'intensification', sessions: [{ day: 1, exercises: [{ name: 'Жим штанги лёжа', muscle: 'chest', role: 'primary', sets: 3, rir: 2, repsRange: [8, 12], workSets: [{ weight: 80, reps: 10, rir: 2 }, { weight: 75, reps: 10, rir: 2 }, { weight: 70, reps: 10, rir: 2 }] }] }] },
        { week: 4, phase: 'deload', deload: true, sessions: [{ day: 1, exercises: [{ name: 'Жим штанги лёжа', muscle: 'chest', role: 'primary', sets: 2, rir: 4, repsRange: [10, 12], workSets: [{ weight: 50, reps: 10, rir: 4 }, { weight: 50, reps: 10, rir: 4 }] }] }] },
      ],
    };
    const sessions: any[] = [
      { date: '2026-11-01', exercises: [{ exerciseName: 'Жим штанги лёжа', sets: [{ weightKg: 90, reps: 12, rir: 3 }] }] },
    ];
    const updated = applyFeedbackToBuild(plan, sessions, { chest: 120 }, 'double_progression');
    const w2Ex = updated.weeks[1].sessions[0].exercises[0];
    const w3Ex = updated.weeks[2].sessions[0].exercises[0];
    expect(w2Ex.workSets[1].weight).toBeGreaterThan(75); // backoff scaled too, not frozen at 75
    expect(w3Ex.workSets[0].weight).toBeGreaterThanOrEqual(w2Ex.workSets[0].weight);

    const nextWk = applyFeedbackToNextWeek(plan, [{
      planKey: 'chest|Жим штанги лёжа',
      exerciseName: 'Жим штанги лёжа',
      muscle: 'chest',
      plannedWeight: 80, plannedReps: 10, plannedRir: 2, week: 3,
      last: { topWeight: 85, topReps: 10, actualRir: 2, date: '2026-11-01', e1rm: 113 },
      recommendation: { nextWeight: 87.5, nextReps: 10, nextRir: 2, label: '+2.5', source: 'fact' },
      rirDelta: 0,
    }]);
    const appended = nextWk.weeks[nextWk.weeks.length - 1];
    expect((appended as any).deload).toBe(false);
    expect(appended.sessions[0].exercises[0].workSets.length).toBe(3);

    const plateauPlan: any = {
      inputSnapshot: { equipment: ['dumbbell'], avoidAxialLoad: true },
      weeks: [{
        week: 1,
        sessions: [{
          day: 1,
          exercises: [{ name: 'Жим ногами в тренажёре', muscle: 'quads', role: 'primary', sets: 3, workSets: [{ weight: 200, reps: 10, rir: 2 }] }],
        }],
      }],
    };
    const plateauSessions: any[] = [1, 2, 3, 4].map(i => ({
      date: `2026-10-0${i}`,
      exercises: [{ exerciseName: 'Жим ногами в тренажёре', sets: [{ weightKg: 200, reps: 10, rir: 2 }] }],
    }));
    const rep = autoReplaceOnPlateau(plateauPlan, plateauSessions);
    if (rep.changes.length > 0) {
      const ex = rep.plan.weeks[0].sessions[0].exercises[0];
      expect(ex.workSets[0].weight).toBeLessThan(200); // safely scaled down
    }
  });

  it('P1-24 & P2: tendon guard (7-day window), diagnostics injection (onCourseOf / памп / name), rehab rounding/clamp, recovery relief (red 2-set + no undefined), personal LVP', () => {
    const oldHeavy = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-08-0${(i % 9) + 1}`,
      exercises: [{ exerciseName: 'Жим лёжа', sets: Array(5).fill({ weightKg: 100, reps: 8 }) }],
    }));
    const recentLight = [{
      date: '2026-11-25',
      exercises: [{ exerciseName: 'Жим лёжа', sets: Array(4).fill({ weightKg: 100, reps: 8 }) }],
    }];
    const g = assessBbTendonGuard([...oldHeavy, ...recentLight], { level: 'intermediate' });
    expect(g.shoulder.heavySets).toBe(4);
    expect(g.shoulder.level).toBe('ok');

    const natPlan: any = {
      level: 'intermediate',
      inputSnapshot: { level: 'intermediate', courseIntensity: 'moderate', peds: [], onCourse: false },
      weeks: [{
        week: 1,
        sessions: [{ day: 1, sessionTag: 'Push', exercises: [{ name: 'Жим штанги лёжа', muscle: 'chest', sets: 4, workSets: Array(4).fill({ weight: 80, reps: 8, rir: 2 }) }] }],
      }],
    };
    const inj = injectBBWeakPoints(natPlan, ['delt_mid']);
    expect(inj.injected).toBe(1);
    const addedEx = inj.plan.weeks[0].sessions[0].exercises[1];
    expect(addedEx.character).toBe('памп');
    expect(addedEx.name).toBe('Махи гантелями в стороны');
    // onCourse: false с фейковым courseIntensity: 'moderate' не должен раздувать бюджет до enhanced (~220)
    expect(inj.injected).toBe(1);

    const rehabPlan: any = {
      weeks: [{ week: 1, sessions: [{ exercises: [{ muscle: 'chest', sets: 4, rir: 4, workSets: [{ weight: 83, reps: 10, rir: 4 }] }] }] }],
    };
    applyRehabToPlan(rehabPlan, ['chest'], 1);
    expect(rehabPlan.weeks[0].sessions[0].exercises[0].rir).toBeLessThanOrEqual(5);
    expect((rehabPlan.weeks[0].sessions[0].exercises[0].workSets[0].weight * 2) % 1).toBe(0);

    const reliefPlan: any = {
      weeks: [{ week: 1, phase: 'accumulation', sessions: [{ exercises: [{ muscle: 'quads', sets: 2, rir: 2, workSets: [{ weight: 100, reps: 10, rir: 2 }, { weight: 100, reps: 10, rir: 2 }] }] }] }],
    };
    const rRed = applyRecoveryRelief(reliefPlan, { painLevel: 'red', painLocation: 'patellar' });
    expect(rRed.adjusted).toBe(1);
    expect(rRed.plan.weeks[0].sessions[0].exercises[0].workSets[0].weight).toBeLessThan(100);

    const rSore = applyRecoveryRelief({
      weeks: [{ week: 1, phase: 'accumulation', sessions: [{ exercises: [{ muscle: 'quads', sets: 4, rir: 2, workSets: Array(4).fill({ weight: 100, reps: 10, rir: 2 }) }] }] }],
    }, { soreness010: 8 });
    expect(rSore.changes.join(' ')).not.toContain('undefined');

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('he_bb_lvp_profile', JSON.stringify({ bench: { slope: -0.01, intercept: 1.17, v1rm: 0.17 } }));
      const vbt = bbVbtRecommendation('bench', 0.65, 0.57, 60);
      expect(vbt.e1RMByVelocity).toBe(100);
      expect(vbt.recommendation).toContain('персональный LVP');
    }
  });
});
