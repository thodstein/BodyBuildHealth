import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { StrongmanDiagnosticsHub } from '../StrongmanDiagnosticsHub';

beforeEach(() => {
  localStorage.clear();
  (HTMLCanvasElement.prototype as any).getContext = vi.fn(() => null);
});

describe('StrongmanDiagnosticsHub PRO', () => {
  it('рендерит заголовок и 6 вкладок', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    expect(container.textContent).toContain('Стронгмен-диагностика');
    expect(screen.getAllByText(/Жим/).length).toBeGreaterThan(0);
    expect(document.querySelector('[data-sm="top-tab-carry"]')).toBeTruthy();
    expect(document.querySelector('[data-sm="top-tab-load"]')).toBeTruthy();
    expect(screen.getAllByText(/Хват\/Кор/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Мобильность/).length).toBeGreaterThan(0);
    expect(document.querySelector('[data-sm="top-tab-video"]')).toBeTruthy();
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
  it('таб Мобильность рендерит OHS', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(document.querySelector('[data-sm="top-tab-mobility"]') as HTMLElement);
    expect(document.body.textContent).toContain('OHS');
    expect(document.body.textContent).toContain('Knee-to-wall');
  });
  it('таб Видео рендерит Kinovea', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(document.querySelector('[data-sm="top-tab-video"]') as HTMLElement);
    expect(document.body.textContent).toContain('Kinovea');
    expect(document.body.textContent).toContain('Sway');
  });
  it('биомеханика отображается при выборе', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(await screen.findByText(/Жим\/лог: старт/));
    expect(document.body.textContent).toContain('McGill');
  });
  it('VBT поля в Жим и Переноски', async () => {
    const { container } = render(<StrongmanDiagnosticsHub />);
    expect(container.textContent).toContain('VBT лог');
    fireEvent.click(document.querySelector('[data-sm="top-tab-carry"]') as HTMLElement);
    expect(document.body.textContent).toContain('VBT йок');
  });
  it('хват tri-modal 3 поля', async () => {
    render(<StrongmanDiagnosticsHub />);
    fireEvent.click(document.querySelector('[data-sm="top-tab-grip"]') as HTMLElement);
    expect(document.body.textContent).toContain('Support');
    expect(document.body.textContent).toContain('Pinch');
    expect(document.body.textContent).toContain('Crush');
  });
});
