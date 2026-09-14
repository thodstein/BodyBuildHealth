/**
 * female-tz-labs.test.ts — §16.3: женские лабораторные пороги в движке риска (ТЗ-модель).
 *
 * Гарантии:
 *  - мужской путь байт-в-байт (sex отсутствует/male → те же числа);
 *  - female: HCT 48/52, АЛТ/АСТ/ГГТ по женскому ULN, креатинин, TT/FT/SHBG/E2 — женские шкалы.
 */
import { describe, expect, it } from 'vitest';
import { calculateTzSpecRisk, clinicalFloorsForLabs } from '../risk-engine-tz-spec';
import type { TzSpecInput } from '../risk-engine-tz-spec';
import { buildTzInput, buildTzInputCore } from '../support-plan/engine-helpers';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';

const labs = (): Record<string, number> => ({
  HCT: 53, ALT: 70, TT: 7, LDL: 3.0, eGFR: 90, LH: 5, FSH: 5, PRL: 10, GLU: 5, HOMA: 1,
});

const baseInput = (extra: Partial<TzSpecInput> = {}): TzSpecInput => ({
  drugClass: 'aas', drugName: 'test_enan', dose: 500, duration: 12, form: 'inject',
  combinations: 1, labCoverage: 0.8, labValues: labs(), supportSubstances: [], ...extra,
});

const shape = (r: ReturnType<typeof calculateTzSpecRisk>) => JSON.stringify({
  organs: r.organs.map((o) => `${o.id}:${o.rawPercent}:${o.afterPercent}:${o.category}`),
  overallRaw: r.overallRaw,
  overallAfter: r.overallAfter,
});

describe('female-tz-labs: мужской путь не изменён (lock)', () => {
  it('clinicalFloorsForLabs: male === undefined', () => {
    for (const l of [{ HCT: 55 }, { ALT: 250 }, { TT: 10 }, labs()]) {
      expect(JSON.stringify(clinicalFloorsForLabs(l, 'male'))).toBe(JSON.stringify(clinicalFloorsForLabs(l)));
    }
  });
  it('calculateTzSpecRisk: sex=male и без sex — идентичная форма результата', () => {
    const a = calculateTzSpecRisk(baseInput());
    const b = calculateTzSpecRisk(baseInput({ sex: 'male' }));
    expect(shape(b)).toBe(shape(a));
  });
});

describe('female-tz-labs: женские floors', () => {
  it('HCT 53: female → floor 50 (женский порог), male → 25', () => {
    const f = clinicalFloorsForLabs({ HCT: 53 }, 'female');
    const m = clinicalFloorsForLabs({ HCT: 53 }, 'male');
    const fHigh = f.find((x) => x.organId === 'hematologic' && x.level === 50);
    expect(fHigh?.label).toContain('женский');
    expect(m.find((x) => x.organId === 'hematologic' && x.level === 50)).toBeUndefined();
    expect(m.find((x) => x.organId === 'hematologic' && x.level === 25)).toBeTruthy();
  });
  it('HCT 50: female → floor есть; male → нет (мужской порог 51)', () => {
    expect(clinicalFloorsForLabs({ HCT: 50 }, 'female').some((x) => x.organId === 'hematologic')).toBe(true);
    expect(clinicalFloorsForLabs({ HCT: 50 }, 'male').some((x) => x.organId === 'hematologic')).toBe(false);
  });
  it('ALT 70: female → 25 (2× женской ULN 31); male → нет (порог >80)', () => {
    expect(clinicalFloorsForLabs({ ALT: 70 }, 'female').some((x) => x.organId === 'hepatic' && x.level === 25)).toBe(true);
    expect(clinicalFloorsForLabs({ ALT: 70 }, 'male').some((x) => x.organId === 'hepatic')).toBe(false);
  });
  it('ALT 100: female → 50 (3×ULN); male → только 25', () => {
    expect(clinicalFloorsForLabs({ ALT: 100 }, 'female').some((x) => x.organId === 'hepatic' && x.level === 50)).toBe(true);
    expect(clinicalFloorsForLabs({ ALT: 100 }, 'male').some((x) => x.organId === 'hepatic' && x.level === 50)).toBe(false);
  });
  it('TT 7 нмоль/л: female → reproductive 50 (вирилизация); male → нет', () => {
    const f = clinicalFloorsForLabs({ TT: 7 }, 'female');
    expect(f.some((x) => x.organId === 'reproductive' && x.level === 50 && x.label.includes('вирилизация'))).toBe(true);
    expect(clinicalFloorsForLabs({ TT: 7 }, 'male').some((x) => x.organId === 'reproductive')).toBe(false);
  });
  it('нейтральные floors (LDL/K/eGFR) полом не меняются', () => {
    const l = { LDL: 5.0, K: 2.5, eGFR: 50 };
    expect(JSON.stringify(clinicalFloorsForLabs(l, 'female'))).toBe(JSON.stringify(clinicalFloorsForLabs(l, 'male')));
  });
});

describe('female-tz-labs: интеграция calculateTzSpecRisk', () => {
  it('HCT 53: у female гематологический орган с женским floor; у male — без', () => {
    const f = calculateTzSpecRisk(baseInput({ sex: 'female' }));
    const hemF = f.organs.find((o) => o.id === 'hematologic')!;
    expect(hemF.floors.some((fl) => fl.label.includes('женский'))).toBe(true);
    const m = calculateTzSpecRisk(baseInput());
    const hemM = m.organs.find((o) => o.id === 'hematologic')!;
    expect(hemM.floors.some((fl) => fl.label.includes('женский'))).toBe(false);
  });
  it('TT 7: у female репродуктивный floor с «вирилизацией»; overallAfter female ≥ male', () => {
    const f = calculateTzSpecRisk(baseInput({ sex: 'female' }));
    const rep = f.organs.find((o) => o.id === 'reproductive')!;
    expect(rep.floors.some((fl) => fl.label.includes('вирилизация'))).toBe(true);
    const m = calculateTzSpecRisk(baseInput());
    expect(f.overallAfter).toBeGreaterThanOrEqual(m.overallAfter);
  });
  it('женские шкалы m_i: TT 7 у female даёт не меньшее репро-напряжение, чем male-шкала', () => {
    const f = calculateTzSpecRisk(baseInput({ sex: 'female' }));
    const repF = f.organs.find((o) => o.id === 'reproductive')!;
    const m = calculateTzSpecRisk(baseInput());
    const repM = m.organs.find((o) => o.id === 'reproductive')!;
    expect(repF.rawPercent).toBeGreaterThanOrEqual(repM.rawPercent);
  });
});

describe('female-tz-labs: проброс входа', () => {
  it('buildTzInputCore: sex=female проходит; без sex — женских полей нет', () => {
    const drugs = [{ drugClass: 'aas' as const, drugName: 'test_enan', dose: 500, form: 'inject' as const }];
    const core = buildTzInputCore({ drugs, duration: 12, labs: {}, sex: 'female' }, []);
    expect(core.sex).toBe('female');
    const coreM = buildTzInputCore({ drugs, duration: 12, labs: {} }, []);
    expect((coreM as any).sex).toBeUndefined();
  });
  it('buildTzInput: профиль female → sex=female; male → поля нет', () => {
    const femState = {
      ...DEFAULT_STATE,
      profile: { ...DEFAULT_STATE.profile, sex: 'female' },
      pharma: { ...DEFAULT_STATE.pharma, phase: 'course', aas: [{ id: 'deca', doseMgWeek: 50, weeks: 12, form: 'inject' }] },
    } as any;
    const inp = buildTzInput(femState, []);
    expect(inp?.sex).toBe('female');
    const maleState = { ...femState, profile: { ...femState.profile, sex: 'male' } };
    const inpM = buildTzInput(maleState, []);
    expect((inpM as any)?.sex).toBeUndefined();
  });
});
