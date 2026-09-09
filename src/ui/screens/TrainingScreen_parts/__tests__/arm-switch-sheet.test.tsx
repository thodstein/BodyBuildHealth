/**
 * arm-switch-sheet.test.tsx — свитчи вместо галочек + шиты вместо селектов.
 *
 * role=switch с aria-checked; шит открывается диалогом, выбор ставит
 * значение, Escape/бэкдроп закрывают; русские подписи на месте.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';

beforeEach(() => {
  localStorage.clear();
});

function go(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
}

function openSec(re: RegExp) {
  const head = screen.getAllByRole('button', { name: re }).find((b) => b.getAttribute('aria-expanded') != null);
  expect(head).toBeTruthy();
  if (head && head.getAttribute('aria-expanded') === 'false') fireEvent.click(head);
}

describe('Arm switch', () => {
  it('тоггл меняет aria-checked и data-on', () => {
    render(<ArmAutoConstructor />);
    go('🎯 Атлет');
    const sw = screen.getByRole('switch', { name: /Специализация/ });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(sw.getAttribute('data-on')).toBe('true');
  });

  it('свитч в свёрнутом аккордеоне раскрывает поля', () => {
    render(<ArmAutoConstructor />);
    go('🎯 Атлет');
    openSec(/На курсе \(PED\)/);
    flipSwitch(/💉 На курсе \(PED\)/);
    expect(screen.getByText('Интенсивность курса')).toBeTruthy();
  });

  it('нативных чекбоксов в конструкторе не осталось', () => {
    const { container } = render(<ArmAutoConstructor />);
    go('🎯 Атлет');
    expect(container.querySelectorAll("input[type='checkbox']").length).toBe(0);
  });
});

function flipSwitch(nameRe: RegExp) {
  fireEvent.click(screen.getByRole('switch', { name: nameRe }));
}

describe('Arm sheet select', () => {
  it('открытие, выбор, закрытие', () => {
    render(<ArmAutoConstructor />);
    go('📚 Сплит и цикл');
    openSec(/Именной цикл/);
    fireEvent.click(screen.getByRole('button', { name: /^Цикл:/ }));
    const dlg = screen.getByRole('dialog', { name: 'Цикл' });
    expect(within(dlg).getByText(/Toproll 6-week/)).toBeTruthy();
    fireEvent.click(within(dlg).getByText(/Toproll 6-week/));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /Цикл: Toproll 6-week/ })).toBeTruthy();
  });

  it('Escape и бэкдроп закрывают без выбора', () => {
    render(<ArmAutoConstructor />);
    go('📚 Сплит и цикл');
    openSec(/Именной цикл/);
    fireEvent.click(screen.getByRole('button', { name: /^Цикл:/ }));
    expect(screen.getByRole('dialog', { name: 'Цикл' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Цикл:/ }));
    fireEvent.click(document.querySelector('.ad-sheet-backdrop')!);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Цикл: — обычный план —' })).toBeTruthy();
  });

  it('русские подписи шитов и фокусов', () => {
    render(<ArmAutoConstructor />);
    go('✊ Стол и хват');
    expect(document.body.textContent).toContain('Хаб');
    expect(document.body.textContent).not.toContain('High-hand');
    go('🎯 Атлет');
    openSec(/На курсе \(PED\)/);
    flipSwitch(/💉 На курсе \(PED\)/);
    expect(document.body.textContent).not.toContain('Enhanced');
  });
});
