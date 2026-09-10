/**
 * arm-cycle-picker.test.tsx — живой подбор именного цикла карточками.
 *
 * Весь каталог rankArmCycles в пикере поверх шита (шит и мост из библиотеки целы):
 * рендер пикера + фаз-полос, клик ставит цикл, повторный — сбрасывает.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';
import { rankArmCycles } from '../../../../engines/arm/arm-cycle-selector.engine';
import { ARM_CYCLE_LIBRARY } from '../../../../engines/arm/arm-cycle-library.engine';

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
  it('показывает ВЕСЬ каталог с фаз-полосами недель, топ-3 со звёздами', () => {
    const { container } = render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    const picker = container.querySelector("[data-arm='cycle-picker']");
    expect(picker, 'picker').not.toBeNull();
    expect(picker!.querySelectorAll('.ad-split').length).toBe(ARM_CYCLE_LIBRARY.length);
    const phases = picker!.querySelectorAll("[data-arm='cycle-phases'] .ad-ph");
    expect(phases.length, 'phase blocks').toBeGreaterThan(0);
    for (const b of Array.from(phases)) {
      expect(b.getAttribute('data-phase')).toBeTruthy();
    }
    for (const star of ['★1', '★2', '★3']) {
      expect(picker!.textContent).toContain(star);
    }
  });

  it('клик по карточке ставит недели цикла (exact-fit без согласия)', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    fireEvent.click(screen.getByRole('button', { name: /Именной цикл/ }));
    const top = rankArmCycles({ ...BASE })[0].cycle;
    fireEvent.click(screen.getByRole('button', { name: `Цикл ${top.name}` }));
    fireEvent.click(screen.getByRole('button', { name: '🎛 Параметры' }));
    expect((screen.getByLabelText('Недель') as HTMLInputElement).value).toBe(String(top.weeks));
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

  it('шит и пикер покрывают всю библиотеку (19)', () => {
    const { container } = render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    const dlg = openCycleSheet();
    const opts = within(dlg).getAllByRole('button').filter((b) => b.textContent !== 'Готово');
    expect(opts.length).toBe(20);
    expect(container.querySelectorAll("[data-arm='cycle-picker'] .ad-split").length).toBe(ARM_CYCLE_LIBRARY.length);
  });

  it('шит — портал в body: fixed строго по вьюпорту, не в карточке', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    const dlg = openCycleSheet();
    const portal = dlg.closest('[data-arm="sheet-portal"]');
    expect(portal, 'portal wrapper').not.toBeNull();
    expect(portal!.parentElement).toBe(document.body);
    // вне фильтрованных предков: ближайший .ad-card/.ad-steps — только портал-скоуп
    expect(dlg.closest('.ad-card')).toBeNull();
  });

  it('выбор из шита ставит цикл ( Toproll )', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
    const dlg = openCycleSheet();
    fireEvent.click(within(dlg).getByText(/Toproll 6-week/));
    expect(screen.getByRole('button', { name: /Цикл: Toproll 6-week/ }), 'sheet synced').toBeTruthy();
  });
});
