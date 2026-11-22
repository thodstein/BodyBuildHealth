/**
 * lab-references-uln-single-source.test.ts — проход 176: верхняя граница
 * V7-референса и разбора читается из каталога, а не держится своей копией.
 *
 * `LAB_REFERENCES` (`risk-engine-v7-matrix`) и `UCUM_MAP` (`core/constants`) —
 * одна и та же нормальный верх для одних и тех же анализов. Копия уже
 * расходилась: АСТ 35 против 40, ГГТ 50 против 55, креатинин 106 против 110,
 * ЩФ 120 против 130, билирубин 20 против 17.1 (проход 24 свёл семь строк
 * мутирующим циклом `UCUM_ULN_SOURCE`). Проход 176 убрал и цикл, и литералы:
 * значение берётся `ucumInfo` прямо в строке.
 *
 * Гард держит три вещи:
 *  1) «сведённые» маркеры численно равны каталогу (и ни один не потерян);
 *  2) таблица больше не правится после объявления (нет второго места с числом);
 *  3) расходящиеся пары остались расходящимися — это клинические решения
 *     (`docs/LAB-NORMS-SINGLE-SOURCE.md` §4), их нельзя «выровнять» молча.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ucumInfo } from '../../core/constants';
import { LAB_REFERENCES } from '../risk-engine-v7-matrix';
import { REFERENCE_RANGES } from '../lab-analysis.engine';

/** Маркер V7 → код каталога (+ масштаб, где V7 хранит другую единицу). */
const DERIVED: Record<string, [code: string, scale?: number]> = {
  ALT: ['ALT'],
  AST: ['AST'],
  GGT: ['GGT'],
  ALP: ['ALP'],
  Bilirubin: ['BIL'],
  Hct: ['HCT', 0.01],
  Hb: ['HGB'],
  PLT: ['PLT'],
  TG: ['TG'],
  HbA1c: ['HbA1c'],
  eGFR: ['EGFR'],
  Creatinine: ['CREATININE'],
  Fibrinogen: ['FIBRINOGEN'],
  D_dimer: ['D_DIMER'],
  CRP: ['CRP'],
  IL6: ['IL6'],
  TNF: ['TNF_ALPHA'],
  Homocysteine: ['HOMOCYSTEINE'],
  PSA: ['PSA'],
  Na: ['NA'],
  TSH: ['TSH'],
  Ferritin: ['FERRITIN'],
  LDH: ['LDH'],
  RBC: ['RBC'],
};

/**
 * Пары, где модель и каталог намеренно расходятся. Число слева — модельный
 * порог (z-терм/порог модели), справа — норма лаборатории. Выравнивание —
 * отдельное клиническое решение с обновлением §4, а не правка ради единообразия.
 *
 * Проход 207: у каждой пары теперь записан смысл расхождения. До этого список
 * был просто «здесь не сводим», и по нему нельзя было понять, что именно
 * осталось за моделью — приходилось читать §4 документа. Смысл у всех 15
 * записей — выбор шкалы (порог действия/риска против лабораторного верха), а не
 * опечатка; числа в тексте обязаны совпадать с обеими строками, иначе гард падает
 * на проверке «повод не спрятался в комментарий».
 */
const DIVERGENT: Array<[marker: string, code: string, reason: string]> = [
  // Модель держит пороги действия/риска, каталог — лабораторный верх.
  ['WBC', 'WBC', 'модель: лейкоцитоз от 11.0 (порог воспаления); каталог: лабораторный верх 9.0'],
  ['LDL', 'LDL', 'модель: порог риска 3.4; каталог: лабораторный верх 3.0'],
  ['HDL', 'HDL', 'модель: верх шкалы 2.0; каталог: лабораторный верх 1.5 (низ у обоих 1.0)'],
  ['Glucose', 'GLU', 'модель: порог 5.8; каталог: верх 5.6 (тиры: грань 5.6–6.1)'],
  ['K', 'K', 'модель: верх 5.0; каталог: верх 5.1'],
  ['Mg', 'MG', 'модель: верх 1.0; каталог: верх 1.07 (ИНВИТРО/Helix 0.66–1.07)'],
  ['Prolactin', 'PRL', 'модель: верх 20; каталог: верх 15'],
  ['SBP', 'BP_SYSTOLIC', 'модель: порог гипертонии 140; каталог: верх 130'],
  ['DBP', 'BP_DIASTOLIC', 'модель: порог гипертонии 90; каталог: верх 85'],
  ['Insulin', 'INS', 'модель: верх 25; каталог: верх 17'],
  ['HOMA_IR', 'HOMA', 'модель: верх 2.5 (порог инсулинорезистентности); каталог: верх 2.7'],
  ['Cortisol', 'CORTISOL', 'модель: верх 600; каталог: верх 550'],
  ['IGF1', 'IGF1', 'модель: верх 350; каталог: верх 250'],
  ['Transferrin', 'TRANSFERRIN', 'модель: верх 3.5; каталог: верх 3.8'],
  ['Haptoglobin', 'HAPTOGLOBIN', 'модель: верх 2.0; каталог: верх 3.0'],
];

describe('проход 176: верх V7-референса — из каталога', () => {
  it('сведённые маркеры равны каталогу', () => {
    for (const [marker, [code, scale]] of Object.entries(DERIVED)) {
      const row = LAB_REFERENCES[marker];
      const info = ucumInfo(code);
      expect(row, `нет строки ${marker}`).toBeTruthy();
      expect(info, `нет записи каталога ${code}`).toBeTruthy();
      expect(row.uln, `${marker} ≠ UCUM_MAP.${code}.uln`).toBeCloseTo(info!.uln * (scale ?? 1), 10);
    }
  });

  it('таблица не правится после объявления', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/engines/risk-engine-v7-matrix.ts'), 'utf8');
    // Второго места с числом быть не должно: либо `ulnFromUcum`, либо литерал
    // в самой строке — но не «объявили 35, потом переписали на 40».
    expect(src).not.toContain('UCUM_ULN_SOURCE');
    expect(src).not.toMatch(/LAB_REFERENCES\s*\[[^\]]+\]\s*\.\s*uln\s*=/);
    expect(src).toMatch(/function ulnFromUcum\(/);
  });

  it('расходящиеся пары остаются расходящимися (клиническое решение, не рефакторинг)', () => {
    for (const [marker, code] of DIVERGENT) {
      const row = LAB_REFERENCES[marker];
      const info = ucumInfo(code);
      expect(row, `нет строки ${marker}`).toBeTruthy();
      if (!info) continue; // пары без каталожной записи — только документация
      expect(row.uln, `${marker}: пара сходится — обнови §4 и этот список осознанно`).not.toBe(info.uln);
    }
  });

  it('у каждой расходящейся пары записан смысл, и числа в нём — те же', () => {
    // Без текста список — просто «здесь не сводим»: следующий агент не может
    // отличить клиническое решение от забытой опечатки. Текст обязан называть
    // оба числа: если кто-то двинет порог модели или каталог, причина станет
    // врать — и гард это покажет.
    // Ревью P3: сравнение по подстроке проходило на чужом числе — «1.0» лежит
    // внутри «1.07» (магний), «3» — внутри «3.5». Сравниваем ЧИСЛА из текста.
    expect(DIVERGENT).toHaveLength(15);
    const numbersIn = (text: string): number[] => (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    for (const [marker, code, reason] of DIVERGENT) {
      const row = LAB_REFERENCES[marker];
      const info = ucumInfo(code);
      expect(reason.length, `${marker}: повод не записан`).toBeGreaterThan(30);
      const numbers = numbersIn(reason);
      expect(numbers, `${marker}: повод не называет модельное число ${row.uln}`).toContain(row.uln);
      if (info) {
        expect(numbers, `${marker}: повод не называет каталожное число ${info.uln}`).toContain(info.uln);
      }
    }
  });

  it('без `sex` — прежний мужской путь: значения не изменились', () => {
    // Проверка именно тех чисел, которые видит риск-модель: сводили границы,
    // но ответ для мужского пути обязан остаться прежним.
    expect(LAB_REFERENCES.AST.uln).toBe(40);
    expect(LAB_REFERENCES.GGT.uln).toBe(55);
    expect(LAB_REFERENCES.Bilirubin.uln).toBe(17.1);
    expect(LAB_REFERENCES.Creatinine.uln).toBe(110);
    expect(LAB_REFERENCES.Hct.uln).toBe(0.52);
    expect(LAB_REFERENCES.Hb.uln).toBe(170);
  });
});

/**
 * Третий реестр — `REFERENCE_RANGES` разбора (`lab-analysis.engine`). Здесь
 * свёрнуты пары, где смысл совпадал с нормой каталога; `criticalHigh` остался
 * литералом (это порог действия, каталог его не хранит).
 */
const RANGE_DERIVED: Record<string, { code: string; lowFromUcum?: boolean }> = {
  ESTRADIOL: { code: 'E2', lowFromUcum: true },
  TSH: { code: 'TSH', lowFromUcum: true },
  LDL: { code: 'LDL' }, // низ 1.5 — цель, не лабораторный низ
  TRIGLYCERIDES: { code: 'TG' }, // низ 0.5 — свой
  FERRITIN: { code: 'FERRITIN' }, // низ 20 — свой (WHO/дефицит)
  ERYTHROCYTES: { code: 'RBC' }, // низ 4.2 — свой
  THROMBOCYTES: { code: 'PLT', lowFromUcum: true },
  POTASSIUM: { code: 'POTASSIUM', lowFromUcum: true },
  SODIUM: { code: 'SODIUM', lowFromUcum: true },
  // Проход 191: свободный тестостерон переехал из 0.2–0.6 нмоль/л (диализный
  // метод) в пг/мл РФ-бланка: одна шкала с каталогом и ступенями.
  TESTOSTERONE_FREE: { code: 'FT', lowFromUcum: true },
};

describe('проход 176: границы разбора — из каталога там, где смысл один', () => {
  it('верх (и низ, где он лабораторный) равен каталогу', () => {
    for (const [marker, { code, lowFromUcum }] of Object.entries(RANGE_DERIVED)) {
      const row = REFERENCE_RANGES[marker];
      const info = ucumInfo(code);
      expect(row, `нет строки ${marker}`).toBeTruthy();
      expect(info, `нет записи каталога ${code}`).toBeTruthy();
      expect(row.high, `${marker}.high ≠ UCUM_MAP.${code}.uln`).toBe(info!.uln);
      if (lowFromUcum) expect(row.low, `${marker}.low ≠ UCUM_MAP.${code}.lln`).toBe(info!.lln);
    }
  });

  it('низ, который является целью, остался своим', () => {
    // Если кто-то «выровняет» низ ЛПНП по каталогу, это уже клиническое
    // решение: цель <1.5 ммоль/л — терапевтическая, а не лабораторный низ.
    expect(REFERENCE_RANGES.LDL.low).toBe(1.5);
    expect(REFERENCE_RANGES.TRIGLYCERIDES.low).toBe(0.5);
    expect(REFERENCE_RANGES.FERRITIN.low).toBe(20);
    expect(REFERENCE_RANGES.ERYTHROCYTES.low).toBe(4.2);
  });

  it('расходящиеся пары разбора не выровнены молча', () => {
    for (const [marker, code] of [
      ['CRP', 'CRP'],
      ['GLUCOSE', 'GLU'],
      ['HOMOCYSTEINE', 'HOMOCYSTEINE'],
      ['BILIRUBIN', 'BIL'],
      ['UREA', 'UREA'],
      ['INSULIN', 'INS'],
      ['APOB', 'APO_B'],
      ['HDL', 'HDL'],
      ['LH', 'LH'],
      ['FSH', 'FSH'],
      ['FREE_T3', 'FT3'],
      ['FREE_T4', 'FT4'],
      ['LEUKOCYTES', 'WBC'],
    ] as const) {
      const row = REFERENCE_RANGES[marker];
      const info = ucumInfo(code);
      expect(row, `нет строки ${marker}`).toBeTruthy();
      if (!info) continue;
      expect(row.high, `${marker}: пара сходится — обнови §4 и этот список осознанно`).not.toBe(info.uln);
    }
  });
});
