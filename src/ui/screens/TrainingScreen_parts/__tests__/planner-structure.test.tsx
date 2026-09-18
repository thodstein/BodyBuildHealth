/**
 * planner-structure.test.tsx — PLANNERS-STRUCTURE-PRO (P2/P4).
 * Плотный каркас: скрытое = null (не display:none), вторичное закрыто,
 * первичное открыто, шаги ходят «Далее/Назад». ПЛ/ручной/кардио не трогаем.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmAutoConstructor } from '../ArmAutoConstructor';
import { PlannerFold } from '../planner-ui';

beforeEach(() => {
  localStorage.clear();
});

describe('planner-ui kit', () => {
  it('закрытый Fold не монтирует тел (null, не display:none)', () => {
    const { container } = render(
      <PlannerFold title="Вторичное" defaultOpen={false} summary="сводка">
        <span data-testid="fold-body">тело</span>
      </PlannerFold>
    );
    // BB-эталон: закрытое = null (не display:none) — пустот нет
    expect(container.querySelector('[data-testid="fold-body"]')).toBeNull();
    expect(container.innerHTML).not.toContain('display:none');
    fireEvent.click(screen.getByRole('button', { name: /Вторичное/ }));
    expect(container.querySelector('[data-testid="fold-body"]')).not.toBeNull();
  });

  it('открытый Fold показывает тело сразу', () => {
    const { container } = render(
      <PlannerFold title="Первичное" defaultOpen>
        <span data-testid="fold-open-body">тело</span>
      </PlannerFold>
    );
    expect(container.querySelector('[data-testid="fold-open-body"]')).not.toBeNull();
  });
});

describe('arm planner structure', () => {
  it('8 шагов, первичная секция открыта, вторичная схлопнута без пустот и display:none', () => {
    const { container } = render(<ArmAutoConstructor />);
    const steps = container.querySelectorAll("[data-arm='steps'] .ad-step");
    expect(steps.length).toBe(8);
    // Первичное: параметры видны сразу
    expect(document.body.textContent).toContain('Дисциплина');
    // Вторичное схлопнуто: ни одного тела с display:none
    const bodies = container.querySelectorAll('.ad-sec-body');
    const displayNone = Array.from(bodies).filter(
      (el) => (el as HTMLElement).style.display === 'none'
    );
    expect(displayNone.length).toBe(0);
    // Схлопнутое тело нулевой высоты: включаем армлифтинг (хват-фокус) и проверяем collapsed
    fireEvent.click(screen.getByText('Армлифтинг'));
    expect(container.querySelector('.ad-sec-body[data-collapsed="true"]')).not.toBeNull();
    expect(container.innerHTML).not.toContain('display:none');
  });

  it('шаг Атлет: слабые зоны открыты по умолчанию', () => {
    render(<ArmAutoConstructor />);
    fireEvent.click(screen.getByText('Далее: Атлет →'));
    expect(document.body.textContent).toContain('Слабые зоны');
    // Чипы слабых зон в DOM (секция открыта) — метка из ARM_MUSCLE_RU
    expect(document.body.textContent).toContain('Пронаторы');
  });

  it('навигация «Далее/Назад» без пустот: вторичная панель раскрывается по клику', () => {
    render(<ArmAutoConstructor />);
    // Хват-фокус виден только вне армрестлинга — переключаем дисциплину
    fireEvent.click(screen.getByText('Армлифтинг'));
    const head = screen.getByRole('button', { name: /Хват-фокус/ });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Поддержка (RT/Axle)')).toBeTruthy();
  });
});
