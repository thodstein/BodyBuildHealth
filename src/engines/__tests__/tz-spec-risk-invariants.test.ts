import { describe, expect, it } from 'vitest';
import { calculateTzSpecRisk } from '../risk-engine-tz-spec';
import { buildTzInput, buildTzInputCore } from '../support-plan/engine-helpers';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';

function input(overrides: Partial<Parameters<typeof calculateTzSpecRisk>[0]> = {}) {
  return {
    drugClass: 'aas' as const,
    drugName: 'test_enan',
    dose: 500,
    duration: 12,
    form: 'inject' as const,
    combinations: 1,
    labCoverage: 0.3,
    labValues: {},
    drugs: [{ drugClass: 'aas' as const, drugName: 'test_enan', dose: 500, form: 'inject' as const }],
    supportSubstances: [],
    ...overrides,
  };
}

describe('TZ mechanism risk invariants', () => {
  it('keeps raw and after percentages in the display range', () => {
    const result = calculateTzSpecRisk(input({ combinations: 3 }));

    for (const organ of result.organs) {
      expect(organ.rawPercent).toBeGreaterThanOrEqual(0);
      expect(organ.rawPercent).toBeLessThanOrEqual(100);
      expect(organ.afterPercent).toBeGreaterThanOrEqual(0);
      expect(organ.afterPercent).toBeLessThanOrEqual(100);
      expect(organ.afterPercent).toBeLessThanOrEqual(organ.rawPercent);
      // Механизмы — та же шкала 0-100, не «баллы» > 100
      for (const mech of organ.mechanisms) {
        expect(mech.rawPercent).toBeGreaterThanOrEqual(0);
        expect(mech.rawPercent).toBeLessThanOrEqual(100);
        expect(mech.afterPercent).toBeGreaterThanOrEqual(0);
        expect(mech.afterPercent).toBeLessThanOrEqual(100);
        expect(mech.afterPercent).toBeLessThanOrEqual(mech.rawPercent);
      }
      // Механизмы комбинируются нелинейно (union): система ≤ суммы долей
      const sumMech = organ.mechanisms.reduce((s, m) => s + m.rawPercent, 0);
      expect(organ.rawPercent).toBeLessThanOrEqual(sumMech + 0.01);
      // union: система не меньше максимума механизма
      const maxMech = organ.mechanisms.reduce((s, m) => Math.max(s, m.rawPercent), 0);
      expect(organ.rawPercent).toBeGreaterThanOrEqual(maxMech - 0.01);
    }
    expect(result.overallRaw).toBeGreaterThanOrEqual(0);
    expect(result.overallRaw).toBeLessThanOrEqual(100);
    expect(result.overallAfter).toBeGreaterThanOrEqual(0);
    expect(result.overallAfter).toBeLessThanOrEqual(100);
    expect(result.overallAfter).toBeLessThanOrEqual(result.overallRaw);
  });

  it('reduces relevant risk when the foundation support is present', () => {
    const withoutSupport = calculateTzSpecRisk(input());
    const withSupport = calculateTzSpecRisk(input({
      supportSubstances: ['hydration', 'cardio_aerobic', 'electrolyte_balance'],
    }));

    const cardioBefore = withoutSupport.organs.find(o => o.id === 'cardio')!;
    const cardioAfter = withSupport.organs.find(o => o.id === 'cardio')!;
    const hemaBefore = withoutSupport.organs.find(o => o.id === 'hematologic')!;
    const hemaAfter = withSupport.organs.find(o => o.id === 'hematologic')!;

    expect(cardioAfter.afterPercent).toBeLessThanOrEqual(cardioBefore.afterPercent);
    expect(hemaAfter.afterPercent).toBeLessThanOrEqual(hemaBefore.afterPercent);
    expect(withSupport.overallAfter).toBeLessThanOrEqual(withoutSupport.overallAfter);
  });

  it('applies the existing phase dose multiplier without changing the risk scale', () => {
    const course = calculateTzSpecRisk(input({ phaseDoseMultiplier: 1 }));
    const bridge = calculateTzSpecRisk(input({ phaseDoseMultiplier: 0.6 }));

    expect(bridge.overallRaw).toBeLessThanOrEqual(course.overallRaw);
    expect(bridge.overallAfter).toBeLessThanOrEqual(course.overallAfter);
    expect(bridge.organs.every(o => o.rawPercent <= 100 && o.afterPercent <= 100)).toBe(true);
  });

  it('синергия базы курса: полное трио снижает cardio/hemato сильнее пары', () => {
    const pair = calculateTzSpecRisk(input({ supportSubstances: ['hydration', 'cardio_aerobic'] }));
    const trio = calculateTzSpecRisk(input({ supportSubstances: ['hydration', 'cardio_aerobic', 'electrolyte_balance'] }));

    const cardioPair = pair.organs.find(o => o.id === 'cardio')!;
    const cardioTrio = trio.organs.find(o => o.id === 'cardio')!;
    const hemaPair = pair.organs.find(o => o.id === 'hematologic')!;
    const hemaTrio = trio.organs.find(o => o.id === 'hematologic')!;

    expect(cardioTrio.afterPercent).toBeLessThanOrEqual(cardioPair.afterPercent);
    expect(hemaTrio.afterPercent).toBeLessThanOrEqual(hemaPair.afterPercent);
  });

  it('синергия фибринолитиков: натто+серра+бромелайн снижают гемато-риск сильнее одного', () => {
    const single = calculateTzSpecRisk(input({ supportSubstances: ['nattokinase'] }));
    const trio = calculateTzSpecRisk(input({ supportSubstances: ['nattokinase', 'serrapeptase', 'bromelain'] }));

    const hemaSingle = single.organs.find(o => o.id === 'hematologic')!;
    const hemaTrio = trio.organs.find(o => o.id === 'hematologic')!;
    expect(hemaTrio.afterPercent).toBeLessThanOrEqual(hemaSingle.afterPercent);
  });

  it('калькулятор и вкладка «Риски»: единый builder — идентичные цифры до механизма', () => {
    const state: any = {
      ...DEFAULT_STATE,
      pharma: {
        ...DEFAULT_STATE.pharma,
        phase: 'course',
        aas: [
          { id: 'test_enan', doseMgWeek: 500, weeks: 12, form: 'inject' },
          { id: 'tren_enan', doseMgWeek: 300, weeks: 10, form: 'inject' },
        ],
      },
      labs: { ...DEFAULT_STATE.labs, fullPanel: { date: '2026-01-01', panelHematology: { HCT: '52' }, panelLipid: { LDL: '4.2', HDL: '0.8', Triglycerides: '2.1' } } as any },
    };
    const subs = ['hydration', 'cardio_aerobic', 'electrolyte_balance', 'nac', 'tudca', 'omega3', 'nattokinase', 'serrapeptase', 'bromelain'];

    const viaState = buildTzInput(state, subs);
    expect(viaState).not.toBeNull();
    const viaCore = buildTzInputCore({
      drugs: viaState!.drugs || [],
      duration: viaState!.duration,
      labs: viaState!.labValues,
      phaseKey: 'course',
      courseWeek: viaState!.courseWeek,
      genetics: viaState!.genetics,
      nutrition: viaState!.nutrition,
      training: viaState!.training,
    }, subs);

    const a = calculateTzSpecRisk(viaState!);
    const b = calculateTzSpecRisk(viaCore);
    expect(b.overallRaw).toBe(a.overallRaw);
    expect(b.overallAfter).toBe(a.overallAfter);
    expect(b.organs.map(o => o.rawPercent)).toEqual(a.organs.map(o => o.rawPercent));
    expect(b.organs.map(o => o.afterPercent)).toEqual(a.organs.map(o => o.afterPercent));
    expect(b.organs.flatMap(o => o.mechanisms.map(m => m.rawPercent))).toEqual(a.organs.flatMap(o => o.mechanisms.map(m => m.rawPercent)));
  });
});
