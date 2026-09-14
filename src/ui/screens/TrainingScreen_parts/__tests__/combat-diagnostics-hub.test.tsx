import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CombatDiagnosticsHub } from '../CombatDiagnosticsHub';

/** P7 шелл: 6 табов, замеры → вердикт, мост заблокирован при redflag. */
describe('CombatDiagnosticsHub shell', () => {
  it('рендер: шапка + 6 табов', () => {
    const { container } = render(<CombatDiagnosticsHub />);
    expect(container.querySelector("[data-combat='hub-root']")).not.toBeNull();
    expect(container.querySelectorAll("[data-combat^='hub-tab-']").length).toBe(6);
    expect(screen.getByText(/Диагностика единоборств/)).toBeTruthy();
  });

  it('замер скорости кросса меняет итог', () => {
    render(<CombatDiagnosticsHub />);
    fireEvent.change(screen.getByLabelText(/Скорость Кросс/), { target: { value: '8' } });
    fireEvent.click(screen.getByText(/📋 Итог/));
    expect(screen.getByText(/Слабейший удар/)).toBeTruthy();
  });

  it('redflag блокирует мост честным сообщением', () => {
    render(<CombatDiagnosticsHub />);
    fireEvent.click(screen.getByText(/🛡 Безопасность/));
    fireEvent.change(screen.getByLabelText(/Сотрясения за год/), { target: { value: '1' } });
    fireEvent.click(screen.getByText(/📋 Итог/));
    fireEvent.click(screen.getByText(/Применить в конструктор/));
    expect(screen.getByRole('status').textContent).toMatch(/заблокирован/);
  });
});
