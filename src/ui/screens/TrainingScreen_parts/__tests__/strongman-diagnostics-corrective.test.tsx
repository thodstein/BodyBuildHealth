import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { StrongmanDiagnosticsHub } from '../StrongmanDiagnosticsHub';

beforeEach(() => {
  localStorage.clear();
  (HTMLCanvasElement.prototype as any).getContext = vi.fn(() => null);
});

describe('StrongmanDiagnosticsHub corrective + bottom nav', () => {
  it('нижний док навигации: 7 табов, закреплён внизу', () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    const dock = container.querySelector('[data-sm="bottom-nav"]');
    expect(dock).toBeTruthy();
    expect((dock as HTMLElement).style.position).toBe('sticky');
    expect((dock as HTMLElement).style.bottom).toBe('0px');
    for (const id of ['press', 'carry', 'load', 'grip', 'mobility', 'video', 'correction']) {
      expect(dock!.querySelector(`[data-sm="bottom-tab-${id}"]`)).toBeTruthy();
    }
  });
  it('таб Коррекция: пустое состояние без фаз', () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(container.querySelector('[data-sm="bottom-tab-correction"]')!);
    expect(document.body.textContent).toContain('Выбери 1–4 слабые фазы');
  });
  it('таб Коррекция: фаза → причина → топ с дозой/кью/прогрессией + сессия + волна', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="bottom-tab-correction"]')!);
    await waitFor(() => expect(document.body.querySelector('[data-sm="corr-card"]')).toBeTruthy());
    const card = document.body.textContent || '';
    expect(card).toContain('Доза:');
    expect(card).toContain('Кью:');
    expect(card).toContain('Прогрессия:');
    expect(card).toContain('Источник:');
    expect(document.body.querySelector('[data-sm="corr-session"]')).toBeTruthy();
    expect(document.body.querySelector('[data-sm="corr-block"]')).toBeTruthy();
  });
  it('кнопка коррекции пишет мост с smCorrections', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    fireEvent.click(container.querySelector('[data-sm="bottom-tab-correction"]')!);
    const btn = await screen.findByText(/Коррекцию в Стронг/);
    fireEvent.click(btn);
    await waitFor(() => expect(document.body.textContent).toContain('Применено'), { timeout: 2000 });
    expect(localStorage.getItem('he_planner_apply')).toContain('smCorrections');
  });
});
