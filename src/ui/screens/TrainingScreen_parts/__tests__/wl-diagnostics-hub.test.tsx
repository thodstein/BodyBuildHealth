import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { WLDiagnosticsHub } from '../WLDiagnosticsHub';

beforeEach(() => { localStorage.clear(); });

describe('WLDiagnosticsHub PRO', () => {
  it('рендерит заголовок и 4 вкладки', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    expect(container.textContent).toContain('ТА-диагностика');
    expect(screen.getAllByText(/Рывок/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Взятие/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Толчок/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Мобильность/)).toBeTruthy();
  });
  it('выбор слабых фаз рывка', async () => {
    render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    const btn = await screen.findByText(/Рывок: отрыв/);
    fireEvent.click(btn);
    expect(await screen.findByText(/deficit_snatch/)).toBeTruthy();
  });
  it('применить без выбора — тост', async () => {
    const { container } = render(<WLDiagnosticsHub />);
    const btns = screen.getAllByText(/Применить в ТА-конструктор/);
    fireEvent.click(btns[btns.length - 1]);
    await waitFor(() => expect(container.textContent).toContain('не выбраны'), { timeout: 2000 });
  });
  it('применить с выбором — bridge', async () => {
    render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getAllByText(/Рывок/)[0]);
    fireEvent.click(await screen.findByText(/Рывок: отрыв/));
    await screen.findByText(/deficit_snatch/);
    const btns = screen.getAllByText(/Применить в ТА-конструктор/);
    fireEvent.click(btns[btns.length - 1]);
    await waitFor(() => expect(document.body.textContent).toContain('Применено'), { timeout: 2000 });
    expect(localStorage.getItem('he_planner_apply')).toContain('weakpoints');
  });
});
