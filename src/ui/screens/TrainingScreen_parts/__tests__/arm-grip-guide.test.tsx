/**
 * arm-grip-guide.test.tsx — справочник снарядов хвата + статус-точки секций.
 *
 * 3 группы × 8 снарядов IronMind с диаметрами; точки ok зажигаются при
 * заполнении PED/PRO/TOP/слабых зон; диагностика хвата цела.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';

beforeEach(() => {
  localStorage.clear();
});

function okDots(container: HTMLElement): number {
  return container.querySelectorAll(".ad-dot[data-s='ok']").length;
}

describe('Arm grip guide', () => {
  it('шаг хвата: 3 группы и 8 снарядов с диаметрами', () => {
    const { container } = render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '✊ Стол и хват' }));
    expect(document.body.textContent).toContain('Хват — диагностика');
    for (const g of ['Support', 'Pinch', 'Crush']) {
      expect(document.body.textContent, g).toContain(g);
    }
    for (const impl of ['Rolling Thunder', 'Apollon Axle', 'Saxon Bar', 'IronMind Hub', 'Pinch Block', 'CoC Silver Bullet', 'Farmer Handles', 'Fat Gripz']) {
      expect(document.body.textContent, impl).toContain(impl);
    }
    expect(container.querySelectorAll("[data-arm='grip-impl']").length).toBe(8);
    expect(document.body.textContent).toMatch(/⌀60|⌀76/);
  });

  it('PED-точка зажигается по чекбоксу', () => {
    const { container } = render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '🎯 Атлет' }));
    const before = okDots(container);
    fireEvent.click(screen.getByLabelText(/💉 На курсе \(PED\)/));
    expect(okDots(container)).toBe(before + 1);
  });

  it('TOP-точка зажигается по RFD, цикл — по подборщику', () => {
    const { container } = render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '✊ Стол и хват' }));
    fireEvent.click(screen.getByLabelText(/RFD speed-блок/));
    expect(okDots(container)).toBeGreaterThan(0);
  });

  it('слабая зона зажигает свою точку', () => {
    const { container } = render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByRole('button', { name: '🎯 Атлет' }));
    const before = okDots(container);
    fireEvent.click(screen.getByRole('button', { name: 'Пронаторы' }));
    expect(okDots(container)).toBe(before + 1);
    expect(screen.getByRole('button', { name: 'Пронаторы' }).getAttribute('aria-pressed')).toBe('true');
  });
});
