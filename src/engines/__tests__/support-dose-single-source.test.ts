/**
 * support-dose-single-source.test.ts — одна доза на вещество (этап E1).
 *
 * До этого прохода дозу знали две базы с разным приоритетом: план брал
 * `DEFAULT_DOSAGES`, а мост карточки вещества — `SUPPORT_CATALOG_DATA[id].dosage`.
 * На одном экране это давало tudca 1000 против 500, omega3 4000 против 2000,
 * nac 1200 против 600. Тест держит четыре вещи:
 *  1. оба входа (`resolvePlanDose` и доза карточки) возвращают одно число;
 *  2. вес-таблица больше не перебивает справочник у селена (было 57 мкг при 80 кг);
 *  3. нет дозы — 0/`null`, а не выдуманные 500 мг;
 *  4. лаб-множитель применяется в резолвере, а не только в тексте причины.
 */
import { describe, expect, it } from 'vitest';
import {
  buildSubstances,
  resolvePlanDose,
  resolvePlanDoseDisplay,
  resolvePlanSubstanceDose,
} from '../support-plan/substances';
import type { CalculatorResult } from '../support-plan/types';
import { DEFAULT_DOSAGES } from '../../data/support-meta';
import { defaultDoseUnit } from '../../data/dose-units';

const fake = {} as CalculatorResult;

describe('одна доза: справочник и карточка не расходятся', () => {
  it('tudca: план и карточка — 1000 мг (каталог 500 больше не перебивает)', () => {
    expect(resolvePlanDose('tudca', 80)).toBe(1000);
    expect(resolvePlanSubstanceDose('tudca')?.mg).toBe(1000);
  });

  it('nac: 1200 мг в обоих входах (каталог 600 игнорируется)', () => {
    expect(resolvePlanDose('nac', 80)).toBe(1200);
    expect(resolvePlanSubstanceDose('nac')?.mg).toBe(1200);
  });

  it('карточка и план совпадают для выборки веществ', () => {
    const ids = ['omega3', 'potassium', 'vitamin_b6', 'zinc', 'magnesium', 'hcg', 'probiotics', 'biotin'];
    for (const id of ids) {
      const card = resolvePlanSubstanceDose(id, 80);
      expect(card?.mg, id).toBe(resolvePlanDose(id, 80));
    }
  });
});

describe('вес-таблица не подменяет справочник', () => {
  it('селен: 200 мкг при 80 и 140 кг (вес его не дозирует)', () => {
    expect(resolvePlanDose('selenium', 80)).toBe(200);
    expect(resolvePlanDose('selenium', 140)).toBe(200);
    expect(resolvePlanDose('selenium')).toBe(200);
  });

  it('вес по-прежнему работает там, где задуман: магний 2.5 мг/кг', () => {
    expect(resolvePlanDose('magnesium', 140)).toBe(350);
    expect(resolvePlanDose('magnesium', 80)).toBe(200);
  });
});

describe('нет дозы — нет числа', () => {
  it('неизвестное вещество: 0 и null, а не 500 мг', () => {
    expect(resolvePlanDose('nonexistent_substance_xyz')).toBe(0);
    expect(resolvePlanSubstanceDose('nonexistent_substance_xyz')).toBeNull();
    const [sub] = buildSubstances(['nonexistent_substance_xyz'], fake);
    expect(sub.doseMg).toBe(0);
    expect(sub.doseDisplay).toBe('по инструкции');
  });
});

describe('лаб-титрация входит в дозу', () => {
  it('множитель ×2: план, карточка и подпись — 2000 мг', () => {
    const factors = new Map<string, number>([['tudca', 2]]);
    expect(resolvePlanDose('tudca', 80, factors)).toBe(2000);
    expect(resolvePlanSubstanceDose('tudca', 80, factors)?.mg).toBe(2000);
    const [sub] = buildSubstances(['tudca'], fake, undefined, 80, factors);
    expect(sub.doseMg).toBe(2000);
    expect(sub.doseDisplay).toBe('2 г');
  });

  it('множитель 1 и отсутствие карты дозу не меняют', () => {
    expect(resolvePlanDose('tudca', 80, new Map([['tudca', 1]]))).toBe(1000);
    expect(resolvePlanDose('tudca', 80, new Map())).toBe(1000);
  });

  it('карточка капит дозу по UL так же, как приём (цинк, D3, магний, селен)', () => {
    const zinc = new Map<string, number>([['zinc', 1.5]]);
    expect(resolvePlanDose('zinc', 80, zinc)).toBe(60); // расчёт до капа
    expect(resolvePlanDoseDisplay('zinc', 80, zinc)).toBe(40); // UL цинка
    expect(buildSubstances(['zinc'], fake, undefined, 80, zinc)[0].doseMg).toBe(40);

    const d3 = new Map<string, number>([['vitamin_d3', 4]]);
    expect(resolvePlanDose('vitamin_d3', 80, d3)).toBe(9120);
    expect(resolvePlanDoseDisplay('vitamin_d3', 80, d3)).toBe(4000); // UL 100 мкг = 4000 МЕ
    expect(buildSubstances(['vitamin_d3'], fake, undefined, 80, d3)[0].doseMg).toBe(4000);

    const mg = new Map<string, number>([['magnesium', 2]]);
    expect(resolvePlanDoseDisplay('magnesium', 80, mg)).toBe(350);

    const se = new Map<string, number>([['selenium', 1.5]]);
    expect(resolvePlanDose('selenium', 80, se)).toBe(300);
    expect(resolvePlanDoseDisplay('selenium', 80, se)).toBe(255);
  });

  it('B6/P5P не капятся молча: превышение остаётся предупреждением', () => {
    const b6 = new Map<string, number>([['vitamin_b6', 2]]);
    expect(resolvePlanDoseDisplay('vitamin_b6', 80, b6)).toBe(50);
  });
});

describe('единица дозы не живёт в прозе', () => {
  it('если в timing названа единица, реестр единиц говорит то же', () => {
    const named = /\((мкг|мг|МЕ|Ед|млрд КОЕ)\)|\b(мкг|млрд КОЕ|МЕ)\b/i;
    for (const [id, dose] of Object.entries(DEFAULT_DOSAGES as Record<string, { timing?: string }>)) {
      const hit = String(dose.timing || '').match(named);
      if (!hit) continue;
      const expected = (hit[1] || hit[2]).toLowerCase();
      const actual = defaultDoseUnit(id).toLowerCase();
      expect(actual, `${id}: timing «${dose.timing}» против единицы «${actual}»`).toBe(expected);
    }
  });
});
