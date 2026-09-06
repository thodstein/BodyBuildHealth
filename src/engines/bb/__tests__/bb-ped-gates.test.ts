import { describe, expect, it } from 'vitest';
import { buildBBPlan, type BBBuilderInput } from '../bb-builder.engine';
import { adaptForPEDs, type PED, type CourseIntensity } from '../bb-ped-adaptation.engine';
import { schemeFor } from '../bb-rep-schemes.engine';
import { autoAssignIntensityTechniques } from '../bb-finalize.engine';

/**
 * bb-ped-gates.test.ts — гейты PED-схем (P0.3 соло-запрет, FST-7 7-in-1 гейт).
 * - FST-7 7-in-1: только enhanced без joint-guard (иначе даунгрейд до standard).
 * - Соло-инсулин без AAS/GH: запрет FST-7, rest_pause/DC (только warnings было —
 *   теперь реальные гейты + rationale).
 */
const WM = { chest: 100, back: 120, shoulders: 60, biceps: 50, triceps: 60, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };
const BASE_MRV = 20;

function buildWithPED(input: BBBuilderInput, peds: PED[], doses: Record<string, number>, intensity: CourseIntensity = 'moderate') {
  const pedAdapt = adaptForPEDs(peds, BASE_MRV, doses, intensity);
  return buildBBPlan({ ...input, pedDoses: doses } as any, pedAdapt);
}

const baseInput = (over: Partial<BBBuilderInput> = {}): BBBuilderInput => ({
  patternId: 'upper_lower_4',
  level: 'enhanced',
  trainingYears: 4,
  goal: 'mass',
  weeks: 4,
  workMax: WM,
  volumeScheme: 'fst7',
  ...over,
} as any);

const fst7Marked = (plan: any) => plan.weeks
  .flatMap((w: any) => w.sessions)
  .flatMap((s: any) => s.exercises)
  .filter((e: any) => !(e as any).warmupActivator && (e.comment || '').includes('FST-7'));

describe('FST-7 7-in-1 гейт', () => {
  it('enhanced без PED: финишер 7 сетов выживает', () => {
    const plan = buildBBPlan(baseInput({}));
    const marked = fst7Marked(plan);
    expect(marked.length).toBeGreaterThan(0);
    expect(marked.some((e: any) => e.sets === 7)).toBe(true);
    for (const e of marked) expect(e.sets).toBeLessThanOrEqual(7);
  }, 30000);

  it('intermediate: даунгрейд до standard + rationale', () => {
    const plan = buildBBPlan(baseInput({ level: 'intermediate', trainingYears: 3 }));
    expect((plan as any).volumeScheme).toBe('standard');
    expect(plan.rationale.some((r: string) => r.includes('FST-7 7-in-1'))).toBe(true);
    expect(fst7Marked(plan).length).toBe(0);
  }, 30000);

  it('enhanced + GH 4 (joint-guard): даунгрейд', () => {
    const plan = buildWithPED(baseInput({}), ['GH'], { GH: 4 });
    expect((plan as any).volumeScheme).toBe('standard');
    expect(plan.rationale.some((r: string) => r.includes('joint-guard'))).toBe(true);
  }, 30000);
});

describe('Соло-инсулин: запрет FST-7/DC', () => {
  it('соло-инсулин + fst7 → standard + warning', () => {
    const plan = buildWithPED(baseInput({}), ['insulin'], { insulin: 10 });
    expect((plan as any).volumeScheme).toBe('standard');
    expect(plan.rationale.some((r: string) => r.includes('Соло-инсулин') || r.includes('соло-инсулин'))).toBe(true);
    expect(fst7Marked(plan).length).toBe(0);
  }, 30000);

  it('schemeFor: соло-инсулин никогда не dc_rp', () => {
    const s = schemeFor({
      phase: 'intensification' as any, character: 'тяж' as any, level: 'advanced',
      pedProfile: { hasAAS: false, hasGH: false, hasInsulin: true, hasMGF: false, hasIGF1: false },
    } as any);
    expect(s).not.toBe('dc_rp');
  });

  it('rest_pause + соло-инсулин: явная техника снимается', () => {
    const plan = buildWithPED(baseInput({ intensityTechnique: 'rest_pause' as any }), ['insulin'], { insulin: 10 });
    const restPause = plan.weeks
      .flatMap((w: any) => w.sessions)
      .flatMap((s: any) => s.exercises)
      .filter((e: any) => (e.workSets || []).some((ws: any) => ws.technique === 'rest_pause'));
    expect(restPause.length).toBe(0);
  }, 30000);

  it('autoAssignIntensityTechniques: флаг гасит rest_pause/myo (dropset жив)', () => {
    const mkPlan = (): any => ({
      weeks: [{ phase: 'accumulation', sessions: [{ day: 1, exercises: [
        { muscle: 'biceps', name: 'Подъём штанги на бицепс', role: 'accessory', character: 'памп', sets: 3, repsRange: [10, 12] as [number, number], rir: 2, workSets: [{ reps: 10, rir: 2, weight: 20 }, { reps: 10, rir: 2, weight: 20 }, { reps: 10, rir: 2, weight: 20 }] },
        { muscle: 'chest', name: 'Сведение в кроссовере', role: 'accessory', character: 'памп', sets: 3, repsRange: [12, 15] as [number, number], rir: 2, workSets: [{ reps: 12, rir: 2, weight: 20 }, { reps: 12, rir: 2, weight: 20 }, { reps: 12, rir: 2, weight: 20 }] },
      ] }] }],
    });
    const blocked = mkPlan();
    autoAssignIntensityTechniques(blocked, 'advanced', [], undefined, false);
    const techsBlocked = blocked.weeks[0].sessions[0].exercises.flatMap((e: any) => (e.workSets || []).map((ws: any) => ws.technique).filter(Boolean));
    expect(techsBlocked).not.toContain('rest_pause');
    expect(techsBlocked).not.toContain('myo_rep');
    const allowed = mkPlan();
    autoAssignIntensityTechniques(allowed, 'advanced', [], undefined, true);
    const techsAllowed = allowed.weeks[0].sessions[0].exercises.flatMap((e: any) => (e.workSets || []).map((ws: any) => ws.technique).filter(Boolean));
    expect(techsAllowed.length).toBeGreaterThan(0);
  });
});
