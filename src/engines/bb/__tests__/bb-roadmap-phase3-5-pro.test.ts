import { describe, it, expect, beforeEach } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { estimateSessionTimeWithSupersets } from '../bb-fatigue.engine';
import {
  loadGymProfiles,
  saveGymProfile,
  deleteGymProfile,
  adaptWeekForTravel,
  GYM_PROFILES_STORAGE_KEY,
} from '../bb-gym-profiles.engine';
import {
  createCustomSplitPattern,
  saveCustomSplitPattern,
  deleteCustomSplitPattern,
  getPattern,
  CUSTOM_SPLITS_STORAGE_KEY,
} from '../bb-split-patterns';
import { replanBBMesoFromFact } from '../bb-replan.engine';
import { programToBBPlan } from '../cycle-to-plan';
import { FULL_PROGRAM_LIBRARY } from '../../complete-program-library.engine';
import { inferPersonalVolumeFromDiary } from '../bb-mev-calibration.engine';

const WORK_MAX = {
  chest: 100,
  back: 110,
  quads: 140,
  hamstrings: 95,
  shoulders: 65,
  biceps: 45,
  triceps: 50,
  glutes: 140,
  calves: 110,
  abs: 40,
};

describe('BB-Auto Roadmap Phases 3–5: Methodologies, MesoTemplates, Budgets, Travel, Custom Splits, Diary MEV', () => {
  beforeEach(() => {
    try {
      localStorage.removeItem(GYM_PROFILES_STORAGE_KEY);
      localStorage.removeItem(CUSTOM_SPLITS_STORAGE_KEY);
    } catch { /* node without storage */ }
  });

  it('Phase 3.1: hit_heavy_duty caps sets <=2, keeps primary rest >=180s and RIR <=1 for intermediate+, and downgrades for beginner', () => {
    const inter = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 4,
      workMax: WORK_MAX,
      methodology: 'hit_heavy_duty',
    });
    const exs = inter.weeks[0].sessions.flatMap(s => s.exercises).filter(e => !(e as any).warmupActivator);
    expect(exs.length).toBeGreaterThan(0);
    for (const ex of exs) {
      expect(ex.sets).toBeLessThanOrEqual(2);
      expect(ex.rir).toBeLessThanOrEqual(1);
    }
    const primaryComp = exs.find(e => e.role === 'primary');
    expect(primaryComp?.restSeconds).toBeGreaterThanOrEqual(180);

    const beg = buildBBPlan({
      patternId: 'fullbody_3',
      level: 'beginner',
      goal: 'mass',
      weeks: 4,
      workMax: WORK_MAX,
      methodology: 'hit_heavy_duty',
    });
    expect(beg.rationale.some(r => /Новичку методика.*отключена/i.test(r))).toBe(true);
  });

  it('Phase 3.1b: smh_lengthened applies stretch tempo and cue; myo_rep_match lifts isolation reps', () => {
    const smh = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 4,
      workMax: WORK_MAX,
      methodology: 'smh_lengthened',
    });
    const smhExs = smh.weeks[0].sessions.flatMap(s => s.exercises).filter(e => !(e as any).warmupActivator);
    expect(smhExs.some(e => (e.comment || '').includes('SMH'))).toBe(true);
    expect(smhExs.some(e => e.tempoSpec === '3-1-1-0')).toBe(true);

    const myo = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 4,
      workMax: WORK_MAX,
      methodology: 'myo_rep_match',
    });
    const myoIsos = myo.weeks[0].sessions
      .flatMap(s => s.exercises)
      .filter(e => !(e as any).warmupActivator && String(e.exerciseType || '').toLowerCase() === 'isolation');
    expect(myoIsos.length).toBeGreaterThan(0);
    for (const iso of myoIsos) {
      expect(iso.repsRange[0]).toBeGreaterThanOrEqual(12);
      expect((iso.comment || '').includes('Myo-rep match')).toBe(true);
    }
  });

  it('Phase 3.2: mesoTemplate resensitization softens W1 and metabolite peaks final working week with 15-25 reps', () => {
    const classic = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 6,
      workMax: WORK_MAX,
      mesoTemplate: 'classic',
    });
    const resens = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 6,
      workMax: WORK_MAX,
      mesoTemplate: 'resensitization',
    });
    expect((resens.weeks[0] as any).phase).toBe('resensitization');
    const setsClassicW1 = classic.weeks[0].sessions.reduce((s, ss) => s + ss.exercises.reduce((a, e) => a + e.sets, 0), 0);
    const setsResensW1 = resens.weeks[0].sessions.reduce((s, ss) => s + ss.exercises.reduce((a, e) => a + e.sets, 0), 0);
    expect(setsResensW1).toBeLessThan(setsClassicW1);

    const metab = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 6,
      workMax: WORK_MAX,
      mesoTemplate: 'metabolite',
    });
    const metabWeek = metab.weeks.find(w => (w as any).phase === 'metabolite');
    expect(metabWeek).toBeDefined();
    const metabExs = metabWeek!.sessions.flatMap(s => s.exercises).filter(e => !(e as any).warmupActivator);
    expect(metabExs.some(e => e.repsRange[1] >= 20)).toBe(true);
  });

  it('Phase 3.3: maxSessionMinutes triggers supersets and trims total session duration vs unbounded plan', () => {
    const unbounded = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'advanced',
      goal: 'mass',
      weeks: 4,
      workMax: WORK_MAX,
      trainingVolumeMode: 'high',
    });
    const bounded = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'advanced',
      goal: 'mass',
      weeks: 4,
      workMax: WORK_MAX,
      trainingVolumeMode: 'high',
      maxSessionMinutes: 45,
    });
    const tUnb = estimateSessionTimeWithSupersets(unbounded.weeks[0].sessions[0]).supersetSeconds;
    const tBnd = estimateSessionTimeWithSupersets(bounded.weeks[0].sessions[0]).supersetSeconds;
    expect(tBnd).toBeLessThanOrEqual(tUnb);
    expect(tBnd).toBeLessThanOrEqual(45 * 60 + 120);
  });

  it('Phase 4.1: GymProfile CRUD and adaptWeekForTravel substitutes barbell lifts with travel-friendly moves', () => {
    const defaults = loadGymProfiles();
    expect(defaults.some(p => p.id === 'gym_full')).toBe(true);
    expect(defaults.some(p => p.id === 'travel_minimal')).toBe(true);

    const saved = saveGymProfile({
      id: 'custom_hotel',
      name: 'Hotel',
      equipment: ['dumbbell', 'bodyweight'],
    });
    expect(saved.some(p => p.id === 'custom_hotel')).toBe(true);
    const afterDel = deleteGymProfile('custom_hotel');
    expect(afterDel.some(p => p.id === 'custom_hotel')).toBe(false);

    const base = buildBBPlan({
      patternId: 'upper_lower_4',
      level: 'intermediate',
      goal: 'mass',
      weeks: 4,
      workMax: WORK_MAX,
      equipment: ['barbell', 'dumbbell', 'cable', 'machine'],
    });
    const travel = adaptWeekForTravel(base, 2, ['bodyweight', 'bands']);
    expect(travel.replaced).toBeGreaterThan(0);
    expect(travel.plan.weeks[1].sessions[0].exercises.some(e => (e.comment || '').includes('✈️'))).toBe(true);
  });

  it('Phase 4.2: Custom split CRUD & getPattern resolution + buildBBPlan with customPattern', () => {
    const custom = createCustomSplitPattern('Upper Lower Custom', [
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Upper' },
      { kind: 'тренировка', character: 'тяж', sessionTag: 'Lower' },
      { kind: 'отдых', character: null },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Push' },
      { kind: 'тренировка', character: 'памп', sessionTag: 'Pull' },
    ]);
    saveCustomSplitPattern(custom);
    expect(getPattern(custom.id)?.name).toBe('Upper Lower Custom');

    const plan = buildBBPlan({
      patternId: custom.id,
      customPattern: custom,
      level: 'intermediate',
      goal: 'mass',
      weeks: 4,
      workMax: WORK_MAX,
    });
    expect(plan.weeks).toHaveLength(4);
    expect(plan.weeks[0].sessions).toHaveLength(4);

    const rem = deleteCustomSplitPattern(custom.id);
    expect(rem.some(p => p.id === custom.id)).toBe(false);
  });

  it('Phase 4.3: replanBBMesoFromFact handles Programs/Cycles plans in-place and applies skipWeek/newInjuries/gymEquipment', () => {
    const prog = FULL_PROGRAM_LIBRARY.find(p => p.daysPerWeek >= 3 && p.weeks.length >= 4) || FULL_PROGRAM_LIBRARY[0];
    const progPlan = programToBBPlan(prog, {
      workMax: WORK_MAX,
      mode: 'adapt',
      level: 'intermediate',
      equipment: ['barbell', 'dumbbell', 'cable', 'machine'],
    });
    const replanProg = replanBBMesoFromFact(progPlan, [], {
      currentWeek: 2,
      skipWeek: true,
      newInjuries: [{ muscle: 'chest', exclude: true } as any],
      gymEquipment: ['bodyweight', 'bands'],
    });
    expect(replanProg).not.toBeNull();
    expect(replanProg!.frozenWeeks).toBe(1);
    expect((replanProg!.plan.weeks[1] as any).phase).toBe('deload');
    const tailExercises = replanProg!.plan.weeks.slice(1).flatMap(w => w.sessions.flatMap(s => s.exercises));
    expect(tailExercises.some(e => e.muscle === 'chest')).toBe(false);
  });

  it('Phase 5.1: inferPersonalVolumeFromDiary estimates landmarks within safe caps from training logs', () => {
    const sessions = Array.from({ length: 12 }, (_, idx) => ({
      date: new Date(Date.now() - (12 - idx) * 3 * 86400 * 1000).toISOString().slice(0, 10),
      exercises: [
        {
          muscle: 'chest',
          sets: Array.from({ length: 4 }, () => ({ weightKg: 80 + idx, reps: 8, rir: 2 })),
        },
        {
          muscle: 'quads',
          sets: Array.from({ length: 4 }, () => ({ weightKg: 120, reps: 8, rir: 0 })),
        },
      ],
    }));
    const res = inferPersonalVolumeFromDiary(sessions, 8, 'intermediate');
    expect(res.confidence).toBe('high');
    expect(res.adjustedLandmarks.chest.mev).toBeGreaterThanOrEqual(2);
    expect(res.adjustedLandmarks.chest.mrv).toBeGreaterThan(res.adjustedLandmarks.chest.mav);
    expect(res.suggestedCalibration.resolvedAt).toBeTruthy();
  });
});
