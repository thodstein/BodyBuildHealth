/**
 * planner-goal-phase.test.ts — Эпик 2 (NUTRITION-PROFESSIONAL-PLAN):
 * разводка «цель» и «фаза». Фаза = фарма-контекст: НЕ меняет направление калорий
 * (это goal), только фарма-гейты через инъекции + предупреждение конфликтов.
 * PHASES = 4 фарма-фазы (дубли-цели удалены).
 */

import { describe, it, expect } from 'vitest';
import { computePlannerTargets } from '../planner-targets';
import { PHASES, GOALS } from '../types';
import { buildDayTargets } from '../planner-day-targets';

const base = (overrides: any = {}) => ({
  weightKg: 90, heightCm: 180, age: 30, sex: 'male' as const, goal: 'mass', phase: 'course', bodyFatPct: 15,
  workoutsPerWeek: 4, avgWorkoutMinutes: 75, dailySteps: 9000, householdActivity: 'moderate', trainType: 'mixed',
  trainIntensity: 'high', surplusPct: 10, injections: [] as any[], weightAdaptMode: false, weightLogWeek: [] as number[],
  expectedLossKgWeek: 0, metabolicAdaptEnabled: false, metabolicAdaptPct: 0, manualGPerKg: { protein: 0, fat: 0, carbs: 0 },
  ...overrides,
});

describe('PHASES — только фарма-фазы', () => {
  it('содержит 4 фарма-фазы', () => {
    const ids = PHASES.map(p => p.id);
    expect(ids).toEqual(['course', 'bridge', 'pct', 'recovery']);
  });
  it('не содержит дублей-целей', () => {
    const goalIds = new Set(GOALS.map(g => g.id));
    const phaseIds = new Set(PHASES.map(p => p.id));
    const overlap = [...phaseIds].filter(id => goalIds.has(id));
    expect(overlap).toEqual([]);
  });
});

describe('фаза не меняет направление калорий (направление задаёт goal)', () => {
  it('course/bridge/pct/recovery дают одинаковые kcal при одной цели', () => {
    const phases = ['course', 'bridge', 'pct', 'recovery'];
    const results = phases.map(ph => computePlannerTargets(base({ phase: ph })));
    const kcalSet = new Set(results.map(r => r.kcal));
    expect(kcalSet.size).toBe(1);
    const pSet = new Set(results.map(r => r.protein));
    expect(pSet.size).toBe(1);
  });
  it('цель меняет kcal: cutting < maintenance < mass при той же фазе course', () => {
    const cut = computePlannerTargets(base({ goal: 'cutting', phase: 'course' }));
    const maint = computePlannerTargets(base({ goal: 'maintenance', phase: 'course' }));
    const mass = computePlannerTargets(base({ goal: 'mass', phase: 'course' }));
    expect(cut.kcal).toBeLessThan(maint.kcal);
    expect(maint.kcal).toBeLessThan(mass.kcal);
  });
  it('наследие: сохранённая фаза-цель (cutting) трактуется нейтрально', () => {
    const legacy = computePlannerTargets(base({ goal: 'cutting', phase: 'cutting' }));
    const normal = computePlannerTargets(base({ goal: 'cutting', phase: 'course' }));
    expect(legacy.kcal).toBe(normal.kcal);
  });
  it('ААС-правило +0.3 г/кг работает независимо от фазы (не дублируется)', () => {
    const without = computePlannerTargets(base({ phase: 'course' }));
    const withAas = computePlannerTargets(base({ phase: 'course', injections: [{ type: 'ААС', dose: 500 }] }));
    expect(withAas.protein - without.protein).toBeGreaterThanOrEqual(Math.round(90 * 0.3) - 1);
    // recovery не даёт дополнительный бонус белка (только пресет + инъекции)
    const recovery = computePlannerTargets(base({ phase: 'recovery' }));
    expect(recovery.protein).toBe(without.protein);
  });
});

describe('предупреждение конфликта цель-масса + ПКТ/мост', () => {
  it('goal=mass + phase=pct → warning', () => {
    const r = computePlannerTargets(base({ phase: 'pct' }));
    expect(Array.isArray(r.warnings)).toBe(true);
    expect((r.warnings || []).some(w => w.includes('pct') && w.includes('mass'))).toBe(true);
  });
  it('goal=mass + phase=bridge → warning', () => {
    const r = computePlannerTargets(base({ phase: 'bridge' }));
    expect((r.warnings || []).length).toBeGreaterThan(0);
  });
  it('goal=mass + phase=course → без warning', () => {
    const r = computePlannerTargets(base({ phase: 'course' }));
    expect(r.warnings || []).toEqual([]);
  });
  it('goal=cutting + phase=pct → без warning (дефицит на ПКТ — норма)', () => {
    const r = computePlannerTargets(base({ goal: 'cutting', phase: 'pct' }));
    expect(r.warnings || []).toEqual([]);
  });
});

describe('buildDayTargets: warnings доезжают в breakdown', () => {
  it('конфликт mass+pct виден в разборе дня', () => {
    const calc = computePlannerTargets(base({ phase: 'pct' }));
    const day = buildDayTargets({
      weightKg: 90, presetGPerKg: 2.0, fatFloorGPerKg: 0.8, kbjuMode: 'auto',
      calcTargets: calc,
      profileTargets: computePlannerTargets(base({ goal: 'maintenance', phase: 'maintenance' })),
      goal: 'mass', trainingVolumeMinPerWeek: 300, budget: 'medium', insulinTotalUnits: 0,
    });
    expect(day.breakdown.some(b => b.startsWith('⚠ Фаза «pct»'))).toBe(true);
  });
  it('без конфликта — нет ⚠-строк согласованности', () => {
    const calc = computePlannerTargets(base({ phase: 'course' }));
    const day = buildDayTargets({
      weightKg: 90, presetGPerKg: 2.0, fatFloorGPerKg: 0.8, kbjuMode: 'auto',
      calcTargets: calc,
      profileTargets: computePlannerTargets(base({ goal: 'maintenance', phase: 'maintenance' })),
      goal: 'mass', trainingVolumeMinPerWeek: 300, budget: 'medium', insulinTotalUnits: 0,
    });
    expect(day.breakdown.some(b => b.startsWith('⚠ Фаза'))).toBe(false);
  });
});