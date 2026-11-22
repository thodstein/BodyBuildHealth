import { describe, expect, it } from 'vitest';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import { buildLMSPlan, type LMSPlanExercise } from '../lms-builder.engine';
import { applyPLEffectiveOverlay, scaleSetCount } from '../lms-effective-plan';

function basePlan() {
  return buildLMSPlan({
    template: CYCLE_01,
    pmMap: { Присед: 150, 'Жим лежа': 100, 'Становая тяга': 180 },
    fallbackPm: 80,
    weeksOverride: 1,
    faithful: true,
  });
}

describe('effective PL plan', () => {
  it('requires explicit consent for a strict source-length change', () => {
    const pmMap = { Присед: 150, 'Жим лежа': 100, 'Становая тяга': 180 };
    const weeks = CYCLE_01.meta.weeks + 1;
    expect(() =>
      buildLMSPlan({
        template: CYCLE_01,
        pmMap,
        weeksOverride: weeks,
        requireSourceChangeConsent: true,
      }),
    ).toThrow('согласие');
    const allowed = buildLMSPlan({
      template: CYCLE_01,
      pmMap,
      weeksOverride: weeks,
      requireSourceChangeConsent: true,
      sourceChangeConsent: true,
    });
    expect(allowed.weeks).toHaveLength(weeks);
  });

  it('applies edits by source work-set block without flattening the set count', () => {
    const plan = basePlan();
    const source = plan.weeks[0].days[0].exercises[0];
    const edited = applyPLEffectiveOverlay(plan, {
      edits: { '1_0_0_0': { sets: 5, weight: 123.4, reps: 6, rir: 3 } },
    });
    const result = edited.weeks[0].days[0].exercises[0];
    expect(result.workSets[0].sets).toBe(5);
    expect(result.workSets[0].weight).toBe(123.4);
    expect(result.workSets[0].reps).toBe(6);
    expect(result.workSets[0].rir).toBe(3);
    expect(plan.weeks[0].days[0].exercises[0]).toBe(source);
  });

  it('uses the flattened set index used by the editor across work-set blocks', () => {
    const plan = basePlan();
    const source = plan.weeks[0].days[0].exercises[0];
    const withBlocks = JSON.parse(JSON.stringify(plan)) as typeof plan;
    const exercise = withBlocks.weeks[0].days[0].exercises[0];
    exercise.workSets = [
      { ...source.workSets[0], sets: 2 },
      { ...source.workSets[0], sets: 3, weight: 200 },
    ];
    const result = applyPLEffectiveOverlay(withBlocks, {
      edits: { '1_0_0_2': { weight: 222 } },
    }).weeks[0].days[0].exercises[0];
    expect(result.workSets[0].weight).toBe(source.workSets[0].weight);
    expect(result.workSets[1].weight).toBe(222);
  });

  it('applies auto-reg and diary overlays once and recalculates metrics', () => {
    const plan = basePlan();
    const sourceSets = plan.weeks[0].days[0].exercises[0].workSets[0].sets;
    const diary = new Map([
      [
        plan.weeks[0].days[0].exercises[0].name,
        {
          adjustedWeight: 90,
          adjustedSets: sourceSets,
          adjustedRir: 3,
        },
      ],
    ]);
    const adjusted = applyPLEffectiveOverlay(plan, {
      autoReg: { volumeMultiplier: 0.5, topSetPctMultiplier: 0.9, rirShift: 0 },
      diary,
    });
    const result = adjusted.weeks[0].days[0].exercises[0].workSets[0];
    expect(result.sets).toBe(Math.max(1, Math.round(sourceSets * 0.5)));
    expect(result.weight).toBe(81);
    expect(result.rir).toBe(3);
    expect(adjusted.cycleMetrics.kpsh).toBeLessThan(plan.cycleMetrics.kpsh);
  });

  it('adds exercises to the requested day and preserves the source plan', () => {
    const plan = basePlan();
    const result = applyPLEffectiveOverlay(plan, {
      additions: {
        '1_0': [{ uid: 'a1', name: 'Добавленное', group: 'chest', sets: 2, reps: 10, weight: 40 }],
      },
    });
    expect(result.weeks[0].days[0].exercises.some((e: LMSPlanExercise) => e.name === 'Добавленное')).toBe(true);
    expect(plan.weeks[0].days[0].exercises.some((e) => e.name === 'Добавленное')).toBe(false);
  });

  it('returns the original object when no overlay is active', () => {
    const plan = basePlan();
    expect(applyPLEffectiveOverlay(plan)).toBe(plan);
  });

  // ── Аудит 2026-11, P1: ручной вес и pct ──
  it('ручной вес НЕ перемножается на autoReg.topSetPctMultiplier (правка = последнее слово)', () => {
    const plan = basePlan();
    const out = applyPLEffectiveOverlay(plan, {
      edits: { '1_0_0_0': { weight: 100 } },
      autoReg: { topSetPctMultiplier: 0.9, volumeMultiplier: 1, rirShift: 0 },
    }).weeks[0].days[0].exercises[0].workSets[0];
    expect(out.weight).toBe(100);
  });

  it('ручной вес без autoReg тоже ровно тот, что ввели', () => {
    const plan = basePlan();
    const out = applyPLEffectiveOverlay(plan, { edits: { '1_0_0_0': { weight: 101.5 } } }).weeks[0].days[0].exercises[0]
      .workSets[0];
    expect(out.weight).toBe(101.5);
  });

  it('правка pct при ws.pct = 0 не даёт NaN/Infinity (вес считается от ПМ упражнения)', () => {
    const plan = JSON.parse(JSON.stringify(basePlan()));
    const ex = plan.weeks[0].days[0].exercises[0];
    ex.workSets[0].pct = 0;
    const out = applyPLEffectiveOverlay(plan, { edits: { '1_0_0_0': { pct: 0.8 } } }).weeks[0].days[0].exercises[0]
      .workSets[0];
    expect(Number.isFinite(out.weight)).toBe(true);
    expect(out.weight).toBeGreaterThan(0);
    expect(out.pct).toBe(0.8);
  });

  it('plVolumeLandmarks пересчитывается после оверлея (не остаётся от исходного плана)', () => {
    const plan = basePlan();
    // Резко урезаем объём всех подходов → статус по мышцам должен измениться.
    const edits: Record<string, { sets: number }> = {};
    plan.weeks.forEach((wk, wi) =>
      wk.days.forEach((day, di) => {
        let flat = 0;
        day.exercises.forEach((ex, ei) => {
          ex.workSets.forEach(() => {
            edits[`${wk.week}_${di}_${ei}_${flat}`] = { sets: 1 };
            flat += 1;
          });
        });
        void wi;
      }),
    );
    const out = applyPLEffectiveOverlay(plan, { edits });
    expect(out.plVolumeLandmarks).toBeTruthy();
    expect(out.plVolumeLandmarks!.some((l) => l.status === 'under')).toBe(true);
  });
  it('P2-9: правка веса/подходов меняет итоги цикла — плитки берут тот же источник', () => {
    const plan = basePlan();
    const before = plan.cycleMetrics;
    const edited = applyPLEffectiveOverlay(plan, { edits: { '1_0_0_0': { weight: 200, sets: 6 } } });
    const after = edited.cycleMetrics;
    expect(after.tonnage).toBeGreaterThan(before.tonnage);
    expect(after.kpsh).toBeGreaterThan(before.kpsh);
    expect(plan.cycleMetrics).toEqual(before); // исходный план не мутирован
  });

  // ── Аудит 2026-11, P2-10: одна функция числа подходов на таблицу и оверлей ──
  it('P2-10: делод режет подходы РОВНО один раз (как билдер: min(vol, 0.6))', () => {
    const plan = basePlan();
    const baseSets = plan.weeks[0].days[0].exercises[0].workSets[0].sets;
    const halfDeload = applyPLEffectiveOverlay(plan, {
      autoReg: { topSetPctMultiplier: 1, volumeMultiplier: 0.5, rirShift: 0, deload: true },
    }).weeks[0].days[0].exercises[0].workSets[0].sets;
    // Старый код: round(base×0.5) ещё раз ×0.6 → ×0.3 (двойное урезание).
    expect(halfDeload).toBe(Math.max(1, Math.round(baseSets * 0.5)));
    expect(halfDeload).toBe(scaleSetCount(baseSets, { autoVolumeMultiplier: 0.5, deload: true }));
  });

  it('P2-10: эффективный план и билдер дают одинаковое число подходов при делоде', () => {
    const ar = { topSetPctMultiplier: 1, volumeMultiplier: 0.8, rirShift: 1, deload: true };
    const built = buildLMSPlan({
      template: CYCLE_01,
      pmMap: { Присед: 150, 'Жим лежа': 100, 'Становая тяга': 180 },
      fallbackPm: 80,
      weeksOverride: 1,
      faithful: true,
      autoReg: ar,
    });
    const overlaid = applyPLEffectiveOverlay(basePlan(), { autoReg: ar });
    const a = built.weeks[0].days[0].exercises[0].workSets[0];
    const b = overlaid.weeks[0].days[0].exercises[0].workSets[0];
    expect(b.sets).toBe(a.sets);
    expect(b.rir).toBe(a.rir);
  });

  it('scaleSetCount: мост объёма × авторегуляция, делод — cap 0.6, минимум 1 подход', () => {
    expect(scaleSetCount(10, { volumeMultiplier: 0.8, autoVolumeMultiplier: 0.5 })).toBe(4);
    expect(scaleSetCount(10, { volumeMultiplier: 1, deload: true })).toBe(6);
    expect(scaleSetCount(10, { volumeMultiplier: 0.3, deload: true })).toBe(3);
    expect(scaleSetCount(1, { volumeMultiplier: 0.2 })).toBe(1);
    expect(scaleSetCount(Number.NaN, {})).toBe(1);
  });
});
