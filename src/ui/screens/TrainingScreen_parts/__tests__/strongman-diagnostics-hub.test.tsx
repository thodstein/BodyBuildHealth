import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { StrongmanDiagnosticsHub } from '../StrongmanDiagnosticsHub';

beforeEach(() => { localStorage.clear(); });

describe('StrongmanDiagnosticsHub PRO', () => {
  it('рендерит заголовок и 4 вкладки', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    expect(container.textContent).toContain('Стронгмен-диагностика');
    expect(screen.getAllByText(/Жим/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Переноски/)).toBeTruthy();
    expect(screen.getByText(/Загрузки/)).toBeTruthy();
    expect(screen.getByText(/Хват\/Кор/)).toBeTruthy();
  });
  it('выбор жим слабых', async () => {
    render(<StrongmanDiagnosticsHub />);
    const btn = await screen.findByText(/Жим\/лог: старт/);
    fireEvent.click(btn);
    expect(document.body.textContent).toContain('press_start');
  });
  it('применить без выбора — тост', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    const btns = screen.getAllByText(/Применить в Стронг/);
    fireEvent.click(btns[btns.length - 1]);
    await waitFor(() => expect(container.textContent).toContain('не выбраны'), { timeout: 2000 });
  });
  it('применить с выбором — bridge', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    const btns = screen.getAllByText(/Применить в Стронг/);
    fireEvent.click(btns[btns.length - 1]);
    await waitFor(() => expect(document.body.textContent).toContain('Применено'), { timeout: 2000 });
    expect(localStorage.getItem('he_planner_apply')).toContain('weakpoints');
  });
});
