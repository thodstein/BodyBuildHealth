import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { RefeedCalendarCard } from '../RefeedCalendarCard';

beforeEach(() => { localStorage.clear(); cleanup(); vi.unstubAllGlobals(); });

describe('RefeedCalendarCard', () => {
  it('сушка: рендерит недели + запись в календарь спецприёмов', () => {
    const { container } = render(<RefeedCalendarCard goal="cutting" startDate="2026-03-02" bodyFatPct={8} />);
    expect(container.querySelector('[data-refeed-calendar="1"]')!.getAttribute('data-mode')).toBe('cut');
    expect(container.querySelectorAll('[data-refeed-week]').length).toBeGreaterThan(0);
    fireEvent.click(container.querySelector('[data-refeed-apply]') as HTMLElement);
    const stored = JSON.parse(localStorage.getItem('he_special_meals') || '[]');
    expect(Array.isArray(stored)).toBe(true);
    expect(stored.some((m: any) => m.type === 'refeed')).toBe(true);
  });

  it('диет-брейк-неделя пишется как 7 дней type=diet_break', () => {
    const { container } = render(<RefeedCalendarCard goal="cutting" startDate="2026-03-02" bodyFatPct={8} />);
    // горизонт по умолчанию 8; BF 8 → брейк каждые 8 недель → 8-я неделя брейк.
    fireEvent.click(container.querySelector('[data-refeed-horizon="8"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-refeed-apply]') as HTMLElement);
    const stored = JSON.parse(localStorage.getItem('he_special_meals') || '[]');
    const breaks = stored.filter((m: any) => m.type === 'diet_break');
    expect(breaks.length).toBe(7);
  });

  it('горизонт переключается', () => {
    const { container } = render(<RefeedCalendarCard goal="cutting" startDate="2026-03-02" bodyFatPct={12} />);
    expect(container.querySelectorAll('[data-refeed-week]').length).toBe(8);
    fireEvent.click(container.querySelector('[data-refeed-horizon="12"]') as HTMLElement);
    expect(container.querySelectorAll('[data-refeed-week]').length).toBe(12);
  });

  it('масса → карточка не рендерится', () => {
    const { container } = render(<RefeedCalendarCard goal="mass" startDate="2026-03-02" bodyFatPct={12} />);
    expect(container.querySelector('[data-refeed-calendar="1"]')).toBeNull();
  });
});
