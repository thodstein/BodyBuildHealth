/**
 * lab-ratio-percent.test.ts — проход 144: «доля от нормы» у обрезанного числа
 * не печатается.
 *
 * Предпросмотр импорта показывал «>1000 нг/мл (250%)»: доля считалась из числа
 * в бланке, хотя «>1000» — «не меньше 1000». Точный процент рядом со знаком
 * читался как измерение. Правило одно: есть граница — подписи нет.
 */
import { describe, it, expect } from 'vitest';
import { ratioPercentLabel } from '../labs-mapping';

describe('проход 144: доля от нормы', () => {
  it('точное число — процент как раньше', () => {
    expect(ratioPercentLabel(2.5)).toBe(' (250%)');
    expect(ratioPercentLabel(0)).toBe(' (0%)');
  });

  it('обрезанное число — подписи нет', () => {
    expect(ratioPercentLabel(2.5, '>')).toBe('');
    expect(ratioPercentLabel(2.5, '<')).toBe('');
  });

  it('доля неизвестна — подписи нет', () => {
    expect(ratioPercentLabel(null)).toBe('');
    expect(ratioPercentLabel(undefined)).toBe('');
  });
});
