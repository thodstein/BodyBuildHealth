import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrthoScreenCard } from '../OrthoScreenCard';

describe('OrthoScreenCard', () => {
  afterEach(() => { try { delete (window as any).open; } catch {} });
  it('рендерится со сводкой и сохраняет в профиль', () => {
    render(<OrthoScreenCard />);
    expect(screen.getByText(/Орто-скрининг J1–J7/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Боль 60–120° при подъёме/));
    fireEvent.click(screen.getByText(/Боль при провокации Hawkins/));
    expect(screen.getByText(/кластер положительный/)).toBeTruthy();
    fireEvent.click(screen.getByText(/В профиль \+ историю/));
    expect(screen.getByRole('status').textContent).toMatch(/Сохранено/);
  });
  it('compact — без чеков, с гардами при кластере', () => {
    render(<OrthoScreenCard compact />);
    expect(screen.queryByText(/Боль 60–120° при подъёме/)).toBeNull();
    expect(screen.getByText(/скрининг, не диагноз/)).toBeTruthy();
  });
  it('hop-замеры считают живой LSI', () => {
    render(<OrthoScreenCard />);
    fireEvent.change(screen.getByLabelText('Hop Single L, см'), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText('Hop Single R, см'), { target: { value: '200' } });
    expect(screen.getByText(/итог 75%/)).toBeTruthy();
  });
  it('печать открывает окно (фолбэк — копия HTML)', () => {
    const write = vi.fn();
    const close = vi.fn();
    const print = vi.fn();
    const focus = vi.fn();
    (window as any).open = vi.fn(() => ({ document: { write, close }, print, focus }));
    render(<OrthoScreenCard />);
    fireEvent.click(screen.getByText('🖨 Печать'));
    expect((window as any).open).toHaveBeenCalled();
    expect(print).toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/Печать открыта/);
  });
});
