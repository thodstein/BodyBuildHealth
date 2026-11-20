/**
 * flat-labs-unit-read.test.ts — проход 182: единица бланка решает и в «плоском» списке.
 *
 * Класс дефекта: `normalizeFlatLabs` (вкладка «Риски», `linked.labs`) переводил
 * единицу только у шести гормонов, а всем остальным отдавал число как есть.
 * 60 пмоль/л инсулина читались как 60 мЕд/л (норма 17), 90 мг/дл глюкозы — как
 * 90 ммоль/л, 15 г/дл гемоглобина — как 15 г/л, 30 пмоль/л свободного
 * тестостерона — как 30 пг/мл. И наоборот: единица, которую нельзя перевести
 * (КФК-МВ в Е/л против нормы в нг/мл), молча отдавалась норме как её число.
 *
 * Гард меряет чтением и моделью:
 *  - число переводится в единицу расчёта (`flatLabUnit`) и только тогда идёт в риск;
 *  - число уже в единице расчёта не округляется;
 *  - без единицы остаётся прежняя эвристика по величине (мужской путь байт-в-байт);
 *  - плейсхолдер («—», «балл») не считается единицей и не пересчитывает число;
 *  - непереводимая запись попадает в `unread`, а не выдаётся за прочитанную;
 *  - единица расчёта не расходится с единицей модели проверки (иначе пересчёт
 *    был бы правильным, а порог — чужим).
 */
import { describe, expect, it } from 'vitest';
import { flatLabUnit, normalizeFlatLabs, readFlatLabs } from '../support-plan/engine-helpers';
import { VERIFICATION_SYSTEMS } from '../risk-verification.engine';
import { canonicalLabValues } from '../lab-code-bridge';
import { unitsIncommensurable } from '../../core/labs-mapping';
import { getActivatedTzMechs } from '../tz-bridge-marker';

const readOne = (code: string, value: number, unit?: string) =>
  readFlatLabs([{ code, value, unit }]);

const mechs = (labs: Record<string, number>) =>
  getActivatedTzMechs(labs).map((m) => m.mechId).sort();

describe('проход 182: единица бланка переводится в единицу расчёта', () => {
  it('инсулин пмоль/л — это мЕд/л, а не «60»', () => {
    // 60 пмоль/л ≈ 10 мЕд/л (норма 3–17): раньше число шло в модель как 60.
    expect(normalizeFlatLabs([{ code: 'INS', value: 60, unit: 'пмоль/л' }]).INS).toBe(10);
    expect(flatLabUnit('INS')).toBe('mIU/L');
  });

  it('глюкоза мг/дл, гемоглобин г/дл, свободный тест пмоль/л', () => {
    expect(normalizeFlatLabs([{ code: 'GLU', value: 90, unit: 'мг/дл' }]).GLU).toBeCloseTo(4.995, 3);
    expect(normalizeFlatLabs([{ code: 'HGB', value: 15, unit: 'г/дл' }]).HGB).toBe(150);
    expect(normalizeFlatLabs([{ code: 'FT', value: 30, unit: 'пмоль/л' }]).FT).toBeCloseTo(8.65, 2);
  });

  it('шесть гормонов остаются в единице норм, а не каталога', () => {
    // Каталог знает общий тестостерон в ng/dL, а норма приложения — 12–33 нмоль/л.
    expect(flatLabUnit('TT')).toBe('nmol/L');
    expect(normalizeFlatLabs([{ code: 'TT', value: 600, unit: 'нг/дл' }]).TT).toBeCloseTo(20.8, 1);
    // Прогестерон: каталог — нмоль/л, норма — 1.2 нг/мл.
    expect(flatLabUnit('PROG')).toBe('ng/mL');
    expect(normalizeFlatLabs([{ code: 'PROG', value: 6, unit: 'нмоль/л' }]).PROG).toBeCloseTo(1.9, 1);
  });

  it('HbA1c из ммоль/моль — проценты (пересчёт не линейный)', () => {
    expect(normalizeFlatLabs([{ code: 'HBA1C', value: 53, unit: 'ммоль/моль' }]).HBA1C).toBe(7);
  });
});

describe('проход 182: число не портится там, где пересчёт не нужен', () => {
  it('та же единица — число не округляется', () => {
    // Через `convertToUnit` 45.55 превращалось бы в 45.6, а 253.4 — в 253.4
    // только потому, что значение большое.
    expect(normalizeFlatLabs([{ code: 'HCT', value: 45.55, unit: '%' }]).HCT).toBe(45.55);
    expect(normalizeFlatLabs([{ code: 'PLT', value: 253.4, unit: '10⁹/л' }]).PLT).toBe(253.4);
  });

  it('плейсхолдер вместо единицы не пересчитывает число', () => {
    // «—» и «балл» — не единица измерения. Раньше такой число подписывалось
    // каноном каталога и уезжало в модель (5 нмоль/л → 0.17 нмоль/л).
    expect(normalizeFlatLabs([{ code: 'TT', value: 5, unit: '—' }]).TT).toBe(5);
    expect(normalizeFlatLabs([{ code: 'TT', value: 5, unit: 'балл' }]).TT).toBe(5);
  });

  it('без единицы — прежняя эвристика по величине (мужской путь)', () => {
    expect(normalizeFlatLabs([{ code: 'E2', value: 450 }]).E2).toBe(122.6);
    expect(normalizeFlatLabs([{ code: 'PRL', value: 300 }]).PRL).toBe(14.2);
    expect(normalizeFlatLabs([{ code: 'INS', value: 60 }]).INS).toBe(60);
    expect(normalizeFlatLabs([{ code: 'TT', value: 18 }]).TT).toBe(18);
  });
});

describe('проход 182: непереводимая запись не выдаётся за прочитанную', () => {
  it('КФК-МВ в Е/л против нормы в нг/мл — «не прочитано», а не число', () => {
    const flat = readFlatLabs([
      { code: 'GLU', value: 5.2, unit: 'ммоль/л' },
      { code: 'CK_MB', value: 25, unit: 'Е/л' },
    ]);
    expect(flat.values).toEqual({ GLU: 5.2 });
    expect(flat.unread).toEqual([{ code: 'CK_MB', value: 25, unit: 'Е/л' }]);
  });

  it('инсулин в нг/мл — «не прочитано»: коэффициента масса↔МЕ для него нет', () => {
    // Единицу каталога (мЕд/л) из массы не получить: коэффициент есть только у
    // пролактина. Выдавать 1 нг/мл за 1 мЕд/л нельзя — это другая величина.
    const flat = readOne('INS', 1, 'нг/мл');
    expect(flat.values.INS).toBeUndefined();
    expect(flat.unread).toEqual([{ code: 'INS', value: 1, unit: 'нг/мл' }]);
  });

  it('поздняя читаемая запись снимает «не прочитано» у того же кода', () => {
    const flat = readFlatLabs([
      { code: 'CK_MB', value: 25, unit: 'Е/л' },
      { code: 'CK_MB', value: 3, unit: 'нг/мл' },
    ]);
    expect(flat.values.CK_MB).toBe(3);
    expect(flat.unread).toEqual([]);
  });
});

describe('проход 182: единица расчёта и единица модели проверки', () => {
  it('ни у одного маркера модели единица расчёта не другой величины', () => {
    const checked: string[] = [];
    for (const system of VERIFICATION_SYSTEMS) {
      for (const mech of system.mechanisms) {
        for (const marker of mech.markers) {
          const target = flatLabUnit(marker.code);
          // Единицы разных величин (масса против количества вещества) означали бы,
          // что пересчёт даёт число, к которому порог модели не относится.
          expect(
            unitsIncommensurable(marker.unit, target),
            `${marker.code}: модель ${marker.unit}, расчёт ${target}`,
          ).toBe(false);
          if (target && marker.unit) checked.push(marker.code);
        }
      }
    }
    expect(checked.length).toBeGreaterThan(30);
  });

  it('порог модели применяется к правильному числу: триглицериды 100 мг/дл', () => {
    // 100 мг/дл = 1.13 ммоль/л — норма. Раньше число шло как 100 ммоль/л, то есть
    // «втрое выше порога», и одна запись бланка давала тяжёлую дислипидемию.
    const fromBlank = canonicalLabValues(readOne('TG', 100, 'мг/дл').values);
    expect(mechs(fromBlank)).toEqual([]);

    const withoutUnit = canonicalLabValues(readOne('TG', 100).values);
    expect(mechs(withoutUnit)).toContain('cv2');
  });
});
