import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WLDiagnosticsHub } from '../WLDiagnosticsHub';

describe('ta corrective tab UI', () => {
  it('таб Коррекция есть и просит выбрать фазы', () => {
    render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🛠️ Коррекция' }));
    expect(screen.getByText(/Коррекция движений — структурировано/)).toBeTruthy();
  });
  it('выбор фазы + таб Коррекция показывает упражнения с дозами и ⭐', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
    fireEvent.click(screen.getByText('Рывок: уход под штангу'));
    fireEvent.click(screen.getByRole('button', { name: '🛠️ Коррекция' }));
    const picks = container.querySelectorAll('[data-wl="corrective-pick"]');
    expect(picks.length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector('[data-wl="corrective"]')?.textContent).toMatch(/@/);
  });
  it('замер петли в Видео даёт хинт с упражнениями и переходом', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
    fireEvent.change(screen.getByPlaceholderText('xLoop см'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: '📹 Видео' }));
    const hint = container.querySelector('[data-wl="corrective-video"]');
    expect(hint).toBeTruthy();
    expect(hint?.textContent).toMatch(/Рывковая тяга|рывок с дефицита/i);
    fireEvent.click(screen.getByRole('button', { name: /Открыть Коррекцию/ }));
    expect(container.querySelector('[data-wl="corrective"]')).toBeTruthy();
  });
  it('петля ≤4 — хинта нет (молчим на шум)', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
    fireEvent.change(screen.getByPlaceholderText('xLoop см'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: '📹 Видео' }));
    expect(container.querySelector('[data-wl="corrective-video"]')).toBeNull();
  });
  it('мобильность-причина даёт хинт в Мобильности с переходом', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🧘 Мобильность' }));
    fireEvent.click(screen.getByRole('button', { name: 'OHS: Пятки плоско' }));
    fireEvent.click(screen.getByRole('button', { name: 'OHS: Колени без вальгуса' }));
    fireEvent.click(screen.getByRole('button', { name: '🏋️ Рывок' }));
    fireEvent.click(screen.getByText('Рывок: фиксация в седе'));
    fireEvent.click(screen.getByRole('button', { name: '🧘 Мобильность' }));
    const hint = container.querySelector('[data-wl="corrective-mobility"]');
    expect(hint).toBeTruthy();
    expect(hint?.textContent).toMatch(/щадящие дозы/);
    fireEvent.click(screen.getByRole('button', { name: /Открыть Коррекцию/ }));
    expect(container.querySelector('[data-wl="corrective"]')).toBeTruthy();
  });
  it('клик ⭐ ставит preferred и показывает сессию + вставку', () => {
    const { container } = render(<WLDiagnosticsHub />);
    fireEvent.click(screen.getByRole('button', { name: '🦾 Толчок' }));
    fireEvent.click(screen.getByText('Толчок: подсед'));
    fireEvent.click(screen.getByRole('button', { name: '🛠️ Коррекция' }));
    const star = container.querySelector('[data-wl="corrective-pick"] button') as HTMLElement;
    expect(star).toBeTruthy();
    fireEvent.click(star);
    expect(container.querySelector('[data-wl="corrective"]')?.textContent).toMatch(/Коррекционная сессия/);
    expect(container.querySelector('[data-wl="inject"]')).toBeTruthy();
  });
});
