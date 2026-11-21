/**
 * free-testosterone-scale.test.ts — проход 191: одна шкала свободного тестостерона.
 *
 * Класс дефекта: у одного анализа было три шкалы в двух единицах. Каталог держал
 * 8–30 пг/мл, строка ступеней — 0.3–1.0 нмоль/л, разбор анализа — 0.2–0.6 нмоль/л,
 * мост механизмов — 65 пг/мл (порог диализного метода). Российские бланки печатают
 * пг/мл иммуноанализа (ИНВИТРО тест 169 / Хеликс 08-050: мужчины 18–40 лет
 * 12.3–46.6; 40–60 лет 9.57–40.6; ≥ 60 лет 7.72–31.4), поэтому:
 * — запись в пг/мл не пересчитывалась в «нмоль/л» разбора (`unitsIncommensurable`)
 *   и молча выпадала из гормональной оценки;
 * — ступеней у `FT` не было вовсе: `tierMarkerKey('FT')` не находил строку, и
 *   мужчина с 9 пг/мл не получал ни ступени, ни совета;
 * — сравнение `< 0.3` в пг/мл не срабатывало никогда, а порог 65 пг/мл моста
 *   срабатывал у здорового.
 *
 * Гард держит равенство: каталог = строка ступеней = разбор = мост, единица одна —
 * пг/мл, и число в шкале толкуется по полосам одного источника.
 */
import { describe, it, expect } from 'vitest';
import { ucumInfo } from '../../core/constants';
import { LAB_TIERS, deriveTier, getLabEntry, tierMarkerKey } from '../lab-tier-ranges';
import { computeTierAdjustments } from '../lab-tier-recommendations';
import { FT_STEPS, FT_MALE_BAND } from '../../engines/lab-norms.engine';
import { REFERENCE_RANGES } from '../../engines/lab-analysis.engine';
import { MARKER_TO_TZ_MECH, getActivatedTzMechs } from '../../engines/tz-bridge-marker';
import { flatLabUnit } from '../../engines/support-plan/engine-helpers';

const FT = ucumInfo('FT')!;

describe('проход 191: свободный тестостерон — одна единица (пг/мл РФ-бланка)', () => {
  it('каталог — источник нормы, строка ступеней в его единице', () => {
    expect(FT.lln).toBe(12.3);
    expect(FT.uln).toBe(46.6);
    expect(FT.prefUnit).toBe('pg/mL');
    const row = LAB_TIERS.FREE_TESTOSTERONE;
    expect(row.unit).toBe(FT.prefUnit);
    expect(row.normal).toEqual([FT.lln, FT.uln]);
    // Возрастные полосы того же источника: ниже 12.3 — но внутри полосы ≥ 60 лет,
    // ниже 7.72 — ниже ЛЮБОЙ взрослой полосы.
    expect(row.borderline[0]).toBe(7.72);
    expect(row.treatment[1]).toBe(7.72);
    expect(row.emergencyLow).toBeUndefined();
  });

  it('форма находит ту же строку: `FT` = `FREE_TESTOSTERONE`', () => {
    expect(tierMarkerKey('FT')).toBe('FREE_TESTOSTERONE');
    expect(getLabEntry('FT')).toBe(LAB_TIERS.FREE_TESTOSTERONE);
    expect(flatLabUnit('FT')).toBe('pg/mL');
  });

  it('ступень читает пг/мл по полосам, высокий свободный T — не болезнь', () => {
    // норма 18–40 лет
    expect(deriveTier('FT', 30, 'male')).toBe(0);
    expect(deriveTier('FT', 40, 'male')).toBe(0);
    // на курсе свободный T высокий — ступени нет (direction: 'low')
    expect(deriveTier('FT', 200, 'male')).toBe(0);
    // ниже 18–40, но внутри полосы 40–60 (9.57) и ≥ 60 (7.72)
    expect(deriveTier('FT', 12, 'male')).toBe(1);
    expect(deriveTier('FT', 9.57, 'male')).toBe(1);
    // ниже любой взрослой полосы РФ
    expect(deriveTier('FT', 7, 'male')).toBe(2);
    expect(deriveTier('FT', 2, 'male')).toBe(2);
    // второе написание — та же ступень
    for (const value of [2, 7, 9.57, 12, 30, 200]) {
      expect(deriveTier('FREE_TESTOSTERONE', value, 'male'), `FREE_TESTOSTERONE ${value}`)
        .toBe(deriveTier('FT', value, 'male'));
    }
  });

  it('у женщины мужской шкалы нет: 3 пг/мл — её норма, а не «лечение»', () => {
    // Верх женского референса 5.45 пг/мл: мужская норма начинается там, где у неё
    // уже вирилизация. Низкий свободный T у женщины клинически не действуют.
    expect(deriveTier('FT', 3, 'female')).toBe(0);
    expect(deriveTier('FREE_TESTOSTERONE', 3, 'female')).toBe(0);
  });

  it('совет — диагностика, без добавок и без «STOP COURSE»', () => {
    // Грань: сначала повтор утром натощак без тренировок 48 ч.
    const edge = computeTierAdjustments({ FT: 12 }, 'male');
    expect(edge.addSubs).toEqual([]);
    expect(edge.titrations).toEqual([]);
    expect(edge.nutrition.map(n => `${n.action} ${n.target}`).join(' | ')).toContain('48 ч');

    // Ниже всех полос: к эндокринологу, с общим T, ГСПГ и ЛГ/ФСГ.
    const low = computeTierAdjustments({ FT: 7 }, 'male');
    expect(low.addSubs).toEqual([]);
    expect(low.titrations).toEqual([]);
    expect(low.stopCourse).toBe(false);
    const text = low.nutrition.map(n => `${n.action} ${n.target}`).join(' | ');
    expect(text).toContain('общий T, ГСПГ, ЛГ/ФСГ');

    // Норма и высокий свободный T не дают ни строки.
    expect(computeTierAdjustments({ FT: 30 }, 'male').nutrition).toEqual([]);
    expect(computeTierAdjustments({ FT: 200 }, 'male').nutrition).toEqual([]);
  });

  it('разбор анализа и мост механизмов читают ту же шкалу, а не диализную', () => {    // Проход 176: границы разбора — из каталога там, где смысл один.
    const ref = REFERENCE_RANGES.TESTOSTERONE_FREE;
    expect(ref.low).toBe(FT.lln);
    expect(ref.high).toBe(FT.uln);
    expect(ref.unit).toBe('пг/мл');
    // Мост: прежние 65 пг/мл — порог диализного метода, в иммуноанализе его почти
    // никто не достигает.
    const link = MARKER_TO_TZ_MECH.find(m => m.marker === 'TESTOSTERONE_FREE')!;
    expect(link.direction).toBe('down');
    expect(link.lln).toBe(FT.lln);
    // Ступени риска начинаются с той же границы.
    expect(FT_STEPS.male[0]).toBe(FT.lln);
    expect(FT_MALE_BAND.low).toBe(FT.lln);
    expect(FT_MALE_BAND.high).toBe(FT.uln);
  });

  it('мост узнаёт код склада `FT`, а не только клинические написания', () => {
    // `labSliceToValues` кладёт свободный тестостерон под кодом склада `FT`
    // (`v['FT'] = readHormone('Free T', …)`), а в `MARKER_TO_TZ_MECH` строки
    // называются `FREE_TESTO`/`TESTOSTERONE_FREE`. Без алиаса анализ не находил
    // строку и механизм не активировался ни при каком значении.
    const low = getActivatedTzMechs({ FT: 7 });
    expect(low.map(m => m.mechId)).toContain('rep1');
    // Норма и высокий свободный T механизм не включают.
    expect(getActivatedTzMechs({ FT: 30 })).toEqual([]);
    expect(getActivatedTzMechs({ FT: 200 })).toEqual([]);
  });
});
