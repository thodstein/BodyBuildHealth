import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeeklyReviewCard } from '../WeeklyReviewCard';

const days = Array.from({ length: 7 }, (_, i) => ({ date: `2026-03-${String(2 + i).padStart(2, '0')}`, kcal: 3000, proteinG: 180 }));

describe('WeeklyReviewCard', () => {
  it('too_slow: кнопка «Применить −150» вызывает колбэк', () => {
    const spy = vi.fn();
    const { container } = render(
      <WeeklyReviewCard
        days={days} targetKcal={3000} targetProteinG={180}
        weightLog={[{ date: '2026-03-02', weightKg: 80 }, { date: '2026-03-08', weightKg: 80 }]}
        goal="cutting" onApplyKcalAdjust={spy}
      />,
    );
    expect(container.querySelector('[data-weekly-review="1"]')!.getAttribute('data-verdict')).toBe('too_slow');
    const btn = container.querySelector('[data-wr-apply]') as HTMLElement;
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(spy).toHaveBeenCalledWith(-150);
  });

  it('on_track: кнопки нет', () => {
    const { container } = render(
      <WeeklyReviewCard
        days={days} targetKcal={3000} targetProteinG={180}
        weightLog={[{ date: '2026-03-02', weightKg: 80 }, { date: '2026-03-08', weightKg: 79.66 }]}
        goal="cutting" onApplyKcalAdjust={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-wr-apply]')).toBeNull();
    expect(container.querySelector('[data-wr-reco]')!.textContent || '').toMatch(/На курсе/);
  });

  it('пусто (нет логов) → карточка не рендерится', () => {
    const { container } = render(
      <WeeklyReviewCard days={[]} targetKcal={3000} targetProteinG={180} weightLog={[]} goal="cutting" />,
    );
    expect(container.querySelector('[data-weekly-review="1"]')).toBeNull();
  });
});
