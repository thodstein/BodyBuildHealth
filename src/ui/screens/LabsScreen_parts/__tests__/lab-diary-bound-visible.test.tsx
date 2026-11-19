/**
 * lab-diary-bound-visible.test.tsx — проход 142: дневник показывает знак
 * границы и не красит «неизвестно» в зелёный.
 *
 * Дневник получал из склада только число, поэтому «Ферритин >1000» в истории и
 * в карточке аномалии выглядел точным измерением, а маркер без нормы в реестре —
 * зелёным «в норме». Теперь значение печатается по общему правилу
 * (`labValueLabel`), а нейтральный цвет значит «сторона не доказана».
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { LabDiaryTab } from '../LabDiaryTab';

const seed = () => localStorage.setItem('he_lab_diary', JSON.stringify([{
  date: '2026-11-01',
  totalMarkers: 3,
  abnormalCount: 1,
  markers: [
    { code: 'FERRITIN', name: 'Ферритин', value: 1000, unit: 'нг/мл', lln: 30, uln: 400, bound: '>', inRange: false },
    { code: 'ALT', name: 'АЛТ', value: 30, unit: 'Ед/л', lln: 0, uln: 41, inRange: true },
    { code: 'CEA', name: 'РЭА', value: 1.1, unit: 'нг/мл', inRange: undefined },
  ],
}]));

beforeEach(() => {
  localStorage.clear();
  seed();
});
afterEach(cleanup);

const draw = () => render(React.createElement(LabDiaryTab, { labs: [] } as any));

describe('проход 142: история дневника', () => {
  it('печатает «>1000», а не 1000', () => {
    const { container } = draw();
    fireEvent.click(screen.getByText(/📋 История/));
    const out = container.querySelector('[data-range="out"]');
    expect(out?.textContent).toContain('>1000');
    // В норме — только доказанное; маркер без нормы нейтрален, а не зелёный.
    expect(container.querySelector('[data-range="in"]')?.textContent).toContain('АЛТ');
    expect(container.querySelector('[data-range="unknown"]')?.textContent).toContain('РЭА');
  });
});

describe('проход 142: карточка аномалии', () => {
  it('называет значение со знаком', () => {
    const { container } = draw();
    fireEvent.click(screen.getByText(/⚠ Аномалии/));
    expect(container.textContent).toContain('Ферритин');
    expect(container.textContent).toContain('>1000');
    // Число без знака рядом не печатается — иначе знак теряется.
    expect(screen.queryByText(/^1000 нг\/мл$/)).toBeNull();
  });
});

describe('проход 160: правка значения доезжает до экрана', () => {
  // Раньше авто-импорт обновлял экран, только если менялось ЧИСЛО ДНЕЙ: правка
  // значения в тот же день не доезжала до истории до перемонтирования вкладки.
  const lab = (value: number) => ({ id: 'g1', code: 'GGT', name: 'ГГТ', value, unit: 'Ед/л', date: '2026-11-02' });
  const ggtRow = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[data-range="in"]')).find(el => (el.textContent || '').includes('ГГТ'));

  it('перерисовка с тем же днём обновляет число', () => {
    const { container, rerender } = render(React.createElement(LabDiaryTab, { labs: [lab(30)] } as any));
    fireEvent.click(screen.getByText(/📋 История/));
    expect(ggtRow(container)?.textContent).toContain('30');
    rerender(React.createElement(LabDiaryTab, { labs: [lab(35)] } as any));
    expect(ggtRow(container)?.textContent).toContain('35');
  });
});
