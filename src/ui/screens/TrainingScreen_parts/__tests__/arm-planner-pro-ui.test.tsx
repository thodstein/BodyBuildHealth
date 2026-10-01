/**
 * arm-planner-pro-ui.test.tsx — PRO-PLAN поверхность арм-конструктора:
 * стиль прогрессии, мульти-старты (маркеры недель), база-якорь (LegsCore), CSV.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';

beforeEach(() => {
  localStorage.clear();
});

function openPlanSec() {
  fireEvent.click(screen.getByRole('button', { name: '4 Сплит и цикл' }));
  const head = screen.getAllByRole('button', { name: /Периодизация и старты/ }).find((b) => b.getAttribute('aria-expanded') != null);
  expect(head, 'секция периодизации').toBeTruthy();
  if (head && head.getAttribute('aria-expanded') === 'false') fireEvent.click(head);
}

describe('Arm PRO-PLAN UI', () => {
  it('секция «Периодизация и старты»: стили прогрессии выбираются', () => {
    render(<ArmAutoConstructor />);
    openPlanSec();
    const chips = document.querySelectorAll('[data-arm="prog-style"] .ad-chip');
    expect(chips.length).toBe(4);
    const dbl = Array.from(chips).find((c) => c.textContent?.includes('Двойная'))!;
    fireEvent.click(dbl);
    expect(dbl.getAttribute('data-active')).toBe('true');
    expect(document.body.textContent).toContain('повторы +1/нед в блоке');
  });

  it('старт добавляется в список и показывает окно тейпера', () => {
    render(<ArmAutoConstructor />);
    openPlanSec();
    fireEvent.change(screen.getByLabelText('Неделя старта'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'A · главный' }));
    fireEvent.click(screen.getByRole('button', { name: '＋ Добавить старт' }));
    const list = document.querySelector('[data-arm="peak-list"]')!;
    expect(list.textContent).toContain('Н6');
    expect(list.textContent).toContain('главный');
    const notes = document.querySelectorAll('[data-arm="peak-note"]');
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0].textContent).toContain('🏁');
  });

  it('старт невалидной недели не добавляется', () => {
    render(<ArmAutoConstructor />);
    openPlanSec();
    fireEvent.change(screen.getByLabelText('Неделя старта'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: '＋ Добавить старт' }));
    expect(document.querySelector('[data-arm="peak-list"]')).toBeNull();
  });

  it('план с стартом и якорем: маркер недели, LegsCore, CSV-кнопка', () => {
    const { container } = render(<ArmAutoConstructor />);
    // недели 10 → окно старта Н6 целиком внутри плана
    fireEvent.click(screen.getByRole('button', { name: '1 Параметры' }));
    fireEvent.change(screen.getByLabelText('Недель'), { target: { value: '10' } });
    openPlanSec();
    fireEvent.change(screen.getByLabelText('Неделя старта'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'A · главный' }));
    fireEvent.click(screen.getByRole('button', { name: '＋ Добавить старт' }));
    fireEvent.click(screen.getByRole('switch', { name: /База-якорь/ }));
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    // план: неделя 1 с якорем
    expect(document.body.textContent).toContain('LegsCore');
    // маркер старта на пилюле недели 6
    const pill6 = container.querySelector('button[aria-label*="старт A"]');
    expect(pill6, 'пилюля старта').not.toBeNull();
    fireEvent.click(pill6!);
    const peakNote = container.querySelector('[data-arm="week-peak"]');
    expect(peakNote?.textContent).toContain('Старт (A)');
    // CSV-кнопка в экспорте
    fireEvent.click(screen.getByRole('button', { name: '📤 Экспорт' }));
    const csv = container.querySelector('[data-arm="export-csv"]');
    expect(csv, 'CSV-кнопка').not.toBeNull();
    expect((csv as HTMLButtonElement).disabled).toBe(false);
  });
});
