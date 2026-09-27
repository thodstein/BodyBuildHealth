/**
 * v7-no-phantom-mechanisms.test.ts — E1.10 (B8): в матрице V7 не должно быть
 * механизмов, которых нет в самой модели.
 *
 * Дефект: computeV7Matrix перебирал mechIdx = 1..9 и подставлял
 * `?? 0.02` (базовый риск) и `?? 1/7` (вес). Следствия:
 *   1) система, для которой модель не описана ни одного механизма (иммунитет,
 *      щитовидная железа, простата, кожа), получала ~2.57% из воздуха И входила
 *      в общее геометрическое среднее, опуская весь индекс;
 *   2) описанные системы получали фантомные слоты (cardio — слот 9, ins_axis —
 *      слоты 3..9), поэтому их балл нельзя было воспроизвести по показанным
 *      пользователю строкам.
 *
 * Границы: TZ-модель (risk-engine-tz-spec, 6 органов × 28 именованных механизмов)
 * — основная и здесь не участвует. Тест держит инвариант V7 и намеренно
 * структурный (сверка с самой моделью), потому что механизмы V7 позиционные:
 * подписи в system-mechanisms.ts — справочник, а не источник истины.
 */
import { describe, it, expect } from 'vitest';
import {
  computeV7Matrix,
  BASE_RISK,
  MECH_WEIGHTS,
  RISK_SYSTEMS_V7,
  type MatrixInput,
} from '../risk-engine-v7-matrix';

const baseInput = (): MatrixInput => ({
  labs: [{ id: '1', code: 'ALT', name: 'АЛТ', value: 35, unit: 'U/L', date: '2026-08-01', phase: 'mid' }],
  course: [],
  genetics: {},
  nutrition: { proteinPerKg: 2, fiberG: 30, omega3G: 1, sodiumG: 3, potassiumG: 3 },
  training: { workoutsPerWeek: 4, avgWorkoutMinutes: 60, hasHIIT: false, volumeTonnes: 8, lissMinutesPerWeek: 60 },
  mode: 'bulk',
  stazhWeeks: 100,
  continuousWeeks: 12,
});

/** Системы, объявленные в реестре V7, но не описанные в самой модели. */
const UNDESCRIBED = ['immunity', 'thyroid', 'prostate', 'skin'];
const MODELED = Object.keys(BASE_RISK);

const geomMean = (arr: number[]): number =>
  arr.length ? Math.min(100, Math.exp(arr.reduce((a, v) => a + Math.log(Math.max(0.01, v)), 0) / arr.length)) : 0;

describe('модель V7 описана полностью (инвариант матрицы)', () => {
  it('BASE_RISK и MECH_WEIGHTS описывают один и тот же набор механизмов', () => {
    for (const sys of MODELED) {
      expect(Object.keys(MECH_WEIGHTS[sys] ?? {}).sort(), `ключи весов ${sys}`).toEqual(
        Object.keys(BASE_RISK[sys]).sort(),
      );
    }
  });

  it('веса описанной системы суммируются в 1 (нормировка не скрыта)', () => {
    for (const sys of MODELED) {
      const sum = Object.values(MECH_WEIGHTS[sys] ?? {}).reduce((a, b) => a + b, 0);
      expect(sum, `сумма весов ${sys}`).toBeCloseTo(1, 6);
    }
  });

  it('каждая описанная система присутствует в реестре V7', () => {
    for (const sys of MODELED) {
      expect(RISK_SYSTEMS_V7 as string[]).toContain(sys);
    }
  });

  it('реестр объявляет больше систем, чем описано моделью — это осознанно', () => {
    const undeclared = MODELED.filter(s => !(RISK_SYSTEMS_V7 as string[]).includes(s));
    expect(undeclared).toEqual([]);
    // 4 системы объявлены, но не описаны: они не должны попадать в матрицу.
    expect((RISK_SYSTEMS_V7 as string[]).length - MODELED.length).toBe(UNDESCRIBED.length);
  });
});

describe('computeV7Matrix не выдаёт фантомных механизмов', () => {
  it('в матрице ровно описанные системы, без неописанных', () => {
    const sysKeys = Object.keys(computeV7Matrix(baseInput()).systems).sort();
    expect(sysKeys).toEqual([...MODELED].sort());
    for (const sys of UNDESCRIBED) {
      expect(sysKeys, `неописанная система ${sys} не должна считаться`).not.toContain(sys);
    }
  });

  it('набор механизмов системы совпадает с моделью (нет слотов 9 и 3..9)', () => {
    const { systems } = computeV7Matrix(baseInput());
    for (const sys of MODELED) {
      expect(Object.keys(systems[sys].mechanisms).map(Number).sort((a, b) => a - b), `слоты ${sys}`).toEqual(
        Object.keys(BASE_RISK[sys]).map(Number).sort((a, b) => a - b),
      );
    }
  });

  it('у ins_axis ровно 2 механизма (в реестре подписано 8 — справочник ≠ модель)', () => {
    const ins = computeV7Matrix(baseInput()).systems.ins_axis;
    expect(Object.keys(ins.mechanisms).map(Number).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it('ни в одной системе нет нулевого набора механизмов', () => {
    for (const [sys, data] of Object.entries(computeV7Matrix(baseInput()).systems)) {
      expect(Object.keys(data.mechanisms).length, `механизмы ${sys}`).toBeGreaterThan(0);
    }
  });
});

describe('каждое число воспроизводится из своих же механизмов', () => {
  it('балл системы = взвешенная сумма Показанных механизмов', () => {
    const { systems } = computeV7Matrix(baseInput());
    for (const sys of MODELED) {
      const data = systems[sys];
      let raw = 0, net = 0;
      for (const [mechStr, m] of Object.entries(data.mechanisms)) {
        const w = MECH_WEIGHTS[sys][Number(mechStr)];
        raw += w * m.P_raw;
        net += w * m.P_net;
      }
      expect(data.raw, `raw ${sys}`).toBeCloseTo(Math.min(100, raw * 100), 9);
      expect(data.net, `net ${sys}`).toBeCloseTo(Math.min(100, net * 100), 9);
    }
  });

  it('индекс = геометрическое среднее только по описанным системам', () => {
    const m = computeV7Matrix(baseInput());
    expect(m.overallRaw).toBeCloseTo(geomMean(Object.values(m.systems).map(s => s.raw)), 9);
    expect(m.overallNet).toBeCloseTo(geomMean(Object.values(m.systems).map(s => s.net)), 9);
  });

  it('индекс не зависит от неописанных систем (их нет в матрице)', () => {
    const m = computeV7Matrix(baseInput());
    // 4 неописанные системы больше не могут опустить индекс: если бы они считались
    // с нулевым вкладом, геометрическое средное разошлось бы с числом систем.
    expect(Object.values(m.systems).every(s => s.raw > 0)).toBe(true);
  });

  it('неописанная система не тянет индекс вниз: база без курса и лабораторий', () => {
    const empty = computeV7Matrix({ ...baseInput(), labs: [], course: [] });
    // 14 описанных систем — у каждой есть собственная база, ноль невозможен.
    expect(empty.overallRaw).toBeGreaterThan(0);
    expect(Object.keys(empty.systems)).toHaveLength(MODELED.length);
  });
});
