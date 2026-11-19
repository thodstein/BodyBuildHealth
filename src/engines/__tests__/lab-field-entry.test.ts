/**
 * lab-field-entry.test.ts — проход 155: запись поля вместе со знаком границы.
 *
 * Ручной ввод на экране «Анализы» читал значение своим `parseFloat`:
 *  - «1 000» превращалось в 1 (обрезанное число выдавалось за полное);
 *  - «5,5» — в 5;
 *  - «>1000» либо не сохранялось вовсе, либо становилось точным 1000, и тренд
 *    честно считал по нему разность.
 * Теперь число берётся правилом расчёта (`labFieldNumber`), знак — отдельным
 * полем, а причина «числа нет» называется одной таблицей на всё приложение.
 */
import { describe, it, expect } from 'vitest';
import { labFieldEntry, labFieldNumber, labFieldUnreadReason } from '../support-plan/lab-field-number';

describe('проход 155: число и знак из одного чтения', () => {
  it('точное число — без знака', () => {
    expect(labFieldEntry('40')).toEqual({ value: 40 });
    expect(labFieldEntry(40)).toEqual({ value: 40 });
  });

  it('«>1000» — число 1000 и знак «>»', () => {
    expect(labFieldEntry('>1000')).toEqual({ value: 1000, bound: '>' });
    expect(labFieldEntry('> 1 000')).toEqual({ value: 1000, bound: '>' });
  });

  it('«<0.5» и «≤30» — знак «<»', () => {
    expect(labFieldEntry('<0.5')).toEqual({ value: 0.5, bound: '<' });
    expect(labFieldEntry('≤30')).toEqual({ value: 30, bound: '<' });
  });

  it('«>=1000» — та же граница, а не потерянная запись', () => {
    expect(labFieldNumber('>=1000')).toBe(1000);
    expect(labFieldEntry('>=1000')).toEqual({ value: 1000, bound: '>' });
  });

  it('«5,5» читается как 5.5, а не как 5', () => {
    expect(labFieldEntry('5,5')).toEqual({ value: 5.5 });
  });

  it('полоска «1+» — не число', () => {
    expect(labFieldEntry('1+')).toBeUndefined();
    expect(labFieldEntry('++')).toBeUndefined();
  });

  it('пустое поле — не запись', () => {
    expect(labFieldEntry('')).toBeUndefined();
    expect(labFieldEntry('   ')).toBeUndefined();
    expect(labFieldEntry(undefined)).toBeUndefined();
  });
});

describe('проход 155: одна таблица причин «числа нет»', () => {
  it('полоска, следы, «отр.», прочерк — причины различаются', () => {
    expect(labFieldUnreadReason('1+')).toContain('полоска');
    expect(labFieldUnreadReason('следы')).toContain('следы');
    expect(labFieldUnreadReason('отр.')).toContain('отрицательно');
    expect(labFieldUnreadReason('—')).toContain('прочерк');
    expect(labFieldUnreadReason('повышен')).toContain('не число');
  });

  it('каждая причина — про запись, а не про «норму»', () => {
    for (const raw of ['1+', 'следы', 'отр.', 'повышен', '—']) {
      expect(labFieldUnreadReason(raw)).not.toMatch(/в норме/i);
    }
  });
});
