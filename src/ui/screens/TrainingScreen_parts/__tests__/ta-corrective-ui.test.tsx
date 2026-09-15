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
