/**
 * arm-wizard-nav.test.tsx — визард 5 шагов: порядок, «Далее/Назад»,
 * слияние сплит+цикл и план+проверка в одни шаги.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';

beforeEach(() => {
  localStorage.clear();
});

function go(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('Arm wizard navigation', () => {
  it('5 шагов в порядке, маркеры на местах', () => {
    const { container } = render(<ArmAutoConstructor />);
    const steps = container.querySelectorAll("[data-arm='steps'] .ad-step");
    expect(Array.from(steps).map((s) => s.textContent)).toEqual([
      '1🎛 Параметры',
      '2🎯 Атлет',
      '3✊ Стол и хват',
      '4📚 Сплит и цикл',
      '5📋 План и проверка',
    ]);
    expect(document.body.textContent).toContain('Дисциплина');
    expect(container.querySelector("[data-arm='steps']")?.getAttribute('aria-label')).toBe('Шаги');
  });

  it('«Далее/Назад» ведут по цепочке params → athlete → grip', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByText('Далее: Атлет →'));
    expect(document.body.textContent).toContain('Слабые зоны');
    fireEvent.click(screen.getByText('Далее: Стол и хват →'));
    expect(document.body.textContent).toContain('Хват — диагностика');
    expect(document.body.textContent).toContain('TOP: матчап');
    fireEvent.click(screen.getByText('← Назад'));
    expect(document.body.textContent).toContain('Слабые зоны');
  });

  it('сплит и цикл — один шаг: пикер, селект и сборка рядом', () => {
    const { container } = render(<ArmAutoConstructor />);
    go('📚 Сплит и цикл');
    expect(container.querySelector("[data-arm='split-list']")).not.toBeNull();
    expect(container.querySelector("[data-arm='cycle-picker']")).not.toBeNull();
    expect(screen.getByDisplayValue('— обычный план —')).toBeTruthy();
    expect(screen.getByText('⚡ Собрать план')).toBeTruthy();
  });

  it('план и проверка — один шаг: дашборд, гейты, веса', () => {
    const { container } = render(<ArmAutoConstructor />);
    go('📚 Сплит и цикл');
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    expect(container.querySelector("[data-arm='plan-dash']")).not.toBeNull();
    expect(container.querySelector("[data-arm='gates']")).not.toBeNull();
    expect(container.querySelector("[data-arm='weights-card']")).not.toBeNull();
    expect(document.body.textContent).toContain('Тепловая карта');
  });

  it('пустой план — только карточка-мост, гейтов нет', () => {
    const { container } = render(<ArmAutoConstructor />);
    go('📋 План и проверка');
    expect(document.body.textContent).toContain('План не собран');
    expect(container.querySelector("[data-arm='gates']")).toBeNull();
    expect(container.querySelector("[data-arm='weights-card']")).toBeNull();
  });
});
