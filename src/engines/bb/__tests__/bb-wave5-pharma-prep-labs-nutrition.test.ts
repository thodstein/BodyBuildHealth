import { describe, it, expect } from 'vitest';
import { deriveBBPedFromPharma } from '../bb-course-sync';
import { adaptForPEDs, assessFemalePedSafety, computeAASEquivDose, AAS_SUBSTANCE_TEQ } from '../bb-ped-adaptation.engine';
import { pedClassesOf } from '../bb-ped-profile';
import { jointGuardActive } from '../bb-joint-guard.engine';
import { computeBBWeeklyBudget } from '../bb-volume.engine';
import { applyPEDMethodologyToPlan } from '../bb-ped-methodology.engine';
import { buildBBPlan } from '../bb-builder.engine';
import {
  buildBBContestPrepPlan,
  buildPeakWeek,
  buildShowTimeline,
  buildPostShowPlan,
  postShowRecoveryDiet,
  prepWeightAdvice,
  planTwoShowSequence,
  resolveStageWeightKg,
  type BBContestPrepConfig,
} from '../bb-contest-prep.engine';
import { savePostShowEntry, getPostShowLog, isPostShowWeekEntry } from '../bb-prep-post-show-log.engine';
import { estimateDiaryExperience } from '../bb-taper-adaptive.engine';
import { prepVolumePlan, buildPrepSeason } from '../bb-prep-cycle.engine';
import { isNewerLabDate } from '../../../core/labs-profile-sync';
import { labTrainingAdjust } from '../../../ui/screens/TrainingScreen_parts/lab-training-adjust';
import { applyBBNutritionToTargets } from '../../../ui/screens/NutritionScreen_parts/IndividualPlan/planner-bb-nutrition';

describe('Wave 5 — Pharma Auto-Sync, Female PED Safety, Contest Prep, Labs & Nutrition', () => {
  it('deriveBBPedFromPharma converts weekly daily-dosed compounds (GH/insulin/IGF1) to daily units and handles phases', () => {
    const course = deriveBBPedFromPharma({
      phase: 'course',
      onCourse: true,
      substances: [
        { id: 'test_enan', name: 'Test E', category: 'aas', route: 'injectable', weeklyDose: 500, unit: 'mg' },
        { id: 'gh', name: 'HGH', category: 'hgh', route: 'subq', weeklyDose: 28, unit: 'IU' },
        { id: 'insulin_rapid', name: 'Humalog', category: 'insulin', route: 'subq', weeklyDose: 70, unit: 'IU' },
        { id: 'igf1_lr3', name: 'IGF-1 LR3', category: 'peptide', route: 'subq', weeklyDose: 350, unit: 'mcg' },
      ],
    });
    expect(course.hasActiveCourse).toBe(true);
    expect(course.phase).toBe('course');
    expect(course.pedDoses.GH).toBe(4);
    expect(course.pedDoses.insulin).toBe(10);
    expect(course.pedDoses.IGF1).toBe(50);
    expect(course.pedDoses.AAS).toBe(500);

    const cruise = deriveBBPedFromPharma({
      phase: 'cruise',
      onCourse: true,
      substances: [
        { id: 'test_enan', name: 'Test E', category: 'aas', route: 'injectable', weeklyDose: 500, unit: 'mg' },
      ],
    });
    expect(cruise.phase).toBe('cruise');
    expect(cruise.pedDoses.AAS).toBeLessThanOrEqual(200);
    expect(cruise.volumeMult).toBe(0.85);
    expect(cruise.rirShift).toBe(1);

    const pct = deriveBBPedFromPharma({
      phase: 'pct',
      onCourse: false,
      substances: [
        { id: 'test_enan', name: 'Test E', category: 'aas', route: 'injectable', weeklyDose: 500, unit: 'mg' },
      ],
    });
    expect(pct.phase).toBe('pct');
    expect(pct.onCourse).toBe(false);
    expect(pct.peds).toEqual([]);
    expect(pct.recoveryMult).toBe(0.8);
    expect(pct.disallowFailureTechniques).toBe(true);

    const minor = deriveBBPedFromPharma({
      phase: 'course',
      onCourse: true,
      age: 16,
      substances: [{ id: 'test_enan', name: 'Test E', category: 'aas', route: 'injectable', weeklyDose: 500, unit: 'mg' }],
    });
    expect(minor.hasActiveCourse).toBe(false);
    expect(minor.peds).toEqual([]);
  });

  it('AAS_SUBSTANCE_TEQ, pedClassesOf, and adaptForPEDs aggregate per-substance AAS and enforce harm-reduction caveats', () => {
    expect(AAS_SUBSTANCE_TEQ.trena).toBe(2.5);
    expect(AAS_SUBSTANCE_TEQ.tren_acet).toBe(2.5);
    expect(AAS_SUBSTANCE_TEQ.test_enan).toBe(1.0);
    expect(computeAASEquivDose({ test_enan: 500, tren_acet: 200 })).toBe(1000);
    expect(pedClassesOf({ pedDoses: { test_enan: 250, somatropin: 4 } })).toMatchObject({ hasAAS: true, hasGH: true });

    const adapt = adaptForPEDs(['AAS'], { chest: 20 }, { test_enan: 500, tren_acet: 200 });
    expect(adapt.perPED[0].dose).toBe(1000);
    expect(adapt.rationale.some(r => /harm-reduction|не медназначение/i.test(r))).toBe(true);

    const female = assessFemalePedSafety({ sex: 'female', peds: ['AAS'], pedDoses: { tren_acet: 100 } });
    expect(female.virilizationRisk).toBe('high');
    expect(female.warnings.length).toBeGreaterThan(0);
    expect(female.redFlags.length).toBeGreaterThan(0);

    // No direct injection instructions in MGF rationale
    const plan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'advanced', goal: 'mass', weeks: 2,
      workMax: { chest: 100, back: 110, quads: 140, hamstrings: 90, shoulders: 60, biceps: 45, triceps: 50 },
      peds: ['MGF'], pedDoses: { MGF: 200 }, weakPoints: ['chest'],
    } as any);
    const methPlan = applyPEDMethodologyToPlan(plan as any, {
      peds: ['MGF'], pedDoses: { MGF: 200 }, level: 'advanced', goal: 'mass', totalWeeks: 2,
    } as any);
    expect((methPlan.rationale || []).join(' ')).not.toMatch(/колите/i);
  });

  it('jointGuardActive triggers for stanozolol and low estradiol (<15 pg/mL); computeBBWeeklyBudget respects doseAwareMrv and female cap', () => {
    expect(jointGuardActive({ hasGH: false, hasAAS: true, pedDoses: { stanozolol: 210 } })).toBe(true);
    expect(jointGuardActive({ hasGH: false, hasAAS: true, estradiolPgMl: 11 })).toBe(true);
    expect(jointGuardActive({ hasGH: false, hasAAS: false, estradiolPgMl: 35 })).toBe(false);

    const trtBudget = computeBBWeeklyBudget({ peds: ['AAS'], pedDoses: { AAS: 125 }, doseAwareMrv: 1.10 });
    const femaleBudget = computeBBWeeklyBudget({ peds: ['AAS'], pedDoses: { anavar: 70 }, sex: 'female' });
    expect(trtBudget).toBeLessThan(150);
    expect(femaleBudget).toBeLessThan(180);
  });

  it('buildBBPlan gates Blast/Cruise off for naturals and applies RIR +1 on cruise weeks and PCT', () => {
    const natPlan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4,
      workMax: { chest: 100, back: 110, quads: 140, hamstrings: 90, shoulders: 60, biceps: 45, triceps: 50 },
      blastCruiseEnabled: true, blastWeeks: 2, cruiseWeeks: 2,
    } as any);
    expect((natPlan.rationale || []).some(r => /Blast\/Cruise/.test(r))).toBe(false);

    const bcPlan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 4, goal: 'mass', weeks: 4,
      peds: ['AAS'], pedDoses: { AAS: 500 }, onCourse: true,
      workMax: { chest: 100, back: 110, quads: 140, hamstrings: 90, shoulders: 60, biceps: 45, triceps: 50 },
      blastCruiseEnabled: true, blastWeeks: 2, cruiseWeeks: 2,
    } as any);
    expect((bcPlan.weeks[2] as any).cruiseWeek).toBe(true);

    const pctPlan = buildBBPlan({
      patternId: 'upper_lower_4', level: 'enhanced', trainingYears: 4, goal: 'mass', weeks: 2,
      peds: ['AAS'], pedDoses: { AAS: 500 }, pedPhase: 'pct', intensityTechnique: 'rest_pause',
      workMax: { chest: 100, back: 110, quads: 140, hamstrings: 90, shoulders: 60, biceps: 45, triceps: 50 },
    } as any);
    expect((pctPlan.rationale || []).some(r => /Фаза ПКТ/.test(r))).toBe(true);
  });

  it('Contest prep fixes: female water floor >=1.5L, wake timeline, prepWeightAdvice cut %, stageWeightKg post-show, 12w post-show log, DST taper', () => {
    const fCfg: BBContestPrepConfig = {
      sex: 'female', category: 'bikini', weightKg: 55, experienceLevel: 'intermediate', enhanced: false, prepCount: 1,
      showDate: '2026-12-20', weeksOut: 2, trainingProtocol: 'bb',
      carbLoadStrategy: 'moderate', waterStrategy: 'tapered', sodiumStrategy: 'tapered', confirmedManipulation: true,
      schedule: { wake: '06:30', stage: '12:00' },
    };
    const pw = buildPeakWeek(fCfg);
    for (const d of pw) expect(d.waterLiters).toBeGreaterThanOrEqual(1.5);

    const tl = buildShowTimeline(fCfg);
    expect(tl[0].time).toBe('06:30');

    const plan = buildBBContestPrepPlan({ ...fCfg, sex: 'male', category: 'mens_physique', weightKg: 90 }, { prepWeeks: 8, taperWeeks: 2 });
    const advice = prepWeightAdvice(
      [
        { date: '2026-10-01', weight: 86 },
        { date: '2026-10-02', weight: 86 },
        { date: '2026-10-03', weight: 86 },
        { date: '2026-10-04', weight: 86 },
      ],
      plan,
      { referenceDate: '2026-10-04', targetWeightKg: 80 },
    );
    expect(advice.progressToTargetPct).toBe(40);

    expect(resolveStageWeightKg(plan, { stageWeightKg: 78 })).toBe(78);
    const postStage = buildPostShowPlan(plan, { stageWeightKg: 78 });
    const postStart = buildPostShowPlan(plan);
    expect(postStage.proteinG).toBeLessThan(postStart.proteinG);
    const recStage = postShowRecoveryDiet(plan, { stageWeightKg: 78 });
    expect(recStage).toHaveLength(12);
    expect(recStage[0].proteinG).toBe(postStage.proteinG);

    // Post-show log supports weeks 1..12
    expect(isPostShowWeekEntry({ week: 12, dateIso: '2026-12-30' })).toBe(true);
    savePostShowEntry('w5_test_plan', { week: 10, dateIso: '2026-12-25', weightKg: 82 });
    expect(getPostShowLog('w5_test_plan').some(e => e.week === 10)).toBe(true);

    // planTwoShowSequence extends workSets when overreach increases sets
    const fakeBb = {
      weeks: [{
        week: 1, phase: 'accumulation',
        sessions: [{ exercises: [{ muscle: 'chest', sets: 3, workSets: [{ reps: 10, rir: 2, weight: 80 }, { reps: 10, rir: 2, weight: 80 }, { reps: 10, rir: 2, weight: 80 }] }] }],
      }, { week: 2, phase: 'peaking', sessions: [{ exercises: [{ muscle: 'chest', sets: 3, workSets: [{ reps: 10, rir: 2, weight: 80 }] }] }] }],
    } as any;
    const seq = planTwoShowSequence(fakeBb, [{ weekNumber: 2 }]);
    const ex0 = (seq.plan.weeks[0].sessions[0].exercises[0] as any);
    expect(ex0.workSets.length).toBe(ex0.sets);

    // Prep cycle labMrvMultiplier & short inter-show gap
    const vpNorm = prepVolumePlan({ category: 'mens_physique', sex: 'male', accentMuscles: [], minimalMuscles: [], weeks: 10, taperWeeks: 2, showDate: '2026-12-20', level: 'intermediate', enhanced: false, weightKg: 80, experienceLevel: 'intermediate' }, 7);
    const vpLab = prepVolumePlan({ category: 'mens_physique', sex: 'male', accentMuscles: [], minimalMuscles: [], weeks: 10, taperWeeks: 2, showDate: '2026-12-20', level: 'intermediate', enhanced: false, weightKg: 80, experienceLevel: 'intermediate', labMrvMultiplier: 0.8 }, 7);
    expect(vpLab.scaledTargetSetsPerMusclePerWeek[1]).toBeLessThan(vpNorm.scaledTargetSetsPerMusclePerWeek[1]);

    const season = buildPrepSeason({
      category: 'mens_physique', sex: 'male', accentMuscles: [], minimalMuscles: [],
      level: 'intermediate', enhanced: false, weightKg: 80, experienceLevel: 'intermediate',
      competitions: [
        { id: 'c1', name: 'Show 1', date: '2027-06-01', priority: 'B' },
        { id: 'c2', name: 'Show 2', date: '2027-06-15', priority: 'A' },
      ],
    });
    expect(season.cycles).toHaveLength(2);
    expect(season.summary[1].totalWeeks).toBeGreaterThanOrEqual(4);

    // DST-safe diary experience
    const exp = estimateDiaryExperience([
      { date: '2026-03-01', sets: 12 },
      { date: '2026-04-01', sets: 14 },
    ]);
    expect(exp.totalSessions).toBe(2);
  });

  it('Labs & Nutrition: same-day lab date overwrite, serum lab gates (HCT/Ferritin/Na/K), and insulin carb floor respecting locked manual mode', () => {
    expect(isNewerLabDate('2026-11-28', '2026-11-28')).toBe(true);
    expect(isNewerLabDate('2026-11-27', '2026-11-28')).toBe(false);

    const adj = labTrainingAdjust(null, { hematocritPct: 55, ferritinNgMl: 15, glucoseMmol: 7.4, potassiumMmol: 3.2 });
    expect(adj.mrvMultiplier).toBeLessThanOrEqual(0.85);
    expect(adj.deloadRecommended).toBe(true);
    expect(adj.warnings.length).toBeGreaterThanOrEqual(4);

    const autoRes = applyBBNutritionToTargets({
      protein: 180, fats: 70, carbs: 80, todayDow: 1,
      bbNote: { trainDays: [1, 3, 5], insulinIU: 15, insulinCarbsG: 150 },
    });
    expect(autoRes.carbs).toBe(150);

    const lockedRes = applyBBNutritionToTargets({
      protein: 180, fats: 70, carbs: 80, kcal: 1670, todayDow: 1, locked: true,
      bbNote: { trainDays: [1, 3, 5], insulinIU: 15, insulinCarbsG: 150, kcal: 2800 },
    });
    expect(lockedRes.carbs).toBe(80);
    expect(lockedRes.kcal).toBe(1670);
  });
});
