/**
 * v7-lab-references-female.test.ts — §6.2 (P2): женские нормы LAB_REFERENCES V7.
 * Женские ветки: Hct/Hb/RBC, АЛТ/АСТ/ГГТ (ULN 31), креатинин, ферритин.
 * Мужской путь (без sex / sex='male') — байт-в-байт прежний.
 */
import { describe, it, expect } from 'vitest';
import {
  LAB_REFERENCES,
  LAB_REFERENCES_FEMALE,
  getLabReference,
  computeV7Matrix,
  type MatrixInput,
} from '../risk-engine-v7-matrix';
import { calculateTZRisk, type TZRiskInput } from '../risk-engine-tz';

describe('getLabReference', () => {
  it('без sex / sex=male — базовая таблица (та же ссылка)', () => {
    expect(getLabReference('ALT')).toBe(LAB_REFERENCES.ALT);
    expect(getLabReference('ALT', 'male')).toBe(LAB_REFERENCES.ALT);
    expect(getLabReference('unknown_marker')).toBeUndefined();
  });

  it('sex=female — женские пороги, служебные поля наследуются', () => {
    const fem = getLabReference('ALT', 'female')!;
    expect(fem.uln).toBe(31);
    expect(fem.mean).toBe(20);
    expect(fem.sensitive).toBe(LAB_REFERENCES.ALT.sensitive);
    expect(fem.alpha).toBe(LAB_REFERENCES.ALT.alpha);
    // Hct/Hb/RBC/креатинин — женские
    // (фаза 2 Л8: Hb ULN выровнен 155→150 и добавлены LLN — единый источник getLabNorm/FEMALE_LAB_GROUPS)
    expect(getLabReference('Hct', 'female')!.uln).toBe(0.48);
    expect(getLabReference('Hb', 'female')!.uln).toBe(150);
    expect(getLabReference('Hb', 'female')!.lln).toBe(120);
    expect(getLabReference('RBC', 'female')!.uln).toBe(5.2);
    expect(getLabReference('RBC', 'female')!.lln).toBe(4.0);
    expect(getLabReference('Creatinine', 'female')!.uln).toBe(97);
    expect(getLabReference('GGT', 'female')!.uln).toBe(31);
    // маркеры без женских отличий — базовая
    expect(getLabReference('TSH', 'female')).toBe(LAB_REFERENCES.TSH);
  });

  it('базовая таблица не мутируется', () => {
    expect(LAB_REFERENCES.ALT.uln).toBe(40);
    expect(LAB_REFERENCES.Hct.uln).toBe(0.52);
    expect(LAB_REFERENCES_FEMALE.ALT.uln).toBe(31);
  });
});

const baseInput = (sex?: 'male' | 'female', labs?: MatrixInput['labs']): MatrixInput => ({
  labs: labs ?? [{ id: '1', code: 'ALT', name: 'АЛТ', value: 35, unit: 'U/L', date: '2026-08-01', phase: 'mid' }],
  course: [],
  genetics: {},
  nutrition: { proteinPerKg: 2, fiberG: 30, omega3G: 1, sodiumG: 3, potassiumG: 3 },
  training: { workoutsPerWeek: 4, avgWorkoutMinutes: 60, hasHIIT: false, volumeTonnes: 8, lissMinutesPerWeek: 60 },
  mode: 'bulk',
  stazhWeeks: 100,
  continuousWeeks: 12,
  ...(sex ? { sex } : {}),
});

describe('computeV7Matrix: женские референсы', () => {
  it('мужской путь байт-в-байт (без sex === sex=male)', () => {
    expect(JSON.stringify(computeV7Matrix(baseInput()))).toBe(JSON.stringify(computeV7Matrix(baseInput('male'))));
  });

  it('АЛТ 35: у женщины hepatic-риск выше (женский ULN 31 против мужского 40)', () => {
    const male = computeV7Matrix(baseInput('male'));
    const fem = computeV7Matrix(baseInput('female'));
    const hepMale = male.systems.hepatic?.raw ?? male.systems.liver?.raw ?? 0;
    const hepFem = fem.systems.hepatic?.raw ?? fem.systems.liver?.raw ?? 0;
    expect(hepFem).toBeGreaterThan(hepMale);
  });

  it('маркеры без женских отличий — результат идентичен', () => {
    const tsh = [{ id: '1', code: 'TSH', name: 'ТТГ', value: 2.0, unit: 'мМЕ/л', date: '2026-08-01', phase: 'mid' }] as MatrixInput['labs'];
    expect(JSON.stringify(computeV7Matrix(baseInput('male', tsh)))).toBe(JSON.stringify(computeV7Matrix(baseInput('female', tsh))));
  });
});

describe('calculateTZRisk: женские референсы в TZ-контуре', () => {
  const tzInput = (sex: 'male' | 'female'): TZRiskInput => ({
    course: [],
    labs: [{ id: '1', code: 'ALT', name: 'АЛТ', value: 35, unit: 'U/L', date: '2026-08-01', phase: 'mid' }],
    genetics: {},
    nutrition: { proteinPerKg: 2, fiberG: 25, omega3G: 1.5, sodiumG: 3, potassiumG: 3, waterL: 2, calories: 2500 },
    training: { hasHIIT: false, weeklyMinutes: 240, volumeTonnes: 8000, lissMinutesPerWeek: 60 },
    weight: 80, age: 30,
    sex,
    supportSubstances: [],
  });

  it('АЛТ 35: женский контур отличается от мужского; без над-пороговых маркеров совпадает', () => {
    const male = calculateTZRisk(tzInput('male'));
    const fem = calculateTZRisk(tzInput('female'));
    expect(fem.overallRaw).not.toBe(male.overallRaw);

    const tsh = [{ id: '1', code: 'TSH', name: 'ТТГ', value: 2.0, unit: 'мМЕ/л', date: '2026-08-01', phase: 'mid' }] as TZRiskInput['labs'];
    const maleTs = calculateTZRisk({ ...tzInput('male'), labs: tsh });
    const femTs = calculateTZRisk({ ...tzInput('female'), labs: tsh });
    expect(femTs.overallRaw).toBe(maleTs.overallRaw);
  });
});
