/**
 * female-aas-risk.test.ts — этап «женский слой» (A): женские пороги вирилизации
 * в assessPedRisk + проводка пола через mapper-ctx.
 *
 * Гарантия: мужской путь байт-в-байт прежний (sex отсутствует/male).
 */
import { describe, expect, it } from 'vitest';
import { assessPedRisk } from '../ped-risk-matrix';
import { assessFemaleAas, FEMALE_AAS_PROFILES } from '../female-aas-risk';
import { buildMapperCtx } from '../support-plan/mapper-ctx';
import { DEFAULT_STATE } from '../../ui/screens/Calculator/Calc.types';
import type { PEDDose } from '../../data/ped-potency-table';

const ped = (id: string, mgPerWeek = 0, form: 'oral' | 'inject' = 'inject'): PEDDose =>
  ({ id, mgPerWeek, form } as PEDDose);

function mkState(aas: Array<{ id: string; mgPerWeek: number; form?: string }>, sex: 'male' | 'female') {
  return {
    ...DEFAULT_STATE,
    profile: { ...DEFAULT_STATE.profile, sex },
    pharma: {
      ...DEFAULT_STATE.pharma,
      phase: 'course',
      aas: aas.map((a) => ({ id: a.id, doseMgWeek: a.mgPerWeek, form: a.form || 'inject' })),
    },
  } as any;
}

describe('female-aas-risk: мужской путь не изменён (lock)', () => {
  const fixtures: Array<[string, PEDDose[]]> = [
    ['tren 500', [ped('trenbolone_enanthate', 500)]],
    ['deca 400', [ped('nandrolone_decanoate', 400)]],
    ['test 750', [ped('test_enan', 750)]],
    ['stan oral 350', [ped('stanozolol', 350, 'oral')]],
    ['stack test+tren+nand', [ped('test_enan', 500), ped('trenbolone_enanthate', 400), ped('nandrolone_decanoate', 300)]],
  ];
  it('sex=undefined и sex=male дают идентичный JSON', () => {
    for (const [name, doses] of fixtures) {
      const a = assessPedRisk(doses, 'medium');
      const b = assessPedRisk(doses, 'medium', 'male');
      expect(JSON.stringify(b), name).toBe(JSON.stringify(a));
      expect(a.sex, name).toBeUndefined();
      expect(a.femaleFlags, name).toBeUndefined();
      expect(a.femaleMaxRatio, name).toBeUndefined();
    }
  });
  it('пустой стек: female/male/undefined идентичны', () => {
    const a = assessPedRisk([], 'medium');
    const b = assessPedRisk([], 'medium', 'female');
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe('female-aas-risk: assessFemaleAas — пороги', () => {
  it('пустой стек → пусто', () => {
    const r = assessFemaleAas([]);
    expect(r.findings.length).toBe(0);
    expect(r.maxRatio).toBe(0);
    expect(r.flags.length).toBe(0);
    expect(r.virilizationDoseIndex).toBe(0);
  });
  it('Deca 50 мг/нед → жёлтая зона (0.67)', () => {
    const r = assessFemaleAas([ped('nandrolone_decanoate', 50)]);
    expect(r.findings[0].name).toBe('Нандролон');
    expect(r.findings[0].level).toBe('yellow');
    expect(r.flags.join(' ')).toContain('Нандролон');
  });
  it('Deca 125 мг/нед → красная зона + флаг вирилизации', () => {
    const r = assessFemaleAas([ped('nandrolone_decanoate', 125)]);
    expect(r.findings[0].level).toBe('red');
    expect(r.maxRatio).toBeCloseTo(125 / 75, 2);
    expect(r.flags.join(' ')).toContain('красного');
  });
  it('Тестостерон 25 мг/нед → красная (1.25), дозо-индекс 13', () => {
    const r = assessFemaleAas([ped('test_enan', 25)]);
    expect(r.findings[0].level).toBe('red');
    expect(r.virilizationDoseIndex).toBe(13);
  });
  it('оральные ×7: оксандролон 20 мг/день → 140 мг/нед (порог)', () => {
    const r = assessFemaleAas([{ id: 'oxandrolone', form: 'oral', mgPerWeek: 20 } as PEDDose]);
    expect(r.findings[0].doseMgWeek).toBe(140);
    expect(r.findings[0].level).toBe('yellow');
    expect(r.findings[0].oral).toBe(true);
  });
  it('инъекционный ×7 не применяется', () => {
    const r = assessFemaleAas([{ id: 'nandrolone_decanoate', form: 'inject', mgPerWeek: 50 } as PEDDose]);
    expect(r.findings[0].doseMgWeek).toBe(50);
  });
  it('тренболон/YK-11/S23 → абсолютные противопоказания', () => {
    const r = assessFemaleAas([
      ped('tren_acet', 50),
      { id: 'yk11', form: 'oral', mgPerWeek: 10 } as PEDDose,
      { id: 's23', form: 'oral', mgPerWeek: 10 } as PEDDose,
    ]);
    expect(r.contraindicated).toEqual(['Тренболон', 'YK-11', 'S23']);
    expect(r.hasRed).toBe(true);
  });
  it('пептиды/инсулин не относятся к женскому AAS-слою', () => {
    const r = assessFemaleAas([
      { id: 'somatropin', pClass: 'gh', iuPerDay: 4 } as PEDDose,
      { id: 'insulin_rapid', pClass: 'insulin', iuPerDay: 5 } as PEDDose,
    ]);
    expect(r.findings.length).toBe(0);
  });
  it('профили: ≥20 записей, имена уникальны', () => {
    expect(FEMALE_AAS_PROFILES.length).toBeGreaterThanOrEqual(20);
    const names = FEMALE_AAS_PROFILES.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('female-aas-risk: женская эскалация в assessPedRisk', () => {
  it('Deca 50: репро не ниже moderate, флаги/индекс есть', () => {
    const r = assessPedRisk([ped('nandrolone_decanoate', 50)], 'medium', 'female');
    expect(r.sex).toBe('female');
    expect(r.femaleMaxRatio).toBeCloseTo(50 / 75, 2);
    expect(r.femaleFlags!.join(' ')).toContain('Нандролон');
    expect(['moderate', 'high']).toContain(r.reproductiveRisk);
    expect(r.triggeredBy.join(' ')).toContain('♀');
  });
  it('Тестостерон 25 мг/нед: репро high', () => {
    const r = assessPedRisk([ped('test_enan', 25)], 'medium', 'female');
    expect(r.reproductiveRisk).toBe('high');
    expect(r.femaleContraindicated).toBeUndefined();
  });
  it('Тренболон: противопоказание + репро high + флаг', () => {
    const r = assessPedRisk([ped('trenbolone_enanthate', 50)], 'medium', 'female');
    expect(r.reproductiveRisk).toBe('high');
    expect(r.femaleContraindicated).toEqual(['Тренболон']);
    expect(r.femaleFlags!.join(' ')).toContain('АБСОЛЮТНОЕ');
  });
  it('оральный оксандролон 30 мг/день: печень high + флаг АЛТ/АСТ', () => {
    const r = assessPedRisk(
      [{ id: 'oxandrolone', form: 'oral', pClass: 'aas_oral_anavar', mgPerWeek: 30 } as PEDDose],
      'medium',
      'female',
    );
    expect(r.hepaticRisk).toBe('high');
    expect(r.femaleFlags!.join(' ')).toContain('АЛТ/АСТ');
  });
  it('male: женские поля не появляются', () => {
    const r = assessPedRisk([ped('nandrolone_decanoate', 50)], 'medium', 'male');
    expect(r.sex).toBeUndefined();
    expect(r.femaleMaxRatio).toBeUndefined();
    expect(r.femaleFlags).toBeUndefined();
  });
  it('пептиды (female): sex есть, женских находок нет', () => {
    const r = assessPedRisk([{ id: 'somatropin', pClass: 'gh', iuPerDay: 4 } as PEDDose], 'medium', 'female');
    expect(r.sex).toBe('female');
    expect(r.femaleMaxRatio).toBeUndefined();
    expect(r.femaleFlags).toBeUndefined();
  });
});

describe('female-aas-risk: проводка пола через mapper-ctx', () => {
  it('женский профиль → ctx.sex=female и pedRisk.sex=female', () => {
    const ctx = buildMapperCtx(mkState([{ id: 'tren_acet', mgPerWeek: 50, form: 'inject' }], 'female'), 'medium');
    expect(ctx.sex).toBe('female');
    expect(ctx.pedRisk?.sex).toBe('female');
    expect(ctx.pedRisk?.femaleFlags?.length).toBeGreaterThan(0);
  });
  it('мужской профиль → ctx.sex отсутствует (байт-в-байт прежний путь)', () => {
    const ctx = buildMapperCtx(mkState([{ id: 'tren_acet', mgPerWeek: 50, form: 'inject' }], 'male'), 'medium');
    expect(ctx.sex).toBeUndefined();
    expect(ctx.pedRisk?.sex).toBeUndefined();
  });
});
