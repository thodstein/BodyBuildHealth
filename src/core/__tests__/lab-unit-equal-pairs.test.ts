/**
 * lab-unit-equal-pairs.test.ts — проход 186: равные единицы — один ключ.
 *
 * Класс дефекта: `unitKey` сравнивал НАПИСАНИЕ единицы, а не величину. «МЕ/л»
 * (IU/L) и «mIU/mL» — это одна и та же единица (1 IU/L = 1 mIU/mL), но ключи
 * выходили разные. `readLabInUnit` видел «разные единицы», клинический
 * коэффициент анализа не срабатывал, и пролактин из бланка РФ «МЕ/л» уходил в
 * «не прочитано» вместо числа. Так же расходились `мг/л` ≡ `мкг/мл`,
 * `нг/мл` ≡ `мкг/л`, `пг/мл` ≡ `нг/л`, `нмоль/мл` ≡ `мкмоль/л`.
 *
 * Гард держит обе стороны:
 *  - физически равные пары сводятся к одному ключу и читаются без пересчёта
 *    (или с пересчётом, который ничего не меняет);
 *  - единицы, которые РАЗЛИЧАЮТСЯ в 1000 раз («МЕ/л» против «мЕд/л»), остаются
 *    разными: сводить их — значит занизить или завысить число в тысячу раз.
 */
import { describe, it, expect } from 'vitest';
import {
  convertToUnit, readLabInUnit, sameLabUnit, unitsIncommensurable,
} from '../labs-mapping';

describe('проход 186: физически равные единицы — один ключ', () => {
  it('активность: IU/L ≡ mIU/mL, µIU/mL ≡ mIU/L', () => {
    expect(sameLabUnit('МЕ/л', 'mIU/mL')).toBe(true);
    expect(sameLabUnit('мкМЕ/мл', 'мЕд/л')).toBe(true);
  });

  it('активность: МЕ/л и мЕд/л — РАЗНЫЕ (в 1000 раз), не сводятся', () => {
    expect(sameLabUnit('МЕ/л', 'мЕд/л')).toBe(false);
    expect(convertToUnit('PRL', 1, 'МЕ/л', 'мЕд/л')).toBe(1000);
  });

  it('массы: мг/л ≡ мкг/мл, нг/мл ≡ мкг/л, пг/мл ≡ нг/л, мг/мл ≡ г/л', () => {
    expect(sameLabUnit('мг/л', 'мкг/мл')).toBe(true);
    expect(sameLabUnit('нг/мл', 'мкг/л')).toBe(true);
    expect(sameLabUnit('пг/мл', 'нг/л')).toBe(true);
    expect(sameLabUnit('мг/мл', 'г/л')).toBe(true);
  });

  it('массы: соседние ступени остаются разными', () => {
    expect(sameLabUnit('нг/мл', 'мг/л')).toBe(false);
    expect(sameLabUnit('мг/л', 'г/л')).toBe(false);
    expect(convertToUnit('CRP', 1, 'г/л', 'мг/л')).toBe(1000);
  });

  it('моли: нмоль/мл ≡ мкмоль/л', () => {
    expect(sameLabUnit('нмоль/мл', 'мкмоль/л')).toBe(true);
    expect(convertToUnit('TT', 1, 'нмоль/мл', 'нмоль/л')).toBe(1000);
  });
});

describe('проход 186: РФ-бланк читается, а не уходит в «не прочитано»', () => {
  it('ФСГ/ЛГ «МЕ/л» — те же mIU/mL, число не меняется', () => {
    expect(readLabInUnit('FSH', 5.4, 'МЕ/л', 'mIU/mL')).toBe(5.4);
    expect(readLabInUnit('LH', 3.1, 'МЕ/л', 'mIU/mL')).toBe(3.1);
  });

  it('пролактин «МЕ/л» читается коэффициентом, а не молчанием', () => {
    // 1 МЕ/л = 1000 мЕд/л; при 21.2 мЕд/л на 1 нг/мл это 47.17 нг/мл.
    const v = readLabInUnit('PRL', 1, 'МЕ/л', 'ng/mL');
    expect(v).toBe(47.17);
  });

  it('D-димер «мг/л» против «мкг/мл» — одна величина', () => {
    expect(readLabInUnit('D_DIMER', 0.4, 'мг/л', 'ug/mL')).toBe(0.4);
    expect(readLabInUnit('D_DIMER', 300, 'нг/мл', 'ug/mL')).toBe(0.3);
  });

  it('ферритин «нг/мл» против «мкг/л» — одна величина', () => {
    expect(readLabInUnit('FERRITIN', 120, 'нг/мл', 'ug/L')).toBe(120);
  });

  it('активность против массы остаётся разными величинами', () => {
    expect(unitsIncommensurable('МЕ/л', 'ng/mL')).toBe(true);
  });
});
