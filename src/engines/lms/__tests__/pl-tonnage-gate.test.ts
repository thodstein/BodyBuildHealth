/**
 * pl-tonnage-gate.test.ts — гейт Шейко: флагается РОСТ тоннажа, снижение
 * (делод/тапер) — справочная заметка без флага (аудит P1-8: раньше abs()
 * помечал «Скачок −50%» как danger).
 */
import { describe, expect, it } from 'vitest';
import { checkTonnageGate } from '../pl-tonnage-gate.engine';
import type { LMSBuildOutput, LMSPlanWeek } from '../lms-builder.engine';

const wk = (week: number, sets: number, weight = 100, reps = 5): LMSPlanWeek => ({
  week,
  pmRow: { 'Присед': 200 },
  days: [{ exercises: [{ name: 'Присед', group: 'legs', coef: 1, mnosz: 1, pm: 200, rir: 2, workSets: [{ weight, reps, pct: 0.8, sets, rir: 2 }] }], metrics: {} }] as never,
});

const plan = (weeks: LMSPlanWeek[]): LMSBuildOutput => ({
  template: { meta: { title: 't', weeks: weeks.length } } as never,
  progressionRationale: '',
  weeks,
  cycleMetrics: {} as never,
});

describe('checkTonnageGate — рост vs снижение', () => {
  it('рост +20% → danger, +8% → warn, снижение −50% → ok с честной заметкой', () => {
    const res = checkTonnageGate(plan([wk(1, 4), wk(2, 5), wk(3, 2), wk(4, 2)]));
    const w2 = res.find(r => r.week === 2)!;
    expect(w2.changePct).toBeCloseTo(25, 1);
    expect(w2.flag).toBe('danger');
    expect(w2.note).toContain('Скачок +');
    const w3 = res.find(r => r.week === 3)!;
    expect(w3.changePct).toBe(-60);
    expect(w3.flag).toBe('ok');
    expect(w3.note).toContain('Снижение');
    expect(w3.note).toContain('не флаг');
  });

  it('умеренный рост +8% → warn (Sheiko-порог 7%)', () => {
    const res = checkTonnageGate(plan([wk(1, 10), wk(2, 10.8)]));
    const w2 = res[0];
    expect(w2.changePct).toBeCloseTo(8, 1);
    expect(w2.flag).toBe('warn');
    expect(w2.note).toContain('Рост +');
  });

  it('ровно как в плане (+0%) → ok без ложных срабатываний', () => {
    const res = checkTonnageGate(plan([wk(1, 4), wk(2, 4), wk(3, 4)]));
    expect(res.every(r => r.flag === 'ok' && r.note === 'ок')).toBe(true);
  });

  it('нулевая база (prev=0) не делит на ноль и не флагает', () => {
    const res = checkTonnageGate(plan([wk(1, 0), wk(2, 4)]));
    expect(res[0].flag).toBe('ok');
    expect(Number.isFinite(res[0].changePct)).toBe(true);
  });
});
