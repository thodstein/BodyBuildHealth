/**
 * bb-roadmap-phase2-tempo-load.test.ts — регрессионные тесты Фазы 2 аудита BB-Auto:
 * W-3 (`neural`/`mini`/`full_rest` deloads),
 * W-4 (4 новые LoadStrategy + отсутствие двойного прогона double_progression),
 * W-5 (tempoFor 3-0-1-2, deload 2-0-1-0, TempoProfile, eccentricMult, sanitizeTempoNotation, tutSeconds),
 * W-6 (female_luteal <= female_foll, vol_mrv >= vol_mav, vbt W1-only),
 * Parity (programToBBPlan принимает pedPhase/bannedPatterns/tempoProfile/vbt).
 */

import { describe, it, expect } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { tempoFor, sanitizeTempoNotation, parseTempoTutPerRep, exerciseTempoOverride } from '../bb-tempo-rest';
import { estimateBBExerciseCost } from '../bb-fatigue.engine';
import { prescribeLoad, applyPostPhaseProcessing } from '../bb-autocoach.engine';
import { programToBBPlan } from '../cycle-to-plan';
import { FULL_PROGRAM_LIBRARY } from '../../complete-program-library.engine';
import type { BBBuilderInput } from '../bb-builder.engine';

const baseInput: BBBuilderInput = {
  patternId: 'upper_lower_4',
  level: 'intermediate',
  goal: 'mass',
  weeks: 4,
  workMax: {
    chest: 100, back: 100, quads: 120, hamstrings: 100, glutes: 110,
    shoulders: 60, biceps: 40, triceps: 45, calves: 90, abs: 20,
    forearms: 35, traps: 90,
  },
  planStartWeek: '2026-11-28',
  rotationMode: 'forbid',
};

describe('BB-Auto Phase 2 — Темпы, профили темпа и TUT (W-5)', () => {
  it('peak contraction exercises use 3-0-1-2 and deload uses 2-0-1-0', () => {
    expect(exerciseTempoOverride('Сведение в кроссовере')).toBe('3-0-1-2');
    expect(tempoFor('памп', undefined, 'deload', 'Сведение в кроссовере').notation).toBe('2-0-1-0');
    expect(tempoFor('тяж', undefined, 'deload').notation).toBe('2-0-1-0');
  });

  it('TempoProfile and eccentricMult adjust generated exercise tempo and tutSeconds', () => {
    const slowPlan = buildBBPlan({
      ...baseInput,
      weeks: 2,
      tempoProfile: 'slow_eccentric',
    });
    const w1Ex = slowPlan.weeks[0].sessions[0].exercises.find(e => !(e as any).warmupActivator)!;
    expect((w1Ex as any).tempoSpec).toBe('4-1-1-0');

    const eccSpec = tempoFor('тяж', undefined, 'accumulation', 'Жим штанги лёжа', { eccentricMult: 1.2 });
    expect(eccSpec.eccentric).toBeGreaterThanOrEqual(4);

    const costFast = estimateBBExerciseCost({
      muscle: 'chest', name: 'Жим', role: 'primary', character: 'тяж',
      sets: 3, repsRange: [8, 10], rir: 2,
      workSets: Array.from({ length: 3 }, () => ({ reps: 10, rir: 2, weight: 80, tempo: '2-0-1-0' })),
      comment: '', executionProfile: {} as any, rationale: '',
    });
    const costSlow = estimateBBExerciseCost({
      muscle: 'chest', name: 'Жим', role: 'primary', character: 'тяж',
      sets: 3, repsRange: [8, 10], rir: 2,
      workSets: Array.from({ length: 3 }, () => ({ reps: 10, rir: 2, weight: 80, tempo: '4-1-1-0' })),
      comment: '', executionProfile: {} as any, rationale: '',
    });
    expect(costSlow.tutSeconds).toBeGreaterThan(costFast.tutSeconds!);
    expect(costSlow.timeSeconds).toBeGreaterThan(costFast.timeSeconds);
  });

  it('sanitizeTempoNotation strips prose descriptions and parses valid 4-digit tempo', () => {
    expect(sanitizeTempoNotation('3-0-1-2 (медленный спуск, пауза 2с)')).toBe('3-0-1-2');
    expect(sanitizeTempoNotation('некорректный текст без цифр')).toBeUndefined();
    expect(parseTempoTutPerRep('4-1-1-0', 4)).toBe(6);
  });
});

describe('BB-Auto Phase 2 — LoadStrategy & Deload Protocols (W-3, W-4)', () => {
  it('supports 4 new LoadStrategy modes in prescribeLoad and top_set_backoff applies backoff weight', () => {
    const tsb = prescribeLoad('top_set_backoff', 100, 8, 2, 120, 2, 6, 'accumulation', 'compound', 'primary');
    expect(tsb.nextWeight).toBeGreaterThanOrEqual(100);
    const dd = prescribeLoad('dynamic_double', 80, 12, 2, 100, 2, 6, 'accumulation', 'compound', 'primary');
    expect(dd.nextWeight).toBeGreaterThan(80);
    const rg = prescribeLoad('rep_goal', 60, 10, 2, 80, 2, 6, 'accumulation', 'compound', 'primary');
    expect(rg.nextWeight).toBeGreaterThan(60);
    const slStay = prescribeLoad('step_loading', 90, 8, 2, 110, 2, 6, 'accumulation', 'compound', 'primary');
    expect(slStay.nextWeight).toBe(90);
    const slJump = prescribeLoad('step_loading', 90, 9, 2, 110, 4, 6, 'accumulation', 'compound', 'primary');
    expect(slJump.nextWeight).toBeGreaterThan(90);

    const planTsb = buildBBPlan({ ...baseInput, weeks: 3, loadStrategy: 'top_set_backoff' });
    const primary = planTsb.weeks[1].sessions[0].exercises.find(e => e.role === 'primary' && e.workSets.length >= 2 && e.workSets[0].weight > 0);
    expect(primary).toBeDefined();
    expect(primary!.workSets[0].weight).toBeGreaterThan(primary!.workSets[1].weight);
  });

  it('W-3: neural deload keeps isolations >=10 reps & >=2 sets; mini deload keeps higher intensity/volume than pump', () => {
    const neuralPlan = buildBBPlan({ ...baseInput, weeks: 6, autoDeload: true, deloadType: 'neural' });
    const neuralDeloadWk = neuralPlan.weeks.find(w => w.phase === 'deload' || w.deload);
    expect(neuralDeloadWk).toBeDefined();
    for (const s of neuralDeloadWk!.sessions) {
      for (const e of s.exercises) {
        if ((e as any).warmupActivator) continue;
        expect(e.sets).toBeGreaterThanOrEqual(2);
        if ((e as any).exerciseType === 'isolation') {
          expect(e.repsRange[0]).toBeGreaterThanOrEqual(10);
        }
      }
    }

    const miniPlan = buildBBPlan({ ...baseInput, weeks: 6, autoDeload: true, deloadType: 'mini' });
    const miniDeloadWk = miniPlan.weeks.find(w => w.phase === 'deload' || w.deload)!;
    const pumpPlan = buildBBPlan({ ...baseInput, weeks: 6, autoDeload: true, deloadType: 'pump' });
    const pumpDeloadWk = pumpPlan.weeks.find(w => w.phase === 'deload' || w.deload)!;
    const avgW = (wk: any) => {
      const ws = wk.sessions.flatMap((s: any) => s.exercises.flatMap((e: any) => e.workSets.map((x: any) => x.weight).filter((v: number) => v > 0)));
      return ws.reduce((a: number, b: number) => a + b, 0) / Math.max(1, ws.length);
    };
    expect(avgW(miniDeloadWk)).toBeGreaterThan(avgW(pumpDeloadWk));
  });
});

describe('BB-Auto Phase 2 — Инверсии параметров (W-6) и паритет Programs', () => {
  it('W-6: female_luteal total weekly volume <= female_follicular total weekly volume', () => {
    const foll = buildBBPlan({ ...baseInput, sex: 'female', cycleDay: 10, cycleLength: 28, weeks: 4 });
    const luteal = buildBBPlan({ ...baseInput, sex: 'female', cycleDay: 24, cycleLength: 28, weeks: 4 });
    const sumSets = (p: any) => p.weeks[0].sessions.reduce((a: number, s: any) => a + s.exercises.reduce((b: number, e: any) => b + e.sets, 0), 0);
    expect(sumSets(luteal)).toBeLessThanOrEqual(sumSets(foll));
  });

  it('W-6: vol_mrv >= vol_mav total working sets', () => {
    const mav = buildBBPlan({ ...baseInput, volumeGoal: 'mav', weeks: 4 });
    const mrv = buildBBPlan({ ...baseInput, volumeGoal: 'mrv', weeks: 4 });
    const sumSets = (p: any) => p.weeks[1].sessions.reduce((a: number, s: any) => a + s.exercises.reduce((b: number, e: any) => b + e.sets, 0), 0);
    expect(sumSets(mrv)).toBeGreaterThanOrEqual(sumSets(mav));
  });

  it('W-6: VBT velocity loss only reduces Week 1, leaving Week 2+ normal', () => {
    const noVbt = buildBBPlan({ ...baseInput, weeks: 4 });
    const withVbt = buildBBPlan({
      ...baseInput,
      weeks: 4,
      vbt: { lift: 'Жим штанги лёжа', bestVelocity: 0.70, lastVelocity: 0.35 },
    });
    const w1NoVbt = noVbt.weeks[0].sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets, 0), 0);
    const w1Vbt = withVbt.weeks[0].sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets, 0), 0);
    const w2NoVbt = noVbt.weeks[1].sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets, 0), 0);
    const w2Vbt = withVbt.weeks[1].sessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.sets, 0), 0);
    expect(w1Vbt).toBeLessThan(w1NoVbt);
    expect(w2Vbt).toBe(w2NoVbt);
  });

  it('Parity: programToBBPlan accepts pedPhase, bannedPatterns, tempoProfile, and vbt', () => {
    const prog = FULL_PROGRAM_LIBRARY[0];
    const plan = programToBBPlan(prog, {
      workMax: baseInput.workMax,
      pedPhase: 'pct',
      bannedPatterns: ['присед'],
      tempoProfile: 'hypertrophy_controlled',
      vbt: { lift: 'Жим', bestVelocity: 0.7, lastVelocity: 0.4 },
    });
    expect((plan as any).inputSnapshot.pedPhase).toBe('pct');
    expect((plan as any).inputSnapshot.tempoProfile).toBe('hypertrophy_controlled');
    const firstNonDeload = plan.weeks.find(w => w.phase !== 'deload')!;
    const firstEx = firstNonDeload.sessions[0].exercises.find(e => !(e as any).warmupActivator)!;
    expect((firstEx as any).tempoSpec).toBe('3-0-1-1');
  });
});
