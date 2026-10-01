/**
 * nutrition-periodization-card.test.tsx — UI-лок карточки «🍽 Периодизация питания».
 *
 * Проверяет: general-режим (горизонт/недели/дни), переключение горизонта,
 * prep-режим (🏁 Весь преп + фазы), раскрытие недели.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NutritionPeriodizationCard } from '../NutritionPeriodizationCard';
import { buildBBContestPrepPlan, isoToday, isoAddDays, type BBContestPrepConfig } from '../../../../../engines/bb/bb-contest-prep.engine';

const baseProps = {
  prepPlan: null as any,
  base: { kcal: 3000, proteinG: 180, fatG: 75, carbsG: 350, waterMl: 3500, sodiumMg: 3500 },
  goal: 'cutting' as const,
  carbPeriodization: 'carb_cycle' as const,
  isTrainingDayForOffset: (offset: number) => [0, 2, 4].includes(((offset % 7) + 7) % 7),
  heavyTrainDay: null as string | null,
  dayLabels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  todayIso: '2026-03-02',
};

function prepCfg(over: Partial<BBContestPrepConfig> = {}): BBContestPrepConfig {
  return {
    sex: 'male', category: 'mens_physique', weightKg: 85, bodyFatPct: 8,
    experienceLevel: 'intermediate', enhanced: false, prepCount: 2,
    showDate: isoAddDays(isoToday(), 120), weeksOut: 2, trainingProtocol: 'bb',
    carbLoadStrategy: 'moderate', waterStrategy: 'minimal', sodiumStrategy: 'constant', ...over,
  };
}

describe('Карточка периодизации питания', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  });

  it('general: рендерит горизонт, недели и раскрытую неделю 1 с днями', () => {
    const { container } = render(<NutritionPeriodizationCard {...baseProps} />);
    const root = container.querySelector('[data-periodization="1"]');
    expect(root).toBeTruthy();
    expect(root!.getAttribute('data-mode')).toBe('general');
    expect(root!.getAttribute('data-horizon')).toBe('4');
    // 4 недели в таблице.
    expect(container.querySelectorAll('[data-week]')).toHaveLength(4);
    // Неделя 1 открыта по умолчанию — 7 дней.
    expect(container.querySelectorAll('[data-day]')).toHaveLength(7);
    // Сводка и заметки.
    expect(container.querySelector('[data-periodization-summary]')).toBeTruthy();
    expect(container.querySelector('[data-periodization-notes]')).toBeTruthy();
  });

  it('general: переключение горизонта меняет число недель', () => {
    const { container } = render(<NutritionPeriodizationCard {...baseProps} />);
    fireEvent.click(container.querySelector('[data-horizon-btn="8"]') as HTMLElement);
    expect(container.querySelector('[data-periodization="1"]')!.getAttribute('data-horizon')).toBe('8');
    expect(container.querySelectorAll('[data-week]')).toHaveLength(8);
  });

  it('general: клик по неделе 2 раскрывает её дни', () => {
    const { container } = render(<NutritionPeriodizationCard {...baseProps} />);
    const w2 = container.querySelector('[data-week="2"]') as HTMLElement;
    fireEvent.click(w2);
    // Дни недели 2 — 7 штук (неделя 1 закрылась).
    expect(container.querySelectorAll('[data-day]')).toHaveLength(7);
    expect(container.querySelector('[data-day="2026-03-09"]')).toBeTruthy();
  });

  it('specialMeals: запланированный читмил виден меткой в дне', () => {
    const { container } = render(
      <NutritionPeriodizationCard {...baseProps} specialMeals={[{ date: '2026-03-04', type: 'cheat_meal' }]} />,
    );
    const day = container.querySelector('[data-day="2026-03-04"]');
    expect(day).toBeTruthy();
    expect(day!.textContent || '').toContain('🍔');
  });

  it('prep: режим prep, кнопка «Весь преп», фазы подготовки', () => {
    const plan = buildBBContestPrepPlan(prepCfg(), { prepWeeks: 12, taperWeeks: 2 });
    const { container } = render(<NutritionPeriodizationCard {...baseProps} prepPlan={plan} todayIso={plan.preparation.startDate} />);
    const root = container.querySelector('[data-periodization="1"]');
    expect(root!.getAttribute('data-mode')).toBe('prep');
    expect(screen.getByText(/Весь преп/)).toBeTruthy();
    // Сводка содержит недели подготовки.
    const summary = container.querySelector('[data-periodization-summary]')!.textContent || '';
    expect(summary).toMatch(/подготовка/);
  });
});
