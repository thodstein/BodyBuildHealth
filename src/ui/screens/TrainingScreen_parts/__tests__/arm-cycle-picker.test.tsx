/**
 * arm-cycle-picker.test.tsx — живой подбор именного цикла карточками.
 *
 * Топ-3 rankArmCycles поверх селекта (селект и мост из библиотеки целы):
 * рендер пикера + фаз-полос, клик ставит цикл, повторный — сбрасывает.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';
import { rankArmCycles } from '../../../../engines/arm/arm-cycle-selector.engine';

function openCycleSheet() {
  const head = screen.getAllByRole('button', { name: /Именной цикл/ }).find((b) => b.getAttribute('aria-expanded') != null);
  if (head && head.getAttribute('aria-expanded') === 'false') fireEvent.click(head);
  fireEvent.click(screen.getByRole('button', { name: /^Цикл:/ }));
  return screen.getByRole('dialog', { name: 'Цикл' });
}

beforeEach(() => {
  localStorage.clear();
});

const BASE = { discipline: 'armwrestling', level: 'intermediate', goal: 'strength', weeks: 8, daysPerWeek: 4, gripFocus: 'support' } as const;

describe('Arm cycle picker', () => {
  it('показывает топ-3 с фаз-полосами недель', () => {
    const { container } = render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    const picker = container.querySelector("[data-arm='cycle-picker']");
    expect(picker, 'picker').not.toBeNull();
    expect(picker!.querySelectorAll('.ad-split').length).toBe(3);
    const phases = picker!.querySelectorAll("[data-arm='cycle-phases'] .ad-ph");
    expect(phases.length, 'phase blocks').toBeGreaterThan(0);
    for (const b of Array.from(phases)) {
      expect(b.getAttribute('data-phase')).toBeTruthy();
    }
  });

  it('клик по карточке ставит цикл в шит и подсвечивает', () => {
    const { container } = render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    fireEvent.click(screen.getByRole('button', { name: /Именной цикл/ }));
    const top = rankArmCycles({ ...BASE })[0].cycle;
    fireEvent.click(screen.getByRole('button', { name: `Цикл ${top.name}` }));
    expect(screen.getByRole('button', { name: `Цикл: ${top.name} (${top.weeks}н)` }), 'sheet synced').toBeTruthy();
    const picker = container.querySelector("[data-arm='cycle-picker']")!;
    const active = Array.from(picker.querySelectorAll('.ad-split')).filter((el) =>
      el.getAttribute('data-active') === 'true',
    );
    expect(active.length).toBe(1);
  });

  it('повторный клик сбрасывает в обычный план', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    fireEvent.click(screen.getByRole('button', { name: /Именной цикл/ }));
    const top = rankArmCycles({ ...BASE })[0].cycle;
    const btn = screen.getByRole('button', { name: `Цикл ${top.name}` });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.getByRole('button', { name: 'Цикл: — обычный план —' }), 'reset').toBeTruthy();
  });

  it('шит покрывает всю библиотеку (19), пикер — только топ-3', () => {
    const { container } = render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    const dlg = openCycleSheet();
    const opts = within(dlg).getAllByRole('button').filter((b) => b.textContent !== 'Готово');
    expect(opts.length).toBe(20);
    expect(container.querySelectorAll("[data-arm='cycle-picker'] .ad-split").length).toBe(3);
  });

  it('выбор из шита ставит цикл ( Toproll )', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    const dlg = openCycleSheet();
    fireEvent.click(within(dlg).getByText(/Toproll 6-week/));
    expect(screen.getByRole('button', { name: /Цикл: Toproll 6-week/ }), 'sheet synced').toBeTruthy();
  });
});
