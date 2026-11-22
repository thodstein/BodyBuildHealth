/**
 * tier-lab-view.test.ts — проход 205: одно число, много написаний.
 *
 * Класс дефекта: плоская карта бланка (`support-plan/mapper-ctx`) называет анализ
 * каноном формы (`POTASSIUM`, `HEMATOCRIT`, `ESTRADIOL`), а домены и правила
 * поддержки — кодом склада/лестницы (`K`, `HCT`, `E2`). Пока перевода не было,
 * значение в карте есть, а правило его не видит: калий 3.2 не включал «Ритм/ЧСС»
 * и «Электролиты», HCT 55 — «Эндотелий/тромбоз», E2 60 — «Ароматизацию», пролактин
 * 40 — «Пролактин», глюкоза 7.0 — «Глюкозу/IR».
 *
 * Таблица написаний собирается из источников поиска ступеней (`LAB_TIERS`,
 * `TIER_MARKER_ALIAS`, `TIER_SAME_ANALYSIS`) — второго списка имён нет.
 */
import { describe, it, expect } from 'vitest';
import { labValueFrom, tierLabView } from '../lab-tier-ranges';

describe('проход 205: labValueFrom — значение под любым написанием', () => {
  it('код склада находит канон формы', () => {
    expect(labValueFrom({ POTASSIUM: 3.2 }, 'K')).toBe(3.2);
    expect(labValueFrom({ HEMATOCRIT: 55 }, 'HCT')).toBe(55);
    expect(labValueFrom({ ESTRADIOL: 60 }, 'E2')).toBe(60);
    expect(labValueFrom({ PROLACTIN: 40 }, 'PRL')).toBe(40);
    expect(labValueFrom({ TESTOSTERONE: 20 }, 'TT')).toBe(20);
    expect(labValueFrom({ FREE_TESTOSTERONE: 7 }, 'FT')).toBe(7);
    expect(labValueFrom({ GLUCOSE: 7 }, 'GLU')).toBe(7);
    expect(labValueFrom({ MAGNESIUM: 0.7 }, 'MG')).toBe(0.7);
    expect(labValueFrom({ SODIUM: 150 }, 'NA')).toBe(150);
    expect(labValueFrom({ PLATELETS: 450 }, 'PLT')).toBe(450);
    expect(labValueFrom({ APOB: 1.5 }, 'APO_B')).toBe(1.5);
    expect(labValueFrom({ INSULIN: 20 }, 'INS')).toBe(20);
  });

  it('обратное направление тоже работает: канон формы находит код', () => {
    expect(labValueFrom({ K: 4.1 }, 'POTASSIUM')).toBe(4.1);
    expect(labValueFrom({ HCT: 44 }, 'HEMATOCRIT')).toBe(44);
    expect(labValueFrom({ E2: 30 }, 'ESTRADIOL')).toBe(30);
  });

  it('нет записи — `undefined`, а не ноль: «не сдано» не значит «норма»', () => {
    expect(labValueFrom({}, 'K')).toBeUndefined();
    expect(labValueFrom({ POTASSIUM: Number.NaN }, 'K')).toBeUndefined();
    expect(labValueFrom({ POTASSIUM: Number.POSITIVE_INFINITY }, 'K')).toBeUndefined();
    expect(labValueFrom({}, 'НЕИЗВЕСТНЫЙ')).toBeUndefined();
  });
});

describe('проход 205: tierLabView — карта, где анализ виден под своим кодом', () => {
  it('добавляет написания, не меняя числа', () => {
    const view = tierLabView({ POTASSIUM: 3.2, HEMATOCRIT: 55, ESTRADIOL: 60, APOB: 1.5 });
    expect(view['K']).toBe(3.2);
    expect(view['POTASSIUM']).toBe(3.2);
    expect(view['HCT']).toBe(55);
    expect(view['HEMATOCRIT']).toBe(55);
    expect(view['E2']).toBe(60);
    expect(view['ESTRADIOL']).toBe(60);
    expect(view['APO_B']).toBe(1.5);
    expect(view['APOB']).toBe(1.5);
  });

  it('не перезаписывает уже стоящее число и не трогает исходную карту', () => {
    const flat = { POTASSIUM: 3.2, K: 4.9 };
    const view = tierLabView(flat);
    expect(view['K']).toBe(4.9);
    expect(view['POTASSIUM']).toBe(3.2);
    expect(flat).toEqual({ POTASSIUM: 3.2, K: 4.9 });
  });

  it('пустая карта остаётся пустой: синонимов без значения не бывает', () => {
    expect(tierLabView({})).toEqual({});
  });
});
