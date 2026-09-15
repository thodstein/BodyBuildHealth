/**
 * lab-norms-female.test.ts — Л8/Л9 (фаза 2 женского слоя): единый getLabNorm(code, sex).
 * Мужской путь без sex — байт-в-байт UCUM_MAP; женские границы — из LAB_REFERENCES_FEMALE.
 */
import { describe, expect, it, vi } from 'vitest';
import { UCUM_MAP } from '../../core/constants';
import { normalizedRatio } from '../../core/labs-mapping';
import { LAB_REFERENCES_FEMALE } from '../risk-engine-v7-matrix';
import {
  getLabNorm,
  hasFemaleLabBound,
  FEMALE_LAB_BOUNDS,
  FEMALE_LABS_NOTE,
  FEMALE_LABS_TAB_NOTE,
} from '../lab-norms.engine';
import { getDynamicRef } from '../role-view.engine';

describe('getLabNorm — мужской путь байт-в-байт', () => {
  it('без sex / male — те же числа, что UCUM_MAP, female=false', () => {
    for (const code of ['HCT', 'HGB', 'ALT', 'CREATININE', 'FERRITIN', 'GLU', 'TSH']) {
      const a = getLabNorm(code)!;
      const b = getLabNorm(code, 'male')!;
      const u = UCUM_MAP[code] as { lln: number; uln: number; prefUnit: string };
      expect(a, code).toEqual({ lln: u.lln, uln: u.uln, unit: u.prefUnit, female: false });
      expect(b, code).toEqual(a);
    }
  });

  it('неизвестный код → null; регистронезависимость', () => {
    expect(getLabNorm('NOPE')).toBeNull();
    expect(getLabNorm('hct', 'female')!.uln).toBe(48);
  });
});

describe('getLabNorm — женские границы (Л8)', () => {
  it('инструкция плана: HCT 36–48, Hb 120–150, RBC 4.0–5.2, АЛТ/АСТ/ГГТ 31, креатинин 97, ферритин 200', () => {
    expect(getLabNorm('HCT', 'female')).toMatchObject({ lln: 36, uln: 48, female: true });
    expect(getLabNorm('HGB', 'female')).toMatchObject({ lln: 120, uln: 150, female: true });
    expect(getLabNorm('RBC', 'female')).toMatchObject({ lln: 4.0, uln: 5.2, female: true });
    expect(getLabNorm('ALT', 'female')).toMatchObject({ lln: 7, uln: 31, female: true });
    expect(getLabNorm('AST', 'female')).toMatchObject({ lln: 8, uln: 31, female: true });
    expect(getLabNorm('GGT', 'female')).toMatchObject({ lln: 7, uln: 31, female: true });
    expect(getLabNorm('CREATININE', 'female')).toMatchObject({ lln: 44, uln: 97, female: true });
    expect(getLabNorm('FERRITIN', 'female')).toMatchObject({ lln: 15, uln: 200, female: true });
  });

  it('маркеры без женских отличий — базовая норма и female=false', () => {
    const glu = getLabNorm('GLU', 'female')!;
    expect(glu.female).toBe(false);
    expect(glu.uln).toBe((UCUM_MAP as any).GLU.uln);
  });

  it('FEMALE_LAB_BOUNDS — паритет с LAB_REFERENCES_FEMALE (единый источник)', () => {
    expect(FEMALE_LAB_BOUNDS.HCT.uln).toBe(Math.round(LAB_REFERENCES_FEMALE.Hct.uln! * 100));
    expect(FEMALE_LAB_BOUNDS.HCT.lln).toBe(Math.round(LAB_REFERENCES_FEMALE.Hct.lln! * 100));
    expect(FEMALE_LAB_BOUNDS.HGB.uln).toBe(LAB_REFERENCES_FEMALE.Hb.uln);
    expect(FEMALE_LAB_BOUNDS.RBC.uln).toBe(LAB_REFERENCES_FEMALE.RBC.uln);
    expect(FEMALE_LAB_BOUNDS.ALT.uln).toBe(LAB_REFERENCES_FEMALE.ALT.uln);
    expect(FEMALE_LAB_BOUNDS.GGT.uln).toBe(LAB_REFERENCES_FEMALE.GGT.uln);
    expect(FEMALE_LAB_BOUNDS.CREATININE.uln).toBe(LAB_REFERENCES_FEMALE.Creatinine.uln);
    expect(FEMALE_LAB_BOUNDS.FERRITIN.uln).toBe(LAB_REFERENCES_FEMALE.Ferritin.uln);
  });

  it('hasFemaleLabBound — только для женских маркеров; базовые таблицы не мутируются', () => {
    expect(hasFemaleLabBound('HCT')).toBe(true);
    expect(hasFemaleLabBound('PSA')).toBe(false);
    expect((UCUM_MAP as any).HCT.uln).toBe(52);
    expect(LAB_REFERENCES_FEMALE.ALT.uln).toBe(31);
  });

  it('легенда/пометка содержат ♀ и кросс-ссылку на «Женщины и ААС»', () => {
    expect(FEMALE_LABS_NOTE).toContain('♀');
    expect(FEMALE_LABS_NOTE).toContain('36–48');
    expect(FEMALE_LABS_TAB_NOTE).toContain('♀');
    expect(FEMALE_LABS_TAB_NOTE).toContain('Женщины и ААС');
  });
});

describe('Л8: role-view getDynamicRef — HCT по женским границам', () => {
  it('female HCT — 36–48 (вместо симметричного ×0.85); male — 36–52 1-в-1', () => {
    expect(getDynamicRef('HCT', 30, 'female', 'baseline')).toEqual({ uln: 48, lln: 36 });
    expect(getDynamicRef('HCT', 30, 'male', 'baseline')).toEqual({ uln: 52, lln: 36 });
    // курсовая фаза: женские границы × phaseFactor(1.1), а не ×0.85 у обеих
    expect(getDynamicRef('HCT', 30, 'female', 'course' as never)).toEqual({ uln: 53, lln: 40 });
    expect(getDynamicRef('TT', 30, 'female', 'baseline')).toEqual(getDynamicRef('TT', 30, 'male', 'baseline'));
  });
});

describe('Л8: normalizedRatio (OCR-превью %) — HCT female 36–48', () => {
  it('female границы = getLabNorm; male/без sex — байт-в-байт прежние', () => {
    // female: середина 36–48 = 42 → ровно 0.5; выше женского ULN 48 → > 1
    expect(normalizedRatio('HCT', 42, '%', 30, 'female')).toBeCloseTo(0.5, 5);
    expect(normalizedRatio('HCT', 49, '%', 30, 'female')!).toBeGreaterThan(1);
    // male: середина 36–52 = 44 → 42 = 0.375; без sex — та же статика
    const male = normalizedRatio('HCT', 42, '%', 30, 'male')!;
    expect(male).toBeCloseTo(0.375, 5);
    expect(normalizedRatio('HCT', 42, '%')).toBe(male);
    expect(getLabNorm('HCT', 'female')).toMatchObject({ lln: 36, uln: 48 });
  });

  it('остальные женские маркеры тоже по женским границам (АЛТ/ГГТ/Hb/креатинин/ферритин/…), мужской путь цел', () => {
    // АЛТ 35: женский ULN 31 → ratio > 1; мужской ULN 40 → 0.5..1
    const altFem = normalizedRatio('ALT', 35, 'U/L', 30, 'female')!;
    const altMale = normalizedRatio('ALT', 35, 'U/L', 30, 'male')!;
    expect(altFem).toBeGreaterThan(1);
    expect(altMale).toBeLessThan(1);
    expect(normalizedRatio('ALT', 35, 'U/L')).toBe(altMale);
    // ГГТ 40: женский ULN 31 → >1, мужской 55 → <1
    expect(normalizedRatio('GGT', 40, 'U/L', 30, 'female')!).toBeGreaterThan(1);
    expect(normalizedRatio('GGT', 40, 'U/L', 30, 'male')!).toBeLessThan(1);
    // Hb: UCUM хранит в г/дл с coeff 10 → 14.5 = 145 г/л; женский коридор 120–150 → в норме
    const hbFem = normalizedRatio('HGB', 14.5, 'g/dL', 30, 'female')!;
    const hbMale = normalizedRatio('HGB', 14.5, 'g/dL', 30, 'male')!;
    expect(hbFem).toBeGreaterThan(hbMale);
    expect(hbFem).toBeLessThan(1);
    // креатинин 100 мкмоль/л: женский ULN 97 → >1, мужской 110 → <1
    expect(normalizedRatio('CREATININE', 100, 'umol/L', 30, 'female')!).toBeGreaterThan(1);
    expect(normalizedRatio('CREATININE', 100, 'umol/L', 30, 'male')!).toBeLessThan(1);
    // ферритин 250 мкг/л: женский ULN 200 → >1, мужской 300 → <1
    expect(normalizedRatio('FERRITIN', 250, 'ug/L', 30, 'female')!).toBeGreaterThan(1);
    expect(normalizedRatio('FERRITIN', 250, 'ug/L', 30, 'male')!).toBeLessThan(1);
  });
});

describe('Л8: labs-indices — женские нормы в индексах (АЛТ→печёночный стресс)', () => {
  const altLab: import('../../core/types').LabPoint[] = [
    { id: '1', code: 'ALT', name: 'АЛТ', value: 35, unit: 'U/L', date: '2026-09-01', phase: 'mid' } as never,
  ];

  it('female hepaticStress выше мужского; без sex === male (JSON-lock)', async () => {
    const { computeLabIndices } = await import('../labs-indices.engine');
    const male = computeLabIndices(altLab, 'male');
    const fem = computeLabIndices(altLab, 'female');
    expect(fem.hepaticStress).toBeGreaterThan(male.hepaticStress);
    expect(JSON.stringify(computeLabIndices(altLab))).toBe(JSON.stringify(male));
  });
});

describe('Л11: clinical-analyzer женские ec50 гемато (честный сепаратор)', () => {
  it('мужской путь: без sex === male байт-в-байт (Monte Carlo зафиксирован)', async () => {
    const { analyzeClinicalRisks } = await import('../clinical-analyzer.engine');
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5); // boxMuller → 0, MC детерминирован
    try {
      const input = {
        compounds: ['testosterone'],
        markers: [{ code: 'Hematocrit', value: 49 }],
        tWeeks: 8, weeksSinceLab: 1, genetics: [],
      };
      const a = analyzeClinicalRisks(input);
      const b = analyzeClinicalRisks({ ...input, sex: 'male' as const });
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    } finally {
      spy.mockRestore();
    }
  });

  it('female: HCT 49 даёт больший риск эритроцитоза, чем мужской контур', async () => {
    const { analyzeClinicalRisks } = await import('../clinical-analyzer.engine');
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const base = {
        compounds: ['testosterone'],
        markers: [{ code: 'Hematocrit', value: 49 }],
        tWeeks: 8, weeksSinceLab: 1, genetics: [],
      };
      const pick = (r: ReturnType<typeof analyzeClinicalRisks>) =>
        r.results.find((x) => x.markersUsed.includes('Hematocrit'))?.riskPercent ?? -1;
      const male = pick(analyzeClinicalRisks({ ...base, sex: 'male' }));
      const fem = pick(analyzeClinicalRisks({ ...base, sex: 'female' }));
      expect(male).toBeGreaterThanOrEqual(0);
      expect(fem).toBeGreaterThan(male);
    } finally {
      spy.mockRestore();
    }
  });
});
