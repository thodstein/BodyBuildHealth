/**
 * ss-kit-top.test.tsx — TOP-норма кита: тач-таргеты, тоглы, EventCard.
 *
 * BTN_SMALL ≥44px; ChipToggle — aria-pressed + data-active + класс слоя;
 * EventCard считает дистанцию/cap медли.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BTN_SMALL, ChipToggle, EventCard } from '../StrengthUI';

describe('SS kit TOP norms', () => {
  it('BTN_SMALL держит тач-норму 44px', () => {
    expect(BTN_SMALL.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('ChipToggle: пресс, активность и хук слоя', () => {
    const fn = () => {};
    const { container, rerender } = render(<ChipToggle active={false} onClick={fn}>Штанга</ChipToggle>);
    const btn = screen.getByRole('button', { name: 'Штанга' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(btn.classList.contains('kit-chiptoggle')).toBe(true);
    fireEvent.click(btn);
    rerender(<ChipToggle active onClick={fn}>Штанга</ChipToggle>);
    expect(container.querySelector(".kit-chiptoggle[data-active='true']")).not.toBeNull();
  });

  it('EventCard: итоги медли в подзаголовке', () => {
    const { container } = render(
      <EventCard
        events={[
          { id: 'yoke_walk', label: 'Йок', distanceM: 20, timeCapS: 60 },
          { id: 'farmers_walk_heavy', label: 'Фермер', distanceM: 40, timeCapS: 60 },
        ]}
      />,
    );
    expect(container.textContent).toContain('60м');
    expect(container.textContent).toContain('cap');
  });
});
