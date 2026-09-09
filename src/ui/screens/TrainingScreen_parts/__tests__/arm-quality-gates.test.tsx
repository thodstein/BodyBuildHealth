/**
 * arm-quality-gates.test.tsx — сплит-превью ротации + гейты качества.
 *
 * Ротация дней в карточках сплита; валидация планом — карточками гейтов
 * (humerus/UCL/плечо/tendon всегда, остальные — при наличии), строки
 * предупреждений дословно.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';

beforeEach(() => {
  localStorage.clear();
});

function goSplit() {
  const c = render(<ArmAutoConstructor />);
  fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
  return c.container;
}

function goQuality() {
  const c = render(<ArmAutoConstructor />);
  fireEvent.click(screen.getByRole('button', { name: '📚 Сплит и цикл' }));
  fireEvent.click(screen.getByText('⚡ Собрать план'));
  fireEvent.click(screen.getByRole('button', { name: '🏋️ Веса и качество' }));
  return c.container;
}

describe('Arm split rotation preview', () => {
  it('каждая карточка показывает полосу ротации', () => {
    const container = goSplit();
    const strips = container.querySelectorAll("[data-arm='split-rot']");
    expect(strips.length).toBeGreaterThan(0);
    for (const s of Array.from(strips)) {
      expect(s.children.length, 'rotation days').toBeGreaterThan(0);
    }
  });

  it('тренировки подписаны, отдых — точками', () => {
    const container = goSplit();
    expect(container.textContent).toMatch(/Стол|Хват|Поддержка/);
    expect(container.querySelectorAll('.ad-rot').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.ad-rest').length).toBeGreaterThan(0);
  });
});

describe('Arm quality gates', () => {
  it('4 гарда всегда на месте + корень гейтов', () => {
    const container = goQuality();
    expect(container.querySelector("[data-arm='gates']"), 'gates').not.toBeNull();
    for (const k of ['humerus', 'ucl', 'shoulder', 'tendon']) {
      const card = container.querySelector(`[data-arm='gate-${k}']`);
      expect(card, k).not.toBeNull();
      expect(card!.textContent).toMatch(/чисто|· \d+/);
    }
  });

  it('предупреждения рендерятся дословно finding-строками', () => {
    const container = goQuality();
    const gates = container.querySelector("[data-arm='gates']")!;
    const findings = gates.querySelectorAll('.ad-finding');
    const warns = Array.from(gates.querySelectorAll("[data-arm^='gate-']")).length;
    expect(warns).toBeGreaterThan(0);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of Array.from(findings)) {
      expect(f.getAttribute('data-level')).toBeTruthy();
      expect(f.textContent!.length).toBeGreaterThan(3);
    }
  });

  it('тепловая карта и сводка на месте', () => {
    const container = goQuality();
    expect(container.textContent).toContain('Тепловая карта');
    expect(container.textContent).toMatch(/Фазы|Объём/);
  });
});
