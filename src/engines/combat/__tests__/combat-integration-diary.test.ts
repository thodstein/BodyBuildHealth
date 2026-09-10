/**
 * combat-integration-diary.test.ts — дневник считает и core-группу;
 * кардио-пейлоад несёт число нагрузки (не объект); нота питания по-русски.
 */
import { describe, it, expect } from 'vitest';
import { buildDiaryTrendCB } from '../combat-diary.engine';
import { combatToCardioPayload, combatToNutritionPayload } from '../combat-integration.engine';
import { buildCombatPlan } from '../combat-builder.engine';
import { finalizeCombatPlan } from '../combat-finalize.engine';

const dayAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

describe('combat diary core group', () => {
  it('core-тренд считается (deadbug 28д окно)', () => {
    const logs = [
      { exerciseId: 'deadbug', date: dayAgo(5), sets: [{ weight: 0, reps: '30с' }] },
      { exerciseId: 'deadbug', date: dayAgo(35), sets: [{ weight: 0, reps: '20с' }] },
    ];
    const trends = buildDiaryTrendCB(logs);
    expect(trends).not.toBeNull();
    const core = trends!.find(t => t.group === 'core');
    expect(core).toBeDefined();
    expect(core!.changePct).toBeGreaterThan(0);
  });
});

describe('combat payloads', () => {
  it('cardio outsideLoad — всегда число или null', () => {
    const plan = finalizeCombatPlan(buildCombatPlan({
      discipline: 'mma', goal: 'power', level: 'intermediate', weeks: 2, daysPerWeek: 2,
      outsideLoad: { sessionsPerWeek: 3, avgDurationMin: 90, avgSRPE: 7, interference: 'medium', highIntensityDays: [1, 3] },
    } as any));
    const cardio = combatToCardioPayload(plan);
    expect(cardio).not.toBeNull();
    expect(typeof cardio!.outsideLoad === 'number' || cardio!.outsideLoad === null).toBe(true);
    // 3×90×7 = 1890
    expect(cardio!.outsideLoad).toBe(1890);
  });

  it('нота питания без raw weighInType', () => {
    const plan = finalizeCombatPlan(buildCombatPlan({
      discipline: 'mma', goal: 'weight_cut', level: 'intermediate',
      weeks: 4, daysPerWeek: 3, weightCutKg: 4, bodyweight: 80,
    } as any));
    const nut = combatToNutritionPayload(plan);
    expect(nut.note).toContain('взвешивание за 24ч');
    expect(nut.note).not.toContain('day_before_24h');
    expect(nut.note).not.toContain('same_day_2h');
  });
});
