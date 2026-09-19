import { describe, it, expect } from 'vitest';
import { injectBBWeakPoints, correctiveWeightHint } from '../bb-diagnostics-injection.engine';
import { correctiveById, correctiveDose, correctiveLoadFactor, BB_CORRECTIVES } from '../bb-corrective.engine';
import type { BBPlan } from '../bb-builder.engine';

/**
 * K3 (BB-CORRECTIVE-HUB-PRO-PLAN): «показано = вставится» для дозы коррекции.
 * Вес — от workMax профиля (точный id упражнения → мышца), rest/repsMax — из записи,
 * RIR3-записи реагируют на сдвиг (кламп 0–4), bodyweight — без кг.
 */
function mockPlan(): BBPlan {
  return {
    pattern: { id: 'test', name: 'Test', sessionsPerRotation: 4 } as any,
    weeks: [
      { week: 1, sessions: [
        { day: 1, weekOffset: 0, character: 'heavy' as any, exercises: [{ muscle: 'shoulders', name: 'Жим гантелей', sets: 3, role: 'primary' as const, exerciseName: 'db_press', workSets: [] } as any] } as any,
      ] } as any,
    ],
    rationale: [],
    level: 'intermediate',
  } as any;
}
const last = (res: any) => {
  const exs = (res.plan.weeks[0].sessions as any[]).flatMap((s) => s.exercises || []).filter((e: any) => String(e.comment || '').includes('ББ-диагностика'));
  return exs[exs.length - 1];
};

describe('bb-corrective K3: реальность дозы инъекции', () => {
  it('вес от workMax мышцы (loadFactor × база, шаг 2.5)', () => {
    const res = injectBBWeakPoints(mockPlan(), ['delt_mid'], { budget: 500, workMax: { shoulders: 100 } });
    const ex = last(res);
    expect(ex.workSets[0].weight).toBe(65); // 0.65 × 100
    expect(String(ex.comment)).toMatch(/@65% ≈65кг/);
  });
  it('точный максимум упражнения приоритетнее мышцы (workMaxByExercise)', () => {
    const h = correctiveWeightHint('lateral_raise', { lateral_raise: 120, shoulders: 100 }, 'shoulders', { loadFactor: 0.6 });
    expect(h.kg).toBe(72.5); // 0.6 × 120 = 72 → шаг плит 2.5
    expect(h.pct).toBe(60);
    const res = injectBBWeakPoints(mockPlan(), ['delt_mid'], { budget: 500, workMax: { lateral_raise: 120, shoulders: 100 }, corrective: { delt_mid: { loadFactor: 0.6, sets: 2, reps: 12, rir: 1 } } });
    expect(last(res).workSets[0].weight).toBe(72.5);
  });
  it('restSec записи доезжает (45с, а не всегда 90)', () => {
    const res = injectBBWeakPoints(mockPlan(), ['delt_mid'], { budget: 500, corrective: { delt_mid: { restSec: 45, tempo: '2-1-2-0' } } });
    const ex = last(res);
    expect(ex.workSets[0].restSeconds).toBe(45);
    expect(ex.restSeconds).toBe(45);
    expect(String(ex.comment)).toMatch(/отдых 45с/);
  });
  it('repsMax-окно доезжает в repsRange (не reps+2)', () => {
    const res = injectBBWeakPoints(mockPlan(), ['delt_mid'], { budget: 500, corrective: { delt_mid: { reps: 5, repsMax: 8 } } });
    expect(last(res).repsRange).toEqual([5, 8]);
  });
  it('RIR3-записи реагируют на сдвиг готовности (кламп 0–4)', () => {
    const base = injectBBWeakPoints(mockPlan(), ['delt_mid'], { budget: 500, corrective: { delt_mid: { rir: 3 } } });
    expect(last(base).rir).toBe(3);
    const shifted = injectBBWeakPoints(mockPlan(), ['delt_mid'], { budget: 500, corrective: { delt_mid: { rir: 3 } }, rirShift: 1 });
    expect(last(shifted).rir).toBe(4);
    const capped = injectBBWeakPoints(mockPlan(), ['delt_mid'], { budget: 500, corrective: { delt_mid: { rir: 4 } }, rirShift: 2 });
    expect(last(capped).rir).toBe(4);
  });
  it('bodyweight-упражнение — без кг + пометка', () => {
    const h = correctiveWeightHint('wall_slide', { shoulders: 100 }, 'shoulders', {});
    expect(h.bodyweight).toBe(true);
    expect(h.kg).toBeNull();
    const res = injectBBWeakPoints(mockPlan(), ['delt_rear'], { budget: 500, workMax: { shoulders: 100 }, corrective: { delt_rear: { bodyweight: true } } });
    const ex = last(res);
    expect(ex.workSets[0].weight).toBe(0);
    expect(String(ex.comment)).toMatch(/без кг/);
  });
  it('паритет: карточка (correctiveDose + hint) == факту workSets (вес/reps/RIR/tempo/отдых)', () => {
    const corr = correctiveById('dm-lateral-pause')!;
    const dose = correctiveDose(corr, null);
    const factor = correctiveLoadFactor(corr.phase);
    const hint = correctiveWeightHint(corr.exerciseId, { shoulders: 100 }, 'shoulders', { loadFactor: factor });
    const res = injectBBWeakPoints(mockPlan(), ['delt_mid'], {
      budget: 500,
      workMax: { shoulders: 100 },
      preferredIds: { delt_mid: corr.exerciseId },
      corrective: { delt_mid: { sets: dose.sets, reps: dose.repsMin, repsMax: dose.repsMax, rir: dose.rir, tempo: dose.tempo, restSec: corr.protocol.restSec, loadFactor: factor } },
    });
    const ex = last(res);
    const ws = ex.workSets[0];
    expect(ex.sets).toBe(dose.sets);
    expect(ws.reps).toBe(dose.repsMin);
    expect(ex.repsRange).toEqual([dose.repsMin, dose.repsMax]);
    expect(ws.rir).toBe(dose.rir);
    expect(ws.tempo).toBe(dose.tempo);
    expect(ws.restSeconds).toBe(corr.protocol.restSec);
    expect(ws.weight).toBe(hint.kg);
    expect(hint.kg).toBe(60); // 0.6 × 100 (техника)
  });
  it('без workMax — без выдуманных кг + честная пометка', () => {
    const res = injectBBWeakPoints(mockPlan(), ['delt_mid'], { budget: 500 });
    const ex = last(res);
    expect(ex.workSets[0].weight).toBe(0);
    expect(String(ex.comment)).toMatch(/вес по факту/);
  });
  it('все записи библиотеки считают вес без исключений (hint не бросает)', () => {
    for (const c of BB_CORRECTIVES) {
      const h = correctiveWeightHint(c.exerciseId, { shoulders: 100, glutes: 120, quads: 150, hamstrings: 110 }, null, { loadFactor: correctiveLoadFactor(c.phase) });
      expect(typeof h.pct).toBe('number');
      expect(h.kg === null || h.kg > 0).toBe(true);
    }
  });
});
