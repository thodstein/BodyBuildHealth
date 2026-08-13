/**
 * taper-planner-tab.test.tsx — рендер-проверка «вывода в UI»:
 * карточка «Весовая категория» показывает блок НАБОРА до категории,
 * когда текущий вес ниже верхней границы (bw=80 → категория 83).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaperPlannerTab } from '../TaperPlannerTab';

describe('TaperPlannerTab — весовая категория (набор веса)', () => {
  it('рендерит калькулятор и карточку категории', () => {
    render(<TaperPlannerTab />);
    expect(screen.getByText(/Тапер-планер/)).toBeTruthy();
    expect(screen.getByText(/Категория до 83 кг/)).toBeTruthy();
  });

  it('вес ниже категории (80 → 83) → блок «Набор до …» с темпом и профицитом', () => {
    render(<TaperPlannerTab />);
    const gainBlock = screen.getByText(/📈 Набор до 83 кг/);
    expect(gainBlock.textContent).toContain('+3.0 кг');
    expect(gainBlock.textContent).toMatch(/темп \d\.\d кг\/нед/);
    expect(gainBlock.textContent).toMatch(/профицит ≈\d+ ккал\/день/);
  });

  it('при весе ниже категории блок сушки отсутствует', () => {
    render(<TaperPlannerTab />);
    expect(screen.queryByText(/Сушка:/)).toBeNull();
  });
});
