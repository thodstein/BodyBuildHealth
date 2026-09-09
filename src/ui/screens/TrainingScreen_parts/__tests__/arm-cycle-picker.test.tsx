/**
 * arm-cycle-picker.test.tsx — живой подбор именного цикла карточками.
 *
 * Топ-3 rankArmCycles поверх селекта (селект и мост из библиотеки целы):
 * рендер пикера + фаз-полос, клик ставит цикл, повторный — сбрасывает.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';
import { rankArmCycles } from '../../../../engines/arm/arm-cycle-selector.engine';

beforeEach(() => {
  localStorage.clear();
});

const BASE = { discipline: 'armwrestling', level: 'intermediate', goal: 'strength', weeks: 8, daysPerWeek: 4, gripFocus: 'support' } as const;

describe('Arm cycle picker', () => {
  it('показывает топ-3 с фаз-полосами недель', () => {
    const { container } = render(<ArmAutoConstructor />);
    const picker = container.querySelector("[data-arm='cycle-picker']");
    expect(picker, 'picker').not.toBeNull();
    expect(picker!.querySelectorAll('.ad-split').length).toBe(3);
    const phases = picker!.querySelectorAll("[data-arm='cycle-phases'] .ad-ph");
    expect(phases.length, 'phase blocks').toBeGreaterThan(0);
    for (const b of Array.from(phases)) {
      expect(b.getAttribute('data-phase')).toBeTruthy();
    }
  });

  it('клик по карточке ставит цикл в селект и подсвечивает', () => {
    const { container } = render(<ArmAutoConstructor />);
    const top = rankArmCycles({ ...BASE })[0].cycle;
    fireEvent.click(screen.getByRole('button', { name: `Цикл ${top.name}` }));
    expect(screen.getByDisplayValue(`${top.name} (${top.weeks}н)`), 'select synced').toBeTruthy();
    const picker = container.querySelector("[data-arm='cycle-picker']")!;
    const active = Array.from(picker.querySelectorAll('.ad-split')).filter((el) =>
      el.getAttribute('data-active') === 'true',
    );
    expect(active.length).toBe(1);
  });

  it('повторный клик сбрасывает в обычный план', () => {
    render(<ArmAutoConstructor />);
    const top = rankArmCycles({ ...BASE })[0].cycle;
    const btn = screen.getByRole('button', { name: `Цикл ${top.name}` });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.getByDisplayValue('— обычный план —'), 'reset').toBeTruthy();
  });

  it('селект покрывает всю библиотеку (19), пикер — только топ-3', () => {
    const { container } = render(<ArmAutoConstructor />);
    const sel = screen.getByDisplayValue('— обычный план —') as HTMLSelectElement;
    expect(sel.options.length).toBe(20);
    expect(container.querySelectorAll("[data-arm='cycle-picker'] .ad-split").length).toBe(3);
  });
});
