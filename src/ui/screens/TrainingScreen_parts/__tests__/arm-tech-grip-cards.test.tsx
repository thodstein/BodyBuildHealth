/**
 * arm-tech-grip-cards.test.tsx — bio-результаты карточек техники и хвата.
 *
 * Провал за столом / слабый замер → bio-карточка с приоритетом;
 * «➕ В слабые зоны» отдаёт ≤2 мышц; пусто — честный баланс/подсказка.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArmTechniqueCard } from '../ArmTechniqueCard';
import { ArmGripCard } from '../ArmGripCard';

beforeEach(() => {
  localStorage.clear();
});

describe('ArmTechniqueCard results', () => {
  it('пусто — баланс, без результатов', () => {
    const { container } = render(<ArmTechniqueCard />);
    expect(document.body.textContent).toContain('Слабые звенья не выявлены — баланс.');
    expect(container.querySelector("[data-arm='tech-result']")).toBeNull();
  });

  it('провал даёт bio-карточку с приоритетом и упражнениями', () => {
    const { container } = render(<ArmTechniqueCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Кисть открывается (cup)' }));
    const cards = container.querySelectorAll("[data-arm='tech-result']");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].getAttribute('data-valid')).toBe('warn');
    expect(cards[0].textContent).toContain('приоритет 1');
  });

  it('применение отдаёт максимум 2 мышцы', () => {
    const fn = vi.fn();
    render(<ArmTechniqueCard onApplyWeak={fn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Кисть открывается (cup)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Пальцы уходят (rising)' }));
    fireEvent.click(screen.getByText('➕ В слабые зоны'));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0].length).toBeLessThanOrEqual(2);
  });
});

describe('ArmGripCard results', () => {
  it('пусто — подсказка, слабый RT — bio-карточки', () => {
    const { container } = render(<ArmGripCard />);
    expect(document.body.textContent).toContain('Введи данные для диагностики.');
    fireEvent.change(screen.getByPlaceholderText('60'), { target: { value: '40' } });
    const cards = container.querySelectorAll("[data-arm='grip-result']");
    expect(cards.length).toBeGreaterThan(0);
    expect(container.querySelector("[data-arm='grip-results']")).not.toBeNull();
  });
});
