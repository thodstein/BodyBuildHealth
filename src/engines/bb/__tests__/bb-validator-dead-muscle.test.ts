import { describe, it, expect } from 'vitest';
import { validateBBPlan } from '../bb-validator.engine';
import type { BBPlan } from '../bb-builder.engine';

/**
 * P1-9 (план BB-FEMALE-POSTERIOR-QUALITY-PLAN): валидатор-гейты.
 * Раньше «quads target 8, факт 0» и «частота 0×/нед» пропускались как
 * warning'и — план с мёртвой мышцей оставался valid. Теперь это error,
 * с честными исключениями (push/pull-сплиты без ножных дней, травмы).
 */

const mkPlan = (over: Record<string, unknown> = {}): BBPlan => ({
  pattern: {} as any,
  weeks: [{ week: 1, phase: 'accumulation', sessions: [{ day: 1, sessionTag: 'Legs', exercises: [] }] }] as any,
  rationale: [],
  rotationMuscleVolume: {},
  volumeTargets: {
    quads: { muscle: 'quads', frequency: 2, mev: 8, mav: 12, mrv: 16, targetSets: 10, minSetsPerSession: 2, maxSetsPerSession: 4, rationale: [] },
    hamstrings: { muscle: 'hamstrings', frequency: 2, mev: 6, mav: 10, mrv: 14, targetSets: 8, minSetsPerSession: 2, maxSetsPerSession: 4, rationale: [] },
  } as any,
  weeklyVolume: { 1: { quads: { directSets: 4, effectiveSets: 6 }, hamstrings: { directSets: 0, effectiveSets: 2 } } } as any,
  ...over,
} as unknown as BBPlan);

describe('P1-9: валидатор ловит мёртвые мышцы', () => {
  it('major-мышца: факт 0 при target MEV > 0 → error (valid=false)', () => {
    const plan = mkPlan({
      weeklyVolume: { 1: { quads: { directSets: 0, effectiveSets: 0 }, hamstrings: { directSets: 0, effectiveSets: 0 } } },
    });
    const r = validateBBPlan(plan, { level: 'intermediate' });
    const errors = r.issues.filter((i: any) => i.level === 'error' && i.code === 'target_volume_deficit');
    expect(errors.map((e: any) => e.exercise)).toContain('quads');
    expect(r.valid).toBe(false);
  });

  it('major-мышца: частота 0×/нед → error', () => {
    const plan = mkPlan({
      volumeTargets: {
        quads: { muscle: 'quads', frequency: 0, mev: 8, mav: 12, mrv: 16, targetSets: 10, minSetsPerSession: 2, maxSetsPerSession: 4, rationale: [] },
      } as any,
    });
    const r = validateBBPlan(plan, { level: 'intermediate' });
    const errors = r.issues.filter((i: any) => i.level === 'error' && i.code === 'low_training_frequency');
    expect(errors.map((e: any) => e.exercise)).toContain('quads');
    expect(r.valid).toBe(false);
  });

  it('push/pull-сплит без ножных дней: 0×/нед на ногах — НЕ ошибка (дизайн сплита)', () => {
    const plan = mkPlan({
      weeks: [{ week: 1, phase: 'accumulation', sessions: [{ day: 1, sessionTag: 'Push', exercises: [] }, { day: 2, sessionTag: 'Pull', exercises: [] }] }] as any,
    });
    const r = validateBBPlan(plan, { level: 'intermediate' });
    const errors = r.issues.filter((i: any) => i.level === 'error');
    expect(errors).toHaveLength(0);
    expect(r.valid).toBe(true);
  });

  it('исключённая травмой мышца: 0 объёма и 0 частоты — НЕ ошибка', () => {
    const plan = mkPlan({
      weeklyVolume: { 1: { quads: { directSets: 0, effectiveSets: 0 }, hamstrings: { directSets: 0, effectiveSets: 2 } } },
      volumeTargets: {
        quads: { muscle: 'quads', frequency: 0, mev: 8, mav: 12, mrv: 16, targetSets: 10, minSetsPerSession: 2, maxSetsPerSession: 4, rationale: [] },
        hamstrings: { muscle: 'hamstrings', frequency: 2, mev: 6, mav: 10, mrv: 14, targetSets: 8, minSetsPerSession: 2, maxSetsPerSession: 4, rationale: [] },
      } as any,
    });
    const r = validateBBPlan(plan, { level: 'intermediate', excludedMuscles: ['quads'] });
    const errors = r.issues.filter((i: any) => i.level === 'error');
    expect(errors).toHaveLength(0);
    expect(r.valid).toBe(true);
  });

  it('PRO/гранулярные ключи (delt_mid): факт 0 — warning, не error', () => {
    const plan = mkPlan({
      volumeTargets: {
        quads: { muscle: 'quads', frequency: 2, mev: 8, mav: 12, mrv: 16, targetSets: 10, minSetsPerSession: 2, maxSetsPerSession: 4, rationale: [] },
        delt_mid: { muscle: 'delt_mid', frequency: 2, mev: 4, mav: 8, mrv: 12, targetSets: 6, minSetsPerSession: 2, maxSetsPerSession: 4, rationale: [] },
      } as any,
      weeklyVolume: { 1: { quads: { directSets: 4, effectiveSets: 6 } } } as any,
    });
    const r = validateBBPlan(plan, { level: 'intermediate' });
    const deltErrors = r.issues.filter((i: any) => i.level === 'error' && i.exercise === 'delt_mid');
    expect(deltErrors).toHaveLength(0);
  });
});
