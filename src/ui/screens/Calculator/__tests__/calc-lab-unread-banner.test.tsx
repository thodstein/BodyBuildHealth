/**
 * calc-lab-unread-banner.test.tsx — проход 141: калькулятор говорит вслух, что в
 * поле записано не число.
 *
 * Пустая ячейка и ячейка с «повышен» для расчёта одинаковы — обе не читаются, — но
 * человек видит заполненное поле и считает показатель учтённым. Баннер
 * `data-lab-unread` называет такие поля и причину, чтобы «нет числа» не выглядело
 * как «в норме».
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import { AutoCalculator } from '../AutoCalculator';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const seed = (slice: any) =>
  localStorage.setItem('he_autocalc_state', JSON.stringify({
    labs: { preCourse: null, midCourse: null, postPCT: null, fullPanel: slice },
  }));

const draw = () => render(React.createElement(AutoCalculator, { embedded: true, onApply: () => {} } as any));

describe('проход 141: «Запись без числа» в калькуляторе', () => {
  it('текст в поле АЛТ называется вслух, вместе с причиной', () => {
    seed({ date: '2026-11-01', panelBiochem: { ALT: 'повышен' } });
    const { container } = draw();
    expect(container.querySelector('[data-lab-unread]')).toBeTruthy();
    const row = container.querySelector('[data-lab-unread-field="panelBiochem|ALT"]');
    expect(row?.textContent).toContain('повышен');
    expect(container.textContent).toContain('не число');
    // И это не «в норме»: текст прямо говорит, что для расчёта поле пустое.
    expect(container.textContent).toMatch(/незаполненное/);
  });

  it('число и граница — без пометки', () => {
    seed({ date: '2026-11-01', panelBiochem: { ALT: '45' }, panelIron: { Ferritin: '>1 000' } });
    const { container } = draw();
    expect(container.querySelector('[data-lab-unread]')).toBeNull();
  });

  it('поле без шкалы не задваивается: только баннер прохода 140', () => {
    seed({ date: '2026-11-01', panelTumor: { CEA: '1.1' }, panelUrinalysis: { Nitrite: 'отр.' } });
    const { container } = draw();
    expect(container.querySelector('[data-lab-unused]')).toBeTruthy();
    expect(container.querySelector('[data-lab-unread]')).toBeNull();
  });

  it('полоска белка мочи — «Запись без числа», а не белок крови', () => {
    seed({ date: '2026-11-01', panelUrinalysis: { Protein: '1+' } });
    const { container } = draw();
    const row = container.querySelector('[data-lab-unread-field="panelUrinalysis|Protein"]');
    expect(row?.textContent).toContain('полоска');
  });
});
