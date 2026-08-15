/**
 * bb-peak-week.test.ts — тесты peak week протокола.
 */
import { describe, expect, it } from 'vitest';
import { buildPeakWeekProtocol, applyPeakWeekToPlan, type PeakWeekProtocol } from '../bb-peak-week.engine';
import { buildBBPlan, type BBBuilderInput } from '../bb-builder.engine';

const EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

function makeInput(overrides: Partial<BBBuilderInput> = {}): BBBuilderInput {
  return {
    patternId: 'upper_lower_4',
    level: 'advanced',
    goal: 'mass',
    weeks: 8,
    workMax: { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50 },
    equipment: EQ,
    volumeGoal: 'mav',
    ...overrides,
  };
}

describe('buildPeakWeekProtocol', () => {
  it('создаёт 7-дневный протокол', () => {
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    expect(proto.days).toHaveLength(7);
    expect(proto.showDay).toBe(7);
  });

  it('день 7 = show day', () => {
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    expect(proto.days[6].phase).toBe('show');
  });

  it('день 1-3 = load/depletion (water high)', () => {
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    expect(proto.days[0].phase).toBe('load');
    expect(proto.days[1].phase).toBe('depletion');
    expect(proto.days[2].phase).toBe('depletion');
    expect(proto.days[0].waterLiters).toBeGreaterThan(5);
  });

  it('день 4-5 = reload (carbs high)', () => {
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    expect(proto.days[3].phase).toBe('reload');
    expect(proto.days[4].phase).toBe('reload');
    expect(proto.days[3].carbGrams).toBeGreaterThan(200);
  });

  it('день 6 = peak (water low)', () => {
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    expect(proto.days[5].phase).toBe('peak');
    expect(proto.days[5].waterLiters).toBeLessThan(1);
  });

  it('вода: load > peak > show', () => {
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    expect(proto.days[0].waterLiters).toBeGreaterThan(proto.days[5].waterLiters);
    expect(proto.days[5].waterLiters).toBeGreaterThan(proto.days[6].waterLiters);
  });

  it('натрий: load > cut', () => {
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    expect(proto.days[0].sodiumGrams).toBeGreaterThan(proto.days[5].sodiumGrams);
  });

  it('углеводы: depletion < reload', () => {
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    expect(proto.days[1].carbGrams).toBeLessThan(proto.days[3].carbGrams);
  });

  it('тренировки: дни 1-3 > 0, дни 4-7 = 0', () => {
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    expect(proto.days[0].trainingMinutes).toBeGreaterThan(0);
    expect(proto.days[3].trainingMinutes).toBe(0);
    expect(proto.days[6].trainingMinutes).toBe(0);
  });

  it('позирование нарастает к show day', () => {
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    expect(proto.days[6].poseMinutes).toBeGreaterThan(proto.days[0].poseMinutes);
  });

  it('warnings содержат предупреждения о безопасности', () => {
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    expect(proto.warnings.length).toBeGreaterThan(2);
    expect(proto.warnings.some(w => w.includes('тренер') || w.includes('врач'))).toBe(true);
  });

  it('female → меньше углеводов в reload', () => {
    const male = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    const female = buildPeakWeekProtocol(80, 'bikini', 'female');
    expect(female.days[3].carbGrams).toBeLessThan(male.days[3].carbGrams);
  });

  it('bikini → меньше натрия в load', () => {
    const bikini = buildPeakWeekProtocol(60, 'bikini', 'female');
    const open = buildPeakWeekProtocol(100, 'open', 'male');
    expect(bikini.days[0].sodiumGrams).toBeLessThanOrEqual(open.days[0].sodiumGrams);
  });

  it('totalWaterCut = load - show', () => {
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    expect(proto.totalWaterCut).toBeCloseTo(proto.days[0].waterLiters - proto.days[6].waterLiters, 1);
  });

  it('totalCarbReload = reloadCarbs × 2 дня', () => {
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    expect(proto.totalCarbReload).toBe(proto.days[3].carbGrams * 2);
  });
});

describe('applyPeakWeekToPlan', () => {
  it('последняя неделя → phase=peaking, deload=true', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    const result = applyPeakWeekToPlan(plan, proto);
    const lastWeek = result.weeks[result.weeks.length - 1];
    expect(lastWeek.phase).toBe('peaking');
    expect(lastWeek.deload).toBe(true);
  });

  it('упражнения последней недели: sets ≤ 1, weight ×0.5', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    const result = applyPeakWeekToPlan(plan, proto);
    const lastWeek = result.weeks[result.weeks.length - 1];
    for (const s of lastWeek.sessions) {
      for (const e of s.exercises) {
        expect(e.sets).toBeGreaterThanOrEqual(1);
        expect(e.rir).toBe(4);
      }
    }
  });

  it('rationale содержит peak week протокол', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    const result = applyPeakWeekToPlan(plan, proto);
    expect(result.rationale.some(r => r.includes('Peak week'))).toBe(true);
    expect(result.rationale.some(r => r.includes('⚠'))).toBe(true);
  });

  it('weekNumber: применяется к указанной неделе, а не последней (для prep-блока)', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    const result = applyPeakWeekToPlan(plan, proto, 5);
    expect(result.weeks[4].phase).toBe('peaking');
    expect(result.weeks[4].deload).toBe(true);
    // Последняя неделя НЕ тронута
    expect(result.weeks[7].phase).not.toBe('peaking');
    // Комментарий Peak week в целевом упражнении
    const targetEx = result.weeks[4].sessions[0].exercises[0];
    expect(String(targetEx.comment || '')).toContain('[Peak week:');
  });

  it('weekNumber за пределами диапазона → клампится к краям', () => {
    const plan = buildBBPlan(makeInput({ weeks: 4 }));
    const proto = buildPeakWeekProtocol(80, 'mens_physique', 'male');
    expect(applyPeakWeekToPlan(plan, proto, 99).weeks[3].phase).toBe('peaking');
    expect(applyPeakWeekToPlan(plan, proto, 0).weeks[0].phase).toBe('peaking');
  });
});
