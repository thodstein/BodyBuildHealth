/**
 * arm-wizard-nav.test.tsx — визард 7 шагов в стиле ББ-авто:
 * params → athlete → grip → split → plan → quality → export.
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
  it('7 шагов в порядке, маркеры на местах', () => {
    const { container } = render(<ArmAutoConstructor />);
    const steps = container.querySelectorAll("[data-arm='steps'] .ad-step");
    expect(Array.from(steps).map((s) => s.textContent)).toEqual([
      '1🎛 Параметры',
      '2🎯 Атлет',
      '3✊ Стол и хват',
      '4📚 Сплит и цикл',
      '5📋 План',
      '6🏋️ Веса и качество',
      '7📤 Экспорт',
    ]);
    expect(document.body.textContent).toContain('Дисциплина');
    expect(container.querySelector("[data-arm='steps']")?.getAttribute('aria-label')).toBe('Шаги');
  });

  it('группы ББ-стиля: ПАРАМЕТРЫ / ПЛАН / ВЫДАЧА', () => {
    const { container } = render(<ArmAutoConstructor />);
    const bar = container.querySelector("[data-arm='steps']")!.textContent;
    expect(bar).toContain('ПАРАМЕТРЫ');
    expect(bar).toContain('ПЛАН');
    expect(bar).toContain('ВЫДАЧА');
  });

  it('«Далее/Назад» ведут по цепочке params → athlete → grip → split', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByText('Далее: Атлет →'));
    expect(document.body.textContent).toContain('Слабые зоны');
    fireEvent.click(screen.getByText('Далее: Стол и хват →'));
    expect(document.body.textContent).toContain('Хват — диагностика');
    expect(document.body.textContent).toContain('TOP: матчап');
    fireEvent.click(screen.getByText('← Назад'));
    expect(document.body.textContent).toContain('Слабые зоны');
    fireEvent.click(screen.getByText('Далее: Стол и хват →'));
    fireEvent.click(screen.getByText('Далее: Сплит и цикл →'));
    expect(document.body.textContent).toContain('Выбор сплита');
  });

  it('сплит и цикл — один шаг: пикер, селект и сборка рядом', () => {
    const { container } = render(<ArmAutoConstructor />);
    go('📚 Сплит и цикл');
    expect(container.querySelector("[data-arm='split-list']")).not.toBeNull();
    expect(container.querySelector("[data-arm='cycle-picker']")).not.toBeNull();
    expect(screen.getByDisplayValue('— обычный план —')).toBeTruthy();
    expect(screen.getByText('⚡ Собрать план')).toBeTruthy();
  });

  it('план — только выдача: дашборд и недели, гейтов нет', () => {
    const { container } = render(<ArmAutoConstructor />);
    go('📚 Сплит и цикл');
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    expect(container.querySelector("[data-arm='plan-dash']")).not.toBeNull();
    expect(container.querySelector("[data-arm='gates']")).toBeNull();
    expect(container.querySelector("[data-arm='weights-card']")).toBeNull();
    fireEvent.click(screen.getByText('Далее: Проверка →'));
    expect(container.querySelector("[data-arm='gates']")).not.toBeNull();
    expect(container.querySelector("[data-arm='weights-card']")).not.toBeNull();
    expect(document.body.textContent).toContain('Тепловая карта');
  });

  it('экспорт — печать и обоснование отдельно от плана', () => {
    const { container } = render(<ArmAutoConstructor />);
    go('📚 Сплит и цикл');
    fireEvent.click(screen.getByText('⚡ Собрать план'));
    go('📤 Экспорт');
    expect(screen.getByText('🖨 Печать')).toBeTruthy();
    expect(container.querySelector("[data-arm='rationale']")).not.toBeNull();
  });

  it('пустой план — только карточка-мост, гейтов нет', () => {
    const { container } = render(<ArmAutoConstructor />);
    go('📋 План');
    expect(document.body.textContent).toContain('План не собран');
    expect(container.querySelector("[data-arm='gates']")).toBeNull();
    expect(container.querySelector("[data-arm='weights-card']")).toBeNull();
  });
});
