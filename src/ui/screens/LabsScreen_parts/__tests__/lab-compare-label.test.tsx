/**
 * lab-compare-label.test.tsx — проход 144: «было → стало» не выдаёт обрезанные
 * числа за измерение.
 *
 * Подпись в предпросмотре импорта собиралась из чисел в бланке: «>800 → >1000»
 * печаталось как «↑ … (+25%)». Ни направления, ни процента запись не
 * доказывает, поэтому у любой границы остаются только сами значения со знаком.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import { LabCompareLabel } from '../LabCompareLabel';

afterEach(cleanup);

const draw = (existing: any, next: any) =>
  render(React.createElement(LabCompareLabel, { existing, next }));

describe('проход 144: подпись сравнения', () => {
  it('точные числа: стрелка и процент', () => {
    const { container } = draw({ value: 40 }, { value: 50 });
    expect(container.textContent).toBe('↑ 40 → 50 (+25%)');
    expect(container.querySelector('[data-lab-compare]')?.getAttribute('data-lab-compare')).toBe('↑');
  });

  it('обрезанные: значения со знаком, без стрелки и процента', () => {
    const { container } = draw({ value: 800, bound: '>' }, { value: 1000, bound: '>' });
    expect(container.textContent).toBe('>800 → >1000');
    expect(container.textContent).not.toContain('%');
    expect(container.textContent).not.toContain('↑');
    expect(container.querySelector('[data-lab-compare]')?.getAttribute('data-lab-compare')).toBe('unknown');
  });

  it('граница у новой записи тоже снимает вывод', () => {
    const { container } = draw({ value: 800 }, { value: 1000, bound: '<' });
    expect(container.textContent).toBe('800 → <1000');
  });
});
