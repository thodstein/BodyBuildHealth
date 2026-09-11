import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { StrongmanVideoGoniometer } from '../StrongmanVideoGoniometer';

beforeEach(() => {
  // jsdom без canvas-пакета: drawMarkers идёт null-веткой (в проде ctx живой)
  (HTMLCanvasElement.prototype as any).getContext = vi.fn(() => null);
});

const TAP = 'Отметить точку';

describe('StrongmanVideoGoniometer', () => {
  it('рендерит съёмку, галерею и канвас', () => {
    render(<StrongmanVideoGoniometer lift="yoke_walk" onAppend={() => {}} />);
    expect(screen.getByText(/Снять камерой/)).toBeTruthy();
    expect(screen.getByText(/Видео из галереи/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Отметить точку/ })).toBeTruthy();
  });
  it('6 тапов дают углы и строку в таблицу', () => {
    const onAppend = vi.fn();
    const { container } = render(<StrongmanVideoGoniometer lift="yoke_walk" onAppend={onAppend} />);
    const canvas = container.querySelector('canvas')!;
    // Вертикальная фигура: таз(150,40) колено(150,100) голеностоп(150,160) стопа(170,160) плечо(150,10) локоть(180,10)
    const pts = [[150, 40], [150, 100], [150, 160], [170, 160], [150, 10], [180, 10]];
    for (const [x, y] of pts) {
      fireEvent.click(canvas, { clientX: x, clientY: y });
    }
    expect(screen.getByText(/Все 6 точек отмечены/)).toBeTruthy();
    expect(document.body.textContent).toContain('Углы:');
    const add = screen.getByText(/В таблицу углов/);
    fireEvent.click(add);
    expect(onAppend).toHaveBeenCalledTimes(1);
    const row = onAppend.mock.calls[0][0] as string;
    expect(row.split(',')).toHaveLength(5);
    expect(row.split(',').slice(1).every(v => Number.isFinite(parseFloat(v)))).toBe(true);
  });
  it('сброс очищает точки', () => {
    const { container } = render(<StrongmanVideoGoniometer lift="log_press" onAppend={() => {}} />);
    const canvas = container.querySelector('canvas')!;
    fireEvent.click(canvas, { clientX: 10, clientY: 10 });
    expect(screen.getByText(/Тапни:/).textContent).toContain('2/6');
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить точки' }));
    expect(screen.getByText(/Тапни:/).textContent).toContain('1/6');
  });
  it('без всех точек кнопки добавления нет', () => {
    render(<StrongmanVideoGoniometer lift="yoke_walk" onAppend={() => {}} />);
    expect(screen.queryByText(/В таблицу углов/)).toBeNull();
  });
  it(TAP + ' доступен скринридеру', () => {
    render(<StrongmanVideoGoniometer lift="yoke_walk" onAppend={() => {}} />);
    expect(screen.getByRole('button', { name: /Отметить точку: Таз/ })).toBeTruthy();
  });
});
