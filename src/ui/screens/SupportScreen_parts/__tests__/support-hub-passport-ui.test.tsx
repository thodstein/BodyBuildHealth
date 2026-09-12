/**
 * support-hub-passport-ui.test.tsx — UI-smoke P7: паспорт рендерится,
 * хаб переключается в 6-й режим, поиск строит карточку вещества.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { SupportSubstancePassport } from '../SupportSubstancePassport';
import { SupportCalcToolsHub } from '../SupportCalcToolsHub';

describe('P7 паспорт UI', () => {
  it('паспорт рендерится с поиском', () => {
    const { container, unmount } = render(<SupportSubstancePassport />);
    expect(container.textContent || '').toMatch(/Паспорт вещества/);
    expect(container.querySelector('input')).toBeTruthy();
    unmount();
  });

  it('хаб: бейдж 6 в 1 + переход в паспорт', () => {
    const { container, unmount } = render(<SupportCalcToolsHub s={{}} />);
    expect(container.textContent || '').toMatch(/6 в 1/);
    const pill = Array.from(container.querySelectorAll('button')).find(b => (b.textContent || '').includes('Паспорт'));
    expect(pill).toBeTruthy();
    fireEvent.click(pill!);
    expect(container.textContent || '').toMatch(/Паспорт вещества/);
    unmount();
  });

  it('поиск магния строит карточку паспорта', () => {
    const { container, unmount } = render(<SupportSubstancePassport />);
    const input = container.querySelector('input')!;
    fireEvent.change(input, { target: { value: 'магний' } });
    const hit = Array.from(container.querySelectorAll('div')).find(
      d => d.textContent && /\(magnesium/.test(d.textContent) && (d as HTMLElement).onclick !== undefined,
    );
    // кликаем по первому результату выдачи (текст содержит id в скобках)
    const cand = Array.from(container.querySelectorAll('div')).find(d =>
      /Магний.*\(magnesium/.test(d.textContent || '') && (d.children.length === 0 || (d.textContent || '').length < 60),
    );
    expect(cand || hit).toBeTruthy();
    fireEvent.click((cand || hit) as Element);
    expect(container.textContent || '').toMatch(/Доказательность|Био:/);
    unmount();
  });
});
