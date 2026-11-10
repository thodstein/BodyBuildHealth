/**
 * Регрессии аудита 2026-11: DC-гейт, явный запрет техник, autoReg
 * (deload/1-сет/RIR/top-set), повторная сборка остатка, гигиена входа,
 * устойчивость валидатора.
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan, type BBBuilderInput } from '../bb-builder.engine';
import { finalizeBBPlan } from '../bb-finalize.engine';
import { replanBBMesoFromFact } from '../bb-replan.engine';
import { validateBBPlan } from '../bb-validator.engine';

const WORK_MAX = {
  chest: 100, back: 120, shoulders: 60, quads: 140, hamstrings: 100,
  glutes: 140, biceps: 50, triceps: 60, calves: 80,
};

function base(overrides: Partial<BBBuilderInput> = {}): BBBuilderInput {
  return {
    patternId: 'upper_lower_4',
    level: 'advanced',
    trainingYears: 5,
    goal: 'mass',
    weeks: 8,
    workMax: { ...WORK_MAX },
    equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
    ...overrides,
  } as BBBuilderInput;
}

function nonDeloadWeeks(plan: any): any[] {
  return plan.weeks.filter((w: any) => w.deload !== true && w.phase !== 'deload' && w.taper !== true && w.taperApplied !== true);
}

describe('BB audit 2026-11 remediation', () => {
  it('clamps weeks 0/NaN and does not mutate the caller input', () => {
    const invalidWorkMax = { ...WORK_MAX, chest: 999 };
    const input = base({ weeks: 0, workMax: invalidWorkMax });
    const plan: any = buildBBPlan(input);
    expect(plan.weeks.length).toBe(1);
    expect(input.weeks).toBe(0);
    expect(input.workMax.chest).toBe(999);
    expect(plan.rationale.join(' ')).toContain('clamp');

    const nan: any = buildBBPlan(base({ weeks: Number.NaN }));
    expect(nan.weeks.length).toBe(8);
  });

  it('requires dcMode + AAS >= 750 for automatic DC rest-pause', () => {
    const noGate: any = buildBBPlan(base({
      patternId: 'upper_lower_6', level: 'enhanced', trainingYears: 9,
      weeks: 12, pedDoses: { AAS: 500, GH: 4, insulin: 10 },
    }));
    const dcComments = noGate.weeks.flatMap((w: any) => (w.sessions || []).flatMap((s: any) =>
      (s.exercises || []).filter((e: any) => /DC Rest-Pause/i.test(String(e.comment || '')))));
    expect(dcComments).toHaveLength(0);

    const gated: any = buildBBPlan(base({
      patternId: 'upper_lower_6', level: 'enhanced', trainingYears: 9,
      weeks: 12, dcMode: true, pedDoses: { AAS: 1000, GH: 4, insulin: 10 },
      intensityTechnique: 'none',
    }));
    const gatedDc = gated.weeks.flatMap((w: any) => (w.sessions || []).flatMap((s: any) =>
      (s.exercises || []).filter((e: any) => /DC Rest-Pause/i.test(String(e.comment || '')))));
    expect(gatedDc.length).toBeGreaterThan(0);
    expect(gatedDc.every((e: any) => e.sets === 1)).toBe(true);
  });

  it('intensityTechnique:none is an explicit ban, not "auto"', () => {
    const plan: any = buildBBPlan(base({
      level: 'enhanced', trainingYears: 8, weeks: 8,
      intensityTechnique: 'none',
      weakPoints: ['biceps'],
      pedDoses: { AAS: 1000 },
    }));
    const text = plan.weeks.flatMap((w: any) => (w.sessions || []).flatMap((s: any) =>
      (s.exercises || []).map((e: any) => String(e.comment || '')))).join(' ');
    expect(text).not.toMatch(/Rest-pause|Drop-set|Myo-reps|кластер/i);
    expect(plan.buildContext?.autoIntensityTechniques).toBe(false);
  });

  it('autoReg deload marks a real deload week and never creates 1-set work from multi-set work', () => {
    const plan: any = buildBBPlan(base({
      weeks: 10, intensityTechnique: 'none',
      autoRegResult: { volumeMultiplier: 0.6, topSetPctMultiplier: 1, rirShift: 1, deload: true },
    }));
    expect(plan.weeks.some((w: any) => w.deload === true || w.phase === 'deload')).toBe(true);
    for (const w of nonDeloadWeeks(plan)) {
      for (const s of w.sessions || []) for (const e of s.exercises || []) {
        if ((e.sets || 0) === 1 && (e.workSets || []).length === 1) {
          // Разрешён только настоящий DC-слот, которого без dcMode здесь нет.
          expect(e.comment || '').toMatch(/DC Rest-Pause/i);
        }
      }
    }
  });

  it('autoReg shifts RIR in workSets and applies the weight multiplier only to the top set', () => {
    const baseline: any = buildBBPlan(base({ weeks: 6, intensityTechnique: 'none' }));
    const plan: any = buildBBPlan(base({
      weeks: 6, intensityTechnique: 'none',
      autoRegResult: { volumeMultiplier: 1, topSetPctMultiplier: 0.8, rirShift: 2 },
    }));
    let checked = 0;
    for (const w of nonDeloadWeeks(plan)) {
      for (const s of w.sessions || []) for (const e of s.exercises || []) {
        if (e.warmupActivator) continue;
        const ws = e.workSets || [];
        if (ws.length >= 2 && ws[0].weight > 0 && ws[1].weight > 0) {
          expect(ws[0].weight).toBeLessThan(ws[1].weight);
          checked++;
        }
        for (const set of ws) {
          expect(set.rir).toBe(Math.min(5, Number(e.rir)));
        }
      }
    }
    expect(checked).toBeGreaterThan(0);

    // RIR-shift должен реально доехать до плана, а не остаться в комментарии.
    const baseWeek = nonDeloadWeeks(baseline)[0];
    const shiftWeek = nonDeloadWeeks(plan)[0];
    const baseRir = baseWeek.sessions.flatMap((s: any) => s.exercises).map((e: any) => Number(e.rir));
    const shiftRir = shiftWeek.sessions.flatMap((s: any) => s.exercises).map((e: any) => Number(e.rir));
    expect(shiftRir.filter((v: number, i: number) => v > (baseRir[i] ?? v)).length).toBeGreaterThan(0);
    const text = shiftWeek.sessions.flatMap((s: any) => s.exercises).map((e: any) => String(e.comment || '')).join(' ');
    expect(text).toMatch(/RIR \+2/i);
  });

  it('replan keeps sex, PED doses and derived snapshots for the whole plan', () => {
    const original: any = buildBBPlan(base({
      patternId: 'female_glute_5', level: 'advanced', trainingYears: 6,
      sex: 'female', weeks: 8, volumeGoal: 'mav',
      pedDoses: { AAS: 1000, GH: 4 }, onCourse: true,
    }));
    const replan = replanBBMesoFromFact(original, [], { currentWeek: 3 });
    expect(replan).not.toBeNull();
    const out: any = replan!.plan;
    expect(out.buildContext?.sex).toBe('female');
    expect(out.onCourse).toBe(true);
    expect(out.inputSnapshot?.sex).toBe('female');
    expect(out.inputSnapshot?.pedDoses?.AAS).toBe(1000);
    expect(Object.keys(out.weeklyVolume || {}).length).toBe(8);
    expect(out.validation).toBeDefined();
  });

  it('validator returns a structural error instead of throwing on malformed plans', () => {
    expect(() => validateBBPlan({} as any)).not.toThrow();
    expect(validateBBPlan({} as any).issues[0].code).toBe('empty_plan');

    const malformed: any = { weeks: [{ week: 1, sessions: [{ exercises: [{ name: 'Жим', sets: 3 }] }] }] };
    expect(() => validateBBPlan(malformed)).not.toThrow();
    const result = validateBBPlan(malformed);
    expect(result.issues.some(i => i.code === 'sets_mismatch')).toBe(true);

    const brokenSession: any = { weeks: [{ week: 1, sessions: [{}] }] };
    expect(() => validateBBPlan(brokenSession)).not.toThrow();
    expect(validateBBPlan(brokenSession).issues.some(i => i.code === 'malformed_session')).toBe(true);

    const nullExercise: any = { weeks: [{ week: 1, sessions: [{ exercises: [null] }] }] };
    expect(() => validateBBPlan(nullExercise)).not.toThrow();
  });

  it('re-finalization is idempotent (sets/workSets do not drift by +/-1)', () => {
    const source: any = buildBBPlan(base({
      patternId: 'upper_lower_6', level: 'advanced', trainingYears: 6, weeks: 8,
      intensityTechnique: 'none',
    }));
    const opts: any = {
      reorder: false, phaseSafety: true, level: 'advanced', trainingYears: 6,
      ensureMinimumVolume: true, controlledRotation: false,
      onCourse: false, maxWorkingSets: source.buildContext?.maxWorkingSets,
      maxExercises: source.buildContext?.maxExercises,
      priorityMuscles: source.priorityMuscles,
    };
    const sig = (p: any) => JSON.stringify(p.weeks.map((w: any) => w.sessions.map((s: any) =>
      s.exercises.map((e: any) => [e.muscle, e.name, e.sets, (e.workSets || []).length]))));
    const once = finalizeBBPlan(structuredClone(source), opts);
    const twice = finalizeBBPlan(structuredClone(once), opts);
    const thrice = finalizeBBPlan(structuredClone(twice), opts);
    expect(sig(twice)).toBe(sig(once));
    expect(sig(thrice)).toBe(sig(twice));
  });

  it('unknown pattern/level are visible in rationale, not silent fallbacks', () => {
    const plan: any = buildBBPlan(base({ patternId: 'no_such_split', level: 'wizard' }));
    const text = plan.rationale.join(' ');
    expect(text).toContain('no_such_split');
    expect(text).toContain('wizard');
  });
});
